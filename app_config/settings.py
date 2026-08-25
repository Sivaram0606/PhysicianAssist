import os
from pathlib import Path

# Base workspace path (resolve relative to config/settings.py)
BASE_DIR = Path(__file__).resolve().parent.parent

# Centralized GCP Credentials & Location Defaults
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "pocprojects-502518")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")

# 1. ClinGen Synthesis Service Configurations
CLINGEN_PROJECT_ID = os.getenv("CLINGEN_PROJECT_ID", "pocprojects-502518")
CLINGEN_LOCATION = os.getenv("CLINGEN_LOCATION", "us-central1")
CLINGEN_MODEL = os.getenv("CLINGEN_MODEL", "gemini-2.5-flash")

# 2. Survey Tailor Backend Configurations
SURVEY_BUCKET_NAME = os.getenv("SURVEY_BUCKET_NAME", "clinical-chatbot-pocprojects")
AGENT_ID = os.getenv("AGENT_ID", "12430422255594194860")
DYNAMIC_LINK_TEMPLATE = os.getenv(
    "DYNAMIC_LINK_TEMPLATE",
    "https://vertexaisearch.cloud.google.com/home/cid/e8f1f600-60a1-4e18-82f2-c70c21616bc7/r/agent/{agent_id}/session/-?hl=en_US"
)

# GECX Orchestrations
GECX_PROJECT_ID = os.getenv("GECX_PROJECT_ID", GOOGLE_CLOUD_PROJECT)
GECX_APP_ID = os.getenv("GECX_APP_ID", "d23b67c0-8ebf-4cdb-a77f-aec49bd1901e")
GECX_DEPLOYMENT_ID = os.getenv("GECX_DEPLOYMENT_ID", "345df3d9-9f05-45c1-b27d-7a58b3b28e52")
GECX_APP_VERSION = os.getenv("GECX_APP_VERSION", "13e5f6ba-f114-4af1-8473-425d54fa3f70")

# 3. Survey Assistant Chatbot (Reasoning Engine) Configurations
ASSISTANT_MODEL_NAME = os.getenv("ASSISTANT_MODEL_NAME", "gemini-3.5-flash")
ASSISTANT_MODEL_LOCATION = os.getenv("ASSISTANT_MODEL_LOCATION", "global")
AGENT_DISPLAY_NAME = os.getenv("AGENT_DISPLAY_NAME", "Mayo-Survey-Assistant")
STAGING_BUCKET = os.getenv("STAGING_BUCKET", f"gs://{SURVEY_BUCKET_NAME}")
GCS_MCP_URL = os.getenv("GCS_MCP_URL", "https://storage.googleapis.com/storage/mcp")
SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT", "anaphor@pocprojects-502518.iam.gserviceaccount.com")
MCP_SERVER_NAME = os.getenv(
    "MCP_SERVER_NAME", 
    "agentregistry-00000000-0000-0000-d12f-592617096909"
)
