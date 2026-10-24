import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  Type,
  AlignLeft,
  Hash,
  ChevronDown,
  GripVertical,
  CheckSquare,
} from 'lucide-react';
import type { FormField, TableColumn } from '../../types/schema';
import { useFormStore } from '../../store/useFormStore';

interface CanvasTableFieldProps {
  field: FormField;
  sectionId: string;
  rowId: string;
  columnId: string;
}

// Sub-component for individual column header drop target
const TableColumnHeaderCell: React.FC<{
  tableField: FormField;
  col: TableColumn;
  colIdx: number;
}> = ({ tableField, col, colIdx }) => {
  const colKey = col.key || col.id || `col_${colIdx}`;
  const { active } = useDndContext();
  const isDraggingElement =
    Boolean(active?.data.current?.isPaletteItem) ||
    active?.data.current?.type === 'field' ||
    active?.data.current?.type === 'table-cell-field';

  const { setNodeRef, isOver } = useDroppable({
    id: `table-col-header-${tableField.id}-${colKey}`,
    data: {
      type: 'table-column-header',
      tableFieldId: tableField.id,
      colKey,
      columnId: col.id,
    },
    disabled: !isDraggingElement,
  });

  const getColIcon = () => {
    switch (col.type) {
      case 'date':
        return <Calendar className="w-3 h-3 text-emerald-500" />;
      case 'time':
        return <Clock className="w-3 h-3 text-blue-500" />;
      case 'textarea':
        return <AlignLeft className="w-3 h-3 text-purple-500" />;
      case 'number':
        return <Hash className="w-3 h-3 text-amber-500" />;
      case 'select':
        return <ChevronDown className="w-3 h-3 text-indigo-500" />;
      default:
        return <Type className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <th
      ref={setNodeRef}
      className={`px-3 py-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap transition-all border-r border-slate-200/80 dark:border-slate-700/60 last:border-r-0 ${
        isOver
          ? 'bg-blue-100/90 dark:bg-blue-900/60 ring-2 ring-blue-500 text-blue-700 dark:text-blue-200'
          : 'bg-slate-100/70 dark:bg-slate-800/60'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {getColIcon()}
        <span>{col.label}</span>
        {col.required && <span className="text-red-500 ml-0.5">*</span>}
        {col.type && col.type !== 'text' && (
          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
            {col.type}
          </span>
        )}
      </div>
      {isOver && (
        <div className="text-[10px] text-blue-600 dark:text-blue-300 font-bold mt-0.5 animate-pulse">
          Apply to column
        </div>
      )}
    </th>
  );
};

// Sub-component for individual table cell with droppable & nested sortable handle
const TableBodyCell: React.FC<{
  tableField: FormField;
  col: TableColumn;
  colIdx: number;
  rowObj: Record<string, any>;
  rIdx: number;
}> = ({ tableField, col, colIdx, rowObj, rIdx }) => {
  const { form, selectedId, setSelected, removeTableCellField } = useFormStore();
  const colKey = col.key || col.id || `col_${colIdx}`;
  const cellKey = `${rIdx}_${colKey}`;

  const { active } = useDndContext();
  const isDraggingElement =
    Boolean(active?.data.current?.isPaletteItem) ||
    active?.data.current?.type === 'field' ||
    active?.data.current?.type === 'table-cell-field';

  // Droppable setup for this cell
  const { setNodeRef, isOver } = useDroppable({
    id: `table-cell-${tableField.id}-${rIdx}-${colKey}`,
    data: {
      type: 'table-cell',
      tableFieldId: tableField.id,
      rowIndex: rIdx,
      colKey,
      columnId: col.id,
    },
    disabled: !isDraggingElement,
  });

  // Check if cell has a custom nested FormField
  const cellFieldRef = tableField.tableConfig?.cellFields?.[cellKey];
  const cellFieldId = typeof cellFieldRef === 'string' ? cellFieldRef : cellFieldRef?.id;
  const nestedField: FormField | null = cellFieldId
    ? form.fields[cellFieldId] || (typeof cellFieldRef === 'object' ? cellFieldRef : null)
    : null;

  const effectiveType = nestedField ? nestedField.type : col.type || 'text';
  const isSelected = selectedId === nestedField?.id;

  // Make nested field draggable inside cell
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: nestedField?.id || `fallback_${cellKey}`,
    data: {
      type: 'table-cell-field',
      fieldId: nestedField?.id,
      field: nestedField,
      tableFieldId: tableField.id,
      rowIndex: rIdx,
      colKey,
    },
    disabled: !nestedField,
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nestedField) {
      setSelected(nestedField.id, 'field');
    } else {
      setSelected(tableField.id, 'field');
    }
  };

  const handleRemoveField = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeTableCellField(tableField.id, rIdx, colKey);
  };

  const isCellHeader =
    (Array.isArray(rowObj._headerCols) && rowObj._headerCols.includes(colKey)) ||
    col.type === 'heading';
  const cellVal = rowObj[colKey];
  const hasVal = cellVal !== undefined && cellVal !== '';

  return (
    <td
      ref={setNodeRef}
      onClick={handleCellClick}
      className={`px-2.5 py-1.5 transition-all border-r border-slate-200/60 dark:border-slate-800/60 last:border-r-0 ${
        isOver
          ? 'bg-blue-50/90 dark:bg-blue-950/60 ring-2 ring-inset ring-blue-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'
      }`}
    >
      {/* If this cell contains a custom nested FormField */}
      {nestedField ? (
        <div
          ref={setSortableRef}
          style={sortableStyle}
          className={`group/cell relative rounded-lg border p-1.5 text-xs transition-all shadow-xs ${
            isDragging
              ? 'opacity-30 border-2 border-dashed border-blue-500'
              : isSelected
              ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-1 ring-blue-500'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-400'
          }`}
        >
          {/* Header ribbon of nested field with drag handle and remove button */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800 text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Drag to reposition this field to another cell or canvas"
              >
                <GripVertical className="w-3 h-3" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                {nestedField.label || nestedField.name}
              </span>
              <span className="text-[9px] uppercase px-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 font-mono">
                {nestedField.type}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRemoveField}
              title="Remove nested element from this cell"
              className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors opacity-0 group-hover/cell:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Render Mockup based on field type */}
          {effectiveType === 'date' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-600 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{hasVal ? String(cellVal) : 'YYYY-MM-DD'}</span>
            </div>
          )}

          {effectiveType === 'time' && (
            <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px]">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {hasVal ? String(cellVal) : '12:00 AM'}
              </span>
            </div>
          )}

          {effectiveType === 'textarea' && (
            <div className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-500 italic line-clamp-2">
              {hasVal ? String(cellVal) : nestedField.placeholder || 'Enter notes...'}
            </div>
          )}

          {effectiveType === 'number' && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono">
              <span>{hasVal ? String(cellVal) : '0'}</span>
              <Hash className="w-3 h-3 text-slate-400" />
            </div>
          )}

          {effectiveType === 'select' && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px]">
              <span className="truncate">{hasVal ? String(cellVal) : 'Select option...'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          )}

          {effectiveType === 'checkbox' && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Checkbox</span>
            </div>
          )}

          {effectiveType === 'text' && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px]">
              <span className="truncate">{hasVal ? String(cellVal) : nestedField.placeholder || 'Text...'}</span>
              <Type className="w-3 h-3 text-slate-400" />
            </div>
          )}
        </div>
      ) : (
        /* Cell without nested field: renders according to column type */
        <div
          className={`min-h-[30px] px-2 py-1 flex items-center rounded text-[11px] transition-all ${
            isCellHeader
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700'
              : effectiveType === 'time'
              ? 'bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 text-slate-700 dark:text-slate-300'
              : effectiveType === 'date'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-300'
              : hasVal
              ? 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium'
              : 'bg-white/80 dark:bg-slate-900/70 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-blue-400'
          }`}
        >
          {effectiveType === 'time' ? (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 w-full">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-mono text-[11px]">{hasVal ? String(cellVal) : 'HH:MM AM'}</span>
            </div>
          ) : effectiveType === 'date' ? (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 w-full">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px]">{hasVal ? String(cellVal) : 'YYYY-MM-DD'}</span>
            </div>
          ) : effectiveType === 'number' ? (
            <div className="flex items-center justify-between w-full">
              <span>{hasVal ? String(cellVal) : '0'}</span>
              <Hash className="w-3 h-3 text-slate-400" />
            </div>
          ) : effectiveType === 'select' ? (
            <div className="flex items-center justify-between w-full">
              <span>{hasVal ? String(cellVal) : col.placeholder || col.label}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          ) : (
            <span className="truncate">{hasVal ? String(cellVal) : col.placeholder || col.label}</span>
          )}
        </div>
      )}

      {/* Over indicator */}
      {isOver && (
        <div className="mt-1 text-center py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold shadow-xs">
          + Drop in this cell
        </div>
      )}
    </td>
  );
};

export const CanvasTableField: React.FC<CanvasTableFieldProps> = ({ field }) => {
  const { updateField } = useFormStore();

  const columns: TableColumn[] = field.tableConfig?.columns || [
    { id: 'col1', key: 'col1', label: 'Column 1', type: 'text' },
    { id: 'col2', key: 'col2', label: 'Column 2', type: 'text' },
  ];
  const defaultRows = field.tableConfig?.defaultRows || [{}, {}];

  const handleAddRow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newRow: Record<string, any> = {};
    columns.forEach((c, idx) => {
      const k = c.key || c.id || `col_${idx}`;
      newRow[k] = '';
    });
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { columns: [], allowAddRows: true }),
        defaultRows: [...defaultRows, newRow],
      },
    });
  };

  const handleAddColumn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newColNumber = columns.length + 1;
    const newColId = `col_${Date.now().toString(36).slice(-4)}_${newColNumber}`;
    const newCol: TableColumn = {
      id: newColId,
      key: newColId,
      label: `Column ${newColNumber}`,
      type: 'text',
    };
    updateField(field.id, {
      tableConfig: {
        ...(field.tableConfig || { allowAddRows: true, defaultRows: [] }),
        columns: [...columns, newCol],
      },
    });
  };

  return (
    <div className="w-full space-y-2 select-none">
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              {columns.map((col, cIdx) => (
                <TableColumnHeaderCell
                  key={col.id || col.key || cIdx}
                  tableField={field}
                  col={col}
                  colIdx={cIdx}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {defaultRows.map((rowObj, rIdx) => {
              if (rowObj._isHeader || rowObj._rowType === 'heading') {
                const headerText =
                  rowObj._headerText || rowObj[columns[0]?.key || columns[0]?.id] || 'Section Header';
                return (
                  <tr
                    key={rIdx}
                    className="bg-blue-50/70 dark:bg-blue-950/40 border-y border-blue-200/70 dark:border-blue-800/70"
                  >
                    <td
                      colSpan={columns.length}
                      className="px-3 py-1.5 text-xs text-blue-900 dark:text-blue-200 uppercase tracking-wider font-bold"
                    >
                      {headerText}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={rIdx}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors"
                >
                  {columns.map((col, cIdx) => (
                    <TableBodyCell
                      key={col.key || col.id || cIdx}
                      tableField={field}
                      col={col}
                      colIdx={cIdx}
                      rowObj={rowObj}
                      rIdx={rIdx}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Builder Table Bottom Ribbon */}
        <div className="px-3 py-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 dark:text-slate-400">
              {columns.length} columns &bull; {defaultRows.length} rows &bull;{' '}
              {field.tableConfig?.allowAddRows !== false ? 'Dynamic rows' : 'Fixed rows'}
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              Drag & Drop elements into any cell or column
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition-colors"
              title="Add a row to this table"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700 transition-colors"
              title="Add a column to this table"
            >
              <Plus className="w-3 h-3" />
              <span>Add Column</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
