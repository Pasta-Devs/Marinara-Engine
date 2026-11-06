/**
 * Calls that grow with the slot they are paid with (Capability API 1.537).
 *
 *   - `calls.perStep`: Animate Dead's two more undead for each slot level above 3rd.
 *   - `options[].fromStep` and their own `perStep`: Create Undead's ghasts only from a higher slot,
 *     refused below it; its ghouls one more a level.
 *   - `upTo.perStep`: Conjure Elemental's challenge rating rising by one a level, a creature above
 *     its base offered and called only when paid high enough.
 *   - `calls.hostileOnBreak` (1.538): Conjure Elemental's elemental, its concentration broken, stays
 *     and turns on its caller's side, no longer theirs to dismiss; its rounds still run.
 *   - The install gates.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stepped-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 538);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const wolf = {
    id: "dire-wolf",
    label: "Dire Wolf",
    filters: { challenge: "CR 1", kind: "Beast", places: ["Forest"] },
    creature: {
      health: 30,
      defense: 14,
      initiativeModifier: 0,
      speed: 50,
      tier: "cr_1",
      actions: [{ id: "maul", name: "Maul", budget: "action", toHit: 5, damage: { flat: 8 }, reach: 5 }],
    },
  };
  const conjure = (calls: Record<string, unknown>) => ({
    id: "conjure-animals",
    label: "Conjure Animals",
    rows: [{ list: "spells", values: { name: "Conjure Animals", level: 3, prepared: true } }],
    mechanics: { kind: "utility", targets: "self", budget: "action", concentration: true, calls },
  });
  const document = (entries: unknown[], edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(wolf));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    edit(doc);
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  let queued: number[] = [];
  const roll = (sides: number) => Math.min(sides, queued.shift() ?? 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const fight = (definition: RulesetDefinition, fields: Record<string, unknown> = {}) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, ...fields },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "smash",
                label: "Smash",
                kind: "attack",
                budget: "action",
                toHit: 30,
                damage: { flat: 30, type: "bludgeoning" },
              },
            ],
          },
        },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) },
        placements: { druid: { x: 3, y: 1 }, brute: { x: 4, y: 1 } },
      },
    });
    state.order = ["druid", "brute"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const slots = { level: 17, spellcasting_ability: "wis", slots_max_3: 3, slots_max_4: 3, slots_max_5: 2 };
  const costed = (calls: Record<string, unknown>, edit?: (doc: Record<string, any>) => void) => {
    const spell = conjure(calls);
    return parsed(
      document([{ ...spell, mechanics: { ...spell.mechanics, cost: [{ pool: "slots_3", amount: 1 }] } }], edit),
    );
  };
  const use = (definition: RulesetDefinition, payWith?: string, mode?: string) => {
    const state = fight(definition, slots);
    const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === "Conjure Animals")!;
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "druid",
        optionId: option.id,
        targetIds: [],
        ...(payWith ? { payWith } : {}),
        ...(mode ? { mode } : {}),
      } as RulesetCombatChoice,
      roll,
    );
    return { option, taken, called: of(taken.events, "called")[0]?.ids ?? [] };
  };

  // ── Animate Dead: two more for each slot level above 3rd ──
  {
    const animate = costed({ creature: "creatures/dire-wolf", count: { flat: 1 }, perStep: 2 });
    assert.equal(use(animate).called.length, 1, "its own 3rd-level slot");
    assert.equal(use(animate, "slots_4").called.length, 3);
    assert.equal(use(animate, "slots_5").called.length, 5);
  }

  // ── Create Undead: an option only from a higher slot, and one more a level ──
  {
    const create = costed({
      options: [
        { creature: "creatures/dire-wolf", count: { flat: 1 }, perStep: 1 },
        { creature: "creatures/cinder-hound", count: { flat: 2 }, fromStep: 2, perStep: 1, label: "Two hounds" },
      ],
    });
    assert.equal(use(create, "slots_5", "call-0").called.length, 3, "one, and one more for each of two levels");
    const low = use(create, "slots_4", "call-1");
    assert.deepEqual(
      of(low.taken.events, "refused").map((one) => one.reason),
      ["unknown-mode"],
      "a 4th-level slot is too low for the hounds",
    );
    assert.equal(low.called.length, 0);
    const high = use(create, "slots_5", "call-1");
    assert.equal(high.called.length, 2, "from its own step, no more yet");
    assert.deepEqual(who(high.taken.state, high.called[0]!).creature, {
      catalogId: "creatures",
      entryId: "cinder-hound",
    });
  }

  // ── Conjure Elemental: the challenge rating one higher for each slot level above ──
  {
    const elemental = costed(
      { from: { catalog: "creatures" }, upTo: { filter: "cr", at: 1, perStep: 1 }, count: { flat: 1 } },
      (doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        creatures.filters.push({ id: "cr", label: "Challenge rating", type: "number" });
        creatures.entries.find((one: { id: string }) => one.id === "cinder-hound").filters.cr = 1;
        creatures.entries.find((one: { id: string }) => one.id === "dire-wolf").filters.cr = 2;
      },
    );
    const { option } = use(elemental);
    assert.ok(
      option.modes?.some((one) => one.id === "call-dire-wolf"),
      "offered for a higher slot",
    );
    const low = use(elemental, undefined, "call-dire-wolf");
    assert.deepEqual(
      of(low.taken.events, "refused").map((one) => one.reason),
      ["unknown-mode"],
    );
    assert.equal(use(elemental, undefined, "call-cinder-hound").called.length, 1, "within its own");
    const high = use(elemental, "slots_4", "call-dire-wolf");
    assert.deepEqual(who(high.taken.state, high.called[0]!).creature, { catalogId: "creatures", entryId: "dire-wolf" });
  }

  // ── Conjure Elemental's concentration broken: the elemental turns on the druid (1.538) ──
  {
    const hostile = parsed(
      document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, rounds: 600, hostileOnBreak: true })]),
    );
    const cast = use(hostile);
    const [wolfId] = cast.called;
    assert.equal(who(cast.taken.state, wolfId!).side, "party");
    const hit = structuredClone(cast.taken.state);
    hit.turn = hit.order.indexOf("brute");
    who(hit, "brute").budgets.action = 1;
    queued = [10, 1];
    const broken = applyRulesetCombatChoice(
      hostile,
      hit,
      { actorId: "brute", optionId: "smash", targetIds: ["druid"] } as RulesetCombatChoice,
      roll,
    );
    queued = [];
    assert.equal(who(broken.state, "druid").concentrating, null, "broken");
    assert.deepEqual(
      of(broken.events, "turnedOn").map((one) => [one.actorId, one.ids]),
      [["druid", [wolfId]]],
    );
    assert.equal(of(broken.events, "sentAway").length, 0, "it stays");
    const wolf = who(broken.state, wolfId!);
    assert.equal(wolf.side, "enemy", "on the other side now");
    assert.ok(!wolf.defeated && !wolf.dismissed);
    assert.equal(wolf.calledWith, undefined, "no longer the druid's to dismiss");
    assert.equal(wolf.calledUntil, cast.taken.state.round + 600, "its hour still runs");
  }

  // ── Refused shapes ──
  refused(
    document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, perStep: 0 })]),
    /calls\.perStep|Number must be greater than or equal to 1/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call that grows with each step of higher cost (calls perStep, fromStep, upTo perStep) requires schemaVersion 2 and capabilityApi 1.537 or newer";
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
    const doc = document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, perStep: 2 })]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(536) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(537) as never, doc), gate);
    const options = document([
      conjure({
        options: [
          { creature: "creatures/dire-wolf", count: { flat: 1 } },
          { creature: "creatures/cinder-hound", count: { flat: 1 }, fromStep: 1 },
        ],
      }),
    ]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(536) as never, options), gate);
    const plain = document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 } })]);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(536) as never, plain), gate);
  }

  {
    const gate =
      "A ruleset with called creatures that turn on their caller when its concentration breaks (calls hostileOnBreak) requires schemaVersion 2 and capabilityApi 1.538 or newer";
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
    const doc = document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, hostileOnBreak: true })]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(537) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(538) as never, doc), gate);
  }

  console.log(
    "Ruleset stepped calls: Animate Dead's two more a level, Create Undead's options from a higher slot and one more a level, Conjure Elemental's challenge rating rising with the slot (1.537), and its elemental turning on its caller as concentration breaks (1.538); gated.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
