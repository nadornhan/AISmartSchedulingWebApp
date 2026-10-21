'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './auth.module.css';

type AuthFieldProps = {
  id: string;
  label: string;
  icon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

export function AuthField({ id, label, icon, ...inputProps }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = inputProps.type === 'password';
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <span className={styles.inputBar}>
        {icon ? <span className={styles.fieldIcon}>{icon}</span> : null}
        <input
          className="chrono-autofill chrono-autofill-auth"
          id={id}
          {...inputProps}
          type={isPassword && visible ? 'text' : inputProps.type}
        />
        {isPassword ? (
          <button
            className={styles.passwordToggle}
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        ) : null}
      </span>
    </div>
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
