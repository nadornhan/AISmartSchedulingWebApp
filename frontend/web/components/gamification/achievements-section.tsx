'use client';

import type { AchievementCategoryGroup, AchievementProgress } from '../../lib/gamification';

type AchievementsSectionProps = {
  categories: AchievementCategoryGroup[];
  achievements?: AchievementProgress[];
};

function achievementState(item: AchievementProgress): 'unlocked' | 'in_progress' | 'locked' {
  if (item.unlocked) return 'unlocked';
  if (item.progress_value > 0) return 'in_progress';
  return 'locked';
}

function statusCopy(item: AchievementProgress) {
  const state = achievementState(item);
  if (state === 'unlocked') {
    return 'Unlocked — a quiet milestone for your forest.';
  }
  if (state === 'in_progress') {
    return `In progress · ${item.progress_value}/${item.requirement_value}`;
  }
  return 'Still waiting — keep tending your routines gently.';
}

function iconGlyph(icon: string) {
  switch (icon) {
    case 'seedling':
      return '🌱';
    case 'focus':
      return '◎';
    case 'tree':
      return '🌳';
    case 'compass':
      return '🧭';
    case 'hourglass':
      return '⌛';
    case 'leaf':
      return '🍃';
    case 'calendar':
      return '📅';
    case 'forest':
      return '🌲';
    default:
      return '✦';
  }
}

function AchievementCard({ item }: { item: AchievementProgress }) {
  const state = achievementState(item);
  const ratio =
    item.requirement_value > 0
      ? Math.min(100, Math.round((item.progress_value / item.requirement_value) * 100))
      : 0;

  const chrome =
    state === 'unlocked'
      ? {
          card: 'border-[#d4a017]/40 bg-[linear-gradient(160deg,rgba(212,160,23,0.16),rgba(15,30,38,0.55))]',
          badge: 'bg-[#d4a017]/25 text-[#f0d37a]',
          bar: 'bg-[#d4a017]',
          label: 'Unlocked',
        }
      : state === 'in_progress'
        ? {
            card: 'border-[#3b82f6]/40 bg-[linear-gradient(160deg,rgba(59,130,246,0.14),rgba(15,30,38,0.55))]',
            badge: 'bg-[#3b82f6]/25 text-[#93c5fd]',
            bar: 'bg-[#3b82f6]',
            label: 'In progress',
          }
        : {
            card: 'border-dashboard-border bg-dashboard-surface/50 opacity-80',
            badge: 'bg-dashboard-bg/80 text-dashboard-muted',
            bar: 'bg-dashboard-muted/50',
            label: 'Locked',
          };

  return (
    <article
      className={`rounded-[var(--radius-sm)] border p-4 shadow-panel ${chrome.card}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${chrome.badge}`}
          aria-hidden="true"
        >
          {iconGlyph(item.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-dashboard-text">{item.name}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${chrome.badge}`}>
              {chrome.label}
              {state === 'in_progress'
                ? ` · ${item.progress_value}/${item.requirement_value}`
                : ''}
            </span>
          </div>
          <p className="mt-1 text-sm text-dashboard-muted">{item.description}</p>
          <p className="mt-2 text-xs text-dashboard-subtle">{statusCopy(item)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-dashboard-bg/80">
            <div
              className={`forest-progress-fill h-full rounded-full ${chrome.bar}`}
              style={{ width: `${state === 'unlocked' ? 100 : ratio}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function AchievementsSection({ categories, achievements = [] }: AchievementsSectionProps) {
  const groups =
    categories.length > 0
      ? categories
      : achievements.length > 0
        ? [
            {
              id: 'all',
              label: 'Achievements',
              achievements,
            },
          ]
        : [];

  if (groups.length === 0) {
    return (
      <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/60 p-6">
        <h2 className="text-xl font-semibold text-dashboard-text">Achievements</h2>
        <p className="mt-2 text-sm text-dashboard-muted">
          Complete tasks and focus sessions to gently unlock milestones.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-dashboard-text">Achievements</h2>
        <p className="mt-1 text-sm text-dashboard-muted">
          Supportive milestones that grow with your effort — never pressure.
        </p>
      </div>
      {groups.map((group) => (
        <div className="space-y-3" key={group.id}>
          <h3 className="text-sm font-medium uppercase tracking-[0.04em] text-dashboard-muted">
            {group.label}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.achievements.map((item) => (
              <AchievementCard item={item} key={item.id} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
