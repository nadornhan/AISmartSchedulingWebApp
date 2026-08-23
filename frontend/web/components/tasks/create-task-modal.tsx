'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../lib/api';
import {
  DURATION_PRESETS_MINUTES,
  formatDurationLabel,
  parseCustomDuration,
} from '../../lib/duration';
import { parseNaturalLanguageTask } from '../../lib/natural-language-task';
import type { Project } from '../../lib/projects';
import type {
  TaskCreateInput,
  TaskPriorityValue,
  TaskResponse,
  TaskUpdateInput,
} from '../../lib/tasks';
import { CreateFolderModal } from '../folders/create-folder-modal';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PlusIcon,
  TrashIcon,
} from '../layout/icons';

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
  subtasks: TaskFormSubtask[];
};

type TaskFormSubtask = {
  title: string;
  isCompleted: boolean;
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
    subtasks: task.subtasks.map((subtask) => ({
      title: subtask.title,
      isCompleted: subtask.is_completed,
    })),
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
      enableNaturalLanguage
      initialValues={{
        title: '',
        description: '',
        projectId: initialProjectId,
        priority: initialPriority,
        dueDate: '',
        dueTime: '',
        estimatedDurationMinutes: null,
        subtasks: [],
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
  enableNaturalLanguage = false,
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
  enableNaturalLanguage?: boolean;
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
  const [titleValue, setTitleValue] = useState(initialValues.title);
  const [dueDateValue, setDueDateValue] = useState(initialValues.dueDate);
  const [dueTimeValue, setDueTimeValue] = useState(initialValues.dueTime);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [availableProjects, setAvailableProjects] = useState(projects);
  const [selectedProjectId, setSelectedProjectId] = useState(initialValues.projectId);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDetailsElement>(null);
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
  const [subtasks, setSubtasks] = useState<TaskFormSubtask[]>(initialValues.subtasks);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function createFromNaturalLanguage() {
    const parsed = parseNaturalLanguageTask(naturalLanguageInput);

    if (!parsed.title) {
      setParseFeedback('Add a task description before creating the task.');
      return;
    }

    const requestedProjectName = parsed.projectName?.toLocaleLowerCase();
    const matchedProject = requestedProjectName
      ? availableProjects.find(
          (project) => project.name.trim().toLocaleLowerCase() === requestedProjectName,
        )
      : null;

    if (parsed.projectName && !matchedProject) {
      setParseFeedback(
        `Folder “${parsed.projectName}” was not found. Check the folder name and try again.`,
      );
      return;
    }

    let dueDateTime: string | null = null;
    if (parsed.dueDate) {
      const parsedDate = new Date(
        `${parsed.dueDate}T${parsed.dueTime ? `${parsed.dueTime}:00` : '23:59:00'}`,
      );
      if (!Number.isNaN(parsedDate.getTime())) dueDateTime = parsedDate.toISOString();
    }

    setParseFeedback(`Creating task from ${parsed.detectedFields.join(', ')}...`);
    setSubmitError(null);
    setIsQuickCreating(true);

    try {
      await onSubmit({
        title: parsed.title,
        description: null,
        project_id: matchedProject?.id ?? (selectedProjectId || null),
        due_date: dueDateTime,
        priority: parsed.priority ?? 'no_priority',
        estimated_duration_minutes: parsed.estimatedDurationMinutes,
        subtasks: [],
      });
    } catch (requestError) {
      setParseFeedback(null);
      setSubmitError(getErrorMessage(requestError));
    } finally {
      setIsQuickCreating(false);
    }
  }

  function addSubtask() {
    const titleValue = subtaskDraft.trim();
    if (!titleValue) return;

    setSubtasks((current) => [
      ...current,
      {
        title: titleValue,
        isCompleted: false,
      },
    ]);
    setSubtaskDraft('');
  }

  function updateSubtask(index: number, nextSubtask: TaskFormSubtask) {
    setSubtasks((current) =>
      current.map((subtask, subtaskIndex) =>
        subtaskIndex === index ? nextSubtask : subtask,
      ),
    );
  }

  function removeSubtask(index: number) {
    setSubtasks((current) => current.filter((_subtask, subtaskIndex) => subtaskIndex !== index));
  }

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    projectMenuRef.current?.removeAttribute('open');
  }

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
      const normalizedSubtasks = subtasks
        .map((subtask, position) => ({
          title: subtask.title.trim(),
          is_completed: subtask.isCompleted,
          position,
        }))
        .filter((subtask) => subtask.title);

      await onSubmit({
        title: titleValue,
        description: notes || null,
        project_id: projectId || null,
        due_date: dueDateTime,
        priority: priorityToApi[priority],
        estimated_duration_minutes: estimatedDurationMinutes,
        subtasks: normalizedSubtasks,
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
          {enableNaturalLanguage ? (
            <section className="rounded-[var(--radius-md)] border border-dashboard-accent/30 bg-dashboard-accent-soft/40 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-dashboard-text">Smart task entry</h3>
                <p className="mt-1 text-xs leading-5 text-dashboard-muted">
                  Write naturally and CHRONO will create the task immediately.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  aria-label="Describe your task naturally"
                  className="min-h-20 min-w-0 flex-1 resize-y rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 py-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
                  onChange={(event) => {
                    setNaturalLanguageInput(event.target.value);
                    setParseFeedback(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void createFromNaturalLanguage();
                    }
                  }}
                  placeholder="e.g. Finalize the CSIT321 report tomorrow at 5 PM, high priority, around 2 hours, assign to: A"
                  value={naturalLanguageInput}
                />
                <button
                  className="h-11 shrink-0 rounded-[var(--radius-sm)] border border-dashboard-accent bg-dashboard-accent-soft px-4 text-sm font-semibold text-dashboard-accent transition hover:bg-dashboard-accent/20 sm:self-end"
                  disabled={isSubmitting || isQuickCreating || !naturalLanguageInput.trim()}
                  onClick={() => void createFromNaturalLanguage()}
                  type="button"
                >
                  {isSubmitting || isQuickCreating ? 'Creating...' : 'Create task'}
                </button>
              </div>
              {parseFeedback ? (
                <p className="mt-2 text-xs leading-5 text-dashboard-accent" role="status">
                  {parseFeedback}
                </p>
              ) : null}
            </section>
          ) : null}

          <Field label="Task Title">
            <input
              className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-accent bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              name="title"
              onChange={(event) => setTitleValue(event.target.value)}
              placeholder="e.g. Finish Q2 Report"
              required
              value={titleValue}
            />
          </Field>

          <div>
            <span className="mb-2 block text-sm font-medium text-dashboard-text">
              Folder / Project
            </span>
            <input name="project" type="hidden" value={selectedProjectId} />
            <details className="group relative" ref={projectMenuRef}>
              <summary className="flex h-[var(--input-height-desktop)] cursor-pointer list-none items-center gap-3 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none transition hover:border-dashboard-border-strong focus-visible:border-dashboard-accent focus-visible:ring-2 focus-visible:ring-dashboard-accent/15 [&::-webkit-details-marker]:hidden">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      availableProjects.find((project) => project.id === selectedProjectId)
                        ?.color ?? 'var(--dashboard-muted)',
                  }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {availableProjects.find((project) => project.id === selectedProjectId)?.name ??
                    'Unassigned (Add to Inbox)'}
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-dashboard-muted transition group-open:rotate-180" />
              </summary>

              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-[var(--radius-sm)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-2 shadow-[0_18px_50px_rgba(0,0,0,.5)]">
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  <button
                    aria-pressed={!selectedProjectId}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                      !selectedProjectId
                        ? 'bg-dashboard-accent-soft text-dashboard-accent'
                        : 'text-dashboard-text hover:bg-dashboard-surface-hover',
                    )}
                    onClick={() => selectProject('')}
                    type="button"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-dashboard-muted" />
                    <span className="min-w-0 flex-1 truncate">Unassigned (Add to Inbox)</span>
                    {!selectedProjectId ? <CheckIcon className="h-4 w-4" /> : null}
                  </button>

                  {availableProjects.map((project) => {
                    const isSelected = project.id === selectedProjectId;
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                          isSelected
                            ? 'bg-dashboard-accent-soft text-dashboard-accent'
                            : 'text-dashboard-text hover:bg-dashboard-surface-hover',
                        )}
                        key={project.id}
                        onClick={() => selectProject(project.id)}
                        type="button"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {isSelected ? <CheckIcon className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 border-t border-dashboard-border pt-2">
                  <button
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-dashboard-accent transition hover:bg-dashboard-accent-soft"
                    onClick={() => {
                      projectMenuRef.current?.removeAttribute('open');
                      setIsCreateFolderOpen(true);
                    }}
                    type="button"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-dashboard-accent-soft">
                      <PlusIcon className="h-4 w-4" />
                    </span>
                    Create new folder
                  </button>
                </div>
              </div>
            </details>
          </div>

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
                  onChange={(event) => setDueDateValue(event.target.value)}
                  type="date"
                  value={dueDateValue}
                />
              </label>
            </Field>

            <Field label="Time" optional>
              <input
                className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                name="dueTime"
                onChange={(event) => setDueTimeValue(event.target.value)}
                type="time"
                value={dueTimeValue}
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

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-dashboard-text">
                Subtasks{' '}
                <span className="font-normal text-dashboard-muted">(optional)</span>
              </span>
              <span className="text-xs text-dashboard-muted">
                {subtasks.filter((subtask) => subtask.isCompleted).length}/{subtasks.length} done
              </span>
            </div>

            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div className="flex items-center gap-2" key={`${subtask.title}-${index}`}>
                  <button
                    aria-label={subtask.isCompleted ? 'Mark subtask incomplete' : 'Mark subtask done'}
                    aria-pressed={subtask.isCompleted}
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border transition',
                      subtask.isCompleted
                        ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
                        : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-accent/70',
                    )}
                    onClick={() =>
                      updateSubtask(index, {
                        ...subtask,
                        isCompleted: !subtask.isCompleted,
                      })
                    }
                    type="button"
                  >
                    {subtask.isCompleted ? <CheckIcon className="h-4 w-4" /> : null}
                  </button>
                  <input
                    className="h-10 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
                    onChange={(event) =>
                      updateSubtask(index, {
                        ...subtask,
                        title: event.target.value,
                      })
                    }
                    value={subtask.title}
                  />
                  <button
                    aria-label="Remove subtask"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted transition hover:border-[var(--red-border)] hover:text-[var(--red-light)]"
                    onClick={() => removeSubtask(index)}
                    type="button"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
                onChange={(event) => setSubtaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask..."
                value={subtaskDraft}
              />
              <button
                aria-label="Add subtask"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent transition hover:bg-dashboard-accent/20"
                onClick={addSubtask}
                type="button"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
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

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreated={(folder) => {
          setAvailableProjects((current) => [
            ...current.filter((project) => project.id !== folder.id),
            folder,
          ]);
          setSelectedProjectId(folder.id);
        }}
      />
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
