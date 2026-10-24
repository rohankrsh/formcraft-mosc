import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, CollisionDetection } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Sparkles, FolderPlus, FileSpreadsheet, FolderTree, LayoutGrid } from 'lucide-react';
import { Header } from '../components/header/Header';
import { SidebarPalette } from '../components/palette/SidebarPalette';
import { CanvasSection } from '../components/canvas/CanvasSection';
import { SectionDropZone } from '../components/canvas/DropZones';
import { PropertyPanel } from '../components/properties/PropertyPanel';
import { LivePreview } from '../components/preview/LivePreview';
import { DocumentUploadModal } from '../components/upload/DocumentUploadModal';
import { PublishDialog } from '../publish/PublishDialog';
import { useFormStore } from '../store/useFormStore';
import type { FieldType, FormField, LayoutRow, LayoutSection } from '../types/schema';

// Hierarchical collision detection prioritizing specific targets for active drag type
const customCollisionDetection: CollisionDetection = (args) => {
  const activeType =
    args.active.data.current?.type ||
    (args.active.data.current?.isPaletteItem ? 'palette' : null);

  let collisions = pointerWithin(args);
  if (collisions.length === 0) {
    collisions = rectIntersection(args);
  }
  if (collisions.length === 0) return [];

  // When dragging a SECTION: only match section drop zones or sections
  if (activeType === 'section') {
    const dropZone = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'section-drop-zone'
    );
    if (dropZone) return [dropZone];

    const secCollisions = collisions.filter((c) => {
      const type = c.data?.droppableContainer?.data?.current?.type;
      return type === 'section' || type === 'section-drop-zone';
    });
    return secCollisions.length > 0 ? secCollisions : collisions;
  }

  // When dragging a ROW: match row drop zones, rows, or empty sections
  if (activeType === 'row') {
    const dropZone = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'row-drop-zone'
    );
    if (dropZone) return [dropZone];

    const secEmpty = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'section-empty'
    );
    if (secEmpty) return [secEmpty];

    const rowCollisions = collisions.filter((c) => {
      const type = c.data?.droppableContainer?.data?.current?.type;
      return type === 'row' || type === 'row-drop-zone' || type === 'section-empty';
    });
    return rowCollisions.length > 0 ? rowCollisions : collisions;
  }

  // When dragging a FIELD, PALETTE ITEM, or TABLE CELL FIELD:
  // Priority: 1. table-cell, 2. table-column-header, 3. field-drop-zone, 4. field, 5. column, 6. row-drop-zone (new row), 7. section-empty
  if (activeType === 'field' || activeType === 'palette' || activeType === 'table-cell-field') {
    const tableCell = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'table-cell'
    );
    if (tableCell) return [tableCell];

    const tableColHeader = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'table-column-header'
    );
    if (tableColHeader) return [tableColHeader];

    const fieldDropZone = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'field-drop-zone'
    );
    if (fieldDropZone) return [fieldDropZone];

    const fieldCol = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'field'
    );
    if (fieldCol) return [fieldCol];

    const colCol = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'column'
    );
    if (colCol) return [colCol];

    const rowDropZone = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'row-drop-zone'
    );
    if (rowDropZone) return [rowDropZone];

    const secEmpty = collisions.find(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'section-empty'
    );
    if (secEmpty) return [secEmpty];
  }

  return collisions;
};

export function BuilderPage() {
  const { formId } = useParams<{ formId?: string }>();
  const {
    form,
    isPreviewMode,
    addField,
    moveField,
    moveFieldToNewRow,
    addFieldToNewRow,
    addTableCellField,
    moveTableCellField,
    moveFieldToTableCell,
    moveTableCellToCanvas,
    moveTableCellToNewRow,
    setTableColumnType,
    addSection,
    moveSection,
    moveRow,
    setSelected,
    selectedId,
    setUploadModalOpen,
    loadForm,
  } = useFormStore();

  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  // Load existing form definition if formId is present in URL
  useEffect(() => {
    if (!formId) return;

    fetch(`/api/forms/${encodeURIComponent(formId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          loadForm(data.data);
        }
      })
      .catch((err) => {
        console.error(`Failed to load form "${formId}":`, err);
      });
  }, [formId, loadForm]);

  const [activeDragItem, setActiveDragItem] = useState<{
    type?: 'palette' | 'field' | 'row' | 'section' | 'table-cell-field';
    isPaletteItem?: boolean;
    fieldType?: FieldType;
    field?: FormField;
    row?: LayoutRow;
    section?: LayoutSection;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.isPaletteItem) {
      setActiveDragItem({
        type: 'palette',
        isPaletteItem: true,
        fieldType: data.fieldType,
      });
    } else if (data?.type === 'field') {
      setActiveDragItem({
        type: 'field',
        isPaletteItem: false,
        field: data.field,
      });
    } else if (data?.type === 'table-cell-field') {
      setActiveDragItem({
        type: 'table-cell-field',
        isPaletteItem: false,
        field: data.field,
      });
    } else if (data?.type === 'row') {
      setActiveDragItem({
        type: 'row',
        row: data.row,
      });
    } else if (data?.type === 'section') {
      setActiveDragItem({
        type: 'section',
        section: data.section,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // 0. DROP ONTO TABLE CELL
    if (overData?.type === 'table-cell') {
      const targetTableId = overData.tableFieldId;
      const targetRow = overData.rowIndex;
      const targetColKey = overData.colKey;

      if (activeData?.isPaletteItem && activeData.fieldType) {
        addTableCellField(targetTableId, targetRow, targetColKey, activeData.fieldType);
      } else if (activeData?.type === 'table-cell-field') {
        moveTableCellField(
          activeData.tableFieldId,
          activeData.rowIndex,
          activeData.colKey,
          targetTableId,
          targetRow,
          targetColKey
        );
      } else if (activeData?.type === 'field') {
        moveFieldToTableCell(active.id as string, targetTableId, targetRow, targetColKey);
      }
      return;
    }

    // 0b. DROP ONTO TABLE COLUMN HEADER (to configure column field type)
    if (overData?.type === 'table-column-header') {
      const targetTableId = overData.tableFieldId;
      const targetColKey = overData.colKey;

      if (activeData?.isPaletteItem && activeData.fieldType) {
        setTableColumnType(targetTableId, targetColKey, activeData.fieldType);
      } else if (activeData?.type === 'table-cell-field' && activeData.field?.type) {
        setTableColumnType(targetTableId, targetColKey, activeData.field.type);
      } else if (activeData?.type === 'field' && activeData.field?.type) {
        setTableColumnType(targetTableId, targetColKey, activeData.field.type);
      }
      return;
    }

    // 1. REARRANGE SECTION
    if (activeData?.type === 'section') {
      const activeSecId = active.id as string;
      let targetIndex: number | null = null;

      if (overData?.type === 'section-drop-zone') {
        targetIndex = overData.targetIndex;
      } else if (overData?.type === 'section') {
        const overSecId = over.id as string;
        const overIdx = form.layout.findIndex((s) => s.id === overSecId);
        if (overIdx !== -1) {
          targetIndex = overIdx;
        }
      }

      if (targetIndex !== null) {
        moveSection(activeSecId, targetIndex);
      }
      return;
    }

    // 2. REARRANGE ROW (within section or between sections)
    if (activeData?.type === 'row') {
      const activeRowId = active.id as string;
      const sourceSecId = activeData.sectionId;

      if (overData?.type === 'row-drop-zone') {
        moveRow(sourceSecId, activeRowId, overData.sectionId, overData.targetIndex);
      } else if (overData?.type === 'row') {
        const overRowId = over.id as string;
        for (const sec of form.layout) {
          const idx = sec.rows.findIndex((r) => r.id === overRowId);
          if (idx !== -1) {
            moveRow(sourceSecId, activeRowId, sec.id, idx);
            break;
          }
        }
      } else if (overData?.type === 'section-empty') {
        moveRow(sourceSecId, activeRowId, overData.sectionId, 0);
      }
      return;
    }

    // 3. DROP FIELD OR PALETTE ITEM ONTO ROW-DROP-ZONE (Creates a new row with this field)
    if (overData?.type === 'row-drop-zone') {
      const targetSecId = overData.sectionId;
      const targetRowIndex = overData.targetIndex;

      if (activeData?.isPaletteItem && activeData.fieldType) {
        addFieldToNewRow(activeData.fieldType, targetSecId, targetRowIndex);
      } else if (activeData?.type === 'field') {
        moveFieldToNewRow(active.id as string, targetSecId, targetRowIndex);
      } else if (activeData?.type === 'table-cell-field') {
        moveTableCellToNewRow(
          activeData.tableFieldId,
          activeData.rowIndex,
          activeData.colKey,
          targetSecId,
          targetRowIndex
        );
      }
      return;
    }

    // 4. DROP FIELD OR PALETTE ITEM ONTO EMPTY SECTION (Creates first row in section)
    if (overData?.type === 'section-empty') {
      const targetSecId = overData.sectionId;

      if (activeData?.isPaletteItem && activeData.fieldType) {
        addFieldToNewRow(activeData.fieldType, targetSecId, 0);
      } else if (activeData?.type === 'field') {
        moveFieldToNewRow(active.id as string, targetSecId, 0);
      } else if (activeData?.type === 'table-cell-field') {
        moveTableCellToNewRow(
          activeData.tableFieldId,
          activeData.rowIndex,
          activeData.colKey,
          targetSecId,
          0
        );
      }
      return;
    }

    // 5. REARRANGE FIELD OR DROP PALETTE ITEM INTO A COLUMN / FIELD / FIELD-DROP-ZONE
    let targetColId: string | null = null;
    let targetIndex: number | undefined = undefined;

    if (overData?.type === 'field-drop-zone') {
      targetColId = overData.columnId;
      targetIndex = overData.targetIndex;
    } else if (overData?.type === 'column') {
      targetColId = overData.columnId;
    } else if (overData?.type === 'field') {
      const overFieldId = over.id as string;
      for (const sec of form.layout) {
        for (const row of sec.rows) {
          for (const col of row.columns) {
            const idx = col.fieldIds.indexOf(overFieldId);
            if (idx !== -1) {
              targetColId = col.id;
              targetIndex = idx;
              break;
            }
          }
          if (targetColId) break;
        }
        if (targetColId) break;
      }
    }

    if (!targetColId) return;

    // Dropping a new item from palette
    if (activeData?.isPaletteItem && activeData.fieldType) {
      let targetSecId: string | undefined;
      let targetRowId: string | undefined;
      for (const sec of form.layout) {
        for (const row of sec.rows) {
          if (row.columns.some((c) => c.id === targetColId)) {
            targetSecId = sec.id;
            targetRowId = row.id;
            break;
          }
        }
        if (targetSecId) break;
      }

      addField(activeData.fieldType, targetSecId, targetRowId, targetColId, targetIndex);
      return;
    }

    // Moving an existing field from a table cell to canvas
    if (activeData?.type === 'table-cell-field') {
      moveTableCellToCanvas(
        activeData.tableFieldId,
        activeData.rowIndex,
        activeData.colKey,
        targetColId,
        targetIndex
      );
      return;
    }

    // Moving an existing field
    if (activeData?.type === 'field') {
      const fieldId = active.id as string;
      moveField(fieldId, targetColId, targetIndex);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden transition-colors">
      {/* Top Application Header */}
      <Header onOpenPublish={() => setIsPublishDialogOpen(true)} />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {isPreviewMode ? (
          <LivePreview />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Left Sidebar: Element Palette */}
            <SidebarPalette />

            {/* Central Canvas: Visual Drag-Drop Grid Surface */}
            <main
              onClick={() => setSelected(null)}
              className="flex-1 bg-slate-100/70 dark:bg-slate-950/60 overflow-y-auto p-6 md:p-8 flex flex-col items-center select-none transition-colors"
            >
              <div className="w-full max-w-4xl space-y-4">
                {/* Form Canvas Header Card */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected('form_settings', 'settings');
                  }}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    selectedId === 'form_settings'
                      ? 'border-blue-500 bg-white dark:bg-slate-900/90 ring-2 ring-blue-500/20 shadow-lg'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-3 h-3 rounded-full shadow-xs"
                          style={{
                            backgroundColor: form.settings.theme?.primaryColor || '#3b82f6',
                          }}
                        />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                          Form Header
                        </span>
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {form.title || 'Untitled Form'}
                      </h1>
                      {form.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {form.description}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 dark:text-slate-400 dark:bg-slate-800/80 dark:border-slate-700/60 px-2.5 py-1 rounded-lg">
                      Click to edit theme & settings
                    </span>
                  </div>
                </div>

                {/* Sections List with Sortable Context & Drop Zones */}
                <SortableContext
                  items={form.layout.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {form.layout.length > 0 && <SectionDropZone index={0} />}

                  <div className="space-y-4">
                    {form.layout.map((section, idx) => (
                      <div key={section.id} className="space-y-2">
                        <CanvasSection section={section} index={idx} />
                        <SectionDropZone index={idx + 1} />
                      </div>
                    ))}
                  </div>
                </SortableContext>

                {/* Empty Canvas Placeholder */}
                {form.layout.length === 0 && (
                  <div className="border-2 border-dashed border-slate-300 bg-white/60 dark:border-slate-800 dark:bg-slate-900/20 rounded-3xl p-12 text-center shadow-xs">
                    <FolderPlus className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Blank Canvas Ready
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                      Forms are organized into sections and rows. Start by adding your first section
                      container or clicking an element in the palette.
                    </p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => addSection('General Information')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Section</span>
                      </button>

                      <button
                        type="button"
                        id="empty-canvas-upload-btn"
                        onClick={() => setUploadModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Import from Excel</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Section Floating / Bottom Button */}
                {form.layout.length > 0 && (
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => addSection()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-850 dark:text-slate-300 dark:hover:text-white text-xs font-medium shadow-xs transition-all group"
                    >
                      <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>Add Another Section Container</span>
                    </button>
                  </div>
                )}
              </div>
            </main>

            {/* Right Panel: Properties Inspector */}
            <PropertyPanel />

            {/* Drag Overlay: Visual Ghost Preview */}
            <DragOverlay
              dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: {
                    active: {
                      opacity: '0.4',
                    },
                  },
                }),
              }}
            >
              {activeDragItem?.type === 'section' && activeDragItem.section ? (
                <div className="p-4 rounded-2xl bg-white border-2 border-indigo-500 dark:bg-slate-900 shadow-2xl max-w-md ring-4 ring-indigo-500/20 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                      <FolderTree className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {activeDragItem.section.title || 'Untitled Section'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Moving Section ({activeDragItem.section.rows.length} rows)
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeDragItem?.type === 'row' && activeDragItem.row ? (
                <div className="p-3.5 rounded-xl bg-white border-2 border-indigo-500 dark:bg-slate-900 shadow-2xl max-w-sm ring-4 ring-indigo-500/20 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        Moving Row ({activeDragItem.row.columns.length} columns)
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {activeDragItem.row.columns.flatMap((c) => c.fieldIds).length} fields inside
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeDragItem?.isPaletteItem ? (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-2xl ring-4 ring-blue-500/20 select-none">
                  <Sparkles className="w-4 h-4" />
                  <span>Adding {activeDragItem.fieldType}...</span>
                </div>
              ) : activeDragItem?.field ? (
                <div className="p-3.5 rounded-xl bg-white border-2 border-blue-500 dark:bg-slate-900 shadow-2xl text-xs text-slate-800 dark:text-white max-w-xs ring-4 ring-blue-500/20 select-none">
                  <p className="font-semibold text-slate-900 dark:text-slate-200">
                    {activeDragItem.field.label}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                    {activeDragItem.field.type} field
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Document Upload & Auto-Generate Modal */}
      <DocumentUploadModal />

      {/* Publish Dialog */}
      <PublishDialog
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        form={form}
      />
    </div>
  );
}
