// A live `preset.update` that sent one section left the preset with a one-section `sectionOrder`:
// normalizePromptPresetChildInserts rebuilt the order from only the sections sent, so every other
// section dropped out of the prompt. preset.update now refuses sections, refuses section ids with
// quote characters in them, and a raw preset or lorebook delete prunes its id from library folders.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { libraryFolders } from "../../../packages/server/src/db/schema/library-folders.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-preset-update-sections-"));
process.env.FILE_STORAGE_DIR = dir;

const drainKeep = async (mari: MariDbService) => {
  for (const approval of mari.getPendingApprovals()) await mari.keepAppliedReview(approval.id);
};

try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const presetId = "preset-update-sections";
    const fullOrder = ["s-intro", "s-style", "s-history"];
    const created = await mari.executeAction({
      action: "preset.create",
      data: {
        id: presetId,
        name: "Three Sections",
        sections: [
          { id: "s-intro", name: "Intro", content: "You are a narrator." },
          { id: "s-style", name: "Style", content: "Write tersely." },
          { id: "s-history", name: "History", isMarker: true, markerConfig: { type: "chat_history" } },
        ],
      },
    });
    assert.equal(created.ok, true, `preset.create succeeds: ${created.error ?? ""}`);
    await drainKeep(mari);

    const order = async () =>
      ((await mari.executeAction({ action: "preset.get", presetId })).output as { sectionOrder: string[] })
        .sectionOrder;
    const sectionCount = async () =>
      ((await mari.executeAction({ action: "preset.sections", presetId })).output as unknown[]).length;
    assert.deepEqual(await order(), fullOrder);

    // The live call: one section through preset.update, with a JSON-quoted id.
    const live = await mari.executeAction({
      action: "preset.update",
      presetId,
      data: { sections: [{ id: '"YZuq-live-id"', name: "Style", content: "Write warmly." }] },
      reason: "Make the style warmer",
      apply: true,
    });
    assert.equal(live.ok, false, "preset.update refuses sections");
    assert.match(String(live.error), /preset\.update does not take "sections"/);
    assert.match(String(live.error), /Nothing was changed/);
    assert.match(String(live.error), /preset\.updateSection/);
    assert.match(String(live.error), /preset\.addSection/);
    assert.deepEqual(await order(), fullOrder, "the refused update leaves the order whole");
    assert.equal(await sectionCount(), 3, "no section row was added");
    assert.equal(mari.getPendingApprovals().length, 0, "the refusal made no review card");

    const topLevel = await mari.executeAction({
      action: "preset.update",
      presetId,
      promptSections: [{ name: "Extra", content: "More." }],
      apply: true,
    });
    assert.equal(topLevel.ok, false, "top-level promptSections is refused too");
    assert.match(String(topLevel.error), /does not take "promptSections"/);
    assert.deepEqual(await order(), fullOrder);

    // Quote characters inside a section id never match a real id.
    const quotedOrder = await mari.executeAction({
      action: "preset.update",
      presetId,
      data: { sectionOrder: ['"s-history"', "s-intro", "s-style"] },
      apply: true,
    });
    assert.equal(quotedOrder.ok, false, "a quoted id in sectionOrder is refused");
    assert.match(String(quotedOrder.error), /preset\.update: a section id contains quote characters/);
    assert.deepEqual(await order(), fullOrder);
    const quotedAlias = await mari.executeAction({
      action: "preset.update",
      presetId,
      data: { section_order: ['"s-history"', "s-intro", "s-style"] },
      apply: true,
    });
    assert.equal(quotedAlias.ok, false, "the section_order alias is checked too");
    assert.deepEqual(await order(), fullOrder);

    const quotedCreate = await mari.executeAction({
      action: "preset.create",
      data: { name: "Quoted", sections: [{ id: "'s-one'", name: "One", content: "One." }] },
    });
    assert.equal(quotedCreate.ok, false, "a quoted section id on preset.create is refused");
    assert.match(String(quotedCreate.error), /preset\.create: a section id contains quote characters/);

    // A whole sectionOrder still reorders.
    const reordered = await mari.executeAction({
      action: "preset.update",
      presetId,
      data: { sectionOrder: ["s-history", "s-intro", "s-style"] },
      apply: true,
    });
    assert.equal(reordered.ok, true, `a complete sectionOrder still reorders: ${reordered.error ?? ""}`);
    await drainKeep(mari);
    assert.deepEqual(await order(), ["s-history", "s-intro", "s-style"]);

    // A raw delete prunes the deleted id from library folders, in the same reviewable plan.
    const lorebook = await mari.executeAction({ action: "lorebook.create", data: { name: "Folder Book" } });
    assert.equal(lorebook.ok, true, `lorebook.create succeeds: ${lorebook.error ?? ""}`);
    await drainKeep(mari);
    const lorebookId = (
      (await mari.executeAction({ action: "lorebook.list" })).output as Array<{ id: string; name: string }>
    ).find((book) => book.name === "Folder Book")?.id;
    assert.ok(lorebookId, "the created lorebook is listed");
    const timestamp = new Date().toISOString();
    await db.insert(libraryFolders).values([
      {
        id: "folder-presets",
        scope: "presets",
        name: "Presets",
        itemIds: JSON.stringify([presetId, "other-preset"]),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "folder-lorebooks",
        scope: "lorebooks",
        name: "Books",
        itemIds: JSON.stringify([lorebookId, presetId]),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    const folderItems = async (id: string) => {
      const [row] = await db.select().from(libraryFolders).where(eq(libraryFolders.id, id));
      return JSON.parse(String(row?.itemIds ?? "[]")) as string[];
    };

    const deleted = await mari.executeCli({
      argv: ["db", "delete", "prompt_presets", presetId, "--cascade", "--apply"],
    });
    assert.equal(deleted.ok, true, `the preset delete applies: ${deleted.error ?? ""}`);
    assert.deepEqual(await folderItems("folder-presets"), ["other-preset"], "the preset id left its folder");
    assert.deepEqual(
      await folderItems("folder-lorebooks"),
      [lorebookId, presetId],
      "a lorebook folder keeps an id that only matches a preset",
    );

    const [review] = mari.getPendingApprovals();
    assert.ok(review, "the delete made a review card");
    await mari.restoreAppliedReview(review.id);
    assert.deepEqual(await folderItems("folder-presets"), [presetId, "other-preset"], "Restore puts the id back");
    assert.deepEqual(await order(), ["s-history", "s-intro", "s-style"], "Restore brings the preset back whole");

    const deletedBook = await mari.executeCli({
      argv: ["db", "delete", "lorebooks", lorebookId, "--cascade", "--apply"],
    });
    assert.equal(deletedBook.ok, true, `the lorebook delete applies: ${deletedBook.error ?? ""}`);
    await drainKeep(mari);
    assert.deepEqual(await folderItems("folder-lorebooks"), [presetId], "the lorebook id left its folder");
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Professor Mari preset.update sections regression passed.");
