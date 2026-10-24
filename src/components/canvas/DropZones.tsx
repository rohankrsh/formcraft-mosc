import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { Plus, ArrowDown, FolderTree, LayoutGrid } from 'lucide-react';

interface SectionDropZoneProps {
  index: number;
}

export const SectionDropZone: React.FC<SectionDropZoneProps> = ({ index }) => {
  const { active } = useDndContext();
  const isSectionActive = active?.data.current?.type === 'section';

  const { setNodeRef, isOver } = useDroppable({
    id: `section-drop-zone-${index}`,
    data: {
      type: 'section-drop-zone',
      targetIndex: index,
    },
    disabled: !isSectionActive,
  });

  if (!isSectionActive) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 flex items-center justify-center my-1 select-none ${
        isOver
          ? 'py-3.5 opacity-100 scale-[1.01]'
          : 'py-1 opacity-70 hover:opacity-100'
      }`}
    >
      <div
        className={`w-full flex items-center justify-center gap-2 transition-all ${
          isOver
            ? 'h-8 rounded-xl bg-blue-600/10 border-2 border-dashed border-blue-500 text-blue-600 dark:text-blue-400 font-semibold text-xs shadow-md shadow-blue-500/10'
            : 'h-2 rounded-full border border-dashed border-blue-400/50 bg-blue-50/40 dark:bg-blue-950/20'
        }`}
      >
        {isOver && (
          <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-xs">
            <ArrowDown className="w-3 h-3 stroke-[3]" />
            <span>Drop Section Here</span>
          </span>
        )}
      </div>
    </div>
  );
};

interface RowDropZoneProps {
  sectionId: string;
  targetIndex: number;
}

export const RowDropZone: React.FC<RowDropZoneProps> = ({ sectionId, targetIndex }) => {
  const { active } = useDndContext();
  const isRowActive = active?.data.current?.type === 'row';
  const isFieldActive =
    active?.data.current?.type === 'field' || Boolean(active?.data.current?.isPaletteItem);

  const isActive = isRowActive || isFieldActive;

  const { setNodeRef, isOver } = useDroppable({
    id: `row-drop-zone-${sectionId}-${targetIndex}`,
    data: {
      type: 'row-drop-zone',
      sectionId,
      targetIndex,
    },
    disabled: !isActive,
  });

  if (!isActive) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 flex items-center justify-center my-0.5 select-none ${
        isOver
          ? 'py-3 opacity-100 scale-[1.01]'
          : 'py-0.5 opacity-60 hover:opacity-100'
      }`}
    >
      <div
        className={`w-full flex items-center justify-center transition-all ${
          isOver
            ? isRowActive
              ? 'h-7 rounded-xl bg-indigo-500/15 border-2 border-dashed border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold text-xs shadow-md shadow-indigo-500/10'
              : 'h-7 rounded-xl bg-emerald-500/15 border-2 border-dashed border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold text-xs shadow-md shadow-emerald-500/10'
            : isRowActive
            ? 'h-1.5 rounded-full border border-dashed border-indigo-400/50 bg-indigo-50/40 dark:bg-indigo-950/20'
            : 'h-1.5 rounded-full border border-dashed border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-950/20'
        }`}
      >
        {isOver && (
          <span
            className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full text-white text-[11px] font-bold shadow-xs ${
              isRowActive ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}
          >
            {isRowActive ? (
              <>
                <ArrowDown className="w-3 h-3 stroke-[3]" />
                <span>Insert Row Here</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Drop to Create New Row</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

interface FieldDropZoneProps {
  columnId: string;
  sectionId: string;
  rowId: string;
  targetIndex: number;
}

export const FieldDropZone: React.FC<FieldDropZoneProps> = ({
  columnId,
  sectionId,
  rowId,
  targetIndex,
}) => {
  const { active } = useDndContext();
  const isFieldActive =
    active?.data.current?.type === 'field' || Boolean(active?.data.current?.isPaletteItem);

  const { setNodeRef, isOver } = useDroppable({
    id: `field-drop-zone-${columnId}-${targetIndex}`,
    data: {
      type: 'field-drop-zone',
      columnId,
      sectionId,
      rowId,
      targetIndex,
    },
    disabled: !isFieldActive,
  });

  if (!isFieldActive) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-150 flex items-center justify-center my-0.5 select-none ${
        isOver
          ? 'py-2 opacity-100 scale-[1.01]'
          : 'py-0.5 opacity-40 hover:opacity-100'
      }`}
    >
      <div
        className={`w-full flex items-center justify-center transition-all ${
          isOver
            ? 'h-6 rounded-lg bg-blue-500/15 border-2 border-dashed border-blue-500 text-blue-600 dark:text-blue-400 font-semibold text-[11px] shadow-xs'
            : 'h-1 rounded-full border border-dashed border-blue-400/50 bg-blue-50/40 dark:bg-blue-950/20'
        }`}
      >
        {isOver && (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-xs">
            <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />
            <span>Drop Field Here</span>
          </span>
        )}
      </div>
    </div>
  );
};

interface SectionEmptyDropZoneProps {
  sectionId: string;
  onAddRow: (e: React.MouseEvent) => void;
}

export const SectionEmptyDropZone: React.FC<SectionEmptyDropZoneProps> = ({
  sectionId,
  onAddRow,
}) => {
  const { active } = useDndContext();
  const isRowActive = active?.data.current?.type === 'row';
  const isFieldActive =
    active?.data.current?.type === 'field' || Boolean(active?.data.current?.isPaletteItem);
  const isDragging = isRowActive || isFieldActive;

  const { setNodeRef, isOver } = useDroppable({
    id: `section-empty-${sectionId}`,
    data: {
      type: 'section-empty',
      sectionId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-8 border-2 border-dashed rounded-xl text-center transition-all duration-200 ${
        isOver
          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/40 scale-[1.01]'
          : isDragging
          ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-transparent'
      }`}
    >
      {isOver ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-2">
          {isRowActive ? (
            <LayoutGrid className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-bounce" />
          ) : (
            <Plus className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />
          )}
          <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
            {isRowActive
              ? 'Release to move row into this section'
              : 'Release to create new row with this field'}
          </p>
        </div>
      ) : isDragging ? (
        <div className="flex flex-col items-center justify-center gap-1 py-2">
          <FolderTree className="w-6 h-6 text-indigo-400 dark:text-indigo-500" />
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            Drop row or field here to populate this section
          </p>
        </div>
      ) : (
        <>
          <FolderTree className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            This section has no rows yet
          </p>
          <button
            type="button"
            onClick={onAddRow}
            className="mt-3 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create first row</span>
          </button>
        </>
      )}
    </div>
  );
};
