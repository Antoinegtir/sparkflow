// Playwright inspector. Usage: node inspect.mjs <job-dir>
// Reads <job-dir>/job.json, writes <job-dir>/result.json plus PNG/WebM files, prints SPARKFLOW_INSPECT_DONE.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const dir = process.argv[2];
const job = JSON.parse(await readFile(path.join(dir, "job.json"), "utf8"));
const viewport = job.viewport ?? { width: 390, height: 844 };
const navTimeout = job.navigationTimeoutMs ?? 120000;
const settle = job.settleMs ?? 700;

const OVERLAY = /Uncaught Error|Render Error|Unable to resolve module|SyntaxError|Failed to compile|TransformError|is not defined|Cannot read propert|Element type is invalid|Unexpected token/;

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox"] });

// Runs in the page: contrast, touch targets, labels, horizontal overflow.
function auditPage() {
  const issues = [];
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) >= 0.1;
  };
  const bgOf = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const tid = (el) => el.closest("[data-testid]")?.getAttribute("data-testid") ?? undefined;

  let texts = 0;
  const seen = new Set();
  for (const el of document.querySelectorAll("div,span,p,a,button,label,h1,h2,h3")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!own || /^[-\s]+$/.test(own) || !visible(el)) continue;
    texts++;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const r = ratio(blend(fg, bg), bg);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const min = large ? 3 : 4.5;
    if (r < min && !seen.has(own)) {
      seen.add(own);
      issues.push({ kind: "contrast", severity: r < min - 1.5 ? "high" : "low", message: `Low contrast ${r.toFixed(1)}:1 on "${own.slice(0, 40)}" (needs ${min}:1)`, testId: tid(el) });
    }
  }
  let controls = 0;
  const sel = '[role=button],[role=link],[role=switch],[role=checkbox],[role=tab],button,a[href],input,textarea';
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    controls++;
    const r = el.getBoundingClientRect();
    const name = el.getAttribute("aria-label") || el.innerText?.trim() || el.getAttribute("placeholder") || el.getAttribute("title") || el.querySelector("img[alt]")?.getAttribute("alt");
    if (!name) issues.push({ kind: "label", severity: "low", message: "Control without an accessible name", testId: tid(el) });
    const small = Math.min(r.width, r.height);
    if (small < 43.5) {
      issues.push({ kind: "touch-target", severity: small < 24 ? "high" : "low", message: `Touch target ${Math.round(r.width)}×${Math.round(r.height)} (needs 44×44)`, testId: tid(el) });
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 2) {
    issues.push({ kind: "overflow", severity: "high", message: `Content overflows horizontally (${document.documentElement.scrollWidth}px wide)` });
  }
  return { issues: issues.slice(0, 40), checked: { texts, controls } };
}

const score = (issues) => {
  const high = issues.filter((i) => i.severity === "high").length;
  return Math.max(0, 100 - 12 * high - 3 * (issues.length - high));
};

const results = [];
for (const [ti, t] of job.targets.entries()) {
  const t0 = Date.now();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: job.deviceScaleFactor ?? 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: job.colorScheme ?? "light",
    ...(t.record ? { recordVideo: { dir, size: viewport } } : {}),
  });
  const page = await context.newPage();
  const consoleMsgs = [];
  const pageErrors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 500)}`));
  page.on("pageerror", (e) => pageErrors.push(String(e.stack || e.message).slice(0, 1500)));
  const out = { name: t.name, finalPath: t.path, httpStatus: null, ok: false, error: null, screenshot: null, stepShots: [], aria: "", testIds: [], console: consoleMsgs, pageErrors, bodyText: "", errorOverlay: false, audit: null, video: null, durationMs: 0 };
  try {
    const res = await page.goto(new URL(t.path, job.baseUrl).toString(), { waitUntil: "load", timeout: navTimeout });
    out.httpStatus = res?.status() ?? null;
    out.ok = !!res && res.status() < 400;
    if (res && res.status() >= 500) {
      // Static-render crashes come back as a 500 page with the error in #_expo-static-error.
      out.bodyText = (await page.locator("#_expo-static-error").innerText().catch(() => "")) || (await page.innerText("body").catch(() => ""));
    }
    await page.waitForFunction(() => document.querySelector("[data-testid]") || document.body.innerText.trim(), null, { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(settle);
    for (const s of t.steps ?? []) {
      const q = s.testId ? page.locator(`[data-testid="${s.testId}"]`).first() : null;
      if (s.action === "click") await q.click({ timeout: 5000 });
      else if (s.action === "fill") await q.locator("input,textarea").first().or(q).first().fill(s.value, { timeout: 5000 });
      else if (s.action === "press") await page.keyboard.press(s.key);
      else if (s.action === "scroll") await page.mouse.wheel(0, s.y);
      else if (s.action === "wait") await page.waitForTimeout(Math.min(5000, s.ms));
      else if (s.action === "goto") await page.goto(new URL(s.path, job.baseUrl).toString(), { waitUntil: "load", timeout: navTimeout });
      await page.waitForTimeout(400);
      if (t.shotAfterEachStep) out.stepShots.push(await page.screenshot());
    }
    out.finalPath = new URL(page.url()).pathname;
    out.screenshot = await page.screenshot();
    out.aria = (await page.locator("body").ariaSnapshot().catch(() => "")).slice(0, 8000);
    out.testIds = await page.evaluate(() =>
      [...document.querySelectorAll("[data-testid]")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.getAttribute("data-testid"), text: (el.innerText || "").trim().slice(0, 80), rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
        })
        .filter((t) => t.rect.width > 0 && t.rect.height > 0)
        .slice(0, 200),
    );
    if (!out.bodyText) out.bodyText = (await page.innerText("body").catch(() => "")).slice(0, 3000);
    out.errorOverlay = (out.httpStatus ?? 0) >= 500 || OVERLAY.test(out.bodyText) || (!out.testIds.length && !out.bodyText.trim());
    const audit = await page.evaluate(auditPage).catch(() => null);
    if (audit) out.audit = { ...audit, score: score(audit.issues) };
  } catch (err) {
    out.error = String(err.message || err).split("\n")[0].slice(0, 500);
    out.screenshot = await page.screenshot().catch(() => null);
  }
  out.durationMs = Date.now() - t0;
  const video = page.video();
  await context.close();
  // Binaries go to files; result.json references them by name.
  const save = async (buf, name) => (buf ? (await writeFile(path.join(dir, name), buf), name) : null);
  out.screenshot = await save(out.screenshot, `${ti}.png`);
  out.stepShots = await Promise.all(out.stepShots.map((b, i) => save(b, `${ti}-step${i}.png`)));
  out.video = video ? path.basename(await video.path()) : null;
  results.push(out);
}
await browser.close();
await writeFile(path.join(dir, "result.json"), JSON.stringify(results));
console.log("SPARKFLOW_INSPECT_DONE");
