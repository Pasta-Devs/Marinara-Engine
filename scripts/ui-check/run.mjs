#!/usr/bin/env node
// ──────────────────────────────────────────────
// UI check: open every main screen at desktop, tablet and phone sizes (and in every starter theme) and fail on
// layout breakage: content cut off with nothing to scroll, popups out of the window, giant pictures, rows that are
// mostly empty space, buttons covered by something else, a page that scrolls sideways.
// ──────────────────────────────────────────────
//   pnpm ui:check                      fresh test server + data, every size, every starter theme on the core screens
//   pnpm ui:check --quick              no themes (about a third of the time)
//   pnpm ui:check --url http://127.0.0.1:7860   check an Engine that is already running (no test data is added
//                                      unless --seed; screens that need data it lacks are skipped)
//   --sizes desktop,phone   --screens home,characters   --themes dewglass,quiet-iris|none|all   --out dir
//   Also runs the core screens in real Vivaldi (100% and 110% zoom; scripts/perf/setup-vivaldi.sh downloads it)
//   and in real WebKit, Safari's engine, as an iPhone and an iPad with "Show tap timings" on
//   (scripts/perf/setup-webkit.sh installs it on Linux). --no-vivaldi / --no-webkit skip one; --quick skips both
//   and the themes.
//
// Writes <out>/report.html (every finding with a marked screenshot), findings.json and, with --webkit, the tap
// timings. Exit code 1 when anything is found. Known, intended exceptions go in scripts/ui-check/allow.json.
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import { detectLayoutProblems } from "./detectors.mjs";
import { screenList, seedFixtures } from "./screens.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

export const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  // Short windows are where pages get cut off (the Connections scroll bug).
  "desktop-short": { viewport: { width: 1280, height: 600 } },
  // iPad mini 6 sideways and upright, iPhone 13 mini: the devices kolache tests on.
  "tablet-landscape": { viewport: { width: 1133, height: 744 }, touch: "tablet" },
  "tablet-portrait": { viewport: { width: 744, height: 1133 }, touch: "tablet" },
  phone: { viewport: { width: 375, height: 812 }, touch: "phone" },
};

const out = resolve(option("out", join(repoRoot, ".tmp/ui-check")));
const sizes = option("sizes", Object.keys(SIZES).join(",")).split(",");
const onlyScreens = option("screens", "").split(",").filter(Boolean);
const themeArg = flag("quick") ? "none" : option("themes", "all");
const themeSizes = option("theme-sizes", "desktop,phone").split(",");
const concurrency = Number(option("jobs", "3"));
const allow = JSON.parse(readFileSync(join(repoRoot, "scripts/ui-check/allow.json"), "utf8"));

function log(...parts) {
  console.log(`[ui-check] ${parts.join(" ")}`);
}

// ── Server ──
async function waitFor(url, timeoutMs = 180_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not come up`);
}

async function startServer() {
  const dataDir = join(out, "data");
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  const clientPort = Number(process.env.UI_CHECK_CLIENT_PORT ?? 5188);
  const serverPort = Number(process.env.UI_CHECK_SERVER_PORT ?? 7981);
  if (!flag("skip-shared-build")) {
    log("building the shared package");
    await new Promise((ok, fail) =>
      spawn("pnpm", ["--filter", "@marinara-engine/shared", "build:preserve"], { cwd: repoRoot, stdio: "ignore" }).once(
        "exit",
        (code) => (code === 0 ? ok() : fail(new Error("shared build failed"))),
      ),
    );
  }
  log(`starting a test server on ${clientPort} (data in ${dataDir})`);
  const child = spawn(process.execPath, [join(repoRoot, "scripts/dev.mjs")], {
    cwd: repoRoot,
    // The dev server's own warnings drown the check's output; --verbose shows them.
    stdio: ["ignore", "ignore", flag("verbose") ? "inherit" : "ignore"],
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      MARINARA_ENV_FILE: join(dataDir, ".env"),
      DEV_SKIP_SHARED_BUILD: "true",
      UPDATES_APPLY_DISABLED: "true",
      PORT: String(serverPort),
      VITE_PORT: String(clientPort),
      VITE_HOST: "127.0.0.1",
      VITE_OPEN_BROWSER: "false",
      AUTO_OPEN_BROWSER: "false",
      AUTO_CREATE_DEFAULT_CONNECTION: "false",
      MARINARA_E2E_DISABLE_RATE_LIMIT: "true",
      LOG_LEVEL: "silent",
      LOG_DISABLE_REQUEST_LOGGING: "true",
      SKIP_PWA: "true",
    },
  });
  const url = `http://127.0.0.1:${clientPort}`;
  await waitFor(url);
  return { url, stop: () => child.kill("SIGTERM") };
}

function apiClient(base) {
  // node:http rather than fetch: Node 22's fetch (undici) crashed the whole run with an internal assertion when
  // the dev server dropped a kept-alive connection between calls.
  const call = (method, path, body) =>
    new Promise((ok, fail) => {
      const payload = body ? JSON.stringify(body) : null;
      const request = httpRequest(
        new URL(path, base),
        {
          method,
          agent: false,
          headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {},
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => (text += chunk));
          response.on("end", () => {
            if ((response.statusCode ?? 500) >= 400)
              fail(new Error(`${method} ${path}: ${response.statusCode} ${text.slice(0, 200)}`));
            else ok(text ? JSON.parse(text) : null);
          });
        },
      );
      request.on("error", fail);
      request.setTimeout(60_000, () => request.destroy(new Error(`${method} ${path}: timed out`)));
      if (payload) request.write(payload);
      request.end();
    });
  return {
    get: (path) => call("GET", path),
    post: (path, body = {}) => call("POST", path, body),
    put: (path, body = {}) => call("PUT", path, body),
  };
}

// ── Browser ──
async function newContext(browser, sizeName) {
  const size = SIZES[sizeName];
  const touch = size.touch
    ? {
        ...(size.touch === "phone" ? devices["iPhone 13 Mini"] : devices["iPad Mini"]),
        viewport: size.viewport,
        // Chromium standing in for Safari: the layout code keys off size and touch, not the engine.
        defaultBrowserType: undefined,
      }
    : { viewport: size.viewport };
  delete touch.defaultBrowserType;
  const context = await browser.newContext({ ...touch, reducedMotion: "reduce" });
  const version = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
  await context.addInitScript(
    ({ version, touch }) => {
      localStorage.setItem("marinara:ui-check", "1");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (!localStorage.getItem("marinara:guide-quests:v1"))
        localStorage.setItem("marinara:guide-quests:v1", JSON.stringify({ offer: "skipped" }));
      // Phones and tablets are always checked with Settings > Advanced > Troubleshooting > "Show tap timings" on.
      if (touch) localStorage.setItem("marinara-tap-timings", "1");
      // Every device walkthrough and chat-mode tip already seen (lib/walkthroughs.ts).
      const devices = ["desktop", "tablet", "phone"];
      localStorage.setItem(
        "marinara-walkthroughs-seen",
        JSON.stringify({
          devices,
          modes: devices.flatMap((d) => ["conversation", "roleplay", "game"].map((m) => `${d}:${m}`)),
        }),
      );
      const stored = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "null");
      if (!stored)
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            version: 105,
            state: {
              hasCompletedOnboarding: true,
              chibiProfessorMariEnabled: false,
              chatWindowIntroDismissed: true,
              seasonalThemesDisabled: true,
              chatHelpSeenModes: ["conversation", "roleplay", "game"],
              convoNotificationSound: false,
              rpNotificationSound: false,
              gameNotificationSound: false,
            },
          }),
        );
    },
    { version, touch: Boolean(size.touch) },
  );
  return context;
}

/** Wait until the page stops changing: no running animations, fonts in, nothing new for a moment. */
async function settle(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(
      () => {
        const busy = document
          .getAnimations()
          .some((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity);
        const state = (window.__uiCheckSettle ??= { html: 0, since: performance.now() });
        const size = document.body.innerHTML.length;
        if (size !== state.html || busy) {
          state.html = size;
          state.since = performance.now();
        }
        // A lazy page or drawer still saying "Loading…" isn't the layout people get to use.
        const loading = [...document.querySelectorAll("p, span, div")].some(
          (el) => el.childElementCount === 0 && /^Loading\b/.test(el.textContent.trim()) && el.getClientRects().length,
        );
        return !loading && document.fonts.status === "loaded" && performance.now() - state.since > 400;
      },
      null,
      { timeout: 12000, polling: 150 },
    )
    .catch(() => undefined);
  await page.evaluate(() => delete window.__uiCheckSettle);
}

async function closeIntro(page) {
  for (const name of ["Skip Tutorial", "Got it", "I know this, skip"]) {
    const button = page.getByRole("button", { name, exact: true }).filter({ visible: true });
    if (await button.count())
      await button
        .first()
        .click()
        .catch(() => undefined);
  }
}

async function markAndShoot(page, findings, file) {
  await page.evaluate((findings) => {
    const layer = document.createElement("div");
    layer.id = "ui-check-marks";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    for (const [i, f] of findings.entries()) {
      if (!f.rect) continue;
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;left:${f.rect.x}px;top:${f.rect.y}px;width:${f.rect.w}px;height:${f.rect.h}px;outline:3px solid #ff2d55;outline-offset:-1px;background:rgba(255,45,85,.08)`;
      const tag = document.createElement("span");
      tag.textContent = String(i + 1);
      tag.style.cssText =
        "position:absolute;left:0;top:0;background:#ff2d55;color:#fff;font:700 12px/16px sans-serif;padding:0 4px";
      box.append(tag);
      layer.append(box);
    }
    document.body.append(layer);
  }, findings);
  await page.screenshot({ path: file });
  await page.evaluate(() => document.getElementById("ui-check-marks")?.remove());
}

async function check(page, label) {
  // The pointer rests mid-page, where a person reading it would leave it: at 0,0 it would hold the auto-hiding
  // top bar open over the sidebar.
  const size = page.viewportSize();
  if (size) await page.mouse.move(size.width / 2, size.height / 2);
  await page.waitForTimeout(350);
  const findings = await page.evaluate(detectLayoutProblems, { allow: allow.checks ?? {} });
  return findings.map((f) => ({ ...f, at: label }));
}

async function runScreen(browser, base, sizeName, screen, theme, results) {
  const context = await newContext(browser, sizeName);
  const page = await context.newPage();
  // Keep this page off UI settings saved on the server (a finished tutorial, an accent from another run).
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message ?? error)));
  const key = `${theme ?? "default"}/${sizeName}/${screen.id}`;
  const entry = { key, theme: theme ?? "default", size: sizeName, screen: screen.id, findings: [], shots: [], errors };
  try {
    await page.goto(base);
    await page.waitForFunction(
      () => window.__marinaraUiCheck && document.querySelector("#root")?.textContent.trim(),
      null,
      {
        timeout: 60_000,
      },
    );
    await settle(page);
    await closeIntro(page);
    if (screen.run) {
      const [source, argument] = screen.run;
      await page.evaluate(([source, argument]) => (0, eval)(`(${source})`)(argument), [source, argument]);
      await settle(page);
    }
    if (screen.then) {
      const skip = await screen.then(page);
      if (typeof skip === "string") entry.skipped = skip;
      await settle(page);
    }
    if (entry.skipped) throw Object.assign(new Error("skipped"), { skipped: true });
    const steps = [{ label: "page", findings: await check(page, "page") }];
    if (screen.walkTabs !== false) {
      // Every tab of the page (an editor's Description / Advanced / …): each is its own layout.
      const tabs = page
        .locator("main [role=tablist] [role=tab], [data-mari-part=page] [role=tablist] [role=tab]")
        .filter({ visible: true });
      const count = Math.min(await tabs.count(), 14);
      for (let i = 1; i < count; i++) {
        const tab = tabs.nth(i);
        const name = ((await tab.textContent()) ?? `tab ${i}`).replace(/\s+/g, " ").trim().slice(0, 30);
        if (!(await tab.isVisible())) continue;
        await tab.click({ timeout: 3000 }).catch(() => undefined);
        await settle(page);
        steps.push({ label: `tab "${name}"`, findings: await check(page, `tab "${name}"`) });
      }
    }
    for (const step of steps) {
      if (!step.findings.length) continue;
      entry.findings.push(...step.findings);
    }
    if (entry.findings.length) {
      const file = join(out, "shots", `${key.replaceAll("/", "__")}.png`);
      mkdirSync(dirname(file), { recursive: true });
      // The last step is on screen; mark what it found (earlier tabs are listed in text).
      await markAndShoot(page, steps.at(-1).findings, file);
      entry.shots.push(file);
    }
  } catch (error) {
    if (!error.skipped) entry.failed = String(error.message ?? error).split("\n")[0];
  } finally {
    await context.close();
  }
  results.push(entry);
  const status = entry.skipped
    ? `skipped (${entry.skipped})`
    : entry.failed
      ? `could not open: ${entry.failed}`
      : entry.findings.length
        ? `${entry.findings.length} problem(s)`
        : "ok";
  log(key, status);
}

async function pool(jobs, size) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]();
    }),
  );
}

function writeReport(results, extra) {
  const withProblems = results.filter((r) => r.findings.length || r.failed);
  const total = results.reduce((n, r) => n + r.findings.length, 0);
  writeFileSync(join(out, "findings.json"), JSON.stringify({ total, results, ...extra }, null, 2));
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rows = withProblems
    .map(
      (r) => `<section><h2>${esc(r.key)}</h2>${r.failed ? `<p class="fail">Could not open: ${esc(r.failed)}</p>` : ""}
<ol>${r.findings.map((f) => `<li><b>${esc(f.check)}</b> ${esc(f.at)} · <code>${esc(f.where)}</code> ${f.text ? `“${esc(f.text)}”` : ""}<br>${esc(f.detail)}</li>`).join("")}</ol>
${r.shots.map((s) => `<img loading="lazy" src="${esc(s.slice(out.length + 1))}">`).join("")}</section>`,
    )
    .join("\n");
  const timings = extra.tapTimings
    ? `<section><h2>Tap timings (WebKit, Show tap timings on)</h2><pre>${esc(extra.tapTimings)}</pre></section>`
    : "";
  writeFileSync(
    join(out, "report.html"),
    `<!doctype html><meta charset="utf-8"><title>UI check</title>
<style>body{font:14px system-ui;margin:24px;max-width:1200px}section{border-top:1px solid #ccc;padding:12px 0}img{max-width:100%;border:1px solid #ccc}code{font-size:12px}.fail{color:#c00}</style>
<h1>UI check: ${total} problem(s) on ${withProblems.length} of ${results.length} screens</h1>
<p>${esc(new Date().toISOString())} · sizes ${esc(sizes.join(", "))} · themes ${esc(extra.themes.join(", ") || "default")}${extra.vivaldi ? ` · Vivaldi ${esc(extra.vivaldi)}` : ""}</p>
${timings}${rows || "<p>Nothing found.</p>"}`,
  );
  return { total, withProblems: withProblems.length };
}

/** What has been checked so far, written out even when the run dies half way. */
const partial = { results: [], themes: [] };

async function main() {
  mkdirSync(out, { recursive: true });
  rmSync(join(out, "shots"), { recursive: true, force: true });
  const external = option("url", "");
  const server = external ? { url: external.replace(/\/$/, ""), stop: () => {} } : await startServer();
  try {
    const api = apiClient(server.url);
    let ids = {};
    if (!external || flag("seed")) {
      log("adding test data");
      ids = await seedFixtures(api);
    }
    const screens = screenList(ids).filter(
      (screen) =>
        (!onlyScreens.length || onlyScreens.includes(screen.id)) &&
        !(screen.run?.[2] === "needs-data" && screen.run[1] === undefined),
    );
    const browser = await chromium.launch({ args: ["--disable-audio-output", "--mute-audio"] });
    const results = partial.results;
    // 1. Every screen, every size, the app's own look.
    await pool(
      sizes.flatMap((size) =>
        screens.map((screen) => () => runScreen(browser, server.url, size, screen, null, results)),
      ),
      concurrency,
    );
    // 2. Every starter theme on the core screens (themes restyle the same pages; desktop + phone catch most).
    let themes = [];
    if (themeArg !== "none") {
      const gallery = (await api.get("/api/themes/gallery")).themes.map((t) => t.id);
      themes = themeArg === "all" ? gallery : themeArg.split(",").filter((id) => gallery.includes(id));
      partial.themes = themes;
      const previous = await api.get("/api/themes/active").catch(() => null);
      for (const theme of themes) {
        const installed = await api.post(`/api/themes/gallery/${encodeURIComponent(theme)}`);
        await api.put("/api/themes/active", { id: installed.id });
        await pool(
          themeSizes
            .filter((size) => SIZES[size])
            .flatMap((size) =>
              screens
                .filter((s) => s.group === "core")
                .map((screen) => () => runScreen(browser, server.url, size, screen, theme, results)),
            ),
          concurrency,
        );
      }
      await api.put("/api/themes/active", { id: previous?.id ?? null }).catch(() => undefined);
    }
    await browser.close();
    let tapTimings = null;
    let vivaldi = null;
    // 3. Real Vivaldi (kolache's browser) at 100% and 110% zoom, and 4. real WebKit (Safari) as an iPhone and an iPad.
    if (flag("vivaldi") || (!flag("quick") && !flag("no-vivaldi"))) {
      const { runVivaldi } = await import("./vivaldi.mjs");
      vivaldi = await runVivaldi(server.url, allow, results, out, screens).catch((error) => {
        results.push({
          key: "vivaldi",
          theme: "default",
          size: "vivaldi",
          screen: "-",
          findings: [],
          shots: [],
          errors: [],
          failed: String(error.message ?? error),
        });
        return null;
      });
    }
    if (flag("webkit") || (!flag("quick") && !flag("no-webkit"))) {
      const { runWebKit } = await import("./webkit.mjs");
      tapTimings = await runWebKit(server.url, allow, results, out, screens).catch((error) => {
        results.push({
          key: "webkit",
          theme: "default",
          size: "webkit",
          screen: "-",
          findings: [],
          shots: [],
          errors: [],
          failed: String(error.message ?? error),
        });
        return null;
      });
    }
    results.sort((a, b) => a.key.localeCompare(b.key));
    const { total, withProblems } = writeReport(results, { themes, tapTimings, vivaldi });
    log(`${total} problem(s) on ${withProblems} of ${results.length} screens. Report: ${join(out, "report.html")}`);
    process.exitCode = total || results.some((r) => r.failed) ? 1 : 0;
  } finally {
    server.stop();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const die = (error) => {
    console.error(error);
    if (partial.results.length) writeReport(partial.results, { themes: partial.themes, tapTimings: null });
    process.exit(2);
  };
  process.on("uncaughtException", die);
  main().catch(die);
}
