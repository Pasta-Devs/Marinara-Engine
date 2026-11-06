/**
 * Familiars (Capability API 1.487).
 *
 *   - Find Familiar: the owl or the cat, as a celestial, fey or fiend, picked as it is cast; the
 *     bond its `appliesSelf` puts on the caster lands with the call.
 *   - Voice of the Chain Master: aimed only at the caster's own familiar, not an ally's.
 *   - Set up before the fight by `mode`; one named no way is left out and said, and so is a way it
 *     does not have. Antipathy set up on an object by `kind`.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetCreatureKind,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-familiar-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 487);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics,
  });
  const findFamiliar = (calls: Record<string, unknown> = {}) =>
    spell("find-familiar", "Find Familiar", {
      kind: "utility",
      targets: "self",
      calls: {
        from: { catalog: "creatures", filters: { familiar: "yes" } },
        count: { flat: 1 },
        initiative: "after",
        asTypes: ["celestial", "fey", "fiend"],
        ...calls,
      },
      appliesSelf: [{ condition: "bonded", duration: "instant" }],
    });
  const voice = (targetTypes: Record<string, unknown> = { calledBySelf: true }) =>
    spell("voice", "Voice of the Chain Master", {
      kind: "buff",
      targets: "ally",
      range: 1000,
      targetTypes,
      applies: [{ condition: "spoken", duration: { rounds: 10 } }],
    });
  const antipathy = spell("antipathy", "Antipathy", {
    kind: "utility",
    targets: "self",
    kindChoice: true,
    calls: { creature: "creatures/object", count: { flat: 1 }, initiative: "none" },
    applies: [{ condition: "spoken", duration: { rounds: 1000 } }],
    appliesToCalled: true,
  });
  const document = (entries: unknown[] = [findFamiliar(), voice(), antipathy]): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "celestial", "fey", "fiend", "object"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "bonded", label: "Familiar bond" }, { id: "spoken", label: "Spoken" });
    doc.combat.conditions.push({ condition: "bonded", effects: [] }, { condition: "spoken", effects: [] });
    const beast = (id: string, label: string, familiar: string) => ({
      id,
      label,
      filters: { familiar },
      creature: {
        health: 1,
        defense: 11,
        initiativeModifier: 0,
        speed: 30,
        tier: "cr_0",
        type: id === "object" ? "object" : "beast",
        actions: [{ id: "talons", name: "Talons", budget: "action", toHit: 3, damage: { flat: 1 }, reach: 5 }],
      },
    });
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
    creatures.filters.push({ id: "familiar", label: "Familiar", type: "text" });
    creatures.entries.push(beast("owl", "Owl", "yes"), beast("cat", "Cat", "yes"), beast("object", "Object", "no"));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries! as RulesetCatalogEntry[];
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 16 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, race: "Human", spellcasting_ability: "cha", slots_max_1: 9 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, catalogs: { spells } },
        { id: "friend", name: "Friend", side: "party", build, live: {}, catalogs: { spells } },
        {
          id: "goblin",
          name: "Goblin",
          side: "enemy",
          block: { health: 7, defense: 13, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
      board: {
        grid: { width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) },
        placements: { hero: { x: 0, y: 1 }, friend: { x: 1, y: 1 }, goblin: { x: 10, y: 1 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const cast = (
    state: RulesetEncounterState,
    actor: string,
    label: string,
    mode?: string,
    targetIds: string[] = [],
  ) => {
    state.turn = state.order.indexOf(actor);
    rulesetCombatant(state, actor)!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label.startsWith(label));
    assert.ok(option, `no ${label}`);
    const done = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: option.id, targetIds, ...(mode ? { mode } : {}) },
      () => 10,
    );
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(of(done.events, "refused")));
    return done;
  };

  // ── Find Familiar: a creature and a type, picked as it is cast, and the bond with it ──
  const option = rulesetCombatOptions(definition, fight(), "hero").find((one) => one.label === "Find Familiar")!;
  assert.deepEqual(
    option.modes?.map((one) => one.id),
    [
      "call-owl-as-celestial",
      "call-owl-as-fey",
      "call-owl-as-fiend",
      "call-cat-as-celestial",
      "call-cat-as-fey",
      "call-cat-as-fiend",
    ],
  );
  const found = cast(fight(), "hero", "Find Familiar", "call-owl-as-fey");
  const [owlId] = of(found.events, "called")[0]!.ids;
  const owl = rulesetCombatant(found.state, owlId!)!;
  assert.equal(owl.name, "Owl");
  assert.equal(rulesetCreatureKind(definition, owl).type, "fey", "a fey owl");
  assert.ok(rulesetCombatConditions(definition, rulesetCombatant(found.state, "hero")!).includes("bonded"));
  assert.ok(of(found.events, "condition").some((one) => one.condition === "bonded" && one.targetId === "hero"));

  // ── Voice of the Chain Master: only one's own familiar ──
  {
    const state = found.state;
    const theirs = cast(state, "friend", "Find Familiar", "call-cat-as-fiend");
    const catId = of(theirs.events, "called")[0]!.ids[0]!;
    const next = theirs.state;
    next.turn = next.order.indexOf("hero");
    for (const id of ["hero", "friend"]) rulesetCombatant(next, id)!.budgets.action = 1;
    const speak = rulesetCombatOptions(definition, next, "hero").find((one) => one.label.startsWith("Voice"))!;
    assert.deepEqual(rulesetOptionTargets(definition, next, "hero", speak), [owlId], "the owl, not the cat");
    const friendTurn = { ...next, turn: next.order.indexOf("friend") };
    const speakFriend = rulesetCombatOptions(definition, friendTurn, "friend").find((one) =>
      one.label.startsWith("Voice"),
    )!;
    assert.deepEqual(rulesetOptionTargets(definition, friendTurn, "friend", speakFriend), [catId]);
  }

  // ── Set up before the fight ──
  {
    const owlFirst = rulesetStandingAtStart(definition, fight(), [
      { casterId: "hero", entry: "Find Familiar", mode: "call-owl-as-fiend" },
    ]);
    assert.deepEqual(owlFirst.skipped, []);
    const called = owlFirst.state.combatants.find((one) => one.calledBy === "hero")!;
    assert.equal(called.name, "Owl");
    assert.equal(rulesetCreatureKind(definition, called).type, "fiend");
    assert.ok(rulesetCombatConditions(definition, rulesetCombatant(owlFirst.state, "hero")!).includes("bonded"));
    const byName = rulesetStandingAtStart(definition, fight(), [
      { casterId: "hero", entry: "Find Familiar", mode: "Cat ×1, celestial" },
    ]);
    assert.equal(byName.state.combatants.find((one) => one.calledBy === "hero")?.name, "Cat", "by its name");
    const none = rulesetStandingAtStart(definition, fight(), [{ casterId: "hero", entry: "Find Familiar" }]);
    assert.equal(
      none.state.combatants.some((one) => one.calledBy === "hero"),
      false,
    );
    assert.match(none.skipped.join(" "), /one of several ways \(Owl ×1, celestial, .*\) and none was named/);
    const wrong = rulesetStandingAtStart(definition, fight(), [
      { casterId: "hero", entry: "Find Familiar", mode: "call-toad" },
    ]);
    assert.match(wrong.skipped.join(" "), /has no "call-toad"/);
    const object = rulesetStandingAtStart(definition, fight(), [{ casterId: "hero", entry: "Antipathy", kind: "fey" }]);
    assert.deepEqual(object.skipped, []);
    const thing = object.state.combatants.find((one) => one.calledBy === "hero")!;
    assert.equal(thing.tracked.find((one) => one.condition === "spoken")?.kind, "fey");
  }

  // ── Refusals ──
  refused(document([findFamiliar({ asTypes: ["dragon"] })]), /Unknown creature type "dragon"/);
  refused(document([voice({ calledBySelf: false })]), /calledBySelf/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries aim only at what their user called (calledBySelf) or call a creature as another type (calls asTypes) requires schemaVersion 2 and capabilityApi 1.487 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(486) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(487) as never, document()), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(486) as never, document([voice()])), gate, "calledBySelf");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(486) as never, document([antipathy])), gate);
  }

  console.log(
    "Familiar: Find Familiar's creature and type picked as cast with its bond on the caster; Voice of the Chain Master only at one's own; set up before the fight by mode or kind, one with no way said; gated at 1.487.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
