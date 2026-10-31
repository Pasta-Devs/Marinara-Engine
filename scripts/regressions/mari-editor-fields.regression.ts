// Prof. Mari points at real Character editor fields: a change-card path and a running
// `character.update` step must name the same `data-mari-field` id the editor puts on the field.
import assert from "node:assert/strict";
import {
  formFieldValue,
  mariPatchFieldId,
  editorFieldId,
  heldEditorFields,
  keptEditorFields,
  withFormFieldValue,
  hasMariField,
  mariWorkingFieldFromTool,
  mariFieldDraft,
  appDataAction,
  rebaseUntouchedKeys,
  mariEditorKindForAction,
  mariEditorKindForTable,
  mariFieldPath,
  declinedForHeldChange,
  heldChangeSettledByUser,
  keptAfterPresave,
  appliesWithoutReview,
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
const longDraft = mariFieldDraft("description", "x".repeat(20_001), 0, 20_001);
assert.equal(longDraft?.value.length, 20_000, "a long field is capped like the route schema");
assert.equal(longDraft?.selection?.length, 4_000, "a long selection is capped like the route schema");
assert.equal(mariFieldDraft("tags", "half-typed", 0, 4), null, "a tag input is not the Tags field content");

// Patch keys in every spelling the server accepts map to the editor id; unknown keys do not.
assert.equal(mariPatchFieldId("character", "firstMes"), "first_mes");
assert.equal(mariPatchFieldId("character", "firstMessage"), "first_mes");
assert.equal(mariPatchFieldId("character", "postHistoryInstructions"), "post_history_instructions");
assert.equal(mariPatchFieldId("character", "backstory"), "extensions.backstory");
assert.equal(mariPatchFieldId("character", "appearance"), "extensions.appearance");
assert.equal(mariPatchFieldId("character", "description"), "description");
assert.equal(mariPatchFieldId("character", "characterId"), null);
assert.equal(mariPatchFieldId("character", "comment"), null);

// A running step: the first field of its patch, wherever the fields sit.
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", {
    action: "character.update",
    characterId: "c1",
    patch: { appearance: "Silver hair", personality: "Dry" },
    apply: true,
  }),
  { entityId: "c1", path: "extensions.appearance" },
);
assert.deepEqual(mariWorkingFieldFromTool("app_data", { action: "character.update", id: "c2", firstMes: "Hi" }), {
  entityId: "c2",
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
    { entityId: "c1", path: "scenario" },
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
  heldEditorFields([
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
    { name: "app_data", arguments: { action: "lorebook.create", lorebookId: "l1", patch: { description: "No" } } },
    { name: "write", arguments: { path: "x" } },
  ]),
  [
    { entityId: "c1", fieldId: "description", value: long },
    { entityId: "c1", fieldId: "personality", value: "Warm" },
    { entityId: "c1", fieldId: "extensions.backstory", value: "Swamp" },
    { entityId: "c1", fieldId: "first_mes", value: "Hi" },
  ],
);
assert.deepEqual(heldEditorFields(null), []);

// Kept: only a character update whose review is still pending can be undone from the field.
const updated = {
  resource: { kind: "character", id: "c1" },
  status: "updated",
  changedFields: ["data.personality", "data.description", "data.tags"],
  reviewIds: ["r1"],
  undoUntil: "2026-10-28T14:32:00.000Z",
};
assert.deepEqual(keptEditorFields([updated], [{ id: "r1" }]), {
  reviewIds: ["r1"],
  fields: [
    { entityId: "c1", fieldId: "description" },
    { entityId: "c1", fieldId: "personality" },
  ],
  undoUntil: "2026-10-28T14:32:00.000Z",
});
assert.deepEqual(keptEditorFields([updated], []), { reviewIds: [], fields: [], undoUntil: null });

// Reading and writing a field by its editor id (Edit, and the user's text after her change).
const server = { description: "Hers", extensions: { backstory: "Hers b", talkativeness: 0.5 } };
assert.deepEqual(withFormFieldValue(server, "extensions.backstory", "Mine b"), {
  description: "Hers",
  extensions: { backstory: "Mine b", talkativeness: 0.5 },
});
assert.equal(server.extensions.backstory, "Hers b");
assert.equal(formFieldValue(server, "extensions.backstory"), "Hers b");
assert.equal(formFieldValue(server, "extensions.missing"), "");

// Slice 7a: the Persona editor joins through its own table entry. Its columns are camelCase,
// a snake_case key names the same column, and character-only keys do not leak in.
assert.equal(mariPatchFieldId("persona", "imageAppearance"), "imageAppearance");
assert.equal(mariPatchFieldId("persona", "image_appearance"), "imageAppearance");
assert.equal(mariPatchFieldId("persona", "creator_notes"), "creatorNotes");
assert.equal(mariPatchFieldId("persona", "mesExample"), "mes_example");
assert.equal(mariPatchFieldId("persona", "backstory"), "backstory");
assert.equal(mariPatchFieldId("persona", "first_mes"), null);
assert.equal(mariPatchFieldId("persona", "aboutMe"), null);
assert.equal(mariPatchFieldId("character", "imageAppearance"), null);
// Finding 1: separators are dropped as on the server, so `persona_update` is no action.
assert.equal(appDataAction("Personas.Update"), "persona.update");
assert.equal(mariEditorKindForAction("Personas.Update"), "persona");
assert.equal(mariEditorKindForAction("persona_update"), null);
assert.equal(mariEditorKindForAction("character-update"), null);
assert.equal(mariEditorKindForAction("lorebook.delete"), null);
assert.equal(mariEditorKindForTable("personas"), "persona");
assert.equal(hasMariField("backstory", "persona"), true);
assert.equal(hasMariField("backstory"), false);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "persona.update", personaId: "p1", patch: { scenario: "Rain" } }),
  { entityId: "p1", path: "scenario" },
);
assert.deepEqual(
  heldEditorFields([
    {
      name: "app_data",
      arguments: { action: "persona.update", id: "p1", data: { mes_example: "Hey", summary: "Short" } },
    },
    { name: "app_data", arguments: { action: "character.update", characterId: "c1", patch: { description: "Card" } } },
  ]),
  [
    { entityId: "p1", fieldId: "summary", value: "Short" },
    { entityId: "c1", fieldId: "description", value: "Card" },
    { entityId: "p1", fieldId: "mes_example", value: "Hey" },
  ],
);
assert.deepEqual(
  keptEditorFields(
    [
      {
        resource: { kind: "persona", id: "p1" },
        status: "updated",
        changedFields: ["aboutMe", "imageAppearance", "description"],
        reviewId: "r2",
      },
    ],
    [{ id: "r2" }],
  ),
  {
    reviewIds: ["r2"],
    fields: [{ entityId: "p1", fieldId: "description" }],
    undoUntil: null,
  },
);

// Finding 2: each kind reads only its server's wrappers.
assert.equal(
  mariWorkingFieldFromTool("app_data", { action: "persona.update", personaId: "p1", card: { scenario: "Rain" } }),
  null,
);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "persona.update", personaId: "p1", persona: { scenario: "Rain" } }),
  { entityId: "p1", path: "scenario" },
);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "character.update", characterId: "c1", card: { scenario: "Rain" } }),
  { entityId: "c1", path: "scenario" },
);
// Finding 3: `id` wins over the kind's id argument, as on the server.
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "persona.update", id: "p2", personaId: "p1", scenario: "Rain" }),
  { entityId: "p2", path: "scenario" },
);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "character.update", id: "c2", characterId: "c1", scenario: "Rain" }),
  { entityId: "c2", path: "scenario" },
);

// Slice 7b: the Lorebook editor. Book fields go by their key; an entry's record is the entry (the server
// reads `entryId` first) and its fields anchor under `entries.<entryId>.` beside the book's.
assert.equal(appDataAction("Lorebooks.Entries.Update"), "lorebook.updateentry");
assert.equal(appDataAction("lorebook.update_entry"), "lorebook.updateentry");
assert.equal(mariEditorKindForAction("lorebook.entry.update"), "lorebookEntry");
assert.equal(mariEditorKindForAction("lorebooks.update"), "lorebook");
assert.equal(mariEditorKindForTable("lorebook_entries"), "lorebookEntry");
assert.equal(mariFieldPath("lorebookEntry", "e1", "content"), "entries.e1.content");
assert.equal(mariFieldPath("lorebook", "l1", "description"), "description");
assert.equal(hasMariField("content", "lorebookEntry"), true);
assert.equal(hasMariField("probability", "lorebookEntry"), false);
assert.equal(mariFieldDraft("entries.e1.keys", "half", 0, 2), null, "a key input is not the Keys field content");
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", {
    action: "lorebook.updateEntry",
    id: "x",
    entryId: "e1",
    entry: { content: "Rain" },
  }),
  { entityId: "e1", path: "entries.e1.content" },
);
assert.equal(
  mariWorkingFieldFromTool("app_data", {
    action: "lorebook.updateEntry",
    entryId: "e1",
    lorebook: { content: "Rain" },
  }),
  null,
);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", {
    action: "lorebooks.update",
    lorebookId: "l1",
    lorebook: { description: "Old" },
  }),
  { entityId: "l1", path: "description" },
);
assert.deepEqual(
  heldEditorFields([
    {
      name: "app_data",
      arguments: {
        action: "lorebook.updateEntry",
        entryId: "e1",
        patch: { content: "C", keys: ["a"], description: "D" },
      },
    },
    {
      name: "app_data",
      arguments: { action: "lorebook.update", id: "l1", data: { description: "Book", scanDepth: 3 } },
    },
  ]),
  [
    { entityId: "e1", fieldId: "entries.e1.description", value: "D" },
    { entityId: "l1", fieldId: "description", value: "Book" },
    { entityId: "e1", fieldId: "entries.e1.content", value: "C" },
  ],
);
// Kept: a lorebook result names only the book, also for an entry edit; the pending review's rows
// name the records and their changed columns.
assert.deepEqual(
  keptEditorFields(
    [{ resource: { kind: "lorebook", id: "l1" }, status: "updated", changedFields: ["content"], reviewId: "r3" }],
    [
      {
        id: "r3",
        diffPreview: [
          {
            table: "lorebook_entries",
            id: "e1",
            action: "update",
            before: { content: "a", order: 1, updatedAt: "1" },
            after: { content: "b", order: 1, updatedAt: "2" },
          },
          { table: "lorebooks", id: "l1", action: "update", before: { description: "x" }, after: { description: "y" } },
        ],
      },
    ],
  ),
  {
    reviewIds: ["r3"],
    fields: [
      { entityId: "l1", fieldId: "description" },
      { entityId: "e1", fieldId: "entries.e1.content" },
    ],
    undoUntil: null,
  },
);

// Every Accept path (field, card, chip) reads the declined ids of the change that waits now, and no other.
{
  const waiting = { mode: "waiting", key: "m1" } as Parameters<typeof declinedForHeldChange>[0];
  assert.deepEqual(declinedForHeldChange(waiting, { key: "m1", fields: [{ entityId: "c1", fieldId: "first_mes" }] }), [
    { entityId: "c1", fieldId: "first_mes" },
  ]);
  assert.deepEqual(
    declinedForHeldChange(waiting, { key: "m0", fields: [{ entityId: "c1", fieldId: "first_mes" }] }),
    [],
  );
  assert.deepEqual(
    declinedForHeldChange({ mode: "busy" }, { key: "m1", fields: [{ entityId: "c1", fieldId: "first_mes" }] }),
    [],
  );
  assert.deepEqual(declinedForHeldChange(null, { key: "m1", fields: [{ entityId: "c1", fieldId: "first_mes" }] }), []);
}

// Not this one: a declined field leaves its held call, the rest still applies.
{
  const { withoutDeclinedMariFields } = await import("../../packages/shared/src/utils/mari-editor-fields.js");
  const call = (args: Record<string, unknown>) => ({ name: "app_data", arguments: args });
  const held = [
    call({ action: "character.update", id: "c1", apply: true, patch: { description: "D", firstMes: "F" } }),
    call({ action: "character.update", id: "c1", apply: true, backstory: "B" }),
    call({ action: "character.update", id: "c2", apply: true, patch: { firstMes: "G" } }),
    call({ action: "lorebook.updateentry", entryId: "e1", patch: { content: "C" } }),
  ];
  const field = (entityId: string, fieldId: string) => ({ entityId, fieldId });
  const kept = withoutDeclinedMariFields(held, [field("c1", "first_mes"), field("c1", "extensions.backstory")]);
  assert.equal(kept.length, 3);
  assert.deepEqual(kept[0]!.arguments.patch, { description: "D" });
  // The same field of another record, and another record's call, stay.
  assert.equal(kept[1], held[2]);
  assert.equal(kept[2], held[3]);
  assert.deepEqual(withoutDeclinedMariFields(held, []), held);
  assert.equal(withoutDeclinedMariFields(held, [field("c1", "description"), field("c1", "first_mes")]).length, 3);
  assert.equal(withoutDeclinedMariFields(held, [field("e1", "entries.e1.content")]).length, 3);
  // Keys the review does not show (`aboutMe`) still run when their field is the only one declined.
  const extra = [
    call({ action: "character.update", id: "c1", apply: true, patch: { description: "D", aboutMe: "A" } }),
  ];
  assert.deepEqual(withoutDeclinedMariFields(extra, [field("c1", "description")])[0]!.arguments.patch, {
    aboutMe: "A",
  });
}

// Slice 7c: the Preset and Agent editors. Their own fields only; prompt sections have their own action.
assert.equal(appDataAction("promptPresets.update"), "preset.update");
assert.equal(appDataAction("Agents.Update"), "agent.update");
assert.equal(mariEditorKindForAction("promptPreset.update"), "preset");
assert.equal(mariEditorKindForAction("agent.update"), "agent");
assert.equal(mariEditorKindForAction("preset.updateSection"), null, "a prompt section is its own record");
assert.equal(mariEditorKindForTable("prompt_presets"), "preset");
assert.equal(mariEditorKindForTable("agent_configs"), "agent");
assert.equal(mariPatchFieldId("preset", "game_prompt"), "gamePrompt");
assert.equal(mariPatchFieldId("agent", "prompt"), "promptTemplate");
assert.equal(hasMariField("conversationPrompt", "preset"), true);
assert.equal(hasMariField("settings", "agent"), false);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", {
    action: "agent.update",
    agentId: "a1",
    agent: { promptTemplate: "Be brief." },
  }),
  { entityId: "a1", path: "promptTemplate" },
);
assert.deepEqual(
  mariWorkingFieldFromTool("app_data", { action: "preset.update", presetId: "p1", patch: { description: "x" } }),
  { entityId: "p1", path: "description" },
);

// A send in Bypass/accept-edits saved the user's text while "m1" was the newest message: only a later
// message's kept change is that run's; the change already shown, or a send that saved nothing, is not.
assert.equal(keptAfterPresave("m1", "m2"), true);
assert.equal(keptAfterPresave("", "m1"), true, "the first message of a new chat");
assert.equal(keptAfterPresave("m1", "m1"), false, "the kept change from before the send");
assert.equal(keptAfterPresave(null, "m2"), false, "a send that saved nothing");
assert.equal(appliesWithoutReview("bypass"), true);
assert.equal(appliesWithoutReview("accept-edits"), true);
for (const mode of ["auto", "manual", "plan"]) assert.equal(appliesWithoutReview(mode), false, mode);

// Single-line fields get the in-field review too, first in editor order; list fields (tags, keys) stay on her card.
assert.deepEqual(
  heldEditorFields([
    {
      name: "app_data",
      arguments: {
        action: "character.update",
        characterId: "c1",
        patch: { description: "D", creator: "Me", name: "Shrek", characterVersion: "2", tags: ["a"] },
      },
    },
    { name: "app_data", arguments: { action: "persona.update", id: "p1", patch: { phoneticName: "Pee", name: "P" } } },
    {
      name: "app_data",
      arguments: { action: "lorebook.updateEntry", entryId: "e1", patch: { content: "C", name: "Gate", keys: ["k"] } },
    },
  ]).map(({ fieldId, value }) => [fieldId, value]),
  // Sorted by each kind's review rank, across records.
  [
    ["name", "Shrek"],
    ["name", "P"],
    ["entries.e1.name", "Gate"],
    ["creator", "Me"],
    ["character_version", "2"],
    ["phoneticName", "Pee"],
    ["entries.e1.content", "C"],
    ["description", "D"],
  ],
);

// Nothing taken over never settles a held change.
{
  const none = heldChangeSettledByUser(
    { fields: [], editorTextOnly: true },
    () => true,
    {},
    () => false,
    () => "x",
  );
  assert.equal(none, false);
}

console.log("mari-editor-fields regression passed");

// Agent Save rebases `settings` (stored whole) onto her newer record: keys the user left alone take
// her value, keys the user changed keep the user's value, and a key she removed goes.
assert.deepEqual(
  rebaseUntouchedKeys(
    { runInterval: 3, contextSize: 8, maxTokens: 100, keep: 1 },
    { runInterval: 3, contextSize: 4, maxTokens: 100, keep: 1 },
    { runInterval: 3, contextSize: 4, maxTokens: 100 },
    { runInterval: 5, contextSize: 6 },
  ),
  { runInterval: 5, contextSize: 8, keep: 1 },
);
