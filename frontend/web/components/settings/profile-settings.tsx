import { useRef, useState, type ChangeEvent } from 'react';

import { UserAvatar } from '../shared/user-avatar';
import { SettingsSection } from './settings-section';

export type ProfileSettingsValue = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

type ProfileSettingsProps = {
  value: ProfileSettingsValue;
  isLoading?: boolean;
  isUploadingAvatar?: boolean;
  onChange?: (value: ProfileSettingsValue) => void;
  onAvatarUpload?: (file: File) => Promise<void>;
  onAvatarDelete?: () => Promise<void>;
};

export function ProfileSettings({
  isLoading = false,
  isUploadingAvatar = false,
  onAvatarDelete,
  onAvatarUpload,
  onChange,
  value,
}: ProfileSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const displayName = `${value.firstName} ${value.lastName}`.trim() || 'New User';

  function updateField(field: keyof ProfileSettingsValue, nextValue: string) {
    if (!onChange) return;
    onChange({ ...value, [field]: nextValue });
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !onAvatarUpload) return;

    setAvatarError(null);

    try {
      await onAvatarUpload(file);
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Unable to upload avatar. Please try again.',
      );
    }
  }

  return (
    <SettingsSection
      eyebrow="Profile"
      title="Profile Settings"
      description="Keep account details ready for scheduling and reminders."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4 sm:flex-row sm:items-center">
          <UserAvatar
            avatarUrl={value.avatarUrl}
            className="size-14 text-base shadow-glow"
            email={value.email}
            firstName={value.firstName}
            lastName={value.lastName}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-dashboard-text">
              {isLoading ? 'Loading profile...' : displayName}
            </p>
            <p className="text-sm text-dashboard-muted">
              {isLoading ? 'Fetching account details' : value.role}
            </p>
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isLoading || isUploadingAvatar || !onAvatarUpload}
            onChange={(event) => void uploadAvatar(event)}
            ref={fileInputRef}
            type="file"
          />
          <div className="grid gap-2">
            <button
              className="rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 py-2 text-sm font-medium text-dashboard-text transition enabled:hover:border-dashboard-accent/50 enabled:hover:text-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              disabled={isLoading || isUploadingAvatar || !onAvatarUpload}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
            </button>
            <button
              className="rounded-[var(--radius-sm)] border border-dashboard-border bg-transparent px-3 py-2 text-sm font-medium text-dashboard-muted transition enabled:hover:border-[var(--red-border)] enabled:hover:text-[var(--red-light)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              disabled={isLoading || isUploadingAvatar || !value.avatarUrl || !onAvatarDelete}
              onClick={() => {
                setAvatarError(null);
                void onAvatarDelete?.().catch((error) => {
                  setAvatarError(
                    error instanceof Error
                      ? error.message
                      : 'Unable to delete avatar. Please try again.',
                  );
                });
              }}
              type="button"
            >
              Delete Photo
            </button>
          </div>
        </div>

        {avatarError ? (
          <p
            className="rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-light)]"
            role="alert"
          >
            {avatarError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-dashboard-text">
            First name
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              disabled={isLoading}
              onChange={(event) => updateField('firstName', event.target.value)}
              readOnly={!onChange}
              value={value.firstName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-dashboard-text">
            Last name
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              disabled={isLoading}
              onChange={(event) => updateField('lastName', event.target.value)}
              readOnly={!onChange}
              value={value.lastName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-dashboard-text sm:col-span-2">
            Email
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              disabled={isLoading}
              onChange={(event) => updateField('email', event.target.value)}
              readOnly={!onChange}
              type="email"
              value={value.email}
            />
          </label>
        </div>
      </div>
    </SettingsSection>
  );
}
