/**
 * Senses a target needs, and conditions that take them away (Capability API 1.127): Deafened.
 * Target menus, the director and resolution agree; nothing rolls against a target it cannot affect.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  rulesetItemUseSchema,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-senses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, syncRulesetCombatants, rulesetDirectorStage } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 122);
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
  const base = read("../../docs/development/ruleset-5e-2014.example.json");
  const spell = (id: string, needs?: string[], area = false) => ({
    id: id.toLowerCase(),
    label: id,
    rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      amount: { flat: 4 },
      damageType: "psychic",
      save: { save: "wis_save", onSuccess: "none" },
      applies: [{ condition: "prone", duration: { rounds: 1 } }],
      range: 60,
      ...(needs ? { needs } : {}),
      ...(area ? { area: { shape: "burst", size: 15 }, friendlyFire: false } : {}),
    },
  });
  const creature = (needs?: string[], area = false) => ({
    id: "harpy",
    label: "Harpy",
    creature: {
      tier: "cr_1",
      health: 80,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "song",
          name: "Luring Song",
          budget: "action",
          damage: { flat: 4, type: "psychic" },
          save: { save: "wis_save", difficulty: 14, onSuccess: "none" },
          applies: [{ condition: "prone", duration: { rounds: 1 } }],
          range: 60,
          ...(needs ? { needs } : {}),
          ...(area ? { area: { shape: "burst", size: 15, friendlyFire: false } } : {}),
        },
      ],
    },
  });
  const document = (needs: string[] | undefined = ["hearing"], area = false) => {
    const doc = structuredClone(base);
    doc.combat.conditions.push({ condition: "deafened", lacks: ["hearing"] });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [spell("Command", needs, area), spell("Bolt")],
    });
    doc.catalogs.push({ id: "singers", label: "Singers", holds: "creatures", entries: [creature(needs, area)] });
    return doc;
  };
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const definition = parsedOrThrow(document());
  const block: RulesetStatBlock = { health: 80, defense: 12, initiativeModifier: 0, speed: 30, actions: [] };
  const fight = (definition: RulesetDefinition, kind: "catalog" | "creature", board = false) => {
    const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries!;
    const singer = definition.catalogs!.find((catalog) => catalog.id === "singers")!.entries![0]!;
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 16, cha: 10 },
      fields: { level: 3, ac: 12, speed: 30, hp_max: 80 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        kind === "catalog"
          ? { id: "caster", name: "Caster", side: "party", build, live: {}, catalogs: { spells } }
          : { id: "caster", name: "Harpy", side: "enemy", block: rulesetCreatureBlock(definition, singer)! },
        { id: "deaf", name: "Deaf", side: "enemy", block },
        { id: "hears", name: "Hears", side: "enemy", block },
      ],
      ...(board
        ? {
            board: {
              grid: { width: 5, height: 1, tiles: [Array(5).fill("plains")] },
              placements: { caster: { x: 0, y: 0 }, deaf: { x: 2, y: 0 }, hears: { x: 3, y: 0 } },
            },
          }
        : {}),
    });
    // Stat blocks enter as opponents; the singer stands against the two targets in this proof.
    rulesetCombatant(state, "caster")!.side = "party";
    state.turn = state.order.indexOf("caster");
    rulesetCombatant(state, "deaf")!.tracked.push({ condition: "deafened", rounds: 1 });
    return state;
  };
  const optionOf = (definition: RulesetDefinition, state: RulesetEncounterState, kind: "catalog" | "creature") => {
    const option = rulesetCombatOptions(definition, state, "caster").find(
      (entry) => entry.label === (kind === "catalog" ? "Command" : "Luring Song"),
    );
    assert.ok(option, `${kind}: the action is offered`);
    return option;
  };

  for (const kind of ["catalog", "creature"] as const) {
    const state = fight(definition, kind);
    const option = optionOf(definition, state, kind);
    assert.deepEqual(rulesetCombatant(state, "caster")!.actions.find((entry) => entry.id === option.id)!.needs, [
      "hearing",
    ]);
    assert.deepEqual(rulesetOptionTargets(definition, state, "caster", option), ["hears"]);
    if (kind === "catalog") {
      const bolt = rulesetCombatOptions(definition, state, "caster").find((entry) => entry.label === "Bolt")!;
      assert.deepEqual(rulesetOptionTargets(definition, state, "caster", bolt), ["deaf", "hears"]);
      const ordinary = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "caster", optionId: bolt.id, targetIds: ["deaf"] },
        () => 1,
      );
      assert.ok(
        ordinary.events.some((entry) => entry.type === "damage" && entry.targetId === "deaf" && entry.dealt === 4),
        "an effect without needs still lands on Deafened",
      );
    }
    const refused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "caster", optionId: option.id, targetIds: ["deaf"] },
      () => assert.fail("an illegal target rolls no dice"),
    );
    assert.equal(refused.events[0]?.type, "refused");
    assert.deepEqual(refused.state, state);

    // Count the condition out through the ordinary turn lifecycle, then point the same action at it.
    let ended = applyRulesetCombatChoice(definition, state, {
      actorId: "caster",
      optionId: "end-turn",
      targetIds: [],
    }).state;
    for (let turn = 0; rulesetCombatant(ended, "deaf")!.tracked.length && turn < 4; turn++) {
      ended = applyRulesetCombatChoice(definition, ended, {
        actorId: ended.order[ended.turn]!,
        optionId: "end-turn",
        targetIds: [],
      }).state;
    }
    assert.equal(rulesetCombatant(ended, "deaf")!.tracked.length, 0, "Deafened has ended");
    assert.deepEqual(rulesetOptionTargets(definition, ended, "caster", option), ["deaf", "hears"]);

    {
      const many = parsedOrThrow(document(["hearing"], true));
      const encounter = fight(many, kind, true);
      const action = optionOf(many, encounter, kind);
      let saves = 0;
      const result = applyRulesetCombatChoice(
        many,
        encounter,
        {
          actorId: "caster",
          optionId: action.id,
          targetIds: [],
          at: { x: 2, y: 0 },
        },
        (sides) => {
          assert.equal(sides, 20);
          saves++;
          return 1;
        },
      );
      assert.equal(saves, 1, `${kind}: only the hearing target rolls`);
      assert.deepEqual(
        result.events.filter((entry) => entry.type === "save").map((entry) => entry.actorId),
        ["hears"],
      );
      assert.deepEqual(
        result.events.filter((entry) => entry.type === "damage").map((entry) => [entry.targetId, entry.dealt]),
        [["hears", 4]],
      );
      assert.equal(rulesetCombatant(result.state, "deaf")!.health!.value, 80);
      assert.deepEqual(rulesetCombatant(result.state, "deaf")!.tracked, [{ condition: "deafened", rounds: 1 }]);
      assert.ok(rulesetCombatant(result.state, "hears")!.tracked.some((entry) => entry.condition === "prone"));
      rulesetCombatant(encounter, "hears")!.tracked.push({ condition: "deafened", rounds: null });
      const nobody = applyRulesetCombatChoice(
        many,
        encounter,
        { actorId: "caster", optionId: action.id, targetIds: [], at: { x: 2, y: 0 } },
        () => assert.fail("an area without a hearing target rolls nothing"),
      );
      assert.ok(!nobody.events.some((entry) => ["refused", "save", "damage", "condition"].includes(entry.type)));
      assert.equal(rulesetCombatant(nobody.state, "hears")!.health!.value, 80);
    }
  }

  // A multi-target sequence picks both while legal, then deafens one before its hearing effect.
  {
    const doc = document();
    const actions = doc.catalogs.at(-1).entries[0].creature.actions;
    actions[0].targetCount = 2;
    actions.push({
      id: "deafen",
      name: "Deafen",
      budget: "action",
      autoHit: true,
      applies: [{ condition: "deafened", duration: { rounds: 1 } }],
    });
    actions.push({
      id: "both",
      name: "Both",
      budget: "action",
      sequence: [
        { action: "deafen", times: 1 },
        { action: "song", times: 1 },
      ],
    });
    const def = parsedOrThrow(doc);
    const state = fight(def, "creature");
    rulesetCombatant(state, "deaf")!.tracked = [];
    const option = rulesetCombatOptions(def, state, "caster").find((entry) => entry.label === "Both")!;
    assert.deepEqual(rulesetOptionTargets(def, state, "caster", option), ["deaf", "hears"]);
    let saves = 0;
    const result = applyRulesetCombatChoice(
      def,
      state,
      { actorId: "caster", optionId: option.id, targetIds: ["deaf", "hears"] },
      () => {
        saves++;
        return 1;
      },
    );
    assert.equal(saves, 1, "the multi-target hearing effect rolls only for the one still hearing");
    assert.deepEqual(
      result.events.filter((entry) => entry.type === "damage").map((entry) => [entry.targetId, entry.dealt]),
      [["hears", 4]],
    );
    assert.equal(rulesetCombatant(result.state, "deaf")!.health!.value, 80);
    assert.deepEqual(
      rulesetCombatant(result.state, "deaf")!.tracked.map((entry) => entry.condition),
      ["deafened"],
    );
    assert.ok(rulesetCombatant(result.state, "hears")!.tracked.some((entry) => entry.condition === "prone"));
  }

  // An invented sense has the same meaning, and ANY missing need is enough to keep a target off.
  for (const needs of [["sight"], ["sight", "hearing"], ["hearing", "sight"], ["echo"]]) {
    const doc = document(needs);
    if (needs.includes("echo")) doc.combat.conditions.at(-1).lacks = ["echo"];
    const def = parsedOrThrow(doc);
    const state = fight(def, "catalog");
    assert.deepEqual(
      rulesetOptionTargets(def, state, "caster", optionOf(def, state, "catalog")),
      needs[0] === "sight" && needs.length === 1 ? ["deaf", "hears"] : ["hears"],
    );
  }

  // The director must attack a legal target even when the deafened one would be easier to finish.
  {
    const encounter = fight(definition, "catalog");
    rulesetCombatant(encounter, "caster")!.actions = rulesetCombatant(encounter, "caster")!.actions.filter(
      (entry) => entry.label === "Command",
    );
    rulesetCombatant(encounter, "deaf")!.health!.value = 1;
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 80,
      maxHp: 80,
      attack: 5,
      defense: 12,
      speed: 30,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("caster", "player")],
      enemies: [unit("deaf", "enemy"), unit("hears", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 1,
    } as never);
    state.rulesetFight = {
      encounter,
      eventSeq: 0,
      events: [],
      controllers: { caster: "ai" },
      bosses: [],
      adjustments: [],
    };
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const events = state.rulesetFight.events.map((entry) => entry.event);
    assert.ok(
      events.some((entry) => entry.type === "save" && entry.actorId === "hears"),
      "the director takes the hearing spell against a legal target",
    );
    assert.ok(
      !events.some((entry) => "targetId" in entry && entry.targetId === "deaf"),
      "the director never picks the deafened target",
    );
  }

  // Old saved fights with neither key retain the same targets, dice and results after a JSON reload.
  {
    const doc = document();
    delete doc.combat.conditions.at(-1).lacks;
    delete doc.catalogs.at(-2).entries[0].mechanics.needs;
    delete doc.catalogs.at(-1).entries[0].creature.actions[0].needs;
    const legacy = parsedOrThrow(doc);
    const state = fight(legacy, "catalog");
    const loaded = JSON.parse(JSON.stringify(state));
    const option = optionOf(legacy, loaded, "catalog");
    assert.deepEqual(rulesetOptionTargets(legacy, loaded, "caster", option), ["deaf", "hears"]);
    const use = (state: RulesetEncounterState) =>
      applyRulesetCombatChoice(legacy, state, { actorId: "caster", optionId: option.id, targetIds: ["deaf"] }, () => 1);
    assert.deepEqual(use(loaded), use(state));
    assert.ok(
      use(loaded).events.some((entry) => entry.type === "damage" && entry.targetId === "deaf" && entry.dealt === 4),
    );
  }

  // Each key refuses empty, oversized, duplicate and malformed ids, but accepts four unique words.
  for (const kind of ["condition", "catalog", "creature"] as const) {
    for (const senses of [
      [],
      ["hearing", "hearing"],
      ["a", "b", "c", "d", "e"],
      ["has spaces"],
      [1],
      "hearing",
      [""],
      ["sight", "hearing", "echo", "smell"],
    ]) {
      const doc = document();
      const object =
        kind === "condition"
          ? doc.combat.conditions.at(-1)
          : kind === "catalog"
            ? doc.catalogs.at(-2).entries[0].mechanics
            : doc.catalogs.at(-1).entries[0].creature.actions[0];
      object[kind === "condition" ? "lacks" : "needs"] = senses;
      const parsed = parseRulesetDefinition(doc);
      assert.equal(parsed.ok, Array.isArray(senses) && senses.length === 4, `${kind}: ${JSON.stringify(senses)}`);
      if (!parsed.ok) assert.match(parsed.issues.join("; "), kind === "condition" ? /lacks/ : /needs/);
    }
  }
  const schema = read("../../docs/extending/ruleset.schema.json");
  const found = { needs: 0, lacks: 0 };
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    const properties = node.properties;
    if (properties?.kind && properties.rider && properties.free)
      assert.ok(properties.needs, "entry mechanics carries needs");
    if (properties?.id && properties.name && properties.budget && properties.autoHit)
      assert.ok(properties.needs, "creature actions carry needs");
    if (properties?.condition && properties.effects) assert.ok(properties.lacks, "combat conditions carry lacks");
    for (const key of ["needs", "lacks"] as const) {
      const shape = properties?.[key];
      if (!shape) continue;
      // Not a sense (1.617): the conditions whose lack in its applier ends a condition.
      if (key === "lacks" && properties.holderLacks) continue;
      // Not a sense either (1.667): what an item asks of whoever binds it, read off their sheet.
      if (key === "needs" && properties.needsWorn) continue;
      // Nor (1.700, 1.701): what an item's wearer is, for its statsIf and touchHarms lines.
      const wearer = ["$comment", "needs", "needsAny", "add", "dice", "flat", "type"];
      if (key === "needs" && Object.keys(properties).every((one) => wearer.includes(one))) continue;
      // Nor (1.802): what a fake's tell asks of the sheet of whoever may notice it.
      if (key === "needs" && properties.says && properties.dc) continue;
      found[key]++;
      assert.equal(shape.minItems, 1);
      assert.equal(shape.maxItems, 4);
      assert.equal(shape.uniqueItems, true);
      assert.equal(shape.items.type, "string");
      assert.ok(shape.items.pattern);
    }
    Object.values(node).forEach(walk);
  };
  walk(schema);
  assert.deepEqual(
    found,
    // An item's use, and each further use, carries them too since 1.628.
    { needs: 7, lacks: 1 },
    "the published schema carries the entry, creature action, aura, condition and item use keys",
  );
  assert.equal(
    rulesetItemUseSchema.safeParse({ kind: "attack", amount: { flat: 4 }, needs: ["hearing"] }).success,
    true,
    "item uses may need senses (1.628)",
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-senses",
    name: "Senses",
    version: "0.1.0",
    description: "A ruleset whose effects need hearing.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/senses.json"] } },
    files: ["ruleset.json", "catalogs/senses.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose effects need a sense a condition can take away requires schemaVersion 2 and capabilityApi 1.127 or newer";
  for (const kind of ["condition", "catalog", "creature", "legacy"] as const) {
    for (const file of [false, true]) {
      const doc = document();
      if (kind !== "condition") delete doc.combat.conditions.at(-1).lacks;
      if (kind !== "catalog") delete doc.catalogs.at(-2).entries[0].mechanics.needs;
      if (kind !== "creature") delete doc.catalogs.at(-1).entries[0].creature.actions[0].needs;
      const documents = new Map<string, unknown>();
      if (file && (kind === "catalog" || kind === "creature")) {
        const catalog = doc.catalogs.at(kind === "catalog" ? -2 : -1);
        documents.set("catalogs/senses.json", { entries: catalog.entries });
        delete catalog.entries;
        catalog.asset = "catalogs/senses.json";
      }
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(126) as any, doc, documents),
        kind === "legacy" ? null : gate,
        `${kind}, file ${file}: previous minor`,
      );
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(127) as any, doc, documents),
        null,
        `${kind}, file ${file}: current minor`,
      );
      if (kind !== "legacy")
        assert.match(
          getCapabilityPackageInstallIssue({ ...manifest(127), schemaVersion: 1 } as any, doc, documents) ?? "",
          /requires schemaVersion 2/,
        );
    }
  }
  console.info(
    "Senses: Deafened removes hearing targets, areas skip them without saves or damage, and the install gate requires 1.127.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
