// A card's lorebooks are not on its row: attachments live in `lorebook_character_links` and the
// book it owns is `lorebooks.characterId`. `character.get` exposes both, so a reader (Professor
// Mari's onboarding handbook included) can find the lore a card brings without a raw DB read.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { characters } from "../../../packages/server/src/db/schema/characters.js";
import { lorebookCharacterLinks, lorebooks } from "../../../packages/server/src/db/schema/lorebooks.js";
import { MariDbService, probeAppDataCall } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-character-lorebooks-"));
process.env.FILE_STORAGE_DIR = dir;

try {
  const db = await createFileNativeDB();
  try {
    const stamp = "2026-01-01T00:00:00.000Z";
    await db.insert(characters).values({
      id: "char-a",
      data: JSON.stringify({ name: "Simulator" }),
      comment: "",
      createdAt: stamp,
      updatedAt: stamp,
    });
    await db.insert(lorebooks).values([
      {
        id: "book-linked",
        name: "Simulator's Lorebook",
        description: "Earth-Prime locations, power systems, magic, character tiers.",
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "book-owned",
        name: "Card Book",
        description: "Ships inside the card.",
        characterId: "char-a",
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "book-other",
        name: "Someone Else",
        description: "Belongs to another card.",
        characterId: "char-b",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]);
    await db
      .insert(lorebookCharacterLinks)
      .values({ id: "link-1", lorebookId: "book-linked", characterId: "char-a", createdAt: stamp });

    const mari = new MariDbService(db);
    const got = await mari.executeAction({ action: "character.get", characterId: "char-a" });
    assert.equal(got.ok, true);

    const output = got.output as {
      data?: { name?: string };
      lorebooks?: Array<{ id: string; name: string; description: string; attached: string }>;
    };
    assert.equal(output.data?.name, "Simulator", "the card itself still comes back");
    assert.deepEqual(
      output.lorebooks,
      [
        // Sorted by name, and the other card's book is not included.
        {
          id: "book-owned",
          name: "Card Book",
          description: "Ships inside the card.",
          attached: "owned",
        },
        {
          id: "book-linked",
          name: "Simulator's Lorebook",
          description: "Earth-Prime locations, power systems, magic, character tiers.",
          attached: "linked",
        },
      ],
      "both the linked book and the card's own book are reported, nothing else",
    );

    // A card with no books reports an empty list, not a missing field.
    await db.insert(characters).values({
      id: "char-bare",
      data: JSON.stringify({ name: "Bare" }),
      comment: "",
      createdAt: stamp,
      updatedAt: stamp,
    });
    // A model that reads `lorebooks` off a card will try to write it back; refuse with the link action
    // instead of dropping the field (a live 12b did exactly this three times, #7949).
    const wrongLink = await mari.executeAction({
      action: "character.update",
      characterId: "char-a",
      data: { lorebooks: [] },
    });
    assert.equal(wrongLink.ok, false, "character.update refuses a lorebook link instead of ignoring it");
    assert.match(String(wrongLink.error), /"action":"lorebook.linkCharacter".*"characterId":"char-a"/);
    assert.match(String(wrongLink.error), /lorebook.search, never its name/);
    // An empty list detaches, so the refusal names the detaching action too.
    assert.match(String(wrongLink.error), /"action":"lorebook.unlinkCharacter" and "apply":true/);
    // A live 12b wrapped it twice, with the book's name as its id; that was saved as a "patch" field.
    const nested = await mari.executeAction({
      action: "character.update",
      characterId: "char-a",
      data: { patch: { lorebooks: [{ id: "Simulator's Lorebook" }] } },
      apply: true,
    });
    assert.equal(nested.ok, false, "a nested link field is refused too");
    assert.match(String(nested.error), /lorebook.linkCharacter/);
    const unwrapped = await mari.executeAction({
      action: "character.update",
      characterId: "char-a",
      data: { patch: { description: "Unwrapped." } },
      apply: true,
    });
    assert.equal(unwrapped.ok, true, String(unwrapped.error));
    const afterUnwrap = (await mari.executeAction({ action: "character.get", characterId: "char-a" })).output as {
      data: Record<string, unknown>;
    };
    assert.equal(afterUnwrap.data.description, "Unwrapped.");
    assert.equal(afterUnwrap.data.patch, undefined, "a doubled wrapper is never stored as a field");

    // The same shape every namespace now uses: kind, id, "ids are generated", and the finder.
    const missingBook = await mari.executeAction({
      action: "lorebook.update",
      lorebookId: "elsies-world",
      data: { name: "x" },
    });
    assert.equal(missingBook.ok, false);
    assert.match(String(missingBook.error), /No lorebook has the id "elsies-world"/);
    assert.match(String(missingBook.error), /lorebook\.list/);

    // Sending back what character.get returned is a read-modify-write, not a link request.
    const echoed = await mari.executeAction({
      action: "character.update",
      characterId: "char-a",
      data: { description: "Echoed.", lorebooks: output.lorebooks },
      apply: true,
    });
    assert.equal(echoed.ok, true, String(echoed.error));
    // Tolerated, not stored: the card's data keeps no stale copy of the links.
    const afterEcho = (await mari.executeAction({ action: "character.get", characterId: "char-a" })).output as {
      data: Record<string, unknown>;
    };
    assert.equal(afterEcho.data.lorebooks, undefined);
    // The refusal sends models to link-character; linking a linked pair again adds no second row.
    const relink = await mari.executeCli({
      argv: ["lorebooks", "link-character", "book-linked", "--character", "char-a", "--apply"],
      command: "mari lorebooks link-character",
    });
    assert.match(JSON.stringify(relink), /already linked/);

    const bare = await mari.executeAction({ action: "character.get", characterId: "char-bare" });
    assert.deepEqual((bare.output as { lorebooks?: unknown[] }).lorebooks, []);

    // The structured link: ids only, a name is refused toward lorebook.search.
    const byName = await mari.executeAction({
      action: "lorebook.linkCharacter",
      lorebookId: "Simulator's Lorebook",
      characterId: "char-bare",
    });
    assert.equal(byName.ok, false);
    assert.match(String(byName.error), /No lorebook has the id "Simulator's Lorebook".*lorebook.search/);
    const linked = await mari.executeAction({
      action: "lorebook.linkCharacter",
      lorebookId: "book-linked",
      characterId: "char-bare",
      reason: "Shares the setting",
    });
    assert.equal(linked.ok, true, String(linked.error));
    assert.equal(linked.mode, "apply", "a link writes by default, like a create");
    const books = () =>
      mari
        .executeAction({ action: "character.get", characterId: "char-bare" })
        .then((r) => (r.output as { lorebooks: Array<{ id: string; attached: string }> }).lorebooks ?? []);
    assert.deepEqual(
      (await books()).map((b) => [b.id, b.attached]),
      [["book-linked", "linked"]],
    );
    const again = await mari.executeAction({
      action: "character.linkLorebook",
      lorebookId: "book-linked",
      characterId: "char-bare",
    });
    assert.match(String(again.output), /already linked to character char-bare; nothing changed/);
    // The gate's probe still learns a link writes by default, though this pair had nothing to write.
    const probe = await probeAppDataCall(() =>
      mari.executeAction({
        action: "lorebook.linkCharacter",
        lorebookId: "book-linked",
        characterId: "char-bare",
        apply: false,
      }),
    );
    assert.equal(probe.savesWithoutApply, true);
    // Unlinking previews like a delete until apply: true.
    const preview = await mari.executeAction({
      action: "lorebook.unlinkCharacter",
      lorebookId: "book-linked",
      characterId: "char-bare",
    });
    assert.equal(preview.mode, "dry-run");
    assert.equal((await books()).length, 1);
    const unlinked = await mari.executeAction({
      action: "lorebook.unlinkCharacter",
      lorebookId: "book-linked",
      characterId: "char-bare",
      apply: true,
    });
    assert.equal(unlinked.ok, true, String(unlinked.error));
    assert.deepEqual(await books(), []);
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Professor Mari character lorebooks regression passed.");
