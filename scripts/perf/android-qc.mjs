#!/usr/bin/env node
// Android QC driver: open the app in real Chrome on an Android emulator as a phone or tablet, tap with real touch
// events, take screenshots and read Settings > Advanced > Troubleshooting > "Show tap timings".
// No npm dependencies. Run scripts/perf/setup-android.sh first (it boots the emulator and starts ChromeDriver).
//
//   node scripts/perf/android-qc.mjs smoke [appUrl] [--out dir]
//       phone + tablet: open Home, screenshot, tap Library (Chats in the classic layout), screenshot, tap Home,
//       print tap timings.
//   node scripts/perf/android-qc.mjs taps [appUrl] --device phone|tablet --tap <target> [--tap ...] [--shot file]
//       <target> is a CSS selector, or text=Some label for a button/link/tab containing that text.
//
// appUrl is the address as the emulator sees it. setup-android.sh forwards the emulator's own localhost port to the
// machine's (adb reverse), so http://localhost:7860 works for a server on this machine and for one inside Termux.
//
// In your own script:
//   import { openDevice } from "./android-qc.mjs";
//   const page = await openDevice("tablet", { appUrl: "http://localhost:7860" });
//   await page.tap('[aria-label="Library"]'); console.log(await page.tapTimings()); await page.screenshot("x.png");
//   await page.close();
//
// Env: ANDROID_QC_DRIVER_PORT (9515), ANDROID_QC_DIR (/tmp/android-qc), ANDROID_SERIAL (which emulator), ADB (adb).
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { formatTimings, makePage, tapSidePane, wd } from "./webkit-qc.mjs";

const DRIVER = `http://127.0.0.1:${process.env.ANDROID_QC_DRIVER_PORT ?? 9515}`;
const STATE = process.env.ANDROID_QC_DIR ?? "/tmp/android-qc";
const ADB = process.env.ADB ?? "adb";

/**
 * Screen setups, in device pixels and dpi. phone: Pixel 7 (412x915 CSS px). tablet: an 8" tablet in portrait
 * (800x1280 CSS px), which Chrome serves the tablet (desktop-class) layout, like Android tablets do.
 */
export const DEVICES = {
  phone: { size: "1080x2400", density: 420 },
  tablet: { size: "1600x2560", density: 320 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const adb = (...args) => execFileSync(ADB, args, { encoding: "utf8" }).trim();

/** Switch the emulator's screen between phone and tablet (Chrome restarts with the new session). */
export function useScreen(device) {
  const want = DEVICES[device];
  if (!want) throw new Error(`Unknown device ${device} (phone, tablet)`);
  adb("shell", "wm", "size", want.size);
  adb("shell", "wm", "density", String(want.density));
}

/**
 * Open the app as "phone" or "tablet" in Android Chrome, with Show tap timings on.
 * keepIntro: leave the first-run tour and "What's New?" up (by default they are closed, which the server remembers).
 */
export async function openDevice(device, { appUrl = "http://localhost:7860", path = "/", keepIntro = false } = {}) {
  useScreen(device);
  const { sessionId } = await wd(
    "POST",
    "/session",
    {
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          "goog:chromeOptions": {
            androidPackage: "com.android.chrome",
            ...(process.env.ANDROID_SERIAL ? { androidDeviceSerial: process.env.ANDROID_SERIAL } : {}),
          },
        },
      },
    },
    DRIVER,
  ).catch((error) => {
    throw new Error(`${error.message}\nIs the emulator up? Run scripts/perf/setup-android.sh`);
  });
  const base = appUrl.replace(/\/$/, "");
  const page = makePage({ sessionId, device, driver: DRIVER, touch: true });
  await wd("POST", `/session/${sessionId}/url`, { url: `${base}/` }, DRIVER);
  await page.run("localStorage.setItem('marinara-tap-timings', '1')");
  await wd("POST", `/session/${sessionId}/url`, { url: base + path }, DRIVER);
  await page.ready(60000);
  if (!keepIntro) await page.closeIntro();
  return page;
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
      const info = await page.run(
        "return [innerWidth, innerHeight, devicePixelRatio, matchMedia('(hover: none) and (pointer: coarse)').matches ? 'yes' : 'no', navigator.userAgent]",
      );
      const shot1 = await page.screenshot(join(outDir, `${device}-home.png`));
      await tapSidePane(page);
      const shot2 = await page.screenshot(join(outDir, `${device}-side-pane.png`));
      await page.tap(home);
      const rows = await page.settled();
      console.log(`\n${device}: ${info[0]}x${info[1]} CSS px at ${info[2]}x, touch screen: ${info[3]}`);
      console.log(`  ${info[4]}`);
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
  try {
    useScreen("phone");
  } catch {
    // The emulator is gone; nothing to put back.
  }
  console.log(failed ? "\nAndroid smoke test FAILED" : "\nAndroid smoke test passed");
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
  console.log("Usage: node scripts/perf/android-qc.mjs smoke|taps [appUrl] ... (see the top of this file)");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
