// Battle narration: the model is told each blow without its numbers, a line that invents a number is
// dropped (the screen's own numbers sit beside the prose), and a ruleset fight's events become one
// blow per attack, with what its damage and the target's fall made of it.
import assert from "node:assert/strict";
import {
  cleanCombatNarrationLine,
  gameRouteCombatNarrateBodySchema,
  isKeyCombatBeat,
  rulesetNarrationBeats,
  type CombatNarrationBeat,
  type DirectedRulesetView,
} from "../../../packages/shared/src/index.js";
import {
  buildCombatNarrationPrompt,
  parseCombatNarration,
} from "../../../packages/server/src/services/game/combat-narration.service.js";
import { marinaraBlow } from "../../../packages/server/src/services/game/marinara-director.service.js";
import { runNamedCases } from "../fixtures/named-cases.js";

const moonblast: CombatNarrationBeat = {
  id: "r1:0",
  actor: "Xerneas",
  target: "Houndoom",
  move: "Moonblast",
  outcome: "hit",
  element: "Fairy",
  effect: "strong",
};
const miss: CombatNarrationBeat = { id: "r1:1", actor: "Houndoom", target: "Xerneas", move: "Crunch", outcome: "miss" };

await runNamedCases([
  {
    name: "the prompt tells each blow and its outcome, in the player's language, and asks for one line each",
    run() {
      const { system, user } = buildCombatNarrationPrompt([moonblast, miss], {
        language: "de",
        genre: "Monster tamers",
      });
      assert.match(system, /Write in German\./);
      assert.match(system, /exactly 2 strings/);
      assert.match(
        user,
        /1\. Xerneas uses Moonblast against Houndoom: it hits; element: Fairy; the target is weak to it/,
      );
      assert.match(user, /2\. Houndoom uses Crunch against Xerneas: it MISSES/);
      assert.match(user, /Setting: Monster tamers/);
    },
  },
  {
    name: "a line with a number of its own is dropped; a number in a name is kept",
    run() {
      assert.equal(cleanCombatNarrationLine("Moonblast hits Houndoom for 24 damage!", moonblast), null);
      assert.equal(cleanCombatNarrationLine("It is 2x super effective, a silver blast!", moonblast), null);
      const unit = { ...moonblast, actor: "Unit 7" };
      assert.equal(
        cleanCombatNarrationLine("Unit 7's antlers glow silver as Moonblast slams into Houndoom", unit),
        "Unit 7's antlers glow silver as Moonblast slams into Houndoom.",
      );
      assert.equal(cleanCombatNarrationLine("", moonblast), null);
      assert.equal(cleanCombatNarrationLine('"Xerneas glows silver."', moonblast), "Xerneas glows silver.");
      assert.equal(cleanCombatNarrationLine('"'.repeat(5000), moonblast), null);
      assert.equal(cleanCombatNarrationLine(42, moonblast), null);
    },
  },
  {
    name: "a reply is read as JSON, or as numbered lines; a missing line is null",
    run() {
      assert.deepEqual(
        parseCombatNarration(
          '```json\n{"lines": ["Xerneas glows silver and blasts Houndoom.", "Houndoom snaps at empty air."]}\n```',
          [moonblast, miss],
        ),
        ["Xerneas glows silver and blasts Houndoom.", "Houndoom snaps at empty air."],
      );
      assert.deepEqual(parseCombatNarration("1. Xerneas glows silver and blasts Houndoom.\n", [moonblast, miss]), [
        "Xerneas glows silver and blasts Houndoom.",
        null,
      ]);
      // A reply that skips a beat keeps the next one in its own place.
      assert.deepEqual(parseCombatNarration("2. Houndoom snaps at empty air.", [moonblast, miss]), [
        null,
        "Houndoom snaps at empty air.",
      ]);
    },
  },
  {
    name: "key moments are crits, knockouts, reactions and super-effective blows",
    run() {
      assert.equal(isKeyCombatBeat(moonblast), true);
      assert.equal(isKeyCombatBeat(miss), false);
      assert.equal(isKeyCombatBeat({ ...miss, outcome: "hit", ko: true }), true);
      assert.equal(isKeyCombatBeat({ ...miss, outcome: "critical" }), true);
    },
  },
  {
    name: "the route takes at most twelve blows and never a number",
    run() {
      const body = { chatId: "c", beats: Array.from({ length: 13 }, (_, i) => ({ ...miss, id: `b${i}` })) };
      assert.equal(gameRouteCombatNarrateBodySchema.safeParse(body).success, false);
      const parsed = gameRouteCombatNarrateBodySchema.parse({ chatId: "c", beats: [{ ...moonblast, amount: 24 }] });
      assert.equal("amount" in parsed.beats[0]!, false);
    },
  },
  {
    name: "a Classic Marinara hit is a blow with its outcome, weakness and the target's fall; regen is not",
    run() {
      const state = {
        fighters: [
          { id: "x", name: "Xerneas", skills: [{ id: "moon", label: "Moonblast" }] },
          { id: "h", name: "Houndoom", skills: [] },
        ],
      } as unknown as Parameters<typeof marinaraBlow>[0];
      const events = [
        { kind: "hit", actorId: "x", targetId: "h", skillId: "moon", amount: 24, crit: true, affinity: "weak" },
        { kind: "down", actorId: "x", targetId: "h" },
        { kind: "miss", actorId: "h", targetId: "x" },
        { kind: "heal", actorId: "x", targetId: "x", amount: 5, status: "regen" },
      ] as Parameters<typeof marinaraBlow>[1];
      assert.deepEqual(marinaraBlow(state, events, 0), {
        actor: "Xerneas",
        target: "Houndoom",
        skill: "Moonblast",
        outcome: "critical",
        amount: "−24",
        ko: 1,
        effect: "strong",
      });
      assert.deepEqual(marinaraBlow(state, events, 2), { actor: "Houndoom", target: "Xerneas", outcome: "miss" });
      assert.equal(marinaraBlow(state, events, 3), undefined);
    },
  },
  {
    name: "a ruleset fight's attack becomes one blow, with its damage and the target's fall",
    run() {
      const events = [
        { seq: 10, event: { type: "turn", actorId: "a", round: 2 } },
        {
          seq: 11,
          event: { type: "attack", actorId: "a", targetId: "b", label: "Longsword", outcome: "critical" },
        },
        { seq: 12, event: { type: "damage", targetId: "b", sourceId: "a", dealt: 14, adjust: "vulnerable" } },
        { seq: 13, event: { type: "down", actorId: "b", dying: false } },
        { seq: 14, event: { type: "turn", actorId: "c", round: 2 } },
        {
          seq: 15,
          event: { type: "damage", targetId: "a", sourceId: "c", label: "Fire Bolt", dealt: 6, adjust: "none" },
        },
        { seq: 16, event: { type: "heal", targetId: "c", sourceId: "c", label: "Healing Word", amount: 4 } },
      ] as unknown as DirectedRulesetView["events"];
      const names = new Map([
        ["a", "Brannoc"],
        ["b", "Goblin"],
        ["c", "Shaman"],
      ]);
      assert.deepEqual(rulesetNarrationBeats(events, names), [
        {
          seq: 11,
          id: "s11",
          actor: "Brannoc",
          target: "Goblin",
          move: "Longsword",
          outcome: "critical",
          effect: "strong",
          ko: true,
        },
        { seq: 15, id: "s15", actor: "Shaman", target: "Brannoc", move: "Fire Bolt", outcome: "hit" },
        { seq: 16, id: "s16", actor: "Shaman", target: "Shaman", move: "Healing Word", outcome: "heal" },
      ]);
    },
  },
]);
