// Slice 55 (P6) fix for F1: a branch-only regression (commit f4e5a9eeb, 2026-09-23) split the
// `finally` block's cleanup into two guards -
//   if (this.abortController === controller) this.abortController = null;
//   if (this.abortController === controller) this.active = false;
// - and the first line nulls `this.abortController`, so the second guard's condition can never be
// true again. `active` was therefore stuck at `true` forever after any normal (non-aborted) run,
// which made the top-bar edge line (slice 52) wedge on "working" permanently. The fix merges both
// writes into one guard, so `active` resets exactly when the controller it belongs to is still the
// current one - and correctly stays `true` when a newer run has already replaced the controller
// (the controller-identity check is what makes "a newer run is in flight" still work).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(
  join(repositoryRoot, "packages/server/src/services/professor-mari/workspace-agent.service.ts"),
  "utf8",
);
const flat = source.replace(/\s+/gu, " ");

// The broken shape must never come back: two separate guards where the first one unconditionally
// nulls the field the second one's condition depends on.
assert.doesNotMatch(
  flat,
  /if \(this\.abortController === controller\) this\.abortController = null; if \(this\.abortController === controller\) this\.active = false;/u,
  "the two-guard shape is the exact bug - the second guard's condition can never be true once the first line runs",
);

// The fix: one guard clears both fields together, so `active` resets in the same breath the
// controller is cleared - and only when this run's controller is still the active one (a newer run
// that replaced the controller before this one's `finally` ran must leave `active` untouched).
assert.match(
  flat,
  /if \(this\.abortController === controller\) \{ this\.abortController = null; this\.active = false; \}/u,
  "active must reset in the same guard that clears the controller, not a second independent check",
);

console.log("Mari workspace-agent active-reset regression passed.");
