import assert from "node:assert/strict";

// A Connection whose server gives no answer (an expired tunnel) is marked unreachable for the Connections page.
// Only its first failure in a row is worth a warning, repeat fetches wait (30 s, doubling, at most 15 min), and
// one answer clears it.
const { noteUnreachable, noteReachable, unreachableOf, unreachableReasonOf, waitingUnreachable, resetReachability } =
  await import("../../../packages/server/src/services/connections/reachability.js");

resetReachability();
const dns = Object.assign(new Error("getaddrinfo ENOTFOUND gone.trycloudflare.com"), { code: "ENOTFOUND" });
assert.equal(unreachableReasonOf(dns), "not_found");
assert.equal(unreachableReasonOf(new Error("fetch failed", { cause: { code: "ECONNREFUSED" } })), "refused");
assert.equal(unreachableReasonOf(new Error("odd")), "unreachable");

const t0 = Date.parse("2026-11-24T10:00:00Z");
const A = "https://gone.trycloudflare.com/v1";
assert.equal(noteUnreachable("acc", "not_found", "Failed", A, t0).first, true);
assert.equal(noteUnreachable("acc", "not_found", "Failed", A, t0 + 1_000).first, false);
// Second failure: wait 60 s from it.
assert.ok(waitingUnreachable("acc", A, t0 + 30_000));
assert.equal(waitingUnreachable("acc", A, t0 + 62_000), null);
// The page keeps showing it after the wait, with when it began.
assert.deepEqual(unreachableOf("acc", A), { reason: "not_found", since: new Date(t0).toISOString(), error: "Failed" });
// The wait never passes 15 minutes.
for (let i = 0; i < 20; i++) noteUnreachable("acc", "not_found", "Failed", A, t0);
assert.equal(waitingUnreachable("acc", A, t0 + 15 * 60_000 + 1), null);

noteReachable("acc");
assert.equal(unreachableOf("acc", A), null);
// A new address (the tunnel's new name) is a new server: the old failure neither shows nor makes fetches wait.
noteUnreachable("moved", "not_found", "Failed", A, t0);
assert.ok(waitingUnreachable("moved", A, t0 + 1_000));
assert.equal(waitingUnreachable("moved", "https://new-name.trycloudflare.com/v1", t0 + 1_000), null);
assert.equal(unreachableOf("moved", "https://new-name.trycloudflare.com/proxy/zai"), null);
assert.equal(noteUnreachable("moved", "not_found", "Failed", "https://new-name.trycloudflare.com/v1", t0).first, true);

console.log("connection-reachability regression passed");
