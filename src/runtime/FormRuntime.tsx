import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Send,
  Loader2,
  Database,
  Search,
  Printer,
  X,
  History,
  Eye,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import type { FormDefinition, FormField, FormSubmissionRecord, PatientFormMode } from '../types/schema';
import { RuntimeSection } from './RuntimeSection';
import { DownloadPdfButton } from '../components/common/DownloadPdfButton';
import { HistoricalSubmissionModal } from './HistoricalSubmissionModal';
import {
  fetchRuntimeOptions,
  fetchRuntimeRecord,
  executeRuntimeQueryApi,
  fetchPatientFormState,
  fetchSubmissionHistory,
  fetchHistoricalSubmission,
  submitFormPersistence,
} from './runtimeApi';

interface FormRuntimeProps {
  slug: string;
  form: FormDefinition;
  version: number;
}

function normalizeValue(value: unknown, dataType?: string, field?: FormField): any {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle select or radio field with options
  if (field && (field.type === 'select' || field.type === 'radio') && field.options?.length) {
    const strVal = String(value).trim().toLowerCase();
    const matchedOption = field.options.find(
      (opt) =>
        opt.value.trim().toLowerCase() === strVal ||
        opt.label.trim().toLowerCase() === strVal ||
        (opt.value.length === 1 && strVal.startsWith(opt.value.toLowerCase())) ||
        (opt.label.length === 1 && strVal.startsWith(opt.label.toLowerCase()))
    );
    if (matchedOption) {
      return matchedOption.value;
    }
  }

  // Handle checkbox field
  if (field && field.type === 'checkbox') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'boolean') return value;
    const strVal = String(value).toLowerCase();
    return strVal === 'true' || strVal === '1' || strVal === 'yes';
  }

  switch (dataType?.toLowerCase()) {
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const strVal = String(value).toLowerCase();
      return strVal === 'true' || strVal === '1' || strVal === 'yes';
    }
    case 'date': {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      return String(value).slice(0, 10);
    }
    default: {
      if (field && field.type === 'date') {
        if (value instanceof Date) {
          return value.toISOString().slice(0, 10);
        }
        return String(value).slice(0, 10);
      }
      if (field && field.type === 'number') {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      return String(value);
    }
  }
}

/**
 * Formats timestamps into readable clinical format: "09-Oct-2026, 09:15 AM".
 */
function formatSubmissionDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return isoString;
  }
}

export const FormRuntime: React.FC<FormRuntimeProps> = ({ slug, form, version }) => {
  const patientFormMode: PatientFormMode = form.settings?.patientFormMode || 'NEW_RECORD';

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dynamicOptions, setDynamicOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Patient Auto-Population from URL ?mrno=...
  const [patientFetchLoading, setPatientFetchLoading] = useState(false);
  const [patientFetchError, setPatientFetchError] = useState<string | null>(null);
  const [patientFetchNotice, setPatientFetchNotice] = useState<string | null>(null);

  // Mode 1: Submission History & Historical Read-Only Modal
  const [submissionHistory, setSubmissionHistory] = useState<FormSubmissionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoricalSub, setSelectedHistoricalSub] = useState<FormSubmissionRecord | null>(null);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isLoadingHistoryRecord, setIsLoadingHistoryRecord] = useState(false);

  // Edit vs Create mode tracking
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState<string | number | null>(null);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | number | null>(null);
  const [primaryKeyInput, setPrimaryKeyInput] = useState('');
  const [isFetchingRecord, setIsFetchingRecord] = useState(false);

  // Parse current MRNO from URL
  const params = new URLSearchParams(window.location.search);
  const mrnoParam = params.get('mrno');
  const normalizedMrno = mrnoParam?.trim() || '';

  // Initialize form default values
  const initDefaults = useCallback(() => {
    const initial: Record<string, any> = {};
    for (const field of Object.values(form.fields || {})) {
      const key = field.name || field.id;
      let val: any = '';
      if (field.type === 'table') {
        val = field.tableConfig?.defaultRows
          ? JSON.parse(JSON.stringify(field.tableConfig.defaultRows))
          : [];
      } else if (field.defaultValue !== undefined) {
        val = field.defaultValue;
      } else if (field.type === 'checkbox' && (field.options?.length || 0) > 0) {
        val = [];
      }
      initial[key] = val;
      initial[field.id] = val;
      if (field.name) {
        initial[field.name] = val;
      }
    }
    setFormData(initial);
    setErrors({});
    setIsEditMode(false);
    setCurrentRecordId(null);
    setCurrentSubmissionId(null);
    setSubmitSuccess(null);
    setServerError(null);
  }, [form]);

  useEffect(() => {
    initDefaults();
  }, [initDefaults]);

  const [runningQueryId, setRunningQueryId] = useState<string | null>(null);

  // Executes a parameterized SQL query and maps results back to form fields via field.name / field.id
  const runSqlQuery = useCallback(
    async (queryId: string, currentValues: Record<string, any>) => {
      const query = (form.sqlQueries || []).find((q) => q.id === queryId && q.enabled !== false);
      if (!query) return;

      setRunningQueryId(queryId);
      try {
        const result = await executeRuntimeQueryApi(slug, queryId, currentValues);
        if (result && result.mappedValues && Object.keys(result.mappedValues).length > 0) {
          setFormData((prev) => {
            const next = { ...prev };
            const fieldsList: FormField[] = Array.isArray(form.fields)
              ? form.fields
              : Object.values(form.fields || {});

            for (const [fKey, val] of Object.entries(result.mappedValues)) {
              if (val !== undefined && val !== null) {
                next[fKey] = val;
                const targetField = fieldsList.find(
                  (f) =>
                    f.name === fKey ||
                    f.id === fKey ||
                    (f.label && f.label.toLowerCase() === fKey.toLowerCase())
                );
                if (targetField) {
                  const normalized = normalizeValue(val, undefined, targetField);
                  next[targetField.id] = normalized;
                  if (targetField.name) {
                    next[targetField.name] = normalized;
                  }
                }
              }
            }
            return next;
          });
          setNoticeMessage(`Populated fields from "${query.name || 'database query'}".`);
        }
      } catch (err: any) {
        console.warn(`[FormRuntime] SQL query "${query.name}" notice:`, err.message);
      } finally {
        setRunningQueryId(null);
      }
    },
    [form.sqlQueries, form.fields, slug]
  );

  // Reusable function to populate mapped form fields from patient demographic data
  const populateFormFields = useCallback(
    (patientData: Record<string, unknown>) => {
      setFormData((currentValues) => {
        const updatedValues = { ...currentValues };
        const fieldsList: FormField[] = Array.isArray(form.fields)
          ? form.fields
          : Object.values(form.fields || {});

        const cleanPatientMap: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(patientData)) {
          if (v !== undefined && v !== null) {
            cleanPatientMap[k.toLowerCase()] = v;
            cleanPatientMap[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
          }
        }

        fieldsList.forEach((field) => {
          let rawValue: unknown = undefined;

          // 1. Check explicit dataBinding column if configured
          const binding = field.dataBinding;
          if (binding?.column) {
            const col = binding.column;
            rawValue =
              patientData[col] ??
              patientData[col.toLowerCase()] ??
              patientData[col.toUpperCase()];

            if (rawValue === undefined || rawValue === null) {
              const colClean = col.replace(/[^a-z0-9]/gi, '').toLowerCase();
              rawValue = cleanPatientMap[colClean];
            }
          }

          // 2. Intelligent semantic matching by field.name / field.label / field.id
          if (rawValue === undefined || rawValue === null) {
            const candidates = [field.name, field.label, field.id].filter(Boolean) as string[];

            for (const cand of candidates) {
              const cleanCand = cand.replace(/[^a-z0-9]/gi, '').toLowerCase();

              if (patientData[cand] !== undefined && patientData[cand] !== null) {
                rawValue = patientData[cand];
                break;
              }
              if (cleanPatientMap[cleanCand] !== undefined && cleanPatientMap[cleanCand] !== null) {
                rawValue = cleanPatientMap[cleanCand];
                break;
              }

              if (['mrno', 'mrn', 'patientid'].includes(cleanCand)) {
                rawValue = patientData.mrno ?? cleanPatientMap['mrno'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['patientname', 'name', 'fullname'].includes(cleanCand)) {
                rawValue =
                  patientData.patientname ??
                  patientData.patient_name ??
                  patientData.first_name ??
                  cleanPatientMap['patientname'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['firstname', 'first_name'].includes(cleanCand)) {
                rawValue = patientData.first_name ?? patientData.patientname;
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['dob', 'dateofbirth', 'birthdate'].includes(cleanCand)) {
                rawValue = patientData.dob ?? cleanPatientMap['dob'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['gender', 'sex'].includes(cleanCand)) {
                rawValue = patientData.gender ?? cleanPatientMap['gender'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['weight', 'patientweight'].includes(cleanCand)) {
                rawValue = patientData.weight ?? cleanPatientMap['weight'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['height', 'patientheight'].includes(cleanCand)) {
                rawValue = patientData.height ?? cleanPatientMap['height'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['age'].includes(cleanCand)) {
                rawValue = patientData.age ?? cleanPatientMap['age'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['bed', 'bedno', 'bednumber'].includes(cleanCand)) {
                rawValue = patientData.bed_no ?? patientData.bedno ?? cleanPatientMap['bedno'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['admissiondate'].includes(cleanCand)) {
                rawValue = patientData.admission_date ?? patientData.admissiondate;
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['admissionno', 'admissionnumber'].includes(cleanCand)) {
                rawValue = patientData.admission_number ?? patientData.admissionnumber;
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['consultant', 'doctor'].includes(cleanCand)) {
                rawValue = patientData.consultant ?? cleanPatientMap['consultant'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['department', 'departmentname'].includes(cleanCand)) {
                rawValue = patientData.department_name ?? cleanPatientMap['departmentname'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['servicecenter'].includes(cleanCand)) {
                rawValue = patientData.service_center ?? cleanPatientMap['servicecenter'];
                if (rawValue !== undefined && rawValue !== null) break;
              } else if (['mobile', 'mobileno', 'phone'].includes(cleanCand)) {
                rawValue = patientData.mobile_no ?? patientData.mobileno;
                if (rawValue !== undefined && rawValue !== null) break;
              }
            }
          }

          if (rawValue === undefined || rawValue === null) return;

          const dataType = binding?.dataType || (binding as any)?.oracleType;
          const normalized = normalizeValue(rawValue, dataType, field);

          const key = field.name || field.id;
          updatedValues[key] = normalized;
          updatedValues[field.id] = normalized;
          if (field.name) {
            updatedValues[field.name] = normalized;
          }
        });

        return updatedValues;
      });
    },
    [form.fields]
  );

  // Load Patient Context & Form State based on Configured Patient Form Behavior (Feature C & D)
  useEffect(() => {
    if (!normalizedMrno) {
      return;
    }

    let isMounted = true;
    const loadPatientContextAndState = async () => {
      try {
        setPatientFetchLoading(true);
        setPatientFetchError(null);

        // 1. Fetch patient basic demographic data
        let patientData: any = null;
        try {
          const pResponse = await fetch(
            `/api/forms/${encodeURIComponent(slug)}/patient-data?mrno=${encodeURIComponent(normalizedMrno)}`
          );
          if (pResponse.ok) {
            const resJson = await pResponse.json();
            patientData = resJson.patientData || resJson.data || resJson;
          }
        } catch {
          // Non-fatal
        }

        // 2. Fetch mode-aware form state (CONTINUE_EXISTING or NEW_RECORD history)
        const stateRes = await fetchPatientFormState(slug, normalizedMrno);

        if (!isMounted) return;

        if (patientFormMode === 'CONTINUE_EXISTING') {
          if (stateRes.hasExistingRecord && stateRes.data && Object.keys(stateRes.data).length > 0) {
            // Mode 2: Populate form with previously saved record values
            setFormData((prev) => {
              const updated = { ...prev };
              for (const [k, v] of Object.entries(stateRes.data!)) {
                updated[k] = v;
              }
              return updated;
            });
            setIsEditMode(true);
            setCurrentRecordId(stateRes.recordId || stateRes.submissionId || null);
            setCurrentSubmissionId(stateRes.submissionId || null);
            setPatientFetchNotice(
              `Existing patient record loaded for editing (Last submitted: ${formatSubmissionDateTime(
                stateRes.updatedAt || stateRes.submittedAt || undefined
              )}).`
            );
          } else {
            // Mode 2 First Time: Blank form with demographic auto-population
            setIsEditMode(false);
            setCurrentRecordId(null);
            setCurrentSubmissionId(null);
            if (patientData) {
              populateFormFields(patientData);
            }
            setPatientFetchNotice(
              `No previous record found for MRNO ${normalizedMrno}. Form initialized for first entry.`
            );
          }
        } else {
          // Mode 1 (NEW_RECORD): Fresh blank form with demographic auto-population
          setIsEditMode(false);
          setCurrentRecordId(null);
          setCurrentSubmissionId(null);
          if (patientData) {
            populateFormFields(patientData);
          }
          setSubmissionHistory(stateRes.history || []);
          setPatientFetchNotice(`Ready to record new submission for MRNO ${normalizedMrno}.`);
        }

        // Execute any SQL queries configured on MRNO trigger
        if (patientData) {
          const mrnoQueries = (form.sqlQueries || []).filter(
            (q) =>
              q.enabled !== false &&
              (q.triggerFieldKey === 'mrno' ||
                q.triggerFieldKey === 'MRNO' ||
                q.parameterMappings?.['mrno'] ||
                /:mrno\b/i.test(q.sql))
          );

          if (mrnoQueries.length > 0) {
            const queryParams: Record<string, any> = {
              ...patientData,
              mrno: normalizedMrno,
            };
            mrnoQueries.forEach((q) => {
              runSqlQuery(q.id, queryParams);
            });
          }
        }
      } catch (err: any) {
        console.warn('[FormRuntime] Patient state load notice:', err.message);
        if (isMounted) {
          setPatientFetchError(`Unable to load patient data or history for MRNO ${normalizedMrno}.`);
        }
      } finally {
        if (isMounted) {
          setPatientFetchLoading(false);
        }
      }
    };

    loadPatientContextAndState();

    return () => {
      isMounted = false;
    };
  }, [slug, form, normalizedMrno, patientFormMode, populateFormFields, runSqlQuery]);

  // View Historical Submission (Feature C)
  const handleViewHistoricalSubmission = async (sub: FormSubmissionRecord) => {
    setIsLoadingHistoryRecord(true);
    try {
      const fullSub = await fetchHistoricalSubmission(slug, sub.id, normalizedMrno);
      setSelectedHistoricalSub(fullSub);
      setIsHistoricalModalOpen(true);
    } catch (err: any) {
      setServerError(`Unable to load historical record #${sub.id}: ${err.message}`);
    } finally {
      setIsLoadingHistoryRecord(false);
    }
  };

  // Refresh submission history manually
  const refreshHistory = useCallback(async () => {
    if (!normalizedMrno) return;
    setIsLoadingHistory(true);
    try {
      const hist = await fetchSubmissionHistory(slug, normalizedMrno);
      setSubmissionHistory(hist);
    } catch (err: any) {
      console.warn('[FormRuntime] Refresh history notice:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [slug, normalizedMrno]);

  // Fetch dynamic lookup options from Oracle
  useEffect(() => {
    let isMounted = true;
    const loadOptions = async () => {
      try {
        const opts = await fetchRuntimeOptions(slug);
        if (isMounted) {
          setDynamicOptions(opts);
        }
      } catch (err: any) {
        console.warn('[FormRuntime] Notice loading dynamic options:', err.message);
      }
    };

    loadOptions();
    return () => {
      isMounted = false;
    };
  }, [slug, form]);

  // Trigger queries on form load
  useEffect(() => {
    const loadQueries = (form.sqlQueries || []).filter(
      (q) => q.enabled !== false && q.executeOn === 'formLoad'
    );
    if (loadQueries.length === 0) return;

    loadQueries.forEach((q) => {
      runSqlQuery(q.id, formData);
    });
  }, [form.sqlQueries, runSqlQuery]);

  // Handle value change for any field
  const handleFieldChange = (field: FormField, val: any) => {
    const key = field.name || field.id;
    const nextFormData = {
      ...formData,
      [key]: val,
      [field.id]: val,
      ...(field.name ? { [field.name]: val } : {}),
    };
    setFormData(nextFormData);

    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setServerError(null);

    if (val !== '' && val !== null && val !== undefined) {
      const matchingQueries = (form.sqlQueries || []).filter(
        (q) =>
          q.enabled !== false &&
          q.executeOn === 'fieldChange' &&
          (q.triggerFieldKey === key ||
            q.triggerFieldKey === field.name ||
            q.triggerFieldKey === field.id ||
            (key.toLowerCase() === 'mrno' && q.triggerFieldKey?.toLowerCase() === 'mrno'))
      );

      matchingQueries.forEach((q) => {
        runSqlQuery(q.id, nextFormData);
      });
    }
  };

  // Manual Fetch record from Oracle Database using record ID input
  const handleFetchRecord = async (recordId: string) => {
    if (!recordId) return;
    setIsFetchingRecord(true);
    setServerError(null);
    setNoticeMessage(null);

    try {
      const fetched = await fetchRuntimeRecord(slug, recordId);
      if (!fetched || Object.keys(fetched).length === 0) {
        setServerError(`No existing record found for identifier "${recordId}".`);
        return;
      }

      setFormData((prev) => {
        const updated = { ...prev };
        for (const field of Object.values(form.fields || {})) {
          const key = field.name || field.id;
          const colName = field.dataBinding?.column?.toUpperCase();

          if (fetched[key] !== undefined) {
            updated[key] = fetched[key];
          } else if (fetched[field.id] !== undefined) {
            updated[key] = fetched[field.id];
          } else if (colName && fetched[colName] !== undefined) {
            updated[key] = fetched[colName];
          } else if (colName && fetched[colName.toLowerCase()] !== undefined) {
            updated[key] = fetched[colName.toLowerCase()];
          }
        }
        return updated;
      });

      setIsEditMode(true);
      setCurrentRecordId(recordId);
      setNoticeMessage(`Record #${recordId} successfully loaded from database.`);
    } catch (err: any) {
      setServerError(err.message || 'Unable to retrieve record from database.');
    } finally {
      setIsFetchingRecord(false);
    }
  };

  // Client-side validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of Object.values(form.fields || {})) {
      if (field.type === 'heading' || field.type === 'divider') continue;

      if (field.visibleIf && field.visibleIf.fieldId) {
        const depVal = formData[field.visibleIf.fieldId];
        if (String(depVal) !== String(field.visibleIf.equals)) {
          continue;
        }
      }

      const key = field.name || field.id;
      const val = formData[key];
      const rules = field.validation || {};

      if (rules.required) {
        let isFieldEmpty =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);

        if (!isFieldEmpty && field.type === 'pain_assessment' && typeof val === 'object') {
          isFieldEmpty =
            !val.painPresent &&
            val.score === null &&
            (!val.location || String(val.location).trim() === '');
        }

        if (isFieldEmpty) {
          newErrors[key] = rules.customErrorMessage || `${field.label} is required.`;
          continue;
        }
      }

      if (val === undefined || val === null || val === '') continue;

      if (field.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          newErrors[key] = 'Must be a valid number.';
        } else {
          if (rules.min !== undefined && num < rules.min) {
            newErrors[key] = rules.customErrorMessage || `Minimum value is ${rules.min}.`;
          }
          if (rules.max !== undefined && num > rules.max) {
            newErrors[key] = rules.customErrorMessage || `Maximum value is ${rules.max}.`;
          }
        }
      }

      if (field.type === 'text' || field.type === 'textarea') {
        const str = String(val);
        if (rules.minLength !== undefined && str.length < rules.minLength) {
          newErrors[key] =
            rules.customErrorMessage || `Minimum length is ${rules.minLength} characters.`;
        }
        if (rules.maxLength !== undefined && str.length > rules.maxLength) {
          newErrors[key] =
            rules.customErrorMessage || `Maximum length is ${rules.maxLength} characters.`;
        }
        if (rules.pattern) {
          try {
            const re = new RegExp(rules.pattern);
            if (!re.test(str)) {
              newErrors[key] = rules.customErrorMessage || 'Invalid format.';
            }
          } catch {
            // ignore bad regex pattern
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler with Transactional Persistence (Feature E)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setNoticeMessage(null);

    if (!validate()) {
      setServerError('Please correct the highlighted errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitFormPersistence(slug, {
        data: formData,
        mrno: normalizedMrno,
        isUpdate: isEditMode && !!currentRecordId,
        recordId: currentRecordId,
        submissionId: currentSubmissionId,
        submittedBy: 'Clinician',
      });

      if (patientFormMode === 'CONTINUE_EXISTING') {
        // Mode 2: Retain saved record in form and update state
        setIsEditMode(true);
        setCurrentRecordId(result.recordId);
        setCurrentSubmissionId(result.submissionId);
        setNoticeMessage(
          `Record #${result.recordId} successfully saved to Oracle Database (${formatSubmissionDateTime(
            result.updatedAt || result.submittedAt
          )}).`
        );
        setSubmitSuccess({
          action: isEditMode ? 'updated' : 'inserted',
          data: result,
          recordId: result.recordId,
          submittedAt: result.updatedAt || result.submittedAt,
        });
      } else {
        // Mode 1: NEW_RECORD
        setSubmitSuccess({
          action: 'inserted',
          data: result,
          recordId: result.recordId,
          submittedAt: result.submittedAt,
        });
        refreshHistory();
      }
    } catch (err: any) {
      if (err.validationErrors) {
        setErrors(err.validationErrors);
        setServerError('Server validation failed. Please check the highlighted form values.');
      } else {
        setServerError(err.message || 'Unable to save record to Oracle Database.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = form.settings.theme?.primaryColor || '#2563eb';
  const hasFetchEnabled =
    form.settings.enableFetchRecord || form.layout.some((s) => s.enableFetchRecord);

  return (
    <>
      {/* Historical Submission Read-Only Modal (Feature C) */}
      <HistoricalSubmissionModal
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        submission={selectedHistoricalSub}
        form={form}
      />

      {/* Static Floating Top-Left Download PDF Button */}
      <DownloadPdfButton
        form={form}
        formData={formData}
        dynamicOptions={dynamicOptions}
        metadata={{
          mrno: normalizedMrno || undefined,
          department: params.get('department') || undefined,
          serviceCenter: params.get('serviceCenter') || undefined,
          recordId: currentRecordId,
        }}
        targetElementId="form-printable-container"
        formTitle={form.title}
        recordId={currentRecordId}
        variant="floating"
      />

      <form
        id="form-printable-container"
        onSubmit={handleSubmit}
        className="w-full max-w-4xl mx-auto space-y-6 pb-20 relative"
      >
        {/* Form Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              {/* Header Badges & Actions */}
              <div className="flex items-center gap-2 flex-wrap no-print">
                <DownloadPdfButton
                  form={form}
                  formData={formData}
                  dynamicOptions={dynamicOptions}
                  metadata={{
                    mrno: normalizedMrno || undefined,
                    department: params.get('department') || undefined,
                    serviceCenter: params.get('serviceCenter') || undefined,
                    recordId: currentRecordId,
                  }}
                  targetElementId="form-printable-container"
                  formTitle={form.title}
                  recordId={currentRecordId}
                  variant="header"
                />

                <span
                  className="w-3.5 h-3.5 rounded-full shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                  Official Form &bull; v{version}
                </span>

                {/* Patient Form Mode Badge */}
                {patientFormMode === 'CONTINUE_EXISTING' ? (
                  isEditMode ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Editing Existing Record #{String(currentRecordId)}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Mode: Continue Existing
                    </span>
                  )
                ) : (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Mode: New Form for Every Submission
                  </span>
                )}

                {normalizedMrno && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <User className="w-3 h-3 text-slate-400" />
                    MRNO: {normalizedMrno}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {form.title}
              </h1>
              {form.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                  {form.description}
                </p>
              )}
            </div>

            {/* Fetch Record Bar (if enabled) */}
            {hasFetchEnabled && (
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 no-print">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter MRN / ID..."
                    value={primaryKeyInput}
                    onChange={(e) => setPrimaryKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFetchRecord(primaryKeyInput.trim());
                      }
                    }}
                    className="w-36 md:w-44 pl-7 pr-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
                </div>
                <button
                  type="button"
                  disabled={isFetchingRecord || !primaryKeyInput.trim()}
                  onClick={() => handleFetchRecord(primaryKeyInput.trim())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                >
                  {isFetchingRecord ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Fetch</span>
                  )}
                </button>
              </div>
            )}

            {/* Button Click SQL Queries */}
            {(form.sqlQueries || [])
              .filter((q) => q.enabled !== false && q.executeOn === 'buttonClick')
              .map((q) => (
                <div
                  key={q.id}
                  className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 no-print"
                >
                  <button
                    type="button"
                    disabled={runningQueryId === q.id}
                    onClick={() => runSqlQuery(q.id, formData)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    {runningQueryId === q.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    <span>{q.buttonLabel || q.name || 'Execute Query'}</span>
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Previous Submissions History Card (Feature C: Mode 1 NEW_RECORD) */}
        {patientFormMode === 'NEW_RECORD' && normalizedMrno && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4 no-print">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Previous Submissions — {form.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Past encounter records for patient MRNO{' '}
                    <strong className="font-mono text-slate-700 dark:text-slate-300">{normalizedMrno}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {submissionHistory.length} {submissionHistory.length === 1 ? 'Record' : 'Records'}
                </span>
                <button
                  type="button"
                  disabled={isLoadingHistory}
                  onClick={refreshHistory}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Refresh history"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-blue-500' : ''}`} />
                </button>
              </div>
            </div>

            {submissionHistory.length === 0 ? (
              <div className="py-6 px-4 rounded-2xl bg-slate-50/60 dark:bg-slate-850/60 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No Previous Submissions
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  No previous records exist for this patient. Every submission in this mode creates a new independent record.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Submitted Date & Time</th>
                      <th className="py-2.5 px-4">Record Identifier</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Clinician</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {submissionHistory.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition">
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span>{formatSubmissionDateTime(sub.submittedAt)}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                          #{String(sub.recordId || sub.id)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {sub.status || 'Submitted'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {sub.submittedBy || 'Clinician'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            disabled={isLoadingHistoryRecord}
                            onClick={() => handleViewHistoricalSubmission(sub)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/50 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Patient Auto-Fetch Loading Banner */}
        {patientFetchLoading && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs animate-pulse no-print">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="font-semibold">Loading patient context and records...</span>
          </div>
        )}

        {/* Patient Auto-Fetch Error Banner */}
        {patientFetchError && (
          <div className="flex items-center justify-between gap-2.5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs animate-in fade-in no-print">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{patientFetchError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPatientFetchError(null)}
              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Patient Auto-Fetch Success Notice */}
        {patientFetchNotice && (
          <div className="flex items-center justify-between gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in no-print">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{patientFetchNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPatientFetchNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-1 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Notice Message */}
        {noticeMessage && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in no-print">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {/* Server Error Banner */}
        {serverError && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in no-print">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form Submission Success Banner / Notice */}
        {submitSuccess && (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-3 animate-in fade-in no-print">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {submitSuccess.action === 'updated'
                    ? 'Record Successfully Updated in Oracle Database!'
                    : 'Form Successfully Submitted & Persisted to Oracle Database!'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitSuccess(null)}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-1 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[11px] text-emerald-800 dark:text-emerald-300">
              <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Record ID: #{String(submitSuccess.recordId)}
              </span>
              <span>
                Timestamp: <strong>{formatSubmissionDateTime(submitSuccess.submittedAt)}</strong>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Committed Transaction
              </span>
            </div>

            <div className="pt-1 flex items-center gap-2 flex-wrap">
              {patientFormMode === 'NEW_RECORD' && (
                <button
                  type="button"
                  onClick={initDefaults}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Submit Another Instance</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 font-medium text-xs shadow-xs hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Confirmation</span>
              </button>
            </div>
          </div>
        )}

        {/* Sections List */}
        <div className="space-y-6">
          {(form.layout || []).map((section) => (
            <RuntimeSection
              key={section.id}
              section={section}
              fields={form.fields || {}}
              values={formData}
              errors={errors}
              dynamicOptions={dynamicOptions}
              onChange={handleFieldChange}
              onFetchRecord={handleFetchRecord}
              disabled={isSubmitting}
            />
          ))}
        </div>

        {/* Sticky Footer Submit Action Bar */}
        <div className="sticky bottom-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl flex items-center justify-between gap-4 no-print">
          <div>
            {isEditMode ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Updating existing patient record #{String(currentRecordId)}
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {patientFormMode === 'NEW_RECORD'
                  ? 'Ready to insert new submission record'
                  : 'Ready to submit initial patient record'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {form.settings.showResetButton && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={initDefaults}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 text-xs font-medium transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{form.settings.resetButtonText || 'Reset'}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isEditMode
                      ? 'Update Record'
                      : form.settings.submitButtonText || 'Submit Form'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};
