import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { rateLimitHook, resetRateLimitBucketsForTests } from "../../packages/server/src/middleware/rate-limit.js";

// A wall clock set back two hours (NTP, a resumed VM) left every per-IP bucket counting down to a reset two hours
// away, so all local clients got 429 with Retry-After near 6646 seconds. Windows now run on a monotonic clock.

const realDateNow = Date.now;
const realPerformanceNow = performance.now.bind(performance);
let monotonicOffset = 0;
performance.now = () => realPerformanceNow() + monotonicOffset;

resetRateLimitBucketsForTests();
const app = Fastify({ logger: false });
app.addHook("onRequest", rateLimitHook);
app.get("/api/generate/status/:chatId", async () => ({ active: false }));
await app.ready();
const hit = () => app.inject({ method: "GET", url: "/api/generate/status/chat" });

try {
  // The generate class allows 60 a minute.
  for (let index = 0; index < 60; index += 1) assert.equal((await hit()).statusCode, 200);
  let blocked = await hit();
  assert.equal(blocked.statusCode, 429);
  assert.ok(
    Number(blocked.headers["retry-after"]) <= 60,
    `Retry-After within the window: ${blocked.headers["retry-after"]}`,
  );

  // The wall clock jumps back two hours: the wait stays within the window.
  Date.now = () => realDateNow() - 2 * 60 * 60_000;
  blocked = await hit();
  assert.equal(blocked.statusCode, 429);
  const retryAfter = Number(blocked.headers["retry-after"]);
  assert.ok(retryAfter > 0 && retryAfter <= 60, `Retry-After after a clock jump: ${retryAfter}`);
  const resetAt = Number(blocked.headers["ratelimit-reset"]);
  assert.ok(Math.abs(resetAt - Date.now() / 1000) <= 61, "RateLimit-Reset is read against the current wall clock");

  // A jump forward does not open the window early either.
  Date.now = () => realDateNow() + 2 * 60 * 60_000;
  assert.equal((await hit()).statusCode, 429);

  // Once a minute has really passed, the client is let in again.
  monotonicOffset = 61_000;
  const allowed = await hit();
  assert.equal(allowed.statusCode, 200, allowed.body);
  assert.equal(allowed.headers["ratelimit-remaining"], "59");
} finally {
  Date.now = realDateNow;
  performance.now = realPerformanceNow;
  resetRateLimitBucketsForTests();
  await app.close();
}

console.log("rate-limit-clock-jump regression passed");
