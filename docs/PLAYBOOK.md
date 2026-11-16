# **Playbook: Deploying Consolidated Monorepo to GCP (GAE + Cloud Run)**

This playbook guides GCP Administrators on how to set up, authenticate, and deploy the separate clinical platforms (React Frontend on Google App Engine Standard + FastAPI Backend on Google Cloud Run) from this unified monorepo.

---

## **1. Prerequisites & GCP Setup**

### **Enable Required APIs**
Ensure the following APIs are enabled in your target GCP project:
- App Engine Admin API
- Cloud Build API
- Artifact Registry API
- Cloud Run API
- Vertex AI API
- Discovery Engine API (for Grounded Scribe claims verification)

### **Initialize App Engine**
App Engine must be initialized in your preferred region:
```bash
gcloud app create --region=us-central1
```

### **Create Artifact Registry Repo**
Create a new Docker repository named **`agentic-physicianassist`** inside us-central1 to store your backend images:
```bash
gcloud artifacts repositories create agentic-physicianassist \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repository for Clinical Notes & Questionnaire Backend Containers"
```

---

## **2. Identity & Access Management (IAM)**

The Cloud Build default service account (`[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`) requires permissions to build and deploy to both App Engine and Cloud Run.

### **Required Roles**
Grant the following roles to the Cloud Build service account:
1. **App Engine Admin** (`roles/appengine.appAdmin`)
2. **Cloud Run Admin** (`roles/run.admin`)
3. **Service Account User** (`roles/iam.serviceAccountUser`) (to act as the target run execution service account)
4. **Artifact Registry Writer** (`roles/artifactregistry.writer`)

---

## **3. Architecture Verification**

The monorepo separates systems while deploying seamlessly:

### **A. Backend Server (Google Cloud Run)**
- **Configuration (`settings.py`):** Located at the project root. Holds your active GCP `PROJECT_ID`, location, and clinical model definitions.
- **Dockerfile (`Dockerfile`):** Located at the project root. Pulls python 3.12, installs the master unified `AgenticPhysicianAssist/requirements.txt`, and boots uvicorn on port `8000`.

### **B. Frontend Client (Google App Engine)**
- **App Engine Config (`frontend/app.yaml`):** Located in the `frontend/` folder. Serves compiled React assets directly as GAE CDN static files using python312 runtime.
- **Production URL Injection:** Vite compiles code with `VITE_API_URL` environment variables set to the Cloud Run backend URL during Cloud Build, guaranteeing secure browser-to-server connectivity.

---

## **4. Deployment Process (CI/CD)**

Deployments are automated in single steps using Google Cloud Build.

### **Manual Trigger Command**
Trigger the build pipeline directly from the root of your local workspace:
```bash
gcloud builds submit --config=cloudbuild.yaml --project=[YOUR_PROJECT_ID]
```

### **Pipeline Execution Summary**
Cloud Build sequentially executes:
1. **`build-backend`**: Builds the backend-only container using the root `Dockerfile`.
2. **`push-backend`**: Tags and pushes the container to `us-central1-docker.pkg.dev/[PROJECT_ID]/agentic-physicianassist/backend:latest`.
3. **`deploy-backend`**: Launches the container on Google Cloud Run on port `8000`.
4. **`build-frontend-assets`**: Installs Node modules and compiles React static files inside `frontend/dist/` with the Cloud Run API URL.
5. **`deploy-frontend`**: deploys the static files directly to App Engine Standard using `frontend/app.yaml`.

---
