import { apiRequest } from './api';
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
  | 'NO_CONTIGUOUS_WINDOW_IN_HORIZON';

export type SchedulingIssue = {
  task_id: string;
  task_title: string;
  code: SchedulingIssueCode;
  severity: 'warning' | 'critical';
  reason: string;
  metadata: {
    required_minutes: number;
    total_available_minutes: number;
    largest_available_block_minutes: number;
    feasible_window_count: number;
    due_date: string | null;
    planning_horizon_end: string;
  };
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
  return apiRequest<AiRecommendation>(
    `/scheduling/recommendations/${recommendationId}/accept`,
    { method: 'POST' },
  );
}

export function dismissRecommendation(recommendationId: string) {
  return apiRequest<AiRecommendation>(
    `/scheduling/recommendations/${recommendationId}/dismiss`,
    { method: 'POST' },
  );
}

export function acceptSuggestion(suggestionId: string) {
  return apiRequest<ScheduleSuggestion>(
    `/scheduling/suggestions/${suggestionId}/accept`,
    { method: 'POST' },
  );
}

export function dismissSuggestion(suggestionId: string) {
  return apiRequest<ScheduleSuggestion>(
    `/scheduling/suggestions/${suggestionId}/dismiss`,
    { method: 'POST' },
  );
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
