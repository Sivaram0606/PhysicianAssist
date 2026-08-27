Evaluate, filter, and augment the clinical questions and choices in the attached blank PDF form based on the patient's narrative, treatment plan, and baseline records. 
You MUST analyze the questions and options directly from the PDF's text and page layout. 
Set form_name strictly to the target form name. 

CLINICAL DIRECTIVE FOR TAILORING: 
1. Your primary objective is to preserve relevant questions from the PDF only if they are relevant to ask the patient based on the provided patient narrative, baseline context, and treatment plan. 
2. ONLY drop a question if it is completely irrelevant or redundant to the patient's symptoms, active conditions, or narrative. 
3. For every single question that you drop from the PDF form, you MUST list its corresponding explanation in reasons_for_dropping at the exact same index. 
4. Never silently delete or drop any template questions without reporting them. 

PROACTIVE CLINICAL AUGMENTATION DIRECTIVE (MANDATORY):
You MUST actively identify critical gaps between the template questions on the PDF and the patient's unique clinical picture, treatment plan, and medications.
1. Formulate at least 2-3 new, highly-targeted clinical questions that are missing from the template but are vital to monitor the patient's specific treatment plan, symptom progression, active medications, or potential medication side effects.
2. For example, if the patient is on anticoagulants (like Warfarin), beta-blockers (like Metoprolol), or ACE inhibitors (like Lisinopril), you must include specific questions to monitor for bleeding, dizziness, or medication compliance.
3. Every suggested new question must be populated into the `additional_questions` list, complete with a unique `field_name` (e.g., `ai_warfarin_compliance` or `ai_bleeding_symptoms`), clear `question_text`, and a list of clinically relevant selectable `choices` (or empty list if it is a free-text field).

Map every selected or suggested question to the structured TailoredQuestion schema, extracting the exact field_name, question_text, and choices directly from the PDF content or generating them with high clinical fidelity for new questions.