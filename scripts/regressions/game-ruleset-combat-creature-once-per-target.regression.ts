/**
 * Creature actions used once on each creature (Capability API 1.674).
 *
 *   - `whenSaved`: a creature that made its save is never picked again in the fight, and with
 *     `until` its sheet remembers it until that rest.
 *   - `whenEnds`: once the condition it put on ends, the same.
 *   - `shared`: two mummies are one source; a creature without it is its own.
 *   - Neither: spared once used on at all.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-once-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 674);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const presence = (oncePerTarget: Record<string, unknown>) => ({
    id: "presence",
    name: "Frightful Presence",
    budget: "action",
    reach: 5,
    autoHit: true,
    save: { save: "wis_save", difficulty: 15, onSuccess: "negates" },
    applies: [{ condition: "frightened", duration: { rounds: 1 } }],
    oncePerTarget,
  });
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const document = () => JSON.parse(fiveEText) as Record<string, any>;
  const definition = parsed(document());
  const block = (oncePerTarget: Record<string, unknown>): RulesetStatBlock =>
    ({
      health: 50,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [presence(oncePerTarget)],
    }) as unknown as RulesetStatBlock;
  const fight = (one: Record<string, unknown>, two: Record<string, unknown> = one, names = ["Mummy", "Mummy"]) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
        { id: "m1", name: names[0]!, side: "enemy", block: block(one) },
        { id: "m2", name: names[1]!, side: "enemy", block: block(two) },
      ],
    });
    state.order = ["m1", "m2", "hero"];
    state.turn = 0;
    return state;
  };
  /** Who it may pick on a fresh turn of its own: its action already spent this turn is put back. */
  const targets = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    const actor = rulesetCombatant(state, id)!;
    actor.budgets = { ...actor.budgets, action: Math.max(1, actor.budgets.action ?? 0) };
    actor.spent = [];
    const option = rulesetCombatOptions(definition, state, id).find((one) => one.label === "Frightful Presence");
    return option ? rulesetOptionTargets(definition, state, id, option) : [];
  };
  const use = (state: RulesetEncounterState, id: string, face: number) => {
    state.turn = state.order.indexOf(id);
    const option = rulesetCombatOptions(definition, state, id).find((one) => one.label === "Frightful Presence")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: id, optionId: option.id, targetIds: ["hero"] },
      (sides) => (sides === 20 ? face : 3),
    );
    const refused = step.events.find((one) => one.type === "refused");
    assert.equal(refused, undefined, JSON.stringify(refused));
    return step.state;
  };
  const holds = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!.tracked.map((one) => one.condition);

  // ── Saved: never again, and the sheet remembers it until a long rest ──
  {
    const state = use(fight({ whenSaved: true, until: "long", shared: "dread" }), "m1", 20);
    assert.deepEqual(holds(state), []);
    assert.deepEqual(targets(state, "m1"), [], "spared");
    assert.deepEqual(targets(state, "m2"), [], "by the other mummy too: one source");
    const usedOn = rulesetCombatant(state, "hero")!.sheet!.live.usedOn ?? {};
    assert.ok(
      Object.keys(usedOn).some((key) => key.startsWith("long|spared|long|dread")),
      JSON.stringify(usedOn),
    );
  }
  // ── Failed: still a target until it ends ──
  {
    const state = use(fight({ whenSaved: true, whenEnds: true }), "m1", 1);
    assert.deepEqual(holds(state), ["frightened"]);
    assert.deepEqual(targets(state, "m1"), ["hero"], "not spared while it holds");
    // The other is its own source without `shared`, even of the same name.
    let next = state;
    for (let i = 0; i < 6 && holds(next).includes("frightened"); i++)
      next = advanceRulesetTurn(definition, next, () => 10).state;
    assert.deepEqual(holds(next), [], "it ran out");
    assert.deepEqual(targets(next, "m1"), [], "spared once it ended");
  }
  // ── Without `shared`, each creature is its own source ──
  {
    const state = use(fight({ whenSaved: true }, { whenSaved: true }, ["Red Dragon", "Blue Dragon"]), "m1", 20);
    assert.deepEqual(targets(state, "m1"), []);
    assert.deepEqual(targets(state, "m2"), ["hero"], "the other dragon may still");
  }
  // ── Neither: spared once used on at all ──
  {
    const state = use(fight({}), "m1", 1);
    assert.deepEqual(targets(state, "m1"), []);
  }

  // ── Refusals ──
  {
    const withCreature = (action: Record<string, unknown>) => {
      const doc = document();
      doc.catalogs
        .find((one: { holds?: string }) => one.holds === "creatures")
        .entries[0].creature.actions.push(action);
      return doc;
    };
    const refused = (doc: unknown, pattern: RegExp) => {
      const result = parseRulesetDefinition(doc);
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refused(withCreature(presence({ until: "nosuch" })), /Unknown rest "nosuch"/);
    const { save: _save, ...unsaved } = presence({ whenSaved: true });
    refused(withCreature(unsaved), /"whenSaved" follows the action's own save/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's action used once on each creature (oncePerTarget on a creature) requires schemaVersion 2 and capabilityApi 1.674 or newer";
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
    const withPresence = document();
    withPresence.catalogs
      .find((one: { holds?: string }) => one.holds === "creatures")
      .entries[0].creature.actions.push(presence({ whenSaved: true }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(673) as never, withPresence), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(674) as never, withPresence), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(673) as never, document()), gate);
  }

  console.log(
    "Creature oncePerTarget: spared once saved, once its condition ends, or once used; shared sources; remembered until a rest on a sheet; gated at 1.674.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
