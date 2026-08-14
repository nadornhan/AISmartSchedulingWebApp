import { apiRequest } from './api';
import type {
  TaskDisplayStatusValue,
  TaskPriorityValue,
  TaskSubtaskProgress,
  TaskStatusValue,
} from './tasks';

export type DashboardProgressSummary = {
  completed: number;
  total: number;
  percent: number | null;
};

export type DashboardFocusGoalSummary = {
  completed_minutes: number;
  goal_minutes: number;
  percent: number;
};

export type DashboardProjectSummary = {
  id: string;
  name: string;
  color: string;
};

export type DashboardTaskSummary = {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project: DashboardProjectSummary | null;
  priority: TaskPriorityValue;
  status: TaskDisplayStatusValue;
  stored_status: TaskStatusValue;
  due_date: string | null;
  estimated_duration_minutes: number | null;
  subtask_progress: TaskSubtaskProgress;
  is_overdue: boolean;
};

export type DashboardNextBestTask = {
  task: DashboardTaskSummary;
  reasons: string[];
};

export type DashboardAiRecommendation = {
  id: string | null;
  task: DashboardTaskSummary;
  title: string;
  explanation: string;
  reasons: string[];
  based_on: string[];
  score: number;
  footnote: string;
};

export type DashboardWeeklyActivityPoint = {
  date: string;
  day: string;
  done: number;
  overdue: number;
};

export type DashboardForestSummary = {
  species_name?: string | null;
  display_name?: string | null;
  growth_stage?: string | null;
  growth_stage_label?: string | null;
  current_growth_points?: number;
  next_stage_at?: number | null;
  total_trees_grown?: number;
  needs_plant_selection?: boolean;
  supportive_message?: string;
};

export type DashboardSummary = {
  task_progress: DashboardProgressSummary;
  today_progress: DashboardProgressSummary;
  focus_goal: DashboardFocusGoalSummary;
  current_streak_days: number;
  overdue_count: number;
  ai_recommendation: DashboardAiRecommendation | null;
  next_best_task: DashboardNextBestTask | null;
  quick_wins: DashboardTaskSummary[];
  in_progress: DashboardTaskSummary[];
  weekly_activity: DashboardWeeklyActivityPoint[];
  forest?: DashboardForestSummary | null;
};

export function getDashboardSummary(signal?: AbortSignal) {
  return apiRequest<DashboardSummary>('/dashboard/summary', {
    method: 'GET',
    signal,
  });
}
