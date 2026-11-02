import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Inject the monorepo root path into sys.path to allow root configuration imports natively
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Initialize master FastAPI instance
app = FastAPI(title="Clinical Intelligence & Questionnaire API Platform")

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
    print(f"Warning: Frontend build directory not found at {frontend_dist}. Run 'npm run build' in ./frontend.")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

