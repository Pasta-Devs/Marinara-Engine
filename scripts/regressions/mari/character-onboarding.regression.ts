// #7760: Professor Mari reads and writes a card's interactive onboarding through
// `character.onboarding.get|update`. Drives the REAL MariDbService against a file-native store:
// a valid block is stored with ids and option values filled and other extensions untouched; a
// partial update keeps omitted keys; broken blocks (reserved, unknown or bad names, unknown keys,
// wrong shape) are refused without touching the card; an unused question saves with a notice.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterOnboarding } from "../../../packages/shared/src/types/character.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { characters } from "../../../packages/server/src/db/schema/characters.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { compactMutationResult } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-character-onboarding-"));
process.env.FILE_STORAGE_DIR = dir;

try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const characterId = "ayrene";
    const drainKeep = async () => {
      for (const approval of mari.getPendingApprovals()) await mari.keepAppliedReview(approval.id);
    };
    const readData = async () => {
      const [row] = await db.select().from(characters).where(eq(characters.id, characterId));
      assert.ok(row, "the character exists");
      return (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as {
        extensions?: Record<string, unknown> & { onboarding?: CharacterOnboarding };
      };
    };
    const update = async (onboarding: unknown) => {
      const result = await mari.executeAction({
        action: "character.onboarding.update",
        characterId,
        onboarding,
        reason: "test",
        apply: true,
      });
      await drainKeep();
      return result;
    };
    const get = async () =>
      (await mari.executeAction({ action: "character.onboarding.get", characterId })).output as {
        onboarding: CharacterOnboarding | null;
        note?: string;
        errors?: string[];
        warnings?: string[];
        samplePersona?: { name: string; description: string };
      };

    const created = await mari.executeAction({
      action: "character.create",
      id: characterId,
      name: "Queen Ayrene",
      description: "A storm queen. She sees {{user}} as her {{bond}}.",
      appearance: "Silver crown",
      backstory: "Born in a storm",
      apply: true,
    });
    assert.equal(created.ok, true, `character.create succeeds: ${created.error ?? ""}`);
    await drainKeep();

    const empty = await get();
    assert.equal(empty.onboarding, null, "a card without onboarding reads as null");
    assert.match(empty.note ?? "", /no onboarding/i);

    // A valid block, written the way a model would: no ids, options as plain strings or label-only.
    const saved = await update({
      enabled: true,
      description: "{{player}}, a {{origin}} traveller.{{#if origin == Northern}} Cold-hardened.{{/if}}",
      variables: [
        { variableName: "player", question: "What is your name?" },
        { variableName: "origin", question: "Where are you from?", options: ["Northern", { label: "Southern" }] },
      ],
      cardVariables: [{ variableName: "bond", question: "What are you to her?", options: ["rival", "knight"] }],
    });
    assert.equal(saved.ok, true, `a valid block saves: ${saved.error ?? ""}`);
    let data = await readData();
    const stored = data.extensions?.onboarding;
    assert.ok(stored, "the block is stored under extensions.onboarding");
    assert.equal(stored.enabled, true);
    assert.ok(
      stored.variables.every((variable) => variable.id),
      "missing question ids are filled",
    );
    const origin = stored.variables.find((variable) => variable.variableName === "origin");
    assert.ok(
      origin?.options.every((option) => option.id),
      "missing option ids are filled",
    );
    assert.deepEqual(
      origin?.options.map((option) => option.value),
      ["Northern", "Southern"],
      "a blank option value defaults to its label",
    );
    assert.equal(data.extensions?.appearance, "Silver crown", "other extensions are untouched");
    assert.equal(data.extensions?.backstory, "Born in a storm", "other extensions are untouched");

    const read = await get();
    assert.deepEqual(read.errors, [], "the saved block has no errors");
    assert.deepEqual(read.warnings, [], "every question is used (bond is in the card's description)");
    assert.equal(
      read.samplePersona?.description,
      "[player], a Northern traveller. Cold-hardened.",
      "the sample persona answers the first option and shows free text as [name]",
    );

    // A partial update keeps omitted keys, including both question lists.
    assert.equal((await update({ enabled: false })).ok, true);
    data = await readData();
    assert.equal(data.extensions?.onboarding?.enabled, false, "the sent key changes");
    assert.equal(data.extensions?.onboarding?.variables.length, 2, "omitted persona questions stay");
    assert.equal(data.extensions?.onboarding?.cardVariables.length, 1, "omitted character questions stay");

    // Broken blocks are refused and leave the stored block as it was.
    const before = JSON.stringify((await readData()).extensions?.onboarding);
    const refusals: Array<[string, unknown, RegExp]> = [
      ["reserved name", { variables: [{ variableName: "user", question: "?" }] }, /built-in macro/],
      ["unknown {{name}}", { description: "From {{hometwon}}." }, /\{\{hometwon\}\}.*no question/],
      ["plain if", { description: "{{if origin == Northern}}x{{/if}}" }, /need a #/],
      [
        "duplicate name",
        { cardVariables: [{ variableName: "origin", question: "?" }] },
        /More than one question is named "origin"/,
      ],
      ["unknown key", { questions: [] }, /Unknown onboarding key\(s\): questions/],
      ["wrong shape", { variables: "nope" }, /doesn't match the shape/],
      ["not an object", "nope", /needs an onboarding object/],
    ];
    for (const [label, patch, message] of refusals) {
      const result = await update(patch);
      assert.equal(result.ok, false, `${label} is refused`);
      assert.match(result.error ?? "", message, `${label} explains itself: ${result.error}`);
    }
    assert.equal(JSON.stringify((await readData()).extensions?.onboarding), before, "refusals store nothing");

    // An unused question saves, with a notice the review card and Mari both see.
    const unused = await update({
      variables: [...(data.extensions?.onboarding?.variables ?? []), { variableName: "hobby", question: "Hobby?" }],
      cardVariables: [{ variableName: "title", question: "Her title for you?" }],
    });
    assert.equal(unused.ok, true, `an unused question still saves: ${unused.error ?? ""}`);
    const notices = (unused.validation?.notices ?? []).map((notice) => notice.message).join("\n");
    assert.match(notices, /Question "hobby" isn't used/, "an unused persona question is a notice");
    assert.match(
      notices,
      /Character question "title".*character\.update/,
      "an unused card question says how to fix it",
    );
    // What Mari reads: the compact result's message must point at the warnings, not just say "applied"
    // (live run, ds4.1 flash: she reported done with an unused character question).
    const compact = compactMutationResult(unused) as { message?: string };
    assert.match(
      compact.message ?? "",
      /saved with warnings in validation\.notices/,
      "Mari is told about the warnings",
    );
    assert.doesNotMatch(
      (compactMutationResult(saved) as { message?: string }).message ?? "",
      /warnings/,
      "a clean save doesn't mention warnings",
    );

    // The prompt's pattern: a card-field edit and the onboarding in one response, no review kept in
    // between. Both writes persist, and the card question is no longer reported unused.
    const cardEdit = await mari.executeAction({
      action: "character.update",
      characterId,
      patch: { scenario: "Ayrene calls {{user}} her {{title}}." },
      apply: true,
    });
    assert.equal(cardEdit.ok, true, `the card edit saves: ${cardEdit.error ?? ""}`);
    const sameResponse = await mari.executeAction({
      action: "character.onboarding.update",
      characterId,
      onboarding: { enabled: true },
      apply: true,
    });
    assert.equal(sameResponse.ok, true, `the onboarding saves right after: ${sameResponse.error ?? ""}`);
    await drainKeep();
    data = await readData();
    assert.equal(
      (data as { scenario?: string }).scenario,
      "Ayrene calls {{user}} her {{title}}.",
      "the card edit stays",
    );
    assert.equal(data.extensions?.onboarding?.enabled, true, "the onboarding write lands too");
    const laterNotices = (sameResponse.validation?.notices ?? []).map((notice) => notice.message).join("\n");
    assert.doesNotMatch(laterNotices, /"title"/, "a card question used in the scenario is not reported unused");
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Mari character onboarding regression passed.");
