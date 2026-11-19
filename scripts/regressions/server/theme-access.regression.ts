// Who may change themes: installing, editing and deleting one needs privileged access, so a phone on the network is
// refused, while picking a theme someone already installed works from that phone too.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-theme-access-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
delete process.env.ADMIN_SECRET;
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { themesRoutes } = await import("../../../packages/server/src/routes/themes.routes.js");

const app = Fastify();
try {
  app.decorate("db", await getDB());
  await app.register(themesRoutes, { prefix: "/api/themes" });
  // app.inject() arrives from 127.0.0.1, the server's own computer; the phone is another device on the network.
  const phone = { remoteAddress: "192.168.1.40", headers: { host: "localhost:7860" } };

  const installed = await app.inject({ method: "POST", url: "/api/themes", payload: { name: "Dusk", css: "" } });
  assert.equal(installed.statusCode, 200, installed.body);
  const { id } = installed.json() as { id: string };

  for (const [label, request] of [
    ["install", { method: "POST", url: "/api/themes", payload: { name: "Phone theme", css: "" } }],
    ["edit", { method: "PATCH", url: `/api/themes/${id}`, payload: { name: "Renamed" } }],
    ["delete", { method: "DELETE", url: `/api/themes/${id}` }],
  ] as const) {
    const response = await app.inject({ ...request, ...phone });
    assert.equal(response.statusCode, 403, `a phone may not ${label} a theme: ${response.body}`);
  }

  const picked = await app.inject({ method: "PUT", url: "/api/themes/active", payload: { id }, ...phone });
  assert.equal(picked.statusCode, 200, `a phone may pick an installed theme: ${picked.body}`);
  console.info("Theme access regression passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
