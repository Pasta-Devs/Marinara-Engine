// Macro context: the lorebook entry counts that macros read, loaded only when a prompt or entry uses them.
import assert from "node:assert/strict";
import { setLorebookEntryCounts } from "../../../packages/server/src/services/prompt/macro-context.js";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
assert.ok(process.env.DATA_DIR, "the regression runner provides a throwaway DATA_DIR");

const staleLorebookCountContext = {
  user: "Mari",
  char: "Character",
  characters: ["Character"],
  variables: {},
  lorebookEntryCounts: { stale: 4 },
};
setLorebookEntryCounts(staleLorebookCountContext, undefined);
assert.deepEqual(
  staleLorebookCountContext.lorebookEntryCounts,
  {},
  "an omitted lorebook count snapshot must clear stale values",
);

const { createLorebookEntrySchema, createLorebookSchema, resolveMacros } =
  await import("../../../packages/shared/src/index.js");
const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
const { buildPromptMacroContext } = await import("../../../packages/server/src/services/prompt/macro-context.js");
const { processLorebooks } = await import("../../../packages/server/src/services/lorebook/index.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");

const db = await getDB();
try {
  // Counting entries reads every entry in every lorebook, so a database that counts its reads shows whether the
  // counts were loaded: a {{lorebooksize::…}} adds exactly one read.
  let reads = 0;
  const countingDb = new Proxy(db, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function"
        ? (...args: unknown[]) => {
            if (key === "select") reads += 1;
            return value.apply(target, args);
          }
        : value;
    },
  });
  const readsDuring = async <T>(run: () => Promise<T>) => {
    const before = reads;
    const result = await run();
    return { reads: reads - before, result };
  };
  const lorebooks = createLorebooksStorage(db);
  const book = async (name: string, content: string) => {
    const { id } = (await lorebooks.create(createLorebookSchema.parse({ name }))) as unknown as { id: string };
    await lorebooks.createEntry(createLorebookEntrySchema.parse({ lorebookId: id, name, content, constant: true }));
    await lorebooks.createEntry(
      createLorebookEntrySchema.parse({ lorebookId: id, name: `${name} 2`, content: "Two." }),
    );
    return id;
  };

  // A prompt's macro context.
  const counted = await book("Counted", "Plain.");
  const context = (source: string) =>
    readsDuring(() =>
      buildPromptMacroContext({
        db: countingDb as typeof db,
        characterIds: [],
        personaName: "Ada",
        macroSources: [source],
      }),
    );
  const withoutSize = await context("Hello.");
  const withSize = await context(`{{lorebooksize::${counted}}}`);
  assert.equal(withSize.reads, withoutSize.reads + 1, "only a prompt that uses lorebooksize loads the counts");
  assert.equal(resolveMacros(`{{lorebooksize::${counted}}}`, withSize.result), "2");

  // A lorebook scan.
  const scan = (bookId: string) =>
    readsDuring(() =>
      processLorebooks(countingDb as typeof db, [{ role: "user", content: "Hello." }], null, {
        activeLorebookIds: [bookId],
        resolveContent: (value, lorebookEntryCounts) =>
          resolveMacros(value, { user: "Ada", char: "Mira", characters: [], variables: {}, lorebookEntryCounts }),
      }),
    );
  const plainScan = await scan(await book("Plain", "Plain."));
  const sizedBook = await book("Sized", "");
  await lorebooks.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: sizedBook,
      name: "Size",
      content: `Size: {{lorebooksize::${sizedBook}}}`,
      constant: true,
    }),
  );
  const sizedScan = await scan(sizedBook);
  assert.equal(sizedScan.reads, plainScan.reads + 1, "only a scan whose entries use lorebooksize loads the counts");
  assert.ok(
    sizedScan.result.activatedEntries.some((entry) => entry.content === "Size: 3"),
    JSON.stringify(sizedScan.result.activatedEntries.map((entry) => entry.content)),
  );
} finally {
  await closeDB();
}
console.info("Lorebook entry counts are loaded only for prompts and entries that use lorebooksize.");
