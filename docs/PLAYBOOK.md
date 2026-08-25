# Playbook: Deploying PhenoFlow Demo to Google App Engine

This guide provides a step-by-step process for deploying the PhenoFlow demo (Vite frontend + FastAPI backend) to a new Google Cloud Platform (GCP) project.

---

## 1. Prerequisites & GCP Setup

### Enable Required APIs
Ensure the following APIs are enabled in your target GCP project:
- App Engine Admin API
- Cloud Build API
- Cloud Storage API
- Vertex AI API
- Discovery Engine API (for Grounded Generation)

### Initialize App Engine
App Engine must be initialized in your preferred region (e.g., `us-central1`).
```bash
gcloud app create --region=us-central1
```

---

## 2. Identity & Access Management (IAM)

The App Engine default service account (`PROJECT_ID@appspot.gserviceaccount.com`) requires specific permissions to build and run the application.

### Required Roles
Grant these roles to the App Engine service account:
1.  **Editor** (`roles/editor`): Granted at the **Project** level. This ensures the service account can create builds and access resources.
2.  **Storage Admin** (`roles/storage.admin`): Granted specifically on the **Staging Bucket** (`gs://staging.PROJECT_ID.appspot.com/`). This is often required if the default build permissions are restricted.

**Command Example:**
```bash
# Project-level Editor role
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/editor"

# Bucket-level Storage Admin role
gcloud storage buckets add-iam-policy-binding gs://staging.PROJECT_ID.appspot.com/ \
    --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/storage.admin"
```

---

## 3. Application Preparation

### Backend Integration (`server.py`)
To serve the frontend and backend as a single service, the FastAPI backend must serve the static frontend files.

> [!IMPORTANT]
> Define the catch-all route at the **very bottom** of `server.py` to ensure it doesn't "steal" requests destined for your `/api` endpoints.

```python
# --- At the bottom of server.py ---
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

frontend_dist_path = os.path.join(os.path.dirname(__file__), "ui", "dist")

if os.path.exists(frontend_dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")

@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_frontend(request: Request, full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="API route not found")
    
    index_path = os.path.join(frontend_dist_path, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            return f.read()
    return "<html><body><h1>PhenoFlow Demo API</h1><p>Frontend not found.</p></body></html>"
```

### Frontend Configuration (`App.jsx`)
1.  **Relative API Path**: Ensure `API_BASE` is set to `/api` instead of a local URL.
    ```javascript
    const API_BASE = '/api';
    ```
2.  **Auto-Populate Logic**: Ensure that selecting a patient automatically hydrates the form so data appears in the sidebar immediately.
    ```javascript
    const handlePatientClick = async (mrn) => {
        // ...
        const sourceRes = await axios.get(`${API_BASE}/patient/${mrn}/data`);
        setPatientSourceData(sourceRes.data);
        setFormData(sourceRes.data); // Hydrate sidebar
        setPrefillEnabled(true);
    };
    ```

---

## 4. Deployment Configuration Files

Create these files in your `demo/` root directory:

### `app.yaml`
```yaml
runtime: python312
instance_class: F2

handlers:
  - url: /api/.*
    script: auto
  - url: /assets
    static_dir: ui/dist/assets
  - url: /.*
    script: auto

entrypoint: uvicorn server:app --host 0.0.0.0 --port $PORT

env_variables:
  PYTHONPATH: "."
```

### `requirements.txt`
Ensure you include `google-cloud-aiplatform[evaluation]` and `tqdm` to avoid runtime import errors related to LLM evaluation.
```text
fastapi==0.115.0
uvicorn==0.30.6
vertexai
google-cloud-discoveryengine
pandas
pydantic
python-multipart
google-cloud-aiplatform[evaluation]
tqdm
```

### `.gcloudignore`
Exclude large local directories to speed up the upload and avoid "Too many files" errors.
```text
node_modules/
venv/
.venv/
ui/node_modules/
ui/src/
ui/public/
.git
.DS_Store
```

---

## 5. Deployment Process

Run these commands from the `demo/` directory:

1.  **Build the Frontend**:
    ```bash
    cd ui
    npm install
    npm run build
    cd ..
    ```

2.  **Deploy to App Engine**:
    ```bash
    gcloud app deploy app.yaml --project=YOUR_PROJECT_ID
    ```

---

## 6. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **404 on API calls** | Catch-all route is too high up in `server.py`. | Move `serve_frontend` to the end of the file. |
| **500 Server Error** | Missing dependencies (e.g., `tqdm`). | Check logs: `gcloud app logs read`. Update `requirements.txt`. |
| **Bucket Access Error** | Permission gap on staging bucket. | Grant `Storage Admin` to the App Engine service account. |
| **Empty Sidebar** | API Base URL or data hydration issue. | Verify `API_BASE = '/api'` and ensure `setFormData` logic is present. |
