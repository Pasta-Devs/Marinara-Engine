/**
 * What a companion fighter did with its turns against a lich (laptop 2026-10-26: Garrick, an AI
 * fighter, made no attack in twelve rounds).
 *
 *   - A heal it cannot get back this fight (a potion, a use a day) is never given to a friend above
 *     half with nobody down, even with nothing better on offer; below half it still is.
 *   - A budget handed over for this turn (an extra action) is not spent on a blow its orders keep it
 *     from walking to; within its leash it still is.
 *   - A treatment of a dying friend that hangs on a check is weighed by its odds, and against the walk
 *     to a blow it gives up: at even odds the blow wins, at good odds the treatment does, unless a
 *     friend still standing could heal them, or the blow is on a boss and the odds are only fair.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  type RulesetCombatAction,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ai-companion-turns-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { pickRulesetChoice, rankRulesetChoices } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  ) as Record<string, any>;
  // First aid as the SRD writes it: a check against a fixed DC that steadies one dying.
  doc.combat.checks.push({ id: "medicine", label: "Medicine", value: { skillMod: "medicine" } });
  doc.combat.contests.push({
    id: "steady",
    label: "Steady",
    budget: "action",
    attacker: { checks: ["medicine"] },
    difficulty: 10,
    targets: "ally",
    targetDying: true,
    onWin: { stabilizes: true },
  });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;

  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      size: "medium",
      abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      saves: {},
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const sword = {
    id: "sword",
    name: "Longsword",
    budget: "action",
    toHit: 5,
    reach: 5,
    damage: { count: 1, sides: 8, flat: 3 },
  };
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 8,
    reach: 5,
    damage: { count: 3, sides: 8, flat: 4 },
  };
  const mend = {
    id: "mend",
    name: "Mend",
    budget: "action",
    range: { normal: 60 },
    targets: "ally",
    heal: { count: 1, sides: 8, flat: 3 },
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
    level: 5,
    skills: [],
    aiHints: { proficiency: "master" as const },
  });
  type Scene = Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>;
  const fight = (blocks: Scene, controllers: Record<string, string>, bosses: string[] = []) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
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
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers, bosses, adjustments: [] } as never;
    return { encounter, state };
  };
  const give = (encounter: RulesetEncounterState, id: string, action: Record<string, unknown>) => {
    const one = rulesetCombatant(encounter, id)!;
    one.actions.push(action as unknown as RulesetCombatAction);
    if (action.uses) one.uses[action.id as string] = (action.uses as { count: number }).count;
  };
  const potion = {
    id: "potion",
    label: "Potion of Healing",
    kind: "heal",
    budget: "action",
    uses: { per: "encounter", count: 1 },
    range: { normal: 5 },
    targets: { side: "ally", count: 1 },
    heal: { count: 2, sides: 4, flat: 2 },
  };
  const surge = {
    id: "surge",
    label: "Action Surge",
    kind: "ability",
    budget: "action",
    free: true,
    uses: { per: "encounter", count: 1 },
    targets: { side: "self", count: 0 },
    gives: [{ budget: "action", count: 1 }],
  };

  // ── A potion is not fed to a friend above half with nobody down ──
  {
    const scene = (corinAt: number) => {
      const made = fight(
        {
          garrick: { side: "party", block: block([sword]), at: { x: 2, y: 5 } },
          corin: { side: "party", block: block([sword], { health: 31 }), at: { x: 3, y: 6 } },
          lich: { side: "enemy", block: block([smash], { health: 150 }), at: { x: 14, y: 5 } },
        },
        { garrick: "ai", corin: "manual" },
      );
      give(made.encounter, "garrick", potion);
      rulesetCombatant(made.encounter, "corin")!.health.value = corinAt;
      return made;
    };
    const above = scene(21);
    const ranked = rankRulesetChoices(definition, above.state, above.encounter, "garrick", 10);
    assert.ok(
      !ranked.some((one) => one.candidate.action.option.id === "potion"),
      `no potion at 21 of 31: ${ranked.map((one) => one.candidate.action.option.id).join(", ")}`,
    );
    assert.notEqual(pickRulesetChoice(definition, above.state, above.encounter, "garrick")?.option.id, "potion");
    const below = scene(12);
    const fed = pickRulesetChoice(definition, below.state, below.encounter, "garrick");
    assert.equal(fed?.option.id, "potion", "still fed at 12 of 31");
    assert.equal(fed?.targetId, "corin");
  }

  // ── An extra action is not taken for a blow off its leash ──
  {
    const scene = (lichAt: number) => {
      const made = fight(
        {
          garrick: { side: "party", block: block([sword]), at: { x: 2, y: 5 } },
          corin: { side: "party", block: block([sword], { health: 31 }), at: { x: 3, y: 6 } },
          lich: { side: "enemy", block: block([smash], { health: 150 }), at: { x: lichAt, y: 5 } },
        },
        { garrick: "ai", corin: "manual" },
      );
      give(made.encounter, "garrick", surge);
      // Its own action already spent, as after the turn's first blow.
      rulesetCombatant(made.encounter, "garrick")!.budgets.action = 0;
      return made;
    };
    // Guarding Corin, three squares from him at most: a lich at x 8 is in a walk, but not on the leash.
    const far = scene(8);
    assert.notEqual(
      pickRulesetChoice(definition, far.state, far.encounter, "garrick")?.option.id,
      "surge",
      "no surge for a blow its leash keeps it from",
    );
    const near = scene(6);
    assert.equal(pickRulesetChoice(definition, near.state, near.encounter, "garrick")?.option.id, "surge");
  }

  // ── First aid by its odds, against the walk to a blow ──
  {
    const scene = (medicine: number, opts: { healer?: boolean; boss?: boolean } = {}) => {
      const made = fight(
        {
          garrick: { side: "party", block: block([sword]), at: { x: 7, y: 5 } },
          hero: { side: "party", block: block([sword]), at: { x: 2, y: 1 } },
          corin: { side: "party", block: block([sword], { health: 31 }), at: { x: 8, y: 6 } },
          ...(opts.healer ? { mira: { side: "party" as const, block: block([sword, mend]), at: { x: 9, y: 8 } } } : {}),
          lich: { side: "enemy", block: block([smash], { health: 150 }), at: { x: 1, y: 1 } },
        },
        { garrick: "ai", hero: "manual", corin: "manual", mira: "manual" },
        opts.boss ? ["lich"] : [],
      );
      rulesetCombatant(made.encounter, "garrick")!.checks!.medicine = medicine;
      const corin = rulesetCombatant(made.encounter, "corin")!;
      corin.health.value = 0;
      corin.down = true;
      corin.dying = true;
      corin.stable = false;
      return made;
    };
    const pick = (made: ReturnType<typeof scene>) =>
      pickRulesetChoice(definition, made.state, made.encounter, "garrick");
    // 9 against DC 10 or so: about even odds. The lich is a walk away, and the walk is taken to strike.
    const even = pick(scene(0));
    assert.equal(even?.option.id, "sword", `strikes rather than try first aid at even odds: ${even?.option.id}`);
    assert.equal(even?.targetId, "lich");
    assert.ok(even?.to, "walking into reach of the blow it then strikes");
    // At good odds with nobody else to heal them, it steadies them.
    assert.equal(pick(scene(5))?.option.id, "contest:steady", "steadies at good odds");
    // Not while a friend still standing has a heal of their own.
    assert.equal(pick(scene(5, { healer: true }))?.option.id, "sword", "leaves it to the healer");
    // Fair odds are enough against a blow on anybody, not against a blow on a boss.
    assert.equal(pick(scene(3))?.option.id, "contest:steady", "steadies at fair odds");
    assert.equal(pick(scene(3, { boss: true }))?.option.id, "sword", "strikes the boss at fair odds");
  }

  console.info(
    "AI companion turns: no potion above half, no extra action off its leash, first aid weighed by its odds against a blow in reach.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
