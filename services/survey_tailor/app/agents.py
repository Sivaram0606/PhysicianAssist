import json
import re
import aiohttp
import pandas as pd
import uuid
import asyncio
import os
from bs4 import BeautifulSoup
from typing import List, Any, Optional
from pydantic import BaseModel, Field
from google.adk import Agent, Runner
from google.adk.models import Gemini
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.utils.content_utils import extract_text_from_content
from google.genai import types, Client
from functools import cached_property
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

# Vertex AI Configuration
class VertexGemini(Gemini):
    @cached_property
    def api_client(self) -> Client:
        # Configuration for Vertex AI with ADC and Mayo Project
        return Client(vertexai=True, project=GOOGLE_CLOUD_PROJECT, location="global")

# Define Structured Responses
class TailoredQuestion(BaseModel):
    field_name: str = Field(description="The underlying REDCap variable/field name (e.g. shaq_1 or compass31_q1).")
    question_text: str = Field(description="The actual clinical question text as seen on the PDF.")
    choices: list[str] = Field(description="The list of selectable options extracted directly from the template PDF, e.g. ['Yes', 'No'] or ['Without ANY difficulty', 'With SOME difficulty']. If the question is a free-text field, keep this list empty.")

class FormTailoredQuestions(BaseModel):
    form_name: str = Field(description="Exact snake_case name of the REDCap form.")
    retained_questions: list[TailoredQuestion] = Field(description="Questions from the template kept because they are relevant.")
    dropped_questions: list[TailoredQuestion] = Field(description="Questions from the template removed because they don't apply to the patient.")
    reasons_for_dropping: list[str] = Field(description="Brief rationales pointing out why specific questions were dropped, aligned 1-to-1.")
    additional_questions: list[TailoredQuestion] = Field(description="Brand-new crucial questions missing from the template.")

class RecommendedForm(BaseModel):
    form_name: str = Field(description="Name of the REDCap form.")
    rationale: str = Field(description="Why this form is relevant to the patient's narrative.")
    priority: str = Field(description="High, Medium, or Low priority.")

class FormRecommendations(BaseModel):
    recommended_forms: List[RecommendedForm] = Field(description="List of recommended forms.")

# Configuration/constants imported from the central config module
from config import GEMINI_MODEL, GOOGLE_CLOUD_PROJECT

# Decoupled Prompts Directory Loader
PROMPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "prompts"))

def load_prompt(filename: str) -> str:
    """Load a markdown prompt file dynamically from disk."""
    filepath = os.path.join(PROMPTS_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read().strip()

# Load all Markdown Prompt Templates and instructions
PATIENT_CHAT_SYSTEM_INSTRUCTION = load_prompt("patient_chat_system.md")
TREATMENT_PLAN_SYSTEM_INSTRUCTION = load_prompt("treatment_plan_system.md")
QUESTIONNAIRE_TAILOR_SYSTEM_INSTRUCTION = load_prompt("questionnaire_tailor_system.md")
FORM_RECOMMENDATION_SYSTEM_INSTRUCTION = load_prompt("form_recommendation_system.md")
QUESTIONNAIRE_TAILOR_PROMPT_TEMPLATE = load_prompt("questionnaire_tailor_prompt.md")
FORM_RECOMMENDATION_PROMPT_TEMPLATE = load_prompt("form_recommendation_prompt.md")

# Local data sources pointing to central /data directory
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))

async def export_pdf_from_redcap(form_name: str) -> bytes:
    """Fetch the blank PDF clinical instrument from local dataset."""
    pdf_path = os.path.join(DATA_DIR, "sample_oncology.pdf")
    with open(pdf_path, "rb") as f:
        return f.read()

async def get_preprocessed_metadata():
    """Fetch and preprocess questionnaire metadata from local JSON dataset."""
    meta_path = os.path.join(DATA_DIR, "metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    df = pd.DataFrame(metadata)
    
    df['cleaned_field_label'] = [
        re.sub(r"[:\r\n\xa0]", '', BeautifulSoup(text, "html.parser").get_text()) if pd.notnull(text) else ''
        for text in df.get('field_label', [])
    ]
    
    df['cleaned_section_header'] = [
        re.sub(r"[:\r\n\xa0]", '', ' '.join([
            elem.get_text() for elem in BeautifulSoup(text, "html.parser").find_all('p', style="text-align: center;")
        ])) if pd.notnull(text) else ''
        for text in df.get('section_header', [])
    ]
    return df

async def get_form_metadata(form_name: str):
    """Fetch and preprocess questionnaire metadata for a specific form from local JSON."""
    meta_path = os.path.join(DATA_DIR, "metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
        
    filtered = [m for m in metadata if m.get("form_name") == form_name]
    df = pd.DataFrame(filtered)
    
    if df.empty:
        return df
    
    df['cleaned_field_label'] = [
        re.sub(r"[:\r\n\xa0]", '', BeautifulSoup(text, "html.parser").get_text()) if pd.notnull(text) else ''
        for text in df.get('field_label', [])
    ]
    
    df['cleaned_section_header'] = [
        re.sub(r"[:\r\n\xa0]", '', ' '.join([
            elem.get_text() for elem in BeautifulSoup(text, "html.parser").find_all('p', style="text-align: center;")
        ])) if pd.notnull(text) else ''
        for text in df.get('section_header', [])
    ]
    return df

async def get_patient_baseline_record(patient_mrn: str, event_id: str):
    """Fetch and preprocess patient record from local patient data."""
    data_path = os.path.join(DATA_DIR, "patient_data.json")
    with open(data_path, "r", encoding="utf-8") as f:
        all_patients = json.load(f)
        
    records = [p for p in all_patients if str(p.get("record_id")) == patient_mrn]
    if not records:
        return ""
    
    # Simple preprocessing similar to user snippet
    df = pd.DataFrame(records)
    df = df.melt(id_vars=["record_id", "redcap_event_name"], var_name="field_name", value_name="answer")
    df['answer'] = df['answer'].fillna('')
    df = df[df['answer'] != '']
    df['cleaned_field_name'] = df['field_name'].str.split('___').str[0]
    
    # Merge with metadata for labels
    metadata_df = await get_preprocessed_metadata()
    merged = pd.merge(df, metadata_df, left_on='cleaned_field_name', right_on='field_name', how='left')
    
    final_str = ""
    current_form = ""
    for _, row in merged.iterrows():
        if row["form_name"] != current_form and row["form_name"] and pd.notnull(row["form_name"]):
            current_form = row["form_name"]
            final_str += f"\n## {current_form}\n"
        
        field_label = row["cleaned_field_label"] if pd.notnull(row["cleaned_field_label"]) else row["cleaned_field_name"]
        final_str += f"{field_label}: {row['answer']}\n"
    
    return final_str

def is_rate_limit_error(exception: Exception) -> bool:
    """Helper to detect 429 RESOURCE_EXHAUSTED rate-limit errors from Vertex AI or Gemini."""
    err_str = str(exception).lower()
    return "429" in err_str or "resource_exhausted" in err_str or "rate_limit" in err_str

@retry(
    retry=retry_if_exception(is_rate_limit_error),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(5),
    reraise=True
)
async def run_agent_workflow(agent: Agent, prompt: Any) -> Any:
    """Helper to run an agent workflow (supporting multimodal text and parts list with exponential backoff on 429) and return final output."""
    runner = Runner(
        agent=agent,
        app_name="clinical_pipeline",
        session_service=InMemorySessionService(),
        auto_create_session=True
    )
    
    # Support both single-string prompts and lists of multimodal types.Part objects
    if isinstance(prompt, str):
        message_parts = [types.Part(text=prompt)]
    elif isinstance(prompt, list):
        message_parts = prompt
    else:
        message_parts = [prompt]
        
    final_event = None
    async for event in runner.run_async(
        user_id="default_user",
        session_id=str(uuid.uuid4()),
        new_message=types.Content(role="user", parts=message_parts)
    ):
        if not event.partial:
            final_event = event
    
    if final_event and final_event.output:
        return final_event.output
    
    return extract_text_from_content(final_event.content) if final_event else ""

async def handle_chat(message: str, role: str, session_id: str, context: Optional[dict] = None) -> Any:
    """Foundational chat handler for Patient role."""
    
    # 1. Patient Survey Flow
    if role == 'patient':
        # Simple survey state machine fallback
        survey_step = context.get('survey_step', 0) if context else 0
        questions = [
            {"id": "q1", "text": "Have you experienced any chest pain in the last 24 hours?", "type": "selection", "options": ["Yes", "No"]},
            {"id": "q2", "text": "How would you describe your current level of fatigue on a scale of 1-10?", "type": "selection", "options": ["1-3", "4-6", "7-10"]},
            {"id": "q3", "text": "Is there anything else about your symptoms you'd like to share today? You can type or use voice recording.", "type": "text"}
        ]
        
        if survey_step < len(questions):
            q = questions[survey_step]
            return {
                "type": "survey_question",
                "message": q["text"],
                "data": {
                    "question": q,
                    "survey_step": survey_step + 1
                }
            }
        else:
            return {
                "type": "text",
                "message": "Thank you for completing the survey. Your responses have been securely recorded and shared with your clinical team."
            }

    # 2. Patient Assistant Logic using Decoupled Prompts
    chat_agent = Agent(
        name="patient_chat_agent",
        model=VertexGemini(model=GEMINI_MODEL),
        instruction=PATIENT_CHAT_SYSTEM_INSTRUCTION,
        generate_content_config=types.GenerateContentConfig(temperature=0.0)
    )
    
    response_text = await run_agent_workflow(chat_agent, message)
    return {
        "type": "text",
        "message": response_text
    }

async def generate_treatment_plan(patient_narrative: str) -> str:
    """Generate a treatment plan using the treatment_plan_agent with decoupled instruction."""
    treatment_agent = Agent(
        name="treatment_plan_agent",
        model=VertexGemini(model=GEMINI_MODEL), 
        instruction=TREATMENT_PLAN_SYSTEM_INSTRUCTION,
        generate_content_config=types.GenerateContentConfig(temperature=0.0)
    )
    return await run_agent_workflow(treatment_agent, f"Analyze: {patient_narrative}")

async def run_clinical_pipeline(patient_narrative: str, template_ids: List[str], patient_mrn: str = None, treatment_plan: str = None) -> dict:
    """Run the full pipeline, reusing treatment plan if provided and running tailoring in parallel per form using asyncio.gather directly."""
    
    # 1. Use provided treatment plan or generate a new one
    if not treatment_plan:
        treatment_agent = Agent(
            name="treatment_plan_agent",
            model=VertexGemini(model=GEMINI_MODEL), 
            instruction=TREATMENT_PLAN_SYSTEM_INSTRUCTION,
            generate_content_config=types.GenerateContentConfig(temperature=0.0)
        )
        treatment_plan = await run_agent_workflow(treatment_agent, f"Analyze: {patient_narrative}")

    # 2. Fetch Baseline Data if MRN exists
    baseline_context = ""
    if patient_mrn:
        try:
            # Using a generic event ID for demo, should be passed from frontend
            baseline_context = await get_patient_baseline_record(patient_mrn, "baseline_arm_1")
        except Exception as e:
            print(f"Warning: Could not fetch baseline: {e}")

    # 3. Define helper to execute a single sub-agent concurrently (Multimodal PDF Understanding)
    async def execute_sub_agent(form_name: str):
        # Fetch blank PDF clinical instrument directly from REDCap API
        pdf_bytes = await export_pdf_from_redcap(form_name)
        
        agent = Agent(
            name=f"questionnaire_agent_{form_name}",
            model=VertexGemini(model=GEMINI_MODEL),
            instruction=QUESTIONNAIRE_TAILOR_SYSTEM_INSTRUCTION.replace("target form name", form_name),
            output_schema=FormTailoredQuestions,
            generate_content_config=types.GenerateContentConfig(temperature=0.0)
        )
        
        # Populate Prompt Template with variables dynamically
        prompt_text = QUESTIONNAIRE_TAILOR_PROMPT_TEMPLATE.format(
            patient_narrative=patient_narrative,
            treatment_plan=treatment_plan,
            baseline_context=baseline_context,
            form_name=form_name
        )

        prompt_parts = [
            types.Part(text=prompt_text),
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
        ]
        
        result_data = await run_agent_workflow(agent, prompt_parts)
        
        # Parse safely
        if not isinstance(result_data, dict):
            try:
                result_data = json.loads(result_data)
            except:
                result_data = {
                    "form_name": form_name,
                    "retained_questions": [],
                    "dropped_questions": [],
                    "reasons_for_dropping": [],
                    "additional_questions": []
                }
        return result_data

    # 4. Run tailoring concurrently for all selected forms using asyncio.gather directly
    tasks = [execute_sub_agent(form) for form in template_ids]
    tailored_results = await asyncio.gather(*tasks)

    # 5. Combine parallel results into a single unified payload
    combined_result = {
        "forms": tailored_results,
        "treatment_plan": treatment_plan,
        "baseline_context": baseline_context
    }
    return combined_result

async def recommend_forms_for_narrative(patient_narrative: str, treatment_plan: str) -> list:
    """Recommends REDCap forms based on deep metadata analysis using decoupled templates."""
    # Fetch Metadata locally
    redcap_questionaire_metadata_df = await get_preprocessed_metadata()
    
    final_str=""
    current_form_name=""
    current_section_name=""
    for _, row in redcap_questionaire_metadata_df.iterrows():
        if row["form_name"] != current_form_name and row["form_name"]!="":
            current_form_name=row["form_name"]
            final_str += f"\n## **{row['form_name']}** \n"
        if (row["cleaned_section_header"] != current_section_name and row["cleaned_section_header"]!=""):
            current_section_name=row["cleaned_section_header"]
            final_str += f"\n#### **{row['cleaned_section_header']}** \n"
        
        field_label = row["cleaned_field_label"] if pd.notnull(row["cleaned_field_label"]) else row["field_name"]
        choices = row.get("select_choices_or_calculations", "")
        final_str += f"{field_label}: {choices}\n"
    
    recommend_agent = Agent(
        name="form_recommendation_agent",
        model=VertexGemini(model=GEMINI_MODEL),
        instruction=FORM_RECOMMENDATION_SYSTEM_INSTRUCTION,
        output_schema=FormRecommendations,
        generate_content_config=types.GenerateContentConfig(temperature=0.0)
    )
    
    # Populate Prompt Template with variables dynamically
    prompt = FORM_RECOMMENDATION_PROMPT_TEMPLATE.format(
        patient_narrative=patient_narrative,
        treatment_plan=treatment_plan,
        form_details=final_str
    )
    
    recommendations = await run_agent_workflow(recommend_agent, prompt)
    
    # recommendations can be a Pydantic model, a dict, or a JSON string
    if isinstance(recommendations, str):
        try:
            parsed = json.loads(recommendations)
            if isinstance(parsed, dict):
                return parsed.get("recommended_forms", [])
        except Exception as e:
            try:
                match = re.search(r"```json\s*(.*?)\s*```", recommendations, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(1))
                    if isinstance(parsed, dict):
                        return parsed.get("recommended_forms", [])
            except:
                pass
    elif isinstance(recommendations, dict):
        return recommendations.get("recommended_forms", [])
    elif hasattr(recommendations, 'recommended_forms'):
         return [item.model_dump() if hasattr(item, 'model_dump') else item.dict() for item in recommendations.recommended_forms]
    return []
