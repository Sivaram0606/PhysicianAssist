import re
import os
import sys
import json
import asyncio
import PyPDF2
from typing import List
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import discoveryengine_v1 as discoveryengine
import pandas as pd 
from vertexai.preview.evaluation import EvalTask 
from vertexai.preview.evaluation import MetricPromptTemplateExamples


# PROJECT_ID = "phenoflow-intelligent-1654". #Argolis project demo
PROJECT_ID = "playground-koyel" #Personal GCP project. Use your own GCP project id here. 
LOCATION = "us-central1"

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
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini_model = GenerativeModel("gemini-2.5-flash")
    USE_REAL_LLM = True
    print(f"Vertex AI initialized with project {PROJECT_ID}")
except Exception as e:
    print(f"Warning: Failed to initialize Vertex AI: {e}. Falling back to mock mode.")
    USE_REAL_LLM = False
    gemini_model = None


current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

STANDALONE_MODE = True

class GenerationConfig(BaseModel):
    llm_version: str = "gemini-2.5-flash"
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


app = FastAPI(title="PhenoFlow Demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_dummy_patient_record(*args, **kwargs):
    """Mocks get_preprocessed_patient_record"""
    try:
        # Access the patient_data.json relative to this file
        data_path = os.path.join(current_dir, "data", "patient_data.json")
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
        data_path = os.path.join(current_dir, "data", "metadata.json")
        with open(data_path, "r") as f:
            data = json.load(f)
            for item in data:
                item["cleaned_section_header"] = item.get("section_header", "").strip() 
                item["cleaned_field_label"] = item.get("field_label", "").strip()
            return data
    except Exception as e:
        print(f"Error loading dummy metadata: {e}")
        return []

async def mock_call_gemini(section, target_patient_mrn, preprocessed_data, **kwargs):
    """Mocks the Vertex AI call"""
    await asyncio.sleep(1.5) # Simulate API latency
    
    # Extract some dummy data points to make the citations look real
    # We know the dummy data has 'symptom_onset', 'pain_severity' etc.
    # But since preprocessed_data is a flat string in this mock context, we'll just simulate it generically 
    # based on the section name to keep it robust.
    
    SECTION_CONTENT = {
        "History of Present Illness": f"""**History of Present Illness**:
**Chief Complaint**: The patient presents today with *"{preprocessed_data.get('chief_complaint', 'headache')}"* <span className="citation" data-field="chief_complaint">[1]</span>.

They report significant discomfort starting from *2023-10-15* <span className="citation" data-field="symptom_onset">[2]</span>. The patient rates their pain as **6/10** <span className="citation" data-field="pain_severity">[3]</span>.

---
**Sources:**
<span className="source-ref" data-field="chief_complaint">[1] Chief Complaint</span>
<span className="source-ref" data-field="symptom_onset">[2] Symptom Onset</span>
<span className="source-ref" data-field="pain_severity">[3] Pain Severity</span>""",

        "Review of Systems": f"""**Review of Systems**:
Patient validates positive for:
- **Headache** <span className="citation" data-field="review_systems">[4]</span>
- **Nausea** <span className="citation" data-field="review_systems">[4]</span>
- **Vision Changes** <span className="citation" data-field="review_systems">[4]</span>

---
**Sources:**
<span className="source-ref" data-field="review_systems">[4] Review of Systems</span>""",

        "Social History": f"""**Social History**:
Patient is a **Never Smoker** <span className="citation" data-field="social_history_smoke">[9]</span> and drinks alcohol **Occasionally** <span className="citation" data-field="social_history_alcohol">[10]</span>.
Occupation: **Software Engineer** <span className="citation" data-field="occupation">[11]</span>.

---
**Sources:**
<span className="source-ref" data-field="social_history_smoke">[9] Smoking Status</span>
<span className="source-ref" data-field="social_history_alcohol">[10] Alcohol Use</span>
<span className="source-ref" data-field="occupation">[11] Occupation</span>""",
        
        "Medical History": f"""**Medical History**:
History is significant for **Hypertension** <span className="citation" data-field="medical_history">[5]</span>.
Past surgeries include **Appendectomy (2010)** <span className="citation" data-field="surgical_history">[6]</span>.

**Medications & Allergies**:
Current medications:
- **Ibuprofen 400mg as needed, Lisinopril 10mg daily** <span className="citation" data-field="medications">[7]</span>
Allergies:
- **Penicillin (Rash)** <span className="citation" data-field="allergies">[8]</span>

---
**Sources:**
<span className="source-ref" data-field="medical_history">[5] Medical History</span>
<span className="source-ref" data-field="surgical_history">[6] Surgical History</span>
<span className="source-ref" data-field="medications">[7] Medications</span>
<span className="source-ref" data-field="allergies">[8] Allergies</span>"""
    }

    return SECTION_CONTENT.get(section.section_name, f"**{section.section_name}**\nContent not generated for this section.")




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
    Calls Gemini to geneeare the nrrative
    """

    if not gemini_model:
        return "Error: Gemini model not initialized."

    # 1. GENERATE NARRATIVE
    prompt = f"""
    You are an expert clinical scribe writing for a specialized multidisciplinary clinic. 
    Your task is to draft the '{section_name}' section of a high-fidelity clinical note.

    **Source Data (JSON):**
    {json.dumps(patient_record, indent=2)}

    **Style Guidelines for a 'Clinically Full' Narrative:**
    - **Narrative Flow:** Use bullet points to weave data into professional, complex sentences.
    - **Medical Terminology:** Use precise clinical language (e.g., 'reports an inability to tolerate oral intake' instead of 'can't eat'; 'significant for' instead of 'has').
    - **Professional Tone:** Use formal descriptors such as 'endorses,' 'denies,' 'significant for,' 'consistent with,' and 'at the time of evaluation.'
    - **Detail Density:** If a score is provided (e.g., PROMIS, MIDAS), interpret its clinical significance in the narrative (e.g., 'indicating severe disability').
    - **Transitioning:** Connect symptoms to their functional impact or duration as provided in the data.

    **Section-Specific Focus:**
    Write only the content for '{section_name}'. Avoid introductory phrases like 'The patient says...' or 'Based on the data...'. Start directly with the clinical description.
    """

    try:
        response = await asyncio.to_thread(gemini_model.generate_content, prompt)
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
            
            refiner_res = await asyncio.to_thread(gemini_model.generate_content, refine_prompt)
            best_field = refiner_res.text.strip()

            # print(f"CLAIM: \"{claim_text}\"", flush=True)
            # print(f"  🎯 REFINER DECISION: Mapping to -> '{best_field}'", flush=True)

            # Avoid mapping to generic IDs unless absolutely necessary
            if best_field == "unknown" or best_field not in patient_record:
                # print(f"  ⚠️ Warning: No solid match found for '{claim_text}'", flush=True)
                continue

            # INJECT TAG
            citation_tag = f' <span className="citation" data-field="{best_field}">[{len(claims)-i}]</span>'
            final_text = final_text[:claim_end] + citation_tag + final_text[claim_end:]

        return final_text

    except Exception as e:
        print(f"CRITICAL ERROR in {section_name}: {e}", flush=True)
        return narrative

@app.get("/api/patients", response_model=List[PatientSummary])
def get_patients():
    """Returns list of patients from the dummy data"""
    try:
        data_path = os.path.join(current_dir, "data", "patient_data.json")
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

@app.post("/api/patient/{mrn}/narrative")
async def generate_patient_narrative(mrn: str, request: PatientDataRequest):
    """
    Generates narrative based on the provided form data.
    """
    
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
                if USE_REAL_LLM:
                    print(f"Generating {sec_name} using Vertex AI with provided data...")
                    # narrative = await call_gemini_vertex(sec_name, patient_data)
                    tasks.append(call_gemini_vertex(sec_name, patient_data))
                else:
                    # Fallback to mock (still uses the provided data for "mock" grounding if we updated mock_call)
                    dummy_section = ClinicalSection(
                        section_name=sec_name,
                        prompt="dummy prompt",
                        generation_config=GenerationConfig(
                            llm_version="gemini-2.5-flash", max_output_tokens=100, temperature=0.1, top_p=1.0
                        )
                    )
                    # preprocessed_text = json.dumps(patient_data)
                    # preprocessed_data_map = {mrn: preprocessed_text}
                    # narrative = await mock_call_gemini(dummy_section, mrn, preprocessed_data=patient_data)
                    tasks.append(mock_call_gemini(dummy_section, mrn, preprocessed_data=patient_data))

            narratives = await asyncio.gather(*tasks)

                # results.append({
                #     "title": sec_name,
                #     "content": narrative
                # })
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


@app.post("/api/patient/{mrn}/evaluate")
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

@app.get("/api/metadata")
def get_metadata():
    return load_dummy_metadata()

@app.get("/api/patient/{mrn}/data")
def get_patient_data(mrn: str):
    try:
        data_path = os.path.join(current_dir, "data", "patient_data.json")
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


@app.post("/api/patient/{mrn}/lab-narrative")
async def generate_lab_narrative(mrn: str):
    # Locate the file in the backend data folder
    pdf_path = os.path.join(current_dir, "data", "sample_oncology.pdf")
    
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
        response = await asyncio.to_thread(gemini_model.generate_content, prompt)
        return {
            "title": "Oncology Lab Interpretation",
            "content": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi.responses import FileResponse
# --- STATIC FILES (Moved to bottom to avoid stealing API routes) ---
frontend_dist_path = os.path.abspath(os.path.join(current_dir, "ui", "dist"))

if os.path.exists(frontend_dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")

@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_frontend(request: Request, full_path: str):
    if full_path.startswith("api"):
       raise HTTPException(status_code=404, detail="API route not found")

    # 2. Check if the specific file (like logo.png) exists in dist
    file_path = os.path.join(frontend_dist_path, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path) # Serves the actual image file
      
    index_path = os.path.join(frontend_dist_path, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            # return f.read()
            return FileResponse(index_path)
    return "<html><body><h1>ClinGenSynth Demo API</h1><p>Frontend not found.</p></body></html>"
