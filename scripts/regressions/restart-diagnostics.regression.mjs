import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Worker } from "node:worker_threads";
import { startRestartDiagnostics } from "./fixtures/restart-diagnostics.mjs";

// Preserve already-written evidence on cancellation as well as failure. This
// evaluates the actual upload gates without cancelling shared hosted CI runs.
for (const [workflow, step] of [
  ["platform-artifacts.yml", "Retain restart diagnostic evidence"],
  ["pull-request-checks.yml", "Retain Windows restart diagnostic evidence"],
]) {
  const source = readFileSync(new URL(`../../.github/workflows/${workflow}`, import.meta.url), "utf8");
  const condition = source.match(new RegExp(`- name: ${step}\\r?\\n\\s+if: ([^\\r\\n]+)`, "u"))?.[1];
  assert.equal(condition, "failure() || cancelled()", `${workflow} must retain both failure and cancellation evidence`);
  for (const conclusion of ["success", "failure", "cancelled"]) {
    const uploads = condition.split(" || ").some((status) => status === `${conclusion}()`);
    assert.equal(uploads, conclusion !== "success", `${workflow}: ${conclusion}`);
  }
}

const directory = mkdtempSync(join(tmpdir(), "marinara-restart-diagnostics-"));
const keys = ["MARINARA_RESTART_DIAGNOSTICS_DIR", "MARINARA_DIAGNOSTIC_SECRET_CANARY", "ImageVersion"];
const previous = keys.map((key) => process.env[key]);
const previousReport = { excludeEnv: process.report.excludeEnv, excludeNetwork: process.report.excludeNetwork };
let worker;
try {
  // Ordinary local runs do not write diagnostics or keep a timer alive.
  delete process.env.MARINARA_RESTART_DIAGNOSTICS_DIR;
  startRestartDiagnostics("source", 1).ready();
  assert.deepEqual(readdirSync(directory), []);

  process.env.MARINARA_RESTART_DIAGNOSTICS_DIR = directory;
  process.env.MARINARA_DIAGNOSTIC_SECRET_CANARY = "restart-report-secret-must-stay-out";
  process.env.ImageVersion = "fixture-windows-image";
  const prefix = join(directory, `source-${process.pid}`);

  // A normal boot retains its phases, but cancels the slow-start report.
  const normal = startRestartDiagnostics("source", 20);
  normal.phase("build");
  normal.phase("listen");
  normal.ready();
  await sleep(40);
  assert.equal(JSON.parse(readFileSync(`${prefix}-state.json`, "utf8")).phase, "ready");
  assert.equal(existsSync(`${prefix}-report.json`), false);

  // A deliberately pending phase produces a real Node diagnostic report,
  // without waiting for or relaxing the restart fixture's 60-second deadline.
  worker = new Worker("setInterval(() => {}, 1000)", {
    eval: true,
    execArgv: ["--report-exclude-network"],
  });
  await new Promise((done) => worker.once("online", done));
  const slow = startRestartDiagnostics("source", 10);
  const deadline = Date.now() + 5_000;
  while (!existsSync(`${prefix}-report.json`) && Date.now() < deadline) await sleep(10);
  assert.ok(existsSync(`${prefix}-report.json`), "a pending import must retain a report");
  const state = JSON.parse(readFileSync(`${prefix}-state.json`, "utf8"));
  const reportText = readFileSync(`${prefix}-report.json`, "utf8");
  const report = JSON.parse(reportText);
  assert.equal(state.phase, "import");
  assert.equal(state.mode, "source");
  assert.equal(state.node, process.version);
  assert.equal(state.runner.ImageVersion, "fixture-windows-image");
  assert.equal(report.header.processId, process.pid);
  assert.ok(Array.isArray(report.libuv), "retain native resource evidence");
  assert.equal(report.workers.length, 1, "retain the loader-worker equivalent too");
  assert.equal("environmentVariables" in report, false);
  assert.equal("environmentVariables" in report.workers[0], false);
  assert.ok(!reportText.includes(process.env.MARINARA_DIAGNOSTIC_SECRET_CANARY));
  assert.deepEqual(
    { excludeEnv: process.report.excludeEnv, excludeNetwork: process.report.excludeNetwork },
    previousReport,
    "diagnostics restore report options",
  );
  slow.ready();
} finally {
  if (worker) await worker.terminate();
  keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
  rmSync(directory, { recursive: true, force: true });
}
console.log("Restart diagnostics retain slow-phase evidence without environment secrets or a normal-boot report.");
