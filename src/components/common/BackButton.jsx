import { btnGhost } from '../../lib/ui';

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5L5.5 8L10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BackButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`${btnGhost} inline-flex items-center gap-1.5 px-2 text-zinc-500 ${className}`.trim()}
      onClick={onClick}
    >
      <BackArrow />
      Back
    </button>
  );
}
