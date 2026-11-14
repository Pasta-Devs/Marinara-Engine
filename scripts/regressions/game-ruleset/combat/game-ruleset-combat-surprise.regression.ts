/**
 * Surprise (Capability API 1.237).
 *
 *   - A fight can begin with some caught unaware: on their first turn they neither move nor act,
 *     and they take no reaction until that turn ends (or the first round is over).
 *   - A condition's `cannotBeSurprised`: 5e's Foresight.
 *   - A use's `ignoresSurpriseWith`: Feral Instinct lets a surprised barbarian act anyway by
 *     raging first, and that turn is then theirs.
 *   - The screen, the import refusals and the install gate.
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
  rulesetCombatEffects,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetSignatureOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-surprise-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { directedRulesetView } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 232);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feature = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({ id, label, rows: [{ list: "features", values: { name: label } }], mechanics }) as unknown as RulesetCatalogEntry;
  const rage = feature("rage", "Rage", {
    kind: "buff",
    targets: "self",
    budget: "bonus",
    applies: [{ condition: "raging", duration: { rounds: 10 } }],
  });
  const feral = feature("feral", "Feral Instinct", { kind: "utility", ignoresSurpriseWith: "rages/rage" });
  const rages = [rage, feral];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "rages", label: "Rages", feeds: ["features"], entries: structuredClone(rages) });
    doc.sheet.live.conditions.push({ id: "foresight", label: "Foresight" }, { id: "raging", label: "Raging" });
    doc.combat.conditions.push(
      { condition: "foresight", effects: [], cannotBeSurprised: true },
      { condition: "raging", effects: [] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const hero = (id: string, name: string, entries: RulesetCatalogEntry[], conditions: string[] = []) => ({
    id,
    name,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 3, ac: 14, speed: 30, hp_max: 30 },
      lists: { features: entries.flatMap((entry) => rowsFromCatalogEntry("rages", entry).map((row) => row.row)) },
    }),
    live: conditions.length ? { conditions } : {},
    catalogs: { rages },
  });
  const goblin: RulesetStatBlock = {
    health: 10,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "slash", label: "Slash", kind: "attack", toHit: 4, damage: { dice: "1d6", bonus: 2 } }],
  } as unknown as RulesetStatBlock;
  const fight = (surprised: string[]) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        hero("brute", "Brute", rages),
        hero("plain", "Plain", [rage]),
        hero("seer", "Seer", [], ["foresight"]),
        { id: "goblin", name: "Goblin", side: "enemy", block: goblin },
      ],
      surprised,
    });
    state.order = ["brute", "plain", "seer", "goblin"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const labels = (state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, id).map((one) => one.label);
  const choose = (state: RulesetEncounterState, id: string, pick: (label: string, kind: string) => boolean) => {
    const option = rulesetCombatOptions(definition, state, id).find((one) => pick(one.label, one.kind));
    assert.ok(option, `nothing picked for ${id}`);
    return applyRulesetCombatChoice(definition, state, { actorId: id, optionId: option.id, targetIds: [id] }, roll);
  };
  const endTurn = (state: RulesetEncounterState, id: string) => choose(state, id, (_, kind) => kind === "end-turn");
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // ── Who is caught unaware, and who never is ──
  const opening = fight(["brute", "plain", "seer", "goblin"]);
  {
    assert.deepEqual(of(opening.opening, "surprised"), [{ type: "surprised", actorIds: ["brute", "plain", "goblin"] }]);
    assert.equal(who(opening, "seer").surprised, undefined);
    assert.ok(rulesetCombatEffects(definition, definition.combat!, who(opening, "brute"), opening).has("cannot-react"));
    assert.ok(!rulesetCombatEffects(definition, definition.combat!, who(opening, "seer"), opening).has("cannot-react"));
    // Nobody named, nobody surprised: no event.
    assert.deepEqual(of(fight([]).opening, "surprised"), []);
  }

  // ── A surprised turn is only ended; Feral Instinct's rage is the one way out ──
  {
    const state = structuredClone(opening);
    assert.deepEqual(labels(state, "brute"), ["Rage", rulesetCombatOptions(definition, state, "brute").at(-1)!.label]);
    // Without Feral Instinct, nothing but ending it.
    const plain = structuredClone(opening);
    plain.turn = 1;
    assert.deepEqual(
      rulesetCombatOptions(definition, plain, "plain").map((one) => one.kind),
      ["end-turn"],
    );
    // Anything else asked for is refused, and says why.
    const full = fight([]);
    const move = rulesetCombatOptions(definition, full, "brute").find(
      (one) => one.kind !== "end-turn" && one.label !== "Rage",
    )!;
    const refused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: move.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(refused.events, "refused").map((one) => one.reason),
      ["surprised"],
    );
    // Raging shakes it off, and the rest of the turn is the barbarian's.
    const step = choose(state, "brute", (label) => label === "Rage");
    assert.deepEqual(of(step.events, "surpriseOver"), [{ type: "surpriseOver", actorId: "brute", label: "Rage" }]);
    const after = who(step.state, "brute");
    assert.equal(after.surprised, undefined);
    assert.ok(after.tracked.some((one) => one.condition === "raging"));
    assert.ok(labels(step.state, "brute").length > 2);
    assert.ok(!rulesetCombatEffects(definition, definition.combat!, after, step.state).has("cannot-react"));
  }

  // ── Ending the first turn ends it; so does the end of the first round ──
  {
    const state = structuredClone(opening);
    const step = endTurn(state, "brute");
    assert.equal(who(step.state, "brute").surprised, undefined);
    assert.deepEqual(of(step.events, "surpriseOver"), [{ type: "surpriseOver", actorId: "brute" }]);
    assert.equal(who(step.state, "plain").surprised, true);
    // One whose turn never came this round (they are later in it) is surprised no longer after it.
    const late = structuredClone(opening);
    late.order = ["seer", "goblin", "brute", "plain"];
    late.turn = 2;
    who(late, "brute").surprised = undefined;
    who(late, "goblin").surprised = true;
    let next = endTurn(late, "brute").state;
    next = endTurn(next, "plain").state;
    assert.equal(who(next, "goblin").surprised, undefined, "a new round ends everybody's surprise");
  }

  // ── No legendary uses while surprised ──
  {
    const state = structuredClone(opening);
    const gob = who(state, "goblin");
    gob.signature = { points: 3, max: 3 } as never;
    gob.actions.push({ ...gob.actions[0]!, id: "flick", label: "Flick", signature: { cost: 1 } } as never);
    assert.deepEqual(rulesetSignatureOptions(definition, state, "goblin"), []);
    gob.surprised = undefined;
    assert.ok(rulesetSignatureOptions(definition, state, "goblin").length > 0);
  }

  // ── The screen is told ──
  {
    const view = directedRulesetView(definition, {
      style: "ruleset",
      party: [],
      enemies: [],
      rulesetFight: { encounter: opening, events: [], eventSeq: 0, controllers: {}, adjustments: [], bosses: [] },
    } as never)!;
    assert.equal(view.combatants.find((one) => one.id === "brute")!.surprised, true);
    assert.equal(view.combatants.find((one) => one.id === "seer")!.surprised, undefined);
  }

  // ── Import refusals ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => (doc.catalogs.at(-1).entries[1].mechanics.ignoresSurpriseWith = "potions/heal")),
    );
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => /Unknown catalog "potions"/.test(issue)),
        result.issues.join("; "),
      );
  }

  // ── The install gate ──
  {
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
    const gate =
      "A ruleset with conditions that keep surprise off or uses that shake it off requires schemaVersion 2 and capabilityApi 1.237 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    const keeps = structuredClone(without);
    keeps.combat.conditions.push({ condition: "foresight", effects: [], cannotBeSurprised: true });
    assert.equal(issue(236, keeps), gate);
    assert.notEqual(issue(237, keeps), gate);
    const shakes = { ...without, extra: { feral: { mechanics: { ignoresSurpriseWith: "rages/rage" } } } };
    assert.equal(issue(236, shakes), gate);
    assert.notEqual(issue(237, shakes), gate);
    assert.notEqual(issue(236, without), gate);
    assert.equal(issue(236, without, new Map([["rages.json", { entries: [feral] }]])), gate);
  }

  console.log(
    "Ruleset surprise: the caught-unaware lose their first turn and reactions, Foresight keeps it off, Feral Instinct's rage shakes it; gated at 1.237.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
