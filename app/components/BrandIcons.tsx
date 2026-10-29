import type { ReactNode } from "react";
import { MetaLogo } from "./MetaLogo";

/** Simplified marks of the tools Sparkflow builds on, sized to the surrounding text. */
const svg = (children: ReactNode, className = "size-3.5") => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    {children}
  </svg>
);

export const ReactLogo = ({ className }: { className?: string }) =>
  svg(
    <g fill="none" stroke="#61dafb" strokeWidth="1.3">
      <ellipse cx="12" cy="12" rx="10" ry="3.9" />
      <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.9" fill="#61dafb" stroke="none" />
    </g>,
    className,
  );

export const ExpoLogo = ({ className }: { className?: string }) =>
  svg(<path fill="currentColor" d="M11.1 4.6c.4-.6 1.4-.6 1.8 0l8.3 13.6c.5.8-.4 1.6-1.2 1.1-1.6-1-3.9-4.6-6.3-8.5-.8-1.3-1.6-1.3-2.4 0-2.4 3.9-4.7 7.5-6.3 8.5-.8.5-1.7-.3-1.2-1.1z" />, className);

export const AppleLogo = ({ className }: { className?: string }) =>
  svg(
    <path
      fill="currentColor"
      d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.4-3.7zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"
    />,
    className,
  );

export const AndroidLogo = ({ className }: { className?: string }) =>
  svg(
    <g fill="#3ddc84">
      <path d="M3 17.5a9 9 0 0 1 18 0z" />
      <path d="M6.6 9.3 4.9 6.4M17.4 9.3l1.7-2.9" stroke="#3ddc84" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8.3" cy="13.8" r="1" fill="#0b0d12" />
      <circle cx="15.7" cy="13.8" r="1" fill="#0b0d12" />
    </g>,
    className,
  );

/** The mark for a "How it works" tag, when it names one of these tools. */
export function brandIcon(tag: string): ReactNode {
  const c = "size-3.5 shrink-0";
  if (/^(Muse Spark|SAM)/.test(tag)) return <MetaLogo className={c} />;
  if (tag === "React Native") return <ReactLogo className={c} />;
  if (/^Expo( Go)?$/.test(tag)) return <ExpoLogo className={`${c} text-ink-200`} />;
  if (/^(iOS|iPhone)/.test(tag)) return <AppleLogo className={`${c} text-ink-200`} />;
  if (/^Android/.test(tag)) return <AndroidLogo className={c} />;
  return null;
}
