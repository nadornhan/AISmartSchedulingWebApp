import { ApiError, apiRequest } from './api';
import { emitTaskDataChanged } from './data-events';
import type { DashboardTaskSummary } from './dashboard';

export type AiWeightsSnapshot = {
  deadline_urgency: number;
  priority: number;
  estimated_duration: number;
  ai_assistant_enabled: boolean;
  work_start: string;
  work_end: string;
  timezone: string;
  pomodoro_minutes: number;
  daily_work_limit_minutes: number;
};

export type AiRecommendation = {
  id: string;
  task: DashboardTaskSummary | null;
  title: string;
  explanation: string;
  reasons: string[];
  based_on: string[];
  score: number;
  status: string;
  weights: AiWeightsSnapshot;
  generated_at: string;
};

export type ScheduleSuggestion = {
  id: string;
  task_id: string;
  task_title: string;
  project_name: string | null;
  suggested_start: string;
  suggested_end: string;
  explanation: string;
  status: string;
  position: number;
};

export type SchedulingIssueCode =
  | 'NO_WINDOW_BEFORE_DEADLINE'
  | 'NO_CONTIGUOUS_WINDOW_BEFORE_DEADLINE'
  | 'NO_CAPACITY_IN_HORIZON'
  | 'NO_CONTIGUOUS_WINDOW_IN_HORIZON'
  | 'LOCKED_TASK_REQUIRES_MANUAL_ACTION'
  | 'NO_VALID_RESCHEDULE_OPTION'
  | 'DAILY_WORK_LIMIT_REACHED';

export type SchedulingIssue = {
  task_id: string;
  task_title: string;
  code: SchedulingIssueCode;
  severity: 'warning' | 'critical';
  reason: string;
  metadata: {
    fixed_task_id?: string | null;
    required_minutes?: number | null;
    total_available_minutes?: number | null;
    largest_available_block_minutes?: number | null;
    feasible_window_count?: number | null;
    due_date: string | null;
    planning_horizon_end: string | null;
    daily_work_limit_minutes?: number | null;
    scheduled_work_minutes?: number | null;
    local_date?: string | null;
  };
};

export type ReschedulingChangeCode =
  | 'INVALID_SCHEDULE_INTERVAL'
  | 'SCHEDULE_CONFLICT'
  | 'SCHEDULE_DELAYED'
  | 'TASK_OVERRUN'
  | 'DURATION_NO_LONGER_FITS'
  | 'OUTSIDE_WORKING_HOURS'
  | 'ENDS_AFTER_DEADLINE'
  | 'CAPACITY_PRESSURE'
  | 'DAILY_WORK_LIMIT_EXCEEDED';

export type RescheduleDetectedChange = {
  code: ReschedulingChangeCode;
  reason: string;
  task_id: string | null;
  related_task_ids: string[];
};

export type RescheduleMove = {
  task_id: string;
  task_title: string;
  previous_start: string | null;
  previous_end: string | null;
  proposed_start: string;
  proposed_end: string;
};

export type RescheduleOption = {
  id: string;
  style: 'minimal_disruption' | 'earlier_completion' | 'best_v7_fit';
  deterministic_rank: number;
  moves: RescheduleMove[];
  preserved_task_ids: string[];
  moved_task_count: number;
  total_displacement_minutes: number;
  completion_at: string;
  deterministic_reasons: string[];
  resolved_change_codes: ReschedulingChangeCode[];
  explanation: string | null;
};

export type RescheduleConflictCode =
  | 'OPTION_NOT_FOUND'
  | 'ALREADY_APPLIED'
  | 'INVALID_PROPOSAL_STATE'
  | 'EXPIRED_PROPOSAL'
  | 'STALE_PROPOSAL'
  | 'LOCKED_TASK'
  | 'INVALID_OPTION'
  | 'STALE_UNDO';

export type RescheduleProposal = {
  id: string;
  status: 'preview' | 'applied' | 'undone' | 'superseded' | 'expired';
  context: {
    timezone: string;
    changes: RescheduleDetectedChange[];
    affected_task_ids: string[];
    fixed_task_ids: string[];
  };
  options: RescheduleOption[];
  issues: SchedulingIssue[];
  selected_option_id: string | null;
  generated_at: string;
  expires_at: string;
  applied_at: string | null;
  undone_at: string | null;
  idempotent: boolean;
  ai_metadata: {
    feature: string;
    prompt_version: string;
    source: 'gemini' | 'fake' | 'deterministic_fallback';
    model: string;
    latency_ms: number;
    fallback_reason: string | null;
  } | null;
};

export type RescheduleConflict = {
  code: RescheduleConflictCode;
  message: string;
};

export type SchedulingPlan = {
  recommendation: AiRecommendation | null;
  schedule: ScheduleSuggestion[];
  issues: SchedulingIssue[];
  generated_at: string;
  footnote: string;
};

export function getSchedulingPlan(signal?: AbortSignal) {
  return apiRequest<SchedulingPlan>('/scheduling/plan', { signal });
}

export function regenerateSchedulingPlan(signal?: AbortSignal) {
  return apiRequest<SchedulingPlan>('/scheduling/plan/regenerate', {
    method: 'POST',
    signal,
  });
}

export function acceptRecommendation(recommendationId: string) {
  return apiRequest<AiRecommendation>(`/scheduling/recommendations/${recommendationId}/accept`, {
    method: 'POST',
  });
}

export function dismissRecommendation(recommendationId: string) {
  return apiRequest<AiRecommendation>(`/scheduling/recommendations/${recommendationId}/dismiss`, {
    method: 'POST',
  });
}

export function acceptSuggestion(suggestionId: string) {
  return apiRequest<ScheduleSuggestion>(`/scheduling/suggestions/${suggestionId}/accept`, {
    method: 'POST',
  });
}

export function dismissSuggestion(suggestionId: string) {
  return apiRequest<ScheduleSuggestion>(`/scheduling/suggestions/${suggestionId}/dismiss`, {
    method: 'POST',
  });
}

export function adjustSuggestion(
  suggestionId: string,
  input: { suggested_start: string; suggested_end: string },
) {
  return apiRequest<ScheduleSuggestion>(`/scheduling/suggestions/${suggestionId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function applySuggestions(suggestionIds?: string[]) {
  const plan = await apiRequest<SchedulingPlan>('/scheduling/suggestions/apply', {
    method: 'POST',
    body: JSON.stringify({
      suggestion_ids: suggestionIds ?? null,
    }),
  });
  emitTaskDataChanged();
  return plan;
}

export function previewReschedule(includeAiExplanations = true, signal?: AbortSignal) {
  return apiRequest<RescheduleProposal>('/scheduling/reschedule/preview', {
    method: 'POST',
    body: JSON.stringify({ include_ai_explanations: includeAiExplanations }),
    signal,
  });
}

export async function applyReschedule(proposalId: string, optionId: string) {
  const proposal = await apiRequest<RescheduleProposal>(
    `/scheduling/reschedule/${proposalId}/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ option_id: optionId }),
    },
  );
  emitTaskDataChanged();
  return proposal;
}

export async function undoReschedule(proposalId: string) {
  const proposal = await apiRequest<RescheduleProposal>(
    `/scheduling/reschedule/${proposalId}/undo`,
    { method: 'POST' },
  );
  emitTaskDataChanged();
  return proposal;
}

export function getRescheduleConflict(error: unknown): RescheduleConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const details = error.details;
  if (!details || typeof details !== 'object' || !('detail' in details)) return null;
  const detail = details.detail;
  if (
    !detail ||
    typeof detail !== 'object' ||
    !('code' in detail) ||
    !('message' in detail) ||
    typeof detail.code !== 'string' ||
    typeof detail.message !== 'string'
  ) {
    return null;
  }
  return detail as RescheduleConflict;
}
