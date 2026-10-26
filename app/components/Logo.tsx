import Link from "next/link";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 text-ink-100">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-spark-400 to-[var(--logo-to,#d946ef)] shadow-[0_4px_20px_-4px_color-mix(in_oklab,var(--color-spark-400)_80%,transparent)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden>
          <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
        </svg>
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight">Sparkflow</span>}
    </Link>
  );
}
