'use client';

import { useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from '../../lib/auth';
import { emitSettingsDataChanged } from '../../lib/data-events';
import {
  getBrowserTimezone,
  getSettings,
  settingsFormValueToUpdateInput,
  settingsResponseToFormValue,
  updateSettings,
  type UserSettingsResponse,
} from '../../lib/settings';
import { AccountActions } from './account-actions';
import { NotificationSettings, type NotificationSettingsValue } from './notification-settings';
import { ProfileSettings, type ProfileSettingsValue } from './profile-settings';
import { SchedulingWeights, type SchedulingWeightsValue } from './scheduling-weights';
import { WorkPreferences, type WorkPreferencesValue } from './work-preferences';

const roleLabels = {
  admin: 'Admin',
  other: 'Other',
  student: 'Student',
  teacher: 'Teacher',
};

export function SettingsPage() {
  const { error, isCheckingSession, setUser, user } = useCurrentUser();
  const [workPreferences, setWorkPreferences] = useState<WorkPreferencesValue | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettingsValue | null>(null);
  const [schedulingWeights, setSchedulingWeights] = useState<SchedulingWeightsValue | null>(null);
  const [savedSettings, setSavedSettings] = useState<UserSettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const profile: ProfileSettingsValue = {
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    email: user?.email ?? '',
    role: user ? roleLabels[user.role] : '',
    avatarUrl: user?.avatar_url ?? null,
  };
  const settingsLoaded = Boolean(workPreferences && notifications && schedulingWeights);
  const isDirty = useMemo(() => {
    if (!savedSettings || !workPreferences || !notifications || !schedulingWeights) {
      return false;
    }

    const savedFormValue = settingsResponseToFormValue(savedSettings);

    return (
      JSON.stringify(savedFormValue.workPreferences) !== JSON.stringify(workPreferences) ||
      JSON.stringify(savedFormValue.notifications) !== JSON.stringify(notifications) ||
      JSON.stringify(savedFormValue.schedulingWeights) !== JSON.stringify(schedulingWeights)
    );
  }, [notifications, savedSettings, schedulingWeights, workPreferences]);

  useEffect(() => {
    if (!user) {
      setWorkPreferences(null);
      setNotifications(null);
      setSchedulingWeights(null);
      setSavedSettings(null);
      return;
    }

    const controller = new AbortController();

    async function loadSettings() {
      setWorkPreferences(null);
      setNotifications(null);
      setSchedulingWeights(null);
      setSavedSettings(null);
      setIsLoadingSettings(true);
      setSettingsError(null);
      setSaveMessage(null);

      try {
        const settings = await getSettings({ signal: controller.signal });
        const formValue = settingsResponseToFormValue(settings);
        const browserTimezone = getBrowserTimezone();
        if (settings.work_pattern.timezone === 'UTC' && browserTimezone !== 'UTC') {
          formValue.workPreferences.timezone = browserTimezone;
        }

        setSavedSettings(settings);
        setWorkPreferences(formValue.workPreferences);
        setNotifications(formValue.notifications);
        setSchedulingWeights(formValue.schedulingWeights);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setSettingsError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load settings. Please try again.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      controller.abort();
    };
  }, [user]);

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

  async function saveSettings() {
    if (!workPreferences || !notifications || !schedulingWeights) return;

    setIsSavingSettings(true);
    setSettingsError(null);
    setSaveMessage(null);

    try {
      const settings = await updateSettings(
        settingsFormValueToUpdateInput({
          workPreferences,
          notifications,
          schedulingWeights,
        }),
      );
      const formValue = settingsResponseToFormValue(settings);

      setSavedSettings(settings);
      setWorkPreferences(formValue.workPreferences);
      setNotifications(formValue.notifications);
      setSchedulingWeights(formValue.schedulingWeights);
      setSaveMessage('Settings saved.');
      emitSettingsDataChanged();
    } catch (saveError) {
      setSettingsError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save settings. Please try again.',
      );
    } finally {
      setIsSavingSettings(false);
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
      {settingsError ? (
        <div
          className="rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-light)]"
          role="alert"
        >
          {settingsError}
        </div>
      ) : null}
      {saveMessage ? (
        <div
          className="rounded-[var(--radius-sm)] border border-dashboard-accent/50 bg-dashboard-accent-soft px-4 py-3 text-sm text-dashboard-accent"
          role="status"
        >
          {saveMessage}
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
          {isLoadingSettings || (!settingsLoaded && !settingsError) ? (
            <div
              className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 text-sm text-dashboard-muted shadow-panel"
              role="status"
            >
              Loading settings...
            </div>
          ) : null}
          {workPreferences ? (
            <WorkPreferences
              isDisabled={isSavingSettings}
              onChange={setWorkPreferences}
              value={workPreferences}
            />
          ) : null}
          {notifications ? (
            <NotificationSettings
              isDisabled={isSavingSettings}
              onChange={setNotifications}
              value={notifications}
            />
          ) : null}
        </div>
        <aside className="grid min-w-0 content-start gap-6">
          {schedulingWeights ? (
            <SchedulingWeights
              isDisabled={isSavingSettings}
              onChange={setSchedulingWeights}
              value={schedulingWeights}
            />
          ) : null}
          {settingsLoaded ? (
            <button
              className="h-11 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d] shadow-glow transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              disabled={isSavingSettings || !isDirty}
              onClick={() => void saveSettings()}
              type="button"
            >
              {isSavingSettings ? 'Saving...' : isDirty ? 'Save Settings' : 'Settings Saved'}
            </button>
          ) : null}
          <AccountActions />
        </aside>
      </div>
    </div>
  );
}
