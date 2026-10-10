import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FormField } from '../types/schema';

interface RuntimeTableProps {
  field: FormField;
  value: any[];
  onChange: (newValue: any[]) => void;
  disabled?: boolean;
}

export const RuntimeTable: React.FC<RuntimeTableProps> = ({
  field,
  value,
  onChange,
  disabled = false,
}) => {
  const tableConfig = field.tableConfig || { columns: [], allowAddRows: true, defaultRows: [] };
  const columns = tableConfig.columns || [];
  const rows = Array.isArray(value) ? value : [];
  const allowAdd = tableConfig.allowAddRows !== false && !disabled;

  const handleCellChange = (rowIndex: number, colKey: string, cellVal: any) => {
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
      emptyRow[key] = '';
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
                return (
                  <th
                    key={key}
                    className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    {col.label}
                    {col.required && <span className="text-rose-500 ml-0.5">*</span>}
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
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium ml-1 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add first row
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((rowObj, rIdx) => {
                if (rowObj._isHeader || rowObj._rowType === 'heading') {
                  const headerText = rowObj._headerText || rowObj[columns[0]?.key || columns[0]?.id] || 'Section Header';
                  return (
                    <tr key={rIdx} className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-y border-slate-200 dark:border-slate-700/80">
                      <td colSpan={columns.length + (allowAdd ? 1 : 0)} className="px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-bold">
                        {headerText}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    {columns.map((col, cIdx) => {
                      const colKey = col.key || col.id || `col_${cIdx}`;
                      const val = rowObj[colKey] ?? '';
                      const isCellHeader =
                        (Array.isArray(rowObj._headerCols) && rowObj._headerCols.includes(colKey)) ||
                        col.type === 'heading';

                      if (isCellHeader) {
                        return (
                          <td key={colKey} className="px-2.5 py-1.5">
                            <div className="px-2.5 py-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                              {val || <span className="text-slate-400 italic font-normal">{col.label}</span>}
                            </div>
                          </td>
                        );
                      }

                      if (col.type === 'select' && col.options && col.options.length > 0) {
                        return (
                          <td key={colKey} className="px-2.5 py-1.5">
                            <select
                              disabled={disabled}
                              value={val}
                              onChange={(e) => handleCellChange(rIdx, colKey, e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Select...</option>
                              {col.options.map((opt, oIdx) => (
                                <option key={oIdx} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      return (
                        <td key={colKey} className="px-2.5 py-1.5">
                          <input
                            disabled={disabled}
                            type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                            value={val}
                            placeholder={col.placeholder || col.label}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const finalVal = col.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw;
                              handleCellChange(rIdx, colKey, finalVal);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      );
                    })}
                    {allowAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDeleteRow(rIdx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
