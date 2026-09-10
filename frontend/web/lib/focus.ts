import { apiRequest } from './api';
import { emitGrowthReward, type RewardFeedback } from './gamification';

export type FocusSessionResponse = {
  id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  completed: boolean;
  growth_reward?: RewardFeedback | null;
};

export function createFocusSession(input: {
  task_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  completed?: boolean;
}) {
  return apiRequest<FocusSessionResponse>('/focus/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((session) => {
    if (session.growth_reward?.awarded) {
      emitGrowthReward(session.growth_reward);
    }
    return session;
  });
}

export type FocusSessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type FocusSessionDetail = {
  id: string;
  task_id: string | null;
  planned_duration_minutes: number;
  actual_duration_seconds: number;
  status: FocusSessionStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  growth_reward?: RewardFeedback | null;
};

export function startFocusSession(input: {
  task_id?: string | null;
  planned_duration_minutes: number;
}) {
  return apiRequest<FocusSessionDetail>('/focus/sessions/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateFocusSession(
  sessionId: string,
  input: { actual_duration_seconds: number; status: 'active' | 'paused' },
) {
  return apiRequest<FocusSessionDetail>(`/focus/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function finishFocusSession(
  sessionId: string,
  actualDurationSeconds: number,
  completed: boolean,
) {
  return apiRequest<FocusSessionDetail>(
    `/focus/sessions/${sessionId}/${completed ? 'complete' : 'cancel'}`,
    {
      method: 'POST',
      body: JSON.stringify({ actual_duration_seconds: actualDurationSeconds }),
    },
  ).then((session) => {
    if (session.growth_reward?.awarded) emitGrowthReward(session.growth_reward);
    return session;
  });
}

export function getActiveFocusSession(signal?: AbortSignal) {
  return apiRequest<FocusSessionDetail | null>('/focus/sessions/active', { signal });
}

export function listFocusSessions(limit = 50, signal?: AbortSignal) {
  return apiRequest<FocusSessionDetail[]>(`/focus/sessions/history?limit=${limit}`, { signal });
}
