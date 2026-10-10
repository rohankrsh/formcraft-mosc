import type React from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  ChevronDownSquare,
  CircleDot,
  CheckSquare,
  Heading,
  Minus,
  Columns,
  LayoutGrid,
  Plus,
  Table,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { FieldType } from '../../types/schema';
import { useFormStore } from '../../store/useFormStore';

interface PaletteFieldDefinition {
  type: FieldType;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

const FIELD_PALETTE: PaletteFieldDefinition[] = [
  {
    type: 'text',
    label: 'Text Input',
    description: 'Single-line text, email, or URL',
    icon: Type,
  },
  {
    type: 'textarea',
    label: 'Text Area',
    description: 'Multi-line notes or remarks',
    icon: AlignLeft,
  },
  {
    type: 'number',
    label: 'Number Input',
    description: 'Numeric quantities, age, or rating',
    icon: Hash,
  },
  {
    type: 'date',
    label: 'Date Picker',
    description: 'Calendar date selection',
    icon: Calendar,
  },
  {
    type: 'time',
    label: 'Time Picker',
    description: 'Time input with AM / PM selector',
    icon: Clock,
  },
  {
    type: 'select',
    label: 'Dropdown Select',
    description: 'Single selection from options',
    icon: ChevronDownSquare,
  },
  {
    type: 'radio',
    label: 'Radio Group',
    description: 'Pick one choice among items',
    icon: CircleDot,
  },
  {
    type: 'checkbox',
    label: 'Checkbox Group',
    description: 'Multi-select options or consents',
    icon: CheckSquare,
  },
  {
    type: 'heading',
    label: 'Heading Block',
    description: 'Title or section subheader',
    icon: Heading,
  },
  {
    type: 'divider',
    label: 'Divider Line',
    description: 'Horizontal break between content',
    icon: Minus,
  },
  {
    type: 'table',
    label: 'Table / Grid',
    description: 'Tabular data with rows & columns',
    icon: Table,
    badge: 'New',
  },
];

interface RowLayoutPreset {
  label: string;
  widths: number[];
  gridDisplay: string;
}

const ROW_PRESETS: RowLayoutPreset[] = [
  { label: 'Full Width (12)', widths: [12], gridDisplay: '12' },
  { label: 'Half & Half (6 + 6)', widths: [6, 6], gridDisplay: '6 / 6' },
  { label: 'Three Columns (4 + 4 + 4)', widths: [4, 4, 4], gridDisplay: '4 / 4 / 4' },
  { label: 'Four Columns (3 + 3 + 3 + 3)', widths: [3, 3, 3, 3], gridDisplay: '3 / 3 / 3 / 3' },
  { label: 'Split Left (8 + 4)', widths: [8, 4], gridDisplay: '8 / 4' },
  { label: 'Split Right (4 + 8)', widths: [4, 8], gridDisplay: '4 / 8' },
];

export const PaletteItem: React.FC<{
  item: PaletteFieldDefinition;
  onQuickAdd: (type: FieldType) => void;
}> = ({ item, onQuickAdd }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette_${item.type}`,
    data: {
      isPaletteItem: true,
      fieldType: item.type,
    },
  });

  const Icon = item.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:bg-slate-850 dark:hover:border-slate-700 cursor-grab active:cursor-grabbing transition-all select-none shadow-xs ${
        isDragging ? 'opacity-40 ring-2 ring-blue-500 scale-95' : 'hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:text-blue-600 group-hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-blue-400 dark:group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.label}</p>
          <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
        </div>
      </div>

      <button
        type="button"
        title="Quick add to active layout"
        onClick={(e) => {
          e.stopPropagation();
          onQuickAdd(item.type);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-700/80 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const CollapsedPaletteItem: React.FC<{
  item: PaletteFieldDefinition;
  onQuickAdd: (type: FieldType) => void;
}> = ({ item, onQuickAdd }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette_collapsed_${item.type}`,
    data: {
      isPaletteItem: true,
      fieldType: item.type,
    },
  });

  const Icon = item.icon;

  return (
    <div className="relative group flex items-center justify-center">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onQuickAdd(item.type)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-750 dark:hover:bg-slate-800 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all shadow-2xs ${
          isDragging ? 'opacity-40 ring-2 ring-blue-500 scale-95' : ''
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Flyout Tooltip */}
      <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-900/95 dark:bg-slate-800 text-white rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 flex items-center gap-2 border border-slate-700/60">
        <div>
          <p className="text-[11px] font-semibold">{item.label}</p>
          <p className="text-[9px] text-slate-400">{item.description}</p>
        </div>
        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
          Add
        </span>
      </div>
    </div>
  );
};

export const SidebarPalette: React.FC = () => {
  const {
    addField,
    addRow,
    addSection,
    form,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useFormStore();

  const handleQuickAdd = (type: FieldType) => {
    addField(type);
  };

  const handleAddPresetRow = (widths: number[]) => {
    if (form.layout.length === 0) {
      addSection();
    }
    const targetSec = form.layout[form.layout.length - 1];
    addRow(targetSec.id, widths);
  };

  // Collapsed View: Slim vertical icon rail
  if (isSidebarCollapsed) {
    return (
      <aside className="w-14 bg-white/95 border-r border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none transition-all duration-200 shadow-xs flex-shrink-0 z-10">
        {/* Top Expand Button */}
        <div className="p-2 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-center">
          <button
            type="button"
            id="palette-expand-btn"
            onClick={toggleSidebarCollapsed}
            title="Expand Palette (Ctrl+B)"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30 transition-all shadow-xs group relative"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <div className="absolute left-full ml-2.5 px-2 py-1 bg-slate-900 text-white text-[11px] rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-medium">
              Expand Palette (Ctrl+B)
            </div>
          </button>
        </div>

        {/* Vertical Icon Rail */}
        <div className="flex-1 overflow-y-auto py-2.5 px-1.5 space-y-1.5 flex flex-col items-center">
          {FIELD_PALETTE.map((item) => (
            <CollapsedPaletteItem key={item.type} item={item} onQuickAdd={handleQuickAdd} />
          ))}

          {/* Quick Row Layout Shortcut */}
          <div className="w-7 border-t border-slate-200 dark:border-slate-800 my-1.5" />
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={() => handleAddPresetRow([12])}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <Columns className="w-4 h-4" />
            </button>
            <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-medium">
              Add Row Layout (12)
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Expanded View: Full Palette
  return (
    <aside className="w-72 bg-white/95 border-r border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none transition-all duration-200 shadow-xs flex-shrink-0 z-10">
      {/* Sidebar Header with Collapse Button */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Element Palette
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Drag or click to insert</p>
          </div>
        </div>

        <button
          type="button"
          id="palette-collapse-btn"
          onClick={toggleSidebarCollapsed}
          title="Collapse Palette (Ctrl+B)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Elements List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Form Fields */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Input Controls
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{FIELD_PALETTE.length} types</span>
          </div>
          <div className="space-y-1.5">
            {FIELD_PALETTE.map((item) => (
              <PaletteItem key={item.type} item={item} onQuickAdd={handleQuickAdd} />
            ))}
          </div>
        </div>

        {/* Section 2: Layout Rows Presets */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Columns className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Row Layouts</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ROW_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddPresetRow(preset.widths)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 dark:hover:border-slate-700 text-left transition-all group shadow-xs"
              >
                <div className="text-[11px] font-semibold text-slate-700 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400">
                  {preset.gridDisplay}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{preset.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
