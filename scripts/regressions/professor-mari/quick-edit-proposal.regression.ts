import assert from "node:assert/strict";

import {
  quickEditFingerprint,
  validateQuickEditProposal,
} from "../../../packages/server/src/services/professor-mari/quick-edit-proposal.js";

const now = Date.now();
const proposal = {
  fingerprint: quickEditFingerprint("before"),
  expiresAt: new Date(now + 60_000).toISOString(),
};

assert.equal(validateQuickEditProposal(proposal, "before", now), "ok");
assert.equal(validateQuickEditProposal(proposal, "changed", now), "stale");
assert.equal(
  validateQuickEditProposal({ ...proposal, expiresAt: new Date(now - 1).toISOString() }, "before", now),
  "expired",
);

console.log("Professor Mari quick-edit proposal regression checks passed.");
