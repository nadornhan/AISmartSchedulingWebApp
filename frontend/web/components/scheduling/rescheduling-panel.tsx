'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CalendarClock,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';

import { onSettingsDataChanged, onTaskDataChanged } from '../../lib/data-events';
import {
  applyReschedule,
  getRescheduleConflict,
  previewReschedule,
  undoReschedule,
  type RescheduleConflictCode,
  type RescheduleOption,
  type RescheduleProposal,
} from '../../lib/scheduling';

const optionLabels: Record<RescheduleOption['style'], string> = {
  minimal_disruption: 'Minimal disruption',
  earlier_completion: 'Earlier completion',
  best_v7_fit: 'Best schedule fit',
};

const changeLabels: Record<string, string> = {
  INVALID_SCHEDULE_INTERVAL: 'Invalid schedule interval',
  SCHEDULE_CONFLICT: 'Schedule conflict',
  SCHEDULE_DELAYED: 'Delayed task',
  TASK_OVERRUN: 'Focus session overrun',
  DURATION_NO_LONGER_FITS: 'Duration changed',
  OUTSIDE_WORKING_HOURS: 'Outside working hours',
  ENDS_AFTER_DEADLINE: 'Ends after deadline',
  CAPACITY_PRESSURE: 'Schedule capacity pressure',
  DAILY_WORK_LIMIT_EXCEEDED: 'Daily workload limit exceeded',
};

function formatDateTime(value: string | null, timezone: string) {
  if (!value) return 'Not scheduled';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}

function requestError(error: unknown) {
  const conflict = getRescheduleConflict(error);
  if (conflict) return { message: conflict.message, code: conflict.code };
  return {
    message: error instanceof Error ? error.message : 'Unable to update your schedule.',
    code: null,
  };
}

function hasReschedulingNeed(proposal: RescheduleProposal) {
  return (
    proposal.context.changes.length > 0 || proposal.options.length > 0 || proposal.issues.length > 0
  );
}

function ScheduleStatusMark() {
  return (
    <svg aria-hidden="true" className="size-7" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="22" rx="6" fill="currentColor" opacity="0.2" />
      <path
        d="M10 4v5M22 4v5M5 12h22M10 17h3M17 17h3M10 22h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="23" cy="23" r="5" fill="currentColor" />
      <path
        d="M23 20.5v2.8l1.8 1.1"
        stroke="#07120f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReschedulingPanel() {
  const [proposal, setProposal] = useState<RescheduleProposal | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<'check' | 'review' | 'apply' | 'undo' | null>(
    'check',
  );
  const [confirmOptionId, setConfirmOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictCode, setConflictCode] = useState<RescheduleConflictCode | null>(null);
  const checkSequence = useRef(0);
  const suppressNextTaskRefresh = useRef(false);

  const checkSchedule = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++checkSequence.current;
    setBusyAction('check');
    try {
      const result = await previewReschedule(false, signal);
      if (sequence !== checkSequence.current || signal?.aborted) return;
      setProposal(hasReschedulingNeed(result) ? result : null);
      setError(null);
      setConflictCode(null);
    } catch (requestFailure) {
      if (sequence !== checkSequence.current || signal?.aborted) return;
      setError(requestError(requestFailure).message);
    } finally {
      if (sequence === checkSequence.current && !signal?.aborted) setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkSchedule(controller.signal);
    const refreshAfterTaskChange = onTaskDataChanged(() => {
      if (suppressNextTaskRefresh.current) {
        suppressNextTaskRefresh.current = false;
        return;
      }
      void checkSchedule();
    });
    const refreshAfterSettingsChange = onSettingsDataChanged(() => {
      void checkSchedule();
    });

    return () => {
      controller.abort();
      refreshAfterTaskChange();
      refreshAfterSettingsChange();
    };
  }, [checkSchedule]);

  async function loadReview() {
    checkSequence.current += 1;
    setIsReviewOpen(true);
    setBusyAction('review');
    setError(null);
    setConflictCode(null);
    setConfirmOptionId(null);
    try {
      setProposal(await previewReschedule(true));
    } catch (requestFailure) {
      const detail = requestError(requestFailure);
      setError(detail.message);
      setConflictCode(detail.code);
    } finally {
      setBusyAction(null);
    }
  }

  async function applyOption(optionId: string) {
    if (!proposal) return;
    checkSequence.current += 1;
    setBusyAction('apply');
    setError(null);
    setConflictCode(null);
    suppressNextTaskRefresh.current = true;
    try {
      setProposal(await applyReschedule(proposal.id, optionId));
      setConfirmOptionId(null);
      setIsReviewOpen(false);
    } catch (requestFailure) {
      const detail = requestError(requestFailure);
      setError(detail.message);
      setConflictCode(detail.code);
    } finally {
      suppressNextTaskRefresh.current = false;
      setBusyAction(null);
    }
  }

  async function undoAppliedProposal() {
    if (!proposal) return;
    checkSequence.current += 1;
    setBusyAction('undo');
    setError(null);
    setConflictCode(null);
    suppressNextTaskRefresh.current = true;
    try {
      setProposal(await undoReschedule(proposal.id));
    } catch (requestFailure) {
      const detail = requestError(requestFailure);
      setError(detail.message);
      setConflictCode(detail.code);
    } finally {
      suppressNextTaskRefresh.current = false;
      setBusyAction(null);
    }
  }

  if (busyAction === 'check' && !proposal && !error) return null;

  if (!proposal && error) {
    return (
      <section
        className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel"
        role="status"
      >
        <h2 className="mb-4 text-xl font-semibold text-dashboard-text">Scheduling changes</h2>
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--orange-soft)] text-[var(--orange-light)]">
            <ScheduleStatusMark />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-dashboard-text">
              Schedule check unavailable
            </h3>
            <p className="mt-1 text-sm text-dashboard-muted">{error}</p>
            <button
              className="mt-3 text-sm font-medium text-dashboard-accent hover:underline"
              onClick={() => void loadReview()}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!proposal) return null;

  const canRegenerate =
    conflictCode === 'STALE_PROPOSAL' ||
    conflictCode === 'STALE_UNDO' ||
    conflictCode === 'EXPIRED_PROPOSAL' ||
    conflictCode === 'LOCKED_TASK' ||
    conflictCode === 'INVALID_OPTION' ||
    proposal.status === 'expired' ||
    proposal.status === 'superseded';
  return (
    <>
      <section
        className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel"
        role="status"
      >
        <h2 className="mb-4 text-xl font-semibold text-dashboard-text">Scheduling changes</h2>
        <div className="flex items-start gap-4">
          <span
            className={`grid size-14 shrink-0 place-items-center rounded-2xl ${
              proposal.status === 'applied'
                ? 'bg-dashboard-accent-soft text-dashboard-accent'
                : proposal.status === 'undone'
                  ? 'bg-dashboard-raised text-dashboard-muted'
                  : 'bg-[var(--orange-soft)] text-[var(--orange-light)]'
            }`}
          >
            <ScheduleStatusMark />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-dashboard-text">
              {proposal.status === 'applied'
                ? 'Schedule updated'
                : proposal.status === 'undone'
                  ? 'Schedule changes undone'
                  : 'Your schedule needs attention'}
            </h3>
            {proposal.status !== 'preview' ? (
              <p className="mt-1 text-sm text-dashboard-muted">
                {proposal.status === 'applied'
                  ? `${proposal.options.find((option) => option.id === proposal.selected_option_id)?.moved_task_count ?? 0} task schedules were safely updated.${proposal.issues.length ? ` ${proposal.issues.length} still need manual attention.` : ''}`
                  : 'The original task times were restored.'}
              </p>
            ) : null}
            {proposal.status === 'preview' && proposal.context.affected_task_ids.length > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dashboard-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-dashboard-accent"
                  />
                  {proposal.context.affected_task_ids.length}{' '}
                  {proposal.context.affected_task_ids.length === 1
                    ? 'task affected'
                    : 'tasks affected'}
                </span>
                {proposal.issues.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-[var(--orange-light)]"
                    />
                    {proposal.issues.length} need manual attention
                  </span>
                ) : null}
              </p>
            ) : null}
            {error ? <p className="mt-2 text-sm text-[var(--red-light)]">{error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.status === 'applied' ? (
                <button
                  className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border-strong px-4 text-sm font-semibold text-dashboard-text transition hover:border-dashboard-accent/60"
                  disabled={busyAction !== null}
                  onClick={() => void undoAppliedProposal()}
                  type="button"
                >
                  {busyAction === 'undo' ? 'Undoing...' : 'Undo changes'}
                </button>
              ) : null}
              {proposal.status === 'preview' ? (
                <button
                  className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-4 text-sm font-semibold text-dashboard-on-accent shadow-glow transition hover:brightness-110"
                  onClick={() => void loadReview()}
                  type="button"
                >
                  Review options
                </button>
              ) : null}
              {canRegenerate ? (
                <button
                  className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-4 text-sm font-semibold text-dashboard-on-accent"
                  disabled={busyAction !== null}
                  onClick={() => void loadReview()}
                  type="button"
                >
                  Generate fresh options
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isReviewOpen ? (
        <div
          aria-labelledby="reschedule-review-title"
          aria-modal="true"
          className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto bg-dashboard-overlay p-4 backdrop-blur-[5px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && busyAction === null) {
              setIsReviewOpen(false);
              setConfirmOptionId(null);
            }
          }}
          role="dialog"
        >
          <div className="my-6 w-full max-w-4xl rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-5 shadow-modal sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-dashboard-accent-soft text-dashboard-accent sm:size-12">
                  <CalendarClock aria-hidden="true" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-accent">
                    Intelligent rescheduling
                  </p>
                  <h2
                    className="mt-2 text-xl font-semibold text-dashboard-text sm:text-2xl"
                    id="reschedule-review-title"
                  >
                    Review schedule options
                  </h2>
                </div>
              </div>
              <button
                aria-label="Close rescheduling options"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-dashboard-border text-dashboard-muted transition hover:text-dashboard-text"
                disabled={busyAction !== null}
                onClick={() => setIsReviewOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-dashboard-border bg-dashboard-bg/35 px-4 py-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-dashboard-accent" />
              <p className="text-sm leading-6 text-dashboard-muted">
                Times are validated against working hours, deadlines, and locked tasks.
              </p>
            </div>

            {busyAction === 'review' ? (
              <div className="grid min-h-64 place-items-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dashboard-border border-t-dashboard-accent" />
                  <p className="mt-3 text-sm text-dashboard-muted">
                    Generating validated options...
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {proposal.context.changes.length ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--orange-border)] bg-[var(--orange-soft)] p-3">
                    <TriangleAlert aria-hidden="true" className="mr-1 size-4 shrink-0 text-[var(--orange-light)]" />
                    {Array.from(new Set(proposal.context.changes.map((change) => change.code))).map(
                      (code) => (
                        <span
                          className="rounded-[var(--radius-pill)] border border-[var(--orange-border)] bg-[var(--orange-soft)] px-3 py-1 text-xs font-medium text-[var(--orange-light)]"
                          key={code}
                          title={proposal.context.changes
                            .filter((change) => change.code === code)
                            .map((change) => change.reason)
                            .join('\n')}
                        >
                          {changeLabels[code] ?? code}
                        </span>
                      ),
                    )}
                  </div>
                ) : null}

                {proposal.ai_metadata?.source === 'deterministic_fallback' ? (
                  <p className="rounded-lg border border-dashboard-border bg-dashboard-bg/35 px-4 py-3 text-sm text-dashboard-muted">
                    AI explanation is unavailable. Every option below remains deterministically
                    validated.
                  </p>
                ) : null}

                {error ? (
                  <div
                    className="rounded-lg border border-[var(--red-border)] bg-[var(--red-soft)] p-4 text-sm text-[var(--red-light)]"
                    role="alert"
                  >
                    <p>{error}</p>
                    {canRegenerate ? (
                      <button
                        className="mt-3 font-semibold text-dashboard-text underline underline-offset-4"
                        onClick={() => void loadReview()}
                        type="button"
                      >
                        Generate fresh options
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {proposal.options.length && proposal.issues.length ? (
                  <UnresolvedIssues issues={proposal.issues} />
                ) : null}

                {proposal.options.length ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {proposal.options.map((option) => (
                      <OptionCard
                        confirmApply={confirmOptionId === option.id}
                        isApplying={busyAction === 'apply' && confirmOptionId === option.id}
                        key={option.id}
                        onApply={() => setConfirmOptionId(option.id)}
                        onCancel={() => setConfirmOptionId(null)}
                        onConfirm={() => void applyOption(option.id)}
                        option={option}
                        timezone={proposal.context.timezone}
                      />
                    ))}
                  </div>
                ) : (
                  <NoSolution onRetry={() => void loadReview()} proposal={proposal} />
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function OptionCard({
  confirmApply,
  isApplying,
  onApply,
  onCancel,
  onConfirm,
  option,
  timezone,
}: Readonly<{
  confirmApply: boolean;
  isApplying: boolean;
  onApply: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  option: RescheduleOption;
  timezone: string;
}>) {
  return (
    <article className="flex flex-col rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-bg/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-dashboard-accent">
            Option {option.deterministic_rank}
          </p>
          <h3 className="mt-1 font-semibold text-dashboard-text">{optionLabels[option.style]}</h3>
        </div>
        <span className="rounded-full bg-dashboard-raised px-2.5 py-1 text-[11px] text-dashboard-muted">
          {option.moved_task_count} moved
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {option.moves.map((move) => (
          <div
            className="rounded-lg border border-dashboard-border bg-dashboard-surface/70 p-3"
            key={move.task_id}
          >
            <p className="truncate text-sm font-semibold text-dashboard-text">{move.task_title}</p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-dashboard-subtle">Before</dt>
                <dd className="text-dashboard-muted">
                  {formatDateTime(move.previous_start, timezone)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-dashboard-subtle">After</dt>
                <dd className="font-medium text-dashboard-accent">
                  {formatDateTime(move.proposed_start, timezone)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-dashboard-border pt-4 text-xs text-dashboard-muted">
        <p>{option.total_displacement_minutes} min total displacement</p>
        {option.deterministic_reasons[0] ? (
          <p className="mt-2">{option.deterministic_reasons[0]}</p>
        ) : null}
        {option.explanation ? (
          <p className="mt-3 rounded-lg border border-[var(--purple-border)] bg-[var(--purple-soft)] p-3 leading-5 text-[var(--purple-light)]">
            {option.explanation}
          </p>
        ) : null}
      </div>

      {confirmApply ? (
        <div className="mt-4 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
          <p className="text-xs font-medium text-dashboard-text">
            Apply this option to all listed tasks?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="h-9 flex-1 rounded-lg border border-dashboard-border px-3 text-xs text-dashboard-muted"
              disabled={isApplying}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 flex-1 rounded-lg bg-dashboard-accent px-3 text-xs font-semibold text-dashboard-on-accent"
              disabled={isApplying}
              onClick={onConfirm}
              type="button"
            >
              {isApplying ? 'Applying...' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-4 h-10 rounded-[var(--radius-sm)] border border-dashboard-accent/50 text-sm font-semibold text-dashboard-accent transition hover:bg-dashboard-accent-soft"
          onClick={onApply}
          type="button"
        >
          Choose this option
        </button>
      )}
    </article>
  );
}

function NoSolution({
  onRetry,
  proposal,
}: Readonly<{ onRetry: () => void; proposal: RescheduleProposal }>) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-bg/25">
      <div className="border-b border-[var(--red-border)] bg-[var(--red-soft)] p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="font-semibold text-dashboard-text">No safe automatic option found</h3>
          <p className="mt-1 text-sm leading-6 text-dashboard-muted">
            Review locked tasks, deadlines, or working hours before trying again.
          </p>
        </div>
      </div>
      {proposal.issues.length ? (
        <div className="p-4 sm:p-5">
          <IssueList issues={proposal.issues} />
        </div>
      ) : null}
      <div className="border-t border-dashboard-border px-4 py-4 sm:px-5">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashboard-border-strong bg-dashboard-surface/70 px-4 text-sm font-semibold text-dashboard-text transition hover:border-dashboard-accent/60"
          onClick={onRetry}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4 text-dashboard-accent" />
          Check again
        </button>
      </div>
    </div>
  );
}

function UnresolvedIssues({ issues }: Readonly<{ issues: RescheduleProposal['issues'] }>) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-bg/25">
      <div className="flex items-start gap-3 border-b border-[var(--orange-border)] bg-[var(--orange-soft)] p-4">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--orange-light)]" />
        <div className="min-w-0">
          <h3 className="font-semibold text-dashboard-text">Some tasks need manual attention</h3>
          <p className="mt-1 text-sm leading-6 text-dashboard-muted">
            The options below safely update the feasible tasks without hiding these issues.
          </p>
        </div>
      </div>
      <div className="p-4">
        <IssueList issues={issues} />
      </div>
    </div>
  );
}

function IssueList({ issues }: Readonly<{ issues: RescheduleProposal['issues'] }>) {
  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <li
          className="rounded-lg border border-dashboard-border border-l-2 border-l-[var(--red-border)] bg-dashboard-surface/80 p-4"
          key={`${issue.task_id}-${issue.code}`}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--red-soft)] text-[var(--red-light)]">
              <ClipboardList aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-dashboard-text">{issue.task_title}</p>
              <p className="mt-1.5 break-words text-sm leading-6 text-dashboard-muted [overflow-wrap:anywhere]">
                {issue.reason}
              </p>
              <Link
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-dashboard-border-strong bg-dashboard-bg/60 px-3 text-sm font-semibold text-dashboard-text transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
                href={
                  `/calendar?taskId=${encodeURIComponent(issue.task_id)}${
                    issue.metadata.due_date
                      ? `&date=${encodeURIComponent(issue.metadata.due_date)}`
                      : ''
                  }`
                }
              >
                <CalendarDays aria-hidden="true" className="size-4 text-dashboard-accent" />
                View in calendar
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
