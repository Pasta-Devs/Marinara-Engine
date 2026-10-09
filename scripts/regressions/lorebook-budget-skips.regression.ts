/**
 * #7325: with every lorebook budget turned off, an entry whose text is blank, or that macros
 * resolve to nothing, was reported as "skipped by token budget" (blocked by the chat budget,
 * "3 / 0"). Such an entry has nothing to add, so no budget skipped it, and its macros
 * ({{setvar}}) still apply. Real budget skips are still reported, each naming the budget that
 * blocked it.
 */
import assert from "node:assert/strict";

const { createLorebookEntrySchema } = await import("../../packages/shared/src/index.js");
const { processLorebooks, resolveAndBudgetActivatedLorebookEntriesWithDiagnostics } =
  await import("../../packages/server/src/services/lorebook/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { resolveMacrosWithVariableSnapshot } =
  await import("../../packages/server/src/services/prompt/macro-context.js");

type Entry = ReturnType<typeof createLorebookEntrySchema.parse> & { id: string };
const image = { path: "lorebook-images/coat.png", caption: "Blue coat" };
const longText = "The Three swore the oath at the northern gate. ".repeat(20);
const setvarOnly = (value: string) => value.replace(/\{\{setvar::[^}]*\}\}/gu, "");

function activation(id: string, content: string, overrides: Record<string, unknown> = {}) {
  const entry = {
    ...createLorebookEntrySchema.parse({ lorebookId: "book", name: id, keys: ["vibrance"], content }),
    id,
    ...overrides,
  } as Entry;
  return { entry, matchedKeys: ["vibrance"], activationSources: ["keyword" as const], injectionOrder: entry.order };
}

const budgets = (lorebookBudget: number) =>
  new Map([["book", { name: "The Three", tokenBudget: lorebookBudget, entryLimit: 100 }]]);
const run = (entries: ReturnType<typeof activation>[], lorebookBudget: number, chatBudget: number) =>
  resolveAndBudgetActivatedLorebookEntriesWithDiagnostics(
    entries as never,
    budgets(lorebookBudget) as never,
    chatBudget,
    0,
    setvarOnly,
  );
const ids = (rows: Array<{ entry: { id: string } }>) => rows.map((row) => row.entry.id).sort();

// Budgets off: text and image-only entries go in; blank and macro-emptied entries are not "skipped".
{
  const result = run(
    [
      activation("facts", "Vibrance is the eldest of The Three."),
      activation("blank", "   "),
      activation("setter", "{{setvar::met_vibrance::yes}}"),
      activation("picture", "", { images: [image] }),
    ],
    0,
    0,
  );
  assert.deepEqual(ids(result.selected), ["facts", "picture"]);
  assert.deepEqual(result.budgetSkippedEntries, [], "nothing is skipped by a budget when every budget is off");
}

// A {{setvar}}-only entry adds no text, but its variable still applies, so an entry that reads it keeps its text.
{
  const macroContext = { user: "User", char: "Char", characters: ["Char"], variables: {} as Record<string, string> };
  const result = resolveAndBudgetActivatedLorebookEntriesWithDiagnostics(
    [
      activation("setter", "{{setvar::met_vibrance::yes}}", { order: 1 }),
      activation("trust", '{{#if {{getvar::met_vibrance}} == "yes"}}Vibrance trusts you.{{/if}}', { order: 2 }),
    ] as never,
    budgets(0) as never,
    0,
    0,
    (value: string) => resolveMacrosWithVariableSnapshot(value, macroContext as never),
  );
  assert.deepEqual(
    result.selected.map((row) => [row.entry.id, row.entry.content]),
    [["trust", "Vibrance trusts you."]],
  );
  assert.equal(macroContext.variables.met_vibrance, "yes", "the {{setvar}} entry's variable is kept");
  assert.deepEqual(result.budgetSkippedEntries, []);
}

// Real skips still report the budget that blocked them.
{
  const chat = run([activation("short", "Short."), activation("long", longText)], 0, 20);
  assert.deepEqual(ids(chat.selected), ["short"]);
  assert.deepEqual(
    chat.budgetSkippedEntries.map((entry) => [entry.id, entry.blockedBy]),
    [["long", "chat"]],
  );

  const lorebook = run([activation("short", "Short."), activation("long", longText)], 20, 0);
  assert.deepEqual(
    lorebook.budgetSkippedEntries.map((entry) => [entry.id, entry.blockedBy]),
    [["long", "lorebook"]],
  );

  // An image-only entry whose pictures do not fit names the budget it hit, not a guess.
  const picture = run([activation("short", "Short."), activation("picture", "", { images: [image] })], 20, 0);
  assert.deepEqual(ids(picture.selected), ["short"]);
  assert.deepEqual(
    picture.budgetSkippedEntries.map((entry) => [entry.id, entry.blockedBy]),
    [["picture", "lorebook"]],
  );
}

// The full scan, as a chat with its Lorebook Token Budget at 0 runs it.
const db = await getDB();
try {
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.create({ name: "The Three", tokenBudget: 0 } as Parameters<typeof lorebooks.create>[0]);
  assert.ok(book);
  const create = (name: string, content: string, keys = ["vibrance"]) =>
    lorebooks.createEntry({ lorebookId: book.id, name, keys, content } as Parameters<typeof lorebooks.createEntry>[0]);
  const facts = await create("Facts", "Vibrance is the eldest of The Three.");
  const setter = await create("Setter", "{{setvar::met_vibrance::yes}}");
  const place = await create("Blank place", "", []);
  assert.ok(facts && setter && place);

  const result = await processLorebooks(db, [{ role: "user", content: "Vibrance waves." }], null, {
    activeLorebookIds: [book.id],
    forcedEntryIds: [place.id],
    tokenBudget: 0,
    resolveContent: setvarOnly,
  });
  assert.deepEqual(result.activatedEntryIds, [facts.id]);
  assert.deepEqual(result.budgetSkippedEntries, [], "the Active Context panel shows no skipped entries");
} finally {
  closeDB();
}
