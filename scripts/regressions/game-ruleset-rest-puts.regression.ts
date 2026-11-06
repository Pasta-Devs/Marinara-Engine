/**
 * A rest that puts a condition on (Capability API 1.426).
 *
 *   - Tranquility: a long rest puts it on an 18th-level monk's sheet, and not before; the next long
 *     rest puts it back fresh.
 *   - Held on the sheet, it keeps a foe's claw off as a sanctuary does, its difficulty off the sheet.
 *   - Its rule ends it on its holder's attack or a cast that reaches a foe, and takes it off the
 *     sheet; a heal on a friend keeps it.
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
  applyRulesetSheetOp,
  rowsFromCatalogEntry,
  rulesetCombatConditions,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-puts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 426);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics,
  });
  const spells = [
    spell("mend", "Mend", { kind: "heal", targets: "ally", range: 30, amount: { flat: 3 } }),
    spell("sting", "Sting", {
      kind: "attack",
      autoHit: true,
      targets: "enemy",
      range: 60,
      damageType: "fire",
      amount: { flat: 2 },
    }),
    spell("flare", "Flare", {
      kind: "attack",
      autoHit: true,
      range: 60,
      damageType: "fire",
      area: { shape: "burst", size: 5 },
      amount: { flat: 2 },
      save: { save: "dex_save", onSuccess: "half" },
    }),
  ] as unknown as RulesetCatalogEntry[];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push({ id: "tranquility", label: "Tranquility" });
    doc.combat.conditions.push({
      condition: "tranquility",
      effects: [],
      sanctuary: { save: "wis_save", difficulty: { derived: "tranquil_dc" } },
      endsWhenHolder: { attacks: true, casts: ["spells"], castsAtFoes: true },
    });
    doc.sheet.derived.push({
      id: "tranquil_dc",
      label: "Tranquility DC",
      op: "sum",
      of: [{ const: 8 }, { abilityMod: "wis" }, { derived: "proficiency_bonus" }],
    });
    const long = doc.rests.find((rest: { id: string }) => rest.id === "long");
    long.clear = { ...long.clear, conditions: ["tranquility"] };
    long.puts = [{ condition: "tranquility", when: { value: { field: "level" }, atLeast: 18 } }];
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
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
  const spellRows = spells.flatMap((entry) =>
    rowsFromCatalogEntry("spells", entry).flatMap((one) => (one.list === "spells" ? [one.row] : [])),
  );
  const caster = (level = 18) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
      fields: { level, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
      lists: { spells: spellRows },
    });
  const block = (): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      saves: { wis_save: 0, dex_save: 0 },
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 4 }, reach: 5 },
        {
          id: "glare",
          name: "Glare",
          budget: "action",
          damage: { count: 0, sides: 0, flat: 3 },
          range: 30,
          save: { save: "con_save", difficulty: 30, onSuccess: "half" },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  const roller = (sides: number) => (sides === 20 ? 10 : 1);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: caster(),
          live: { conditions: ["tranquility"] },
          catalogs: { spells },
        },
        { id: "ally", name: "Ally", side: "party", build: caster(), live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        { id: "far", name: "Far", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { hero: { x: 5, y: 5 }, ally: { x: 7, y: 5 }, foe: { x: 6, y: 5 }, far: { x: 10, y: 9 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, actorId: string, label: string, choice: Partial<RulesetCombatChoice>) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} can ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], ...choice },
      roller,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) => rulesetCombatConditions(definition, who(state, id));

  // ── A long rest puts it on an 18th-level sheet, and puts it back fresh ──
  {
    const rested = (level: number, live: unknown = {}) => {
      const result = applyRulesetSheetOp(definition, caster(level), live, { op: "rest", rest: "long" });
      assert.ok(result.ok, JSON.stringify(result));
      return result;
    };
    const on = rested(18);
    assert.deepEqual(on.ok && on.live.conditions, ["tranquility"]);
    assert.match(on.ok ? on.now : "", /Tranquility on/);
    const early = rested(17);
    assert.deepEqual(early.ok ? (early.live.conditions ?? []) : null, [], "not before 18th level");
    const again = rested(18, { conditions: ["tranquility"] });
    assert.deepEqual(again.ok && again.live.conditions, ["tranquility"], "put back once, not twice");
  }

  // ── Held on the sheet, it keeps a claw off: Wisdom 16 and proficiency 6 make 17 ──
  {
    const claw = act(fight(), "foe", "Claw", { targetIds: ["hero"] });
    assert.deepEqual(
      of(claw.events, "save").map((one) => [one.actorId, one.difficulty, one.success]),
      [["foe", 17, false]],
    );
    assert.deepEqual(
      of(claw.events, "sanctuary").map((one) => [one.holderId, one.to]),
      [["hero", "ally"]],
    );
  }

  // ── Its rule ends it on an attack or a cast at a foe, off the sheet too; a heal keeps it ──
  {
    const mended = act(fight(), "hero", "Mend", { targetIds: ["ally"] });
    assert.ok(holds(mended.state, "hero").includes("tranquility"), "a heal on a friend keeps it");
    const stung = act(fight(), "hero", "Sting", { targetIds: ["far"] });
    assert.ok(!holds(stung.state, "hero").includes("tranquility"), "a cast at a foe ends it");
    assert.ok(
      !(who(stung.state, "hero").sheet?.live as { conditions?: string[] } | undefined)?.conditions?.includes(
        "tranquility",
      ),
      "and takes it off the sheet",
    );
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.rests.find((rest: { id: string }) => rest.id === "long").puts = [{ condition: "nothing_here" }];
      }),
      /Unknown condition "nothing_here"/,
    );
    refused(
      document((doc) => {
        doc.rests.find((rest: { id: string }) => rest.id === "long").puts = [
          { condition: "tranquility", when: { value: { derived: "no_such" }, atLeast: 1 } },
        ];
      }),
      /no_such/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).endsWhenHolder = { attacks: true, castsAtFoes: true };
      }),
      /"castsAtFoes" narrows "casts"/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).endsWhenHolder = { casts: ["nothing_here"] };
      }),
      /Unknown catalog "nothing_here"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose rests put a condition on (puts) or whose conditions' rules end on their holder's attack or cast (endsWhenHolder attacks, casts) requires schemaVersion 2 and capabilityApi 1.426 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(425) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(426) as never, document()), gate);
    const putsOnly = document((doc) => {
      doc.combat.conditions.at(-1).endsWhenHolder = { acts: true };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(425) as never, putsOnly), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(425) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Rest puts: a long rest puts Tranquility on an 18th-level sheet and back fresh; held on the sheet it keeps a claw off with its difficulty off the sheet; its rule ends it on a cast at a foe and takes it off the sheet, a heal on a friend keeps it; gated at 1.426.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
