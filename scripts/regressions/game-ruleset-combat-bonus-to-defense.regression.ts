/**
 * A weapon's bonus moved to its wielder's defense (Capability API 1.737): a Defender's +3.
 *
 *   - Before the first attack with it on a turn, 1 to 3 of its bonus may go to defense, for nothing:
 *     its attacks that turn lose it, and defense keeps it until the start of the wielder's next turn.
 *   - Not after an attack with it this turn, nor twice a turn; the weapon has it back next turn.
 *   - Import and the install gate.
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
  rulesetDefenseAgainst,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-bonus-to-defense-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 737);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const defender = (shift: unknown = { upTo: 3, label: "Defender" }) => ({
    category: "blade",
    slots: { hands: 1 },
    stack: 1,
    attack: {
      budget: "action",
      toHit: { bonus: 3 },
      damage: { dice: "1d8", bonus: 3, type: "slashing" },
      ...(shift !== null ? { bonusToDefense: shift } : {}),
    },
  });
  const document = (shift?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "blade", label: "Blade" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "defender", label: "Defender", item: defender(shift) }],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document({ upTo: 3, label: "Defender" }));
  const combat = definition.combat!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const ogre = {
    health: 500,
    defense: 1,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  } as unknown as RulesetStatBlock;
  let state: RulesetEncounterState = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "hero",
        name: "Hero",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          lists: {},
        }),
        live: {},
        items: [
          {
            name: "Defender",
            quantity: 1,
            worn: true,
            item: defender() as unknown as RulesetCatalogItem,
            stack: { id: "st", ref: "gear/defender" },
          },
        ],
      },
      { id: "ogre", name: "Ogre", side: "enemy", block: ogre },
    ],
  });
  state.order = ["hero", "ogre"];
  state.turn = 0;
  const step = (choice: Partial<RulesetCombatChoice> & { optionId: string; actorId: string }) => {
    const result = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice }, () => 10);
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    state = result.state;
    return result.events;
  };
  const hero = () => rulesetCombatant(state, "hero")!;
  const sword = () => hero().actions.find((one) => one.id === "item:0")!;
  const shifts = () =>
    rulesetCombatOptions(definition, state, "hero")
      .filter((one) => one.id.startsWith("shift:"))
      .map((one) => one.label);
  const defense = () =>
    rulesetDefenseAgainst(definition, combat, state, hero(), rulesetCombatant(state, "ogre")).defense;

  const baseHit = sword().toHit!;
  const baseFlat = sword().damage!.flat;
  const baseDefense = defense();
  assert.deepEqual(shifts(), ["Defender: 1 to defense", "Defender: 2 to defense", "Defender: 3 to defense"]);

  // ── 2 of it to defense, for nothing ──
  step({ actorId: "hero", optionId: "shift:0:2" });
  assert.equal(sword().toHit, baseHit - 2);
  assert.equal(sword().damage!.flat, baseFlat - 2);
  assert.equal(defense(), baseDefense + 2);
  assert.deepEqual(shifts(), [], "once a turn");
  assert.equal(hero().budgets.action, 1, "free");

  // ── It holds through the foe's turn, and comes back at the hero's next ──
  step({ actorId: "hero", optionId: "item:0", targetIds: ["ogre"] });
  step({ actorId: "hero", optionId: "end-turn" });
  assert.equal(state.order[state.turn], "ogre");
  assert.equal(defense(), baseDefense + 2, "until the start of the wielder's next turn");
  step({ actorId: "ogre", optionId: "end-turn" });
  assert.equal(state.order[state.turn], "hero");
  assert.equal(defense(), baseDefense);
  assert.equal(sword().toHit, baseHit);
  assert.equal(sword().damage!.flat, baseFlat);

  // ── Not after an attack with it this turn ──
  assert.equal(shifts().length, 3);
  step({ actorId: "hero", optionId: "item:0", targetIds: ["ogre"] });
  assert.deepEqual(shifts(), []);

  // ── Refused out of range ──
  for (const bad of [{ upTo: 0 }, { upTo: 11 }, { upTo: 2, extra: true }]) {
    assert.equal(parseRulesetDefinition(document(bad)).ok, false, JSON.stringify(bad));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a weapon whose bonus may go to its wielder's defense (attack.bonusToDefense) requires schemaVersion 2 and capabilityApi 1.737 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(736) as never, document({ upTo: 3 })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(737) as never, document({ upTo: 3 })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(736) as never, document(null)), gate);
  }

  console.log(
    "Bonus to defense: a Defender lends 1 to 3 of its +3 to defense before its first attack a turn, back at its wielder's next turn; gated at 1.737.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
