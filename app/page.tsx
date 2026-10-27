import { Composer } from "./components/Composer";
import { DotLens } from "./components/DotLens";
import { MetaLogo } from "./components/MetaLogo";
import { ScrollVideo } from "./components/ScrollVideo";
import { HowItWorks } from "./components/HowItWorks";
import { ReactLogo } from "./components/ReactLogo";
import { ImportNative } from "./components/ImportNative";
import { ProjectGrid } from "./components/ProjectGrid";
import { Logo } from "./components/Logo";
import { SignIn } from "./components/SignIn";
import { StartBuilding } from "./components/StartBuilding";

export default function Home() {
  // Pas encore de backend : valeurs affichées dans la barre du haut.
  const info = { model: "mock", sandbox: "local", llm: "mock" };
  return (
    // Landing look: Aurora colors (globals.css [data-landing]), Bricolage Grotesque + Geist.
    <main
      id="top"
      data-landing="aurora"
      className="relative min-h-screen overflow-x-clip bg-ink-950 font-sans"
      style={{ "--font-sans": "var(--font-geist)", "--font-mono": "var(--font-geist-mono)", "--landing-head": "var(--font-bricolage)" } as React.CSSProperties}>
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] h-[70vh] bg-[radial-gradient(ellipse_at_center,var(--landing-glow,rgba(124,58,237,.22)),transparent_65%)]" />
      {/* Flat dot grid, faded toward the bottom and hollowed out under the magnifier (DotLens). */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:22px_22px]"
        style={{
          maskImage:
            "radial-gradient(ellipse at top, black, transparent 70%), radial-gradient(circle var(--lr, 0px) at var(--lx, -999px) var(--ly, -999px), transparent 98%, black 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />
      <DotLens />

      {/* Floating app bar: translucent and blurred over the page as it scrolls. */}
      <header className="fixed inset-x-0 top-3 z-40 mx-auto grid w-[min(780px,calc(100%-32px))] grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-white/10 bg-ink-950/55 py-2 pl-3 pr-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl backdrop-saturate-150">
        <Logo />
        <nav className="hidden items-center gap-1 text-[13px] text-ink-300 md:flex">
          <a href="#how" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-ink-100">How it works</a>
          <a href="#apps" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-ink-100">My apps</a>
          <a href="https://github.com/Antoinegtir/sparkflow" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-ink-100">
            <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden>
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
            GitHub
          </a>
        </nav>
        <div className="col-start-3 flex items-center justify-end gap-2">
          <SignIn />
          <StartBuilding />
        </div>
      </header>
      <div className="h-16" />

      {/* Android and Apple glass logos on each side of the headline (wide screens only). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-24 mx-auto hidden max-w-6xl justify-between px-2 lg:flex">
        <video className="hero-logo h-56 w-56 -rotate-6" src="/videos/android.webm" autoPlay muted loop playsInline />
        {/* Starts half a turn later (#t=): both loops last 15 s, so they never spin in sync. */}
        <video className="hero-logo h-56 w-56 rotate-6" src="/videos/apple.webm#t=7.5" autoPlay muted loop playsInline />
      </div>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="mb-6 text-[13px] tracking-wide text-ink-400">
          Built on <span className="text-ink-200">Muse Spark</span>, <span className="text-ink-200">Muse Image</span> and{" "}
          <span className="text-ink-200">SAM 3.1</span> by{" "}
          <span className="inline-flex items-baseline gap-1 text-ink-200">
            <MetaLogo className="h-[1.15em] w-[1.15em] translate-y-[0.22em]" />
            Meta
          </span>
        </p>
        <h1 className="landing-head text-balance text-4xl font-semibold tracking-tight text-ink-100 sm:text-6xl">
          Mobile apps that <span className="text-spark-500">look at themselves.</span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-ink-300 sm:text-lg">
          Describe an app, drop a sketch or just talk. Sparkflow plans it, builds it in{" "}
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap font-medium text-[#61dafb]">
            <ReactLogo className="h-[1.05em] w-[1.05em] translate-y-[0.18em] animate-[spin_12s_linear_infinite]" />
            React Native
          </span>
          , screenshots every screen and fixes what doesn&apos;t match until it does.
        </p>
        <div className="mt-10 w-full">
          <Composer />
          <ImportNative />
        </div>
      </section>

      {/* Scroll-scrubbed glass phone, right under the import link. */}
      <ScrollVideo src="/videos/phone.webm">
        <HowItWorks />
      </ScrollVideo>
      <div id="apps" className="scroll-mt-20">
        <ProjectGrid />
      </div>
      {info.llm === "mock" && (
        <p className="relative mx-auto mb-12 max-w-lg px-6 text-center text-xs text-warn/90">
          Demo mode: no <code className="font-mono">MODEL_API_KEY</code> set, so a scripted agent builds a sample habit tracker. Add your Meta Model API key to <code className="font-mono">.env</code> to use Muse Spark.
        </p>
      )}
      <footer className="relative mx-auto max-w-5xl border-t border-ink-800 px-6 pb-10 pt-6">
        <div className="flex flex-col items-center justify-between gap-3 text-[12.5px] text-ink-400 sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="font-medium text-ink-200">Sparkflow</span>
            <span className="text-ink-600">·</span>© {new Date().getFullYear()} Antoine Gonthier. All rights reserved.
          </span>
          <span className="text-ink-500">Built with Muse Spark, Expo and React Native</span>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-600 sm:text-left">
          Apple and the Apple logo are trademarks of Apple Inc. Android robot © Google, CC BY 3.0. Sparkflow is not affiliated with Apple or Google.
        </p>
      </footer>
    </main>
  );
}
