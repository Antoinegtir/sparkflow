# Sparkflow

Describe a mobile app, drop a sketch or record a voice memo. Sparkflow plans it, builds it in React Native (Expo), screenshots every screen and fixes what doesn't match until it does.

## Run it

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` installs the Expo template's dependencies and Playwright's Chromium. Copy `.env.example` to `.env` and set `MODEL_API_KEY` to use Muse Spark; without a key a scripted mock agent builds a sample habit tracker.

## How it works

- **Planner** turns the request (text, sketch, voice) into screens, navigation, a data model and visual acceptance criteria.
- **Builder** writes Expo Router code with tools (files, patches, typecheck, screenshots) in a sandbox copied from `templates/expo-base`.
- **Verifier** opens each screen at 390×844 with Playwright, checks the criteria on the screenshot and audits accessibility; failing screens go back to the Builder.
- **IDE** (`/p/<id>`) shows every page on a canvas, live previews, versions, diffs, and lets you point at elements and ask for changes.
- **Native projects**: import an Expo project and drive it in the iOS Simulator (idb or AXe), capture its pages and edit it in place.

## Scripts

- `npm test`: unit tests.
- `npm run smoke`: one full build with the mock agent and the local sandbox.
- `npm run eval`: the prompts in `eval/prompts.json`, results in `eval/results/`.

File icons from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT).

Apple and the Apple logo are trademarks of Apple Inc. Android robot © Google, CC BY 3.0. Sparkflow is not affiliated with Apple or Google.
