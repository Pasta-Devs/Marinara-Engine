/**
 * Harm for defiance (Capability API 1.562): 5e's Geas.
 *
 *   - A condition whose `harms` comes `at` "attacks-source-side" deals its holder its harm as they
 *     attack whoever put it on, or one of their side; `once` deals it only the first time.
 *   - "attacks-source" only at whoever put it on; nothing at anybody else.
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
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-geas-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 562);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (harms: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "geased", label: "Geased" });
    doc.combat.conditions.push({ condition: "geased", harms });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = (health: number, attacks: boolean): RulesetStatBlock =>
    ({
      health,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: attacks
        ? [{ id: "club", name: "Club", budget: "action", toHit: 10, damage: { count: 1, sides: 6, flat: 0 } }]
        : [],
    }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (definition: RulesetDefinition) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block(100, true) },
        { id: "cleric", name: "Cleric", side: "party", block: block(50, false) },
        { id: "friend", name: "Friend", side: "party", block: block(50, false) },
      ],
    });
    state.order = ["ogre", "cleric", "friend"];
    state.turn = 0;
    rulesetCombatant(state, "ogre")!.tracked.push({ condition: "geased", source: "cleric" } as never);
    return state;
  };
  const club = (definition: RulesetDefinition, state: RulesetEncounterState, at: string) => {
    const option = rulesetCombatOptions(definition, state, "ogre").find((one) => one.label === "Club")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: option.id, targetIds: [at] } as never,
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };
  const ogreHarm = (events: RulesetCombatEvent[]) =>
    of(events, "damage")
      .filter((one) => one.targetId === "ogre")
      .map((one) => one.dealt);

  // ── At its source's side: harmed, once ──
  {
    const definition = parsed(document({ at: "attacks-source-side", dice: "5d10", type: "psychic", once: true }));
    let state = fight(definition);
    const first = club(definition, state, "friend");
    assert.deepEqual(ogreHarm(first.events), [15], "5d10 psychic for striking the cleric's friend");
    state = first.state;
    state.turn = 0;
    rulesetCombatant(state, "ogre")!.budgets.action = 1;
    const again = club(definition, state, "cleric");
    assert.deepEqual(ogreHarm(again.events), [], "no more than once");
  }

  // ── Only at its source ──
  {
    const definition = parsed(document({ at: "attacks-source", dice: "2d6", type: "psychic" }));
    assert.deepEqual(ogreHarm(club(definition, fight(definition), "friend").events), [], "not for a friend");
    assert.deepEqual(ogreHarm(club(definition, fight(definition), "cleric").events), [6], "for the cleric");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that harms its holder for attacking whoever put it on (harms.at attacks-source, attacks-source-side, harms.once) requires schemaVersion 2 and capabilityApi 1.562 or newer";
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
    const doc = () => document({ at: "attacks-source", dice: "5d10" });
    assert.equal(getCapabilityPackageInstallIssue(manifest(561) as never, doc()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(562) as never, doc()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(561) as never, document({ at: "turn-start", dice: "1d4" })),
      gate,
    );
  }

  console.log(
    "Geas: harmed for striking its caster's side, only once; only at its caster where it says; gated at 1.562.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
