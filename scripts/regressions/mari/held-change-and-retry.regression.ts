import assert from "node:assert/strict";

import { isHardStepFailure } from "../../../packages/client/src/components/chat/mari/mari-tool-presentation.js";
import {
  heldCallsAreEditorText,
  heldChangeSettledByUser,
} from "../../../packages/client/src/lib/mari-editor-fields.js";

// A write that failed and then went through on her retry does not fail the turn ("That attempt failed").
const step = (id: string, status: "done" | "error", action: string, characterId = "c1") => ({
  id,
  name: "app_data",
  status,
  input: { action, characterId, patch: { description: "warm" } },
  detail: null,
  output: status === "error" ? "Error: conflict" : "{}",
  startedAt: 1,
  updatedAt: 2,
});
const failedWrite = step("w1", "error", "character.update");
assert.equal(isHardStepFailure(failedWrite), true, "a failed write alone fails the run");
assert.equal(
  isHardStepFailure(failedWrite, [step("r1", "done", "character.get"), step("w2", "done", "character.update")]),
  false,
  "a later finished write of the same action on the same record recovers it",
);
assert.equal(
  isHardStepFailure(failedWrite, [step("w2", "done", "character.update", "c2")]),
  true,
  "the same action on another record does not recover it",
);
assert.equal(
  isHardStepFailure(failedWrite, [step("w2", "done", "lorebook.update")]),
  true,
  "another action does not recover it",
);
assert.equal(
  isHardStepFailure(failedWrite, [step("r1", "done", "character.get")]),
  true,
  "a later read does not recover a failed write",
);
assert.equal(
  isHardStepFailure(failedWrite, [step("w2", "error", "character.update")]),
  true,
  "a retry that also failed does not recover it",
);
assert.equal(isHardStepFailure(step("r0", "error", "character.get")), false, "a missed read never fails the run");

// Edit, then the user's own Save, of every held field answers the held change.
const review = { fields: [{ entityId: "c1", fieldId: "description", value: "hers" }], editorTextOnly: true };
const here = (id: string) => id === "c1";
const before = { description: "original" };
const clean = () => false;
const saved = (text: string) => () => text;
assert.equal(
  heldChangeSettledByUser(review, here, before, clean, saved("hers (edited)")),
  true,
  "saved own text settles it",
);
assert.equal(
  heldChangeSettledByUser(review, here, before, () => true, saved("hers (edited)")),
  false,
  "still unsaved: the change waits",
);
assert.equal(
  heldChangeSettledByUser(review, here, before, clean, saved("original")),
  false,
  "reverted, or a save that failed, leaves the text from before Edit: the change waits",
);
assert.equal(
  heldChangeSettledByUser(review, here, {}, clean, saved("x")),
  false,
  "nothing taken over: the change waits",
);
assert.equal(
  heldChangeSettledByUser({ ...review, editorTextOnly: false }, here, before, clean, saved("x")),
  false,
  "a held call the editor cannot take over still waits",
);
assert.equal(
  heldChangeSettledByUser(
    { ...review, fields: [...review.fields, { entityId: "c2", fieldId: "description", value: "x" }] },
    here,
    before,
    clean,
    saved("x"),
  ),
  false,
  "the same field on another character still waits",
);

// Only held calls that rewrite editor text fields can be taken over with Edit.
const update = (patch: Record<string, unknown>, action = "character.update") => ({
  name: "app_data",
  arguments: { action, characterId: "c1", patch },
});
assert.equal(heldCallsAreEditorText([update({ description: "a" })]), true, "a text update can be taken over");
assert.equal(
  heldCallsAreEditorText(Array.from({ length: 9 }, () => update({ description: "a" }))),
  true,
  "more calls than the card shows still count",
);
assert.equal(heldCallsAreEditorText([update({ description: "a" }), update({})]), false, "a call with no fields");
assert.equal(heldCallsAreEditorText([update({ description: "a", tags: ["x"] })]), false, "a field that is not text");
assert.equal(
  heldCallsAreEditorText([update({ description: "a" }, "character.delete")]),
  false,
  "a call that is no update",
);
assert.equal(heldCallsAreEditorText([]), false, "no held calls");

console.log("held-change-and-retry regression passed");

assert.equal(
  heldCallsAreEditorText([update({ description: "a", unknown_key: "x" })]),
  false,
  "a key no editor field shows keeps the change waiting",
);
assert.equal(
  heldCallsAreEditorText([update({ description: "a", extensions: { other_key: "x" } })]),
  false,
  "an extensions entry no editor field shows keeps the change waiting",
);

const dbStep = (id: string, status: "done" | "error", row: string, payload = "{}") => ({
  id,
  name: "bash",
  status,
  input: { command: `mari db patch characters ${row} --json '${payload}' --apply` },
  detail: null,
  output: null,
  startedAt: 1,
  updatedAt: 2,
});
assert.equal(
  isHardStepFailure(dbStep("d1", "error", "row-a"), [dbStep("d2", "done", "row-b")]),
  true,
  "a db patch on another row does not recover a failed one",
);
assert.equal(
  isHardStepFailure(dbStep("d1", "error", "row-a"), [dbStep("d2", "done", "row-a", '{"a":1}')]),
  false,
  "the same row with a new payload recovers it",
);
