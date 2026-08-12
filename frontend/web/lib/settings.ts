import { apiRequest } from './api';

export type WorkPatternSettings = {
  work_start: string;
  work_end: string;
  pomodoro_minutes: number;
};

export type AiSchedulingSettings = {
  ai_assistant_enabled: boolean;
  ai_deadline_urgency_weight: number;
  ai_priority_weight: number;
  ai_estimated_duration_weight: number;
};

export type NotificationPreferences = {
  notify_task_reminders: boolean;
  notify_productivity_reminders: boolean;
  notify_daily_digest: boolean;
  notify_overdue_alerts: boolean;
  notify_focus_do_not_disturb: boolean;
  notify_weekly_report: boolean;
};

export type ChannelPreferences = {
  channel_desktop: boolean;
  channel_push: boolean;
  channel_email: boolean;
};

export type UserSettingsResponse = {
  id: string;
  user_id: string;
  work_pattern: WorkPatternSettings;
  ai_scheduling: AiSchedulingSettings;
  notifications: NotificationPreferences;
  channels: ChannelPreferences;
  created_at: string;
  updated_at: string;
};

export type UserSettingsUpdate = {
  work_pattern?: Partial<WorkPatternSettings>;
  ai_scheduling?: Partial<AiSchedulingSettings>;
  notifications?: Partial<NotificationPreferences>;
  channels?: Partial<ChannelPreferences>;
};

export type SettingsWorkPreferencesValue = {
  workStart: string;
  workEnd: string;
  pomodoroMinutes: number;
};

export type SettingsNotificationValue = {
  taskReminders: boolean;
  productivityReminders: boolean;
  dailyDigest: boolean;
  overdueAlerts: boolean;
  focusDoNotDisturb: boolean;
  weeklyReport: boolean;
  channels: {
    push: boolean;
    email: boolean;
    desktop: boolean;
  };
};

export type SettingsSchedulingWeightsValue = {
  aiAssistantEnabled: boolean;
  deadlineUrgency: number;
  priorityLevel: number;
  estimatedDuration: number;
};

export type SettingsFormValue = {
  workPreferences: SettingsWorkPreferencesValue;
  notifications: SettingsNotificationValue;
  schedulingWeights: SettingsSchedulingWeightsValue;
};

export type AiSchedulingConfig = {
  workStart: string;
  workEnd: string;
  isEnabled: boolean;
  weights: {
    deadlineUrgency: number;
    priority: number;
    estimatedDuration: number;
  };
};

export type FocusDurationInput = {
  estimated_duration_minutes?: number | null;
};

// #76: settings are persisted through FastAPI/PostgreSQL, not local-only state.
export const SETTINGS_DATA_SOURCE = 'fastapi-postgresql' as const;

type RequestOptions = {
  signal?: AbortSignal;
};

export function getSettings(options: RequestOptions = {}) {
  return apiRequest<UserSettingsResponse>('/settings', {
    signal: options.signal,
  });
}

export function updateSettings(input: UserSettingsUpdate, options: RequestOptions = {}) {
  return apiRequest<UserSettingsResponse>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
    signal: options.signal,
  });
}

export function settingsResponseToFormValue(settings: UserSettingsResponse): SettingsFormValue {
  return {
    workPreferences: {
      workStart: settings.work_pattern.work_start,
      workEnd: settings.work_pattern.work_end,
      pomodoroMinutes: settings.work_pattern.pomodoro_minutes,
    },
    notifications: {
      taskReminders: settings.notifications.notify_task_reminders,
      productivityReminders: settings.notifications.notify_productivity_reminders,
      dailyDigest: settings.notifications.notify_daily_digest,
      overdueAlerts: settings.notifications.notify_overdue_alerts,
      focusDoNotDisturb: settings.notifications.notify_focus_do_not_disturb,
      weeklyReport: settings.notifications.notify_weekly_report,
      channels: {
        push: settings.channels.channel_push,
        email: settings.channels.channel_email,
        desktop: settings.channels.channel_desktop,
      },
    },
    schedulingWeights: {
      aiAssistantEnabled: settings.ai_scheduling.ai_assistant_enabled,
      deadlineUrgency: settings.ai_scheduling.ai_deadline_urgency_weight,
      priorityLevel: settings.ai_scheduling.ai_priority_weight,
      estimatedDuration: settings.ai_scheduling.ai_estimated_duration_weight,
    },
  };
}

export function settingsFormValueToUpdateInput(value: SettingsFormValue): UserSettingsUpdate {
  return {
    work_pattern: {
      work_start: value.workPreferences.workStart,
      work_end: value.workPreferences.workEnd,
      pomodoro_minutes: value.workPreferences.pomodoroMinutes,
    },
    ai_scheduling: {
      ai_assistant_enabled: value.schedulingWeights.aiAssistantEnabled,
      ai_deadline_urgency_weight: value.schedulingWeights.deadlineUrgency,
      ai_priority_weight: value.schedulingWeights.priorityLevel,
      ai_estimated_duration_weight: value.schedulingWeights.estimatedDuration,
    },
    notifications: {
      notify_task_reminders: value.notifications.taskReminders,
      notify_productivity_reminders: value.notifications.productivityReminders,
      notify_daily_digest: value.notifications.dailyDigest,
      notify_overdue_alerts: value.notifications.overdueAlerts,
      notify_focus_do_not_disturb: value.notifications.focusDoNotDisturb,
      notify_weekly_report: value.notifications.weeklyReport,
    },
    channels: {
      channel_push: value.notifications.channels.push,
      channel_email: value.notifications.channels.email,
      channel_desktop: value.notifications.channels.desktop,
    },
  };
}

export function getFocusDefaultMinutes(settings: UserSettingsResponse): number {
  return settings.work_pattern.pomodoro_minutes;
}

// #75: Focus defaults to pomodoro_minutes; task estimates override when present.
export function getFocusDurationMinutes(
  settings: UserSettingsResponse,
  task: FocusDurationInput | null | undefined,
): number {
  return task?.estimated_duration_minutes ?? getFocusDefaultMinutes(settings);
}

// #74: AI scheduling consumes work hours, enabled flag, and scoring weights.
export function getAiSchedulingConfig(settings: UserSettingsResponse): AiSchedulingConfig {
  return {
    workStart: settings.work_pattern.work_start,
    workEnd: settings.work_pattern.work_end,
    isEnabled: settings.ai_scheduling.ai_assistant_enabled,
    weights: {
      deadlineUrgency: settings.ai_scheduling.ai_deadline_urgency_weight,
      priority: settings.ai_scheduling.ai_priority_weight,
      estimatedDuration: settings.ai_scheduling.ai_estimated_duration_weight,
    },
  };
}
