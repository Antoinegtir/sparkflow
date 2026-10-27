import type { SafeAreas } from "@/app/components/ide/ui";

export type PreviewPlatform = "ios" | "android";

/** A device the web build can be previewed in: logical screen size, safe areas and frame proportions. */
export type PreviewDevice = {
  id: string;
  label: string;
  platform: PreviewPlatform;
  areas: SafeAreas;
  h: number;
  radius: number;
  bezel: number;
  ipad?: boolean;
  homeButton?: boolean;
};

export const PREVIEW_DEVICES: PreviewDevice[] = [
  // iPhone SE: square screen, thick top and bottom bezels, Touch ID home button, 20 pt status bar.
  { id: "se", label: "iPhone SE", platform: "ios", areas: { width: 375, top: 20, bottom: 0 }, h: 667, radius: 0, bezel: 28, homeButton: true },
  { id: "iphone", label: "iPhone", platform: "ios", areas: { width: 393, top: 59, bottom: 34, island: true }, h: 852, radius: 55, bezel: 12 },
  { id: "ipadmini", label: "iPad mini", platform: "ios", areas: { width: 744, top: 24, bottom: 20 }, h: 1133, radius: 21, bezel: 36, ipad: true },
  // Pixel 8 class: 412×915 dp, punch-hole camera, gesture navigation.
  { id: "pixel", label: "Pixel", platform: "android", areas: { width: 412, top: 36, bottom: 24, android: true }, h: 915, radius: 42, bezel: 10 },
  // Compact Galaxy-style phone: 360×780 dp.
  { id: "galaxy", label: "Galaxy", platform: "android", areas: { width: 360, top: 32, bottom: 24, android: true }, h: 780, radius: 38, bezel: 9 },
];

/** The SE's forehead and chin (speaker, home button), in points. */
export const SE_CHIN = 110;

/** Outer size of the drawn device (frame included), in points. */
export const outerSize = (d: PreviewDevice) => ({ w: d.areas.width + d.bezel * 2, h: d.h + (d.homeButton ? 2 * SE_CHIN : d.bezel * 2) });

export const PREVIEW_DEVICE_KEY = "sparkflow-preview-device";
