import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Fixture-only evidence for #8081. A report can identify loader workers and native
// resources; it does not establish which import caused a stall, or cure one.
export function startRestartDiagnostics(mode, delayMs = 15_000) {
  const directory = process.env.MARINARA_RESTART_DIAGNOSTICS_DIR;
  if (!directory) return { phase() {}, ready() {} };
  const started = Date.now();
  let phase = "import";
  const prefix = join(directory, `${mode}-${process.pid}`);
  const record = () => {
    try {
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        `${prefix}-state.json`,
        JSON.stringify(
          {
            mode,
            phase,
            pid: process.pid,
            parent: process.ppid,
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            elapsedMs: Date.now() - started,
            resources: process.getActiveResourcesInfo(),
            memory: process.memoryUsage(),
            runner: Object.fromEntries(
              [
                "ImageOS",
                "ImageVersion",
                "RUNNER_OS",
                "RUNNER_ARCH",
                "GITHUB_RUN_ID",
                "GITHUB_RUN_ATTEMPT",
                "GITHUB_SHA",
              ]
                .map((key) => [key, process.env[key]])
                .filter(([, value]) => value !== undefined),
            ),
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.warn("[restart-fixture] Could not save diagnostic state:", error);
    }
  };
  record();
  const timer = setTimeout(() => {
    record();
    const previous = { excludeEnv: process.report.excludeEnv, excludeNetwork: process.report.excludeNetwork };
    try {
      // CI credentials must never enter the retained report. Network discovery
      // is unnecessary here and can itself wait on DNS while diagnosing a stall.
      process.report.excludeEnv = true;
      process.report.excludeNetwork = true;
      // Report options belong to each thread. A pre-existing loader worker can
      // still include its own environment, so remove it at every report depth.
      writeFileSync(
        `${prefix}-report.json`,
        JSON.stringify(
          process.report.getReport(),
          (key, value) => (key === "environmentVariables" ? undefined : value),
          2,
        ),
      );
      console.info(`[restart-fixture] Still in ${phase} after ${Date.now() - started}ms; diagnostic report saved`);
    } catch (error) {
      console.warn("[restart-fixture] Could not save diagnostic report:", error);
    } finally {
      Object.assign(process.report, previous);
    }
  }, delayMs);
  timer.unref();
  return {
    phase(next) {
      phase = next;
      record();
    },
    ready() {
      clearTimeout(timer);
      phase = "ready";
      record();
    },
  };
}
