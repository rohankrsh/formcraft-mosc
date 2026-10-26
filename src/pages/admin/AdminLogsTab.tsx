import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Eye,
  User,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getAdminLogs,
  getAdminLogEventTypes,
  type AdminActivityLog,
} from '../../services/adminApi';
import { LogDetailModal } from './LogDetailModal';

interface AdminLogsTabProps {
  onNavigateToSubmission?: (submissionId: number) => void;
}

export const AdminLogsTab: React.FC<AdminLogsTabProps> = ({ onNavigateToSubmission }) => {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedActorType, setSelectedActorType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AdminActivityLog | null>(null);

  // Load distinct event types on mount
  useEffect(() => {
    getAdminLogEventTypes()
      .then((res) => {
        if (res.success && Array.isArray(res.eventTypes)) {
          setEventTypes(res.eventTypes);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminLogs({
        page,
        pageSize,
        search: search.trim(),
        eventType: selectedEventType !== 'all' ? selectedEventType : undefined,
        actorType: selectedActorType !== 'all' ? selectedActorType : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res.success && Array.isArray(res.logs)) {
        setLogs(res.logs);
        if (res.pagination) {
          setTotalRecords(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      } else {
        setError(res.error || 'Failed to retrieve system activity logs.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching activity logs.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, selectedEventType, selectedActorType, selectedStatus, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedEventType('all');
    setSelectedActorType('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getEventTypeBadgeColor = (eventType: string) => {
    const et = eventType.toUpperCase();
    if (et.includes('LOGIN_SUCCESS')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (et.includes('FAILED') || et.includes('BLOCKED') || et.includes('UNAUTHORIZED') || et.includes('RATE_LIMITED'))
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (et.includes('SUBMISSION_EDITED')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (et.includes('SUBMISSION')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (et.includes('PUBLISHED')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    if (et.includes('DRAFT') || et.includes('FORM_CREATED')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>System-Wide Activity & Audit Logs</span>
            <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
              {totalRecords} Events
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time audit trail capturing form design, publication snapshotting, submissions, and administrative authentication
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchLogs()} className="underline hover:text-rose-300">Retry</button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Text Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by description, actor, entity ID, event..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Event Type Filter */}
          <div>
            <select
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Type Filter */}
          <div>
            <select
              value={selectedActorType}
              onChange={(e) => {
                setSelectedActorType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Actor Types</option>
              <option value="admin">Administrator</option>
              <option value="user">User / Clinician</option>
              <option value="system">System</option>
              <option value="anonymous">Anonymous / Unauthenticated</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Action */}
        {(search || selectedEventType !== 'all' || selectedActorType !== 'all' || selectedStatus !== 'all' || startDate || endDate) && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Activity Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Outcome</th>
                <th className="py-3 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading system activity logs...</span>
                  </td>
                </tr>
              )}

              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No activity logs found</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting the search filters.</p>
                  </td>
                </tr>
              )}

              {logs.map((log) => {
                const badgeColor = getEventTypeBadgeColor(log.eventType);
                return (
                  <tr
                    key={log.logId}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-3 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${badgeColor}`}>
                        {log.eventType}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.actorName || 'System'}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {log.actorType}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono text-slate-400 text-[11px]">
                        {log.entityType || 'SYSTEM'} {log.entityId ? `#${log.entityId}` : ''}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-slate-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-white">{logs.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="text-white">{Math.min(page * pageSize, totalRecords)}</strong> of{' '}
              <strong className="text-white">{totalRecords}</strong> events
            </span>
            <span>•</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-300"
            >
              <option value={15}>15 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onNavigateToSubmission={onNavigateToSubmission}
        />
      )}
    </div>
  );
};
