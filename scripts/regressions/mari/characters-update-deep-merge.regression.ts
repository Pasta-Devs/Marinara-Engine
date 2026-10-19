// #7761: `mari characters update <id> --json` merged the patch shallowly into the card, so a patch
// carrying `extensions` replaced the whole object and dropped every sibling extension (appearance,
// backstory, depth prompt, onboarding...). It must deep-merge like `app_data` `character.update`.
// Drives the REAL MariDbService CLI against a file-native store.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { characters } from "../../../packages/server/src/db/schema/characters.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-characters-deep-merge-"));
process.env.FILE_STORAGE_DIR = dir;

try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const id = "deep-merge-char";
    const readData = async () => {
      const [row] = await db.select().from(characters).where(eq(characters.id, id));
      assert.ok(row, "the character exists");
      return (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as {
        description?: string;
        tags?: string[];
        extensions?: Record<string, unknown>;
      };
    };

    const created = await mari.executeCli({
      argv: [
        "characters",
        "create",
        "--id",
        id,
        "--name",
        "Ayrene",
        "--description",
        "A queen.",
        "--appearance",
        "Silver crown",
        "--backstory",
        "Born in a storm",
        "--apply",
      ],
    });
    assert.equal(created.ok, true, `characters create succeeds: ${created.error ?? ""}`);
    assert.equal((await readData()).extensions?.appearance, "Silver crown", "seeded appearance is stored");

    const depthPrompt = { prompt: "Stay regal.", depth: 4, role: "system" };
    const updated = await mari.executeCli({
      argv: [
        "characters",
        "update",
        id,
        "--json",
        JSON.stringify({ extensions: { depth_prompt: depthPrompt } }),
        "--apply",
      ],
    });
    assert.equal(updated.ok, true, `characters update succeeds: ${updated.error ?? ""}`);

    const data = await readData();
    assert.deepEqual(data.extensions?.depth_prompt, depthPrompt, "the patched extension is written");
    assert.equal(data.extensions?.appearance, "Silver crown", "a sibling extension (appearance) survives the patch");
    assert.equal(data.extensions?.backstory, "Born in a storm", "a sibling extension (backstory) survives the patch");
    assert.equal(data.description, "A queen.", "untouched top-level fields survive the patch");

    // Arrays still replace wholesale, same as app_data character.update. Seed a populated list first so
    // replacing can't pass for appending or merging.
    await mari.executeCli({
      argv: ["characters", "update", id, "--json", JSON.stringify({ tags: ["queen", "ruler"] }), "--apply"],
    });
    assert.deepEqual((await readData()).tags, ["queen", "ruler"], "seeded tags are stored");
    await mari.executeCli({
      argv: ["characters", "update", id, "--json", JSON.stringify({ tags: ["royal"] }), "--apply"],
    });
    assert.deepEqual((await readData()).tags, ["royal"], "an array in the patch replaces the stored array");
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("mari characters update deep-merge regression passed");
