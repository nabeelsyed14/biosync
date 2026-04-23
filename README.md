# BioSync 🧬
**A Privacy-First, Mobile Health Intelligence Platform**

BioSync is a futuristic health dashboard that connects your body with your environment. By combining data from wearables (Galaxy Watch/Health Connect) and IoT sensors (Raspberry Pi), BioSync uses Machine Learning to give you a real-time **Vitality Index**—telling you exactly how ready you are for the day.

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
*Created with ❤️ for a privacy-first health future.*
