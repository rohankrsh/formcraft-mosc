import React from 'react';
import { X, Calendar, User, Hash, Printer, ShieldAlert } from 'lucide-react';
import type { FormDefinition, FormField, FormSubmissionRecord } from '../types/schema';
import { PainFaceIcon, getPainScaleItem } from '../components/painAssessment/PainScaleData';

interface HistoricalSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: FormSubmissionRecord | null;
  form: FormDefinition;
}

export const HistoricalSubmissionModal: React.FC<HistoricalSubmissionModalProps> = ({
  isOpen,
  onClose,
  submission,
  form,
}) => {
  if (!isOpen || !submission) return null;

  const data = submission.formData || {};
  const fieldsList: FormField[] = Array.isArray(form.fields)
    ? form.fields
    : Object.values(form.fields || {});

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  const renderFieldValue = (field: FormField) => {
    const val = data[field.name] !== undefined ? data[field.name] : data[field.id];
    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-400 italic">None provided</span>;
    }

    if (field.type === 'checkbox') {
      if (Array.isArray(val)) {
        return val.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {val.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium"
              >
                {String(item)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400 italic">None selected</span>
        );
      }
      return val ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Yes / Checked</span>
      ) : (
        <span className="text-slate-400">No / Unchecked</span>
      );
    }

    if (field.type === 'table') {
      const rows = Array.isArray(val) ? val : [];
      const cols = field.tableConfig?.columns || [];
      if (rows.length === 0) {
        return <span className="text-slate-400 italic">No table rows recorded</span>;
      }
      return (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl mt-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                {cols.map((col) => (
                  <th key={col.id} className="py-2 px-3">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                  {cols.map((col) => (
                    <td key={col.id} className="py-2 px-3 text-slate-800 dark:text-slate-200">
                      {String(row[col.id] || row[col.key || ''] || '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (field.type === 'pain_assessment') {
      const pVal = typeof val === 'object' && val !== null ? val : {};
      const score = typeof pVal.score === 'number' ? pVal.score : null;
      const scaleItem = score !== null ? getPainScaleItem(score) : null;
      const painPresent = pVal.painPresent === 'yes' ? 'Yes' : pVal.painPresent === 'no' ? 'No' : '—';
      const location = pVal.location ? String(pVal.location).trim() : '—';

      return (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-750">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Pain Present?</span>
              <span className={`font-bold ${painPresent === 'Yes' ? 'text-rose-600 dark:text-rose-400' : painPresent === 'No' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                {painPresent}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-750">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Location</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={location}>
                {location}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-750">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Score</span>
              {score !== null ? (
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <PainFaceIcon score={score} className="w-4 h-4 shrink-0" />
                  <span>{score} / 10 &bull; {scaleItem?.label}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic">Not recorded</span>
              )}
            </div>
          </div>
          {scaleItem && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1">
              Assessment note: {scaleItem.description}
            </p>
          )}
        </div>
      );
    }

    return <span className="font-medium text-slate-900 dark:text-slate-100">{String(val)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Read-Only Historical View
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                <Hash className="w-3 h-3 text-slate-400" />
                Record #{String(submission.recordId || submission.id)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                {submission.status || 'Submitted'}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {form.title}
            </h2>

            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Submitted: <strong>{formatTimestamp(submission.submittedAt)}</strong></span>
              </span>
              {submission.submittedBy && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Clinician: <strong>{submission.submittedBy}</strong></span>
                </span>
              )}
              {submission.mrno && (
                <span>MRNO: <strong className="font-mono">{submission.mrno}</strong></span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical Safe Banner */}
        <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            You are viewing an immutable past record. Editing is disabled. Closing this window returns to your active new form.
          </span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {form.layout && form.layout.length > 0 ? (
            form.layout.map((sec) => (
              <div
                key={sec.id}
                className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-850/40 border border-slate-200/80 dark:border-slate-800 space-y-3"
              >
                {sec.title && (
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    {sec.title}
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {sec.rows?.flatMap((r) => r.columns || []).flatMap((col) => col.fieldIds || []).map((fId) => {
                    const field = form.fields[fId];
                    if (!field || field.type === 'heading' || field.type === 'divider') return null;
                    return (
                      <div
                        key={field.id}
                        className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 ${
                          field.type === 'table' || field.type === 'pain_assessment' ? 'md:col-span-2' : ''
                        }`}
                      >
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                          {field.label || field.name}
                        </span>
                        <div>{renderFieldValue(field)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {fieldsList.map((field) => {
                if (field.type === 'heading' || field.type === 'divider') return null;
                const isFullWidth = field.type === 'table' || field.type === 'pain_assessment';
                return (
                  <div
                    key={field.id}
                    className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 ${
                      isFullWidth ? 'md:col-span-2' : ''
                    }`}
                  >
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                      {field.label || field.name}
                    </span>
                    <div>{renderFieldValue(field)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            FormCraft Clinical Runtime Archive
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Record</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition"
            >
              Back to Active Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
