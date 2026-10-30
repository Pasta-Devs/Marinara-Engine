// Prof. Mari points at real Character editor fields: a change-card path and a running
// `character.update` step must name the same `data-mari-field` id the editor puts on the field.
import assert from "node:assert/strict";
import {
  characterFieldValue,
  characterPatchFieldId,
  editorFieldId,
  heldCharacterFields,
  keptCharacterFields,
  withCharacterFieldValue,
  hasMariField,
  mariWorkingFieldFromTool,
  mariFieldDraft,
} from "../../packages/client/src/lib/mari-editor-fields.js";

// Change-card paths come from the row's `data` column.
assert.equal(editorFieldId("data.first_mes"), "first_mes");
assert.equal(editorFieldId("data.extensions.backstory"), "extensions.backstory");
assert.equal(editorFieldId("description"), "description");
assert.deepEqual(mariFieldDraft("description", "Make this warmer", 0, 9), {
  fieldId: "description",
  value: "Make this warmer",
  selection: "Make this",
});
assert.deepEqual(mariFieldDraft("description", "Draft", 2, 2), { fieldId: "description", value: "Draft" });
assert.equal(mariFieldDraft("tags", "half-typed", 0, 4), null, "a tag input is not the Tags field content");

// Patch keys in every spelling the server accepts map to the editor id; unknown keys do not.
assert.equal(characterPatchFieldId("firstMes"), "first_mes");
assert.equal(characterPatchFieldId("firstMessage"), "first_mes");
assert.equal(characterPatchFieldId("postHistoryInstructions"), "post_history_instructions");
assert.equal(characterPatchFieldId("backstory"), "extensions.backstory");
assert.equal(characterPatchFieldId("appearance"), "extensions.appearance");
assert.equal(characterPatchFieldId("description"), "description");
assert.equal(characterPatchFieldId("characterId"), null);
assert.equal(characterPatchFieldId("comment"), null);

// A running step: the first field of its patch, wherever the fields sit.
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", {
    action: "character.update",
    characterId: "c1",
    patch: { appearance: "Silver hair", personality: "Dry" },
    apply: true,
  }),
  { characterId: "c1", path: "extensions.appearance" },
);
assert.deepEqual(mariWorkingFieldFromTool("app_data", { action: "character.update", id: "c2", firstMes: "Hi" }), {
  characterId: "c2",
  path: "first_mes",
});
// Not a character field edit: no glow.
assert.equal(mariWorkingFieldFromTool("app_data", { action: "character.create", data: { name: "X" } }), null);
assert.equal(
  mariWorkingFieldFromTool("app_data", { action: "character.update", characterId: "c1", comment: "x" }),
  null,
);
assert.equal(
  mariWorkingFieldFromTool("web_search", { action: "character.update", characterId: "c1", name: "X" }),
  null,
);

// The server's action aliases glow too.
for (const action of ["characters.update", "Character.Update", " CHARACTERS.update "]) {
  assert.deepEqual(
    mariWorkingFieldFromTool("app_data", { action, characterId: "c1", patch: { scenario: "Storm" } }),
    { characterId: "c1", path: "scenario" },
    action,
  );
}

// "Open at this field" only for fields the editor anchors (itself or its parent).
assert.equal(hasMariField("data.first_mes"), true);
assert.equal(hasMariField("data.extensions.backstory"), true);
assert.equal(hasMariField("data.extensions.depth_prompt.role"), true);
assert.equal(hasMariField("data.tags"), true);
assert.equal(hasMariField("name"), true);
assert.equal(hasMariField("data.extensions.talkativeness"), false);
assert.equal(hasMariField("avatarPath"), false);
assert.equal(hasMariField("data.extensions"), false);

// Slice 5: the fields a held change would write, full values, in editor order; a later call to
// the same field wins; lists, unknown keys and other records' actions stay out.
const long = "x".repeat(900);
assert.deepEqual(
  heldCharacterFields([
    {
      name: "app_data",
      arguments: { action: "character.update", characterId: "c1", patch: { firstMes: "Hi", tags: ["a"] } },
    },
    {
      name: "app_data",
      arguments: { action: "Character.Update", id: "c1", data: { description: long, personality: "Dry" } },
    },
    {
      name: "app_data",
      arguments: { action: "character.update", characterId: "c1", extensions: { backstory: "Swamp" } },
    },
    { name: "app_data", arguments: { action: "character.update", characterId: "c1", patch: { personality: "Warm" } } },
    { name: "app_data", arguments: { action: "lorebook.update", lorebookId: "l1", patch: { description: "No" } } },
    { name: "write", arguments: { path: "x" } },
  ]),
  [
    { characterId: "c1", fieldId: "description", value: long },
    { characterId: "c1", fieldId: "personality", value: "Warm" },
    { characterId: "c1", fieldId: "extensions.backstory", value: "Swamp" },
    { characterId: "c1", fieldId: "first_mes", value: "Hi" },
  ],
);
assert.deepEqual(heldCharacterFields(null), []);

// Kept: only a character update whose review is still pending can be undone from the field.
const updated = {
  resource: { kind: "character", id: "c1" },
  status: "updated",
  changedFields: ["data.personality", "data.description", "data.tags"],
  reviewIds: ["r1"],
  undoUntil: "2026-10-28T14:32:00.000Z",
};
assert.deepEqual(keptCharacterFields([updated], new Set(["r1"])), {
  reviewIds: ["r1"],
  fields: [
    { characterId: "c1", fieldId: "description" },
    { characterId: "c1", fieldId: "personality" },
  ],
  undoUntil: "2026-10-28T14:32:00.000Z",
});
assert.deepEqual(keptCharacterFields([updated], new Set()), { reviewIds: [], fields: [], undoUntil: null });

// Reading and writing a field by its editor id (Edit, and the user's text after her change).
const server = { description: "Hers", extensions: { backstory: "Hers b", talkativeness: 0.5 } };
assert.deepEqual(withCharacterFieldValue(server, "extensions.backstory", "Mine b"), {
  description: "Hers",
  extensions: { backstory: "Mine b", talkativeness: 0.5 },
});
assert.equal(server.extensions.backstory, "Hers b");
assert.equal(characterFieldValue(server, "extensions.backstory"), "Hers b");
assert.equal(characterFieldValue(server, "extensions.missing"), "");

console.log("mari-editor-fields regression passed");
