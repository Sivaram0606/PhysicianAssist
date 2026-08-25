import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Info, CheckSquare, Square, Play, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { NarrativeEntry, TailoredQuestionnaireResult } from '../types';

interface AvailableFormsProps {
  mrn: string;
  narratives: NarrativeEntry[];
  treatmentPlan: string | null;
  aiRecommendations?: any[];
  onQuestionnaireGenerated: (result: TailoredQuestionnaireResult, templateId: string) => void;
}

// Sample fallback list when connection to REDCap fails
const MOCK_DATA = [
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"registration_log"},
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"consent"},
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"history_of_present_illness_scleroderma"},
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"review_of_systems"},
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"past_medical_history_2ecd"},
  {"arm_num":1,"unique_event_name":"baseline_arm_1","form":"surgical_history"}
];

export const AvailableForms: React.FC<AvailableFormsProps> = ({ 
  mrn, 
  narratives, 
  treatmentPlan, 
  aiRecommendations = [], 
  onQuestionnaireGenerated 
}) => {
  const [allForms, setAllForms] = useState<string[]>([]);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showOtherForms, setShowOtherForms] = useState(false);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/redcap-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const uniqueForms = Array.from(new Set(data.map((item: any) => item.form))) as string[];
        setAllForms(uniqueForms);
      } catch (err) {
        console.warn("Error fetching forms. Using fallback:", err);
        setNotice('Connection failed. Showing sample data.');
        const uniqueForms = Array.from(new Set(MOCK_DATA.map((item: any) => item.form))) as string[];
        setAllForms(uniqueForms);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  // Pre-select AI recommended forms once they are loaded
  useEffect(() => {
    if (aiRecommendations && aiRecommendations.length > 0) {
      const newSelection = new Set<string>();
      aiRecommendations.forEach(rec => {
        newSelection.add(rec.form_name);
      });
      setSelectedForms(newSelection);
    }
  }, [aiRecommendations]);

  const formatFormName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const toggleFormSelection = (form: string) => {
    setSelectedForms(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(form)) {
        newSelection.delete(form);
      } else {
        newSelection.add(form);
      }
      return newSelection;
    });
  };

  const handleTriggerPipeline = async () => {
    if (selectedForms.size === 0) return;
    
    setIsTriggering(true);
    try {
      const combinedNarrative = narratives.map(n => n.narrative).join('\n\n');
      const template_ids = Array.from(selectedForms);
      
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/generate-questionnaire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          narrative: combinedNarrative,
          template_ids: template_ids,
          mrn: mrn,
          treatment_plan: treatmentPlan
        }),
      });

      if (!response.ok) throw new Error('Pipeline trigger failed');
      
      const result = await response.json();
      if (result.status === 'success') {
        onQuestionnaireGenerated(result.data, template_ids.join(', '));
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error triggering pipeline:', err);
      alert(`Error triggering pipeline: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  // Divide forms into AI Recommended vs. Others
  const recommendedSet = new Set(aiRecommendations.map(r => r.form_name));
  const otherForms = allForms.filter(f => !recommendedSet.has(f));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center">
          <FileText size={16} className="mr-2 text-clinical-600" />
          Survey Form Customization
        </h3>
        {selectedForms.size > 0 && (
          <span className="text-xs font-medium bg-clinical-100 text-clinical-700 px-2 py-1 rounded-full">
            {selectedForms.size} selected
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {notice && (
            <div className="flex items-start text-amber-700 bg-amber-50 p-2.5 rounded-lg text-xs border border-amber-100">
              <Info size={14} className="mr-1.5 mt-0.5 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* AI Recommended Section */}
          {aiRecommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-clinical-600 bg-clinical-50/50 py-1.5 px-3 rounded-lg border border-clinical-100/50">
                <Sparkles size={14} className="mr-1.5 text-clinical-500" />
                AI-Recommended Forms
              </div>
              
              <div className="space-y-3">
                {aiRecommendations.map((rec, idx) => {
                  const isSelected = selectedForms.has(rec.form_name);
                  return (
                    <div 
                      key={idx}
                      onClick={() => toggleFormSelection(rec.form_name)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-clinical-50 border-clinical-200 text-clinical-800 shadow-sm' 
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="mt-1 mr-3 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare size={18} className="text-clinical-600" />
                          ) : (
                            <Square size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm leading-snug">{formatFormName(rec.form_name)}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              rec.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>{rec.priority} Priority</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-normal">{rec.rationale}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Available Forms Section */}
          {otherForms.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <button 
                onClick={() => setShowOtherForms(!showOtherForms)}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors py-2 px-1"
              >
                <span>Other Available Forms ({otherForms.length})</span>
                {showOtherForms ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showOtherForms && (
                <ul className="space-y-1.5 mt-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {otherForms.map((form, idx) => {
                    const isSelected = selectedForms.has(form);
                    return (
                      <li 
                        key={idx} 
                        onClick={() => toggleFormSelection(form)}
                        className={`flex items-center text-xs px-3 py-2 rounded-md border transition-colors cursor-pointer select-none ${
                          isSelected 
                            ? 'bg-clinical-50/50 border-clinical-100 text-clinical-800' 
                            : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <div className="mr-2 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-clinical-600" />
                          ) : (
                            <Square size={15} className="text-slate-400" />
                          )}
                        </div>
                        <span className="leading-tight truncate">{formatFormName(form)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Trigger Pipeline Button */}
          {selectedForms.size > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={handleTriggerPipeline}
                disabled={isTriggering}
                className={`w-full flex items-center justify-center text-sm font-medium text-white px-4 py-3 rounded-lg transition-all shadow-sm ${
                  isTriggering 
                    ? 'bg-clinical-400 cursor-not-allowed' 
                    : 'bg-clinical-600 hover:bg-clinical-700 hover:shadow'
                }`}
              >
                {isTriggering ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Triggering Pipeline...
                  </>
                ) : (
                  <>
                    <Play size={18} className="mr-2" />
                    Trigger Questionnaire Customization
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
