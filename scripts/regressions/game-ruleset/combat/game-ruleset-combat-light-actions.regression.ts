/**
 * Lights switched in a fight (Capability API 1.296).
 *
 *   - A creature action that `sheds` a light, or `"out"`, and nothing else: the magmin's Ignited
 *     Illumination, a will-o'-wisp's Variable Illumination. A creature `unlit` begins with its light
 *     out.
 *   - An item's `toggle.offLight`: what it sheds while switched off, a hooded lantern's hood down.
 *   - Import refusals and the install gate.
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
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetLightAt,
  rulesetLightOf,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-light-actions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 291);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { dice: "1d4" }, reach: 5 };
  const creature = (id: string, extra: Record<string, unknown>, actions: unknown[] = []) => ({
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1_2",
      actions: [claw, ...actions],
      ...extra,
    },
  });
  const magmin = creature("magmin", { light: { bright: 10, dim: 10 }, unlit: true }, [
    { id: "ignite", name: "Ignite", budget: "bonus", sheds: { bright: 10, dim: 10 } },
    { id: "douse", name: "Extinguish", budget: "bonus", sheds: "out" },
  ]);
  const wisp = creature("wisp", { light: { bright: 20, dim: 20 } }, [
    { id: "small", name: "Glow 5", budget: "bonus", sheds: { bright: 5, dim: 5 } },
    { id: "out", name: "Dark", budget: "bonus", sheds: "out" },
  ]);
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(magmin, wisp);
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
  const blockOf = (id: string): RulesetStatBlock =>
    rulesetCreatureBlock(
      definition,
      entries.find((entry) => entry.id === id),
    )!;
  const hero = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  const fight = (beast: string, items?: RulesetSheetItem[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: {}, ...(items ? { items } : {}) },
        { id: beast, name: beast, side: "enemy", block: blockOf(beast) },
      ],
      board: {
        grid: {
          width: 24,
          height: 10,
          tiles: Array.from({ length: 10 }, () => Array.from({ length: 24 }, () => "plains")),
        } as never,
        placements: { hero: { x: 2, y: 5 }, [beast]: { x: 14, y: 5 } },
        light: "dark",
      },
    });
    state.order = ["hero", beast];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionFor = (state: RulesetEncounterState, id: string, label: string) => {
    state.turn = state.order.indexOf(id);
    return rulesetCombatOptions(definition, state, id).find((option) => option.label === label);
  };
  const use = (state: RulesetEncounterState, id: string, label: string): RulesetCombatStep => {
    const option = optionFor(state, id, label);
    assert.ok(option, `${label} on the menu`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: id, optionId: option.id, targetIds: [] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const sees = (state: RulesetEncounterState, a: string, b: string) =>
    rulesetCanSee(definition, state, who(state, a), who(state, b));

  // ── Read off the bestiary ──
  assert.equal(blockOf("magmin").unlit, true);
  assert.deepEqual(blockOf("magmin").actions.find((action) => action.name === "Ignite")?.sheds, {
    bright: 10,
    dim: 10,
  });

  // ── The magmin: unlit, ablaze, put out ──
  {
    const state = fight("magmin");
    assert.equal(rulesetLightOf(definition, who(state, "magmin"), state), null, "unlit as it begins");
    assert.equal(sees(state, "hero", "magmin"), false);
    const ablaze = use(state, "magmin", "Ignite");
    const event = ablaze.events.find((one) => one.type === "switch");
    assert.ok(event?.type === "switch" && event.on === true && event.label === "Ignite", JSON.stringify(ablaze.events));
    assert.deepEqual(rulesetLightOf(definition, who(ablaze.state, "magmin"), ablaze.state), { bright: 2, dim: 2 });
    assert.equal(sees(ablaze.state, "hero", "magmin"), true, "seen by its own flames");
    assert.equal(who(ablaze.state, "magmin").budgets.bonus, 0, "on its bonus action");
    assert.equal(who(ablaze.state, "magmin").budgets.action, 1);
    who(ablaze.state, "magmin").budgets.bonus = 1;
    const out = use(ablaze.state, "magmin", "Extinguish");
    assert.ok(out.events.some((one) => one.type === "switch" && one.on === false));
    assert.equal(rulesetLightOf(definition, who(out.state, "magmin"), out.state), null);
    assert.equal(sees(out.state, "hero", "magmin"), false);
  }

  // ── The will-o'-wisp: lit as it begins, smaller, out ──
  {
    const state = fight("wisp");
    assert.deepEqual(rulesetLightOf(definition, who(state, "wisp"), state), { bright: 4, dim: 4 });
    const small = use(state, "wisp", "Glow 5");
    assert.deepEqual(rulesetLightOf(definition, who(small.state, "wisp"), small.state), { bright: 1, dim: 1 });
    who(small.state, "wisp").budgets.bonus = 1;
    const dark = use(small.state, "wisp", "Dark");
    assert.equal(rulesetLightOf(definition, who(dark.state, "wisp"), dark.state), null);
  }

  // ── A hooded lantern: dim light 5 feet with its hood down ──
  {
    const lantern = {
      name: "Hooded lantern",
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        toggle: { label: "Raise the hood", budget: "action", offLight: { bright: 0, dim: 5 } },
        worn: { light: { bright: 30, dim: 30 } },
      },
    } as RulesetSheetItem;
    const state = fight("wisp", [lantern]);
    assert.deepEqual(rulesetLightOf(definition, who(state, "hero"), state), { bright: 0, dim: 1 }, "hood down");
    assert.equal(rulesetLightAt(definition, state, { x: 2, y: 5 }), "dim", "no bright light, even where it is held");
    assert.equal(rulesetLightAt(definition, state, { x: 3, y: 5 }), "dim");
    assert.equal(rulesetLightAt(definition, state, { x: 4, y: 5 }), "dark");
    state.turn = 0;
    const raised = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "switch:0", targetIds: [] },
      () => 10,
    );
    assert.deepEqual(rulesetLightOf(definition, who(raised.state, "hero"), raised.state), { bright: 6, dim: 6 });
    // Parsed from a catalog, too.
    parsed(
      fiveE((doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "lantern", label: "Lantern", item: lantern.item }],
        });
      }),
    );
  }

  // ── Refusals ──
  {
    const withBeast = (beast: unknown, edit: (doc: Record<string, any>) => void = () => {}) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(beast);
        edit(doc);
      });
    refusedDoc(
      withBeast(
        creature("odd", {}, [
          { id: "both", name: "Both", budget: "bonus", sheds: "out", toHit: 4, damage: { dice: "1d4" } },
        ]),
      ),
      /Lighting or putting out its light is all it does, so it carries no damage, toHit/,
    );
    refusedDoc(
      withBeast(creature("odd", { unlit: true }, [{ id: "out", name: "Out", budget: "bonus", sheds: "out" }])),
      /needs an action that lights it/,
    );
    refusedDoc(
      withBeast(
        creature("odd", {}, [{ id: "lit", name: "Lit", budget: "bonus", sheds: { bright: 5, dim: 5 } }]),
        (doc) => {
          delete doc.combat.sight;
          doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries = doc.catalogs
            .find((catalog: { id: string }) => catalog.id === "creatures")
            .entries.filter((entry: { id: string }) => entry.id === "odd");
        },
      ),
      /Light is read where combat.sight.darkness makes the dark real/,
    );
  }

  // ── The gate ──
  {
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
    const gate =
      "A ruleset with creatures that light or put out their own light, or items that shed light while switched off, requires schemaVersion 2 and capabilityApi 1.296 or newer";
    for (const thing of [
      creature("a", {}, [{ id: "x", name: "X", budget: "bonus", sheds: "out" }]),
      creature("b", { unlit: true }, []),
      {
        id: "c",
        label: "C",
        item: { category: "gear", toggle: { label: "T", budget: "action", offLight: { bright: 0, dim: 5 } } },
      },
    ]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(thing);
      assert.equal(getCapabilityPackageInstallIssue(manifest(295) as never, doc), gate, thing.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(296) as never, doc), gate, thing.id);
    }
  }

  console.log(
    "Light actions: a magmin unlit, set ablaze and put out with its bonus action, a will-o'-wisp's light made smaller and put out, a hooded lantern's dim light with its hood down; refusals; gated at 1.296.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
