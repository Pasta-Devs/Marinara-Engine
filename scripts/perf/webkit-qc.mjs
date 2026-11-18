#!/usr/bin/env node
// WebKit QC driver: open the app in real WebKit (WebKitGTK, Safari's engine) as an iPhone or iPad, tap with real
// WebDriver clicks, take screenshots and read Settings > Advanced > Troubleshooting > "Show tap timings".
// No npm dependencies. Run scripts/perf/setup-webkit.sh first (it installs and starts the driver + touch proxy).
//
//   node scripts/perf/webkit-qc.mjs smoke [appUrl] [--out dir]
//       phone + tablet: open Home, screenshot, tap Library (Chats in the classic layout), screenshot, tap Home,
//       print tap timings.
//   node scripts/perf/webkit-qc.mjs taps [appUrl] --device phone|tablet --tap <target> [--tap ...] [--shot file]
//       <target> is a CSS selector, or text=Some label for a button/link/tab containing that text.
//   node scripts/perf/webkit-qc.mjs proxy <appUrl> [--port 7899]       (started by setup-webkit.sh)
//
// In your own script:
//   import { openDevice } from "./webkit-qc.mjs";
//   const page = await openDevice("tablet", { appUrl: "http://localhost:7860" });
//   await page.tap('[aria-label="Library"]'); console.log(await page.tapTimings()); await page.screenshot("x.png");
//   await page.close();
//
// Env: WEBKIT_QC_DRIVER_PORT (4444), WEBKIT_QC_PROXY_PORT (7899), WEBKIT_QC_DIR (/tmp/webkit-qc).
// If a session can't start ("Maximum number of active sessions"), run setup-webkit.sh --restart.
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const DRIVER = `http://127.0.0.1:${process.env.WEBKIT_QC_DRIVER_PORT ?? 4444}`;
const PROXY_PORT = Number(process.env.WEBKIT_QC_PROXY_PORT ?? 7899);
const PROXY = `http://127.0.0.1:${PROXY_PORT}`;
const STATE = process.env.WEBKIT_QC_DIR ?? "/tmp/webkit-qc";
const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

/** CSS-pixel viewports of the devices kolache tests on (iPhone 13 mini, iPad mini 6). */
export const DEVICES = {
  phone: { width: 375, height: 812 },
  tablet: { width: 744, height: 1133 },
};

const UA = {
  // iOS Safari.
  phone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  // iPadOS Safari asks for the desktop site by default, so it looks like a Mac with a touch screen.
  tablet:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
};
const PLATFORM = { phone: "iPhone", tablet: "MacIntel" };
const SCREEN = Object.fromEntries(
  Object.entries(DEVICES).map(([name, { width, height }]) => [
    name,
    { width, height, availWidth: width, availHeight: height },
  ]),
);

// ── Touch shim, served same-origin by the proxy (the app's CSP blocks inline scripts) ──
function shimSource(device) {
  if (!UA[device]) return "/* webkit-qc: no device */";
  return `(() => {
  const T = "(min-width: 0px)", F = "(max-width: 0px)";
  const rewrite = (q) => String(q)
    .replace(/\\(\\s*(any-)?hover\\s*:\\s*none\\s*\\)/gi, T)
    .replace(/\\(\\s*(any-)?hover\\s*:\\s*hover\\s*\\)/gi, F)
    .replace(/\\(\\s*(any-)?hover\\s*\\)/gi, F)
    .replace(/\\(\\s*(any-)?pointer\\s*:\\s*coarse\\s*\\)/gi, T)
    .replace(/\\(\\s*(any-)?pointer\\s*:\\s*fine\\s*\\)/gi, F);
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => matchMedia(rewrite(query));
  const define = (name, value) => Object.defineProperty(Navigator.prototype, name, { get: () => value, configurable: true });
  define("maxTouchPoints", 5);
  define("userAgent", ${JSON.stringify(UA[device])});
  define("platform", ${JSON.stringify(PLATFORM[device])});
  // The app tells phones from tablets by the screen's short side, and Xvfb's screen is a desktop monitor.
  for (const [name, value] of Object.entries(${JSON.stringify(SCREEN[device])})) {
    Object.defineProperty(Screen.prototype, name, { get: () => value, configurable: true });
  }
  document.documentElement.dataset.webkitQcDevice = ${JSON.stringify(device)};
})();`;
}

const SHIM_TAGS = {
  phone: '<script src="/__webkit-qc/shim.js?device=phone"></script>',
  tablet: '<script src="/__webkit-qc/shim.js?device=tablet"></script>',
};

// ── Proxy: forwards everything to the app and adds the shim to HTML pages ──
export function startProxy(appUrl, port = PROXY_PORT) {
  const target = new URL(appUrl);
  const send = target.protocol === "https:" ? httpsRequest : httpRequest;
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://proxy");
    if (url.pathname === "/__webkit-qc/target") return res.end(appUrl);
    const cookieDevice = /(?:^|;\s*)webkit_qc=(phone|tablet|none)/.exec(req.headers.cookie ?? "")?.[1];
    const requested = url.searchParams.get("webkit_qc");
    const device =
      requested === "none" || Object.hasOwn(DEVICES, requested ?? "") ? requested : (cookieDevice ?? "none");
    if (url.pathname === "/__webkit-qc/shim.js") {
      res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
      return res.end(shimSource(url.searchParams.get("device")));
    }
    const fail = (error) => {
      if (res.writableEnded) return;
      if (res.headersSent) return res.destroy();
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`webkit-qc proxy: ${error.message}`);
    };
    const wantsHtml = req.method === "GET" && /text\/html/.test(req.headers.accept ?? "");
    const headers = { ...req.headers, host: target.host };
    if (wantsHtml) {
      delete headers["accept-encoding"];
      delete headers["if-none-match"];
      delete headers["if-modified-since"];
    }
    const upstream = send(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: req.url,
        headers,
      },
      (up) => {
        const outHeaders = { ...up.headers };
        if (requested === device) {
          outHeaders["set-cookie"] = [...[].concat(up.headers["set-cookie"] ?? []), `webkit_qc=${device}; Path=/`];
        }
        // A reset or cut-off answer from the app still gets a reply (or a closed socket), never a hung request.
        up.on("error", fail);
        up.on("aborted", () => fail(new Error("the app closed the response early")));
        if (!wantsHtml || !/text\/html/.test(up.headers["content-type"] ?? "") || device === "none") {
          res.writeHead(up.statusCode, outHeaders);
          return up.pipe(res);
        }
        const chunks = [];
        up.on("data", (chunk) => chunks.push(chunk));
        up.on("end", () => {
          if (res.writableEnded) return;
          // Fixed strings only: nothing from the request reaches the page.
          const tag = SHIM_TAGS[device] ?? "";
          const html = Buffer.concat(chunks)
            .toString("utf8")
            .replace(/<head[^>]*>/i, (head) => head + tag);
          delete outHeaders["content-length"];
          delete outHeaders["content-encoding"];
          delete outHeaders.etag;
          outHeaders["cache-control"] = "no-store";
          res.writeHead(up.statusCode, outHeaders);
          res.end(html);
        });
      },
    );
    upstream.on("error", fail);
    req.pipe(upstream);
  });
  // WebSockets / upgrades: pass the raw connection through.
  server.on("upgrade", (req, socket, head) => {
    const upstream = connect(Number(target.port || (target.protocol === "https:" ? 443 : 80)), target.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i];
        lines.push(`${name}: ${name.toLowerCase() === "host" ? target.host : req.rawHeaders[i + 1]}`);
      }
      upstream.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) upstream.write(head);
      upstream.pipe(socket).pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

// ── WebDriver client ──
export async function wd(method, path, body, driver = DRIVER) {
  const response = await fetch(driver + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.value?.message ?? response.statusText;
    throw new Error(`WebDriver ${method} ${path}: ${message}`);
  }
  return json.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open the app as "phone" or "tablet" in WebKit, with Show tap timings on. */
/** keepIntro: leave the first-run tour and "What's New?" up (by default they are closed, which the server remembers). */
export async function openDevice(
  device,
  { appUrl = "http://localhost:7860", size, path = "/", keepIntro = false } = {},
) {
  const viewport = size ?? DEVICES[device];
  if (!viewport) throw new Error(`Unknown device ${device} (phone, tablet)`);
  const proxyTarget = await fetch(`${PROXY}/__webkit-qc/target`)
    .then((r) => r.text())
    .catch(() => "");
  if (proxyTarget !== appUrl.replace(/\/$/, "")) {
    throw new Error(
      `Touch proxy isn't pointing at ${appUrl} (it is at "${proxyTarget}"). Run scripts/perf/setup-webkit.sh ${appUrl}`,
    );
  }
  const { sessionId } = await wd("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "MiniBrowser",
        "webkitgtk:browserOptions": { args: ["--automation", `--user-agent=${UA[device]}`] },
      },
    },
  }).catch((error) => {
    throw new Error(`${error.message}\nIf the driver is stuck, run scripts/perf/setup-webkit.sh --restart`);
  });
  const s = `/session/${sessionId}`;
  const run = (script, args = []) => wd("POST", `${s}/execute/sync`, { script, args });

  // Size the window so the page itself (not the window frame) gets the device viewport.
  await wd("POST", `${s}/window/rect`, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  for (let i = 0; i < 3; i++) {
    const inner = await run("return [innerWidth, innerHeight]");
    const dw = viewport.width - inner[0];
    const dh = viewport.height - inner[1];
    if (!dw && !dh) break;
    const rect = await wd("GET", `${s}/window/rect`);
    await wd("POST", `${s}/window/rect`, { x: 0, y: 0, width: rect.width + dw, height: rect.height + dh });
  }

  const base = PROXY;
  await wd("POST", `${s}/url`, { url: `${base}/?webkit_qc=${device}` });
  await run("localStorage.setItem('marinara-tap-timings', '1')");
  await wd("POST", `${s}/url`, { url: base + path });

  const page = makePage({ sessionId, device });
  await page.ready();
  if (!keepIntro) await page.closeIntro();
  return page;
}

/**
 * The page helpers shared by the WebKit driver and the Android one (android-qc.mjs).
 * touch: tap with a W3C touch pointer (real touchstart/touchend in Android Chrome) instead of an element click.
 */
export function makePage({ sessionId, device, driver = DRIVER, touch = false }) {
  const s = `/session/${sessionId}`;
  const call = (method, path, body) => wd(method, path, body, driver);
  const run = (script, args = []) => call("POST", `${s}/execute/sync`, { script, args });
  return {
    sessionId,
    device,
    run,
    /** Wait until the app has drawn something and the tap timings box is up. */
    async ready(timeoutMs = 30000) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const ok = await run(
          "return document.readyState === 'complete' && !!document.querySelector('[data-component=\"TapTimings\"]') && (document.getElementById('root')?.innerText.trim().length ?? 0) > 20",
        ).catch(() => false);
        if (ok) return;
        await sleep(250);
      }
      throw new Error("App didn't finish loading (no tap timings box). Is the server running?");
    },
    /** Close the first-run tour and "What's New?" (the server remembers). A script click adds no tap timings row. */
    async closeIntro() {
      // Both can appear a moment late (after settings sync).
      const skipped = () =>
        run(`
          const skip = [...document.querySelectorAll("button")].find(
            (b) => b.offsetParent && /^(Skip Tutorial|Got it)$/.test(b.textContent.trim()),
          );
          skip?.click();
          return !!skip;
        `);
      let quietSince = Date.now();
      for (const end = Date.now() + 5000; Date.now() < end && Date.now() - quietSince < 2000;) {
        if (await skipped()) quietSince = Date.now();
        await sleep(250);
      }
    },
    /** Find the first visible element: CSS selector, or text=Label. */
    async find(target, timeoutMs = 10000) {
      const query = target.startsWith("text=")
        ? {
            using: "xpath",
            value: `//*[self::button or self::a or @role='tab' or @role='button' or @role='menuitem'][contains(normalize-space(.), ${xpathString(target.slice(5))}) or contains(@aria-label, ${xpathString(target.slice(5))})]`,
          }
        : { using: "css selector", value: target };
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const found = await call("POST", `${s}/elements`, query).catch(() => []);
        for (const element of found) {
          const id = element[ELEMENT];
          if (await call("GET", `${s}/element/${id}/displayed`).catch(() => false)) return id;
        }
        await sleep(200);
      }
      throw new Error(`Nothing visible matches ${target}`);
    },
    /** A real tap (pointer events from the browser itself), which is what the tap timings box measures. */
    async tap(target, { settle = true } = {}) {
      const id = await this.find(target);
      if (touch) {
        const origin = { [ELEMENT]: id };
        // A pointer action doesn't scroll; an element click would, but it would also tap it a second time.
        await run("arguments[0].scrollIntoView({ block: 'nearest' })", [origin]);
        await call("POST", `${s}/actions`, {
          actions: [
            {
              type: "pointer",
              id: "finger",
              parameters: { pointerType: "touch" },
              actions: [
                { type: "pointerMove", duration: 0, origin, x: 0, y: 0 },
                { type: "pointerDown", button: 0 },
                { type: "pause", duration: 60 },
                { type: "pointerUp", button: 0 },
              ],
            },
          ],
        });
        await call("DELETE", `${s}/actions`).catch(() => {});
      } else {
        await call("POST", `${s}/element/${id}/click`, {});
      }
      if (settle) await this.settled();
    },
    /** Wait until the newest tap timings row is final (no "…"). */
    async settled(timeoutMs = 12000) {
      const end = Date.now() + timeoutMs;
      await sleep(300);
      while (Date.now() < end) {
        const rows = await this.tapTimings();
        if (rows.length && rows.every((row) => row.final)) return rows;
        await sleep(200);
      }
      return this.tapTimings();
    },
    /** Rows of the tap timings box (last 6 taps) in tap order: tap -> shown · smooth · longest frame · server. */
    async tapTimings() {
      const rows = await run(`
        const box = document.querySelector('[data-component="TapTimings"]');
        if (!box) return [];
        // The box lists the newest tap first.
        return [...box.children].filter((row) => row.querySelector('span')).map((row) => row.textContent).reverse();
      `);
      return rows.map((text) => {
        const final = !text.endsWith("…");
        const match = /^(.*?) (\d+) · (\d+) · (\d+) · (.*?)(?: …)?$/.exec(text);
        if (!match) return { text, final };
        const [, label, shown, smooth, longest, server] = match;
        return { label, shown: +shown, smooth: +smooth, longest: +longest, server: server.trim(), text, final };
      });
    },
    async screenshot(file) {
      const png = await call("GET", `${s}/screenshot`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(png, "base64"));
      return file;
    },
    async close() {
      await call("DELETE", s).catch(() => {});
    },
  };
}

function xpathString(text) {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return `concat("${text.replace(/"/g, `", '"', "`)}")`;
}

export function formatTimings(rows) {
  return rows
    .map((row) =>
      row.shown === undefined
        ? `  ${row.text}`
        : `  ${row.label.padEnd(18)} shown ${String(row.shown).padStart(5)} ms · smooth ${String(row.smooth).padStart(5)} ms · longest frame ${String(row.longest).padStart(4)} ms · server ${row.server}`,
    )
    .join("\n");
}

/**
 * Open the side pane: Library in the new layout, Chats in the classic one (on a phone the classic layout keeps Chats
 * in the top bar's More menu).
 */
export async function tapSidePane(page) {
  const direct = await page.find('[aria-label="Library"], [aria-label="Chats"]', 3000).catch(() => null);
  if (direct) return page.tap('[aria-label="Library"], [aria-label="Chats"]');
  await page.tap('button[aria-haspopup="menu"][aria-label="More"]');
  await page.tap('[role="menuitem"][data-topbar-panel="chats"]');
}

// ── CLI ──
async function smoke(appUrl, outDir) {
  const home = '[aria-label="Home"]';
  let failed = false;
  for (const device of ["phone", "tablet"]) {
    let page;
    try {
      page = await openDevice(device, { appUrl });
      await sleep(1500);
      const size = await page.run(
        "return [innerWidth, innerHeight, matchMedia('(hover: none) and (pointer: coarse)').matches ? 'yes' : 'no']",
      );
      const want = DEVICES[device];
      if (size[0] !== want.width || size[1] !== want.height) {
        throw new Error(
          `viewport is ${size[0]}x${size[1]}, expected ${want.width}x${want.height} (restart with setup-webkit.sh --restart)`,
        );
      }
      const shot1 = await page.screenshot(join(outDir, `${device}-home.png`));
      await tapSidePane(page);
      const shot2 = await page.screenshot(join(outDir, `${device}-side-pane.png`));
      await page.tap(home);
      const rows = await page.settled();
      console.log(`\n${device}: ${size[0]}x${size[1]} WebKit viewport, touch screen (as the page sees it): ${size[2]}`);
      console.log(`  screenshots: ${shot1}, ${shot2}`);
      console.log("  tap timings (tap -> shown · smooth · longest frame · server):");
      console.log(formatTimings(rows));
      if (!rows.some((row) => row.shown !== undefined)) throw new Error("tap timings box has no readings");
    } catch (error) {
      failed = true;
      console.error(`\n${device}: FAILED: ${error.message}`);
    } finally {
      await page?.close();
    }
  }
  console.log(failed ? "\nWebKit smoke test FAILED" : "\nWebKit smoke test passed");
  process.exitCode = failed ? 1 : 0;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const options = { tap: [] };
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = rest[++i];
      if (key === "tap") options.tap.push(value);
      else options[key] = value;
    } else positional.push(arg);
  }
  const appUrl = (positional[0] ?? "http://localhost:7860").replace(/\/$/, "");

  if (command === "proxy") {
    await startProxy(appUrl, Number(options.port ?? PROXY_PORT));
    console.log(`webkit-qc touch proxy on http://127.0.0.1:${options.port ?? PROXY_PORT} -> ${appUrl}`);
    return;
  }
  if (command === "smoke") return smoke(appUrl, options.out ?? join(STATE, "smoke"));
  if (command === "taps") {
    const device = options.device ?? "tablet";
    const page = await openDevice(device, { appUrl });
    try {
      await sleep(1000);
      for (const target of options.tap) await page.tap(target);
      console.log(`${device} tap timings (tap -> shown · smooth · longest frame · server):`);
      console.log(formatTimings(await page.settled()));
      if (options.shot) console.log(`screenshot: ${await page.screenshot(options.shot)}`);
    } finally {
      await page.close();
    }
    return;
  }
  console.log("Usage: node scripts/perf/webkit-qc.mjs smoke|taps|proxy [appUrl] ... (see the top of this file)");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
