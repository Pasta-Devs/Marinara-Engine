/**
 * Tracks moved and sealed health given back (Capability API 1.201).
 *
 *   - `mechanics.tracks`: a cure takes levels off a live track (5e's Greater Restoration, one level
 *     of exhaustion), held to the track's floor; harm adds them on a failed save (Sickening
 *     Radiance), on a sheet and on a creature without one, held to the top; a level that halves
 *     the maximum holds health to it at once, and one that defeats slays; an immune creature
 *     gains none.
 *   - `mechanics.unseals`: the health only a rest would give back is given back.
 *   - A cure that only does these is offered only on whoever it would help.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-track-cures-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 196);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Greater Restoration: a level of exhaustion off, and the maximum whole again.
  const restoration = spell("restoration", "Restoration", {
    kind: "utility",
    targets: "ally",
    tracks: [{ track: "exhaustion", by: -1 }],
    unseals: true,
  });
  // Only the exhaustion, and only the maximum, each on its own.
  const rest = spell("rest", "Rest", { kind: "utility", targets: "ally", tracks: [{ track: "exhaustion", by: -2 }] });
  const mend = spell("mend", "Mend", { kind: "utility", targets: "ally", unseals: true });
  // Sickening Radiance, cast at somebody: a level on a failed Constitution save.
  const radiance = spell("radiance", "Radiance", {
    kind: "debuff",
    targets: "enemy",
    targetCount: 2,
    save: { save: "con_save", onSuccess: "negates" },
    tracks: [{ track: "exhaustion", by: 1 }],
  });
  const crush = spell("crush", "Crush", {
    kind: "debuff",
    targets: "any",
    autoHit: true,
    tracks: [{ track: "exhaustion", by: 3 }],
  });
  const spells = [restoration, rest, mend, radiance, crush];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.levels.push(
      { track: "exhaustion", at: 4, modifiers: [{ to: "health-max", times: 0.5 }] },
      { track: "exhaustion", at: 6, defeats: true },
    );
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
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
    ...extra,
  });
  let d20 = 5;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const brenna = (live: unknown): RulesetCombatantInput => ({
    id: "brenna",
    name: "Brenna",
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
    }),
    live,
    catalogs: {},
  });
  const fight = (
    brennaLive: unknown = {},
    enemies: Array<Record<string, unknown>> = [{ id: "a" }],
  ): RulesetEncounterState => {
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
        brenna(brennaLive),
        ...enemies.map(
          ({ id, ...extra }) =>
            ({ id, name: String(id).toUpperCase(), side: "enemy", block: block(), ...extra }) as RulesetCombatantInput,
        ),
      ],
    });
    state.order = ["mage", "brenna", ...enemies.map((one) => String(one.id))];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, label).id, targetIds },
      roll,
    );
    const refused = step.events.find((one) => one.type === "refused");
    assert.equal(refused, undefined, JSON.stringify(step.events));
    return step;
  };
  const sheetLive = (state: RulesetEncounterState, id: string) => {
    const sheet = rulesetCombatant(state, id)!.sheet!;
    return readRulesetLive(definition, sheet.build, sheet.live);
  };
  const exhaustion = (state: RulesetEncounterState, id: string) => {
    const combatant = rulesetCombatant(state, id)!;
    return combatant.sheet
      ? sheetLive(state, id).tracks.find((one) => one.id === "exhaustion")!.value
      : (combatant.tracks?.exhaustion ?? 0);
  };
  const health = (state: RulesetEncounterState, id: string) => {
    const { value, max } = rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!);
    return { value, max };
  };
  const moves = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) => (one.type === "track" ? [[one.targetId, one.from, one.to]] : []));

  // ── Greater Restoration: a level of exhaustion off, and the maximum whole again ──
  {
    const tired = fight({ tracks: { exhaustion: 4 }, pools: { hp: { value: 6, sealed: 5 } } });
    // At the fourth level, half of 20.
    assert.deepEqual(health(tired, "brenna"), { value: 6, max: 10 });
    const step = cast(tired, "Restoration", ["brenna"]);
    assert.equal(exhaustion(step.state, "brenna"), 3);
    assert.deepEqual(moves(step.events), [["brenna", 4, 3]]);
    const unsealed = step.events.find((one) => one.type === "unsealed");
    assert.ok(unsealed && unsealed.type === "unsealed" && unsealed.amount === 5 && unsealed.maxHealth === 20);
    assert.equal(sheetLive(step.state, "brenna").pools.find((one) => one.key === "hp")!.sealed, 0);
    assert.deepEqual(health(step.state, "brenna"), { value: 6, max: 20 });
    // Held to the floor: two off a single level leaves none, and says so once.
    const low = cast(fight({ tracks: { exhaustion: 1 } }), "Rest", ["brenna"]);
    assert.equal(exhaustion(low.state, "brenna"), 0);
    assert.deepEqual(moves(low.events), [["brenna", 1, 0]]);
    // A creature without a sheet, its levels on itself, and its sealed health too.
    const brute = fight({}, [{ id: "a", tracks: { exhaustion: 2 } }]);
    rulesetCombatant(brute, "a")!.side = "party";
    rulesetCombatant(brute, "a")!.health!.sealed = 7;
    const cured = cast(brute, "Restoration", ["a"]);
    assert.equal(exhaustion(cured.state, "a"), 1);
    assert.equal(rulesetCombatant(cured.state, "a")!.health!.sealed, undefined);
  }

  // ── Offered only on whoever it would help ──
  {
    const targets = (state: RulesetEncounterState, label: string) =>
      rulesetOptionTargets(definition, state, "mage", optionOf(state, label)).sort();
    assert.deepEqual(targets(fight(), "Restoration"), []);
    assert.deepEqual(targets(fight({ tracks: { exhaustion: 1 } }), "Restoration"), ["brenna"]);
    assert.deepEqual(targets(fight({ pools: { hp: { value: 10, sealed: 4 } } }), "Restoration"), ["brenna"]);
    assert.deepEqual(targets(fight({ pools: { hp: { value: 10, sealed: 4 } } }), "Rest"), []);
    assert.deepEqual(targets(fight({ tracks: { exhaustion: 1 } }), "Mend"), []);
  }

  // ── Sickening Radiance: a level on a failed save, none on a made one ──
  {
    d20 = 5;
    const failed = cast(fight({}, [{ id: "a" }, { id: "b", tracks: { exhaustion: 2 } }]), "Radiance", ["a", "b"]);
    assert.equal(exhaustion(failed.state, "a"), 1);
    assert.equal(exhaustion(failed.state, "b"), 3);
    assert.deepEqual(moves(failed.events), [
      ["a", 0, 1],
      ["b", 2, 3],
    ]);
    d20 = 20;
    const made = cast(fight(), "Radiance", ["a"]);
    assert.equal(exhaustion(made.state, "a"), 0);
    assert.deepEqual(moves(made.events), []);
    d20 = 5;
    // A creature immune to exhaustion gains none.
    const immune = cast(fight({}, [{ id: "a", block: block({ conditionImmunities: ["exhaustion"] }) }]), "Radiance", [
      "a",
    ]);
    assert.equal(exhaustion(immune.state, "a"), 0);
  }

  // ── Raised to the fourth level, health is held to the halved maximum; to the sixth, slain ──
  {
    const halved = cast(fight({ tracks: { exhaustion: 1 } }), "Crush", ["brenna"]);
    assert.equal(exhaustion(halved.state, "brenna"), 4);
    assert.deepEqual(health(halved.state, "brenna"), { value: 10, max: 10 });
    assert.equal(sheetLive(halved.state, "brenna").pools.find((one) => one.key === "hp")!.value, 10);
    // A brute at 40, its maximum halved to 20, holds 20.
    const brute = cast(fight({}, [{ id: "a", tracks: { exhaustion: 1 } }]), "Crush", ["a"]);
    assert.deepEqual(health(brute.state, "a"), { value: 20, max: 20 });
    // What it held is what it has: a level taken off again restores the maximum, not the 20 lost.
    rulesetCombatant(brute.state, "a")!.side = "party";
    rulesetCombatant(brute.state, "mage")!.budgets.action = 1;
    const eased = cast(brute.state, "Rest", ["a"]);
    assert.deepEqual(health(eased.state, "a"), { value: 20, max: 40 });
    // Held to the top, and the sixth level slays.
    const dead = cast(fight({}, [{ id: "a", tracks: { exhaustion: 4 } }]), "Crush", ["a"]);
    assert.equal(exhaustion(dead.state, "a"), 6);
    assert.ok(rulesetCombatant(dead.state, "a")!.defeated);
    assert.ok(dead.events.some((one) => one.type === "slain" && one.targetId === "a" && one.label === "Exhaustion"));
  }

  // ── Import refusals ──
  {
    const refused = (mechanics: Record<string, unknown>, pattern: RegExp, edit?: (doc: any) => void) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.at(-1).entries.push({ ...spell("x", "X", {}), mechanics });
          edit?.(doc);
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const base = { kind: "utility", targets: "ally" };
    refused({ ...base, tracks: [{ track: "exhaustion", by: 0 }] }, /A track is moved by at least one level/);
    refused({ ...base, tracks: [{ track: "exhaustion", by: 21 }] }, /tracks/);
    refused({ ...base, tracks: [] }, /tracks/);
    refused(
      {
        ...base,
        tracks: [
          { track: "exhaustion", by: 1 },
          { track: "exhaustion", by: -1 },
        ],
      },
      /A track is named once/,
    );
    refused({ ...base, tracks: [{ track: "weariness", by: -1 }] }, /Unknown track "weariness"/);
    refused({ ...base, unseals: false }, /unseals/);
    refused({ ...base, tracks: [{ track: "wounds", by: -1 }] }, /A wound track is marked, not moved by levels/, (doc) =>
      doc.sheet.live.tracks.push({
        id: "wounds",
        label: "Wounds",
        min: 0,
        max: 3,
        kinds: [{ id: "cut", label: "Cut", severity: 1 }],
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
      "A ruleset with entries that move live tracks by levels or give back sealed health, or broken wall sections with their own cost step, requires schemaVersion 2 and capabilityApi 1.201 or newer";
    const withCures = fiveE();
    assert.equal(getCapabilityPackageInstallIssue(manifest(200) as never, withCures), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(201) as never, withCures), gate);
    const without = JSON.parse(fiveEText);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(200) as never, without), gate);
    // A creature's own levels are no move.
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(200) as never, { ...without, extra: { tracks: { exhaustion: 2 } } }),
      gate,
    );
    for (const entry of [mend, rest]) {
      const files = new Map([["spells.json", { entries: [entry] }]]);
      assert.equal(getCapabilityPackageInstallIssue(manifest(200) as never, without, files as never), gate);
    }
    const ice = {
      zone: { sections: { every: 10, health: 30, defense: 12, broken: { perCostStep: { dice: "1d6" } } } },
    };
    const files = new Map([["walls.json", { entries: [{ mechanics: ice }] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(200) as never, without, files as never), gate);
  }

  console.log(
    "Ruleset track cures: Greater Restoration takes exhaustion off and unseals the maximum, Sickening Radiance adds it on a failed save, halving and slaying at once; gated at 1.201.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
