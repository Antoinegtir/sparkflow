# Sparkflow

Describe a mobile app, drop a sketch or record a voice memo. Sparkflow plans it, builds it in React Native (Expo), screenshots every screen and fixes what doesn't match until it does.

## Run it

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` installs the Expo template's dependencies and Playwright's Chromium. Copy `.env.example` to `.env` and set `MODEL_API_KEY` to use Muse Spark; without a key a scripted mock agent builds a sample habit tracker.

## Hosted site + your computer

The site is hosted on Firebase Hosting (https://sparkflow-ai.web.app); the builds run on your computer. Install the server once:

```bash
curl -fsSL https://sparkflow-ai.web.app/install.sh | bash
```

The installer checks the Xcode command line tools (full Xcode for the iOS Simulator view) and git, installs what's missing among Node 20+, cloudflared and watchman (with Homebrew, or the official builds in `~/.sparkflow/tools`, no sudo), downloads the latest GitHub release (checksum verified) into `~/.sparkflow` and adds a `sparkflow` command:

- `sparkflow`: starts the server, opens a Cloudflare quick tunnel and opens the hosted site connected to it (one-time token in the link).
- `sparkflow doctor`, `sparkflow update [vX.Y.Z]`, `sparkflow version`, `sparkflow uninstall [--all]`.

Your apps live in `~/.sparkflow/data` and the API key in `~/.sparkflow/.env`, shared by every version.

From a checkout, `npm run remote` does the same as `sparkflow`. `npm run deploy` publishes the site (static export to `.next-static`, then `firebase deploy --only hosting`).

### Releases

`npm run release -- patch` (or `minor`, `major`, `1.2.3`) bumps `package.json`, tags `vX.Y.Z` and pushes. The `Release` workflow builds the server on Ubuntu and publishes `sparkflow-vX.Y.Z.tar.gz` and its `.sha256` on GitHub Releases, which `install.sh` and `sparkflow update` download.

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
