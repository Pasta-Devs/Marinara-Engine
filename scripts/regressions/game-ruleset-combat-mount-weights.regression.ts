/**
 * Mounts that carry riders by weight (Capability API 1.641): 5e's Carpet of Flying, "can carry up to
 * 200 pounds at that speed ... twice that weight, but it flies at half speed".
 *
 *   - Called out by its item's use, it is mounted by its caller though it is no bigger than they are.
 *   - It bears riders while their weight is within what it carries, at half speed past its full-speed
 *     weight; one more than that is not offered.
 *   - Its riders go where it flies; its rider getting down hands it to the next.
 *   - A Broom of Flying keeps 30 feet past its full load, not half (Capability API 1.660).
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
  RULESET_DISMOUNT_OPTION,
  RULESET_MOUNT_OPTION_PREFIX,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetMovementAllowance,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mount-weights-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 641);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const carpetBlock = (carries: Record<string, unknown> = { weight: 200, slowedUpTo: 400 }) => ({
    health: 30,
    defense: 12,
    initiativeModifier: 0,
    speed: 0,
    speeds: { fly: 80 },
    hover: true,
    size: "medium",
    actions: [],
    tier: "cr_0",
    mountCarries: carries,
  });
  const document = (
    weights: Record<string, unknown> | null = { bySize: { small: 60, medium: 180, large: 900 } },
    carries?: Record<string, unknown>,
  ) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
      ],
      default: "medium",
    };
    doc.combat.mounts = {
      larger: 1,
      controlled: { standard: ["dash", "disengage", "dodge"] },
      ...(weights ? { weights } : {}),
    };
    doc.items = { categories: [{ id: "wondrous", label: "Wondrous" }] };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({ id: "carpet", label: "Carpet of Flying", creature: carpetBlock(carries) });
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "carpet",
          label: "Carpet of Flying",
          item: {
            category: "wondrous",
            stack: 1,
            use: {
              kind: "utility",
              targets: "self",
              budget: "action",
              label: "Unroll",
              calls: { creature: "creatures/carpet", count: { flat: 1 }, dismissible: true, initiative: "after" },
            },
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
  const definition = parsed(document());
  const carpetItem = (definition.catalogs!.find((catalog) => catalog.id === "gear")!.entries![0] as RulesetCatalogEntry)
    .item!;
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const person = (size = "medium"): RulesetStatBlock =>
    ({ health: 20, defense: 12, initiativeModifier: 0, speed: 30, size, actions: [] }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const step = (
    state: RulesetEncounterState,
    choice: Partial<RulesetCombatChoice> & { actorId: string },
    rules = definition,
  ) => {
    state.turn = state.order.indexOf(choice.actorId);
    const taken = applyRulesetCombatChoice(rules, state, { optionId: "end-turn", targetIds: [], ...choice }, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    return taken.state;
  };
  const ids = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    return rulesetCombatOptions(definition, state, id).map((one) => one.id);
  };
  const cells = (state: RulesetEncounterState, id: string, rules = definition) =>
    rulesetMovementAllowance(rules, rules.combat!, who(state, id), state);

  // ── Called out by its item, and mounted by its caller ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [{ item: carpetItem, quantity: 1, worn: false, name: "Carpet of Flying" }],
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: person("small") },
      ],
      board: {
        grid: { width: 14, height: 5, tiles: Array.from({ length: 5 }, () => Array(14).fill("plains")) } as never,
        placements: { ada: { x: 2, y: 2 }, goblin: { x: 12, y: 2 } },
      },
    });
    state.order = ["ada", "goblin"];
    state.turn = 0;
    const unroll = rulesetCombatOptions(definition, state, "ada").find((one) => one.label.includes("Unroll"));
    assert.ok(
      unroll,
      rulesetCombatOptions(definition, state, "ada")
        .map((one) => one.label)
        .join(", "),
    );
    const called = step(state, { actorId: "ada", optionId: unroll.id });
    const carpet = called.combatants.find((one) => one.name.includes("Carpet"));
    assert.ok(carpet, "the carpet is out");
    assert.ok(
      ids(called, "ada").includes(`${RULESET_MOUNT_OPTION_PREFIX}${carpet.id}`),
      "no bigger than her, and mounted",
    );
  }

  // ── Riders by weight ──
  const fight = (rules = definition, carries?: Record<string, unknown>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ada", name: "Ada", side: "party", block: person() },
        { id: "bo", name: "Bo", side: "party", block: person() },
        { id: "cy", name: "Cy", side: "party", block: person() },
        {
          id: "carpet",
          name: "Carpet",
          side: "party",
          block: carpetBlock(carries) as unknown as RulesetStatBlock,
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: person("small") },
      ],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: {
          ada: { x: 1, y: 2 },
          bo: { x: 2, y: 1 },
          cy: { x: 2, y: 3 },
          carpet: { x: 2, y: 2 },
          goblin: { x: 18, y: 2 },
        },
      },
    });
    state.order = ["ada", "bo", "cy", "carpet", "goblin"];
    state.turn = 0;
    return state;
  };
  const mount = `${RULESET_MOUNT_OPTION_PREFIX}carpet`;
  let state = fight();
  assert.equal(cells(state, "carpet"), 16, "80 feet, unladen");
  state = step(state, { actorId: "ada", optionId: mount });
  assert.equal(who(state, "carpet").riddenBy, "ada");
  assert.equal(cells(state, "carpet"), 16, "180 pounds, within its 200");
  state = step(state, { actorId: "bo", optionId: mount });
  assert.deepEqual(who(state, "carpet").passengers, ["bo"]);
  assert.equal(who(state, "carpet").riddenBy, "ada", "Ada still steers it");
  assert.equal(cells(state, "carpet"), 8, "360 pounds: half speed");
  assert.ok(!ids(state, "cy").includes(mount), "540 pounds is past its 400");

  // ── Where it flies they go ──
  {
    who(state, "carpet").movement = 8;
    const flown = step(state, { actorId: "carpet", optionId: RULESET_MOVE_OPTION, to: { x: 6, y: 2 } });
    for (const id of ["carpet", "ada", "bo"]) assert.deepEqual([who(flown, id).x, who(flown, id).y], [6, 2], id);
    state = flown;
  }

  // ── Its rider gets down: the next one on it takes it ──
  state.combatants.forEach((one) => (one.movementLeft = 6));
  state = step(state, { actorId: "ada", optionId: RULESET_DISMOUNT_OPTION });
  assert.equal(who(state, "ada").mountedOn, undefined);
  assert.equal(who(state, "carpet").riddenBy, "bo");
  assert.equal(who(state, "carpet").passengers, undefined);
  assert.equal(cells(state, "carpet"), 16, "180 pounds again");

  // ── A broom keeps its own speed past its full load (1.660) ──
  {
    const broom = { weight: 200, slowedUpTo: 400, slowedSpeed: 30 };
    const rules = parsed(document(undefined, broom));
    let flown = fight(rules, broom);
    flown = step(flown, { actorId: "ada", optionId: mount }, rules);
    assert.equal(cells(flown, "carpet", rules), 16, "within its 200");
    flown = step(flown, { actorId: "bo", optionId: mount }, rules);
    assert.equal(cells(flown, "carpet", rules), 6, "past it: 30 feet, not half of 80");
    refused(document(undefined, { weight: 200, slowedSpeed: 30 }), /slowedSpeed/);
    const gate =
      "A ruleset with a mount's own speed past its full-pace load (mountCarries.slowedSpeed) requires schemaVersion 2 and capabilityApi 1.660 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(659) as never, document(undefined, broom)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(660) as never, document(undefined, broom)), gate);
  }

  // ── Refusals ──
  refused(document(null), /needs combat\.mounts\.weights/);
  refused(document({ bySize: { huge: 4000 } }), /Unknown size "huge"/);
  refused(document(undefined, { weight: 400, slowedUpTo: 300 }), /slowedUpTo/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a mount that carries riders by weight (mountCarries, mounts.weights) requires schemaVersion 2 and capabilityApi 1.641 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(640) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(641) as never, document()), gate);
  }

  console.log(
    "Carpet of Flying: called by its item, it carries riders by weight, at half speed past its full load; gated at 1.641.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
