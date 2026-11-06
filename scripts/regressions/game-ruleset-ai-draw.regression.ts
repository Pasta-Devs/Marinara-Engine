/**
 * The Engine's own fighters take in hand what does better, and shoot what does better (2026-10-26,
 * after the In hand row gave players the same).
 *
 *   - A foe with a sword in hand and a bow carried, with nobody in the sword's reach, takes the bow in
 *     hand with the turn's free interaction and shoots; with somebody beside it on a later turn, where
 *     a shot at somebody beside you is at disadvantage, it takes the sword back and swings.
 *   - A companion on the Engine's tactics shoots first the arrows that do more (clauses of their own,
 *     1.657), and keeps arrows that only slay one kind for that kind, even where every arrow it has
 *     carries clauses of its own (laptop 2026-10-26: Pip shot an Arrow of Undead Slaying at a Bandit
 *     Captain with four +1 arrows left).
 *   - The turn's free interaction already spent (on picking up what it dropped, 1.266), nothing else
 *     is taken in hand that turn; and a weapon a buckler keeps out of hand is never tried.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetItemBook,
  rulesetSheetItems,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ai-draw-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [{ createCombatDirector }, { commandRulesetCombatDirector, syncRulesetCombatants, rulesetDirectorStage }] =
  await Promise.all([
    import("../../packages/server/src/services/game/combat-director.service.js"),
    import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
  ]);

try {
  const doc = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
  ) as Record<string, any>;
  // A buckler (armor in one hand), a sword that only swings, arrows that burn, and arrows that only slay what is a dragon; and an
  // attack roll thrown twice, a shot with a foe beside you at disadvantage, as 5e has it.
  const outfitter = doc.catalogs.find((catalog: { id: string }) => catalog.id === "outfitter");
  outfitter.entries.push(
    {
      id: "buckler",
      label: "Buckler",
      item: { category: "armor", rarity: "common", stats: { bulk: 1, guard: 1 }, slots: { hands: 1 } },
    },
    {
      id: "sword",
      label: "Sword",
      item: {
        category: "weapon",
        rarity: "common",
        stats: { bulk: 1, damage: "1d8", swing: "brawn", reach: "close" },
        slots: { hands: 1 },
        attack: {
          budget: "act",
          toHit: { abilities: { stat: "swing" } },
          damage: { dice: { stat: "damage" }, abilities: { stat: "swing" }, type: "cut" },
          reach: 2,
        },
      },
    },
    {
      id: "fire-arrows",
      label: "Fire arrows",
      item: {
        category: "ammunition",
        rarity: "uncommon",
        tags: ["arrow"],
        stats: { bulk: 1 },
        stack: 20,
        ammoRider: { plus: [{ dice: "3d6", type: "fire" }] },
      },
    },
    {
      id: "slaying-arrows",
      label: "Dragon-slaying arrows",
      item: {
        category: "ammunition",
        rarity: "storied",
        tags: ["arrow"],
        stats: { bulk: 1 },
        stack: 20,
        ammoRider: { plus: [{ dice: "6d10", type: "cut", targetIs: { types: ["dragon"] } }], spentOnUse: true },
      },
    },
    {
      id: "keen-arrows",
      label: "Keen arrows",
      item: {
        category: "ammunition",
        rarity: "uncommon",
        tags: ["arrow"],
        stats: { bulk: 1 },
        stack: 20,
        ammoRider: { plus: [{ flat: 1, type: "cut" }], spentOnUse: true },
      },
    },
  );
  // A bow that hits hard enough that a +1 arrow is no clear gain over another (a 5e longbow's 1d8 + 3).
  const huntingBow = outfitter.entries.find((entry: { id: string }) => entry.id === "hunting-bow");
  outfitter.entries.push({
    ...structuredClone(huntingBow),
    id: "war-bow",
    label: "War bow",
    item: { ...structuredClone(huntingBow.item), stats: { ...huntingBow.item.stats, damage: "3d8" } },
  });
  doc.combat.attackRoll.advantage = true;
  doc.combat.ranged = { adjacentFoe: "disadvantage" };
  doc.combat.creatureTypes = {
    types: [
      { id: "humanoid", label: "Humanoid" },
      { id: "dragon", label: "Dragon" },
    ],
    default: "humanoid",
  };
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, `imports cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  const ember: RulesetDefinition = parsed.definition;
  const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
    (ember.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(ember, entries, { actor: "player" });
  const stack = (id: string, ref: string, quantity = 1, equipped = false): GameInventoryStack => ({
    id,
    name: id,
    item: `outfitter/${ref}`,
    quantity,
    ...(equipped ? { equipped: true as const } : {}),
  });
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({ health: 200, defense: 1, initiativeModifier: 0, actions: [], ...extra }) as unknown as RulesetStatBlock;
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 30,
    maxHp: 30,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 3,
    skills: [],
    aiHints: { proficiency: "master" as const },
  });

  /** A fight on a road one cell wide, in the order given: sheet fighters by their stacks, the rest blocks. */
  const fight = (
    fighters: Array<{
      id: string;
      side: "party" | "enemy";
      at: { x: number; y: number };
      stacks?: GameInventoryStack[];
      block?: RulesetStatBlock;
    }>,
    controllers: Record<string, string>,
  ) => {
    const encounter = createRulesetEncounter({
      definition: ember,
      seed: 7,
      roller: () => 4,
      combatants: fighters.map((one) =>
        !one.stacks
          ? { id: one.id, name: one.id, side: one.side, block: one.block ?? block() }
          : one.side === "party"
            ? {
                id: one.id,
                name: one.id,
                side: one.side,
                build: defaultRulesetSheetBuild(ember),
                items: rulesetSheetItems(book, one.stacks, undefined),
              }
            : // An opponent with a sheet of its own, carrying what it fights with (1.795).
              {
                id: one.id,
                name: one.id,
                side: one.side,
                block: block({ sheet: defaultRulesetSheetBuild(ember) }),
                carried: rulesetSheetItems(book, one.stacks, undefined).map((held, index) => ({
                  held,
                  ref: one.stacks![index]!.item,
                })),
              },
      ),
      board: {
        grid: { width: 30, height: 1, tiles: [Array(30).fill("plains")] },
        placements: Object.fromEntries(fighters.map((one) => [one.id, one.at])),
      } as never,
    });
    encounter.order = fighters.map((one) => one.id);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: fighters.filter((one) => one.side === "party").map((one) => unit(one.id, "player")),
      enemies: fighters.filter((one) => one.side === "enemy").map((one) => unit(one.id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers, bosses: [], adjustments: [] } as never;
    syncRulesetCombatants(ember, state);
    state.stage = rulesetDirectorStage(state);
    return { state, fight: state.rulesetFight! };
  };
  type Fight = ReturnType<typeof fight>;
  /** What happened of `actorId`'s since the event `from`. */
  const said = (one: Fight, from: number, actorId: string) =>
    one.fight.events
      .filter((entry) => entry.seq > from && "actorId" in entry.event && entry.event.actorId === actorId)
      .map((entry) => entry.event);
  /** One turn of the Engine's own, the current actor's. */
  const play = (one: Fight) => {
    const from = one.fight.eventSeq;
    const result = commandRulesetCombatDirector(ember, one.state, { type: "continue" });
    assert.ok(result.ok, result.ok ? "" : result.error);
    return from;
  };
  /** The manual hero's turn, ended as it begins. */
  const pass = (one: Fight) => {
    const result = commandRulesetCombatDirector(ember, one.state, {
      type: "ruleset",
      optionId: "end-turn",
      targetIds: [],
    });
    assert.ok(result.ok, result.ok ? "" : result.error);
  };

  // ── Nobody in the sword's reach: the bow taken in hand, and shot ──
  const brigand = () => [stack("sword", "sword", 1, true), stack("bow", "hunting-bow"), stack("arrows", "arrows", 20)];
  const duel = fight(
    [
      { id: "brigand", side: "enemy", at: { x: 1, y: 0 }, stacks: brigand() },
      { id: "hero", side: "party", at: { x: 22, y: 0 }, block: block({ health: 40, defense: 8 }) },
    ],
    { hero: "manual" },
  );
  {
    const events = said(duel, play(duel), "brigand");
    assert.deepEqual(events[0], { type: "drew", actorId: "brigand", label: "bow", stowed: ["sword"] });
    assert.ok(
      events.some((event) => event.type === "attack" && event.optionId === "item:1" && event.targetId === "hero"),
      `it shoots the hero: ${JSON.stringify(events)}`,
    );
    assert.equal(
      events.some((event) => event.type === "move"),
      false,
      "and stays where it shot from",
    );
    assert.deepEqual(rulesetCombatant(duel.fight.encounter, "brigand")!.drawn, { 0: false, 1: true });
  }

  // ── With the hero beside it, a shot at disadvantage: the sword taken back, and swung ──
  {
    pass(duel);
    // Backed against the end of a one-cell-wide road, where no step takes it out of the hero's reach.
    const hero = rulesetCombatant(duel.fight.encounter, "hero")!;
    const at = rulesetCombatant(duel.fight.encounter, "brigand")!;
    at.x = 0;
    hero.x = 1;
    const events = said(duel, play(duel), "brigand");
    assert.deepEqual(events[0], { type: "drew", actorId: "brigand", label: "sword", stowed: ["bow"] });
    assert.ok(
      events.some((event) => event.type === "attack" && event.optionId === "item:0" && event.targetId === "hero"),
      `it swings at the hero: ${JSON.stringify(events)}`,
    );
    // Its next turn, still beside the hero: the sword stays in hand.
    pass(duel);
    const again = said(duel, play(duel), "brigand");
    assert.equal(
      again.some((event) => event.type === "drew"),
      false,
      "nothing more is taken in hand",
    );
    assert.ok(again.some((event) => event.type === "attack" && event.optionId === "item:0"));
  }

  // ── The free interaction spent picking up what it dropped: the bow stays where it is ──
  {
    const dropped = fight(
      [
        { id: "brigand", side: "enemy", at: { x: 1, y: 0 }, stacks: brigand() },
        { id: "hero", side: "party", at: { x: 22, y: 0 }, block: block({ health: 40, defense: 8 }) },
      ],
      { hero: "manual" },
    );
    const one = rulesetCombatant(dropped.fight.encounter, "brigand")!;
    one.dropped = [{ key: "item:0", label: "sword", at: { x: 1, y: 0 } }];
    const events = said(dropped, play(dropped), "brigand");
    assert.ok(
      events.some((event) => event.type === "pickedUp"),
      `the sword is picked up: ${JSON.stringify(events)}`,
    );
    assert.equal(
      events.some((event) => event.type === "drew"),
      false,
      "and nothing else is taken in hand that turn",
    );
    assert.ok(
      events.some((event) => event.type === "move"),
      "it walks toward the hero instead",
    );
    // The next turn has its own: the bow is taken in hand then.
    pass(dropped);
    const next = said(dropped, play(dropped), "brigand");
    assert.equal(next[0]?.type, "drew", JSON.stringify(next));
  }

  // ── A buckler in the hand the bow needs: never tried, and the turn goes on without it ──
  {
    const shielded = fight(
      [
        {
          id: "brigand",
          side: "enemy",
          at: { x: 1, y: 0 },
          stacks: [stack("buckler", "buckler", 1, true), ...brigand()],
        },
        { id: "hero", side: "party", at: { x: 22, y: 0 }, block: block({ health: 40, defense: 8 }) },
      ],
      { hero: "manual" },
    );
    for (let turn = 0; turn < 2; turn++) {
      const events = said(shielded, play(shielded), "brigand");
      assert.equal(
        events.some((event) => event.type === "drew"),
        false,
        "the bow is never taken in hand",
      );
      assert.ok(
        events.some((event) => event.type === "move"),
        `it walks toward the hero: ${JSON.stringify(events)}`,
      );
      pass(shielded);
    }
  }

  // ── A companion shoots first the arrows that do more, and keeps those that slay for what they slay ──
  {
    const quiver = () => [
      stack("bow", "hunting-bow", 1, true),
      stack("arrows", "arrows", 20),
      stack("slaying", "slaying-arrows", 3),
      stack("fire", "fire-arrows", 5),
    ];
    const archery = (foe: RulesetStatBlock) =>
      fight(
        [
          { id: "archer", side: "party", at: { x: 1, y: 0 }, stacks: quiver() },
          { id: "beast", side: "enemy", at: { x: 10, y: 0 }, block: foe },
        ],
        { archer: "ai" },
      );
    const plainFoe = archery(block({ type: "humanoid" }));
    const events = said(plainFoe, play(plainFoe), "archer");
    const archer = rulesetCombatant(plainFoe.fight.encounter, "archer")!;
    assert.deepEqual(archer.ammoFirst, { 0: 3 }, `the fire arrows first: ${JSON.stringify(events)}`);
    assert.ok(events.some((event) => event.type === "attack" && event.optionId === "item:0"));
    assert.deepEqual(archer.itemsUsed, { 3: 1 }, "shot out of the fire arrows, not the plain or the slaying");

    const dragon = archery(block({ type: "dragon" }));
    said(dragon, play(dragon), "archer");
    const slayer = rulesetCombatant(dragon.fight.encounter, "archer")!;
    assert.deepEqual(slayer.ammoFirst, { 0: 2 }, "against a dragon, the slaying arrows first");
    assert.deepEqual(slayer.itemsUsed, { 2: 1 });

    // Only keen and slaying arrows, the slaying first in the bag: the keen ones at a humanoid.
    const magicQuiver = (foe: RulesetStatBlock) =>
      fight(
        [
          {
            id: "pip",
            side: "party",
            at: { x: 1, y: 0 },
            stacks: [
              stack("bow", "war-bow", 1, true),
              stack("slaying", "slaying-arrows", 1),
              stack("keen", "keen-arrows", 4),
            ],
          },
          { id: "captain", side: "enemy", at: { x: 10, y: 0 }, block: foe },
        ],
        { pip: "ai" },
      );
    const captain = magicQuiver(block({ type: "humanoid" }));
    const shots = said(captain, play(captain), "pip");
    const pip = rulesetCombatant(captain.fight.encounter, "pip")!;
    assert.ok(
      shots.some((event) => event.type === "attack" && event.optionId === "item:0"),
      JSON.stringify(shots),
    );
    assert.deepEqual(pip.itemsUsed, { 2: 1 }, "a keen arrow at the humanoid, the slaying one kept");
    const wyrm = magicQuiver(block({ type: "dragon" }));
    said(wyrm, play(wyrm), "pip");
    assert.deepEqual(rulesetCombatant(wyrm.fight.encounter, "pip")!.itemsUsed, { 1: 1 }, "the slaying one at a dragon");
  }

  console.log(
    "AI draw: draws the better weapon, picks the better ammunition, and only with the turn's free interaction.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
