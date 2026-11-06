// #7827: the character authoring traps are all silent — the wrong storage location, a `null`
// "clear" that is dropped, and a read-back that proves persistence rather than intent. This executes
// the handbook's example (the whole card in one create, then an About Me patch) and pins that every
// field lands where the app reads it. The traps run here as fixtures, never as example lines she could
// copy: a null probe changes nothing, and a name-only placeholder saves, which is why the handbook forbids it.
import assert from "node:assert/strict";
import { withHandbook, type HandbookResult } from "./_handbook.js";

type Card = {
  comment?: string;
  data?: Record<string, unknown> & { extensions?: Record<string, unknown> & { aboutMe?: string } };
};

await withHandbook("builtin-characters", async ({ commands, mari, run }) => {
  assert.deepEqual(
    commands.map((command) => command.action),
    ["character.create", "character.update", "character.get"],
    "the example is the whole-card create, the About Me patch and the read-back — no probe line",
  );
  assert.equal(commands[2]!.field, undefined, "character.get has no field selector");
  assert.equal(commands[0]!.apply, undefined, "the create relies on creates writing by default");
  for (const field of ["name", "description", "personality", "firstMes", "backstory", "appearance", "aboutMe"]) {
    assert.ok(commands[0]!.data[field], `the create carries the full card, including ${field}`);
  }

  const readCard = async (): Promise<Card> => {
    const result = await run(2);
    assert.equal(result.ok, true);
    const output = result.output as Record<string, unknown>;
    return (output.character as Card) ?? (output as Card);
  };

  const created = await run(0);
  assert.equal(created.ok, true, `character.create failed: ${String(created.error ?? "")}`);
  assert.equal(created.readBack?.status, "verified", "a create without apply writes and verifies");

  const card = await readCard();
  const sent = commands[0]!.data;
  assert.equal(card.data?.description, sent.description);
  assert.equal(card.data?.personality, sent.personality);
  assert.equal(card.data?.first_mes, sent.firstMes, "firstMes is stored as first_mes");
  assert.equal(card.data?.extensions?.backstory, sent.backstory, "backstory lives under extensions");
  assert.equal(card.data?.extensions?.appearance, sent.appearance, "appearance lives under extensions");
  assert.equal(card.data?.extensions?.aboutMe, sent.aboutMe, "aboutMe lives under extensions");
  assert.equal(card.comment, sent.comment, "comment is the row column");

  const patched = await run(1);
  assert.equal(patched.ok, true, `the About Me patch failed: ${String(patched.error ?? "")}`);
  const expected = String(commands[1]!.patch.aboutMe);
  assert.equal((await readCard()).data?.extensions?.aboutMe, expected, "the About Me patch landed");

  // Fixture, not an example line: null is not a clear — it is dropped before the patch is built.
  const probe = (await mari.executeAction({
    action: "character.update",
    characterId: commands[0]!.characterId,
    patch: { aboutMe: null },
    reason: "Probe: null is not a clear",
    apply: true,
  })) as HandbookResult;
  assert.notEqual(probe.ok, true, "a null-only patch is refused, not applied");
  assert.match(String(probe.error), /character\.update needs a patch field such as/u);
  assert.equal((await readCard()).data?.extensions?.aboutMe, expected, "the null probe cleared nothing");

  // Fixture: only `name` is enforced, so a placeholder saves and verifies. The handbook forbids it.
  const placeholder = (await mari.executeAction({
    action: "character.create",
    data: { name: "Placeholder" },
  })) as HandbookResult;
  assert.equal(placeholder.ok, true, "a name-only create is accepted — the handbook is the only guard");
});

console.log("Professor Mari characters handbook regression passed.");
