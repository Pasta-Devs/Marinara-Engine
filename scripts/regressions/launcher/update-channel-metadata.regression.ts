import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import { rateLimitHook } from "../../../packages/server/src/middleware/rate-limit.js";
import { updatesRoutes } from "../../../packages/server/src/routes/updates.routes.js";

const app = Fastify();
app.addHook("onRequest", rateLimitHook);
await app.register(updatesRoutes, { prefix: "/api/updates" });
const originalFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async () => {
  fetches += 1;
  throw new Error("The installed channel must not depend on GitHub availability");
};
try {
  const response = await app.inject({ method: "GET", url: "/api/updates/channel" });
  assert.equal(response.statusCode, 200, response.body);
  const metadata = response.json();
  assert.ok(["stable", "staging"].includes(metadata.channel));
  if (metadata.currentBranch === "staging") assert.equal(metadata.channel, "staging");
  if (metadata.currentBranch === "main") assert.equal(metadata.channel, "stable");
  assert.deepEqual(metadata.channels.map((entry: { id: string }) => entry.id).sort(), ["stable", "staging"]);
  assert.equal(fetches, 0);
  for (let request = 1; request < 30; request += 1) {
    assert.equal((await app.inject({ method: "GET", url: "/api/updates/channel" })).statusCode, 200);
  }
  assert.equal((await app.inject({ method: "GET", url: "/api/updates/channel" })).statusCode, 429);
  assert.equal(fetches, 0);

  // A Docker install, which has no git, built from staging checks for updates on staging and isn't offered a channel
  // switch. Faked as no .git folder, a /.dockerenv file and no git command to run.
  process.env.MARINARA_GIT_BRANCH = "staging";
  const existsSync = fs.existsSync;
  fs.existsSync = ((path: Parameters<typeof existsSync>[0]) =>
    String(path) === "/.dockerenv" || (!String(path).endsWith(".git") && existsSync(path))) as typeof existsSync;
  syncBuiltinESMExports();
  const searchPath = process.env.PATH;
  process.env.PATH = "";
  try {
    const check = (await app.inject({ method: "GET", url: "/api/updates/check" })).json();
    assert.equal(check.installType, "docker", JSON.stringify(check));
    assert.equal(check.currentBranch, "staging", JSON.stringify(check));
    assert.equal(check.channel, "staging");
    assert.equal(check.channelSwitch, false, "the build's own channel is not a switch");
  } finally {
    process.env.PATH = searchPath;
    fs.existsSync = existsSync;
    syncBuiltinESMExports();
  }
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
}
console.log("Installed update-channel metadata is available without network requests.");
