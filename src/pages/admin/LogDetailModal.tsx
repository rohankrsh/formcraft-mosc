import React from 'react';
import {
  X,
  Activity,
  User,
  FileText,
} from 'lucide-react';
import { type AdminActivityLog } from '../../services/adminApi';

interface LogDetailModalProps {
  log: AdminActivityLog;
  onClose: () => void;
  onNavigateToSubmission?: (submissionId: number) => void;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({
  log,
  onClose,
  onNavigateToSubmission,
}) => {
  const isSubmission = log.entityType === 'SUBMISSION' && log.entityId && !isNaN(Number(log.entityId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Activity Log Entry</h3>
                <span className="font-mono text-xs text-slate-400">#{log.logId}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    log.status === 'SUCCESS'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {log.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{log.eventType}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Timestamp</span>
              <span className="font-mono text-slate-300 font-medium">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Actor</span>
              <span className="text-white font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>{log.actorName || 'System'}</span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {log.actorType}
                </span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">IP Address</span>
              <span className="font-mono text-slate-400">{log.ipAddress || '127.0.0.1'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Target Entity</span>
              <span className="font-mono text-slate-300 font-medium">
                {log.entityType || 'SYSTEM'} {log.entityId ? `(#${log.entityId})` : ''}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Description</span>
              <span className="text-slate-200 font-medium">{log.description}</span>
            </div>
          </div>

          {/* Details JSON */}
          {log.details && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Audited Event Context / Metadata
              </span>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Quick Action for Submissions */}
          {isSubmission && onNavigateToSubmission && (
            <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-between">
              <div>
                <div className="font-semibold text-blue-300">Linked Submission Available</div>
                <p className="text-slate-400 text-[11px]">Inspect or view the full clinical record for Submission #{log.entityId}.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSubmission(Number(log.entityId));
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open Submission</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">FORMCRAFT_ACTIVITY_LOGS • Immutable</span>
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
