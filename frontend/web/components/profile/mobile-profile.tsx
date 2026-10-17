'use client';

import { Camera, LoaderCircle } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { SignOutIcon } from '../layout/icons';
import type { ProfileSettingsValue } from '../settings/profile-settings';
import { UserAvatar } from '../shared/user-avatar';

function DetailRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-5 px-4 py-3.5">
      <dt className="text-sm text-dashboard-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium leading-6 text-dashboard-text [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

export function MobileProfile({
  value,
  memberSince,
  isActive,
  isLoading,
  isUploadingAvatar,
  onAvatarUpload,
  onAvatarDelete,
  onSignOut,
}: Readonly<{
  value: ProfileSettingsValue;
  memberSince: string;
  isActive: boolean;
  isLoading: boolean;
  isUploadingAvatar: boolean;
  onAvatarUpload: (file: File) => Promise<void>;
  onAvatarDelete: () => Promise<void>;
  onSignOut: () => void;
}>) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const displayName = `${value.firstName} ${value.lastName}`.trim() || '—';
  const busy = isLoading || isUploadingAvatar;

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError(null);
    try {
      await onAvatarUpload(file);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Unable to upload photo. Try again.');
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    try {
      await onAvatarDelete();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Unable to remove photo. Try again.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-7 lg:hidden" aria-busy={busy}>
      <div className="flex flex-col items-center pb-2 pt-2">
        <div className="relative">
          <UserAvatar
            avatarUrl={value.avatarUrl}
            className="size-24 border-4 border-dashboard-surface text-3xl shadow-panel"
            email={value.email}
            firstName={value.firstName}
            lastName={value.lastName}
          />
          <button
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-dashboard-bg bg-dashboard-accent text-dashboard-on-accent transition hover:bg-dashboard-accent-strong disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            type="button"
          >
            {isUploadingAvatar ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="Upload profile photo"
          className="sr-only"
          disabled={busy}
          onChange={(event) => void uploadPhoto(event)}
          ref={fileInput}
          type="file"
        />
        <p aria-live="polite" className="mt-4 text-xs text-dashboard-muted">
          {isUploadingAvatar ? 'Updating your photo…' : 'Tap the camera to change your photo'}
        </p>
        {value.avatarUrl ? (
          <button
            className="mt-1 min-h-9 px-3 text-xs font-medium text-dashboard-muted transition hover:text-[var(--red-light)] disabled:opacity-50"
            disabled={busy}
            onClick={() => void removePhoto()}
            type="button"
          >
            Remove photo
          </button>
        ) : null}
      </div>

      {photoError ? (
        <p
          role="alert"
          className="rounded-xl border border-[var(--red-border)] bg-[var(--red-soft)] p-3 text-sm text-[var(--red-light)]"
        >
          {photoError}
        </p>
      ) : null}

      <section aria-labelledby="mobile-personal-information">
        <h2
          id="mobile-personal-information"
          className="mb-3 px-1 text-base font-semibold text-dashboard-text"
        >
          Personal information
        </h2>
        <dl className="divide-y divide-dashboard-border overflow-hidden rounded-2xl border border-dashboard-border bg-dashboard-surface shadow-panel">
          <DetailRow label="Name">{isLoading ? 'Loading…' : displayName}</DetailRow>
          <DetailRow label="Role">{value.role || '—'}</DetailRow>
        </dl>
      </section>

      <section aria-labelledby="mobile-account-details">
        <h2
          id="mobile-account-details"
          className="mb-3 px-1 text-base font-semibold text-dashboard-text"
        >
          Account details
        </h2>
        <dl className="divide-y divide-dashboard-border overflow-hidden rounded-2xl border border-dashboard-border bg-dashboard-surface shadow-panel">
          <DetailRow label="Email">{value.email || '—'}</DetailRow>
          <DetailRow label="Member since">{memberSince}</DetailRow>
          <DetailRow label="Status">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-dashboard-accent' : 'bg-dashboard-muted'}`}
              />
              {isLoading ? 'Loading…' : isActive ? 'Active' : 'Inactive'}
            </span>
          </DetailRow>
        </dl>
      </section>

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--red-border)] bg-[var(--red-soft)] px-4 text-sm font-semibold text-[var(--red-light)] transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red-light)]"
        onClick={onSignOut}
        type="button"
      >
        <SignOutIcon className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
