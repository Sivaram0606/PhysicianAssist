# **ClinGen: Automated Clinical Narrative & Phenotyping Engine**

**ClinGen** is a high-performance clinical automation pipeline designed to bridge the gap between structured registry data and professional medical documentation. Built on **Google Cloud Vertex AI**, it transforms complex patient data into validated, peer-reviewed clinical narratives in seconds.

---

## **🌟 Purpose**
Modern medicine is data-rich but narrative-driven. Clinicians often spend hours manually synthesizing raw JSON registry data into readable History of Present Illness (HPI) or Review of Systems (ROS) sections. **ClinGen** automates this synthesis while providing an interactive, "Trust but Verify" audit trail for every claim generated.

---

## **🚀 Key Features**

### **1. Parallelized Clinical Synthesis**
Unlike traditional LLM wrappers that generate text sequentially, ClinGen utilizes a **High-Concurrency Architecture**. Powered by `asyncio.gather` and **Gemini 3.5 Flash**, the system triggers generation for 8+ clinical sections simultaneously.
* **Impact:** Total generation time is slashed from **30+ seconds to under 4 seconds**.

### **2. Deep-Link Traceability (Grounding & Citations)**
ClinGen solves the "Black Box" problem of AI. Every clinical claim is cross-referenced against the source patient record via **Google Discovery Engine**. 
* **Interactive Citations:** Clicking a citation (e.g., `[1]`) in the narrative instantly highlights the corresponding raw data field in the UI sidebar.
* **Refiner Logic:** A secondary LLM layer ensures that clinical scores (e.g., MIDAS, PROMIS, Beighton) are mapped to their specific interpreted meanings.

### **3. Dynamic Diagnostic Viewer**
* **Lab Reports Viewport:** Streams and embeds pathology/lab report PDF files (`sample_oncology.pdf`) dynamically from the backend data folder to the UI viewport using the secure `/api/patient/{mrn}/lab-pdf` endpoint.
* **Ambient Synthesis:** Allows coordinators to trigger a specialized Oncology Scribe model to digest the PDF contents and weave WBC counts and genetic markers directly into the patient note.

### **4. Automated AI Audit (LLM-as-a-Judge)**
Upon generation, ClinGen triggers an independent **Vertex AI EvalTask** that audits the narrative using objective metrics:
* **Groundedness:** Verifying claims against source facts.
* **Coherence & Fluency:** Ensuring professional medical standards.

---

## **⚙️ Architecture & Local Development Setup**

The monorepo is organized as follows:
```text
/home/john/clingen/
├── main.py                    # Root Gateway Server (Orchestrator)
├── settings.py                # Central GCP Project & Model configuration
├── requirements.txt           # Unified Master python dependencies
├── Dockerfile                 # Backend-only Container definition
├── docker-compose.yml         # Local Multi-Service Stack Orchestration
├── cloudbuild.yaml            # Google Cloud Build CI/CD deploy pipeline
├── data/                      # Patient datasets and oncology PDFs
├── frontend/                  # React + Vite (TypeScript) Single Page App
└── services/                  # Child services (clingen_synth, survey_tailor)
```

### **1. Prerequisites**
* **Python 3.12+** and **Node.js 24+**
* **Google Cloud CLI** authenticated to a project with Vertex AI, Application Default Credentials (ADC) set up, and Discovery Engine APIs enabled.

### **2. Local Authentication**
```bash
gcloud auth application-default login
gcloud config set project [YOUR_PROJECT_ID]
```

### **3. Option A: Unified Local Run (Single Port 8000)**
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
Open your browser and navigate to `http://localhost:8000`.

### **4. Option B: Local Docker-Compose Run (Hot-Reloading)**
This spins up both the Nginx React frontend (Port 3000) and python backend (Port 8000) concurrently inside isolated docker containers, complete with ADC mount volumes:
```bash
docker-compose up --build
```
Open your browser and navigate to `http://localhost:3000` (frontend) which proxies automatically to the backend on `http://localhost:8000`.

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
*Vision: ClinGen is designed to empower clinicians with AI that is not only fast but demonstrably grounded in truth.*
