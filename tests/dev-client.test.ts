import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { devClientLink, metroUrlFor, pageLink, splitExpUrl, templateHash } from "../lib/web/dev-client-links";

describe("Sparkflow Dev", () => {
  it("splits Expo links into Metro host and page", () => {
    expect(splitExpUrl("exp://192.168.1.4:8100/--/(tabs)/stats")).toEqual({ host: "192.168.1.4:8100", secure: false, path: "/(tabs)/stats" });
    expect(splitExpUrl("exp://192.168.1.4:8100")).toEqual({ host: "192.168.1.4:8100", secure: false, path: "/" });
    expect(() => splitExpUrl("javascript:alert(1)")).toThrow();
  });

  it("points the Android emulator at the host through 10.0.2.2", () => {
    expect(metroUrlFor("ios", "exp://192.168.1.4:8100")).toBe("http://192.168.1.4:8100");
    expect(metroUrlFor("android", "exp://192.168.1.4:8100")).toBe("http://10.0.2.2:8100");
    expect(metroUrlFor("android", "exp://tunnel.example.com:443")).toBe("http://tunnel.example.com:443");
  });

  it("builds the dev client and page links", () => {
    expect(devClientLink("http://10.0.2.2:8100")).toBe("exp+sparkflow-dev://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8100");
    expect(pageLink("sparkflow", "/(tabs)/stats")).toBe("sparkflow://(tabs)/stats");
  });

  it("hashes only what the native build depends on", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-hash-"));
    try {
      await writeFile(path.join(dir, "package.json"), "{}");
      await writeFile(path.join(dir, "app.json"), "{}");
      await mkdir(path.join(dir, "plugins"));
      await writeFile(path.join(dir, "plugins", "a.js"), "1");
      const a = await templateHash(dir);
      await writeFile(path.join(dir, "App.tsx"), "changed");
      expect(await templateHash(dir)).toBe(a);
      await writeFile(path.join(dir, "plugins", "a.js"), "2");
      expect(await templateHash(dir)).not.toBe(a);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
