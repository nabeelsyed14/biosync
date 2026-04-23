import json

# Define the cells for the Jupyter Notebook with detailed academic descriptions and Step-only headers
cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# BioSync Predictive Engine: Advanced Health Intelligence\n",
            "\n",
            "## Introduction\n",
            "Welcome to the BioSync Predictive Engine. This module represents the core intelligence of the BioSync platform, focusing on quantifying user 'Readiness'—a holistic metric that synthesizes physical activity, physiological recovery, and environmental stressors. \n",
            "\n",
            "By leveraging high-fidelity sensor data (DHT22, MQ-135, and Google Fit integrations), this engine identifies complex correlations between your environment, your lifestyle, and your systemic recovery. The ultimate goal is to provide actionable insights that allow for optimized performance and proactive health management.\n",
            "\n",
            "### Key Research Objectives:\n",
            "- **Data Integration**: Harmonizing heterogeneous data streams from IoT hardware and mobile biometrics.\n",
            "- **Feature Engineering**: Transforming raw sensor telemetry into meaningful health indicators.\n",
            "- **Predictive Modeling**: Utilizing advanced ensemble learning to forecast next-day readiness states."
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 1: Research Objective and Environment Setup\n",
            "\n",
            "This research focuses on developing a predictive model for quantifying user 'Readiness'—a holistic metric representing systemic recovery and energetic potential. By integrating heterogeneous data streams including physical activity (steps), physiological recovery (sleep and heart rate), nutritional intake (protein and caloric density), and environmental stressors (CO2 and temperature), we aim to construct a robust regressor capable of forecasting next-day wellness states.\n",
            "\n",
            "In this initial phase, we initialize the computational environment by importing specialized libraries for numerical analysis (NumPy, Pandas), statistical visualization (Matplotlib, Seaborn), and machine learning (Scikit-Learn)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "\n",
            "from sklearn.model_selection import train_test_split\n",
            "from sklearn.preprocessing import StandardScaler\n",
            "from sklearn.linear_model import LinearRegression\n",
            "from sklearn.tree import DecisionTreeRegressor\n",
            "from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor\n",
            "from sklearn.metrics import mean_squared_error, r2_score\n",
            "import joblib\n",
            "\n",
            "# Configure high-resolution visualization parameters\n",
            "sns.set_theme(style=\"darkgrid\")\n",
            "plt.rcParams['figure.figsize'] = (10, 6)\n",
            "\n",
            "print(\"Computational environment successfully initialized.\")"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 2: Data Ingestion and Preliminary Exploration\n",
            "\n",
            "The raw dataset is sourced from the BioSync hardware simulation engine, which synthesizes 5,000 daily observations. This phase focuses on primary data ingestion and an initial audit of the feature space to identify structural inconsistencies, data types, and the overall volume of observations."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "df_raw = pd.read_csv('biosync_raw_hardware_data.csv')\n",
            "print(f\"Database dimensions confirmed: {df_raw.shape[0]} observations with {df_raw.shape[1]} multifaceted features.\")\n",
            "display(df_raw.head())"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 3: Exploratory Data Analysis (EDA) and Quality Audit\n",
            "\n",
            "Rigorous Data Science requires a thorough understanding of the underlying distributions and an assessment of data integrity. Hardware sensors in the BioSync localized IoT array are prone to periodic signal degradation or hardware malfunctions, which manifest as missing values (NaNs) or stochastic outliers. We utilize descriptive statistics and distribution visualizations to locate these anomalies."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "print(\"Audit of missing values in the feature space:\")\n",
            "print(df_raw.isnull().sum())\n",
            "\n",
            "# Statistical distribution analysis for anomaly detection\n",
            "fig, axes = plt.subplots(2, 2, figsize=(14, 10))\n",
            "sns.histplot(df_raw['sleep_hours_tracked'], bins=30, kde=True, ax=axes[0,0], color='#3498db')\n",
            "axes[0,0].set_title('Restorative Sleep Duration (Hours)')\n",
            "\n",
            "sns.histplot(df_raw['avg_resting_hr'], bins=30, kde=True, ax=axes[0,1], color='#e74c3c')\n",
            "axes[0,1].set_title('Physiological State: Resting HR (bpm)')\n",
            "\n",
            "sns.histplot(df_raw['room_co2_ppm'], bins=30, kde=True, ax=axes[1,0], color='#9b59b6')\n",
            "axes[1,0].set_title('Environmental Stressor: Ambient CO2 (ppm)')\n",
            "\n",
            "sns.histplot(df_raw['readiness_score'], bins=30, kde=True, ax=axes[1,1], color='#2ecc71')\n",
            "axes[1,1].set_title('Target Variable: Systemic Readiness Index')\n",
            "\n",
            "plt.tight_layout()\n",
            "plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 4: Data Remediation and Preprocessing\n",
            "\n",
            "To prevent algorithmic bias and ensure the stability of the model, we perform data remediation. This involves:\n",
            "1. **Imputation**: Addressing missing data by replacing NaNs with feature medians.\n",
            "2. **Outlier Mitigation**: Implementing strict logical boundaries on sensor data to remove physically impossible readings caused by hardware glitches (e.g., capping heart rates and exaggerated sleep durations)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "df_clean = df_raw.copy()\n",
            "\n",
            "# Feature-wise imputation\n",
            "for col in df_clean.columns:\n",
            "    if df_clean[col].isnull().any():\n",
            "        df_clean[col] = df_clean[col].fillna(df_clean[col].median())\n",
            "\n",
            "# Stochastic outlier mitigation for hardware sensor fidelity\n",
            "df_clean['sleep_hours_tracked'] = df_clean['sleep_hours_tracked'].clip(0, 14)\n",
            "df_clean['avg_resting_hr'] = df_clean['avg_resting_hr'].clip(40, 180)\n",
            "df_clean['steps_taken'] = df_clean['steps_taken'].clip(0, 35000)\n",
            "\n",
            "print(\"Data remediation complete. Integrity of the feature space restored.\")"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 5: Feature Engineering and Train-Test Stratification\n",
            "\n",
            "The dataset is partitioned into training and validation subsets following an 80/20 stratification. Additionally, we implement Feature Standardization (Z-score normalization) to ensure that high-magnitude features like 'steps_taken' do not disproportionately influence the model's coefficients compared to lower-magnitude sleep metrics."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "X = df_clean.drop('readiness_score', axis=1)\n",
            "y = df_clean['readiness_score']\n",
            "\n",
            "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\n",
            "\n",
            "scaler = StandardScaler()\n",
            "X_train_scaled = scaler.fit_transform(X_train)\n",
            "X_test_scaled = scaler.transform(X_test)\n",
            "\n",
            "print(f\"Stratification complete. Training cohort size: {X_train_scaled.shape[0]} observations.\")\n",
            "\n",
            "# Supplemental Visual 1: Feature Correlation Matrix\n",
            "plt.figure(figsize=(12, 10))\n",
            "correlation_matrix = df_clean.corr()\n",
            "sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', fmt=\".2f\", linewidths=0.5)\n",
            "plt.title('Feature Intercorrelation Map: Biometric & Environmental Drivers')\n",
            "plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 6: Multi-Algorithm Benchmarking and Model Selection\n",
            "\n",
            "In this stage, we compare four distinct regression architectures: a parametric baseline (Linear Regression), a non-parametric tree-based approach (Decision Tree), and two ensemble learning methods (Random Forest and Gradient Boosting). This comparative analysis allows us to scientifically justify the selection of the most accurate predictor."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "models = {\n",
            "    \"Linear Regression\": LinearRegression(),\n",
            "    \"Decision Tree\": DecisionTreeRegressor(random_state=42),\n",
            "    \"Random Forest\": RandomForestRegressor(n_estimators=100, random_state=42),\n",
            "    \"Gradient Boosting\": GradientBoostingRegressor(n_estimators=100, random_state=42)\n",
            "}\n",
            "\n",
            "benchmark_results = []\n",
            "for name, model in models.items():\n",
            "    model.fit(X_train_scaled, y_train)\n",
            "    preds = model.predict(X_test_scaled)\n",
            "    rmse = np.sqrt(mean_squared_error(y_test, preds))\n",
            "    r2 = r2_score(y_test, preds)\n",
            "    benchmark_results.append({\"Model Architecture\": name, \"RMSE\": rmse, \"R2 Accuracy\": r2})\n",
            "\n",
            "results_df = pd.DataFrame(benchmark_results)\n",
            "display(results_df.sort_values(by='R2 Accuracy', ascending=False))"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 7: Predictive Performance Evaluation\n",
            "\n",
            "The performance of the candidate architectures is visualized through comparative error analysis. We utilize Root Mean Squared Error (RMSE) to assess residual magnitude and the R-Squared coefficient to determine the proportion of variance explained by the model."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "fig, ax = plt.subplots(1, 2, figsize=(15, 6))\n",
            "\n",
            "# RMSE Comparative Analysis\n",
            "sns.barplot(x='RMSE', y='Model Architecture', data=results_df.sort_values(by='RMSE'), ax=ax[0], palette='viridis', hue='Model Architecture', legend=False)\n",
            "ax[0].set_title('Metric: Root Mean Squared Error (RMSE)')\n",
            "\n",
            "# R2 Comparative Analysis\n",
            "sns.barplot(x='R2 Accuracy', y='Model Architecture', data=results_df.sort_values(by='R2 Accuracy', ascending=False), ax=ax[1], palette='magma', hue='Model Architecture', legend=False)\n",
            "ax[1].set_title('Metric: R-Squared (Variance Explained)')\n",
            "\n",
            "plt.tight_layout()\n",
            "plt.show()\n",
            "\n",
            "# Supplemental Visual 2: Actual vs. Predicted Regression Analysis\n",
            "best_preds = final_model.predict(X_test_scaled)\n",
            "plt.figure(figsize=(10, 6))\n",
            "plt.scatter(y_test, best_preds, alpha=0.5, color='#34495e')\n",
            "plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)\n",
            "plt.xlabel('Empirical Readiness (Actual)')\n",
            "plt.ylabel('Synthesized Readiness (Predicted)')\n",
            "plt.title(f'Regression Fidelity Analysis: {best_arch}')\n",
            "plt.show()\n",
            "\n",
            "# Supplemental Visual 3: Residual Error Distribution\n",
            "residuals = y_test - best_preds\n",
            "plt.figure(figsize=(10, 6))\n",
            "sns.histplot(residuals, kde=True, color='#e67e22')\n",
            "plt.title('Residual Distribution: Predictive Accuracy Audit')\n",
            "plt.xlabel('Residual Error (Variance)')\n",
            "plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 8: Attribution Analysis and Feature Importance\n",
            "\n",
            "To gain insight into the biological and environmental drivers of user Readiness, we perform an attribution analysis using the feature importance mapping of our optimized ensemble model."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "best_arch = results_df.sort_values(by='R2 Accuracy', ascending=False).iloc[0]['Model Architecture']\n",
            "final_model = models[best_arch]\n",
            "\n",
            "if hasattr(final_model, 'feature_importances_'):\n",
            "    importances = final_model.feature_importances_\n",
            "    feat_imp = pd.Series(importances, index=X.columns).sort_values(ascending=True)\n",
            "    \n",
            "    plt.figure(figsize=(10, 6))\n",
            "    feat_imp.plot(kind='barh', color='#16a085')\n",
            "    plt.title(f'Biometric Feature Attribution Analysis ({best_arch})')\n",
            "    plt.xlabel('Importance Coefficient')\n",
            "    plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Step 9: Model Serialization and Deployment Preparation\n",
            "\n",
            "Having validated the predictive engine, we serialize the trained model and the feature scaler to disk using `joblib`. These artifacts will be integrated into the BioSync production stack to facilitate real-time health intelligence forecasting."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "joblib.dump(final_model, 'biosync_production_model.pkl')\n",
            "joblib.dump(scaler, 'biosync_scaler.pkl')\n",
            "print(\"Success: Model artifacts successfully serialized and ready for deployment.\")"
        ]
    }
]

# Jupyter Notebook structure
notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "codemirror_mode": {"name": "ipython", "version": 3},
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
            "version": "3.8.10"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 4
}

with open('Biosync_ML.ipynb', 'w') as f:
    json.dump(notebook, f, indent=1)

print("[SUCCESS] Academic Notebook 'Biosync_ML.ipynb' compiled with advanced academic documentation.")

