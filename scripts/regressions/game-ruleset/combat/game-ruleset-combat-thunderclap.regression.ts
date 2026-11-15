/**
 * A clap around whoever a weapon's mode hits (Capability API 1.312): a Hammer of Thunderbolts.
 *
 *   - A mode's `aroundHit` makes the one it hit, and everybody within its reach of them (the wielder
 *     and allies too), save or take its condition, counted on the wielder's turns with `of`.
 *   - Only on a hit, and only in that mode: the hammer swung does nothing of it.
 *   - Import refusals, and the install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-thunderclap-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 307);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const clap = {
    within: 30,
    save: { save: "con_save", difficulty: 17 },
    condition: "stunned",
    rounds: 1,
    of: "source",
  };
  const hurl = (aroundHit: Record<string, unknown> = clap) => ({
    id: "hurl",
    label: "Hurled",
    range: { normal: 20, long: 60 },
    charges: 1,
    aroundHit,
  });
  const hammerItem = (mode: Record<string, unknown> = hurl()) =>
    ({
      category: "gear",
      slots: { hands: 1 },
      stack: 1,
      charges: { max: 5 },
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "2d6", abilities: ["str"], type: "bludgeoning" },
        reach: 5,
        modes: [mode],
      },
    }) as RulesetCatalogItem;
  const hammer = { name: "Hammer of Thunderbolts", quantity: 1, worn: true, item: hammerItem() } as RulesetSheetItem;
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const creature = (id: string, side: "enemy", con = -20, defense = 5) => ({
    id,
    name: id,
    side,
    block: {
      health: 200,
      defense,
      initiativeModifier: -20,
      saves: { con_save: con },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    } as RulesetStatBlock,
  });
  const grid = (): TacticalGrid => ({
    width: 40,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(40).fill("plains")),
  });
  let d20 = 10;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (heroCon = 10) => {
    const hero = rulesetSheetBuildSchema.parse({ ...build, abilities: { ...build.abilities, con: heroCon } });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: {}, items: [hammer] },
        creature("foe", "enemy"),
        { id: "ally", name: "Ally", side: "party", build, live: {} },
        creature("tough", "enemy", 20),
        creature("far", "enemy"),
        creature("plated", "enemy", -20, 99),
      ],
      board: {
        grid: grid(),
        placements: {
          hero: { x: 2, y: 5 },
          foe: { x: 5, y: 5 },
          ally: { x: 6, y: 5 },
          tough: { x: 5, y: 6 },
          far: { x: 12, y: 5 },
          plated: { x: 4, y: 7 },
        },
      },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const option = (state: RulesetEncounterState) => {
    state.turn = state.order.indexOf("hero");
    const found = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Hammer of Thunderbolts");
    assert.ok(found, "no hammer");
    return found;
  };
  const strike = (state: RulesetEncounterState, target: string, mode?: string) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option(state).id, targetIds: [target], ...(mode ? { mode } : {}) },
      roller,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const stunned = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!.tracked.find((one) => one.condition === "stunned");
  const saves = (events: RulesetCombatEvent[]) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save");

  // ── Hurled: a clap around the one hit ──
  {
    const step = strike(fight(), "foe", "hurl");
    const state = step.state;
    for (const id of ["foe", "ally", "hero"]) assert.ok(stunned(state, id), `${id} is stunned`);
    assert.equal(stunned(state, "tough"), undefined, "a made save keeps it off");
    assert.equal(stunned(state, "far"), undefined, "farther than 30 feet");
    assert.deepEqual(
      saves(step.events)
        .map((one) => one.actorId)
        .sort(),
      ["ally", "foe", "hero", "plated", "tough"],
      "everybody within 30 feet of the one hit saves, once",
    );
    const entry = stunned(state, "foe")!;
    assert.equal(entry.clockOf, "source", "until the end of the wielder's next turn");
    assert.equal(entry.source, "hero");
    assert.ok(
      step.events.some((one) => one.type === "uses" && one.left === 4 && one.of === 5),
      "a charge spent",
    );
  }

  // ── A miss claps nothing; nor does a swing ──
  {
    const missed = strike(fight(), "plated", "hurl");
    assert.ok(
      missed.events.some((one) => one.type === "attack" && one.outcome !== "hit"),
      JSON.stringify(missed.events),
    );
    assert.equal(saves(missed.events).length, 0, "no hit, no clap");
    const close = fight();
    rulesetCombatant(close, "hero")!.x = 4;
    const swung = strike(close, "foe");
    assert.ok(
      swung.events.some((one) => one.type === "attack" && one.outcome === "hit"),
      JSON.stringify(swung.events),
    );
    assert.equal(saves(swung.events).length, 0, "only the hurled hammer claps");
  }

  // ── Off a board, only the one hit ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items: [hammer] },
        creature("foe", "enemy"),
        { id: "ally", name: "Ally", side: "party", build, live: {} },
      ],
    });
    const step = strike(state, "foe", "hurl");
    assert.ok(stunned(step.state, "foe"));
    assert.equal(stunned(step.state, "ally"), undefined);
  }

  // ── Refusals ──
  const withMode = (mode: Record<string, unknown>) =>
    document((doc) => {
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "hammer", label: "Hammer", item: hammerItem(mode) }],
      });
    });
  parse(withMode(hurl()));
  refused(withMode(hurl({ ...clap, rounds: undefined })), /"of" says whose turns/);
  refused(withMode(hurl({ ...clap, save: undefined })), /save/);

  // ── The gate ──
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
      "A ruleset with a weapon mode whose hit claps around the one it hit requires schemaVersion 2 and capabilityApi 1.312 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(311) as never, withMode(hurl())), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(312) as never, withMode(hurl())), gate);
    const plain = hurl();
    delete (plain as Record<string, unknown>).aroundHit;
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(311) as never, withMode(plain)),
      gate,
      "no clap, no gate",
    );
  }

  console.log(
    "Thunderclap: a hurled Hammer of Thunderbolts stuns whoever is within 30 feet of the one it hit on a failed save, counted on its wielder's turns; only on a hit in that mode; refusals; gated at 1.312.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
