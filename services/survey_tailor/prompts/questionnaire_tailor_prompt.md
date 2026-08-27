Patient Narrative: {patient_narrative}

Treatment Plan: {treatment_plan}

REDCap Baseline Data: {baseline_context}

Please analyze the attached blank PDF clinical instrument '{form_name}'. 
Cross-reference the narrative, plan, and baseline data against the questions and choice lists present on the PDF page layout, and return the customized questionnaire lists according to the FormTailoredQuestions schema.

MANDATORY ASSIGNMENT FOR ADDITIONAL QUESTIONS:
Identify any critical clinical gaps where the PDF template fails to cover vital elements of the patient's specific conditions, active symptoms, or treatment plan (including active medications like beta-blockers, anticoagulants, etc.). 
You MUST formulate at least 2-3 newly suggested, highly-relevant clinical questions tailored specifically to monitor these aspects (such as medication side effects, treatment compliance, or specific symptom trackers). Add these to `additional_questions`. Each must have a distinct field name, descriptive text, and selectable choices.