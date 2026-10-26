import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  Edit3,
  History,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getAdminSubmissions,
  type AdminSubmissionRecord,
} from '../../services/adminApi';
import type { FormMetadata } from '../../types/schema';
import { ViewSubmissionModal } from './ViewSubmissionModal';
import { EditSubmissionModal } from './EditSubmissionModal';
import { SubmissionHistoryModal } from './SubmissionHistoryModal';

interface AdminSubmissionsTabProps {
  forms: FormMetadata[];
  initialSubmissionIdToOpen?: number | null;
  onClearInitialSubmissionId?: () => void;
}

export const AdminSubmissionsTab: React.FC<AdminSubmissionsTabProps> = ({
  forms,
  initialSubmissionIdToOpen = null,
  onClearInitialSubmissionId,
}) => {
  const [submissions, setSubmissions] = useState<AdminSubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedFormSlug, setSelectedFormSlug] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleToggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Modals state
  const [viewSubId, setViewSubId] = useState<number | null>(null);
  const [editSubId, setEditSubId] = useState<number | null>(null);
  const [historySubId, setHistorySubId] = useState<number | null>(null);

  // Handle external deep-link from Activity Logs or Overview
  useEffect(() => {
    if (initialSubmissionIdToOpen) {
      setViewSubId(initialSubmissionIdToOpen);
      if (onClearInitialSubmissionId) onClearInitialSubmissionId();
    }
  }, [initialSubmissionIdToOpen, onClearInitialSubmissionId]);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminSubmissions({
        page,
        pageSize,
        search: search.trim(),
        formSlug: selectedFormSlug !== 'all' ? selectedFormSlug : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
      });

      if (res.success && Array.isArray(res.data)) {
        setSubmissions(res.data);
        if (res.pagination) {
          setTotalRecords(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      } else {
        setError(res.error || 'Failed to retrieve form submissions.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching submissions.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, selectedFormSlug, selectedStatus, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedFormSlug('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleEditSuccess = (updatedSubId: number) => {
    setSuccessMessage(`Submission #${updatedSubId} was successfully amended and recorded in the clinical audit trail.`);
    setTimeout(() => setSuccessMessage(null), 6000);
    fetchSubmissions();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Form Submissions Management</span>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
              {totalRecords} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Inspect hospital submissions, review historical clinical values, and execute audited administrative amendments
          </p>
        </div>

        <button
          onClick={() => fetchSubmissions()}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400/80 hover:text-emerald-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchSubmissions()} className="underline hover:text-rose-300">Retry</button>
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
              placeholder="Search by ID, MRNO, Form Name, Submitter..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Form Filter */}
          <div>
            <select
              value={selectedFormSlug}
              onChange={(e) => {
                setSelectedFormSlug(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Forms</option>
              {forms.map((f) => (
                <option key={f.id} value={f.slug}>
                  {f.title || f.name}
                </option>
              ))}
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
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted (Original)</option>
              <option value="Amended">Amended (Administratively Edited)</option>
              <option value="Updated">Updated</option>
            </select>
          </div>

          {/* Date Picker Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              title="Start submission date"
            />
          </div>
        </div>

        {/* Reset Filter Action */}
        {(search || selectedFormSlug !== 'all' || selectedStatus !== 'all' || startDate || endDate) && (
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

      {/* Submissions Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800 select-none">
              <tr>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleToggleSort('id')}
                  title="Sort by Submission ID"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    {sortBy === 'id' && (
                      <span className="text-blue-400 font-mono text-[9px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleToggleSort('formSlug')}
                  title="Sort by Form Name"
                >
                  <div className="flex items-center gap-1">
                    <span>Form Name & Version</span>
                    {sortBy === 'formSlug' && (
                      <span className="text-blue-400 font-mono text-[9px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">Patient Context</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleToggleSort('submittedBy')}
                  title="Sort by Submitter"
                >
                  <div className="flex items-center gap-1">
                    <span>Submitted By</span>
                    {sortBy === 'submittedBy' && (
                      <span className="text-blue-400 font-mono text-[9px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleToggleSort('submittedAt')}
                  title="Sort by Original Submission Date"
                >
                  <div className="flex items-center gap-1">
                    <span>Submitted At</span>
                    {sortBy === 'submittedAt' && (
                      <span className="text-blue-400 font-mono text-[9px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleToggleSort('lastModifiedAt')}
                  title="Sort by Last Modified Date"
                >
                  <div className="flex items-center gap-1">
                    <span>Last Modified</span>
                    {sortBy === 'lastModifiedAt' && (
                      <span className="text-blue-400 font-mono text-[9px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading && submissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading submissions from Oracle Database...</span>
                  </td>
                </tr>
              )}

              {!isLoading && submissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No submissions found</p>
                    <p className="text-xs text-slate-500 mt-1">Try broadening your search or clearing active filters.</p>
                  </td>
                </tr>
              )}

              {submissions.map((sub) => {
                const isAmended = sub.status === 'Amended' || sub.editCount > 0;
                return (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-300 font-semibold">
                      #{sub.id}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-200">
                        {sub.formTitle}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-slate-400 text-[10px]">{sub.formSlug}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          v{sub.formVersion}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {sub.mrno ? (
                        <div>
                          <div className="font-mono text-blue-400 font-medium">MRNO: {sub.mrno}</div>
                          {sub.patientName && (
                            <div className="text-[11px] text-slate-300 font-medium">{sub.patientName}</div>
                          )}
                          {sub.admissionNumber && (
                            <div className="text-[10px] text-slate-500 font-mono">Adm: {sub.admissionNumber}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No patient bound</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{sub.submittedBy || 'Clinician'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      {sub.updatedAt && sub.updatedAt !== sub.submittedAt ? (
                        <div>
                          <span className="text-purple-400 font-medium">{new Date(sub.updatedAt).toLocaleString()}</span>
                          {sub.editCount > 0 && (
                            <span className="text-[10px] text-purple-400/80 block">
                              {sub.editCount} {sub.editCount === 1 ? 'edit' : 'edits'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Unmodified</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isAmended
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isAmended ? 'Amended' : 'Submitted'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      {/* View Button */}
                      <button
                        onClick={() => setViewSubId(sub.id)}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        title="View Complete Submission"
                      >
                        <Eye className="w-3 h-3 text-slate-400" />
                        <span>View</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => setEditSubId(sub.id)}
                        className="inline-flex items-center gap-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                        title="Edit Submitted Values"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      {/* History Button */}
                      {sub.editCount > 0 && (
                        <button
                          onClick={() => setHistorySubId(sub.id)}
                          className="inline-flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                          title="View Administrative Edit History"
                        >
                          <History className="w-3 h-3" />
                          <span>{sub.editCount}</span>
                        </button>
                      )}
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
              Showing <strong className="text-white">{submissions.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="text-white">{Math.min(page * pageSize, totalRecords)}</strong> of{' '}
              <strong className="text-white">{totalRecords}</strong> submissions
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
              <option value={10}>10 per page</option>
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
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

      {/* View Submission Modal */}
      {viewSubId !== null && (
        <ViewSubmissionModal
          submissionId={viewSubId}
          onClose={() => setViewSubId(null)}
          onOpenEdit={(id) => {
            setViewSubId(null);
            setEditSubId(id);
          }}
          onOpenHistory={(id) => {
            setHistorySubId(id);
          }}
        />
      )}

      {/* Edit Submission Modal */}
      {editSubId !== null && (
        <EditSubmissionModal
          submissionId={editSubId}
          onClose={() => setEditSubId(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Submission History Modal */}
      {historySubId !== null && (
        <SubmissionHistoryModal
          submissionId={historySubId}
          onClose={() => setHistorySubId(null)}
        />
      )}
    </div>
  );
};
