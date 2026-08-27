import sys
import os
import uuid
import re
import json
import aiohttp
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Add this service's directory to sys.path to let python resolve local sibling imports cleanly
current_service_dir = os.path.dirname(os.path.abspath(__file__))
if current_service_dir not in sys.path:
    sys.path.insert(0, current_service_dir)

from survey_assistant.agent import root_agent
from google.adk import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.utils.content_utils import extract_text_from_content
from google.genai import types

from agents import run_clinical_pipeline, generate_treatment_plan, handle_chat
from config import (
    SURVEY_BUCKET_NAME,
    AGENT_ID,
    DYNAMIC_LINK_TEMPLATE,
)

survey_tailor_router = APIRouter()

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

# Single global runner for survey assistant chat
survey_assistant_runner = Runner(
    agent=root_agent,
    app_name="survey_assistant",
    session_service=InMemorySessionService(),
    auto_create_session=True
)

@survey_tailor_router.post("/api/chat")
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

@survey_tailor_router.post("/api/run-session")
async def run_session_endpoint(payload: RunSessionPayload):
    """Executes the Patient Survey Assistant agent locally using ADK's Runner."""
    clean_sid = re.sub(r'[^a-zA-Z0-9-]', '', payload.session_id)
    if len(clean_sid) > 20:
        clean_sid = clean_sid[:20]

    if not clean_sid:
        clean_sid = "defaultSession"

    try:
        # Intercept starting message to inject MRN and Survey ID context directly in message text
        assistant_message = payload.message
        msg_lower = payload.message.lower().strip()
        if msg_lower in ["yes, let's start!", "lets_start", "start", "ready"] or "start" in msg_lower or "ready" in msg_lower:
            assistant_message = f"Yes, let's start! Patient MRN: {payload.mrn or 'N/A'}, Survey ID: {payload.survey_id or 'N/A'}"

        message_parts = [types.Part(text=assistant_message)]

        final_event = None
        chunks = []
        
        # Stream the async runner execution
        async for event in survey_assistant_runner.run_async(
            user_id="default_user",
            session_id=clean_sid,
            new_message=types.Content(role="user", parts=message_parts)
        ):
            if not event.partial:
                final_event = event
                # Extract event-level payload or chunks if they exist
                if hasattr(event, "chunks") and event.chunks:
                    chunks.extend(event.chunks)
                elif isinstance(event, dict) and "chunks" in event:
                    chunks.extend(event["chunks"])

        bot_text = ""
        payload_data = None

        if final_event:
            if hasattr(final_event, "output") and final_event.output:
                bot_text = final_event.output
            else:
                bot_text = extract_text_from_content(final_event.content)

            if hasattr(final_event, "payload") and final_event.payload:
                payload_data = final_event.payload
            elif isinstance(final_event, dict) and "payload" in final_event:
                payload_data = final_event["payload"]

        return {
            "status": "success",
            "session_id": clean_sid,
            "response": {
                "type": "text" if not (payload_data or chunks) else "rich_assistant_tool",
                "message": bot_text,
                "payload": payload_data,
                "chunks": chunks
            }
        }
    except Exception as e:
        print(f"ADK local assistant error: {e}")
        return {
            "status": "success",
            "session_id": clean_sid,
            "response": {
                "type": "text",
                "message": f"Local ADK Fallback: Patient MRN: {payload.mrn or 'N/A'}, Survey ID: {payload.survey_id or 'N/A'}. (Direct error: {str(e)})"
            }
        }

# Local data sources pointing to central /data directory
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))

@survey_tailor_router.post("/api/forms-proxy")
async def forms_proxy():
    """Returns unique clinical survey forms from local metadata JSON."""
    try:
        meta_path = os.path.join(DATA_DIR, "metadata.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        
        # Extract unique form names
        unique_forms = sorted(list(set(item.get("form_name") for item in metadata if item.get("form_name"))))
        
        # Format list of dictionaries mimicking event-form mapping expected by frontend
        return [{"arm_num": "1", "unique_event_name": "baseline_arm_1", "form": f} for f in unique_forms]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local data load failed: {str(e)}")

@survey_tailor_router.post("/api/analyze-narrative")
async def analyze_narrative(payload: PlanPayload):
    try:
        from agents import generate_treatment_plan, recommend_forms_for_narrative
        plan = await generate_treatment_plan(payload.narrative)
        recommendations = await recommend_forms_for_narrative(payload.narrative, plan)
        return {"status": "success", "plan": plan, "recommendations": recommendations}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@survey_tailor_router.post("/api/generate-treatment-plan")
async def handle_generate_treatment_plan(payload: PlanPayload):
    try:
        plan = await generate_treatment_plan(payload.narrative)
        return {"status": "success", "plan": plan}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@survey_tailor_router.post("/api/generate-questionnaire")
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

@survey_tailor_router.post("/api/deploy-survey")
async def deploy_survey(payload: DeployPayload):
    try:
        import json
        
        # Generate the survey ID
        survey_id = str(uuid.uuid4())
        survey_json_str = json.dumps(payload.survey_data, indent=2)
        
        # Enforce strict, mandatory GCS upload if SURVEY_BUCKET_NAME is configured
        if not SURVEY_BUCKET_NAME:
            raise HTTPException(
                status_code=500,
                detail="GCS Deploy Failed: SURVEY_BUCKET_NAME is not configured in settings.py"
            )
            
        try:
            from google.cloud import storage
            gcs_client = storage.Client()
            bucket = gcs_client.bucket(SURVEY_BUCKET_NAME)
            gcs_key = f"deployed_surveys/{payload.mrn}_{survey_id}.json"
            blob = bucket.blob(gcs_key)
            
            # Upload directly from memory
            blob.upload_from_string(survey_json_str, content_type="application/json")
            gcs_uri = f"gs://{SURVEY_BUCKET_NAME}/{gcs_key}"
            gcs_message = f"Survey deployed successfully to GCS bucket '{SURVEY_BUCKET_NAME}'"
            print(f"GCS Deploy: Uploaded {gcs_key} successfully to {SURVEY_BUCKET_NAME}")

            # Format the URL exactly like the template requested in config
            dynamic_link = DYNAMIC_LINK_TEMPLATE.format(
                agent_id=AGENT_ID,
                survey_id=survey_id
            )
            
            return {
                "status": "success",
                "message": gcs_message,
                "gcs_uri": gcs_uri,
                "dynamic_link": dynamic_link,
                "survey_id": survey_id
            }
        except Exception as gcs_err:
            print(f"CRITICAL: GCS Deploy Failed: {gcs_err}")
            raise HTTPException(
                status_code=500,
                detail=f"GCS Deploy Failed: Could not upload to bucket '{SURVEY_BUCKET_NAME}'. Exact error: {str(gcs_err)}. Please verify your SURVEY_BUCKET_NAME in settings.py and ensure Google Cloud credentials have storage.objects.create permissions."
            )
    except HTTPException:
        # Re-raise explicit HTTP exceptions from inner blocks
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}
    except HTTPException:
        # Re-raise explicit HTTP exceptions from inner blocks
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}

@survey_tailor_router.get("/api/get-gcloud-token")
async def get_gcloud_token():
    try:
        # Local token proxy fallback
        return {
            "status": "success",
            "token": "local-fallback-token"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
