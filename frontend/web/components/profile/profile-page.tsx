'use client';

import { useState } from 'react';

import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from '../../lib/auth';
import { useCurrentUser } from '../auth/current-user-provider';
import { SignOutIcon } from '../layout/icons';
import { ProfileSettings, type ProfileSettingsValue } from '../settings/profile-settings';
import { SettingsSection } from '../settings/settings-section';

const roleLabels = {
  admin: 'Admin',
  other: 'Other',
  student: 'Student',
  teacher: 'Teacher',
};

function formatMemberSince(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-AU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function ProfilePage() {
  const { error, isCheckingSession, setUser, signOut, user } = useCurrentUser();
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
      setUser(await uploadCurrentUserAvatar(file));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function deleteAvatar() {
    setIsUploadingAvatar(true);

    try {
      setUser(await deleteCurrentUserAvatar());
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
      {error ? (
        <div
          className="rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-light)] lg:col-span-2"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <ProfileSettings
        isLoading={isCheckingSession && !user}
        isUploadingAvatar={isUploadingAvatar}
        onAvatarDelete={deleteAvatar}
        onAvatarUpload={uploadAvatar}
        value={profile}
      />

      <aside className="grid content-start gap-6">
        <SettingsSection
          description="Your account identity and membership information."
          eyebrow="Account"
          title="Account Details"
        >
          <dl className="grid gap-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-dashboard-border pb-3">
              <dt className="text-dashboard-muted">Role</dt>
              <dd className="font-medium text-dashboard-text">{profile.role || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-dashboard-border pb-3">
              <dt className="text-dashboard-muted">Member since</dt>
              <dd className="font-medium text-dashboard-text">
                {formatMemberSince(user?.created_at)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-dashboard-muted">Status</dt>
              <dd className="inline-flex items-center gap-2 font-medium text-dashboard-accent">
                <span className="h-2 w-2 rounded-full bg-dashboard-accent" />
                {user?.is_active ? 'Active' : 'Inactive'}
              </dd>
            </div>
          </dl>

          <button
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashboard-border-strong bg-[var(--bg-input)] text-sm font-semibold text-dashboard-muted transition hover:border-[var(--red-border)] hover:text-[var(--red-light)]"
            onClick={signOut}
            type="button"
          >
            <SignOutIcon className="h-5 w-5" />
            Sign out
          </button>
        </SettingsSection>
      </aside>
    </div>
  );
}
