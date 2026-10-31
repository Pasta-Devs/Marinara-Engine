/**
 * Smites (Capability API 1.503).
 *
 *   - `endsAfter: "own-hit"`: a miss leaves it on; the next weapon hit takes its damage and ends it.
 *   - A condition's `onHit`: what its holder's weapon hit puts on whoever it hit (Branding Smite's
 *     glow, which holds off invisible).
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
  rulesetCombatant,
  rulesetActiveConditions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-smites-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 503);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const onHit = { weapon: true, applies: [{ condition: "branded", duration: { rounds: 10 } }] };
  const fiveE = (rule: unknown = onHit): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "branding", label: "Branding Smite" }, { id: "branded", label: "Branded" });
    doc.combat.conditions.push(
      {
        condition: "branding",
        effects: [],
        modifiers: [{ to: "damage", attacks: "weapon", dice: "2d6", damageType: "radiant" }],
        onHit: rule,
      },
      { condition: "branded", effects: [], suppresses: ["invisible"] },
    );
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
  const block = (): RulesetStatBlock =>
    ({
      health: 80,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "sword",
          name: "Sword",
          budget: "action",
          toHit: 5,
          damage: { count: 1, sides: 8, flat: 0, type: "slashing" },
          reach: 5,
        },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "paladin", name: "Paladin", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 4, height: 1, tiles: [Array(4).fill("plains")] } as never,
        placements: { paladin: { x: 1, y: 0 }, foe: { x: 2, y: 0 } },
      },
    });
    state.order = ["paladin", "foe"];
    state.turn = 0;
    rulesetCombatant(state, "paladin")!.tracked.push({
      condition: "branding",
      rounds: 10,
      source: "paladin",
      endsAfter: "own-hit",
    });
    rulesetCombatant(state, "foe")!.tracked.push({ condition: "invisible", rounds: null });
    return state;
  };
  const swing = (state: RulesetEncounterState, face: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "paladin", optionId: "sword", targetIds: ["foe"] },
      () => face,
    );
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatant(state, id)!.tracked.some((one) => one.condition === condition);

  // ── A miss leaves it on, and puts nothing on ──
  {
    const missed = swing(fight(), 2);
    assert.equal(of(missed.events, "attack")[0]?.outcome, "miss", JSON.stringify(missed.events));
    assert.ok(holds(missed.state, "paladin", "branding"));
    assert.ok(!holds(missed.state, "foe", "branded"));
  }

  // ── A hit: 2d6 radiant, the glow on the foe, and the smite spent ──
  {
    const hit = swing(fight(), 12);
    const damage = of(hit.events, "damage");
    assert.ok(damage.length > 0, JSON.stringify(hit.events));
    assert.ok(holds(hit.state, "foe", "branded"), "glowing");
    assert.equal(
      rulesetCombatant(hit.state, "foe")!.tracked.find((one) => one.condition === "branded")!.source,
      "paladin",
    );
    assert.ok(!holds(hit.state, "paladin", "branding"), "spent by the hit");
    // The glow holds off being invisible.
    assert.ok(
      !rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(hit.state, "foe")!, hit.state).some(
        (one) => one.condition === "invisible",
      ),
    );
    // The next hit is plain.
    const next = hit.state;
    next.turn = 0;
    rulesetCombatant(next, "paladin")!.budgets.action = 1;
    const plain = swing(next, 12);
    assert.ok(of(plain.events, "damage").length > 0);
  }

  // ── Refusals ──
  refused(fiveE({ applies: [] }), /applies/);
  refused(fiveE({ applies: [{ condition: "glowing", duration: "instant" }] }), /Unknown condition "glowing"/);
  refused(fiveE({ weapon: false, applies: onHit.applies }), /weapon/);
  refused(fiveE({ blow: "thrown", applies: onHit.applies }), /blow/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions end on their holder's next hit or put something on whoever it hits (endsAfter own-hit, a condition's onHit) requires schemaVersion 2 and capabilityApi 1.503 or newer";
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
    const only = JSON.parse(fiveEText) as Record<string, any>;
    only.combat.conditions[0].onHit = onHit;
    assert.equal(getCapabilityPackageInstallIssue(manifest(502) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(503) as never, only), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(502) as never,
        JSON.parse(fiveEText),
        new Map([["catalogs/spells.json", { entries: [{ mechanics: { applies: [{ endsAfter: "own-hit" }] } }] }]]),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(502) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Smites: a miss keeps the smite, the next weapon hit takes its damage, puts its glow on the one hit and ends it; gated at 1.503.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
