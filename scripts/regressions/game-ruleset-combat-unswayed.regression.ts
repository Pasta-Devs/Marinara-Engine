/**
 * A contest that leaves something on a target its user loses to, and a condition that ends as its
 * holder can't hear whoever put it on (Capability API 1.618): 5e's Pipes of the Sewers.
 *
 *   - `contest.onLose.applies`: a swarm the piper loses to can't be swayed for 24 hours, and a
 *     `targetTypes.not.holding` keeps it out after.
 *   - `endsWhenHolder.cantHearSource`: a swayed swarm that starts its turn deaf, or with its piper
 *     down, is free, and the condition's `onEnd` keeps it unswayed.
 *   - Refusals; the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unswayed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 618);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (opts: { spurned?: string; sense?: string } = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "performance", label: "Performance", value: { abilityMod: "cha" } },
      { id: "wisdom", label: "Wisdom", value: { abilityMod: "wis" } },
    );
    doc.sheet.live.conditions.push(
      { id: "piped", label: "Piped" },
      { id: "pipes_spurned", label: "Spurns the pipes" },
      { id: "stuffed_ears", label: "Stuffed ears" },
    );
    doc.combat.conditions.push(
      {
        condition: "piped",
        effects: [],
        endsWhenHolder: { cantHearSource: { sense: opts.sense ?? "hearing" } },
        onEnd: { applies: [{ condition: "pipes_spurned", duration: { rounds: 14400 } }] },
      },
      { condition: "pipes_spurned", effects: [] },
      { condition: "stuffed_ears", effects: [], lacks: ["hearing"] },
    );
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sway",
          label: "Sway",
          rows: [{ list: "spells", values: { name: "Sway", level: 0, prepared: true } }],
          mechanics: {
            kind: "debuff",
            targets: "enemy",
            budget: "action",
            range: 30,
            contest: {
              attacker: ["performance"],
              defender: ["wisdom"],
              onLose: { applies: [{ condition: opts.spurned ?? "pipes_spurned", rounds: 14400 }] },
            },
            targetTypes: { not: { holding: ["pipes_spurned"] } },
            applies: [{ condition: "piped", duration: { rounds: 600 } }],
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
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const fight = (): RulesetEncounterState => {
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
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
          }),
          live: {},
          catalogs: {},
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
    state.order = ["piper", "swarm", "bard"];
    state.turn = 0;
    return state;
  };
  const swarm = (state: RulesetEncounterState) => rulesetCombatant(state, "swarm")!;
  const holds = (state: RulesetEncounterState) => rulesetCombatConditions(definition, swarm(state));
  const sway = (state: RulesetEncounterState, dice: number[]) => {
    rulesetCombatant(state, "piper")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "piper").find((one) => one.label === "Sway")!;
    assert.ok(option, "no Sway");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "piper", optionId: option.id, targetIds: ["swarm"] },
      () => dice.shift() ?? 10,
    );
  };
  const endTurn = (state: RulesetEncounterState) => {
    const end = rulesetCombatOptions(definition, state, "piper").find((one) => one.kind === "end-turn")!;
    return applyRulesetCombatChoice(definition, state, { actorId: "piper", optionId: end.id, targetIds: [] }, () => 10)
      .state;
  };

  // ── Lost: unswayed for 24 hours, and not aimed at again ──
  {
    const step = sway(fight(), [1, 20]);
    assert.ok(holds(step.state).includes("pipes_spurned"), JSON.stringify(step.events));
    assert.ok(!holds(step.state).includes("piped"));
    const spurned = swarm(step.state).tracked.find((one) => one.condition === "pipes_spurned")!;
    assert.equal(spurned.rounds, 14400);
    assert.equal(spurned.source, "piper");
    const again = sway(step.state, [20, 1]);
    assert.ok(again.events.some((one) => one.type === "refused"));
  }
  // ── Won, then deaf as its turn starts: free, and unswayed after ──
  {
    const step = sway(fight(), [20, 1]);
    assert.ok(holds(step.state).includes("piped"));
    // Still hearing, its turn starts with the hold on.
    let state = endTurn(structuredClone(step.state));
    assert.ok(holds(state).includes("piped"));
    state = structuredClone(step.state);
    swarm(state).tracked.push({ condition: "stuffed_ears", rounds: 10 });
    state = endTurn(state);
    assert.ok(!holds(state).includes("piped"));
    assert.ok(holds(state).includes("pipes_spurned"));
  }
  // ── Its piper down: free ──
  {
    const state = sway(fight(), [20, 1]).state;
    rulesetCombatant(state, "piper")!.defeated = true;
    rulesetCombatant(state, "piper")!.health = 0;
    state.turn = 0;
    const next = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "piper", optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    assert.ok(!rulesetCombatConditions(definition, rulesetCombatant(next, "swarm")!).includes("piped"));
  }

  // ── Refusals ──
  refused(document({ spurned: "shunned" }), /Unknown condition "shunned"/);
  refused(document({ sense: "echolocation" }), /Unknown sense "echolocation"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest that leaves conditions on a target its user loses to (contest.onLose), or a condition that ends as its holder can't hear its source (endsWhenHolder.cantHearSource), requires schemaVersion 2 and capabilityApi 1.618 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(617) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(618) as never, document()), gate);
  }

  console.log(
    "contest.onLose and endsWhenHolder.cantHearSource: a lost sway leaves a swarm unswayed for 24 hours; a deaf swarm, or one whose piper is down, goes free and unswayed; refusals; gated at 1.618.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
