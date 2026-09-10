'use client';

import { getApiUrl } from '../../lib/api';

type UserAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function getUserInitials({
  email,
  firstName,
  lastName,
}: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const initials =
    `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`.toUpperCase();

  return initials || email?.trim().slice(0, 2).toUpperCase() || 'U';
}

function resolveAvatarUrl(avatarUrl: string) {
  if (/^https?:\/\//.test(avatarUrl)) {
    return avatarUrl;
  }

  return getApiUrl(avatarUrl);
}

export function UserAvatar({
  avatarUrl,
  className,
  email,
  firstName,
  imageClassName,
  lastName,
}: UserAvatarProps) {
  const initials = getUserInitials({ email, firstName, lastName });

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full border border-dashboard-border-strong bg-gradient-to-br from-dashboard-muted to-dashboard-surface text-sm font-semibold text-dashboard-bg',
        className,
      )}
    >
      {avatarUrl ? (
        <img
          alt=""
          className={cn('h-full w-full object-cover', imageClassName)}
          src={resolveAvatarUrl(avatarUrl)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
