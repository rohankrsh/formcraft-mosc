import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Sliders } from 'lucide-react';
import type { LayoutColumn, FormField } from '../../types/schema';
import { CanvasFieldItem } from './CanvasFieldItem';
import { useFormStore } from '../../store/useFormStore';

interface CanvasColumnProps {
  column: LayoutColumn;
  sectionId: string;
  rowId: string;
}

export const CanvasColumn: React.FC<CanvasColumnProps> = ({
  column,
  sectionId,
  rowId,
}) => {
  const { form, setColumnWidth, selectedId, setSelected } = useFormStore();

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnId: column.id,
      sectionId,
      rowId,
    },
  });

  const isSelected = selectedId === column.id;

  // Map 1-12 col span styles
  const colSpanStyle: React.CSSProperties = {
    gridColumn: `span ${Math.min(12, Math.max(1, column.width))} / span ${Math.min(
      12,
      Math.max(1, column.width)
    )}`,
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newW = parseInt(e.target.value, 10);
    if (!isNaN(newW) && newW >= 1 && newW <= 12) {
      setColumnWidth(sectionId, rowId, column.id, newW);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={colSpanStyle}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(column.id, 'column');
      }}
      className={`relative min-h-[110px] rounded-xl p-2.5 transition-all flex flex-col border shadow-xs ${
        isOver
          ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/40 dark:bg-blue-500/10'
          : isSelected
          ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-400/30 dark:border-indigo-500/80 dark:bg-slate-900/40'
          : 'border-slate-200/90 bg-white/90 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/40 dark:hover:border-slate-700/80'
      }`}
    >
      {/* Column Mini Controls Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800/60 text-[10px] text-slate-500 select-none">
        <div className="flex items-center gap-1.5 font-medium">
          <Sliders className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          <span>Span:</span>
          <select
            value={column.width}
            onChange={handleWidthChange}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 rounded px-1.5 py-0.5 text-[10px] cursor-pointer focus:outline-none focus:border-blue-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((w) => (
              <option key={w} value={w}>
                {w}/12 ({Math.round((w / 12) * 100)}%)
              </option>
            ))}
          </select>
        </div>

        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600">
          {column.fieldIds.length} {column.fieldIds.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Sortable Field Items Container */}
      <SortableContext items={column.fieldIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2.5">
          {column.fieldIds.map((fieldId) => {
            const field: FormField | undefined = form.fields[fieldId];
            if (!field) return null;
            return (
              <CanvasFieldItem
                key={field.id}
                field={field}
                sectionId={sectionId}
                rowId={rowId}
                columnId={column.id}
              />
            );
          })}

          {column.fieldIds.length === 0 && (
            <div
              className={`h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                isOver
                  ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-slate-300 text-slate-400 dark:border-slate-800 dark:text-slate-500 hover:border-slate-400'
              }`}
            >
              <Plus className="w-4 h-4 mb-1 opacity-60" />
              <span className="text-[11px] font-medium">Drop fields here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};
