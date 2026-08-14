import { Link } from 'react-router-dom';

const LOGO_SRC = '/image/logo.png';

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
};

/**
 * FinHubKH brand mark from public/image/logo.png
 * Logo art sits on a dark field — keep rounded frame so it reads as a badge in light UI.
 */
export function BrandLogo({
  size = 'md',
  showWordmark = true,
  wordmark = 'FinhubKH',
  tagline = 'Journal',
  to = '/',
  className = '',
  imgClassName = '',
  tone = 'default',
  as = 'link',
}) {
  const onDark = tone === 'onDark';
  const img = (
    <img
      src={LOGO_SRC}
      alt="FinhubKH"
      className={`${SIZES[size] || SIZES.md} shrink-0 rounded-xl object-cover shadow-sm ring-1 ${
        onDark ? 'ring-white/20' : 'ring-black/10 dark:ring-white/10'
      } ${imgClassName}`}
      width={size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'sm' ? 28 : 36}
      height={size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'sm' ? 28 : 36}
      decoding="async"
    />
  );

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {img}
      {showWordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={`truncate text-sm font-bold tracking-tight ${
              onDark ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {wordmark}
          </span>
          {tagline ? (
            <span
              className={`mt-0.5 text-[10px] font-medium uppercase tracking-widest ${
                onDark ? 'text-violet-200' : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (as === 'div' || !to) return content;

  return (
    <Link to={to} className="inline-flex min-w-0 overflow-hidden no-underline" aria-label="FinhubKH Journal home">
      {content}
    </Link>
  );
}

export default BrandLogo;
