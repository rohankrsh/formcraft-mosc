import React from 'react';
import { Search, RotateCcw, Building2, MapPin, X } from 'lucide-react';
import type { Department, ServiceCenter } from '../../services/patientApi';

interface PatientFiltersProps {
  departments: Department[];
  serviceCenters: ServiceCenter[];
  selectedDepartment: string;
  selectedServiceCenter: string;
  searchQuery: string;
  onDepartmentChange: (deptId: string) => void;
  onServiceCenterChange: (scId: string) => void;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export const PatientFilters: React.FC<PatientFiltersProps> = ({
  departments,
  serviceCenters,
  selectedDepartment,
  selectedServiceCenter,
  searchQuery,
  onDepartmentChange,
  onServiceCenterChange,
  onSearchChange,
  onResetFilters,
  isLoading = false,
}) => {
  const hasActiveFilters =
    (selectedDepartment && selectedDepartment !== 'all') ||
    (selectedServiceCenter && selectedServiceCenter !== 'all') ||
    searchQuery.trim() !== '';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Dropdown Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {/* Department Filter */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="dept-filter"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Department</span>
            </label>
            <div className="relative">
              <select
                id="dept-filter"
                value={selectedDepartment}
                onChange={(e) => onDepartmentChange(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept.departmentId} value={dept.departmentId}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Center Filter */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="sc-filter"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>Service Center</span>
            </label>
            <div className="relative">
              <select
                id="sc-filter"
                value={selectedServiceCenter}
                onChange={(e) => onServiceCenterChange(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="all">All Service Centers ({serviceCenters.length})</option>
                {serviceCenters.map((sc) => (
                  <option key={sc.serviceCenterId} value={sc.serviceCenterId}>
                    {sc.serviceCenterName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Search Input & Reset Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 lg:w-96">
          <div className="flex-1 flex flex-col gap-1.5">
            <label
              htmlFor="patient-search"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span>Search Patients</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="patient-search"
                type="text"
                placeholder="Search MRNO, name, bed, admission #..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all active:scale-95 whitespace-nowrap h-[34px]"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
