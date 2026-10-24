import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Plus, LayoutGrid, GripVertical, AlertCircle } from 'lucide-react';
import type { LayoutRow } from '../../types/schema';
import { CanvasColumn } from './CanvasColumn';
import { useFormStore } from '../../store/useFormStore';

interface CanvasRowProps {
  row: LayoutRow;
  sectionId: string;
}

const PRESET_CONFIGS = [
  { label: '1 Col', widths: [12] },
  { label: '6 / 6', widths: [6, 6] },
  { label: '4 / 4 / 4', widths: [4, 4, 4] },
  { label: '3 / 3 / 3 / 3', widths: [3, 3, 3, 3] },
  { label: '8 / 4', widths: [8, 4] },
  { label: '4 / 8', widths: [4, 8] },
];

export const CanvasRow: React.FC<CanvasRowProps> = ({ row, sectionId }) => {
  const { deleteRow, setRowLayout, addRow, autoBalanceRowWidths } = useFormStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    data: {
      type: 'row',
      rowId: row.id,
      sectionId,
      row,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const colSum = row.columns.reduce((acc, c) => acc + (c.width || 0), 0);
  const isInvalidSum = colSum !== 12;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRow(sectionId, row.id);
  };

  const handleAddRowBelow = (e: React.MouseEvent) => {
    e.stopPropagation();
    addRow(sectionId, [12]);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row relative border rounded-2xl p-3 transition-colors ${
        isDragging
          ? 'opacity-30 border-2 border-dashed border-indigo-500 bg-indigo-50/20 dark:bg-slate-900/40'
          : isInvalidSum
          ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20 dark:bg-rose-950/10'
          : 'border-slate-200/90 hover:border-slate-300 bg-slate-50/70 dark:border-slate-800/80 dark:hover:border-slate-700 dark:bg-slate-900/30'
      }`}
    >
      {/* Row Control Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          {/* Dedicated Row Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Drag to rearrange row position or move across sections"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <LayoutGrid className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Row Layout:</span>
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            {PRESET_CONFIGS.map((preset, idx) => {
              const isActive =
                row.columns.length === preset.widths.length &&
                row.columns.every((c, i) => c.width === preset.widths[i]);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRowLayout(sectionId, row.id, preset.widths)}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 dark:border-transparent dark:bg-slate-800/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 shadow-xs'
                  }`}
                  title={`Change row layout to ${preset.label}`}
                >
                  {preset.label}
                </button>
              );
            })}

            {isInvalidSum && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-semibold">
                <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                <span>Total: {colSum}/12</span>
                <button
                  type="button"
                  onClick={() => autoBalanceRowWidths(sectionId, row.id)}
                  className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold shadow-xs transition-colors"
                  title="Auto-balance this row's columns to equal 12"
                >
                  Balance to 12
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row actions */}
        <div className="flex items-center gap-1 opacity-60 group-hover/row:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleAddRowBelow}
            title="Add row below"
            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200/80 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete this row"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Columns Container (12-column responsive layout) */}
      <div className="grid grid-cols-12 gap-3">
        {row.columns.map((column) => (
          <CanvasColumn
            key={column.id}
            column={column}
            sectionId={sectionId}
            rowId={row.id}
          />
        ))}
      </div>
    </div>
  );
};
