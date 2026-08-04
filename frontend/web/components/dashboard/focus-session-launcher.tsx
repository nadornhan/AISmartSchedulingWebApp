'use client';

import { useRouter } from 'next/navigation';

import type { DashboardTaskSummary } from '../../lib/dashboard';

export function FocusSessionLauncher({
  task,
}: Readonly<{
  task: DashboardTaskSummary | null;
}>) {
  const router = useRouter();
  const disabled = task === null;

  function startFocus() {
    if (!task) return;

    const params = new URLSearchParams({
      task_id: task.id,
      task_title: task.title,
    });
    router.push(`/focus?${params.toString()}`);
  }

  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-dashboard-text">Focus Launcher</h2>
          <p className="mt-1 text-sm text-dashboard-muted">
            {task ? task.title : 'Select a task once your queue has something active.'}
          </p>
        </div>
        <button
          className="h-11 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d] shadow-glow transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled}
          onClick={startFocus}
          type="button"
        >
          Start Focus
        </button>
      </div>
    </section>
  );
}
