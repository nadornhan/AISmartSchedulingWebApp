import { apiRequest, getSessionKey } from './api';
import { cachedReadWithSignal, peekReadCache } from './read-cache';
import type { SchedulingPlan } from './scheduling';
import { getBrowserTimezone } from './settings';

export type InsightTrendPoint = {
  date: string;
  completed_count: number;
};

export type InsightRecommendation = {
  id: string;
  category: 'deep_focus' | 'consistency' | 'breaks' | 'schedule';
  title: string;
  description: string;
  cta_label: string;
};

export type InsightsSummary = {
  period_start: string;
  period_end: string;
  timezone: string;
  user_first_name: string;
  greeting: string;
  weekly_summary_text: string;
  tasks_completed_this_week: number;
  tasks_completed_last_week: number;
  week_over_week_change_percent: number | null;
  completion_rate_this_week: number;
  unfinished_workload_minutes_this_week: number;
  estimated_work_minutes_this_week: number;
  estimated_work_time_label: string;
  focus_duration_minutes_this_week: number;
  goal_progress_percent: number;
  current_streak_days: number;
  trend: InsightTrendPoint[];
  recommendations: InsightRecommendation[];
  scheduling_plan: SchedulingPlan | null;
  motivational_quote: string;
  footer_message: string;
  footnote: string;
};

export function getInsightsSummary(signal?: AbortSignal) {
  const timezone = getBrowserTimezone();
  return cachedReadWithSignal(
    getSessionKey(),
    'analytics',
    `summary:${timezone}`,
    () =>
      apiRequest<InsightsSummary>('/analytics/insights?include_schedule=false', {
        headers: { 'X-Client-Timezone': timezone },
      }),
    60_000,
    signal,
  );
}

export function getCachedInsightsSummary() {
  return peekReadCache<InsightsSummary>(
    getSessionKey(),
    'analytics',
    `summary:${getBrowserTimezone()}`,
  );
}

export type WeeklyInsight = {
  period_start: string;
  period_end: string;
  narrative: string;
  generated_at: string;
  cached: boolean;
  model: string;
  prompt_version: string;
  metrics: {
    period_start: string;
    period_end: string;
    timezone: string;
    focus_time_attribution: string;
    completion_rate: number;
    completed_task_count: number;
    focus_duration_minutes: number;
    workload_minutes: number;
    current_streak_days: number;
    estimated_minutes: number;
    actual_minutes: number;
    estimate_accuracy_percent: number | null;
    duration_comparison_task_count: number | null;
    duration_comparison_excluded_task_count: number | null;
    productivity_trend: { date: string; completed_count: number; focus_minutes: number }[];
    productive_hours: { hour: number; completed_count: number; focus_minutes: number }[];
  };
};

export function getWeeklyInsight(signal?: AbortSignal) {
  const timezone = getBrowserTimezone();
  return cachedReadWithSignal(
    getSessionKey(),
    'analytics',
    `weekly:${timezone}`,
    () =>
      apiRequest<WeeklyInsight>('/analytics/weekly-insight', {
        headers: { 'X-Client-Timezone': timezone },
      }),
    5 * 60_000,
    signal,
  );
}

export function getCachedWeeklyInsight() {
  return peekReadCache<WeeklyInsight>(
    getSessionKey(),
    'analytics',
    `weekly:${getBrowserTimezone()}`,
  );
}
