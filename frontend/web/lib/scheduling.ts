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

export type SchedulingPlan = {
  recommendation: AiRecommendation | null;
  schedule: ScheduleSuggestion[];
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

export function createFocusSession(input: {
  task_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  completed?: boolean;
}) {
  return apiRequest('/scheduling/focus-sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
