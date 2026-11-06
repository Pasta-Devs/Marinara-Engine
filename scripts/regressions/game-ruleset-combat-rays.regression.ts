/**
 * A ray for each target (Capability API 1.468).
 *
 *   - Prismatic Spray: a d8 for each creature it reaches picks its ray; a ray deals its own damage
 *     type or puts on its own condition; the eighth row strikes two more, an eighth rolled over;
 *     each target saves once, and every ray striking them reads it.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rays-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 468);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rows = [
    { atMost: 1, label: "Red", damageType: "fire" },
    { atMost: 2, label: "Orange", damageType: "acid" },
    { atMost: 3, label: "Yellow", damageType: "lightning" },
    { atMost: 4, label: "Green", damageType: "poison" },
    { atMost: 5, label: "Blue", damageType: "cold" },
    { atMost: 6, label: "Indigo", applies: ["restrained"] },
    { atMost: 7, label: "Violet", applies: ["blinded"] },
    { atMost: 8, label: "Special", again: 2 },
  ];
  const spray = (mechanics: Record<string, unknown> = {}) =>
    ({
      id: "spray",
      label: "Spray",
      rows: [{ list: "spells", values: { name: "Spray", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        targets: "enemy",
        range: 120,
        area: { shape: "burst", size: 10 },
        amount: { dice: "10d6" },
        damageType: "fire",
        save: { save: "dex_save", onSuccess: "half" },
        applies: [
          { condition: "restrained", duration: { rounds: 10 } },
          { condition: "blinded", duration: { rounds: 10 } },
        ],
        rays: { dice: "1d8", rows },
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (mechanics?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spray(mechanics)] });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = [spray()];
  const block: RulesetStatBlock = {
    health: 80,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  } as unknown as RulesetStatBlock;
  // The d8s come off a list in turn; d20s are `d20`, every other die a 3.
  const cast = (eights: number[], d20: number) => {
    const queue = [...eights];
    const roll = (sides: number) => (sides === 8 ? queue.shift()! : sides === 20 ? d20 : 3);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
            fields: { level: 13, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int", slots_max_1: 4 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "thug", name: "Thug", side: "enemy", block },
        { id: "ogre", name: "Ogre", side: "enemy", block },
      ],
      board: {
        grid: { width: 16, height: 12, tiles: Array.from({ length: 12 }, () => Array(16).fill("plains")) },
        placements: { mage: { x: 2, y: 8 }, thug: { x: 8, y: 8 }, ogre: { x: 9, y: 8 } },
      },
    });
    state.order = ["mage", "thug", "ogre"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Spray");
    assert.ok(option, "no Spray");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 8, y: 8 } },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    assert.equal(queue.length, 0, "every d8 rolled");
    return step;
  };
  const rays = (events: RulesetCombatEvent[], id: string) =>
    of(events, "ray")
      .filter((one) => one.targetId === id)
      .map((one) => one.ray);
  const saves = (events: RulesetCombatEvent[], id: string) =>
    of(events, "save").filter((one) => one.actorId === id).length;
  const hurt = (events: RulesetCombatEvent[], id: string) =>
    of(events, "damage")
      .filter((one) => one.targetId === id)
      .map((one) => `${(one as { damageType?: string }).damageType ?? ""}:${one.amount}`);
  const holds = (step: ReturnType<typeof cast>, id: string, condition: string) =>
    rulesetCombatant(step.state, id)!.tracked.some((one) => one.condition === condition);

  // ── Failed saves: red on the thug; special on the ogre, an eighth rolled over, green and indigo ──
  {
    const step = cast([1, 8, 8, 4, 6], 2);
    assert.deepEqual(rays(step.events, "thug"), ["Red"]);
    assert.deepEqual(rays(step.events, "ogre"), ["Special", "Green", "Indigo"]);
    assert.equal(saves(step.events, "thug"), 1);
    assert.equal(saves(step.events, "ogre"), 1, "one save for both rays");
    assert.deepEqual(hurt(step.events, "thug"), ["fire:30"], JSON.stringify(of(step.events, "damage")));
    assert.deepEqual(hurt(step.events, "ogre"), ["poison:30"]);
    assert.equal(holds(step, "ogre", "restrained"), true);
    assert.equal(holds(step, "thug", "restrained"), false);
    assert.equal(holds(step, "ogre", "blinded"), false);
  }

  // ── Saved: half damage, no condition ──
  {
    const step = cast([5, 7], 20);
    assert.deepEqual(rays(step.events, "thug"), ["Blue"]);
    assert.deepEqual(rays(step.events, "ogre"), ["Violet"]);
    assert.deepEqual(hurt(step.events, "thug"), ["cold:15"]);
    assert.deepEqual(hurt(step.events, "ogre"), []);
    assert.equal(holds(step, "ogre", "blinded"), false);
  }

  // ── Refusals ──
  refused(fiveE({ save: undefined }), /"rays" are saved against once by each target/);
  refused(
    fiveE({
      rays: {
        dice: "1d8",
        rows: [
          { atMost: 4, label: "A" },
          { atMost: 8, label: "B", applies: ["prone"] },
        ],
      },
    }),
    /A ray puts on only what the entry "applies": "prone" is not there/,
  );
  refused(
    fiveE({
      rays: {
        dice: "1d8",
        rows: [
          { atMost: 4, label: "A" },
          { atMost: 4, label: "B" },
        ],
      },
    }),
    /Rows run strictly up/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries roll a ray for each target (rays) requires schemaVersion 2 and capabilityApi 1.468 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(467) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(468) as never, fiveE()), gate);
  }

  console.log(
    "Rays: Prismatic Spray rolls a ray for each target, its own type or condition, a special ray striking two more on one save; gated at 1.468.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
