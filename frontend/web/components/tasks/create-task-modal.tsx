'use client';

import { FormEvent, useState } from 'react';

import { ApiError } from '../../lib/api';
import type { Project } from '../../lib/projects';
import type { TaskCreateInput, TaskPriorityValue } from '../../lib/tasks';
import { CalendarIcon, ChevronDownIcon, CloseIcon } from '../layout/icons';

export type TaskPriorityLabel = 'No priority' | 'Low' | 'Medium' | 'High';

const priorityToApi: Record<TaskPriorityLabel, TaskPriorityValue> = {
  'No priority': 'no_priority',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

const priorityFromApi: Record<TaskPriorityValue, TaskPriorityLabel> = {
  no_priority: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function priorityLabelFromApi(value: TaskPriorityValue): TaskPriorityLabel {
  return priorityFromApi[value];
}

export function CreateTaskModal({
  initialPriority = 'No priority',
  initialProjectId = '',
  isSubmitting,
  onClose,
  onCreate,
  projects,
}: Readonly<{
  initialPriority?: TaskPriorityLabel;
  initialProjectId?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (task: TaskCreateInput) => Promise<void>;
  projects: Project[];
}>) {
  const [priority, setPriority] = useState<TaskPriorityLabel>(initialPriority);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    const projectId = String(formData.get('project') || '');
    const dueDate = String(formData.get('dueDate') || '');
    const dueTime = String(formData.get('dueTime') || '').trim();
    const description = String(formData.get('description') || '').trim();
    let dueDateTime: string | null = null;

    if (dueDate) {
      const normalizedTime = dueTime
        ? dueTime.length === 5
          ? `${dueTime}:00`
          : dueTime
        : '23:59:00';
      const parsedDueDate = new Date(`${dueDate}T${normalizedTime}`);

      if (Number.isNaN(parsedDueDate.getTime())) {
        setSubmitError('Please enter a valid due date and time.');
        return;
      }

      dueDateTime = parsedDueDate.toISOString();
    }

    try {
      await onCreate({
        title: String(formData.get('title')).trim(),
        description: description || null,
        project_id: projectId || null,
        due_date: dueDateTime,
        priority: priorityToApi[priority],
      });
    } catch (requestError) {
      setSubmitError(getErrorMessage(requestError));
    }
  }

  return (
    <div
      aria-labelledby="create-task-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#000306]/80 p-4 backdrop-blur-[5px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <form
        className="my-6 w-full max-w-[620px] rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.6)] sm:p-8"
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2
              className="text-2xl font-semibold tracking-[var(--tracking-heading)] text-dashboard-text"
              id="create-task-title"
            >
              Create New Task
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">Add the details of your task below.</p>
          </div>
          <button
            aria-label="Close create task dialog"
            className="grid h-10 w-10 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-text"
            onClick={onClose}
            type="button"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <Field label="Task Title">
            <input
              autoFocus
              className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-accent bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              name="title"
              placeholder="e.g. Finish Q2 Report"
              required
            />
          </Field>

          <Field label="Folder / Project">
            <label className="relative block">
              <span className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-dashboard-muted" />
              <select
                className="h-[var(--input-height-desktop)] w-full appearance-none rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] pl-9 pr-10 text-sm text-dashboard-text outline-none focus:border-dashboard-accent"
                defaultValue={initialProjectId}
                name="project"
              >
                <option value="">Unassigned (Add to Inbox)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-muted" />
            </label>
          </Field>

          <Field label="Priority">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['No priority', 'Low', 'Medium', 'High'] as TaskPriorityLabel[]).map((option) => (
                <button
                  className={cn(
                    'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border text-sm transition',
                    priority === option
                      ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-text'
                      : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong',
                  )}
                  key={option}
                  onClick={() => setPriority(option)}
                  type="button"
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      option === 'No priority' && 'bg-dashboard-muted',
                      option === 'Low' && 'bg-[var(--blue)]',
                      option === 'Medium' && 'bg-[var(--yellow)]',
                      option === 'High' && 'bg-[var(--red)]',
                    )}
                  />
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Due Date" optional>
              <label className="relative block">
                <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dashboard-muted" />
                <input
                  className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] pl-12 pr-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                  name="dueDate"
                  type="date"
                />
              </label>
            </Field>

            <Field label="Time" optional>
              <input
                className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                name="dueTime"
                type="time"
              />
            </Field>
          </div>

          <Field label="Notes / Description" optional>
            <textarea
              className="min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 py-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
              name="description"
              placeholder="Add any notes or details..."
            />
          </Field>
        </div>

        {submitError ? (
          <p className="mt-5 text-sm text-[var(--red-light)]" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            className="h-11 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-5 text-sm font-medium text-dashboard-text transition hover:border-dashboard-border-strong"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex h-11 items-center gap-3 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-6 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
            <span className="rounded bg-[#04110d]/15 px-1.5 py-0.5 text-xs">⌘↵</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  children,
  label,
  optional,
}: Readonly<{ children: React.ReactNode; label: string; optional?: boolean }>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-dashboard-text">
        {label}{' '}
        {optional ? <span className="font-normal text-dashboard-muted">(optional)</span> : null}
      </span>
      {children}
    </label>
  );
}
