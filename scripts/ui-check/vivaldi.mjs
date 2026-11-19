// ──────────────────────────────────────────────
// UI check, Vivaldi pass: the core screens in the real Vivaldi browser, at 100% and 110% page zoom
// ──────────────────────────────────────────────
// Vivaldi is built on Chromium but measures some layouts differently from plain Chromium (Home's widgets shook in
// it on Nov 17 and grew several screens tall on Nov 19, neither showed in headless Chromium). Playwright cannot
// attach to Vivaldi (its own interface runs as pages it waits on), so this drives it over the DevTools protocol
// directly: one tab, Runtime.evaluate, Page.captureScreenshot. scripts/perf/setup-vivaldi.sh downloads Vivaldi;
// VIVALDI_PATH points at your own copy instead (on a Mac: /Applications/Vivaldi.app/Contents/MacOS/Vivaldi).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLayoutProblems } from "./detectors.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** kolache's Vivaldi runs at 110% page zoom; 100% is everyone else. Zoom = a smaller CSS window at a higher pixel ratio. */
export const VIVALDI_SIZES = {
  "vivaldi-110": { width: 1440, height: 900, zoom: 1.1 },
  "vivaldi-short-110": { width: 1280, height: 640, zoom: 1.1 },
  "vivaldi-100": { width: 1280, height: 800, zoom: 1 },
};

function vivaldiPath() {
  if (process.env.VIVALDI_PATH) return process.env.VIVALDI_PATH;
  const setup = resolve(here, "../perf/setup-vivaldi.sh");
  const found = spawnSync("bash", [setup, "--path"], { encoding: "utf8" });
  if (found.status === 0) return found.stdout.trim();
  const installed = spawnSync("bash", [setup], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (installed.status !== 0) throw new Error("Could not install Vivaldi (scripts/perf/setup-vivaldi.sh)");
  return installed.stdout.trim().split("\n").at(-1);
}

export async function startVivaldi() {
  const port = Number(process.env.VIVALDI_QC_PORT ?? 9333);
  const profile = mkdtempSync(join(tmpdir(), "ui-check-vivaldi-"));
  const flags = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1600,1100",
    ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  const binary = vivaldiPath();
  // The real windowed browser (not headless, which is plain Chromium underneath). On a Linux box with no screen,
  // xvfb-run gives it one.
  const headless = process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
  const child = headless
    ? // Displays from :140 up, clear of the WebKit check's :99.
      spawn("xvfb-run", ["-a", "-n", "140", "-s", "-screen 0 1700x1200x24", binary, ...flags], {
        stdio: "ignore",
        detached: true,
      })
    : spawn(binary, flags, { stdio: "ignore", detached: true });
  const base = `http://127.0.0.1:${port}`;
  let version = null;
  for (let i = 0; i < 120 && !version; i++) {
    await sleep(500);
    version = await fetch(`${base}/json/version`)
      .then((r) => r.json())
      .catch(() => null);
  }
  if (!version) throw new Error("Vivaldi did not start");
  return {
    base,
    version: version.Browser,
    stop: () => {
      // The whole group: xvfb-run, its X server and every Vivaldi process.
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      spawnSync("pkill", ["-f", `user-data-dir=${profile}`]);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

export async function openTab(base, url) {
  // The tab Vivaldi opened at start (about:blank). A tab made over the protocol stays in the background, where
  // Vivaldi never answers for it.
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    const list = await fetch(`${base}/json/list`).then((r) => r.json());
    target = list.find((t) => t.type === "page" && !t.url.startsWith("chrome-extension:"));
    if (!target) await sleep(250);
  }
  if (!target) throw new Error("Vivaldi has no tab to drive");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    socket.onopen = ok;
    socket.onerror = () => fail(new Error("could not reach the Vivaldi tab"));
  });
  let next = 0;
  const waiting = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const call = waiting.get(message.id);
    if (!call) return;
    waiting.delete(message.id);
    if (message.error) call.fail(new Error(message.error.message));
    else call.ok(message.result);
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = ++next;
      waiting.set(id, { ok, fail });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  // The start tab answers nothing until it has loaded a page.
  await send("Page.navigate", { url });
  await sleep(1000);
  return {
    send,
    evaluate,
    async size({ width, height, zoom }) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: Math.round(width / zoom),
        height: Math.round(height / zoom),
        deviceScaleFactor: zoom,
        mobile: false,
      });
    },
    async load(url) {
      await send("Page.navigate", { url });
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        if (
          await evaluate(`!!(window.__marinaraUiCheck && document.querySelector("#root")?.textContent.trim())`).catch(
            () => false,
          )
        )
          return;
      }
      throw new Error("the app did not load (is the ui-check hook in this build?)");
    },
    async screenshot(file) {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(data, "base64"));
      return file;
    },
    async close() {
      socket.close();
      await fetch(`${base}/json/close/${target.id}`).catch(() => undefined);
    },
  };
}

const PREPARE = `(() => {
  localStorage.setItem("marinara:ui-check", "1");
  localStorage.setItem("marinara:guide-quests:v1", JSON.stringify({ offer: "skipped" }));
  const devices = ["desktop", "tablet", "phone"];
  localStorage.setItem("marinara-walkthroughs-seen", JSON.stringify({ devices, modes: devices.flatMap((d) => ["conversation", "roleplay", "game"].map((m) => d + ":" + m)) }));
})()`;

const SKIP_INTRO = `(() => {
  for (const b of document.querySelectorAll("button")) if (b.offsetParent && /^(Skip Tutorial|Got it|I know this, skip)$/.test(b.textContent.trim())) b.click();
})()`;

/** Home's widgets measured three times a second apart: any that keeps changing size is a feedback loop. */
const HOME_STABLE = `(async () => {
  const read = () => Object.fromEntries([...document.querySelectorAll("[data-home-widget-id]")].map((w) => [w.dataset.homeWidgetId, w.offsetHeight]));
  const samples = [];
  for (let i = 0; i < 3; i++) { samples.push(read()); await new Promise((r) => setTimeout(r, 1000)); }
  return Object.keys(samples[0]).filter((id) => samples.some((s) => Math.abs(s[id] - samples[0][id]) > 2)).map((id) => ({
    check: "unstable", where: '[data-home-widget-id="' + id + '"]', text: id, at: "page",
    detail: "Home widget keeps changing height: " + samples.map((s) => s[id]).join(" → ") + "px",
  }));
})()`;

export async function runVivaldi(appUrl, allow, results, out, screens) {
  const browser = await startVivaldi();
  console.log(`[ui-check] Vivaldi ${browser.version}`);
  const detect = `(${detectLayoutProblems.toString()})(${JSON.stringify({ allow: allow.checks ?? {} })})`;
  try {
    const tab = await openTab(browser.base, appUrl);
    await tab.load(appUrl).catch(() => undefined);
    await tab.evaluate(PREPARE);
    for (const [sizeName, size] of Object.entries(VIVALDI_SIZES)) {
      await tab.size(size);
      for (const screen of screens.filter((s) => s.group === "core" && !s.then)) {
        const key = `vivaldi/${sizeName}/${screen.id}`;
        const entry = { key, theme: "default", size: sizeName, screen: screen.id, findings: [], shots: [], errors: [] };
        try {
          await tab.load(appUrl);
          await sleep(800);
          await tab.evaluate(SKIP_INTRO);
          if (screen.run) await tab.evaluate(`(${screen.run[0]})(${JSON.stringify(screen.run[1] ?? null)})`);
          await sleep(1500);
          await tab.evaluate(SKIP_INTRO);
          entry.findings = (await tab.evaluate(detect)).map((f) => ({ ...f, at: "page" }));
          if (screen.id === "home") entry.findings.push(...(await tab.evaluate(HOME_STABLE)));
          if (entry.findings.length)
            entry.shots.push(await tab.screenshot(join(out, "shots", `${key.replaceAll("/", "__")}.png`)));
        } catch (error) {
          entry.failed = String(error.message ?? error).split("\n")[0];
        }
        results.push(entry);
        console.log(
          `[ui-check] ${key} ${entry.failed ? `could not open: ${entry.failed}` : entry.findings.length ? `${entry.findings.length} problem(s)` : "ok"}`,
        );
      }
    }
    await tab.close();
    return browser.version;
  } finally {
    browser.stop();
  }
}
