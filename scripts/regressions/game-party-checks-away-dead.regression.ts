/**
 * What the whole party does is done by those with it and alive. A card stays when its member is taken
 * out of the party, and a dead hero keeps theirs, so:
 *   - the check context a turn loads knows who left, off the game's party list, as a whole-party sheet
 *     command does, and a list it cannot read in full counts nobody away;
 *   - a group check (`who="party"`) rolls and counts only the members present and alive, in the tag
 *     pass and in a branch, so two removed members passing never carry a party that failed;
 *   - a story's exposure saves are rolled, and their failures marked, only for them, and only a shade
 *     one of them carries keeps an exposure off;
 *   - the checks, the sheet commands (a party long rest) and the fight-setup brief count the same
 *     members away, seeded alike with the player's own card: a persona called by a shorter name than
 *     its card ("Lethariel" for "Lethariel Moonwhisper") is still in the party;
 *   - in a game set up with a persona, its setup put the player's card first, so the first card stays in
 *     the party once the persona no longer names a card (renamed or deleted since);
 *   - with no persona, the first card is the player's in a game set up with no party (its setup makes a
 *     card for nobody else), so a solo game's only card, the player, is never counted away, even once
 *     it recruits; where the game had a party, a first card whose member was removed is still away.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRulesetSheetBuild, parseRulesetDefinition, type StoryTurn } from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-party-checks-away-dead-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { gamePlayerCardName, loadSkillCheckModifierContext, resolveSkillCheckTagsInContent, rulesetGroupCheckRollers },
  { createGameTurnChanceSession, resolveGameTurnBranches },
  { rollStoryExposureSavesWith, storyPartyCarriesShade },
  { buildPartyNpcId },
  { getDB, closeDB },
  { createChatsStorage },
  { createGameRulesetsStorage },
  { gameRulesetCardsAway, loadGameRulesetSheetContext },
  { createCharactersStorage },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/one-request-dice.js"),
  import("../../packages/server/src/services/game/story-exposure-saves.service.js"),
  import("../../packages/server/src/services/generation/game-party-utils.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/server/src/services/storage/game-rulesets.storage.js"),
  import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js"),
  import("../../packages/server/src/services/storage/characters.storage.js"),
]);
const db = await getDB();

try {
  const document = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  document.id = "five-e-party-checks";
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const fiveE = parsed.definition;
  const rulesetId = "local/five-e-party-checks";
  await createGameRulesetsStorage(db).put({
    rulesetId,
    version: fiveE.version,
    sourceKind: "local",
    definition: JSON.stringify(document),
  });
  const scripted = (values: number[]) => {
    let index = 0;
    return () => {
      assert.ok(index < values.length, "asked for more d20s than scripted");
      return values[index++]!;
    };
  };

  // Rook and Pip are with the party; Dagna and Mars were taken out of it; Wren is dead on her sheet.
  const names = ["Rook", "Pip", "Dagna", "Mars", "Wren"];
  const cards = names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(fiveE) } }));
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "The ford", mode: "game", characterIds: [] });
  const meta = {
    gameRuleset: { id: rulesetId, version: fiveE.version, packageId: null, options: {} },
    gameCharacterCards: cards,
    gameNpcs: names.map((name) => ({ name })),
    gamePartyCharacterIds: ["Rook", "Pip", "Wren"].map((name) => buildPartyNpcId(name)),
  };
  await chats.patchMetadata(chat.id, meta);
  const live = { wren: { tracks: { death_save_failures: 3 } } };
  const context = await loadSkillCheckModifierContext(db, chat.id, live);
  assert.deepEqual([...(context.ruleset?.away ?? [])], ["dagna", "mars"], "the loader knows who left the party");

  // ── A group check: Rook and Pip fail, the removed two would pass, the dead one is not asked ──
  const group = await resolveSkillCheckTagsInContent(
    `They wade the ford. [skill_check: skill="Athletics" dc="12" who="party"]`,
    {
      loadContext: async () => context,
      rollD20: scripted([5, 6, 18, 18, 18]),
      rulesetPinned: true,
    },
  );
  const records = [...group.content.matchAll(/\[skill_check:[^\]]*\]/g)].map((match) => match[0]);
  assert.equal(records.length, 2, group.content);
  assert.match(records[0]!, /result="failure"[^\]]*who="Rook"/);
  assert.match(records[1]!, /result="failure"[^\]]*who="Pip"/);
  assert.ok(
    group.content.endsWith(`(Group Athletics check against 12: 0 of 2 passed, so the party fails.)`),
    group.content,
  );

  // ── Nobody left to roll: the whole party is dead or gone, so the check is refused, never "0 of 0 passed" ──
  const allDown = await loadSkillCheckModifierContext(db, chat.id, {
    rook: { tracks: { death_save_failures: 3 } },
    pip: { tracks: { death_save_failures: 3 } },
    wren: { tracks: { death_save_failures: 3 } },
  });
  const nobody = await resolveSkillCheckTagsInContent(
    `They wade the ford. [skill_check: skill="Athletics" dc="12" who="party"]`,
    { loadContext: async () => allDown, rollD20: scripted([]), rulesetPinned: true },
  );
  assert.doesNotMatch(nobody.content, /0 of 0 passed/, nobody.content);
  assert.doesNotMatch(nobody.content, /Group Athletics check/, "no group is rolled");

  // ── The same in a branch: the party's half is theirs ──
  const branched = await resolveGameTurnBranches(
    [
      `[skill_check: skill="Athletics" dc="12" who="party" branch="ford"]`,
      "[branch: ford]",
      "[on success] Across.",
      "[on failure] Swept back.",
      "[/branch]",
    ].join("\n"),
    createGameTurnChanceSession({
      db: null as never,
      chatId: chat.id,
      roll: scripted([5, 6, 18, 18, 18]),
      loadModifierContext: async () => context,
      playerD20s: [],
    }),
  );
  assert.match(branched.content, /0 of 2 passed, so the party fails\.\)/);
  assert.match(branched.content, /Swept back\./);

  // ── A story's exposure: only those with the party and alive save, and only their failures cost ──
  const turn = {
    sheet: "",
    tells: [],
    saves: [
      {
        exposure: "ford",
        label: "The cold ford",
        times: 1,
        hours: 1,
        save: "con_save",
        difficulty: 12,
        tracks: [{ track: "exhaustion", by: 1 }],
        applies: [],
      },
    ],
  } as unknown as StoryTurn;
  const exposed = rollStoryExposureSavesWith(context, meta, turn, scripted([5, 18, 3, 3, 3]));
  assert.equal(exposed.sheet, '[sheet: who="Rook" op="track" track="exhaustion" by="1"]');
  assert.doesNotMatch(exposed.tells.join("\n"), /Dagna|Mars|Wren/, exposed.tells.join("\n"));

  // ── A shade lit spares the party only when one with it and alive carries it ──
  const lantern = {
    id: "lantern_of_dusk",
    name: "Lantern of Dusk",
    carried: { light: { bright: 0, dim: 15, shade: true } },
  };
  const holding = (key: string) => ({
    ...context,
    ruleset: { ...context.ruleset!, items: new Map([[key, [{ item: lantern, quantity: 1, worn: false } as never]]]) },
  });
  assert.equal(storyPartyCarriesShade(holding("rook")), true);
  assert.equal(storyPartyCarriesShade(holding("dagna")), false, "a removed member's lantern");
  assert.equal(storyPartyCarriesShade(holding("wren")), false, "a dead member's lantern");

  // ── A party list the Engine cannot read in full counts nobody away ──
  await chats.patchMetadata(chat.id, { gamePartyCharacterIds: [...meta.gamePartyCharacterIds, "missing-character"] });
  assert.equal((await loadSkillCheckModifierContext(db, chat.id, live)).ruleset?.away, undefined);

  // Who each path counts away: the checks (by lookup key), the sheet commands and the fight brief.
  const awayEverywhere = async (chatId: string, personaId: string | null = null) => {
    const stored = JSON.parse((await chats.getById(chatId))!.metadata) as Record<string, unknown>;
    return {
      checks: [...((await loadSkillCheckModifierContext(db, chatId)).ruleset?.away ?? [])],
      sheets: (await loadGameRulesetSheetContext(db, chatId))?.away ?? [],
      brief: await gameRulesetCardsAway(db, chatId, fiveE, stored, personaId),
    };
  };
  const sheeted = (...cardNames: string[]) =>
    cardNames.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(fiveE) } }));

  // ── A persona called by a shorter name than its card ──
  // The player is never on the party list: only the roster's seed keeps their card present, so every
  // path seeds it with the card a check finds for the persona, not the persona's own name.
  const lethariel = await createCharactersStorage(db).createPersona("Lethariel", "The player.");
  assert.ok(lethariel);
  const ridge = await chats.create({ name: "The ridge", mode: "game", characterIds: [], personaId: lethariel.id });
  await chats.patchMetadata(ridge.id, {
    gameRuleset: meta.gameRuleset,
    gameCharacterCards: sheeted("Lethariel Moonwhisper", "Rook", "Dagna"),
    gameNpcs: [{ name: "Rook" }, { name: "Dagna" }],
    gamePartyCharacterIds: [buildPartyNpcId("Rook")],
  });
  assert.equal(
    await gamePlayerCardName(db, ridge.id, JSON.parse((await chats.getById(ridge.id))!.metadata), ridge.personaId),
    "Lethariel Moonwhisper",
  );
  assert.deepEqual(
    await awayEverywhere(ridge.id, ridge.personaId),
    { checks: ["dagna"], sheets: ["Dagna"], brief: ["Dagna"] },
    "a party long rest reaches the player's own card",
  );

  // ── A persona that no longer names a card, in a game set up with it and a party ──
  // The setup asked for the player's card before the party's (gm-prompts' characterCardTargets), so the
  // first card stays the player's once the persona is renamed or deleted, or the card renamed.
  const kae = await createCharactersStorage(db).createPersona("Kae", "The player, renamed since the setup.");
  assert.ok(kae);
  for (const personaId of [kae.id, "a-deleted-persona"]) {
    const camp = await chats.create({ name: "The camp", mode: "game", characterIds: [], personaId });
    await chats.patchMetadata(camp.id, {
      gameRuleset: meta.gameRuleset,
      gameCharacterCards: sheeted("Kaelen", "Rook", "Dagna"),
      gameNpcs: [{ name: "Rook" }, { name: "Dagna" }],
      gamePartyCharacterIds: [buildPartyNpcId("Rook")],
      gameInitialSetup: {
        config: { personaId, partyCharacterIds: [buildPartyNpcId("Rook"), buildPartyNpcId("Dagna")] },
        createdAt: "2026-11-04T00:00:00.000Z",
      },
    });
    assert.deepEqual(
      await awayEverywhere(camp.id, personaId),
      { checks: ["dagna"], sheets: ["Dagna"], brief: ["Dagna"] },
      `the player's own card stays in (${personaId === kae.id ? "renamed" : "deleted"} persona)`,
    );
    assert.deepEqual(rulesetGroupCheckRollers((await loadSkillCheckModifierContext(db, camp.id)).ruleset!, "party"), [
      "Kaelen",
      "Rook",
    ]);
  }

  // ── No persona: a solo game's only card is the player's ──
  // Set up with no persona and no party, the setup makes a card only for a player character its
  // preferences define (gm-prompts' character_card_scope), and the player is never on the party list.
  const solo = await chats.create({ name: "The lone road", mode: "game", characterIds: [] });
  await chats.patchMetadata(solo.id, {
    gameRuleset: meta.gameRuleset,
    gameCharacterCards: sheeted("Kaelen"),
    gameNpcs: [],
    gamePartyCharacterIds: [],
  });
  assert.deepEqual(await awayEverywhere(solo.id), { checks: [], sheets: [], brief: [] }, "the solo player is present");
  assert.deepEqual(rulesetGroupCheckRollers((await loadSkillCheckModifierContext(db, solo.id)).ruleset!, "party"), [
    "Kaelen",
  ]);
  // And still once a companion joins, by the setup the game keeps: it had no party.
  await chats.patchMetadata(solo.id, {
    gameInitialSetup: { config: { partyCharacterIds: [] }, createdAt: "2026-11-04T00:00:00.000Z" },
    gameCharacterCards: sheeted("Kaelen", "Rook"),
    gameNpcs: [{ name: "Rook" }],
    gamePartyCharacterIds: [buildPartyNpcId("Rook")],
  });
  assert.deepEqual(await awayEverywhere(solo.id), { checks: [], sheets: [], brief: [] }, "a recruit keeps Kaelen in");
  // Rook leaves: he is away, the player is not.
  await chats.patchMetadata(solo.id, { gamePartyCharacterIds: [] });
  assert.deepEqual(await awayEverywhere(solo.id), { checks: ["rook"], sheets: ["Rook"], brief: ["Rook"] });

  // ── No persona, a game with a party: the first card is a companion's, and once removed it is away ──
  const band = await chats.create({ name: "The band", mode: "game", characterIds: [] });
  await chats.patchMetadata(band.id, {
    gameRuleset: meta.gameRuleset,
    gameCharacterCards: sheeted("Rook", "Pip"),
    gameNpcs: [{ name: "Rook" }, { name: "Pip" }],
    gamePartyCharacterIds: [buildPartyNpcId("Pip")],
  });
  assert.deepEqual(
    await awayEverywhere(band.id),
    { checks: ["rook"], sheets: ["Rook"], brief: ["Rook"] },
    "a removed companion who happens to be first",
  );
  // Nor kept once everyone has left, where the setup it keeps had a party.
  await chats.patchMetadata(band.id, {
    gameInitialSetup: {
      config: { partyCharacterIds: [buildPartyNpcId("Rook"), buildPartyNpcId("Pip")] },
      createdAt: "2026-11-04T00:00:00.000Z",
    },
    gamePartyCharacterIds: [],
  });
  assert.deepEqual(await awayEverywhere(band.id), {
    checks: ["rook", "pip"],
    sheets: ["Rook", "Pip"],
    brief: ["Rook", "Pip"],
  });

  // ── And each route seeds its roster that way: the fight brief, and the sheet blocks a turn shows ──
  const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  assert.match(
    source("../../packages/server/src/routes/encounter.routes.ts"),
    /gameRulesetCardsAway\(app\.db, chatId, resolved\.definition, chatMeta, chat\.personaId\)/u,
  );
  assert.match(
    source("../../packages/server/src/routes/generate.routes.ts"),
    /gameRulesetCardsAway\(\s*app\.db,\s*input\.chatId,\s*pinnedGameRuleset\.definition,\s*turnSheetMetadata as Record<string, unknown>,\s*chat\.personaId,\s*\)/u,
  );

  console.log(
    "Party checks: removed and dead members neither roll nor count in group checks and exposure saves, nor carry a shade; the checks, the sheet commands and the fight brief count one party, a solo game's player in it.",
  );
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
