'use client';

import { FormEvent, useMemo, useState } from 'react';

import { ApiError } from '../../lib/api';
import {
  DURATION_PRESETS_MINUTES,
  formatDurationLabel,
  parseCustomDuration,
} from '../../lib/duration';
import type { Project } from '../../lib/projects';
import type {
  TaskCreateInput,
  TaskPriorityValue,
  TaskResponse,
  TaskUpdateInput,
} from '../../lib/tasks';
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

type DurationOption = '' | 'custom' | `${(typeof DURATION_PRESETS_MINUTES)[number]}`;

type TaskFormInitialValues = {
  title: string;
  description: string;
  projectId: string;
  priority: TaskPriorityLabel;
  dueDate: string;
  dueTime: string;
  estimatedDurationMinutes: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function toDateInputValue(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function durationOptionFromMinutes(value: number | null): DurationOption {
  if (value === null) return '';
  return DURATION_PRESETS_MINUTES.includes(
    value as (typeof DURATION_PRESETS_MINUTES)[number],
  )
    ? (`${value}` as DurationOption)
    : 'custom';
}

function taskInitialValues(task: TaskResponse): TaskFormInitialValues {
  return {
    title: task.title,
    description: task.description ?? '',
    projectId: task.project_id ?? '',
    priority: priorityFromApi[task.priority],
    dueDate: toDateInputValue(task.due_date),
    dueTime: toTimeInputValue(task.due_date),
    estimatedDurationMinutes: task.estimated_duration_minutes,
  };
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
  return (
    <TaskFormModal
      description="Add the details of your task below."
      initialValues={{
        title: '',
        description: '',
        projectId: initialProjectId,
        priority: initialPriority,
        dueDate: '',
        dueTime: '',
        estimatedDurationMinutes: null,
      }}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onCreate}
      projects={projects}
      submitLabel="Create Task"
      submittingLabel="Creating..."
      title="Create New Task"
    />
  );
}

export function EditTaskModal({
  isSubmitting,
  onClose,
  onUpdate,
  projects,
  task,
}: Readonly<{
  isSubmitting: boolean;
  onClose: () => void;
  onUpdate: (task: TaskUpdateInput) => Promise<void>;
  projects: Project[];
  task: TaskResponse;
}>) {
  const initialValues = useMemo(() => taskInitialValues(task), [task]);

  return (
    <TaskFormModal
      description="Update the details for this task."
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onUpdate}
      projects={projects}
      submitLabel="Save Changes"
      submittingLabel="Saving..."
      title="Edit Task"
    />
  );
}

function TaskFormModal({
  description,
  initialValues,
  isSubmitting,
  onClose,
  onSubmit,
  projects,
  submitLabel,
  submittingLabel,
  title,
}: Readonly<{
  description: string;
  initialValues: TaskFormInitialValues;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (task: TaskCreateInput) => Promise<void>;
  projects: Project[];
  submitLabel: string;
  submittingLabel: string;
  title: string;
}>) {
  const initialDuration = initialValues.estimatedDurationMinutes;
  const [priority, setPriority] = useState<TaskPriorityLabel>(initialValues.priority);
  const [durationOption, setDurationOption] = useState<DurationOption>(
    durationOptionFromMinutes(initialDuration),
  );
  const [customDuration, setCustomDuration] = useState(
    initialDuration !== null &&
      !DURATION_PRESETS_MINUTES.includes(
        initialDuration as (typeof DURATION_PRESETS_MINUTES)[number],
      )
      ? String(initialDuration)
      : '',
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    const titleValue = String(formData.get('title') || '').trim();
    const projectId = String(formData.get('project') || '');
    const dueDate = String(formData.get('dueDate') || '');
    const dueTime = String(formData.get('dueTime') || '').trim();
    const notes = String(formData.get('description') || '').trim();
    let dueDateTime: string | null = null;
    let estimatedDurationMinutes: number | null = null;

    if (!titleValue) {
      setSubmitError('Please enter a task title.');
      return;
    }

    if (durationOption === 'custom') {
      estimatedDurationMinutes = parseCustomDuration(customDuration);
      if (estimatedDurationMinutes === null) {
        setSubmitError('Custom duration must be a positive whole number of minutes.');
        return;
      }
    } else if (durationOption) {
      estimatedDurationMinutes = Number(durationOption);
    }

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
      await onSubmit({
        title: titleValue,
        description: notes || null,
        project_id: projectId || null,
        due_date: dueDateTime,
        priority: priorityToApi[priority],
        estimated_duration_minutes: estimatedDurationMinutes,
      });
    } catch (requestError) {
      setSubmitError(getErrorMessage(requestError));
    }
  }

  return (
    <div
      aria-labelledby="task-form-title"
      aria-modal="true"
      className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto bg-[#000306]/80 p-4 backdrop-blur-[5px]"
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
              id="task-form-title"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">{description}</p>
          </div>
          <button
            aria-label="Close task dialog"
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
              defaultValue={initialValues.title}
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
                defaultValue={initialValues.projectId}
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
                  defaultValue={initialValues.dueDate}
                  name="dueDate"
                  type="date"
                />
              </label>
            </Field>

            <Field label="Time" optional>
              <input
                className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                defaultValue={initialValues.dueTime}
                name="dueTime"
                type="time"
              />
            </Field>
          </div>

          <Field label="Estimated Duration" optional>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS_MINUTES.map((minutes) => {
                const value = String(minutes) as DurationOption;
                return (
                  <button
                    aria-pressed={durationOption === value}
                    className={cn(
                      'h-10 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition',
                      durationOption === value
                        ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                        : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text',
                    )}
                    key={minutes}
                    onClick={() => setDurationOption(value)}
                    type="button"
                  >
                    {formatDurationLabel(minutes)}
                  </button>
                );
              })}
              <button
                aria-pressed={durationOption === 'custom'}
                className={cn(
                  'h-10 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition',
                  durationOption === 'custom'
                    ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                    : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text',
                )}
                onClick={() => setDurationOption('custom')}
                type="button"
              >
                Custom
              </button>
              {durationOption ? (
                <button
                  className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border px-3 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
                  onClick={() => {
                    setDurationOption('');
                    setCustomDuration('');
                  }}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {durationOption === 'custom' ? (
              <input
                className="mt-3 h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
                inputMode="numeric"
                min={1}
                onChange={(event) => setCustomDuration(event.target.value)}
                pattern="[1-9][0-9]*"
                placeholder="Minutes"
                type="number"
                value={customDuration}
              />
            ) : null}
          </Field>

          <Field label="Notes / Description" optional>
            <textarea
              className="min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 py-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
              defaultValue={initialValues.description}
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
            {isSubmitting ? submittingLabel : submitLabel}
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
