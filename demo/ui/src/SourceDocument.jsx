import { useRef, useEffect } from 'react';
import { FileText, CheckSquare, Activity, ExternalLink } from 'lucide-react';

const SourceDocument = ({ metadata, patientData, highlightedField, formData, onInputChange, prefillEnabled, onPrefillToggle }) => {
    const fieldRefs = useRef({});

    useEffect(() => {
        if (highlightedField && fieldRefs.current[highlightedField]) {
            fieldRefs.current[highlightedField].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedField]);

    const sections = metadata.reduce((acc, field) => {
        if (field.field_name === 'prefill_data') return acc;
        if (field.section_header) {
            acc.push({ title: field.section_header, fields: [] });
        }
        if (acc.length === 0) {
            acc.push({ title: "General", fields: [] });
        }
        acc[acc.length - 1].fields.push(field);
        return acc;
    }, []);

    const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#26A69A]/50 focus:ring-1 focus:ring-[#26A69A]/30 outline-none transition-all";

    const renderFieldInput = (field) => {
        const value = formData[field.field_name] || '';

        switch (field.field_type) {
            case 'textarea':
            case 'notes':
                return (
                    <textarea
                        className={`${inputClasses} min-h-[100px] resize-none`}
                        value={value}
                        onChange={(e) => onInputChange(field.field_name, e.target.value)}
                        placeholder="Clinical observations..."
                    />
                );
            case 'dropdown':
                const options = field.select_choices_or_calculations.split('|').map(opt => {
                    const [val, label] = opt.split(',').map(s => s.trim());
                    return { val, label: label || val };
                });
                return (
                    <select
                        className={inputClasses}
                        value={value}
                        onChange={(e) => onInputChange(field.field_name, e.target.value)}
                    >
                        <option value="" className="bg-[#0F213A]">Select Option</option>
                        {options.map(opt => (
                            <option key={opt.val} value={opt.val} className="bg-[#0F213A]">{opt.label}</option>
                        ))}
                    </select>
                );
            case 'radio':
            case 'checkbox':
                const choices = field.select_choices_or_calculations.split('|').map(opt => {
                    const [val, label] = opt.split(',').map(s => s.trim());
                    return { val, label: label || val };
                });
                const isCheck = field.field_type === 'checkbox';
                const currentValues = isCheck ? (Array.isArray(value) ? value : (value ? [value] : [])) : [value];

                return (
                    <div className="grid grid-cols-1 gap-2">
                        {choices.map(opt => {
                            const active = currentValues.includes(opt.val);
                            return (
                                <label key={opt.val} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${active ? 'bg-[#26A69A]/20 border-[#26A69A]/50 text-white' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}>
                                    <div className={`w-4 h-4 flex items-center justify-center border transition-all ${isCheck ? 'rounded' : 'rounded-full'} ${active ? 'bg-[#26A69A] border-[#26A69A]' : 'border-slate-600'}`}>
                                        {active && (isCheck ? <CheckSquare size={12} className="text-white" /> : <div className="w-1.5 h-1.5 bg-white rounded-full" />)}
                                    </div>
                                    <input
                                        type={isCheck ? "checkbox" : "radio"}
                                        className="hidden"
                                        checked={active}
                                        onChange={() => {
                                            if (isCheck) {
                                                const next = active ? currentValues.filter(v => v !== opt.val) : [...currentValues, opt.val];
                                                onInputChange(field.field_name, next);
                                            } else {
                                                onInputChange(field.field_name, opt.val);
                                            }
                                        }}
                                    />
                                    <span className="text-xs font-medium">{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>
                );
            default:
                return (
                    <input
                        type="text"
                        className={inputClasses}
                        value={value}
                        onChange={(e) => onInputChange(field.field_name, e.target.value)}
                        placeholder={field.field_note || "Enter data..."}
                    />
                );
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0F213A]/60 backdrop-blur-md border border-[#26A69A]/20 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header Area */}
            <div className="flex-none p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#26A69A]" />
                        Patient Questionnarire
                    </h2>

                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Source Node</span>
                </div>

                {/* Pre-fill Control Area (Teal instead of Blue) */}
                <div className="bg-[#26A69A]/10 border border-[#26A69A]/20 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-tight">Auto-Populate Questionnaire</p>
                        <p className="text-[10px] text-[#26A69A] font-bold">Populate source fields</p>
                    </div>
                    <div className="flex bg-[#061226] p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => onPrefillToggle(true)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${prefillEnabled ? 'bg-[#26A69A] text-white shadow-lg' : 'text-slate-500'}`}
                        >
                            On
                        </button>
                        <button
                            onClick={() => onPrefillToggle(false)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!prefillEnabled ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                        >
                            Off
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {sections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-6">
                        <h3 className="text-[10px] font-black text-[#26A69A] uppercase tracking-[0.3em] flex items-center gap-4">
                            {section.title}
                            <div className="h-px bg-[#26A69A]/20 flex-1"></div>
                        </h3>

                        <div className="space-y-8">
                            {section.fields.map((field) => (
                                <div
                                    key={field.field_name}
                                    ref={el => fieldRefs.current[field.field_name] = el}
                                    id={`field-${field.field_name}`}
                                    className={`transition-all duration-700 p-4 rounded-2xl border-2 ${highlightedField === field.field_name
                                        ? 'bg-[#26A69A]/20 border-[#26A69A] shadow-[0_0_20px_rgba(38,166,154,0.2)] scale-[1.02]'
                                        : 'bg-transparent border-transparent'
                                        }`}
                                >
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        {field.field_label}
                                    </label>
                                    {renderFieldInput(field)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* --- THE REFERENCE LINK FOOTER (PINNED AT BOTTOM) --- */}
            <div className="flex-none p-4 bg-[#061226]/60 border-t border-white/5 backdrop-blur-md">
                <a 
                    href="https://www.uclahealth.org/sites/default/files/documents/new-patient-questionnaire.pdf?f=6969d366" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#26A69A]/40 group transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#26A69A]/10 rounded-lg group-hover:bg-[#26A69A]/20 transition-colors">
                            <FileText size={14} className="text-[#26A69A]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Standard Reference</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">UCLA Health Standards</span>
                        </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-600 group-hover:text-[#26A69A] transition-colors" />
                </a>
            </div>

        </div>
    );
};

export default SourceDocument;