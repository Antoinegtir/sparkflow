// Shared by tailwind.config.js, app/+html.tsx and constants/theme.ts (CommonJS on purpose).
const KEYS = ["primary", "background", "surface", "text", "muted", "border", "danger", "success"];

function rgb(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
/** Blend a toward b by t (0..1). */
const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** White or slate-900, whichever reads better on bg. */
const onColor = (bg) => (contrast("#FFFFFF", bg) >= contrast("#0F172A", bg) ? "#FFFFFF" : "#0F172A");

/** Lighten fg toward white until it reaches 4.5:1 on bg (at most 12 steps). */
function lift(fg, bg) {
  let c = fg;
  for (let i = 0; i < 12 && contrast(c, bg) < 4.5; i++) c = mix(c, "#FFFFFF", 0.12);
  return c;
}

function deriveDark(light) {
  if (luminance(light.background) < 0.2) return { ...light };
  const p = light.primary;
  const surface = mix("#17171F", p, 0.07);
  return {
    ...light,
    background: mix("#0B0B10", p, 0.05),
    surface,
    text: mix("#F4F4F7", p, 0.04),
    muted: mix("#9A9AAE", p, 0.06),
    border: mix("#2A2A36", p, 0.08),
    primary: lift(p, surface),
    danger: lift(light.danger, surface),
    success: lift(light.success, surface),
  };
}

function buildPalettes(theme) {
  const light = {};
  for (const k of KEYS) light[k] = theme[k];
  const dark = { ...deriveDark(light), ...(theme.dark || {}) };
  const finish = (p) => ({ ...p, onPrimary: onColor(p.primary), onDanger: onColor(p.danger) });
  return { light: finish(light), dark: finish(dark), radius: theme.radius ?? 16 };
}

/** --sf-<key>: "r g b" (for tailwind alpha) and --sf-c-<key>: rgb(...) (for inline styles). */
function cssVars(palette) {
  return Object.entries(palette)
    .filter(([, v]) => typeof v === "string" && v.startsWith("#"))
    .map(([k, v]) => `--sf-${k}:${rgb(v).join(" ")};--sf-c-${k}:rgb(${rgb(v).join(",")});`)
    .join("");
}

module.exports = { KEYS, rgb, mix, luminance, contrast, onColor, lift, deriveDark, buildPalettes, cssVars };
