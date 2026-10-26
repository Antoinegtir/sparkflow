import { Folder } from "lucide-react";
import { ScrollVideo } from "./components/ScrollVideo";
import { Prompt } from "./components/Prompt";

export default function Home() {
  return (
    <div className="relative mx-auto max-w-[1000px] px-4 py-4">
      {/* Logos Android et Apple de chaque côté du titre (grands écrans uniquement). */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-48 top-24 hidden justify-between min-[1400px]:flex">
        <video className="hero-logo h-56 w-56 -rotate-6" src="/videos/android.webm" autoPlay muted loop playsInline />
        {/* Démarre une demi-boucle plus tard pour ne jamais tourner en même temps. */}
        <video className="hero-logo h-56 w-56 rotate-6" src="/videos/apple.webm#t=7.5" autoPlay muted loop playsInline />
      </div>

      <section className="relative pb-10 pt-[70px] text-center sm:pt-[140px]">

        <p className="mb-9 text-base text-muted">
          Built on <b className="font-medium text-fg">Muse Spark</b>, <b className="font-medium text-fg">Muse Image</b> and{" "}
          <b className="font-medium text-fg">SAM 3.1</b> by <span className="font-bold text-[#2d7dff]">∞</span>{" "}
          <b className="font-medium text-fg">Meta</b>
        </p>
        <h1 className="text-[clamp(44px,7vw,78px)] font-bold leading-[1.04] tracking-[-0.03em]">
          Mobile apps that <span className="block bg-gradient-to-r from-[#0a84ff] via-[#5e5ce6] to-[#bf5af2] bg-clip-text text-transparent">look at themselves.</span>
        </h1>
        <p className="mx-auto mb-14 mt-8 max-w-[600px] text-lg leading-[1.7] text-[#c7cdd6] sm:text-[22px]">
          Describe an app, drop a sketch or just talk. Sparkflow plans it, builds it in React Native, screenshots every screen and fixes what doesn&apos;t match until it does.
        </p>

        <Prompt />

        <a className="mx-auto mt-10 flex w-fit cursor-pointer items-center justify-center gap-2.5 border-b-2 border-[#3a4250] px-8 pb-3.5 text-[15px] text-muted hover:text-fg">
          <Folder size={18} className="fill-[#4ea3ff] text-[#4ea3ff]" />
          Import from a React Native project
        </a>
      </section>

      {/* Téléphone en verre piloté par le scroll, juste sous le lien d'import. */}
      <ScrollVideo src="/videos/phone.webm" className="max-h-[80vh] w-auto" />
    </div>
  );
}
