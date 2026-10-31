import Image from "next/image";
import Link from "next/link";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink-100">
      {/* An app-icon tile: light edge, white highlight at the top and an inner shadow for depth. */}
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[9px] border border-white/20 bg-gradient-to-b from-[#1c1f26] to-[#050608] shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-2px_6px_rgba(0,0,0,.6),0_4px_14px_-4px_rgba(0,0,0,.8)]">
        <Image src="/logo.png" alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" priority />
        <span className="pointer-events-none absolute inset-0 rounded-[9px] bg-[radial-gradient(120%_70%_at_30%_0%,rgba(255,255,255,.28),transparent_55%)]" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight">Sparkflow</span>}
    </Link>
  );
}
