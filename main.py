import os
import sys

# Disable mTLS client-certificate endpoint rewrite (aiplatform.mtls.googleapis.com),
# which breaks async google-genai (aiohttp) requests on corporate macOS environments.
os.environ.setdefault("GOOGLE_API_USE_CLIENT_CERTIFICATE", "false")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Inject the monorepo root path into sys.path to allow root configuration imports natively
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

@asynccontextmanager
async def lifespan(app: FastAPI):
    port = int(os.getenv("PORT", 8001))
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173/")
    if os.path.isdir(os.path.join(current_dir, "frontend", "dist")):
        print(f"➜  App UI & API:  http://localhost:{port}/", flush=True)
    else:
        print(f"➜  Frontend UI:   {frontend_url}", flush=True)
        print(f"➜  Backend Docs:  http://localhost:{port}/docs", flush=True)
    yield

# Initialize master FastAPI instance
app = FastAPI(title="Clinical Intelligence & Questionnaire API Platform", lifespan=lifespan)

# Enable CORS for the local React App development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Mount specialized Agentic-PhysicianAssist router
try:
    from services.clingen_synth.server import agentic_physicianassist_router
    app.include_router(agentic_physicianassist_router)
    print("Unified Server: agentic_physicianassist router registered successfully.")
except Exception as e:
    print(f"Warning: Failed to load agentic_physicianassist router: {e}")

# 2. Mount specialized survey_tailor router
try:
    from services.survey_tailor.server import survey_tailor_router
    app.include_router(survey_tailor_router)
    print("Unified Server: survey_tailor router registered successfully.")
except Exception as e:
    print(f"Warning: Failed to load survey_tailor router: {e}")

# 3. Serve compiled React Frontend (frontend/dist) from the same FastAPI server
frontend_dist = os.path.join(current_dir, "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    print(f"Unified Server: Serving static frontend UI from {frontend_dist}")
else:
    print("Unified Server: API ready on port 8001 (Frontend UI served by Vite at http://localhost:5173 in dev mode).")

    @app.get("/")
    def dev_root():
        return {
            "status": "ok",
            "message": "Agentic-PhysicianAssist Backend API is running. Open http://localhost:5173 for the Frontend UI."
        }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

