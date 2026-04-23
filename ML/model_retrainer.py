import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from supabase import create_client, Client
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
import joblib
from dotenv import load_dotenv

# Load env variables
load_dotenv()
url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_KEY", "")

print("Initializing Supabase Client...")
try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print("Could not create Supabase client (Missing config?):", e)
    supabase = None

print("Loading base synthetic dataset...")
df_base = pd.read_csv('biosync_raw_hardware_data.csv')

def calc_readiness(row):
    sleep_score = min(max(row.get('sleep_hours_tracked', 0) / 8.0, 0), 1) * 35
    step_score = min(max(row.get('steps_taken', 0) / 10000.0, 0), 1) * 20
    hr_score = max((100 - row.get('avg_resting_hr', 60)) / 55.0, 0) * 15
    protein_score = min(max(row.get('protein_intake_g', 50) / 120.0, 0), 1) * 20
    co2_penalty = max((row.get('room_co2_ppm', 400) - 800) / 1000.0, 0) * 15
    spo2_penalty = 0
    if row.get('spo2_percentage', 99) < 95.0 and row.get('sleep_hours_tracked', 0) > 7.0:
        spo2_penalty = max((95.0 - row['spo2_percentage']), 0) * 8
    score = (sleep_score + step_score + hr_score + protein_score) - co2_penalty - spo2_penalty
    return min(max(score, 0), 100)

new_data_frames = []

if supabase:
    print("Fetching last 7 days of live user data...")
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    try:
        health_res = supabase.table('health_logs').select('*').gte('created_at', seven_days_ago).execute()
        env_res = supabase.table('environment_logs').select('*').gte('created_at', seven_days_ago).eq('environment_type', 'indoor').execute()
        
        health_df = pd.DataFrame(health_res.data) if health_res.data else pd.DataFrame()
        env_df = pd.DataFrame(env_res.data) if env_res.data else pd.DataFrame()
        
        if not health_df.empty and not env_df.empty:
            health_df['date'] = pd.to_datetime(health_df['created_at']).dt.date
            env_df['date'] = pd.to_datetime(env_df['created_at']).dt.date
            
            merged = pd.merge(health_df, env_df, on='date', how='inner')
            new_rows = []
            for _, row in merged.iterrows():
                new_row = {
                    'user_age': 30, # Default proxy for user profile
                    'steps_taken': row.get('steps', 0),
                    'sleep_hours_tracked': row.get('sleep_hours', 0),
                    'avg_resting_hr': row.get('heart_rate', 0),
                    'calories_consumed': 2000,
                    'protein_intake_g': 80,
                    'room_temp_c': row.get('temperature', 22.0),
                    'room_co2_ppm': row.get('co2_or_aqi', 400.0),
                    'spo2_percentage': row.get('spo2', 98.0)
                }
                new_row['readiness_score'] = calc_readiness(new_row)
                new_rows.append(new_row)
            
            df_live = pd.DataFrame(new_rows)
            new_data_frames.append(df_live)
            print(f"Extracted {len(df_live)} live data rows to blend.")
    except Exception as e:
        print("Error fetching live data. Skipping blending.", e)

df_combined = df_base.copy()
if new_data_frames:
    df_combined = pd.concat([df_base] + new_data_frames, ignore_index=True)
    print("Combined synthetic and live data.")

print("Imputing and clipping dataset...")
for col in df_combined.columns:
    if df_combined[col].isnull().any():
        df_combined[col] = df_combined[col].fillna(df_combined[col].median())

df_combined['sleep_hours_tracked'] = df_combined['sleep_hours_tracked'].clip(0, 14)
df_combined['avg_resting_hr'] = df_combined['avg_resting_hr'].clip(40, 180)
df_combined['steps_taken'] = df_combined['steps_taken'].clip(0, 35000)
if 'spo2_percentage' in df_combined.columns:
    df_combined['spo2_percentage'] = df_combined['spo2_percentage'].clip(70, 100)

X = df_combined.drop('readiness_score', axis=1)
y = df_combined['readiness_score']

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

print("Retraining RandomForestRegressor with merged contextual baseline...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_scaled, y)

joblib.dump(model, 'biosync_production_model.pkl')
joblib.dump(scaler, 'biosync_scaler.pkl')

print("Success: Continuous Learning Update Complete. Output model written to disk.")
