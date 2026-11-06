/**
 * Healing an amend adds (Capability API 1.421).
 *
 *   - Disciple of Life: every creature a spell of 1st level or higher heals regains 2 + its level more;
 *     a cantrip's healing is not changed.
 *   - Blessed Healer: its caster regains 2 + the level, once a cast, when it heals somebody else;
 *     not when it heals only them.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-heal-amends-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 421);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>, level = 1) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      damageType: "fire",
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
      ...mechanics,
    },
  });
  const burst = {
    range: 60,
    area: { shape: "burst", size: 5 },
    amount: { dice: "2d6" },
    save: { save: "dex_save", onSuccess: "half" },
  };
  const spells = [
    spell("mend", "Mend", { kind: "heal", targets: "ally", range: 60, amount: { dice: "1d8", flat: 3 } }),
    spell("soothe", "Soothe", { kind: "heal", targets: "ally", range: 60, amount: { dice: "1d4" } }, 0),
    spell("prayer", "Prayer", {
      kind: "heal",
      targets: "ally",
      targetCount: 2,
      range: 60,
      amount: { dice: "1d8" },
    }),
  ] as unknown as RulesetCatalogEntry[];
  const life = { add: { const: 2 }, perLevel: 1, fromLevel: 1 };
  const wizard = [
    {
      id: "disciple",
      label: "Disciple of Life",
      rows: [{ list: "features", values: { name: "Disciple of Life" } }],
      mechanics: { kind: "utility", amends: [{ catalogs: ["spells"], healAdd: life }] },
    },
    {
      id: "blessed",
      label: "Blessed Healer",
      rows: [{ list: "features", values: { name: "Blessed Healer" } }],
      mechanics: { kind: "utility", amends: [{ catalogs: ["spells"], healsSelf: life }] },
    },
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "warded", label: "Warded" });
    doc.combat.conditions.push({ condition: "warded", effects: ["resist-all"] });
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "wizard", label: "Wizard", feeds: ["features", "counters"], entries: structuredClone(wizard) },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const rows = (catalog: string, entries: RulesetCatalogEntry[], list: string) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry(catalog, entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const sheet = (features: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: {
        level: 14,
        ac: 12,
        speed: 30,
        hp_max: 90,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_2: 3,
      },
      lists: {
        spells: rows("spells", spells, "spells"),
        features: rows("wizard", features, "features"),
        counters: rows("wizard", features, "counters"),
      },
    });
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")),
  });
  // Saves fail on 1; every d12 is a 5, every d8 and d6 and d10 a 1.
  const roll = (sides: number) => (sides === 20 ? 1 : sides === 12 ? 5 : 1);
  const fight = (features = wizard): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "wiz",
          name: "Wizard",
          side: "party",
          build: sheet(features),
          live: {},
          catalogs: { spells, wizard: features },
        },
        { id: "ally", name: "Ally", side: "party", block: block() },
        { id: "a", name: "A", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { wiz: { x: 2, y: 7 }, ally: { x: 4, y: 7 }, a: { x: 12, y: 7 } } },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const cast = (
    state: RulesetEncounterState,
    label: string,
    choice: Partial<RulesetCombatChoice> = {},
    alters: string[] = [],
  ) => {
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "wiz").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "wiz",
        optionId: option.id,
        targetIds: [],
        ...choice,
        ...(alters.length
          ? { alters: alters.map((one) => who(state, "wiz").actions.find((action) => action.label === one)!.id) }
          : {}),
      },
      roll,
    );
  };
  const ok = (step: ReturnType<typeof cast>) => {
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const refusedWith = (step: ReturnType<typeof cast>) => of(step.events, "refused").map((one) => one.reason);
  const dealtTo = (step: ReturnType<typeof cast>, id: string) =>
    of(step.events, "damage")
      .filter((one) => one.targetId === id)
      .map((one) => one.dealt);
  const at = { x: 12, y: 7 };

  void refusedWith;
  void dealtTo;
  void grid;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const hurt = (state: RulesetEncounterState) => {
    who(state, "ally").health!.value = 50;
    who(state, "wiz").sheet!.live = { ...who(state, "wiz").sheet!.live, pools: { hp: { value: 40 } } } as never;
    return state;
  };
  const disciple = [wizard[0]!];
  const blessed = [wizard[1]!];

  // ── Disciple of Life: 1d8 + 3 at 1 + 3, and 2 + the level more ──
  {
    assert.equal(health(ok(cast(hurt(fight([])), "Mend", { targetIds: ["ally"] })).state, "ally"), 54, "1 + 3");
    assert.equal(
      health(ok(cast(hurt(fight(disciple)), "Mend", { targetIds: ["ally"] })).state, "ally"),
      54 + 3,
      "2 + 1st level",
    );
    assert.equal(
      health(ok(cast(hurt(fight(disciple)), "Mend", { targetIds: ["ally"], payWith: "slots_2" })).state, "ally"),
      54 + 4,
      "2 + 2nd level",
    );
    const both = ok(cast(hurt(fight(disciple)), "Prayer", { targetIds: ["ally", "wiz"] }));
    assert.equal(health(both.state, "ally"), 50 + 1 + 3, "every creature it heals");
    assert.equal(health(both.state, "wiz"), 40 + 1 + 3);
    assert.equal(
      health(ok(cast(hurt(fight(disciple)), "Soothe", { targetIds: ["ally"] })).state, "ally"),
      51,
      "not a cantrip",
    );
  }

  // ── Blessed Healer: its caster's own 2 + the level, once, when it heals somebody else ──
  {
    const other = ok(cast(hurt(fight(blessed)), "Mend", { targetIds: ["ally"] }));
    assert.equal(health(other.state, "ally"), 54);
    assert.equal(health(other.state, "wiz"), 43, JSON.stringify(of(other.events, "heal")));
    const self = ok(cast(hurt(fight(blessed)), "Mend", { targetIds: ["wiz"] }));
    assert.equal(health(self.state, "wiz"), 44, "only its own 1 + 3, healing only them");
    const both = ok(cast(hurt(fight(blessed)), "Prayer", { targetIds: ["ally", "wiz"] }));
    assert.equal(health(both.state, "wiz"), 40 + 1 + 3, "once a cast");
    assert.equal(
      health(ok(cast(hurt(fight(blessed)), "Soothe", { targetIds: ["ally"] })).state, "wiz"),
      40,
      "not a cantrip",
    );
  }

  // ── Refusals ──
  {
    const amending = (amend: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.amends = [{ catalogs: ["spells"], ...amend }];
      });
    refused(amending({ healAdd: {} }), /Healing an amend adds is an "add", a "perLevel" or both/);
    refused(amending({ healsSelf: { add: { derived: "nothing_here" } } }), /nothing_here/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries amend the healing of others (healAdd) or heal their user as they heal somebody else (healsSelf) requires schemaVersion 2 and capabilityApi 1.421 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(420) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(421) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(420) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Heal amends: Disciple of Life adds 2 + the level to every creature a 1st-level or higher spell heals; Blessed Healer heals its caster 2 + the level once when it heals somebody else; gated at 1.421.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
