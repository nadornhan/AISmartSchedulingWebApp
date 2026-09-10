'use client';

import { useEffect } from 'react';

import type { PriorityLevel, PriorityTask } from './priority.types';

type Props = {
  task: PriorityTask | null;
  onClose: () => void;
};

const priorityLabels: Record<PriorityLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority',
};

function readableStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDeadline(value?: string) {
  if (!value) return 'No deadline';

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(minutes?: number) {
  if (!minutes) return 'Not estimated';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function PriorityTaskPreview({ task, onClose }: Props) {
  useEffect(() => {
    if (!task) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, task]);

  if (!task) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[350] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section
        aria-labelledby="priority-task-preview-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-dashboard-border bg-[#07141e] p-6 shadow-panel"
      >
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-dashboard-accent">
              Task preview
            </p>
            <h2
              className="mt-2 break-words text-xl font-semibold text-dashboard-text"
              id="priority-task-preview-title"
            >
              {task.title}
            </h2>
          </div>
          <button
            aria-label="Close task preview"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-2xl text-dashboard-muted transition hover:bg-white/5 hover:text-dashboard-text"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </header>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-dashboard-muted">
          {task.description || 'No description provided.'}
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <PreviewField label="Priority" value={priorityLabels[task.priority]} />
          <PreviewField label="Status" value={readableStatus(task.status)} />
          <PreviewField label="Deadline" value={formatDeadline(task.deadline)} />
          <PreviewField
            label="Estimated duration"
            value={formatDuration(task.estimatedDurationMinutes)}
          />
          <div className="sm:col-span-2">
            <PreviewField label="Project / Folder" value={task.folder} />
          </div>
        </dl>
      </section>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-raised/65 p-3.5">
      <dt className="text-xs uppercase tracking-wide text-dashboard-muted">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-dashboard-text">{value}</dd>
    </div>
  );
}
