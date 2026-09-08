import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-cli-hyphen-ids-"));
process.env.FILE_STORAGE_DIR = directory;
try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const untouchedId = "unrelated-row";
    assert.equal(
      (
        await mari.executeAction({
          action: "character.create",
          characterId: untouchedId,
          data: { name: "Untouched fixture" },
          apply: true,
        })
      ).ok,
      true,
    );
    const readUntouched = () => mari.executeCli({ argv: ["db", "get", "--parsed", "characters", untouchedId] });
    const untouched = (await readUntouched()).output;
    for (const id of [
      "ordinary-id",
      "-single-prefix",
      "--EwXN_y0nAZbMu0baN4O",
      "--lowercase-id",
      "--enable",
      "--raw",
      "--selective",
      "--apply",
    ]) {
      const created = await mari.executeAction({
        action: "character.create",
        characterId: id,
        data: { name: "CLI ID fixture" },
        apply: true,
      });
      assert.equal(created.ok, true, JSON.stringify(created));
      // An exact option-name collision uses the standard end-of-options marker.
      const target = id === "--apply" ? ["--", "characters", id] : ["characters", id];
      const get = () => mari.executeCli({ argv: ["db", "get", "--parsed", ...target] });
      assert.equal((await get()).ok, true, `get must address ${id}`);

      const draft = await mari.executeCli({
        argv: ["db", "patch", "--json", JSON.stringify({ comment: "updated" }), ...target],
      });
      assert.equal(draft.ok, true, JSON.stringify(draft));
      assert.equal(draft.mode, "dry-run", "an ID must never become mutation approval");
      assert.notEqual(((await get()).output as { comment?: string })?.comment, "updated");

      const patch = await mari.executeCli({
        argv: ["db", "patch", "--apply", "--json", JSON.stringify({ comment: "updated" }), ...target],
      });
      assert.equal(patch.ok, true, JSON.stringify(patch));
      const row = (await get()).output as Record<string, unknown>;
      assert.equal(row.comment, "updated");

      const replaced = await mari.executeCli({
        argv: ["db", "replace", "--apply", "--json", JSON.stringify({ ...row, comment: "replaced" }), ...target],
      });
      assert.equal(replaced.ok, true, JSON.stringify(replaced));
      assert.equal(((await get()).output as { comment?: string }).comment, "replaced");

      const missingCascade = await mari.executeCli({ argv: ["db", "delete", "--apply", ...target] });
      assert.equal(missingCascade.ok, false, "dependent rows still require explicit cascade approval");
      assert.equal((await get()).ok, true);
      const removed = await mari.executeCli({ argv: ["db", "delete", "--apply", "--cascade", ...target] });
      assert.equal(removed.ok, true, JSON.stringify(removed));
      assert.equal((await get()).ok, false, "only the addressed row should be removed");
      assert.deepEqual((await readUntouched()).output, untouched, "deleting one row must preserve unrelated rows");
    }
    const missingSelector = await mari.executeCli({ argv: ["db", "delete", "characters", "--apply"] });
    assert.equal(missingSelector.ok, false, "a flag must not turn an unscoped delete into a valid mutation");
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}

console.log("Mari hyphen-prefixed CLI ID regressions passed.");
