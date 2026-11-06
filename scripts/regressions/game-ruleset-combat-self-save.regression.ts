/**
 * A use whose user saves against what it puts on them (Capability API 1.693): 5e's Dust of Sneezing
 * and Choking, its thrower caught in the cloud with everybody else, saving at the same difficulty.
 *
 *   - Failing the save, the user takes `appliesSelf`; making it, they do not, and the log shows the save.
 *   - Without `appliesSelfSaves`, `appliesSelf` goes on as before, with no save.
 *   - Refused without a save or without `appliesSelf`, and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-self-save-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 693);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (more: Record<string, unknown> = { appliesSelfSaves: true }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sneezing",
          label: "Sneezing Dust",
          rows: [{ list: "spells", values: { name: "Sneezing Dust", level: 5, prepared: true } }],
          mechanics: {
            kind: "debuff",
            targets: "enemy",
            budget: "action",
            range: 30,
            save: { save: "con_save", onSuccess: "negates" },
            applies: [{ condition: "poisoned", duration: { rounds: 2 } }],
            appliesSelf: [{ condition: "poisoned", duration: { rounds: 2 } }],
            ...more,
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const throwDust = (definition: RulesetDefinition, con: number) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
            lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 9, ac: 16, speed: 30, hp_max: 60 },
          }),
          live: {},
        },
        {
          id: "orc",
          name: "Orc",
          side: "enemy",
          block: { health: 15, defense: 13, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    } as never);
    state.order = ["wizard", "fighter", "orc"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Sneezing Dust");
    assert.ok(option, "offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["orc"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };
  const poisoned = (step: ReturnType<typeof throwDust>, id: string) =>
    rulesetCombatant(step.state, id)!.tracked.some((one) => one.condition === "poisoned");
  const ownSaves = (step: ReturnType<typeof throwDust>) =>
    of(step.events, "save").filter((one) => one.actorId === "wizard");

  const definition = parsed(document());
  // ── Failed: 10 + 1 against the spell's 16, the thrower coughs too ──
  {
    const failed = throwDust(definition, 12);
    assert.equal(poisoned(failed, "wizard"), true);
    const orcs = of(failed.events, "save").filter((one) => one.actorId === "orc");
    assert.equal(orcs[0]?.difficulty, 16);
    assert.deepEqual(
      ownSaves(failed).map((one) => [one.save, one.difficulty, one.success]),
      [["con_save", 16, false]],
      "the same difficulty",
    );
  }
  // ── Made: 10 + 6 meets 16, the thrower is spared ──
  {
    const made = throwDust(definition, 22);
    assert.equal(poisoned(made, "wizard"), false);
    assert.deepEqual(
      ownSaves(made).map((one) => one.success),
      [true],
    );
  }
  // ── Without it, as before: no save, and on ──
  {
    const plain = throwDust(parsed(document({})), 20);
    assert.equal(poisoned(plain, "wizard"), true);
    assert.deepEqual(ownSaves(plain), []);
  }

  // ── Refused ──
  {
    const noSave = document();
    delete noSave.catalogs.at(-1).entries[0].mechanics.save;
    refused(noSave, /"appliesSelfSaves" rolls its "save" against its "appliesSelf", so it needs both/);
    const noSelf = document();
    delete noSelf.catalogs.at(-1).entries[0].mechanics.appliesSelf;
    refused(noSelf, /"appliesSelfSaves" rolls its "save" against its "appliesSelf", so it needs both/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a use whose user saves against what it puts on them (appliesSelfSaves) requires schemaVersion 2 and capabilityApi 1.693 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(692) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(693) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(692) as never, document({})), gate);
  }

  console.log(
    "Self save: the thrower saves against its own dust at its difficulty, spared on a success; gated at 1.693.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
