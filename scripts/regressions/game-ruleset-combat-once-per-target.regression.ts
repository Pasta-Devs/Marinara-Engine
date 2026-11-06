/**
 * Once a creature until a rest (Capability API 1.304).
 *
 *   - `oncePerTarget: { until }`: used on a creature, an entry is not offered against that one again
 *     until its user takes that rest, however many fights come between: 5e's Chains of Carceri.
 *   - Whom it was used on lives on the sheet's live state, by name, and only the named rest clears it.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLiveStateSchema,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-once-per-target-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 299);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 0, prepared: true } }],
      mechanics: { kind: "attack", range: 60, autoHit: true, amount: { flat: 1 }, damageType: "force", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Chains of Carceri, once a creature until a long rest; one until a short rest; one as often as wanted.
  const chains = spell("chains", { oncePerTarget: { until: "long" } });
  const brief = spell("brief", { oncePerTarget: { until: "short" } });
  const bolt = spell("bolt", {});
  const spells = [chains, brief, bolt];
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
    fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "cha" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const foe = (id: string, name: string) => ({
    id,
    name,
    side: "enemy" as const,
    block: {
      health: 500,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    },
  });
  const fight = (live: unknown = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "warlock", name: "Warlock", side: "party", build, live, catalogs: { spells } },
        foe("a", "Imp"),
        foe("b", "Quasit"),
      ],
      board: {
        grid: { width: 10, height: 5, tiles: Array.from({ length: 5 }, () => Array(10).fill("plains")) } as never,
        placements: { warlock: { x: 2, y: 2 }, a: { x: 3, y: 2 }, b: { x: 4, y: 2 } },
      },
    });
    state.order = ["warlock", "a", "b"];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    state.turn = 0;
    const warlock = rulesetCombatant(state, "warlock")!;
    for (const key of Object.keys(warlock.budgets)) warlock.budgets[key] = 9;
    const option = rulesetCombatOptions(definition, state, "warlock").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const targetsOf = (state: RulesetEncounterState, label: string) =>
    rulesetOptionTargets(definition, state, "warlock", optionOf(state, label));
  const use = (state: RulesetEncounterState, label: string, targetIds: string[]) => {
    const option = optionOf(state, label);
    return applyRulesetCombatChoice(definition, state, { actorId: "warlock", optionId: option.id, targetIds }, () => 1);
  };
  const refusal = (step: ReturnType<typeof use>) => step.events.find((one) => one.type === "refused");
  const liveOf = (state: RulesetEncounterState): RulesetLiveState => rulesetCombatant(state, "warlock")!.sheet!.live;
  const rest = (live: RulesetLiveState, id: string): RulesetLiveState => {
    const rested = applyRulesetSheetOp(definition, build, live, { op: "rest", rest: id });
    assert.ok(rested.ok);
    return rested.live;
  };

  // ── Once a creature, in one fight ──
  let live: RulesetLiveState;
  {
    const state = fight();
    assert.deepEqual(targetsOf(state, "Chains"), ["a", "b"]);
    const step = use(state, "Chains", ["a"]);
    assert.equal(refusal(step), undefined, JSON.stringify(step.events));
    assert.deepEqual(targetsOf(step.state, "Chains"), ["b"], "not on the imp again");
    assert.deepEqual(targetsOf(step.state, "Bolt"), ["a", "b"], "what has no such limit is untouched");
    assert.deepEqual(targetsOf(step.state, "Brief"), ["a", "b"], "nor another entry with one");
    assert.ok(refusal(use(step.state, "Chains", ["a"])), "a choice at the imp is refused");
    const quasit = use(step.state, "Chains", ["b"]);
    assert.equal(refusal(quasit), undefined);
    assert.deepEqual(targetsOf(quasit.state, "Chains"), [], "both used now");
    const briefly = use(quasit.state, "Brief", ["a"]);
    assert.equal(refusal(briefly), undefined);
    live = liveOf(briefly.state);
    assert.deepEqual(live.usedOn, {
      "long|spells/chains": ["imp#a", "imp", "quasit#b", "quasit"],
      "short|spells/brief": ["imp#a", "imp"],
    });
    assert.deepEqual(rulesetLiveStateSchema.parse(live).usedOn, live.usedOn, "a stored live state keeps it");
  }

  // ── Into the next fight, and until the rest it names ──
  {
    const next = fight(live);
    assert.deepEqual(targetsOf(next, "Chains"), [], "the next fight remembers");
    assert.deepEqual(targetsOf(next, "Brief"), ["b"]);
    const short = rest(live, "short");
    assert.deepEqual(targetsOf(fight(short), "Chains"), [], "a short rest is not enough for chains");
    assert.deepEqual(targetsOf(fight(short), "Brief"), ["a", "b"], "but is for its own");
    const long = rest(short, "long");
    assert.equal(long.usedOn, undefined, "a long rest clears it");
    assert.deepEqual(targetsOf(fight(long), "Chains"), ["a", "b"]);
    assert.deepEqual(rest(live, "long").usedOn, { "short|spells/brief": ["imp#a", "imp"] }, "only its own");
  }

  // ── Refusals ──
  const withSpell = (entry: RulesetCatalogEntry) =>
    fiveE((doc) => {
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(entry);
    });
  refusedDoc(withSpell(spell("odd", { oncePerTarget: { until: "nap" } })), /Unknown rest "nap"/);
  refusedDoc(withSpell(spell("odd", { targets: "self", oncePerTarget: { until: "long" } })), /oncePerTarget/);
  // Since 1.628 an area may be spent once on each creature it catches.
  parsed(withSpell(spell("odd", { area: { shape: "burst", size: 10 }, oncePerTarget: { until: "long" } })));

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
      "A ruleset with uses once a creature until a rest requires schemaVersion 2 and capabilityApi 1.304 or newer";
    const doc = fiveE();
    assert.equal(getCapabilityPackageInstallIssue(manifest(303) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(304) as never, doc), gate);
  }

  console.log(
    "Once per target: Chains of Carceri not on the same creature again until a long rest, across fights; refusals; gated at 1.304.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
