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

/** App Store: its white "A" (Simple Icons' glyph) on the blue tile. */
export const AppStoreLogo = ({ className }: { className?: string }) =>
  svg(
    <>
      <defs>
        <linearGradient id="appstore-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18bffb" />
          <stop offset="1" stopColor="#2072f3" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="5.4" fill="url(#appstore-bg)" />
      <path fill="#fff" transform="translate(4.2 4.2) scale(0.65)" d="M8.8086 14.9194l6.1107-11.0368c.0837-.1513.1682-.302.2437-.4584.0685-.142.1267-.2854.1646-.4403.0803-.3259.0588-.6656-.066-.9767-.1238-.3095-.3417-.5678-.6201-.7355a1.4175 1.4175 0 0 0-.921-.1924c-.3207.043-.6135.1935-.8443.4288-.1094.1118-.1996.2361-.2832.369-.092.1463-.175.2979-.259.4492l-.3864.6979-.3865-.6979c-.0837-.1515-.1667-.303-.2587-.4492-.0837-.1329-.1739-.2572-.2835-.369-.2305-.2353-.5233-.3857-.844-.429a1.4181 1.4181 0 0 0-.921.1926c-.2784.1677-.4964.426-.6203.7355-.1246.311-.1461.6508-.066.9767.038.155.0962.2984.1648.4403.0753.1564.1598.307.2437.4584l1.248 2.2543-4.8625 8.7825H2.0295c-.1676 0-.3351-.0007-.5026.0092-.1522.009-.3004.0284-.448.0714-.3108.0906-.5822.2798-.7783.548-.195.2665-.3006.5929-.3006.9279 0 .3352.1057.6612.3006.9277.196.2683.4675.4575.7782.548.1477.043.296.0623.4481.0715.1675.01.335.009.5026.009h13.0974c.0171-.0357.059-.1294.1-.2697.415-1.4151-.6156-2.843-2.0347-2.843zM3.113 18.5418l-.7922 1.5008c-.0818.1553-.1644.31-.2384.4705-.067.1458-.124.293-.1611.452-.0785.3346-.0576.6834.0645 1.0029.1212.3175.3346.583.607.7549.2727.172.5891.2416.9013.1975.3139-.044.6005-.1986.8263-.4402.1072-.1148.1954-.2424.2772-.3787.0902-.1503.1714-.3059.2535-.4612L6 19.4636c-.0896-.149-.9473-1.4704-2.887-.9218m20.5861-3.0056a1.4707 1.4707 0 0 0-.779-.5407c-.1476-.0425-.2961-.0616-.4483-.0705-.1678-.0099-.3352-.0091-.503-.0091H18.648l-4.3891-7.817c-.6655.7005-.9632 1.485-1.0773 2.1976-.1655 1.0333.0367 2.0934.546 3.0004l5.2741 9.3933c.084.1494.167.299.2591.4435.0837.131.1739.2537.2836.364.231.2323.5238.3809.8449.4232.3192.0424.643-.0244.9217-.1899.2784-.1653.4968-.4204.621-.7257.1246-.3072.146-.6425.0658-.9641-.0381-.1529-.0962-.2945-.165-.4346-.0753-.1543-.1598-.303-.2438-.4524l-1.216-2.1662h1.596c.1677 0 .3351.0009.5029-.009.1522-.009.3007-.028.4483-.0705a1.4707 1.4707 0 0 0 .779-.5407A1.5386 1.5386 0 0 0 24 16.452a1.539 1.539 0 0 0-.3009-.9158Z" />
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
