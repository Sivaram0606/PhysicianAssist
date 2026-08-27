import React, { useState, useEffect } from 'react';
import { ClinicalDataPayload, TailoredQuestionnaireResult } from '../types';
import { NarrativeCard } from './NarrativeCard';
import { AvailableForms } from './AvailableForms';
import { User, Activity, ArrowLeft, FileJson, ClipboardList, Loader2, Eye, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface DashboardProps {
  data: ClinicalDataPayload;
  onReset: () => void;
  onQuestionnaireGenerated: (result: TailoredQuestionnaireResult, templateId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onQuestionnaireGenerated }) => {
  const [treatmentPlan, setTreatmentPlan] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);
  
  const { response } = data;
  const mrn = response?.target_patient_mrn || 'Unknown MRN';
  const narratives = response?.narratives || [];

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (narratives.length === 0) return;
      
      setLoadingPlan(true);
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

  const renderMarkdown = (content: string) => {
    const rawHtml = marked.parse(content) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  // Workflow sequence steps
  const steps = [
    { id: 1, name: 'Upload Narrative', status: 'complete' },
    { id: 2, name: 'AI Analysis & Select', status: 'current' },
    { id: 3, name: 'Verify Questions (HITL)', status: 'upcoming' },
    { id: 4, name: 'Deploy Survey', status: 'upcoming' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow flex flex-col">
      
      {/* Workflow Sequence Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
            Analyzing and tailoring clinical instruments for Patient MRN: <strong className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{mrn}</strong>
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
          
          {/* AI Generated Treatment Plan Box (Center Focused) */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <ClipboardList size={22} className="mr-2.5 text-clinical-600" />
                AI-Generated Treatment Plan
              </h3>
              <span className="text-xs font-bold uppercase tracking-wider text-clinical-600 bg-clinical-50 px-3 py-1 rounded-full">
                Clinical Synthesis
              </span>
            </div>
            
            {loadingPlan ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={40} className="animate-spin mb-4 text-clinical-500" />
                <p className="text-sm font-bold tracking-wide">Analyzing patient clinical narratives...</p>
                <p className="text-xs text-slate-400 mt-1">Generating treatment recommendations and mapping clinical fields.</p>
              </div>
            ) : treatmentPlan ? (
              <div 
                className="prose prose-md max-w-none text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-800 prose-ul:space-y-1"
                dangerouslySetInnerHTML={renderMarkdown(treatmentPlan)}
              />
            ) : (
              <p className="text-sm text-slate-500 italic text-center py-12">Plan could not be generated.</p>
            )}
          </div>

          {/* Survey Form Customization (AI Preselected + Extra list) */}
          <AvailableForms 
            mrn={mrn}
            narratives={narratives}
            treatmentPlan={treatmentPlan}
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
