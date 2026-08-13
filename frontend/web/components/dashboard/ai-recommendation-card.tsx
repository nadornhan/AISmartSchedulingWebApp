'use client';

import { useRouter } from 'next/navigation';

import type { DashboardAiRecommendation } from '../../lib/dashboard';
import { acceptRecommendation, dismissRecommendation } from '../../lib/scheduling';
import { DashboardTaskCard } from './dashboard-task-card';

export function AiRecommendationCard({
  item,
  onChanged,
}: Readonly<{
  item: DashboardAiRecommendation | null;
  onChanged?: () => void;
}>) {
  const router = useRouter();
  const focusMinutes = item?.task.estimated_duration_minutes ?? 25;

  async function startFocus() {
    if (!item) return;

    if (item.id) {
      try {
        await acceptRecommendation(item.id);
      } catch {
        // Still allow focus even if accept fails.
      }
    }

    const params = new URLSearchParams({
      task_id: item.task.id,
      task_title: item.task.title,
      duration: String(focusMinutes),
    });
    router.push(`/focus?${params.toString()}`);
    onChanged?.();
  }

  async function dismiss() {
    if (!item?.id) return;
    try {
      await dismissRecommendation(item.id);
      onChanged?.();
    } catch {
      // Keep card visible if dismiss fails.
    }
  }

  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-dashboard-text">AI Recommendation</h2>
          <p className="mt-1 text-xs text-dashboard-muted">
            Based on your tasks, focus history, and Settings priorities.
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] border border-dashboard-accent/40 bg-dashboard-accent-soft px-3 py-1 text-[11px] font-medium text-dashboard-accent">
          AI based on your patterns
        </span>
      </div>

      {item ? (
        <div className="space-y-3">
          <DashboardTaskCard compact task={item.task} />
          <p className="text-sm leading-6 text-dashboard-muted">{item.explanation}</p>
          <div className="flex flex-wrap gap-2">
            {item.reasons.map((reason) => (
              <span
                className="rounded-[var(--radius-pill)] border border-dashboard-border bg-dashboard-bg/45 px-3 py-1 text-xs font-medium text-dashboard-muted"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-11 flex-1 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110"
              onClick={() => void startFocus()}
              type="button"
            >
              Accept & Start {focusMinutes}-min Focus
            </button>
            <button
              className="h-11 rounded-[var(--radius-sm)] border border-dashboard-border px-4 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
              onClick={() => void dismiss()}
              type="button"
            >
              Dismiss
            </button>
            <button
              className="h-11 rounded-[var(--radius-sm)] border border-dashboard-border px-4 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
              onClick={() => router.push('/analytics')}
              type="button"
            >
              Review schedule
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-dashboard-border bg-dashboard-bg/25 p-5 text-sm text-dashboard-muted">
          No AI recommendation yet. Create open tasks or enable the AI assistant in Settings.
        </p>
      )}
    </section>
  );
}
