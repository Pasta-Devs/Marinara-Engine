// Slice 74: the change receipt. A change Mari applies leaves a small record on her message - excerpts per
// field, list names, her reason, the undo deadline - so the card stays full after Keep / Undo / reload. This
// pins record building, the size cap, the merge of one run's commands, the old-message fallback state and
// the Keep / Undo outcome write-back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";

import {
  MARI_RECEIPT_LIMITS,
  excerptTextPair,
  mariReceiptReason,
  mariReceiptState,
  mariWorkspaceSessionId,
  mergeMariActionResults,
  withMariReceiptOutcome,
  type MariDbCommandResult,
  type MariDbRowChange,
  type MariWorkspaceActionResult,
} from "../../../packages/shared/src/index.js";
import {
  buildMariFailedActionResult,
  buildMariWorkspaceActionResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import { recordMariReceiptOutcome } from "../../../packages/server/src/routes/professor-mari-workspace.routes.js";
import { createChatsStorage } from "../../../packages/server/src/services/storage/chats.storage.js";
import { receiptSummary } from "../../../packages/client/src/components/chat/MariChangeReceipt.js";

function applied(preview: MariDbRowChange[], approvalId?: string): MariDbCommandResult {
  return {
    ok: true,
    mode: "apply",
    command: "app_data",
    summary: {
      matchedRows: preview.length,
      affectedRows: preview.length,
      insertedRows: 0,
      updatedRows: preview.length,
      replacedRows: 0,
      deletedRows: 0,
      affectedTables: {},
      preview,
      truncated: false,
    },
    approval: approvalId
      ? { status: "pending", id: approvalId, expiresAt: "2026-10-22T08:00:00.000Z" }
      : { status: "not_required" },
  };
}

// ── Record building: text, lists (greetings, the character's lorebook), reason, undo ──────────────
const shrekBefore = {
  id: "shrek",
  data: {
    name: "Shrek",
    description: "Big green ogre, lives in a swamp.",
    scenario: "",
    alternate_greetings: ["Shrek looks up."],
    character_book: { entries: [{ id: 1, comment: "Swamp", content: "Mud." }] },
    extensions: { talkativeness: "0.5" },
  },
};
const shrekAfter = {
  id: "shrek",
  data: {
    name: "Shrek",
    description: "Shrek, an ogre in his forties who guards a swamp.",
    scenario: "Villagers keep turning up at the swamp.",
    alternate_greetings: ["Shrek looks up.", "*He is mid-onion when you knock.*"],
    character_book: {
      entries: [
        { id: 1, comment: "Swamp", content: "Mud and onions." },
        { id: 2, comment: "Onion field", content: "Rows of onions." },
      ],
    },
    extensions: { talkativeness: "0.7" },
  },
};
const shrek = buildMariWorkspaceActionResult(
  "character.update",
  applied([{ table: "characters", id: "shrek", action: "update", before: shrekBefore, after: shrekAfter }], "rev-1"),
  "Every example line was about the swamp.",
);
assert.ok(shrek);
assert.equal(shrek.reviewId, "rev-1", "old readers still find the review");
assert.deepEqual(shrek.reviewIds, ["rev-1"]);
assert.equal(shrek.undoUntil, "2026-10-22T08:00:00.000Z", "the undo deadline comes from the review");
assert.equal(shrek.reason, "Every example line was about the swamp.");
assert.deepEqual(
  shrek.changes?.map((change) => `${change.kind}:${change.field}`),
  [
    "text:description",
    "text:scenario",
    "list:alternate_greetings",
    "list:character_book",
    "text:extensions.talkativeness",
  ],
  "editor order; a nested setting shows its changed key, not the whole object",
);
assert.equal(shrek.moreChanges, undefined, "one level of nesting is shown, nothing is left to count");
const greetings = shrek.changes?.find((change) => change.field === "alternate_greetings");
assert.deepEqual(greetings?.kind === "list" && greetings.added, ["*He is mid-onion when you knock.*"]);
const book = shrek.changes?.find((change) => change.field === "character_book");
assert.ok(book?.kind === "list");
assert.deepEqual(book.added, ["Onion field"], "a lorebook entry is named, never raw JSON");
assert.deepEqual(book.edited, ["Swamp"]);
assert.ok(!JSON.stringify(shrek.changes).includes('"content"'), "no row JSON in the record");

// A change with no restore copy (no review on the result) is saved and has no undo.
const unreviewed = buildMariWorkspaceActionResult(
  "character.update",
  applied([{ table: "characters", id: "shrek", action: "update", before: shrekBefore, after: shrekAfter }]),
);
assert.ok(unreviewed?.changes?.length, "the receipt is kept without a review too");
assert.equal(unreviewed?.reviewIds, undefined);
assert.equal(unreviewed?.undoUntil, undefined);
assert.equal(mariReceiptState(unreviewed!, new Set()), "saved");

// Slice 87: a created character keeps the name and all 14 fields, text and lists first, and no Keep / expiry is shown.
const fourteen = Object.fromEntries(
  Array.from({ length: 14 }, (_, index) => [`field${index}`, index % 2 ? `Value ${index}` : index]),
);
const created = buildMariWorkspaceActionResult(
  "character.create",
  applied(
    [
      {
        table: "characters",
        id: "mira",
        action: "insert",
        before: null,
        after: { id: "mira", data: { name: "Mira", ...fourteen } },
      },
    ],
    "rev-mira",
  ),
);
assert.equal(created?.status, "created");
assert.equal(created?.changes?.length, 15, "every created field and the name are kept, none counted");
assert.equal(created?.moreChanges, undefined);
assert.equal(created?.changes?.[0]?.field, "name", "text leads a created record");
assert.ok(
  created?.changes?.findIndex((change) => change.kind === "value") >
    created?.changes?.findIndex((change) => change.kind === "text"),
  "switches and numbers come after text on a created record",
);

// Slice 87: a new lorebook shows its entries with keys and text; its switches come last.
const lorebook = buildMariWorkspaceActionResult(
  "lorebook.create",
  applied(
    [
      {
        table: "lorebooks",
        id: "lore",
        action: "insert",
        before: null,
        after: { id: "lore", name: "Swamp rules", isGlobal: false, enabled: true, scanDepth: 2 },
      },
      {
        table: "lorebook_entries",
        id: "e3",
        action: "insert",
        before: null,
        after: {
          id: "e3",
          lorebookId: "lore",
          name: "Onions",
          keys: ["onion", "onions"],
          content: "Onions grow in the field.",
        },
      },
    ],
    "rev-lore",
  ),
);
const entriesOfLore = lorebook?.changes?.find((change) => change.field === "entries");
assert.ok(entriesOfLore?.kind === "list");
assert.deepEqual(entriesOfLore.items, [
  { name: "Onions", keys: ["onion", "onions"], text: "Onions grow in the field." },
]);
assert.ok(
  (lorebook?.changes?.findIndex((change) => change.field === "entries") ?? -1) <
    (lorebook?.changes?.findIndex((change) => change.kind === "value") ?? -1),
  "the entries come before the switches",
);
assert.ok(
  lorebook?.changes?.some((change) => change.field === "scanDepth"),
  "a switch is still shown",
);

// Slice 87: a preset's changed setting (parameters.maxTokens) is shown, not hidden in the field count.
const preset = buildMariWorkspaceActionResult(
  "preset.update",
  applied([
    {
      table: "prompt_presets",
      id: "preset",
      action: "update",
      before: { id: "preset", data: { description: "Old", parameters: { maxTokens: 512, temperature: 1 } } },
      after: { id: "preset", data: { description: "Old", parameters: { maxTokens: 1024, temperature: 1 } } },
    },
  ]),
);
assert.deepEqual(
  preset?.changes?.map((change) => change.field),
  ["parameters.maxTokens"],
  "only the setting that changed",
);
assert.equal(preset?.changes?.[0]?.kind === "value" && preset.changes[0].after, "1024");

// ── #7771: a nested change is shown on the card, not only counted ────────────────────────────────
// Interactive onboarding is the case that started this: it sits at `data.extensions.onboarding`, two
// levels under the row, so the old builder only counted it in `moreChanges`.
const question = (id: string, variableName: string) => ({
  id,
  variableName,
  question: `Where is the ${variableName}?`,
  options: [] as unknown[],
  allowCustom: true,
  multiSelect: false,
  separator: ",",
  displayMode: "text",
  optionSort: "manual",
});
const emptyOnboarding = {
  enabled: false,
  description: "",
  personality: "",
  backstory: "",
  appearance: "",
  scenario: "",
  variables: [] as unknown[],
  cardVariables: [] as unknown[],
};
const personaQuestions = ["hometown", "family", "fear", "dream", "voice"].map((name, index) =>
  question(`p${index}`, name),
);
const characterQuestion = question("c0", "title");
const writtenOnboarding = {
  ...emptyOnboarding,
  enabled: true,
  description: "A swamp ogre.",
  variables: personaQuestions,
  cardVariables: [characterQuestion],
};
const cardWith = (onboarding: unknown, personality = "Grumpy.") => ({
  id: "ogre",
  data: { name: "Ogre", personality, extensions: { onboarding } },
});
const onboarded = buildMariWorkspaceActionResult(
  "character.update",
  applied([
    {
      table: "characters",
      id: "ogre",
      action: "update",
      before: cardWith(emptyOnboarding),
      after: cardWith(writtenOnboarding, "Grumpy, but polite to guests."),
    },
  ]),
  "So the chat can start with a persona.",
);
assert.ok(onboarded);
const onboarding = onboarded.changes?.find((change) => change.field === "extensions.onboarding");
assert.ok(onboarding?.kind === "nested", "the onboarding change is its own excerpt");
assert.deepEqual(onboarding.onboarding, {
  enabled: true,
  personaQuestions: 5,
  characterQuestions: 1,
});
assert.deepEqual(
  onboarding.keys,
  ["description", "variables", "cardVariables"],
  "the changed keys; the state word says enabled",
);
assert.equal(onboarding.count, 3);
assert.equal(onboarded.moreChanges, undefined, "a shown nested change is not counted away");

// One question reworded: the same counts, and the questions array is named as what changed.
const editedOnboarding = {
  ...writtenOnboarding,
  variables: [{ ...personaQuestions[0]!, question: "Where is the swamp, exactly?" }, ...personaQuestions.slice(1)],
};
const edited = buildMariWorkspaceActionResult(
  "character.update",
  applied([
    {
      table: "characters",
      id: "ogre",
      action: "update",
      before: cardWith(writtenOnboarding),
      after: cardWith(editedOnboarding),
    },
  ]),
);
const editedNested = edited?.changes?.find((change) => change.field === "extensions.onboarding");
assert.ok(editedNested?.kind === "nested");
assert.deepEqual(editedNested.keys, ["variables"], "only the questions changed");
assert.equal(editedNested.onboarding?.personaQuestions, 5, "the counts still describe the onboarding");

// A card that had no onboarding: only what she wrote is named, not the untouched empty prose fields.
const addedOnboarding = buildMariWorkspaceActionResult(
  "character.update",
  applied([
    {
      table: "characters",
      id: "ogre",
      action: "update",
      before: { id: "ogre", data: { name: "Ogre", personality: "Grumpy." } },
      after: cardWith(writtenOnboarding),
    },
  ]),
);
const addedNested = addedOnboarding?.changes?.find((change) => change.field === "extensions.onboarding");
assert.ok(addedNested?.kind === "nested");
assert.deepEqual(addedNested.keys, ["description", "variables", "cardVariables"]);

// A list whose only difference is its order cannot be drawn: it still counts, so the receipt is not empty.
const reordered = buildMariWorkspaceActionResult(
  "preset.update",
  applied([
    {
      table: "prompt_presets",
      id: "reorder",
      action: "update",
      before: { id: "reorder", name: "Reorder", parameters: { stopStrings: ["a", "b"] } },
      after: { id: "reorder", name: "Reorder", parameters: { stopStrings: ["b", "a"] } },
    },
  ]),
);
assert.equal(reordered?.changes?.length, 0, "an order-only list change has no excerpt");
assert.equal(reordered?.moreChanges, 1, "but it is still counted as changed");
assert.match(
  receiptSummary(reordered!, (key, options) => `${key}${options ? JSON.stringify(options) : ""}`, "en"),
  /marichangereceipt\.labelMany\{"count":1\}/u,
  "a receipt with nothing nameable still says how many changed",
);

// Inside a nested object, only noisy keys changed (an id): nothing to draw, and it still counts.
const noiseOnly = buildMariWorkspaceActionResult(
  "character.update",
  applied([
    {
      table: "characters",
      id: "ogre",
      action: "update",
      before: { id: "ogre", data: { name: "Ogre", extensions: { plugin_settings: { id: "one" } } } },
      after: { id: "ogre", data: { name: "Ogre", extensions: { plugin_settings: { id: "two" } } } },
    },
  ]),
);
assert.equal(noiseOnly?.changes?.length, 0, "an id-only nested change draws nothing");
assert.equal(noiseOnly?.moreChanges, 1, "but it is still counted as changed");

// The same list beside a drawable setting: the setting shows, and the dropped list still counts.
const reorderedBeside = buildMariWorkspaceActionResult(
  "preset.update",
  applied([
    {
      table: "prompt_presets",
      id: "reorder",
      action: "update",
      before: { id: "reorder", name: "Reorder", parameters: { temperature: 0.8, stopStrings: ["a", "b"] } },
      after: { id: "reorder", name: "Reorder", parameters: { temperature: 0.9, stopStrings: ["b", "a"] } },
    },
  ]),
);
assert.deepEqual(
  reorderedBeside?.changes?.map((change) => change.field),
  ["parameters.temperature"],
  "the drawable setting is shown",
);
assert.equal(reorderedBeside?.moreChanges, 1, "the list that cannot be drawn is still counted");

// Two lists that cannot be drawn in one field count as two, with or without a drawable sibling.
const twoUndrawn = buildMariWorkspaceActionResult(
  "preset.update",
  applied([
    {
      table: "prompt_presets",
      id: "two",
      action: "update",
      before: { id: "two", name: "Two", parameters: { stopStrings: ["a", "b"], otherList: ["x", "y"] } },
      after: { id: "two", name: "Two", parameters: { stopStrings: ["b", "a"], otherList: ["y", "x"] } },
    },
  ]),
);
assert.equal(twoUndrawn?.moreChanges, 2, "each undrawn change counts once");

// Nested keys are stored uncapped so a merge can count the exact union; the card caps what it shows.
const keyRange = (offset: number) => Array.from({ length: 8 }, (_, index) => `key${offset + index}`);
const nestedResult = (keys: string[]): MariWorkspaceActionResult => ({
  status: "updated",
  resource: { kind: "character", id: "merge-keys", label: "Merge" },
  changedFields: ["extensions"],
  summary: "Updated character.",
  changes: [{ field: "extensions.settings", kind: "nested", keys, count: keys.length }],
});
const [mergedKeys] = mergeMariActionResults([nestedResult(keyRange(0)), nestedResult(keyRange(7))]);
const mergedNested = mergedKeys?.changes?.[0];
assert.ok(mergedNested?.kind === "nested");
assert.equal(mergedNested.count, 15, "8 + 8 keys with one shared count 15 once");
assert.equal(mergedNested.keys.length, 15, "keys are kept uncapped for the merge");
assert.ok(mergedNested.keys.length > MARI_RECEIPT_LIMITS.nestedKeys, "more keys than the card shows");

// Any other deeper object gets the general fallback: its changed keys by name.
const plugin = buildMariWorkspaceActionResult(
  "character.update",
  applied([
    {
      table: "characters",
      id: "ogre",
      action: "update",
      before: { id: "ogre", data: { name: "Ogre", extensions: { plugin_settings: { depth: 1, mode: "x" } } } },
      after: { id: "ogre", data: { name: "Ogre", extensions: { plugin_settings: { depth: 2, mode: "x" } } } },
    },
  ]),
);
const settings = plugin?.changes?.find((change) => change.field === "extensions.plugin_settings");
assert.ok(settings?.kind === "nested");
assert.deepEqual(settings.keys, ["depth"]);
assert.equal(settings.onboarding, undefined, "only the onboarding object gets the counts");
assert.equal(plugin?.moreChanges, undefined);

// A deeper list keeps its names (lorebook-style), instead of being counted.
const deeperList = buildMariWorkspaceActionResult(
  "preset.update",
  applied([
    {
      table: "prompt_presets",
      id: "pre",
      action: "update",
      before: { id: "pre", data: { name: "Preset", parameters: { stopStrings: ["</s>"] } } },
      after: { id: "pre", data: { name: "Preset", parameters: { stopStrings: ["</s>", "\nUser:"] } } },
    },
  ]),
);
const stopStrings = deeperList?.changes?.find((change) => change.field === "parameters.stopStrings");
assert.ok(stopStrings?.kind === "list");
assert.deepEqual(stopStrings.added, ["User:"], "names are flattened and clipped like every list name");

// The head line names the nested thing ("onboarding"), not the container ("extensions").
{
  const t = (key: string, options?: Record<string, unknown>) => `${key}${options ? JSON.stringify(options) : ""}`;
  const summary = receiptSummary(onboarded!, t, "en");
  assert.match(summary, /onboarding/u, "the summary says what changed");
  assert.doesNotMatch(summary, /extensions/u);
}

// Boilerplate reasons say nothing and are dropped.
assert.equal(mariReceiptReason("User asked to make Shrek less repetitive"), undefined);
assert.equal(mariReceiptReason("Update requested by user"), undefined);
assert.equal(mariReceiptReason("  So the lore fires.  "), "So the lore fires.");

// ── Excerpts: the window starts near the change, on a word ───────────────────────────────────────
const longBefore = `${"The swamp is quiet at dawn. ".repeat(20)}Shrek counts onions.`;
const longAfter = `${"The swamp is quiet at dawn. ".repeat(20)}Shrek counts his onions twice.`;
const window = excerptTextPair(longBefore, longAfter);
assert.ok(window.before.startsWith("…") && window.after.startsWith("…"), "a late edit is not shown from the start");
assert.ok(window.after.includes("counts his onions twice"), "the edit itself is in the window");
assert.ok(longAfter.includes(` ${window.after.slice(1, 15)}`), "the window starts on a word");

// ── Size cap ─────────────────────────────────────────────────────────────────────────────────────
const huge = "word ".repeat(4000);
const manyBefore: Record<string, unknown> = { id: "big", data: {} };
const manyAfter: Record<string, unknown> = { id: "big", data: {} };
for (let index = 0; index < 45; index += 1) {
  (manyBefore.data as Record<string, unknown>)[`field_${index}`] = `${huge}a`;
  (manyAfter.data as Record<string, unknown>)[`field_${index}`] = `b${huge}`;
}
(manyAfter.data as Record<string, unknown>).alternate_greetings = Array.from({ length: 40 }, (_, i) => `${huge}${i}`);
const big = buildMariWorkspaceActionResult(
  "character.update",
  applied([{ table: "characters", id: "big", action: "update", before: manyBefore, after: manyAfter }], "rev-big"),
  huge,
);
assert.ok(big?.changes);
assert.equal(big.changes.length, MARI_RECEIPT_LIMITS.changes, "at most 40 fields");
assert.ok((big.moreChanges ?? 0) >= 6, "the rest are counted");
for (const change of big.changes) {
  if (change.kind === "list") {
    assert.ok(change.added.length <= MARI_RECEIPT_LIMITS.names);
    for (const name of change.added) assert.ok(name.length <= MARI_RECEIPT_LIMITS.name);
  } else {
    assert.ok(
      change.before.length <= MARI_RECEIPT_LIMITS.text + 2 && change.after.length <= MARI_RECEIPT_LIMITS.text + 2,
    );
  }
}
assert.ok((big.reason ?? "").length <= MARI_RECEIPT_LIMITS.reason);
const bigBytes = Buffer.byteLength(JSON.stringify(big));
assert.ok(bigBytes < 70000, `a worst-case record stays bounded (${bigBytes} bytes)`);

// ── One run, one record: two entry edits of a lorebook merge, with both reviews ──────────────────
const entry = (id: string, name: string, action: MariDbRowChange["action"]): MariDbRowChange => ({
  table: "lorebook_entries",
  id,
  action,
  before: action === "insert" ? null : { id, lorebookId: "lore", name, content: "Old." },
  after: { id, lorebookId: "lore", name, content: "New." },
});
const first = buildMariWorkspaceActionResult(
  "lorebook.updateEntry",
  applied([entry("e1", "Swamp", "update")], "rev-a"),
);
const second = buildMariWorkspaceActionResult(
  "lorebook.createEntry",
  applied([entry("e2", "Onion field", "insert")], "rev-b"),
);
assert.equal(first?.resource.id, "lore");
const merged = mergeMariActionResults([first!, second!]);
assert.equal(merged.length, 1, "one receipt per record");
assert.deepEqual(merged[0]?.reviewIds, ["rev-a", "rev-b"]);
const entries = merged[0]?.changes?.find((change) => change.field === "entries");
assert.ok(entries?.kind === "list");
assert.deepEqual(entries.added, ["Onion field"]);
assert.deepEqual(entries.edited, ["Swamp"]);
assert.deepEqual(entries.count, { added: 1, edited: 1, removed: 0 });
const editedTwice = mergeMariActionResults([
  first!,
  buildMariWorkspaceActionResult("lorebook.updateEntry", applied([entry("e1", "Swamp", "update")], "rev-c"))!,
]);
const swampItems = editedTwice[0]?.changes?.find((change) => change.field === "entries");
assert.ok(swampItems?.kind === "list");
assert.deepEqual(
  swampItems.items?.map((item) => item.name),
  ["Swamp"],
  "an entry edited twice in one run shows once",
);
assert.ok(
  mergeMariActionResults(
    Array.from({ length: 30 }, (_, i) => ({ ...first!, resource: { ...first!.resource, id: `r${i}` } })),
  ).length <= MARI_RECEIPT_LIMITS.records,
  "at most 12 records per message",
);

// ── Fallback state: an old message has no excerpts and no known outcome ──────────────────────────
const old: MariWorkspaceActionResult = {
  status: "updated",
  resource: { kind: "character", id: "shrek", label: "Shrek" },
  changedFields: ["character_book"],
  reviewId: "rev-old",
  summary: "Updated character “Shrek”.",
};
assert.equal(mariReceiptState(old, new Set()), "old");
assert.equal(mariReceiptState(old, new Set(["rev-old"])), "open", "an old change can still be answered");
assert.equal(mariReceiptState(shrek, new Set(["rev-1"])), "open");
assert.equal(mariReceiptState(shrek, new Set()), "closed", "the undo record is gone, unanswered");
assert.equal(mariReceiptState(shrek, new Set(), new Map([["rev-1", "kept"]])), "kept", "a live answer wins");
assert.equal(mariReceiptState({ ...shrek, outcome: "undone" }, new Set()), "undone");

// ── Outcome write-back: Keep / Undo marks the receipt on the message that made the change ─────────
assert.equal(withMariReceiptOutcome([shrek], "other", "kept"), null, "another message is left alone");
assert.equal(withMariReceiptOutcome([shrek], "rev-1", "kept")?.[0]?.outcome, "kept");

const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const db = await getDB();
try {
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Receipt regression", mode: "conversation", characterIds: [] });
  assert.ok(chat);
  const older = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Earlier." });
  const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Done." });
  assert.ok(older && message);
  await chats.updateMessageExtra(older.id, { mariWorkspaceActionResults: [gandalfResult()] });
  await chats.updateMessageExtra(message.id, { mariWorkspaceActionResults: merged });
  const app = { db } as unknown as FastifyInstance;
  await recordMariReceiptOutcome(app, mariWorkspaceSessionId(chat.id), "rev-b", "undone");
  const extraOf = async (id: string) => {
    const row = await chats.getMessage(id);
    return (typeof row?.extra === "string" ? JSON.parse(row.extra) : row?.extra) as {
      mariWorkspaceActionResults: MariWorkspaceActionResult[];
    };
  };
  assert.equal((await extraOf(message.id)).mariWorkspaceActionResults[0]?.outcome, "undone");
  assert.equal((await extraOf(older.id)).mariWorkspaceActionResults[0]?.outcome, undefined);
  // A review from no Mari chat (the CLI) has no message to mark; nothing throws.
  await recordMariReceiptOutcome(app, "professor-mari-workspace", "rev-b", "kept");
} finally {
  await closeDB();
}

function gandalfResult(): MariWorkspaceActionResult {
  return {
    status: "updated",
    resource: { kind: "character", id: "gandalf", label: "Gandalf" },
    changedFields: ["scenario"],
    reviewId: "rev-gandalf",
    reviewIds: ["rev-gandalf"],
    summary: "Updated character “Gandalf”.",
  };
}

// Slice 87: an apply that did not save leaves a "Not saved" result with the reason; a dry run leaves none.
const failed = buildMariFailedActionResult(
  "character.update",
  { apply: true, id: "shrek", data: { name: "Shrek" } },
  "x ".repeat(400),
);
assert.equal(failed?.status, "failed");
assert.equal(failed?.resource.id, "shrek");
assert.equal(failed?.resource.label, "Shrek");
assert.ok((failed?.error ?? "").length <= 300, "the reason is clipped");
assert.equal(
  buildMariFailedActionResult("character.update", { apply: false, id: "shrek" }, "no"),
  null,
  "a dry run leaves no card",
);
assert.equal(
  buildMariFailedActionResult("character.get", { apply: true, id: "shrek" }, "not found"),
  null,
  "a failed read sent with apply:true wrote nothing, so it leaves no Not saved card",
);
assert.equal(
  buildMariFailedActionResult("chat.updateMessage", { apply: true }, "no"),
  null,
  "a message fix has no card here",
);
assert.equal(
  buildMariFailedActionResult("character.create", { apply: true, data: { name: "Mira" } }, "bad")?.resource.id,
  "new",
  "a create that failed has no id yet",
);

// Slice 87: the card has no Keep (an applied change is saved; Undo is the only answer), and every changed
// field stays reachable behind "Show all".
const card = readFileSync(
  new URL("../../../packages/client/src/components/chat/MariChangeReceipt.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(card, /mariappliededit\.keep|marichangereceipt\.keepAll|, true\)/u, "a change card has no Keep");
assert.match(card, /marichangereceipt\.showAll/u, "every changed field is reachable from the card");
assert.match(card, /marichangereceipt\.createdMany/u, "three new characters read as Created 3 characters");
assert.match(
  card,
  /marichangereceipt\.onboardingOn/u,
  "the card says whether onboarding is on, not just that a field changed",
);

// A new lorebook's head line counts its fields and its entries apart: "3 fields · 3 entries", not "6 fields".
{
  const t = (key: string, options?: Record<string, unknown>) => `${key}${options ? JSON.stringify(options) : ""}`;
  const lorebook = {
    status: "created",
    resource: { kind: "lorebook", id: "lb1" },
    changes: [
      { field: "name", kind: "value", before: "", after: "Harbour" },
      { field: "description", kind: "text", before: "", after: "The harbour book." },
      {
        field: "entries",
        kind: "list",
        added: ["Gull", "Pier", "Tide"],
        edited: [],
        removed: [],
        count: { added: 3, edited: 0, removed: 0 },
        items: [{ name: "Gull" }, { name: "Pier" }, { name: "Tide" }],
      },
    ],
    moreChanges: 0,
  } as unknown as MariWorkspaceActionResult;
  const summary = receiptSummary(lorebook, t, "en");
  assert.match(summary, /marichangereceipt\.fieldCount\{"count":2\}/u, "fields exclude the entry list");
  assert.match(summary, /marichangereceipt\.entryCount\{"count":3\}/u, "entries are counted on their own");
}

console.log("change-receipt regression passed");
