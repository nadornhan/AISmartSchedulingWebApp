'use client';

import { useRouter } from 'next/navigation';

import type { UserResponse } from '../../lib/auth';
import { useCurrentUser } from '../auth/current-user-provider';
import { UserAvatar } from '../shared/user-avatar';
import { SettingsIcon, SignOutIcon } from './icons';

type ProfileMenuProps = {
  onClose: () => void;
  user?: UserResponse | null;
};

function fullName(user?: UserResponse | null) {
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'New User';
}

export function ProfileMenu({ onClose, user }: ProfileMenuProps) {
  const router = useRouter();
  const { signOut } = useCurrentUser();

  function openSettings() {
    onClose();
    router.push('/settings');
  }

  function handleSignOut() {
    onClose();
    signOut();
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-dashboard-border bg-dashboard-surface/65 p-3">
        <UserAvatar
          avatarUrl={user?.avatar_url}
          className="h-11 w-11"
          email={user?.email}
          firstName={user?.first_name}
          lastName={user?.last_name}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-dashboard-text">{fullName(user)}</p>
          <p className="truncate text-xs text-dashboard-muted">{user?.email ?? ''}</p>
        </div>
      </div>

      <button
        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
        onClick={openSettings}
        type="button"
      >
        <SettingsIcon className="h-5 w-5" />
        <span>Settings</span>
      </button>

      <button
        className="flex h-11 w-full items-center gap-3 rounded-lg border-t border-dashboard-border px-3 text-left text-sm font-medium text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
        onClick={handleSignOut}
        type="button"
      >
        <SignOutIcon className="h-5 w-5" />
        <span>Sign out</span>
      </button>
    </div>
  );
}
