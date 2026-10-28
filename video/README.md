# Sparkflow demo video

The Meta Global AI Developer Hackathon demo, made with [Remotion](https://remotion.dev): 1920×1080, 30 fps, about 1 min 50.

```bash
npm install
npm run studio   # preview and edit
npm run render   # out/sparkflow.mp4
```

Rendering without a Remotion-downloaded browser: set `REMOTION_CHROME` to a Chrome / headless shell binary.

- `src/Root.tsx`: the scene order and durations.
- `src/scenes.tsx`: one component per scene (hook, problem, intro, impact, pipeline, point and talk, native, Meta models, agents, built during the hackathon, end card).
- `src/ui.tsx`: backdrop, phone frames and the demo habit app.
- Fonts (Inter, JetBrains Mono) are bundled in `public/fonts`, so renders need no network.
