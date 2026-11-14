/**
 * Exhaustion at its worst (Capability API 1.115).
 *
 *   - A modifier `{ "to": "health-max", "times": 0.5 }` halves the health maximum, rounded down and
 *     never below 1; health above it is lost as the fight begins, and healing never goes past it.
 *   - A level that `defeats` takes its holder out of the fight before anybody moves.
 *   - An opponent without a sheet carries live tracks: given on the combatant, or on a creature the
 *     Game Master proposes, and held to the ruleset's tracks by the clamp.
 *   - A creature's `conditionImmunities` may name a track a level reads; none of its levels touch it.
 *   - Import and the install gate (1.115).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetProposedCreatureSchema,
  rulesetProposedStatBlock,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-exhaustion-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const worst = (doc: Record<string, any>) => {
    doc.combat.levels.push(
      { track: "exhaustion", at: 4, modifiers: [{ to: "health-max", times: 0.5 }] },
      { track: "exhaustion", at: 6, defeats: true },
    );
  };
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
  const creatureOf = (doc: Record<string, any>, entryId: string) =>
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries.find((one: { id: string }) => one.id === entryId).creature;

  // ── Import ──
  {
    parsedOrThrow(fiveE(worst), "a halving level and a defeating one");
    parsedOrThrow(
      fiveE((doc) => {
        worst(doc);
        creatureOf(doc, "cinder-hound").conditionImmunities = ["exhaustion"];
      }),
      "a creature immune to exhaustion",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").conditionImmunities = ["weariness"])),
      /Unknown condition "weariness"/,
      "an immunity to nothing",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").conditionImmunities = ["death_save_failures"])),
      /Unknown condition "death_save_failures"/,
      "a track no level reads",
    );
    refused(
      fiveE((doc) =>
        doc.combat.levels.push({ track: "exhaustion", at: 4, modifiers: [{ to: "health-max", times: 2 }] }),
      ),
      /health maximum is only halved/,
      "a doubled maximum",
    );
    refused(
      fiveE((doc) =>
        doc.combat.levels.push({ track: "exhaustion", at: 4, modifiers: [{ to: "health-max", flat: -5 }] }),
      ),
      /health maximum is only halved/,
      "a flat change to the maximum",
    );
    refused(
      fiveE((doc) => doc.combat.levels.push({ track: "exhaustion", at: 6, defeats: false })),
      /defeats/,
      "defeats is only ever true",
    );
  }

  // ── In a fight ──
  {
    const definition = parsedOrThrow(fiveE(worst), "the 5e example at its worst");
    const mending = {
      id: "mending-light",
      label: "Mending Light",
      rows: [{ list: "spells", values: { name: "Mending Light", level: 1, prepared: true } }],
      mechanics: {
        kind: "heal",
        targets: "ally",
        amount: { dice: "1d8", flat: 4 },
        cost: [{ pool: "slots_1", amount: 1 }],
      },
    } as unknown as RulesetCatalogEntry;
    const corwin: RulesetCombatantInput = {
      id: "corwin",
      name: "Corwin",
      side: "party",
      build: rulesetSheetBuildSchema.parse({
        abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
        fields: { level: 3, ac: 12, speed: 30, hp_max: 20, spellcasting_ability: "int", slots_max_1: 4 },
        lists: { spells: rowsFromCatalogEntry("spells", mending).map((row) => row.row) },
      }),
      live: {},
      catalogs: { spells: [mending] },
    };
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
    const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
      health: 21,
      defense: 12,
      initiativeModifier: 30,
      speed: 30,
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { count: 1, sides: 6, flat: 0 } }],
      ...extra,
    });
    const fight = (...combatants: RulesetCombatantInput[]): RulesetEncounterState =>
      createRulesetEncounter({ definition, seed: 1, roller: () => 5, combatants });
    const health = (state: RulesetEncounterState, id: string) => {
      const { value, max } = rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!);
      return { value, max };
    };
    const ogre = (tracks?: Record<string, number>, extra: Partial<RulesetStatBlock> = {}): RulesetCombatantInput =>
      ({ id: "ogre", name: "Ogre", side: "enemy", block: block(extra), ...(tracks ? { tracks } : {}) }) as any;
    const imp = (): RulesetCombatantInput =>
      ({ id: "imp", name: "Imp", side: "enemy", block: block({ initiativeModifier: 0 }) }) as RulesetCombatantInput;

    // A sheet at the fourth level: half of 20, and the points over it gone from the sheet itself.
    const tired = fight(corwin, brenna({ tracks: { exhaustion: 4 } }), imp());
    assert.deepEqual(health(tired, "brenna"), { value: 10, max: 10 });
    const sheet = rulesetCombatant(tired, "brenna")!.sheet!;
    assert.equal(
      readRulesetLive(definition, sheet.build, sheet.live).pools.find((pool) => pool.key === "hp")?.value,
      10,
      "what she brings is what she has",
    );
    // At the third, nothing halves.
    assert.deepEqual(health(fight(corwin, brenna({ tracks: { exhaustion: 3 } }), imp()), "brenna"), {
      value: 20,
      max: 20,
    });
    // Healing stops at the halved maximum: 5 + 4 on 6 of 10 is 10, not 15.
    const hurt = fight(corwin, brenna({ tracks: { exhaustion: 4 }, pools: { hp: { value: 6 } } }), imp());
    assert.deepEqual(health(hurt, "brenna"), { value: 6, max: 10 });
    const mend = rulesetCombatOptions(definition, hurt, "corwin").find((option) => option.label === "Mending Light");
    assert.ok(mend, "Corwin is on turn with his spell");
    const healed = applyRulesetCombatChoice(
      definition,
      hurt,
      { actorId: "corwin", optionId: mend.id, targetIds: ["brenna"] },
      () => 5,
    );
    const heal = healed.events.find((event) => event.type === "heal") as Extract<RulesetCombatEvent, { type: "heal" }>;
    assert.deepEqual([heal.amount, heal.health, heal.maxHealth], [9, 10, 10]);
    const after = rulesetCombatant(healed.state, "brenna")!.sheet!;
    assert.equal(
      readRulesetLive(definition, after.build, after.live).pools.find((pool) => pool.key === "hp")?.value,
      10,
      "and the sheet never holds more than the fight says",
    );

    // An opponent's tracks: 21 halves to 10, the stored points held to it.
    const weary = fight(ogre({ exhaustion: 4 }), brenna({}));
    assert.deepEqual(health(weary, "ogre"), { value: 10, max: 10 });
    assert.deepEqual(rulesetCombatant(weary, "ogre")!.health, { value: 10, max: 21, temp: 0 });
    assert.deepEqual(rulesetCombatant(weary, "ogre")!.tracks, { exhaustion: 4 });
    // Two halvings would be a quarter: one level halves once, however often it is read.
    assert.deepEqual(health(weary, "ogre"), { value: 10, max: 10 });
    // Tracks on its block count as well as on the combatant.
    assert.deepEqual(health(fight(ogre(undefined, { tracks: { exhaustion: 5 } }), brenna({})), "ogre").max, 10);

    // The sixth level: out before anybody moves, and the first turn goes to whoever can take it.
    const dead = fight(ogre({ exhaustion: 6 }), imp(), brenna({}));
    assert.equal(rulesetCombatant(dead, "ogre")!.defeated, true);
    assert.ok(
      dead.opening.some((event) => event.type === "defeated" && event.actorId === "ogre"),
      JSON.stringify(dead.opening),
    );
    assert.notEqual(dead.order[dead.turn], "ogre");
    const firstTurn = dead.opening.find((event) => event.type === "turn") as { actorId: string } | undefined;
    assert.notEqual(firstTurn?.actorId, "ogre");
    assert.equal(rulesetCombatant(fight(ogre({ exhaustion: 5 }), brenna({})), "ogre")!.defeated, false);
    // A sheet at the sixth too.
    assert.equal(
      rulesetCombatant(fight(corwin, brenna({ tracks: { exhaustion: 6 } }), imp()), "brenna")!.defeated,
      true,
    );

    // Immune: no level of the track touches it.
    const lich = fight(ogre({ exhaustion: 6 }, { conditionImmunities: ["exhaustion"] }), brenna({}));
    assert.equal(rulesetCombatant(lich, "ogre")!.defeated, false);
    assert.deepEqual(health(lich, "ogre"), { value: 21, max: 21 });

    // A bestiary opponent takes its tracks from the combatant.
    const hounds = parsedOrThrow(fiveE(worst), "the bestiary");
    const bestiary = Object.fromEntries((hounds.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
    const houndFight = createRulesetEncounter({
      definition: hounds,
      seed: 1,
      roller: () => 4,
      bestiary,
      combatants: [
        {
          id: "hound",
          name: "Hound",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "cinder-hound" },
          tracks: { exhaustion: 6 },
        },
        brenna({}),
      ],
    });
    assert.equal(rulesetCombatant(houndFight, "hound")!.defeated, true);
  }

  // ── A creature the Game Master proposes ──
  {
    const definition = parsedOrThrow(fiveE(worst), "the 5e example at its worst");
    const proposed = rulesetProposedCreatureSchema.parse({
      health: 11,
      defense: 12,
      initiativeModifier: 1,
      tier: "cr_1",
      actions: [{ id: "club", name: "Club", budget: "action", toHit: 3, damage: { dice: "1d4", flat: 1 } }],
      tracks: { exhaustion: 9, rage: 2 },
    });
    const block = rulesetProposedStatBlock(definition, proposed)!;
    assert.deepEqual(block.tracks, { exhaustion: 9, rage: 2 }, "carried onto the block");
    const tierId = definition.combat!.threat?.tiers[0]?.id ?? "minion";
    const clamped = clampRulesetStatBlock(definition, block, tierId);
    assert.deepEqual(clamped.block.tracks, { exhaustion: 6 }, "held to the tracks the ruleset has, and to their tops");
    assert.ok(
      clamped.adjusted.some((line) => /track this ruleset does not have/.test(line)),
      clamped.adjusted.join("; "),
    );
    const immune = clampRulesetStatBlock(
      definition,
      { ...block, conditionImmunities: ["exhaustion", "nonsense"] },
      tierId,
    );
    assert.deepEqual(immune.block.conditionImmunities, ["exhaustion"], "an immunity to a leveled track is kept");
  }

  // ── The install gate: 1.115, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-exhaustion",
      name: "Exhaustion",
      version: "0.1.0",
      description: "A packaged ruleset whose exhaustion kills.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /halve the health maximum or defeat.*capabilityApi 1\.115/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const halving = (doc: Record<string, any>) =>
      doc.combat.levels.push({ track: "exhaustion", at: 4, modifiers: [{ to: "health-max", times: 0.5 }] });
    const defeating = (doc: Record<string, any>) =>
      doc.combat.levels.push({ track: "exhaustion", at: 6, defeats: true });
    const immune = (doc: Record<string, any>) => (creatureOf(doc, "cinder-hound").conditionImmunities = ["exhaustion"]);
    for (const [what, edit] of [
      ["a halving level", halving],
      ["a defeating level", defeating],
      ["an immunity to a track", immune],
    ] as const) {
      assert.match(issue(114, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(115, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(issue(114, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
    const document = fiveE(immune);
    const creatures = document.catalogs.find((one: { id: string }) => one.id === "creatures");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((one: { id: string }) =>
        one.id === "creatures" ? { ...one, entries: undefined, asset: "catalogs/creatures.json" } : one,
      ),
    };
    const paths = ["ruleset.json", "catalogs/creatures.json"];
    const files = new Map<string, unknown>([["catalogs/creatures.json", { entries: creatures.entries }]]);
    assert.match(issue(114, inFile, paths, files) ?? "", gate, "a catalog file");
    assert.doesNotMatch(issue(115, inFile, paths, files) ?? "", gate);
  }

  console.log("Exhaustion: a halved maximum, a level that defeats, opponents' tracks and immunity, gated at 1.115.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
