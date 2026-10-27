const plugin = require("tailwindcss/plugin");
const { buildPalettes, cssVars } = require("./constants/palette");
const theme = require("./theme.json");

const palettes = buildPalettes(theme);
const color = (k) => `rgb(var(--sf-${k}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // 'class' instead of 'media': NativeWind web throws "Cannot manually set color scheme" otherwise.
  darkMode: "class",
  theme: {
    extend: {
      colors: Object.fromEntries(
        ["primary", "background", "surface", "text", "muted", "border", "danger", "success"].map((k) => [k, color(k)]).concat([
          ["on-primary", color("onPrimary")],
          ["on-danger", color("onDanger")],
        ]),
      ),
      borderRadius: { theme: `${palettes.radius}px` },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": Object.fromEntries(cssVars(palettes.light).split(";").filter(Boolean).map((d) => d.split(":"))),
        "@media (prefers-color-scheme: dark)": {
          ":root": Object.fromEntries(cssVars(palettes.dark).split(";").filter(Boolean).map((d) => d.split(":"))),
        },
      });
    }),
  ],
};
