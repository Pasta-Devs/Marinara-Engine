/**
 * Hanging on that ends its condition, and wards off being slain outright (Capability API 1.596):
 * 5e's Death Ward.
 *
 *   - `ends`: once it works, the condition it is on is over; the next blow that drops them drops them.
 *   - `outright`: Power Word Kill's `kills` and Divine Word's `killsAtMost` are undone once, nothing of
 *     them taking; the next one slays. One with no ward is slain.
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
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-death-ward-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 596);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics: { targets: "enemy", range: 60, budget: "action", ...mechanics },
  });
  const spells = [
    spell("kill", "Kill", { kind: "debuff", kills: true, healthAtMost: 100 }),
    spell("word", "Word", {
      kind: "debuff",
      save: { save: "cha_save", onSuccess: "negates" },
      applies: [{ condition: "deafened", duration: { rounds: 10 }, targetHealthAtMost: 50 }],
      killsAtMost: 20,
    }),
    spell("bolt", "Bolt", { kind: "attack", autoHit: true, amount: { flat: 100 }, damageType: "fire" }),
  ];
  const ward = { uses: 1, ends: true, outright: true, label: "Death Ward" };
  const fiveE = (hangsOn: Record<string, unknown> = ward, edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    doc.sheet.live.conditions.push({ id: "death_ward", label: "Death Ward" });
    doc.combat.conditions.push({ condition: "death_ward", effects: [], hangsOn });
    if (!doc.sheet.live.conditions.some((one: { id: string }) => one.id === "deafened"))
      doc.sheet.live.conditions.push({ id: "deafened", label: "Deafened" });
    if (!doc.combat.conditions.some((one: { condition: string }) => one.condition === "deafened"))
      doc.combat.conditions.push({ condition: "deafened", effects: [] });
    edit(doc);
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
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (health: number): RulesetStatBlock =>
    ({ health, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 1 : 3);
  const fight = (): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 10, cha: 10 },
            fields: { level: 17, ac: 12, speed: 30, hp_max: 90, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "warded", name: "Warded", side: "enemy", block: block(50) },
        { id: "low", name: "Low", side: "enemy", block: block(15) },
        { id: "bare", name: "Bare", side: "enemy", block: block(50) },
      ],
    });
    state.order = ["mage", "warded", "low", "bare"];
    state.turn = 0;
    for (const id of ["warded", "low"])
      rulesetCombatant(state, id)!.tracked.push({ condition: "death_ward", rounds: 4800 });
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const warded = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.some((one) => one.condition === "death_ward");
  const cast = (state: RulesetEncounterState, label: string, target: string) => {
    state.turn = 0;
    who(state, "mage").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };

  // ── Power Word Kill: undone once, the ward gone; the next slays ──
  {
    const first = cast(fight(), "Kill", "warded");
    assert.deepEqual(of(first.events, "slain"), []);
    assert.deepEqual(
      of(first.events, "hangsOn").map((one) => [one.actorId, one.outright, one.label]),
      [["warded", true, "Death Ward"]],
    );
    assert.ok(!who(first.state, "warded").defeated);
    assert.equal(who(first.state, "warded").health!.value, 50, "nothing of it took");
    assert.ok(!warded(first.state, "warded"), "the ward is over");
    const again = cast(first.state, "Kill", "warded");
    assert.equal(of(again.events, "slain").length, 1);
    assert.equal(who(again.state, "warded").defeated, true);
    // With no ward, slain.
    const bare = cast(fight(), "Kill", "bare");
    assert.equal(who(bare.state, "bare").defeated, true);
  }

  // ── Divine Word at 20 or fewer: undone, and nothing else of it goes on ──
  {
    const first = cast(fight(), "Word", "low");
    assert.deepEqual(of(first.events, "slain"), []);
    assert.equal(of(first.events, "hangsOn").length, 1);
    assert.ok(!who(first.state, "low").tracked.some((one) => one.condition === "deafened"), "not deafened");
    assert.ok(!warded(first.state, "low"));
    const again = cast(first.state, "Word", "low");
    assert.equal(who(again.state, "low").defeated, true);
  }

  // ── Dropped to 0 by damage: left at 1, the ward over; the next blow drops them ──
  {
    const first = cast(fight(), "Bolt", "warded");
    assert.equal(who(first.state, "warded").health!.value, 1);
    assert.deepEqual(
      of(first.events, "hangsOn").map((one) => [one.actorId, one.outright]),
      [["warded", undefined]],
    );
    assert.ok(!warded(first.state, "warded"));
    const again = cast(first.state, "Bolt", "warded");
    assert.equal(who(again.state, "warded").health!.value, 0);
    assert.deepEqual(of(again.events, "hangsOn"), []);
  }

  // ── Without `outright`, Power Word Kill slays through it; without `ends`, it stays on ──
  {
    const plain = parsed(fiveE({ uses: 1 }));
    const state = fight();
    const option = rulesetCombatOptions(plain, state, "mage").find((one) => one.label === "Kill")!;
    const step = applyRulesetCombatChoice(
      plain,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["warded"] },
      roll,
    );
    assert.equal(who(step.state, "warded").defeated, true);
    const kept = parsed(fiveE({ uses: 1, outright: true }));
    const other = fight();
    const killing = rulesetCombatOptions(kept, other, "mage").find((one) => one.label === "Kill")!;
    const spared = applyRulesetCombatChoice(
      kept,
      other,
      { actorId: "mage", optionId: killing.id, targetIds: ["warded"] },
      roll,
    );
    assert.ok(!who(spared.state, "warded").defeated);
    assert.ok(warded(spared.state, "warded"), "still on, its use spent");
  }

  // ── Refusals ──
  refused(
    fiveE({ uses: 1, outright: true, save: { save: "con_save", difficulty: 10 } }),
    /"outright" works against what deals no damage, so it reads no blow/,
  );
  refused(
    fiveE(ward, (doc) => {
      doc.combat.levels = [{ track: "exhaustion", at: 1, hangsOn: { uses: 1, ends: true } }];
    }),
    /"ends" ends the combat condition it is on, so it goes on one/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with hanging on that ends its condition or wards off being slain outright (hangsOn ends, outright) requires schemaVersion 2 and capabilityApi 1.596 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(595) as never, fiveE()), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(595) as never, fiveE({ uses: 1, ends: true })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(596) as never, fiveE()), gate);
  }

  console.log(
    "Death Ward: Power Word Kill and Divine Word undone once, the ward over; at 0 left at 1 and the ward over; gated at 1.596.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
