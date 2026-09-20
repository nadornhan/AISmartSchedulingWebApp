import { apiRequest } from './api';
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
  return apiRequest<InsightsSummary>('/analytics/insights', {
    method: 'GET',
    headers: {
      'X-Client-Timezone': getBrowserTimezone(),
    },
    signal,
  });
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
  return apiRequest<WeeklyInsight>('/analytics/weekly-insight', {
    method: 'GET',
    headers: {
      'X-Client-Timezone': getBrowserTimezone(),
    },
    signal,
  });
}
