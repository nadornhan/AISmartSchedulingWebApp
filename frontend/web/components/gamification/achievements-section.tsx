'use client';

import type { AchievementProgress, AchievementsResponse } from '../../lib/gamification';

type AchievementsSectionProps = {
  data: AchievementsResponse;
  claimingId: string | null;
  onClaim: (achievementId: string) => void;
};

function achievementState(item: AchievementProgress) {
  if (item.claimed) return 'claimed';
  if (item.claimable) return 'claimable';
  if (item.progress_value > 0) return 'in_progress';
  return 'locked';
}

function iconGlyph(icon: string) {
  switch (icon) {
    case 'seedling': return '🌱';
    case 'focus': return '◎';
    case 'tree': return '🌳';
    case 'compass': return '🧭';
    case 'hourglass': return '⌛';
    case 'leaf': return '🍃';
    case 'calendar': return '📅';
    case 'forest': return '🌲';
    default: return '✦';
  }
}

function AchievementCard({ item, claiming, onClaim }: {
  item: AchievementProgress;
  claiming: boolean;
  onClaim: () => void;
}) {
  const state = achievementState(item);
  const ratio = item.requirement_value > 0
    ? Math.min(100, Math.round((item.progress_value / item.requirement_value) * 100))
    : 0;
  const chrome = {
    claimed: {
      card: 'border-[#d4a017]/35 bg-[linear-gradient(160deg,rgba(212,160,23,0.12),rgba(15,30,38,0.55))]',
      badge: 'bg-[#d4a017]/20 text-[#f0d37a]', bar: 'bg-[#d4a017]', label: 'Claimed',
    },
    claimable: {
      card: 'border-dashboard-accent/60 bg-[linear-gradient(160deg,rgba(45,212,191,0.18),rgba(15,30,38,0.62))] ring-1 ring-dashboard-accent/20',
      badge: 'bg-dashboard-accent/20 text-dashboard-accent', bar: 'bg-dashboard-accent', label: 'Ready',
    },
    in_progress: {
      card: 'border-[#3b82f6]/35 bg-[linear-gradient(160deg,rgba(59,130,246,0.12),rgba(15,30,38,0.55))]',
      badge: 'bg-[#3b82f6]/20 text-[#93c5fd]', bar: 'bg-[#3b82f6]', label: 'In progress',
    },
    locked: {
      card: 'border-dashboard-border bg-dashboard-surface/50',
      badge: 'bg-dashboard-bg/80 text-dashboard-muted', bar: 'bg-dashboard-muted/50', label: 'Not started',
    },
  }[state];

  return (
    <article className={`rounded-[var(--radius-sm)] border p-4 shadow-panel ${chrome.card}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${chrome.badge}`} aria-hidden="true">
          {iconGlyph(item.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-base font-semibold text-dashboard-text">{item.name}</h4>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${chrome.badge}`}>
              {chrome.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-dashboard-muted">{item.description}</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-dashboard-subtle">{item.progress_value}/{item.requirement_value}</span>
            <span className="font-semibold text-dashboard-accent">+{item.reward_growth_points} GP</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-dashboard-bg/80">
            <div className={`forest-progress-fill h-full rounded-full ${chrome.bar}`} style={{ width: `${item.completed ? 100 : ratio}%` }} />
          </div>
          {item.claimable ? (
            <button
              className="mt-4 w-full rounded-lg bg-dashboard-accent px-3 py-2 text-sm font-semibold text-dashboard-bg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              disabled={claiming}
              onClick={onClaim}
              type="button"
            >
              {claiming ? 'Claiming...' : `Claim ${item.reward_growth_points} GP`}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AchievementsSection({ data, claimingId, onClaim }: AchievementsSectionProps) {
  return (
    <section className="space-y-7">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-dashboard-text">Achievements</h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-dashboard-accent/35 bg-dashboard-accent/10 px-2.5 py-1 text-xs font-semibold text-dashboard-accent shadow-sm"
            title={data.current_title.description}
          >
            <span aria-hidden="true">✦</span>
            {data.current_title.name}
          </span>
        </div>
        <p className="mt-1 text-sm text-dashboard-muted">
          Complete the visible milestone, claim its Growth Points, then reveal the next challenge.
        </p>
      </div>

      {data.categories.map((group) => (
        <div className="space-y-3" key={group.id}>
          <h3 className="text-sm font-medium uppercase tracking-[0.04em] text-dashboard-muted">
            {group.label}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.achievements.map((item) => (
              <AchievementCard
                claiming={claimingId === item.id}
                item={item}
                key={item.id}
                onClaim={() => onClaim(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
