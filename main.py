import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# 1. Mount specialized clingen router
try:
    from services.clingen_synth.server import clingen_router
    app.include_router(clingen_router)
    print("Unified Server: clingen_synth router registered successfully.")
except Exception as e:
    print(f"Warning: Failed to load clingen_synth router: {e}")

# 2. Mount specialized survey_tailor router
try:
    from services.survey_tailor.server import survey_tailor_router
    app.include_router(survey_tailor_router)
    print("Unified Server: survey_tailor router registered successfully.")
except Exception as e:
    print(f"Warning: Failed to load survey_tailor router: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
