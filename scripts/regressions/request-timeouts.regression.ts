import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REQUEST_TIMEOUTS,
  requestTimeoutSettingsSchema,
} from "../../packages/shared/src/constants/request-timeouts.js";

const root = mkdtempSync(join(tmpdir(), "marinara-timeouts-"));
process.env.MARINARA_ENV_FILE = join(root, ".env");
process.env.NODE_ENV = "production";
process.env.DATA_DIR = root;
delete process.env.MARINARA_E2E_DISABLE_RATE_LIMIT;
writeFileSync(process.env.MARINARA_ENV_FILE, "# Keep this configuration intact\nCHAT_GENERATION_TIMEOUT_MS=420000\n");
for (const { env } of Object.values(REQUEST_TIMEOUTS)) delete process.env[env];
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = require("fastify");
const { adminRoutes } = await import("../../packages/server/src/routes/admin.routes.js");
const config = await import("../../packages/server/src/config/runtime-config.js");
const app = Fastify();
const { rateLimitHook, REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT } =
  await import("../../packages/server/src/middleware/rate-limit.js");
app.addHook("onRequest", rateLimitHook);
await app.register(adminRoutes, { prefix: "/api/admin" });
try {
  const originalEnv = readFileSync(process.env.MARINARA_ENV_FILE, "utf8");
  const defaults = (await app.inject({ url: "/api/admin/request-timeouts" })).json();
  assert.equal(defaults.chat, 420);
  assert.equal(defaults.comfyui, 2400);
  const settings = { ...defaults, chat: 1200, agents: 1800, images: 3600, comfyui: 7200 };
  const rejected = await app.inject({
    method: "PUT",
    url: "/api/admin/request-timeouts",
    payload: settings,
    remoteAddress: "203.0.113.10",
  });
  assert.equal(rejected.statusCode, 403);
  for (let i = 1; i < REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT.max; i++) {
    const attempt = await app.inject({
      method: "PUT",
      url: "/api/admin/request-timeouts",
      payload: settings,
      remoteAddress: "203.0.113.10",
    });
    assert.equal(attempt.statusCode, 403);
  }
  const throttled = await app.inject({
    method: "PUT",
    url: "/api/admin/request-timeouts",
    payload: settings,
    remoteAddress: "203.0.113.10",
  });
  assert.equal(throttled.statusCode, 429);
  for (const invalid of [
    { ...settings, chat: 0 },
    { ...settings, chat: 3601 },
    { ...settings, images: -1 },
    { ...settings, video: 86401 },
    { ...settings, ADMIN_SECRET: "unsafe" },
  ]) {
    assert.equal(requestTimeoutSettingsSchema.safeParse(invalid).success, false);
  }
  const saved = await app.inject({ method: "PUT", url: "/api/admin/request-timeouts", payload: settings });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.deepEqual(saved.json(), settings);
  assert.equal(config.getChatGenerationTimeoutMs(), 1_200_000);
  assert.equal(config.getAgentCallTimeoutMs(), 1_800_000);
  assert.equal(process.env.COMFYUI_GEN_TIMEOUT, "7200");
  assert.equal(readFileSync(process.env.MARINARA_ENV_FILE, "utf8"), originalEnv);
  config.reloadRuntimeEnv();
  assert.equal(config.getChatGenerationTimeoutMs(), 1_200_000, "UI preference survives .env reload");
  const code = `import {getChatGenerationTimeoutMs} from ${JSON.stringify(new URL("../../packages/server/src/config/runtime-config.ts", import.meta.url).href)}; if(getChatGenerationTimeoutMs()!==1200000)throw Error('lost saved timeout');`;
  const child = spawnSync(
    process.execPath,
    ["--import", require.resolve("tsx/esm"), "--input-type=module", "-e", code],
    {
      env: { ...process.env, CHAT_GENERATION_TIMEOUT_MS: "300000" },
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.equal(child.status, 0, child.stderr);
  console.info("Request timeouts preserve .env, validate bounds, enforce admin access and survive restart.");
} finally {
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
