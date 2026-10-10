import type React from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { useFormStore } from '../../store/useFormStore';
import { CanvasSection } from './CanvasSection';

export const BuilderCanvas: React.FC = () => {
  const { form, addSection, setSelected, selectedId } = useFormStore();

  return (
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
                  style={{ backgroundColor: form.settings.theme?.primaryColor || '#3b82f6' }}
                />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                  Form Header
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {form.title || 'Untitled Form'}
              </h1>
              {form.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{form.description}</p>
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
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No sections in canvas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Forms are organized into sections and rows. Start by adding your first section container.
            </p>
            <button
              type="button"
              onClick={() => addSection('General Information')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Section</span>
            </button>
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
  );
};
