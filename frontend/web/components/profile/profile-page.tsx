'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AtSign, Camera, LogOut, UserRound } from 'lucide-react';

import { updateCurrentUserProfile, uploadCurrentUserAvatar } from '../../lib/auth';
import { useCurrentUser } from '../auth/current-user-provider';
import { UserAvatar } from '../shared/user-avatar';

function formatMemberSince(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(date);
}

const sectionClassName = 'rounded-2xl border border-dashboard-border bg-dashboard-surface p-5 shadow-panel sm:p-6';
const inputClassName = 'h-11 w-full rounded-xl border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none transition focus:border-dashboard-accent focus:ring-2 focus:ring-dashboard-accent/15 disabled:opacity-60';

export function ProfilePage() {
  const { error, isCheckingSession, setUser, signOut, user } = useCurrentUser();
  const fileInput = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user?.first_name ?? '');
    setLastName(user?.last_name ?? '');
  }, [user?.first_name, user?.last_name]);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingName(true);
    setProfileError(null);
    setSaveMessage(null);
    try {
      setUser(await updateCurrentUserProfile({ firstName, lastName }));
      setSaveMessage('Profile updated.');
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : 'Unable to update your profile. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  }

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploadingAvatar(true);
    setAvatarError(null);
    try {
      setUser(await uploadCurrentUserAvatar(file));
    } catch (uploadError) {
      setAvatarError(uploadError instanceof Error ? uploadError.message : 'Unable to upload your photo. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—';

  return (
    <div className="grid w-full grid-cols-1 gap-6 pb-2 lg:grid-cols-2">
      {error ? <p className="rounded-xl border border-[var(--red-border)] bg-[var(--red-soft)] p-4 text-sm text-[var(--red-light)] lg:col-span-2" role="alert">{error}</p> : null}

      <section aria-labelledby="profile-heading" className={sectionClassName}>
        <h2 className="mb-5 border-b border-dashboard-border pb-3 text-base font-semibold text-dashboard-text" id="profile-heading">My Profile</h2>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <UserAvatar
                avatarUrl={user?.avatar_url}
                className="h-14 w-14 shrink-0 border border-dashboard-border text-base"
                email={user?.email}
                firstName={user?.first_name}
                lastName={user?.last_name}
              />
              <button
                aria-label="Change profile image"
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-dashboard-surface bg-dashboard-accent text-dashboard-on-accent transition hover:bg-dashboard-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isUploadingAvatar || isCheckingSession}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                <Camera aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <input accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile image" className="sr-only" disabled={isUploadingAvatar || isCheckingSession} onChange={(event) => void onAvatarSelected(event)} ref={fileInput} type="file" />
            <span aria-live="polite" className="text-xs text-dashboard-muted">{isUploadingAvatar ? 'Updating…' : null}</span>
          </div>
          {avatarError ? <p className="basis-full text-sm text-[var(--red-light)]" role="alert">{avatarError}</p> : null}
        </div>

        <form className="space-y-4" onSubmit={(event) => void saveName(event)}>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm font-medium text-dashboard-text">
              First name
              <input autoComplete="given-name" className={inputClassName} disabled={isSavingName || isCheckingSession} maxLength={100} onChange={(event) => setFirstName(event.target.value)} required value={firstName} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-dashboard-text">
              Last name
              <input autoComplete="family-name" className={inputClassName} disabled={isSavingName || isCheckingSession} maxLength={100} onChange={(event) => setLastName(event.target.value)} required value={lastName} />
            </label>
          </div>
          {profileError ? <p className="text-sm text-[var(--red-light)]" role="alert">{profileError}</p> : null}
          {saveMessage ? <p className="text-sm text-dashboard-accent" role="status">{saveMessage}</p> : null}
          <button className="h-11 w-full rounded-xl bg-dashboard-accent px-5 text-sm font-semibold text-dashboard-on-accent transition hover:bg-dashboard-accent-strong disabled:cursor-not-allowed disabled:opacity-50" disabled={isSavingName || isCheckingSession || !firstName.trim() || !lastName.trim()} type="submit">{isSavingName ? 'Saving…' : 'Save changes'}</button>
        </form>
      </section>

      <div className="space-y-6">
      <section aria-labelledby="security-heading" className={sectionClassName}>
        <h2 className="mb-4 border-b border-dashboard-border pb-3 text-base font-semibold text-dashboard-text" id="security-heading">Account Security</h2>
        <dl className="divide-y divide-dashboard-border overflow-hidden rounded-xl border border-dashboard-border">
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <AtSign aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-muted" />
            <dt className="flex-1 text-sm font-medium text-dashboard-text">Email</dt>
            <dd className="max-w-[60%] truncate text-right text-sm text-dashboard-muted">{user?.email ?? '—'}</dd>
          </div>
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-dashboard-muted" />
            <dt className="flex-1 text-sm font-medium text-dashboard-text">Account type</dt>
            <dd className="text-right text-sm text-dashboard-muted">{role}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="access-heading" className={sectionClassName}>
        <h2 className="mb-4 border-b border-dashboard-border pb-3 text-base font-semibold text-dashboard-text" id="access-heading">Account Access</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-dashboard-text">Account status</p>
            <p className="mt-1 text-sm text-dashboard-muted">{user?.is_active ? 'Your account is active.' : 'Your account is inactive.'} Member since {formatMemberSince(user?.created_at)}.</p>
          </div>
          <button className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--red-border)] bg-[var(--red-soft)] px-4 text-sm font-semibold text-[var(--red-light)] transition hover:opacity-80" onClick={signOut} type="button">
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Log out
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
