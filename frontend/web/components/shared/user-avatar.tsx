'use client';

import { useState } from 'react';
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
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const src = avatarUrl ? resolveAvatarUrl(avatarUrl) : null;

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full border border-dashboard-border-strong [background:var(--avatar-background)] text-sm font-semibold text-[var(--avatar-text)]',
        className,
      )}
    >
      {src && src !== failedAvatarUrl ? (
        <img
          key={src}
          alt=""
          className={cn('h-full w-full object-cover', imageClassName)}
          onError={() => setFailedAvatarUrl(src)}
          onLoad={() => setFailedAvatarUrl(null)}
          src={src}
        />
      ) : (
        initials
      )}
    </span>
  );
}
