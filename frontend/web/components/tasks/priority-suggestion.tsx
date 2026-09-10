'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import type { TaskPriorityValue } from '../../lib/tasks';

type Proposal = {
  suggested_priority: TaskPriorityValue;
  confidence: number;
  reasons: string[];
  missing_inputs: string[];
  ai_explanation: string | null;
  importance_level: string | null;
  importance_confidence: number | null;
  importance_source: 'ai' | 'user' | 'unavailable';
  importance_reason: string | null;
};

export function PrioritySuggestion({ title, taskDescription, dueDate, dueTime, duration, priority, disabled, onChoose }: {
  taskDescription: string;
  title: string; dueDate: string; dueTime: string; duration: number | null;
  priority: TaskPriorityValue; disabled: boolean; onChoose: (value: TaskPriorityValue) => void;
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
          const result = await apiRequest<{ items: { id: string; title: string; status: string }[]; total_pages: number }>(`/tasks?page=${page}&page_size=100`);
          if (cancelled) return;
          options.push(...result.items.filter(task => task.status !== 'done'));
          totalPages = result.total_pages;
          page += 1;
        } while (page <= totalPages);
        setTaskOptions(options); setDependencyError('');
      } catch { if (!cancelled) setDependencyError('Could not load tasks for dependency selection.'); }
    }
    void loadTasks();
    return () => { cancelled = true; };
  }, [open]);
  useEffect(() => {
    request.current += 1;
    setProposal(null);
    setBusy(false);
  }, [title, taskDescription, dueDate, dueTime, duration, priority, description, dependencies]);
  useEffect(() => () => { request.current += 1; }, []);

  async function preview() {
    if (!title.trim()) { setError('Add a task title first.'); return; }
    const version = ++request.current;
    setBusy(true); setError(''); setProposal(null);
    try {
      const response = await apiRequest<{ proposal: Proposal }>('/tasks/priority/preview', {
        method: 'POST', body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate ? new Date(`${dueDate}T${dueTime || '23:59'}:00`).toISOString() : null,
          estimated_duration_minutes: duration, current_priority: priority,
          description: taskDescription, importance_description: description,
          dependency_ids: dependencies,
        }),
      });
      if (version !== request.current) return;
      setProposal(response.proposal); setChoice(response.proposal.suggested_priority);
    } catch (err) {
      if (version === request.current) setError(err instanceof Error ? err.message : 'Could not suggest priority.');
    } finally { if (version === request.current) setBusy(false); }
  }
  const button = 'rounded-lg border border-dashboard-accent/30 px-2.5 py-1.5 text-xs text-dashboard-accent hover:bg-dashboard-accent/10 disabled:opacity-50';
  const priorityLabels: Record<TaskPriorityValue, string> = { no_priority: 'No priority', low: 'Low', medium: 'Medium', high: 'High' };
  return <>
    <button type="button" className={button} disabled={disabled} aria-expanded={open}
      onClick={() => setOpen(!open)}>✧ Suggest with AI</button>
    {open && <div className="w-full space-y-3 rounded-lg border border-dashboard-accent/30 bg-dashboard-accent/5 p-3 text-sm">
      <input aria-label="Why this task matters" placeholder="Why it matters (optional)" maxLength={2000}
        className="w-full rounded border border-dashboard-border bg-[var(--bg-input)] p-2"
        value={description} onChange={e => setDescription(e.target.value)} disabled={disabled} />
      <details>
        <summary className="cursor-pointer text-xs text-dashboard-muted">Prerequisites (optional){dependencies.length > 0 ? ` · ${dependencies.length} selected` : ''}</summary>
        {dependencyError && <p role="alert">{dependencyError}</p>}
        <div className="max-h-36 space-y-1 overflow-y-auto">
          {taskOptions.map(task => <label key={task.id} className="flex items-center gap-2">
            <input type="checkbox" checked={dependencies.includes(task.id)} disabled={disabled || (!dependencies.includes(task.id) && dependencies.length >= 100)}
              onChange={e => setDependencies(current => e.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} />
            {task.title}
          </label>)}
          {!dependencyError && taskOptions.length === 0 && <p className="text-xs text-dashboard-muted">No open tasks available.</p>}
        </div>
      </details>
      <button type="button" className={button} onClick={preview} disabled={busy || disabled}>
        {busy ? 'Generating…' : 'Get suggestion'}
      </button>
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {proposal && <div role="status" className="space-y-2">
        <p>Suggested priority: <strong className="text-dashboard-accent">{priorityLabels[proposal.suggested_priority]}</strong></p>
        <p className="text-xs font-normal text-dashboard-muted">
          Confidence: <strong className="text-dashboard-text">{Math.round(proposal.confidence * 100)}%</strong>
        </p>
        <div className="text-xs font-normal">
          <p className="font-medium text-dashboard-text">Deterministic reasons</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-dashboard-muted">
            {proposal.reasons.filter(reason =>
              !reason.startsWith('AI-inferred importance:') &&
              reason !== 'Workload compares all open task estimates with the next 7 days of working hours'
            ).map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
        {(proposal.ai_explanation || (proposal.importance_source === 'ai' && proposal.importance_reason)) ? (
          <div className="text-xs font-normal">
            <p className="font-medium text-dashboard-text">AI explanation</p>
            <p className="mt-1 text-dashboard-muted">{proposal.ai_explanation || proposal.importance_reason}</p>
          </div>
        ) : <p className="text-xs font-normal text-dashboard-muted">AI explanation unavailable; using task data.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={disabled} onClick={() => { onChoose(proposal.suggested_priority); setOpen(false); }}>Accept</button>
          <select aria-label="Change suggested priority" value={choice} onChange={e => setChoice(e.target.value as TaskPriorityValue)} className="rounded bg-[var(--bg-input)] p-1">
            <option value="no_priority">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
          <button type="button" className={button} disabled={disabled} onClick={() => { onChoose(choice); setOpen(false); }}>Change</button>
          <button type="button" className={button} onClick={() => { request.current += 1; setProposal(null); setOpen(false); setBusy(false); }}>Ignore</button>
        </div>
      </div>}
    </div>}
  </>;
}
