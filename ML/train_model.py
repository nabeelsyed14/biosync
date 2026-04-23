import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
import joblib

print("Loading dataset...")
df_raw = pd.read_csv('biosync_raw_hardware_data.csv')
df_clean = df_raw.copy()

print("Imputing and clipping dataset...")
for col in df_clean.columns:
    if df_clean[col].isnull().any():
        df_clean[col] = df_clean[col].fillna(df_clean[col].median())

df_clean['sleep_hours_tracked'] = df_clean['sleep_hours_tracked'].clip(0, 14)
df_clean['avg_resting_hr'] = df_clean['avg_resting_hr'].clip(40, 180)
df_clean['steps_taken'] = df_clean['steps_taken'].clip(0, 35000)
if 'spo2_percentage' in df_clean.columns:
    df_clean['spo2_percentage'] = df_clean['spo2_percentage'].clip(70, 100)

X = df_clean.drop('readiness_score', axis=1)
y = df_clean['readiness_score']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

print("Training RandomForestRegressor on updated dataset...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train_scaled, y_train)

joblib.dump(model, 'biosync_production_model.pkl')
joblib.dump(scaler, 'biosync_scaler.pkl')

print("Success: Model artifacts successfully serialized and ready for deployment.")
