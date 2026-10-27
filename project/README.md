# loumi — AI-Powered Smart Farming

**Loumi** is an AI-assisted agricultural platform designed to help farmers make informed farming decisions using machine learning, weather information, and agricultural data.

The platform aims to support crop health monitoring, cultivation planning, crop suitability assessment, and weather-based risk prediction.

**Current focus:** Pineapple farming, with rice farming under development and plans to support additional crops in the future.

Loumi is being designed as a scalable, multi-crop platform. Its architecture should allow new crops and their associated ML models to be integrated without rebuilding the entire website.

## Features

Loumi currently provides five feature areas. Their interfaces and backend integration points are designed to support the integration of trained ML models and other agricultural services.

### 1. Disease Detection
- Upload an image or capture a photo using a supported device.
- Submit the image for analysis by a connected ML model.
- Display the predicted disease, classification, confidence (if available), symptoms, and recommended next steps.
- Designed initially for pineapple disease detection, with the possibility of supporting other crops through compatible models.

### 2. Farm Planner
- Collect information about farm area, soil, water availability, location, budget, and farming goals.
- Display a cultivation plan, timeline, and task checklist based on backend recommendations.
- Designed to accommodate crop-specific planning requirements as support expands to pineapple, rice, and other crops.

### 3. Chatbot
- Conversational agricultural assistant with English and Hindi language support.
- Designed to answer questions about crop cultivation, soil, crop health, planting seasons, and farming practices.
- Requires a connected AI provider or language model to generate real responses.

### 4. Variety & Suitability
- Assess whether a crop may be suitable for a given location and its growing conditions.
- Collect information about soil, drainage, temperature, rainfall, water availability, and other relevant factors.
- Display suitability assessments and variety recommendations when supported by the connected model or recommendation engine.
- Currently being developed for pineapple cultivation, with rice and other crops planned for future expansion.

### 5. Weather Disease Prediction
- Use location and relevant weather conditions to estimate potential crop disease risks.
- Display risk levels, contributing conditions, and preventive recommendations when supported by the backend.
- Designed to distinguish weather-based risk prediction from image-based disease detection.
- Future crop support will require suitable crop-specific data and validated prediction models.

**Important:** The frontend does not intentionally fabricate ML predictions. When a feature's backend service is unavailable, the UI should communicate that clearly instead of presenting a mock prediction as a real result.

---

## Tech Stack

### Frontend
- **React** — user interface.
- **TypeScript** — type-safe application development.
- **Vite** — development server and build tooling.
- **Tailwind CSS** — styling and responsive layouts.
- **React Router** — page navigation.
- **Lucide React** — icons.
- **Fetch API** — communication with backend services through a shared API client.

### Backend and ML Integration
- **Python with FastAPI or Flask** — serving ML models and agricultural services.
- **Joblib or compatible model-loading tools** — loading supported saved models.
- **Weather API** — obtaining weather information when configured.
- **AI provider API or self-hosted language model** — powering the chatbot.

The backend technology can evolve independently of the frontend, provided that the API contracts remain compatible.

---

## Getting Started

### Prerequisites
- Node.js and npm.
- The project source code.
- A running backend for any features you want to test with real predictions.

### Install Dependencies

```bash
npm install
```

### Start the Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Type Checking and Linting

If these scripts are configured in `package.json`, run:

```bash
npm run typecheck
npm run lint
```

---

## Configure the Backend URL

Create a `.env` file in the frontend project root using `.env.example` as a template.

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WEATHER_API_BASE_URL=
```

`VITE_API_BASE_URL` specifies the backend's base URL.

`VITE_WEATHER_API_BASE_URL` is optional and should be used only if the existing frontend supports a separate weather service.

For example, if the backend runs locally on port `8000`, the frontend can send requests to that backend.

All frontend API URLs should be managed centrally through `src/config/api.ts`.

**Security note:** Variables prefixed with `VITE_` are exposed to the browser. Never store secret API keys or credentials in them.

---

## API Endpoints

The current frontend uses the following endpoint conventions:

| Feature | Method | Endpoint |
|---|---|---|
| Disease Detection | POST | `/api/disease-detection` |
| Farm Planner | POST | `/api/farm-planner` |
| Chatbot | POST | `/api/chatbot` |
| Variety & Suitability | POST | `/api/variety-suitability` |
| Weather Disease Prediction | POST | `/api/weather-disease-prediction` |

The weather page may also use the following optional endpoint to retrieve weather information:

| Purpose | Method | Endpoint |
|---|---|---|
| Weather data | GET | `/api/weather?lat=...&lon=...` |

The weather endpoint is available only when the relevant backend service has been implemented and configured.

**These endpoint names describe the frontend's expected API contract. They do not mean that the backend endpoints or ML models have already been implemented.**

Before integration, inspect the existing TypeScript service modules and confirm their actual request and response formats.

---

## Project Structure

The current frontend follows a modular structure:

```text
loumi/
├── src/
│   ├── components/
│   │   └── ui/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── DiseaseDetection.tsx
│   │   ├── FarmPlanner.tsx
│   │   ├── Chatbot.tsx
│   │   ├── VarietySuitability.tsx
│   │   └── WeatherDiseasePrediction.tsx
│   ├── services/
│   │   ├── apiClient.ts
│   │   ├── diseaseDetectionService.ts
│   │   ├── farmPlannerService.ts
│   │   ├── chatbotService.ts
│   │   ├── varietySuitabilityService.ts
│   │   └── weatherDiseaseService.ts
│   ├── types/
│   ├── config/
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── README.md
```

The exact filenames may differ slightly from this example. Use the existing project structure as the source of truth.

### Why This Structure?

Each feature has its own page, service module, and request/response types. This separation makes it easier to connect, test, and update individual ML models without unnecessarily changing other features.

---

## Connecting Machine Learning Models

Loumi's frontend is designed to communicate with ML models through backend APIs.

A typical workflow is:

1. A farmer enters information or uploads an image.
2. The frontend validates the input.
3. The frontend sends the request to the appropriate backend endpoint.
4. The backend preprocesses the input and invokes the relevant model or recommendation logic.
5. The backend returns a structured response.
6. The frontend displays the returned result.

### Recommended Backend Structure

A separate Python backend can be organised as follows:

```text
loumi-backend/
├── app/
│   ├── main.py
│   ├── api/
│   ├── services/
│   ├── schemas/
│   └── models/
├── requirements.txt
├── .env.example
└── README.md
```

This is a suggested structure, not a claim that these files already exist.

### Model Integration Guidelines

- Load saved models on the backend, not in the browser.
- Preserve the preprocessing steps and feature order used during model training.
- Validate inputs before making predictions.
- Return structured JSON that matches the frontend's TypeScript interfaces.
- Handle model-loading failures and invalid inputs without fabricating results.
- Keep API credentials on the backend.
- Test each model independently before connecting it to the UI.

A saved `.pkl` file alone may not be sufficient. Depending on how the model was trained, it may also require saved encoders, scalers, preprocessing pipelines, or other dependencies.

### Implemented: Pineapple Variety Suitability API (`POST /api/variety-suitability`)

The **Pineapple Variety Suitability ML Model** (`pineapple_suitability_model.pkl`) is served via FastAPI. The backend aligns the 30 input features (10 agro-climatic measurements and 20 one-hot encoded categories), runs `RandomForestClassifier.predict()` and `predict_proba()`, and executes the ICAR Manipur / MOMA rule-based variety matcher for **Queen** and **Kew** pineapple cultivars.

#### Expected Model File Location
`backend/ml/weights/pineapple_suitability_model.pkl` (configurable via `SUITABILITY_MODEL_PATH`).

#### Sample Request (`POST /api/variety-suitability`)

```json
{
  "state": "Manipur",
  "district": "Imphal West",
  "village": "Lamphel",
  "latitude": 24.817,
  "longitude": 93.937,
  "soilType": "sandy_loam",
  "soilDrainage": "good",
  "waterAvailability": "reliable",
  "plantingSeason": "pre_monsoon",
  "soilPH": 5.2,
  "temperatureMin": 18.0,
  "temperatureMax": 30.0,
  "rainfall": 1800.0,
  "elevation": 780.0,
  "farmArea": 2.5,
  "preferredVariety": "queen",
  "intendedUse": "fresh"
}
```

#### Sample Response (HTTP 200 OK)

```json
{
  "result": {
    "status": "suitable",
    "score": 70.4,
    "scoreExplanation": "Suitable for pineapple cultivation (Model confidence: 70.4%)",
    "recommendedVarieties": [
      {
        "variety": "Kew Pineapple",
        "score": 100.0,
        "bestUse": "Commercial canning, juice & processing",
        "description": "Large-sized, fiberless, juice-rich variety highly suitable for canning and processing. Thrives in valley floors and foothills.",
        "advantages": [
          "Large cylindrical fruit (1.5–2.5 kg) with fiberless, juice-rich flesh ideal for canning and juice processing.",
          "Thrives in fertile valley floors and foothills with good water retention."
        ],
        "limitations": [],
        "optimalConditions": [
          "Temperature: 18.0°C – 35.0°C",
          "Annual Rainfall: 1500.0 – 3000.0 mm",
          "Soil pH: 4.5 – 5.5",
          "Drainage: Good"
        ],
        "reasons": [
          "Suitability match score: 100/100",
          "Large-sized, fiberless, juice-rich variety highly suitable for canning and processing. Thrives in valley floors and foothills."
        ]
      },
      {
        "variety": "Queen Pineapple",
        "score": 85.0,
        "bestUse": "Fresh table consumption",
        "description": "Highly aromatic, golden yellow flesh, high sweetness. Best for fresh consumption; thrives on hill slopes and well-drained tracts of Manipur (Thoubal, Churachandpur).",
        "advantages": [
          "High sweetness, rich golden-yellow flesh, and strong pleasant aroma favored for fresh fruit markets.",
          "Highly adapted to well-drained slopes and red sandy loam soils of Manipur (e.g. Thoubal, Churachandpur)."
        ],
        "limitations": [
          "Prefers Excellent drainage; current field has Good drainage.",
          "Smaller fruit size and deeper eyes make it less economical for commercial canning factories."
        ],
        "optimalConditions": [
          "Temperature: 15.0°C – 32.0°C",
          "Annual Rainfall: 1200.0 – 2500.0 mm",
          "Soil pH: 5.0 – 6.0",
          "Drainage: Excellent"
        ],
        "reasons": [
          "Suitability match score: 85/100",
          "Highly aromatic, golden yellow flesh, high sweetness. Best for fresh consumption; thrives on hill slopes and well-drained tracts of Manipur (Thoubal, Churachandpur)."
        ]
      }
    ],
    "reasons": [
      "Soil pH (5.2) is within the optimal acidic range (4.5–6.5) required by pineapples.",
      "Good soil drainage provides healthy aeration and prevents Phytophthora root rot.",
      "Annual precipitation (1800 mm) is well suited for rainfed pineapple farming.",
      "Temperature range (18.0°C to 30.0°C) matches tropical pineapple physiological requirements.",
      "Sandy Loam soil provides optimal balance of drainage, aeration, and root anchorage."
    ],
    "limitations": [],
    "improvements": [],
    "conditionsUsed": [
      { "field": "Minimum Temperature", "value": "18.0 °C", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Maximum Temperature", "value": "30.0 °C", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Annual Rainfall", "value": "1800 mm", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Soil pH", "value": "5.2", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Soil Type", "value": "Sandy Loam", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Soil Drainage", "value": "Good", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Planting Season / Month", "value": "pre_monsoon (March)", "source": "provided", "sourceLabel": "Farmer provided" },
      { "field": "Elevation", "value": "780 m", "source": "provided", "sourceLabel": "Farmer provided" }
    ],
    "dataStillNeeded": [
      "Laboratory soil test for Nitrogen (N), Phosphorus (P), and Potassium (K) nutrient profile",
      "In-situ volumetric soil moisture measurement"
    ]
  },
  "modelVersion": "PineappleSuitability-RF-v1.0 (ICAR NEH Manipur / MOMA Agro-Climatic Dataset)"
}
```

---

## Multi-Crop Architecture

Loumi currently focuses on pineapple farming, while rice farming is under development.

The long-term objective is to support multiple crops through a modular architecture.

### Current Development Priorities

**Pineapple**
- Disease detection.
- Variety and land suitability.
- Farm planning.
- Weather-based disease risk prediction.

**Rice**
- Develop suitable rice-specific datasets and agricultural logic.
- Evaluate appropriate rice disease detection and prediction models.
- Add rice-specific cultivation planning and suitability assessments where reliable data and models are available.

**Future Crops**
- Introduce additional crops as appropriate datasets, models, and agricultural knowledge become available.

### Important Design Principle

Different crops require different inputs, growing conditions, disease classes, and recommendation logic.

Do not assume that a pineapple model can predict rice diseases or rice suitability.

When expanding the platform, prefer crop-specific model configurations and validation rules while reusing common UI components, API infrastructure, authentication, and other shared services.

For example, a future implementation could introduce a crop selector and route the request to a suitable crop-specific model. Add this only when the corresponding models and backend support are ready.

---

## Responsible Agricultural Guidance

Loumi provides AI-assisted agricultural information to support farming decisions.

Predictions and recommendations may be incomplete or inaccurate. Results should be interpreted alongside local conditions, reliable agricultural research, and advice from qualified agricultural experts.

Do not present estimated disease risks as confirmed diagnoses, or suitability scores as guarantees of crop success.

Privacy, security, and data-handling claims must reflect the safeguards actually implemented by the application.

---

## Development Roadmap

1. Finalise the frontend UI and user experience.
2. Connect and test the pineapple suitability model.
3. Integrate the agricultural chatbot with a real AI response engine.
4. Connect pineapple disease detection.
5. Implement weather-based disease risk prediction using suitable data and models.
6. Develop pineapple farm planning logic.
7. Expand to rice farming using rice-specific agricultural data and validated models.
8. Extend support to additional crops as the platform evolves.

**Vision:** Build Loumi into a flexible agricultural platform that helps farmers make better-informed decisions across multiple crops.