import { apiRequest } from './api';

export type InsightTrendPoint = {
  date: string;
  completed_count: number;
};

export type InsightRecommendation = {
  id: string;
  category: 'deep_focus' | 'consistency' | 'breaks';
  title: string;
  description: string;
  cta_label: string;
};

export type InsightsSummary = {
  user_first_name: string;
  greeting: string;
  weekly_summary_text: string;
  tasks_completed_this_week: number;
  tasks_completed_last_week: number;
  week_over_week_change_percent: number | null;
  estimated_work_minutes_this_week: number;
  estimated_work_time_label: string;
  goal_progress_percent: number;
  current_streak_days: number;
  trend: InsightTrendPoint[];
  recommendations: InsightRecommendation[];
  motivational_quote: string;
  footer_message: string;
};

export function getInsightsSummary(signal?: AbortSignal) {
  return apiRequest<InsightsSummary>('/analytics/insights', {
    method: 'GET',
    signal,
  });
}
