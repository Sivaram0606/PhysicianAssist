export interface NarrativeEntry {
  narrative: string;
  // Allow for other potential fields in the objects, though we only strictly need 'narrative'
  [key: string]: any;
}

export interface ClinicalResponse {
  target_patient_mrn: string;
  narratives: NarrativeEntry[];
}

export interface ClinicalDataPayload {
  response: ClinicalResponse;
}

export interface TailoredQuestion {
  field_name: string;
  question_text: string;
  choices: string[];
}

export interface FormTailoredQuestions {
  form_name: string;
  retained_questions: TailoredQuestion[];
  dropped_questions: TailoredQuestion[];
  reasons_for_dropping: string[];
  additional_questions: TailoredQuestion[];
}

export interface TailoredQuestionnaireResult {
  forms: FormTailoredQuestions[];
  treatment_plan?: string;
  baseline_context?: string;
}
