import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const adminRoutes = readFileSync(
  new URL("../../../packages/server/src/routes/admin.routes.ts", import.meta.url),
  "utf8",
);
const appFactory = readFileSync(new URL("../../../packages/server/src/app.ts", import.meta.url), "utf8");
const settingsPanel = readFileSync(
  new URL("../../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url),
  "utf8",
);

assert.match(adminRoutes, /requirePrivilegedAccess\(req, reply, \{ feature: "Server restart" \}\)/u);
assert.match(adminRoutes, /rateLimit: ADMIN_RESTART_RATE_LIMIT/u);
assert.match(adminRoutes, /req\.body\?\.confirm !== true/u);
const serverEntry = readFileSync(new URL("../../../packages/server/src/index.ts", import.meta.url), "utf8");
// A restart takes the signal shutdown (deadlines, store flush), then exits with the restart code.
assert.match(serverEntry, /setRestartHandler\(\(exitCode\) => void shutdown\("restart", exitCode\)\)/u);
assert.match(serverEntry, /process\.exit\(exitCode\)/u);
assert.doesNotMatch(adminRoutes, /\bspawn\(/u, "The server must never fork its own replacement");
assert.match(appFactory, /forceCloseConnections: false/u);
assert.match(
  readFileSync(new URL("../../../packages/client/src/hooks/use-server-restart.ts", import.meta.url), "utf8"),
  /api\.post<\{ status: "restarting"; bootId: string \}>\("\/admin\/restart", \{ confirm: true \}\)/u,
);
assert.match(settingsPanel, /useRestartServer\(\)/u);
assert.match(settingsPanel, /controlId="restart-server"/u);

const dataDir = mkdtempSync(join(tmpdir(), "marinara-admin-restart-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

try {
  const { buildApp } = await import("../../../packages/server/src/app.js");
  const app = await buildApp();
  let releaseRequest = () => {};
  let closing: Promise<void> | undefined;
  try {
    let requestStarted = () => {};
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const holdRequest = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });

    app.get("/__restart-regression/long-lived", async () => {
      requestStarted();
      await holdRequest;
      return { status: "complete" };
    });
    await app.listen({ host: "127.0.0.1", port: 0 });

    const unmanagedHealth = (await app.inject({ method: "GET", url: "/api/health" })).json() as {
      canRestart?: boolean;
    };
    assert.equal(unmanagedHealth.canRestart, false, "Settings disables Restart Server without a supervisor");
    const unsupported = await app.inject({ method: "POST", url: "/api/admin/restart", payload: { confirm: true } });
    assert.equal(unsupported.statusCode, 409, "Unsupervised starts must not fork an orphan replacement");
    assert.equal(unsupported.json().code, "restart-unavailable", "the client localizes the toast by this code");

    const address = app.server.address();
    assert(address && typeof address !== "string");
    const response = fetch(`http://127.0.0.1:${address.port}/__restart-regression/long-lived`, {
      headers: { connection: "close" },
    });
    await started;
    closing = app.close();
    const closedEarly = await Promise.race([
      closing.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 50)),
    ]);
    assert.equal(closedEarly, false, "Graceful shutdown must preserve an active request");
    releaseRequest();
    const completedResponse = await response;
    assert.equal(completedResponse.status, 200);
    await completedResponse.json();
    await closing;

    // A supervised restart answers 202, turns health to 503 so the sheet sees the old server go, then exits 75.
    const { setRestartHandler } = await import("../../../packages/server/src/lib/server-restart.js");
    const restartApp = await buildApp();
    const exited = new Promise<number>((resolve) => setRestartHandler(resolve));
    process.env.MARINARA_RESTART_SUPERVISOR = String(process.ppid);
    const health = (await restartApp.inject({ method: "GET", url: "/api/health" })).json() as {
      canRestart?: boolean;
    };
    assert.equal(health.canRestart, true);
    const restart = await restartApp.inject({ method: "POST", url: "/api/admin/restart", payload: { confirm: true } });
    assert.equal(restart.statusCode, 202);
    assert.match((restart.json() as { bootId: string }).bootId, /^[0-9a-f]{8}$/u);
    const pendingHealth = await restartApp.inject({ method: "GET", url: "/api/health" });
    assert.equal(pendingHealth.statusCode, 503, "the old server must not look like the new one");
    assert.equal(await exited, 75, "the launcher starts a replacement on exit code 75");
    await restartApp.close();
  } finally {
    releaseRequest();
    await (closing ?? app.close());
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("Admin server restart regression passed.\n");
