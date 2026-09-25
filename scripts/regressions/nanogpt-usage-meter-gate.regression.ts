// The NanoGPT usage meter's gate, driven through the REAL exported helper.
//
// This pins the bug this regression exists for: the stored `showUsageWidget`
// flag is a "true"/"false" STRING (see the storage layer and
// `isConnectionFlagTrue`'s own contract), so an `=== true` check reads false on
// a connection the user actually enabled and silently hides the meter. The
// editor kept working because it happened to compare against both forms, which
// is exactly why the chat HUD path needed its own proof.
import assert from "node:assert/strict";
import {
  isConnectionFlagTrue,
  resolveNanoGptUsageConnection,
} from "../../packages/client/src/lib/connection-filters.js";

type Row = { id: string; provider?: string; showUsageWidget?: unknown };

const nanoOn: Row = { id: "nano-on", provider: "nanogpt", showUsageWidget: "true" };
const nanoOff: Row = { id: "nano-off", provider: "nanogpt", showUsageWidget: "false" };
const nanoBoolean: Row = { id: "nano-bool", provider: "nanogpt", showUsageWidget: true };
const openai: Row = { id: "oai", provider: "openai", showUsageWidget: "true" };
const rows: Row[] = [nanoOn, nanoOff, nanoBoolean, openai];

// The core regression: the stored STRING form must resolve the meter.
assert.deepEqual(
  resolveNanoGptUsageConnection(rows, "nano-on"),
  nanoOn,
  'a stored "true" string must show the meter (the bug was an === true check here)',
);

// Client-side payloads use real booleans, so both forms must work.
assert.deepEqual(resolveNanoGptUsageConnection(rows, "nano-bool"), nanoBoolean);

// Opted out stays quiet.
assert.equal(resolveNanoGptUsageConnection(rows, "nano-off"), null);

// Another provider is never read as NanoGPT, even with the flag set.
assert.equal(resolveNanoGptUsageConnection(rows, "oai"), null);

// Random has no single connection to read a quota from.
assert.equal(resolveNanoGptUsageConnection(rows, "random"), null);

// A missing / empty selection, or an id not in the list, shows nothing.
assert.equal(resolveNanoGptUsageConnection(rows, null), null);
assert.equal(resolveNanoGptUsageConnection(rows, undefined), null);
assert.equal(resolveNanoGptUsageConnection(rows, ""), null);
assert.equal(resolveNanoGptUsageConnection(rows, "gone"), null);
assert.equal(resolveNanoGptUsageConnection(null, "nano-on"), null);
assert.equal(resolveNanoGptUsageConnection(undefined, "nano-on"), null);

// A missing flag is not an opt-in, and neither is a truthy-looking impostor.
assert.equal(resolveNanoGptUsageConnection([{ id: "x", provider: "nanogpt" }], "x"), null);
for (const value of ["1", "yes", 1, {}, [], "TRUE", "True", null, undefined] as unknown[]) {
  assert.equal(
    resolveNanoGptUsageConnection([{ id: "x", provider: "nanogpt", showUsageWidget: value }], "x"),
    null,
    `showUsageWidget=${JSON.stringify(value)} must not opt in`,
  );
}

// The helper's contract that the gate depends on.
assert.equal(isConnectionFlagTrue("true"), true);
assert.equal(isConnectionFlagTrue(true), true);
assert.equal(isConnectionFlagTrue("false"), false);
assert.equal(isConnectionFlagTrue(false), false);
assert.equal(isConnectionFlagTrue(undefined), false);
assert.equal(isConnectionFlagTrue(null), false);
assert.equal(isConnectionFlagTrue(1), false);

// Object identity is preserved, so the caller reads the matched row's id.
const resolved = resolveNanoGptUsageConnection(rows, "nano-on");
assert.equal(resolved?.id, "nano-on");

console.info("[regression] nanogpt usage meter gate: string flags, providers, random OK");
