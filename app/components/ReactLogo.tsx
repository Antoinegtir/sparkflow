/** React Native's atom mark (three orbits around a nucleus), drawn inline at text size. */
export function ReactLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="-11.5 -10.232 23 20.463" className={className} aria-label="React Native" role="img">
      <circle r="2.05" fill="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <ellipse rx="11" ry="4.2" />
        <ellipse rx="11" ry="4.2" transform="rotate(60)" />
        <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      </g>
    </svg>
  );
}
