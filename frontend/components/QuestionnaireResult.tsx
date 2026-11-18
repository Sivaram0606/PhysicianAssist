import React, { useState } from 'react';
import { TailoredQuestionnaireResult } from '../types';
import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, Sparkles, Database, Download, Check, ChevronDown, ChevronUp, ChevronRight, X, User, ShieldCheck } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface QuestionnaireResultProps {
  result: TailoredQuestionnaireResult;
  templateId: string;
  mrn: string;
  onBack: () => void;
}

export const QuestionnaireResult: React.FC<QuestionnaireResultProps> = ({ result, templateId, mrn, onBack }) => {
  const [activeTab, setActiveTab] = useState<'retained' | 'additional' | 'dropped'>('retained');
  const [isDeployed, setIsDeployed] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployToast, setDeployToast] = useState<string | null>(null);
  const [deployedLink, setDeployedLink] = useState<string | null>(null);
  const [deployedUri, setDeployedUri] = useState<string | null>(null);
  const [deployedSurveyId, setDeployedSurveyId] = useState<string | null>(null);
  const [collapsedForms, setCollapsedForms] = useState<{ [form: string]: boolean }>({});

  const formatFormName = (name: string) => {
    if (!name || name === "general_questions" || name === "General / Uncategorized") {
      return "General Questionnaire Questions";
    }
    return name
      .split(', ')
      .map(form => form
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      )
      .join(' & ');
  };

  const renderMarkdown = (content: string) => {
    const rawHtml = marked.parse(content) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tailored_${templateId}_mrn_${mrn}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    // Collect all active questions (retained + additional recommended) across all tailored forms
    const activeQuestions: any[] = [];
    result.forms?.forEach(form => {
      form.retained_questions?.forEach(q => {
        activeQuestions.push({
          form_name: form.form_name,
          field_name: q.field_name,
          question_text: q.question_text,
          choices: q.choices
        });
      });
      form.additional_questions?.forEach(q => {
        activeQuestions.push({
          form_name: form.form_name,
          field_name: q.field_name,
          question_text: q.question_text,
          choices: q.choices
        });
      });
    });

    // Store in LocalStorage for backward compatibility
    localStorage.setItem('deployed_questions', JSON.stringify(activeQuestions));
    localStorage.setItem('deployed_template_id', templateId);
    localStorage.setItem('deployed_mrn', mrn);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/deploy-survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mrn: mrn,
          survey_event_id: templateId || "default_survey",
          survey_data: {
            template_id: templateId,
            patient_mrn: mrn,
            deployed_questions: activeQuestions,
            tailored_at: new Date().toISOString()
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to deploy survey to backend GCS');
      }

      const data = await response.json();
      if (data.status === 'success') {
        setIsDeployed(true);
        setDeployedLink(data.dynamic_link);
        setDeployedUri(data.gcs_uri);
        setDeployedSurveyId(data.survey_id);
        localStorage.setItem('deployed_survey_id', data.survey_id);
        setDeployToast("Physician HITL approved! Tailored survey written to storage and bound to the Patient ADK Assistant.");
      } else {
        setDeployToast(`Error deploying survey: ${data.message}`);
      }
    } catch (err: any) {
      console.error("Deployment failed:", err);
      setDeployToast(`Deployment failed: ${err.message || err}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Calculate sum of questions across all nested forms
  const totalRetained = result.forms?.reduce((acc, form) => acc + (form.retained_questions?.length || 0), 0) || 0;
  const totalAdditional = result.forms?.reduce((acc, form) => acc + (form.additional_questions?.length || 0), 0) || 0;
  const totalDropped = result.forms?.reduce((acc, form) => acc + (form.dropped_questions?.length || 0), 0) || 0;

  // Workflow sequence steps
  const steps = [
    { id: 1, name: 'Upload Narrative', status: 'complete' },
    { id: 2, name: 'Treatment Plan (HITL)', status: 'complete' },
    { id: 3, name: 'Select & Tailor Forms', status: 'complete' },
    { id: 4, name: 'Verify Questions (HITL)', status: isDeployed ? 'complete' : 'current' },
    { id: 5, name: 'Deploy Survey', status: isDeployed ? 'current' : 'upcoming' }
  ];

  const customWebLink = `${window.location.origin}?showPatient=true&role=patient&mrn=${mrn}&survey_id=${deployedSurveyId || ''}`;

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

      {deployToast && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            {deployToast}
          </span>
          <button onClick={() => setDeployToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Local ADK Chatbot Deployed Banner */}
      {isDeployed && (
        <div className="bg-gradient-to-r from-clinical-50 to-clinical-100 border border-clinical-200 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-clinical-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                    Active Local Deployment
                  </span>
                  <span className="text-slate-500 text-xs font-mono">
                    {deployedUri}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Survey deployed
                </h3>
                <p className="text-slate-600 text-sm mt-1">
                  Click below link to go to the chatbot survey assistant
                </p>
              </div>
              <button
                onClick={() => setIsDeployed(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 transition-colors shrink-0"
                title="Dismiss"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200/60 flex flex-col gap-6">
              {/* Single Deployed Link Option: Patient Survey Assistant */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-clinical-100 text-clinical-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      Active Portal
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Local Chatbot Assistant Portal</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Direct access to our tailored patient-facing voice & text chatbot interface powered by local ADK runner.
                  </p>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-xl">
                    <span className="text-xs font-mono text-slate-500 select-all truncate flex-1">
                      {customWebLink}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(customWebLink);
                        alert("Chatbot Portal Link copied!");
                      }}
                      className="ml-2 text-xs font-semibold text-clinical-600 hover:text-clinical-800 shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="shrink-0">
                  <a
                    href={customWebLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-sm font-semibold text-white bg-clinical-600 hover:bg-clinical-700 py-2.5 px-5 rounded-lg transition-all shadow-sm"
                  >
                    <User size={14} className="mr-2" />
                    Launch Chatbot Portal
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center text-sm font-medium text-slate-500 hover:text-clinical-600 transition-colors mb-3"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Clinical Narrative
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Tailored Questionnaire
            </h1>
            <span className="bg-clinical-50 text-clinical-700 font-medium px-3 py-1 rounded-full text-xs border border-clinical-100 font-mono max-w-md truncate" title={formatFormName(templateId)}>
              {formatFormName(templateId)}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Questionnaire tailored by clinical agents for Patient MRN: <strong className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{mrn}</strong>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToJson}
            className="flex items-center justify-center text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors px-4 py-2.5 rounded-lg border border-slate-200 shadow-sm"
          >
            <Download size={16} className="mr-2" />
            Export JSON
          </button>

          <button 
            onClick={handleDeploy}
            disabled={isDeployed}
            className={`flex items-center justify-center text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-all shadow-md ${
              isDeployed 
                ? 'bg-green-600' 
                : 'bg-clinical-600 hover:bg-clinical-700 hover:shadow'
            }`}
          >
            {isDeployed ? (
              <>
                <Check size={16} className="mr-2 animate-bounce" />
                Deployed!
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                HITL Approve & Deploy Survey
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-grow">
        
        {/* Left Side: Interactive Questionnaire Viewer */}
        <div className="w-full lg:w-2/3 flex flex-col">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 mb-6 bg-slate-50 p-1.5 rounded-lg border border-slate-100 shadow-sm">
            <button
              onClick={() => setActiveTab('retained')}
              className={`flex-1 flex items-center justify-center py-2 px-4 text-sm font-medium rounded-md transition-all ${
                activeTab === 'retained'
                  ? 'bg-white text-clinical-700 shadow-sm font-semibold border border-clinical-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 size={16} className={`mr-2 ${activeTab === 'retained' ? 'text-clinical-600' : 'text-slate-400'}`} />
              Retained ({totalRetained})
            </button>
            
            <button
              onClick={() => setActiveTab('additional')}
              className={`flex-1 flex items-center justify-center py-2 px-4 text-sm font-medium rounded-md transition-all ${
                activeTab === 'additional'
                  ? 'bg-white text-clinical-700 shadow-sm font-semibold border border-clinical-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Sparkles size={16} className={`mr-2 ${activeTab === 'additional' ? 'text-clinical-600' : 'text-slate-400'}`} />
              AI-Suggested ({totalAdditional})
            </button>

            <button
              onClick={() => setActiveTab('dropped')}
              className={`flex-1 flex items-center justify-center py-2 px-4 text-sm font-medium rounded-md transition-all ${
                activeTab === 'dropped'
                  ? 'bg-white text-clinical-700 shadow-sm font-semibold border border-clinical-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle size={16} className={`mr-2 ${activeTab === 'dropped' ? 'text-clinical-600' : 'text-slate-400'}`} />
              Dropped ({totalDropped})
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex-grow">
            
            {activeTab === 'retained' && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
                    Retained Questions
                  </h3>
                  <p className="text-slate-500 text-sm">
                    These questions from the original templates have been verified as relevant and are grouped by clinical form.
                  </p>
                </div>
                {totalRetained > 0 ? (
                  <div className="space-y-6">
                    {result.forms?.map((form) => {
                      if (!form.retained_questions || form.retained_questions.length === 0) return null;
                      const isCollapsed = collapsedForms[form.form_name];
                      return (
                        <div key={form.form_name} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button 
                            onClick={() => setCollapsedForms(prev => ({ ...prev, [form.form_name]: !prev[form.form_name] }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 text-left hover:bg-slate-100 transition-colors"
                          >
                            <span className="font-bold text-slate-800 text-sm">{formatFormName(form.form_name)} ({form.retained_questions.length})</span>
                            {isCollapsed ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronUp size={18} className="text-slate-500" />}
                          </button>
                          {!isCollapsed && (
                            <ul className="p-4 space-y-4">
                              {form.retained_questions.map((q, qIdx) => (
                                <li key={qIdx} className="flex flex-col p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all">
                                  <div className="flex items-start">
                                    <div className="bg-green-100 p-1 rounded-full mr-3.5 flex-shrink-0 mt-0.5">
                                      <CheckCircle2 size={14} className="text-green-600" />
                                    </div>
                                    <div>
                                      <span className="text-slate-800 text-sm font-bold leading-relaxed">{q.question_text}</span>
                                      <p className="text-[10px] text-slate-400 font-mono mt-1">Field ID: {q.field_name}</p>
                                    </div>
                                  </div>
                                  
                                  {q.choices && q.choices.length > 0 && (
                                    <div className="mt-3 ml-8 pl-3 border-l border-slate-200 flex flex-wrap gap-2">
                                      {q.choices.map((choice, cIdx) => (
                                        <span key={cIdx} className="text-xs bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full shadow-sm font-semibold">
                                          {choice}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-12">No questions retained from templates.</p>
                )}
              </div>
            )}

            {activeTab === 'additional' && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
                    AI-Suggested Questions
                  </h3>
                  <p className="text-slate-500 text-sm">
                    These additional questions were missing from standard templates but are highly recommended and grouped by relevant clinical category.
                  </p>
                </div>
                {totalAdditional > 0 ? (
                  <div className="space-y-6">
                    {result.forms?.map((form) => {
                      if (!form.additional_questions || form.additional_questions.length === 0) return null;
                      const isCollapsed = collapsedForms[form.form_name];
                      return (
                        <div key={form.form_name} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button 
                            onClick={() => setCollapsedForms(prev => ({ ...prev, [form.form_name]: !prev[form.form_name] }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 text-left hover:bg-slate-100 transition-colors"
                          >
                            <span className="font-bold text-slate-800 text-sm">{formatFormName(form.form_name)} ({form.additional_questions.length})</span>
                            {isCollapsed ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronUp size={18} className="text-slate-500" />}
                          </button>
                          {!isCollapsed && (
                            <ul className="p-4 space-y-4">
                              {form.additional_questions.map((q, qIdx) => (
                                <li key={qIdx} className="flex flex-col p-4 bg-clinical-50/20 hover:bg-clinical-50/40 border border-clinical-100 rounded-xl transition-all">
                                  <div className="flex items-start">
                                    <div className="bg-clinical-100 p-1 rounded-full mr-3.5 flex-shrink-0 mt-0.5">
                                      <Sparkles size={14} className="text-clinical-600" />
                                    </div>
                                    <div>
                                      <span className="text-slate-800 text-sm font-bold leading-relaxed">{q.question_text}</span>
                                      <p className="text-[10px] text-clinical-400 font-mono mt-1">Field ID: {q.field_name}</p>
                                    </div>
                                  </div>

                                  {q.choices && q.choices.length > 0 && (
                                    <div className="mt-3 ml-8 pl-3 border-l border-clinical-200 flex flex-wrap gap-2">
                                      {q.choices.map((choice, cIdx) => (
                                        <span key={cIdx} className="text-xs bg-white border border-slate-200 text-clinical-600 px-2.5 py-1 rounded-full shadow-sm font-semibold">
                                          {choice}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-12">No additional questions recommended.</p>
                )}
              </div>
            )}

            {activeTab === 'dropped' && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
                    Dropped Questions
                  </h3>
                  <p className="text-slate-500 text-sm">
                    These standard template questions have been filtered out because they do not apply to the patient's specific clinical context.
                  </p>
                </div>
                {totalDropped > 0 ? (
                  <div className="space-y-6">
                    {result.forms?.map((form) => {
                      if (!form.dropped_questions || form.dropped_questions.length === 0) return null;
                      const isCollapsed = collapsedForms[form.form_name];
                      return (
                        <div key={form.form_name} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button 
                            onClick={() => setCollapsedForms(prev => ({ ...prev, [form.form_name]: !prev[form.form_name] }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 text-left hover:bg-slate-100 transition-colors"
                          >
                            <span className="font-bold text-slate-800 text-sm">{formatFormName(form.form_name)} ({form.dropped_questions.length})</span>
                            {isCollapsed ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronUp size={18} className="text-slate-500" />}
                          </button>
                          {!isCollapsed && (
                            <div className="p-3 space-y-4">
                              {form.dropped_questions.map((q, qIdx) => (
                                <div key={qIdx} className="p-4 bg-slate-50 rounded-lg border border-slate-150">
                                  <div className="flex items-start mb-2.5">
                                    <div className="bg-amber-100 p-1 rounded-full mr-3 flex-shrink-0 mt-0.5">
                                      <AlertTriangle size={13} className="text-amber-600" />
                                    </div>
                                    <div>
                                      <span className="text-slate-800 font-bold text-sm leading-relaxed">{q.question_text}</span>
                                      <p className="text-[10px] text-slate-400 font-mono mt-1">Field ID: {q.field_name}</p>
                                    </div>
                                  </div>
                                  {form.reasons_for_dropping && form.reasons_for_dropping[qIdx] && (
                                    <div className="ml-8 p-3 bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded text-slate-600 text-xs">
                                      <div className="flex items-start">
                                        <HelpCircle size={13} className="mr-1.5 mt-0.5 text-slate-400 flex-shrink-0" />
                                        <span className="leading-relaxed"><strong>Clinical Rationale:</strong> {form.reasons_for_dropping[qIdx]}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-12">No template questions were dropped.</p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right Side: Clinical Context Sidebar */}
        <div className="w-full lg:w-1/3 space-y-6">
          
          {/* AI Treatment Plan Recap */}
          {result.treatment_plan && (
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center">
                  <Sparkles size={16} className="mr-2 text-clinical-600" />
                  Treatment Plan Context
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  HITL Verified
                </span>
              </div>
              <div 
                className="prose prose-sm max-w-none text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-800 max-h-96 overflow-y-auto custom-scrollbar pr-1"
                dangerouslySetInnerHTML={renderMarkdown(result.treatment_plan)}
              />
            </div>
          )}

          {/* Patient Baseline Context */}
          {result.baseline_context && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center">
                <Database size={16} className="mr-2 text-clinical-600" />
                Clinical Baseline Context
              </h3>
              <pre className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-4 font-mono text-slate-600 overflow-auto max-h-96 custom-scrollbar leading-relaxed">
                {result.baseline_context}
              </pre>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};