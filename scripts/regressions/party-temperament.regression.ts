// A party member's temperament is theirs for the whole game (Alyssa 2026-10-31): kept on their game
// card, used outright in every fight, changed only by the story, and the one they started with kept.
import assert from "node:assert/strict";
import {
  assignCombatTactics,
  COMBAT_PARTY_TEMPERAMENTS,
  gameCardTemperament,
  partyTemperamentFallback,
  readPartyTemperament,
  withKeptTemperament,
} from "../../packages/shared/src/features/combat-ai.js";
import {
  cardsWithFreshTemperaments,
  keepPartyTemperaments,
  withCardTemperament,
} from "../../packages/server/src/services/game/party-temperament.service.js";
import { applyGeneratedGameCharacterCards } from "../../packages/server/src/routes/game.routes.js";

const unit = (id: string, aiHints?: Parameters<typeof withKeptTemperament>[0]) => ({
  id,
  hp: 40,
  maxHp: 40,
  attack: 10,
  defense: 5,
  speed: 10,
  level: 3,
  skills: [],
  aiHints,
});

// The party may be arrogant, cruel or honourable; never fanatical, territorial or hungry.
for (const word of ["arrogant", "cruel", "honourable"])
  assert.ok((COMBAT_PARTY_TEMPERAMENTS as readonly string[]).includes(word));
for (const word of ["fanatical", "territorial", "hungry", "mindless"])
  assert.equal(readPartyTemperament(word), undefined);
assert.equal(readPartyTemperament(" Honorable "), "honourable");

// A kept temperament is used outright, over every seed: no fight draws another.
for (let seed = 0; seed < 400; seed += 1) {
  assert.equal(
    assignCombatTactics(unit("john", withKeptTemperament(undefined, "cautious")), seed).adjective,
    "cautious",
  );
  assert.equal(assignCombatTactics(unit("vex", withKeptTemperament(undefined, "cruel")), seed).adjective, "cruel");
}
// A hint that is not kept still only leans, as a foe's always has.
const leaned = new Set(
  Array.from(
    { length: 200 },
    (_, seed) => assignCombatTactics(unit("orc", { temperament: "cautious" }), seed).adjective,
  ),
);
assert.ok(leaned.size > 1, "an enemy's hinted temperament is still a draw");

// The fallback for one nothing reads is the same every time for the same game and name.
assert.equal(partyTemperamentFallback("chat-1", "John"), partyTemperamentFallback("chat-1", " john "));
for (let i = 0; i < 50; i += 1) {
  const drawn = partyTemperamentFallback(`chat-${i}`, "Mira");
  assert.ok(!["arrogant", "cruel", "honourable", "supportive", "cowardly"].includes(drawn), drawn);
}

// A card made with a temperament keeps it as both its current and its initial one.
const made = withCardTemperament({ name: "John" }, "Supportive");
assert.deepEqual(gameCardTemperament(made), { current: "supportive", initial: "supportive" });
assert.equal(withCardTemperament({ name: "John" }, "hungry").temperament, undefined);

// A session's end may change it for the story; the initial one never moves, and a card written back
// without one keeps what it had.
const before = [{ name: "John", class: "Blade", temperament: "supportive", temperamentInitial: "supportive" }];
const changed = applyGeneratedGameCharacterCards(before, [{ name: "John", class: "Blade", temperament: "cautious" }]);
assert.deepEqual(gameCardTemperament(changed.cards[0]), { current: "cautious", initial: "supportive" });
const silent = applyGeneratedGameCharacterCards(changed.cards, [{ name: "John", class: "Blade" }]);
assert.deepEqual(gameCardTemperament(silent.cards[0]), { current: "cautious", initial: "supportive" });
const bogus = applyGeneratedGameCharacterCards(changed.cards, [
  { name: "John", class: "Blade", temperament: "fanatical" },
]);
assert.deepEqual(gameCardTemperament(bogus.cards[0]), { current: "cautious", initial: "supportive" });
// A card from before temperaments were kept takes its first one as its initial one.
const old = applyGeneratedGameCharacterCards(
  [{ name: "Old", class: "Scout" }],
  [{ name: "Old", temperament: "patient" }],
);
assert.deepEqual(gameCardTemperament(old.cards[0]), { current: "patient", initial: "patient" });

// A fight keeps each member's card temperament over the setup's hint; one with none takes the hint,
// and it is written onto their card for every fight after.
const cards = [
  { name: "John", temperament: "cautious", temperamentInitial: "supportive" },
  { name: "Mira" },
  { name: "Tobin" },
];
const fight = keepPartyTemperaments(
  [
    { name: "John", aiHints: { temperament: "reckless" as const, proficiency: "veteran" as const } },
    { name: "Mira", aiHints: { temperament: "honourable" as const } },
    { name: "Tobin", aiHints: { temperament: "fanatical" as const } },
    { name: "Summoned Wolf" },
  ],
  cards,
  "chat-9",
);
assert.deepEqual(fight.party[0]!.aiHints, { temperament: "cautious", proficiency: "veteran", kept: true });
assert.equal(fight.party[1]!.aiHints?.temperament, "honourable");
assert.equal(fight.party[2]!.aiHints?.temperament, partyTemperamentFallback("chat-9", "Tobin"));
assert.equal(fight.party[3]!.aiHints, undefined, "one with no card fights as any combatant does");
assert.equal(fight.fresh.size, 2, "only members with a card have one written");
const written = cardsWithFreshTemperaments(cards, fight.fresh);
assert.ok(written.changed);
assert.deepEqual(gameCardTemperament(written.cards[0]), { current: "cautious", initial: "supportive" });
assert.deepEqual(gameCardTemperament(written.cards[1]), { current: "honourable", initial: "honourable" });
// The next fight reads them off the cards, whatever its setup hints.
const next = keepPartyTemperaments(
  [{ name: "Mira", aiHints: { temperament: "reckless" as const } }],
  written.cards,
  "chat-9",
);
assert.equal(next.party[0]!.aiHints?.temperament, "honourable");
assert.equal(next.fresh.size, 0);

// A member the fight names by a variant of their card's name (a first name) is still that card: its
// temperament is used, and one drawn for it is written onto that card. A variant two cards share
// finds neither, so no card takes another's.
{
  const cards = [
    { name: "Johnathan Reyes", temperament: "patient", temperamentInitial: "patient" },
    { name: "Mira Vale" },
    { name: "Ana Brightwater" },
    { name: "Ana Duskwood" },
  ];
  const fight = keepPartyTemperaments(
    [
      { name: "Johnathan", aiHints: { temperament: "reckless" as const } },
      { name: "Mira", aiHints: { temperament: "protective" as const } },
      { name: "Ana", aiHints: { temperament: "cautious" as const } },
    ],
    cards,
    "chat-7",
  );
  assert.equal(fight.party[0]!.aiHints?.temperament, "patient");
  assert.equal(fight.party[1]!.aiHints?.temperament, "protective");
  assert.equal(fight.party[2]!.aiHints?.temperament, "cautious");
  assert.deepEqual([...fight.fresh.keys()], ["mira vale"]);
  const written = cardsWithFreshTemperaments(cards, fight.fresh);
  assert.deepEqual(gameCardTemperament(written.cards[1]), { current: "protective", initial: "protective" });
  assert.equal(written.cards[2]!.temperament, undefined);
  assert.equal(written.cards[3]!.temperament, undefined);
}

console.log("party-temperament regression passed");
