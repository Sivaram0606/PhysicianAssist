import re
import os
import sys
import json
import asyncio
import PyPDF2
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import vertexai
from google.cloud import discoveryengine_v1 as discoveryengine
import pandas as pd 
from vertexai.preview.evaluation import EvalTask 
from vertexai.preview.evaluation import MetricPromptTemplateExamples
from google import genai
from google.genai import types

# Inject the monorepo root path into sys.path to allow root configuration imports
current_dir = os.path.dirname(os.path.abspath(__file__))
monorepo_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
if monorepo_root not in sys.path:
    sys.path.insert(0, monorepo_root)

# Pull configuration properties from the centralized settings module
from settings import (
    AGENTIC_PHYSICIANASSIST_PROJECT_ID as PROJECT_ID,
    AGENTIC_PHYSICIANASSIST_LOCATION as LOCATION,
    AGENTIC_PHYSICIANASSIST_MODEL
)

EVALUATION_METRICS: List[str] = [
            MetricPromptTemplateExamples.Pointwise.FLUENCY,
            MetricPromptTemplateExamples.Pointwise.COHERENCE,
            MetricPromptTemplateExamples.Pointwise.GROUNDEDNESS,
            MetricPromptTemplateExamples.Pointwise.INSTRUCTION_FOLLOWING,
            MetricPromptTemplateExamples.Pointwise.VERBOSITY,
            MetricPromptTemplateExamples.Pointwise.SUMMARIZATION_QUALITY,
            MetricPromptTemplateExamples.Pointwise.TEXT_QUALITY
        ]

grounding_client = discoveryengine.GroundedGenerationServiceClient()

grounding_config_path = grounding_client.grounding_config_path(
    project=PROJECT_ID,
    location=LOCATION,
    grounding_config="default_grounding_config",
)

try:
    # Initialize both Vertex AI (for legacy evaluation) and the new google-genai Client (for generation calls)
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    USE_REAL_LLM = True
    print(f"Vertex AI and Google GenAI SDK initialized with project {PROJECT_ID}")
except Exception as e:
    print(f"Warning: Failed to initialize Google GenAI or Vertex AI: {e}. Narrative generation is disabled.")
    USE_REAL_LLM = False
    client = None

data_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "data"))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

STANDALONE_MODE = True

class GenerationConfig(BaseModel):
    llm_version: str = "gemini-3.5-flash"
    max_output_tokens: int = 100
    temperature: float = 0.1
    top_p: float = 1.0

class ClinicalSection(BaseModel):
    section_name: str
    prompt: str
    generation_config: GenerationConfig

class PatientDataRequest(BaseModel):
    patient_data: dict

class PatientSummary(BaseModel):
    mrn: str
    name: str
    event_id: str
    survey_completion: int # Percentage

class NarrativeResponse(BaseModel):
    """Structure for the combined clinical narrative response across multiple sections."""

    mrn: str
    sections: List[dict]


agentic_physicianassist_router = APIRouter()

def load_dummy_patient_record(*args, **kwargs):
    """Mocks get_preprocessed_patient_record"""
    try:
        # Access the patient_data.json relative to this file
        data_path = os.path.join(data_dir, "patient_data.json")
        with open(data_path, "r") as f:
            data = json.load(f)
            
        transformed_data = []
        for record in data:
            event_name = record.get("redcap_event_name", "unknown_event")
            for key, value in record.items():
                if key != "redcap_event_name":
                    transformed_data.append({
                        "redcap_event_name": event_name,
                        "cleaned_field_name": key,
                        "answer": str(value)
                    })
        return transformed_data
    except Exception as e:
        print(f"Error loading dummy patient data: {e}")
        return []

def load_dummy_metadata(*args, **kwargs):
    """Mocks get_preprocessed_metadata"""
    try:
        data_path = os.path.join(data_dir, "metadata.json")
        with open(data_path, "r") as f:
            data = json.load(f)
            for item in data:
                item["cleaned_section_header"] = item.get("section_header", "").strip() 
                item["cleaned_field_label"] = item.get("field_label", "").strip()
            return data
    except Exception as e:
        print(f"Error loading dummy metadata: {e}")
        return []


async def run_live_evaluation(patient_record: dict, generated_sections: list):
    """
    Executes the Vertex AI Evaluation Task (LLM-as-a-Judge).
    """
    eval_data = {"instruction": [], "context": [], "response": []}
    context_string = json.dumps(patient_record)
    
    for section in generated_sections:
        eval_data["instruction"].append(f"Write a clinical {section['title']} section.")
        eval_data["context"].append(context_string)
        eval_data["response"].append(section["content"])

    eval_dataset = pd.DataFrame(eval_data)
    
    # metrics like grounding, fluency, and coherence
    eval_task = EvalTask(
        dataset=eval_dataset, 
        metrics=EVALUATION_METRICS
    )
    
    # prompt_template maps DataFrame columns to evaluator input
    prompt_template = "Instruction: {instruction}. Context: {context}. Response: {response}"
    
    # Run in thread to avoid blocking the async event loop
    result = await asyncio.to_thread(
        eval_task.evaluate, 
        prompt_template=prompt_template
    )
    summary = {k: float(v) for k, v in result.summary_metrics.items()}
    metrics_list = result.metrics_table.to_dict(orient="records")

    print("************************")
    print(metrics_list)
    print("************************")
    # Format results for the frontend Evaluation Tab

    return {
        "overall_score": summary.get("groundedness/std", 0.5),
        "metrics": metrics_list
    }

def prepare_grounding_facts(patient_record: dict):
    """
    PRECISE FACT GENERATION:
    We tag demographics and flatten lists so 'diabetes' can be found as a string.
    """
    facts = []
    # These fields are generic and often 'steal' citations from specific clinical fields
    demographic_keys = ['record_id', 'redcap_event_name', 'patient_name', 'dob', 'age', 'visit_date']
    
    for key, value in patient_record.items():
        if not value: continue
        
        # Flatten lists (e.g. ['diabetes']) into a clean string for keyword matching
        val_str = ", ".join(value) if isinstance(value, list) else str(value)
        fact_text = f"The {key.replace('_', ' ')} is {val_str}."
        
        facts.append(discoveryengine.GroundingFact(
            fact_text=fact_text,
            attributes={
                "field_name": key, 
                "raw_val": val_str.lower(),
                "is_demographic": str(key in demographic_keys)
            }
        ))
    return facts

async def call_gemini_vertex(section_name: str, patient_record: dict):
    """
    Calls Gemini to generate the narrative using google-genai Client
    """

    if not client:
        return "Error: Gemini client not initialized."

    # 1. GENERATE NARRATIVE
    prompt = f"""
    You are an expert clinical scribe writing for a specialized multidisciplinary clinic. 
    Your task is to draft a highly detailed, comprehensive, and clinically elaborate '{section_name}' section of a high-fidelity clinical note. 

    The current draft is too short and crisp. You must expand this content dramatically, weaving in all available context, secondary indicators, historical symptoms, and clinical interpretations to produce an exhaustive, multi-paragraph, and professionally dense clinical narrative.

    **Source Data (JSON):**
    {json.dumps(patient_record, indent=2)}

    **Style Guidelines for a 'Clinically Elaborate' Narrative:**
    - **Strict Clinical Grounding & Hallucination Prevention:** Every single symptom, historical timeline milestone, surgery, medication, and clinical diagnosis you generate MUST be strictly grounded in and supported by the provided Source Data (JSON). Never invent, assume, or speculate about facts, dates, symptoms, or scores that are not explicitly present in the patient record. Speculation or ungrounded details are strictly prohibited.
    - **Exhaustive Data Inclusion:** Systematically examine the source JSON. Weave *every single piece* of relevant clinical data (such as specific medications, dosages, timelines, prior surgeries, qualitative answers, and individual score components) into the narrative prose. Never summarize or leave any detail out.
    - **Elaborate Clinical Prose:** Do not use short, clipped sentences. Construct complex, medically dense, and flowing sentences. Describe symptoms along with their specific timeline, severity patterns, aggravating factors, and functional limitations on the patient's daily life.
    - **Medical Terminology & Descriptors:** Maintain an exceptionally formal clinical tone. Use professional verbs such as 'endorses,' 'denies,' 'significant for,' 'consistent with,' 'at the time of evaluation,' 'exacerbates,' and 'ameliorates.' Refer to symptoms using formal clinical nomenclature (e.g., 'oral hypomotility and dysphagia' instead of 'difficulty swallowing').
    - **Deep Score Interpretation:** If clinical scores or indices are present in the source data (e.g., PROMIS-29 T-scores, MIDAS scores, PAGI-QOL, or Beighton score), do not just state the numbers. Thoroughly analyze what each score signifies, explain its severity classification (e.g., 'indicating severe fatigue and severe physical disability'), and detail how it impacts the patient's daily baseline functional capacity.
    - **Functional Synthesizing:** Explicitly connect the patient's symptoms (e.g., headaches, joint pain) to their secondary systemic, cognitive, or physical outcomes as described in the medical history.

    **Section-Specific Focus:**
    Write only the content for the '{section_name}' section. Avoid generic, brief introductory sentences (such as 'The patient is a...') or analytical lead-ins (like 'According to the provided data...'). Begin directly with the dense, elaborate clinical description of the patient's state.
    """

    try:
        response = await client.aio.models.generate_content(
            model=AGENTIC_PHYSICIANASSIST_MODEL,
            contents=prompt
        )
        narrative = response.text

        # 2. PREPARE FACTS
        facts = prepare_grounding_facts(patient_record)
        
        fact_lookup = {}
        for i, f in enumerate(facts):
            fname = f.attributes['field_name']
            fact_lookup[fname] = f.fact_text

        # 3. CALL GROUNDING API (Step 1: Identify Claims)
        grounding_request = discoveryengine.CheckGroundingRequest(
            grounding_config=grounding_config_path,
            answer_candidate=narrative,
            facts=facts,
            grounding_spec=discoveryengine.CheckGroundingSpec(citation_threshold=0.1),
        )
        
        grounding_resp = await asyncio.to_thread(grounding_client.check_grounding, request=grounding_request)
        claims = sorted(grounding_resp.claims, key=lambda x: x.start_pos, reverse=True)
        
        # 4. REFINER LLM CALL (Step 2: Correct the Mapping)
        final_text = narrative

        for i, claim in enumerate(claims):
            claim_text = claim.claim_text.strip()
            claim_end = claim.end_pos # Corrected variable name
            
            # --- THE REFINER LLM CALL ---
            # We ask Gemini to look at the claim and pick the best field from the keys
            refine_prompt = f"""
            Task: Match the following clinical claim to the most appropriate Field ID.
            Claim: "{claim_text}"
            
            Available Fields & Data:
            {json.dumps(patient_record, indent=2)}
            
            Clinical Interpreters (Use these to verify if the claim matches the score):
            - PROMIS-29 T-Scores: Mean is 50. >60 is high, >70 is 'very much' (e.g., severe fatigue).
            - MIDAS Score: 0-5 (Minimal), 6-10 (Mild), 11-20 (Moderate), 21+ (Severe Disability).
            - PAGI-QOL: Range 0-5. Lower scores indicate worse quality of life.
            - Beighton Score: Range 0-9. Higher score indicates higher hypermobility.
            
            Rules:
            1. Respond ONLY with the Field ID (the key).
            2. If the claim describes a 'severity' found in a score (e.g., 'very much fatigued'), map it to the corresponding score field (e.g., 'promis_fatigue_tscore').
            3. If the claim mentions a medical device or intervention (e.g., 'TPN' or 'G-tube'), map it to 'nutrition_support'.
            4. If no field matches, respond with 'unknown'.
            """
            
            refiner_res = await client.aio.models.generate_content(
                model=AGENTIC_PHYSICIANASSIST_MODEL,
                contents=refine_prompt
            )
            best_field = refiner_res.text.strip()

            # Avoid mapping to generic IDs unless absolutely necessary
            if best_field == "unknown" or best_field not in patient_record:
                continue

            # INJECT TAG
            citation_tag = f' <span className="citation" data-field="{best_field}">[{len(claims)-i}]</span>'
            final_text = final_text[:claim_end] + citation_tag + final_text[claim_end:]

        return final_text

    except Exception as e:
        print(f"CRITICAL ERROR in {section_name}: {e}", flush=True)
        return f"**{section_name}**\n\nClinical narrative section could not be generated: Clinical Intelligence Model (Gemini 3.5) was unreachable."

@agentic_physicianassist_router.get("/api/patients", response_model=List[PatientSummary])
def get_patients():
    """Returns list of patients from the dummy data"""
    try:
        data_path = os.path.join(data_dir, "patient_data.json")
        with open(data_path, "r") as f:
            raw_data = json.load(f)
        
        patients = []
        for p in raw_data:
            # Calculate a dummy "completion" based on non-empty fields
            total_fields = len(p.keys())
            filled_fields = sum(1 for v in p.values() if v)
            completion = int((filled_fields / total_fields) * 100) if total_fields > 0 else 0
            
            patients.append(PatientSummary(
                mrn=p.get("record_id", "Unknown"),
                name=p.get("patient_name", "Unknown"),
                event_id=p.get("redcap_event_name", "unknown"),
                survey_completion=completion
            ))
        return patients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@agentic_physicianassist_router.post("/api/patient/{mrn}/narrative")
async def generate_patient_narrative(mrn: str, request: PatientDataRequest):
    """
    Generates narrative based on the provided form data.
    """
    
    if not USE_REAL_LLM:
        raise HTTPException(
            status_code=500,
            detail="Narrative generation failed: Clinical Intelligence Model (Gemini 3.5) could not be initialized."
        )

    try:
        # Define the logic to run inside or outside the patch context
        async def run_logic():
            # 1. Use provided data directly
            patient_data = request.patient_data
            
            # 2. Generate
            sections_to_generate = [
                "History of Present Illness",
                "Review of Systems",
                "Social History",
                "Medical History",
                "Nutritional & Functional Status",
                "Systemic Hypermobility",
                "Disability",
                "Infectious Disease History"
            ]
            
            results = []
            tasks = []
            for sec_name in sections_to_generate:
                print(f"Generating {sec_name} using Vertex AI with provided data...")
                tasks.append(call_gemini_vertex(sec_name, patient_data))

            narratives = await asyncio.gather(*tasks)

            results = [
                {"title": title, "content": content}
                for title, content in zip(sections_to_generate, narratives)
            ]
                
            return {
                "mrn": mrn,
                "sections": results
            }
        return await run_logic()
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class EvalRequest(BaseModel):
    """Request structure for auditing and evaluating generated clinical narratives."""

    patient_data: dict
    sections: List[dict]


@agentic_physicianassist_router.post("/api/patient/{mrn}/evaluate")
async def evaluate_patient_narrative(mrn: str, request: EvalRequest):
    """
    Takes the narrative variable from the frontend and audits it.
    """
    try:
        # Pass the frontend's variable directly into the evaluation plugin logic
        eval_results = await run_live_evaluation(request.patient_data, request.sections)
        return eval_results
    except Exception as e:
        print(f"Evaluation Error: {e}")
        raise HTTPException(status_code=500, detail="Evaluation failed")

@agentic_physicianassist_router.get("/api/metadata")
def get_metadata():
    return load_dummy_metadata()

@agentic_physicianassist_router.get("/api/patient/{mrn}/data")
def get_patient_data(mrn: str):
    try:
        data_path = os.path.join(data_dir, "patient_data.json")
        with open(data_path, "r") as f:
            all_patients = json.load(f)
        
        target_p = next((p for p in all_patients if str(p.get("record_id")) == mrn), None)
        if not target_p:
            raise HTTPException(status_code=404, detail="Patient not found")
        return target_p
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class LabNarrativeRequest(BaseModel):
    lab_context: str = ""


def extract_text_from_pdf(file_path):
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() or ""
    except Exception as e:
        print(f"PDF Read Error: {e}")
    return text


@agentic_physicianassist_router.post("/api/patient/{mrn}/lab-narrative")
async def generate_lab_narrative(mrn: str):
    # Locate the file in the backend data folder
    pdf_path = os.path.join(data_dir, "sample_oncology.pdf")
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Lab report file not found on server")

    # Extract text from PDF
    context = extract_text_from_pdf(pdf_path)

    prompt = f"""
    You are an expert Oncology Scribe. Based on this lab report text:
    "{context}"
    
    Write a high-fidelity 'Oncology Lab Interpretation' section for a clinical note.
    - Use professional headers.
    - Interpret WBC counts and genetic markers (like FLT3).
    - Format like a paragraph.
    """

    try:
        response = await client.aio.models.generate_content(
            model=AGENTIC_PHYSICIANASSIST_MODEL,
            contents=prompt
        )
        return {
            "title": "Oncology Lab Interpretation",
            "content": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@agentic_physicianassist_router.get("/api/patient/{mrn}/lab-pdf")
def get_lab_pdf(mrn: str):
    """Serves the actual hematopathology/oncology lab report PDF directly from the backend data folder."""
    pdf_path = os.path.join(data_dir, "sample_oncology.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Lab report PDF not found on server")
    from fastapi.responses import FileResponse
    return FileResponse(pdf_path, media_type="application/pdf")

