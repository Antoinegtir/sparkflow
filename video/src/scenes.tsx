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
              <span style={{ color: C.sky }}>●</span> Powered by Muse Spark
            </Chip>
            <Chip>SAM 3.1</Chip>
            <Chip>React Native · Expo</Chip>
          </div>
        </Reveal>
      </Center>
    </Fade>
  );
}

// ---------------------------------------------------------------- 4. Pipeline

const STEPS = [
  { k: "01 · Describe", t: "Text, a sketch or your voice.", b: "Muse Spark reads all three. SAM 3.1 cuts a paper sketch into buttons, cards and lists." },
  { k: "02 · Plan", t: "Screens, navigation, data.", b: "Every screen gets visual acceptance criteria, checkable on one screenshot." },
  { k: "03 · Build", t: "Real React Native.", b: "The Builder writes Expo code with tools, typechecks it and fixes its own errors." },
  { k: "04 · Look", t: "It opens the app.", b: "Screenshot, accessibility tree, console. Muse Spark checks each criterion with its own eyes." },
  { k: "05 · Fix", t: "Wrong? It sees why.", b: "The rejected screenshot goes back to the Builder until every page passes." },
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
          <Kicker style={{ textAlign: "center" }}>07 · Native, for real</Kicker>
        </Reveal>
        <Reveal at={6}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2.5, marginTop: 14, textAlign: "center" }}>
            Live on the iOS Simulator <span style={{ color: C.ink500 }}>and</span> the Android emulator.
          </div>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 120, top: 250 }}>
        <div style={{ position: "relative", opacity: a, transform: `translateY(${(1 - a) * 200}px)` }}>
          <OffthreadVideo src={staticFile("apple.webm")} muted style={{ position: "absolute", width: 340, left: -320, top: 120, opacity: 0.95, maskImage: "radial-gradient(circle, black 40%, transparent 68%)" }} />
          <Phone scale={0.7} glow="rgba(10,132,255,.4)">
            <HabitApp t={1} glass={glass > 0.5} />
          </Phone>
        </div>
        <div style={{ position: "relative", opacity: b, transform: `translateY(${(1 - b) * 200}px)` }}>
          <OffthreadVideo src={staticFile("android.webm")} muted style={{ position: "absolute", width: 340, right: -320, top: 120, opacity: 0.95, maskImage: "radial-gradient(circle, black 40%, transparent 68%)" }} />
          <Phone scale={0.67} android glow="rgba(48,209,88,.35)">
            <HabitApp t={1} accent="#1a73e8" />
          </Phone>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 60 }}>
        <div style={{ display: "flex", gap: 16, opacity: ease(f, 130, 16) }}>
          <Chip>
            <span style={{ color: C.sky }}>◆</span> Real Liquid Glass, not a CSS fake
          </Chip>
          <Chip>Mobile skills: haptics · sheets · gestures</Chip>
          <Chip>Expo Go · your own RN app</Chip>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}

// ---------------------------------------------------------------- 7. Under the hood

export function Stack() {
  const f = useCurrentFrame();
  const roles = [
    { n: "Planner", d: "Muse Spark · text, sketch, voice → plan", c: C.sky },
    { n: "Builder", d: "Muse Spark · tools, typecheck, git", c: C.blue },
    { n: "Verifier", d: "Muse Spark vision · screenshots, a11y", c: C.violet },
    { n: "Segmenter", d: "SAM 3.1 · sketch → components", c: C.green },
  ];
  return (
    <Fade>
      <Backdrop />
      <AbsoluteFill style={{ padding: "110px 160px", fontFamily: sans, color: C.ink100 }}>
        <Reveal at={0}>
          <Kicker>Agentic, and verifiable</Kicker>
        </Reveal>
        <Reveal at={5}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, marginTop: 16 }}>
            Four agents, <span style={gradientText}>one loop.</span>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginTop: 60 }}>
          {roles.map((r, k) => {
            const p = pop(f, 20 + k * 8);
            return (
              <Card key={r.n} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ width: 18, height: 72, borderRadius: 9, background: r.c, boxShadow: `0 0 30px ${r.c}` }} />
                <div>
                  <div style={{ fontSize: 42, fontWeight: 700 }}>{r.n}</div>
                  <div style={{ fontSize: 26, color: C.ink400, marginTop: 6 }}>{r.d}</div>
                </div>
              </Card>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 50, opacity: ease(f, 70, 16) }}>
          {["React Native", "Expo Router", "TypeScript", "Playwright", "idb · adb", "git versions"].map((t) => (
            <Chip key={t} style={{ fontSize: 22, color: C.ink300 }}>
              {t}
            </Chip>
          ))}
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
        <Reveal at={36}>
          <div style={{ marginTop: 26, fontSize: 26, color: C.ink500, letterSpacing: 3, textTransform: "uppercase", fontFamily: mono }}>Meta AI Developer Hackathon · Built with Muse Spark</div>
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
    { m: "Muse Spark 1.3", r: "Plans, writes the code with tools, and judges every screenshot with vision", c: C.sky },
    { m: "Muse Spark 1.2 · audio", r: "Understands voice memos: describe an app, or say “bigger, in purple”", c: C.blue },
    { m: "SAM 3.1", r: "Segments a paper sketch into buttons, cards and lists for the Planner", c: C.green },
    { m: "Muse Image 1.0", r: "Generates the app's illustrations and artwork as a Builder tool", c: C.violet },
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 56 }}>
          {models.map((x, k) => {
            const p = pop(f, 24 + k * 12);
            return (
              <div key={x.m} style={{ display: "flex", alignItems: "center", gap: 32, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
                <div style={{ width: 470, flexShrink: 0, fontSize: 40, fontWeight: 700, color: x.c }}>{x.m}</div>
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
    "Sketch segmentation with SAM 3.1",
    "Voice requests",
    "Live iOS Simulator, point and talk",
    "Bring your own React Native app",
    "Mobile skills: real Liquid Glass, haptics…",
    "Android emulator",
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 60px", marginTop: 90 }}>
          {items.map((t, k) => (
            <div key={t} style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 32, opacity: ease(f, 30 + k * 8, 14) }}>
              <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 56, opacity: ease(f, 110, 16) }}>
          <Chip style={{ fontSize: 22 }}>Open source on GitHub</Chip>
          <Chip style={{ fontSize: 22 }}>One-line install</Chip>
          <Chip style={{ fontSize: 22 }}>Ships as versioned releases</Chip>
        </div>
      </AbsoluteFill>
    </Fade>
  );
}
