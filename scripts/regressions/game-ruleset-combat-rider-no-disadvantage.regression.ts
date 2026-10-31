/**
 * A rider that needs an adjacent ally without disadvantage (Capability API 1.126): 5e's Sneak Attack.
 * The final roll mode is read after advantage and disadvantage cancel. Catalog and creature riders
 * share the condition, and the old ally-adjacent condition still allows disadvantage.
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
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatantInput,
  type RulesetCombatRider,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rider-no-disadvantage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 121);
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
  const example = read("../../docs/development/ruleset-5e-2014.example.json");
  const word = "ally-adjacent-no-disadvantage";
  const sneakWhen: RulesetCombatRider["when"] = ["advantage", word];
  const rider = (when: unknown = sneakWhen) => ({ on: "hit", when, oncePer: "turn", amount: { flat: 3 } });
  const entry = (kind: "catalog" | "creature", when: unknown = sneakWhen) =>
    kind === "catalog"
      ? {
          id: "sneak-attack",
          label: "Sneak Attack",
          rows: [{ list: "features", values: { name: "Sneak Attack" } }],
          mechanics: { kind: "rider", rider: { ...rider(when), sources: ["attacks"] } },
        }
      : {
          id: "rogue",
          label: "Rogue",
          creature: {
            tier: "cr_1",
            health: 80,
            defense: 12,
            initiativeModifier: 20,
            speed: 30,
            actions: [{ id: "stab", name: "Stab", budget: "action", toHit: 5, reach: 5, damage: { flat: 4 } }],
            riders: [{ id: "sneak_attack", name: "Sneak Attack", ...rider(when) }],
          },
        };
  const document = (kind: "catalog" | "creature", when: unknown = sneakWhen) => {
    const doc = structuredClone(example);
    doc.catalogs.push({
      id: "sneak",
      label: "Sneak Attack",
      ...(kind === "creature" ? { holds: "creatures" } : { feeds: ["features"] }),
      entries: [entry(kind, when)],
    });
    return doc;
  };
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };

  // Both rider shapes accept all three conditions, and refuse an unknown word or an empty list.
  for (const kind of ["catalog", "creature"] as const) {
    const all = ["advantage", "ally-adjacent", word];
    const definition = parsedOrThrow(document(kind, all));
    const carried = definition.catalogs!.find((catalog) => catalog.id === "sneak")!.entries![0]!;
    assert.deepEqual(kind === "catalog" ? carried.mechanics!.rider!.when : carried.creature!.riders![0]!.when, all);
    // Six at most since 1.544's surprised and not-yet-acted targets.
    for (const when of [[], ["adjacent"], [...all, "target-hurt", "target-surprised", "target-not-yet-acted", word]]) {
      const parsed = parseRulesetDefinition(document(kind, when));
      assert.equal(parsed.ok, false, `${kind}: invalid when ${JSON.stringify(when)} should be refused`);
      if (!parsed.ok) assert.match(parsed.issues.join("; "), /when/);
    }
  }

  // The enum and bounds are generated directly from zod, with no additional refusal to mirror.
  const schema = read("../../docs/extending/ruleset.schema.json");
  let shapes = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (node.properties?.on?.const === "hit" && node.properties?.oncePer && node.properties?.when) {
      shapes++;
      // With 1.544's surprised and not-yet-acted targets.
      assert.deepEqual(node.properties.when.items.enum, [
        "advantage",
        "ally-adjacent",
        word,
        "target-hurt",
        "target-surprised",
        "target-not-yet-acted",
      ]);
      assert.equal(node.properties.when.minItems, 1);
      assert.equal(node.properties.when.maxItems, 6);
    }
    Object.values(node).forEach(walk);
  };
  walk(schema);
  assert.equal(shapes, 2, "the published catalog and creature rider shapes both carry the condition");

  const block: RulesetStatBlock = { health: 80, defense: 12, initiativeModifier: 0, speed: 30, actions: [] };
  const strike = (
    kind: "catalog" | "creature",
    when: RulesetCombatRider["when"],
    adjacent: boolean,
    conditions: string[],
    allyCondition?: string,
    board = true,
  ) => {
    const definition = parsedOrThrow(document(kind, when));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "sneak")!.entries!;
    const actor: RulesetCombatantInput =
      kind === "creature"
        ? { id: "rogue", name: "Rogue", side: "enemy", block: rulesetCreatureBlock(definition, entries[0])! }
        : {
            id: "rogue",
            name: "Rogue",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
              fields: { level: 1, ac: 12, speed: 30, hp_max: 80 },
              lists: {
                attacks: [
                  {
                    name: "Rapier",
                    ability: "dex",
                    proficient: true,
                    bonus: 0,
                    damage: "1d8",
                    damage_type: "piercing",
                    finesse: true,
                    reach: 5,
                    range: 0,
                    long_range: 0,
                  },
                ],
                features: rowsFromCatalogEntry("sneak", entries[0]!).map((row) => row.row),
              },
            }),
            live: {},
            catalogs: { sneak: entries },
          };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        actor,
        { id: "target", name: "Target", side: "enemy", block },
        { id: "ally", name: "Ally", side: "enemy", block },
      ],
      ...(board
        ? {
            board: {
              grid: { width: 9, height: 1, tiles: [Array(9).fill("plains")] },
              placements: { rogue: { x: 0, y: 0 }, target: { x: 1, y: 0 }, ally: { x: adjacent ? 2 : 8, y: 0 } },
            },
          }
        : {}),
    });
    state.turn = state.order.indexOf("rogue");
    const holder = rulesetCombatant(state, "rogue")!;
    // Stat blocks enter through the enemy path; afterwards they may stand on the party's side.
    holder.side = "party";
    rulesetCombatant(state, "ally")!.side = "party";
    assert.deepEqual(holder.riders![0]!.when, when, `${kind}: the encounter keeps the authored condition`);
    for (const condition of conditions) holder.tracked.push({ condition, rounds: null });
    if (allyCondition) rulesetCombatant(state, "ally")!.tracked.push({ condition: allyCondition, rounds: null });
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "rogue", optionId: holder.actions[0]!.id, targetIds: ["target"] },
      (sides) => (sides === 20 ? 15 : 4),
    );
    const attack = result.events.find((event) => event.type === "attack");
    assert.ok(attack, `${kind}: the blow must be made`);
    assert.equal(attack.outcome, "hit", "even the disadvantaged roll hits, so a miss cannot hide a broken rider");
    return { ...result, mode: attack.mode };
  };

  for (const kind of ["catalog", "creature"] as const) {
    for (const [what, when, adjacent, conditions, expectedMode, fires, allyCondition, board] of [
      ["adjacent and normal", sneakWhen, true, [], "normal", true],
      ["adjacent and disadvantage", sneakWhen, true, ["poisoned"], "disadvantage", false],
      ["adjacent and cancelled", sneakWhen, true, ["poisoned", "invisible"], "normal", true],
      ["no ally and normal", sneakWhen, false, [], "normal", false],
      ["no ally and disadvantage", sneakWhen, false, ["poisoned"], "disadvantage", false],
      ["advantage alone", sneakWhen, false, ["invisible"], "advantage", true],
      ["adjacency still needed", [word], false, ["invisible"], "advantage", false],
      ["adjacent and advantage", [word], true, ["invisible"], "advantage", true],
      ["old adjacency at disadvantage", ["ally-adjacent"], true, ["poisoned"], "disadvantage", true],
      ["any-of with old adjacency", [word, "ally-adjacent"], true, ["poisoned"], "disadvantage", true],
      ["incapacitated ally", sneakWhen, true, [], "normal", false, "incapacitated"],
      ["boardless normal", sneakWhen, false, [], "normal", true, undefined, false],
      ["boardless disadvantage", sneakWhen, false, ["poisoned"], "disadvantage", false, undefined, false],
    ] as const) {
      const result = strike(kind, [...when], adjacent, [...conditions], allyCondition, board);
      assert.equal(result.mode, expectedMode, `${kind}: ${what} uses the expected final mode`);
      assert.equal(result.events.filter((event) => event.type === "rider").length, fires ? 1 : 0, `${kind}: ${what}`);
      const damage = result.events.filter((event) => event.type === "damage");
      assert.equal(damage.length, fires ? 2 : 1, `${kind}: ${what} adds exactly one damage clause`);
      if (fires) assert.equal(damage[1]!.dealt, 3, "the rider's actual damage lands");
      assert.equal(rulesetCombatant(result.state, "rogue")!.ridersSpent?.length ?? 0, fires ? 1 : 0);
    }
  }

  // The install gate reads catalog and creature riders, in headers and in catalog files.
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-sneak-attack",
    name: "Sneak Attack",
    version: "0.1.0",
    description: "A packaged ruleset whose rider needs an ally without disadvantage.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/sneak.json"] } },
    files: ["ruleset.json", "catalogs/sneak.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose riders need an adjacent ally without disadvantage requires schemaVersion 2 and capabilityApi 1.126 or newer";
  for (const kind of ["catalog", "creature"] as const) {
    for (const file of [false, true]) {
      for (const when of [[word], ["advantage", word], ["advantage", "ally-adjacent"]]) {
        const doc = document(kind, when);
        const catalog = doc.catalogs.at(-1);
        const documents = new Map<string, unknown>();
        if (file) {
          documents.set("catalogs/sneak.json", { entries: catalog.entries });
          delete catalog.entries;
          catalog.asset = "catalogs/sneak.json";
        }
        const issue = (minor: number) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc, documents);
        assert.equal(issue(125), when.includes(word) ? gate : null, `${kind}, file ${file}: the previous minor`);
        assert.equal(issue(126), null, `${kind}, file ${file}: 1.126 accepts the rider`);
        const legacy = { ...manifest(126), schemaVersion: 1 };
        assert.match(getCapabilityPackageInstallIssue(legacy as any, doc, documents) ?? "", /requires schemaVersion 2/);
      }
    }
  }

  console.info("Rider no disadvantage: Sneak Attack reads the final mode, with catalog and creature gates at 1.126.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
