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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, Sparkles, FolderPlus, FileSpreadsheet } from 'lucide-react';
import { Header } from '../components/header/Header';
import { SidebarPalette } from '../components/palette/SidebarPalette';
import { CanvasSection } from '../components/canvas/CanvasSection';
import { PropertyPanel } from '../components/properties/PropertyPanel';
import { LivePreview } from '../components/preview/LivePreview';
import { DocumentUploadModal } from '../components/upload/DocumentUploadModal';
import { PublishDialog } from '../publish/PublishDialog';
import { useFormStore } from '../store/useFormStore';
import type { FieldType, FormField } from '../types/schema';

// Custom collision detection strategy that falls back gracefully
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return rectIntersection(args);
};

export function BuilderPage() {
  const { formId } = useParams<{ formId?: string }>();
  const {
    form,
    isPreviewMode,
    addField,
    moveField,
    addSection,
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
    isPaletteItem?: boolean;
    fieldType?: FieldType;
    field?: FormField;
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
        isPaletteItem: true,
        fieldType: data.fieldType,
      });
    } else if (data?.type === 'field') {
      setActiveDragItem({
        isPaletteItem: false,
        field: data.field,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Determine target column and position
    let targetColId: string | null = null;
    let targetIndex: number | undefined = undefined;

    if (overData?.type === 'column') {
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
              <div className="w-full max-w-4xl space-y-6">
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

                {/* Sections List */}
                <div className="space-y-6">
                  {form.layout.map((section, idx) => (
                    <CanvasSection key={section.id} section={section} index={idx} />
                  ))}
                </div>

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

            {/* Drag Overlay */}
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
              {activeDragItem?.isPaletteItem ? (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-2xl ring-2 ring-white/20">
                  <Sparkles className="w-4 h-4" />
                  <span>Adding {activeDragItem.fieldType}...</span>
                </div>
              ) : activeDragItem?.field ? (
                <div className="p-3.5 rounded-xl bg-white border border-blue-500 dark:bg-slate-900 shadow-2xl text-xs text-slate-800 dark:text-white max-w-xs ring-2 ring-blue-500/40">
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
