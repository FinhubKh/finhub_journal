import { useState } from 'react';
import { input } from '../../lib/ui';

const iconEye = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const iconEyeOff = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a18.45 18.45 0 01-4.06 5.12M6.12 6.12A18.5 18.5 0 002 12s3.5 7 10 7a10.94 10.94 0 005.91-1.72"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  className = '',
  autoComplete = 'current-password',
  disabled = false,
  id,
  name,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        id={id}
        name={name}
        className={`${input} pr-11`}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-violet-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
        disabled={disabled}
      >
        {visible ? iconEyeOff : iconEye}
      </button>
    </div>
  );
}
