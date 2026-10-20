'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle, Sparkles } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { TaskPriorityValue } from '../../lib/tasks';

type Proposal = {
  suggested_priority: TaskPriorityValue;
  confidence: number;
};

export function PrioritySuggestion({
  title,
  taskDescription,
  dueDate,
  dueTime,
  duration,
  priority,
  disabled,
  onChoose,
}: {
  taskDescription: string;
  title: string;
  dueDate: string;
  dueTime: string;
  duration: number | null;
  priority: TaskPriorityValue;
  disabled: boolean;
  onChoose: (value: TaskPriorityValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState<TaskPriorityValue>('no_priority');
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [taskOptions, setTaskOptions] = useState<{ id: string; title: string }[]>([]);
  const [dependencyError, setDependencyError] = useState('');
  const request = useRef(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadTasks() {
      try {
        const options: { id: string; title: string }[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const result = await apiRequest<{
            items: { id: string; title: string; status: string }[];
            total_pages: number;
          }>(`/tasks?page=${page}&page_size=100`);
          if (cancelled) return;
          options.push(...result.items.filter((task) => task.status !== 'done'));
          totalPages = result.total_pages;
          page += 1;
        } while (page <= totalPages);
        setTaskOptions(options);
        setDependencyError('');
      } catch {
        if (!cancelled) setDependencyError('Could not load tasks for dependency selection.');
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [open]);
  useEffect(() => {
    request.current += 1;
    setProposal(null);
    setBusy(false);
  }, [title, taskDescription, dueDate, dueTime, duration, priority, description, dependencies]);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  async function preview() {
    if (!title.trim()) {
      setError('Add a task title first.');
      return;
    }
    const version = ++request.current;
    setBusy(true);
    setError('');
    setProposal(null);
    try {
      const response = await apiRequest<{ proposal: Proposal }>('/tasks/priority/preview', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate ? new Date(`${dueDate}T${dueTime || '23:59'}:00`).toISOString() : null,
          estimated_duration_minutes: duration,
          current_priority: priority,
          description: taskDescription,
          importance_description: description,
          dependency_ids: dependencies,
        }),
      });
      if (version !== request.current) return;
      setProposal(response.proposal);
      setChoice(response.proposal.suggested_priority);
    } catch (err) {
      if (version === request.current)
        setError(err instanceof Error ? err.message : 'Could not suggest priority.');
    } finally {
      if (version === request.current) setBusy(false);
    }
  }
  const button =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-dashboard-border px-3.5 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent hover:bg-dashboard-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50';
  const primaryButton =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-dashboard-accent px-4 py-2.5 text-sm font-semibold text-dashboard-on-accent transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50';
  const priorityLabels: Record<TaskPriorityValue, string> = {
    no_priority: 'No priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return (
    <>
      <button
        type="button"
        className={button}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-accent" />
        Suggest with AI
      </button>
      {open && (
        <div className="w-full min-w-0 space-y-4 rounded-xl border border-dashboard-accent/30 bg-dashboard-accent-soft p-4 font-sans text-sm font-normal sm:p-5">
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-dashboard-text">
              Why it matters <span className="font-normal text-dashboard-muted">(optional)</span>
            </span>
            <textarea
              aria-label="Why this task matters"
              placeholder="Add a little context for the suggestion"
              maxLength={2000}
              rows={3}
              className="block min-h-24 w-full min-w-0 resize-y rounded-lg border border-dashboard-border bg-[var(--bg-input)] px-3 py-3 text-sm leading-5 text-dashboard-text outline-none transition placeholder:text-dashboard-muted focus:border-dashboard-accent focus:ring-2 focus:ring-dashboard-accent/15"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={disabled}
            />
          </label>
          <details className="group rounded-lg border border-dashboard-border bg-[var(--bg-input)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-dashboard-text outline-none transition hover:bg-dashboard-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-accent [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                Prerequisites <span className="font-normal text-dashboard-muted">(optional)</span>
                {dependencies.length > 0 ? ` · ${dependencies.length} selected` : ''}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-dashboard-muted transition-transform group-open:rotate-180"
              />
            </summary>
            {dependencyError && (
              <p className="px-3 pb-3 text-sm text-dashboard-danger" role="alert">
                {dependencyError}
              </p>
            )}
            <div className="max-h-44 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
              {taskOptions.map((task) => (
                <label
                  key={task.id}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${dependencies.includes(task.id) ? 'border-dashboard-accent/40 bg-dashboard-accent-soft' : 'border-dashboard-border hover:bg-dashboard-surface'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent disabled:cursor-not-allowed"
                    checked={dependencies.includes(task.id)}
                    disabled={
                      disabled || (!dependencies.includes(task.id) && dependencies.length >= 100)
                    }
                    onChange={(e) =>
                      setDependencies((current) =>
                        e.target.checked
                          ? [...current, task.id]
                          : current.filter((id) => id !== task.id),
                      )
                    }
                  />
                  <span className="min-w-0 break-words text-sm leading-5 text-dashboard-text">
                    {task.title}
                  </span>
                </label>
              ))}
              {!dependencyError && taskOptions.length === 0 && (
                <p className="py-2 text-sm text-dashboard-muted">No open tasks available.</p>
              )}
            </div>
          </details>
          <button
            type="button"
            className={`${primaryButton} w-full sm:w-auto`}
            onClick={preview}
            disabled={busy || disabled}
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            )}
            {busy ? 'Generating…' : 'Get suggestion'}
          </button>
          {error && (
            <p role="alert" className="text-dashboard-danger">
              {error}
            </p>
          )}
          {proposal && (
            <div
              role="status"
              className="space-y-3 rounded-lg border border-dashboard-border bg-[var(--bg-input)] p-3 sm:p-4"
            >
              <p>
                Suggested priority:{' '}
                <strong className="text-dashboard-accent">
                  {priorityLabels[proposal.suggested_priority]}
                </strong>
              </p>
              <p className="text-xs font-normal text-dashboard-muted">
                Confidence:{' '}
                <strong className="text-dashboard-text">
                  {Math.round(proposal.confidence * 100)}%
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 border-t border-dashboard-border pt-3">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={disabled}
                  onClick={() => {
                    onChoose(proposal.suggested_priority);
                    setOpen(false);
                  }}
                >
                  Accept
                </button>
                <select
                  aria-label="Change suggested priority"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value as TaskPriorityValue)}
                  className="min-h-10 min-w-0 rounded-lg border border-dashboard-border bg-[var(--bg-input)] px-3 py-2 text-sm text-dashboard-text outline-none focus:border-dashboard-accent focus:ring-2 focus:ring-dashboard-accent/15"
                >
                  <option value="no_priority">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  type="button"
                  className={button}
                  disabled={disabled}
                  onClick={() => {
                    onChoose(choice);
                    setOpen(false);
                  }}
                >
                  Change
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    request.current += 1;
                    setProposal(null);
                    setOpen(false);
                    setBusy(false);
                  }}
                >
                  Ignore
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
