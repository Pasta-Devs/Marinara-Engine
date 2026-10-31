/**
 * A command to the whole party passes by the dead and those taken out of the party (laptop pass 6,
 * 2026-10-26: a party long rest put two fallen companions back on their feet, death saves cleared,
 * after they had died and left the party).
 *
 *   - `who="party"` skips a card dead by the ruleset's dying saves, and any card the sheet context
 *     counts away; the living members still rest.
 *   - Named, the away are still found; the dead are refused a heal, a rest or temporary health,
 *     which only a use of what raises the dead gives back.
 *   - A fight leaves the dead out, and refuses a party of none but the dead.
 *   - The Game Master's sheet block says who is dead.
 *   - The sheet context counts away a card whose member left the stored party list, and nobody when
 *     a member of that list cannot be named.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-party-rest-dead-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { applyGameRulesetSheetTurn, loadGameRulesetSheetContext, renderGameRulesetSheetBlocks } =
  await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
const { createRulesetFight } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");

const db = await getDB();
try {
  const doc = JSON.parse(
    readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/party-rest-dead",
    version: 1,
    sourceKind: "local",
    definition: JSON.stringify({ ...doc, id: "party-rest-dead" }),
  });
  const characters = createCharactersStorage(db);
  const aldric = (await characters.create(characterDataSchema.parse({ name: "Aldric", description: "A" })))!;
  const kesh = (await characters.create(characterDataSchema.parse({ name: "Kesh", description: "K" })))!;
  const mara = (await characters.create(characterDataSchema.parse({ name: "Mara", description: "M" })))!;
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Pass 6", mode: "game", characterIds: [aldric.id, kesh.id, mara.id] });
  await chats.patchMetadata(chat.id, {
    gameRuleset: { id: "local/party-rest-dead", version: 1, packageId: null, options: {} },
    gameCharacterCards: [{ name: "Aldric" }, { name: "Kesh" }, { name: "Mara" }],
    // Kesh was taken out of the party; his card stays.
    gamePartyCharacterIds: [aldric.id, mara.id],
  });

  const context = (await loadGameRulesetSheetContext(db, chat.id))!;
  assert.deepEqual(context.away, ["Kesh"], "a member taken out of the party is away");
  const hurt = { pools: { hp: { value: 3 } } };
  const live = {
    aldric: { pools: { hp: { value: 0 } }, tracks: { death_save_failures: 3 } },
    kesh: hurt,
    mara: hurt,
  };
  const rest = applyGameRulesetSheetTurn(context, `[sheet: who="party" op="rest" rest="Long rest"]`, live);
  assert.deepEqual(rest.live.aldric, live.aldric, "the dead do not rest");
  assert.deepEqual(rest.live.kesh, hurt, "one who left the party does not rest");
  assert.notDeepEqual(rest.live.mara, hurt, "the living member rests");
  assert.deepEqual(
    rest.rests.map((one) => one.who),
    ["Mara"],
  );

  // Named, one away is still found; the dead are not healed or rested back to life (laptop pass 6
  // 2026-10-26: a restore of 1 hit point stood a dead hero up).
  const named = applyGameRulesetSheetTurn(
    context,
    `[sheet: who="Kesh" op="rest" rest="Long rest"] [sheet: who="Aldric" op="heal" pool="hp" amount="1"] [sheet: who="Aldric" op="rest" rest="Long rest"]`,
    live,
  );
  assert.notDeepEqual(named.live.kesh, hurt);
  assert.deepEqual(named.live.aldric, live.aldric);
  assert.deepEqual(
    named.outcomes.filter((one) => one.who === "Aldric").map((one) => [one.ok, one.reason]),
    [
      [false, "dead"],
      [false, "dead"],
    ],
  );
  // Nor by health's other names, nor by taking a condition off them (laptop 2026-10-26: pool="hit_points"
  // restored a dead hero to 1 of 38, and her Unconscious and Prone came off).
  assert.deepEqual(
    applyGameRulesetSheetTurn(
      context,
      `[sheet: who="Aldric" op="restore" pool="hit_points" amount="1"] [sheet: who="Aldric" op="condition" condition="Prone" state="off"]`,
      live,
    ).outcomes.map((one) => [one.ok, one.reason]),
    [
      [false, "dead"],
      [false, "dead"],
    ],
  );
  // Nor are their dying saves wiped, by the track's label or its id (laptop 2026-10-26: "Death save
  // failures" set to 0 brought a dead hero back dying in the next fight).
  const failures = context.definition.combat!.dying!.failures!;
  const failuresLabel = context.definition.sheet.live.tracks.find((track) => track.id === failures)!.label;
  for (const track of [failuresLabel, failures]) {
    const wiped = applyGameRulesetSheetTurn(context, `[sheet: who="Aldric" op="track" track="${track}" to="0"]`, live);
    assert.deepEqual(
      wiped.outcomes.map((one) => [one.ok, one.reason]),
      [[false, "dead"]],
      track,
    );
    assert.deepEqual(wiped.live.aldric, live.aldric);
  }
  // Both together are a revival the story tells, in either order (laptop 0706 Party B: a Game Master's
  // revival wrote the failures back to 0 and a restore of 1 hit point).
  for (const order of [
    `[sheet: who="Aldric" op="restore" pool="hp" amount="1"] [sheet: who="Aldric" op="track" track="${failuresLabel}" to="0"]`,
    `[sheet: who="Aldric" op="track" track="${failures}" to="0"] [sheet: who="Aldric" op="restore" pool="hit_points" amount="1"]`,
  ]) {
    const raised = applyGameRulesetSheetTurn(context, order, live);
    assert.deepEqual(
      raised.outcomes.map((one) => one.ok),
      [true, true],
      order,
    );
    assert.equal((raised.live.aldric as { pools: { hp: { value: number } } }).pools.hp.value, 1);
  }
  // Nor is a condition put on them (laptop 0706 Party B: Restrained on a dead Lyra).
  assert.deepEqual(
    applyGameRulesetSheetTurn(
      context,
      `[sheet: who="Aldric" op="condition" condition="Restrained" state="on"]`,
      live,
    ).outcomes.map((one) => [one.ok, one.reason]),
    [[false, "dead"]],
  );
  // A revival takes Prone off with it.
  assert.deepEqual(
    applyGameRulesetSheetTurn(
      context,
      `[sheet: who="Aldric" op="condition" condition="Prone" state="off"] [sheet: who="Aldric" op="track" track="${failures}" to="0"] [sheet: who="Aldric" op="restore" pool="hp" amount="1"]`,
      live,
    ).outcomes.map((one) => one.ok),
    [true, true, true],
  );
  // A damage or a note still reaches them.
  assert.equal(
    applyGameRulesetSheetTurn(context, `[sheet: who="Aldric" op="damage" pool="hp" amount="1"]`, live).outcomes[0]?.ok,
    true,
  );

  // Nor does a fight take the dead: not on the board, not in the budget (laptop pass 6 2026-10-26: a
  // dead hero placed down, every blow on him a critical); a party of none but the dead is refused.
  const fight = (party: string[]) =>
    createRulesetFight({
      definition: context.definition,
      seed: 3,
      party: party.map((name) => ({ id: name.toLowerCase(), name })),
      enemies: [{ id: "bandit", name: "Bandit", tier: "cr_1_4" }],
      cards: ["Aldric", "Mara"].map((name) => ({ name, rulesetSheet: { v: 1, build: context.cards[0]!.build } })),
      playerName: "Aldric",
      live,
      partyCatalogs: {},
      bestiary: {},
    });
  const both = fight(["Aldric", "Mara"]);
  assert.ok(both.ok, both.ok ? "" : both.error);
  assert.deepEqual(
    both.fight.encounter.combatants.filter((one) => one.side === "party").map((one) => one.name),
    ["Mara"],
  );
  assert.ok(both.fight.adjustments.includes("Aldric is dead and stays out of the fight."));
  // The player's own character dead, the player plays the first one still standing (Alyssa 2026-10-26),
  // whoever they gave the Engine before.
  assert.equal(both.standIn, "mara");
  assert.ok(both.fight.adjustments.includes("Aldric is dead, so the player plays Mara until Aldric lives again."));
  // Left out of the party sent to the fight, dead, it is the same (laptop Party A 2026-10-26: nobody
  // was the player's, and the ambush played itself out).
  const without = fight(["Mara"]);
  assert.ok(without.ok, without.ok ? "" : without.error);
  assert.equal(without.standIn, "mara");
  assert.ok(without.fight.adjustments.includes("Aldric is dead, so the player plays Mara until Aldric lives again."));
  const alone = fight(["Aldric"]);
  assert.equal(alone.ok, false);
  if (!alone.ok) assert.match(alone.error, /is dead, so there is nobody to fight it/);

  // Companions fight on their own unless the player plays them (Alyssa 2026-10-26): the player's own
  // character is theirs, every other is the Engine's; with the lead dead, the one in its place is theirs.
  const onTheirOwn = (party: string[], liveNow: typeof live) =>
    createRulesetFight({
      definition: context.definition,
      seed: 3,
      party: party.map((name) => ({ id: name.toLowerCase(), name })),
      enemies: [{ id: "bandit", name: "Bandit", tier: "cr_1_4" }],
      cards: ["Aldric", "Kesh", "Mara"].map((name) => ({
        name,
        rulesetSheet: { v: 1, build: context.cards[0]!.build },
      })),
      playerName: "Aldric",
      companionsOnTheirOwn: true,
      live: liveNow,
      partyCatalogs: {},
      bestiary: {},
    });
  const living = onTheirOwn(["Mara", "Aldric", "Kesh"], {});
  assert.ok(living.ok, living.ok ? "" : living.error);
  assert.equal(living.fight.lead, "aldric");
  assert.deepEqual(living.fight.controllers, { mara: "ai", kesh: "ai" });
  const leadDead = onTheirOwn(["Aldric", "Mara", "Kesh"], live);
  assert.ok(leadDead.ok, leadDead.ok ? "" : leadDead.error);
  assert.equal(leadDead.fight.lead, "mara");
  assert.deepEqual(leadDead.fight.controllers, { kesh: "ai" });

  // The Game Master reads who is dead on their sheet, so a potion or a rest is not spent on them in
  // the story (laptop pass 6 2026-10-26: a potion poured into a dead hero was used up).
  const blocks = renderGameRulesetSheetBlocks(
    context.definition,
    ["Aldric", "Mara"].map((name) => ({ name, rulesetSheet: { v: 1, build: context.cards[0]!.build } })),
    live,
  );
  assert.match(blocks[0]!, /^Aldric[\s\S]*\nDEAD: healing, rest and potions do nothing for them/);
  assert.doesNotMatch(blocks[1]!, /DEAD/);
  // The player's own character dead (Alyssa 2026-10-26): the player plays one still living and not
  // gone from the party, and the Game Master offers a way back; with everyone dead, a checkpoint or
  // the story.
  const three = ["Aldric", "Kesh", "Mara"].map((name) => ({
    name,
    rulesetSheet: { v: 1, build: context.cards[0]!.build },
  }));
  const said = renderGameRulesetSheetBlocks(context.definition, three, live, {}, undefined, undefined, "Aldric", [
    "Kesh",
  ]);
  assert.ok(
    said.some((block) =>
      /^THE PLAYER'S OWN CHARACTER, Aldric, IS DEAD\. Until Aldric lives again, the player plays Mara:/.test(block),
    ),
    said.join("\n---\n"),
  );
  assert.ok(!said.some((block) => /THE PLAYER'S OWN/.test(block) && /plays Kesh/.test(block)), "never one gone");
  // With no character of their own the player directs them all, so nobody dead is the player's own
  // (laptop 2026-10-26: "no character of their own" beside "THE PLAYER'S OWN CHARACTER ... IS DEAD").
  const directed = renderGameRulesetSheetBlocks(context.definition, three, live, {}, undefined, undefined, null);
  assert.ok(!directed.some((block) => /THE PLAYER'S OWN|EVERYONE/.test(block)), directed.join("\n---\n"));
  const alive = renderGameRulesetSheetBlocks(
    context.definition,
    three,
    { mara: hurt },
    {},
    undefined,
    undefined,
    "Aldric",
  );
  assert.ok(!alive.some((block) => /IS DEAD|EVERYONE/.test(block)), "a living lead says nothing");
  // A party worn down is said as a whole, for the Game Master to warn them in the story before a fight
  // and let the player choose (Alyssa 2026-10-26); a fresh one says nothing.
  const spent = renderGameRulesetSheetBlocks(
    context.definition,
    three,
    { mara: { pools: { hp: { value: 1 } } } },
    {},
    undefined,
    undefined,
    "Aldric",
  );
  const worn = spent.find((block) => block.startsWith("THE PARTY IS WORN DOWN: "));
  assert.ok(worn, spent.join("\n---\n"));
  assert.match(worn!, /Mara 1\/\d+ Hit points/);
  // Hurt, not badly: nothing said (Mara at 3 of 8, the party at most of its health).
  assert.ok(!alive.some((block) => block.startsWith("THE PARTY IS WORN DOWN")));
  assert.match(worn!, /"Are you sure\?"/);
  assert.match(worn!, /Do not offer a rest or a retreat as a choice/);
  const fresh = renderGameRulesetSheetBlocks(context.definition, three, {}, {}, undefined, undefined, "Aldric");
  assert.ok(!fresh.some((block) => block.startsWith("THE PARTY IS WORN DOWN")), fresh.join("\n---\n"));
  const dead = { pools: { hp: { value: 0 } }, tracks: { death_save_failures: 3 } };
  const wiped = renderGameRulesetSheetBlocks(
    context.definition,
    three,
    { aldric: dead, kesh: dead, mara: dead },
    {},
    undefined,
    undefined,
    "Aldric",
  );
  assert.ok(
    wiped.some((block) => /^EVERYONE IN THE PARTY IS DEAD\. The player may go back to a checkpoint\./.test(block)),
  );
  const wipedDirected = renderGameRulesetSheetBlocks(
    context.definition,
    three,
    { aldric: dead, kesh: dead, mara: dead },
    {},
    undefined,
    undefined,
    null,
  );
  assert.ok(wipedDirected.some((block) => /^EVERYONE IN THE PARTY IS DEAD\./.test(block)));

  // A party list member the Engine cannot name drops nobody.
  await chats.patchMetadata(chat.id, { gamePartyCharacterIds: [aldric.id, mara.id, "missing-id"] });
  assert.equal((await loadGameRulesetSheetContext(db, chat.id))!.away, undefined);
  // And a game with no stored party list counts nobody away.
  await chats.patchMetadata(chat.id, { gamePartyCharacterIds: null });
  assert.equal((await loadGameRulesetSheetContext(db, chat.id))!.away, undefined);

  console.log("A party command passes by the dead and those taken out of the party.");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
