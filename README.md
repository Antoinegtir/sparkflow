<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<a href="https://sparkflow-ai.web.app"><img src="public/logo.png" alt="Sparkflow" width="96" /></a>

# Sparkflow

**Mobile apps that look at themselves.**

[![Hero](.github/assets/hero.jpg)](https://sparkflow-ai.web.app)

</div>

> Describe a mobile app, drop a sketch or just talk. Sparkflow plans it, builds it in React Native, opens it in the iOS Simulator and the Android emulator, screenshots every screen and fixes what doesn't match until it does.

> [!TIP]
>
> | [<img alt="Open Sparkflow" src="https://img.shields.io/badge/open-sparkflow--ai.web.app-0073FF?style=flat-square&labelColor=black" width="196px" />](https://sparkflow-ai.web.app) | Nothing to install: sign in and build in the cloud, the app in a web preview and on your phone. |
> | :----- | :----- |
> | [<img alt="Install" src="https://img.shields.io/badge/install-one%20command-white?style=flat-square&labelColor=black&logo=gnubash&logoColor=white" width="196px" />](#quick-start) | For the real iOS Simulator and Android emulator: `curl -fsSL https://sparkflow-ai.web.app/install.sh \| bash`, then `sparkflow`. |

<div align="center">

[![GitHub Release](https://img.shields.io/github/v/release/Antoinegtir/sparkflow?color=0073FF&labelColor=black&logo=github&style=flat-square)](https://github.com/Antoinegtir/sparkflow/releases)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/Antoinegtir/sparkflow/release.yml?color=0073FF&labelColor=black&style=flat-square&label=release)](https://github.com/Antoinegtir/sparkflow/actions)
[![GitHub Stars](https://img.shields.io/github/stars/Antoinegtir/sparkflow?color=0073FF&labelColor=black&style=flat-square)](https://github.com/Antoinegtir/sparkflow/stargazers)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)

<p align="center">
  <img src="https://img.shields.io/badge/Muse%20Spark-0064E0?style=for-the-badge&logo=meta&logoColor=white" alt="Muse Spark" />
  <img src="https://img.shields.io/badge/React%20Native-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/fastlane-00F200?style=for-the-badge&logo=fastlane&logoColor=black" alt="fastlane" />
</p>

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

| Describe | Look |
|:---:|:---:|
| ![Describe](.github/assets/step-describe.jpg) | ![Look](.github/assets/step-look.jpg) |

| Point and talk |
|:---:|
| ![Point and talk](.github/assets/step-point.jpg) |

## Contents

- [Overview](#overview)
  - [How it works](#how-it-works)
- [Meta models](#meta-models)
- [Built during the hackathon](#built-during-the-hackathon)
- [Features](#features)
- [Quick start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [The `sparkflow` command](#the-sparkflow-command)
  - [Where your apps live](#where-your-apps-live)
- [Development](#development)
  - [Scripts](#scripts)
  - [Releases and deploys](#releases-and-deploys)
- [Architecture](#architecture)
- [License](#license)

## Overview

**Sparkflow** turns an idea into a native mobile app that checks its own work. You write a sentence, drop a paper sketch or a screenshot, or record a voice memo; it returns a real Expo project, verified screen by screen, that you can open on your phone, export or keep editing.

| Logo | Built on | Role |
|:---:|---|---|
| <img width="32" src="https://cdn.simpleicons.org/meta/0064E0" alt="Meta" /> | **Muse Spark** · **Muse Wonder** · **Muse Image** · **SAM 3.1** by Meta | Every step of the agent loop: planning, writing the code, judging each screenshot, drawing the assets, reading sketches. See [Meta models](#meta-models). |
| <img width="32" src="https://cdn.simpleicons.org/react/61DAFB" alt="React Native" /> | **React Native** | The code it writes: real components, no web view. |
| <img width="32" src="https://cdn.simpleicons.org/expo/white" alt="Expo" /> | **Expo** · Expo Router | The project template, navigation, Expo Go and the dev client. |
| <img width="32" src="https://cdn.simpleicons.org/apple/white" alt="Apple" /> | **iOS Simulator** | Where the app runs and gets looked at, with its accessibility tree. |
| <img width="32" src="https://cdn.simpleicons.org/android/3DDC84" alt="Android" /> | **Android emulator** | Same, on Android, through adb and uiautomator. |

### How it works

| Step | | What happens |
|:---:|---|---|
| 01 | **Describe** | Say what you want, however you like: text, sketch, screenshot or voice. |
| 02 | **Plan** | The Planner turns it into screens, navigation, a data model, a theme, and visual acceptance criteria for every screen. |
| 03 | **Build** | The Builder writes Expo and React Native code with real tools: it edits files, runs the type checker and fixes its own errors. Every iteration is a git commit. |
| 04 | **Look** | Sparkflow runs what it built on the web, in the iOS Simulator and in the Android emulator, screenshots it, reads the accessibility tree and the console. |
| 05 | **Fix** | A screen that fails goes back to the Builder with the rejected screenshot and the exact list of what is off, until it passes. |
| 06 | **Point and talk** | Click anything on the live phone and say “bigger, in blue”: Sparkflow finds the component, the file and the line, and edits it. |
| 07 | **Ship** | Scan the QR code with Expo Go, export the source, or import your own React Native project and let Sparkflow work on it in place. |

## Meta models

Sparkflow is an agent loop where each step is a Meta model, called through the [Meta Model API](https://llama.developer.meta.com). The IDE shows which model does what, live, in the **Activity** panel and the prompt bar.

```
 prompt · sketch · screenshot · PDF · voice
            │
            ▼
   ┌─────────────────┐   pages, navigation, data model, theme,
   │  PLAN           │   acceptance criteria for every page
   │  Muse Spark 1.3 │◀── SAM 3.1 segments the sketch into components
   └────────┬────────┘
            ▼
   ┌─────────────────┐   edits files, runs the type checker, fixes its errors,
   │  BUILD          │   one git commit per iteration
   │  Muse Wonder 1.0│──▶ Muse Image 1.0 draws icons, photos, splash screens
   └────────┬────────┘
            ▼
   ┌─────────────────┐   screenshots every page (web, iOS, Android), reads the
   │  VERIFY         │   accessibility tree and the console, judges each page
   │  Muse Spark 1.3 │   against its criteria
   └────────┬────────┘
     passes │ fails ─────▶ back to BUILD with the rejected screenshot
            ▼               and the exact list of what is off
     verified app
```

| Model | Where | What it does in Sparkflow |
|---|---|---|
| **Muse Spark 1.3** | Planner, Verifier | Reads the request in any form (text, sketch, screenshot, PDF, voice), writes the plan and the per-page acceptance criteria; then looks at each screenshot and returns a verdict with what to fix. Multimodal in both directions of the loop. |
| **Muse Wonder 1.0** | Builder | Writes the Expo and React Native code with tools (read, edit, type-check, generate assets), and fixes what the Verifier rejects. |
| **Muse Image 1.0** | Builder tool `generate_image` | App icons, splash screens, photos and illustrations, written straight into the project's assets. |
| **SAM 3.1** | Tool `segment` | Cuts a paper sketch or a screenshot into its parts (buttons, cards, lists), so the plan follows the drawing. |

Code: [`lib/agent/roles.ts`](lib/agent/roles.ts) (the loop's roles), [`lib/agent/meta.ts`](lib/agent/meta.ts) (Muse Image, SAM), [`lib/agent/llm/`](lib/agent/llm) (the Model API client), [`lib/shared/models.ts`](lib/shared/models.ts) (which model each step uses).

## Built during the hackathon

Sparkflow was started at the kickoff of the Meta Global AI Developer Hackathon (first commit October 26, 2026); everything in this repository was built during the event. The [commit history](https://github.com/Antoinegtir/sparkflow/commits/main) shows it day by day.

| Area | What was built |
|---|---|
| Agent loop | Planner, Builder and Verifier on Meta models, the fix loop, per-page acceptance criteria, visual and accessibility checks |
| Multimodal input | Prompts with sketches, screenshots, PDFs, HEIC photos and voice; SAM segmentation; Muse Image assets |
| IDE | The canvas of pages and links, live devices, point-and-edit, code editor, asset manager, history with diffs and restore, the Activity view of the loop |
| Cloud | Sparkflow without installing anything: Cloud Run in Europe and the US, each app in its own Modal sandbox with a live web preview and Expo Go |
| Mac and cloud together | The `sparkflow` CLI; the cloud's apps opened in the Mac's iOS Simulator and Android emulator, loading their code from the cloud |
| Ship | Release builds, TestFlight and Google Play uploads with fastlane, GitHub push, sharing and comments |

## Features

- **Three ways in**: a prompt, a sketch or a screenshot, a voice memo.
- **Visual verification**: every screen is checked on its screenshot, plus contrast, touch targets and overflow.
- **Live devices**: the iOS Simulator and Android emulators stream into the browser, booted from the device menu; tap, type, rotate, switch light and dark.
- **Point and edit**: select an element on the live phone and ask for a change; the IDE jumps to its file and line.
- **An IDE for the whole app**: every page on a canvas, the code, assets, history with diffs and restore, accessibility scores.
- **Your apps everywhere**: signed in with GitHub or Google, your apps are saved to your account and listed even when your computer is off.
- **GitHub, Finder, VS Code**: create the repository with the GitHub CLI and push, or open the project folder in one click.
- **Ship**: a native Release build with the app's own name and bundle ID, installed on the iOS Simulator or Android emulator; or a fastlane upload to TestFlight and Google Play's internal track, with credentials kept on your computer.
- **Bring your project**: import an existing Expo app; Sparkflow drives it in place.

## Quick start

```bash
curl -fsSL https://sparkflow-ai.web.app/install.sh | bash
sparkflow
```

The installer checks your machine, installs what's missing without sudo, downloads the latest release (checksum verified) into `~/.sparkflow` and adds the `sparkflow` command. The first start asks for your Muse Spark API key and where your apps should live; without a key, a demo mode builds a sample app.

`sparkflow` starts the server, opens a Cloudflare tunnel and opens [sparkflow-ai.web.app](https://sparkflow-ai.web.app) connected to your computer.

### Prerequisites

| | Needed for |
|---|---|
| macOS, Linux or Windows (WSL) | Running the server (the iOS Simulator needs a Mac) |
| Node 20+, git | Everything (Node is installed for you if missing) |
| Xcode or Android Studio | Either one: the iOS Simulator (Mac only) or the Android emulator (`ANDROID_HOME` or `~/Library/Android/sdk`) |
| cloudflared, watchman | The tunnel and Metro (installed for you if missing) |
| GitHub CLI (`gh`) | Optional: creating repositories from the IDE |

### The `sparkflow` command

| Command | Does |
|---|---|
| `sparkflow` | Start the server, the tunnel and the site |
| `sparkflow doctor` | Check the machine and the installation |
| `sparkflow update [vX.Y.Z]` | Install the latest release (or a given one); nothing happens when you're up to date |
| `sparkflow version` | Print the installed version |
| `sparkflow uninstall [--all]` | Remove Sparkflow, keeping your apps; `--all` also deletes `~/.sparkflow` (settings, and apps kept there) |

### Where your apps live

You pick the folder at the first start (for example `~/Documents/apps`; it's `SPARKFLOW_DATA_DIR` in `~/.sparkflow/.env`). Each app is a plain Expo project with its own git history:

```
~/Documents/apps/
├── wander/          ← an app: open it in VS Code, run it with Expo
├── habitly/
└── .sparkflow/      ← Sparkflow's own files: history, screenshots
```

## Development

```bash
npm install
npm run setup      # the Expo template's dependencies and Playwright's Chromium
cp .env.example .env   # MODEL_API_KEY=… (a scripted mock agent runs without it)
npm run dev
```

### Scripts

| Script | |
|---|---|
| `npm run dev` | The app and its API on localhost |
| `npm run remote` | Same as `sparkflow`, from this checkout |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run smoke` | One full build with the mock agent and the local sandbox |
| `npm run eval` | The prompts in `eval/prompts.json`, results in `eval/results/` |

### Releases and deploys

- `npm run release -- patch` (or `minor`, `major`, `1.2.3`) bumps the version, tags `vX.Y.Z` and pushes. The `Release` workflow builds the server and publishes `sparkflow-vX.Y.Z.tar.gz` and its `.sha256` on GitHub Releases, which `install.sh` and `sparkflow update` download.
- `npm run deploy` publishes the site: a static export, then Firebase Hosting.

## Architecture

The same server runs in two places: in the cloud for everyone (the default), and on your Mac with `sparkflow` for the real simulators.

```
                         sparkflow-ai.web.app (static, Firebase Hosting)
                         Landing · My apps · IDE · Firebase Auth
                          │                                   │
             cloud (default)                                  │  your Mac (sparkflow CLI)
                          ▼                                   ▼
 ┌────────────────────────────────────┐        ┌────────────────────────────────────┐
 │ Cloud Run · Europe and US          │        │ Next.js API on :3002 + tunnel      │
 │  Next.js API, sessions, quotas     │        │  Planner → Builder → Verifier      │
 │  Planner → Builder → Verifier      │        │  Expo sandboxes, Metro, Playwright │
 │  each app → its Modal sandbox:     │        │  iOS Simulator · Android emulator  │
 │   Expo, Metro, Playwright          │──Metro▶│  Sparkflow Dev loads the cloud's   │
 └──────────────┬─────────────────────┘        │  apps in the simulators            │
                ▼                              └────────────────────────────────────┘
        Meta Model API: Muse Spark · Muse Wonder · Muse Image · SAM 3.1
```

| Path | |
|---|---|
| `app/` | The site and the IDE (Next.js App Router), and the API routes |
| `lib/agent/` | The orchestrator, the Planner, Builder and Verifier, the project store |
| `lib/sandbox/` | Where apps run: local sandboxes and Modal sandboxes (cloud), Metro, the inspector |
| `lib/cloud/` | Cloud mode: sessions, per-user apps, daily quotas |
| `lib/web/` | Browser-side: the backend shim, devices, Firebase |
| `templates/expo-base/` | The Expo template every app starts from |
| `templates/demo/` | Wander, the demo app every user finds in My apps |
| `scripts/` | Install, onboarding, release, static build, cloud deploy |

## License

[MIT](LICENSE) © 2026 Antoine Gonthier.

File icons from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT). Apple and the Apple logo are trademarks of Apple Inc. Android robot © Google, CC BY 3.0. Sparkflow is not affiliated with Apple, Google or Meta.
