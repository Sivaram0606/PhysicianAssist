# Agentic-PhysicianAssist: Automated Clinical Narrative & Questionnaire Tailoring Platform

An advanced, high-performance full-stack clinical automation and questionnaire tailoring platform designed to translate unstructured patient narratives and registry data into structured clinical survey instruments and peer-reviewed clinical scribe documentation. Built on **Google Cloud Vertex AI (Gemini 3.5 Flash)** and **Google Agent Development Kit (ADK)**, this platform bridges the gap between raw medical records and actionable clinical workflows in seconds.

---

## 🚀 Key Features

- **Parallelized Clinical Scribe Synthesis:** Evaluates raw patient narratives and structured clinical datasets to synthesize detailed, structured clinical scribe records (History of Present Illness, Review of Systems, Medical/Surgical History, Hypermobility, Disability, etc.) in under 4 seconds via asynchronous concurrency (`asyncio.gather`).
- **Interactive Citations & Grounding:** Eliminates the AI "black box" by cross-referencing clinical claims against source records via Google Discovery Engine. Clicking citations in the UI dynamically highlights corresponding raw data fields.
- **Dynamic Diagnostic Repository (PDF Viewport):** Streams and embeds pathology and oncology lab report PDFs (`sample_oncology.pdf`) directly into the UI viewport via `/api/patient/{mrn}/lab-pdf`, allowing clinical coordinators to trigger an Oncology Scribe model to integrate lab findings into narrative notes.
- **Automated Form Recommendation:** Evaluates clinical survey metadata against patient profiles to prioritize relevant questionnaires (e.g., Scleroderma, Gastrointestinal, Dysautonomia) by High, Medium, or Low urgency.
- **Multimodal Questionnaire Tailoring:** Performs question extraction, inclusion, dropping, and contextual adaptation by cross-analyzing clinical template schemas and patient narratives.
- **Interactive Patient & Coordinator Chat:** Integrates a real-time conversational agent powered by Google ADK to query patients or clarify clinical history.
- **Cloud Storage & Graceful Fallback:** Automatically uploads tailored questionnaires to Google Cloud Storage (GCS) when `SURVEY_BUCKET_NAME` is configured, with seamless fallback to local disk storage for offline testing.

---

## 📊 Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                       React Frontend                        │
 │  (Clinical Notes Dashboard, Diagnostic PDF Viewport, Chat) │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼ REST APIs / Proxy (Port 8000)
 ┌─────────────────────────────────────────────────────────────┐
 │                   FastAPI Gateway Server                    │
 │        (Route Endpoints, Static Files, Central Settings)    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
 ┌─────────────────────────────┐         ┌─────────────────────┐
 │ Agentic-PhysicianAssist     │         │ Google ADK Agent    │
 │ Scribe Note Engine          │         │ Orchestrator        │
 └──────────┬──────────────────┘         └──────────┬──────────┘
            │                                       │
            └───────────────────┬───────────────────┘
                                │
                                ▼ Vertex AI APIs
 ┌─────────────────────────────────────────────────────────────┐
 │                  Gemini 3.5 Flash Model                     │
 └─────────────────────────────────────────────────────────────┘
```

- **Frontend:** Built with React 19, TypeScript, Tailwind CSS, and Vite.
- **Backend:** Unified Python FastAPI application serving API routes and compiled React assets.
- **Configuration:** Centralized in `settings.py` as the singular source of truth.

---

## ⚙️ Monorepo Project Structure

```text
.
├── main.py                       # Root FastAPI Gateway Server (Orchestrator)
├── settings.py                   # Centralized GCP Project & Model configurations
├── requirements.txt              # Unified master Python dependencies
├── Dockerfile                    # Multi-stage container (compiles UI + runs FastAPI)
├── docker-compose.yml            # Multi-service stack (separate UI and Backend)
├── Makefile                      # Quick-launch development and deployment commands
├── cloudbuild.yaml               # Google Cloud Build CI/CD deploy pipeline
├── data/                         # Patient records, metadata, and oncology PDFs
├── frontend/                     # React + Vite (TypeScript) Single Page Application
│   ├── App.tsx                   # Main application router and state management
│   ├── Dockerfile                # Nginx container for isolated frontend serving
│   ├── components/               # UI components (Synthesizer, Chat, Dashboard)
│   └── vite.config.ts            # Vite proxy configuration
├── services/                     # Specialized microservices & agent modules
│   ├── clingen_synth/            # Clinical note generation and PDF serving router
│   ├── survey_tailor/            # Survey recommendation and tailoring router
│   └── survey_assistant/         # Google ADK Chat Assistant prompts and config
└── terraform/                    # Infrastructure-as-Code for Cloud Run deployment
    ├── main.tf                   # Cloud Run, Artifact Registry, GCS, and IAM roles
    ├── variables.tf              # Configurable project and resource variables
    └── terraform.tfvars          # Deployment parameter values
```

---

## 🏁 Getting Started

### 1. Prerequisites
- **Docker & Docker Compose** (Docker Engine 20.10+ / Docker Compose v2)
- **Google Cloud SDK (`gcloud`)** with authenticated credentials
- **Python 3.12+**
- **Node.js 24+** (for frontend development)

### 2. Google Cloud Authentication
Authenticate with Google Cloud and configure Application Default Credentials (ADC) for Vertex AI access:
```bash
gcloud auth application-default login
gcloud config set project agentic-physicianassist-2257
```

---

## 🏃 Running the Application

### Option A: Unified Docker Container (Single Container: UI + Backend on Port 8000)

The root `Dockerfile` utilizes a multi-stage build that compiles the React frontend and packages it with the FastAPI backend into a single container image:

```bash
# 1. Build the unified Docker image
docker build -t agentic-physicianassist-app .

# 2. Run the container with local ADC mounted
docker run -p 8000:8000 \
  -e GOOGLE_CLOUD_PROJECT=agentic-physicianassist-2257 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
  -v ~/.config/gcloud/application_default_credentials.json:/root/.config/gcloud/application_default_credentials.json:ro \
  agentic-physicianassist-app
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

### Option B: Multi-Service Docker Compose (Hot-Reloading Development)

Launches isolated containers for the frontend (Nginx on Port 3000) and backend (FastAPI on Port 8000):

```bash
docker compose up --build
```

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **Backend Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

*(Note: If using legacy `docker-compose` v1, run with `COMPOSE_API_VERSION=1.40 docker-compose up --build`).*

---

### Option C: Quick Launch via Makefile

A `Makefile` is included at the repository root to streamline common workflows:

```bash
# Run both Backend (Port 8001) and Frontend (Vite dev server) concurrently
make run

# Deploy infrastructure to Cloud Run via Terraform
make deploy

# Tear down Cloud Run and provisioned resources
make destroy
```

---

### Option D: Local Native Execution (Without Docker)

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Compile Frontend static assets
cd frontend
npm install --silent
npm run build
cd ..

# 3. Boot the unified FastAPI server
python main.py
```
Navigate to **[http://localhost:8000](http://localhost:8000)**.

---

## ☁️ Production Cloud Deployment

### 1. Terraform Deployment (Google Cloud Run)
Automates infrastructure provisioning including Cloud Run v2, Artifact Registry, GCS buckets, and IAM roles:

```bash
cd terraform
terraform init
terraform apply -auto-approve
```

Key outputs:
- **Cloud Run URL:** `https://agentic-physicianassist-app-[hash].us-central1.run.app`
- **Artifact Registry Repository:** `us-central1-docker.pkg.dev/[PROJECT_ID]/agentic-physicianassist`

### 2. Google Cloud Build CI/CD
Trigger automated builds from the workspace root:

```bash
gcloud builds submit --config=cloudbuild.yaml --project=agentic-physicianassist-2257
```

---

## 🛠️ Configuration Reference (`settings.py`)

All runtime settings read from environment variables with sensible defaults:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `GOOGLE_CLOUD_PROJECT` | `agentic-physicianassist-2257` | Active GCP Project ID |
| `GCP_REGION` | `us-central1` | Deployment Region |
| `GOOGLE_CLOUD_LOCATION` | `global` | Vertex AI API endpoint location |
| `AGENTIC_PHYSICIANASSIST_PROJECT_ID` | `agentic-physicianassist-2257` | Scribe synthesis GCP project |
| `AGENTIC_PHYSICIANASSIST_LOCATION` | `global` | Synthesis API location |
| `AGENTIC_PHYSICIANASSIST_MODEL` | `gemini-3.5-flash` | Gemini foundation model |
| `SURVEY_BUCKET_NAME` | `clinical-chatbot-pocprojects` | GCS bucket for survey JSON storage |
| `AGENT_ID` | `12430422255594194860` | Vertex AI Search / Agent identifier |
| `PORT` | `8000` | Port for the root FastAPI server |
