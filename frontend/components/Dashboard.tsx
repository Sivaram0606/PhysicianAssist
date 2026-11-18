import React, { useState, useEffect } from 'react';
import { ClinicalDataPayload, TailoredQuestionnaireResult } from '../types';
import { NarrativeCard } from './NarrativeCard';
import { AvailableForms } from './AvailableForms';
import { User, Activity, ArrowLeft, FileJson, ClipboardList, Loader2, Eye, CheckCircle2, ChevronRight, X, ShieldCheck, ShieldAlert, Edit3, PenTool, Sparkles, RotateCcw } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface DashboardProps {
  data: ClinicalDataPayload;
  onReset: () => void;
  onQuestionnaireGenerated: (result: TailoredQuestionnaireResult, templateId: string) => void;
}

const CLINICAL_DIRECTIVE_PRESETS = [
  'Urgent Hematology co-management for FLT3-ITD+ AML leukocytosis & thrombocytopenia before invasive procedures.',
  'Avoid oral NSAIDs due to severe gastroparesis; prioritize non-oral migraine rescue (intranasal sumatriptan) & prokinetic review.',
  'Close blood pressure, renal function, and Raynaud/vascular symptom surveillance at next intake.'
];

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onQuestionnaireGenerated }) => {
  const [treatmentPlan, setTreatmentPlan] = useState<string | null>(null);
  const [draftPlan, setDraftPlan] = useState<string>('');
  const [physicianAddendum, setPhysicianAddendum] = useState<string>('');
  const [isEditingPlan, setIsEditingPlan] = useState<boolean>(false);
  const [isPlanApproved, setIsPlanApproved] = useState<boolean>(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);
  
  const physicianName = 'Dr. Demo User, MD';
  const { response } = data;
  const mrn = response?.target_patient_mrn || 'Unknown MRN';
  const narratives = response?.narratives || [];

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (narratives.length === 0) return;
      
      setLoadingPlan(true);
      setIsPlanApproved(false);
      setApprovedAt(null);
      setIsEditingPlan(false);
      try {
        const combinedNarrative = narratives.map(n => n.narrative).join('\n\n');
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/analyze-narrative`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ narrative: combinedNarrative }),
        });

        if (!response.ok) throw new Error('Failed to fetch narrative analysis');
        
        const result = await response.json();
        if (result.status === 'success') {
          setTreatmentPlan(result.plan);
          setDraftPlan(result.plan || '');
          setAiRecommendations(result.recommendations || []);
        }
      } catch (err) {
        console.error('Error generating analysis:', err);
      } finally {
        setLoadingPlan(false);
      }
    };

    fetchAnalysis();
  }, [narratives]);

  const handleSavePlanEdits = () => {
    setTreatmentPlan(draftPlan);
    setIsEditingPlan(false);
  };

  const handleApprovePlan = () => {
    if (isEditingPlan) {
      setTreatmentPlan(draftPlan);
      setIsEditingPlan(false);
    }
    setIsPlanApproved(true);
    setApprovedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleAppendDirective = (directive: string) => {
    setPhysicianAddendum(prev => {
      const bullet = `- ${directive}`;
      if (prev.includes(directive)) return prev;
      return prev.trim() ? `${prev.trim()}\n${bullet}` : bullet;
    });
  };

  const effectiveTreatmentPlan = (draftPlan || treatmentPlan)
    ? (physicianAddendum.trim()
        ? `${draftPlan || treatmentPlan}\n\n### Physician HITL Clinical Addendum (Verified by ${physicianName})\n${physicianAddendum.trim()}`
        : (draftPlan || treatmentPlan))
    : null;

  const renderMarkdown = (content: string) => {
    const rawHtml = marked.parse(content) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  // Workflow sequence steps
  const steps = [
    { id: 1, name: 'Upload Narrative', status: 'complete' },
    { id: 2, name: 'Treatment Plan (HITL)', status: isPlanApproved ? 'complete' : 'current' },
    { id: 3, name: 'Select & Tailor Forms', status: isPlanApproved ? 'current' : 'upcoming' },
    { id: 4, name: 'Verify Questions (HITL)', status: 'upcoming' },
    { id: 5, name: 'Deploy Survey', status: 'upcoming' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow flex flex-col">
      
      {/* Workflow Sequence Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                  step.status === 'complete' 
                    ? 'bg-green-100 border-green-500 text-green-700' 
                    : step.status === 'current'
                    ? 'bg-clinical-50 border-clinical-600 text-clinical-800 ring-4 ring-clinical-100'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {step.status === 'complete' ? (
                    <CheckCircle2 size={16} className="text-green-600" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-xs font-bold uppercase tracking-wider ${
                    step.status === 'current' ? 'text-clinical-700' : 'text-slate-500'
                  }`}>{step.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {step.status === 'complete' ? 'Completed' : step.status === 'current' ? 'In Progress' : 'Pending'}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight size={18} className="text-slate-300 hidden sm:block mx-2" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Patient Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            Patient Analysis Workspace
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Analyzing treatment plan and tailoring clinical instruments for Patient MRN: <strong className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{mrn}</strong>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowNarrativeModal(true)}
            className="flex items-center justify-center text-sm font-semibold text-clinical-700 bg-clinical-50 hover:bg-clinical-100 transition-colors px-4 py-2.5 rounded-xl border border-clinical-200 shadow-sm"
          >
            <Eye size={16} className="mr-2" />
            View Patient Narrative ({narratives.length})
          </button>
          <button 
            onClick={onReset}
            className="flex items-center justify-center text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm"
          >
            <ArrowLeft size={16} className="mr-2" />
            Load New Patient
          </button>
        </div>
      </div>

      {/* Center-Focused Layout: Treatment Plan & Customized Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-grow">
        
        {/* Central Wide Stage: Treatment Plan & available forms customizable */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* AI Generated Treatment Plan + Physician HITL Governance Box */}
          <div id="treatment-plan-card" className={`bg-white rounded-3xl shadow-sm border transition-all p-8 ${
            isPlanApproved ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <ClipboardList size={22} className="mr-2.5 text-clinical-600" />
                  AI-Generated Treatment Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synthesized from longitudinal narrative & lab evidence • Requires Physician Human-in-the-Loop (HITL) verification
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPlanApproved ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Physician HITL Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                    <ShieldAlert size={14} className="text-amber-600" />
                    Pending Physician HITL
                  </span>
                )}
              </div>
            </div>

            {/* Physician HITL Action & Attestation Bar */}
            {!loadingPlan && treatmentPlan && (
              <div className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                isPlanApproved
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/60 border-amber-200/80'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${
                    isPlanApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isPlanApproved ? <ShieldCheck size={18} /> : <PenTool size={18} />}
                  </div>
                  <div>
                    {isPlanApproved ? (
                      <>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                          HITL Sign-Off Complete • {physicianName}
                        </p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Attested at {approvedAt} • Verified care plan & physician directives are actively guiding downstream survey tailoring.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                          Physician Human-in-the-Loop (HITL) Review Required
                        </p>
                        <p className="text-xs text-amber-800/90 mt-0.5">
                          Inspect AI synthesis, add clinical overrides or medication directives, and sign off before generating patient follow-up surveys.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    id="btn-edit-treatment-plan"
                    type="button"
                    onClick={() => {
                      if (!isEditingPlan) {
                        setDraftPlan(treatmentPlan);
                        setIsPlanApproved(false);
                      }
                      setIsEditingPlan(!isEditingPlan);
                    }}
                    className="inline-flex items-center justify-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer"
                  >
                    {isEditingPlan ? (
                      <>
                        <RotateCcw size={14} className="mr-1.5 text-slate-500" />
                        Close Editor
                      </>
                    ) : (
                      <>
                        <Edit3 size={14} className="mr-1.5 text-clinical-600" />
                        {isPlanApproved ? 'Modify Plan (HITL)' : 'Review & Edit (HITL)'}
                      </>
                    )}
                  </button>

                  {!isPlanApproved && (
                    <button
                      id="btn-approve-treatment-plan"
                      type="button"
                      onClick={handleApprovePlan}
                      className="inline-flex items-center justify-center text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={15} className="mr-1.5" />
                      HITL Approve & Sign Plan
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Physician HITL Editor Panel */}
            {isEditingPlan && !loadingPlan && (
              <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-clinical-200 space-y-5 animate-fade-in">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="input-physician-addendum" className="text-xs font-extrabold uppercase tracking-wider text-clinical-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-clinical-600" />
                      Physician Clinical Overrides & Directives (HITL Addendum)
                    </label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quick-Insert Clinical Directives</span>
                  </div>

                  {/* Quick-insert clinical directive chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      id="chip-directive-aml"
                      onClick={() => handleAppendDirective(CLINICAL_DIRECTIVE_PRESETS[0])}
                      className="text-[11px] font-semibold bg-white hover:bg-clinical-50 text-clinical-700 border border-clinical-200 px-3 py-1.5 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      + Urgent Hematology Co-Mgmt (FLT3+ AML)
                    </button>
                    <button
                      type="button"
                      id="chip-directive-nsaid"
                      onClick={() => handleAppendDirective(CLINICAL_DIRECTIVE_PRESETS[1])}
                      className="text-[11px] font-semibold bg-white hover:bg-clinical-50 text-clinical-700 border border-clinical-200 px-3 py-1.5 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      + Hold Oral NSAIDs (Gastroparesis) → Intranasal Triptan
                    </button>
                    <button
                      type="button"
                      id="chip-directive-renal"
                      onClick={() => handleAppendDirective(CLINICAL_DIRECTIVE_PRESETS[2])}
                      className="text-[11px] font-semibold bg-white hover:bg-clinical-50 text-clinical-700 border border-clinical-200 px-3 py-1.5 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      + Renal & Raynaud Vascular Surveillance
                    </button>
                  </div>

                  <textarea
                    id="input-physician-addendum"
                    value={physicianAddendum}
                    onChange={(e) => setPhysicianAddendum(e.target.value)}
                    rows={3}
                    placeholder="Enter physician-specific overrides, contraindications, dosage adjustments, or follow-up priorities..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 focus:border-clinical-500 focus:ring-2 focus:ring-clinical-200 outline-none font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="textarea-treatment-plan" className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Edit AI-Synthesized Treatment Plan (Markdown)
                  </label>
                  <textarea
                    id="textarea-treatment-plan"
                    value={draftPlan}
                    onChange={(e) => setDraftPlan(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-mono text-slate-700 leading-relaxed focus:border-clinical-500 focus:ring-2 focus:ring-clinical-200 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                  <button
                    id="btn-save-plan-edits"
                    type="button"
                    onClick={handleSavePlanEdits}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm transition-all cursor-pointer"
                  >
                    Save Draft Changes
                  </button>
                  <button
                    id="btn-save-and-approve-plan"
                    type="button"
                    onClick={handleApprovePlan}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                  >
                    <ShieldCheck size={15} className="mr-1.5" />
                    Save & HITL Sign-Off Plan
                  </button>
                </div>
              </div>
            )}
            
            {loadingPlan ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={40} className="animate-spin mb-4 text-clinical-500" />
                <p className="text-sm font-bold tracking-wide">Analyzing patient clinical narratives...</p>
                <p className="text-xs text-slate-400 mt-1">Generating treatment recommendations and mapping clinical fields.</p>
              </div>
            ) : treatmentPlan ? (
              <div className="space-y-6">
                <div 
                  className="prose prose-md max-w-none text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-800 prose-ul:space-y-1"
                  dangerouslySetInnerHTML={renderMarkdown(draftPlan || treatmentPlan)}
                />

                {physicianAddendum.trim() && (
                  <div className="mt-6 p-5 rounded-2xl bg-clinical-50/70 border-l-4 border-l-clinical-600 border border-clinical-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-clinical-800">
                        <ShieldCheck size={15} className="text-clinical-600" />
                        Physician HITL Clinical Addendum & Overrides
                      </span>
                      <span className="text-[11px] font-semibold text-clinical-700">
                        {physicianName} {approvedAt ? `• Signed ${approvedAt}` : '• Draft'}
                      </span>
                    </div>
                    <div
                      className="prose prose-sm max-w-none text-slate-700 prose-ul:my-1"
                      dangerouslySetInnerHTML={renderMarkdown(physicianAddendum)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center py-12">Plan could not be generated.</p>
            )}
          </div>

          {/* Survey Form Customization (AI Preselected + Extra list) */}
          <AvailableForms 
            mrn={mrn}
            narratives={narratives}
            treatmentPlan={effectiveTreatmentPlan}
            isPlanApproved={isPlanApproved}
            aiRecommendations={aiRecommendations}
            onQuestionnaireGenerated={onQuestionnaireGenerated}
          />

        </div>

        {/* Sidebar Panel: Patient Metadata & Logs */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Stats Sidebar Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Dossier</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Record MRN</span>
                <span className="font-mono font-bold text-slate-800">{mrn}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Narrative Logs</span>
                <span className="font-bold text-slate-800">{narratives.length} Entries</span>
              </div>
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Treatment Plan HITL</span>
                {isPlanApproved ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wider">
                    Verified & Signed
                  </span>
                ) : (
                  <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
                    Pending Review
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Pipeline Status</span>
                <span className="font-bold text-clinical-600 bg-clinical-50 px-2 py-0.5 rounded uppercase tracking-wider">Analysis Active</span>
              </div>
            </div>
          </div>

          {/* Raw JSON Data Viewer */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
              <FileJson size={14} className="mr-1.5 text-slate-400" /> Raw Data Preview
            </h3>
            <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-48 custom-scrollbar shadow-inner">
              <pre className="text-[10px] leading-relaxed text-green-400 font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>

        </div>

      </div>

      {/* Patient Narrative Modal Dialog (Frosted Glass backdrop overlay) */}
      {showNarrativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-zoom-in">
            {/* Modal Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Clinical Narrative Records</h3>
                <p className="text-xs text-slate-500 mt-1">Dossier logs containing the uploaded patient symptom narratives.</p>
              </div>
              <button 
                onClick={() => setShowNarrativeModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable narratives list */}
            <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar flex-grow">
              {narratives.map((entry, index) => (
                <div key={`modal-narrative-${index}`} className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-clinical-500 rounded" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-clinical-600 bg-clinical-50 px-2.5 py-1 rounded-full mb-3 inline-block">
                    Narrative Entry {index + 1}
                  </span>
                  <NarrativeCard narrative={entry.narrative} />
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setShowNarrativeModal(false)}
                className="px-5 py-2.5 bg-slate-800 text-white font-semibold text-sm rounded-xl hover:bg-slate-900 transition-colors shadow"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
