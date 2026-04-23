import json
import threading
import os
import joblib
import numpy as np
from flask import Flask, jsonify, request

# --- Configuration ---
MQTT_BROKER = "127.0.0.1"
MQTT_PORT = 1883
MQTT_TOPIC_ENV = "homeostasis/air/environment"
MQTT_TOPIC_SCORE = "homeostasis/display/score"

# BIOSYNC GLOBAL STATE
latest_data = {
    "temperature": 0.0,
    "humidity": 0.0,
    "lux": 0,
    "co2": 0,
    "timestamp": 0
}

app = Flask(__name__)

# --- ML MODEL LOADER ---
# Locate ML artifacts in the /ML directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'ML', 'biosync_production_model.pkl')
SCALER_PATH = os.path.join(BASE_DIR, 'ML', 'biosync_scaler.pkl')

model = None
scaler = None

try:
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print("[BioSync] ML Models loaded successfully.")
    else:
        print("[BioSync] ML Model artifacts missing in /ML directory.")
except Exception as e:
    print(f"[BioSync] Failed to load ML artifacts: {e}")

# Manual CORS implementation (Zero-Dependency)
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

def start_mqtt_loop():
    try:
        import paho.mqtt.client as mqtt
        import paho.mqtt.publish as publish
        
        def on_connect(client, userdata, flags, rc):
            print(f"[BioSync] MQTT Connected (Result: {rc})")
            client.subscribe(MQTT_TOPIC_ENV)

        def on_message(client, userdata, msg):
            global latest_data
            if msg.topic == MQTT_TOPIC_ENV:
                try:
                    payload = json.loads(msg.payload.decode())
                    latest_data["temperature"] = payload.get("temp_c", 0.0)
                    latest_data["humidity"] = payload.get("humidity", 0.0)
                    latest_data["lux"] = payload.get("lux", 0)
                    latest_data["co2"] = payload.get("air_quality_proxy", 0)
                except:
                    pass

        # Try-catch for Paho version compatibility
        try:
            client = mqtt.Client() # Works for 1.x
        except:
            # Fallback for 2.x if needed
            from paho.mqtt.client import CallbackAPIVersion
            client = mqtt.Client(CallbackAPIVersion.VERSION1)
            
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"[BioSync] Critical MQTT Error: {e}")

# --- HTTP Routes ---

@app.route('/sensors', methods=['GET'])
def get_sensors():
    return jsonify(latest_data)

@app.route('/predict', methods=['POST'])
def predict_vitality():
    """
    BioSync ML Inference Endpoint
    Expects JSON: {
        "user_age": number,
        "steps_taken": number,
        "sleep_hours_tracked": number,
        "avg_resting_hr": number,
        "calories_consumed": number,
        "protein_intake_g": number,
        "room_temp_c": number,
        "room_co2_ppm": number,
        "spo2_percentage": number
    }
    """
    if not model or not scaler:
        return jsonify({"error": "ML Models not loaded on server", "vitality_index": 50}), 200

    data = request.get_json()
    try:
        # Feature order must match training
        features = [
            data.get('user_age', 25),
            data.get('steps_taken', 5000),
            data.get('sleep_hours_tracked', 7.0),
            data.get('avg_resting_hr', 70),
            data.get('calories_consumed', 2000),
            data.get('protein_intake_g', 75),
            data.get('room_temp_c', data.get('temperature', 22.0)),
            data.get('room_co2_ppm', data.get('co2', 450)),
            data.get('spo2_percentage', 98.0)
        ]
        
        # Scale and Predict
        scaled_features = scaler.transform([features])
        prediction = model.predict(scaled_features)[0]
        
        # Ensure 0-100 range
        vitality_score = int(np.clip(prediction, 0, 100))
        
        return jsonify({
            "status": "success",
            "vitality_index": vitality_score
        })
    except Exception as e:
        print(f"[BioSync] Prediction Error: {e}")
        return jsonify({"error": "Inference failed", "vitality_index": 50}), 500

@app.route('/score', methods=['POST'])
def update_score():
    data = request.get_json()
    if not data or 'score' not in data:
        return jsonify({"error": "No score provided"}), 400
    
    score = data['score']
    print(f"\n[BioSync] Score Update: {score}")
    
    try:
        import paho.mqtt.publish as publish
        publish.single(MQTT_TOPIC_SCORE, json.dumps({"score": score}), hostname=MQTT_BROKER)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Start MQTT bridge in background
    mqtt_thread = threading.Thread(target=start_mqtt_loop, daemon=True)
    mqtt_thread.start()
    
    print("BioSync Intelligence Server starting on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
