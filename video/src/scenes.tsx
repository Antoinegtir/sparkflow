import { AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, ease, gradientText, mono, pop, sans, sceneFade } from "./theme";
import { Backdrop, Chip, HabitApp, Kicker, Phone, Reveal } from "./ui";

const Center = ({ children, gap = 28 }: { children: React.ReactNode; gap?: number }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap, fontFamily: sans, color: C.ink100, textAlign: "center" }}>
    {children}
  </AbsoluteFill>
);

function Fade({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: sceneFade(f, durationInFrames) }}>{children}</AbsoluteFill>;
}

// ---------------------------------------------------------------- 1. Hook

export function Hook() {
  const f = useCurrentFrame();
  const words = ["AI", "writes", "apps", "blind."];
  const out = ease(f, 78, 14);
  return (
    <Fade>
      <Backdrop />
      <Center>
        <div style={{ display: "flex", gap: 34, fontSize: 150, fontWeight: 800, letterSpacing: -6, opacity: 1 - out, transform: `scale(${1 - out * 0.08})` }}>
          {words.map((w, i) => {
            const p = pop(f, 6 + i * 9);
            return (
              <span key={w} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 60}px)`, color: i === 3 ? C.ink500 : C.ink100 }}>
                {w}
              </span>
            );
          })}
        </div>
      </Center>
      <Center>
        <div style={{ opacity: out, transform: `scale(${0.92 + out * 0.08})`, fontSize: 130, fontWeight: 800, letterSpacing: -5 }}>
          <span style={gradientText}>What if it could see?</span>
        </div>
      </Center>
    </Fade>
  );
}

// ---------------------------------------------------------------- 2. Problem

export function Problem() {
  const f = useCurrentFrame();
  const typed = "Add liquid glass to the app".slice(0, Math.floor(interpolate(f, [10, 50], [0, 27], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })));
  const code = ["background: 'rgba(255,255,255,.6)'", "backdropFilter: 'blur(20px)'", "border: '1px solid white'"];
  const verdict = pop(f, 120);
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "120px 160px", fontFamily: sans, color: C.ink100, flexDirection: "row", gap: 100, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <Reveal at={0}>
            <Kicker color={C.red}>The problem</Kicker>
          </Reveal>
          <Reveal at={6}>
            <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.04, marginTop: 20 }}>
              Code that compiles
              <br />
              <span style={{ color: C.ink500 }}>isn't an app that looks right.</span>
            </div>
          </Reveal>
          <Reveal at={150}>
            <div style={{ fontSize: 32, color: C.ink300, marginTop: 36, lineHeight: 1.4, maxWidth: 760 }}>
              Coding agents never open what they build. They fake native effects, ship overlapping layouts and call it done.
            </div>
          </Reveal>
        </div>
        <div style={{ width: 720 }}>
          <div style={{ borderRadius: 26, background: "rgba(20,25,34,.85)", border: "1px solid rgba(255,255,255,.1)", padding: 34, boxShadow: "0 40px 90px -30px black" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ background: C.blue, borderRadius: "22px 22px 6px 22px", padding: "14px 22px", fontSize: 28, fontWeight: 500, minHeight: 40 }}>
                {typed}
                <span style={{ opacity: f % 30 < 15 && f < 60 ? 1 : 0 }}>|</span>
              </div>
            </div>
            <div style={{ marginTop: 26, fontFamily: mono, fontSize: 24, lineHeight: 1.7, color: C.ink300 }}>
              {code.map((l, i) => (
                <div key={l} style={{ opacity: ease(f, 62 + i * 12, 14), textDecoration: verdict > 0.5 ? "line-through" : undefined, textDecorationColor: C.red }}>
                  <span style={{ color: C.violet }}>{l.split(":")[0]}</span>:{l.slice(l.indexOf(":") + 1)}
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 22,
                display: "inline-flex",
                gap: 12,
                alignItems: "center",
                padding: "10px 18px",
                borderRadius: 14,
                background: "rgba(255,69,58,.14)",
                color: C.red,
                fontSize: 26,
                fontWeight: 700,
                opacity: verdict,
                transform: `scale(${0.8 + verdict * 0.2})`,
              }}>
              ✕ A CSS look-alike. Not Liquid Glass.
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- 3. Logo

export function Intro() {
  const f = useCurrentFrame();
  const p = pop(f, 4, 12);
  const glow = 0.6 + Math.sin(f / 9) * 0.15;
  return (
    <Fade>
      <Backdrop />
      <Center gap={18}>
        <div style={{ position: "relative", width: 320, height: 320, transform: `scale(${0.4 + p * 0.6}) rotate(${(1 - p) * -40}deg)`, opacity: p }}>
          <div style={{ position: "absolute", inset: -80, background: `radial-gradient(circle, rgba(99,102,241,${glow * 0.5}), transparent 65%)` }} />
          <Img src={staticFile("logo.png")} style={{ width: 320, height: 320, mixBlendMode: "screen", maskImage: "radial-gradient(circle, black 55%, transparent 72%)" }} />
        </div>
        <Reveal at={18}>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -6, ...gradientText }}>Sparkflow</div>
        </Reveal>
        <Reveal at={34}>
          <div style={{ fontSize: 40, color: C.ink300, fontWeight: 500 }}>Describe a mobile app. It builds it, opens it, looks at it, and fixes it.</div>
        </Reveal>
        <Reveal at={52}>
          <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
            <Chip>
              <span style={{ color: C.sky }}>●</span> Muse Spark · Muse Wonder
            </Chip>
            <Chip>SAM 3.1</Chip>
            <Chip>React Native · Expo</Chip>
            <Chip>In the cloud or on your Mac</Chip>
          </div>
        </Reveal>
      </Center>
    </Fade>
  );
}

// ---------------------------------------------------------------- 4. Pipeline

const STEPS = [
  { k: "01 · Describe", t: "Text, sketch, screenshot or voice.", b: "Drop several files at once. Muse Spark reads them all; SAM 3.1 cuts a paper sketch into buttons, cards and lists." },
  { k: "02 · Plan", t: "Screens, navigation, data.", b: "Every screen gets visual acceptance criteria, checkable on one screenshot." },
  { k: "03 · Build", t: "Real React Native.", b: "Muse Wonder writes the Expo code with tools, typechecks it and fixes its own errors. Every change is a git commit." },
  { k: "04 · Look", t: "It opens the app.", b: "Web preview, iOS Simulator, Android emulator: screenshot, accessibility tree, console. Muse Spark checks each criterion by looking." },
  { k: "05 · Fix", t: "Wrong? It sees why.", b: "The rejected screenshot goes back to the Builder with exactly what's off, until every page passes." },
];
export const STEP_LEN = 195;

export function Pipeline() {
  const f = useCurrentFrame();
  const i = Math.min(STEPS.length - 1, Math.floor(f / STEP_LEN));
  const local = f - i * STEP_LEN;
  const s = STEPS[i];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 150px", flexDirection: "row", alignItems: "center", gap: 90, fontFamily: sans, color: C.ink100 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 46 }}>
            {STEPS.map((_, j) => (
              <div key={j} style={{ height: 6, flex: 1, borderRadius: 3, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${j < i ? 100 : j > i ? 0 : Math.min(100, (local / STEP_LEN) * 100)}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.violet})` }} />
              </div>
            ))}
          </div>
          <div key={i}>
            <Reveal at={i * STEP_LEN}>
              <Kicker>{s.k}</Kicker>
            </Reveal>
            <Reveal at={i * STEP_LEN + 5}>
              <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3.5, lineHeight: 1.02, marginTop: 18 }}>{s.t}</div>
            </Reveal>
            <Reveal at={i * STEP_LEN + 12}>
              <div style={{ fontSize: 34, color: C.ink300, marginTop: 28, lineHeight: 1.4, maxWidth: 820 }}>{s.b}</div>
            </Reveal>
          </div>
        </div>
        <div style={{ width: 700, height: 900, position: "relative", display: "grid", placeItems: "center" }}>
          {i === 0 && <DescribeVisual f={local} />}
          {i === 1 && <PlanVisual f={local} />}
          {i === 2 && <BuildVisual f={local} />}
          {i === 3 && <LookVisual f={local} />}
          {i === 4 && <FixVisual f={local} />}
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 26, background: "rgba(20,25,34,.9)", border: "1px solid rgba(255,255,255,.1)", padding: 30, boxShadow: "0 40px 90px -30px black", ...style }}>
      {children}
    </div>
  );
}

function DescribeVisual({ f }: { f: number }) {
  const prompt = "A habit tracker with a streak, daily habits and stats";
  const n = Math.floor(interpolate(f, [8, 70], [0, prompt.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const bars = Array.from({ length: 28 }, (_, k) => 10 + Math.abs(Math.sin((f + k * 7) / 5)) * 50 * ease(f, 80, 10));
  const sketch = ease(f, 95, 20);
  return (
    <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 26 }}>
      <Card>
        <div style={{ fontSize: 30, lineHeight: 1.4, minHeight: 84 }}>
          {prompt.slice(0, n)}
          <span style={{ color: C.sky, opacity: f % 24 < 12 ? 1 : 0 }}>▍</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {["sketch.jpg", "screenshot.png", "brief.pdf"].map((x, k) => {
            const p = pop(f, 40 + k * 8);
            return (
              <div key={x} style={{ fontFamily: mono, fontSize: 18, color: C.ink300, padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", opacity: p, transform: `scale(${0.8 + p * 0.2})` }}>
                {x}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", height: 64, marginTop: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: C.red, marginRight: 14, opacity: ease(f, 80, 8) }} />
          {bars.map((h, k) => (
            <div key={k} style={{ width: 8, height: h, borderRadius: 4, background: C.sky, opacity: 0.85 }} />
          ))}
        </div>
      </Card>
      <Card style={{ opacity: sketch, transform: `translateY(${(1 - sketch) * 40}px) rotate(-2deg)`, background: "#fbf8ef", color: "#333", padding: 26 }}>
        <div style={{ position: "relative", height: 250, fontFamily: "'Comic Sans MS', cursive" }}>
          {[{ x: 0, y: 0, w: 520, h: 70, l: "Streak 🔥" }, { x: 0, y: 90, w: 520, h: 60, l: "habit  ○" }, { x: 0, y: 165, w: 520, h: 60, l: "habit  ○" }].map((b, k) => {
            const seg = ease(f, 120 + k * 8, 12);
            return (
              <div key={k} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, border: "3px solid #444", borderRadius: 14, padding: "12px 18px", fontSize: 26 }}>
                {b.l}
                <div style={{ position: "absolute", inset: -8, border: `3px solid ${C.violet}`, borderRadius: 18, opacity: seg, background: `${C.violet}18` }}>
                  <span style={{ position: "absolute", right: 8, top: -16, fontFamily: mono, fontSize: 16, background: C.violet, color: "white", padding: "1px 8px", borderRadius: 6 }}>
                    {["Card", "ListItem", "ListItem"][k]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function PlanVisual({ f }: { f: number }) {
  const screens = [
    { t: "Today", c: ["A header reads “Today”", "A streak card shows 12 days", "Four habit rows with a check"] },
    { t: "Stats", c: ["A weekly bar chart", "Three stat tiles"] },
    { t: "Habit detail", c: ["The habit's name as title", "A 30-day calendar"] },
  ];
  return (
    <div style={{ width: 660, display: "flex", flexDirection: "column", gap: 18 }}>
      {screens.map((s, k) => {
        const p = pop(f, 6 + k * 14);
        return (
          <Card key={s.t} style={{ opacity: p, transform: `translateX(${(1 - p) * 80}px)`, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{s.t}</div>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.ink500 }}>{k === 2 ? "/habit/[id]" : `/(tabs)/${s.t.toLowerCase()}`}</div>
            </div>
            {s.c.map((c, j) => (
              <div key={c} style={{ display: "flex", gap: 12, fontSize: 22, color: C.ink300, marginTop: 10, opacity: ease(f, 40 + k * 14 + j * 8, 12) }}>
                <span style={{ color: C.sky }}>◇</span>
                {c}
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

function BuildVisual({ f }: { f: number }) {
  const lines = [
    ["k", "export default function "],
    ["", "  const habits = useStore((s) => s.habits);"],
    ["", "  return ("],
    ["t", "    <Screen testID=\"today\">"],
    ["t", "      <Header title=\"Today\" />"],
    ["t", "      <Card glass>…</Card>"],
    ["t", "      {habits.map((h) => <ListItem … />)}"],
    ["t", "    </Screen>"],
    ["", "  );"],
    ["", "}"],
  ];
  const shown = interpolate(f, [5, 90], [0, lines.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tc = ease(f, 100, 14);
  const color = { k: C.violet, f: C.sky, t: "#7ee787", "": C.ink300 } as Record<string, string>;
  return (
    <div style={{ width: 680, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card style={{ fontFamily: mono, fontSize: 24, lineHeight: 1.65, padding: 30 }}>
        <div style={{ color: C.ink500, fontSize: 18, marginBottom: 12 }}>app/(tabs)/index.tsx</div>
        {lines.map(([k, l], j) => (
          <div key={j} style={{ color: color[k], opacity: interpolate(shown - j, [0, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), whiteSpace: "pre" }}>
            {l}
            {j === 0 && <span style={{ color: C.sky }}>Today() {"{"}</span>}
          </div>
        ))}
      </Card>
      <div style={{ display: "flex", gap: 14, opacity: tc }}>
        <Chip style={{ fontSize: 22 }}>
          <span style={{ color: C.green }}>✓</span> typecheck
        </Chip>
        <Chip style={{ fontSize: 22 }}>
          <span style={{ color: C.green }}>✓</span> git commit · v3
        </Chip>
        <Chip style={{ fontSize: 22 }}>
          <span style={{ color: C.violet }}>◆</span> Muse Image artwork
        </Chip>
      </div>
    </div>
  );
}

function Criteria({ f, items, start, fail }: { f: number; items: string[]; start: number; fail?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((c, j) => {
        const p = pop(f, start + j * 14);
        const bad = j === fail;
        return (
          <div key={c} style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 24, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 18,
                color: "white",
                background: bad ? C.red : C.green,
              }}>
              {bad ? "✕" : "✓"}
            </span>
            <span style={{ color: bad ? "#ffb4ae" : C.ink100 }}>{c}</span>
          </div>
        );
      })}
    </div>
  );
}

function LookVisual({ f }: { f: number }) {
  const scan = interpolate(f, [10, 70], [0, 852], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
      <Phone scale={0.82} glow="rgba(10,132,255,.45)">
        <HabitApp t={1} />
        <div style={{ position: "absolute", left: 0, right: 0, top: scan, height: 3, background: C.sky, boxShadow: `0 0 30px 8px ${C.sky}`, opacity: f < 75 ? 1 : 0 }} />
        {f > 75 &&
          [{ y: 140, h: 150 }, { y: 302, h: 76 }, { y: 388, h: 76 }].map((b, k) => (
            <div key={k} style={{ position: "absolute", left: 16, right: 16, top: b.y, height: b.h, border: `3px solid ${C.green}`, borderRadius: 22, opacity: ease(f, 78 + k * 10, 10) }} />
          ))}
      </Phone>
      <div style={{ width: 300 }}>
        <Criteria f={f} start={80} items={["“Today” header", "Streak card", "Habit rows", "Contrast 4.5:1", "44 pt targets"]} />
      </div>
    </div>
  );
}

function FixVisual({ f }: { f: number }) {
  const fixed = ease(f, 85, 26);
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
      <Phone scale={0.82} glow={fixed > 0.5 ? "rgba(48,209,88,.45)" : "rgba(255,69,58,.45)"}>
        <HabitApp t={1} broken={1 - fixed} />
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: 140,
            height: 150,
            border: `3px solid ${fixed > 0.5 ? C.green : C.red}`,
            borderRadius: 26,
            opacity: ease(f, 10, 10),
          }}
        />
      </Phone>
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ opacity: 1 - fixed }}>
          <Criteria f={f} start={14} fail={1} items={["“Today” header", "Streak card overflows the screen", "Habit rows"]} />
        </div>
        <div style={{ opacity: fixed, marginTop: -170 }}>
          <Criteria f={f} start={95} items={["“Today” header", "Streak card", "Habit rows"]} />
        </div>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.ink400, marginTop: 30, opacity: ease(f, 110, 12) }}>attempt 2/3 · verified ✓</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 5. Point and talk

export function PointTalk() {
  const f = useCurrentFrame();
  const cx = interpolate(f, [20, 70], [740, 342], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const cy = interpolate(f, [20, 70], [900, 336], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const click = pop(f, 74);
  const talk = ease(f, 90, 10);
  const change = ease(f, 175, 30);
  const bars = Array.from({ length: 36 }, (_, k) => 8 + Math.abs(Math.sin((f + k * 5) / 4)) * 42 * (f > 92 && f < 170 ? 1 : 0.15));
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 150px", flexDirection: "row", alignItems: "center", gap: 100, fontFamily: sans, color: C.ink100 }}>
        <div style={{ flex: 1 }}>
          <Reveal at={0}>
            <Kicker color={C.violet}>06 · Point and talk</Kicker>
          </Reveal>
          <Reveal at={6}>
            <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3.5, lineHeight: 1.02, marginTop: 18 }}>
              Point at it.
              <br />
              <span style={gradientText}>Say what you want.</span>
            </div>
          </Reveal>
          <div style={{ marginTop: 44, opacity: talk }}>
            <Card style={{ display: "flex", alignItems: "center", gap: 18, padding: 24, width: 680 }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: C.red, flexShrink: 0 }} />
              <div style={{ display: "flex", gap: 4, alignItems: "center", height: 56 }}>
                {bars.map((h, k) => (
                  <div key={k} style={{ width: 7, height: h, borderRadius: 4, background: C.violet }} />
                ))}
              </div>
            </Card>
            <div style={{ fontSize: 40, fontWeight: 600, marginTop: 22, opacity: ease(f, 110, 14) }}>“Bigger, and in purple.”</div>
            <div style={{ fontFamily: mono, fontSize: 22, color: C.ink400, marginTop: 16, opacity: ease(f, 150, 14) }}>
              → components/HabitRow.tsx:42 · edited · recaptured
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Phone scale={0.95} glow="rgba(139,92,246,.45)">
            <HabitApp t={1} big={change} accent={interpolateColor(change)} />
            <div
              style={{
                position: "absolute",
                left: 318,
                top: 296,
                width: 54,
                height: 54,
                border: `3px solid ${C.violet}`,
                borderRadius: 30,
                opacity: click * (1 - change),
                background: `${C.violet}22`,
              }}
            />
          </Phone>
          <Cursor x={cx} y={cy} press={click} />
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

const interpolateColor = (t: number) => {
  const a = [10, 132, 255];
  const b = [139, 92, 246];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
};

function Cursor({ x, y, press }: { x: number; y: number; press: number }) {
  const s = press > 0 && press < 0.98 ? 0.85 : 1;
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" style={{ position: "absolute", left: x, top: y, transform: `scale(${s})`, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))" }}>
      <path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="white" stroke="black" strokeWidth="1.2" />
    </svg>
  );
}

// ---------------------------------------------------------------- 6. Native everywhere

export function Native() {
  const f = useCurrentFrame();
  const a = pop(f, 6);
  const b = pop(f, 16);
  const glass = ease(f, 120, 30);
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ fontFamily: sans, color: C.ink100, alignItems: "center", paddingTop: 80 }}>
        <Reveal at={0}>
          <Kicker style={{ textAlign: "center" }}>07 · On your Mac, for real</Kicker>
        </Reveal>
        <Reveal at={6}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2.5, marginTop: 14, textAlign: "center" }}>
            Live on the iOS Simulator <span style={{ color: C.ink500 }}>and</span> the Android emulator.
          </div>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 120, top: 250 }}>
        <div style={{ position: "relative", opacity: a, transform: `translateY(${(1 - a) * 200}px)` }}>
          <OffthreadVideo src={staticFile("apple.mp4")} muted style={{ position: "absolute", width: 340, left: -320, top: 120, opacity: 0.95, maskImage: "radial-gradient(circle, black 40%, transparent 68%)" }} />
          <Phone scale={0.7} glow="rgba(10,132,255,.4)">
            <HabitApp t={1} glass={glass > 0.5} />
          </Phone>
        </div>
        <div style={{ position: "relative", opacity: b, transform: `translateY(${(1 - b) * 200}px)` }}>
          <OffthreadVideo src={staticFile("android.mp4")} muted style={{ position: "absolute", width: 340, right: -320, top: 120, opacity: 0.95, maskImage: "radial-gradient(circle, black 40%, transparent 68%)" }} />
          <Phone scale={0.67} android glow="rgba(48,209,88,.35)">
            <HabitApp t={1} accent="#1a73e8" />
          </Phone>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 60 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <Terminal f={f} />
          <div style={{ display: "flex", gap: 16, opacity: ease(f, 150, 16) }}>
            <Chip style={{ fontSize: 22 }}>
              <span style={{ color: C.sky }}>◆</span> Cloud apps open here too
            </Chip>
            <Chip style={{ fontSize: 22 }}>Git history, pages and screenshots move with them</Chip>
            <Chip style={{ fontSize: 22 }}>Real Liquid Glass</Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- 8. End card

export function Outro() {
  const f = useCurrentFrame();
  const p = pop(f, 2, 12);
  return (
    <Fade>
      <Backdrop />
      <Center gap={22}>
        <Img src={staticFile("logo.png")} style={{ width: 220, height: 220, mixBlendMode: "screen", maskImage: "radial-gradient(circle, black 55%, transparent 72%)", transform: `scale(${p}) rotate(${f / 4}deg)` }} />
        <Reveal at={8}>
          <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: -4 }}>
            Describe it. <span style={gradientText}>Watch it get built.</span>
          </div>
        </Reveal>
        <Reveal at={22}>
          <div style={{ fontSize: 44, color: C.ink300, fontFamily: mono }}>sparkflow-ai.web.app</div>
        </Reveal>
        <Reveal at={30}>
          <div style={{ fontSize: 30, color: C.ink400 }}>Sign in and build in the cloud. Nothing to install.</div>
        </Reveal>
        <Reveal at={36}>
          <div style={{ marginTop: 26, fontSize: 26, color: C.ink500, letterSpacing: 3, textTransform: "uppercase", fontFamily: mono }}>Meta AI Developer Hackathon · Built on Meta models</div>
        </Reveal>
      </Center>
    </Fade>
  );
}

// ---------------------------------------------------------------- Impact

export function Impact() {
  const f = useCurrentFrame();
  const who = [
    { t: "Founders", d: "A real app to put in users' hands, today." },
    { t: "Designers", d: "Sketch on paper, get native screens back." },
    { t: "Developers", d: "Point at your own RN app and talk to it." },
  ];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "120px 160px", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker>Push the Frontier · software</Kicker>
        </Reveal>
        <Reveal at={6}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, marginTop: 18, maxWidth: 1500 }}>
            An agent that doesn't stop at “it compiles”. <span style={gradientText}>It stops at “it looks right”.</span>
          </div>
        </Reveal>
        <div style={{ display: "flex", gap: 26, marginTop: 70 }}>
          {who.map((w, k) => {
            const p = pop(f, 40 + k * 10);
            return (
              <Card key={w.t} style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 50}px)` }}>
                <div style={{ fontSize: 44, fontWeight: 700 }}>{w.t}</div>
                <div style={{ fontSize: 28, color: C.ink400, marginTop: 10, lineHeight: 1.35 }}>{w.d}</div>
              </Card>
            );
          })}
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- Meta models

export function MetaModels() {
  const f = useCurrentFrame();
  const models = [
    { m: "Muse Spark 1.3", r: "Planner and Verifier: plans, then judges every screenshot", c: C.sky },
    { m: "Muse Wonder 1.0", r: "Builder: writes the code with tools, fixes what's rejected", c: C.blue },
    { m: "Muse Spark 1.2 · audio", r: "Listens to voice memos: “bigger, in purple”", c: C.amber },
    { m: "Muse Image 1.0", r: "Draws the app icon, splash screen and illustrations", c: C.violet },
    { m: "SAM 3.1", r: "Cuts a sketch into buttons, cards and lists", c: C.green },
  ];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "100px 160px", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker>Meta Model API</Kicker>
        </Reveal>
        <Reveal at={5}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, marginTop: 16 }}>
            Every step runs on <span style={gradientText}>Meta's models.</span>
          </div>
        </Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 70 }}>
          {models.map((x, k) => {
            const p = pop(f, 24 + k * 12);
            return (
              <div key={x.m} style={{ display: "flex", alignItems: "center", gap: 32, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
                <div style={{ width: 470, flexShrink: 0, fontSize: 38, fontWeight: 700, color: x.c }}>{x.m}</div>
                <div style={{ height: 2, width: 60 * p, background: x.c, opacity: 0.6 }} />
                <div style={{ fontSize: 30, color: C.ink300, lineHeight: 1.35 }}>{x.r}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- Built during the hackathon

export function Built() {
  const f = useCurrentFrame();
  const items = [
    "Planner → Builder → Verifier loop",
    "Screenshot + accessibility verification",
    "Sketches, screenshots, PDFs and voice",
    "An IDE: canvas, code, assets, history",
    "Point and talk on the live phone",
    "Cloud Run in Europe and the US, Modal sandboxes",
    "Cloud apps on the Mac's Simulator and emulator",
    "Sharing with roles, comments on the canvas",
    "TestFlight, Google Play, GitHub",
    "Bring your own React Native app",
  ];
  const line = ease(f, 10, 60);
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "100px 160px", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker color={C.amber}>Built during the hackathon</Kicker>
        </Reveal>
        <Reveal at={5}>
          <div style={{ fontSize: 80, fontWeight: 800, letterSpacing: -3, marginTop: 16 }}>
            Every line, <span style={gradientText}>Oct 26 → Nov 4.</span>
          </div>
        </Reveal>
        <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,.1)", marginTop: 60 }}>
          <div style={{ height: "100%", width: `${line * 100}%`, borderRadius: 2, background: `linear-gradient(90deg, ${C.amber}, ${C.blue}, ${C.violet})` }} />
          <div style={{ position: "absolute", left: 0, top: 18, fontFamily: mono, fontSize: 22, color: C.ink400 }}>Day 1 · first commit</div>
          <div style={{ position: "absolute", right: 0, top: 18, fontFamily: mono, fontSize: 22, color: C.ink400, opacity: line }}>Day 10 · submission</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 60px", marginTop: 90 }}>
          {items.map((t, k) => (
            <div key={t} style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 30, opacity: ease(f, 30 + k * 7, 14) }}>
              <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 64, opacity: ease(f, 110, 16) }}>
          <Chip style={{ fontSize: 22 }}>Open source · MIT</Chip>
          <Chip style={{ fontSize: 22 }}>400+ commits · 80+ releases</Chip>
          <Chip style={{ fontSize: 22 }}>One-line install</Chip>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- Cloud

/** A decorative QR code: the three finder squares and a fixed pseudo-random fill. */
function Qr({ size = 220 }: { size?: number }) {
  const n = 25;
  const finder = (x: number, y: number) =>
    [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => {
      const dx = x - fx;
      const dy = y - fy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
      return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    });
  const reserved = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const on = reserved(x, y) ? finder(x, y) : ((x * 7919 + y * 104729 + x * y * 31) % 11) % 2 === 0;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />);
    }
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} style={{ background: "white", borderRadius: 18 }}>
      <g fill="#0b0d12">{cells}</g>
    </svg>
  );
}

export function Cloud() {
  const f = useCurrentFrame();
  const signIn = ease(f, 14, 14) * (1 - ease(f, 70, 12));
  const app = ease(f, 78, 18);
  const steps = ["Sandbox ready on Modal", "Expo and Metro running", "Web preview live", "Pages verified"];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 140px", flexDirection: "row", alignItems: "center", gap: 80, fontFamily: sans, color: C.ink100 }}>
        <div style={{ flex: 1 }}>
          <Reveal at={0}>
            <Kicker>Nothing to install</Kicker>
          </Reveal>
          <Reveal at={6}>
            <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3.5, lineHeight: 1.02, marginTop: 18 }}>
              Sign in.
              <br />
              <span style={gradientText}>Build in the cloud.</span>
            </div>
          </Reveal>
          <Reveal at={16}>
            <div style={{ fontSize: 32, color: C.ink300, marginTop: 28, lineHeight: 1.4, maxWidth: 760 }}>
              Each app gets its own sandbox, run from Google Cloud in Europe and the US. A live web preview in the browser, and your phone with Expo Go.
            </div>
          </Reveal>
          <div style={{ display: "flex", gap: 14, marginTop: 36, opacity: ease(f, 110, 14) }}>
            <Chip style={{ fontSize: 22 }}>
              <span style={{ color: C.green }}>●</span> cloud-eu
            </Chip>
            <Chip style={{ fontSize: 22 }}>
              <span style={{ color: C.green }}>●</span> cloud-us
            </Chip>
            <Chip style={{ fontSize: 22, color: C.ink300 }}>Cloud Run · Modal</Chip>
          </div>
        </div>
        <div style={{ width: 860, height: 640, position: "relative" }}>
          <Card style={{ position: "absolute", inset: 0, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
              ))}
              <div style={{ marginLeft: 16, flex: 1, fontFamily: mono, fontSize: 19, color: C.ink400, padding: "7px 16px", borderRadius: 10, background: "rgba(255,255,255,.05)" }}>
                sparkflow-ai.web.app{app > 0.5 ? "/habits" : ""}
              </div>
            </div>
            {/* Sign-in, then the app in its sandbox. */}
            <AbsoluteFill style={{ top: 64, alignItems: "center", justifyContent: "center", gap: 18, opacity: signIn }}>
              <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 10 }}>Sign in to Sparkflow</div>
              {["Continue with GitHub", "Continue with Google"].map((t, k) => (
                <div
                  key={t}
                  style={{
                    width: 420,
                    padding: "16px 0",
                    textAlign: "center",
                    borderRadius: 16,
                    fontSize: 24,
                    fontWeight: 600,
                    background: k === 0 ? "white" : "rgba(255,255,255,.06)",
                    color: k === 0 ? "#0b0d12" : C.ink100,
                    border: "1px solid rgba(255,255,255,.14)",
                    transform: `scale(${k === 0 && f > 56 && f < 64 ? 0.96 : 1})`,
                  }}>
                  {t}
                </div>
              ))}
            </AbsoluteFill>
            <AbsoluteFill style={{ top: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 50, opacity: app }}>
              <Phone scale={0.6} glow="rgba(10,132,255,.4)">
                <HabitApp t={interpolate(f, [100, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
              </Phone>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 300 }}>
                {steps.map((t, k) => {
                  const p = ease(f, 92 + k * 26, 12);
                  return (
                    <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 22, opacity: 0.35 + p * 0.65 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 13, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, background: p > 0.5 ? C.green : "rgba(255,255,255,.1)", color: "white" }}>
                        {p > 0.5 ? "✓" : ""}
                      </span>
                      {t}
                    </div>
                  );
                })}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: ease(f, 200, 14) }}>
                  <Qr size={170} />
                  <div style={{ fontFamily: mono, fontSize: 17, color: C.ink400 }}>Scan with Expo Go</div>
                </div>
              </div>
            </AbsoluteFill>
          </Card>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- IDE

function MiniPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f2f4f8", padding: "54px 16px 0", color: "#0b0d12", fontFamily: sans }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

const Row = ({ w = "100%", h = 54, c = "white" }: { w?: string | number; h?: number; c?: string }) => (
  <div style={{ width: w, height: h, borderRadius: 16, background: c, border: "1px solid #e6e9ef", marginBottom: 10 }} />
);

function StatsPage() {
  const bars = [40, 62, 35, 80, 70, 92, 55];
  return (
    <MiniPage title="Stats">
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 190, padding: 16, borderRadius: 20, background: "white", border: "1px solid #e6e9ef", marginBottom: 12 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, height: `${b}%`, borderRadius: 6, background: i === 5 ? C.blue : "#c9d6f5" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {["12", "86%", "4"].map((v) => (
          <div key={v} style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: "white", border: "1px solid #e6e9ef", textAlign: "center", fontSize: 26, fontWeight: 800 }}>
            {v}
          </div>
        ))}
      </div>
    </MiniPage>
  );
}

function DetailPage() {
  return (
    <MiniPage title="Morning run">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 7, padding: 14, borderRadius: 20, background: "white", border: "1px solid #e6e9ef" }}>
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 8, background: i % 5 === 3 || i > 30 ? "#e8ecf3" : C.blue, opacity: i % 5 === 3 || i > 30 ? 1 : 0.35 + ((i * 37) % 60) / 100 }} />
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Row h={60} />
      </div>
    </MiniPage>
  );
}

function ProfilePage() {
  return (
    <MiniPage title="Profile">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: `linear-gradient(135deg, ${C.blue}, ${C.violet})` }} />
        <div style={{ fontSize: 22, fontWeight: 700 }}>Alex</div>
      </div>
      <Row />
      <Row />
      <Row />
    </MiniPage>
  );
}

export function Ide() {
  const f = useCurrentFrame();
  const S = 0.34;
  const W = 393 * S;
  const H = 852 * S;
  const pages = [
    { t: "Today", x: 90, y: 180, el: <HabitApp t={1} />, at: 20 },
    { t: "Stats", x: 440, y: 14, el: <StatsPage />, at: 50 },
    { t: "Habit detail", x: 440, y: 334, el: <DetailPage />, at: 80 },
    { t: "Profile", x: 790, y: 190, el: <ProfilePage />, at: 110 },
  ];
  const links: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ];
  const activity = [
    { m: "Muse Spark 1.3", t: "Planned 4 pages and their criteria", c: C.sky, at: 14 },
    { m: "Muse Wonder 1.0", t: "Wrote app/(tabs)/index.tsx", c: C.blue, at: 40 },
    { m: "Muse Image 1.0", t: "Drew the app icon", c: C.violet, at: 66 },
    { m: "Muse Spark 1.3", t: "Today · 5/5 criteria ✓", c: C.sky, at: 92 },
    { m: "Muse Wonder 1.0", t: "Fixed the streak card overflow", c: C.blue, at: 130 },
    { m: "Muse Spark 1.3", t: "All 4 pages verified ✓", c: C.green, at: 170 },
  ];
  const tabs = ["Canvas", "Code", "Assets", "Layout", "History", "Activity"];
  const tab = f < 200 ? 0 : 1;
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "80px 120px", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker>An IDE for the whole app</Kicker>
        </Reveal>
        <Reveal at={5}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, marginTop: 14 }}>
            Every page, <span style={gradientText}>on one canvas.</span>
          </div>
        </Reveal>
        <div style={{ position: "relative", flex: 1, marginTop: 40, opacity: ease(f, 8, 16) }}>
          <Card style={{ position: "absolute", inset: 0, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", alignItems: "center" }}>
              {tabs.map((t, k) => (
                <div
                  key={t}
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    padding: "7px 16px",
                    borderRadius: 10,
                    color: (k === tab || (k === 5 && tab === 0)) ? C.ink100 : C.ink500,
                    background: k === tab ? "rgba(255,255,255,.08)" : "transparent",
                  }}>
                  {t}
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontFamily: mono, fontSize: 18, color: C.ink400 }}>Habits · v7</div>
            </div>
            <div style={{ flex: 1, display: "flex" }}>
              {/* Canvas, or the code of the page picked */}
              <div style={{ flex: 1, position: "relative", backgroundImage: "radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
                <div style={{ position: "absolute", inset: 0, opacity: tab === 0 ? 1 : 0 }}>
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
                    {links.map(([a, b], k) => {
                      const A = pages[a];
                      const B = pages[b];
                      const p = ease(f, Math.max(A.at, B.at) + 10, 20);
                      const x1 = A.x + W;
                      const y1 = A.y + H / 2;
                      const x2 = B.x;
                      const y2 = B.y + H / 2;
                      const mx = (x1 + x2) / 2;
                      return (
                        <path
                          key={k}
                          d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={C.sky}
                          strokeWidth={2.5}
                          strokeDasharray="1000"
                          strokeDashoffset={1000 * (1 - p)}
                          opacity={0.7}
                        />
                      );
                    })}
                  </svg>
                  {pages.map((pg, k) => {
                    const p = pop(f, pg.at);
                    const ok = f > activity[k === 0 ? 3 : 5].at;
                    return (
                      <div key={pg.t} style={{ position: "absolute", left: pg.x, top: pg.y, opacity: p, transform: `scale(${0.85 + p * 0.15})` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 600, color: C.ink300, marginBottom: 8, width: W }}>
                          {pg.t}
                          <span style={{ color: ok ? C.green : C.amber }}>{ok ? "✓" : "●"}</span>
                        </div>
                        <div style={{ width: W, height: H, borderRadius: 24, overflow: "hidden", position: "relative", border: `2px solid ${ok ? "rgba(48,209,88,.6)" : "rgba(255,255,255,.15)"}` }}>
                          <div style={{ position: "absolute", left: 0, top: 0, width: 393, height: 852, transform: `scale(${S})`, transformOrigin: "top left" }}>{pg.el}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ position: "absolute", inset: 0, padding: 36, fontFamily: mono, fontSize: 22, lineHeight: 1.75, opacity: tab === 1 ? 1 : 0 }}>
                  <div style={{ color: C.ink500, fontSize: 18, marginBottom: 10 }}>app/(tabs)/index.tsx · line 42</div>
                  {[
                    ["", "export default function Today() {"],
                    ["", "  const habits = useStore((s) => s.habits);"],
                    ["-", "  <Card style={styles.streak}>"],
                    ["+", "  <Card style={[styles.streak, { marginHorizontal: 16 }]}>"],
                    ["", "    <Text style={styles.title}>Streak</Text>"],
                  ].map(([k, l], j) => (
                    <div key={j} style={{ whiteSpace: "pre", color: k === "+" ? "#7ee787" : k === "-" ? "#ffa198" : C.ink300, background: k === "+" ? "rgba(46,160,67,.15)" : k === "-" ? "rgba(248,81,73,.12)" : undefined }}>
                      {k || " "} {l}
                    </div>
                  ))}
                </div>
              </div>
              {/* Activity: the agent at work, model by model */}
              <div style={{ width: 470, borderLeft: "1px solid rgba(255,255,255,.08)", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontFamily: mono, fontSize: 17, letterSpacing: 3, color: C.ink500, textTransform: "uppercase" }}>Activity</div>
                {activity.map((a, k) => {
                  const p = pop(f, a.at);
                  return (
                    <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
                      <div style={{ display: "inline-block", fontFamily: mono, fontSize: 15, color: a.c, padding: "2px 10px", borderRadius: 8, background: `${a.c}1f` }}>{a.m}</div>
                      <div style={{ fontSize: 21, marginTop: 6, color: C.ink100 }}>{a.t}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- Mac terminal

function Terminal({ f }: { f: number }) {
  const cmd = "curl -fsSL https://sparkflow-ai.web.app/install.sh | bash";
  const n = Math.floor(interpolate(f, [40, 90], [0, cmd.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const run = f > 100;
  const done = f > 125;
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 24,
        padding: "16px 26px",
        borderRadius: 18,
        background: "rgba(10,12,16,.92)",
        border: "1px solid rgba(255,255,255,.12)",
        color: C.ink100,
        display: "flex",
        gap: 22,
        alignItems: "center",
        opacity: ease(f, 30, 12),
        minWidth: 1060,
      }}>
      <span>
        <span style={{ color: C.green }}>$</span> {run ? "sparkflow" : cmd.slice(0, n)}
        {!run && <span style={{ color: C.sky, opacity: f % 24 < 12 ? 1 : 0 }}>▍</span>}
      </span>
      {done && <span style={{ color: C.green, opacity: ease(f, 125, 10) }}>✓ Connected to sparkflow-ai.web.app</span>}
    </div>
  );
}

// ---------------------------------------------------------------- Share and ship

export function ShareShip() {
  const f = useCurrentFrame();
  const role = f < 70 ? 0 : f < 95 ? 1 : 2;
  const people = [
    { i: "AG", c: C.blue },
    { i: "MK", c: C.violet },
    { i: "SL", c: C.green },
  ];
  const ship = [
    { t: "Expo Go", d: "Scan the QR code", c: C.ink100 },
    { t: "Release build", d: "Its own name and bundle ID", c: C.sky },
    { t: "TestFlight", d: "Upload with fastlane", c: C.blue },
    { t: "Google Play", d: "Internal track", c: C.green },
    { t: "GitHub", d: "Create the repo and push", c: C.ink300 },
    { t: "Export", d: "The code is yours", c: C.amber },
  ];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker color={C.violet}>08 · Share and ship</Kicker>
        </Reveal>
        <Reveal at={5}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, marginTop: 14 }}>
            Bring friends in. <span style={gradientText}>Send it to the stores.</span>
          </div>
        </Reveal>
        <div style={{ display: "flex", gap: 40, marginTop: 56 }}>
          <Card style={{ flex: 1, opacity: pop(f, 20), padding: 34 }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Share “Habits”</div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <div style={{ flex: 1, fontFamily: mono, fontSize: 19, color: C.ink300, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                sparkflow-ai.web.app/join/cloud-eu/t1.…
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, padding: "14px 20px", borderRadius: 14, background: f > 110 ? C.green : C.blue, color: "white" }}>{f > 110 ? "Copied" : "Copy link"}</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 20, padding: 6, borderRadius: 14, background: "rgba(255,255,255,.05)", width: "fit-content" }}>
              {["View", "Comment", "Edit"].map((r, k) => (
                <div key={r} style={{ fontSize: 21, fontWeight: 600, padding: "9px 22px", borderRadius: 10, background: k === role ? "rgba(255,255,255,.14)" : "transparent", color: k === role ? C.ink100 : C.ink500 }}>
                  {r}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30 }}>
              <div style={{ display: "flex" }}>
                {people.map((p, k) => {
                  const s = pop(f, 120 + k * 10);
                  return (
                    <div key={p.i} style={{ width: 58, height: 58, borderRadius: 29, marginLeft: k ? -14 : 0, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, background: p.c, border: `3px solid ${C.ink800}`, transform: `scale(${s})` }}>
                      {p.i}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 22, color: C.ink400, opacity: ease(f, 150, 12) }}>3 people · in the cloud or from your Mac</div>
            </div>
            <div style={{ marginTop: 26, display: "flex", gap: 14, alignItems: "flex-start", opacity: ease(f, 170, 14) }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: C.violet, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700 }}>MK</div>
              <div style={{ fontSize: 22, padding: "12px 18px", borderRadius: "4px 18px 18px 18px", background: "rgba(139,92,246,.18)", border: "1px solid rgba(139,92,246,.35)" }}>
                On Today: can the streak be orange? 🔥
              </div>
            </div>
          </Card>
          <Card style={{ width: 760, opacity: pop(f, 34), padding: 34 }}>
            <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 18 }}>Ship</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {ship.map((s, k) => {
                const p = pop(f, 60 + k * 14);
                return (
                  <div key={s.t} style={{ padding: "18px 20px", borderRadius: 18, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: s.c }}>{s.t}</div>
                      <span style={{ color: C.green, fontWeight: 800, opacity: ease(f, 100 + k * 14, 10) }}>✓</span>
                    </div>
                    <div style={{ fontSize: 20, color: C.ink400, marginTop: 6 }}>{s.d}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}
