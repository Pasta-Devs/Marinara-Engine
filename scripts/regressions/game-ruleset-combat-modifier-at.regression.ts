/**
 * A change at targets that are something (Capability API 1.726): 5e's Demon Armor.
 *
 *   - A modifier to the holder's own attacks or damage with `at` reaches only targets that are that.
 *   - Import refusals and the install gate.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-modifier-at-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 726);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const armor = [
    { to: "attacks", mode: "disadvantage", at: { tags: ["demon"] } },
    { to: "damage", flat: 5, at: { tags: ["demon"] } },
  ];
  const fiveE = (modifiers: unknown[] = armor): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: [
        { id: "humanoid", label: "Humanoid" },
        { id: "fiend", label: "Fiend" },
      ],
      tags: [{ id: "demon", label: "Demon" }],
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "demon_armor", label: "Demon Armor" });
    doc.combat.conditions.push({ condition: "demon_armor", effects: [], modifiers });
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
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const strike = (targetId: string) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "knight",
          name: "Knight",
          side: "party",
          block: block({
            keepsOn: ["demon_armor"],
            actions: [
              { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 3 } },
            ],
          }),
        },
        { id: "vrock", name: "Vrock", side: "enemy", block: block({ type: "fiend", tags: ["demon"] }) },
        { id: "bandit", name: "Bandit", side: "enemy", block: block() },
      ],
    });
    state.order = ["knight", "vrock", "bandit"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "knight").find((one) => one.label === "Claw");
    assert.ok(option, "no Claw");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "knight", optionId: option.id, targetIds: [targetId] },
      () => 10,
    );
    const attack = of(step.events, "attack")[0]!;
    const damage = of(step.events, "damage")[0];
    return { mode: attack.mode, amount: damage?.amount };
  };

  // ── Against a demon: disadvantage, and 5 more damage ──
  assert.deepEqual(strike("vrock"), { mode: "disadvantage", amount: 8 });
  // ── Against anybody else: as always ──
  assert.deepEqual(strike("bandit"), { mode: "normal", amount: 3 });

  // ── Worn, and the other way round: a Ring of Elemental Command ──
  // Advantage on its wearer's attacks at the linked elementals, and theirs at its wearer at a
  // disadvantage: `at` on its own attacks, `from` (1.185) on attacks it is the target of.
  {
    const ring = [
      { to: "attacks", mode: "advantage", at: { tags: ["demon"] } },
      { to: "attacks-taken", mode: "disadvantage", from: { tags: ["demon"] } },
    ];
    const doc = fiveE();
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "finger", label: "Finger", count: 2 }] };
    const ringed = parsed(doc);
    const fight = () => {
      const state = createRulesetEncounter({
        definition: ringed,
        seed: 1,
        roller: () => 10,
        combatants: [
          {
            id: "hero",
            name: "Hero",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
            }),
            live: {},
            items: [
              {
                name: "Ring of Elemental Command",
                quantity: 1,
                worn: true,
                item: { category: "gear", slots: { finger: 1 }, worn: { modifiers: ring } },
              } as never,
            ],
          },
          {
            id: "vrock",
            name: "Vrock",
            side: "enemy",
            block: block({
              type: "fiend",
              tags: ["demon"],
              actions: [
                { id: "beak", name: "Beak", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 3 } },
              ],
            }),
          },
          {
            id: "bandit",
            name: "Bandit",
            side: "enemy",
            block: block({
              actions: [
                { id: "club", name: "Club", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 3 } },
              ],
            }),
          },
        ],
      });
      return state;
    };
    const state = fight();
    const modeOf = (actorId: string, targetId: string) =>
      rulesetAttackMode(ringed, ringed.combat!, rulesetCombatant(state, actorId)!, rulesetCombatant(state, targetId)!, {
        state,
        optionId: "none",
      });
    assert.equal(modeOf("hero", "vrock"), "advantage", "the wearer's at the demon");
    assert.equal(modeOf("hero", "bandit"), "normal");
    assert.equal(modeOf("vrock", "hero"), "disadvantage", "the demon's at the wearer");
    assert.equal(modeOf("bandit", "hero"), "normal");
  }

  // ── Refusals and the install gate ──
  {
    refused(
      fiveE([{ to: "saves", mode: "advantage", at: { tags: ["demon"] } }]),
      /"at" narrows the holder's own attacks or damage/,
    );
    refused(fiveE([{ to: "attacks", mode: "disadvantage", at: { tags: ["devil"] } }]), /devil/);
    const gate =
      "A ruleset with a change to its holder's attacks or damage at targets that are something (modifiers[].at) requires schemaVersion 2 and capabilityApi 1.726 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(725) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(726) as never, fiveE()), gate);
  }

  console.log("Demon Armor: disadvantage and 5 more damage against a demon only; gated at 1.726.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
