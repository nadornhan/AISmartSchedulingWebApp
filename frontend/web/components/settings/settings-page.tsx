'use client';

import { useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from '../../lib/auth';
import { AccountActions } from './account-actions';
import { NotificationSettings, type NotificationSettingsValue } from './notification-settings';
import { ProfileSettings, type ProfileSettingsValue } from './profile-settings';
import { SchedulingWeights, type SchedulingWeightsValue } from './scheduling-weights';
import { WorkPreferences, type WorkPreferencesValue } from './work-preferences';

const initialWorkPreferences: WorkPreferencesValue = {
  workStart: '09:00',
  workEnd: '17:00',
  pomodoroMinutes: 25,
};

const initialNotifications: NotificationSettingsValue = {
  taskReminders: true,
  productivityReminders: true,
  dailyDigest: true,
  overdueAlerts: true,
  focusDoNotDisturb: true,
  weeklyReport: false,
  channels: {
    push: true,
    email: true,
    desktop: false,
  },
};

const initialSchedulingWeights: SchedulingWeightsValue = {
  deadlineUrgency: 80,
  priorityLevel: 70,
  estimatedDuration: 50,
};

const roleLabels = {
  admin: 'Admin',
  other: 'Other',
  student: 'Student',
  teacher: 'Teacher',
};

export function SettingsPage() {
  const { error, isCheckingSession, setUser, user } = useCurrentUser();
  const [workPreferences, setWorkPreferences] = useState(initialWorkPreferences);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [schedulingWeights, setSchedulingWeights] = useState(initialSchedulingWeights);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const profile: ProfileSettingsValue = {
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    email: user?.email ?? '',
    role: user ? roleLabels[user.role] : '',
    avatarUrl: user?.avatar_url ?? null,
  };

  async function uploadAvatar(file: File) {
    setIsUploadingAvatar(true);

    try {
      const updatedUser = await uploadCurrentUserAvatar(file);
      setUser(updatedUser);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function deleteAvatar() {
    setIsUploadingAvatar(true);

    try {
      const updatedUser = await deleteCurrentUserAvatar();
      setUser(updatedUser);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      {error ? (
        <div
          className="rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-light)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="grid min-w-0 gap-6">
          <ProfileSettings
            isLoading={isCheckingSession && !user}
            isUploadingAvatar={isUploadingAvatar}
            onAvatarDelete={deleteAvatar}
            onAvatarUpload={uploadAvatar}
            value={profile}
          />
          <WorkPreferences onChange={setWorkPreferences} value={workPreferences} />
          <NotificationSettings onChange={setNotifications} value={notifications} />
        </div>
        <aside className="grid min-w-0 content-start gap-6">
          <SchedulingWeights onChange={setSchedulingWeights} value={schedulingWeights} />
          <AccountActions />
        </aside>
      </div>
    </div>
  );
}
