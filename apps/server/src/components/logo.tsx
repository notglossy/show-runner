import { LOGO_WORDMARK_PATH } from '@/lib/render/logo';

/**
 * ShowRunner logo. `tone="dark"` (gray lettering, light violet mark) sits on ink or black; `tone="light"` (ink
 * lettering, signal violet mark) sits on the light ground, where the gray lettering would disappear.
 */
export function Logo({
  tone,
  className = 'h-7 w-auto',
}: {
  tone: 'dark' | 'light';
  className?: string;
}) {
  return (
    <svg viewBox="0 0 181 20" fill="none" role="img" aria-label="ShowRunner" className={className}>
      <path d={LOGO_WORDMARK_PATH} className={tone === 'dark' ? 'fill-steel' : 'fill-ink'} />
      <rect
        x="1"
        y="2"
        width="22"
        height="15"
        strokeWidth="2"
        className={tone === 'dark' ? 'stroke-signal-tint' : 'stroke-signal'}
      />
    </svg>
  );
}
