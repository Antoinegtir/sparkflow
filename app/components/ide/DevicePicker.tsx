"use client";

import clsx from "clsx";
import { Check, ChevronDown, Loader2, Smartphone, Tablet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SIM_CHANGED } from "@/lib/web/sim-device";

type Device = { udid: string; name: string; runtime: string; booted: boolean; kind: "iphone" | "ipad" | "android" };

/**
 * Device picker grouped iPhone / iPad / Android. Picking boots the device (shutting the current one down) and
 * reinstalls the app there. `inline`: the list itself, for when nothing is running yet.
 */
export function DevicePicker({
  bundleId,
  onSwitching,
  inline,
  platform,
  label,
}: {
  bundleId?: string;
  onSwitching?: (name: string | null) => void;
  inline?: boolean;
  /** Only this platform's devices (Play: boot an iOS Simulator from the iOS tab). */
  platform?: "ios" | "android";
  /** The button's text instead of the booted device's name; the list then opens below its left edge. */
  label?: string;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = () => fetch("/api/sim/devices").then((r) => r.json()).then((d) => Array.isArray(d) && setDevices(d)).catch(() => {});

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!open) return;
    void load();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = devices.find((d) => d.booted);
  async function pick(d: Device) {
    setOpen(false);
    if (d.booted) return;
    setBusy(true);
    onSwitching?.(d.name);
    try {
      const res = await fetch("/api/sim/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ udid: d.udid, bundleId }) });
      const json = await res.json();
      // Still booting past the wait (an Android cold boot): it shows up by itself once ready.
      if (!res.ok && !/did not boot/i.test(json.error ?? "")) alert(json.error ?? "Could not switch the simulator");
      window.dispatchEvent(new Event(SIM_CHANGED));
      await load();
    } finally {
      setBusy(false);
      onSwitching?.(null);
    }
  }

  const group = (kind: Device["kind"], title: string) => {
    if (platform && (kind === "android") !== (platform === "android")) return null;
    const list = devices.filter((d) => d.kind === kind);
    if (!list.length) return null;
    return (
      <div>
        <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{title}</p>
        {list.map((d) => (
          <button key={d.udid} onClick={() => void pick(d)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink-200 hover:bg-ink-800">
            <span className="flex-1 truncate">{d.name}</span>
            <span className="text-[10.5px] text-ink-500">{d.runtime}</span>
            {d.booted && <Check size={13} className="text-spark-400" />}
          </button>
        ))}
      </div>
    );
  };

  const empty = <p className="p-3 text-[12px] text-ink-500">No simulators or emulators found. Install an iOS Simulator in Xcode or an Android emulator in Android Studio.</p>;
  if (inline)
    return (
      <div className="w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 text-left">
        {busy ? (
          <p className="flex items-center gap-2 p-3 text-[12px] text-ink-400">
            <Loader2 size={13} className="animate-spin" /> Booting… (an Android emulator's first start can take a few minutes)
          </p>
        ) : (
          <>
            {group("iphone", "iPhone")}
            {group("ipad", "iPad")}
            {group("android", "Android")}
            {!devices.length && empty}
          </>
        )}
      </div>
    );

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] text-ink-300 hover:text-ink-100">
        {busy ? <Loader2 size={13} className="animate-spin" /> : current?.kind === "ipad" ? <Tablet size={13} /> : <Smartphone size={13} />}
        <span className="max-w-[160px] truncate">{busy ? "Booting…" : (label ?? current?.name ?? "No device")}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className={clsx("absolute z-50 mt-1 max-h-96 w-72 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 text-left shadow-2xl", label ? "left-0" : "right-0")}>
          {group("iphone", "iPhone")}
          {group("ipad", "iPad")}
          {group("android", "Android")}
          {!devices.length && empty}
        </div>
      )}
    </div>
  );
}
