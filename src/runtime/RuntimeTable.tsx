import React from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import type { FormField, TableColumn } from '../types/schema';
import type { StaffDetailsResponse } from '../services/userApi';
import {
  resolveStaffColumnMapping,
  isStaffColumnLocked,
  getStaffValueForField,
  isStaffFieldLocked,
} from '../utils/staffFieldHelper';

export function isStaffNameColumn(col: TableColumn): boolean {
  const mapping = resolveStaffColumnMapping(col);
  return mapping.isStaffField && mapping.sourceField === 'staff_name';
}

interface RuntimeTableProps {
  field: FormField;
  value: any[];
  onChange: (newValue: any[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  staffContext?: StaffDetailsResponse | null;
}

export const RuntimeTable: React.FC<RuntimeTableProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  errors = {},
  staffContext,
}) => {
  const tableConfig = field.tableConfig || { columns: [], allowAddRows: true, defaultRows: [] };
  const columns = tableConfig.columns || [];
  const rows = Array.isArray(value) ? value : [];
  const allowAdd = tableConfig.allowAddRows !== false && !disabled;

  const handleCellChange = (rowIndex: number, colKey: string, cellVal: any) => {
    const targetCol = columns.find((c, idx) => (c.key || c.id || `col_${idx}`) === colKey);
    if (targetCol && isStaffColumnLocked(targetCol)) {
      // Strictly prevent manual edits to locked staff cells
      return;
    }
    const updated = [...rows];
    updated[rowIndex] = {
      ...(updated[rowIndex] || {}),
      [colKey]: cellVal,
    };
    onChange(updated);
  };

  const handleAddRow = () => {
    const emptyRow: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const key = col.key || col.id || `col_${idx}`;
      const mapping = resolveStaffColumnMapping(col);
      if (mapping.isStaffField && staffContext) {
        emptyRow[key] = getStaffValueForField(mapping.sourceField, staffContext);
      } else {
        emptyRow[key] = '';
      }
    });
    onChange([...rows, emptyRow]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const updated = [...rows];
    updated.splice(rowIndex, 1);
    onChange(updated);
  };

  return (
    <div className="w-full space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80">
              {columns.map((col, idx) => {
                const key = col.key || col.id || `th_${idx}`;
                const isColLocked = isStaffColumnLocked(col);
                return (
                  <th
                    key={key}
                    className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>{col.label}</span>
                      {isColLocked && (
                        <span title="Locked staff field (read-only)">
                          <Lock className="w-3 h-3 text-slate-400" />
                        </span>
                      )}
                    </span>
                    {col.required && <span className="text-rose-500 ml-0.5">*</span>}
                    {col.type && col.type !== 'text' && (
                      <span className="ml-1 text-[9px] uppercase px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-mono">
                        {col.type}
                      </span>
                    )}
                  </th>
                );
              })}
              {allowAdd && <th className="px-3 py-2 text-right w-12 font-normal text-slate-400">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (allowAdd ? 1 : 0)}
                  className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500"
                >
                  No rows added yet.{' '}
                  {allowAdd && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium ml-1 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add first row
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((rowObj, rIdx) => {
                if (rowObj._isHeader || rowObj._rowType === 'heading') {
                  const headerText =
                    rowObj._headerText ||
                    rowObj[columns[0]?.key || columns[0]?.id] ||
                    'Section Header';
                  return (
                    <tr
                      key={rIdx}
                      className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-y border-slate-200 dark:border-slate-700/80"
                    >
                      <td
                        colSpan={columns.length + (allowAdd ? 1 : 0)}
                        className="px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-bold"
                      >
                        {headerText}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {columns.map((col, cIdx) => {
                      const colKey = col.key || col.id || `col_${cIdx}`;
                      const cellKey = `${rIdx}_${colKey}`;
                      const cellFieldKey = `${field.name || field.id}.${rIdx}.${colKey}`;
                      const altCellFieldKey = `${field.id}.${rIdx}.${colKey}`;
                      const cellError = errors[cellFieldKey] || errors[altCellFieldKey] || errors[cellKey];
                      const val = rowObj[colKey] ?? '';

                      // Check for custom nested cell field configuration
                      const cellFieldRef = tableConfig.cellFields?.[cellKey];
                      const cellField: FormField | null =
                        cellFieldRef && typeof cellFieldRef === 'object' && 'type' in cellFieldRef
                          ? (cellFieldRef as FormField)
                          : null;

                      const isColLocked =
                        disabled ||
                        isStaffColumnLocked(col) ||
                        (cellField ? isStaffFieldLocked(cellField) : false);

                      const effectiveType = cellField?.type || col.type || 'text';
                      const placeholder = cellField?.placeholder || col.placeholder || col.label;
                      const options = cellField?.options || col.options || [];

                      const isCellHeader =
                        (Array.isArray(rowObj._headerCols) && rowObj._headerCols.includes(colKey)) ||
                        effectiveType === 'heading';

                      if (isCellHeader) {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <div className="px-2.5 py-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                              {val || <span className="text-slate-400 italic font-normal">{col.label}</span>}
                            </div>
                          </td>
                        );
                      }

                      // Date field
                      if (effectiveType === 'date') {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <input
                              id={`input-${field.id}-${rIdx}-${colKey}`}
                              name={`cell_${field.id}_${rIdx}_${colKey}`}
                              type="date"
                              readOnly={isColLocked}
                              disabled={disabled}
                              tabIndex={isColLocked ? -1 : 0}
                              value={val}
                              onKeyDown={(e) => {
                                if (isColLocked && e.key !== 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                if (!isColLocked) {
                                  handleCellChange(rIdx, colKey, e.target.value);
                                }
                              }}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                                isColLocked
                                  ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed select-none text-slate-700 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                              } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                            />
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Time field (Hour, Minute, AM/PM dropdowns)
                      if (effectiveType === 'time') {
                        const raw = String(val || '');
                        const parts = raw.split(' ');
                        const hhmm = parts[0] || '';
                        const [hhStr, mmStr] = hhmm.split(':');
                        const hour = hhStr || '';
                        const minute = mmStr || '';
                        const period = (parts[1] === 'PM' ? 'PM' : parts[1] === 'AM' ? 'AM' : '') as
                          | 'AM'
                          | 'PM'
                          | '';

                        const buildTimeVal = (h: string, m: string, p: string) => {
                          if (!h && !m && !p) return '';
                          const hh = h.padStart(2, '0');
                          const mm = m.padStart(2, '0');
                          return `${hh}:${mm} ${p || 'AM'}`;
                        };

                        const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
                        const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <div className="flex items-center gap-1 min-w-[170px]">
                              <select
                                id={`input-${field.id}-${rIdx}-${colKey}`}
                                name={`cell_${field.id}_${rIdx}_${colKey}`}
                                disabled={isColLocked}
                                value={hour}
                                onChange={(e) =>
                                  handleCellChange(
                                    rIdx,
                                    colKey,
                                    buildTimeVal(e.target.value, minute, period || 'AM')
                                  )
                                }
                                className={`flex-1 border rounded px-1.5 py-1 text-xs focus:outline-none ${
                                  isColLocked
                                    ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-slate-600 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                    : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                                } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                              >
                                <option value="">HH</option>
                                {hours.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <span className="text-slate-400 font-bold text-xs">:</span>
                              <select
                                disabled={isColLocked}
                                value={minute}
                                onChange={(e) =>
                                  handleCellChange(
                                    rIdx,
                                    colKey,
                                    buildTimeVal(hour || '12', e.target.value, period || 'AM')
                                  )
                                }
                                className={`flex-1 border rounded px-1.5 py-1 text-xs focus:outline-none ${
                                  isColLocked
                                    ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-slate-600 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                    : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                                } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                              >
                                <option value="">MM</option>
                                {minutes.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <select
                                disabled={isColLocked}
                                value={period}
                                onChange={(e) =>
                                  handleCellChange(
                                    rIdx,
                                    colKey,
                                    buildTimeVal(hour || '12', minute || '00', e.target.value)
                                  )
                                }
                                className={`w-14 border rounded px-1.5 py-1 text-xs focus:outline-none ${
                                  isColLocked
                                    ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-slate-600 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                    : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                                } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                              >
                                <option value="">AM/PM</option>
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Textarea field
                      if (effectiveType === 'textarea') {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <textarea
                              id={`input-${field.id}-${rIdx}-${colKey}`}
                              name={`cell_${field.id}_${rIdx}_${colKey}`}
                              rows={2}
                              readOnly={isColLocked}
                              disabled={disabled}
                              tabIndex={isColLocked ? -1 : 0}
                              value={val}
                              placeholder={placeholder}
                              onKeyDown={(e) => {
                                if (isColLocked && e.key !== 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              onPaste={(e) => {
                                if (isColLocked) {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                if (!isColLocked) {
                                  handleCellChange(rIdx, colKey, e.target.value);
                                }
                              }}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 resize-y ${
                                isColLocked
                                  ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed select-none text-slate-700 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                              } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                            />
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Select / Dropdown
                      if (effectiveType === 'select' && options.length > 0) {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <select
                              id={`input-${field.id}-${rIdx}-${colKey}`}
                              name={`cell_${field.id}_${rIdx}_${colKey}`}
                              disabled={isColLocked}
                              value={val}
                              onChange={(e) => handleCellChange(rIdx, colKey, e.target.value)}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                                isColLocked
                                  ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-slate-700 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                              } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                            >
                              <option value="">{placeholder || 'Select...'}</option>
                              {options.map((opt, oIdx) => (
                                <option key={oIdx} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Checkbox
                      if (effectiveType === 'checkbox') {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 text-center scroll-mt-24 align-top"
                          >
                            <input
                              id={`input-${field.id}-${rIdx}-${colKey}`}
                              name={`cell_${field.id}_${rIdx}_${colKey}`}
                              type="checkbox"
                              disabled={isColLocked}
                              checked={Boolean(val)}
                              onChange={(e) => handleCellChange(rIdx, colKey, e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75"
                            />
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Radio group
                      if (effectiveType === 'radio' && options.length > 0) {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              {options.map((opt, oIdx) => (
                                <label
                                  key={oIdx}
                                  className={`inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 ${
                                    isColLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                                  }`}
                                >
                                  <input
                                    id={oIdx === 0 ? `input-${field.id}-${rIdx}-${colKey}` : undefined}
                                    type="radio"
                                    disabled={isColLocked}
                                    name={`tbl_${field.id}_${rIdx}_${colKey}`}
                                    value={opt.value}
                                    checked={String(val) === String(opt.value)}
                                    onChange={() => handleCellChange(rIdx, colKey, opt.value)}
                                    className="w-3.5 h-3.5 text-blue-600 focus:ring-0 disabled:cursor-not-allowed"
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              ))}
                            </div>
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Number field
                      if (effectiveType === 'number') {
                        return (
                          <td
                            key={colKey}
                            id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                            data-table-id={field.id}
                            data-row-index={rIdx}
                            data-col-key={colKey}
                            data-cell-key={cellKey}
                            data-cell-error={cellError ? 'true' : undefined}
                            className="px-2.5 py-1.5 scroll-mt-24 align-top"
                          >
                            <input
                              id={`input-${field.id}-${rIdx}-${colKey}`}
                              name={`cell_${field.id}_${rIdx}_${colKey}`}
                              type="number"
                              readOnly={isColLocked}
                              disabled={disabled}
                              tabIndex={isColLocked ? -1 : 0}
                              value={val}
                              placeholder={placeholder}
                              onKeyDown={(e) => {
                                if (isColLocked && e.key !== 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              onPaste={(e) => {
                                if (isColLocked) {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                if (!isColLocked) {
                                  const raw = e.target.value;
                                  handleCellChange(rIdx, colKey, raw === '' ? '' : Number(raw));
                                }
                              }}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                                isColLocked
                                  ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed select-none text-slate-700 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                              } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                            />
                            {cellError && (
                              <p
                                id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                                className="text-[10px] text-rose-500 font-medium mt-0.5"
                              >
                                {cellError}
                              </p>
                            )}
                          </td>
                        );
                      }

                      // Default: Text field
                      return (
                        <td
                          key={colKey}
                          id={`table-cell-${field.id}-${rIdx}-${colKey}`}
                          data-table-id={field.id}
                          data-row-index={rIdx}
                          data-col-key={colKey}
                          data-cell-key={cellKey}
                          data-cell-error={cellError ? 'true' : undefined}
                          className="px-2.5 py-1.5 scroll-mt-24 align-top"
                        >
                          <input
                            id={`input-${field.id}-${rIdx}-${colKey}`}
                            name={`cell_${field.id}_${rIdx}_${colKey}`}
                            type="text"
                            readOnly={isColLocked}
                            disabled={disabled}
                            tabIndex={isColLocked ? -1 : 0}
                            value={val}
                            placeholder={placeholder}
                            onKeyDown={(e) => {
                              if (isColLocked && e.key !== 'Tab') {
                                e.preventDefault();
                              }
                            }}
                            onPaste={(e) => {
                              if (isColLocked) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => {
                              if (!isColLocked) {
                                handleCellChange(rIdx, colKey, e.target.value);
                              }
                            }}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                              isColLocked
                                ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed select-none text-slate-700 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700'
                                : 'bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 focus:ring-blue-500'
                            } ${cellError ? 'border-rose-500 focus:ring-rose-500/30' : ''}`}
                          />
                          {cellError && (
                            <p
                              id={`error-msg-${field.id}-${rIdx}-${colKey}`}
                              className="text-[10px] text-rose-500 font-medium mt-0.5"
                            >
                              {cellError}
                            </p>
                          )}
                        </td>
                      );
                    })}
                    {allowAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDeleteRow(rIdx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {allowAdd && rows.length > 0 && (
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      )}
    </div>
  );
};
