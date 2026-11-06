/**
 * A use offered only while its user holds a condition, and a condition its source keeps only while
 * holding one (Capability API 1.617): 5e's Pipes of the Sewers, whose call and sway work only while
 * their user plays them.
 *
 *   - `userHolds`: the sway is not offered until "Play" puts `piping` on its user.
 *   - `endsWhenSource.lacks`: the swayed swarm's `piped` comes off once its piper stops playing.
 *   - An item use's `usableWhen` (1.166) reads a derived value: who may play at all.
 *   - Refusals for unknown conditions; the install gate.
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-user-holds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 617);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (opts: { holds?: string; lacks?: string; proficiency?: number } = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "piping", label: "Piping" }, { id: "piped", label: "Piped" });
    doc.combat.conditions.push(
      { condition: "piping", effects: [] },
      { condition: "piped", effects: [], endsWhenSource: { lacks: [opts.lacks ?? "piping"] } },
    );
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "pipes",
          label: "Pipes of the Sewers",
          item: {
            category: "gear",
            use: {
              kind: "buff",
              budget: "action",
              label: "Play",
              targets: "self",
              usableWhen: { value: { derived: "proficiency_bonus" }, atLeast: opts.proficiency ?? 1 },
              applies: [{ condition: "piping", duration: { rounds: 1 } }],
            },
            moreUses: [
              {
                label: "Sway",
                use: {
                  kind: "debuff",
                  budget: "bonus",
                  targets: "enemy",
                  range: 30,
                  userHolds: [opts.holds ?? "piping"],
                  applies: [{ condition: "piped", duration: { rounds: 10 } }],
                },
              },
            ],
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
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const fight = (definition: RulesetDefinition): RulesetEncounterState => {
    const pipes = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "piper",
          name: "Piper",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          items: [{ item: pipes, quantity: 1, worn: false, name: "Pipes of the Sewers" }],
        },
        {
          id: "swarm",
          name: "Swarm",
          side: "enemy",
          block: {
            health: 24,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["piper", "swarm"];
    state.turn = 0;
    return state;
  };
  const piper = (state: RulesetEncounterState) => rulesetCombatant(state, "piper")!;
  const labels = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    piper(state).budgets.action = 1;
    piper(state).budgets.bonus = 1;
    return rulesetCombatOptions(definition, state, "piper").map((one) => one.label);
  };
  const take = (definition: RulesetDefinition, state: RulesetEncounterState, label: string, target: string) => {
    piper(state).budgets.action = 1;
    piper(state).budgets.bonus = 1;
    const found = rulesetCombatOptions(definition, state, "piper").find((one) => one.label === label);
    assert.ok(found, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "piper", optionId: found.id, targetIds: [target] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };

  // ── Not swayed until played; swayed while played; free once the playing stops ──
  {
    const definition = parsed(document());
    let state = fight(definition);
    const before = labels(definition, state);
    assert.ok(
      before.some((label) => /Play/.test(label)),
      before.join(", "),
    );
    assert.ok(!before.some((label) => /Sway/.test(label)), before.join(", "));
    state = take(
      definition,
      state,
      before.find((label) => /Play/.test(label))!,
      "piper",
    );
    assert.ok(rulesetCombatConditions(definition, piper(state)).includes("piping"));
    const playing = labels(definition, state);
    const sway = playing.find((label) => /Sway/.test(label));
    assert.ok(sway, playing.join(", "));
    state = take(definition, state, sway, "swarm");
    const swarm = () => rulesetCombatConditions(definition, rulesetCombatant(state, "swarm")!);
    assert.ok(swarm().includes("piped"));
    // The playing stops: the sway goes with it, and is not offered again.
    piper(state).tracked = piper(state).tracked.filter((one) => one.condition !== "piping");
    piper(state).sheet!.live.conditions = (piper(state).sheet!.live.conditions ?? []).filter((id) => id !== "piping");
    const end = rulesetCombatOptions(definition, state, "piper").find((one) => one.kind === "end-turn")!;
    state = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "piper", optionId: end.id, targetIds: [] },
      () => 10,
    ).state;
    assert.ok(!swarm().includes("piped"));
  }
  // ── Who may play at all: a derived value at least what it asks ──
  {
    const definition = parsed(document({ proficiency: 9 }));
    assert.ok(!labels(definition, fight(definition)).some((label) => /Play/.test(label)));
  }

  // ── Refusals ──
  refused(document({ holds: "humming" }), /Unknown condition "humming"/);
  refused(document({ lacks: "humming" }), /Unknown condition "humming"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a use offered only while its user holds a condition (userHolds), or a condition its source keeps only while holding one (endsWhenSource.lacks), requires schemaVersion 2 and capabilityApi 1.617 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(616) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(617) as never, document()), gate);
  }

  console.log(
    "userHolds and endsWhenSource.lacks: the Pipes' sway only while played, its hold gone once the playing stops; usableWhen for who may play; refusals; gated at 1.617.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
