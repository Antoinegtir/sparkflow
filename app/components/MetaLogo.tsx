/** Meta's infinity mark (simplified), in its blue gradient, sized to the surrounding text. */
export function MetaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="meta-mark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0064e0" />
          <stop offset="1" stopColor="#0082fb" />
        </linearGradient>
      </defs>
      <path
        d="M2.5 12c0-3.1 1.6-5.8 4-5.8 2.6 0 4.2 3.2 5.5 5.8 1.3 2.6 2.9 5.8 5.5 5.8 2.4 0 4-2.7 4-5.8s-1.6-5.8-4-5.8c-2.6 0-4.2 3.2-5.5 5.8-1.3 2.6-2.9 5.8-5.5 5.8-2.4 0-4-2.7-4-5.8z"
        fill="none"
        stroke="url(#meta-mark)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
