import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trash2,
  Copy,
  Plus,
  Sliders,
  ShieldCheck,
  Layers,
  Database,
  Table,
  Link,
  ChevronUp,
  ChevronDown,
  Rows,
  Edit3,
  AlertTriangle,
  Users,
  Building,
  Check,
  Search,
  Globe,
} from 'lucide-react';
import { useFormStore } from '../../store/useFormStore';
import type { FormField, FieldOption, FormTheme, TableColumn, OracleBindType, DataBindingMode, SqlQueryDefinition } from '../../types/schema';
import { SqlQueryEditorModal } from '../database/SqlQueryEditorModal';
import {
  fetchAllowlistedTables,
  fetchAllowlistedColumns,
  type AllowlistedTable,
  type AllowlistedColumn,
} from '../../services/databaseApi';
import {
  fetchDepartments,
  fetchServiceCenters,
  type Department,
  type ServiceCenter,
} from '../../services/patientApi';

const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Cyan', hex: '#06b6d4' },
];

export const PropertyPanel: React.FC = () => {
  const {
    form,
    selectedId,
    selectedType,
    setSelected,
    updateField,
    deleteField,
    duplicateField,
    updateSection,
    deleteSection,
    updateMetadata,
    updateSettings,
    addSqlQuery,
    updateSqlQuery,
    deleteSqlQuery,
  } = useFormStore();

  const [availableTables, setAvailableTables] = useState<AllowlistedTable[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, AllowlistedColumn[]>>({});
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SqlQueryDefinition | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);

  const fieldKeyWarnings = useMemo(() => {
    const keys = new Map<string, number>();
    const warnings: string[] = [];
    const validKeyRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

    for (const f of Object.values(form.fields || {})) {
      if (f.type === 'heading' || f.type === 'divider') continue;
      const count = keys.get(f.name) || 0;
      keys.set(f.name, count + 1);
      if (!validKeyRegex.test(f.name)) {
        warnings.push(`Field "${f.label || f.id}" has non-standard key "${f.name}".`);
      }
    }

    for (const [key, count] of keys.entries()) {
      if (count > 1) {
        warnings.push(`Duplicate field key "${key}" detected on ${count} fields.`);
      }
    }
    return warnings;
  }, [form.fields]);

  useEffect(() => {
    let isMounted = true;
    fetchAllowlistedTables().then((tables) => {
      if (isMounted) setAvailableTables(tables);
    });
    fetchDepartments().then((depts) => {
      if (isMounted) setDepartments(depts);
    }).catch((err) => console.warn('Failed to load departments in builder:', err.message));
    fetchServiceCenters().then((scs) => {
      if (isMounted) setServiceCenters(scs);
    }).catch((err) => console.warn('Failed to load service centers in builder:', err.message));
    return () => {
      isMounted = false;
    };
  }, []);

  const [scopeMode, setScopeMode] = useState<'all' | 'specific' | null>(null);
  const [lastSpecificDepartmentIds, setLastSpecificDepartmentIds] = useState<string[]>([]);

  // Reset explicit scope override if form changes
  useEffect(() => {
    setScopeMode(null);
  }, [form.id]);

  const isOrganizationWide = useMemo(() => {
    if (scopeMode !== null) return scopeMode === 'all';

    const rawIds = form.settings.departmentIds;
    const rawId = form.settings.departmentId;
    const rawName = form.settings.departmentName;

    // 1. If departmentIds array is present:
    // It is ONLY organization-wide if it explicitly contains 'ALL'.
    // If it's an array without 'ALL' (e.g. ['51'] or [] when switched to specific), it is in Specific Depts mode!
    if (Array.isArray(rawIds)) {
      return rawIds.some((id) => String(id).toUpperCase() === 'ALL');
    }

    // 2. Legacy single-department checks
    if (rawId && String(rawId).toUpperCase() === 'ALL') return true;
    if (rawName && (rawName.toUpperCase() === 'ALL' || rawName.toLowerCase().includes('all departments'))) return true;

    // 3. If rawId is set to a specific department code/ID (e.g. '51' or 'CARDIOLOGY'), it is specific
    if (rawId && String(rawId).trim() !== '') return false;

    // 4. Default for unassigned legacy forms
    return true;
  }, [form.settings.departmentIds, form.settings.departmentId, form.settings.departmentName, scopeMode]);

  const selectedDepartmentIds = useMemo(() => {
    const rawIds = form.settings.departmentIds;
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      return rawIds
        .map((id) => String(id).trim())
        .filter((id) => id.length > 0 && id.toUpperCase() !== 'ALL');
    }
    const rawId = form.settings.departmentId;
    if (rawId && String(rawId).toUpperCase() !== 'ALL') {
      const match = departments.find(
        (d) => String(d.departmentId) === String(rawId) || d.departmentName.toUpperCase() === String(rawId).toUpperCase()
      );
      return match ? [String(match.departmentId)] : [String(rawId).trim()];
    }
    const rawName = form.settings.departmentName;
    if (rawName && rawName.toUpperCase() !== 'ALL' && !rawName.toLowerCase().includes('all departments')) {
      const match = departments.find((d) => d.departmentName.toUpperCase() === rawName.toUpperCase());
      if (match) return [String(match.departmentId)];
    }
    return [];
  }, [form.settings.departmentIds, form.settings.departmentId, form.settings.departmentName, departments]);

  // Keep lastSpecificDepartmentIds updated whenever user selects departments
  useEffect(() => {
    if (selectedDepartmentIds.length > 0) {
      setLastSpecificDepartmentIds(selectedDepartmentIds);
    }
  }, [selectedDepartmentIds]);

  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  const filteredDepartments = useMemo(() => {
    if (!deptSearchQuery.trim()) return departments;
    const q = deptSearchQuery.toLowerCase().trim();
    return departments.filter(
      (d) =>
        d.departmentName.toLowerCase().includes(q) ||
        String(d.departmentId).toLowerCase().includes(q)
    );
  }, [departments, deptSearchQuery]);

  const handleToggleDepartment = (deptId: string) => {
    setScopeMode('specific');
    const idStr = String(deptId).trim();
    let nextIds: string[];
    if (selectedDepartmentIds.includes(idStr)) {
      nextIds = selectedDepartmentIds.filter((id) => id !== idStr);
    } else {
      nextIds = [...selectedDepartmentIds, idStr];
    }
    nextIds = Array.from(new Set(nextIds));

    if (nextIds.length === 0) {
      updateSettings({
        departmentIds: [],
        departmentNames: [],
        departmentId: '',
        departmentName: '',
      });
      return;
    }

    const nextNames = nextIds.map((id) => {
      const d = departments.find((dept) => String(dept.departmentId) === id);
      return d ? d.departmentName : id;
    });

    updateSettings({
      departmentIds: nextIds,
      departmentNames: nextNames,
      departmentId: nextIds[0],
      departmentName: nextNames.join(', '),
    });
  };

  const handleRemoveDepartment = (deptId: string) => {
    setScopeMode('specific');
    const idStr = String(deptId).trim();
    const nextIds = selectedDepartmentIds.filter((id) => id !== idStr);
    const nextNames = nextIds.map((id) => {
      const d = departments.find((dept) => String(dept.departmentId) === id);
      return d ? d.departmentName : id;
    });
    updateSettings({
      departmentIds: nextIds,
      departmentNames: nextNames,
      departmentId: nextIds[0] || '',
      departmentName: nextNames.join(', '),
    });
  };

  const handleSetOrganizationWide = () => {
    setScopeMode('all');
    updateSettings({
      departmentIds: ['ALL'],
      departmentNames: ['All Departments (Organization-wide)'],
      departmentId: 'ALL',
      departmentName: 'All Departments (Organization-wide)',
    });
  };

  const handleSetSpecificDepartments = () => {
    setScopeMode('specific');
    // If we have previously selected departments saved, restore them!
    const restoreIds =
      lastSpecificDepartmentIds.length > 0
        ? lastSpecificDepartmentIds
        : (form.settings.departmentIds || []).filter((id) => String(id).toUpperCase() !== 'ALL');

    if (restoreIds.length > 0) {
      const restoreNames = restoreIds.map((id) => {
        const d = departments.find((dept) => String(dept.departmentId) === id);
        return d ? d.departmentName : id;
      });
      updateSettings({
        departmentIds: restoreIds,
        departmentNames: restoreNames,
        departmentId: restoreIds[0],
        departmentName: restoreNames.join(', '),
      });
    } else {
      updateSettings({
        departmentIds: [],
        departmentNames: [],
        departmentId: '',
        departmentName: '',
      });
    }
  };

  const handleSelectAllDepartments = () => {
    setScopeMode('specific');
    const allIds = departments.map((d) => String(d.departmentId));
    const allNames = departments.map((d) => d.departmentName);
    updateSettings({
      departmentIds: allIds,
      departmentNames: allNames,
      departmentId: allIds[0] || '',
      departmentName: allNames.join(', '),
    });
  };

  const handleClearAllDepartments = () => {
    setScopeMode('specific');
    updateSettings({
      departmentIds: [],
      departmentNames: [],
      departmentId: '',
      departmentName: '',
    });
  };

  const loadColumnsForTable = async (tableName: string) => {
    if (!tableName || columnsByTable[tableName]) return;
    const cols = await fetchAllowlistedColumns(tableName);
    setColumnsByTable((prev) => ({ ...prev, [tableName]: cols }));
  };

  useEffect(() => {
    if (selectedType === 'settings' && form.settings.primaryEntity) {
      loadColumnsForTable(form.settings.primaryEntity);
    } else if (selectedType === 'section') {
      const sec = form.layout.find((s) => s.id === selectedId);
      const entity = sec?.fetchEntity || form.settings.primaryEntity || 'PATIENT';
      loadColumnsForTable(entity);
    } else if (selectedType === 'field' && selectedId && form.fields[selectedId]) {
      const f = form.fields[selectedId];
      if (f.dataBinding?.table) loadColumnsForTable(f.dataBinding.table);
      if (f.optionsBinding?.table) loadColumnsForTable(f.optionsBinding.table);
    }
  }, [selectedId, selectedType, form.settings.primaryEntity, form.layout]);

  const renderContent = () => {
    if (!selectedId && !selectedType) {
      return (
      <aside className="w-80 bg-white/95 border-l border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] p-6 select-none justify-center items-center text-center transition-colors shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-xs">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Properties Inspector</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
          Click on any field, row, section, or header on the canvas to configure its settings.
        </p>
      </aside>
    );
  }

  // Case 1: Form Settings
  if (selectedType === 'settings') {
    return (
      <aside className="w-80 bg-white/95 border-l border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none transition-colors shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Form Settings & Database
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Form Meta */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Form Details
            </h4>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Form Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateMetadata(e.target.value, form.description)}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Description</label>
              <textarea
                value={form.description || ''}
                rows={2}
                onChange={(e) => updateMetadata(form.title, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Department Assignment (Multi-Department Role-Based Form Visibility) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider">
                  Department Assignment
                </h4>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                {isOrganizationWide
                  ? 'Org-wide'
                  : `${selectedDepartmentIds.length} Dept${selectedDepartmentIds.length === 1 ? '' : 's'}`}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Assign this form to one or multiple clinical departments. Users from any assigned department can access this form.
            </p>

            {/* Scope Selection: All vs Specific */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                id="btn-scope-all-departments"
                onClick={handleSetOrganizationWide}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                  isOrganizationWide
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>All Departments</span>
              </button>

              <button
                type="button"
                id="btn-scope-specific-departments"
                onClick={handleSetSpecificDepartments}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                  !isOrganizationWide
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Building className="w-3 h-3" />
                <span>Specific Depts</span>
              </button>
            </div>

            {isOrganizationWide ? (
              <div className="p-3 bg-blue-50/60 border border-blue-200/70 dark:bg-blue-950/20 dark:border-blue-900/40 rounded-lg text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <Check className="w-3.5 h-3.5 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="text-[11px] leading-tight">
                  <p className="font-semibold">Organization-wide Access</p>
                  <p className="text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                    This form is accessible by staff in every department across the hospital.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Actions: Select All / Clear All */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    Assigned Departments ({selectedDepartmentIds.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-dept-select-all"
                      onClick={handleSelectAllDepartments}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline text-[10px]"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      id="btn-dept-clear-all"
                      onClick={handleClearAllDepartments}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium hover:underline text-[10px]"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Selected Departments Chips */}
                {selectedDepartmentIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg max-h-28 overflow-y-auto">
                    {selectedDepartmentIds.map((id) => {
                      const dept = departments.find((d) => String(d.departmentId) === id);
                      const name = dept ? dept.departmentName : `ID: ${id}`;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-medium"
                        >
                          <span>{name}</span>
                          <span className="text-[9px] text-blue-500 dark:text-blue-400 font-mono">
                            #{id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDepartment(id)}
                            className="p-0.5 rounded-full hover:bg-blue-200/80 dark:hover:bg-blue-800/80 text-blue-600 dark:text-blue-300 transition-colors"
                            title={`Remove ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>Please select at least one department below.</span>
                  </div>
                )}

                {/* Searchable Multi-Select Department List */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-850">
                  <div className="p-1.5 border-b border-slate-200 dark:border-slate-750 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    <input
                      type="text"
                      id="form-settings-department-search"
                      value={deptSearchQuery}
                      onChange={(e) => setDeptSearchQuery(e.target.value)}
                      placeholder="Filter departments..."
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400"
                    />
                    {deptSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDeptSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDepartments.map((d) => {
                      const idStr = String(d.departmentId);
                      const isSelected = selectedDepartmentIds.includes(idStr);
                      return (
                        <label
                          key={d.departmentId}
                          className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                            isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleDepartment(idStr)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {d.departmentName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            ID: {d.departmentId}
                          </span>
                        </label>
                      );
                    })}
                    {filteredDepartments.length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No departments match &ldquo;{deptSearchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Service Center (Optional)
              </label>
              <select
                id="form-settings-service-center-select"
                value={form.settings.serviceCenterId || form.settings.serviceCenterName || 'ALL'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL' || !val) {
                    updateSettings({
                      serviceCenterId: undefined,
                      serviceCenterName: undefined,
                    });
                  } else {
                    const match = serviceCenters.find(
                      (s) => String(s.serviceCenterId) === val || s.serviceCenterName === val
                    );
                    updateSettings({
                      serviceCenterId: match?.serviceCenterId || val,
                      serviceCenterName: match?.serviceCenterName || val,
                    });
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Service Centers (Unrestricted)</option>
                {serviceCenters.map((s) => (
                  <option
                    key={s.serviceCenterId || s.serviceCenterName}
                    value={s.serviceCenterId || s.serviceCenterName}
                  >
                    {s.serviceCenterName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Oracle Primary Entity Binding */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider">
                Oracle Primary Entity
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Configure which allowlisted Oracle table this form writes new records to and updates existing rows.
            </p>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Target Table (Allowlisted)
              </label>
              <select
                value={form.settings.primaryEntity || ''}
                onChange={(e) => {
                  const val = e.target.value || undefined;
                  updateSettings({ primaryEntity: val, primaryKeyColumn: undefined });
                  if (val) loadColumnsForTable(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Standalone / No DB Entity --</option>
                {availableTables.map((t) => (
                  <option key={t.table} value={t.table}>
                    {t.table} {t.primaryKey ? `(PK: ${t.primaryKey})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {form.settings.primaryEntity && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Primary Key Column
                </label>
                <select
                  value={form.settings.primaryKeyColumn || ''}
                  onChange={(e) => updateSettings({ primaryKeyColumn: e.target.value || undefined })}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Primary Key Column --</option>
                  {(columnsByTable[form.settings.primaryEntity] || []).map((col) => (
                    <option key={col.column} value={col.column}>
                      {col.column} {col.isPrimaryKey ? '(Primary Key)' : `(${col.oracleType})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Fetch Record Button
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Enable Fetch Record button in Interactive Preview
                </span>
              </div>
              <input
                type="checkbox"
                id="form-settings-fetch-record-toggle"
                checked={Boolean(form.settings.enableFetchRecord)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const defaultEntity = form.settings.primaryEntity || 'PATIENT';
                  const defaultPk = form.settings.primaryKeyColumn || 'PATIENT_ID';
                  updateSettings({
                    enableFetchRecord: enabled,
                    primaryEntity: enabled ? defaultEntity : form.settings.primaryEntity,
                    primaryKeyColumn: enabled ? defaultPk : form.settings.primaryKeyColumn,
                  });
                  if (enabled) loadColumnsForTable(defaultEntity);
                }}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
              />
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Patient Form Behavior (Feature A) */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider">
                Patient Form Behavior
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure how this form behaves when opened against a patient encounter in the HIS runtime.
            </p>

            <div className="space-y-2">
              {/* Option 1: NEW_RECORD */}
              <label
                className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  (form.settings.patientFormMode || 'NEW_RECORD') === 'NEW_RECORD'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="patientFormMode"
                  value="NEW_RECORD"
                  checked={(form.settings.patientFormMode || 'NEW_RECORD') === 'NEW_RECORD'}
                  onChange={() => updateSettings({ patientFormMode: 'NEW_RECORD' })}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                    New Form for Every Submission
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                    Create a new patient-specific form record whenever the form is opened. Keep previous submissions available in submission history.
                  </span>
                </div>
              </label>

              {/* Option 2: CONTINUE_EXISTING */}
              <label
                className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.settings.patientFormMode === 'CONTINUE_EXISTING'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="patientFormMode"
                  value="CONTINUE_EXISTING"
                  checked={form.settings.patientFormMode === 'CONTINUE_EXISTING'}
                  onChange={() => updateSettings({ patientFormMode: 'CONTINUE_EXISTING' })}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                    Continue Existing Patient Form
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                    Load the existing patient record when available and update that record when submitted.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Field Key Safety Warning (Non-Intrusive, Step 19) */}
          {fieldKeyWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-1 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Field Key Warnings
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {fieldKeyWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-600 dark:text-amber-400/80 pt-1">
                SQL parameter and result mapping connects directly to <code>field.name</code>.
              </p>
            </div>
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Database SQL Queries Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Database SQL Queries
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingQuery(null);
                  setIsSqlModalOpen(true);
                }}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" />
                New Query
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Execute parameterized SQL queries to auto-populate form fields using canonical{' '}
              <code className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">field.name</code>.
            </p>

            {(form.sqlQueries || []).length === 0 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-850/60 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No SQL queries configured yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuery(null);
                    setIsSqlModalOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Add Parameterized Query
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(form.sqlQueries || []).map((q) => {
                  const mappedCount = Object.values(q.resultMappings || {}).filter(Boolean).length;
                  return (
                    <div
                      key={q.id}
                      className="p-3 bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 hover:border-indigo-300 dark:hover:border-indigo-800 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                          {q.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              q.enabled !== false
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {q.enabled !== false ? 'Enabled' : 'Disabled'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuery(q);
                              setIsSqlModalOpen(true);
                            }}
                            title="Edit Query"
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSqlQuery(q.id)}
                            title="Delete Query"
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {q.executeOn === 'fieldChange'
                            ? `on: ${q.triggerFieldKey || 'change'}`
                            : q.executeOn === 'formLoad'
                            ? 'on: load'
                            : 'on: button'}
                        </span>
                        <span>{mappedCount} fields mapped</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Submission Action */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Submission Actions
            </h4>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Submit Button Text</label>
              <input
                type="text"
                value={form.settings.submitButtonText}
                onChange={(e) => updateSettings({ submitButtonText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Show Reset Button</span>
              <input
                type="checkbox"
                checked={form.settings.showResetButton}
                onChange={(e) => updateSettings({ showResetButton: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {form.settings.showResetButton && (
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Reset Button Label</label>
                <input
                  type="text"
                  value={form.settings.resetButtonText || 'Reset Form'}
                  onChange={(e) => updateSettings({ resetButtonText: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Theme & Styling */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Exported Form Theme
            </h4>

            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1.5">Primary Accent Color</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        theme: {
                          ...(form.settings.theme as FormTheme),
                          primaryColor: color.hex,
                        },
                      })
                    }
                    className={`w-6 h-6 rounded-full transition-transform ${
                      form.settings.theme?.primaryColor === color.hex
                        ? 'ring-2 ring-slate-800 dark:ring-white scale-110 shadow-md'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Border Radius</label>
              <select
                value={form.settings.theme?.borderRadius || 'md'}
                onChange={(e) =>
                  updateSettings({
                    theme: {
                      ...(form.settings.theme as FormTheme),
                      borderRadius: e.target.value as 'none' | 'sm' | 'md' | 'lg' | 'full',
                    },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="none">Square (none)</option>
                <option value="sm">Small (sm)</option>
                <option value="md">Medium (md)</option>
                <option value="lg">Large (lg)</option>
                <option value="full">Pill (full)</option>
              </select>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Case 2: Section Inspector
  if (selectedType === 'section') {
    const section = form.layout.find((s) => s.id === selectedId);
    if (!section) return null;

    return (
      <aside className="w-80 bg-white/95 border-l border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none transition-colors shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Section Settings
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Section Title
            </label>
            <input
              type="text"
              value={section.title || ''}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={section.description || ''}
              onChange={(e) => updateSection(section.id, { description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Section Fetch Record (Oracle DB) Toggle & Settings */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider">
                  Fetch Record Button
                </h4>
              </div>
              <input
                type="checkbox"
                id={`fetch-record-toggle-${section.id}`}
                checked={Boolean(section.enableFetchRecord)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const defaultEntity = section.fetchEntity || form.settings?.primaryEntity || 'PATIENT';
                  const defaultPk = section.fetchPrimaryKey || form.settings?.primaryKeyColumn || 'PATIENT_ID';

                  updateSection(section.id, {
                    enableFetchRecord: enabled,
                    fetchEntity: enabled ? defaultEntity : undefined,
                    fetchPrimaryKey: enabled ? defaultPk : undefined,
                  });

                  if (enabled) {
                    loadColumnsForTable(defaultEntity);
                    updateSettings({
                      primaryEntity: defaultEntity,
                      primaryKeyColumn: defaultPk,
                      enableFetchRecord: true,
                    });
                  } else {
                    const otherSectionHasFetch = form.layout.some(
                      (s) => s.id !== section.id && s.enableFetchRecord
                    );
                    if (!otherSectionHasFetch) {
                      updateSettings({
                        enableFetchRecord: false,
                      });
                    }
                  }
                }}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Enable a "Fetch Record" search button in the Interactive Preview to search records by ID/MRN and auto-populate this section.
            </p>

            {section.enableFetchRecord && (
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Database Entity / Table
                  </label>
                  <select
                    value={section.fetchEntity || form.settings?.primaryEntity || 'PATIENT'}
                    onChange={(e) => {
                      const table = e.target.value;
                      const pk = table === 'PATIENT' ? 'PATIENT_ID' : undefined;
                      loadColumnsForTable(table);
                      updateSection(section.id, {
                        fetchEntity: table,
                        fetchPrimaryKey: pk,
                      });
                      updateSettings({
                        primaryEntity: table,
                        primaryKeyColumn: pk,
                      });
                    }}
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {availableTables.map((t) => (
                      <option key={t.table} value={t.table}>
                        {t.table}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Lookup Primary Key Column
                  </label>
                  <select
                    value={section.fetchPrimaryKey || form.settings?.primaryKeyColumn || 'PATIENT_ID'}
                    onChange={(e) => {
                      const pk = e.target.value;
                      updateSection(section.id, { fetchPrimaryKey: pk });
                      updateSettings({ primaryKeyColumn: pk });
                    }}
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="PATIENT_ID">PATIENT_ID (MRN / Patient ID)</option>
                    <option value="MRNO">MRNO (Medical Record Number)</option>
                    {(columnsByTable[section.fetchEntity || form.settings?.primaryEntity || 'PATIENT'] || [])
                      .filter((c) => c.column !== 'PATIENT_ID' && c.column !== 'MRNO')
                      .map((c) => (
                        <option key={c.column} value={c.column}>
                          {c.column} {c.isPrimaryKey ? '(PK)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Fetch Record button will be active in Preview!</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => deleteSection(section.id)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Section</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Case 3: Field Inspector
  const field: FormField | undefined = selectedId ? form.fields[selectedId] : undefined;
  if (!field) return null;

  const handleOptionChange = (index: number, key: 'label' | 'value', val: string) => {
    if (!field.options) return;
    const newOptions = [...field.options];
    newOptions[index] = { ...newOptions[index], [key]: val };
    updateField(field.id, { options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions: FieldOption[] = [
      ...(field.options || []),
      {
        label: `Option ${(field.options?.length || 0) + 1}`,
        value: `option_${(field.options?.length || 0) + 1}`,
      },
    ];
    updateField(field.id, { options: newOptions });
  };

  const handleDeleteOption = (index: number) => {
    if (!field.options) return;
    const newOptions = field.options.filter((_, i) => i !== index);
    updateField(field.id, { options: newOptions });
  };

  // Table Column Handlers
  const handleAddTableColumn = () => {
    const currentCols = field.tableConfig?.columns || [];
    const colNumber = currentCols.length + 1;
    const colId = `col_${Date.now().toString(36).slice(-4)}_${colNumber}`;
    const newCol: TableColumn = {
      id: colId,
      key: colId,
      label: `Column ${colNumber}`,
      type: 'text',
    };
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { allowAddRows: true, defaultRows: [] }),
        columns: [...currentCols, newCol],
      },
    });
  };

  const handleUpdateTableColumn = (index: number, updates: Partial<TableColumn>) => {
    if (!field.tableConfig?.columns) return;
    const updated = [...field.tableConfig.columns];
    updated[index] = { ...updated[index], ...updates };
    updateField(field.id, {
      tableConfig: {
        ...field.tableConfig,
        columns: updated,
      },
    });
  };

  const handleDeleteTableColumn = (index: number) => {
    if (!field.tableConfig?.columns) return;
    const updated = field.tableConfig.columns.filter((_, i) => i !== index);
    updateField(field.id, {
      tableConfig: {
        ...field.tableConfig,
        columns: updated,
      },
    });
  };

  // Table Row & Predefined Cell Data Handlers
  const handleAddTableRow = () => {
    const columns = field.tableConfig?.columns || [];
    const currentRows = field.tableConfig?.defaultRows || [];
    const newRow: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const colKey = col.key || col.id || `col_${idx}`;
      newRow[colKey] = '';
    });
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: [...currentRows, newRow],
      },
    });
  };

  const handleUpdateTableCell = (rowIndex: number, colKey: string, value: any) => {
    const currentRows = [...(field.tableConfig?.defaultRows || [])];
    if (!currentRows[rowIndex]) {
      currentRows[rowIndex] = {};
    }
    currentRows[rowIndex] = {
      ...currentRows[rowIndex],
      [colKey]: value,
    };
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: currentRows,
      },
    });
  };

  const handleToggleRowHeading = (rowIndex: number) => {
    const currentRows = [...(field.tableConfig?.defaultRows || [])];
    if (!currentRows[rowIndex]) return;
    const isHeading = Boolean(currentRows[rowIndex]._isHeader);
    currentRows[rowIndex] = {
      ...currentRows[rowIndex],
      _isHeader: !isHeading,
      _rowType: !isHeading ? 'heading' : 'data',
    };
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: currentRows,
      },
    });
  };

  const handleToggleCellHeader = (rowIndex: number, colKey: string) => {
    const currentRows = [...(field.tableConfig?.defaultRows || [])];
    if (!currentRows[rowIndex]) return;
    const headerCols: string[] = Array.isArray(currentRows[rowIndex]._headerCols)
      ? [...currentRows[rowIndex]._headerCols]
      : [];
    const idx = headerCols.indexOf(colKey);
    if (idx >= 0) {
      headerCols.splice(idx, 1);
    } else {
      headerCols.push(colKey);
    }
    currentRows[rowIndex] = {
      ...currentRows[rowIndex],
      _headerCols: headerCols,
    };
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: currentRows,
      },
    });
  };

  const handleDeleteTableRow = (rowIndex: number) => {
    const currentRows = (field.tableConfig?.defaultRows || []).filter((_, i) => i !== rowIndex);
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: currentRows,
      },
    });
  };

  const handleMoveTableRow = (rowIndex: number, direction: 'up' | 'down') => {
    const currentRows = [...(field.tableConfig?.defaultRows || [])];
    const targetIdx = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    if (targetIdx < 0 || targetIdx >= currentRows.length) return;
    const temp = currentRows[rowIndex];
    currentRows[rowIndex] = currentRows[targetIdx];
    currentRows[targetIdx] = temp;
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: currentRows,
      },
    });
  };

  return (
    <aside className="w-80 bg-white/95 border-l border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none transition-colors shadow-xs">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
            {field.type.slice(0, 2)}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
              {field.type} Field
            </span>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{field.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => duplicateField(field.id)}
            title="Duplicate Field"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => deleteField(field.id)}
            title="Delete Field"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Basic Properties */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Field Label
            </label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Field Key / Name (JSON Payload)
            </label>
            <input
              type="text"
              value={field.name}
              onChange={(e) => updateField(field.id, { name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {field.type !== 'divider' && field.type !== 'heading' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Help / Instructions Text
                </label>
                <input
                  type="text"
                  value={field.helpText || ''}
                  onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {field.type === 'heading' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Subtitle / Description
              </label>
              <textarea
                rows={2}
                value={field.helpText || ''}
                onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Options Editor (for select, radio, checkbox) */}
        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Options Choices
              </h4>
              <button
                type="button"
                onClick={handleAddOption}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>Add Option</span>
              </button>
            </div>

            <div className="space-y-2">
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={opt.label}
                    placeholder="Display Label"
                    onChange={(e) => handleOptionChange(idx, 'label', e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={opt.value}
                    placeholder="Value"
                    onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                    className="w-24 bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-slate-400 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteOption(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table Columns Editor */}
        {field.type === 'table' && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Table Columns ({field.tableConfig?.columns?.length || 0})
                </h4>
              </div>
              <button
                type="button"
                onClick={handleAddTableColumn}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>Add Column</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {(field.tableConfig?.columns || []).map((col, idx) => (
                <div key={col.key || idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-850/60 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <input
                      type="text"
                      value={col.label}
                      placeholder="Column Header"
                      onChange={(e) => handleUpdateTableColumn(idx, { label: e.target.value })}
                      className="flex-1 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteTableColumn(idx)}
                      disabled={(field.tableConfig?.columns?.length || 0) <= 1}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400"
                      title="Delete Column"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={col.type}
                      onChange={(e) => handleUpdateTableColumn(idx, { type: e.target.value as any })}
                      className="flex-1 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                      <option value="text">Text Cell</option>
                      <option value="number">Number Cell</option>
                      <option value="date">Date Cell</option>
                      <option value="heading">Heading / Fixed Label</option>
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(col.required)}
                        onChange={(e) => handleUpdateTableColumn(idx, { required: e.target.checked })}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Req</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Predefined Rows & Cell Content Editor */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Rows className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Predefined Rows & Cells ({field.tableConfig?.defaultRows?.length || 0})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddTableRow}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Row</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Define the initial data, section headings, or fixed row labels inside each cell.
              </p>

              {(!field.tableConfig?.defaultRows || field.tableConfig.defaultRows.length === 0) ? (
                <div className="p-3 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                  No predefined rows yet.
                  <button
                    type="button"
                    onClick={handleAddTableRow}
                    className="block mx-auto mt-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    + Add first row with cell values
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {field.tableConfig.defaultRows.map((row, rIdx) => {
                    const isHeadingRow = Boolean(row._isHeader);
                    const columns = field.tableConfig?.columns || [];

                    return (
                      <div
                        key={rIdx}
                        className={`p-2.5 rounded-lg border transition-all ${
                          isHeadingRow
                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-850/60 dark:border-slate-800'
                        } space-y-2`}
                      >
                        {/* Row Title & Actions */}
                        <div className="flex items-center justify-between gap-1 border-b border-slate-200/60 dark:border-slate-700/50 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              Row #{rIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRowHeading(rIdx)}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                                isHeadingRow
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                              }`}
                              title="Toggle full-width section header row"
                            >
                              {isHeadingRow ? 'Section Heading' : 'Data Row'}
                            </button>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveTableRow(rIdx, 'up')}
                              disabled={rIdx === 0}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTableRow(rIdx, 'down')}
                              disabled={rIdx === (field.tableConfig?.defaultRows?.length || 0) - 1}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTableRow(rIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* If Section Heading Row */}
                        {isHeadingRow ? (
                          <div>
                            <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-semibold uppercase">
                              Section Heading Title
                            </label>
                            <input
                              type="text"
                              value={row._headerText || row[columns[0]?.key || columns[0]?.id] || ''}
                              placeholder="e.g. VITAL SIGNS / PRE-TRANSFUSION"
                              onChange={(e) => {
                                const val = e.target.value;
                                const firstKey = columns[0]?.key || columns[0]?.id || 'col_1';
                                handleUpdateTableCell(rIdx, '_headerText', val);
                                handleUpdateTableCell(rIdx, firstKey, val);
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-xs font-semibold text-blue-900 dark:text-blue-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          /* Column Cells */
                          <div className="space-y-1.5 pt-0.5">
                            {columns.map((col, cIdx) => {
                              const colKey = col.key || col.id || `col_${cIdx}`;
                              const cellVal = row[colKey] ?? '';
                              const isCellHeader =
                                (Array.isArray(row._headerCols) && row._headerCols.includes(colKey)) ||
                                col.type === 'heading';

                              return (
                                <div key={colKey} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[170px]" title={col.label}>
                                      {col.label}
                                    </span>
                                    <label
                                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                                      title="Display cell as fixed heading/label instead of editable input"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isCellHeader}
                                        disabled={col.type === 'heading'}
                                        onChange={() => handleToggleCellHeader(rIdx, colKey)}
                                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 w-3 h-3 cursor-pointer"
                                      />
                                      <span>Fixed Label</span>
                                    </label>
                                  </div>
                                  <input
                                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                    value={cellVal}
                                    placeholder={`Predefined ${col.label}...`}
                                    onChange={(e) =>
                                      handleUpdateTableCell(
                                        rIdx,
                                        colKey,
                                        col.type === 'number'
                                          ? (e.target.value === '' ? '' : Number(e.target.value))
                                          : e.target.value
                                      )
                                    }
                                    className={`w-full bg-white dark:bg-slate-900 border ${
                                      isCellHeader
                                        ? 'border-indigo-300 dark:border-indigo-700 font-semibold text-indigo-900 dark:text-indigo-200'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                    } rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2">
              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-850/60 dark:border-slate-800 cursor-pointer">
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">Allow Dynamic Rows</span>
                <input
                  type="checkbox"
                  checked={field.tableConfig?.allowAddRows !== false}
                  onChange={(e) =>
                    updateField(field.id, {
                      tableConfig: {
                        ...(field.tableConfig || { columns: [], defaultRows: [] }),
                        allowAddRows: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* Validation Panel */}
        {field.type !== 'divider' && field.type !== 'heading' && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Validation Rules
              </h4>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-850/60 dark:border-slate-800">
              <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">Required Field</span>
              <input
                type="checkbox"
                checked={Boolean(field.validation?.required)}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: { required: e.target.checked },
                  })
                }
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Min Value / Len</label>
                <input
                  type="number"
                  value={field.validation?.min !== undefined ? field.validation.min : ''}
                  onChange={(e) =>
                    updateField(field.id, {
                      validation: {
                        min: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Max Value / Len</label>
                <input
                  type="number"
                  value={field.validation?.max !== undefined ? field.validation.max : ''}
                  onChange={(e) =>
                    updateField(field.id, {
                      validation: {
                        max: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Regex Pattern</label>
              <input
                type="text"
                value={field.validation?.pattern || ''}
                placeholder="e.g. ^[0-9]+$"
                onChange={(e) =>
                  updateField(field.id, {
                    validation: { pattern: e.target.value || undefined },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Custom Error Message</label>
              <input
                type="text"
                value={field.validation?.customErrorMessage || ''}
                placeholder="Please enter a valid value."
                onChange={(e) =>
                  updateField(field.id, {
                    validation: { customErrorMessage: e.target.value || undefined },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Oracle Data Binding Section (Step 5) */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Oracle Data Binding
            </h4>
          </div>

          <div>
            <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">
              Data Source
            </label>
            <select
              value={field.dataBinding?.source === 'oracle' ? 'oracle' : 'none'}
              onChange={(e) => {
                const isOracle = e.target.value === 'oracle';
                if (isOracle) {
                  const defaultTable = form.settings.primaryEntity || availableTables[0]?.table || '';
                  if (defaultTable) loadColumnsForTable(defaultTable);
                  updateField(field.id, {
                    dataBinding: {
                      source: 'oracle',
                      table: defaultTable,
                      column: '',
                      mode: 'read-write',
                      oracleType: 'STRING',
                    },
                  });
                } else {
                  updateField(field.id, { dataBinding: null });
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="none">None (Local / Static Field)</option>
              <option value="oracle">Oracle Database</option>
            </select>
          </div>

          {field.dataBinding?.source === 'oracle' && (
            <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/50 space-y-2.5">
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Bound Table (Allowlisted)
                </label>
                <select
                  value={field.dataBinding.table || ''}
                  onChange={(e) => {
                    const table = e.target.value;
                    if (table) loadColumnsForTable(table);
                    updateField(field.id, {
                      dataBinding: {
                        ...(field.dataBinding as any),
                        table,
                        column: '',
                      },
                    });
                  }}
                  className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Allowlisted Table --</option>
                  {availableTables.map((t) => (
                    <option key={t.table} value={t.table}>
                      {t.table}
                    </option>
                  ))}
                </select>
              </div>

              {field.dataBinding.table && (
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Bound Column
                  </label>
                  <select
                    value={field.dataBinding.column || ''}
                    onChange={(e) => {
                      const colName = e.target.value;
                      const colMeta = (columnsByTable[field.dataBinding?.table || ''] || []).find(
                        (c) => c.column === colName
                      );
                      updateField(field.id, {
                        dataBinding: {
                          ...(field.dataBinding as any),
                          column: colName,
                          oracleType: colMeta?.oracleType || field.dataBinding?.oracleType || 'STRING',
                        },
                      });
                    }}
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {(columnsByTable[field.dataBinding.table] || []).map((c) => (
                      <option key={c.column} value={c.column}>
                        {c.column} {c.isPrimaryKey ? '(PK)' : `(${c.oracleType})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Binding Mode
                  </label>
                  <select
                    value={field.dataBinding.mode || 'read-write'}
                    onChange={(e) =>
                      updateField(field.id, {
                        dataBinding: {
                          ...(field.dataBinding as any),
                          mode: e.target.value as DataBindingMode,
                        },
                      })
                    }
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="read-write">Read & Write</option>
                    <option value="read">Read Only</option>
                    <option value="write">Write Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Oracle Bind Type
                  </label>
                  <select
                    value={field.dataBinding.oracleType || 'STRING'}
                    onChange={(e) =>
                      updateField(field.id, {
                        dataBinding: {
                          ...(field.dataBinding as any),
                          oracleType: e.target.value as OracleBindType,
                        },
                      })
                    }
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="STRING">STRING</option>
                    <option value="NUMBER">NUMBER</option>
                    <option value="DATE">DATE</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Options Binding for Select and Radio fields */}
        {(field.type === 'select' || field.type === 'radio') && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Link className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider">
                Options Come From (Lookup)
              </h4>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Load from Oracle Lookup Table
              </span>
              <input
                type="checkbox"
                checked={Boolean(field.optionsBinding?.table)}
                onChange={(e) => {
                  if (e.target.checked) {
                    const defaultTable = 'DRUG_MASTER';
                    loadColumnsForTable(defaultTable);
                    updateField(field.id, {
                      optionsBinding: {
                        table: defaultTable,
                        valueColumn: 'DRUG_GEN_ID',
                        labelColumn: 'DRUG_NAME',
                      },
                    });
                  } else {
                    updateField(field.id, { optionsBinding: null });
                  }
                }}
                className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {field.optionsBinding && (
              <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Lookup Table (Allowlisted)
                  </label>
                  <select
                    value={field.optionsBinding.table || ''}
                    onChange={(e) => {
                      const table = e.target.value;
                      if (table) loadColumnsForTable(table);
                      updateField(field.id, {
                        optionsBinding: {
                          table,
                          valueColumn: '',
                          labelColumn: '',
                        },
                      });
                    }}
                    className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Lookup Table --</option>
                    {availableTables.map((t) => (
                      <option key={t.table} value={t.table}>
                        {t.table}
                      </option>
                    ))}
                  </select>
                </div>

                {field.optionsBinding.table && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Value Column
                      </label>
                      <select
                        value={field.optionsBinding.valueColumn || ''}
                        onChange={(e) =>
                          updateField(field.id, {
                            optionsBinding: {
                              ...(field.optionsBinding as any),
                              valueColumn: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Value Col --</option>
                        {(columnsByTable[field.optionsBinding.table] || []).map((c) => (
                          <option key={c.column} value={c.column}>
                            {c.column}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Label Column
                      </label>
                      <select
                        value={field.optionsBinding.labelColumn || ''}
                        onChange={(e) =>
                          updateField(field.id, {
                            optionsBinding: {
                              ...(field.optionsBinding as any),
                              labelColumn: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Label Col --</option>
                        {(columnsByTable[field.optionsBinding.table] || []).map((c) => (
                          <option key={c.column} value={c.column}>
                            {c.column}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

return (
  <>
    {renderContent()}
    <SqlQueryEditorModal
      isOpen={isSqlModalOpen}
      onClose={() => {
        setIsSqlModalOpen(false);
        setEditingQuery(null);
      }}
      form={form}
      initialQuery={editingQuery}
      onSave={(query) => {
        if (editingQuery) {
          updateSqlQuery(query.id, query);
        } else {
          addSqlQuery(query);
        }
      }}
    />
  </>
);
};
