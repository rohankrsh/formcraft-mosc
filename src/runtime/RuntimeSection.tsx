import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { LayoutSection, FormField } from '../types/schema';
import { RuntimeField } from './RuntimeField';
import type { StaffDetailsResponse } from '../services/userApi';

interface RuntimeSectionProps {
  section: LayoutSection;
  fields: Record<string, FormField>;
  values: Record<string, any>;
  errors: Record<string, string>;
  dynamicOptions: Record<string, { label: string; value: string }[]>;
  onChange: (field: FormField, value: any) => void;
  onFetchRecord?: (recordId: string) => Promise<void>;
  disabled?: boolean;
  staffContext?: StaffDetailsResponse | null;
}

const WIDTH_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

export const RuntimeSection: React.FC<RuntimeSectionProps> = ({
  section,
  fields,
  values,
  errors,
  dynamicOptions,
  onChange,
  onFetchRecord,
  disabled = false,
  staffContext,
}) => {
  const [fetchInput, setFetchInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const handleFetch = async () => {
    if (!fetchInput.trim() || !onFetchRecord || isFetching) return;
    setIsFetching(true);
    try {
      await onFetchRecord(fetchInput.trim());
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {section.title || 'Section'}
          </h2>
          {section.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {section.description}
            </p>
          )}
        </div>

        {/* Section Fetch Record Bar (if enabled) */}
        {section.enableFetchRecord && onFetchRecord && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                disabled={disabled || isFetching}
                placeholder="Enter ID / MRN..."
                value={fetchInput}
                onChange={(e) => setFetchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetch();
                  }
                }}
                className="w-40 md:w-48 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <button
              type="button"
              disabled={disabled || isFetching || !fetchInput.trim()}
              onClick={handleFetch}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <span>Fetch Record</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Grid Rows */}
      <div className="space-y-5">
        {(section.rows || []).map((row) => (
          <div key={row.id} className="grid grid-cols-12 gap-4 items-start">
            {(row.columns || []).map((col) => {
              const widthClass = WIDTH_CLASSES[col.width] || 'col-span-12';
              return (
                <div key={col.id} className={`${widthClass} space-y-4`}>
                  {(col.fieldIds || []).map((fieldId) => {
                    const field = fields[fieldId];
                    if (!field) return null;

                    // Evaluate visibleIf condition
                    if (field.visibleIf && field.visibleIf.fieldId) {
                      const depVal = values[field.visibleIf.fieldId];
                      if (String(depVal) !== String(field.visibleIf.equals)) {
                        return null;
                      }
                    }

                    const val = values[field.name || field.id] !== undefined ? values[field.name || field.id] : values[field.id];
                    const err = errors[field.name || field.id] || errors[field.id] || (field.name ? errors[field.name] : undefined);
                    const fieldOptions = dynamicOptions[field.id];

                    return (
                      <RuntimeField
                        key={field.id}
                        field={field}
                        value={val}
                        error={err}
                        errors={errors}
                        dynamicOptions={fieldOptions}
                        onChange={onChange}
                        disabled={disabled}
                        staffContext={staffContext}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
