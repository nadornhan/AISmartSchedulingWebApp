'use client';

import { useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '../layout/icons';
import {
  cn,
  statusClass,
  statuses,
  statusOptionClass,
  type Task,
  type TaskStatus,
} from './task-page-model';

export function StatusDropdown({
  compact = false,
  disabled,
  onChange,
  taskTitle,
  value,
}: Readonly<{
  compact?: boolean;
  disabled: boolean;
  onChange: (status: TaskStatus) => void;
  taskTitle: string;
  value: TaskStatus;
}>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn('relative w-fit', isOpen && 'z-50')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Status for ${taskTitle}: ${value}`}
        className={cn(
          'inline-flex appearance-none items-center justify-between rounded-[var(--radius-pill)] border font-medium outline-none transition focus:ring-2 focus:ring-dashboard-accent/20 disabled:cursor-not-allowed disabled:opacity-60',
          compact
            ? 'h-7 min-w-[104px] gap-1.5 px-2.5 text-[10px]'
            : 'h-10 min-w-[128px] gap-2 px-3.5 text-sm',
          statusClass(value),
        )}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{value}</span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform',
            compact ? 'h-3 w-3' : 'h-4 w-4',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div
          aria-label={`Choose status for ${taskTitle}`}
          className="absolute left-0 top-full z-50 mt-2 grid min-w-40 gap-1.5 rounded-xl border border-dashboard-border bg-dashboard-raised p-2 shadow-panel"
          role="menu"
        >
          {statuses.map((status) => (
            <button
              aria-checked={value === status}
              className={cn(
                'flex w-full items-center justify-between rounded-[var(--radius-pill)] border px-3 py-2 text-left text-sm font-semibold transition',
                statusOptionClass(status),
                value === status && 'ring-1 ring-current',
              )}
              key={status}
              onClick={() => {
                setIsOpen(false);
                if (status !== value) onChange(status);
              }}
              role="menuitemradio"
              type="button"
            >
              <span>{status}</span>
              {value === status ? <CheckIcon className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CheckBox({
  checked,
  label,
  onChange,
}: Readonly<{ checked: boolean; label: string; onChange: () => void }>) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition',
        checked
          ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
          : 'border-dashboard-border-strong bg-[var(--bg-input)] hover:border-dashboard-accent/70',
      )}
      onClick={onChange}
      type="button"
    >
      {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function SubtaskAccordion({
  disabled,
  onToggle,
  task,
}: Readonly<{
  disabled: boolean;
  onToggle: (subtaskId: string, isCompleted: boolean) => void;
  task: Task;
}>) {
  const { completed, percent, total } = task.source.subtask_progress;

  return (
    <div className="rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)]/70 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted">
          Subtasks
        </span>
        <span className="text-xs font-medium text-dashboard-accent">
          {completed}/{total} completed
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-dashboard-border">
        <div
          className="h-full rounded-full bg-dashboard-accent transition-[width] duration-300"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {task.source.subtasks.map((subtask) => (
          <button
            aria-pressed={subtask.is_completed}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-dashboard-surface-hover disabled:cursor-wait disabled:opacity-60"
            disabled={disabled}
            key={subtask.id}
            onClick={() => onToggle(subtask.id, !subtask.is_completed)}
            type="button"
          >
            <span
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                subtask.is_completed
                  ? 'border-dashboard-accent bg-dashboard-accent text-[#04110d]'
                  : 'border-dashboard-border-strong bg-transparent',
              )}
            >
              {subtask.is_completed ? <CheckIcon className="h-3.5 w-3.5" /> : null}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-sm text-dashboard-text',
                subtask.is_completed && 'text-dashboard-muted line-through',
              )}
            >
              {subtask.title}
            </span>
            {!subtask.is_completed ? (
              <span className="shrink-0 rounded-full bg-dashboard-accent-soft px-2 py-0.5 text-[10px] font-semibold text-dashboard-accent">
                +2 GP
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
