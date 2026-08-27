# Clinical Research Intelligent Questionnaire Tailoring Platform

An advanced, high-performance full-stack clinical questionnaire tailoring platform designed to translate unstructured patient narratives into relevant, structured clinical survey templates. Utilizing **Google ADK** for reasoning agent orchestration and **Vertex AI (Gemini 3.5 Flash)** for clinical intelligence, this platform helps clinical coordinators match patients with optimal survey instruments, analyze patient needs, and tailor intake questionnaires dynamically.

---

## 🚀 Key Features

- **Clinical Scribe Note Synthesis:** Evaluates raw patient narratives using Gemini to synthesize detailed, structured clinical scribe records (HPI, ROS, Social/Medical History, hypermobility, disability, etc.) in under 4 seconds via asynchronous execution.
- **Dynamic Diagnostic Repository:** Streams and embeds hematopathology and oncology lab report PDFs (`sample_oncology.pdf`) dynamically from the backend data folder to the UI viewport using the secure `/api/patient/{mrn}/lab-pdf` endpoint, allowing clinicians to trigger an Oncology Scribe to synthesize findings into notes.
- **Automated Form Recommendation:** Analyzes clinical survey metadata against patient profiles to suggest relevant questionnaires (e.g. Scleroderma, Gastrointestinal, Dysautonomia) sorted by high, medium, or low priority.
- **Multimodal Questionnaire Tailoring:** Performs precise extraction, inclusion, dropping, and addition of intake questions using multimodal PDF understanding (by cross-analyzing clinical template metadata and patient context).
- **Interactive Chat Assistant:** Features a real-time clinical assistant to help coordinators query patients or gather missing context.
- **Clinical Database Integration:** Integrates dynamically with local metadata and patient records, supporting seamless offline local testing.
- **Robust Cloud Uploads:** Deploys questionnaires dynamically to Google Cloud Storage (GCS) if `SURVEY_BUCKET_NAME` is configured, with an automated graceful fallback to local disk storage.
- **Voice-to-Text Support:** Supports clinical coordinators dictating narratives or patients responding to follow-ups using local speech-recognition hooks.

---

## 📊 Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │                       React App                         │
 │     (Dashboard, Chat, Available Forms, Diagnostic UI)   │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ REST APIs / WebSocket Proxy
 ┌─────────────────────────────────────────────────────────┐
 │                   FastAPI Backend Server                │
 │       (FastAPI Route Endpoints, Central Settings)       │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ Google ADK Agent Runner
 ┌─────────────────────────────────────────────────────────┐
 │                Clinical Intelligent Agents              │
 │  (Treatment Plan, Tailoring, and Recommendation Agents) │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ Vertex AI APIs
 ┌─────────────────────────────────────────────────────────┐
 │               Gemini 3.5 Flash Model                    │
 └─────────────────────────────────────────────────────────┘
```

- **Frontend:** Built with React, TypeScript, and Vite. Utilizes standard CSS for a modern, clinical, and responsive layout.
- **Backend:** A unified Python FastAPI gateway server orchestrating Google ADK agents with Vertex AI Gemini. Fully configured using centralized configurations.
- **Database/Storage Integration:** Connected with local JSON datasets for metadata and patient records.

---

## ⚙️ Project Structure

The monorepo is cleanly flattened and organized as follows:
```text
/home/john/clingen/
├── main.py                    # Root Gateway Server (Orchestrator)
├── settings.py                # Centralized GCP Project & Model configurations
├── requirements.txt           # Unified Master python dependencies
├── Dockerfile                 # Backend-only container definition
├── docker-compose.yml         # Local Multi-Service Stack Orchestration
├── cloudbuild.yaml            # Google Cloud Build CI/CD deploy pipeline
├── data/                      # Patient datasets and oncology PDFs
├── frontend/                  # React + Vite (TypeScript) Single Page App
└── services/                  # Child services
    ├── clingen_synth/         # Scribe note generator and PDF serving router
    ├── survey_tailor/         # Questionnaire tailoring and recommendations router
    └── survey_assistant/      # ADK Patient Assistant configuration and prompts
```

---

## 🏁 Getting Started

### 1. Prerequisites
Ensure you have the following installed on your developer machine:
- **Docker & Docker Compose**
- **Google Cloud SDK** (with active Application Default Credentials)
- **Python 3.12+** (for local backend development)
- **Node.js 24+** (for local frontend development)

### 2. Google Cloud Setup
Authenticate with GCP and set up Application Default Credentials (ADC) to authorize Gemini API usage locally:
```bash
gcloud auth application-default login
gcloud config set project [YOUR_PROJECT_ID]
```

---

## 🏃 Running the Application

### Option A: Running with Docker Compose (Recommended Separated Mode)
You can launch the complete, isolated multi-service local environment with a single command:
```bash
docker-compose up --build
```
- **Hot-Reloading Frontend Panel:** Available at [http://localhost:3000](http://localhost:3000)
- **Backend APIs:** Available at [http://localhost:8000/docs](http://localhost:8000/docs)

### Option B: Unified Local Running (Single Port 8000)
This launches the backend, compiles the React assets, and serves the whole application natively from a single python process:
```bash
# Install root python dependencies
pip install -r requirements.txt

# Compile Frontend static assets
cd frontend
npm install --silent
npm run build
cd ..

# Boot the Full-Stack platform
python main.py
```
Open your browser and navigate to [http://localhost:8000](http://localhost:8000).

---

## ☁️ Production Cloud Deployment

Deployments are automated through **Google Cloud Build** (`cloudbuild.yaml`):
1. **Backend Deploy (Google Cloud Run):**
   - Built using the root `Dockerfile` (context `.`) to package the FastAPI orchestrator.
   - Pushed to the **`clingen`** Artifact Registry repository.
   - Deployed as `clinical-survey-intelligence-backend` on port `8000`.
2. **Frontend Deploy (Google App Engine):**
   - Compiles static React assets, baking in the production Cloud Run backend URL.
   - Deployed directly to App Engine Standard using `frontend/app.yaml` under `clinical-survey-intelligence-frontend` for high-performance CDN static delivery.

---

## 🛠️ Technical Features & Implementation Notes

- **Decoupled Prompts:** Prompt markdown system instructions and template strings are stored in `services/survey_assistant/prompts` to ensure clean segregation of prompts from code.
- **Centralized Configuration:** The entire application leverages `/home/john/clingen/settings.py` as its singular source of truth for runtime variables, making the deployment pipeline robust.
- **Robust Error Handling:** Integrates `tenacity` exponential backoff retries specifically for `429 RESOURCE_EXHAUSTED` rate limits.
- **Concurrently Executing Agents:** Tailoring multiple clinical templates simultaneously is optimized via Python's asynchronous standard library (`asyncio.gather`), significantly decreasing load times.
