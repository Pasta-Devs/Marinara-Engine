/**
 * A cure that does one of its cures (Capability API 1.204).
 *
 *   - `mechanics.cureOneOf`: 5e's Greater Restoration ends a charm or a petrification, takes a level
 *     of exhaustion off, or gives the lowered maximum back: ONE of them. Each is a mode of the
 *     option; unpicked, the first the target has something for, in that order.
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cure-one-of-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 199);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cure = {
    kind: "utility",
    targets: "ally",
    ends: { conditions: ["charmed", "petrified"], count: 1 },
    tracks: [{ track: "exhaustion", by: -1 }],
    unseals: true,
  };
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const greater = spell("greater", "Greater", { ...cure, cureOneOf: true });
  const all = spell("all", "All", cure);
  const spells = [greater, all];
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
  const definition = parsed(fiveE());
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const brennaBuild = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
  });
  const fight = (live: Record<string, unknown>, charmed = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: brennaBuild,
          live,
          catalogs: {},
        } as RulesetCombatantInput,
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: { health: 10, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
    });
    if (charmed) rulesetCombatant(state, "brenna")!.tracked.push({ condition: "charmed", source: "a", rounds: null });
    state.order = ["mage", "brenna", "a"];
    state.turn = 0;
    return state;
  };
  const tired = { tracks: { exhaustion: 2 }, pools: { hp: { value: 10, sealed: 5 } } };
  const cast = (state: RulesetEncounterState, label: string, mode?: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["brenna"], ...(mode ? { mode } : {}) },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };
  const after = (state: RulesetEncounterState) => {
    const brenna = rulesetCombatant(state, "brenna")!;
    const live = readRulesetLive(definition, brenna.sheet!.build, brenna.sheet!.live);
    return {
      charmed: rulesetCombatConditions(definition, brenna).includes("charmed"),
      exhaustion: live.tracks.find((one) => one.id === "exhaustion")!.value,
      sealed: live.pools.find((one) => one.key === "hp")!.sealed,
    };
  };

  // ── Its cures are the option's modes ──
  {
    const option = rulesetCombatOptions(definition, fight(tired, true), "mage").find((one) => one.label === "Greater")!;
    assert.deepEqual(
      option.modes?.map((mode) => [mode.id, mode.label]),
      [
        ["ends-charmed", "Charmed"],
        ["ends-petrified", "Petrified"],
        ["track-exhaustion", "Exhaustion"],
        ["unseals", "Hit points"],
      ],
    );
  }

  // ── Unpicked: the first the target has something for ──
  {
    assert.deepEqual(after(cast(fight(tired, true), "Greater")), { charmed: false, exhaustion: 2, sealed: 5 });
    assert.deepEqual(after(cast(fight(tired), "Greater")), { charmed: false, exhaustion: 1, sealed: 5 });
    assert.deepEqual(after(cast(fight({ pools: { hp: { value: 10, sealed: 5 } } }), "Greater")), {
      charmed: false,
      exhaustion: 0,
      sealed: 0,
    });
  }

  // ── Picked: only that one ──
  {
    assert.deepEqual(after(cast(fight(tired, true), "Greater", "unseals")), {
      charmed: true,
      exhaustion: 2,
      sealed: 0,
    });
    assert.deepEqual(after(cast(fight(tired, true), "Greater", "track-exhaustion")), {
      charmed: true,
      exhaustion: 1,
      sealed: 5,
    });
    assert.deepEqual(after(cast(fight(tired, true), "Greater", "ends-charmed")), {
      charmed: false,
      exhaustion: 2,
      sealed: 5,
    });
    // Without it, all of them.
    assert.deepEqual(after(cast(fight(tired, true), "All")), { charmed: false, exhaustion: 1, sealed: 0 });
  }

  // ── Import refusals ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.catalogs.at(-1).entries.push(spell("x", "X", { kind: "utility", unseals: true, cureOneOf: true }));
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => /"cureOneOf" picks one of at least two cures/.test(issue)),
        result.issues.join("; "),
      );
    // Two conditions are two cures.
    parsed(
      fiveE((doc) => {
        doc.catalogs
          .at(-1)
          .entries.push(
            spell("y", "Y", { kind: "utility", ends: { conditions: ["charmed", "petrified"] }, cureOneOf: true }),
          );
      }),
    );
  }

  // ── The install gate ──
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
      "A ruleset with cures that do one of their cures requires schemaVersion 2 and capabilityApi 1.204 or newer";
    const without = JSON.parse(fiveEText);
    const withOne = fiveE((doc) => (doc.catalogs.at(-1).entries = [greater]));
    assert.equal(getCapabilityPackageInstallIssue(manifest(203) as never, withOne), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(204) as never, withOne), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(203) as never, without), gate);
    const files = new Map([["spells.json", { entries: [greater] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(203) as never, without, files as never), gate);
  }

  console.log(
    "Ruleset cure one of: Greater Restoration does one of its cures, picked as a mode or else the first the target needs; gated at 1.204.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
