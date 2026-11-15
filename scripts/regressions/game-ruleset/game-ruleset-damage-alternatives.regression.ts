/**
 * What a creature's blow deals instead, and when (Capability API 1.102).
 *
 *   - `alternatives` on a creature action's damage are amounts it deals in place of its first, the
 *     first that holds winning: `twoHanded` unless the creature carries a `shield`, and
 *     `{ selfHealthAtMost }` while its health is at most that share of its most. 5e's "or 8 (1d10 +
 *     3) slashing damage if used with two hands" and a swarm's weaker bite at half its hit points.
 *   - Only the dice and the flat part change: the type and the clauses stay the action's own.
 *   - The menu's forecast reads the same amount the blow then rolls, a sequence's parts included.
 *   - Import checks the shape (dice or flat, a share between nothing and all) and a pool fight's die.
 *   - The install gate asks for 1.102, for an alternative and for a shield, in a catalog file too.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-damage-alternatives-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const fiveEText = read("../../../docs/development/ruleset-5e-2014.example.json");
  const gravewatchText = read("../../../docs/examples/rulesets/gravewatch.json");
  const variantOf =
    (text: string) =>
    (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
      const doc = JSON.parse(text) as Record<string, any>;
      edit(doc);
      return doc;
    };
  const fiveE = variantOf(fiveEText);
  const gravewatch = variantOf(gravewatchText);
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const creatureOf = (doc: Record<string, any>, catalogId: string, entryId: string) =>
    doc.catalogs
      .find((one: { id: string }) => one.id === catalogId)
      .entries.find((one: { id: string }) => one.id === entryId).creature;
  /** The sentinel's slam is a longsword in two hands: 1d8 + 2, or 1d10 + 3 with both. It acts first. */
  const sentinel = (doc: Record<string, any>) => creatureOf(doc, "creatures", "hollow-sentinel");
  const twoHanded = (doc: Record<string, any>) => {
    sentinel(doc).initiativeModifier = 30;
    sentinel(doc).actions[0].damage.alternatives = [{ when: "twoHanded", dice: "1d10", flat: 3 }];
  };
  const bloodied = (doc: Record<string, any>) => {
    sentinel(doc).initiativeModifier = 30;
    sentinel(doc).actions[0].damage.alternatives = [{ when: { selfHealthAtMost: 0.5 }, dice: "1d4" }];
  };

  // ── Import ──
  {
    parsedOrThrow(fiveE(twoHanded), "a two-handed slam");
    parsedOrThrow(fiveE(bloodied), "a bloodied slam");
    parsedOrThrow(
      fiveE((doc) => {
        twoHanded(doc);
        sentinel(doc).shield = true;
      }),
      "a sentinel with a shield",
    );
    const alternative = (value: unknown) => fiveE((doc) => (sentinel(doc).actions[0].damage.alternatives = [value]));
    refused(alternative({ when: "twoHanded" }), /alternatives\.0.*dice, a flat amount, or both/, "no amount");
    refused(alternative({ when: { selfHealthAtMost: 1 }, dice: "1d4" }), /selfHealthAtMost/, "all of its health");
    refused(alternative({ when: { selfHealthAtMost: 0 }, dice: "1d4" }), /selfHealthAtMost/, "none of it");
    refused(alternative({ when: "mounted", dice: "1d4" }), /alternatives\.0\.when/, "a condition nobody reads");
    refused(
      fiveE((doc) => (sentinel(doc).actions[0].damage.alternatives = [])),
      /alternatives/,
      "an empty list",
    );
    refused(
      fiveE((doc) => (sentinel(doc).shield = false)),
      /shield/,
      "a shield that is not",
    );
    // A pool fight throws its own die, and an alternative is held to it as the first amount is.
    const rats = (dice: string) => (doc: Record<string, any>) =>
      (creatureOf(doc, "night", "grave-rats").actions[0].damage.alternatives = [{ when: "twoHanded", dice }]);
    parsedOrThrow(gravewatch(rats("2d10")), "a pool alternative in the pool's die");
    refused(gravewatch(rats("2d6")), /alternatives\.0\.dice: A "dice-pool" fight throws d10s/, "another die");
  }

  // ── A fight ──
  {
    /** Every die lands on its highest face but the d20, which lands on 15: a hit, never a critical. */
    const roller: RulesetCombatRoller = (sides) => (sides === 20 ? 15 : sides);
    const fight = (definition: RulesetDefinition): RulesetEncounterState => {
      const catalogs = Object.fromEntries((definition.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
      const brenna: RulesetCombatantInput = {
        id: "brenna",
        name: "Brenna",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
          fields: { level: 3, ac: 12, speed: 30, hp_max: 200 },
        }),
        catalogs: {},
      } as RulesetCombatantInput;
      const state = createRulesetEncounter({
        definition,
        seed: 7,
        bestiary: catalogs,
        roller,
        combatants: [
          brenna,
          {
            id: "sentinel",
            name: "Sentinel",
            side: "enemy",
            creature: { catalogId: "creatures", entryId: "hollow-sentinel" },
          },
        ],
      });
      assert.equal(currentRulesetActor(state)?.id, "sentinel", "the sentinel acts first");
      return state;
    };
    const forecastOf = (definition: RulesetDefinition, state: RulesetEncounterState, label: RegExp) => {
      const option = rulesetCombatOptions(definition, state, "sentinel").find((one) => label.test(one.label));
      assert.ok(option, `the sentinel has ${label}`);
      return option.forecast?.averageDamage;
    };
    const slamOf = (definition: RulesetDefinition, state: RulesetEncounterState) => {
      const option = rulesetCombatOptions(definition, state, "sentinel").find((one) => /^Slam/.test(one.label))!;
      const after = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "sentinel", optionId: option.id, targetIds: ["brenna"] },
        roller,
      );
      const damage = after.events.find((event) => event.type === "damage") as
        Extract<RulesetCombatEvent, { type: "damage" }> | undefined;
      assert.ok(damage, `the slam lands: ${JSON.stringify(after.events.map((event) => event.type))}`);
      return { rolls: damage.rolls, flat: damage.flat, type: damage.damageType };
    };

    // As shipped: 1d8 + 2.
    const plain = parsedOrThrow(
      fiveE((doc) => (sentinel(doc).initiativeModifier = 30)),
      "the 5e example",
    );
    assert.equal(forecastOf(plain, fight(plain), /^Slam/), 6.5);
    assert.deepEqual(slamOf(plain, fight(plain)), { rolls: [8], flat: 2, type: "bludgeoning" });

    // Both hands free: 1d10 + 3, in the forecast, in each part of the double slam and in the blow.
    const versatile = parsedOrThrow(fiveE(twoHanded), "a two-handed slam");
    assert.equal(forecastOf(versatile, fight(versatile), /^Slam/), 8.5, "the two-handed forecast");
    assert.equal(forecastOf(versatile, fight(versatile), /^Double slam/), 17, "two two-handed slams");
    assert.deepEqual(slamOf(versatile, fight(versatile)), { rolls: [10], flat: 3, type: "bludgeoning" });

    // A shield fills a hand, and the slam is its own again.
    const shielded = parsedOrThrow(
      fiveE((doc) => {
        twoHanded(doc);
        sentinel(doc).shield = true;
      }),
      "a sentinel with a shield",
    );
    assert.equal(forecastOf(shielded, fight(shielded), /^Slam/), 6.5, "a shield, one hand");
    assert.deepEqual(slamOf(shielded, fight(shielded)), { rolls: [8], flat: 2, type: "bludgeoning" });

    // Bloodied: unhurt it slams as written, at half its health or below it deals 1d4 and no flat part.
    const swarm = parsedOrThrow(fiveE(bloodied), "a bloodied slam");
    const hurt = (share: number) => {
      const state = fight(swarm);
      const health = rulesetCombatant(state, "sentinel")!.health!;
      // Even numbers, so "at half" is exactly half.
      health.max = 100;
      health.value = Math.round(100 * share);
      return state;
    };
    assert.equal(forecastOf(swarm, hurt(1), /^Slam/), 6.5, "unhurt");
    assert.equal(forecastOf(swarm, hurt(0.6), /^Slam/), 6.5, "above half");
    assert.equal(forecastOf(swarm, hurt(0.5), /^Slam/), 2.5, "at half");
    assert.deepEqual(slamOf(swarm, hurt(1)), { rolls: [8], flat: 2, type: "bludgeoning" });
    assert.deepEqual(slamOf(swarm, hurt(0.4)), { rolls: [4], flat: 0, type: "bludgeoning" });
  }

  // ── The install gate: 1.102, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-damage-alternatives",
      name: "Damage alternatives",
      version: "0.1.0",
      description: "A packaged ruleset whose creatures swing two-handed.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /two-handed or when hurt.*capabilityApi 1\.102/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const shieldOnly = (doc: Record<string, any>) => (sentinel(doc).shield = true);
    assert.match(issue(101, fiveE(twoHanded)) ?? "", gate, "an alternative");
    assert.match(issue(101, fiveE(shieldOnly)) ?? "", gate, "a shield");
    assert.doesNotMatch(issue(102, fiveE(twoHanded)) ?? "", gate);
    assert.doesNotMatch(issue(102, fiveE(shieldOnly)) ?? "", gate);
    assert.doesNotMatch(issue(101, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
    const document = fiveE(twoHanded);
    const creatures = document.catalogs.find((one: { id: string }) => one.id === "creatures");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((one: { id: string }) =>
        one.id === "creatures" ? { ...one, entries: undefined, asset: "catalogs/creatures.json" } : one,
      ),
    };
    const paths = ["ruleset.json", "catalogs/creatures.json"];
    const files = new Map<string, unknown>([["catalogs/creatures.json", { entries: creatures.entries }]]);
    assert.match(issue(101, inFile, paths, files) ?? "", gate, "a catalog file");
    assert.doesNotMatch(issue(102, inFile, paths, files) ?? "", gate);
  }

  console.log(
    "Damage alternatives: two hands, a shield and a bloodied swarm, forecast and dealt alike, gated at 1.102.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
