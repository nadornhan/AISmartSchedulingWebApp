'use client';

import type { GrowthStage } from '../../lib/gamification';

type PlantVisualProps = {
  stage: GrowthStage | string;
  speciesKey?: string;
  size?: number;
  locked?: boolean;
  celebrate?: boolean;
  className?: string;
};

type Palette = { trunk: string; foliage: string; accent: string; bloom?: string };

const BASE_COLORS: Record<string, Palette> = {
  oak: { trunk: '#6b4423', foliage: '#2f7d4a', accent: '#3f9a5c' },
  maple: { trunk: '#7a4a2a', foliage: '#3f8f4a', accent: '#5aad62', bloom: '#c45c26' },
  pine: { trunk: '#5c4033', foliage: '#1f6b45', accent: '#2f8a5a' },
  cherry_blossom: { trunk: '#6e4a3a', foliage: '#6f9e5a', accent: '#f2a6c1', bloom: '#e879a8' },
  bonsai: { trunk: '#5a4636', foliage: '#4a7c59', accent: '#6aa87a' },
  willow: { trunk: '#6b5535', foliage: '#6f9e4a', accent: '#8fbf5c' },
  lavender: { trunk: '#6a5a40', foliage: '#7a9a58', accent: '#8b6bb5', bloom: '#a889d0' },
  sunflower: { trunk: '#6b5230', foliage: '#5f9a3f', accent: '#e8b923', bloom: '#f0cb4a' },
};

function paletteFor(speciesKey: string | undefined, stage: string): Palette {
  const base = BASE_COLORS[speciesKey ?? ''] ?? {
    trunk: '#6b4423',
    foliage: '#2f7d4a',
    accent: '#3f9a5c',
  };

  // Maple: sprout green → bushy green → autumn orange/red canopy.
  if (speciesKey === 'maple') {
    if (stage === 'mature') {
      return { trunk: '#7a4a2a', foliage: '#c45c26', accent: '#e07a3a', bloom: '#a83a1a' };
    }
    if (stage === 'growing') {
      return { trunk: '#7a4a2a', foliage: '#3f8f4a', accent: '#5aad62' };
    }
    return { trunk: '#7a4a2a', foliage: '#5aad62', accent: '#7bc47f' };
  }

  if (speciesKey === 'cherry_blossom' && stage === 'mature') {
    return { ...base, foliage: '#f2a6c1', accent: '#e879a8' };
  }
  if (speciesKey === 'sunflower' && stage !== 'seedling') {
    return { ...base, foliage: stage === 'mature' ? '#e8b923' : '#5f9a3f', accent: '#f0cb4a' };
  }
  if (speciesKey === 'lavender' && stage === 'mature') {
    return { ...base, foliage: '#8b6bb5', accent: '#a889d0' };
  }
  return base;
}

function SeedlingSvg({ trunk, foliage, accent }: Palette) {
  return (
    <>
      <ellipse cx="60" cy="108" rx="28" ry="8" fill="rgba(60, 140, 80, 0.22)" />
      <ellipse cx="60" cy="104" rx="10" ry="5" fill="#8b6b3d" opacity="0.55" />
      <path
        d="M60 102 C58 86 56 70 60 56"
        stroke={trunk}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="48" cy="68" rx="11" ry="6" fill={foliage} transform="rotate(-30 48 68)" />
      <ellipse cx="72" cy="64" rx="10" ry="5.5" fill={accent} transform="rotate(26 72 64)" />
      <circle cx="60" cy="54" r="4.5" fill={accent} />
    </>
  );
}

function GrowingSvg({ trunk, foliage, accent }: Palette) {
  return (
    <>
      <ellipse cx="60" cy="110" rx="34" ry="9" fill="rgba(60, 140, 80, 0.24)" />
      <path
        d="M60 108 C58 78 57 52 60 34"
        stroke={trunk}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="60" cy="42" rx="28" ry="22" fill={foliage} />
      <ellipse cx="42" cy="52" rx="16" ry="12" fill={accent} />
      <ellipse cx="78" cy="50" rx="15" ry="11" fill={accent} />
      <ellipse cx="60" cy="30" rx="14" ry="10" fill={accent} opacity="0.9" />
    </>
  );
}

function MatureSvg({
  speciesKey,
  trunk,
  foliage,
  accent,
  bloom,
}: Palette & { speciesKey?: string }) {
  if (speciesKey === 'pine') {
    return (
      <>
        <ellipse cx="60" cy="112" rx="36" ry="9" fill="rgba(60, 140, 80, 0.24)" />
        <path d="M60 112 V48" stroke={trunk} strokeWidth="7" strokeLinecap="round" />
        <polygon points="60,20 36,58 84,58" fill={foliage} />
        <polygon points="60,36 32,74 88,74" fill={accent} />
        <polygon points="60,52 30,92 90,92" fill={foliage} opacity="0.95" />
      </>
    );
  }

  if (speciesKey === 'willow') {
    return (
      <>
        <ellipse cx="60" cy="112" rx="40" ry="10" fill="rgba(60, 140, 80, 0.24)" />
        <path d="M60 112 V40" stroke={trunk} strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="60" cy="38" rx="30" ry="20" fill={foliage} />
        <path
          d="M40 42 Q34 78 32 104 M50 48 Q46 84 44 108 M70 48 Q74 84 76 108 M80 42 Q86 78 88 104"
          stroke={accent}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
      </>
    );
  }

  if (speciesKey === 'sunflower') {
    return (
      <>
        <ellipse cx="60" cy="112" rx="34" ry="9" fill="rgba(60, 140, 80, 0.24)" />
        <path d="M60 110 V52" stroke={trunk} strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="46" cy="70" rx="12" ry="6" fill="#5f9a3f" transform="rotate(-35 46 70)" />
        <ellipse cx="74" cy="74" rx="12" ry="6" fill="#5f9a3f" transform="rotate(35 74 74)" />
        <circle cx="60" cy="40" r="18" fill={foliage} />
        <circle cx="60" cy="40" r="9" fill="#6b4423" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 60 + Math.cos(rad) * 22;
          const y = 40 + Math.sin(rad) * 22;
          return <ellipse key={deg} cx={x} cy={y} rx="7" ry="4" fill={bloom || accent} />;
        })}
      </>
    );
  }

  if (speciesKey === 'lavender') {
    return (
      <>
        <ellipse cx="60" cy="112" rx="34" ry="9" fill="rgba(60, 140, 80, 0.24)" />
        <path
          d="M48 108 V58 M60 110 V50 M72 108 V60"
          stroke={trunk}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <ellipse cx="48" cy="48" rx="8" ry="16" fill={foliage} />
        <ellipse cx="60" cy="40" rx="9" ry="18" fill={accent} />
        <ellipse cx="72" cy="50" rx="8" ry="15" fill={bloom || foliage} />
      </>
    );
  }

  return (
    <>
      <ellipse cx="60" cy="112" rx="40" ry="10" fill="rgba(60, 140, 80, 0.28)" />
      <path
        d="M60 112 C56 86 52 64 48 48 M60 112 C64 86 68 64 72 48 M60 90 C48 84 40 78 34 72 M60 90 C72 84 80 78 86 72"
        stroke={trunk}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="60" cy="40" rx="36" ry="28" fill={foliage} />
      <ellipse cx="34" cy="54" rx="20" ry="16" fill={accent} />
      <ellipse cx="86" cy="54" rx="20" ry="16" fill={accent} />
      <ellipse cx="60" cy="22" rx="18" ry="14" fill={bloom || accent} opacity="0.92" />
      {speciesKey === 'cherry_blossom' ? (
        <>
          <circle cx="42" cy="40" r="3.5" fill="#fff5f8" />
          <circle cx="70" cy="34" r="3" fill="#fff5f8" />
          <circle cx="78" cy="52" r="2.8" fill="#fff5f8" />
        </>
      ) : (
        <circle cx="48" cy="36" r="4" fill="rgba(255,255,255,0.25)" />
      )}
    </>
  );
}

export function PlantVisual({
  stage,
  speciesKey,
  size = 160,
  locked = false,
  celebrate = false,
  className,
}: PlantVisualProps) {
  const normalized = String(stage || 'seedling').toLowerCase();
  const palette = paletteFor(speciesKey, normalized);

  return (
    <div
      className={[
        'relative inline-flex items-center justify-center',
        celebrate ? 'forest-stage-pop' : '',
        locked ? 'opacity-45 grayscale' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        height={size}
        viewBox="0 0 120 120"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {normalized === 'mature' ? (
          <MatureSvg speciesKey={speciesKey} {...palette} />
        ) : normalized === 'growing' ? (
          <GrowingSvg {...palette} />
        ) : (
          <SeedlingSvg {...palette} />
        )}
        {locked ? (
          <>
            <rect fill="rgba(8, 20, 28, 0.35)" height="120" width="120" x="0" y="0" />
            <path
              d="M52 58 V50 a8 8 0 0 1 16 0 v8 M46 58 h28 v22 H46 z"
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
