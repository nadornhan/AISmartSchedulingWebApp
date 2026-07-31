'use client';

import { useState } from 'react';

import { AccountActions } from './account-actions';
import {
  NotificationSettings,
  type NotificationSettingsValue,
} from './notification-settings';
import { ProfileSettings, type ProfileSettingsValue } from './profile-settings';
import { SchedulingWeights, type SchedulingWeightsValue } from './scheduling-weights';
import { WorkPreferences, type WorkPreferencesValue } from './work-preferences';

const initialProfile: ProfileSettingsValue = {
  firstName: 'Alex',
  lastName: 'Johnson',
  email: 'alex@example.com',
  role: 'Student · CSIT321',
};

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

export function SettingsPage() {
  const [profile, setProfile] = useState(initialProfile);
  const [workPreferences, setWorkPreferences] = useState(initialWorkPreferences);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [schedulingWeights, setSchedulingWeights] = useState(initialSchedulingWeights);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-6">
          <ProfileSettings onChange={setProfile} value={profile} />
          <WorkPreferences onChange={setWorkPreferences} value={workPreferences} />
          <NotificationSettings onChange={setNotifications} value={notifications} />
        </div>
        <aside className="grid content-start gap-6">
          <SchedulingWeights onChange={setSchedulingWeights} value={schedulingWeights} />
          <AccountActions />
        </aside>
      </div>
    </div>
  );
}
