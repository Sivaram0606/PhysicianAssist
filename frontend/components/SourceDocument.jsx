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

    // Updated input styling matching light-themed questionnaire generation layout
    const inputClasses = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-clinical-400 focus:ring-1 focus:ring-clinical-400/30 outline-none transition-all";

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
                        <option value="">Select Option</option>
                        {options.map(opt => (
                            <option key={opt.val} value={opt.val}>{opt.label}</option>
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
                                <label key={opt.val} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${active ? 'bg-clinical-50 border-clinical-200 text-clinical-800' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
                                    <div className={`w-4 h-4 flex items-center justify-center border transition-all ${isCheck ? 'rounded' : 'rounded-full'} ${active ? 'bg-clinical-600 border-clinical-600' : 'border-slate-300'}`}>
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
        <div className="h-full flex flex-col bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            {/* Header Area */}
            <div className="flex-none p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <FileText className="w-4 h-4 text-clinical-600" />
                        Patient Questionnaire
                    </h2>

                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Source Node</span>
                </div>

                {/* Pre-fill Control Area (Tailored to match Questionnaire view) */}
                <div className="bg-clinical-50/50 border border-clinical-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">Auto-Populate Questionnaire</p>
                        <p className="text-[10px] text-clinical-600 font-bold">Populate source fields</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => onPrefillToggle(true)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${prefillEnabled ? 'bg-clinical-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            On
                        </button>
                        <button
                            onClick={() => onPrefillToggle(false)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!prefillEnabled ? 'bg-slate-300 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
                        <h3 className="text-[10px] font-black text-clinical-600 uppercase tracking-[0.3em] flex items-center gap-4">
                            {section.title}
                            <div className="h-px bg-clinical-100 flex-1"></div>
                        </h3>

                        <div className="space-y-8">
                            {section.fields.map((field) => (
                                <div
                                    key={field.field_name}
                                    ref={el => fieldRefs.current[field.field_name] = el}
                                    id={`field-${field.field_name}`}
                                    className={`transition-all duration-700 p-4 rounded-2xl border-2 ${highlightedField === field.field_name
                                        ? 'bg-clinical-50/50 border-clinical-400 shadow-[0_0_15px_rgba(2,132,199,0.1)] scale-[1.01]'
                                        : 'bg-transparent border-transparent'
                                        }`}
                                >
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
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
            <div className="flex-none p-4 bg-slate-50 border-t border-slate-100">
                <a 
                    href="https://www.uclahealth.org/sites/default/files/documents/new-patient-questionnaire.pdf?f=6969d366" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-clinical-300 hover:bg-slate-50/50 shadow-sm group transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-clinical-50 rounded-lg group-hover:bg-clinical-100 transition-colors">
                            <FileText size={14} className="text-clinical-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Standard Reference</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">UCLA Health Standards</span>
                        </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-400 group-hover:text-clinical-600 transition-colors" />
                </a>
            </div>

        </div>
    );
};

export default SourceDocument;