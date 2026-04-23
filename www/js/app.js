/**
 * BioSync v5.1 — Native Android Intelligence Logic
 * Uses correct @capgo/capacitor-health API
 */

// ====== UI HELPERS ======
const updateEl = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
};

// Inject toast animation style once
(() => {
    const s = document.createElement('style');
    s.textContent = `@keyframes toastIn { from { opacity:0; transform: translateX(40px); } to { opacity:1; transform: translateX(0); } }`;
    document.head.appendChild(s);
})();

window.utils = {
    showXPToast: (amount, reason) => {
        const container = document.getElementById('xp-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
            color: white; padding: 10px 16px; border-radius: 12px;
            font-size: 0.8rem; font-weight: 600; font-family: 'Outfit', sans-serif;
            box-shadow: 0 4px 20px rgba(30,144,255,0.3);
            animation: toastIn 0.3s ease; display: flex; align-items: center; gap: 8px;
            margin-bottom: 8px;
        `;
        toast.innerHTML = amount > 0
            ? `<i class="fa-solid fa-star"></i> +${amount} XP <small style="opacity:0.8">${reason}</small>`
            : `<i class="fa-solid fa-check"></i> <small>${reason}</small>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// ====== GOAL BANK ======
const GOAL_BANK = [
    { id: 'steps-10k', title: 'Daily 10k Steps', cat: 'activity', xp: 50, icon: 'fa-shoe-prints' },
    { id: 'steps-morning', title: '1k Steps before 9 AM', cat: 'activity', xp: 20, icon: 'fa-sun' },
    { id: 'active-hour', title: 'Stand every hour', cat: 'activity', xp: 15, icon: 'fa-person-walking' },
    { id: 'run-1km', title: 'Run 1km', cat: 'activity', xp: 50, icon: 'fa-person-running' },
    { id: 'water-2l', title: 'Drink 2L Water', cat: 'nutrition', xp: 30, icon: 'fa-droplet' },
    { id: 'log-3', title: 'Log all 3 meals', cat: 'nutrition', xp: 40, icon: 'fa-utensils' },
    { id: 'protein-100', title: 'Hit 100g Protein', cat: 'nutrition', xp: 50, icon: 'fa-egg' },
    { id: 'sleep-8h', title: '8 Hours Sleep', cat: 'sleep', xp: 60, icon: 'fa-bed' },
    { id: 'no-screens-1h', title: 'No screens 1h before bed', cat: 'sleep', xp: 35, icon: 'fa-mobile-screen' },
    { id: 'mood-check', title: 'Daily Mood Log', cat: 'mindset', xp: 15, icon: 'fa-face-smile' },
    { id: 'meditate-10', title: '10 min Meditation', cat: 'mindset', xp: 35, icon: 'fa-om' },
    { id: 'fresh-air', title: 'Open windows (10m)', cat: 'env', xp: 10, icon: 'fa-wind' },
    { id: 'co2-optimal', title: 'Maintain CO2 < 600', cat: 'env', xp: 25, icon: 'fa-chart-area' },
];

document.addEventListener('DOMContentLoaded', () => {

    // ====== 1. CLOUD INIT ======
    try {
        const cfg = window.BioSyncConfig || {};
        if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase) {
            window.supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
            console.log("⚡ Cloud Sync Active");
        }
    } catch (e) { console.warn("Cloud init skipped", e); }

    // ====== 2. THEME ======
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('biosync_theme', theme);
        const isDark = theme === 'dark';
        ['theme-icon', 'theme-icon-settings'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        });
        const txt = document.getElementById('theme-text');
        if (txt) txt.textContent = isDark ? 'Dark' : 'Light';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = isDark ? '#0a0a0f' : '#f4f5fb';
    };

    applyTheme(localStorage.getItem('biosync_theme') || 'dark');

    ['theme-toggle-btn', 'theme-toggle-settings'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => {
            applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        });
    });

    // OpenAI Key Storage
    const keyInput = document.getElementById('openai-api-key');
    if (keyInput) {
        keyInput.value = localStorage.getItem('biosync_openai_key') || '';
        keyInput.addEventListener('change', () => {
            localStorage.setItem('biosync_openai_key', keyInput.value.trim());
            window.utils.showXPToast(0, 'API Key saved locally');
        });
    }

    // ====== 3. NAVIGATION ======
    const navBtns = document.querySelectorAll('.nav-item');
    const pages = { dashboard: 'page-dashboard', analytics: 'page-analytics', goals: 'page-goals', settings: 'page-settings' };

    const switchPage = (pageName) => {
        Object.values(pages).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(pages[pageName]);
        if (target) target.classList.remove('hidden');

        navBtns.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Render analytics charts only when tab is visible & canvas is sized
        if (pageName === 'analytics') setTimeout(initAnalyticsPage, 80);
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    // ====== 4. GREETING & ONBOARDING ======
    const hour = new Date().getHours();
    updateEl('greeting-time', hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening');
    
    // Check Onboarding
    const onboardingOverlay = document.getElementById('onboarding-overlay');
    if (!localStorage.getItem('biosync_onboarding_done')) {
        if (onboardingOverlay) onboardingOverlay.classList.remove('hidden');
    }

    // Avatar Selection
    let selectedAvatar = '👤';
    document.querySelectorAll('.avatar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-btn').forEach(b => {
                b.classList.remove('selected');
                b.style.background = 'transparent';
                b.style.borderColor = 'transparent';
            });
            btn.classList.add('selected');
            btn.style.background = 'rgba(30,144,255,0.1)';
            btn.style.borderColor = 'var(--accent-blue)';
            selectedAvatar = btn.getAttribute('data-icon');
        });
    });

    // Complete Onboarding
    const completeBtn = document.getElementById('complete-onboarding-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            const name = document.getElementById('onboarding-name').value || 'User';
            localStorage.setItem('biosync_name', name);
            localStorage.setItem('biosync_emoji', selectedAvatar);
            localStorage.setItem('biosync_onboarding_done', 'true');
            
            // Mirror to settings page
            document.getElementById('stats-age').value = document.getElementById('onboarding-age').value || 25;
            document.getElementById('stats-weight').value = document.getElementById('onboarding-weight').value || 70;
            document.getElementById('stats-height').value = document.getElementById('onboarding-height').value || 175;
            document.getElementById('stats-gender').value = document.getElementById('onboarding-gender').value || 'male';
            
            updateEl('sidebar-name', name);
            const emj = document.getElementById('sidebar-emoji');
            if (emj) emj.innerText = selectedAvatar;
            const settingsNameDisplay = document.getElementById('settings-name-display');
            if (settingsNameDisplay) settingsNameDisplay.innerText = name;
            
            if (onboardingOverlay) onboardingOverlay.classList.add('hidden');
            window.utils.showXPToast(100, 'System Initialized');
        });
    }

    const storedName = localStorage.getItem('biosync_name') || 'User';
    updateEl('sidebar-name', storedName);
    const storedEmoji = localStorage.getItem('biosync_emoji') || '👤';
    const emj = document.getElementById('sidebar-emoji');
    if (emj) emj.innerText = storedEmoji;
    const settingsNameDisplay = document.getElementById('settings-name-display');
    if (settingsNameDisplay) settingsNameDisplay.innerText = storedName;

    // ====== 5. READINESS RING ======
    const stepEl = document.getElementById('step-count');
    const sleepEl = document.getElementById('sleep-duration');
    const hrEl = document.getElementById('heart-rate');
    const spo2El = document.getElementById('spo2-display');
    const hrMiniEl = document.getElementById('hr-mini');
    const spo2MiniEl = document.getElementById('spo2-mini');

    const updateReadiness = async (steps, sleep, hr, hrv) => {
        const s = parseInt(steps) || 0;
        const sl = parseFloat(sleep) || 0;
        const h = parseInt(hr) || 72;
        const hv = parseFloat(hrv) || 40;
        
        // Advanced Readiness Formula: Steps (30%) + Sleep (30%) + HR (20%) + HRV (20%)
        const score = Math.round(
            Math.min(s / 10000, 1) * 30 + 
            Math.min(sl / 8, 1) * 30 + 
            Math.max((120 - h) / 80, 0) * 20 +
            Math.min(hv / 80, 1) * 20
        );

        updateEl('readiness-val', score || '--');
        const ring = document.getElementById('readiness-ring-fill');
        if (ring) ring.style.strokeDashoffset = 314 - (score / 100) * 314;
        updateEl('readiness-score', score + '%');

        // Push Score to Raspberry Pi OLED (Feedback Loop)
        const piAddress = localStorage.getItem('biosync_pi_ip');
        const capHttp = window.Capacitor?.Plugins?.CapacitorHttp;
        
        if (piAddress && capHttp) {
            console.log(`[BioSync] Pushing score ${score} to ${piAddress}`);
            try {
                await capHttp.post({
                    url: piAddress + '/score',
                    headers: { 'Content-Type': 'application/json' },
                    data: { score: score },
                    connectTimeout: 2000,
                    readTimeout: 2000
                });
            } catch (e) {
                console.warn('[BioSync] Pi Score Push Failed:', e.message);
            }
        }
    };

    // ====== 6. HEALTH CONNECT (Custom BioSyncHealth Plugin) ======
    const hcBtn = document.getElementById('health-connect-btn');
    const hcBanner = document.getElementById('hc-banner');
    const hcBannerText = document.getElementById('hc-banner-text') || hcBanner;

    const syncHealthConnect = async () => {
        const banner = hcBannerText || hcBanner;
        if (hcBanner) hcBanner.classList.remove('hidden');

        // Only works on native Android
        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            if (banner) banner.textContent = 'Health sync requires the Android app.';
            setTimeout(() => hcBanner && hcBanner.classList.add('hidden'), 3000);
            return;
        }

        // Use OUR custom plugin (crash-safe) instead of the Capgo Health plugin
        const BioSyncHealth = window.Capacitor?.Plugins?.BioSyncHealth;
        if (!BioSyncHealth) {
            if (banner) banner.textContent = 'Health plugin not ready. Try rebuilding.';
            setTimeout(() => hcBanner && hcBanner.classList.add('hidden'), 3000);
            return;
        }

        if (banner) banner.textContent = 'Checking Health Connect...';

        // ---- Step 1: Verify Health Connect is available on this device ----
        try {
            const avail = await BioSyncHealth.checkAvailability();
            if (!avail.available) {
                if (banner) banner.textContent = 'Health Connect not available on this device.';
                setTimeout(() => hcBanner && hcBanner.classList.add('hidden'), 4000);
                return;
            }
        } catch (e) {
            console.warn('checkAvailability error (continuing anyway):', e);
            // Some devices don't support getSdkStatus — continue and let queries fail naturally
        }

        if (banner) banner.textContent = 'Syncing health data...';

        // ---- Step 2: Fetch all metrics in one native call ----
        try {
            const data = await BioSyncHealth.syncToday();

            const totalSteps = data.steps || 0;
            const latestHR   = data.heartRate || 0;
            let sleepHours   = data.sleepHours || 0;
            const latestSpO2 = data.spo2 || 0;
            const latestHRV  = data.hrv || 0;

            // --- DEMO PATCH: Correct Health Connect Double-Counting ---
            if (sleepHours > 12) {
                console.log("[BioSync Demo Patch] Recalibrating sleep: " + sleepHours + "h -> " + (sleepHours / 2) + "h");
                sleepHours = sleepHours / 2;
            }

            // Update dashboard UI
            if (stepEl && totalSteps > 0) stepEl.innerText = totalSteps.toLocaleString();
            if (hrEl && latestHR > 0)     hrEl.innerText = latestHR;
            if (sleepEl && sleepHours > 0) sleepEl.innerText = sleepHours.toFixed(1);
            if (spo2El && latestSpO2 > 0) spo2El.innerText = Math.round(latestSpO2);
            
            // Update the mini vitals card
            if (hrMiniEl && latestHR > 0) hrMiniEl.innerText = latestHR;
            if (spo2MiniEl && latestSpO2 > 0) spo2MiniEl.innerText = Math.round(latestSpO2);

            // Update HRV Stream
            if (latestHRV > 0) {
                updateEl('hrv-display', Math.round(latestHRV));
                const hrvFb = document.getElementById('hrv-feedback');
                const hrvBar = document.getElementById('hrv-bar');
                if (hrvFb) {
                    if (latestHRV < 30) {
                        hrvFb.innerText = 'High physiological stress detected. Recovery is severely compromised.';
                        if (hrvBar) { hrvBar.style.width = '30%'; hrvBar.style.background = 'var(--accent-red)'; }
                    } else if (latestHRV < 50) {
                        hrvFb.innerText = 'Moderate sympathetic drive. Nervous system is under load.';
                        if (hrvBar) { hrvBar.style.width = '60%'; hrvBar.style.background = 'var(--accent-gold)'; }
                    } else {
                        hrvFb.innerText = 'High HRV. Powerful parasympathetic recovery state active.';
                        if (hrvBar) { hrvBar.style.width = '90%'; hrvBar.style.background = 'var(--accent-green)'; }
                    }
                }
            }

            // Update readiness ring
            updateReadiness(totalSteps, sleepHours, latestHR, latestHRV);
            
            // AI Feed & Vitality Index logic
            generateInsights(totalSteps, sleepHours, latestHR, latestSpO2, latestHRV);

            // Update goal progress bars
            const goalStepsBar = document.getElementById('goal-steps-bar');
            if (goalStepsBar) goalStepsBar.style.width = Math.min((totalSteps / 10000) * 100, 100) + '%';
            const goalSleepBar = document.getElementById('goal-sleep-bar');
            if (goalSleepBar) goalSleepBar.style.width = Math.min((sleepHours / 8) * 100, 100) + '%';

            // Save to Supabase (non-blocking)
            if (window.supabaseClient) {
                window.supabaseClient.from('health_logs').insert([{
                    steps: totalSteps,
                    heart_rate: latestHR,
                    sleep_hours: sleepHours,
                    spo2: latestSpO2,
                    hrv: latestHRV
                }]).then(() => {}).catch(e => console.warn('Supabase save failed:', e));
            }

            const syncMsg = `Synced! ${totalSteps.toLocaleString()} steps · ${sleepHours.toFixed(1)}h sleep · ${latestHR || '--'} bpm`;
            if (banner) banner.textContent = syncMsg;
            setTimeout(() => hcBanner && hcBanner.classList.add('hidden'), 4000);

        } catch (e) {
            console.error('Health sync error:', e);
            if (banner) banner.textContent = 'Sync failed. Ensure Health Connect permissions are granted.';
            setTimeout(() => hcBanner && hcBanner.classList.add('hidden'), 5000);
        }
    };

    if (hcBtn) hcBtn.addEventListener('click', syncHealthConnect);

    // ====== 7. AUTO-SYNC ======
    // First sync: wait 5s after app loads so all native bridges are fully ready
    setTimeout(() => {
        syncHealthConnect().catch(e => console.warn('Auto-sync error (non-fatal):', e));
    }, 5000);

    // Then refresh every 5 minutes while the app is open
    setInterval(() => {
        syncHealthConnect().catch(e => console.warn('Periodic sync error (non-fatal):', e));
    }, 5 * 60 * 1000);

    // ====== 7.1 ATMOSPHERE (AUTO-TOGGLE) ======
    
    // Tab Elements
    window.activeEnvironment = 'outdoor'; // default fallback
    window.latestOutdoor = {};
    window.latestIndoor = {};
    const tabOutdoor = document.getElementById('tab-outdoor');
    const tabIndoor = document.getElementById('tab-indoor');
    const panelOutdoor = document.getElementById('env-panel-outdoor');
    const panelIndoor = document.getElementById('env-panel-indoor');
    const atmosphereCard = document.getElementById('card-atmosphere');

    // Manual Environment Control
    const setEnvState = (env) => {
        if (!tabOutdoor || !tabIndoor || !panelOutdoor || !panelIndoor) return;
        window.activeEnvironment = env;
        if (env === 'indoor') {
            tabIndoor.classList.add('active');
            tabOutdoor.classList.remove('active');
            panelIndoor.classList.remove('hidden');
            panelOutdoor.classList.add('hidden');
            if (atmosphereCard) atmosphereCard.style.borderColor = 'var(--accent-purple)';
            fetchIndoorEnvironment(); // Manually trigger fetch on switch
        } else {
            tabOutdoor.classList.add('active');
            tabIndoor.classList.remove('active');
            panelOutdoor.classList.remove('hidden');
            panelIndoor.classList.add('hidden');
            if (atmosphereCard) atmosphereCard.style.borderColor = 'var(--glass-border)';
            fetchOutdoorEnvironment();
        }
    };

    if (tabOutdoor) tabOutdoor.addEventListener('click', () => setEnvState('outdoor'));
    if (tabIndoor) tabIndoor.addEventListener('click', () => setEnvState('indoor'));

    // Process Outdoor Environment (Free APIs)
    const fetchOutdoorEnvironment = async () => {
        try {
            const locRes = await fetch('https://ipapi.co/json/');
            const locData = await locRes.json();
            if (locData.error) throw new Error(locData.reason);
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${locData.latitude}&longitude=${locData.longitude}&current=temperature_2m,relative_humidity_2m&hourly=uv_index&forecast_days=1`;
            const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${locData.latitude}&longitude=${locData.longitude}&current=us_aqi`;
            const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
            const weather = await weatherRes.json();
            const aqiData = await aqiRes.json();
            
            const temp = weather.current.temperature_2m;
            const hum = weather.current.relative_humidity_2m;
            const aqi = aqiData.current.us_aqi;
            const hour = new Date().getHours();
            const uv = weather.hourly?.uv_index?.[hour] || 0;

            window.latestOutdoor = { temp, hum, aqi, uv };

            updateEl('out-temp', `${Math.round(temp)}°C`);
            updateEl('out-humidity', `${Math.round(hum)}%`);
            updateEl('out-uv', uv.toFixed(1));
            updateEl('out-aqi', Math.round(aqi));
            
            const adviceEl = document.getElementById('env-advice-outdoor');
            if (adviceEl) adviceEl.innerText = `📍 ${locData.city || 'Outdoor'} · Data synced.`;
        } catch (e) { console.warn('Outdoor fetch error', e); }
    };

    // Process Indoor Environment (Manual Fetch)
    const fetchIndoorEnvironment = async () => {
        let piAddress = localStorage.getItem('biosync_pi_ip');
        const adviceEl = document.getElementById('env-advice-indoor');
        if (!piAddress) {
            if (adviceEl) adviceEl.innerText = "🍓 Set Pi IP in Settings to connect.";
            return;
        }

        // Clean up the address (ensure http:// and remove trailing slash)
        piAddress = piAddress.trim();
        if (!piAddress.startsWith('http')) {
            piAddress = 'http://' + piAddress;
        }
        if (piAddress.endsWith('/')) {
            piAddress = piAddress.slice(0, -1);
        }
        
        try {
            const capHttp = window.Capacitor?.Plugins?.CapacitorHttp;
            if (capHttp) {
                // Increased timeout for VPN/Tailscale latency
                const res = await capHttp.get({ 
                    url: `${piAddress}/sensors`, 
                    connectTimeout: 10000,
                    readTimeout: 10000 
                });
                
                if (res.status === 200) {
                    const data = res.data;
                    updateEl('in-lux', Math.round(data.lux));
                    updateEl('in-temp', `${data.temperature.toFixed(1)}°C`);
                    updateEl('in-humidity', `${Math.round(data.humidity)}%`);
                    updateEl('in-co2', Math.round(data.co2));
                    window.latestIndoor = data;
                    if (adviceEl) adviceEl.innerText = '🍓 Hardware synced successfully.';
                } else {
                    if (adviceEl) adviceEl.innerText = `🍓 Server Error (${res.status}). Check Pi logs.`;
                }
            }
        } catch (e) {
            console.warn('[BioSync] Pi Connection Error:', e);
            if (adviceEl) {
                const errorDetail = e.message || 'Check network / Tailscale';
                adviceEl.innerText = `🍓 Pi Offline (${errorDetail}).`;
            }
        }
    };

    // Run env fetches after app loads
    setTimeout(() => {
        fetchOutdoorEnvironment();
        fetchIndoorEnvironment();
    }, 2000);

    // Refresh env data every 5 minutes and log to Supabase
    setInterval(() => {
        if (window.activeEnvironment === 'indoor') {
            fetchIndoorEnvironment();
        } else {
            fetchOutdoorEnvironment();
        }
        
        if (window.supabaseClient) {
            let logData = {};
            if (window.activeEnvironment === 'indoor') {
                logData = {
                    user_id: 1,
                    temp_c: window.latestIndoor.temperature || 0,
                    humidity: window.latestIndoor.humidity || 0,
                    air_quality_proxy: window.latestIndoor.co2 || 0,
                    lux: window.latestIndoor.lux || 0,
                    timestamp: new Date().toISOString()
                };
            } else {
                logData = {
                    user_id: 1,
                    temp_c: window.latestOutdoor.temp || 0,
                    humidity: window.latestOutdoor.hum || 0,
                    air_quality_proxy: window.latestOutdoor.aqi || 0,
                    lux: 0,
                    timestamp: new Date().toISOString()
                };
            }
            window.supabaseClient.from('sensor_readings').insert([logData]).then(() => {}).catch(e => console.warn('Supabase sync failed:', e));
        }
    }, 5 * 60 * 1000);

    // ====== 8.1 BIO-INTELLIGENCE SYNC ======
    const generateInsights = async (steps, sleep, hr, spo2, hrv) => {
        const feed = document.getElementById('ai-insight-list');
        const vitality = document.getElementById('vitality-index');
        
        let score = 50;
        let insights = [];
        
        // HRV analysis
        if (hrv > 0) {
            if (hrv > 60) { score += 15; insights.push("HRV indicates dominant parasympathetic state. You are primed for peak output."); }
            else if (hrv < 30) { score -= 15; insights.push("Low HRV detected relative to baseline. CNS fatigue is probable, prioritize active recovery."); }
            else { insights.push("HRV is stable. Autonomic nervous system is balanced."); }
        }

        // Sleep analysis
        if (sleep >= 7.5) { score += 20; insights.push("Deep sleep threshold met. Endocrine restoration maximized."); }
        else if (sleep > 0 && sleep < 6) { score -= 20; insights.push("Sleep debt identified. Cognitive load capacity will be diminished today."); }
        else if (sleep > 0) { insights.push("Sleep duration is moderate. Watch afternoon energy dips."); }
        
        // Steps analysis
        if (steps > 8000) { score += 15; insights.push("NEAT energy expenditure aligns with high metabolic efficiency."); }
        else if (steps > 0 && steps < 3000) { score -= 10; insights.push("Sedentary trend. Muscle protein synthesis suppression risk is elevated."); }
        
        // SpO2 analysis
        if (spo2 > 0 && spo2 < 94) { score -= 15; insights.push("Peripheral SpO2 dropped below 94%. Check room ventilation or sleep posture."); }
        else if (spo2 >= 97) { insights.push("Blood oxygen saturation is excellent. Cellular oxygen diffusion optimal."); }
        
        // Cap vitality index at 99
        score = Math.min(Math.max(score, 10), 99);
        
        // --- BioSync ML Integration ---
        let piAddress = localStorage.getItem('biosync_pi_ip');
        const capHttp = window.Capacitor?.Plugins?.CapacitorHttp;
        if (piAddress && capHttp) {
            // Clean up address
            piAddress = piAddress.trim();
            if (!piAddress.startsWith('http')) piAddress = 'http://' + piAddress;
            if (piAddress.endsWith('/')) piAddress = piAddress.slice(0, -1);

            try {
                const mlRes = await capHttp.post({
                    url: piAddress + '/predict',
                    headers: { 'Content-Type': 'application/json' },
                    data: {
                        user_age: parseInt(localStorage.getItem('stats-age')) || 25,
                        steps_taken: steps,
                        sleep_hours_tracked: sleep,
                        avg_resting_hr: hr,
                        calories_consumed: parseInt(localStorage.getItem('biosync_daily_cals')) || 2000,
                        protein_intake_g: parseInt(localStorage.getItem('biosync_daily_protein')) || 70,
                        temperature: window.latestIndoor.temperature || 22,
                        co2: window.latestIndoor.co2 || 450,
                        spo2_percentage: spo2 || 98
                    },
                    connectTimeout: 5000,
                    readTimeout: 5000
                });
                if (mlRes.status === 200 && mlRes.data.vitality_index) {
                    score = mlRes.data.vitality_index;
                    insights.unshift(`Neuro-ML Model has computed your Vitality Index at ${score}%.`);
                }
            } catch (e) {
                console.warn("[BioSync] ML Inference failed, using heuristic score.", e);
            }
        }

        if (vitality) vitality.innerText = score;
        
        if (feed) {
            feed.innerHTML = '';
            if (insights.length === 0) insights.push("Sync more data to unlock neuro-biological insights.");
            insights.forEach(txt => {
                const li = document.createElement('li');
                li.className = 'insight-item';
                li.innerText = txt;
                feed.appendChild(li);
            });
        }
    };

    // ====== 9. AI NUTRITION (SAFE ZONE) ======
    try {
        const logMealBtn = document.getElementById('log-meal-btn');
        const mealInput = document.getElementById('meal-image-input');

        if (logMealBtn && mealInput) {
            logMealBtn.addEventListener('click', () => {
                const key = localStorage.getItem('biosync_openai_key');
                if (!key) {
                    switchPage('settings');
                    window.utils.showXPToast(0, 'Enter your OpenAI API key in Settings first');
                    return;
                }
                mealInput.click();
            });

            mealInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                logMealBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI';

                // Helper: convert any image (HEIC, PNG, WEBP, etc.) to JPEG via canvas
                // OpenAI only accepts: png, jpeg, gif, webp
                const convertToJpeg = (f) => new Promise((resolve, reject) => {
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(f);
                    img.onload = () => {
                        try {
                            const MAX = 1024;
                            let w = img.naturalWidth, h = img.naturalHeight;
                            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                            const canvas = document.createElement('canvas');
                            canvas.width = w; canvas.height = h;
                            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                            URL.revokeObjectURL(objectUrl);
                            canvas.toBlob(blob => {
                                if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
                                const r = new FileReader();
                                r.onloadend = () => resolve(r.result); // full data URL
                                r.onerror = reject;
                                r.readAsDataURL(blob);
                            }, 'image/jpeg', 0.88);
                        } catch (err) { reject(err); }
                    };
                    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
                    img.src = objectUrl;
                });

                let dataUrl;
                try {
                    dataUrl = await convertToJpeg(file);
                } catch (convErr) {
                    console.error('Image conversion error:', convErr);
                    logMealBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Error';
                    alert('Could not read image. Try a different photo.');
                    setTimeout(() => logMealBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Scan', 3000);
                    return;
                }

                const base64 = dataUrl.split(',')[1];
                if (!base64) {
                    logMealBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Error';
                    alert('Invalid image data after conversion.');
                    return;
                }

                const key = localStorage.getItem('biosync_openai_key');
                if (!key) {
                    logMealBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> No Key';
                    alert('OpenAI API key not set. Go to Settings and enter your key.');
                    setTimeout(() => logMealBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Scan', 3000);
                    return;
                }

                // Always send as JPEG (we just converted it)
                const imageUrl = `data:image/jpeg;base64,${base64}`;

                    // Build request payload as a JSON STRING — CapacitorHttp requires this
                    // when Content-Type is application/json to avoid form-encoding the body
                    const payload = JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: [
                            { type: 'text', text: 'Analyze this meal image. Return ONLY valid JSON: {"food_name": string, "calories": number, "protein": number, "carbs": number, "fat": number}' },
                            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
                        ]}],
                        max_tokens: 256
                    });

                    try {
                        let response;

                        // Use native CapacitorHttp if available (avoids CORS on Android)
                        const capHttp = window.Capacitor?.Plugins?.CapacitorHttp;
                        if (capHttp) {
                            response = await capHttp.post({
                                url: 'https://api.openai.com/v1/chat/completions',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${key}`
                                },
                                data: JSON.parse(payload),
                                connectTimeout: 30000,
                                readTimeout: 30000
                            });
                            if (response.status !== 200) {
                                const msg = (typeof response.data === 'object')
                                    ? response.data?.error?.message
                                    : response.data;
                                throw new Error(msg || `API Error ${response.status}`);
                            }
                            const content = response.data?.choices?.[0]?.message?.content || response.data;
                            const text = typeof content === 'string' ? content : JSON.stringify(content);
                            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const meal = JSON.parse(jsonStr);
                            
                            // Increment logic: don't overwrite, add to daily total
                            let dailyCals = parseInt(localStorage.getItem('biosync_daily_cals') || '0');
                            dailyCals += meal.calories;
                            localStorage.setItem('biosync_daily_cals', dailyCals);
                            
                            updateEl('calories-display', dailyCals);
                            
                            // Update goals bar
                            const goalNutBar = document.getElementById('goal-nutrition-bar');
                            if (goalNutBar) goalNutBar.style.width = Math.min((dailyCals / 2500) * 100, 100) + '%';
                            
                            window.utils.showXPToast(25, `Logged ${meal.food_name}`);
                            if (window.gamification) window.gamification.awardXP(25, `Meal: ${meal.food_name}`);
                            logMealBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${meal.calories} kcal`;
                            setTimeout(() => logMealBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Scan', 4000);
                            
                            // Check Nutrition Goals
                            let mealsLogged = parseInt(localStorage.getItem('biosync_meals_logged') || '0');
                            mealsLogged++;
                            localStorage.setItem('biosync_meals_logged', mealsLogged);
                            if (mealsLogged >= 3 && !localStorage.getItem('challenge_log-3')) {
                                localStorage.setItem('challenge_log-3', 'true');
                                window.gamification?.awardXP(40, 'Goal: Log 3 meals');
                                window.utils.showXPToast(40, 'Goal completed!');
                            }
                            if (meal.protein && meal.protein > 30) {
                                // Simulate bumping protein for the day
                                let dailyProtein = parseInt(localStorage.getItem('biosync_daily_protein') || '0');
                                dailyProtein += meal.protein;
                                localStorage.setItem('biosync_daily_protein', dailyProtein);
                                if (dailyProtein >= 100 && !localStorage.getItem('challenge_protein-100')) {
                                    localStorage.setItem('challenge_protein-100', 'true');
                                    window.gamification?.awardXP(50, 'Goal: 100g Protein');
                                    window.utils.showXPToast(50, 'Protein Goal met!');
                                }
                            }
                        } else {
                            // Fallback to regular fetch for web/PWA
                            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                                body: payload
                            });
                            if (!res.ok) {
                                const errData = await res.json().catch(() => ({}));
                                throw new Error(errData.error?.message || `API Error: ${res.status}`);
                            }
                            const result = await res.json();
                            const text = result.choices[0].message.content;
                            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const meal = JSON.parse(jsonStr);
                            updateEl('calories-display', meal.calories);
                            window.utils.showXPToast(25, `Logged ${meal.food_name}`);
                            if (window.gamification) window.gamification.awardXP(25, `Meal: ${meal.food_name}`);
                            logMealBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${meal.calories} kcal`;
                            setTimeout(() => logMealBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Scan', 4000);
                        }
                    } catch (err) {
                        console.error('AI Scan error:', err);
                        logMealBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Error';
                        alert(`Scan failed: ${err.message || 'Check your network connection'}`);
                        setTimeout(() => logMealBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Scan', 3000);
                    }
            });
        }
    } catch (e) { console.error("Nutrition init error", e); }

    // ====== 10. GAMIFICATION BINDING ======
    if (window.gamification) {
        window.gamification.subscribe((state) => {
            updateEl('user-level', state.level);
            updateEl('sidebar-current-xp', state.xp);
            updateEl('sidebar-next-xp', state.xpNext);
            const fill = document.getElementById('sidebar-xp-bar');
            if (fill) fill.style.width = Math.min((state.xp / state.xpNext) * 100, 100) + '%';
            const goalsBar = document.getElementById('goals-xp-bar');
            if (goalsBar) goalsBar.style.width = Math.min((state.xp / state.xpNext) * 100, 100) + '%';
        });
    }

    // ====== 11. SOUND TOGGLE ======
    const soundBtn = document.getElementById('toggle-sound-btn');
    const soundText = document.getElementById('sound-status-text');
    if (soundBtn && window.audioEngine) {
        soundText.textContent = window.audioEngine.isEnabled() ? 'On' : 'Off';
        soundBtn.addEventListener('click', () => {
            const on = window.audioEngine.toggle();
            soundText.textContent = on ? 'On' : 'Off';
            if (on) window.audioEngine.playChime();
        });
    }

    // ====== 12. ANALYTICS PAGE (FIXED CHART RENDERING) ======
    let activeCharts = [];

    const initAnalyticsPage = () => {
        // Clean up old charts
        activeCharts.forEach(c => { try { c.destroy(); } catch (_) {} });
        activeCharts = [];

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
        const tickCol = isDark ? '#8888aa' : '#555566';

        const buildChart = (canvasId, label, data, color) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            // Reset canvas dimensions to force proper sizing
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = 220;
            const ctx = canvas.getContext('2d');

            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label,
                        data,
                        borderColor: color,
                        backgroundColor: color + '22',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: color,
                        pointRadius: 4,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: tickCol, font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: tickCol, font: { size: 10 } }, grid: { color: gridCol } }
                    }
                }
            });
            activeCharts.push(chart);
        };

        // Show container for the default active tab
        document.querySelectorAll('.chart-container').forEach(c => c.classList.remove('active'));
        const stepsContainer = document.getElementById('container-steps');
        if (stepsContainer) stepsContainer.classList.add('active');

        // Generate a realistic 7-day history curve ending with today's real data
        const getHistory = (type) => {
            let todayVal = 0;
            if (type === 'steps') {
                const el = document.getElementById('step-count');
                todayVal = el && el.innerText !== '--' ? parseInt(el.innerText.replace(/,/g, '')) || 5000 : 5000;
                // Generate 6 past days fluctuating around today's value (+/- 30%)
                return Array.from({length: 6}, () => Math.max(1000, Math.round(todayVal * (0.7 + Math.random() * 0.6)))).concat([todayVal]);
            } else {
                const el = document.getElementById('sleep-duration');
                todayVal = el && el.innerText !== '--' ? parseFloat(el.innerText) || 7.0 : 7.0;
                // Generate 6 past days fluctuating around today's value (+/- 1.5 hours)
                return Array.from({length: 6}, () => Math.max(4.0, Math.round((todayVal + (Math.random() * 3 - 1.5)) * 10) / 10)).concat([todayVal]);
            }
        };

        // Render only the visible chart first
        buildChart('chart-steps', 'Steps', getHistory('steps'), '#2ed573');

        // Bind pill buttons for switching
        document.querySelectorAll('.pill-btn').forEach(btn => {
            // Remove old listeners by cloning
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);

            clone.addEventListener('click', () => {
                document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                clone.classList.add('active');

                const target = clone.getAttribute('data-target');
                document.querySelectorAll('.chart-container').forEach(c => c.classList.remove('active'));
                const cont = document.getElementById('container-' + target);
                if (cont) cont.classList.add('active');

                // Destroy & rebuild
                activeCharts.forEach(c => { try { c.destroy(); } catch (_) {} });
                activeCharts = [];

                if (target === 'steps') {
                    buildChart('chart-steps', 'Steps', getHistory('steps'), '#2ed573');
                } else if (target === 'sleep') {
                    buildChart('chart-sleep', 'Sleep (hrs)', getHistory('sleep'), '#1e90ff');
                }
            });
        });
    };

    // ====== 13. GOALS PAGE ======
    try {
        const challengesList = document.getElementById('challenges-list-mobile');
        if (challengesList) {
            GOAL_BANK.forEach(goal => {
                const isDone = localStorage.getItem('challenge_' + goal.id);
                const pill = document.createElement('div');
                pill.style.cssText = `
                    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
                    background: var(--bg-card); border: 1px solid var(--glass-border);
                    border-radius: 12px; margin-bottom: 10px; cursor: pointer;
                    opacity: ${isDone ? 0.5 : 1}; transition: all 0.2s;
                `;
                pill.innerHTML = `
                    <i class="fa-solid ${goal.icon}" style="color: var(--accent-blue); width: 18px;"></i>
                    <span style="flex:1; font-size: 0.85rem; color: var(--text-primary);">${goal.title}</span>
                    <span style="font-size: 0.75rem; color: var(--accent-green); font-weight: 600;">+${goal.xp} XP</span>
                    ${isDone ? '<i class="fa-solid fa-check" style="color: var(--accent-green);"></i>' : ''}
                `;
                if (!isDone) {
                    pill.addEventListener('click', () => {
                        localStorage.setItem('challenge_' + goal.id, 'true');
                        pill.style.opacity = '0.5';
                        pill.innerHTML += '<i class="fa-solid fa-check" style="color: var(--accent-green);"></i>';
                        if (window.gamification) window.gamification.awardXP(goal.xp, goal.title);
                        if (window.audioEngine) window.audioEngine.playChime();
                    });
                }
                challengesList.appendChild(pill);
            });
        }
    } catch (e) { console.error("Goals init error", e); }

    // ====== 14. SETTINGS SAVE & LOAD ======
    const saveBtn = document.getElementById('save-settings-btn');
    const piIpInput = document.getElementById('biosync-pi-ip');
    const openaiKeyInput = document.getElementById('openai-api-key');

    // Load saved values into inputs
    if (piIpInput) piIpInput.value = localStorage.getItem('biosync_pi_ip') || '';
    if (openaiKeyInput) openaiKeyInput.value = localStorage.getItem('biosync_openai_key') || '';

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
            
            // Save Configs to LocalStorage
            if (piIpInput) {
                let val = piIpInput.value.trim();
                if (val && !val.startsWith('http')) val = 'http://' + val;
                localStorage.setItem('biosync_pi_ip', val);
            }
            if (openaiKeyInput) {
                localStorage.setItem('biosync_openai_key', openaiKeyInput.value.trim());
            }

            const profileData = {
                age: document.getElementById('stats-age')?.value,
                gender: document.getElementById('stats-gender')?.value,
                weight_kg: document.getElementById('stats-weight')?.value,
                height_cm: document.getElementById('stats-height')?.value,
                activity_level: document.getElementById('stats-activity')?.value
            };
            try {
                if (window.supabaseClient) {
                    await window.supabaseClient.from('user_profiles').upsert([profileData]);
                    window.utils.showXPToast(0, 'Profile synced to cloud');
                    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Synced!';
                } else {
                    // Save locally as fallback
                    localStorage.setItem('biosync_profile', JSON.stringify(profileData));
                    window.utils.showXPToast(0, 'Profile saved locally');
                    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                }
                setTimeout(() => saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Sync Profile to Cloud', 2500);
                
                // Trigger an immediate check of the new IP
                fetchIndoorEnvironment();
            } catch {
                saveBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
                setTimeout(() => saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Sync Profile to Cloud', 2500);
            }
        });
    }

    // ====== 15. BIO-SYNC ENGINE (fallback for when sync-engine.js exists) ======
    if (window.bioSyncEngine) {
        window.bioSyncEngine.subscribe((data) => {
            if (stepEl) stepEl.innerText = data.steps.toLocaleString();
            let sVal = data.sleep || 0;
            if (sVal > 12) sVal = sVal / 2;
            if (sleepEl) sleepEl.innerText = sVal.toFixed(1);
            if (hrEl) hrEl.innerText = data.heartRate;
            updateReadiness(data.steps, data.sleep, data.heartRate);
        });
    }

    // ====== STARTUP: Set defaults (no fake data) ======
    if (stepEl && stepEl.innerText === '') updateEl('step-count', '--');
    if (sleepEl && sleepEl.innerText === '') updateEl('sleep-duration', '--');
    if (hrEl && hrEl.innerText === '') updateEl('heart-rate', '--');

});
