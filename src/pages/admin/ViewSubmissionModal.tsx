import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  User,
  Calendar,
  Clock,
  History,
  Edit3,
  AlertCircle,
  Layers,
} from 'lucide-react';
import {
  getAdminSubmissionDetail,
  type AdminSubmissionRecord,
} from '../../services/adminApi';

interface ViewSubmissionModalProps {
  submissionId: number;
  onClose: () => void;
  onOpenEdit?: (submissionId: number) => void;
  onOpenHistory?: (submissionId: number) => void;
}

export const ViewSubmissionModal: React.FC<ViewSubmissionModalProps> = ({
  submissionId,
  onClose,
  onOpenEdit,
  onOpenHistory,
}) => {
  const [submission, setSubmission] = useState<AdminSubmissionRecord | null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAdminSubmissionDetail(submissionId);
        if (!isMounted) return;
        if (res.success && res.submission) {
          setSubmission(res.submission);
          setSchema(res.schema);
        } else {
          setError(res.error || 'Failed to retrieve submission details.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Error loading clinical submission.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  const formData = submission?.formData || {};
  const patient = submission?.patient;

  const renderFieldValue = (field: any, val: any) => {
    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-500 italic text-xs">Not recorded</span>;
    }

    if (field?.type === 'checkbox') {
      if (Array.isArray(val)) {
        return (
          <div className="flex flex-wrap gap-1">
            {val.map((item, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono">
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <span className="font-medium text-slate-200">{val ? 'Yes / Checked' : 'No / Unchecked'}</span>;
    }

    if (field?.type === 'table') {
      if (!Array.isArray(val) || val.length === 0) {
        return <span className="text-slate-500 italic text-xs">No rows recorded</span>;
      }
      const columns = field.tableConfig?.columns || [];
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 mt-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
              <tr>
                <th className="py-2 px-3">#</th>
                {columns.map((c: any) => (
                  <th key={c.id || c.key} className="py-2 px-3">{c.label || c.key}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {val.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{rIdx + 1}</td>
                  {columns.map((c: any) => {
                    const colKey = c.key || c.id;
                    const cellVal = row[colKey];
                    return (
                      <td key={colKey} className="py-2 px-3 text-slate-300 font-mono text-xs">
                        {cellVal !== undefined && cellVal !== null ? String(cellVal) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (typeof val === 'object') {
      return (
        <pre className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800 overflow-x-auto max-h-40">
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }

    return <span className="text-slate-200 font-medium text-xs break-words">{String(val)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {submission?.formTitle || 'Submission Details'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[10px] font-semibold">
                  v{submission?.formVersion || 1}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    submission?.status === 'Amended'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {submission?.status || 'Submitted'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="font-mono text-slate-300">Submission #{submissionId}</span>
                <span>•</span>
                <span>Mode: <strong className="font-mono text-slate-300">{submission?.submissionMode || 'NEW_RECORD'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {submission && onOpenHistory && submission.editCount > 0 && (
              <button
                onClick={() => onOpenHistory(submission.id)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="View Administrative Edit History"
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({submission.editCount})</span>
              </button>
            )}

            {submission && onOpenEdit && (
              <button
                onClick={() => onOpenEdit(submission.id)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-600/30"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Submission</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading submission data and clinical version schema...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && submission && (
            <>
              {/* Patient Banner if Patient Info Available */}
              {patient && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Patient Name</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-400" />
                      {patient.patient_name || patient.patientName || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">MRNO</span>
                    <span className="font-mono text-slate-300 font-semibold">{submission.mrno || patient.mrno || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission / Bed</span>
                    <span className="font-mono text-slate-300">
                      {patient.admission_number || submission.admissionNumber || 'N/A'} • Bed {patient.bed_no || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Doctor / Consultant</span>
                    <span className="text-slate-300">{patient.consultant || 'N/A'}</span>
                  </div>
                </div>
              )}

              {/* Submission Attribution & Metadata Strip */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Submitted By: <strong className="text-white font-medium">{submission.submittedBy || 'Clinician'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Originally Submitted: <strong className="text-white font-mono">{new Date(submission.submittedAt).toLocaleString()}</strong></span>
                </div>
                {submission.updatedAt && submission.updatedAt !== submission.submittedAt && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Last Amended: <strong className="font-mono">{new Date(submission.updatedAt).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>

              {/* Clinical Form Data Rendered via Saved Version Schema */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Recorded Clinical Data (Version {submission.formVersion})</span>
                </div>

                {schema?.layout && Array.isArray(schema.layout) ? (
                  schema.layout.map((section: any, sIdx: number) => {
                    const fields = schema.fields || {};
                    return (
                      <div key={section.id || sIdx} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                        {section.title && (
                          <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              {section.title}
                            </h4>
                            {section.description && (
                              <span className="text-[11px] text-slate-400">{section.description}</span>
                            )}
                          </div>
                        )}

                        <div className="p-4 space-y-4">
                          {(section.rows || []).map((row: any, rIdx: number) => (
                            <div key={row.id || rIdx} className="grid grid-cols-12 gap-4">
                              {(row.columns || []).map((col: any, cIdx: number) => {
                                const colWidth = col.width || 12;
                                return (
                                  <div
                                    key={col.id || cIdx}
                                    className={`space-y-3 col-span-12 sm:col-span-${colWidth}`}
                                    style={{ gridColumn: `span ${colWidth} / span ${colWidth}` }}
                                  >
                                    {(col.fieldIds || []).map((fId: string) => {
                                      const field = fields[fId] || { id: fId, label: fId, type: 'text' };
                                      const val = formData[fId];
                                      return (
                                        <div key={fId} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 space-y-1">
                                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                            <span>{field.label || field.name || fId}</span>
                                            <span className="text-[10px] font-mono text-slate-600">{field.type || 'text'}</span>
                                          </div>
                                          <div className="pt-0.5">
                                            {renderFieldValue(field, val)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Fallback flat grid if layout missing
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(formData).map(([key, val]) => (
                      <div key={key} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 block font-mono">
                          {key}
                        </span>
                        <div>{renderFieldValue({ type: typeof val === 'object' ? 'object' : 'text' }, val)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            FormCraft Clinical Runtime • Saved Historical Snapshot
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
