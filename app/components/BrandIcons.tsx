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

export const TypeScriptLogo = ({ className }: { className?: string }) =>
  svg(
    <>
      <rect x="2" y="2" width="20" height="20" rx="2.5" fill="#3178c6" />
      <path fill="#fff" d="M6 12.4h5.4v1.5H9.5V19H7.9v-5.1H6zM16.3 11.9c1.2 0 2 .4 2.6 1.1l-1 1c-.4-.4-.9-.7-1.5-.7-.6 0-.9.3-.9.6 0 .4.3.6 1.3.9 1.5.5 2.3 1.1 2.3 2.4 0 1.4-1.1 2.3-2.8 2.3-1.3 0-2.4-.5-3-1.3l1-1c.5.6 1.2.9 1.9.9.7 0 1.1-.3 1.1-.7 0-.4-.3-.6-1.3-.9-1.4-.4-2.3-1.1-2.3-2.3 0-1.3 1.1-2.3 2.6-2.3z" />
    </>,
    className,
  );

export const GitLogo = ({ className }: { className?: string }) =>
  svg(
    <>
      <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.2" transform="rotate(45 12 12)" fill="#f05032" />
      <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M9.6 7.4 14.4 12.2M10.6 8.5v7.3" />
      </g>
      <g fill="#fff">
        <circle cx="10.6" cy="8.5" r="1.3" />
        <circle cx="10.6" cy="15.8" r="1.3" />
        <circle cx="14.6" cy="12.4" r="1.3" />
      </g>
    </>,
    className,
  );

/** The mark for a "How it works" tag, when it names one of these tools. */
export function brandIcon(tag: string): ReactNode {
  const c = "size-3.5 shrink-0";
  if (/^(Muse Spark|SAM)/.test(tag)) return <MetaLogo className={c} />;
  if (tag === "React Native") return <ReactLogo className={c} />;
  if (/^Expo( Go)?$/.test(tag)) return <ExpoLogo className={`${c} text-ink-200`} />;
  if (/^(iOS|iPhone)/.test(tag)) return <AppleLogo className={`${c} text-ink-200`} />;
  if (tag === "TypeScript") return <TypeScriptLogo className={c} />;
  if (tag === "git") return <GitLogo className={c} />;
  if (/^Android/.test(tag)) return <AndroidLogo className={c} />;
  if (tag === "TestFlight") return <AppStoreLogo className={c} />;
  if (tag === "Google Play") return <PlayStoreLogo className={c} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (tag === "Bring your project") return <img src="/emoji/party-popper.webp" alt="" width={14} height={14} className={c} />;
  return null;
}

/** App Store: the white "A" of pencils and brush on its blue tile. */
export const AppStoreLogo = ({ className }: { className?: string }) =>
  svg(
    <>
      <defs>
        <linearGradient id="appstore-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18bffb" />
          <stop offset="1" stopColor="#2072f3" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5.2" fill="url(#appstore-bg)" />
      <g stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M9.6 6.2 15.9 17M14.4 6.2 8.1 17M6.4 13.8h8.3M16.6 13.8h1.6M5.8 17.1l-.6 1" />
      </g>
    </>,
    className,
  );

/** Google Play: its four-colour triangle. */
export const PlayStoreLogo = ({ className }: { className?: string }) =>
  svg(
    <>
      <path fill="#00d7fe" d="M3.6 2.3a1.5 1.5 0 0 0-.4 1.1v17.2c0 .4.1.8.4 1.1l9.7-9.7z" />
      <path fill="#ffce00" d="m16.5 15.2-3.2-3.2 3.2-3.2 3.8 2.2c1.1.6 1.1 1.6 0 2.2z" />
      <path fill="#ff3a44" d="M16.5 15.2 13.3 12l-9.7 9.7c.4.4 1 .4 1.7 0z" />
      <path fill="#00f076" d="M16.5 8.8 5.3 2.4c-.7-.4-1.3-.3-1.7 0l9.7 9.6z" />
    </>,
    className,
  );
