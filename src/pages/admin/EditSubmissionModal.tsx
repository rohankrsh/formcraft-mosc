import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  getAdminSubmissionDetail,
  updateAdminSubmission,
  type AdminSubmissionRecord,
} from '../../services/adminApi';

interface EditSubmissionModalProps {
  submissionId: number;
  onClose: () => void;
  onSuccess: (updatedSubId: number) => void;
}

export const EditSubmissionModal: React.FC<EditSubmissionModalProps> = ({
  submissionId,
  onClose,
  onSuccess,
}) => {
  const [submission, setSubmission] = useState<AdminSubmissionRecord | null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [originalFormData, setOriginalFormData] = useState<Record<string, any>>({});
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string>('');

  const [reason, setReason] = useState<string>('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAdminSubmissionDetail(submissionId);
        if (!isMounted) return;
        if (res.success && res.submission) {
          setSubmission(res.submission);
          setSchema(res.schema);
          const initialData = JSON.parse(JSON.stringify(res.submission.formData || {}));
          setFormData(initialData);
          setOriginalFormData(JSON.parse(JSON.stringify(initialData)));
          setOriginalUpdatedAt(res.submission.updatedAt || res.submission.submittedAt);
        } else {
          setError(res.error || 'Failed to load submission for editing.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Error loading clinical submission.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  // Compute changed keys
  const getChangedKeys = () => {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(originalFormData), ...Object.keys(formData)]);
    for (const key of allKeys) {
      if (JSON.stringify(originalFormData[key]) !== JSON.stringify(formData[key])) {
        changed.push(key);
      }
    }
    return changed;
  };

  const changedKeys = getChangedKeys();

  const handleFieldChange = (fieldId: string, val: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  const handleResetField = (fieldId: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: originalFormData[fieldId],
    }));
  };

  const handleSaveClick = () => {
    setReasonError(null);
    if (!reason || reason.trim().length < 5) {
      setReasonError('Please provide a clinical / operational justification (minimum 5 characters).');
      return;
    }
    if (changedKeys.length === 0) {
      setReasonError('No field changes have been made yet.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateAdminSubmission(submissionId, {
        formData,
        reason: reason.trim(),
        originalUpdatedAt,
      });

      if (res.success) {
        onSuccess(submissionId);
        onClose();
      } else {
        setError(res.error || 'Failed to save submission amendment.');
        setShowConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving clinical changes.');
      setShowConfirm(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to render editable input control for a given field
  const renderFieldControl = (field: any) => {
    const fId = field.id || field.name;
    const val = formData[fId];
    const isChanged = changedKeys.includes(fId);

    if (field.type === 'textarea') {
      return (
        <textarea
          value={val !== undefined && val !== null ? String(val) : ''}
          onChange={(e) => handleFieldChange(fId, e.target.value)}
          rows={3}
          className={`w-full bg-slate-950 border ${
            isChanged ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-slate-800'
          } rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors`}
          placeholder={`Enter ${field.label || fId}...`}
        />
      );
    }

    if (field.type === 'select') {
      const options = field.options || [];
      return (
        <select
          value={val !== undefined && val !== null ? String(val) : ''}
          onChange={(e) => handleFieldChange(fId, e.target.value)}
          className={`w-full bg-slate-950 border ${
            isChanged ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-slate-800'
          } rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors`}
        >
          <option value="">-- Select option --</option>
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => handleFieldChange(fId, e.target.checked)}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
          />
          <span className="text-xs text-slate-300">Checked / Confirmed</span>
        </label>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={val !== undefined && val !== null ? String(val) : ''}
          onChange={(e) => handleFieldChange(fId, e.target.value === '' ? '' : Number(e.target.value))}
          className={`w-full bg-slate-950 border ${
            isChanged ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-slate-800'
          } rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors`}
          placeholder="0"
        />
      );
    }

    if (field.type === 'table') {
      const columns = field.tableConfig?.columns || [];
      const rows = Array.isArray(val) ? val : [];

      const handleAddRow = () => {
        const newRow: Record<string, any> = {};
        columns.forEach((c: any) => {
          newRow[c.key || c.id] = '';
        });
        handleFieldChange(fId, [...rows, newRow]);
      };

      const handleRemoveRow = (rIdx: number) => {
        const updated = rows.filter((_: any, idx: number) => idx !== rIdx);
        handleFieldChange(fId, updated);
      };

      const handleCellChange = (rIdx: number, colKey: string, cellVal: any) => {
        const updated = [...rows];
        updated[rIdx] = { ...updated[rIdx], [colKey]: cellVal };
        handleFieldChange(fId, updated);
      };

      return (
        <div className="space-y-2 mt-1">
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                <tr>
                  <th className="py-2 px-2.5">#</th>
                  {columns.map((c: any) => (
                    <th key={c.id || c.key} className="py-2 px-2.5">{c.label || c.key}</th>
                  ))}
                  <th className="py-2 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row: any, rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[10px]">{rIdx + 1}</td>
                    {columns.map((c: any) => {
                      const colKey = c.key || c.id;
                      return (
                        <td key={colKey} className="py-1.5 px-2.5">
                          <input
                            type="text"
                            value={row[colKey] !== undefined ? String(row[colKey]) : ''}
                            onChange={(e) => handleCellChange(rIdx, colKey, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(rIdx)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="py-3 text-center text-slate-500 italic text-xs">
                      No rows recorded. Click below to add a row.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Row</span>
          </button>
        </div>
      );
    }

    // Default: text / date / time / string
    return (
      <input
        type={field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
        value={val !== undefined && val !== null ? String(val) : ''}
        onChange={(e) => handleFieldChange(fId, e.target.value)}
        className={`w-full bg-slate-950 border ${
          isChanged ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-slate-800'
        } rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors`}
        placeholder={`Enter ${field.label || fId}...`}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Edit Clinical Submission #{submissionId}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[10px] font-semibold">
                  v{submission?.formVersion || 1}
                </span>
                {changedKeys.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                    {changedKeys.length} {changedKeys.length === 1 ? 'field' : 'fields'} modified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {submission?.formTitle} • Original Submitter: <span className="text-slate-300 font-medium">{submission?.submittedBy || 'Clinician'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading submission data for editing...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <strong>Amendment Error:</strong> {error}
              </div>
            </div>
          )}

          {!isLoading && submission && (
            <>
              {/* Clinical Integrity Warning Banner */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-200">
                    Clinical Record Amendment Safeguards Active
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    This form represents an authenticated hospital record. Editing submitted data will create a linked clinical audit trail entry recording your administrator identity, modification timestamp, and reason. The original submitter and original submission timestamp will remain preserved.
                  </p>
                </div>
              </div>

              {/* Mandatory Reason for Edit Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Mandatory Amendment Reason / Clinical Justification *</span>
                  <span className="text-[10px] text-slate-500 font-normal">Required for hospital compliance audit</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  rows={2}
                  placeholder="e.g., Correction of recorded blood pressure reading per attending physician's clinical order..."
                  className={`w-full bg-slate-900 border ${
                    reasonError ? 'border-rose-500/80 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {reasonError && (
                  <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {reasonError}
                  </p>
                )}
              </div>

              {/* Form Schema Sections */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Editable Field Values
                  </div>
                  {changedKeys.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(JSON.parse(JSON.stringify(originalFormData)));
                      }}
                      className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Discard All Changes</span>
                    </button>
                  )}
                </div>

                {schema?.layout && Array.isArray(schema.layout) ? (
                  schema.layout.map((section: any, sIdx: number) => {
                    const fields = schema.fields || {};
                    return (
                      <div key={section.id || sIdx} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                        {section.title && (
                          <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-800">
                            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              {section.title}
                            </h4>
                          </div>
                        )}

                        <div className="p-4 space-y-4">
                          {(section.rows || []).map((row: any, rIdx: number) => (
                            <div key={row.id || rIdx} className="grid grid-cols-12 gap-4">
                              {(row.columns || []).map((col: any, cIdx: number) => {
                                const colWidth = col.width || 12;
                                return (
                                  <div
                                    key={col.id || cIdx}
                                    className={`space-y-3 col-span-12 sm:col-span-${colWidth}`}
                                    style={{ gridColumn: `span ${colWidth} / span ${colWidth}` }}
                                  >
                                    {(col.fieldIds || []).map((fId: string) => {
                                      const field = fields[fId] || { id: fId, label: fId, type: 'text' };
                                      const isChanged = changedKeys.includes(fId);

                                      return (
                                        <div
                                          key={fId}
                                          className={`p-3 rounded-lg border transition-all ${
                                            isChanged
                                              ? 'bg-amber-500/5 border-amber-500/30'
                                              : 'bg-slate-950/40 border-slate-800/80'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                                            <span className="flex items-center gap-1.5">
                                              <span>{field.label || field.name || fId}</span>
                                              {isChanged && (
                                                <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                                                  Modified
                                                </span>
                                              )}
                                            </span>
                                            {isChanged && (
                                              <button
                                                type="button"
                                                onClick={() => handleResetField(fId)}
                                                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                                              >
                                                Reset field
                                              </button>
                                            )}
                                          </div>
                                          {renderFieldControl(field)}
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
                    );
                  })
                ) : (
                  <div className="space-y-3">
                    {Object.keys(formData).map((fId) => {
                      const isChanged = changedKeys.includes(fId);
                      return (
                        <div
                          key={fId}
                          className={`p-3 rounded-lg border ${
                            isChanged ? 'bg-amber-500/5 border-amber-500/30' : 'bg-slate-950/40 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                            <span>{fId}</span>
                            {isChanged && <span className="text-[10px] text-amber-400 font-bold">Modified</span>}
                          </div>
                          {renderFieldControl({ id: fId, type: typeof formData[fId] === 'number' ? 'number' : 'text' })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <span>Optimistic Concurrency: Protected</span>
            <span>•</span>
            <span>Status will update to <strong className="text-purple-400">Amended</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving || changedKeys.length === 0}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Review & Save Amendment ({changedKeys.length})</span>
            </button>
          </div>
        </div>

        {/* Confirmation Dialog Overlay */}
        {showConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold text-white">Confirm Clinical Amendment</h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                You are about to save changes to <strong className="text-white">Submission #{submissionId}</strong>.
                This action will be permanently recorded in the Oracle clinical audit trail with your administrator attribution.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">
                  Amendment Summary ({changedKeys.length} fields)
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                  {changedKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between text-slate-300 border-b border-slate-800/60 pb-1">
                      <span className="text-slate-400">{k}:</span>
                      <span className="text-amber-400 truncate max-w-[200px]">
                        {String(formData[k] ?? 'empty')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-1 text-[11px] text-slate-400">
                  <strong>Reason:</strong> {reason}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving to Oracle...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm & Save to Oracle</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
