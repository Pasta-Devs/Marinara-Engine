/**
 * Ammunition with clauses of its own (Capability API 1.657): 5e's Arrow of Slaying, "a creature of
 * the type ... hit by the arrow must make a DC 17 Constitution saving throw, taking an extra 6d10
 * piercing damage on a failed save, or half as much extra damage on a successful one. Once an arrow of
 * slaying deals its extra damage to a creature, it becomes a nonmagical arrow."
 *
 *   - Each carried stack of it is its own way to shoot the bow; the plain way takes plain arrows first.
 *   - Shot at its kind, its 6d10 rides the blow; at another, nothing more.
 *   - Spent, what comes back after a won fight comes back as a plain arrow.
 *   - Refused without a tag, with a switched clause, or naming an unknown creature type.
 *   - The install gate.
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
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ammo-rider-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { rankRulesetChoices } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 657);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const slaying = () => ({
    plus: [
      {
        dice: "6d10",
        type: "piercing",
        save: { save: "con_save", difficulty: 17, onSuccess: "half" },
        targetIs: { types: ["dragon"] },
      },
    ],
    spentOnUse: true,
  });
  const document = (edit: (rider: Record<string, any>, doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      tags: [{ id: "arrow", label: "Arrow" }],
      slots: [{ id: "hand", label: "Hand", count: 2 }],
    };
    doc.combat.creatureTypes = {
      types: ["beast", "dragon"].map((id) => ({ id, label: id })),
      field: "race",
      default: "beast",
    };
    const rider = slaying();
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        { id: "arrow", label: "Arrow", item: { category: "gear", tags: ["arrow"] } },
        {
          id: "dragon-arrow",
          label: "Arrow of Dragon Slaying",
          item: { category: "gear", tags: ["arrow"], ammoRider: rider },
        },
        {
          id: "longbow",
          label: "Longbow",
          item: {
            category: "gear",
            slots: { hand: 2 },
            attack: {
              budget: "action",
              toHit: { bonus: 20 },
              damage: { dice: "1d8", bonus: 2, type: "piercing" },
              range: { normal: 80 },
              ammo: { tag: "arrow", recover: 1 },
            },
          },
        },
      ],
    });
    edit(rider, doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const kit = (id: string, def: RulesetDefinition = definition) =>
    def.catalogs!.find((catalog) => catalog.id === "kit")!.entries!.find((entry) => entry.id === id)!.item!;
  const stack = (
    id: string,
    name: string,
    quantity: number,
    worn = false,
    def: RulesetDefinition = definition,
  ): RulesetSheetItem => ({
    item: kit(id, def),
    quantity,
    worn,
    name,
    stack: { id: `s-${id}`, ref: `kit/${id}` },
  });
  const foe = (id: string, type: string, health: number) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: { health, defense: 10, initiativeModifier: -20, type, actions: [] } as unknown as RulesetStatBlock,
  });
  // Every d20 a 5 (the archer hits on +20; a monster fails its save), every other die a 4.
  const faces = (sides: number) => (sides === 20 ? 5 : 4);
  const fight = (foes = [foe("wyrm", "dragon", 20)], def: RulesetDefinition = definition): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: faces,
      combatants: [
        {
          id: "archer",
          name: "Archer",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
          }),
          items: [
            stack("longbow", "Longbow", 1, true, def),
            stack("arrow", "Arrow", 5, false, def),
            stack("dragon-arrow", "Arrow of Dragon Slaying", 1, false, def),
          ],
        },
        ...foes,
      ],
    });
    state.order = ["archer", ...foes.map((one) => one.id)];
    state.turn = 0;
    return state;
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const shoot = (state: RulesetEncounterState, target: string, mode?: string, def: RulesetDefinition = definition) => {
    const result = applyRulesetCombatChoice(
      def,
      state,
      { actorId: "archer", optionId: "item:0", targetIds: [target], ...(mode ? { mode } : {}) },
      faces,
    );
    assert.deepEqual(eventsOf(result.events, "refused"), [], JSON.stringify(eventsOf(result.events, "refused")));
    return result;
  };
  const dealt = (events: RulesetCombatEvent[], id: string) =>
    eventsOf(events, "damage")
      .filter((one) => one.targetId === id)
      .reduce((sum, one) => sum + one.amount, 0);

  // ── Its own way to shoot the bow ──
  {
    const state = fight();
    const bow = rulesetCombatOptions(definition, state, "archer").find((one) => one.id === "item:0")!;
    assert.deepEqual(
      bow.modes?.map((one) => [one.id, one.label]),
      [["shot:2", "Arrow of Dragon Slaying"]],
    );
    const plain = shoot(fight([foe("wyrm", "dragon", 200)]), "wyrm");
    assert.equal(dealt(plain.events, "wyrm"), 6, "a plain arrow first: 1d8 + 2, nothing more");
    const archer = rulesetCombatant(plain.state, "archer")!;
    assert.equal(archer.itemsUsed?.["1"], 1);
    assert.equal(
      eventsOf(plain.events, "shot")[0]?.left,
      archer.sheet!.items![1]!.quantity - 1,
      "a plain shot counts the plain arrows left, not the slaying ones (laptop playtest 2026-10-30)",
    );
  }

  // ── At another kind, nothing more and not spent ──
  {
    const result = shoot(fight([foe("wolf", "beast", 200)]), "wolf", "shot:2");
    assert.equal(dealt(result.events, "wolf"), 6);
    const archer = rulesetCombatant(result.state, "archer")!;
    assert.equal(archer.itemsUsed?.["2"], 1, "the slaying arrow was shot");
    assert.equal(
      eventsOf(result.events, "shot")[0]?.left,
      0,
      "what is left of the stack it was shot out of, as its label names it, not every arrow",
    );
    assert.equal(archer.recoverable?.["2"], 1, "still a slaying arrow to win back");
  }

  // ── At its kind: 6d10 on a failed save, then a plain arrow ──
  {
    const before = fight();
    const result = shoot(before, "wyrm", "shot:2");
    assert.equal(dealt(result.events, "wyrm"), 30, "6, and 6d10 of 4s more on a failed save");
    const changes = rulesetFightItemChanges(before, result.state);
    const taken = Object.fromEntries(changes.map((one) => [one.stack.ref, one.taken]));
    assert.equal(taken["kit/dragon-arrow"], 1, "the slaying arrow is gone");
    assert.equal(taken["kit/arrow"], -1, "and back as a plain arrow");
  }

  // ── The Engine keeps it for its kind (laptop handoff 2026-10-30: Nyx shot five at humans) ──
  {
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 5,
      skills: [],
    });
    const modesAt = (target: string, type: string) => {
      const state = fight([foe(target, type, 200)]);
      const director = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("archer", "player")],
        enemies: [unit(target, "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      return rankRulesetChoices(definition, director, state, "archer", 200)
        .filter((one) => one.candidate.action.choice?.optionId === "item:0")
        .map((one) => one.candidate.action.choice?.mode ?? "plain");
    };
    const atWolf = modesAt("wolf", "beast");
    assert.ok(atWolf.includes("plain"), JSON.stringify(atWolf));
    assert.ok(!atWolf.includes("shot:2"), "never a slaying arrow at a creature it does nothing more to");
    assert.ok(modesAt("wyrm", "dragon").includes("shot:2"), "at its own kind it is weighed");
  }

  // ── Refused ──
  refused(
    document((_rider, doc) => delete doc.catalogs.at(-1).entries[1].item.tags),
    /ammoRider: Ammunition is drawn by its tag, so an item with an ammoRider has one/,
  );
  refused(
    document((rider) => (rider.plus[0].when = "toggled")),
    /ammoRider\.plus\.0\.when: Ammunition has no switch/,
  );
  refused(
    document((rider) => (rider.plus[0].targetIs = { types: ["giant"] })),
    /Unknown creature type "giant"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with ammunition that adds to the shot it is fired as (item ammoRider) requires schemaVersion 2 and capabilityApi 1.657 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(656) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(657) as never, document()), gate);
  }

  // ── A bonus to hit on the shot it rides (1.812: the real Arrow +1 added nothing to the roll) ──
  {
    const plusOne = document((rider) => {
      rider.toHit = 3;
    });
    const toHitGate =
      "A ruleset with ammunition that adds to the attack roll of its shot (an ammoRider's toHit) requires schemaVersion 2 and capabilityApi 1.812 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const hit = parsed(plusOne);
    const rolled = (mode?: string) =>
      eventsOf(shoot(fight([foe("wolf", "beast", 200)], hit), "wolf", mode, hit).events, "attack")[0]!.total;
    assert.equal(rolled("shot:2") - rolled(), 3, "the shot it rides is rolled 3 higher, a plain one not");
    assert.equal(getCapabilityPackageInstallIssue(manifest(811) as never, plusOne), toHitGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(812) as never, plusOne), toHitGate);
  }

  console.log(
    "Arrow of Slaying: ammunition's own 6d10 against its kind, shot as its own mode, spent into a plain arrow; gated at 1.657.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
