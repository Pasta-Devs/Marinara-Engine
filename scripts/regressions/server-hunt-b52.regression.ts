// Server hunt batch 52: storage write-scoping fixes.
//   - lorebooks.updateEntryEmbedding: a vector computed from an entry's old text
//     must be dropped when the entry was edited meanwhile (expectedUpdatedAt),
//     and an embedding write must not bump updatedAt (the provenance CAS token).
//   - prompts.setDefault: only the previous default and the new one change;
//     every other preset keeps its updatedAt.
//   - themes.setActive: clears every active row, so duplicate active flags
//     cannot persist.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-hunt-b52-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createThemesStorage } = await import("../../packages/server/src/services/storage/themes.storage.js");
const { customThemes } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");

const db = await getDB();
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

try {
  // ── lorebook embeddings ──
  {
    const lorebooks = createLorebooksStorage(db);
    const book = await lorebooks.create({ name: "Embedding lore" });
    assert.ok(book);
    const entry = (await lorebooks.createEntry({
      lorebookId: (book as { id: string }).id,
      name: "Tower",
      content: "The tower is red.",
      keys: ["tower"],
    } as never)) as { id: string; updatedAt: string };
    assert.ok(entry);
    const snapshotUpdatedAt = entry.updatedAt;

    // Embedding write with a matching snapshot stores the vector and leaves updatedAt alone.
    await tick();
    await lorebooks.updateEntryEmbedding(entry.id, [0.1, 0.2], "space-a", snapshotUpdatedAt);
    const afterEmbed = (await lorebooks.getEntry(entry.id)) as { embedding: number[] | null; updatedAt: string };
    assert.deepEqual(afterEmbed.embedding, [0.1, 0.2], "matching snapshot stores the vector");
    assert.equal(afterEmbed.updatedAt, snapshotUpdatedAt, "embedding write must not bump updatedAt");

    // User edits the text while a slow embed call for the old text is in flight.
    await lorebooks.updateEntryEmbedding(entry.id, null, null);
    await tick();
    await lorebooks.updateEntry(entry.id, { content: "The tower is blue." } as never);
    const edited = (await lorebooks.getEntry(entry.id)) as { embedding: number[] | null; updatedAt: string };
    assert.notEqual(edited.updatedAt, snapshotUpdatedAt);
    await lorebooks.updateEntryEmbedding(entry.id, [0.9, 0.9], "space-a", snapshotUpdatedAt);
    const afterStale = (await lorebooks.getEntry(entry.id)) as { embedding: number[] | null };
    assert.ok(
      !afterStale.embedding || afterStale.embedding.length === 0,
      "vector computed from stale text must not be stored",
    );

    // Legacy callers without a snapshot still write by id.
    await lorebooks.updateEntryEmbedding(entry.id, [0.3], "space-a");
    const legacy = (await lorebooks.getEntry(entry.id)) as { embedding: number[] | null };
    assert.deepEqual(legacy.embedding, [0.3]);
  }

  // ── prompt preset setDefault ──
  {
    const prompts = createPromptsStorage(db);
    const a = (await prompts.create({ name: "Preset A" } as never)) as { id: string };
    await tick();
    const b = (await prompts.create({ name: "Preset B" } as never)) as { id: string };
    await tick();
    const c = (await prompts.create({ name: "Preset C" } as never)) as { id: string };
    await tick();
    await prompts.setDefault(a.id);
    const before = (await prompts.getById(c.id)) as { updatedAt: string };
    await tick();
    await prompts.setDefault(b.id);
    const cAfter = (await prompts.getById(c.id)) as { updatedAt: string; isDefault: unknown };
    assert.equal(cAfter.updatedAt, before.updatedAt, "unrelated preset keeps its updatedAt");
    const aAfter = (await prompts.getById(a.id)) as { isDefault: unknown };
    const bAfter = (await prompts.getById(b.id)) as { isDefault: unknown };
    assert.ok(aAfter.isDefault === false || aAfter.isDefault === "false", "previous default is cleared");
    assert.ok(bAfter.isDefault === true || bAfter.isDefault === "true", "new default is set");
  }

  // ── theme setActive ──
  {
    const themes = createThemesStorage(db);
    const t1 = (await themes.create({ name: "One", css: "" } as never))!;
    const t2 = (await themes.create({ name: "Two", css: "" } as never))!;
    const t3 = (await themes.create({ name: "Three", css: "" } as never))!;
    // Simulate the duplicate-active state the old race could leave behind.
    await db.update(customThemes).set({ isActive: "true" }).where(eq(customThemes.id, t1.id));
    await db.update(customThemes).set({ isActive: "true" }).where(eq(customThemes.id, t2.id));
    const result = await themes.setActive(t3.id);
    assert.equal(result?.id, t3.id);
    const active = (await db.select().from(customThemes)).filter((row) => row.isActive === "true");
    assert.deepEqual(
      active.map((row) => row.id),
      [t3.id],
      "exactly one theme is active after setActive",
    );

    // Overlapping calls end with a single active theme.
    await Promise.all([themes.setActive(t1.id), themes.setActive(t2.id)]);
    const activeAfterRace = (await db.select().from(customThemes)).filter((row) => row.isActive === "true");
    assert.equal(activeAfterRace.length, 1, "overlapping setActive calls leave one active theme");

    assert.equal(await themes.setActive(null), null);
    const none = (await db.select().from(customThemes)).filter((row) => row.isActive === "true");
    assert.equal(none.length, 0);
  }

  console.log("server-hunt-b52 regression: ok");
} finally {
  await closeDB?.();
  rmSync(dir, { recursive: true, force: true });
}
