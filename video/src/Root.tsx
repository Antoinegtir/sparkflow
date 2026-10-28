import { AbsoluteFill, Composition, Series } from "remotion";
import { C, FPS } from "./theme";
import { Built, Hook, Impact, Intro, MetaModels, Native, Outro, Pipeline, PointTalk, Problem, Stack, STEP_LEN } from "./scenes";

const SCENES = [
  { c: Hook, d: 130 },
  { c: Problem, d: 260 },
  { c: Intro, d: 160 },
  { c: Impact, d: 230 },
  { c: Pipeline, d: STEP_LEN * 5 },
  { c: PointTalk, d: 270 },
  { c: Native, d: 260 },
  { c: MetaModels, d: 300 },
  { c: Stack, d: 210 },
  { c: Built, d: 260 },
  { c: Outro, d: 200 },
];
const TOTAL = SCENES.reduce((n, s) => n + s.d, 0);

function Sparkflow() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Series>
        {SCENES.map(({ c: Scene, d }, i) => (
          <Series.Sequence key={i} durationInFrames={d}>
            <Scene />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

export function Root() {
  return <Composition id="Sparkflow" component={Sparkflow} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />;
}
