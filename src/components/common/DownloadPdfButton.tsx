import React, { useState } from 'react';
import { FileDown, Loader2, Check } from 'lucide-react';
import { downloadFormAsPdf } from '../../utils/exportPdf';

interface DownloadPdfButtonProps {
  targetElementId?: string;
  formTitle: string;
  recordId?: string | number | null;
  className?: string;
  variant?: 'floating' | 'inline' | 'header';
}

export const DownloadPdfButton: React.FC<DownloadPdfButtonProps> = ({
  targetElementId = 'form-printable-container',
  formTitle,
  recordId,
  className = '',
  variant = 'header',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isGenerating) return;
    setIsGenerating(true);

    try {
      await downloadFormAsPdf(targetElementId, {
        formTitle,
        recordId,
        fileName: formTitle,
      });
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 2500);
    } catch (err) {
      console.error('[DownloadPdfButton] Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (variant === 'floating') {
    return (
      <div className={`fixed top-20 left-6 z-40 no-print ${className}`}>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isGenerating}
          title="Download form and current data as PDF"
          className="group flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 shadow-xl backdrop-blur-md transition-all active:scale-95 text-xs font-semibold cursor-pointer ring-1 ring-black/5 dark:ring-white/10 hover:shadow-2xl"
        >
          <div className="w-6 h-6 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-transform group-hover:scale-110">
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDownloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
          </div>
          <span>
            {isGenerating ? 'Generating PDF...' : isDownloaded ? 'Downloaded!' : 'Download PDF'}
          </span>
        </button>
      </div>
    );
  }

  // Header / Top-left corner variant
  return (
    <div className={`no-print ${className}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        title="Download form and current data as PDF"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 dark:text-rose-400" />
        ) : isDownloaded ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <FileDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
        )}
        <span>
          {isGenerating ? 'Generating PDF...' : isDownloaded ? 'Downloaded!' : 'Download PDF'}
        </span>
      </button>
    </div>
  );
};
