import React, { useEffect, useState } from 'react';
import {
  X,
  History,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getAdminSubmissionHistory,
  type SubmissionAuditHistoryItem,
} from '../../services/adminApi';

interface SubmissionHistoryModalProps {
  submissionId: number;
  onClose: () => void;
}

export const SubmissionHistoryModal: React.FC<SubmissionHistoryModalProps> = ({
  submissionId,
  onClose,
}) => {
  const [history, setHistory] = useState<SubmissionAuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAdminSubmissionHistory(submissionId);
        if (!isMounted) return;
        if (res.success && Array.isArray(res.history)) {
          setHistory(res.history);
        } else {
          setError(res.error || 'Failed to retrieve submission edit history.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Error loading audit history.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Administrative Edit Audit Trail</span>
                <span className="text-xs font-mono font-normal text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                  Submission #{submissionId}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Full chronological history of all administrative modifications and clinical justifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading && (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading audit trail records...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && history.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No Administrative Edits Recorded</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                This submission retains its original submitted values exactly as entered by the submitting clinician.
              </p>
            </div>
          )}

          {!isLoading && !error && history.length > 0 && (
            <div className="space-y-4 relative before:absolute before:top-3 before:bottom-3 before:left-5 before:w-0.5 before:bg-slate-800">
              {history.map((item, idx) => (
                <div key={item.id || idx} className="relative pl-12 space-y-2">
                  {/* Timeline dot */}
                  <div className="absolute left-3.5 top-2 w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-slate-900 shadow-md shadow-purple-500/40" />

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px] font-bold uppercase">
                          {item.adminName?.charAt(0) || 'A'}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-white">
                            {item.adminName || 'Administrator'}
                          </div>
                          {item.adminEmail && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.adminEmail}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Clinical Justification / Reason
                      </span>
                      <p className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                        "{item.reason}"
                      </p>
                    </div>

                    {/* Changed Fields Diff */}
                    {item.diff && Object.keys(item.diff).length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Modified Fields ({Object.keys(item.diff).length})
                        </span>
                        <div className="space-y-1.5">
                          {Object.entries(item.diff).map(([fKey, change]: [string, any]) => (
                            <div
                              key={fKey}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/60 text-xs font-mono grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                            >
                              <div className="sm:col-span-4 text-purple-400 font-semibold truncate" title={fKey}>
                                {fKey}
                              </div>
                              <div className="sm:col-span-8 flex items-center gap-2 text-[11px]">
                                <span className="text-rose-400/80 line-through bg-rose-500/10 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={String(change.from)}>
                                  {change.from !== null && change.from !== undefined ? String(change.from) : 'empty'}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold truncate max-w-[180px]" title={String(change.to)}>
                                  {change.to !== null && change.to !== undefined ? String(change.to) : 'empty'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            Immutable Audit Trail • Record Retention Compliant
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
