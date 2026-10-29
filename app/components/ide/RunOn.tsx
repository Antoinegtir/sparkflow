"use client";

import clsx from "clsx";
import { Check, ChevronDown, Globe, Loader2, Monitor, QrCode, Smartphone, Tablet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { ProjectState } from "@/lib/shared";
import { PREVIEW_DEVICES } from "@/lib/web/devices";
import { SIM_CHANGED, useSimDevice } from "@/lib/web/sim-device";

type Device = { udid: string; name: string; runtime: string; booted: boolean; kind: "iphone" | "ipad" | "android" };

/**
 * Where the app runs, in one menu: natively in an iOS Simulator or Android emulator on this computer
 * (booted from here), on your own phone with Expo Go, or as the web build in a device frame.
 */
export function RunOn({ state, onDevice, onSwitching }: { state: ProjectState; onDevice: (id: string) => void; onSwitching: (name: string | null) => void }) {
  const sim = useSimDevice();
  const native = !!state.native;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const onLive = native || state.previewDevice === "simulator";
  const preview = PREVIEW_DEVICES.find((d) => d.id === state.previewDevice);

  // The button says what the app runs on now.
  const Icon = onLive ? (sim.device?.ipad ? Tablet : Smartphone) : preview ? (preview.ipad ? Tablet : Smartphone) : Monitor;
  const label = busy ? `Starting ${busy}…` : onLive ? (sim.device?.name ?? "No device") : (preview?.label ?? "Web");
  const kind = onLive ? (sim.device?.platform === "android" ? "Emulator" : "Simulator") : "Web preview";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] text-ink-200 hover:text-ink-100">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
        <span className="max-w-[160px] truncate">{label}</span>
        <span className={clsx("hidden rounded px-1.5 py-px text-[10.5px] sm:inline", onLive ? "bg-emerald-400/15 text-emerald-300" : "bg-ink-800 text-ink-400")}>{kind}</span>
        <ChevronDown size={12} className="text-ink-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1">
          <RunOnMenu
            state={state}
            onDevice={onDevice}
            onDone={() => setOpen(false)}
            onSwitching={(name) => {
              setBusy(name);
              onSwitching(name);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The choices themselves (also the focus view's device button): this computer's Simulators and
 * emulators, your phone, the web preview sizes.
 */
export function RunOnMenu({
  state,
  onDevice,
  onSwitching,
  onDone,
}: {
  state: ProjectState;
  onDevice: (id: string) => void;
  onSwitching?: (name: string | null) => void;
  onDone: () => void;
}) {
  const sim = useSimDevice();
  const native = !!state.native;
  const [qr, setQr] = useState(false);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    fetch("/api/sim/devices")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setDevices(d))
      .catch(() => {});
  }, []);

  const onLive = native || state.previewDevice === "simulator";
  const preview = PREVIEW_DEVICES.find((d) => d.id === state.previewDevice);

  async function runOnDevice(d: Device) {
    onDone();
    // Already the one shown: just show the app there.
    if (d.booted && sim.device?.udid === d.udid) return native || onDevice("simulator");
    onSwitching?.(d.name);
    try {
      const res = await fetch("/api/sim/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ udid: d.udid, bundleId: state.native?.bundleId }) });
      const json = await res.json().catch(() => ({}));
      // Still booting past the wait (an Android cold boot): it shows up by itself once ready.
      if (!res.ok && !/did not boot/i.test(json.error ?? "")) alert(json.error ?? "Could not start this device");
      window.dispatchEvent(new Event(SIM_CHANGED));
      if (!native) onDevice("simulator");
    } finally {
      onSwitching?.(null);
    }
  }

  // Long lists (Xcode installs many Simulators): the running ones and a few others, unless "Show all".
  const FEW = 3;
  const group = (title: string, list: Device[]) =>
    list.length > 0 && (
      <div>
        <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] text-ink-500">{title}</p>
        {(all ? list : list.filter((d, i) => d.booted || i < FEW)).map((d) => {
          const current = onLive && sim.device?.udid === d.udid;
          return (
            <button key={d.udid} onClick={() => void runOnDevice(d)} className={clsx(row, current && "bg-spark-500/10")}>
              <span className={clsx("size-1.5 shrink-0 rounded-full", d.booted ? "bg-emerald-400" : "bg-ink-600")} title={d.booted ? "Running" : "Not running: click to start it"} />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-[10.5px] text-ink-500">{d.booted ? "running" : d.runtime}</span>
              {current && <Check size={13} className="text-spark-400" />}
            </button>
          );
        })}
      </div>
    );
  const row = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink-200 hover:bg-ink-800";
  const heading = (icon: React.ReactNode, title: string, hint: string) => (
    <div className="flex items-baseline gap-2 border-t border-[var(--line)] px-2.5 pt-2.5 pb-1 first:border-t-0 first:pt-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
        {icon}
        {title}
      </span>
      <span className="truncate text-[11px] text-ink-500">{hint}</span>
    </div>
  );
  const sorted = (k: Device["kind"]) => (devices ?? []).filter((d) => d.kind === k).sort((a, b) => Number(b.booted) - Number(a.booted));
  const hidden = (devices ?? []).length - (["iphone", "ipad", "android"] as const).reduce((n, k) => n + sorted(k).filter((d, i) => d.booted || i < FEW).length, 0);

  return (
        <div className="max-h-[70vh] w-80 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 text-left shadow-2xl">
          {heading(<Smartphone size={12} />, "On this Mac", "the native app, live")}
          {sim.supported ? (
            <>
              {group("iPhone Simulator", sorted("iphone"))}
              {group("iPad Simulator", sorted("ipad"))}
              {group("Android emulator", sorted("android"))}
              {!all && hidden > 0 && (
                <button onClick={() => setAll(true)} className="w-full cursor-pointer px-2.5 py-1.5 text-left text-[11.5px] text-spark-400 hover:underline">
                  Show all ({hidden} more)
                </button>
              )}
              {!devices && (
                <p className="flex items-center gap-2 px-2.5 py-2 text-[12px] text-ink-500">
                  <Loader2 size={12} className="animate-spin" /> Looking for simulators and emulators…
                </p>
              )}
              {devices?.length === 0 && <p className="px-2.5 py-2 text-[12px] text-ink-500">No simulator or emulator installed: add one in Xcode or Android Studio.</p>}
            </>
          ) : (
            <p className="px-2.5 py-2 text-[12px] text-ink-500">Needs Xcode (iOS Simulator) or Android Studio (emulator) on this computer.</p>
          )}

          {!native && (
            <>
              {heading(<QrCode size={12} />, "Your phone", "with Expo Go, same Wi‑Fi")}
              {state.preview?.expoGoUrl ? (
                qr ? (
                  <div className="px-2.5 pb-2">
                    <div className="mx-auto mt-1 w-fit rounded-lg bg-white p-2">
                      {/* An https link: every phone camera reads it (an exp:// one only with Expo Go installed). */}
                      <QRCodeSVG value={`https://sparkflow-ai.web.app/open?u=${encodeURIComponent(state.preview.expoGoUrl)}`} size={160} />
                    </div>
                    <p className="mt-2 text-[11.5px] leading-snug text-ink-400">
                      Scan with the camera. First time: sign in to Expo Go, and with the same account here: <span className="font-mono text-ink-300">npx expo login</span>
                    </p>
                  </div>
                ) : (
                  <button onClick={() => setQr(true)} className={row}>
                    <QrCode size={13} className="text-ink-400" />
                    <span className="flex-1">Show the QR code</span>
                  </button>
                )
              ) : (
                <p className="px-2.5 py-2 text-[12px] text-ink-500">Available once the app's preview is running.</p>
              )}

              {heading(<Globe size={12} />, "Web preview", "the web build in a frame")}
              {(["ios", "android"] as const).map((pf) => (
                <div key={pf}>
                  <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] text-ink-500">{pf === "ios" ? "iOS" : "Android"}</p>
                  {PREVIEW_DEVICES.filter((d) => d.platform === pf).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        onDone();
                        onDevice(d.id);
                      }}
                      className={clsx(row, !onLive && preview?.id === d.id && "bg-spark-500/10")}>
                      {d.ipad ? <Tablet size={13} className="text-ink-400" /> : <Smartphone size={13} className="text-ink-400" />}
                      <span className="flex-1">{d.label}</span>
                      {!onLive && preview?.id === d.id && <Check size={13} className="text-spark-400" />}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
  );
}
