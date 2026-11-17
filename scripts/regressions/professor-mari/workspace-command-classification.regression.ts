// How Professor Mari sorts workspace commands: an app_data preview is a read and an applied write is a mutation, the
// instruction.* actions are sorted by their suffix, and the direct-JSON recovery parser recognises the instruction.*
// family without matching a field name that only contains the word.
import assert from "node:assert/strict";
import {
  isAppDataActionName,
  isMutatingWorkspaceCommand,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

assert.equal(
  isMutatingWorkspaceCommand({
    id: "widget-preview",
    name: "app_data",
    arguments: { action: "home_widget.create", apply: false },
  }),
  false,
);
assert.equal(
  isMutatingWorkspaceCommand({
    id: "widget-save",
    name: "app_data",
    arguments: { action: "home_widget.create", apply: true },
  }),
  true,
);
// F6: the direct-JSON compatibility recovery parser (isAppDataActionName) must recognize the
// instruction.* family, or a small/custom model's bare {"action":"instruction.get",...} is dropped
// instead of normalized to app_data. Pin the regex directly (isMutatingWorkspaceCommand bypasses
// the recovery path, so it can't catch a regression at that anchor).
assert.equal(isAppDataActionName("instruction.get"), true, "the recovery parser recognizes instruction.get");
assert.equal(isAppDataActionName("instruction.list"), true, "the recovery parser recognizes instruction.list");
assert.equal(
  isAppDataActionName("instructions.remember"),
  true,
  "the recovery parser tolerates the lenient plural instructions.*",
);
assert.equal(
  isAppDataActionName("post_history_instructions"),
  false,
  "a field name that merely contains 'instructions' is not an action (anchored match)",
);
// And read/write classification (suffix-based) is correct for the new family.
assert.equal(
  isMutatingWorkspaceCommand({ id: "i-get", name: "app_data", arguments: { action: "instruction.get" } }),
  false,
  "instruction.get classifies as a read",
);
assert.equal(
  isMutatingWorkspaceCommand({ id: "i-list", name: "app_data", arguments: { action: "instruction.list" } }),
  false,
  "instruction.list classifies as a read",
);
for (const action of ["instruction.remember", "instruction.update", "instruction.forget"]) {
  assert.equal(
    isMutatingWorkspaceCommand({ id: `i-${action}`, name: "app_data", arguments: { action, apply: true } }),
    true,
    `${action} classifies as a mutation`,
  );
}
