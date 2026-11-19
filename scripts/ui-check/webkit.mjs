// ──────────────────────────────────────────────
// UI check, WebKit pass: the core screens as an iPhone and an iPad in real WebKit (Safari's engine)
// ──────────────────────────────────────────────
// Uses the WebKit QC tools (scripts/perf/setup-webkit.sh + webkit-qc.mjs). "Show tap timings" is on, a few real
// taps are made (Library, a section, Home) and their readings go into the report, as every phone/tablet QC must.
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLayoutProblems } from "./detectors.mjs";
import { formatTimings, openDevice } from "../perf/webkit-qc.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export async function runWebKit(appUrl, allow, results, out, screens) {
  const setup = spawnSync("bash", [resolve(here, "../perf/setup-webkit.sh"), appUrl, "--no-smoke"], {
    stdio: "inherit",
  });
  if (setup.status !== 0) throw new Error("WebKit setup failed (scripts/perf/setup-webkit.sh)");
  const detect = `return (${detectLayoutProblems.toString()})(arguments[0]);`;
  const timings = [];
  for (const device of ["phone", "tablet"]) {
    const page = await openDevice(device, { appUrl });
    try {
      // Same start as the Chromium pass: the check's store hook, walkthroughs seen, then a fresh load.
      await page.run(`
        localStorage.setItem("marinara:ui-check", "1");
        const devices = ["desktop", "tablet", "phone"];
        localStorage.setItem("marinara-walkthroughs-seen", JSON.stringify({ devices, modes: devices.flatMap((d) => ["conversation", "roleplay", "game"].map((m) => d + ":" + m)) }));
        location.reload();
      `);
      await new Promise((r) => setTimeout(r, 1500));
      await page.ready();
      await page.closeIntro();
      // Real taps, for the tap timings.
      for (const target of ["text=Library", "text=Characters", "text=Home"])
        await page.tap(target).catch(() => undefined);
      timings.push(`${device}\n${formatTimings(await page.tapTimings())}`);
      for (const screen of screens.filter((s) => s.group === "core" && !s.then)) {
        const key = `webkit/${device}/${screen.id}`;
        const entry = {
          key,
          theme: "default",
          size: `webkit-${device}`,
          screen: screen.id,
          findings: [],
          shots: [],
          errors: [],
        };
        try {
          await page.run(`location.reload()`);
          await new Promise((r) => setTimeout(r, 1200));
          await page.ready();
          if (screen.run) {
            await page.run(`(0, eval)("(" + arguments[0] + ")")(arguments[1]);`, [
              screen.run[0],
              screen.run[1] ?? null,
            ]);
          }
          await new Promise((r) => setTimeout(r, 1500));
          entry.findings = (await page.run(detect, [{ allow: allow.checks ?? {}, covered: true }])).map((f) => ({
            ...f,
            at: "page",
          }));
          if (entry.findings.length)
            entry.shots.push(await page.screenshot(join(out, "shots", `${key.replaceAll("/", "__")}.png`)));
        } catch (error) {
          entry.failed = String(error.message ?? error).split("\n")[0];
        }
        results.push(entry);
        console.log(
          `[ui-check] ${key} ${entry.failed ? `could not open: ${entry.failed}` : entry.findings.length ? `${entry.findings.length} problem(s)` : "ok"}`,
        );
      }
    } finally {
      await page.close();
    }
  }
  return timings.join("\n\n");
}
