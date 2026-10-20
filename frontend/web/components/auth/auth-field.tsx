import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
  icon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

export function AuthField({ id, label, icon, ...inputProps }: AuthFieldProps) {
  return (
    <label className="grid w-full gap-2 text-xs font-semibold text-dashboard-muted" htmlFor={id}>
      <span>{label}</span>
      <span className="relative flex h-12 items-center rounded-xl border border-dashboard-border bg-[var(--bg-input)] transition focus-within:border-dashboard-accent focus-within:ring-2 focus-within:ring-dashboard-accent/15">
        {icon ? (
          <span className="pointer-events-none absolute left-4 flex size-5 items-center justify-center text-dashboard-muted">
            {icon}
          </span>
        ) : null}
        <input
          className={`chrono-autofill chrono-autofill-auth h-full w-full rounded-xl border-0 bg-transparent pr-4 text-sm font-medium text-dashboard-text outline-none placeholder:font-normal placeholder:text-dashboard-muted ${icon ? 'pl-11' : 'pl-4'}`}
          id={id}
          {...inputProps}
        />
      </span>
    </label>
  );
}

export function UserIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EmailIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 0V7a2 2 0 1 1 4 0v2h-4Z"
        fill="currentColor"
      />
    </svg>
  );
}
