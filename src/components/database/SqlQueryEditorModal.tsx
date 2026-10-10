import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Database,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Code,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  Plus,
  Loader2,
} from 'lucide-react';
import type { FormDefinition, SqlQueryDefinition, SqlQueryParameterMapping } from '../../types/schema';

interface SqlQueryEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormDefinition;
  initialQuery?: SqlQueryDefinition | null;
  onSave: (query: SqlQueryDefinition) => void;
}

export const SqlQueryEditorModal: React.FC<SqlQueryEditorModalProps> = ({
  isOpen,
  onClose,
  form,
  initialQuery,
  onSave,
}) => {
  // Query configuration states
  const [queryId, setQueryId] = useState('');
  const [queryName, setQueryName] = useState('patient_lookup');
  const [sql, setSql] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [executeOn, setExecuteOn] = useState<'formLoad' | 'fieldChange' | 'buttonClick'>('fieldChange');
  const [triggerFieldKey, setTriggerFieldKey] = useState('');
  const [buttonLabel, setButtonLabel] = useState('Lookup Patient');

  // Mappings
  const [parameterMappings, setParameterMappings] = useState<Record<string, SqlQueryParameterMapping>>({});
  const [resultMappings, setResultMappings] = useState<Record<string, string>>({});

  // Test & Preview states
  const [testBinds, setTestBinds] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    columns: string[];
    rows: Record<string, any>[];
    rowCount: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Discover current form fields: canonical field.name is the primary key
  const availableFields = useMemo(() => {
    return Object.values(form.fields || {})
      .filter((f) => f.type !== 'heading' && f.type !== 'divider')
      .map((f) => ({
        id: f.id,
        key: f.name || f.id,
        label: f.label || f.name,
        type: f.type,
      }));
  }, [form.fields]);

  // Initialize or reset modal state
  useEffect(() => {
    if (!isOpen) return;

    if (initialQuery) {
      setQueryId(initialQuery.id);
      setQueryName(initialQuery.name || 'patient_lookup');
      setSql(initialQuery.sql || '');
      setEnabled(initialQuery.enabled !== false);
      setExecuteOn(initialQuery.executeOn || 'fieldChange');
      setTriggerFieldKey(initialQuery.triggerFieldKey || '');
      setButtonLabel(initialQuery.buttonLabel || 'Lookup Patient');
      setParameterMappings(initialQuery.parameterMappings || {});
      setResultMappings(initialQuery.resultMappings || {});
    } else {
      const defaultField = availableFields.find((f) => f.key === 'mrno') || availableFields[0];
      const defaultTrigger = defaultField ? defaultField.key : '';

      setQueryId(`query_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
      setQueryName('patient_lookup');
      setSql(
        `SELECT p.PATIENT_ID AS "patientId",\n       p.MRNO AS "mrno",\n       p.FIRSTNAME AS "firstName",\n       p.LASTNAME AS "lastName",\n       p.GENDERID AS "gender"\nFROM PATIENT p\nWHERE p.MRNO = :mrno`
      );
      setEnabled(true);
      setExecuteOn('fieldChange');
      setTriggerFieldKey(defaultTrigger);
      setButtonLabel('Lookup Patient');
      setParameterMappings({
        mrno: { source: 'form', fieldKey: defaultTrigger || 'mrno' },
      });
      setResultMappings({});
    }

    setTestResult(null);
    setTestError(null);
  }, [isOpen, initialQuery, availableFields]);

  // Detect bind parameters from SQL (:paramName)
  const detectedBindParams = useMemo(() => {
    if (!sql) return [];
    const stripped = sql.replace(/'(?:''|[^'])*'/g, "''");
    const regex = /:([a-zA-Z][a-zA-Z0-9_]*)/g;
    const binds = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(stripped)) !== null) {
      binds.add(match[1]);
    }
    return Array.from(binds);
  }, [sql]);

  // Keep parameterMappings in sync when new bind variables are added
  useEffect(() => {
    setParameterMappings((prev) => {
      const next = { ...prev };
      detectedBindParams.forEach((param) => {
        if (!next[param]) {
          // Smart default: if a form field matches the param name case-insensitively, auto-assign it
          const matchingField = availableFields.find(
            (f) => f.key.toLowerCase() === param.toLowerCase()
          );
          next[param] = {
            source: 'form',
            fieldKey: matchingField ? matchingField.key : availableFields[0]?.key || '',
          };
        }
      });
      return next;
    });

    // Also populate default test value for testing
    setTestBinds((prev) => {
      const next = { ...prev };
      detectedBindParams.forEach((param) => {
        if (next[param] === undefined) {
          next[param] = param.toLowerCase().includes('mrno') ? '5' : '1';
        }
      });
      return next;
    });
  }, [detectedBindParams, availableFields]);

  // Insert alias helper into SQL editor
  const insertAlias = (fieldKey: string) => {
    const aliasSnippet = ` AS "${fieldKey}"`;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newSql = sql.substring(0, start) + aliasSnippet + sql.substring(end);
      setSql(newSql);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + aliasSnippet.length, start + aliasSnippet.length);
      }, 0);
    } else {
      setSql((prev) => prev + aliasSnippet);
    }
  };

  // Run automatic mapping logic given a list of SQL column names / aliases
  const autoMapColumns = (columns: string[]) => {
    setResultMappings((prev) => {
      const next = { ...prev };
      columns.forEach((col) => {
        const cleanCol = col.trim();
        const lowerCol = cleanCol.toLowerCase();
        const strippedCol = lowerCol.replace(/_/g, '');

        // 1. Exact case match
        let match = availableFields.find((f) => f.key === cleanCol);

        // 2. Case-insensitive match
        if (!match) {
          match = availableFields.find((f) => f.key.toLowerCase() === lowerCol);
        }

        // 3. Normalized match (e.g. PATIENT_ID -> patientId)
        if (!match) {
          match = availableFields.find((f) => f.key.toLowerCase() === strippedCol);
        }

        if (match) {
          next[cleanCol] = match.key;
        } else if (!next[cleanCol]) {
          next[cleanCol] = '';
        }
      });
      return next;
    });
  };

  // Execute test / preview query against backend
  const handleTestQuery = async () => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/database/queries/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'formcraft_secret_key_2026',
        },
        body: JSON.stringify({
          sql,
          parameters: testBinds,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to execute query.');
      }

      const { columns, rows, rowCount } = json.data;
      setTestResult({ columns, rows, rowCount });

      // Automatically map returned columns to form fields
      if (columns && columns.length > 0) {
        autoMapColumns(columns);
      }
    } catch (err: any) {
      setTestError(err.message || 'Error testing query against Oracle database.');
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Helper to parse output columns exposed by the outermost / top-level SELECT statement.
   * Ignores nested subquery aliases, window functions (e.g. rn), and inner query expressions.
   */
  function extractTopLevelSelectColumns(sql: string): string[] {
    if (!sql || typeof sql !== 'string') return [];

    const cleaned = sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (!cleaned) return [];

    let depth = 0;
    let inQuotes: string | null = null;
    let selectStart = -1;
    let fromStart = -1;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if ((char === '"' || char === "'") && (i === 0 || cleaned[i - 1] !== '\\')) {
        if (inQuotes === char) {
          inQuotes = null;
        } else if (!inQuotes) {
          inQuotes = char;
        }
      }

      if (inQuotes) continue;

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        if (depth > 0) depth--;
      } else if (depth === 0) {
        const remaining = cleaned.slice(i);
        if (selectStart === -1 && /^\bSELECT\b/i.test(remaining)) {
          selectStart = i + 6;
          i += 5;
          continue;
        }
        if (selectStart !== -1 && /^\bFROM\b/i.test(remaining)) {
          fromStart = i;
          break;
        }
      }
    }

    if (selectStart === -1) return [];

    const selectListText = fromStart !== -1
      ? cleaned.slice(selectStart, fromStart)
      : cleaned.slice(selectStart);

    const colExpressions: string[] = [];
    let currentExpr = '';
    depth = 0;
    inQuotes = null;

    for (let i = 0; i < selectListText.length; i++) {
      const char = selectListText[i];

      if ((char === '"' || char === "'") && (i === 0 || selectListText[i - 1] !== '\\')) {
        if (inQuotes === char) {
          inQuotes = null;
        } else if (!inQuotes) {
          inQuotes = char;
        }
      }

      if (!inQuotes) {
        if (char === '(') depth++;
        else if (char === ')') { if (depth > 0) depth--; }
        else if (char === ',' && depth === 0) {
          if (currentExpr.trim()) colExpressions.push(currentExpr.trim());
          currentExpr = '';
          continue;
        }
      }
      currentExpr += char;
    }

    if (currentExpr.trim()) {
      colExpressions.push(currentExpr.trim());
    }

    const cols: string[] = [];

    for (const expr of colExpressions) {
      const trimmed = expr.trim();
      if (!trimmed) continue;

      const asMatch = trimmed.match(/\bAS\s+(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))\s*$/i);
      if (asMatch) {
        const alias = asMatch[1] || asMatch[2] || asMatch[3];
        if (alias) {
          cols.push(alias);
          continue;
        }
      }

      const implicitMatch = trimmed.match(/(?:\)|[a-zA-Z0-9_.])\s+(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))\s*$/i);
      if (implicitMatch) {
        const alias = implicitMatch[1] || implicitMatch[2] || implicitMatch[3];
        if (alias && !/^(DISTINCT|ALL)$/i.test(alias)) {
          cols.push(alias);
          continue;
        }
      }

      const colMatch = trimmed.match(/(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*$/i);
      if (colMatch) {
        cols.push(colMatch[1]);
      }
    }

    return cols;
  }

  // Parse columns exposed ONLY by the top-level SELECT statement
  const parsedSqlColumns = useMemo(() => {
    return extractTopLevelSelectColumns(sql);
  }, [sql]);

  // Combined columns list (preview columns take precedence, fallback to parsed SQL aliases)
  const activeResultColumns = useMemo(() => {
    if (testResult && testResult.columns.length > 0) {
      return testResult.columns;
    }
    return parsedSqlColumns;
  }, [testResult, parsedSqlColumns]);

  // Auto-map when parsedSqlColumns changes if resultMappings is empty
  useEffect(() => {
    if (parsedSqlColumns.length > 0 && Object.keys(resultMappings).length === 0) {
      autoMapColumns(parsedSqlColumns);
    }
  }, [parsedSqlColumns]);

  // Validation before saving
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!queryName.trim()) issues.push('Query Name is required.');
    if (!sql.trim()) issues.push('SQL query cannot be empty.');
    if (sql.trim() && !/^(SELECT|WITH)\s+/i.test(sql.trim())) {
      issues.push('Only read-only SELECT queries are permitted.');
    }
    for (const param of detectedBindParams) {
      const mapping = parameterMappings[param];
      if (!mapping) {
        issues.push(`Parameter :${param} is not mapped.`);
      } else if (mapping.source === 'form' && !mapping.fieldKey) {
        issues.push(`Parameter :${param} must be assigned to a form field.`);
      }
    }
    return issues;
  }, [queryName, sql, detectedBindParams, parameterMappings]);

  // Save query
  const handleSave = () => {
    if (validationIssues.length > 0) return;

    const queryDef: SqlQueryDefinition = {
      id: queryId || `query_${Date.now()}`,
      name: queryName.trim(),
      operation: 'select',
      sql: sql.trim(),
      enabled,
      executeOn,
      triggerFieldKey: executeOn === 'fieldChange' ? triggerFieldKey : undefined,
      buttonLabel: executeOn === 'buttonClick' ? buttonLabel : undefined,
      parameterMappings,
      resultMappings,
    };

    onSave(queryDef);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                SQL Query & Field Mapping
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold">
                  Oracle SELECT
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Directly map SQL query result columns to form fields using canonical{' '}
                <code className="text-indigo-600 dark:text-indigo-400 font-semibold font-mono">field.name</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Top Configuration: Name, Trigger, Enabled */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-850/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Query Identifier / Name
              </label>
              <input
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="e.g. patient_lookup"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Execution Trigger
              </label>
              <select
                value={executeOn}
                onChange={(e) => setExecuteOn(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="fieldChange">Field Change (e.g. enter MR Number)</option>
                <option value="formLoad">Form Load (Execute on initial open)</option>
                <option value="buttonClick">Button Click (Manual trigger button)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              {executeOn === 'fieldChange' && (
                <div className="w-full mr-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trigger Field Key (<code className="font-mono text-indigo-500">field.name</code>)
                  </label>
                  <select
                    value={triggerFieldKey}
                    onChange={(e) => setTriggerFieldKey(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Field --</option>
                    {availableFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.key} ({f.label})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {executeOn === 'buttonClick' && (
                <div className="w-full mr-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={buttonLabel}
                    onChange={(e) => setButtonLabel(e.target.value)}
                    placeholder="Lookup Patient"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex flex-col items-center shrink-0">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enabled
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-5 w-5"
                />
              </div>
            </div>
          </div>

          {/* SQL Editor & Available Form Fields Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* SQL Editor (Left 2 cols) */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-indigo-500" />
                  Parameterized SQL Query
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Use Oracle bind syntax (e.g. <code className="font-mono text-indigo-500">:mrno</code>)
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>SELECT Statement</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSql(
                          `SELECT p.PATIENT_ID AS "patientId",\n       p.MRNO AS "mrno",\n       p.FIRSTNAME AS "firstName",\n       p.LASTNAME AS "lastName",\n       p.GENDERID AS "gender"\nFROM PATIENT p\nWHERE p.MRNO = :mrno`
                        )
                      }
                      className="text-slate-300 hover:text-indigo-400 transition"
                    >
                      Reset to Template
                    </button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  rows={8}
                  placeholder="SELECT p.PATIENT_ID AS &quot;patientId&quot; FROM PATIENT p WHERE p.MRNO = :mrno"
                  className="w-full bg-slate-950 text-slate-100 p-3 leading-relaxed focus:outline-none resize-y selection:bg-indigo-600/40"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Available Form Fields Sidebar (Right 1 col) */}
            <div className="space-y-2 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Available Form Fields
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {availableFields.length} fields
                </span>
              </div>

              <div className="flex-1 max-h-56 overflow-y-auto bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-200 dark:border-slate-800 p-2 space-y-1.5">
                {availableFields.map((f) => (
                  <div
                    key={f.key}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs hover:border-indigo-400 transition"
                  >
                    <div className="overflow-hidden pr-2">
                      <div className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                        {f.key}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{f.label}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertAlias(f.key)}
                      title={`Insert AS "${f.key}" into SQL`}
                      className="shrink-0 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-semibold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      Alias
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bind Parameter Mapping & Preview Inputs */}
          <div className="space-y-3 bg-slate-50/80 dark:bg-slate-850/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  SQL Bind Parameters
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    {detectedBindParams.length} detected
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Connect each bind parameter (<code className="font-mono">:param</code>) to an input form field key.
                </p>
              </div>
            </div>

            {detectedBindParams.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                No bind parameters detected. (Add variables like <code className="font-mono text-indigo-500">:mrno</code> to parameterize your query).
              </div>
            ) : (
              <div className="space-y-2.5">
                {detectedBindParams.map((param) => {
                  const mapping = parameterMappings[param] || { source: 'form', fieldKey: '' };
                  return (
                    <div
                      key={param}
                      className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded">
                        :{param}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                      {/* Source */}
                      <select
                        value={mapping.source}
                        onChange={(e) => {
                          const src = e.target.value as 'form' | 'static' | 'context';
                          setParameterMappings((prev) => ({
                            ...prev,
                            [param]: { ...prev[param], source: src },
                          }));
                        }}
                        className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                      >
                        <option value="form">Form Field Key</option>
                        <option value="static">Static Value</option>
                        <option value="context">Context Variable</option>
                      </select>

                      {/* Source Field or Static Value */}
                      {mapping.source === 'form' ? (
                        <select
                          value={mapping.fieldKey || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameterMappings((prev) => ({
                              ...prev,
                              [param]: { ...prev[param], fieldKey: val },
                            }));
                          }}
                          className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono flex-1 min-w-[140px]"
                        >
                          <option value="">-- Choose Field Key --</option>
                          {availableFields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.key} ({f.label})
                            </option>
                          ))}
                        </select>
                      ) : mapping.source === 'static' ? (
                        <input
                          type="text"
                          value={String(mapping.value ?? '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameterMappings((prev) => ({
                              ...prev,
                              [param]: { ...prev[param], value: val },
                            }));
                          }}
                          placeholder="Enter static value"
                          className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs flex-1 min-w-[140px]"
                        />
                      ) : (
                        <input
                          type="text"
                          value={mapping.fieldKey || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParameterMappings((prev) => ({
                              ...prev,
                              [param]: { ...prev[param], fieldKey: val },
                            }));
                          }}
                          placeholder="e.g. user, formId"
                          className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs flex-1 min-w-[140px]"
                        />
                      )}

                      {/* Test Value Input for Preview */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-slate-500">Test Value:</span>
                        <input
                          type="text"
                          value={testBinds[param] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTestBinds((prev) => ({ ...prev, [param]: val }));
                          }}
                          placeholder="e.g. 5"
                          className="w-20 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview / Test Query Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTestQuery}
              disabled={isTesting || !sql.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing against Oracle...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Preview / Test Query
                </>
              )}
            </button>

            {testResult && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Query executed successfully ({testResult.rowCount} rows returned)
              </div>
            )}
          </div>

          {/* Test Error Display */}
          {testError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">Query Execution Error</div>
                <div className="font-mono leading-relaxed">{testError}</div>
              </div>
            </div>
          )}

          {/* Test Query Rows Table Preview */}
          {testResult && testResult.rows.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Preview Data ({testResult.rows.length} row sample)
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-40">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-mono">
                    <tr>
                      {testResult.columns.map((c) => (
                        <th key={c} className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {testResult.rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                        {testResult.columns.map((c) => (
                          <td key={c} className="px-3 py-1.5 text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {r[c] !== null && r[c] !== undefined ? String(r[c]) : <span className="text-slate-400 italic">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result Column Mapping Section (Core Requirement) */}
          <div className="space-y-3 bg-slate-50/80 dark:bg-slate-850/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  SQL Result Column ↔ Form Field Mapping
                </h3>
                <p className="text-[11px] text-slate-500">
                  Maps SQL return columns to the canonical form key <code className="font-mono text-indigo-500">field.name</code>. Automatic case-insensitive matching is enabled.
                </p>
              </div>

              {activeResultColumns.length > 0 && (
                <button
                  type="button"
                  onClick={() => autoMapColumns(activeResultColumns)}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Map Columns
                </button>
              )}
            </div>

            {activeResultColumns.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-2">
                Run a test query or define aliases (e.g. <code className="font-mono">AS "patientId"</code>) to configure result mappings.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeResultColumns.map((col) => {
                  const mappedFieldKey = resultMappings[col] || '';
                  const isAutoMatched =
                    mappedFieldKey &&
                    availableFields.some(
                      (f) =>
                        f.key.toLowerCase() === col.toLowerCase() ||
                        f.key.toLowerCase() === col.replace(/_/g, '').toLowerCase()
                    );

                  return (
                    <div
                      key={col}
                      className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {col}
                          </span>
                          {isAutoMatched && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                              Auto
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">SQL Column / Alias</div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                      <div className="flex-1">
                        <select
                          value={mappedFieldKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            setResultMappings((prev) => ({ ...prev, [col]: val }));
                          }}
                          className={`w-full text-xs font-mono rounded-lg border px-2.5 py-1.5 ${mappedFieldKey
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100'
                              : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            }`}
                        >
                          <option value="">-- (Unmapped / Ignore) --</option>
                          {availableFields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.key} ({f.label})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unmapped column warning notices */}
            {activeResultColumns.some((col) => !resultMappings[col]) && (
              <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Some SQL result columns are not mapped to form fields and will be ignored during execution.
                </span>
              </div>
            )}
          </div>

          {/* Validation Errors Display before Save */}
          {validationIssues.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Please address before saving:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {validationIssues.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={validationIssues.length > 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Save SQL Query
          </button>
        </div>
      </div>
    </div>
  );
};
