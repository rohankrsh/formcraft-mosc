import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Undo2,
  Redo2,
  Play,
  PencilRuler,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  PlusCircle,
  Plus,
  Sun,
  Moon,
  UploadCloud,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  ShieldAlert,
  X,
  Rocket,
  LayoutGrid,
  Users,
} from 'lucide-react';
import { useFormStore } from '../../store/useFormStore';
import { useTemporalStore } from '../../store/useTemporalStore';
import { generateOfflineHtml } from '../../utils/exportHtml';

interface HeaderProps {
  onOpenPublish?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPublish }) => {
  const {
    form,
    isPreviewMode,
    setPreviewMode,
    setSelected,
    resetToEmpty,
    resetToSample,
    addSection,
    builderTheme,
    toggleBuilderTheme,
    setUploadModalOpen,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useFormStore();

  const hasDbBinding = Boolean(
    form.settings?.primaryEntity ||
    Object.values(form.fields || {}).some(
      (f) =>
        (f.dataBinding && f.dataBinding.source === 'oracle' && f.dataBinding.table) ||
        (f.optionsBinding && f.optionsBinding.table)
    )
  );

  const [showExportWarning, setShowExportWarning] = useState(false);

  const handleDownloadForm = () => {
    if (hasDbBinding) {
      setShowExportWarning(true);
      return;
    }

    const htmlContent = generateOfflineHtml(form);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'form'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { undo, redo, canUndo, canRedo, pastCount, futureCount } = useTemporalStore();

  const handleNewBlankForm = () => {
    resetToEmpty();
  };


  // Global keyboard shortcuts for Undo/Redo/Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            undo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapsed();
      } else if (e.key === 'Escape') {
        setSelected(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, setSelected, toggleSidebarCollapsed]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between select-none z-30 sticky top-0 transition-colors shadow-xs">
      {/* Left: Brand & Form Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                FormCraft
              </span>
              <Link
                to="/"
                className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 inline-flex items-center gap-1 transition-colors"
                title="Go to Forms Dashboard"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/patients"
                className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1 transition-colors"
                title="Go to Patient List"
              >
                <Users className="w-3 h-3 text-blue-500" />
                <span>Patients</span>
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <h1
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 truncate max-w-[180px] md:max-w-[240px] cursor-pointer transition-colors"
                title="Click to edit form settings"
                onClick={() => setSelected('form_settings', 'settings')}
              >
                {form.title || 'Untitled Form'}
              </h1>
              <button
                type="button"
                onClick={handleNewBlankForm}
                title="Open Blank Canvas (Clear all data)"
                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Toggle Palette Sidebar Button */}
        <button
          type="button"
          id="header-toggle-palette-btn"
          onClick={toggleSidebarCollapsed}
          title={isSidebarCollapsed ? "Show Element Palette (Ctrl+B)" : "Hide Element Palette (Ctrl+B)"}
          className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium ${isSidebarCollapsed
              ? 'text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 border-slate-200 dark:text-slate-400 dark:hover:text-white dark:bg-slate-800 dark:border-slate-700'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'
            }`}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          <span className="hidden xl:inline text-[11px]">{isSidebarCollapsed ? 'Show Palette' : 'Hide Palette'}</span>
        </button>

        {/* Undo / Redo controls */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 dark:bg-slate-950/80 dark:border-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-md flex items-center gap-1 text-xs transition-all ${canUndo
                ? 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95'
                : 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-40'
              }`}
          >
            <Undo2 className="w-4 h-4" />
            {pastCount > 0 && (
              <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-700 dark:text-slate-400">
                {pastCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            className={`p-1.5 rounded-md flex items-center gap-1 text-xs transition-all ${canRedo
                ? 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95'
                : 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-40'
              }`}
          >
            <Redo2 className="w-4 h-4" />
            {futureCount > 0 && (
              <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-700 dark:text-slate-400">
                {futureCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Middle: Canvas / Live Preview Mode Switch */}
      <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 p-1 rounded-xl shadow-inner">
        <button
          type="button"
          onClick={() => setPreviewMode(true)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${!isPreviewMode
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900'
            }`}
        >
          <PencilRuler className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Design Canvas</span>
          <span className="sm:hidden">Canvas</span>
        </button>

        <button
          type="button"
          onClick={() => setPreviewMode(true)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${isPreviewMode
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900'
            }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Interactive Preview</span>
          <span className="sm:hidden">Preview</span>
        </button>
      </div>

      {/* Right: + Button (New Blank Form), Theme Switcher, Actions & Settings */}
      <div className="flex items-center gap-2">
        {/* + Button: New Blank Form */}
        <button
          type="button"
          id="header-plus-btn"
          onClick={handleNewBlankForm}
          title="Open a blank canvas without any predefined data (Ctrl+Z can undo)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">New Form</span>
        </button>

        {/* Upload Form Button */}
        <button
          type="button"
          id="header-upload-btn"
          onClick={() => setUploadModalOpen(true)}
          title="Upload Excel document to auto-generate a form"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:border-emerald-800/60 shadow-xs active:scale-95 transition-all"
        >
          <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Upload Form</span>
        </button>

        {/* Publish Button */}
        {onOpenPublish && (
          <button
            type="button"
            id="header-publish-btn"
            onClick={onOpenPublish}
            title="Validate form schema and publish to public runtime URL"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        )}

        {/* Standalone HTML Export (Step 14) */}
        <button
          type="button"
          id="header-export-btn"
          onClick={handleDownloadForm}
          title={
            hasDbBinding
              ? 'Offline HTML export is disabled for database-connected forms'
              : 'Download standalone zero-dependency offline HTML form'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${hasDbBinding
              ? 'text-slate-400 bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500 border border-slate-200 dark:border-slate-800 opacity-80'
              : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 shadow-xs'
            }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Download Form</span>
          {hasDbBinding && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
              DB
            </span>
          )}
        </button>



        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleBuilderTheme}
          title={builderTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:hover:text-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 transition-all flex items-center gap-1.5 text-xs font-medium"
        >
          {builderTheme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline text-[11px]">Dark</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => addSection()}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 transition-colors"
          title="Add a new section container"
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Add Section</span>
        </button>

        <button
          type="button"
          onClick={() => setSelected('form_settings', 'settings')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 transition-colors"
          title="Form Settings & Theme"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        <div className="relative group">
          <button
            type="button"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 dark:border-slate-800 transition-colors"
            title="Reset Options"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 hidden group-hover:block z-50">
            <button
              type="button"
              onClick={handleNewBlankForm}
              className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Blank Form</span>
            </button>
            <button
              type="button"
              onClick={resetToSample}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
            >
              <span>Load Patient Sample</span>
            </button>
          </div>
        </div>
      </div>

      {/* Step 14: Export Warning Modal for DB-bound forms */}
      {showExportWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Offline HTML Export Disabled
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExportWarning(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                This form contains active <strong>Oracle Database bindings</strong>{' '}
                {form.settings?.primaryEntity && (
                  <span>
                    (target table:{' '}
                    <code className="font-bold text-indigo-600 dark:text-indigo-400">
                      {form.settings.primaryEntity}
                    </code>
                    )
                  </span>
                )}
                .
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                A downloaded static offline file cannot connect to Oracle or execute database transactions, and database credentials or bindings must never be embedded in client files.
              </p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                Database-bound forms are accessible securely via the live, authenticated Express API routes.
              </p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowExportWarning(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
