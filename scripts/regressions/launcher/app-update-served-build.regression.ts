/**
 * A waiting service worker prompts a refresh only when the page runs a build the server no longer
 * serves: a page loaded after a restart already runs the new build (playtest 2026-10-23).
 */
import assert from "node:assert/strict";
import { formatRuntimeBuild, runningBuildIsServed } from "../../../packages/client/src/lib/runtime-build.js";
import { nextRestartStep } from "../../../packages/client/src/lib/server-restart.js";

const client = formatRuntimeBuild("2.4.6", "abc1234");
const answer =
  (body: unknown, ok = true) =>
  async () =>
    ({ ok, json: async () => body }) as Response;

assert.equal(await runningBuildIsServed("2.4.6", client, answer({ version: "2.4.6", build: client })), true);
assert.equal(
  await runningBuildIsServed("2.4.6", client, answer({ version: "2.4.6", build: "2.4.6+def5678" })),
  false,
  "a newer build is served",
);
assert.equal(await runningBuildIsServed("2.4.6", client, answer({ status: "ok" })), false, "unknown prompts");
assert.equal(await runningBuildIsServed("2.4.6", client, answer({}, false)), false, "no answer prompts");
assert.equal(
  await runningBuildIsServed("2.4.6", client, async () => {
    throw new TypeError("Failed to fetch");
  }),
  false,
);
// A server that takes the connection and never answers reads as unknown once the probe gives up.
assert.equal(
  await runningBuildIsServed(
    "2.4.6",
    client,
    (_input, init) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true }),
      ),
    20,
  ),
  false,
  "a silent server prompts",
);
console.info("App update: a waiting worker prompts only when the server serves another build.");

// The restart sheet must not reload on the old process, which keeps answering while it shuts down.
{
  const old = { ok: true as const, bootId: "aaaa" };
  const fresh = { ok: true as const, bootId: "bbbb" };
  const down = { ok: false as const };
  assert.equal(nextRestartStep("stopping", "aaaa", old), "stopping", "the old process is not the restarted server");
  assert.equal(nextRestartStep("stopping", "aaaa", down), "starting");
  assert.equal(nextRestartStep("starting", "aaaa", down), "starting");
  assert.equal(nextRestartStep("starting", "aaaa", fresh), "back");
  assert.equal(nextRestartStep("stopping", "aaaa", fresh), "back", "a fast restart can skip the down window");
  // Without boot ids (health hides them before sign-in) only an answer after an outage counts.
  assert.equal(nextRestartStep("stopping", null, { ok: true }), "stopping");
  assert.equal(nextRestartStep("starting", null, { ok: true }), "back");
  assert.equal(nextRestartStep("back", "aaaa", down), "back", "back never goes backwards");
  console.info("Server restart: the sheet waits for a new boot id, not the shutting-down process.");
}
