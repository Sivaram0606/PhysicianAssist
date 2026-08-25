import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface NarrativeCardProps {
  narrative: string;
}

export const NarrativeCard: React.FC<NarrativeCardProps> = ({ narrative }) => {
  // Memoize the parsed and sanitized HTML to prevent unnecessary re-renders
  const htmlContent = useMemo(() => {
    if (!narrative) return '<p class="text-slate-400 italic">No narrative content provided.</p>';
    
    try {
      // Parse markdown to HTML
      const rawHtml = marked.parse(narrative) as string;
      // Sanitize HTML to prevent XSS, especially important for clinical/external data
      return DOMPurify.sanitize(rawHtml);
    } catch (error) {
      console.error("Error parsing markdown:", error);
      return '<p class="text-red-500">Error rendering content.</p>';
    }
  }, [narrative]);

  return (
    <div 
      className="prose prose-slate prose-sm sm:prose-base max-w-none prose-headings:text-clinical-900 prose-a:text-clinical-500 prose-table:border-collapse prose-th:bg-slate-100 prose-th:p-2 prose-th:border prose-th:border-slate-300 prose-td:p-2 prose-td:border prose-td:border-slate-200"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
