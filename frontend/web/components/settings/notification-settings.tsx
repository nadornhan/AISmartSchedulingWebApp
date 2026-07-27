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

export function NotificationSettings({ value, onChange }: NotificationSettingsProps) {
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
        <div className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <div className="flex items-center justify-between gap-4 py-3" key={notification.key}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-950">{notification.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{notification.description}</p>
              </div>
              <button
                aria-checked={value[notification.key]}
                aria-label={`${notification.label} notifications`}
                className={`relative h-6 w-11 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  value[notification.key] ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                onClick={() => toggleNotification(notification.key)}
                role="switch"
                type="button"
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white transition ${
                    value[notification.key] ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase text-slate-500">
            Channels
          </p>
          <div className="grid gap-3">
            {channels.map((channel) => (
              <button
                aria-checked={value.channels[channel.key]}
                className={`rounded-lg border px-3 py-2 text-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  value.channels[channel.key]
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
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
