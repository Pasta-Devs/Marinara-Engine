import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const adminRoutes = readFileSync(new URL("../../packages/server/src/routes/admin.routes.ts", import.meta.url), "utf8");
const appFactory = readFileSync(new URL("../../packages/server/src/app.ts", import.meta.url), "utf8");
const settingsPanel = readFileSync(
  new URL("../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url),
  "utf8",
);

assert.match(adminRoutes, /requirePrivilegedAccess\(req, reply, \{ feature: "Server restart" \}\)/u);
assert.match(adminRoutes, /rateLimit: ADMIN_RESTART_RATE_LIMIT/u);
assert.match(adminRoutes, /req\.body\?\.confirm !== true/u);
assert.match(adminRoutes, /await app\.close\(\)/u);
assert.match(adminRoutes, /spawn\(process\.execPath, \[\.\.\.process\.execArgv, \.\.\.process\.argv\.slice\(1\)\]/u);
assert.match(adminRoutes, /app\.server\.closeAllConnections\(\)/u);
assert.match(appFactory, /forceCloseConnections: false/u);
assert.match(settingsPanel, /api\.post<\{ status: "restarting" \}>\("\/admin\/restart", \{ confirm: true \}\)/u);
assert.match(settingsPanel, /controlId="restart-server"/u);

const dataDir = mkdtempSync(join(tmpdir(), "marinara-admin-restart-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
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
  } finally {
    releaseRequest();
    await (closing ?? app.close());
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("Admin server restart regression passed.\n");
