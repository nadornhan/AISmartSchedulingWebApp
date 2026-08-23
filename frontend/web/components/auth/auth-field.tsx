import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
  icon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

export function AuthField({ id, label, icon, ...inputProps }: AuthFieldProps) {
  return (
    <label className="relative block h-[72px] w-full" htmlFor={id}>
      <span className="absolute left-0 top-2.5 text-sm text-[#65737a]">{label}</span>
      <input
        className="chrono-autofill chrono-autofill-auth absolute inset-x-0 bottom-0 h-12 w-full border-0 border-b border-[#ececf2] bg-transparent pr-8 text-sm font-bold text-[#f4f7f6] outline-none placeholder:font-semibold placeholder:text-[#65737a] focus:border-[var(--accent)]"
        id={id}
        {...inputProps}
      />
      {icon ? (
        <span className="pointer-events-none absolute right-0 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-[#f4f7f6] opacity-80">
          {icon}
        </span>
      ) : null}
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
