import os
from pathlib import Path

# Base workspace path (resolve relative to config/settings.py)
BASE_DIR = Path(__file__).resolve().parent.parent

# Centralized GCP Credentials & Location Defaults
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT") or "agentic-physicianassist-2257"
os.environ["GOOGLE_CLOUD_PROJECT"] = GOOGLE_CLOUD_PROJECT
GCP_REGION = os.getenv("GCP_REGION") or "us-central1"
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION") or "global"

# 1. ClinGen Synthesis Service Configurations
CLINGEN_PROJECT_ID = os.getenv("CLINGEN_PROJECT_ID") or "agentic-physicianassist-2257"
CLINGEN_LOCATION = os.getenv("CLINGEN_LOCATION") or "global"
CLINGEN_MODEL = os.getenv("CLINGEN_MODEL") or "gemini-3.5-flash"

# 2. Survey Tailor Backend Configurations
SURVEY_BUCKET_NAME = os.getenv("SURVEY_BUCKET_NAME", "clinical-chatbot-pocprojects")
AGENT_ID = os.getenv("AGENT_ID", "12430422255594194860")
DYNAMIC_LINK_TEMPLATE = os.getenv(
    "DYNAMIC_LINK_TEMPLATE",
    "https://vertexaisearch.cloud.google.com/home/cid/e8f1f600-60a1-4e18-82f2-c70c21616bc7/r/agent/{agent_id}/session/-?hl=en_US"
)

# 3. Survey Assistant Chatbot (Reasoning Engine) Configurations
ASSISTANT_MODEL_NAME = os.getenv("ASSISTANT_MODEL_NAME", "gemini-3.5-flash")
ASSISTANT_MODEL_LOCATION = os.getenv("ASSISTANT_MODEL_LOCATION", "global")
AGENT_DISPLAY_NAME = os.getenv("AGENT_DISPLAY_NAME") or "Patient-Survey-Assistant"
STAGING_BUCKET = os.getenv("STAGING_BUCKET", f"gs://{SURVEY_BUCKET_NAME}")
GCS_MCP_URL = os.getenv("GCS_MCP_URL", "https://storage.googleapis.com/storage/mcp")
SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT", "anaphor@agentic-physicianassist-2257.iam.gserviceaccount.com")
MCP_SERVER_NAME = os.getenv(
    "MCP_SERVER_NAME", 
    "agentregistry-00000000-0000-0000-8c4c-b4550d010e13"
)
