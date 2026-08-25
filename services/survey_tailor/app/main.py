import aiohttp
import uuid
import re
from typing import Optional, List, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents import run_clinical_pipeline, generate_treatment_plan, handle_chat
from config import (
    REDCAP_TOKEN,
    REDCAP_API_URL,
    SURVEY_BUCKET_NAME,
    AGENT_ID,
    DYNAMIC_LINK_TEMPLATE,
    GECX_PROJECT_ID,
    GECX_APP_ID,
    GECX_DEPLOYMENT_ID,
    GECX_APP_VERSION,
)

app = FastAPI(title="Mayo Clinic Questionnaire API")

# Enable CORS for the local React App development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatPayload(BaseModel):
    message: str
    role: str # 'coordinator' or 'patient'
    session_id: Optional[str] = None
    context: Optional[dict] = None

class RunSessionPayload(BaseModel):
    session_id: str
    message: str
    mrn: Optional[str] = None
    survey_id: Optional[str] = None

class RequestPayload(BaseModel):
    narrative: str
    template_id: Optional[str] = None
    template_ids: Optional[List[str]] = None
    mrn: Optional[str] = None
    treatment_plan: Optional[str] = None

class PlanPayload(BaseModel):
    narrative: str

class DeployPayload(BaseModel):
    mrn: str
    survey_event_id: str
    survey_data: Any

@app.post("/api/chat")
async def chat_endpoint(payload: ChatPayload):
    try:
        session_id = payload.session_id or str(uuid.uuid4())
        response = await handle_chat(
            message=payload.message,
            role=payload.role,
            session_id=session_id,
            context=payload.context
        )
        return {
            "status": "success",
            "response": response,
            "session_id": session_id
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Global variables to cache google credentials
_credentials = None

def get_valid_token(force_refresh: bool = False) -> str:
    """Gets a cached access token, refreshing it only if expired or forced."""
    global _credentials
    try:
        import google.auth
        import google.auth.transport.requests

        if _credentials is None:
            _credentials, project = google.auth.default()

        # credentials.valid checks both presence of a token and if it is not expired
        if force_refresh or not _credentials.valid:
            auth_request = google.auth.transport.requests.Request()
            _credentials.refresh(auth_request)

        return _credentials.token or ""
    except Exception as e:
        print(f"Auth error during token fetch: {e}")
        return ""

@app.post("/api/run-session")
async def run_session_endpoint(payload: RunSessionPayload):
    """Secure mediator endpoint that uses local backend ADC to call GECX."""
    try:
        # Format session ID properly for GECX requirements (alphanumeric and hyphens, max 20 chars)
        clean_sid = re.sub(r'[^a-zA-Z0-9-]', '', payload.session_id)
        if len(clean_sid) > 20:
            clean_sid = clean_sid[:20]
        if not clean_sid:
            clean_sid = "defaultSession"
            
        # Dynamically fetch access token using host ADC, only if expired/invalid
        token = get_valid_token()

        session_name = f"projects/{GECX_PROJECT_ID}/locations/us/apps/{GECX_APP_ID}/sessions/{clean_sid}"
        deployment_name = f"projects/{GECX_PROJECT_ID}/locations/us/apps/{GECX_APP_ID}/deployments/{GECX_DEPLOYMENT_ID}"
        app_version_resource = f"projects/{GECX_PROJECT_ID}/locations/us/apps/{GECX_APP_ID}/versions/{GECX_APP_VERSION}"
        
        # Intercept starting message to inject MRN and Survey ID context directly in message text
        gecx_message = payload.message
        msg_lower = payload.message.lower().strip()
        if msg_lower in ["yes, let's start!", "lets_start", "start", "ready"] or "start" in msg_lower or "ready" in msg_lower:
            gecx_message = f"Yes, let's start! Patient MRN: {payload.mrn or 'N/A'}, Survey ID: {payload.survey_id or 'N/A'}"

        url = f"https://ces.googleapis.com/v1beta/{session_name}:runSession"
        
        post_data = {
            "config": {
                "session": session_name,
                "app_version": app_version_resource,
                "deployment": deployment_name
            },
            "inputs": [
                {
                    "text": gecx_message
                }
            ]
        }
        
        # Call GECX with up to 1 retry if it errors
        for attempt in range(2):
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=post_data, headers=headers) as response:
                        if response.status == 200:
                            resp_json = await response.json()
                            
                            outputs = resp_json.get("outputs", [])
                            bot_text = ""
                            payload_data = None
                            chunks = []
                            
                            if outputs:
                                first_output = outputs[0]
                                bot_text = first_output.get("text", "")
                                payload_data = first_output.get("payload") # Directly fetch custom_template payload!
                                
                                # Fallback: Parse diagnosticInfo chunks for tools if available
                                diag_info = first_output.get("diagnosticInfo", {})
                                messages = diag_info.get("messages", [])
                                for msg in messages:
                                    if msg.get("role") == "survey assistant" and "chunks" in msg:
                                        chunks.extend(msg["chunks"])
                            
                            return {
                                "status": "success",
                                "session_id": clean_sid,
                                "response": {
                                    "type": "text" if not (payload_data or chunks) else "rich_gecx_tool",
                                    "message": bot_text,
                                    "payload": payload_data,
                                    "chunks": chunks
                                }
                            }
                        else:
                            err_text = await response.text()
                            raise Exception(f"GECX Error {response.status}: {err_text}")
            except Exception as e:
                print(f"GECX attempt {attempt + 1} failed: {e}")
                if attempt == 0:
                    print("Retrying GECX with a freshly refreshed token...")
                    token = get_valid_token(force_refresh=True)
                else:
                    raise e
    except Exception as e:
        print(f"GECX Error: {e}")
        # Return fallback simulation if GECX or auth is offline
        return {
            "status": "success",
            "session_id": clean_sid,
            "response": {
                "type": "text",
                "message": f"GECX Sandbox Fallback: Medicated message '{payload.message}'. Patient MRN: {payload.mrn or 'N/A'}, Survey ID: {payload.survey_id or 'N/A'}. (Direct error: {str(e)})"
            }
        }

import os
import json

# Local data sources pointing to central /data directory
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))

@app.post("/api/redcap-proxy")
async def redcap_proxy():
    """Returns unique clinical survey forms from local metadata JSON."""
    try:
        meta_path = os.path.join(DATA_DIR, "metadata.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        
        # Extract unique form names
        unique_forms = sorted(list(set(item.get("form_name") for item in metadata if item.get("form_name"))))
        
        # Format list of dictionaries mimicking REDCap event-form mapping expected by frontend
        return [{"arm_num": "1", "unique_event_name": "baseline_arm_1", "form": f} for f in unique_forms]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local data load failed: {str(e)}")

@app.post("/api/analyze-narrative")
async def analyze_narrative(payload: PlanPayload):
    try:
        from agents import generate_treatment_plan, recommend_forms_for_narrative
        plan = await generate_treatment_plan(payload.narrative)
        recommendations = await recommend_forms_for_narrative(payload.narrative, plan)
        return {"status": "success", "plan": plan, "recommendations": recommendations}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/generate-treatment-plan")
async def handle_generate_treatment_plan(payload: PlanPayload):
    try:
        plan = await generate_treatment_plan(payload.narrative)
        return {"status": "success", "plan": plan}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/generate-questionnaire")
async def generate_questionnaire(payload: RequestPayload):
    try:
        # Build the list of templates to tailor
        templates = payload.template_ids or []
        if payload.template_id and payload.template_id not in templates:
            templates.append(payload.template_id)
            
        # Pass the treatment_plan if it exists to avoid regeneration
        data = await run_clinical_pipeline(
            patient_narrative=payload.narrative, 
            template_ids=templates, 
            patient_mrn=payload.mrn,
            treatment_plan=payload.treatment_plan
        )
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/deploy-survey")
async def deploy_survey(payload: DeployPayload):
    try:
        from google.cloud import storage
        import json
        
        # Generate the survey ID instead of session ID
        survey_id = str(uuid.uuid4())
        
        # Initialize GCS client using Application Default Credentials (ADC)
        client = storage.Client()
        bucket_name = SURVEY_BUCKET_NAME
        bucket = client.bucket(bucket_name)
        
        # Target path: {SURVEY_BUCKET_NAME}/surveys/{patient_mrn}/{survey_id}
        blob_path = f"surveys/{payload.mrn}/{survey_id}"
        blob = bucket.blob(blob_path)
        
        # Upload the JSON survey structure
        blob.upload_from_string(
            data=json.dumps(payload.survey_data, indent=2),
            content_type="application/json"
        )
        
        # Format the URL exactly like the template requested in config
        dynamic_link = DYNAMIC_LINK_TEMPLATE.format(
            agent_id=AGENT_ID,
            survey_id=survey_id
        )
        
        return {
            "status": "success",
            "message": "Survey deployed successfully to GCS",
            "gcs_uri": f"gs://{bucket_name}/{blob_path}",
            "dynamic_link": dynamic_link,
            "survey_id": survey_id
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/get-gcloud-token")
async def get_gcloud_token():
    try:
        token = get_valid_token()
        return {
            "status": "success",
            "token": token
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)