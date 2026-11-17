import os
from functools import cached_property
import google.auth
from google.auth.transport.requests import Request

from google.adk import Runner
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.integrations.agent_registry import AgentRegistry
from google.adk.auth.credential_manager import CredentialManager
from google.adk.integrations.agent_identity import GcpAuthProvider
try:
    from .config import config
except:
    from config import config

# Register the GCP Auth Provider globally to ensure MCP Toolsets authenticate successfully in Agent Engine
CredentialManager.register_auth_provider(GcpAuthProvider())

# -----------------------------------------------------------------------------
# FIX FOR REASONING ENGINE PICKLING ISSUE
# When deploying to Reasoning Engine, the AgentRegistry object is pickled 
# on the local developer machine (john@...) and unpickled on the cloud. 
# This causes ADK to attempt to refresh the local user's credentials on the 
# cloud metadata server, resulting in a 404 error.
# We patch _get_auth_headers to ALWAYS fetch fresh ADC credentials at runtime.
# -----------------------------------------------------------------------------
original_get_auth_headers = AgentRegistry._get_auth_headers

def patched_get_auth_headers(self) -> dict:
    try:
        creds, _ = google.auth.default()
        request = Request()
        creds.refresh(request)
        return {
            "Authorization": f"Bearer {creds.token}",
            "Content-Type": "application/json",
        }
    except Exception as e:
        # Fallback to original if something goes wrong
        return original_get_auth_headers(self)

AgentRegistry._get_auth_headers = patched_get_auth_headers


# Sync sessions from Gemini Enterprise to Survey Assistant by forcing auto_create_session=True.
# If a session_id is received and exists, ADK uses it; if not found, it automatically creates a new session.
original_runner_init = Runner.__init__
def patched_runner_init(self, *args, **kwargs):
    kwargs['auto_create_session'] = True
    original_runner_init(self, *args, **kwargs)
Runner.__init__ = patched_runner_init


# Monkeypatch Runner.run_async to print and log all inputs sent from Gemini Enterprise to Survey Assistant.
original_run_async = Runner.run_async
async def patched_run_async(self, *args, **kwargs):
    # Extract arguments safely from args or kwargs
    user_id = kwargs.get('user_id') or (args[0] if len(args) > 0 else None)
    session_id = kwargs.get('session_id') or (args[1] if len(args) > 1 else None)
    new_message = kwargs.get('new_message')
    state_delta = kwargs.get('state_delta')

    print("\n" + "="*80)
    print("[GEMINI ENTERPRISE INVOCATION TO SURVEY ASSISTANT]")
    print(f"App/Agent: {self.app_name}")
    print(f"Session ID (Gemini Enterprise): {session_id}")
    print(f"User ID: {user_id}")
    if new_message:
        print(f"Incoming Message: {new_message}")
    if state_delta:
        print(f"Incoming State/Context Delta: {state_delta}")
    print("="*80 + "\n")

    # Delegate to the original run_async generator
    async for event in original_run_async(self, *args, **kwargs):
        yield event
Runner.run_async = patched_run_async


class GlobalGemini(Gemini):
    """Pins the Vertex AI client to the location configured in config.py."""

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, project=config.GCP_PROJECT_ID, location=config.MODEL_LOCATION)


# Initialize AgentRegistry to retrieve the authenticated McpToolset (optional for local dev)
mcp_toolset = None
try:
    registry = AgentRegistry(
        project_id=config.GCP_PROJECT_ID,
        location="global"
    )
    mcp_toolset = registry.get_mcp_toolset(
        f"projects/{config.GCP_PROJECT_ID}/locations/global/mcpServers/{config.MCP_SERVER_NAME}"
    )
except Exception:
    print(f"Info: Optional AgentRegistry MCP '{config.MCP_SERVER_NAME}' not configured in '{config.GCP_PROJECT_ID}'; using built-in get_survey_questions tool.")

def get_survey_questions(mrn: str, survey_id: str) -> str:
    """
    Retrieve the customized survey questions for a patient from local storage or Google Cloud Storage (GCS).
    Use this tool to fetch the customized survey using the patient's mrn and survey_id.
    """
    import json
    local_survey_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "deployed_surveys", f"{mrn}_{survey_id}.json")
    )
    if os.path.exists(local_survey_path):
        try:
            with open(local_survey_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            deployed_qs = data.get("deployed_questions", [])
            return json.dumps(deployed_qs, indent=2)
        except Exception as local_err:
            print(f"Warning: Failed reading local survey file {local_survey_path}: {local_err}")

    from google.cloud import storage
    try:
        from settings import SURVEY_BUCKET_NAME
        gcs_client = storage.Client()
        bucket = gcs_client.bucket(SURVEY_BUCKET_NAME)
        gcs_key = f"deployed_surveys/{mrn}_{survey_id}.json"
        blob = bucket.blob(gcs_key)
        
        if blob.exists():
            content = blob.download_as_string().decode("utf-8")
            data = json.loads(content)
            deployed_qs = data.get("deployed_questions", [])
            return json.dumps(deployed_qs, indent=2)
            
        return f"No survey found locally or in GCS bucket '{SURVEY_BUCKET_NAME}' for the given MRN {mrn} and Survey ID {survey_id}."
    except Exception as e:
        return f"Error reading survey: {str(e)}"

agent_tools = [get_survey_questions]
if mcp_toolset is not None:
    agent_tools.append(mcp_toolset)

# 2. Root Patient Survey Assistant Agent
root_agent = LlmAgent(
    name="Patient_Survey_Assistant",
    model=GlobalGemini(model=config.MODEL_NAME),
    description=config.get_prompt(config.SURVEY_DESCRIPTION_FILE),
    sub_agents=[],
    instruction=config.get_prompt(config.SURVEY_INSTRUCTION_FILE) + "\n\nUse the 'get_survey_questions' tool to fetch the customized survey using the patient's mrn and survey_id.",
    tools=agent_tools,
)
