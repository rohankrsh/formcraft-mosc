import React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  // Phone,
  Stethoscope,
  Bed,
  AlertCircle,
  History,
} from 'lucide-react';
import type { Patient, DeployedForm } from '../../services/patientApi';
import { parseAndValidateUserId } from '../../utils/staffFieldHelper';

interface PatientTableProps {
  patients: Patient[];
  deployedForms: DeployedForm[];
  selectedForms: Record<string, string>; // mrno -> formSlug or formId
  onSelectFormForPatient: (mrno: string, formKey: string) => void;
  isLoading: boolean;
  page: number;
  totalPages: number;
  totalPatients: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  onOpenSubmittedForms?: (patient: Patient) => void;
}

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  deployedForms,
  selectedForms,
  onSelectFormForPatient,
  isLoading,
  page,
  totalPages,
  totalPatients,
  limit,
  onPageChange,
  onLimitChange,
  onOpenSubmittedForms,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlDepartment = searchParams.get('department') || searchParams.get('departmentId') || '';
  const urlServiceCenter = searchParams.get('serviceCenter') || searchParams.get('serviceCenterId') || '';
  const urlUserId = searchParams.get('user_id') || searchParams.get('userId') || '';

  const buildRuntimeFormUrl = (slug: string, mrno: string) => {
    let url = `/forms/${encodeURIComponent(slug)}?mrno=${encodeURIComponent(mrno)}`;
    if (urlDepartment) {
      url += `&department=${encodeURIComponent(urlDepartment)}`;
    }
    if (urlServiceCenter) {
      url += `&serviceCenter=${encodeURIComponent(urlServiceCenter)}`;
    }
    const cleanUserId = parseAndValidateUserId(urlUserId);
    if (cleanUserId) {
      url += `&user_id=${cleanUserId}`;
    }
    return url;
  };

  const handleFormSelect = (mrno: string, formValue: string) => {
    onSelectFormForPatient(mrno, formValue);
    if (!formValue) return;

    // Find selected form
    const form = deployedForms.find(
      (f) => f.slug === formValue || f.id === formValue
    );
    if (form) {
      const slug = form.slug || form.id;
      navigate(buildRuntimeFormUrl(slug, mrno), {
        state: { returnUrl: location.pathname + location.search },
      });
    }
  };

  const handleOpenForm = (mrno: string) => {
    const formValue = selectedForms[mrno];
    if (!formValue) return;
    const form = deployedForms.find(
      (f) => f.slug === formValue || f.id === formValue
    );
    if (form) {
      const slug = form.slug || form.id;
      navigate(buildRuntimeFormUrl(slug, mrno), {
        state: { returnUrl: location.pathname + location.search },
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden transition-colors">
      {/* Table Container with Horizontal Scroll */}
      <div className="overflow-x-auto w-full min-h-[380px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 tracking-wide uppercase text-[11px] select-none whitespace-nowrap">
              <th className="py-3.5 px-4">MRNO</th>
              <th className="py-3.5 px-4">Patient Name</th>
              <th className="py-3.5 px-4">Admission Date</th>
              <th className="py-3.5 px-4">Bed No</th>
              <th className="py-3.5 px-4">Adm #</th>
              <th className="py-3.5 px-4">Age / Gender</th>
              <th className="py-3.5 px-4">Consultant</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Service Center</th>
              {/* <th className="py-3.5 px-4">Mobile</th> */}
              <th className="py-3.5 px-4 text-center">Submitted Forms</th>
              <th className="py-3.5 px-4 min-w-[260px] text-right">Deployed Form Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {isLoading ? (
              // Skeleton Loader Rows
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-14" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" /></td>
                  {/* <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td> */}
                  <td className="py-4 px-4 text-center"><div className="h-7 bg-slate-200 dark:bg-slate-800 rounded-xl w-32 mx-auto" /></td>
                  <td className="py-4 px-4"><div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48 ml-auto" /></td>
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No Patients Found</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No active admitted patients match the current department, service center, or search filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              patients.map((patient) => {
                const currentSelection = selectedForms[patient.mrno] || '';

                return (
                  <tr
                    key={patient.mrno}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* MRNO */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                        {patient.mrno}
                      </span>
                    </td>

                    {/* Patient Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                          {patient.patientName.charAt(0) || 'P'}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {patient.patientName}
                        </span>
                      </div>
                    </td>

                    {/* Admission Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <span className="font-mono text-xs">{patient.admissionDate || '—'}</span>
                    </td>

                    {/* Bed No */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        <Bed className="w-3 h-3 text-slate-400" />
                        {patient.bedNo || '—'}
                      </span>
                    </td>

                    {/* Admission Number */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {patient.admissionNumber || '—'}
                    </td>

                    {/* Age / Gender */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-700 dark:text-slate-300">
                          {patient.age || '—'}
                        </span>
                        {patient.gender && (
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${patient.gender.toLowerCase().includes('female')
                                ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                                : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                              }`}
                          >
                            {patient.gender}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Consultant */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                      <div className="flex items-center gap-1">
                        <Stethoscope className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[140px]" title={patient.consultant}>
                          {patient.consultant || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded">
                        {patient.departmentName || '—'}
                      </span>
                    </td>

                    {/* Service Center */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <span className="truncate max-w-[130px] block" title={patient.serviceCenter}>
                        {patient.serviceCenter || '—'}
                      </span>
                    </td>

                    {/* Submitted Forms Action Column */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => onOpenSubmittedForms?.(patient)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        title={`View submitted forms for MRNO ${patient.mrno}`}
                      >
                        <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Submitted Forms</span>
                      </button>
                    </td>

                    {/* Deployed Form Dropdown Action */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={currentSelection}
                          onChange={(e) => handleFormSelect(patient.mrno, e.target.value)}
                          className="w-48 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer transition-all"
                        >
                          <option value="">
                            {deployedForms.length > 0 ? `Select Form (${deployedForms.length})` : 'No Forms Available (0)'}
                          </option>
                          {deployedForms.map((form) => (
                            <option
                              key={form.id}
                              value={form.slug || form.id}
                            >
                              {form.title} (v{form.version || form.publishedVersion || 1})
                            </option>
                          ))}
                        </select>

                        {currentSelection && (
                          <button
                            type="button"
                            onClick={() => handleOpenForm(patient.mrno)}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs active:scale-95 shrink-0"
                            title="Open selected form for this patient"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Showing{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {patients.length > 0 ? (page - 1) * limit + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {Math.min(page * limit, totalPatients)}
            </strong>{' '}
            of{' '}
            <strong className="text-slate-900 dark:text-slate-100">{totalPatients}</strong>{' '}
            patients
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-2 font-medium">
            Page {page} of {totalPages || 1}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
