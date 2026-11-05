/**
 * What a layered wall's layers stop, and whom it spares as picked (Capability API 1.492).
 *
 *   - A layer's `blocks`: while it stands, attacks from afar that are not magical (red), those that
 *     are (orange), and spells cast across the wall (indigo) do not pass; each lifts as its layer falls.
 *     The wall here is opaque by `obscures`, so what it lets through is aimed at unseen.
 *   - `spares: { chosen }`: its caster and those picked as it is cast cross it and stand near it
 *     unharmed; nobody else does.
 *   - Refusals and the install gate.
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
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-layer-blocks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 492);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const layers = {
    spares: { chosen: 1 },
    rows: [
      { id: "red", label: "Red", damageType: "fire", blocks: ["ranged-nonmagical"] },
      { id: "orange", label: "Orange", damageType: "acid", blocks: ["ranged-magical"] },
      { id: "indigo", label: "Indigo", applies: ["restrained"], save: "con_save", blocks: ["spells"] },
    ],
    flash: {
      within: 20,
      save: "con_save",
      applies: [{ condition: "blinded", duration: { rounds: 10 } }],
      triggers: ["appears"],
    },
  };
  const prism = spell("prism", {
    kind: "attack",
    autoHit: true,
    area: { shape: "wall", size: 20 },
    range: 60,
    amount: { flat: 10 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
    applies: [{ condition: "restrained", duration: { rounds: 10 } }],
    zone: { rounds: 100, triggers: ["enter"], atCast: false, obscures: {}, layers },
  });
  const frost = spell("frost", {
    kind: "attack",
    autoHit: true,
    area: { shape: "burst", size: 5 },
    range: 120,
    amount: { flat: 5 },
    damageType: "cold",
    save: { save: "dex_save", onSuccess: "half" },
  });
  const spells = [prism, frost];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
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
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  // An archer with a plain bow and a magic one.
  const archer = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "bow", name: "Bow", budget: "action", toHit: 4, damage: { flat: 3 }, range: { normal: 120 } },
        {
          id: "wand",
          name: "Wand",
          budget: "action",
          toHit: 4,
          damage: { flat: 3 },
          range: { normal: 120 },
          qualities: ["magical"],
        },
      ],
    }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 10 : 1);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "druid", name: "Druid", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "a", name: "A", side: "enemy", block: archer() },
      ],
      board: {
        grid: { width: 20, height: 15, tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, druid: { x: 3, y: 9 }, a: { x: 8, y: 7 } },
      },
    });
    state.order = ["mage", "druid", "a"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    return option;
  };
  const choose = (state: RulesetEncounterState, actorId: string, label: string, extra: Record<string, unknown>) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: optionOf(state, actorId, label).id, targetIds: [], ...extra },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: RulesetCombatCell) => {
    state.turn = state.order.indexOf(actorId);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const struck = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) => (one.type === "zone" && one.outcome === "struck" ? [one.targetId] : []));
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.some((one) => one.condition === condition);
  const wall = (state: RulesetEncounterState) => who(state, "mage").zones?.find((one) => one.label === "Prism");
  const walled = (designates?: string[]): RulesetCombatStep => {
    const step = choose(fight(), "mage", "Prism", { at: { x: 5, y: 7 }, ...(designates ? { designates } : {}) });
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const gone = (state: RulesetEncounterState, count: number) => {
    wall(state)!.layersGone = count;
    for (const one of state.combatants) one.tracked = one.tracked.filter((entry) => entry.condition !== "blinded");
    return state;
  };
  const aimable = (state: RulesetEncounterState, label: string) => {
    const option = optionOf(state, "a", label);
    return rulesetOptionTargets(definition, state, "a", option).includes("mage");
  };

  // ── Whom it spares: offered as it is cast, its caster and those picked; the rest are not ──
  {
    const option = optionOf(fight(), "mage", "Prism");
    assert.deepEqual(option.designates, { count: 1, ids: ["druid", "a"] });
    const plain = walled();
    assert.equal(holds(plain.state, "druid", "blinded"), true, "the druid, not picked, is flashed");
    assert.equal(holds(plain.state, "mage", "blinded"), false, "its caster never is");
    const picked = walled(["druid"]);
    assert.equal(holds(picked.state, "druid", "blinded"), false, "picked, spared");
    assert.deepEqual(wall(picked.state)!.spared, ["druid"]);
    assert.deepEqual(struck(walk(gone(picked.state, 0), "druid", { x: 5, y: 8 }).events), [], "crossed unharmed");
    assert.ok(struck(walk(gone(walled().state, 0), "druid", { x: 5, y: 8 }).events).includes("druid"));
    // More than it spares, or somebody it does not offer, is refused.
    assert.ok(refused(choose(fight(), "mage", "Prism", { at: { x: 5, y: 7 }, designates: ["druid", "a"] })));
    assert.ok(refused(choose(fight(), "mage", "Prism", { at: { x: 5, y: 7 }, designates: ["nobody"] })));
  }

  // ── What its layers stop: the red the bow, the orange the wand, the indigo spells ──
  {
    const state = () => gone(walled(["druid"]).state, 0);
    assert.equal(aimable(state(), "Bow"), false, "red stops a plain shot");
    assert.equal(aimable(state(), "Wand"), false, "orange stops a magic one");
    assert.equal(aimable(gone(state(), 1), "Bow"), true, "red gone: the bow shoots through, unseen");
    assert.equal(aimable(gone(state(), 1), "Wand"), false, "but orange stands");
    assert.equal(aimable(gone(state(), 2), "Wand"), true, "orange gone");
    const across = (count: number) =>
      choose(gone(state(), count), "druid", "Frost", { at: { x: 9, y: 7 } }).events.find(
        (one) => one.type === "refused",
      );
    assert.ok(across(2), "indigo stops a spell cast across it");
    assert.equal(across(3), undefined, "indigo gone");
    assert.equal(
      choose(gone(state(), 0), "druid", "Frost", { at: { x: 3, y: 5 } }).events.find((one) => one.type === "refused"),
      undefined,
      "this side of it, a spell is cast as ever",
    );
  }

  // ── Refusals ──
  refusedDoc(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.zone.layers.rows[0].blocks = ["melee"];
    }),
    /blocks/,
  );
  refusedDoc(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.zone.layers.spares = { chosen: 0 };
    }),
    /spares/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose layered walls stop what passes through a layer (layer blocks) or spare those picked as they are cast (spares chosen) requires schemaVersion 2 and capabilityApi 1.492 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(491) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(492) as never, fiveE()), gate);
  }

  console.log(
    "Layer blocks: a Prismatic Wall's red stops plain shots, its orange magic ones, its indigo spells, each lifting as it falls; it spares its caster and those picked as it is cast; gated at 1.492.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
