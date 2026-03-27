import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  LayoutDashboard, FileText, User, Activity,
  CheckCircle, ChevronRight, ArrowLeft, ShieldCheck, ExternalLink, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import SourceDocument from './SourceDocument';

const API_BASE = '/api';

function App() {
  const [view, setView] = useState('dashboard');
  const [selectedMrn, setSelectedMrn] = useState(null);
  const [patients, setPatients] = useState([]);
  const [narrativeData, setNarrativeData] = useState(null);
  const [patientSourceData, setPatientSourceData] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // Loading & Progress States
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [evalData, setEvalData] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const [formData, setFormData] = useState({});
  const [prefillEnabled, setPrefillEnabled] = useState(false);

  useEffect(() => {
    fetchPatients();
    fetchMetadata();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API_BASE}/patients`);
      setPatients(res.data);
    } catch (err) { console.error("Failed to fetch patients", err); }
  };

  const fetchMetadata = async () => {
    try {
      const res = await axios.get(`${API_BASE}/metadata`);
      setMetadata(res.data);
    } catch (err) { console.error("Failed to fetch metadata", err); }
  };

  const handlePatientClick = async (mrn) => {
    setSelectedMrn(mrn);
    setView('narrative');
    setNarrativeData(null); // Keep it null so we show the "Generate" button first
    setEvalData(null);
    setFormData({});
    setPrefillEnabled(false);

    try {
      const sourceRes = await axios.get(`${API_BASE}/patient/${mrn}/data`);
      setPatientSourceData(sourceRes.data);
    } catch (err) { console.error("Failed to fetch source data", err); }
  };

  const handleBack = () => {
    setView('dashboard');
    setSelectedMrn(null);
    setNarrativeData(null);
    setEvalData(null);
    setPatientSourceData(null);
    setFormData({});
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handlePrefillToggle = (enabled) => {
    setPrefillEnabled(enabled);
    if (enabled && patientSourceData) {
      setFormData(patientSourceData);
    } else {
      setFormData({});
    }
  };

  const isFormValid = () => {
    if (prefillEnabled) return true;
    if (!metadata) return false;
    const fieldsToCheck = metadata.filter(f =>
      f.field_type !== 'descriptive' && f.field_name !== 'prefill_data' && !f.section_header
    );
    for (const field of fieldsToCheck) {
      const val = formData[field.field_name];
      if (!val || (Array.isArray(val) && val.length === 0)) return false;
    }
    return true;
  };



  const handleGenerateNarrative = async () => {
    if (!selectedMrn) return;
    const finalData = { ...patientSourceData, ...formData };

    setLoading(true);
    setProgress(5);
    setEvalData(null);
    setEvalLoading(true); // Pre-emptively start audit loading

    try {
      // 1. PHASE 1: Generate & Store in Variable
      const res = await axios.post(`${API_BASE}/patient/${selectedMrn}/narrative`, {
        patient_data: finalData
      });

      const generatedNarrative = res.data; // Capture the narrative variable
      setNarrativeData(generatedNarrative); // Update UI text
      setLoading(false);
      setProgress(100);

      // 2. PHASE 2: Pass Variable to Evaluation
      const evalRes = await axios.post(`${API_BASE}/patient/${selectedMrn}/evaluate`, {
        patient_data: finalData,
        sections: generatedNarrative.sections // Pass captured variable
      });

      setEvalData(evalRes.data);
    } catch (err) {
      console.error("Pipeline failed", err);
    } finally {
      setEvalLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative font-sans text-slate-100 overflow-x-hidden" style={{ background: 'radial-gradient(circle at center, #286890 0%, #183361 100%)' }}>
      
      {/* Watermark Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.10] bg-no-repeat bg-center"
        style={{ backgroundImage: 'url("/logo.png")', backgroundSize: 'contain' }}
      />
      
      <header className="bg-[#061226]/90 backdrop-blur-xl border-b border-[#26A69A]/10 sticky top-0 z-50 shadow-sm">
        <div className="max-w-full mx-auto px-10 h-20 flex items-center justify-between">
          
          {/* --- BRANDING SECTION --- */}
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-10 h-10 flex items-center justify-center bg-[#26A69A] rounded-xl border border-teal-500/30 shadow-[0_0_15px_rgba(38,166,154,0.3)] overflow-hidden p-1.5 transition-colors">
              <img 
                src="/logo.png" 
                alt="ClinGenSynth Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-white uppercase leading-none">
                ClinGen<span className="text-[#26A69A]">Synth</span>
              </span>
              <span className="text-[9px] text-[#26A69A] font-bold tracking-[0.2em] uppercase">Intelligent Synthesis Hub</span>
            </div>
          </div>

          {/* User Profile Section */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-black text-white uppercase tracking-tighter">Dr. Demo User</p>
              <p className="text-[10px] text-[#26A69A] font-bold uppercase tracking-widest">Clinical Lead</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#0F213A] border border-[#26A69A]/40 flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-[#26A69A]" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-10 py-8 relative z-10 h-[calc(100vh-80px)] overflow-hidden">
        {view === 'dashboard' ? (
          <DashboardView patients={patients} onSelect={handlePatientClick} />
        ) : (
          <NarrativeView
            mrn={selectedMrn}
            data={narrativeData}
            setNarrativeData={setNarrativeData}
            patientData={patientSourceData}
            metadata={metadata}
            loading={loading}
            setLoading={setLoading}
            progress={progress}
            evalData={evalData}
            evalLoading={evalLoading}
            onBack={handleBack}
            formData={formData}
            onInputChange={handleInputChange}
            prefillEnabled={prefillEnabled}
            onPrefillToggle={handlePrefillToggle}
            onGenerate={handleGenerateNarrative}
            isFormValid={isFormValid()}
          />
        )}
      </main>
    </div>
  );
}

const NarrativeView = ({
  mrn, data, setNarrativeData, patientData, metadata, loading, setLoading, progress, evalData, evalLoading, onBack,
  formData, onInputChange, prefillEnabled, onPrefillToggle, onGenerate, isFormValid
}) => {
  const [activeTab, setActiveTab] = useState('narrative');
  const [activeSection, setActiveSection] = useState(0);
  const [highlightedField, setHighlightedField] = useState(null);
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef([]);

  useEffect(() => {
    if (!data || activeTab !== 'narrative') return;
    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index'));
          setActiveSection(index);
        }
      });
    };
    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sectionRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [data, loading, activeTab]);

  const scrollToSection = (index) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCitationClick = (e) => {
    const target = e.target.closest('[data-field]');
    if (target) {
      const fieldName = target.getAttribute('data-field');
      setHighlightedField(fieldName);
      const element = document.getElementById(`field-${fieldName}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  // NEW: Logical Handler for synthesizing PDF lab data into the existing report
  const handleLabSynthesis = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/patient/${mrn}/lab-narrative`);
      // Update the narrativeData by prepending the new lab interpretation section
      setNarrativeData(prev => ({
        ...prev,
        sections: [res.data, ...(prev?.sections || [])]
      }));
      setActiveTab('narrative'); // Automatically redirect to Clinical Report to see new data
    } catch (e) {
      console.error("Lab Synthesis Error", e);
    }
    setLoading(false);
  };


  return (
    <div className="h-full flex flex-col w-full overflow-hidden">
      <div className="flex-none mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="h-6 w-px bg-slate-700"></div>
          <h1 className="text-xl font-bold text-white">Clinical Review <span className="text-sm font-mono text-slate-500">Patient Id: {mrn}</span></h1>
        </div>

        {loading && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
              <Activity className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
              <span className="text-xs font-mono">{progress}%</span>
            </div>
            <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
              <div className="h-full bg-[#26A69A] transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {/* TOP NAVIGATION TABS */}
      {data && (
        <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl w-fit backdrop-blur-md">
          <button
            onClick={() => setActiveTab('narrative')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'narrative' ? 'bg-[#26A69A] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Clinical Report
          </button>
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'evaluation' ? 'bg-[#26A69A] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AI Audit
            {evalLoading && <Activity size={14} className="animate-spin text-white" />}
            {evalData && !evalLoading && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </button>
          <button
          onClick={() => setActiveTab('lab_reports')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'lab_reports' ? 'bg-[#26A69A] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Lab Reports
        </button>
        </div>
      )}

      {/* <div className="flex-1 min-h-0 flex gap-6 w-full">
        {activeTab === 'narrative' ? (
          <>
            <div className="w-64 flex-none flex flex-col gap-2 overflow-y-auto pr-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-1">Sections</p>
              {!loading && data ? data.sections.map((section, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToSection(idx)}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border
                    ${activeSection === idx ? 'bg-[#26A69A] text-white border-teal-500 shadow-lg translate-x-1' : 'bg-white/5 text-slate-400 border-white/5 hover:border-teal-500/30'}`}
                >
                  {section.title}
                </button>
              )) : <div className="px-4 text-xs text-slate-600 italic">Ready to Begin</div>}
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-[#0F213A]/40 backdrop-blur-md rounded-3xl border border-[#26A69A]/20 overflow-hidden shadow-2xl">
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-12 relative scroll-smooth">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <Activity className="w-10 h-10 text-[#26A69A] animate-spin" />
                    <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">Synthesizing clinical evidence...</p>
                  </div>
                ) : data ? (
                  <div onClick={handleCitationClick} className="space-y-16">
                    {data.sections.map((section, idx) => (
                      <section key={idx} data-index={idx} ref={el => sectionRefs.current[idx] = el} className="relative pb-10 border-b border-white/5 last:border-0">
                        <h2 className="text-xl font-bold text-[#26A69A] uppercase tracking-tight mb-8">{section.title}</h2>
                        <article className="prose prose-invert prose-sm max-w-none font-serif leading-relaxed
                            [&_.citation]:text-[#26A69A] [&_.citation]:font-bold [&_.citation]:cursor-pointer [&_.citation]:text-[10px] [&_.citation]:align-super">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{section.content}</ReactMarkdown>
                        </article>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <button
                        onClick={onGenerate}
                        disabled={!isFormValid}
                        className={`w-full max-w-sm py-4 px-8 rounded-2xl font-bold text-lg shadow-2xl transition-all active:scale-95
                        ${isFormValid ? 'bg-[#26A69A] text-white hover:shadow-[0_0_25px_rgba(38,166,154,0.4)]' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                      >
                        {isFormValid ? "Run Note Generation Pipeline" : "Complete Form to Start"}
                      </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-[#0F213A]/40 backdrop-blur-md rounded-3xl border border-[#26A69A]/20 shadow-2xl overflow-hidden">
            <EvaluationView evalData={evalData} evalLoading={evalLoading} />
          </div>
        ) 
        } */}
        {/* --- UPDATED CONDITIONAL RENDERING BLOCK --- */}
      <div className="flex-1 min-h-0 flex gap-6 w-full">
        {activeTab === 'narrative' ? (
          <>
            <div className="w-64 flex-none flex flex-col gap-2 overflow-y-auto pr-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-1">Sections</p>
              {!loading && data ? data.sections.map((section, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToSection(idx)}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border
                    ${activeSection === idx ? 'bg-[#26A69A] text-white border-teal-500 shadow-lg translate-x-1' : 'bg-white/5 text-slate-400 border-white/5 hover:border-teal-500/30'}`}
                >
                  {section.title}
                </button>
              )) : <div className="px-4 text-xs text-slate-600 italic">Ready to Begin</div>}
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-[#0F213A]/40 backdrop-blur-md rounded-3xl border border-[#26A69A]/20 overflow-hidden shadow-2xl">
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-12 relative scroll-smooth">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <Activity className="w-10 h-10 text-[#26A69A] animate-spin" />
                    <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">Synthesizing clinical evidence...</p>
                  </div>
                ) : data ? (
                  <div onClick={handleCitationClick} className="space-y-16">
                    {data.sections.map((section, idx) => (
                      <section key={idx} data-index={idx} ref={el => sectionRefs.current[idx] = el} className="relative pb-10 border-b border-white/5 last:border-0">
                        <h2 className="text-xl font-bold text-[#26A69A] uppercase tracking-tight mb-8">{section.title}</h2>
                        <article className="prose prose-invert prose-sm max-w-none font-serif leading-relaxed
                            [&_.citation]:text-[#26A69A] [&_.citation]:font-bold [&_.citation]:cursor-pointer [&_.citation]:text-[10px] [&_.citation]:align-super">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{section.content}</ReactMarkdown>
                        </article>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <button
                        onClick={onGenerate}
                        disabled={!isFormValid}
                        className={`w-full max-w-sm py-4 px-8 rounded-2xl font-bold text-lg shadow-2xl transition-all active:scale-95
                        ${isFormValid ? 'bg-[#26A69A] text-white hover:shadow-[0_0_25px_rgba(38,166,154,0.4)]' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                      >
                        {isFormValid ? "Run Note Generation Pipeline" : "Complete Form to Start"}
                      </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'evaluation' ? (
          /* IF EVALUATION TAB IS ACTIVE */
          <div className="flex-1 bg-[#0F213A]/40 backdrop-blur-md rounded-3xl border border-[#26A69A]/20 shadow-2xl overflow-hidden">
            <EvaluationView evalData={evalData} evalLoading={evalLoading} />
          </div>
        ) : (
          /* IF NEITHER, SHOW THE LAB REPORTS VIEW */
          <div className="flex-1 bg-[#0F213A]/40 backdrop-blur-md rounded-3xl border border-[#26A69A]/20 shadow-2xl overflow-hidden p-12">
            <LabReportsView 
              mrn={mrn} 
              loading={loading}
              onGenerateFromLab={handleLabSynthesis}
            />
          </div>
        )}

        <div className="w-[450px] flex-none">
          <SourceDocument metadata={metadata} patientData={patientData} highlightedField={highlightedField} formData={formData} onInputChange={onInputChange} prefillEnabled={prefillEnabled} onPrefillToggle={onPrefillToggle} />
        </div>
      </div>
    </div>
  );
};



const EvaluationView = ({ evalData, evalLoading }) => {
  if (evalLoading) return (
    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
      <div className="relative mb-6">
        <Activity className="w-16 h-16 text-[#26A69A] animate-spin" />
        <div className="absolute inset-0 bg-[#26A69A] blur-3xl opacity-20 animate-pulse"></div>
      </div>
      <h3 className="text-lg font-black text-white uppercase tracking-[0.3em] animate-pulse">
        Auditing Trust Metrics...
      </h3>
    </div>
  );

  if (!evalData || !evalData.metrics) return (
    <div className="p-12 text-center text-slate-500 italic font-medium tracking-widest uppercase text-xs">
      No diagnostic audit data available for this session.
    </div>
  );

  const metrics = evalData.metrics;
  const getAvg = (key) => (metrics.reduce((acc, m) => acc + (m[key] || 0), 0) / metrics.length) || 0;

  const kpis = [
    { label: 'Clinical Grounding', val: getAvg('groundedness/score'), isPercent: true, color: '#26A69A' },
    { label: 'Logic Coherence', val: getAvg('coherence/score'), isPercent: false, color: '#0ea5e9' },
    { label: 'Prose Fluency', val: getAvg('fluency/score'), isPercent: false, color: '#6366f1' },
    { label: 'Overall Quality', val: getAvg('text_quality/score'), isPercent: false, color: '#a855f7' }
  ];

  return (
    <div className="h-full overflow-y-auto p-8 space-y-10 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. KPI HUD GRID */}
      <div className="grid grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-[#0F213A]/60 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 shadow-xl hover:border-[#26A69A]/30 transition-all group">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 group-hover:text-[#26A69A] transition-colors">
              {kpi.label}
            </p>
            <div className="text-4xl font-black text-white tracking-tighter">
              {kpi.isPercent ? `${(kpi.val * 100).toFixed(0)}%` : `${kpi.val.toFixed(1)}`}
              <span className="text-xs text-slate-500 ml-1 font-normal">{kpi.isPercent ? '' : '/ 5'}</span>
            </div>
            <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(38,166,154,0.3)]"
                style={{ 
                  width: kpi.isPercent ? `${kpi.val * 100}%` : `${(kpi.val / 5) * 100}%`,
                  backgroundColor: kpi.color 
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. SECTION PERFORMANCE CHART */}
      <div className="bg-[#0F213A]/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Groundedness Breakdown</h3>
            <p className="text-[10px] text-[#26A69A] font-bold uppercase mt-1 tracking-widest">Sectional Evidence Verification</p>
          </div>
          <div className="flex gap-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">
            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-[#26A69A] rounded-full shadow-[0_0_8px_#26A69A]"></div> Verified</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-800 rounded-full"></div> Insufficient</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {metrics.map((m, i) => {
            const score = m['groundedness/score'] || 0;
            const title = m.instruction?.split('clinical ')[1]?.split(' section')[0] || `Section ${i + 1}`;

            return (
              <div key={i} className="group">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide group-hover:text-white transition-colors truncate pr-4">
                    {title}
                  </span>
                  <span className="text-[10px] font-mono font-black text-[#26A69A]">
                    {(score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out ${score > 0.8 ? 'bg-gradient-to-r from-[#26A69A] to-teal-400' : 'bg-amber-500/80'}`}
                    style={{ width: `${score * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RAW METRICS TABLE */}
      <div className="bg-[#0F213A]/60 backdrop-blur-md rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5">
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-[0.2em]">Clinical Module</th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] text-center">Coherence</th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] text-center">Fluency</th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] text-center">Diagnostic Quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {metrics.map((m, i) => {
              const coherence = m['coherence/score'] || 0;
              const fluency = m['fluency/score'] || 0;
              const quality = m['text_quality/score'] || 0;
              const title = m.instruction?.replace("Write a clinical ", "").replace(" section.", "") || `Row ${i + 1}`;

              return (
                <tr key={i} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-6 font-bold text-sm text-white tracking-tight">{title}</td>
                  <td className="px-8 py-6 text-center">
                    <span className="px-3 py-1 bg-[#26A69A]/10 border border-[#26A69A]/20 text-[#26A69A] rounded-lg text-[10px] font-black">
                      {coherence.toFixed(1)}/5
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 text-slate-400 rounded-lg text-[10px] font-black group-hover:text-slate-200">
                      {fluency.toFixed(1)}/5
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                       <span className={`text-[11px] font-black ${quality >= 4 ? 'text-green-400' : 'text-slate-400'}`}>
                        {quality.toFixed(1)}
                      </span>
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white/20" style={{ width: `${(quality/5)*100}%` }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. PINNED REFERENCE FOOTER */}
      <div className="flex-none p-4 bg-[#061226]/60 border-t border-white/5 backdrop-blur-md">
                <a 
                  href="https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/evaluation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#26A69A]/40 group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#26A69A]/10 rounded-lg group-hover:bg-[#26A69A]/20 transition-colors">
                      <ShieldCheck size={14} className="text-[#26A69A]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Audit Methodology</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Vertex AI Evaluation Framework</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-slate-600 group-hover:text-[#26A69A] transition-colors" />
                </a>
            </div>
    </div>
  );
};

const LabReportsView = ({ mrn, onGenerateFromLab, loading }) => {
  const pdfUrl = "/sample_oncology.pdf"; // Target PDF stored in ui/public/
  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Diagnostic Repository</h3>
          <p className="text-[10px] text-[#26A69A] font-bold uppercase tracking-widest">Hematopathology & Oncology</p>
        </div>
        <button
          onClick={onGenerateFromLab}
          disabled={loading}
          className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${loading ? 'bg-white/5 text-slate-600' : 'bg-[#26A69A] text-white hover:scale-105 shadow-[0_0_20px_rgba(38,166,154,0.3)]'}`}
        >
          {/* Using Zap icon to differentiate AI Synthesis action */}
          {loading ? <Activity size={14} className="animate-spin" /> : <Zap size={14} className="fill-white" />}
          {loading ? 'Synthesizing Report...' : 'Use Lab Report for Narrative'}
        </button>
      </div>
      {/* PDF Viewport */}
      <div className="flex-1 bg-[#061226]/80 rounded-[2.5rem] border border-white/5 overflow-hidden relative shadow-inner">
        <iframe src={`${pdfUrl}#toolbar=0&navpanes=0`} className="w-full h-full opacity-80" title="Lab Report" />
        <div className="absolute top-6 right-6 bg-[#0F213A]/90 p-3 rounded-xl border border-[#26A69A]/30 backdrop-blur-md">
          <ShieldCheck size={20} className="text-[#26A69A]" />
        </div>
      </div>
      {/* <div className="bg-[#061226]/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#26A69A]/10 rounded-xl"><FileText size={18} className="text-[#26A69A]" /></div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-white uppercase tracking-widest">Validated Oncology Standard</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">CAP/CLIA Certified Laboratory Output</span>
          </div>
        </div>
        <ExternalLink size={14} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
      </div> */}
    </div>
  );
};

const DashboardView = ({ patients, onSelect }) => {
  return (
    <div className="space-y-10 max-w-full mx-auto w-full">
      <div>
        <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Clinical Notes Dashboard</h1>
        <p className="text-[#26A69A] font-bold uppercase tracking-[0.2em] text-xs">Intelligent Clinical Notes Generation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {patients.map((patient) => (
          <div
            key={patient.mrn}
            onClick={() => onSelect(patient.mrn)}
            className="bg-[#0F213A]/50 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] hover:border-[#26A69A]/50 hover:bg-[#26A69A]/5 transition-all cursor-pointer group shadow-xl"
            role="button"
          >
            <p className="text-[10px] font-black text-[#26A69A] uppercase tracking-[0.3em] mb-2">{patient.mrn}</p>
            <h3 className="text-2xl font-black text-white group-hover:text-[#26A69A] transition-colors tracking-tight">{patient.name}</h3>
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500 italic">Survey Completion</span>
                <span className="text-white">{patient.survey_completion}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#26A69A] to-teal-400 shadow-[0_0_10px_rgba(38,166,154,0.5)] transition-all duration-1000" 
                  style={{ width: `${patient.survey_completion}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


export default App;