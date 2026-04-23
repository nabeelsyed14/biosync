/**
 * BioSync V2 - Hardware Reception Node
 * 
 * This is a lightweight Node.js Express server to handle incoming
 * traffic from local IoT hardware (like a Raspberry Pi sensor array).
 * It listens on Port 3000 by default.
 * 
 * To run:
 * 1. Install dependencies: npm install express cors
 * 2. Start server: node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Fit OAuth Setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_FIT_CLIENT_ID,
    process.env.GOOGLE_FIT_CLIENT_SECRET,
    process.env.GOOGLE_FIT_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`
);

const SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.location.read'
];

// Middleware securely allows the frontend to fetch data from this backend
app.use(cors());
// Parse incoming JSON payloads from hardware
app.use(express.json());
// Serve static frontend files (HTML, CSS, JS, logo)
app.use(express.static(__dirname + '/www'));

// In-memory state of the latest hardware data
let latestHardwareData = {
    steps: 0,
    heartRate: 70,
    temperature: 22,
    humidity: 45,
    co2: 400
};

// --- NutriScale Nutrition Core ---
let userProfile = {
    age: 25,
    weight_kg: 70,
    height_cm: 175,
    gender: 'male',
    activity_level: 'moderate',
    goal: 'maintain' // lose, maintain, gain, muscle
};

let dailyNutrition = {
    calories_consumed: 0,
    protein_g: 0,
    fiber_g: 0,
    target_calories: 2250,
    meal_count: 0
};

// Calculation Logic
const calculateBMR = (p) => {
    if (p.gender === 'male') return (10 * p.weight_kg) + (6.25 * p.height_cm) - (5 * p.age) + 5;
    return (10 * p.weight_kg) + (6.25 * p.height_cm) - (5 * p.age) - 161;
};

const calculateTDEE = (bmr, level) => {
    const multipliers = { low: 1.2, moderate: 1.55, high: 1.725 };
    return Math.round(bmr * (multipliers[level] || 1.2));
};

const updateNutritionTargets = () => {
    const bmr = calculateBMR(userProfile);
    const tdee = calculateTDEE(bmr, userProfile.activity_level);
    const adjustments = { lose: -500, maintain: 0, gain: 500, muscle: 250 };
    dailyNutrition.target_calories = tdee + (adjustments[userProfile.goal] || 0);
};

// Initial calculation
updateNutritionTargets();

/**
 * 1. POST Endpoint for Hardware (Raspberry Pi/Galaxy Watch)
 * IoT Devices simply send an HTTP POST here:
 * URL: http://<YOUR_IP_ADDRESS>:3000/api/sensor
 * Body: { "type": "heartRate", "value": 75 }
 */
app.post('/api/sensor', (req, res) => {
    const { type, value } = req.body;
    
    if (type && value !== undefined) {
        // Update our local state
        latestHardwareData[type] = value;
        console.log(`[HARDWARE LOG] Received ${type}: ${value}`);
        res.status(200).json({ success: true, message: "Data synchronized." });
    } else {
        res.status(400).json({ success: false, message: "Invalid payload format." });
    }
});

/**
 * 2. GET Endpoint for Frontend UI
 * The BioSync Dashboard fetches this endpoint via JS to update the UI.
 */
app.get('/api/sync', (req, res) => {
    res.json({
        ...latestHardwareData,
        nutrition: dailyNutrition,
        profile: userProfile
    });
});

app.post('/api/profile', (req, res) => {
    userProfile = { ...userProfile, ...req.body };
    updateNutritionTargets();
    res.json({ success: true, profile: userProfile, target_calories: dailyNutrition.target_calories });
});

/**
 * 2b. GET Endpoint for Public Config (Supabase)
 */
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
});

/**
 * 3. POST Endpoint for Nutrition OpenAI Analysis (Ported from V1)
 * Takes a base64 string of a food image, queries GPT-4o-mini, and returns macros.
 */
app.post('/api/nutrition', async (req, res) => {
    const { image_base64 } = req.body;
    
    if (!image_base64) {
        return res.status(400).json({ error: "Missing image_base64 payload." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server missing OPENAI_API_KEY." });
    }

    const prompt = `Analyze this food image for the BioSync health platform. 
Identify all food items. Estimate weight in grams based on plate size.

CRITICAL: Return ONLY a valid JSON object. 
{
    "food_name": "string",
    "calories": integer,
    "protein": float,
    "carbs": float,
    "fat": float,
    "fiber": float,
    "health_insight": "short advice",
    "items": [{"item": "name", "weight": "estimate"}]
}
No markdown, no talk.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}`, detail: "high" } }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let content = data.choices[0].message.content.trim();
        if (content.startsWith("```")) content = content.replace(/```json|```/g, "").trim();

        const parsed = JSON.parse(content);
        const healthScore = calculateQualityScore(parsed, userProfile.goal);
        
        const result = {
            ...parsed,
            health_score: healthScore.score,
            health_emoji: healthScore.emoji,
            timestamp: new Date().toISOString()
        };

        // Update totals
        dailyNutrition.calories_consumed += result.calories;
        dailyNutrition.protein_g += (result.protein || 0);
        dailyNutrition.fiber_g += (result.fiber || 0);
        dailyNutrition.meal_count += 1;

        res.json(result);
    } catch (error) {
        console.error("❌ Nutrition AI Error:", error);
        res.status(500).json({ error: error.message || "Failed to analyze image." });
    }
});
// Quality Scoring (Ported from NutriScale)
const calculateQualityScore = (data, goal) => {
    let score = 80;
    if ((data.fiber || 0) > 5) score += 10;
    if ((data.protein || 0) > 20) score += 5;
    if ((data.fat || 0) > 20) score -= 10;
    
    // Goal based weights
    if (goal === 'muscle' && (data.protein || 0) < 15) score -= 15;
    if (goal === 'lose' && (data.calories || 0) > 600) score -= 10;

    const final = Math.max(0, Math.min(100, score));
    let emoji = "🟡 🙂";
    if (final >= 80) emoji = "🟢 🥗";
    if (final < 50) emoji = "🔴 🍟";
    
    return { score: final, emoji };
};

/**
 * 4. Google Fit OAuth Routes
 */
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        // Persist tokens in memory (or better yet, a database)
        console.log("✅ Google Fit Authenticated");
        res.send('<h1>Authentication Successful!</h1><p>You can close this tab and return to the BioSync Dashboard.</p>');
    } catch (error) {
        console.error("❌ Auth Error:", error);
        res.status(500).send("Authentication failed.");
    }
});

/**
 * 5. GET Endpoint for Google Fit Syncing
 * URL: http://localhost:3000/api/external-sync
 */
app.get('/api/external-sync', async (req, res) => {
    try {
        if (!oauth2Client.credentials.access_token) {
            return res.json({ status: "unauthenticated", message: "Visit /auth/google first" });
        }

        const fitness = google.fitness({ version: 'v1', auth: oauth2Client });
        
        // 1. Fetch Steps
        // Time range: Last 24 hours
        const end = Date.now();
        const start = end - (24 * 60 * 60 * 1000);

        const stepsRes = await fitness.users.dataset.aggregate({
            userId: 'me',
            requestBody: {
                aggregateBy: [{ dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps" }],
                bucketByTime: { durationMillis: (24 * 60 * 60 * 1000) },
                startTimeMillis: start,
                endTimeMillis: end
            }
        });

        // 2. Fetch Heart Rate
        const hrRes = await fitness.users.dataSources.datasets.get({
            userId: 'me',
            dataSourceId: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
            datasetId: `${start}000000-${end}000000`
        });

        // Extract Steps
        let steps = 0;
        const bucket = stepsRes.data.bucket[0];
        if (bucket && bucket.dataset[0].point[0]) {
            steps = bucket.dataset[0].point[0].value[0].intVal;
        }

        // Extract Latest Heart Rate
        let heartRate = latestHardwareData.heartRate;
        const points = hrRes.data.point;
        if (points && points.length > 0) {
            heartRate = Math.round(points[points.length - 1].value[0].fpVal);
        }

        // Update local state
        latestHardwareData.steps = steps;
        latestHardwareData.heartRate = heartRate;

        res.json({ 
            status: "success", 
            source: "Google Fit Cloud",
            data: { steps, heartRate }
        });
    } catch (error) {
        console.error("❌ Google Fit Sync Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`⚡ BioSync Gateway Active`);
    console.log(`📡 Listening for IoT Sensors on Port ${PORT}`);
    console.log(`===============================================`);
    console.log(`Hardware should POST to: http://localhost:${PORT}/api/sensor`);
});
