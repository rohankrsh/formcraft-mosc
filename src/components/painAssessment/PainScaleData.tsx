import React from 'react';

export interface PainScaleItem {
  score: number;
  label: string;
  category: string;
  description: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    ring: string;
    fillHex: string;
  };
}

export const PAIN_SCALE_ITEMS: PainScaleItem[] = [
  {
    score: 0,
    label: 'No Pain',
    category: 'No Pain',
    description: 'No pain',
    color: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      badgeText: 'text-emerald-800 dark:text-emerald-200',
      ring: 'ring-emerald-500',
      fillHex: '#10b981',
    },
  },
  {
    score: 1,
    label: 'Slight Pain',
    category: 'Slight',
    description: 'Pain is present but does not limit activity',
    color: {
      bg: 'bg-green-50 dark:bg-green-950/40',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-700 dark:text-green-300',
      badgeBg: 'bg-green-100 dark:bg-green-900/60',
      badgeText: 'text-green-800 dark:text-green-200',
      ring: 'ring-green-500',
      fillHex: '#22c55e',
    },
  },
  {
    score: 2,
    label: 'Slight Pain',
    category: 'Slight',
    description: 'Pain is present but does not limit activity',
    color: {
      bg: 'bg-lime-50 dark:bg-lime-950/40',
      border: 'border-lime-300 dark:border-lime-700',
      text: 'text-lime-700 dark:text-lime-300',
      badgeBg: 'bg-lime-100 dark:bg-lime-900/60',
      badgeText: 'text-lime-800 dark:text-lime-200',
      ring: 'ring-lime-500',
      fillHex: '#84cc16',
    },
  },
  {
    score: 3,
    label: 'Slight Pain',
    category: 'Slight',
    description: 'Pain is present but does not limit activity',
    color: {
      bg: 'bg-lime-50/70 dark:bg-lime-950/30',
      border: 'border-lime-300 dark:border-lime-700',
      text: 'text-lime-800 dark:text-lime-200',
      badgeBg: 'bg-lime-100 dark:bg-lime-900/50',
      badgeText: 'text-lime-900 dark:text-lime-100',
      ring: 'ring-lime-500',
      fillHex: '#a3e635',
    },
  },
  {
    score: 4,
    label: 'Mild Pain',
    category: 'Mild',
    description: 'Can do most activities with rest periods',
    color: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/40',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-700 dark:text-yellow-300',
      badgeBg: 'bg-yellow-100 dark:bg-yellow-900/60',
      badgeText: 'text-yellow-800 dark:text-yellow-200',
      ring: 'ring-yellow-500',
      fillHex: '#eab308',
    },
  },
  {
    score: 5,
    label: 'Mild Pain',
    category: 'Mild',
    description: 'Can do most activities with rest periods',
    color: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
      badgeText: 'text-amber-800 dark:text-amber-200',
      ring: 'ring-amber-500',
      fillHex: '#f59e0b',
    },
  },
  {
    score: 6,
    label: 'Moderate Pain',
    category: 'Moderate',
    description: 'Unable to do some activities because of pain',
    color: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/60',
      badgeText: 'text-orange-800 dark:text-orange-200',
      ring: 'ring-orange-500',
      fillHex: '#f97316',
    },
  },
  {
    score: 7,
    label: 'Severe Pain',
    category: 'Severe',
    description: 'Unable to do most activities because of pain',
    color: {
      bg: 'bg-orange-50/80 dark:bg-orange-950/50',
      border: 'border-orange-400 dark:border-orange-600',
      text: 'text-orange-800 dark:text-orange-200',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/70',
      badgeText: 'text-orange-900 dark:text-orange-100',
      ring: 'ring-orange-600',
      fillHex: '#ea580c',
    },
  },
  {
    score: 8,
    label: 'Severe Pain',
    category: 'Severe',
    description: 'Unable to do most activities because of pain',
    color: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-300 dark:border-rose-700',
      text: 'text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/60',
      badgeText: 'text-rose-800 dark:text-rose-200',
      ring: 'ring-rose-500',
      fillHex: '#ef4444',
    },
  },
  {
    score: 9,
    label: 'Severe Pain',
    category: 'Severe',
    description: 'Unable to do most activities because of pain',
    color: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-400 dark:border-red-600',
      text: 'text-red-700 dark:text-red-300',
      badgeBg: 'bg-red-100 dark:bg-red-900/70',
      badgeText: 'text-red-900 dark:text-red-100',
      ring: 'ring-red-600',
      fillHex: '#dc2626',
    },
  },
  {
    score: 10,
    label: 'Worst Pain Ever',
    category: 'Worst Pain',
    description: 'Unable to do any activities because of pain',
    color: {
      bg: 'bg-rose-100/50 dark:bg-rose-950/60',
      border: 'border-rose-500 dark:border-rose-600',
      text: 'text-rose-900 dark:text-rose-200',
      badgeBg: 'bg-rose-200 dark:bg-rose-900/80',
      badgeText: 'text-rose-950 dark:text-rose-100',
      ring: 'ring-rose-700',
      fillHex: '#991b1b',
    },
  },
];

export const getPainScaleItem = (score: number | null | undefined): PainScaleItem | null => {
  if (score === null || score === undefined || score < 0 || score > 10) return null;
  return PAIN_SCALE_ITEMS[score] || null;
};

/**
 * Renders a crisp SVG facial expression for any pain score from 0 to 10
 */
export const PainFaceIcon: React.FC<{
  score: number;
  size?: number;
  className?: string;
  isSelected?: boolean;
}> = ({ score, size = 36, className = '', isSelected = false }) => {
  const item = PAIN_SCALE_ITEMS[score] || PAIN_SCALE_ITEMS[0];
  const strokeColor = '#1e293b';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-150 ${className} ${isSelected ? 'scale-110 drop-shadow-md' : ''}`}
      role="img"
      aria-label={`Pain face for score ${score}: ${item.label}`}
    >
      {/* Face circle with gradient background */}
      <circle
        cx="24"
        cy="24"
        r="22"
        fill={item.color.fillHex}
        fillOpacity="0.22"
        stroke={item.color.fillHex}
        strokeWidth={isSelected ? '3' : '2'}
      />

      {/* Facial features per score */}
      {score === 0 && (
        <>
          {/* Eyes: Happy bright eyes */}
          <circle cx="17" cy="18" r="2.5" fill={strokeColor} />
          <circle cx="31" cy="18" r="2.5" fill={strokeColor} />
          {/* Mouth: Wide smiling curve */}
          <path
            d="M14 26C15.5 32.5 32.5 32.5 34 26"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 1 && (
        <>
          {/* Eyes */}
          <circle cx="17" cy="19" r="2.3" fill={strokeColor} />
          <circle cx="31" cy="19" r="2.3" fill={strokeColor} />
          {/* Mouth: Friendly smile */}
          <path
            d="M15 27C17 31.5 31 31.5 33 27"
            stroke={strokeColor}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 2 && (
        <>
          {/* Eyes */}
          <circle cx="17" cy="19" r="2.2" fill={strokeColor} />
          <circle cx="31" cy="19" r="2.2" fill={strokeColor} />
          {/* Mouth: Subtle smile */}
          <path
            d="M16 27.5C18 30.5 30 30.5 32 27.5"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 3 && (
        <>
          {/* Eyes */}
          <circle cx="17" cy="20" r="2.2" fill={strokeColor} />
          <circle cx="31" cy="20" r="2.2" fill={strokeColor} />
          {/* Mouth: Slight relaxed curve */}
          <path
            d="M17 28C19 29.8 29 29.8 31 28"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 4 && (
        <>
          {/* Eyes */}
          <circle cx="17" cy="20" r="2.2" fill={strokeColor} />
          <circle cx="31" cy="20" r="2.2" fill={strokeColor} />
          {/* Mouth: Straight neutral line */}
          <line
            x1="17"
            y1="28.5"
            x2="31"
            y2="28.5"
            stroke={strokeColor}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 5 && (
        <>
          {/* Eyebrows slightly worried */}
          <line x1="15" y1="16.5" x2="20" y2="18" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="33" y1="16.5" x2="28" y2="18" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          {/* Eyes */}
          <circle cx="17.5" cy="21" r="2.2" fill={strokeColor} />
          <circle cx="30.5" cy="21" r="2.2" fill={strokeColor} />
          {/* Mouth: Subtle downturn */}
          <path
            d="M17 29.5C19 28.5 29 28.5 31 29.5"
            stroke={strokeColor}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 6 && (
        <>
          {/* Eyebrows */}
          <line x1="14" y1="16" x2="20" y2="18.5" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="34" y1="16" x2="28" y2="18.5" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
          {/* Eyes */}
          <circle cx="17.5" cy="21.5" r="2.2" fill={strokeColor} />
          <circle cx="30.5" cy="21.5" r="2.2" fill={strokeColor} />
          {/* Mouth: Clear downward curve */}
          <path
            d="M16 31C18 27.5 30 27.5 32 31"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 7 && (
        <>
          {/* Eyebrows worried */}
          <line x1="14" y1="15.5" x2="21" y2="19" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="34" y1="15.5" x2="27" y2="19" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          {/* Eyes */}
          <circle cx="17" cy="22" r="2.3" fill={strokeColor} />
          <circle cx="31" cy="22" r="2.3" fill={strokeColor} />
          {/* Mouth: Deeper frown */}
          <path
            d="M15 32C17.5 26.5 30.5 26.5 33 32"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}

      {score === 8 && (
        <>
          {/* Angled sad eyebrows */}
          <line x1="13" y1="15" x2="21" y2="19.5" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="35" y1="15" x2="27" y2="19.5" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
          {/* Eyes */}
          <ellipse cx="17" cy="22" rx="2.5" ry="2.2" fill={strokeColor} />
          <ellipse cx="31" cy="22" rx="2.5" ry="2.2" fill={strokeColor} />
          {/* Mouth: Open distressed frown oval */}
          <path
            d="M16 32.5C17.5 26 30.5 26 32 32.5C30.5 34 17.5 34 16 32.5Z"
            fill={strokeColor}
            fillOpacity="0.85"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        </>
      )}

      {score === 9 && (
        <>
          {/* Angled distressed eyebrows */}
          <line x1="13" y1="14.5" x2="21" y2="19.5" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" />
          <line x1="35" y1="14.5" x2="27" y2="19.5" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" />
          {/* Eyes: Squeezed distress */}
          <path d="M15 22L19 24L15 26" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M33 22L29 24L33 26" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Teardrop on right cheek */}
          <path
            d="M34 28.5C34 27.5 35 26.5 35 26.5C35 26.5 36 27.5 36 28.5C36 29.3 35.5 30 35 30C34.5 30 34 29.3 34 28.5Z"
            fill="#38bdf8"
          />
          {/* Mouth: Open crying mouth */}
          <path
            d="M15 33C17 26 31 26 33 33C30.5 35.5 17.5 35.5 15 33Z"
            fill={strokeColor}
            fillOpacity="0.9"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        </>
      )}

      {score === 10 && (
        <>
          {/* Eyebrows deeply distressed */}
          <line x1="12" y1="14" x2="21" y2="20" stroke={strokeColor} strokeWidth="2.6" strokeLinecap="round" />
          <line x1="36" y1="14" x2="27" y2="20" stroke={strokeColor} strokeWidth="2.6" strokeLinecap="round" />
          {/* Eyes: Tightly shut agonized angles */}
          <path d="M14 22L18.5 24.5L14 27" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 22L29.5 24.5L34 27" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {/* Teardrops on both cheeks */}
          <path
            d="M11.5 28C11.5 26.8 12.8 25.5 12.8 25.5C12.8 25.5 14 26.8 14 28C14 29 13.5 29.8 12.8 29.8C12 29.8 11.5 29 11.5 28Z"
            fill="#38bdf8"
          />
          <path
            d="M34 28C34 26.8 35.2 25.5 35.2 25.5C35.2 25.5 36.5 26.8 36.5 28C36.5 29 35.8 29.8 35.2 29.8C34.5 29.8 34 29 34 28Z"
            fill="#38bdf8"
          />
          {/* Mouth: Wide open anguished cry */}
          <path
            d="M14 33.5C16.5 25.5 31.5 25.5 34 33.5C31 37 17 37 14 33.5Z"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth="1.8"
          />
        </>
      )}
    </svg>
  );
};
