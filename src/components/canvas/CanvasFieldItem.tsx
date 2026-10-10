import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Copy,
  Calendar,
  Clock,
  ChevronDown,
  Hash,
  Type,
  AlignLeft,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import type { FormField } from '../../types/schema';
import { useFormStore } from '../../store/useFormStore';

interface CanvasFieldItemProps {
  field: FormField;
  sectionId: string;
  rowId: string;
  columnId: string;
}

export const CanvasFieldItem: React.FC<CanvasFieldItemProps> = ({
  field,
}) => {
  const { selectedId, setSelected, deleteField, duplicateField } = useFormStore();

  const isSelected = selectedId === field.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      field,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(field.id, 'field');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteField(field.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateField(field.id);
  };

  // Render mock preview of the field
  const renderFieldControl = () => {
    switch (field.type) {
      case 'text':
        return (
          <div className="relative">
            <input
              type="text"
              readOnly
              placeholder={field.placeholder || 'Enter text...'}
              defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 pointer-events-none cursor-default"
            />
            <Type className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
          </div>
        );

      case 'textarea':
        return (
          <div className="relative">
            <textarea
              readOnly
              rows={3}
              placeholder={field.placeholder || 'Enter long text...'}
              defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 pointer-events-none resize-none cursor-default"
            />
            <AlignLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
          </div>
        );

      case 'number':
        return (
          <div className="relative">
            <input
              type="number"
              readOnly
              placeholder={field.placeholder || '0'}
              defaultValue={typeof field.defaultValue === 'number' ? field.defaultValue : ''}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 pointer-events-none cursor-default"
            />
            <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
          </div>
        );

      case 'date':
        return (
          <div className="relative">
            <input
              type="text"
              readOnly
              placeholder="YYYY-MM-DD"
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 pointer-events-none cursor-default"
            />
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
          </div>
        );

      case 'time':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                placeholder="HH : MM"
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 pointer-events-none cursor-default pr-8"
              />
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
            </div>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/70 text-[11px] font-semibold pointer-events-none shrink-0">
              <span className="px-2.5 py-2 bg-blue-500 text-white">AM</span>
              <span className="px-2.5 py-2 bg-slate-50 text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">PM</span>
            </div>
          </div>
        );


      case 'select':
        return (
          <div className="relative">
            <div className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/70 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between cursor-default">
              <span className="truncate">
                {field.options && field.options.length > 0
                  ? field.options.find((o) => o.value === field.defaultValue)?.label ||
                  field.options[0].label
                  : 'Select an option...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-1.5 pt-1">
            {(field.options || [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' },
            ]).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${field.defaultValue === opt.value
                      ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/20'
                      : 'border-slate-300 dark:border-slate-600'
                    }`}
                >
                  {field.defaultValue === opt.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </div>
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-1.5 pt-1">
            {(field.options || [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' },
            ]).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${Array.isArray(field.defaultValue) && field.defaultValue.includes(opt.value)
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                      : 'border-slate-300 dark:border-slate-600'
                    }`}
                >
                  {Array.isArray(field.defaultValue) &&
                    field.defaultValue.includes(opt.value) && (
                      <CheckSquare className="w-2.5 h-2.5" />
                    )}
                </div>
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        );

      case 'heading':
        return (
          <div className="py-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{field.label}</h3>
            {field.helpText && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{field.helpText}</p>}
          </div>
        );

      case 'divider':
        return (
          <div className="py-2">
            <hr className="border-t border-slate-200 dark:border-slate-700/80" />
          </div>
        );

      case 'table': {
        const columns = field.tableConfig?.columns || [
          { id: 'col1', key: 'col1', label: 'Column 1', type: 'text' },
          { id: 'col2', key: 'col2', label: 'Column 2', type: 'text' },
        ];
        const defaultRows = field.tableConfig?.defaultRows || [{}, {}];

        return (
          <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/70 bg-slate-100/70 dark:bg-slate-800/60">
                  {columns.map((col, cIdx) => (
                    <th key={col.id || col.key || cIdx} className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {col.label}
                      {col.required && <span className="text-red-500 ml-0.5">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {(defaultRows.length > 0 ? defaultRows : [{}]).slice(0, 10).map((row, rIdx) => {
                  if (row._isHeader || row._rowType === 'heading') {
                    const headerText = row._headerText || row[columns[0]?.key || columns[0]?.id] || 'Section Header';
                    return (
                      <tr key={rIdx} className="bg-blue-50/70 dark:bg-blue-950/40 border-y border-blue-200/70 dark:border-blue-800/70">
                        <td colSpan={columns.length} className="px-3 py-1.5 text-xs text-blue-900 dark:text-blue-200 uppercase tracking-wider font-bold">
                          {headerText}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={rIdx} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40">
                      {columns.map((col, cIdx) => {
                        const colKey = col.key || col.id || `col_${cIdx}`;
                        const isCellHeader =
                          (Array.isArray(row._headerCols) && row._headerCols.includes(colKey)) ||
                          col.type === 'heading';
                        const cellVal = row[colKey];
                        const hasVal = cellVal !== undefined && cellVal !== '';

                        return (
                          <td key={colKey} className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                            <div
                              className={`min-h-6 px-2 py-1 flex items-center rounded text-[11px] ${
                                isCellHeader
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700'
                                  : hasVal
                                  ? 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium'
                                  : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {hasVal ? cellVal : col.label}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50">
              <span>{columns.length} columns &bull; {field.tableConfig?.allowAddRows !== false ? 'Dynamic rows' : 'Fixed rows'}</span>
              <span className="text-blue-500 font-medium">+ Add Row</span>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleSelect}
      className={`group relative rounded-xl border p-3 transition-all duration-150 select-none shadow-xs ${isDragging
          ? 'opacity-40 ring-2 ring-blue-500 bg-white dark:bg-slate-900/50'
          : field._needsReview
            ? isSelected
              ? 'bg-amber-50/40 border-amber-500 ring-2 ring-amber-500/30 shadow-md dark:bg-amber-950/40 dark:ring-amber-500/40'
              : 'bg-amber-50/20 border-amber-400 hover:border-amber-500 dark:bg-amber-950/20 dark:border-amber-600/70 dark:hover:border-amber-500'
            : isSelected
              ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-md dark:bg-slate-900/90 dark:ring-blue-500/30'
              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900/60 dark:border-slate-800 dark:hover:border-slate-700'
        }`}
    >
      {/* Top Action Ribbon on Hover / Selection */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {field.type !== 'heading' && field.type !== 'divider' && (
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 cursor-pointer">
              <span>{field.label}</span>
              {field.validation?.required && (
                <span className="text-rose-500 font-bold text-xs" title="Required field">
                  *
                </span>
              )}
            </label>
          )}

          {field.type === 'heading' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20 px-1.5 py-0.5 rounded">
              Header
            </span>
          )}

          {field.type === 'divider' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 border border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700 px-1.5 py-0.5 rounded">
              Divider
            </span>
          )}

          {/* _needsReview Visual Badge */}
          {field._needsReview && (
            <span
              title={field._reviewReason || 'Imported field flagged for manual review'}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 shadow-xs cursor-help"
            >
              <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Review Needed</span>
            </span>
          )}
        </div>

        {/* Action icons */}
        <div
          className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
        >
          <span className="text-[9px] font-mono text-slate-500 bg-slate-100 border border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800 px-1.5 py-0.5 rounded">
            {field.name}
          </span>
          <button
            type="button"
            onClick={handleDuplicate}
            title="Duplicate field"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete field"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Field Input Control Mockup */}
      <div>{renderFieldControl()}</div>

      {/* Help text display for regular inputs */}
      {field.helpText && field.type !== 'heading' && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 italic">{field.helpText}</p>
      )}

      {/* Validation badge indicators */}
      {field.validation &&
        (field.validation.pattern ||
          typeof field.validation.min === 'number' ||
          typeof field.validation.max === 'number') && (
          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
            {typeof field.validation.min === 'number' && (
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                min: {field.validation.min}
              </span>
            )}
            {typeof field.validation.max === 'number' && (
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                max: {field.validation.max}
              </span>
            )}
            {field.validation.pattern && (
              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-mono truncate max-w-[120px]">
                regex
              </span>
            )}
          </div>
        )}
    </div>
  );
};
