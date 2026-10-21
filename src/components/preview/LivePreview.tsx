import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileJson,
  X,
  Plus,
  Trash2,
  Database,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useFormStore } from '../../store/useFormStore';
import type { FormField } from '../../types/schema';
import { DownloadPdfButton } from '../common/DownloadPdfButton';
import { PainAssessmentInput } from '../painAssessment/PainAssessmentInput';

export const LivePreview: React.FC = () => {
  const { form, setPreviewMode } = useFormStore();
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    Object.values(form.fields).forEach((f) => {
      if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === 'checkbox') {
        initial[f.name] = [];
      } else if (f.type === 'table') {
        initial[f.name] =
          f.tableConfig?.defaultRows && f.tableConfig.defaultRows.length > 0
            ? JSON.parse(JSON.stringify(f.tableConfig.defaultRows))
            : [{}];
      } else if (f.type === 'pain_assessment') {
        initial[f.name] = f.defaultValue || { painPresent: '', location: '', score: null };
      } else {
        initial[f.name] = '';
      }
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const autoFetchTimerRef = useRef<any>(null);

  // Oracle Integration State
  const [loadedOptions, setLoadedOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [prefillRecordId, setPrefillRecordId] = useState('');
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{
    loading: boolean;
    error?: string;
    successMsg?: string;
    pk?: string;
  } | null>(null);

  // Auto-resolve primaryEntity and primaryKeyColumn from sections, settings, bindings, or label heuristics
  const sectionWithFetch = form.layout.find((s) => s.enableFetchRecord);
  const hasFetchEnabled = Boolean(
    form.settings?.enableFetchRecord ||
    sectionWithFetch ||
    form.settings?.primaryEntity ||
    Object.values(form.fields).some((f) => f.dataBinding?.source === 'oracle')
  );

  const effectivePrimaryEntity =
    form.settings?.primaryEntity ||
    sectionWithFetch?.fetchEntity ||
    Object.values(form.fields).find(
      (f) => f.dataBinding?.source === 'oracle' && f.dataBinding?.table
    )?.dataBinding?.table ||
    (hasFetchEnabled ? 'PATIENT' : undefined) ||
    (Object.values(form.fields).some((f) => {
      const lbl = (f.label || '').toLowerCase();
      const nm = (f.name || '').toLowerCase();
      return lbl.includes('patient') || lbl.includes('mrn') || nm.includes('patient') || nm.includes('mrn');
    })
      ? 'PATIENT'
      : undefined);

  const effectivePrimaryKeyColumn =
    form.settings?.primaryKeyColumn ||
    sectionWithFetch?.fetchPrimaryKey ||
    Object.values(form.fields).find(
      (f) =>
        f.dataBinding?.source === 'oracle' &&
        f.dataBinding?.table === effectivePrimaryEntity &&
        (f.dataBinding?.column === 'PATIENT_ID' || f.dataBinding?.column === 'MRNO')
    )?.dataBinding?.column ||
    'PATIENT_ID';

  useEffect(() => {
    // 1. Sync form definition to backend (including effective primaryEntity if missing)
    const formToSync = {
      ...form,
      settings: {
        ...form.settings,
        enableFetchRecord: hasFetchEnabled || form.settings?.enableFetchRecord,
        primaryEntity: effectivePrimaryEntity || form.settings?.primaryEntity,
        primaryKeyColumn: effectivePrimaryKeyColumn || form.settings?.primaryKeyColumn,
      },
    };

    fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToSync),
    }).catch((err) => console.warn('[LivePreview] Form sync notice:', err));

    // 2. Fetch batched options for fields with optionsBinding
    const hasOptionsBinding = Object.values(form.fields).some((f) => f.optionsBinding?.table);
    if (hasOptionsBinding) {
      fetch(`/api/forms/${form.id}/options`, {
        headers: { 'x-api-key': 'formcraft_secret_key_2026' },
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) {
            setLoadedOptions(json.data);
          }
        })
        .catch((err) => console.warn('[LivePreview] Options fetch notice:', err));
    }
  }, [form, effectivePrimaryEntity, effectivePrimaryKeyColumn, hasFetchEnabled]);

  const [runningPreviewQueryId, setRunningPreviewQueryId] = useState<string | null>(null);

  const runLiveSqlQuery = useCallback(
    async (queryId: string, currentValues: Record<string, any>) => {
      const query = (form.sqlQueries || []).find((q) => q.id === queryId && q.enabled !== false);
      if (!query) return;

      setRunningPreviewQueryId(queryId);
      try {
        await fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }).catch(() => { });

        const res = await fetch(`/api/forms/${form.id}/queries/${queryId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'formcraft_secret_key_2026',
          },
          body: JSON.stringify({ parameters: currentValues }),
        });

        const json = await res.json();
        if (json.success && json.mappedValues && Object.keys(json.mappedValues).length > 0) {
          setFormData((prev) => {
            const next = { ...prev };
            for (const [fKey, val] of Object.entries(json.mappedValues)) {
              if (val !== undefined && val !== null) {
                next[fKey] = val;
              }
            }
            return next;
          });
          setDbStatus({
            loading: false,
            successMsg: `Populated form fields from SQL query "${query.name || 'database query'}".`,
          });
        }
      } catch (err: any) {
        console.warn(`[LivePreview] SQL query notice:`, err.message);
      } finally {
        setRunningPreviewQueryId(null);
      }
    },
    [form]
  );

  useEffect(() => {
    const loadQueries = (form.sqlQueries || []).filter(
      (q) => q.enabled !== false && q.executeOn === 'formLoad'
    );
    if (loadQueries.length === 0) return;
    loadQueries.forEach((q) => {
      runLiveSqlQuery(q.id, formData);
    });
  }, [form.sqlQueries, runLiveSqlQuery]);

  const handlePrefill = async (customId?: string): Promise<Record<string, any> | null> => {
    const idToFetch = (typeof customId === 'string' ? customId : prefillRecordId).trim();
    if (!idToFetch) return null;
    setDbStatus({ loading: true, error: undefined, successMsg: undefined });
    try {
      // Ensure backend form definition is updated before fetching record
      await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          settings: {
            ...form.settings,
            enableFetchRecord: hasFetchEnabled || form.settings?.enableFetchRecord,
            primaryEntity: effectivePrimaryEntity || form.settings?.primaryEntity || 'PATIENT',
            primaryKeyColumn: effectivePrimaryKeyColumn || form.settings?.primaryKeyColumn || 'PATIENT_ID',
          },
        }),
      }).catch(() => { });

      const res = await fetch(
        `/api/forms/${form.id}/data/${encodeURIComponent(idToFetch)}`,
        {
          headers: { 'x-api-key': 'formcraft_secret_key_2026' },
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Record not found in Oracle database.');
      }
      setFormData((prev) => ({ ...prev, ...json.data }));
      setActiveRecordId(idToFetch);
      setPrefillRecordId(idToFetch);
      setDbStatus({
        loading: false,
        successMsg: `Loaded patient record "${idToFetch}" from Oracle table "${effectivePrimaryEntity || 'PATIENT'}".`,
      });
      return json.data;
    } catch (err: any) {
      setDbStatus({
        loading: false,
        error: err.message || 'Failed to fetch record from Oracle.',
      });
      return null;
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (field.type === 'heading' || field.type === 'divider') return null;

    const rules = field.validation;
    if (!rules) return null;

    // Required check
    if (rules.required) {
      if (field.type === 'pain_assessment') {
        const pVal = typeof value === 'object' && value !== null ? value : {};
        const hasPresence = Boolean(pVal.painPresent);
        const hasLoc = Boolean(pVal.location && String(pVal.location).trim());
        const hasScore = pVal.score !== null && pVal.score !== undefined && pVal.score !== '';
        if (!hasPresence && !hasLoc && !hasScore) {
          return rules.customErrorMessage || `${field.label} is required.`;
        }
      } else if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return rules.customErrorMessage || `${field.label} is required.`;
      }
    }

    // If empty and not required, skip further checks
    if (value === '' || value === undefined || value === null) {
      return null;
    }

    // Number min/max
    if (field.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) return 'Please enter a valid number.';
      if (rules.min !== undefined && num < rules.min) {
        return rules.customErrorMessage || `Minimum value is ${rules.min}.`;
      }
      if (rules.max !== undefined && num > rules.max) {
        return rules.customErrorMessage || `Maximum value is ${rules.max}.`;
      }
    }

    // Text min/max length
    if (field.type === 'text' || field.type === 'textarea') {
      const str = String(value);
      if (rules.min !== undefined && str.length < rules.min) {
        return (
          rules.customErrorMessage || `Must be at least ${rules.min} characters.`
        );
      }
      if (rules.max !== undefined && str.length > rules.max) {
        return (
          rules.customErrorMessage || `Cannot exceed ${rules.max} characters.`
        );
      }
    }

    // Regex pattern
    if (rules.pattern && (field.type === 'text' || field.type === 'textarea')) {
      try {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(String(value))) {
          return rules.customErrorMessage || 'Value is invalid format.';
        }
      } catch (err) {
        console.error('Invalid pattern', err);
      }
    }

    return null;
  };

  const handleInputChange = (field: FormField, value: any) => {
    const nextFormData = { ...formData, [field.name]: value };
    setFormData(nextFormData);

    if (errors[field.name]) {
      const err = validateField(field, value);
      setErrors((prev) => {
        const copy = { ...prev };
        if (!err) delete copy[field.name];
        else copy[field.name] = err;
        return copy;
      });
    }

    // Trigger matching fieldChange queries by field.name or field.id
    if (value !== '' && value !== null && value !== undefined) {
      const matchingQueries = (form.sqlQueries || []).filter(
        (q) =>
          q.enabled !== false &&
          q.executeOn === 'fieldChange' &&
          (q.triggerFieldKey === field.name || q.triggerFieldKey === field.id)
      );
      matchingQueries.forEach((q) => {
        runLiveSqlQuery(q.id, nextFormData);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-fetch if patient ID is present but details haven't been fetched yet
    if (effectivePrimaryEntity) {
      const pkField = Object.values(form.fields).find(
        (f) =>
          f.dataBinding?.column === 'PATIENT_ID' ||
          f.dataBinding?.column === 'MRNO' ||
          f.name.toLowerCase().includes('patient_id') ||
          f.label.toLowerCase().includes('patient_id') ||
          f.label.toLowerCase().includes('mrn') ||
          (f.type === 'number' && (f.label.toLowerCase().includes('patient') || f.label.toLowerCase().includes('id')))
      );
      const pkVal = pkField ? String(formData[pkField.name] || '').trim() : '';
      if (pkVal && !activeRecordId) {
        const fetched = await handlePrefill(pkVal);
        if (fetched) {
          // Details loaded successfully!
          return;
        }
      }
    }

    const newErrors: Record<string, string> = {};
    Object.values(form.fields).forEach((f) => {
      const err = validateField(f, formData[f.name]);
      if (err) {
        newErrors[f.name] = err;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If bound to Oracle Primary Entity, submit directly to live Express API
    if (effectivePrimaryEntity) {
      setDbStatus({ loading: true, error: undefined, successMsg: undefined });
      const isUpdate = Boolean(activeRecordId);
      const url = isUpdate
        ? `/api/forms/${form.id}/data/${encodeURIComponent(activeRecordId!)}`
        : `/api/forms/${form.id}/data`;
      const method = isUpdate ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'formcraft_secret_key_2026',
        },
        body: JSON.stringify({ data: formData }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) {
            throw new Error(json.error || 'Failed to save to Oracle database.');
          }
          const pk = json.data?.primaryKey || activeRecordId;
          setDbStatus({
            loading: false,
            successMsg: isUpdate
              ? `Record "${pk}" successfully updated in Oracle table "${effectivePrimaryEntity}".`
              : `New record successfully created in Oracle table "${effectivePrimaryEntity}" with ID: ${pk}.`,
            pk,
          });
          setSubmittedData(formData);
        })
        .catch((err) => {
          setDbStatus({
            loading: false,
            error: err.message || 'Database error occurred during save.',
          });
        });

      return;
    }

    // Successful local submission (Phase 1 / Standalone mode)
    setSubmittedData(formData);

    if (form.settings.submitAction === 'print') {
      window.print();
    }
  };

  const handleDownloadJson = () => {
    if (!submittedData) return;
    const blob = new Blob([JSON.stringify(submittedData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.id || 'form_response'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    const initial: Record<string, any> = {};
    Object.values(form.fields).forEach((f) => {
      if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === 'checkbox') {
        initial[f.name] = [];
      } else if (f.type === 'table') {
        initial[f.name] =
          f.tableConfig?.defaultRows && f.tableConfig.defaultRows.length > 0
            ? JSON.parse(JSON.stringify(f.tableConfig.defaultRows))
            : [{}];
      } else {
        initial[f.name] = '';
      }
    });
    setFormData(initial);
    setErrors({});
    setSubmittedData(null);
  };

  const theme = form.settings.theme || {
    primaryColor: '#3b82f6',
    borderRadius: 'md',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const radiusClass =
    theme.borderRadius === 'none'
      ? 'rounded-none'
      : theme.borderRadius === 'sm'
        ? 'rounded-sm'
        : theme.borderRadius === 'lg'
          ? 'rounded-2xl'
          : theme.borderRadius === 'full'
            ? 'rounded-full'
            : 'rounded-xl';

  return (
    <div className="flex-1 bg-slate-100/80 dark:bg-slate-950 overflow-y-auto p-6 md:p-12 flex flex-col items-center transition-colors">
      {/* Banner */}
      <div className="w-full max-w-3xl mb-6 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Live Interactive Form Preview
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Test validations, interactions, and instant submission simulation.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreviewMode(false)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 dark:border-transparent transition-colors shadow-xs"
        >
          Return to Canvas
        </button>
      </div>

      {/* Oracle Integration Prefill & Status Card */}
      {(hasFetchEnabled || Boolean(effectivePrimaryEntity)) && (
        <div className="w-full max-w-3xl mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Oracle Database Connected: <code className="text-indigo-600 dark:text-indigo-400 font-bold">{effectivePrimaryEntity || 'PATIENT'}</code>
              </span>
              {activeRecordId && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  Editing Record #{activeRecordId}
                </span>
              )}
            </div>

            {activeRecordId && (
              <button
                type="button"
                onClick={() => {
                  setActiveRecordId(null);
                  setPrefillRecordId('');
                  handleReset();
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                + Switch to New Record (Insert)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              id="top-fetch-record-input"
              placeholder={`Enter ${effectivePrimaryKeyColumn || 'record ID'} (e.g. 473585) to prefill...`}
              value={prefillRecordId}
              onChange={(e) => setPrefillRecordId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePrefill())}
              className="flex-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              id="top-fetch-record-btn"
              disabled={!prefillRecordId.trim() || dbStatus?.loading}
              onClick={() => handlePrefill()}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {dbStatus?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Fetch Record</span>
            </button>
          </div>

          {dbStatus?.error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dbStatus.error}</span>
            </div>
          )}

          {dbStatus?.successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{dbStatus.successMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Button Click SQL Queries in Preview */}
      {(form.sqlQueries || []).some((q) => q.enabled !== false && q.executeOn === 'buttonClick') && (
        <div className="w-full max-w-3xl flex items-center gap-2 flex-wrap bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
          <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
            Database Queries:
          </span>
          {(form.sqlQueries || [])
            .filter((q) => q.enabled !== false && q.executeOn === 'buttonClick')
            .map((q) => (
              <button
                key={q.id}
                type="button"
                disabled={runningPreviewQueryId === q.id}
                onClick={() => runLiveSqlQuery(q.id, formData)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {runningPreviewQueryId === q.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                <span>{q.buttonLabel || q.name || 'Execute Query'}</span>
              </button>
            ))}
        </div>
      )}

      {/* Static Floating Top-Left Download PDF Button (always available) */}
      <DownloadPdfButton
        form={form}
        formData={formData}
        dynamicOptions={loadedOptions}
        metadata={{
          recordId: activeRecordId || undefined,
        }}
        targetElementId="preview-form-printable-container"
        formTitle={form.title}
        recordId={activeRecordId}
        variant="floating"
      />

      {/* Form Container Container */}
      <div
        id="preview-form-printable-container"
        className="w-full max-w-3xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-3xl p-8 md:p-10 shadow-xl space-y-8 relative"
      >
        {/* Form Title & Header with Top-Left Download Button */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <DownloadPdfButton
              form={form}
              formData={formData}
              dynamicOptions={loadedOptions}
              metadata={{
                recordId: activeRecordId || undefined,
              }}
              targetElementId="preview-form-printable-container"
              formTitle={form.title}
              recordId={activeRecordId}
              variant="header"
            />
            {activeRecordId && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                Record #{activeRecordId}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{form.description}</p>
          )}
        </div>

        {/* The Live Form */}
        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {form.layout.map((section) => (
            <div key={section.id} className="space-y-4">
              {section.title && (
                <div className="border-b border-slate-200 dark:border-slate-800/80 pb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {section.title}
                    </h2>
                    {section.enableFetchRecord && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/80 dark:border-indigo-800/80 flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        <span>Fetch {section.fetchEntity || 'PATIENT'} Enabled</span>
                      </span>
                    )}
                  </div>
                  {section.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                  )}
                </div>
              )}

              {/* Section-level Fetch Record Toolbar if enabled on this section */}
              {section.enableFetchRecord && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                        Fetch {section.fetchEntity || 'PATIENT'} Record
                      </span>
                      <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300">
                        Enter {section.fetchPrimaryKey || 'PATIENT_ID'} or MRN to auto-fill fields
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                      type="text"
                      id={`section-fetch-input-${section.id}`}
                      placeholder={`Enter ${section.fetchPrimaryKey || 'PATIENT_ID'} / MRN (e.g. 473585)...`}
                      value={prefillRecordId}
                      onChange={(e) => setPrefillRecordId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handlePrefill(prefillRecordId);
                        }
                      }}
                      className="flex-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <button
                      type="button"
                      id={`section-fetch-btn-${section.id}`}
                      disabled={!prefillRecordId.trim() || dbStatus?.loading}
                      onClick={() => handlePrefill(prefillRecordId)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {dbStatus?.loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Fetch Record</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {section.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-4">
                    {row.columns.map((column) => {
                      const colSpanStyle = {
                        gridColumn: `span ${Math.min(
                          12,
                          Math.max(1, column.width)
                        )} / span ${Math.min(12, Math.max(1, column.width))}`,
                      };

                      return (
                        <div key={column.id} style={colSpanStyle} className="space-y-3">
                          {column.fieldIds.map((fId) => {
                            const field = form.fields[fId];
                            if (!field) return null;

                            const value = formData[field.name];
                            const error = errors[field.name];

                            // Heading
                            if (field.type === 'heading') {
                              return (
                                <div key={field.id} className="py-2">
                                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {field.label}
                                  </h3>
                                  {field.helpText && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      {field.helpText}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            // Divider
                            if (field.type === 'divider') {
                              return (
                                <hr key={field.id} className="border-t border-slate-200 dark:border-slate-800 my-2" />
                              );
                            }

                            // Pain Assessment
                            if (field.type === 'pain_assessment') {
                              return (
                                <div key={field.id} className="w-full">
                                  <PainAssessmentInput
                                    value={value}
                                    onChange={(nextVal) => handleInputChange(field, nextVal)}
                                    label={field.label}
                                    helpText={field.helpText}
                                    required={field.validation?.required}
                                    error={error}
                                  />
                                </div>
                              );
                            }

                            const isPkField = Boolean(
                              effectivePrimaryEntity &&
                              (
                                (field.dataBinding?.table &&
                                  field.dataBinding.table.toUpperCase() === effectivePrimaryEntity.toUpperCase() &&
                                  field.dataBinding?.column &&
                                  (field.dataBinding.column.toUpperCase() === effectivePrimaryKeyColumn.toUpperCase() ||
                                    field.dataBinding.column.toUpperCase() === 'PATIENT_ID' ||
                                    field.dataBinding.column.toUpperCase() === 'MRNO')) ||
                                field.name.toLowerCase().includes('patient_id') ||
                                field.label.toLowerCase().includes('patient_id') ||
                                field.label.toLowerCase().includes('mrn') ||
                                (field.type === 'number' && (field.label.toLowerCase().includes('patient') || field.label.toLowerCase().includes('id'))) ||
                                (field.type === 'text' && (field.label.toLowerCase().includes('patient') && field.label.toLowerCase().includes('id')))
                              )
                            );

                            return (
                              <div key={field.id} className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  <span>{field.label}</span>
                                  {field.validation?.required && (
                                    <span className="text-rose-500 font-bold ml-1">*</span>
                                  )}
                                  {isPkField && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800">
                                      Primary Key (Patient ID / MRN)
                                    </span>
                                  )}
                                </label>

                                {/* Inputs */}
                                {field.type === 'text' && (
                                  isPkField ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        name={field.name}
                                        value={value || ''}
                                        placeholder={field.placeholder || 'Enter Patient ID or MRN...'}
                                        onChange={(e) => {
                                          const newVal = e.target.value;
                                          handleInputChange(field, newVal);
                                          setPrefillRecordId(newVal);
                                          if (newVal && newVal.trim().length >= 3) {
                                            clearTimeout(autoFetchTimerRef.current);
                                            autoFetchTimerRef.current = setTimeout(() => {
                                              handlePrefill(newVal);
                                            }, 500);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const val = e.target.value?.trim();
                                          if (val && val !== activeRecordId) {
                                            handlePrefill(val);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handlePrefill(value);
                                          }
                                        }}
                                        className={`flex-1 bg-slate-50 border ${error
                                            ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                            : 'border-slate-300 dark:border-slate-700/80 focus:border-indigo-500'
                                          } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handlePrefill(value)}
                                        disabled={!value || dbStatus?.loading}
                                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                                        title="Fetch patient details from Oracle database"
                                      >
                                        {dbStatus?.loading ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        <span>Fetch Details</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      name={field.name}
                                      value={value || ''}
                                      placeholder={field.placeholder || ''}
                                      onChange={(e) => handleInputChange(field, e.target.value)}
                                      className={`w-full bg-slate-50 border ${error
                                          ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                          : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'
                                        } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors`}
                                    />
                                  )
                                )}

                                {field.type === 'textarea' && (
                                  <textarea
                                    rows={3}
                                    name={field.name}
                                    value={value || ''}
                                    placeholder={field.placeholder || ''}
                                    onChange={(e) => handleInputChange(field, e.target.value)}
                                    className={`w-full bg-slate-50 border ${error
                                        ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                        : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'
                                      } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors resize-none`}
                                  />
                                )}

                                {field.type === 'number' && (
                                  isPkField ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        name={field.name}
                                        value={value !== undefined ? value : ''}
                                        placeholder={field.placeholder || 'Enter Patient ID or MRN...'}
                                        onChange={(e) => {
                                          const newVal = e.target.value;
                                          handleInputChange(field, newVal);
                                          setPrefillRecordId(String(newVal));
                                          if (newVal !== undefined && String(newVal).trim().length >= 3) {
                                            clearTimeout(autoFetchTimerRef.current);
                                            autoFetchTimerRef.current = setTimeout(() => {
                                              handlePrefill(String(newVal));
                                            }, 500);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const val = e.target.value !== undefined ? String(e.target.value).trim() : '';
                                          if (val && val !== activeRecordId) {
                                            handlePrefill(val);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handlePrefill(String(value));
                                          }
                                        }}
                                        className={`flex-1 bg-slate-50 border ${error
                                            ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                            : 'border-slate-300 dark:border-slate-700/80 focus:border-indigo-500'
                                          } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handlePrefill(String(value))}
                                        disabled={value === undefined || value === '' || dbStatus?.loading}
                                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                                        title="Fetch patient details from Oracle database"
                                      >
                                        {dbStatus?.loading ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        <span>Fetch Details</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      type="number"
                                      name={field.name}
                                      value={value !== undefined ? value : ''}
                                      placeholder={field.placeholder || ''}
                                      onChange={(e) => handleInputChange(field, e.target.value)}
                                      className={`w-full bg-slate-50 border ${error
                                          ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                          : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'
                                        } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors`}
                                    />
                                  )
                                )}

                                {field.type === 'date' && (
                                  <input
                                    type="date"
                                    name={field.name}
                                    value={value || ''}
                                    onChange={(e) => handleInputChange(field, e.target.value)}
                                    className={`w-full bg-slate-50 border ${error
                                        ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                        : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'
                                      } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors`}
                                  />
                                )}


                                {field.type === 'time' && (() => {
                                  // Parse stored value "HH:MM AM" or "HH:MM PM"
                                  const raw = (value as string) || '';
                                  const parts = raw.split(' ');
                                  const hhmm = parts[0] || '';
                                  const [hhStr, mmStr] = hhmm.split(':');
                                  const hour = hhStr || '';
                                  const minute = mmStr || '';
                                  const period = (parts[1] === 'PM' ? 'PM' : parts[1] === 'AM' ? 'AM' : '') as 'AM' | 'PM' | '';

                                  const buildValue = (h: string, m: string, p: string) => {
                                    if (!h && !m && !p) return '';
                                    return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${p || 'AM'}`;
                                  };

                                  const selCls = `px-2 py-2 text-xs bg-slate-50 dark:bg-slate-950 border ${error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'} ${radiusClass} text-slate-900 dark:text-white focus:outline-none transition-colors appearance-none cursor-pointer`;

                                  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
                                  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {/* Hour */}
                                      <select
                                        name={field.name}
                                        value={hour}
                                        onChange={(e) => handleInputChange(field, buildValue(e.target.value, minute, period || 'AM'))}
                                        className={`flex-1 ${selCls}`}
                                      >
                                        <option value="">HH</option>
                                        {hours.map((h) => (
                                          <option key={h} value={h}>{h}</option>
                                        ))}
                                      </select>
                                      <span className="text-slate-400 font-bold text-sm select-none">:</span>
                                      {/* Minute */}
                                      <select
                                        value={minute}
                                        onChange={(e) => handleInputChange(field, buildValue(hour || '12', e.target.value, period || 'AM'))}
                                        className={`flex-1 ${selCls}`}
                                      >
                                        <option value="">MM</option>
                                        {minutes.map((m) => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                      {/* AM / PM */}
                                      <select
                                        value={period}
                                        onChange={(e) => handleInputChange(field, buildValue(hour || '12', minute || '00', e.target.value))}
                                        className={`w-20 ${selCls}`}
                                      >
                                        <option value="">AM/PM</option>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                      </select>
                                    </div>
                                  );
                                })()}




                                {field.type === 'select' && (() => {
                                  const selectOpts =
                                    loadedOptions[field.name]?.length
                                      ? loadedOptions[field.name]
                                      : loadedOptions[field.id]?.length
                                        ? loadedOptions[field.id]
                                        : field.options || [];

                                  return (
                                    <select
                                      name={field.name}
                                      value={value || ''}
                                      onChange={(e) => handleInputChange(field, e.target.value)}
                                      className={`w-full bg-slate-50 border ${error
                                          ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                          : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500'
                                        } dark:bg-slate-950 ${radiusClass} px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors`}
                                    >
                                      <option value="">Choose an option...</option>
                                      {selectOpts.map((opt, i) => (
                                        <option key={i} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })()}

                                {field.type === 'radio' && (() => {
                                  const radioOpts =
                                    loadedOptions[field.name]?.length
                                      ? loadedOptions[field.name]
                                      : loadedOptions[field.id]?.length
                                        ? loadedOptions[field.id]
                                        : field.options || [];

                                  return (
                                    <div className="space-y-2 pt-1">
                                      {radioOpts.map((opt, i) => (
                                        <label
                                          key={i}
                                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                          <input
                                            type="radio"
                                            name={field.name}
                                            value={opt.value}
                                            checked={value === opt.value}
                                            onChange={() => handleInputChange(field, opt.value)}
                                            className="text-blue-600 focus:ring-0 cursor-pointer"
                                          />
                                          <span>{opt.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })()}

                                {field.type === 'checkbox' && (
                                  <div className="space-y-2 pt-1">
                                    {(field.options || []).map((opt, i) => {
                                      const isChecked =
                                        Array.isArray(value) && value.includes(opt.value);
                                      return (
                                        <label
                                          key={i}
                                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            name={field.name}
                                            value={opt.value}
                                            checked={isChecked}
                                            onChange={(e) => {
                                              const currentList = Array.isArray(value)
                                                ? [...value]
                                                : [];
                                              if (e.target.checked) {
                                                currentList.push(opt.value);
                                              } else {
                                                const idx = currentList.indexOf(opt.value);
                                                if (idx !== -1) currentList.splice(idx, 1);
                                              }
                                              handleInputChange(field, currentList);
                                            }}
                                            className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                          />
                                          <span>{opt.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}

                                {field.type === 'table' && (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                          {(field.tableConfig?.columns || []).map((col, cIdx) => (
                                            <th key={col.id || col.key || cIdx} className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                              {col.label}
                                              {col.required && <span className="text-rose-500 ml-0.5">*</span>}
                                            </th>
                                          ))}
                                          {field.tableConfig?.allowAddRows !== false && (
                                            <th className="px-3 py-2 text-right w-12 font-normal text-slate-400">Action</th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                        {(Array.isArray(value) ? value : []).map((rowObj: any, rowIndex: number) => {
                                          if (rowObj._isHeader || rowObj._rowType === 'heading') {
                                            const headerText =
                                              rowObj._headerText ||
                                              rowObj[field.tableConfig?.columns?.[0]?.key || field.tableConfig?.columns?.[0]?.id || 'col_1'] ||
                                              'Section Header';
                                            return (
                                              <tr key={rowIndex} className="bg-slate-100/90 dark:bg-slate-900/90 font-bold border-y border-slate-200 dark:border-slate-800">
                                                <td
                                                  colSpan={(field.tableConfig?.columns?.length || 0) + (field.tableConfig?.allowAddRows !== false ? 1 : 0)}
                                                  className="px-3 py-2 text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-bold"
                                                >
                                                  {headerText}
                                                </td>
                                              </tr>
                                            );
                                          }

                                          return (
                                            <tr key={rowIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                                              {(field.tableConfig?.columns || []).map((col, cIdx) => {
                                                const colKey = col.key || col.id || `col_${cIdx}`;
                                                const isCellHeader =
                                                  (Array.isArray(rowObj._headerCols) && rowObj._headerCols.includes(colKey)) ||
                                                  col.type === 'heading';
                                                const cellVal = rowObj[colKey] ?? '';

                                                if (isCellHeader) {
                                                  return (
                                                    <td key={colKey} className="px-2 py-1.5">
                                                      <div className="px-2 py-1 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-850/80 rounded border border-slate-200/80 dark:border-slate-700/60">
                                                        {cellVal || <span className="text-slate-400 italic font-normal">{col.label}</span>}
                                                      </div>
                                                    </td>
                                                  );
                                                }

                                                return (
                                                  <td key={colKey} className="px-2 py-1.5">
                                                    <input
                                                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                                      value={cellVal}
                                                      placeholder={col.label}
                                                      onChange={(e) => {
                                                        const rows = Array.isArray(value) ? [...value] : [];
                                                        rows[rowIndex] = {
                                                          ...rows[rowIndex],
                                                          [colKey]: col.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
                                                        };
                                                        handleInputChange(field, rows);
                                                      }}
                                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                                    />
                                                  </td>
                                                );
                                              })}
                                              {field.tableConfig?.allowAddRows !== false && (
                                                <td className="px-2 py-1.5 text-right">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const rows = Array.isArray(value) ? [...value] : [];
                                                      rows.splice(rowIndex, 1);
                                                      handleInputChange(field, rows);
                                                    }}
                                                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    title="Delete Row"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    {field.tableConfig?.allowAddRows !== false && (
                                      <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex justify-start">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const rows = Array.isArray(value) ? [...value] : [];
                                            const emptyRow: Record<string, any> = {};
                                            (field.tableConfig?.columns || []).forEach((c, cIdx) => {
                                              const colKey = c.key || c.id || `col_${cIdx}`;
                                              emptyRow[colKey] = '';
                                            });
                                            rows.push(emptyRow);
                                            handleInputChange(field, rows);
                                          }}
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium py-1 px-2"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>Add Row</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {field.helpText && (
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                    {field.helpText}
                                  </p>
                                )}

                                {error && (
                                  <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    <span>{error}</span>
                                  </p>
                                )}
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
          ))}

          {/* Form Actions Footer */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            {form.settings.showResetButton ? (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{form.settings.resetButtonText || 'Reset'}</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              className={`px-6 py-2.5 ${radiusClass} text-xs font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all`}
              style={{ backgroundColor: theme.primaryColor }}
            >
              {form.settings.submitAction === 'print' ? (
                <Printer className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{form.settings.submitButtonText || 'Submit Form'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Submission Success Dialog */}
      {submittedData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Form Successfully Validated & Submitted!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubmittedData(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dbStatus?.successMsg ? (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Oracle Database Transaction Committed</p>
                  <p className="mt-0.5 text-[11px]">{dbStatus.successMsg}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Responses have been validated. You can inspect or download the JSON responses payload below:
              </p>
            )}

            <div className="bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl p-3 max-h-60 overflow-y-auto">
              <pre className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                {JSON.stringify(submittedData, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmittedData(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
              >
                <FileJson className="w-4 h-4" />
                <span>Download Answers (.json)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
