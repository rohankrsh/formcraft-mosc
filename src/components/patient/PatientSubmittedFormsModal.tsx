import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  User,
  Hash,
  Printer,
  ShieldAlert,
  ArrowLeft,
  Eye,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  Bed,
  Loader2,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  fetchPatientSubmittedForms,
  fetchPatientSubmissionDetail,
  type Patient,
  type PatientSubmissionSummary,
} from '../../services/patientApi';
import type { FormDefinition, FormField } from '../../types/schema';
import { DownloadPdfButton } from '../common/DownloadPdfButton';
import { PainFaceIcon, getPainScaleItem } from '../painAssessment/PainScaleData';

interface PatientSubmittedFormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  departmentContext?: string;
  serviceCenterContext?: string;
}

/**
 * Formats ISO timestamp into readable Date: "15-Oct-2026"
 */
function formatSubmissionDate(isoStr?: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return isoStr;
  }
}

/**
 * Formats ISO timestamp into readable Time: "10:30 AM"
 */
function formatSubmissionTime(isoStr?: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

export const PatientSubmittedFormsModal: React.FC<PatientSubmittedFormsModalProps> = ({
  isOpen,
  onClose,
  patient,
  departmentContext,
  serviceCenterContext,
}) => {
  // Navigation mode: 'list' = submission records list, 'detail' = viewing selected form
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // Window display mode for historical viewer: 'normal' | 'minimized' | 'maximized'
  const [windowMode, setWindowMode] = useState<'normal' | 'minimized' | 'maximized'>('normal');

  // List state
  const [submissions, setSubmissions] = useState<PatientSubmissionSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [detailData, setDetailData] = useState<{
    submission: PatientSubmissionSummary & { mrno: string; formData: Record<string, any> };
    form: FormDefinition;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Load submissions list for the patient
  const loadSubmissions = useCallback(async () => {
    if (!patient?.mrno) return;
    setIsLoadingList(true);
    setListError(null);

    try {
      const res = await fetchPatientSubmittedForms(patient.mrno, {
        department: departmentContext || undefined,
        serviceCenter: serviceCenterContext || undefined,
      });

      if (res.success) {
        setSubmissions(res.submissions || []);
      } else {
        throw new Error(res.error || 'Failed to fetch submitted forms.');
      }
    } catch (err: any) {
      console.error('[PatientSubmittedFormsModal] Error loading submissions:', err);
      setListError(err.message || 'Unable to retrieve patient submission history.');
      setSubmissions([]);
    } finally {
      setIsLoadingList(false);
    }
  }, [patient?.mrno, departmentContext, serviceCenterContext]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen && patient?.mrno) {
      setViewMode('list');
      setWindowMode('normal');
      setDetailData(null);
      setDetailError(null);
      loadSubmissions();
    }
  }, [isOpen, patient?.mrno, loadSubmissions]);

  // Open specific historical submission in read-only mode
  const handleOpenForm = async (sub: PatientSubmissionSummary) => {
    if (!patient?.mrno) return;
    setViewMode('detail');
    setWindowMode('normal');
    setIsLoadingDetail(true);
    setDetailError(null);

    try {
      const res = await fetchPatientSubmissionDetail(patient.mrno, sub.id);
      if (res.success && res.submission && res.form) {
        setDetailData({
          submission: res.submission,
          form: res.form,
        });
      } else {
        throw new Error(res.error || 'Failed to load historical submission details.');
      }
    } catch (err: any) {
      console.error('[PatientSubmittedFormsModal] Error loading submission detail:', err);
      setDetailError(err.message || 'Unable to load historical submission.');
      setDetailData(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Back to list view
  const handleBackToList = () => {
    setViewMode('list');
    setWindowMode('normal');
    setDetailData(null);
    setDetailError(null);
  };

  // Close modal completely and reset window state
  const handleCloseModal = () => {
    setWindowMode('normal');
    onClose();
  };

  // Prevent background page scrolling while modal is open (except when minimized)
  useEffect(() => {
    if (isOpen && windowMode !== 'minimized') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, windowMode]);

  if (!isOpen || !patient) return null;

  // Render individual field value in read-only mode
  const renderReadOnlyFieldValue = (field: FormField, formData: Record<string, any>) => {
    const val =
      formData[field.name] !== undefined
        ? formData[field.name]
        : formData[field.id] !== undefined
        ? formData[field.id]
        : undefined;

    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-400 dark:text-slate-500 italic">—</span>;
    }

    if (field.type === 'checkbox') {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          return <span className="text-slate-400 dark:text-slate-500 italic">None selected</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {val.map((item, idx) => {
              const opt = field.options?.find((o) => o.value === item || o.label === item);
              const label = opt ? opt.label : String(item);
              return (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold"
                >
                  ☑ {label}
                </span>
              );
            })}
          </div>
        );
      }
      const isChecked =
        val === true || val === 'true' || val === 'yes' || val === 1 || val === '1';
      return (
        <span
          className={`font-semibold ${
            isChecked
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {isChecked ? '☑ Yes / Checked' : '☐ No / Unchecked'}
        </span>
      );
    }

    if (field.type === 'select' || field.type === 'radio') {
      if (field.options && field.options.length > 0) {
        const str = String(val).trim().toLowerCase();
        const opt = field.options.find(
          (o) =>
            o.value.trim().toLowerCase() === str ||
            o.label.trim().toLowerCase() === str ||
            (o.value.length === 1 && str.startsWith(o.value.toLowerCase())) ||
            (o.label.length === 1 && str.startsWith(o.label.toLowerCase()))
        );
        if (opt) {
          return <span className="font-semibold text-slate-800 dark:text-slate-200">{opt.label}</span>;
        }
      }
      return <span className="font-semibold text-slate-800 dark:text-slate-200">{String(val)}</span>;
    }

    if (field.type === 'textarea') {
      return (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words text-xs leading-relaxed">
          {String(val)}
        </div>
      );
    }

    if (field.type === 'table') {
      const rows = Array.isArray(val) ? val : [];
      const cols = field.tableConfig?.columns || [];

      if (rows.length === 0) {
        return (
          <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 italic">
            No table records entered
          </div>
        );
      }

      return (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl mt-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                {cols.map((col) => (
                  <th key={col.id} className="py-2.5 px-3">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                  {cols.map((col) => {
                    const cellVal = row[col.id] !== undefined ? row[col.id] : row[col.key || ''];
                    return (
                      <td key={col.id} className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                        {cellVal !== undefined && cellVal !== null && cellVal !== ''
                          ? String(cellVal)
                          : '—'}
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

    if (field.type === 'pain_assessment') {
      const pVal = typeof val === 'object' && val !== null ? val : {};
      const score = typeof pVal.score === 'number' ? pVal.score : null;
      const scaleItem = score !== null ? getPainScaleItem(score) : null;
      const painPresent = pVal.painPresent === 'yes' ? 'Yes' : pVal.painPresent === 'no' ? 'No' : '—';
      const location = pVal.location ? String(pVal.location).trim() : '—';

      return (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
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

    return (
      <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
        {String(val)}
      </span>
    );
  };

  // When in detail view and minimized: Render compact floating bar at bottom-right
  if (viewMode === 'detail' && windowMode === 'minimized') {
    const recordNumber = detailData?.submission
      ? String(detailData.submission.recordId || detailData.submission.id)
      : null;
    const formTitle = detailData?.submission?.formName || 'Submitted Form';

    return (
      <aside
        role="region"
        aria-label="Minimized Historical Submission Viewer"
        className="fixed bottom-5 right-5 z-[100] max-w-[92vw] sm:max-w-md w-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200 ring-1 ring-black/5 dark:ring-white/10"
      >
        <div
          onClick={() => setWindowMode('normal')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1 select-none"
          title="Click to restore form viewer"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Historical
              </span>
              {recordNumber && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                  #{recordNumber}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {formTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
          {/* Restore Button */}
          <button
            type="button"
            onClick={() => setWindowMode('normal')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold transition active:scale-95 cursor-pointer border border-blue-200 dark:border-blue-800/60 shadow-xs"
            title="Restore form viewer"
            aria-label="Restore form viewer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restore</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            title="Close viewer"
            aria-label="Close viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  const isMaximized = viewMode === 'detail' && windowMode === 'maximized';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isMaximized ? 'p-2 sm:p-3 md:p-4' : 'p-3 sm:p-5'
      } bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]'
            : 'max-w-4xl w-full max-h-[92vh]'
        }`}
      >
        {/* ========================================================= */}
        {/* VIEW 1: SUBMISSIONS LIST                                   */}
        {/* ========================================================= */}
        {viewMode === 'list' && (
          <>
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Clinical Record Archive
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    MRNO: {patient.mrno}
                  </span>
                  {patient.admissionNumber && (
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Adm #{patient.admissionNumber}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Submitted Forms — {patient.patientName}</span>
                </h2>

                {/* Patient Context Chips */}
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap pt-0.5">
                  {patient.age && <span>Age: <strong>{patient.age}</strong></span>}
                  {patient.gender && <span>Gender: <strong>{patient.gender}</strong></span>}
                  {patient.departmentName && (
                    <span>Dept: <strong>{patient.departmentName}</strong></span>
                  )}
                  {patient.bedNo && (
                    <span className="inline-flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5 text-slate-400" />
                      <span>Bed: <strong>{patient.bedNo}</strong></span>
                    </span>
                  )}
                  {patient.consultant && (
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{patient.consultant}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={loadSubmissions}
                  disabled={isLoadingList}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Refresh submission history"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Submissions List */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-[300px]">
              {isLoadingList ? (
                <div className="space-y-3 py-6">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 animate-pulse flex items-center justify-between"
                    >
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                      </div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-24" />
                    </div>
                  ))}
                </div>
              ) : listError ? (
                <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex flex-col items-center justify-center gap-3 text-center my-6">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <div>
                    <p className="font-bold text-sm">Failed to Load Submission History</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">{listError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadSubmissions}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 text-white font-semibold shadow-xs hover:bg-rose-500 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : submissions.length === 0 ? (
                /* Empty state matching requirement */
                <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shadow-xs">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      No submitted forms are available for this patient.
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      No historical encounters or assessments have been recorded yet for MRNO {patient.mrno}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 tracking-wide uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Form Name</th>
                          <th className="py-3 px-4">Submitted Date</th>
                          <th className="py-3 px-4">Submitted Time</th>
                          <th className="py-3 px-4">Version</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Submitted By</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {submissions.map((sub) => (
                          <tr
                            key={sub.id}
                            className="hover:bg-blue-50/40 dark:hover:bg-slate-850/60 transition-colors group"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-bold text-slate-900 dark:text-white text-xs">
                                {sub.formName}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                              {formatSubmissionDate(sub.submittedAt)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                              {formatSubmissionTime(sub.submittedAt)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                v{sub.formVersion || 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {sub.status || 'Submitted'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                              {sub.submittedBy || 'Clinician'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenForm(sub)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Open Form</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Total Submissions: <strong>{submissions.length}</strong>
              </span>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold shadow-xs hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: HISTORICAL SUBMISSION DETAIL (READ-ONLY)           */}
        {/* ========================================================= */}
        {viewMode === 'detail' && (
          <>
            {/* Detail Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                    title="Return to submitted forms list"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Submitted Forms</span>
                  </button>

                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Historical Read-Only View
                  </span>

                  {detailData?.submission && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      <Hash className="w-3 h-3 text-slate-400" />
                      Record #{String(detailData.submission.recordId || detailData.submission.id)}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white pt-0.5">
                  {detailData?.submission.formName || 'Submitted Form'}
                </h2>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                  <span>
                    Patient: <strong>{patient.patientName}</strong> (MRNO: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{patient.mrno}</span>)
                  </span>
                  {detailData?.submission.submittedAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        Submitted: <strong>{formatSubmissionDate(detailData.submission.submittedAt)}, {formatSubmissionTime(detailData.submission.submittedAt)}</strong>
                      </span>
                    </span>
                  )}
                  {detailData?.submission.submittedBy && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Clinician: <strong>{detailData.submission.submittedBy}</strong></span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0">
                {detailData?.form && (
                  <DownloadPdfButton
                    form={detailData.form}
                    formData={detailData.submission.formData}
                    metadata={{
                      mrno: patient.mrno,
                      department: patient.departmentName,
                      serviceCenter: patient.serviceCenter,
                      recordId: detailData.submission.recordId || detailData.submission.id,
                    }}
                    formTitle={detailData.submission.formName}
                    variant="header"
                  />
                )}

                {/* Window Controls: Minimize, Maximize/Restore, Close */}
                <div className="flex items-center gap-0.5 sm:gap-1 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-700">
                  {/* Minimize Button */}
                  <button
                    type="button"
                    onClick={() => setWindowMode('minimized')}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Minimize"
                    aria-label="Minimize form viewer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  {/* Maximize / Restore Button */}
                  {windowMode === 'maximized' ? (
                    <button
                      type="button"
                      onClick={() => setWindowMode('normal')}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Restore down"
                      aria-label="Restore down"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWindowMode('maximized')}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Maximize"
                      aria-label="Maximize form viewer"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Close"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Read-Only Safety Banner */}
            <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Viewing an immutable historical clinical submission snapshot. Changes cannot be made and existing records are never overwritten.
                </span>
              </div>
              <button
                type="button"
                onClick={handleBackToList}
                className="text-amber-800 dark:text-amber-300 hover:underline font-bold shrink-0 text-xs cursor-pointer"
              >
                Back to List
              </button>
            </div>

            {/* Detail Body: Form Fields and Sections */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0 text-xs">
              {isLoadingDetail ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="font-semibold text-sm">Loading submission schema and clinical data...</p>
                </div>
              ) : detailError ? (
                <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex flex-col items-center justify-center gap-3 text-center my-6">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <div>
                    <p className="font-bold text-sm">Failed to Load Submission Record</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">{detailError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs hover:bg-slate-300 transition cursor-pointer"
                  >
                    Back to Submitted Forms
                  </button>
                </div>
              ) : detailData ? (
                <div className="space-y-6">
                  {detailData.form.layout && detailData.form.layout.length > 0 ? (
                    detailData.form.layout.map((sec) => (
                      <div
                        key={sec.id}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-850/40 border border-slate-200/80 dark:border-slate-800 space-y-4"
                      >
                        {sec.title && (
                          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                              {sec.title}
                            </h3>
                            {sec.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {sec.description}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sec.rows
                            ?.flatMap((r) => r.columns || [])
                            ?.flatMap((col) => col.fieldIds || [])
                            ?.map((fId) => {
                              const field = detailData.form.fields[fId];
                              if (!field || field.type === 'heading' || field.type === 'divider') {
                                return null;
                              }

                              const isFullWidth = field.type === 'table' || field.type === 'pain_assessment';

                              return (
                                <div
                                  key={field.id}
                                  className={`p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1 ${
                                    isFullWidth ? 'md:col-span-2' : ''
                                  }`}
                                >
                                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {field.label || field.name}
                                    {field.validation?.required && (
                                      <span className="text-rose-500 ml-1">*</span>
                                    )}
                                  </span>
                                  <div>
                                    {renderReadOnlyFieldValue(field, detailData.submission.formData)}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Fallback when layout is empty */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.values(detailData.form.fields || {}).map((field) => {
                        if (field.type === 'heading' || field.type === 'divider') return null;
                        const isFullWidth = field.type === 'table' || field.type === 'pain_assessment';

                        return (
                          <div
                            key={field.id}
                            className={`p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1 ${
                              isFullWidth ? 'md:col-span-2' : ''
                            }`}
                          >
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {field.label || field.name}
                            </span>
                            <div>
                              {renderReadOnlyFieldValue(field, detailData.submission.formData)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Detail Footer */}
            <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Submitted Forms</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Record</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
