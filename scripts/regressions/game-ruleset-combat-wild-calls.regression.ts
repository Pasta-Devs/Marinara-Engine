/**
 * Called creatures under nobody's control, tamed while they hold a condition (Capability API
 * 1.615): Pipes of the Sewers, "Called swarms move toward the music by the shortest available route
 * but aren't under your control otherwise".
 *
 *   - One to three swarms, one a charge spent (`chargeStep` with the call's `perStep`).
 *   - Untamed, a swarm's turn is only a walk toward its caller; it keeps no side standing.
 *   - Holding `tamedWhile`, it takes its turn as any called creature does.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetEncounterOutcome,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wild-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 615);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rats = {
    id: "rats",
    label: "Swarm of Rats",
    creature: {
      health: 24,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1",
      actions: [{ id: "bites", name: "Bites", budget: "action", toHit: 2, damage: { flat: 7 }, reach: 5 }],
    },
  };
  const pipesCall: Record<string, unknown> = {
    creature: "creatures/rats",
    count: { flat: 1 },
    perStep: 1,
    side: "none",
    tamedWhile: "piped",
  };
  const document = (calls: Record<string, unknown> = pipesCall) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.sheet.live.conditions.push({ id: "piped", label: "Piped" });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(rats));
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
            stack: 1,
            charges: { max: 3 },
            use: {
              kind: "utility",
              targets: "self",
              budget: "bonus",
              label: "Call",
              charges: 1,
              chargeStep: { max: 2 },
              calls,
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
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const pipes = (definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0] as RulesetCatalogEntry)
    .item!;
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [{ item: pipes, quantity: 1, worn: true, name: "Pipes of the Sewers" }],
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 100, defense: 10, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
      board: {
        grid: { width: 30, height: 5, tiles: Array.from({ length: 5 }, () => Array(30).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, brute: { x: 28, y: 2 } },
      },
    });
    for (const one of state.combatants) one.initiative = { ada: 20, brute: 1 }[one.id]!;
    state.order = ["ada", "brute"];
    state.turn = 0;
    return state;
  };
  const pipe = (payWith?: string) => {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "ada").find((one) => /Call/.test(one.label));
    assert.ok(option, "the pipes");
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: option.id, targetIds: [], ...(payWith ? { payWith } : {}) },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return { state: taken.state, ids: of(taken.events, "called")[0]?.ids ?? [], option };
  };

  // ── One swarm a charge ──
  {
    const one = pipe();
    assert.equal(one.ids.length, 1);
    assert.ok((one.option.payWith ?? []).length >= 2, JSON.stringify(one.option.payWith));
    assert.equal(pipe(one.option.payWith![1]).ids.length, 3, "three charges, three swarms");
  }
  // ── Untamed: only walking toward the piper; nobody's side ──
  {
    const { state, ids } = pipe();
    const swarm = rulesetCombatant(state, ids[0]!)!;
    assert.ok(swarm.calledWild);
    // Far off, as if it came from the sewers.
    swarm.x = 20;
    swarm.y = 2;
    const turn = (from: RulesetEncounterState, id: string) => {
      from.turn = from.order.indexOf(id) - 1;
      if (from.turn < 0) from.turn = from.order.length - 1;
      return applyRulesetCombatChoice(
        definition,
        from,
        { actorId: from.order[from.turn]!, optionId: "end-turn", targetIds: [] },
        roll,
      );
    };
    const walked = turn(structuredClone(state), swarm.id);
    assert.deepEqual(
      of(walked.events, "skip").map((one) => [one.actorId, one.reason]),
      [[swarm.id, "wild"]],
    );
    const drawn = of(walked.events, "drawn");
    assert.equal(drawn.length, 1);
    assert.ok(drawn[0]!.to.x < 20, "nearer the piper");
    assert.notEqual(walked.state.order[walked.state.turn], swarm.id, "and its turn is over");
    // It keeps no side standing: the party down, the fight is lost.
    const lost = structuredClone(state);
    rulesetCombatant(lost, "ada")!.defeated = true;
    assert.equal(rulesetEncounterOutcome(lost), "defeat");
    // ── Piped: its own turn ──
    const piped = structuredClone(state);
    rulesetCombatant(piped, swarm.id)!.tracked.push({ condition: "piped", rounds: 1 });
    const tame = turn(piped, swarm.id);
    assert.deepEqual(of(tame.events, "skip"), []);
    assert.equal(tame.state.order[tame.state.turn], swarm.id, "its turn to take");
  }

  // ── Refusals ──
  refused(document({ ...pipesCall, tamedWhile: "nope" }), /Unknown condition "nope"/);
  refused(document({ ...pipesCall, side: undefined }), /Only a call whose creatures are under nobody's control/);

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a call whose creatures are under nobody\'s control (calls.side "none", calls.tamedWhile) requires schemaVersion 2 and capabilityApi 1.615 or newer';
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(614) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(615) as never, document()), gate);
  }

  console.log(
    "Pipes of the Sewers: a swarm a charge, untamed only walking to the piper, tamed while piped; gated at 1.615.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
