'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AtSign, ChartLine, ChevronDown, ChevronRight, LogOut, TreePine, UserRound, type LucideIcon } from 'lucide-react';

import { updateCurrentUserProfile } from '../../lib/auth';
import { useCurrentUser } from '../auth/current-user-provider';
import { useUiPreferences } from '../layout/ui-preferences-provider';
import { UserAvatar } from '../shared/user-avatar';
import { emitSettingsDataChanged } from '../../lib/data-events';
import {
  getSettings,
  settingsFormValueToUpdateInput,
  settingsResponseToFormValue,
  updateSettings,
  type UserSettingsResponse,
} from '../../lib/settings';
import { AppearanceSettings } from '../settings/appearance-settings';
import { NotificationSettings, type NotificationSettingsValue } from '../settings/notification-settings';
import { SchedulingWeights, type SchedulingWeightsValue } from '../settings/scheduling-weights';
import { WorkPreferences, type WorkPreferencesValue } from '../settings/work-preferences';

type PreferenceSection = 'appearance' | 'notifications' | 'work' | 'scheduling';
type AccountTab = 'account' | PreferenceSection;

const groupClassName = 'divide-y divide-dashboard-border overflow-hidden rounded-2xl border border-dashboard-border bg-dashboard-surface shadow-panel';
const rowClassName = 'flex min-h-14 items-center gap-3 px-4 py-3 text-left transition hover:bg-dashboard-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dashboard-accent';

function AccountLink({ href, icon: Icon, label, value }: {
  href: string;
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  return (
    <Link className={rowClassName} href={href}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-muted" />
      <span className="min-w-0 flex-1 text-sm text-dashboard-text">{label}</span>
      <span className="max-w-[56%] truncate text-right text-sm text-dashboard-muted">{value ?? 'Open'}</span>
      <span className="grid h-6 w-4 shrink-0 place-items-center text-dashboard-subtle">
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </span>
    </Link>
  );
}

export function AccountPage() {
  const { setUser, user, signOut } = useCurrentUser();
  const { theme } = useUiPreferences();
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Your account';
  const [isEditingName, setIsEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTab>('account');
  const [workPreferences, setWorkPreferences] = useState<WorkPreferencesValue | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettingsValue | null>(null);
  const [schedulingWeights, setSchedulingWeights] = useState<SchedulingWeightsValue | null>(null);
  const [savedSettings, setSavedSettings] = useState<UserSettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const settingsLoaded = Boolean(workPreferences && notifications && schedulingWeights);
  const isDirty = useMemo(() => {
    if (!savedSettings || !workPreferences || !notifications || !schedulingWeights) return false;
    const savedValue = settingsResponseToFormValue(savedSettings);
    return JSON.stringify(savedValue.workPreferences) !== JSON.stringify(workPreferences)
      || JSON.stringify(savedValue.notifications) !== JSON.stringify(notifications)
      || JSON.stringify(savedValue.schedulingWeights) !== JSON.stringify(schedulingWeights);
  }, [notifications, savedSettings, schedulingWeights, workPreferences]);

  useEffect(() => {
    setFirstName(user?.first_name ?? '');
    setLastName(user?.last_name ?? '');
  }, [user?.first_name, user?.last_name]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setIsLoadingSettings(true);
    setSettingsError(null);
    void getSettings({ signal: controller.signal }).then((settings) => {
      if (controller.signal.aborted) return;
      const value = settingsResponseToFormValue(settings);
      setSavedSettings(settings);
      setWorkPreferences(value.workPreferences);
      setNotifications(value.notifications);
      setSchedulingWeights(value.schedulingWeights);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setSettingsError(error instanceof Error ? error.message : 'Unable to load preferences. Please try again.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoadingSettings(false);
    });
    return () => controller.abort();
  }, [user]);

  async function savePreferences() {
    if (!workPreferences || !notifications || !schedulingWeights) return;
    setIsSavingSettings(true);
    setSettingsError(null);
    setSaveMessage(null);
    try {
      const update = settingsFormValueToUpdateInput({ workPreferences, notifications, schedulingWeights });
      if (workPreferences.timezone === savedSettings?.work_pattern.timezone) delete update.work_pattern?.timezone;
      const settings = await updateSettings(update);
      const value = settingsResponseToFormValue(settings);
      setSavedSettings(settings);
      setWorkPreferences(value.workPreferences);
      setNotifications(value.notifications);
      setSchedulingWeights(value.schedulingWeights);
      setSaveMessage('Preferences saved.');
      emitSettingsDataChanged();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to save preferences. Please try again.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  function accountTabButton(tab: AccountTab, label: string, className: string) {
    const isActive = activeTab === tab;
    return (
      <button
        aria-pressed={isActive}
        className={`${className} ${isActive ? 'border-dashboard-accent/50 bg-dashboard-accent-soft text-dashboard-accent' : 'border-dashboard-border bg-dashboard-surface text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-text'}`}
        onClick={() => setActiveTab(tab)}
        type="button"
      >
        {label}
      </button>
    );
  }

  function renderPreferencePanel(section: PreferenceSection) {
    return (
      <section aria-label={`${section} preferences`} className="space-y-4 rounded-2xl border border-dashboard-border bg-dashboard-surface p-4 shadow-panel">
            {section === 'appearance' ? <AppearanceSettings /> : null}
            {isLoadingSettings ? <p className="rounded-xl border border-dashboard-border bg-dashboard-surface p-4 text-sm text-dashboard-muted" role="status">Loading preferences…</p> : null}
            {section === 'notifications' && notifications ? <NotificationSettings isDisabled={isSavingSettings} onChange={setNotifications} value={notifications} /> : null}
            {section === 'work' && workPreferences ? <WorkPreferences isDisabled={isSavingSettings} onChange={setWorkPreferences} value={workPreferences} /> : null}
            {section === 'scheduling' && schedulingWeights ? <SchedulingWeights isDisabled={isSavingSettings} onChange={setSchedulingWeights} value={schedulingWeights} /> : null}
            {settingsError ? <p className="rounded-xl border border-[var(--red-border)] bg-[var(--red-soft)] p-3 text-sm text-[var(--red-light)]" role="alert">{settingsError}</p> : null}
            {saveMessage ? <p className="rounded-xl border border-dashboard-accent/50 bg-dashboard-accent-soft p-3 text-sm text-dashboard-accent" role="status">{saveMessage}</p> : null}
            {section !== 'appearance' && settingsLoaded ? (
              <button
                className="h-11 w-full rounded-xl bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-dashboard-on-accent shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingSettings || !isDirty}
                onClick={() => void savePreferences()}
                type="button"
              >
                {isSavingSettings ? 'Saving…' : isDirty ? 'Save preferences' : 'Preferences saved'}
              </button>
            ) : null}
      </section>
    );
  }

  async function saveName() {
    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    if (!nextFirstName || !nextLastName) {
      setProfileError('Enter both your first and last name.');
      return;
    }
    setIsSavingName(true);
    setProfileError(null);
    try {
      setUser(await updateCurrentUserProfile({ firstName: nextFirstName, lastName: nextLastName }));
      setIsEditingName(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update your name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  }

  return (
    <div className="grid w-full gap-5 pb-2 md:grid-cols-[180px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Account settings" className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {accountTabButton('account', 'Account', 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium')}
        {accountTabButton('notifications', 'Notifications', 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium')}
        {accountTabButton('appearance', 'Theme', 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium')}
        {accountTabButton('work', 'Work preferences', 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium')}
        {accountTabButton('scheduling', 'Scheduling priorities', 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium')}
      </nav>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--red-border)] bg-[var(--red-soft)] px-4 text-sm font-semibold text-[var(--red-light)] transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red-light)] md:hidden"
        onClick={signOut}
        type="button"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Log out
      </button>

      <aside className="hidden md:block">
        <nav aria-label="Account settings" className="sticky top-28 rounded-2xl border border-dashboard-border bg-dashboard-surface p-3 shadow-panel">
          {accountTabButton('account', 'Account', 'block w-full rounded-xl px-3 py-2.5 text-left text-sm')}
          {accountTabButton('notifications', 'Notifications', 'mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm')}
          {accountTabButton('appearance', 'Theme', 'mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm')}
          {accountTabButton('work', 'Work preferences', 'mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm')}
          {accountTabButton('scheduling', 'Scheduling priorities', 'mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm')}
        </nav>
        <button
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--red-border)] bg-[var(--red-soft)] px-4 text-sm font-semibold text-[var(--red-light)] transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red-light)]"
          onClick={signOut}
          type="button"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Log out
        </button>
      </aside>

      <div className="min-w-0 space-y-6 md:-mt-7">
        <h1 className="sr-only">{activeTab === 'account' ? 'Account' : activeTab === 'appearance' ? 'Theme' : activeTab === 'work' ? 'Work preferences' : activeTab === 'scheduling' ? 'Scheduling priorities' : 'Notifications'}</h1>
        {activeTab === 'account' ? (
        <section aria-labelledby="account-profile-heading" className="rounded-2xl border border-dashboard-border bg-dashboard-surface p-5 shadow-panel" id="account-profile">
          <h2 className="sr-only" id="account-profile-heading">My Profile</h2>
          <Link
            aria-label="View your profile"
            className="flex min-w-0 items-center gap-4 rounded-xl transition hover:bg-dashboard-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dashboard-accent"
            href="/profile"
          >
            <UserAvatar
              avatarUrl={user?.avatar_url}
              className="h-16 w-16 shrink-0 border-2 border-dashboard-border text-xl shadow-panel"
              email={user?.email}
              firstName={user?.first_name}
              lastName={user?.last_name}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-dashboard-text">{name}</span>
              <span className="mt-1 block truncate text-sm text-dashboard-muted">{user?.email}</span>
            </span>
            <span className="shrink-0 rounded-full border border-dashboard-border px-4 py-2 text-sm font-medium text-dashboard-muted">View profile</span>
          </Link>
        </section>
        ) : null}

        {activeTab === 'account' ? (
        <section aria-labelledby="account-private-information" className="rounded-2xl border border-dashboard-border bg-dashboard-surface p-5 shadow-panel">
          <h2 className="mb-4 text-base font-semibold text-dashboard-text" id="account-private-information">Private information</h2>
        <div className={groupClassName}>
          <button
            aria-expanded={isEditingName}
            className={`${rowClassName} w-full`}
            onClick={() => {
              setProfileError(null);
              setIsEditingName((current) => !current);
              setFirstName(user?.first_name ?? '');
              setLastName(user?.last_name ?? '');
            }}
            type="button"
          >
            <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-muted" />
            <span className="min-w-0 flex-1 text-left text-sm text-dashboard-text">Name</span>
            <span className="max-w-[56%] truncate text-right text-sm text-dashboard-muted">{name}</span>
            <span className="grid h-6 w-4 shrink-0 place-items-center text-dashboard-subtle">
              {isEditingName ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
            </span>
          </button>
          <div className={`${rowClassName} cursor-default hover:bg-transparent`}>
            <AtSign aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-muted" />
            <span className="min-w-0 flex-1 text-sm text-dashboard-text">Email</span>
            <span className="max-w-[65%] truncate text-right text-sm text-dashboard-muted">{user?.email ?? '—'}</span>
          </div>
        </div>
        {isEditingName ? (
          <form
            className="mt-4 space-y-3 rounded-2xl border border-dashboard-border bg-dashboard-raised p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium text-dashboard-text">
              First name
              <input autoComplete="given-name" className="h-11 rounded-xl border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none focus:border-dashboard-accent" disabled={isSavingName} maxLength={100} onChange={(event) => setFirstName(event.target.value)} required value={firstName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-dashboard-text">
              Last name
              <input autoComplete="family-name" className="h-11 rounded-xl border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none focus:border-dashboard-accent" disabled={isSavingName} maxLength={100} onChange={(event) => setLastName(event.target.value)} required value={lastName} />
            </label>
            {profileError ? <p className="text-sm text-[var(--red-light)]" role="alert">{profileError}</p> : null}
            <div className="flex gap-2">
              <button className="h-10 flex-1 rounded-xl border border-dashboard-border px-3 text-sm font-medium text-dashboard-muted disabled:opacity-60" disabled={isSavingName} onClick={() => setIsEditingName(false)} type="button">Cancel</button>
              <button className="h-10 flex-1 rounded-xl bg-dashboard-accent px-3 text-sm font-semibold text-dashboard-on-accent disabled:opacity-60" disabled={isSavingName || !firstName.trim() || !lastName.trim()} type="submit">{isSavingName ? 'Saving…' : 'Save name'}</button>
            </div>
          </form>
        ) : null}
      </section>
        ) : null}

        {activeTab === 'account' ? (
      <section aria-labelledby="account-progress" className="rounded-2xl border border-dashboard-border bg-dashboard-surface p-5 shadow-panel">
        <h2 className="mb-4 text-base font-semibold text-dashboard-text" id="account-progress">Your progress</h2>
        <div className={groupClassName}>
          <AccountLink href="/analytics" icon={ChartLine} label="AI Insights" value="View insights" />
          <AccountLink href="/gamification" icon={TreePine} label="Personal Forest" value="View forest" />
        </div>
      </section>
        ) : null}

        {activeTab !== 'account' ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-dashboard-text">{activeTab === 'appearance' ? `Theme · ${theme === 'light' ? 'Light' : 'Dark'}` : activeTab === 'work' ? 'Work preferences' : activeTab === 'scheduling' ? 'Scheduling priorities' : 'Notifications'}</h2>
            {renderPreferencePanel(activeTab)}
          </section>
        ) : null}

      </div>
    </div>
  );
}
