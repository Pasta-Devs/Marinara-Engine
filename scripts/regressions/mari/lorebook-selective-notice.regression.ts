// #7949: the scanner weighs secondary keys only when `selective` is on AND `secondaryKeys` is non-empty.
// Either half alone saves cleanly and fires on any one primary key. Live gemma runs did exactly that
// ("only when both 'guild' and 'forms' come up" → both words in `keys`, `selectiveLogic: "AND"`) and
// reported success, so the write result must say so. The dry-run message must name the key that saves.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { lorebooks } from "../../../packages/server/src/db/schema/lorebooks.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { compactMutationResult } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-selective-notice-"));
process.env.FILE_STORAGE_DIR = dir;

type Result = { ok: boolean; output?: unknown; validation?: { notices: Array<{ message: string }> } };
const notices = (result: Result) => (result.validation?.notices ?? []).map((notice) => notice.message);

try {
  const db = await createFileNativeDB();
  try {
    const stamp = "2026-01-01T00:00:00.000Z";
    await db.insert(lorebooks).values({ id: "book", name: "Aldric's Chronicles", createdAt: stamp, updatedAt: stamp });
    const mari = new MariDbService(db);
    const add = (data: Record<string, unknown>, entryId?: string) =>
      mari.executeAction({ action: "lorebook.addEntry", lorebookId: "book", entryId, data }) as Promise<Result>;

    // The live 12b call, verbatim in shape.
    const bothInKeys = await add({
      name: "Guild Forms Lore",
      content: "x",
      keys: ["guild", "forms"],
      selective: "true",
      selectiveLogic: "AND",
    });
    assert.equal(bothInKeys.ok, true, "the write itself still succeeds");
    assert.match(
      notices(bothInKeys).join("\n"),
      /selective is on but secondaryKeys is empty, so selectiveLogic does nothing/,
    );

    // Run 2: keys as objects saved "[object Object]" twice. Refuse, naming the field and the shape.
    const objectKeys = await add({
      name: "Guild Forms Entry",
      content: "x",
      keys: [
        { constant: "true", key: '"guild"' },
        { constant: "true", key: '"forms"' },
      ],
    });
    assert.equal(objectKeys.ok, false);
    assert.match(
      String((objectKeys as { error?: unknown }).error),
      /"keys" must be a list of plain strings.*\[object Object\]/,
    );

    const secondaryOff = await add({ name: "Off", content: "x", keys: ["guild"], secondaryKeys: ["forms"] });
    assert.match(notices(secondaryOff).join("\n"), /secondaryKeys are set but selective is off, so they are ignored/);

    const right = await add({
      name: "Right",
      content: "x",
      keys: ["guild"],
      secondaryKeys: ["forms"],
      selective: true,
      selectiveLogic: "and_all",
    });
    assert.deepEqual(notices(right), [], "a working two-word entry gets no notice");
    const plain = await add({ name: "Plain", content: "x", keys: ["guild"] }, "entry-plain");
    assert.deepEqual(notices(plain), [], "an ordinary keyword entry gets no notice");

    // updateEntry checks the merged entry, but only when the patch touched the matching keys.
    const plainId = "entry-plain";
    const contentOnly = (await mari.executeAction({
      action: "lorebook.updateEntry",
      entryId: plainId,
      patch: { content: "y" },
      apply: true,
    })) as Result;
    assert.deepEqual(notices(contentOnly), [], "an unrelated edit stays quiet");
    const turnOn = (await mari.executeAction({
      action: "lorebook.updateEntry",
      entryId: plainId,
      patch: { selective: true },
      apply: true,
    })) as Result;
    assert.match(notices(turnOn).join("\n"), /lorebook\.updateEntry: selective is on but secondaryKeys is empty/);

    // An update without apply is a preview, and the message says which key saves it. In Auto there is no
    // Permissions Mode section in the prompt, so the old "proceed per your Permissions Mode" pointed at nothing.
    const preview = await mari.executeAction({
      action: "lorebook.updateEntry",
      entryId: plainId,
      patch: { content: "z" },
    });
    const message = String((compactMutationResult(preview) as { message?: string }).message);
    assert.match(message, /saves only with top-level "apply": true/);
    assert.doesNotMatch(message, /Permissions Mode/);
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Professor Mari lorebook selective notice regression passed.");
