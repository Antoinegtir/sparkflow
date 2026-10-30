import { describe, expect, it } from "vitest";
import { rewriteImports } from "../lib/agent/rename";

const run = (files: Record<string, string>, moves: Record<string, string>) => Object.fromEntries(rewriteImports(new Map(Object.entries(files)), new Map(Object.entries(moves))));

describe("rewriteImports", () => {
  it("follows a renamed file in relative and @/ imports", () => {
    const out = run(
      {
        "app/index.tsx": `import { Card } from "../components/Card";\nimport Btn from "@/components/Button";\nimport x from "react";`,
        "components/Card.tsx": `export const Card = 1;`,
        "components/Button.tsx": `export default 1;`,
      },
      { "components/Card.tsx": "components/NoteCard.tsx" },
    );
    expect(out).toEqual({ "app/index.tsx": `import { Card } from "../components/NoteCard";\nimport Btn from "@/components/Button";\nimport x from "react";` });
  });

  it("rewrites a moved file's own relative imports, and @/ ones that point to it", () => {
    const out = run(
      {
        "lib/a.ts": `import { b } from "./b";\nexport * from "../constants/c";`,
        "lib/b.ts": `export const b = 1;`,
        "constants/c.ts": `export const c = 1;`,
        "app/x.tsx": `import { a } from "@/lib/a";\nconst m = require("../lib/a");\nconst d = import("@/lib/a");`,
      },
      { "lib/a.ts": "lib/util/a.ts" },
    );
    expect(out["lib/util/a.ts"]).toBe(`import { b } from "../b";\nexport * from "../../constants/c";`);
    expect(out["app/x.tsx"]).toBe(`import { a } from "@/lib/util/a";\nconst m = require("../lib/util/a");\nconst d = import("@/lib/util/a");`);
  });

  it("keeps folder imports pointing to the folder when its index moves with it", () => {
    const out = run(
      { "app/index.tsx": `import { Kit } from "../components/kit";`, "components/kit/index.ts": `export const Kit = 1;` },
      { "components/kit/index.ts": "components/ui/index.ts" },
    );
    expect(out["app/index.tsx"]).toBe(`import { Kit } from "../components/ui";`);
  });

  it("keeps an explicit extension and leaves unrelated files alone", () => {
    const out = run(
      { "a.ts": `import data from "./data.json";`, "data.json": "{}", "b.ts": `import { a } from "./a";` },
      { "data.json": "assets/data.json" },
    );
    expect(out).toEqual({ "a.ts": `import data from "./assets/data.json";` });
  });
});
