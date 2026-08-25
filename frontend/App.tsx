import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { QuestionnaireResult } from './components/QuestionnaireResult';
import { ChatInterface } from './components/ChatInterface';
import ClinGenSynthesizer from './components/ClinGenSynthesizer'; // Imported ClinGen Synthesizer
import { ClinicalDataPayload, TailoredQuestionnaireResult } from './types';
import { AlertCircle, Stethoscope, User, ArrowLeft, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<'coordinator' | 'patient' | null>('coordinator');
  const [coordinatorTab, setCoordinatorTab] = useState<'clingen' | 'tailor'>('clingen');
  const [clinicalData, setClinicalData] = useState<ClinicalDataPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionnaireResult, setQuestionnaireResult] = useState<TailoredQuestionnaireResult | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Check if we should show the patient portal in the frontend.
  // This is hidden by default for users, but retained in the codebase and accessible via `?showPatient=true` query param.
  const showPatientPortal = typeof window !== 'undefined' && window.location.search.includes('showPatient=true');

  // Auto-route based on query parameters on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      if (roleParam === 'patient') {
        setUserRole('patient');
      } else if (roleParam === 'coordinator') {
        setUserRole('coordinator');
      }
    }
  }, []);

  // Secure and elegant callback to hand off a synthesized narrative from ClinGen to Survey Tailoring
  const handleExportNarrative = (narrativeData: any) => {
    if (!narrativeData || !narrativeData.sections) {
      setError('Export failed: Synthesized narrative has an invalid schema.');
      return;
    }

    // Convert ClinGen sections list into a single integrated markdown string
    const combinedMarkdown = narrativeData.sections.map((section: any) => {
      return `## ${section.title}\n\n${section.content}`;
    }).join('\n\n');

    // Build the clinicalData payload matching the schema expected by the Survey Tailoring Workspace
    const formattedPayload: ClinicalDataPayload = {
      response: {
        target_patient_mrn: narrativeData.mrn || 'N/A',
        narratives: [
          {
            narrative: combinedMarkdown
          }
        ]
      }
    };

    setClinicalData(formattedPayload);
    setCoordinatorTab('tailor'); // Jump straight into the tailoring dashboard!
  };

  // If user is a patient, render ChatInterface in absolute full-screen mode directly at the root
  if (userRole === 'patient') {
    return (
      <div className="w-screen h-screen overflow-hidden">
        <ChatInterface 
          role="patient" 
          onQuestionnaireGenerated={(result, templateId) => {
            setQuestionnaireResult(result);
            setSelectedTemplate(templateId);
          }}
        />
      </div>
    );
  }

  // To preserve the gorgeous dark radial styling of ClinGen, render it as a full-page view without the white global navbar on top
  if (userRole === 'coordinator' && coordinatorTab === 'clingen') {
    return (
      <ClinGenSynthesizer 
        onExportNarrative={handleExportNarrative} 
        onBackToPortal={() => {
          handleReset();
        }} 
      />
    );
  }

  const handleDataLoaded = (data: any) => {
    setError(null);
    
    // Basic schema validation
    if (!data || typeof data !== 'object') {
      setError('Invalid JSON structure: Root must be an object.');
      return;
    }
    
    if (!data.response) {
      setError('Invalid schema: Missing "response" object at root.');
      return;
    }

    if (typeof data.response.target_patient_mrn !== 'string') {
      setError('Invalid schema: "response.target_patient_mrn" must be a string.');
      return;
    }

    if (!Array.isArray(data.response.narratives)) {
      setError('Invalid schema: "response.narratives" must be an array.');
      return;
    }

    // If validation passes, set the data
    setClinicalData(data as ClinicalDataPayload);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleReset = () => {
    setClinicalData(null);
    setQuestionnaireResult(null);
    setSelectedTemplate(null);
    setUserRole(null);
    setError(null);
    setCoordinatorTab('clingen');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Global Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center text-clinical-700">
            <Stethoscope size={24} className="mr-2" />
            <span className="font-bold text-xl tracking-tight">Mayo Clinic Survey Intelligence</span>
          </div>

          {/* Toggle navigation for coordinators between ClinGen Synthesizer and Tailor workspace */}
          {userRole === 'coordinator' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setCoordinatorTab('clingen')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  coordinatorTab === 'clingen'
                    ? 'bg-[#0284c7] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Synthesizer
              </button>
              <button
                onClick={() => setCoordinatorTab('tailor')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  coordinatorTab === 'tailor'
                    ? 'bg-[#0284c7] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tailoring Suite
              </button>
            </div>
          )}

          {userRole && (
            <button 
              onClick={handleReset}
              className="text-sm font-semibold text-slate-500 hover:text-clinical-600 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </nav>

      <main className="flex-grow flex flex-col">
        {error && (
          <div className="max-w-4xl mx-auto w-full mt-6 px-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start">
              <AlertCircle className="text-red-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-red-800 font-medium">Error Loading Data</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!userRole ? (
          <div className="flex-grow flex flex-col items-center justify-center px-4 py-12">
            <div className="text-center mb-12 max-w-2xl">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Clinical Survey Intelligence
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Welcome to the intelligent bridge between clinical narratives and REDCap. 
                Please select your portal to begin.
              </p>
            </div>
            
            
            <div className={`grid grid-cols-1 ${showPatientPortal ? 'md:grid-cols-2 max-w-4xl' : 'max-w-md'} gap-8 w-full px-4`}>
              <button 
                onClick={() => setUserRole('coordinator')}
                className="group relative bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-clinical-500 transition-all duration-300 shadow-xl hover:shadow-clinical-200/50 flex flex-col items-center text-center w-full"
              >
                <div className="bg-clinical-50 p-6 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Stethoscope size={48} className="text-clinical-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Research Coordinator</h3>
                <p className="text-slate-500 text-sm">
                  Upload narratives, analyze clinical context, and tailor survey instruments for patient cohorts.
                </p>
                <div className="mt-6 font-semibold text-clinical-600 flex items-center">
                  Enter Portal <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              {showPatientPortal && (
                <button 
                  onClick={() => setUserRole('patient')}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-clinical-500 transition-all duration-300 shadow-xl hover:shadow-clinical-200/50 flex flex-col items-center text-center w-full"
                >
                  <div className="bg-clinical-50 p-6 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    <User size={48} className="text-clinical-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Patient Survey</h3>
                  <p className="text-slate-500 text-sm">
                    Complete your health questionnaire with ease using touch, keyboard, or voice interactions.
                  </p>
                  <div className="mt-6 font-semibold text-clinical-600 flex items-center">
                    Start Survey <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : userRole === 'coordinator' ? (
          !clinicalData ? (
            <div className="flex-grow flex flex-col justify-center max-w-4xl mx-auto w-full px-4 py-8">
              <div className="flex items-center justify-between py-4">
                <button 
                  onClick={() => setUserRole(null)}
                  className="text-sm font-medium text-slate-500 hover:text-clinical-600 flex items-center transition-colors"
                >
                  <ArrowLeft size={16} className="mr-1" /> Back
                </button>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  Coordinator Upload
                </div>
              </div>
              
              {/* Added cohesive helper header for the tailoring uploads */}
              <div className="bg-clinical-50/50 border border-clinical-100 rounded-2xl p-6 mb-6 flex gap-4 items-center">
                <div className="p-3 bg-clinical-100 rounded-xl text-[#0284c7]">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-clinical-900 text-sm">Workflow Intelligence Tip</h4>
                  <p className="text-xs text-clinical-700 mt-0.5 leading-relaxed">
                    You can upload an existing clinical narrative JSON here, or select the <strong>Synthesizer</strong> tab in the header to generate a patient narrative from clinical registries and evaluate it first!
                  </p>
                </div>
              </div>

              <FileUpload onFileLoaded={handleDataLoaded} onError={handleError} />
            </div>
          ) : questionnaireResult ? (
            <QuestionnaireResult 
              result={questionnaireResult} 
              templateId={selectedTemplate || ""} 
              mrn={clinicalData.response.target_patient_mrn} 
              onBack={() => {
                setQuestionnaireResult(null);
                setSelectedTemplate(null);
              }} 
            />
          ) : (
            <div className="flex-grow flex flex-col w-full pb-8">
              <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <button 
                  onClick={() => {
                    setClinicalData(null);
                    setError(null);
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-clinical-600 flex items-center transition-colors"
                >
                  <ArrowLeft size={16} className="mr-1" /> Back to Upload
                </button>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  Coordinator Workspace
                </div>
              </div>
              <Dashboard 
                data={clinicalData}
                onReset={handleReset}
                onQuestionnaireGenerated={(result, templateId) => {
                  setQuestionnaireResult(result);
                  setSelectedTemplate(templateId);
                }}
              />
            </div>
          )
        ) : (
          <div className="flex-grow flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8">
            <div className="flex items-center justify-between py-4">
              <button 
                onClick={() => setUserRole(null)}
                className="text-sm font-medium text-slate-500 hover:text-clinical-600 flex items-center transition-colors"
              >
                <ArrowLeft size={16} className="mr-1" /> Change Portal
              </button>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
                Active Session: {userRole}
              </div>
            </div>
            
            <ChatInterface 
              role={userRole} 
              onQuestionnaireGenerated={(result, templateId) => {
                setQuestionnaireResult(result);
                setSelectedTemplate(templateId);
              }}
            />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto shadow-inner">
        <div className="max-w-7xl mx-auto px-4 text-center text-[10px] uppercase tracking-widest font-bold text-slate-400">
          <p>Confidential & Proprietary • Mayo Clinic Research Intelligence • HIPAA Compliant Environment</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
