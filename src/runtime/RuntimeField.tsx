import React from 'react';
import type { FormField } from '../types/schema';
import { RuntimeTable } from './RuntimeTable';
import { PainAssessmentInput } from '../components/painAssessment/PainAssessmentInput';
import type { StaffDetailsResponse } from '../services/userApi';

interface RuntimeFieldProps {
  field: FormField;
  value: any;
  onChange: (field: FormField, value: any) => void;
  error?: string;
  errors?: Record<string, string>;
  dynamicOptions?: { label: string; value: string }[];
  disabled?: boolean;
  staffContext?: StaffDetailsResponse | null;
}

export const RuntimeField: React.FC<RuntimeFieldProps> = ({
  field,
  value,
  onChange,
  error,
  errors,
  dynamicOptions,
  disabled = false,
  staffContext,
}) => {
  const isRequired = field.validation?.required;

  // Heading field
  if (field.type === 'heading') {
    return (
      <div
        id={`field-container-${field.id}`}
        data-field-id={field.id}
        data-field-name={field.name}
        className="py-2 border-b border-slate-200/80 dark:border-slate-800 scroll-mt-24"
      >
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {field.label}
        </h3>
        {field.helpText && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{field.helpText}</p>
        )}
      </div>
    );
  }

  // Divider field
  if (field.type === 'divider') {
    return <hr className="my-3 border-slate-200 dark:border-slate-800" />;
  }

  // Pain Assessment field
  if (field.type === 'pain_assessment') {
    return (
      <div
        id={`field-container-${field.id}`}
        data-field-id={field.id}
        data-field-name={field.name}
        className="w-full scroll-mt-24"
      >
        <PainAssessmentInput
          value={value}
          onChange={(newVal) => onChange(field, newVal)}
          disabled={disabled}
          label={field.label}
          helpText={field.helpText}
          required={isRequired}
          error={error}
        />
        {error && (
          <p id={`error-message-${field.id}`} className="text-xs text-rose-500 mt-1.5 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Table field
  if (field.type === 'table') {
    return (
      <div
        id={`field-container-${field.id}`}
        data-field-id={field.id}
        data-field-name={field.name}
        className="space-y-1.5 w-full scroll-mt-24"
      >
        {field.label && (
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {field.label}
            {isRequired && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        {field.helpText && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.helpText}</p>
        )}
        <RuntimeTable
          field={field}
          value={Array.isArray(value) ? value : []}
          onChange={(newRows) => onChange(field, newRows)}
          disabled={disabled}
          errors={errors}
          staffContext={staffContext}
        />
        {error && (
          <p id={`error-message-${field.id}`} className="text-xs text-rose-500 mt-1 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Combine static and dynamic options for select & radio
  const combinedOptions = [
    ...(field.options || []),
    ...(dynamicOptions || []),
  ];

  return (
    <div
      id={`field-container-${field.id}`}
      data-field-id={field.id}
      data-field-name={field.name}
      className="space-y-1.5 w-full scroll-mt-24"
    >
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        {field.label}
        {isRequired && <span className="text-rose-500 ml-1 font-bold">*</span>}
      </label>

      {/* Field Input Control */}
      {field.type === 'text' && (
        <input
          id={`input-${field.id}`}
          name={field.name || field.id}
          type="text"
          disabled={disabled}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          id={`input-${field.id}`}
          name={field.name || field.id}
          disabled={disabled}
          rows={3}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-y ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        />
      )}

      {field.type === 'number' && (
        <input
          id={`input-${field.id}`}
          name={field.name || field.id}
          type="number"
          disabled={disabled}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(field, v === '' ? '' : Number(v));
          }}
          className={`w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        />
      )}

      {field.type === 'date' && (
        <input
          id={`input-${field.id}`}
          name={field.name || field.id}
          type="date"
          disabled={disabled}
          value={value ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        />
      )}

      {field.type === 'time' && (() => {
        // Parse stored value "HH:MM AM" or "HH:MM PM" → parts
        const raw = (value as string) || '';
        const parts = raw.split(' ');
        const hhmm = parts[0] || '';
        const [hhStr, mmStr] = hhmm.split(':');
        const hour = hhStr || '';
        const minute = mmStr || '';
        const period = (parts[1] === 'PM' ? 'PM' : parts[1] === 'AM' ? 'AM' : '') as 'AM' | 'PM' | '';

        const buildValue = (h: string, m: string, p: string) => {
          if (!h && !m && !p) return '';
          const hh = h.padStart(2, '0');
          const mm = m.padStart(2, '0');
          return `${hh}:${mm} ${p || 'AM'}`;
        };

        const selectCls = `px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 appearance-none cursor-pointer ${
          error
            ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
            : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
        }`;

        const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
        const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

        return (
          <div className="flex items-center gap-1.5">
            {/* Hour */}
            <select
              id={`input-${field.id}`}
              name={field.name || field.id}
              disabled={disabled}
              value={hour}
              onChange={(e) => onChange(field, buildValue(e.target.value, minute, period || 'AM'))}
              className={`flex-1 ${selectCls}`}
            >
              <option value="">HH</option>
              {hours.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-slate-400 font-bold text-sm select-none">:</span>
            {/* Minute */}
            <select
              disabled={disabled}
              value={minute}
              onChange={(e) => onChange(field, buildValue(hour || '12', e.target.value, period || 'AM'))}
              className={`flex-1 ${selectCls}`}
            >
              <option value="">MM</option>
              {minutes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {/* AM / PM */}
            <select
              disabled={disabled}
              value={period}
              onChange={(e) => onChange(field, buildValue(hour || '12', minute || '00', e.target.value))}
              className={`w-20 ${selectCls}`}
            >
              <option value="">AM/PM</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        );
      })()}

      {field.type === 'select' && (
        <select
          id={`input-${field.id}`}
          name={field.name || field.id}
          disabled={disabled}
          value={value ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border transition-all text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-300 dark:border-slate-700/80 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        >
          <option value="">{field.placeholder || '-- Select an option --'}</option>
          {combinedOptions.map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'radio' && (
        <div id={`input-${field.id}`} className="space-y-2 pt-1">
          {combinedOptions.map((opt, idx) => (
            <label
              key={idx}
              className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <input
                type="radio"
                disabled={disabled}
                name={field.name || field.id}
                value={opt.value}
                checked={String(value) === String(opt.value)}
                onChange={() => onChange(field, opt.value)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className="pt-1">
          {combinedOptions.length > 0 ? (
            <div className="space-y-2">
              {combinedOptions.map((opt, idx) => {
                const currentArr = Array.isArray(value) ? value : [];
                const isChecked = currentArr.includes(opt.value);
                return (
                  <label
                    key={idx}
                    className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onChange(field, [...currentArr, opt.value]);
                        } else {
                          onChange(field, currentArr.filter((v) => v !== opt.value));
                        }
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(value)}
                onChange={(e) => onChange(field, e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span>{field.placeholder || field.label}</span>
            </label>
          )}
        </div>
      )}

      {field.helpText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.helpText}</p>
      )}

      {error && (
        <p id={`error-message-${field.id}`} className="text-xs text-rose-500 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
