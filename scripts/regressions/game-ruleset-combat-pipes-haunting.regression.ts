/**
 * An item's use that needs senses, and an area spent once on each (Capability API 1.628): 5e's Pipes
 * of Haunting, "Each creature within 30 feet of you that hears you play must succeed on a DC 15
 * Wisdom saving throw or become frightened ... A creature that succeeds on its saving throw is immune
 * to the effect of these pipes for 24 hours."
 *
 *   - Its burst passes over its user's own side (`friendlyFire: false`) and over the deafened.
 *   - Whoever made their save is passed over by the next use, until a long rest.
 *   - The install gate.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pipes-haunting-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 628);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.conditions.push({ condition: "deafened", effects: [], lacks: ["hearing"] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "pipes",
          label: "Pipes of Haunting",
          item: {
            category: "gear",
            use: {
              kind: "debuff",
              budget: "action",
              label: "Play",
              area: { shape: "burst", size: 30, around: true },
              friendlyFire: false,
              needs: ["hearing"],
              save: { save: "wis_save", onSuccess: "negates" },
              saveDifficulty: 15,
              applies: [{ condition: "frightened", duration: { rounds: 10 } }],
              oncePerTarget: { until: "long", whenSaved: true },
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const pipes = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const goblin = (): RulesetStatBlock =>
    ({ health: 10, defense: 12, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const start = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 13, speed: 30, hp_max: 30 },
          }),
          items: [{ item: pipes, quantity: 1, worn: false, name: "Pipes of Haunting" }],
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 13, speed: 30, hp_max: 30 },
          }),
        },
        { id: "steady", name: "Steady Goblin", side: "enemy", block: goblin() },
        { id: "shaky", name: "Shaky Goblin", side: "enemy", block: goblin() },
        { id: "deaf", name: "Deaf Goblin", side: "enemy", block: goblin() },
      ],
    });
    state.order = ["bard", "friend", "steady", "shaky", "deaf"];
    state.turn = 0;
    rulesetCombatant(state, "deaf")!.tracked.push({ condition: "deafened", rounds: null } as never);
    return state;
  };
  const frightened = (state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes("frightened");
  const saves = (events: RulesetCombatEvent[]) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save")
      .map((one) => one.actorId);
  /** Plays, the steady goblin's d20 a 19 and everybody else's a 2. */
  const play = (state: RulesetEncounterState) => {
    const working = structuredClone(state);
    working.turn = 0;
    rulesetCombatant(working, "bard")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, working, "bard").find((one) => one.label.includes("Play"));
    assert.ok(
      option,
      rulesetCombatOptions(definition, working, "bard")
        .map((one) => one.label)
        .join(", "),
    );
    let d20 = 0;
    const faces = [19, 2, 2, 2];
    const step = applyRulesetCombatChoice(
      definition,
      working,
      { actorId: "bard", optionId: option.id, targetIds: [] },
      (sides: number) => (sides === 20 ? faces[d20++ % faces.length]! : 3),
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };

  // ── Only hostile creatures that hear it ──
  const first = play(start());
  assert.deepEqual(saves(first.events), ["steady", "shaky"], JSON.stringify(first.events));
  assert.ok(!frightened(first.state, "steady"), "saved");
  assert.ok(frightened(first.state, "shaky"));
  assert.ok(!frightened(first.state, "deaf"), "never heard it");
  assert.ok(!frightened(first.state, "friend"), "its user's own side is spared");

  // ── Whoever saved is passed over next time ──
  const calm = structuredClone(first.state);
  for (const id of ["shaky"]) {
    const one = rulesetCombatant(calm, id)!;
    one.tracked = one.tracked.filter((entry) => entry.condition !== "frightened");
  }
  const second = play(calm);
  assert.deepEqual(saves(second.events), ["shaky"], JSON.stringify(second.events));

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item use that needs senses (use.needs) or an entry once a target over an area (oncePerTarget with area) requires schemaVersion 2 and capabilityApi 1.628 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(627) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(628) as never, document()), gate);
  }

  console.log(
    "Pipes of Haunting: an item use that needs hearing passes over the deafened and its user's side; whoever saved is passed over next time; gated at 1.628.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
