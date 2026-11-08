/**
 * A Legacy game's party moves to Classic classes from the Journal (owner 2026-11-06): one class each
 * (the tree picked, else the card's guess), the sister tree from their temperament (kept on the card,
 * else read from their Description, else drawn), at the top of that class (level 10, whatever their
 * Legacy level), each level's gains rolled as a level-up would, and their Legacy stats left on the card. A game already on Classic, or on a ruleset, isn't offered it.
 */
import assert from "node:assert/strict";
import {
  applyMarinaraLegacyUpgrade,
  marinaraLegacyNeedsTemperament,
  marinaraLegacyTemperamentPrompt,
  marinaraLegacyUpgradeBlock,
  readMarinaraLegacyTemperaments,
} from "../../packages/server/src/services/game/marinara-legacy-upgrade.service.js";
import {
  MARINARA_LEGACY_UPGRADE_LEVEL,
  marinaraClassBody,
  marinaraTrees,
  readMarinaraCardProgression,
} from "../../packages/shared/src/index.js";
import {
  applyGeneratedGameCharacterCards,
  keepFreshGameOwnedCardFields,
} from "../../packages/server/src/routes/game.routes.js";

const legacy = () => ({
  gameSetupConfig: { genre: "fantasy" },
  gameSessionNumber: 6,
  gameCharacterCards: [
    {
      name: "Kara",
      class: "Knight",
      shortDescription: "A stern knight.",
      temperament: "protective",
      temperamentInitial: "protective",
      rpgStats: { attributes: [{ name: "Level", value: 12 }], hp: { value: 40, max: 40 } },
    },
    { name: "Wren", class: "Thief", shortDescription: "Quick hands, quicker feet." },
    { name: "Ossian", class: "Wizard", shortDescription: "An old scholar." },
  ],
});

// Offered only to a Legacy game with a party.
assert.equal(marinaraLegacyUpgradeBlock(legacy()), null);
assert.ok(marinaraLegacyUpgradeBlock({ ...legacy(), gameSetupConfig: { marinaraClasses: true } }));
assert.ok(marinaraLegacyUpgradeBlock({ ...legacy(), gameRuleset: { id: "srd" } }));
assert.ok(marinaraLegacyUpgradeBlock({ ...legacy(), gameCharacterCards: [] }));

// Only the cards without a temperament are read, from their Descriptions.
const needed = marinaraLegacyNeedsTemperament(legacy());
assert.deepEqual(
  needed.map((card) => card.name),
  ["Wren", "Ossian"],
);
const prompt = marinaraLegacyTemperamentPrompt(needed, new Map([["wren", "Wren runs from every fair fight."]]));
assert.match(prompt.user, /Wren runs from every fair fight/);
assert.match(prompt.system, /reckless\|cautious/);
const read = readMarinaraLegacyTemperaments({ Wren: "Cowardly", Ossian: "not a temperament" });
assert.equal(read.get("wren"), "cowardly");
assert.equal(read.has("ossian"), false, "a wrong answer is left out, and drawn instead");

assert.equal(MARINARA_LEGACY_UPGRADE_LEVEL, 10, "the top of a starting class, where promotion opens");

const meta = legacy();
const result = applyMarinaraLegacyUpgrade(meta, {
  gameId: "chat-1",
  members: [{ name: "kara", primary: "blade" }],
  read,
  classic: new Map(),
  at: "2026-11-06T13:00:00Z",
});
assert.ok("patch" in result);
const patched = result.patch as {
  gameCharacterCards: Array<Record<string, unknown>>;
  gameSetupConfig: Record<string, unknown>;
};
assert.equal(patched.gameSetupConfig.marinaraClasses, true, "the game turns Classic on");
assert.equal(patched.gameSetupConfig.genre, "fantasy", "the rest of its setup is kept");
const [kara, wren, ossian] = patched.gameCharacterCards.map((card) => ({
  card,
  progression: readMarinaraCardProgression(card.marinara)!,
}));
// Kara: the tree picked (by any spelling of her name), her kept temperament, level 10 in one class
// although her Legacy sheet said 12.
assert.equal(kara!.progression.primary, "blade");
assert.equal(kara!.progression.temperament, "protective");
assert.equal(kara!.progression.level, 10);
assert.deepEqual(Object.keys(kara!.progression.classLevels), [kara!.progression.activeClass], "one class");
assert.equal(kara!.progression.classLevels[kara!.progression.activeClass], 10, "the class is at its top too");
assert.deepEqual(
  kara!.progression.stats,
  marinaraClassBody(kara!.progression).stats,
  "its stats are the class body rolled level by level, as level-ups give",
);
assert.ok(kara!.card.rpgStats, "Legacy stats stay on the card");
// Wren: the guessed tree, the temperament read from the Description now kept on the card.
assert.equal(wren!.progression.primary, "scout");
assert.equal(wren!.card.temperament, "cowardly");
assert.equal(wren!.card.temperamentInitial, "cowardly");
assert.equal(wren!.progression.level, 10, "the same whatever their Legacy level");
// Ossian: the model's answer was wrong, so a temperament was drawn and kept.
assert.ok(typeof ossian!.card.temperament === "string");
assert.deepEqual(
  result.upgraded.map((one) => one.temperamentFrom),
  ["card", "description", "drawn"],
);
assert.equal(result.upgraded[1]!.secondary, marinaraTrees("scout", "cowardly").secondary);
// Stats grew along the class from its level-1 start.
const start = readMarinaraCardProgression({
  ...wren!.progression,
  level: 1,
  classLevels: { [wren!.progression.activeClass]: 1 },
})!;
const startBody = marinaraClassBody(start).stats;
assert.ok(
  Object.values(wren!.progression.stats).reduce((a, b) => a + b, 0) >
    Object.values(startBody).reduce((a, b) => a + b, 0) + 9,
  "nine level-ups' worth of rolled gains",
);

// Once upgraded it can't be done again.
assert.ok(
  "refusal" in
    applyMarinaraLegacyUpgrade(
      { ...meta, ...result.patch },
      {
        gameId: "chat-1",
        members: [],
        read: new Map(),
        classic: new Map(),
        at: "x",
      },
    ),
);

// Not mid-fight: the fight under way was set up with Legacy sheets.
assert.match(marinaraLegacyUpgradeBlock({ ...legacy(), gameActiveState: "combat" }) ?? "", /fight/);

// What the upgrade gave survives a session's end: the conclusion rewrites each card from what the model
// returned, and the Classic progression (and the multiplayer seat) ride along.
{
  const done = applyMarinaraLegacyUpgrade(legacy(), {
    gameId: "game-2",
    members: [],
    read: new Map(),
    classic: new Map(),
    at: "2026-11-06T14:00:00Z",
  });
  assert.ok("patch" in done);
  const cards = (done.patch.gameCharacterCards as Array<Record<string, unknown>>).map((card) =>
    card.name === "Wren" ? { ...card, multiplayerParticipantId: "seat-1" } : card,
  );
  const concluded = applyGeneratedGameCharacterCards(
    cards,
    cards.map((card) => ({ name: card.name, class: "Hero", shortDescription: "Changed by the story." })),
  ).cards;
  for (const [index, card] of concluded.entries()) assert.deepEqual(card.marinara, cards[index]!.marinara);
  assert.equal(concluded.find((card) => card.name === "Wren")!.multiplayerParticipantId, "seat-1");

  // The conclusion was written from cards read before its model call; a progression the game wrote
  // meanwhile (the upgrade itself, a fight's XP) is the one kept.
  const stale = legacy().gameCharacterCards as Array<Record<string, unknown>>;
  const kept = keepFreshGameOwnedCardFields(applyGeneratedGameCharacterCards(stale, stale).cards, cards);
  for (const [index, card] of kept.entries()) assert.deepEqual(card.marinara, cards[index]!.marinara);
}

console.log("game-marinara-legacy-upgrade: ok");
