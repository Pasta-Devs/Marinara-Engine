/**
 * Damage and healing at their most (Capability API 1.415).
 *
 *   - Overchannel: an alteration that maximizes a spell's damage, paid at 1st to 5th level only; its
 *     first use since its counter came back is free, each later one harms its user with 2d12 necrotic
 *     a level, 1d12 a level more each time, past resistance.
 *   - Supreme Healing: an amend that heals at the most.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-maximized-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 415);
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
    spell("burst", "Burst", burst),
    spell("storm", "Storm", burst, 6),
    spell("spark", "Spark", { range: 60, amount: { dice: "1d10" } }, 0),
    spell("mend", "Mend", { kind: "heal", targets: "ally", range: 60, amount: { dice: "1d8", flat: 3 } }),
  ] as unknown as RulesetCatalogEntry[];
  const wizard = [
    {
      id: "overchannel",
      label: "Overchannel",
      rows: [
        { list: "features", values: { name: "Overchannel" } },
        { list: "counters", values: { name: "Overchannel uses", max: 20, recharge: "long" } },
      ],
      mechanics: {
        kind: "utility",
        usesOf: "Overchannel uses",
        alters: {
          catalogs: ["spells"],
          maximizes: { fromLevel: 1, upToLevel: 5 },
          backlash: { free: 1, dice: "2d12", grows: "1d12", type: "necrotic", unblockable: true },
        },
      },
    },
    {
      id: "supreme",
      label: "Supreme Healing",
      rows: [{ list: "features", values: { name: "Supreme Healing" } }],
      mechanics: { kind: "utility", amends: [{ catalogs: ["spells"], maxHeal: true }] },
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
        slots_max_6: 1,
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

  // ── Overchannel: at its most, free once, then 2d12 a level and 1d12 a level more each time ──
  {
    const plain = ok(cast(fight(), "Burst", { at }));
    assert.deepEqual(dealtTo(plain, "a"), [2], "1 + 1");
    const first = ok(cast(fight(), "Burst", { at }, ["Overchannel"]));
    assert.deepEqual(dealtTo(first, "a"), [12], JSON.stringify(first.events));
    assert.deepEqual(dealtTo(first, "wiz"), [], "the first is free");
    const second = ok(cast(first.state, "Burst", { at }, ["Overchannel"]));
    assert.deepEqual(dealtTo(second, "a"), [12]);
    assert.deepEqual(dealtTo(second, "wiz"), [10], "2d12 at 1st level");
    const damage = of(second.events, "damage").find((one) => one.targetId === "wiz")!;
    assert.equal(damage.damageType, "necrotic");
    assert.equal(damage.label, "Overchannel");
    const third = ok(cast(second.state, "Burst", { at, payWith: "slots_2" }, ["Overchannel"]));
    assert.deepEqual(dealtTo(third, "wiz"), [30], "(2 + 1)d12 a level at 2nd level");
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(third.state, "wiz")).value, 50);
    // Past resistance: a wizard who resists everything takes it all the same.
    const warded = structuredClone(first.state);
    who(warded, "wiz").tracked.push({ condition: "warded", rounds: null } as never);
    assert.deepEqual(dealtTo(ok(cast(warded, "Burst", { at }, ["Overchannel"])), "wiz"), [10]);
    // 6th level, and a cantrip: not within 1st to 5th.
    assert.deepEqual(refusedWith(cast(fight(), "Storm", { at }, ["Overchannel"])), ["bad-alter"]);
    assert.deepEqual(refusedWith(cast(fight(), "Spark", { targetIds: ["a"] }, ["Overchannel"])), ["bad-alter"]);
  }

  // ── Supreme Healing ──
  {
    const hurt = (state: RulesetEncounterState) => {
      who(state, "ally").health!.value = 50;
      return state;
    };
    const healed = ok(cast(hurt(fight()), "Mend", { targetIds: ["ally"] }));
    assert.equal(who(healed.state, "ally").health!.value, 61, "8 + 3");
    const plain = ok(cast(hurt(fight([wizard[0]!])), "Mend", { targetIds: ["ally"] }));
    assert.equal(who(plain.state, "ally").health!.value, 54, "1 + 3");
  }

  // ── Refusals ──
  {
    const withOverchannel = (edit: (mechanics: Record<string, any>) => void) =>
      fiveE((doc) => edit(doc.catalogs.at(-1).entries[0].mechanics));
    refused(
      withOverchannel((mechanics) => {
        delete mechanics.usesOf;
      }),
      /"backlash" counts the uses of a counter/,
    );
    refused(
      withOverchannel((mechanics) => {
        mechanics.alters.maximizes = { fromLevel: 6, upToLevel: 5 };
      }),
      /"fromLevel" is above "upToLevel"/,
    );
    refused(
      withOverchannel((mechanics) => {
        mechanics.alters.backlash.type = "gloom";
      }),
      /Unknown damage type "gloom"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries maximize damage or healing (maximizes, maxHeal) or harm their user (backlash) requires schemaVersion 2 and capabilityApi 1.415 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(414) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(415) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(414) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Maximized: Overchannel's burst at its most, free once, then 2d12 a level and 1d12 a level more each time, 1st to 5th level only; Supreme Healing's 1d8 at 8; gated at 1.415.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
