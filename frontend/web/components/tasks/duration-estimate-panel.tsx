'use client';

import { useRef, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';

import { ApiError } from '../../lib/api';
import {
  confirmTaskDuration,
  previewTaskDuration,
  type DurationConfirmation,
  type DurationProposal,
} from '../../lib/tasks';

type Props = {
  taskId: string;
  disabled: boolean;
  onApplied: (minutes: number) => void;
  onBusyChange: (busy: boolean) => void;
  onPendingChange: (pending: boolean) => void;
};

const buttonClass =
  'rounded-lg border border-dashboard-border px-3 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50';

export function DurationEstimatePanel({
  taskId,
  disabled,
  onApplied,
  onBusyChange,
  onPendingChange,
}: Readonly<Props>) {
  const [proposal, setProposal] = useState<DurationProposal | null>(null);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Freeze uncertain confirmations: a retry must resend exactly the same decision.
  const [retryRequest, setRetryRequest] = useState<DurationConfirmation | null>(null);
  const requestRunning = useRef(false);

  function begin() {
    if (requestRunning.current) return false;
    requestRunning.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    setMessage(null);
    return true;
  }

  function finish() {
    requestRunning.current = false;
    setBusy(false);
    onBusyChange(false);
  }

  function clearProposal() {
    setProposal(null);
    setRetryRequest(null);
    onPendingChange(false);
  }

  async function preview() {
    if (disabled || !begin()) return;
    try {
      const response = await previewTaskDuration(taskId);
      setProposal(response.proposal);
      setMinutes(String(response.proposal.suggested_duration_minutes));
      onPendingChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not estimate this task.');
    } finally {
      finish();
    }
  }

  async function confirm(action: 'apply' | 'ignored') {
    if (!proposal) return;
    const value = Number(minutes);
    if (
      !retryRequest &&
      action === 'apply' &&
      (!Number.isInteger(value) || value < 1 || value > 10080)
    ) {
      setError('Enter a whole number from 1 to 10,080 minutes.');
      return;
    }
    const request: DurationConfirmation = retryRequest ?? {
      proposal_token: proposal.proposal_token,
      action:
        action === 'ignored'
          ? 'ignored'
          : value === proposal.suggested_duration_minutes
            ? 'accepted'
            : 'changed',
      ...(action === 'apply' && value !== proposal.suggested_duration_minutes
        ? { duration_minutes: value }
        : {}),
    };
    if (!begin()) return;
    try {
      const result = await confirmTaskDuration(taskId, request);
      if (result.applied_duration_minutes !== null) {
        onApplied(result.applied_duration_minutes);
        setMessage(`Saved ${result.applied_duration_minutes} minutes to this task.`);
      } else {
        setMessage('Estimate dismissed. Your saved duration is unchanged.');
      }
      clearProposal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice.');
      if (err instanceof ApiError && [404, 409, 422].includes(err.status)) {
        clearProposal();
      } else {
        setRetryRequest(request);
      }
    } finally {
      finish();
    }
  }

  return (
    <section
      aria-label="Duration estimate"
      className="mt-4 rounded-xl border border-dashboard-border bg-[var(--bg-input)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-dashboard-text">
          <Clock3 size={16} aria-hidden="true" /> Personalized estimate
        </span>
        {!proposal && (
          <button
            type="button"
            className={buttonClass}
            disabled={disabled || busy}
            onClick={preview}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Estimating...
              </span>
            ) : (
              'Estimate time'
            )}
          </button>
        )}
      </div>
      {disabled && (
        <p className="mt-2 text-sm text-dashboard-muted">
          Save your task changes before requesting or applying an estimate.
        </p>
      )}
      {proposal && (
        <div className="mt-3 space-y-3">
          <p className="text-xl font-semibold text-dashboard-text">
            {proposal.suggested_duration_minutes} minutes suggested
          </p>
          <p className="text-sm text-dashboard-muted">
            {proposal.confidence >= 0.7 ? 'High' : proposal.confidence >= 0.45 ? 'Medium' : 'Low'}{' '}
            confidence
            {' · '}
            {proposal.historical_sample_count} historical tasks
            {' · '}
            {proposal.adjustment_factor}× adjustment
          </p>
          <p className="text-sm leading-relaxed text-dashboard-muted">{proposal.explanation}</p>
          <label className="block text-sm text-dashboard-text">
            Minutes to apply
            <input
              aria-label="Minutes to apply"
              type="number"
              min={1}
              max={10080}
              step={1}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              disabled={busy || disabled || retryRequest !== null}
              className="mt-1 block w-full rounded-lg border border-dashboard-border bg-[var(--bg-surface-raised)] p-2 text-dashboard-text"
            />
          </label>
          <p className="text-xs text-dashboard-muted">
            Applying saves the duration immediately. Other task details stay as saved.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={busy || (disabled && !retryRequest)}
              onClick={() => confirm('apply')}
            >
              {busy ? 'Saving...' : retryRequest ? 'Retry saving choice' : 'Apply duration'}
            </button>
            {!retryRequest && (
              <button
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => confirm('ignored')}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--red-light)]">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-dashboard-accent">
          {message}
        </p>
      )}
    </section>
  );
}
