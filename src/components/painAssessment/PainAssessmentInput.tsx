import React, { useId } from 'react';
import type { PainAssessmentValue } from '../../types/schema';
import { PAIN_SCALE_ITEMS, PainFaceIcon, getPainScaleItem } from './PainScaleData';
import { Activity, X, MapPin } from 'lucide-react';

export interface PainAssessmentInputProps {
  value?: PainAssessmentValue | null | any;
  onChange?: (value: PainAssessmentValue) => void;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string;
  helpText?: string;
  required?: boolean;
  isBuilderPreview?: boolean;
  error?: string;
}

export const PainAssessmentInput: React.FC<PainAssessmentInputProps> = ({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  label = 'PAIN ASSESSMENT',
  helpText,
  required = false,
  isBuilderPreview = false,
  error,
}) => {
  const componentId = useId();
  const isInteractive = !disabled && !readOnly;

  // Normalize incoming value
  const currentValue: PainAssessmentValue = React.useMemo(() => {
    if (!value) {
      return { painPresent: '', location: '', score: null };
    }
    if (typeof value === 'object') {
      return {
        painPresent: value.painPresent === 'yes' || value.painPresent === 'no' ? value.painPresent : '',
        location: typeof value.location === 'string' ? value.location : '',
        score: typeof value.score === 'number' && value.score >= 0 && value.score <= 10 ? value.score : null,
      };
    }
    return { painPresent: '', location: '', score: null };
  }, [value]);

  const selectedItem = getPainScaleItem(currentValue.score);

  const handlePainPresentChange = (choice: 'yes' | 'no') => {
    if (!isInteractive) return;
    const nextChoice = currentValue.painPresent === choice ? '' : choice;
    onChange?.({
      ...currentValue,
      painPresent: nextChoice,
    });
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isInteractive) return;
    onChange?.({
      ...currentValue,
      location: e.target.value,
    });
  };

  const handleScoreSelect = (score: number) => {
    if (!isInteractive) return;
    // Clicking the same score toggles/clears it, or selects new score
    const nextScore = currentValue.score === score ? null : score;
    onChange?.({
      ...currentValue,
      score: nextScore,
    });
  };

  const handleClearScore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInteractive) return;
    onChange?.({
      ...currentValue,
      score: null,
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${
        error
          ? 'border-rose-400 bg-rose-50/20 dark:border-rose-700/60 dark:bg-rose-950/10'
          : 'border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-xs'
      } overflow-hidden`}
    >
      {/* Element Header */}
      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-850/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {label || 'PAIN ASSESSMENT'}
          </span>
          {required && (
            <span className="text-rose-500 font-bold text-xs" title="Required field">
              *
            </span>
          )}
        </div>

        {isBuilderPreview && (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
            0–10 Scale Preview
          </span>
        )}
      </div>

      {helpText && (
        <div className="px-4 pt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
          {helpText}
        </div>
      )}

      {/* Main Two-Area Layout */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ========================================================= */}
        {/* LEFT AREA: Pain Details (Pain Present?, Location, Score) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-3.5 pr-0 lg:pr-4 lg:border-r border-slate-200/80 dark:border-slate-800">
          {/* 1. Pain Present? YES / NO */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Pain Present?
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isInteractive}
                onClick={() => handlePainPresentChange('yes')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  currentValue.painPresent === 'yes'
                    ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${!isInteractive ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-98'}`}
                aria-pressed={currentValue.painPresent === 'yes'}
              >
                Yes
              </button>
              <button
                type="button"
                disabled={!isInteractive}
                onClick={() => handlePainPresentChange('no')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  currentValue.painPresent === 'no'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${!isInteractive ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-98'}`}
                aria-pressed={currentValue.painPresent === 'no'}
              >
                No
              </button>
            </div>
          </div>

          {/* 2. Location Input */}
          <div>
            <label
              htmlFor={`${componentId}-location`}
              className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
            >
              Location :
            </label>
            <div className="relative">
              <input
                id={`${componentId}-location`}
                type="text"
                disabled={!isInteractive}
                readOnly={readOnly}
                value={currentValue.location || ''}
                onChange={handleLocationChange}
                placeholder={isInteractive ? 'Enter pain location (e.g. Lower back)...' : '—'}
                className={`w-full px-3 py-1.5 pl-8 text-xs rounded-xl border transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 ${
                  !isInteractive
                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-default'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 3. Score Display */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Score :
              </span>
              {currentValue.score !== null && isInteractive && (
                <button
                  type="button"
                  onClick={handleClearScore}
                  className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center gap-0.5 transition-colors"
                  title="Clear pain score selection"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {selectedItem ? (
              <div
                className={`p-2.5 rounded-xl border ${selectedItem.color.border} ${selectedItem.color.bg} transition-all flex items-center justify-between gap-2`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-lg ${selectedItem.color.badgeBg} ${selectedItem.color.badgeText} flex items-center justify-center font-black font-mono text-sm shadow-xs`}
                  >
                    {selectedItem.score}
                  </span>
                  <div>
                    <p className={`text-xs font-bold ${selectedItem.color.text}`}>
                      {selectedItem.label}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                      {selectedItem.description}
                    </p>
                  </div>
                </div>
                <PainFaceIcon score={selectedItem.score} size={28} isSelected />
              </div>
            ) : (
              <div className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 text-xs italic flex items-center justify-between">
                <span>Not recorded — select face</span>
                <span className="text-[10px] font-mono text-slate-400">0–10</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT AREA: 0–10 Selectable Facial Scale                  */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {/* Top Progression Categories Bar */}
          <div className="grid grid-cols-6 text-center text-[10px] font-bold tracking-tight text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800/80 select-none">
            <span className="text-emerald-600 dark:text-emerald-400">No Pain (0)</span>
            <span className="text-lime-600 dark:text-lime-400">Slight (1–3)</span>
            <span className="text-amber-600 dark:text-amber-400">Mild (4–5)</span>
            <span className="text-orange-600 dark:text-orange-400">Moderate (6)</span>
            <span className="text-rose-600 dark:text-rose-400">Severe (7–9)</span>
            <span className="text-red-700 dark:text-red-400 font-extrabold">Worst Pain (10)</span>
          </div>

          {/* 11 Selectable Facial Expressions */}
          <div
            role="radiogroup"
            aria-label="0 to 10 facial pain assessment scale"
            className="grid grid-cols-11 gap-1 sm:gap-1.5 pt-1"
          >
            {PAIN_SCALE_ITEMS.map((item) => {
              const isSelected = currentValue.score === item.score;

              return (
                <button
                  key={item.score}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!isInteractive}
                  onClick={() => handleScoreSelect(item.score)}
                  title={`Score ${item.score}: ${item.label} (${item.description})`}
                  className={`group relative flex flex-col items-center justify-between p-1 sm:p-1.5 rounded-xl border transition-all select-none ${
                    isSelected
                      ? `${item.color.border} ${item.color.bg} shadow-md ring-2 ${item.color.ring} scale-105 z-10`
                      : 'border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-850'
                  } ${!isInteractive ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
                >
                  {/* Numeric Score Tag */}
                  <span
                    className={`font-mono text-xs font-extrabold mb-1 px-1 rounded ${
                      isSelected
                        ? `${item.color.badgeBg} ${item.color.badgeText}`
                        : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}
                  >
                    {item.score}
                  </span>

                  {/* SVG Face Icon */}
                  <div className="py-0.5">
                    <PainFaceIcon
                      score={item.score}
                      size={28}
                      isSelected={isSelected}
                      className={isSelected ? '' : 'group-hover:scale-105'}
                    />
                  </div>

                  {/* Accessible / Hover Indicator Dot */}
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all ${
                      isSelected
                        ? item.color.badgeBg.replace('bg-', 'bg-')
                        : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Bottom Clinical Activity Reference Notes */}
          <div className="pt-2 text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 leading-tight">
            <span>
              <strong className="text-slate-700 dark:text-slate-300">0:</strong> Normal activity
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">1–3:</strong> Does not limit activity
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">4–5:</strong> Requires rest periods
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">6:</strong> Limits some activity
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">7–9:</strong> Limits most activity
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">10:</strong> Unable to do any activity
            </span>
          </div>
        </div>
      </div>

      {/* Validation Error Message */}
      {error && (
        <div className="px-4 pb-2.5 text-xs text-rose-500 font-medium">
          {error}
        </div>
      )}
    </div>
  );
};
