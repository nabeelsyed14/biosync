# BioSync 🧬 

**The ultimate 360° view of your health and environment.** 🚀

BioSync is a powerful, real-time health intelligence platform that syncs your biological vitals with your physical environment. By bridging your **Galaxy Watch** and a **Raspberry Pi IoT hub**, BioSync uses a custom Random Forest ML model to calculate your **Vitality Index**—giving you a daily score on your readiness to perform! ⚡️

---

## 🌟 Top Features
- **⌚️ Smart Sync**: Direct integration with Health Connect for Steps, Sleep, HR, and HRV.
- **🏠 Home Atmosphere**: Real-time Indoor Air Quality (CO2), Temp, and Humidity tracking via Raspberry Pi.
- **🍎 AI Nutrition**: Snap a photo of your food to get instant calorie and macro breakdowns using OpenAI!
- **🤖 Neuro-ML Engine**: A smart "Vitality Index" that learns from your habits to predict your physical state.
- **🎮 Gamified Growth**: Earn XP, level up, and unlock badges as you hit your health goals.
- **☁️ Cloud Sync**: All your historical data is safely stored in Supabase for long-term trend analysis.

![BioSync Logo](www/biosync_logo.png)

## ✨ Why BioSync?
Most health apps keep your data in "walled gardens." BioSync brings everything together locally, keeping your sensitive medical data under your control.
- **Smart Monitoring**: Track Steps, Sleep, HR, SpO2, and HRV in one sleek Glassmorphism interface.
- **Environment Sensing**: Know if your room's air quality (CO2) or temperature is affecting your recovery.
- **AI Nutrition**: Just scan your food to get instant macro and calorie breakdowns via OpenAI.
- **Vitality Score**: A custom Random Forest ML model predicts your physical readiness based on 10+ biological markers.

## 🛠️ Built With
- **Mobile**: Capacitor.js + Kotlin (Native Android Health Bridge)
- **IoT**: Raspberry Pi 5 + MQTT + Flask
- **Cloud**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-4o-mini & Scikit-Learn

## 🚀 Getting Started

### 1. Setup the Environment
Clone the repo and install the dependencies:
```bash
npm install
pip install -r requirements.txt
```

### 2. Configure Keys
Copy `.env.example` to `.env` and add your API keys for OpenAI and Supabase.

### 3. Launch the Dashboard
Run the validator to check your setup:
```bash
python run.py
```

## 📂 Project Structure
- `/www`: The beautiful Glassmorphism frontend.
- `/ML`: Pre-trained models and data generation scripts.
- `/android`: Native Kotlin code for the Health Connect plugin.
- `/biosync_arduino`: Hardware code for secondary sensor nodes.

---
## 🔌 Hardware Requirements
To use the full "Pure Real" sync features of BioSync, you will need:
- **Wearable**: A Samsung Galaxy Watch (or any Wear OS device) connected to Android Health Connect.
- **IoT Hub**: A Raspberry Pi 5 (or Pi 4) running the `pi_sensor_server.py` script.
- **Environment Sensors**: DHT22 (Temp/Humidity) and MQ135 (Air Quality) connected to the Pi via GPIO.
- **Mobile Device**: An Android smartphone running the BioSync `.apk` (Android 13+ recommended for Health Connect stability).
---
## 📄 License
This project is licensed under the **MIT License**. You are free to use, modify, and distribute this software for academic or personal projects, provided that proper credit is given to the original repository.

---
*BioSync © 2026. Developed for the advancement of decentralized health intelligence.*

