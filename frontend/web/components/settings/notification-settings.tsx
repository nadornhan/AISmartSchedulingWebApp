import { SettingsSection } from './settings-section';

export type NotificationSettingsValue = {
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

type NotificationSettingsProps = {
  value: NotificationSettingsValue;
  onChange: (value: NotificationSettingsValue) => void;
  isDisabled?: boolean;
};

const notifications = [
  {
    label: 'Task Reminders',
    description: 'Send reminders before task deadlines',
    key: 'taskReminders',
  },
  {
    label: 'Productivity-Based',
    description: 'Remind during peak focus hours',
    key: 'productivityReminders',
  },
  {
    label: 'Daily Digest',
    description: "Morning summary of today's tasks",
    key: 'dailyDigest',
  },
  {
    label: 'Overdue Task Alerts',
    description: 'Get alerted when tasks pass their deadline',
    key: 'overdueAlerts',
  },
  {
    label: 'Focus Mode Do Not Disturb',
    description: 'Suppress notifications during focus sessions',
    key: 'focusDoNotDisturb',
  },
  {
    label: 'Weekly Progress Report',
    description: 'AI-generated report every Sunday evening',
    key: 'weeklyReport',
  },
] satisfies Array<{
  label: string;
  description: string;
  key: keyof Omit<NotificationSettingsValue, 'channels'>;
}>;

const channels = [
  { label: 'Push', key: 'push' },
  { label: 'Email', key: 'email' },
  { label: 'Desktop', key: 'desktop' },
] satisfies Array<{ label: string; key: keyof NotificationSettingsValue['channels'] }>;

export function NotificationSettings({
  isDisabled = false,
  value,
  onChange,
}: NotificationSettingsProps) {
  function toggleNotification(key: keyof Omit<NotificationSettingsValue, 'channels'>) {
    onChange({ ...value, [key]: !value[key] });
  }

  function toggleChannel(key: keyof NotificationSettingsValue['channels']) {
    onChange({
      ...value,
      channels: {
        ...value.channels,
        [key]: !value.channels[key],
      },
    });
  }

  return (
    <SettingsSection
      eyebrow="Notifications"
      title="Notification Settings"
      description="Choose which reminders and reports should be active."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="divide-y divide-dashboard-border">
          {notifications.map((notification) => (
            <div className="flex items-center justify-between gap-4 py-3" key={notification.key}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-dashboard-text">{notification.label}</p>
                <p className="mt-0.5 text-xs text-dashboard-muted">{notification.description}</p>
              </div>
              <button
                aria-checked={value[notification.key]}
                aria-label={`${notification.label} notifications`}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${
                  value[notification.key]
                    ? 'border-dashboard-accent bg-dashboard-accent'
                    : 'border-dashboard-border bg-[var(--bg-input)]'
                }`}
                disabled={isDisabled}
                onClick={() => toggleNotification(notification.key)}
                role="switch"
                type="button"
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-dashboard-text transition ${
                    value[notification.key] ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-dashboard-muted">
            Channels
          </p>
          <div className="grid gap-3">
            {channels.map((channel) => (
              <button
                aria-checked={value.channels[channel.key]}
                className={`rounded-[var(--radius-sm)] border px-3 py-2 text-center text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${
                  value.channels[channel.key]
                    ? 'border-dashboard-accent/60 bg-dashboard-accent-soft text-dashboard-accent'
                    : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text'
                }`}
                disabled={isDisabled}
                key={channel.label}
                onClick={() => toggleChannel(channel.key)}
                role="switch"
                type="button"
              >
                {channel.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
