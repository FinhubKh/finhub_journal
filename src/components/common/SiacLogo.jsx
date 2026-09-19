/** Official SIAC seal — served from /image/siac-logo.png */
export const SIAC_LOGO_SRC = '/image/siac-logo.png';

export default function SiacLogo({
  size = 28,
  className = '',
  alt = 'SIAC',
}) {
  const px = typeof size === 'number' ? size : undefined;
  return (
    <img
      src={SIAC_LOGO_SRC}
      alt={alt}
      width={px}
      height={px}
      decoding="async"
      className={`shrink-0 rounded-full object-cover ${className}`.trim()}
      style={px ? { width: px, height: px } : undefined}
    />
  );
}
