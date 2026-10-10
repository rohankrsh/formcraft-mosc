import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  LayoutGrid,
  PencilRuler,
  Sun,
  Moon,
  Users,
  FileText,
  RefreshCw,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';
import { PatientFilters } from '../components/patient/PatientFilters';
import { PatientTable } from '../components/patient/PatientTable';
import {
  fetchPatients,
  fetchDepartments,
  fetchServiceCenters,
  fetchDeployedForms,
  type Patient,
  type Department,
  type ServiceCenter,
  type DeployedForm,
} from '../services/patientApi';

export const PatientList: React.FC = () => {
  // Theme state matching FormCraft
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Filter & Search state
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedServiceCenter, setSelectedServiceCenter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [deployedForms, setDeployedForms] = useState<DeployedForm[]>([]);
  const [selectedForms, setSelectedForms] = useState<Record<string, string>>({});

  // Loading & Error states
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(true);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounce search input
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(query);
      setPage(1); // Reset to page 1 on new search
    }, 300);
  };

  // Load dropdown filters and deployed forms once on component mount
  const loadMetadata = useCallback(async () => {
    setIsLoadingMetadata(true);
    try {
      const [deptList, scList, formsList] = await Promise.all([
        fetchDepartments().catch((err) => {
          console.warn('Failed to fetch departments:', err);
          return [] as Department[];
        }),
        fetchServiceCenters().catch((err) => {
          console.warn('Failed to fetch service centers:', err);
          return [] as ServiceCenter[];
        }),
        fetchDeployedForms().catch((err) => {
          console.warn('Failed to fetch deployed forms:', err);
          return [] as DeployedForm[];
        }),
      ]);

      setDepartments(deptList);
      setServiceCenters(scList);
      setDeployedForms(formsList);
    } catch (err) {
      console.error('Metadata fetch error:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load patients when filters, search, or pagination changes
  const loadPatients = useCallback(async () => {
    setIsLoadingPatients(true);
    setErrorMessage(null);

    try {
      const res = await fetchPatients({
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        serviceCenterId: selectedServiceCenter !== 'all' ? selectedServiceCenter : undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      });

      if (res.success) {
        setPatients(res.patients || []);
        setTotalPatients(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        throw new Error(res.error || 'Failed to fetch patients.');
      }
    } catch (err: any) {
      console.error('Patient fetch error:', err);
      setErrorMessage(
        err.message ||
        'Unable to connect to Oracle database. Please verify backend connection.'
      );
      setPatients([]);
      setTotalPatients(0);
      setTotalPages(1);
    } finally {
      setIsLoadingPatients(false);
    }
  }, [selectedDepartment, selectedServiceCenter, debouncedSearch, page, limit]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Filter handlers
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartment(deptId);
    setPage(1);
  };

  const handleServiceCenterChange = (scId: string) => {
    setSelectedServiceCenter(scId);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedDepartment('all');
    setSelectedServiceCenter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleSelectFormForPatient = (mrno: string, formKey: string) => {
    setSelectedForms((prev) => ({
      ...prev,
      [mrno]: formKey,
    }));
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Navigation Header */}
      <header className="h-16 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  FormCraft
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                  HIS Patients
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Admitted Inpatients & Form Launcher
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/builder"
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <PencilRuler className="w-3.5 h-3.5" />
              <span>Form Builder</span>
            </Link>
          </nav>
        </div>

        {/* Right Header Actions: Refresh & Theme */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              loadMetadata();
              loadPatients();
            }}
            disabled={isLoadingPatients}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Patient List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingPatients ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-none mx-auto p-6 md:p-8 space-y-6">
        {/* Title & Stats Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Patient List</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active inpatients matching status 387 in Oracle Database. Select a deployed form to open with patient MRNO.
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Admitted
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {totalPatients}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Deployed Forms
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {deployedForms.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={loadPatients}
              className="px-2.5 py-1 rounded bg-rose-200/60 dark:bg-rose-900/60 hover:bg-rose-300/60 font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <PatientFilters
          departments={departments}
          serviceCenters={serviceCenters}
          selectedDepartment={selectedDepartment}
          selectedServiceCenter={selectedServiceCenter}
          searchQuery={searchQuery}
          onDepartmentChange={handleDepartmentChange}
          onServiceCenterChange={handleServiceCenterChange}
          onSearchChange={handleSearchChange}
          onResetFilters={handleResetFilters}
          isLoading={isLoadingPatients || isLoadingMetadata}
        />

        {/* Patients Table */}
        <PatientTable
          patients={patients}
          deployedForms={deployedForms}
          selectedForms={selectedForms}
          onSelectFormForPatient={handleSelectFormForPatient}
          isLoading={isLoadingPatients}
          page={page}
          totalPages={totalPages}
          totalPatients={totalPatients}
          limit={limit}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      </main>
    </div>
  );
};

export default PatientList;
