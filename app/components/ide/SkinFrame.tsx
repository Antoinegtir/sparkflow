"use client";

import type { CSSProperties, ReactNode } from "react";
import type { DeviceSkin } from "@/lib/web/device-skin";

/**
 * An Android emulator's own frame (its SDK skin): the screen, cut to its rounded corners by the
 * skin's overlay (opaque where the screen hides, so used inverted), under the frame image.
 * Fills its box, which should have the skin's aspect ratio.
 */
export function SkinFrame({ skin, children, className, style }: { skin: DeviceSkin; children: ReactNode; className?: string; style?: CSSProperties }) {
  const mask = skin.mask ? `linear-gradient(#000 0 0), url(${skin.mask})` : undefined;
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <div
        className="absolute overflow-hidden bg-black"
        style={{
          left: `${(skin.screen.x / skin.width) * 100}%`,
          top: `${(skin.screen.y / skin.height) * 100}%`,
          width: `${(skin.screen.width / skin.width) * 100}%`,
          height: `${(skin.screen.height / skin.height) * 100}%`,
          ...(mask
            ? { maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%, 100% 100%", WebkitMaskSize: "100% 100%, 100% 100%", maskComposite: "exclude", WebkitMaskComposite: "xor" }
            : {}),
        }}>
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={skin.back} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
    </div>
  );
}
