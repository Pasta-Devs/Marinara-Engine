/**
 * An area whose effect the Engine cannot weigh (K5: Exalted's withering volleys, which take
 * initiative, not health): each friend it catches takes off what a foe adds, and one over friends
 * and no foe is never thrown as support. Ruleset-neutral: any area whatever it does.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetWindowOptions,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unread-areas-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { pickRulesetChoice } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(JSON.parse(fiveEText));
  const combat = definition.combat!;
  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const hold = {
    id: "hold",
    name: "Hold",
    budget: "action",
    range: { normal: 90 },
    save: { save: "wis_save", difficulty: 16, onSuccess: "negates" },
    applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
  };
  const flick = {
    id: "flick",
    name: "Flick",
    budget: "action",
    toHit: 6,
    range: { normal: 90 },
    damage: { count: 1, sides: 2, flat: 0 },
  };
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 8,
    reach: 1,
    damage: { count: 3, sides: 10, flat: 5 },
  };
  const poke = {
    id: "poke",
    name: "Poke",
    budget: "action",
    toHit: 2,
    reach: 1,
    damage: { count: 1, sides: 2, flat: 0 },
  };
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 60,
    maxHp: 60,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 9,
    skills: [],
    aiHints: { proficiency: "master" as const, temperament: "disciplined" as const },
  });
  const fight = (
    blocks: Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>,
  ) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 14, height: 8, tiles: Array.from({ length: 8 }, () => Array(14).fill("plains")) },
        placements: Object.fromEntries(Object.entries(blocks).map(([id, one]) => [id, one.at])),
      } as never,
    });
    encounter.order = Object.keys(blocks);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: Object.entries(blocks)
        .filter(([, one]) => one.side === "party")
        .map(([id]) => unit(id, "player")),
      enemies: Object.entries(blocks)
        .filter(([, one]) => one.side === "enemy")
        .map(([id]) => unit(id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    return { encounter, state };
  };

  const volley = {
    id: "volley",
    name: "Volley",
    budget: "action",
    range: { normal: 30 },
    area: { shape: "burst", size: 10 },
  };
  const scene = (friends: Array<{ x: number; y: number }>, foe?: { x: number; y: number }) =>
    fight({
      archer: { side: "enemy", block: block([volley]), at: { x: 1, y: 1 } },
      ...Object.fromEntries(
        friends.map((at, index) => [`ally${index}`, { side: "enemy" as const, block: block([]), at }]),
      ),
      ...(foe
        ? { hero: { side: "party" as const, block: block([]), at: foe } }
        : { hero: { side: "party" as const, block: block([]), at: { x: 13, y: 7 } } }),
    });
  const aims = (picked: ReturnType<typeof pickRulesetChoice>) =>
    picked?.option.id === "volley" ? (picked.choice.at ?? picked.choice.targetIds) : null;
  // A foe alone: thrown at it.
  {
    const { encounter, state } = scene([], { x: 6, y: 4 });
    const picked = pickRulesetChoice(definition, state, encounter, "archer");
    assert.equal(picked?.option.id, "volley", `thrown at a lone foe: ${JSON.stringify(picked?.choice)}`);
  }
  // A foe with two friends beside it: not thrown where it catches them.
  {
    const { encounter, state } = scene(
      [
        { x: 6, y: 3 },
        { x: 6, y: 5 },
      ],
      { x: 6, y: 4 },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "archer");
    if (picked?.option.id === "volley") {
      const at = picked.choice.at;
      assert.ok(at, JSON.stringify(picked.choice));
      const caught = ["ally0", "ally1"].filter((id) => {
        const one = rulesetCombatant(encounter, id)!;
        return Math.max(Math.abs(one.x! - at.x), Math.abs(one.y! - at.y)) <= 2;
      });
      assert.ok(caught.length < 2, `not over both friends: ${JSON.stringify({ at, caught })}`);
    }
  }
  // Friends and no foe inside: never thrown as support.
  {
    const { encounter, state } = scene([
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]);
    const picked = pickRulesetChoice(definition, state, encounter, "archer");
    assert.notEqual(picked?.option.id, "volley", `over friends alone: ${JSON.stringify(picked?.choice)}`);
  }
  // A foe in the corner beside it: every aim that catches the foe catches the archer too, which
  // counts as a friend caught (AI pass 2026-10-24: Exalted fire-arrow volleys over their own archer).
  {
    const { encounter, state } = scene([], { x: 0, y: 0 });
    const picked = pickRulesetChoice(definition, state, encounter, "archer");
    assert.notEqual(picked?.option.id, "volley", `not over itself: ${JSON.stringify(picked?.choice)}`);
  }
  console.info("Unread areas: thrown at a foe, kept off friends and its maker, never over friends alone.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
