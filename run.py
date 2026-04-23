"""
BioSync V2 - System Launcher & Health Checker
================================================
This script validates ALL services (Node.js, Supabase, Google Fit, OpenAI),
installs missing dependencies, starts the backend gateway, and opens the dashboard.

Usage:  python run.py
"""

import os
import sys
import subprocess
import time
import webbrowser
import json
import socket

# --- Discover Node.js path ---
NODE_DIR = None
POSSIBLE_PATHS = [
    os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "nodejs"),
    os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "nodejs"),
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "nodejs"),
    os.path.join(os.environ.get("APPDATA", ""), "nvm", "current"),
]
for p in POSSIBLE_PATHS:
    if os.path.isfile(os.path.join(p, "node.exe")):
        NODE_DIR = p
        break

# Inject into PATH if found
if NODE_DIR and NODE_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = NODE_DIR + os.pathsep + os.environ.get("PATH", "")

# --- ANSI Colors ---
class C:
    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    RESET  = "\033[0m"

def ok(msg):    print(f"  {C.GREEN}[OK] {msg}{C.RESET}")
def fail(msg):  print(f"  {C.RED}[FAIL] {msg}{C.RESET}")
def warn(msg):  print(f"  {C.YELLOW}[WARN] {msg}{C.RESET}")
def info(msg):  print(f"  {C.CYAN}  -> {msg}{C.RESET}")
def header(msg): print(f"\n{C.BOLD}{C.BLUE}{'='*50}\n  {msg}\n{'='*50}{C.RESET}")

# --- 1. Environment Variables ---
def check_env():
    header("1 . Environment Variables (.env)")
    if not os.path.exists(".env"):
        fail(".env file not found! Create one with your API keys.")
        return False

    env = {}
    with open(".env", "r") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()

    required = {
        "OPENAI_API_KEY":        ("OpenAI GPT-4o-mini for nutrition analysis", 10),
        "SUPABASE_URL":          ("Supabase project URL", 10),
        "SUPABASE_ANON_KEY":     ("Supabase anonymous key", 10),
        "GOOGLE_FIT_CLIENT_ID":  ("Google Cloud OAuth client ID", 10),
        "GOOGLE_FIT_CLIENT_SECRET": ("Google Cloud OAuth client secret", 5),
    }

    all_ok = True
    for key, (desc, min_len) in required.items():
        val = env.get(key, "")
        if len(val) >= min_len:
            ok(f"{key} - {desc}")
        else:
            fail(f"{key} - MISSING or too short")
            info(f"  Expected: {desc}")
            all_ok = False

    return all_ok, env

# --- 2. Node.js ---
def check_node():
    header("2 . Node.js Runtime")
    try:
        result = subprocess.run(["node", "-v"], capture_output=True, text=True, shell=True)
        version = result.stdout.strip()
        if version:
            ok(f"Node.js {version} detected")
            return True
        else:
            fail("Node.js not found in PATH")
            info("Download from: https://nodejs.org/en/download/")
            return False
    except FileNotFoundError:
        fail("Node.js is not installed")
        info("Download from: https://nodejs.org/en/download/")
        return False

# --- 3. NPM Dependencies ---
def check_deps():
    header("3 . NPM Dependencies")
    if os.path.exists("node_modules"):
        ok("node_modules/ found")
        return True
    else:
        warn("node_modules/ not found - installing now...")
        try:
            subprocess.run(["npm", "install"], check=True, shell=True)
            ok("Dependencies installed successfully")
            return True
        except subprocess.CalledProcessError:
            fail("npm install failed - check package.json")
            return False

# --- 4. Supabase Connectivity ---
def check_supabase(env):
    header("4 . Supabase Cloud Database")
    url = env.get("SUPABASE_URL", "")
    key = env.get("SUPABASE_ANON_KEY", "")

    if not url or not key:
        fail("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env")
        return False

    try:
        # DNS CHECK FIRST
        hostname = url.replace("https://", "").replace("http://", "").split("/")[0]
        try:
            socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            fail(f"Supabase DNS Error: Cannot resolve {hostname}")
            info("   -> This usually means your INTERNET IS DOWN or there is a TYPO in the SUPABASE_URL.")
            info("   -> TIP: If your internet is unstable, try running 'ipconfig /flushdns' or restarting your router.")
            info("   -> Check if you can visit your Supabase dashboard in your browser.")
            return False

        import urllib.request
        import urllib.error

        # Ping the Supabase REST API (returns table list or auth error - both mean it's reachable)
        req = urllib.request.Request(
            f"{url}/rest/v1/",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}"
            }
        )
        response = urllib.request.urlopen(req, timeout=10)
        status = response.getcode()
        if status == 200:
            ok(f"Supabase reachable at {url}")
            ok(f"HTTP {status} - Database API is live")
            return True
        else:
            warn(f"Supabase returned HTTP {status}")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 401:
            ok(f"Supabase reachable at {url} (Authenticated Rejected, but server is live)")
            return True
        elif e.code == 404:
            warn(f"Supabase returned 404 - URL might be wrong, but server is reachable")
            return True
        else:
            fail(f"Supabase HTTP Error: {e.code} {e.reason}")
        return False
    except urllib.error.URLError as e:
        fail(f"Network Error reaching Supabase: {e.reason}")
        return False
    except Exception as e:
        fail(f"Generic Failure checking Supabase: {e}")
        return False

# --- 5. Google Fit Credentials ---
def check_google(env):
    header("5 . Google Fit OAuth Credentials")
    client_id = env.get("GOOGLE_FIT_CLIENT_ID", "")
    client_secret = env.get("GOOGLE_FIT_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        fail("Missing GOOGLE_FIT_CLIENT_ID or GOOGLE_FIT_CLIENT_SECRET")
        return False

    if ".apps.googleusercontent.com" in client_id:
        ok(f"Client ID format valid (ends with .apps.googleusercontent.com)")
    else:
        warn("Client ID doesn't look like a standard Google OAuth client ID")

    if client_secret.startswith("GOCSPX-"):
        ok(f"Client Secret format valid (GOCSPX- prefix)")
    else:
        warn("Client Secret doesn't match expected GOCSPX- prefix format")

    # Try to reach Google's OAuth discovery endpoint
    try:
        import urllib.request
        req = urllib.request.Request("https://accounts.google.com/.well-known/openid-configuration")
        response = urllib.request.urlopen(req, timeout=10)
        if response.getcode() == 200:
            ok("Google OAuth endpoint reachable")
            return True
    except Exception as e:
        fail(f"Cannot reach Google OAuth: {e}")
        return False

    return True

# --- 6. OpenAI Key Quick Check ---
def check_openai(env):
    header("6 . OpenAI API Key")
    key = env.get("OPENAI_API_KEY", "")
    if not key:
        fail("Missing OPENAI_API_KEY")
        return False

    if key.startswith("sk-"):
        ok("API key format looks valid (sk- prefix)")
    else:
        warn("Key doesn't start with 'sk-' - may be invalid")

    # Quick models list check
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"}
        )
        response = urllib.request.urlopen(req, timeout=10)
        if response.getcode() == 200:
            ok("OpenAI API is authenticated and reachable")
            return True
    except Exception as e:
        error_str = str(e)
        if "401" in error_str:
            fail("OpenAI returned 401 - API key is invalid or expired")
        elif "429" in error_str:
            warn("OpenAI returned 429 - Rate limited but key is valid")
            return True
        else:
            fail(f"OpenAI check failed: {e}")
            info("   -> TIP: DNS failures (getaddrinfo) are common on unstable internet.")
            info("   -> Try flushing your DNS or checking your connection status.")
        return False

    return True

# --- 7. Port Management ---
def clear_port_conflict(port=3000):
    """Kills any process currently blocking the specified port (Windows Only)."""
    try:
        # Get PID using netstat
        cmd = f'netstat -ano | findstr LISTENING | findstr :{port}'
        output = subprocess.check_output(cmd, shell=True).decode()
        if output:
            pids = set()
            for line in output.strip().split('\n'):
                parts = line.split()
                if len(parts) > 4:
                    pids.add(parts[-1])
            
            for pid in pids:
                warn(f"Port {port} is blocked by PID {pid}. Cleaning up...")
                subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            ok(f"Port {port} cleared successfully.")
            return True
    except subprocess.CalledProcessError:
        # netstat returns 1 if findstr fails to find anything - this is GOOD
        return True
    except Exception as e:
        warn(f"Could not automatically clear port {port}: {e}")
    return False

# --- 8. Launch Server ---
def launch_server():
    header("7 . Launching BioSync Gateway")
    
    # Step 0: Ensure port is clean
    clear_port_conflict(3000)
    
    try:
        server = subprocess.Popen(
            ["node", "server.js"],
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        time.sleep(2)

        # Check if it crashed immediately
        if server.poll() is not None:
            output = server.stdout.read().decode()
            fail(f"Server crashed on startup:\n{output}")
            return None

        ok("Express server started on port 3000")
        return server
    except Exception as e:
        fail(f"Failed to start server: {e}")
        return None

# --- Main ---
def main():
    print(f"""
{C.BOLD}{C.CYAN}
    ____  _       ____                   
   | __ )(_) ___ / ___| _   _ _ __   ___ 
   |  _ \\| |/ _ \\\\___ \\| | | | '_ \\ / __|
   | |_) | | (_) |___) | |_| | | | | (__ 
   |____/|_|\\___/|____/ \\__, |_| |_|\\___|
                        |___/            
{C.RESET}{C.DIM}    Health Intelligence Platform - System Launcher v2.0{C.RESET}
""")

    # Step 1: Env
    env_ok, env = check_env()

    # Step 2: Node
    node_ok = check_node()

    # Step 3: Deps (only if Node exists)
    deps_ok = check_deps() if node_ok else False

    # Step 4: Supabase
    supa_ok = check_supabase(env) if env_ok else False

    # Step 5: Google
    google_ok = check_google(env) if env_ok else False

    # Step 6: OpenAI
    openai_ok = check_openai(env) if env_ok else False

    # --- Summary ---
    header("SYSTEM STATUS SUMMARY")
    checks = {
        "Environment (.env)": env_ok,
        "Node.js Runtime":    node_ok,
        "NPM Dependencies":   deps_ok,
        "Supabase Database":  supa_ok,
        "Google Fit OAuth":   google_ok,
        "OpenAI Nutrition":   openai_ok,
    }

    all_critical = True
    for name, status in checks.items():
        if status:
            ok(name)
        else:
            fail(name)
            if name in ["Environment (.env)", "Node.js Runtime", "NPM Dependencies"]:
                all_critical = False

    if not all_critical:
        print(f"\n  {C.RED}{C.BOLD}Cannot launch - critical dependencies missing.{C.RESET}")
        sys.exit(1)

    # Step 7: Launch
    server = launch_server()
    if server:
        info("Opening dashboard in browser...")
        dashboard_url = "http://localhost:3000"
        webbrowser.open(dashboard_url)

        print(f"\n  {C.GREEN}{C.BOLD}BioSync V2 is running!{C.RESET}")
        print(f"  {C.DIM}Server:    {dashboard_url}{C.RESET}")
        print(f"  {C.DIM}Dashboard: {dashboard_url}{C.RESET}")
        print(f"\n  {C.YELLOW}Press Ctrl+C to stop the server.{C.RESET}\n")

        try:
            server.wait()
        except KeyboardInterrupt:
            print(f"\n  {C.RED}Shutting down BioSync...{C.RESET}")
            server.terminate()
            server.wait()
            ok("Server stopped cleanly.")
    else:
        fail("System failed to start.")
        sys.exit(1)

if __name__ == "__main__":
    main()
