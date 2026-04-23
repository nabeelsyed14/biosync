import pandas as pd
import numpy as np

np.random.seed(42)
n_samples = 5000

print("Generating synthetic raw dataset...")

# Generate base clean data
data = {
    'user_age': np.random.randint(18, 65, n_samples),
    'steps_taken': np.random.normal(8000, 3500, n_samples).astype(int),
    'sleep_hours_tracked': np.random.normal(7.5, 1.8, n_samples),
    'avg_resting_hr': np.random.normal(68, 8, n_samples).astype(int),
    'calories_consumed': np.random.normal(2400, 600, n_samples).astype(int),
    'protein_intake_g': np.random.normal(90, 30, n_samples),
    'room_temp_c': np.random.normal(22, 2.5, n_samples),
    'room_co2_ppm': np.random.normal(600, 200, n_samples).astype(int),
    'spo2_percentage': np.random.normal(97.0, 1.5, n_samples)
}

df = pd.DataFrame(data)

# Ensure no negative steps/calories
df['steps_taken'] = df['steps_taken'].clip(lower=0)
df['calories_consumed'] = df['calories_consumed'].clip(lower=0)

# Generate Ground Truth Target: Readiness Score
# Formula combines multiple vectors
def calc_readiness(row):
    sleep_score = min(max(row['sleep_hours_tracked'] / 8.0, 0), 1) * 35 # 35% weight
    step_score = min(max(row['steps_taken'] / 10000.0, 0), 1) * 20      # 20% weight
    hr_score = max((100 - row['avg_resting_hr']) / 55.0, 0) * 15         # Lower HR is better, 15% weight
    protein_score = min(max(row['protein_intake_g'] / 120.0, 0), 1) * 20 # 20% weight
    
    # Penalty for high CO2 (bad sleep quality)
    co2_penalty = max((row['room_co2_ppm'] - 800) / 1000.0, 0) * 15
    
    # Penalty for low SpO2 combined with long sleep (suspected apnea)
    spo2_penalty = 0
    if row['spo2_percentage'] < 95.0 and row['sleep_hours_tracked'] > 7.0:
        spo2_penalty = max((95.0 - row['spo2_percentage']), 0) * 8
    
    score = (sleep_score + step_score + hr_score + protein_score) - co2_penalty - spo2_penalty + np.random.normal(0, 5)
    return min(max(score, 0), 100)

df['readiness_score'] = df.apply(calc_readiness, axis=1)

# Inject "Dirty" Data (Nulls & Outliers)
print("Injecting real-world noise (NaNs, Outliers)...")

# 1. Nulls (Sensor disconnects)
df.loc[df.sample(frac=0.05).index, 'room_co2_ppm'] = np.nan
df.loc[df.sample(frac=0.03).index, 'avg_resting_hr'] = np.nan
df.loc[df.sample(frac=0.02).index, 'sleep_hours_tracked'] = np.nan
df.loc[df.sample(frac=0.02).index, 'spo2_percentage'] = np.nan

# 2. Outliers (Hardware glitches)
df.loc[df.sample(int(n_samples * 0.01)).index, 'sleep_hours_tracked'] = np.random.uniform(20, 48, int(n_samples * 0.01)) # Impossible sleep
df.loc[df.sample(int(n_samples * 0.01)).index, 'avg_resting_hr'] = np.random.randint(0, 10, int(n_samples * 0.01))     # Impossible HR
df.loc[df.sample(int(n_samples * 0.01)).index, 'steps_taken'] = np.random.randint(50000, 100000, int(n_samples * 0.01))  # Marathon glitch
df.loc[df.sample(int(n_samples * 0.01)).index, 'spo2_percentage'] = np.random.uniform(70, 85, int(n_samples * 0.01)) # Impossible spo2 while conscious

df.to_csv('biosync_raw_hardware_data.csv', index=False)
print("Saved to 'biosync_raw_hardware_data.csv'")
