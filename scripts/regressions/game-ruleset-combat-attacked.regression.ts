/**
 * An attack that is over, and answers that strike or send it on (Capability API 1.422).
 *
 *   - Retaliation: hurt by a creature beside them, the barbarian answers with their own best melee
 *     weapon strike at it.
 *   - Giant Killer: attacked by a Large creature beside them, hit or missed, the ranger strikes back;
 *     a Medium one opens nothing.
 *   - Stand Against the Tide: a melee attack that missed the ranger is made again at the creature the
 *     ranger picks, never its maker; a hit opens nothing for it.
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
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-attacked-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 422);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feature = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "features", values: { name: label } }],
      mechanics: { kind: "utility", budget: "reaction", targets: "enemy", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const features = [
    feature("retaliation", "Retaliation", { reaction: { on: "harmed", within: 5 }, strikesWith: "melee" }),
    feature("giant-killer", "Giant Killer", {
      reaction: { on: "attacked", within: 5, sourceIs: { atLeastSize: "large" } },
      strikesWith: "melee",
    }),
    feature("tide", "Stand Against the Tide", {
      targets: "any",
      reaction: { on: "attacked", missed: true, blow: "melee", at: "chosen" },
      redirects: true,
    }),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
      ],
      default: "medium",
    };
    doc.catalogs.push({ id: "class", label: "Class", feeds: ["features"], entries: structuredClone(features) });
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
  const rows = (entries: RulesetCatalogEntry[]) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry("class", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
    );
  const hero = (entries: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      fields: { level: 11, ac: 15, speed: 30, hp_max: 90 },
      lists: {
        features: rows(entries),
        attacks: [
          { name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", damage_type: "slashing" },
        ],
      },
    });
  const block = (size?: string): RulesetStatBlock =>
    ({
      health: 60,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      ...(size ? { size } : {}),
      actions: [
        {
          id: "club",
          name: "Club",
          budget: "action",
          toHit: 5,
          damage: { count: 1, sides: 6, flat: 2, type: "bludgeoning" },
          reach: 5,
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  // d20s from the queue (10 when it runs out), every other die a 3.
  let queue: number[] = [];
  const roller = (sides: number) => (sides === 20 ? (queue.shift() ?? 10) : 3);
  const fight = (entries: RulesetCatalogEntry[], foeSize?: string): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "foe", name: "Foe", side: "enemy", block: block(foeSize) },
        { id: "hero", name: "Hero", side: "party", build: hero(entries), live: {}, catalogs: { class: entries } },
        { id: "other", name: "Other", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { foe: { x: 6, y: 5 }, hero: { x: 5, y: 5 }, other: { x: 6, y: 4 } },
      },
    });
    state.order = ["foe", "hero", "other"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const club = (state: RulesetEncounterState, d20: number) => {
    queue = [d20];
    const option = rulesetCombatOptions(definition, state, "foe").find((one) => one.label === "Club");
    assert.ok(option, "the foe can club");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      roller,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const answer = (step: ReturnType<typeof club>, label: string, targetIds: string[] = [], d20 = 15) => {
    const window = step.state.window;
    assert.ok(window, `a window for ${label}: ${JSON.stringify(step.events)}`);
    const option = rulesetWindowOptions(definition, step.state, "hero").find((one) => one.label === label);
    assert.ok(option, `${label} is offered: ${JSON.stringify(rulesetWindowOptions(definition, step.state, "hero"))}`);
    queue = [d20];
    const taken = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "hero", optionId: option.id, targetIds, window: window.id },
      roller,
    );
    assert.equal(of(taken.events, "refused").length, 0, JSON.stringify(of(taken.events, "refused")));
    return taken;
  };
  const retaliation = [features[0]!];
  const giantKiller = [features[1]!];
  const tide = [features[2]!];

  // ── Retaliation: hurt from beside them, their own greataxe back ──
  {
    const hit = club(fight(retaliation), 18);
    assert.equal(hit.state.window?.trigger.kind, "harmed");
    const back = answer(hit, "Retaliation");
    const attack = of(back.events, "attack");
    assert.deepEqual(
      attack.map((one) => [one.actorId, one.targetId, one.label]),
      [["hero", "foe", "Greataxe"]],
      JSON.stringify(back.events),
    );
    assert.equal(who(back.state, "hero").budgets.reaction, 0, "the reaction is spent");
    // A miss hurts nobody, so it asks nothing.
    assert.equal(club(fight(retaliation), 2).state.window, undefined);
  }

  // ── Giant Killer: a Large creature beside them, hit or missed ──
  {
    for (const d20 of [18, 2]) {
      const attacked = club(fight(giantKiller, "large"), d20);
      assert.equal(attacked.state.window?.trigger.kind, "attacked", `on a ${d20}`);
      const back = answer(attacked, "Giant Killer");
      assert.deepEqual(
        of(back.events, "attack").map((one) => [one.actorId, one.targetId]),
        [["hero", "foe"]],
      );
    }
    assert.equal(club(fight(giantKiller), 18).state.window, undefined, "a Medium one opens nothing");
  }

  // ── Stand Against the Tide: a missed melee attack made again at the one the ranger picks ──
  {
    const missed = club(fight(tide), 2);
    assert.equal(missed.state.window?.trigger.kind, "attacked");
    const sent = answer(missed, "Stand Against the Tide", ["other"], 18);
    assert.deepEqual(
      of(sent.events, "attack").map((one) => [one.actorId, one.targetId, one.label]),
      [["foe", "other", "Club"]],
      JSON.stringify(sent.events),
    );
    assert.ok(of(sent.events, "damage").some((one) => one.targetId === "other" && one.dealt > 0));
    // Never back at its maker.
    const again = club(fight(tide), 2);
    const option = rulesetWindowOptions(definition, again.state, "hero").find(
      (one) => one.label === "Stand Against the Tide",
    )!;
    const wrong = applyRulesetCombatChoice(
      definition,
      again.state,
      { actorId: "hero", optionId: option.id, targetIds: ["foe"], window: again.state.window!.id },
      roller,
    );
    assert.deepEqual(
      of(wrong.events, "refused").map((one) => one.reason),
      ["bad-target"],
    );
    assert.equal(club(fight(tide), 18).state.window, undefined, "a hit opens nothing for it");
  }

  // ── Refusals ──
  {
    const withFeature = (entry: RulesetCatalogEntry) =>
      document((doc) => {
        doc.catalogs.at(-1).entries = [entry];
      });
    refused(
      withFeature(feature("x", "X", { reaction: { on: "harmed", missed: true }, strikesWith: "melee" })),
      /"missed" narrows an attack that is over/,
    );
    refused(
      withFeature(feature("x", "X", { reaction: { on: "attacked" }, redirects: true })),
      /"redirects" is taken at an "attacked" moment that "missed" its holder/,
    );
    refused(
      withFeature(feature("x", "X", { reaction: { on: "turn-start" }, strikesWith: "melee" })),
      /"strikesWith" is a reaction aimed back at whoever caused its moment/,
    );
    refused(
      withFeature(
        feature("x", "X", {
          reaction: { on: "attacked", sourceIs: { types: ["nothing_here"] } },
          strikesWith: "melee",
        }),
      ),
      /declares no creature types/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose reactions answer an attack that is over (on attacked, missed), test whoever caused their moment (sourceIs), strike with their holder's own weapon (strikesWith) or send a missed attack elsewhere (redirects) requires schemaVersion 2 and capabilityApi 1.422 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(421) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(422) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(421) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Attacked: Retaliation strikes back with the barbarian's own greataxe when hurt from beside them; Giant Killer when a Large creature beside them attacks, hit or missed; Stand Against the Tide sends a missed melee attack at another; gated at 1.422.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
