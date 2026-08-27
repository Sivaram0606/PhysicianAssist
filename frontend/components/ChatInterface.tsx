import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Mic, Paperclip, MicOff, Sparkles, Database, Plus, Stethoscope, ShieldCheck, Menu, SquarePen, ArrowUp, HelpCircle, Settings, MessageSquare, History } from 'lucide-react';
import { TailoredQuestionnaireResult } from '../types';
import { useVoiceToText } from '../hooks/useVoiceToText';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Custom SVG for the Gemini Sparkle Logo
const GeminiLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M12.0001 2.25C12.0001 7.63478 16.3653 12 21.7501 12C16.3653 12 12.0001 16.3652 12.0001 21.75C12.0001 16.3652 7.63488 12 2.25012 12C7.63488 12 12.0001 7.63478 12.0001 2.25Z" fill="url(#paint0_linear_gemini)"/>
    <defs>
      <linearGradient id="paint0_linear_gemini" x1="2.25012" y1="2.25" x2="21.7501" y2="21.75" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4"/>
        <stop offset="0.333333" stopColor="#EA4335"/>
        <stop offset="0.666667" stopColor="#FBBC05"/>
        <stop offset="1" stopColor="#34A853"/>
      </linearGradient>
    </defs>
  </svg>
);

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'form_recommendation' | 'question_tailoring' | 'survey_question' | 'rich_assistant_tool';
  data?: any;
}

interface ChatInterfaceProps {
  role: 'coordinator' | 'patient';
  onQuestionnaireGenerated?: (result: TailoredQuestionnaireResult, templateId: string) => void;
  isEmbedded?: boolean;
  embeddedMrn?: string;
  embeddedSurveyId?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  role, 
  onQuestionnaireGenerated,
  isEmbedded = false,
  embeddedMrn,
  embeddedSurveyId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  
  // Custom Deployed Survey States
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [customStep, setCustomStep] = useState<number>(-1);

  // Patient Context States
  const [patientMrn, setPatientMrn] = useState('');
  const [urlSurveyId, setUrlSurveyId] = useState('');

  // Sidebar Open State
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isEmbedded);

  // Sync embedded props
  useEffect(() => {
    if (embeddedMrn) {
      setPatientMrn(embeddedMrn);
    }
    if (embeddedSurveyId) {
      setUrlSurveyId(embeddedSurveyId);
    }
  }, [embeddedMrn, embeddedSurveyId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { isListening, transcript, startListening, stopListening, setTranscript } = useVoiceToText();

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load patient context parameters from URL query params or localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryMrn = params.get('mrn');
      const querySurveyId = params.get('survey_id');
      
      if (queryMrn) {
        setPatientMrn(queryMrn);
        localStorage.setItem('deployed_mrn', queryMrn);
      } else {
        setPatientMrn(localStorage.getItem('deployed_mrn') || '');
      }

      if (querySurveyId) {
        setUrlSurveyId(querySurveyId);
        localStorage.setItem('deployed_survey_id', querySurveyId);
      } else {
        setUrlSurveyId(localStorage.getItem('deployed_survey_id') || '');
      }
    }
  }, []);

  useEffect(() => {
    if (role === 'patient') {
      const storedQuestions = localStorage.getItem('deployed_questions');
      const storedTemplateId = localStorage.getItem('deployed_template_id') || 'Tailored Follow-up';
      if (storedQuestions) {
        try {
          const parsed = JSON.parse(storedQuestions) as any[];
          if (parsed && parsed.length > 0) {
            setCustomQuestions(parsed);
            setCustomStep(-1);
            setMessages([{
              id: '1',
              role: 'assistant',
              content: `Welcome to your Patient Survey Portal! Your clinical team has deployed a customized follow-up survey for you, tailored using clinical intelligence. Would you like to start?`,
              type: 'survey_question',
              data: {
                question: {
                  id: "ready",
                  text: "Ready to start?",
                  type: "selection",
                  options: ["Yes, let's start!", "No, not now"]
                }
              }
            }]);
            return;
          }
        } catch (e) {
          console.error("Error loading custom questions:", e);
        }
      }
    }

    // Default welcome if no custom questions or coordinator
    const welcomeMessage = role === 'coordinator' 
      ? "Hello Research Coordinator. I'm here to help you prepare clinical surveys. You can start by uploading a patient narrative JSON file."
      : "Welcome to Scleroderma Intake Chatbot. I will guide you through your clinical survey today. How are you feeling?";
    
    setMessages([{
      id: '1',
      role: 'assistant',
      content: welcomeMessage
    }]);
  }, [role]);

  const handleSend = async (overrideMessage?: string, context?: any) => {
    const messageText = overrideMessage || input;
    if (!messageText.trim() || isLoading) return;
    
    // If we were listening, stop
    if (isListening) stopListening();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setTranscript('');

    // Dynamic extraction of MRN and Survey ID parameters from the URL directly when user submits message / let's start
    let currentMrn = patientMrn;
    let currentSurveyId = urlSurveyId;
    
    if (role === 'patient' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryMrn = params.get('mrn');
      const querySurveyId = params.get('survey_id');
      if (queryMrn) {
        currentMrn = queryMrn;
        setPatientMrn(queryMrn);
      }
      if (querySurveyId) {
        currentSurveyId = querySurveyId;
        setUrlSurveyId(querySurveyId);
      }
    }

    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      // Determine endpoint: Patient Chat Assistant uses mediated /api/run-session, Coordinator uses /api/chat
      const endpoint = role === 'patient' ? `${apiUrl}/api/run-session` : `${apiUrl}/api/chat`;
      
      const payloadBody = role === 'patient' 
        ? {
            session_id: sessionId || strGenerateSessionId(),
            message: messageText,
            mrn: currentMrn,
            survey_id: currentSurveyId
          }
        : {
            message: messageText,
            role: role,
            session_id: sessionId,
            context: {
              ...context,
              survey_step: surveyStep
            }
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const result = await response.json();
      if (result.status === 'success') {
        if (result.session_id) setSessionId(result.session_id);
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response.message,
          type: result.response.type,
          data: result.response
        };
        
        if (result.response.type === 'survey_question' && result.response.data?.survey_step !== undefined) {
          setSurveyStep(result.response.data.survey_step);
        }

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error('Chat Error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        const combinedNarrative = content.response.narratives.map((n: any) => n.narrative).join('\n\n');
        handleSend("I've uploaded a patient narrative file. Please analyze it.", { narrative: combinedNarrative });
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const startNewChat = () => {
    setSessionId(null);
    setSurveyStep(0);
    setCustomStep(-1);
    
    const welcome = role === 'coordinator' 
      ? "Hello Research Coordinator. I'm here to help you prepare clinical surveys. You can start by uploading a patient narrative JSON file."
      : "Welcome to Scleroderma Intake Chatbot. I will guide you through your clinical survey today. How are you feeling?";

    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: welcome
    }]);
  };

  const strGenerateSessionId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = 'sess-';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const parseBulletedChoices = (text: string): string[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const choices: string[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
      if (bulletMatch) {
        choices.push(bulletMatch[1].trim());
      } else {
        const numberMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
        if (numberMatch) {
          choices.push(numberMatch[1].trim());
        }
      }
    });
    return choices;
  };

  const cleanMessageContent = (text: string, parsedChoices: string[]): string => {
    if (!text || parsedChoices.length === 0) return text;
    const lines = text.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
      if (bulletMatch && parsedChoices.includes(bulletMatch[1].trim())) {
        return false;
      }
      const numberMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
      if (numberMatch && parsedChoices.includes(numberMatch[1].trim())) {
        return false;
      }
      return true;
    });
    return cleanedLines.join('\n').trim();
  };

  const renderAssistantRichTools = (msg: Message) => {
    const data = msg.data;
    if (!data) return null;

    // Traverse across multiple potential nesting paths to load payload and chunks robustly
    const payload = data.payload || data.response?.payload || data.data?.payload;
    const chunks = data.chunks || data.response?.chunks || data.data?.chunks;

    // Aggregate and deduplicate options: Check both the assistant primary outputs[0].payload AND diagnostic messages chunks.
    let actions: any[] = [];
    let questionText = "";
    let isDateTime = false;
    let pickerLabel = "";
    let isDateOnly = true;
    let pickerModeMaxToday = false;

    // 1. Check primary payload first
    if (payload) {
      questionText = payload.question || "";
      actions = payload.actions || [];
    }

    // 2. Fallback to diagnostic message chunks if primary payload didn't load everything (e.g. date time picker is in chunks toolCall)
    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk: any) => {
        const toolCall = chunk.toolCall;
        const chunkPayload = chunk.payload || toolCall?.args?.payload || {};

        if (chunkPayload.question && !questionText) questionText = chunkPayload.question;
        if (chunkPayload.actions && actions.length === 0) actions = actions;

        if (toolCall) {
          const displayName = toolCall.displayName || toolCall.name;
          const args = toolCall.args || {};
          const innerPayload = args.payload || {};

          if (displayName === 'render_survey_options') {
            if (!questionText) questionText = innerPayload.question || args.summary || "";
            if (actions.length === 0) actions = innerPayload.actions || [];
          } else if (displayName === 'render_date_time_picker') {
            isDateTime = true;
            pickerLabel = innerPayload.label || args.summary || "Please select the Survey completion date";
            isDateOnly = innerPayload.picker_mode === 'DATE';
            pickerModeMaxToday = innerPayload.max_date === 'TODAY';
          }
        }
      });
    }

    const elements: React.ReactNode[] = [];

    // Render chips if we have options / actions available
    if (actions && actions.length > 0) {
      // Prevent double rendering of question text if it matches msg.content
      const showQuestionHeader = questionText && msg.content !== questionText;
      
      elements.push(
        <div key="rich-options" className="mt-4 space-y-3 pt-4 border-t border-slate-100 animate-fadeIn">
          {showQuestionHeader && (
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 leading-relaxed">
              <Sparkles size={15} className="text-indigo-600 shrink-0" />
              {questionText}
            </h4>
          )}
          <div className="flex flex-wrap gap-2 pt-1.5">
            {actions.map((act: any, idx: number) => (
              <button
                key={idx}
                onClick={() => handleSend(act.utterance || act.content)}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-indigo-500 rounded-full text-xs font-semibold transition-all shadow-sm flex flex-col items-start active:scale-[0.98]"
                title={act.description}
              >
                <span className="font-bold text-slate-800 text-xs">{act.content}</span>
                {act.description && (
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5 max-w-[200px] truncate">
                    {act.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Render DateTime Picker if assistant triggered the toolCall
    if (isDateTime) {
      elements.push(
        <div key="rich-datepicker" className="mt-4 space-y-3 pt-4 border-t border-slate-100 animate-fadeIn">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 leading-relaxed">
            <Database size={15} className="text-indigo-600 shrink-0" />
            {pickerLabel}
          </h4>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 max-w-md pt-1.5 shadow-sm">
            <input
              type={isDateOnly ? "date" : "datetime-local"}
              id="integrated-picker"
              max={pickerModeMaxToday ? new Date().toISOString().split('T')[0] : undefined}
              className="bg-transparent border border-slate-200 text-xs text-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans shadow-inner flex-grow font-semibold"
            />
            <button
              onClick={() => {
                const inputVal = (document.getElementById("integrated-picker") as HTMLInputElement)?.value;
                if (inputVal) {
                  handleSend(inputVal);
                } else {
                  alert("Please select a valid date first!");
                }
              }}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-[0.98] shrink-0 border border-indigo-500"
            >
              Confirm
            </button>
          </div>
        </div>
      );
    }

    return elements.length > 0 ? elements : null;
  };

  // Check if messages list is actually empty (or has only default starting prompt) - landing page ONLY shown to coordinators
  const isChatEmpty = role === 'coordinator' && messages.length <= 1 && (messages.length === 0 || messages[0].id === '1');

  return (
    <div className={`flex bg-white overflow-hidden text-slate-800 font-sans relative ${
      role === 'patient' 
        ? 'h-screen w-screen' 
        : 'h-[calc(100vh-8rem)] w-full rounded-[2rem] border border-slate-200/60 shadow-2xl mt-4'
    }`}>
      
      {/* Sleek, Minimalist Left Dummy Sidebar (Gemini Style) */}
      {isSidebarOpen && (
        <div className="w-64 bg-[#F0F4F9] border-r border-slate-200/50 flex flex-col justify-between p-4 shrink-0 hidden md:flex z-30 transition-all duration-300">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header spacer (since top header overlays) */}
            <div className="h-14 shrink-0" />
            
            {/* New Session Trigger */}
            <button 
              onClick={startNewChat}
              className="flex items-center gap-2 py-3 px-4 bg-slate-200/55 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all shadow-sm w-fit active:scale-[0.98] mb-8"
            >
              <Plus size={14} className="text-indigo-600" />
              New Session
            </button>

            {/* Recents list */}
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1">
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Recents</h3>
                <div className="space-y-0.5">
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/40 rounded-full text-xs font-semibold text-left truncate transition-colors">
                    <MessageSquare size={13} className="text-slate-400 shrink-0" />
                    Patient Survey Session
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/40 rounded-full text-xs font-semibold text-left truncate transition-colors">
                    <MessageSquare size={13} className="text-slate-400 shrink-0" />
                    Clinical Baseline Audit
                  </button>
                </div>
              </div>
            </div>

            {/* Dummy Actions at bottom */}
            <div className="space-y-1 shrink-0 pt-4 border-t border-slate-200/60 text-slate-500 text-xs font-semibold">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-200/40 rounded-full transition-colors text-left">
                <Settings size={14} /> Settings
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-200/40 rounded-full transition-colors text-left">
                <History size={14} /> Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Layered statically inside a flex-col box to prevent top overflow */}
      <div className="flex-grow flex flex-col bg-transparent overflow-hidden relative z-10 w-full h-full">
        
        {/* Top Header - Fixed/Static Height instead of absolute positioned! */}
        <div className="h-16 border-b border-slate-150 flex items-center justify-between bg-white/90 px-6 shrink-0 relative z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              title="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer select-none">
              <GeminiLogo />
              <span className="text-lg font-bold tracking-tight text-slate-800">Intelligent Survey Assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {role === 'patient' && (patientMrn || urlSurveyId) && (
              <div className="bg-slate-50 border border-slate-150 rounded-full py-1.5 px-3.5 flex items-center gap-2 text-xs font-semibold text-slate-600 shadow-sm select-none">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Patient MRN: <strong className="font-mono text-slate-800">{patientMrn}</strong>
              </div>
            )}
            <button 
              onClick={startNewChat}
              className="w-9 h-9 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              title="New Chat Session"
            >
              <SquarePen size={15} />
            </button>
          </div>
        </div>

        {/* Content Container (Remaining viewport height) */}
        <div className="flex-grow relative overflow-hidden w-full flex flex-col justify-between">
          
          {/* Startup Welcome Landing View (If chat is empty) */}
          {isChatEmpty ? (
            <div className="flex-grow flex flex-col items-center justify-center px-4">
              <h1 className="text-[40px] font-normal text-slate-800 tracking-tight text-center mb-10 select-none animate-fadeIn">
                What can I help with, {role === 'coordinator' ? 'Research Coordinator' : `Patient ${patientMrn || 'Intake'}`}?
              </h1>
              
              {/* Quick Starter Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[700px] w-full px-4 mb-20 animate-fadeIn" style={{ animationDelay: '100ms' }}>
                <button 
                  onClick={() => handleSend("I want to complete my customized health follow-up questionnaire.")}
                  className="p-5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-3xl text-left shadow-sm transition-all text-sm group"
                >
                  <div className="text-clinical-600 font-bold mb-1.5 group-hover:text-indigo-600 flex items-center gap-1.5">
                    <Bot size={16} /> Complete Survey
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">Activate your tailored intake survey checklist deployed by your clinical team.</p>
                </button>
                
                <button 
                  onClick={() => handleSend("What is Scleroderma and how does this questionnaire help my clinical team?")}
                  className="p-5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-3xl text-left shadow-sm transition-all text-sm group"
                >
                  <div className="text-clinical-600 font-bold mb-1.5 group-hover:text-indigo-600 flex items-center gap-1.5">
                    <HelpCircle size={16} /> Patient Information
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">Learn how these tailored Intelligent templates support clinical monitoring and safety.</p>
                </button>
              </div>
            </div>
          ) : (
            /* Active Scrollable Conversation Thread */
            <div className="flex-grow overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar flex flex-col pb-32">
              <div className="max-w-3xl w-full mx-auto flex-grow space-y-8 flex flex-col pt-4">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                    >
                      <div className={`flex gap-4 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border select-none transition-all ${
                          isUser 
                            ? 'bg-slate-50 border-slate-200 text-slate-600' 
                            : 'bg-white border-slate-100 text-slate-800'
                        }`}>
                          {isUser ? <User size={14} /> : <GeminiLogo />}
                        </div>

                        {/* Bubble content */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                            {isUser ? 'You' : 'Intelligent Survey Assistant'}
                          </span>
                          <div className={`p-4 rounded-3xl text-[15px] leading-relaxed shadow-sm prose prose-sm max-w-none ${
                            isUser 
                              ? 'bg-[#E3EBF8] text-slate-800 border border-[#D0DEF2] font-semibold rounded-tr-none' 
                              : 'bg-white text-slate-800 font-normal border border-slate-150 rounded-tl-none font-sans'
                          }`}>
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {(() => {
                                if (role === 'patient' && !isUser && msg.type !== 'survey_question' && msg.type !== 'rich_assistant_tool') {
                                  const parsedChoices = parseBulletedChoices(msg.content);
                                  return cleanMessageContent(msg.content, parsedChoices);
                                }
                                return msg.content;
                              })()}
                            </ReactMarkdown>
                            
                            {/* Render assistant rich widgets (chips/calendars) inline inside bot bubbles */}
                            {renderAssistantRichTools(msg)}

                            {/* Dynamically parsed bullet choices fallback for local chatbot assistant */}
                            {role === 'patient' && !isUser && msg.type !== 'survey_question' && msg.type !== 'rich_assistant_tool' && (
                              (() => {
                                const parsedChoices = parseBulletedChoices(msg.content);
                                if (parsedChoices.length > 0) {
                                  return (
                                    <div className="mt-4 space-y-2 pt-4 border-t border-slate-100 animate-fadeIn">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select an option:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {parsedChoices.map((opt) => (
                                          <button
                                            key={opt}
                                            onClick={() => handleSend(opt)}
                                            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:border-indigo-500 rounded-full text-xs font-semibold transition-all shadow-sm active:scale-[0.98]"
                                          >
                                            {opt}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()
                            )}

                            {/* Legacy Integrated Components fallback */}
                            {msg.type === 'form_recommendation' && msg.data && (
                              <div className="mt-4 space-y-3 pt-4 border-t border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Templates</h4>
                                <div className="grid grid-cols-1 gap-2.5">
                                  {msg.data.recommendations.map((rec: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl hover:border-indigo-400 transition-colors shadow-sm">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 text-xs">{rec.form_name.split('_').map((w:any) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                                          rec.priority === 'High' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>{rec.priority} Priority</span>
                                      </div>
                                      <p className="text-xs text-slate-500 leading-relaxed mb-3">{rec.rationale}</p>
                                      <button 
                                        onClick={() => handleSend(`I've selected the ${rec.form_name} form. Please tailor the questions for this patient.`, { selected_form: rec.form_name, narrative: msg.data.narrative, treatment_plan: msg.data.treatment_plan })}
                                        className="w-full py-2 bg-white border border-slate-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-[0.99]"
                                      >
                                        Select this Form
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {msg.type === 'question_tailoring' && msg.data && (
                              <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verify Tailored Output</h4>
                                  
                                  {msg.data.retained_questions.map((q: any, idx: number) => (
                                    <div key={`ret-${idx}`} className="bg-green-50 border border-green-150 p-3 rounded-xl flex items-start shadow-sm">
                                      <div className="bg-green-100 p-1 rounded-full mr-2.5 mt-0.5 shrink-0">
                                        <Bot size={12} className="text-green-600" />
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-green-800 uppercase tracking-wider mb-0.5">Retain Question</p>
                                        <p className="text-xs text-green-700 font-semibold leading-relaxed">{q.question_text || q}</p>
                                      </div>
                                    </div>
                                  ))}

                                  {msg.data.dropped_questions.map((q: any, idx: number) => (
                                    <div key={`drp-${idx}`} className="bg-red-50 border border-red-150 p-3 rounded-xl shadow-sm">
                                      <div className="flex items-start">
                                        <div className="bg-red-100 p-1 rounded-full mr-2.5 mt-0.5 shrink-0">
                                          <Bot size={12} className="text-red-600" />
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black text-red-800 uppercase tracking-wider mb-0.5">Redact Question</p>
                                          <p className="text-xs text-red-700 font-semibold leading-relaxed">{q.question_text || q}</p>
                                        </div>
                                      </div>
                                      {msg.data.reasons_for_dropping && msg.data.reasons_for_dropping[idx] && (
                                        <div className="mt-2 ml-7 p-2 bg-white rounded-lg border border-red-100 text-[10px] text-red-600 italic leading-relaxed">
                                          Rationale: {msg.data.reasons_for_dropping[idx]}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                
                                <button 
                                  onClick={() => handleSend("I approve these suggestions. Deploy the customized survey.", { deployment_ready: true, final_data: msg.data })}
                                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center active:scale-[0.99] border border-indigo-500"
                                >
                                  Final Approval & Deploy
                                </button>
                              </div>
                            )}

                            {msg.type === 'survey_question' && msg.data && (
                              <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
                                {msg.data.question.type === 'selection' && msg.data.question.options && (
                                  <div className="flex flex-wrap gap-2">
                                    {msg.data.question.options.map((opt: string) => (
                                      <button
                                        key={opt}
                                        onClick={() => handleSend(opt)}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-indigo-500 rounded-full text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-[0.98]"
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {msg.data.question.type === 'text' && (
                                  <div className="text-xs text-slate-500 bg-slate-50 border border-slate-150 p-3.5 rounded-xl italic leading-relaxed">
                                    Please type your response in the input bar below and press Enter (or click Send), or click the microphone to dictate your answer.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start animate-fadeIn">
                    <div className="flex gap-3.5">
                      <div className="h-8 w-8 rounded-full border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <GeminiLogo />
                      </div>
                      <div className="bg-white px-5 py-3.5 rounded-3xl rounded-tl-none border border-slate-150 shadow-sm flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-indigo-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Gemini Style Floating Pill-shaped Input Container */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[750px] px-4 z-20 shrink-0">
            <div className="flex items-center gap-3 bg-white rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.06)] border border-slate-150 px-6 py-3 transition-shadow hover:shadow-[0_4px_30px_rgba(0,0,0,0.10)] focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 bg-white/95 backdrop-blur-sm">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".json"
              />
              {role === 'coordinator' && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
                  title="Attach patient narrative json"
                >
                  <Paperclip size={18} />
                </button>
              )}
              <div className="flex-grow">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Intelligent Survey Assistant"
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] py-1 text-slate-800 placeholder-slate-500 font-sans font-medium"
                />
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={isListening ? stopListening : startListening}
                  className={`p-2 rounded-full transition-all ${
                    isListening 
                      ? 'bg-red-50 text-red-500 animate-pulse' 
                      : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                  title="Voice dictation"
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className={`p-2 rounded-full transition-all ${
                    input.trim() && !isLoading 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/10 active:scale-95' 
                      : 'text-slate-300'
                  }`}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-3.5 text-center font-black tracking-widest uppercase select-none">
              Confidential • HIPAA Sandbox Connected • Powered by Google Gemini & Clinical Research Intelligence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small micro icon helper
const MicrophoneIcon = () => (
  <svg className="h-3 w-3 inline mr-1 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);
