# Mayo Clinic Clinical Questionnaire Tailoring Platform

An advanced, full-stack medical questionnaire tailoring platform designed to translate unstructured patient narratives into highly relevant, structured clinical questionnaires. Utilizing Google ADK for AI agent orchestration and Vertex AI (Gemini) for clinical intelligence, this platform helps coordinators match patients with optimal clinical templates, analyze patient needs, and tailor clinical intake questions dynamically.

## Key Features

- **Treatment Plan Synthesis:** Evaluates raw patient narratives using Gemini to synthesize concise, structured clinical treatment plans.
- **Automated Form Recommendation:** Analyzes REDCap form metadata against patient profiles to suggest relevant questionnaires (e.g. Scleroderma, Gastrointestinal, Dysautonomia) sorted by high, medium, or low priority.
- **Multimodal Questionnaire Tailoring:** Performs precise extraction, inclusion, dropping, and addition of intake questions using multimodal PDF understanding (by cross-analyzing clinical template PDFs and patient context).
- **Interactive Chat Interface:** Features a real-time clinical assistant to help coordinators query patients or gather missing context.
- **REDCap Integration:** Integrates dynamically with the REDCap API to fetch clinical templates, metadata, and patient baseline records.
- **Voice-to-Text Support:** Supports clinical coordinators dictating narratives or patients responding to follow-ups using local speech-recognition hooks.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │                       React App                         │
 │  (Dashboard, Chat, Available Forms, Questionnaire View)  │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ REST APIs / WebSocket Proxy
 ┌─────────────────────────────────────────────────────────┐
 │                   FastAPI Backend Server                │
 │  (FastAPI Route Endpoints, App Config, REDCap Proxy)    │
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
 │               Gemini 2.5/3.5 Flash Model                │
 └─────────────────────────────────────────────────────────┘
```

- **Frontend:** Built with React, TypeScript, and Vite. Utilizes Tailwind CSS for a modern, clinical, and responsive layout. Includes a dev proxy-interceptor to handle secure requests.
- **Backend:** A Python FastAPI server orchestrating Google ADK agents with Vertex AI Gemini. Fully configured using centralized configurations.
- **Database/Storage Integration:** Mocked connection with REDCap database API endpoints for metadata and blank intake clinical forms/PDFs.

---

## Project Structure

```
.
├── backend/                       # Python FastAPI Backend
│   ├── prompts/                   # Decoupled Markdown Prompt Templates
│   │   ├── form_recommendation_prompt.md
│   │   ├── form_recommendation_system.md
│   │   ├── patient_chat_system.md
│   │   ├── questionnaire_tailor_prompt.md
│   │   ├── questionnaire_tailor_system.md
│   │   └── treatment_plan_system.md
│   ├── agents.py                  # Orchestrated Agent definitions & logic
│   ├── config.py                  # CENTRAL CONFIGURATION MODULE
│   ├── main.py                    # FastAPI entrypoint, router, and API proxy
│   ├── pyproject.toml             # uv/pip project dependencies
│   └── .env.example               # Centralized configuration variables template
│
├── frontend/                      # React/Vite Frontend
│   ├── components/                # Modular layout and card elements
│   ├── hooks/                     # Custom hooks (e.g., VoiceToText)
│   ├── App.tsx                    # Main Dashboard SPA Coordinator Flow
│   ├── package.json               # Node.js dependencies
│   └── Dockerfile                 # Multi-stage production container build (Nginx)
│
├── docker-compose.yml             # Single-command environment orchestration
├── sample_patient.json            # Mock patient narrative file for testing
├── test_redcap.py                 # Endpoint verification utility for REDCap
└── GEMINI.md                      # Foundational agent/team guidelines
```

---

## Getting Started

### 1. Prerequisites
Ensure you have the following installed on your developer machine:
- **Docker & Docker Compose**
- **Google Cloud SDK** (with Application Default Credentials active)
- **Python 3.14+** (for local backend development)
- **Node.js 24+** (for local frontend development)

### 2. Google Cloud Setup
Authenticate with GCP and set up Application Default Credentials (ADC) to authorize Gemini API usage locally:
```bash
gcloud auth application-default login
```

### 3. Environment Configuration
Create a local configuration file for your backend settings:
```bash
cp backend/.env.example backend/.env
```
Ensure the variables in `backend/.env` are correctly set:
- `REDCAP_TOKEN`: The secure access token for the REDCap API.
- `REDCAP_API_URL`: The base URL pointing to the REDCap API.
- `GEMINI_MODEL`: The default Google Gemini Model ID (e.g. `gemini-3.5-flash` or `gemini-2.5-flash`).

---

## Running the Application

### Option A: Running with Docker Compose (Recommended)
You can launch the complete full-stack environment with a single command:
```bash
docker-compose up --build
```
- **Frontend Panel:** Available at [http://localhost:3000](http://localhost:3000)
- **Backend API Docs:** Available at [http://localhost:8000/docs](http://localhost:8000/docs)

### Option B: Local Running (For Development)

#### 1. Launch the Backend Server
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
python main.py
```
*Note: Make sure your `.env` file exists under the `backend` folder.*

#### 2. Launch the Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
- The local React development server will start at [http://localhost:5173](http://localhost:5173).

---

## Technical Features & Implementation Notes

- **Decoupled Prompts:** Prompt markdown system instructions and template strings are stored in `backend/prompts/` to ensure separating prompts from code.
- **Centralized Configuration:** The entire application leverages `backend/config.py` as its singular source of truth for runtime variables, making the deployment pipeline robust and avoiding hardcoded secrets or endpoints.
- **Robust Error Handling:** Integrates `tenacity` exponential backoff retries specifically for `429 RESOURCE_EXHAUSTED` rate limits.
- **Concurrently Executing Agents:** Tailoring multiple clinical templates simultaneously is optimized via Python's asynchronous standard library (`asyncio.gather`), significantly decreasing load times.
