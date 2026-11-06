/**
 * What a condition leaves behind only as it ends some ways (Capability API 1.632): 5e's Pipes of the
 * Sewers, "If a friendly swarm starts its turn and can't hear the pipes' music, your control over that
 * swarm ends, and the swarm ... can't be swayed by the pipes' music for the next 24 hours."
 *
 *   - `onEnd.when: ["cantHearSource"]`: a swayed swarm that can't hear its piper is free and unswayed.
 *   - One whose piper merely stops playing (`endsWhenSource.lacks`) is free, and nothing more.
 *   - `when: ["endsWhenSource"]` the other way round; refusals; the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-on-end-when-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 632);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (opts: { when?: string[] } = { when: ["cantHearSource"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "performance", label: "Performance", value: { abilityMod: "cha" } },
      { id: "wisdom", label: "Wisdom", value: { abilityMod: "wis" } },
    );
    doc.sheet.live.conditions.push(
      { id: "piped", label: "Piped" },
      { id: "pipes_spurned", label: "Spurns the pipes" },
      { id: "stuffed_ears", label: "Stuffed ears" },
      { id: "piping", label: "Piping" },
    );
    doc.combat.conditions.push(
      {
        condition: "piped",
        effects: [],
        endsWhenHolder: { cantHearSource: { sense: "hearing" } },
        endsWhenSource: { lacks: ["piping"] },
        onEnd: { when: opts.when, applies: [{ condition: "pipes_spurned", duration: { rounds: 14400 } }] },
      },
      { condition: "piping", effects: [] },
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
              onLose: { applies: [{ condition: "pipes_spurned", rounds: 14400 }] },
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
  const fight = (def = definition): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: def,
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
  const sway = (state: RulesetEncounterState, dice: number[], def = definition) => {
    rulesetCombatant(state, "piper")!.budgets.action = 1;
    const option = rulesetCombatOptions(def, state, "piper").find((one) => one.label === "Sway")!;
    assert.ok(option, "no Sway");
    return applyRulesetCombatChoice(
      def,
      state,
      { actorId: "piper", optionId: option.id, targetIds: ["swarm"] },
      () => dice.shift() ?? 10,
    );
  };
  const endTurn = (state: RulesetEncounterState, def = definition) => {
    const end = rulesetCombatOptions(def, state, "piper").find((one) => one.kind === "end-turn")!;
    return applyRulesetCombatChoice(def, state, { actorId: "piper", optionId: end.id, targetIds: [] }, () => 10).state;
  };

  const playing = (state: RulesetEncounterState) => {
    rulesetCombatant(state, "piper")!.tracked.push({ condition: "piping", rounds: null } as never);
    return state;
  };

  // ── Unheard: free, and unswayed after ──
  {
    let state = sway(playing(fight()), [20, 1]).state;
    assert.ok(holds(state).includes("piped"));
    swarm(state).tracked.push({ condition: "stuffed_ears", rounds: 10 });
    state = endTurn(state);
    assert.ok(!holds(state).includes("piped"));
    assert.ok(holds(state).includes("pipes_spurned"), "it could not hear the pipes");
  }
  // ── Its piper stops playing: free, and nothing left behind ──
  {
    const state = sway(playing(fight()), [20, 1]).state;
    assert.ok(holds(state).includes("piped"));
    const piper = rulesetCombatant(state, "piper")!;
    piper.tracked = piper.tracked.filter((one) => one.condition !== "piping");
    const next = endTurn(state);
    assert.ok(!holds(next).includes("piped"), "ended with the music");
    assert.ok(!holds(next).includes("pipes_spurned"), "the pipes never said so");
  }
  // ── Named the other way, the other way round ──
  {
    const other = parsed(document({ when: ["endsWhenSource"] }));
    const state = sway(playing(fight(other)), [20, 1], other).state;
    const piper = rulesetCombatant(state, "piper")!;
    piper.tracked = piper.tracked.filter((one) => one.condition !== "piping");
    const next = endTurn(state, other);
    assert.ok(rulesetCombatConditions(other, swarm(next)).includes("pipes_spurned"));
  }

  // ── Refusals ──
  refused(document({ when: ["forgotten"] }), /when/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition leaving something behind only as it ends some ways (onEnd.when) requires schemaVersion 2 and capabilityApi 1.632 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(631) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(632) as never, document()), gate);
  }

  console.log(
    "onEnd.when: a swarm that can't hear its piper goes free and unswayed, one whose piper stops only free; the other way round when named so; gated at 1.632.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
