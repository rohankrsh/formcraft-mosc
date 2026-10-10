import type React from 'react';
import {
  FolderTree,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Settings,
  Database,
} from 'lucide-react';
import type { LayoutSection } from '../../types/schema';
import { CanvasRow } from './CanvasRow';
import { useFormStore } from '../../store/useFormStore';

interface CanvasSectionProps {
  section: LayoutSection;
  index: number;
}

export const CanvasSection: React.FC<CanvasSectionProps> = ({ section, index }) => {
  const { deleteSection, addRow, selectedId, setSelected, updateSection } = useFormStore();

  const isSelected = selectedId === section.id;
  const isCollapsed = Boolean(section.collapsible);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(section.id, 'section');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSection(section.id);
  };

  const handleAddRow = (e: React.MouseEvent) => {
    e.stopPropagation();
    addRow(section.id, [12]);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateSection(section.id, { collapsible: !isCollapsed });
  };

  return (
    <div
      onClick={handleSelect}
      className={`rounded-2xl border transition-all duration-200 shadow-xs ${
        section._needsReview
          ? isSelected
            ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/30 shadow-md dark:bg-amber-950/30 dark:ring-amber-500/30'
            : 'border-amber-400/90 bg-amber-50/10 hover:border-amber-500 dark:border-amber-600/70 dark:bg-amber-950/20'
          : isSelected
          ? 'border-blue-500 bg-white ring-2 ring-blue-500/20 shadow-md dark:bg-slate-900/90 dark:ring-blue-500/30'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700/90'
      }`}
    >
      {/* Section Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            {index + 1}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {section.title || `Section ${index + 1}`}
              </h2>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                ({section.rows.length} {section.rows.length === 1 ? 'row' : 'rows'})
              </span>

              {/* Fetch Record Enabled Indicator Badge */}
              {section.enableFetchRecord && (
                <span
                  title={`Fetch Record button active in Preview for ${section.fetchEntity || 'PATIENT'}`}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 shadow-xs"
                >
                  <Database className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Fetch Record ({section.fetchEntity || 'PATIENT'})</span>
                </span>
              )}

              {/* _needsReview Visual Badge */}
              {section._needsReview && (
                <span
                  title={section._reviewReason || 'Section contains ambiguous structures flagged for review'}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 shadow-xs cursor-help"
                >
                  <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>Review Needed</span>
                </span>
              )}
            </div>
            {section.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
            )}
          </div>
        </div>

        {/* Section action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Section Settings Quick Button */}
          <button
            type="button"
            id={`section-settings-btn-${section.id}`}
            onClick={handleSelect}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              isSelected
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700'
            }`}
            title="Configure Section Settings & Fetch Record Button"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Section Settings</span>
          </button>

          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-colors"
            title="Add a new row to this section"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            title="Delete this section"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section Content: Rows & Optional Fetch Record Banner */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Visual indicator when Fetch Record is enabled */}
          {section.enableFetchRecord && (
            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-bold">Fetch Record Button Enabled:</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Interactive Preview will render a search bar for <code className="font-bold text-indigo-600 dark:text-indigo-400">{section.fetchEntity || 'PATIENT'}</code> by <code className="font-bold text-indigo-600 dark:text-indigo-400">{section.fetchPrimaryKey || 'PATIENT_ID'}</code>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelect}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline shrink-0 cursor-pointer"
              >
                Configure
              </button>
            </div>
          )}
          {section.rows.map((row) => (
            <CanvasRow key={row.id} row={row} sectionId={section.id} />
          ))}

          {section.rows.length === 0 && (
            <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center bg-slate-50/50 dark:bg-transparent">
              <FolderTree className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">This section has no rows yet</p>
              <button
                type="button"
                onClick={handleAddRow}
                className="mt-3 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create first row</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
