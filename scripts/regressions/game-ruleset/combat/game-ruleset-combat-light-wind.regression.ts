/**
 * Light obscurement and the wind (Capability API 1.286).
 *
 *   - `obscures.light` (and a teleport's `smoke.light`): it hides nobody, though whoever is seen
 *     only through it is seen lightly obscured (dim light, a Cape of the Mountebank's smoke).
 *   - `obscures.dispersed` with a zone's `disperses`: where the wind reaches the fog, the fog ends,
 *     and with it the concentration holding it (Gust of Wind on a Fog Cloud); a fog without it
 *     (Darkness) stays, and a wind that reaches no fog leaves it be.
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
  rowsFromCatalogEntry,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetLightlyObscured } from "../../../../packages/shared/src/features/ruleset-combat/sight.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-light-wind-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 281);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "utility", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const cloud = (obscures: Record<string, unknown>, size = 10) => ({
    area: { shape: "burst", size },
    range: 120,
    concentration: true,
    zone: { rounds: 10, triggers: [], obscures },
  });
  // Fog Cloud, blown away by wind; Darkness, which is not; a dim haze that hides nobody.
  const fog = spell("fog", cloud({ dispersed: true }));
  const dark = spell("dark", cloud({}, 5));
  const haze = spell("haze", cloud({ light: true }));
  // Gust of Wind, here a burst held at a point that does nothing but blow.
  const gust = spell("gust", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], disperses: true },
  });
  // A howling dust storm: a light fog that is itself a wind, and does not blow itself away.
  const storm = spell("storm", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: { light: true, dispersed: true }, disperses: true },
  });
  // Stinking Cloud: a strong wind disperses it only after it has blown on it a whole round (1.289).
  const stink = spell("stink", cloud({ dispersed: { after: 1 } }, 5));
  const cape = spell("cape", { teleport: { distance: 30, smoke: { light: true } } });
  const spells = [fog, dark, haze, gust, cape, storm, stink];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const block = (): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "druid", name: "Druid", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 20, height: 15, tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, druid: { x: 2, y: 9 }, a: { x: 10, y: 7 }, b: { x: 16, y: 7 } },
      },
    });
    state.order = ["mage", "druid", "a", "b"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, actorId: string, label: string, at: RulesetCombatCell) => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], at },
      () => 10,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const sees = (state: RulesetEncounterState, viewer: string, seen: string) =>
    rulesetCanSee(definition, state, who(state, viewer), who(state, seen));
  const dim = (state: RulesetEncounterState, viewer: string, seen: string) =>
    rulesetLightlyObscured(definition, state, who(state, viewer), who(state, seen));
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const labels = (state: RulesetEncounterState, id: string) => (who(state, id).zones ?? []).map((one) => one.label);

  // ── A light haze hides nobody, but who is seen through it is seen dimly ──
  {
    const state = fight();
    assert.equal(dim(state, "mage", "a"), false, "nothing between them yet");
    const step = cast(state, "mage", "Haze", { x: 10, y: 7 });
    assert.equal(sees(step.state, "mage", "a"), true, "a haze hides nobody");
    assert.equal(dim(step.state, "mage", "a"), true, "seen through it, lightly obscured");
    assert.equal(dim(step.state, "mage", "druid"), false, "not where the haze is not");
    // The same cloud without `light` hides.
    const thick = cast(fight(), "mage", "Fog", { x: 10, y: 7 });
    assert.equal(sees(thick.state, "mage", "a"), false, "a fog hides");
    assert.equal(dim(thick.state, "mage", "a"), false, "not seen at all, so not seen dimly");
  }

  // ── The Cape's thin smoke ──
  {
    const step = cast(fight(), "mage", "Cape", { x: 6, y: 6 });
    assert.ok(labels(step.state, "mage").includes("Cape"), "smoke stands");
    assert.equal(sees(step.state, "b", "mage"), true, "thin smoke hides nobody");
    assert.equal(dim(step.state, "b", "mage"), true, "but the mage stands in it");
    assert.equal(dim(step.state, "b", "druid"), false);
  }

  // ── The wind blows the fog away, and ends the concentration holding it ──
  {
    const fogged = cast(fight(), "mage", "Fog", { x: 10, y: 7 });
    assert.equal(who(fogged.state, "mage").concentrating?.actionId !== undefined, true, "held by concentration");
    const blown = cast(fogged.state, "druid", "Gust", { x: 12, y: 7 });
    const event = blown.events.find((one) => one.type === "zone" && one.outcome === "dispersed");
    assert.ok(event, JSON.stringify(blown.events));
    assert.equal((event as { actorId: string }).actorId, "mage");
    assert.deepEqual(labels(blown.state, "mage"), [], "the fog is gone");
    assert.equal(who(blown.state, "mage").concentrating ?? null, null, "and the concentration with it");
    assert.deepEqual(labels(blown.state, "druid"), ["Gust"], "the wind stays");
    assert.equal(sees(blown.state, "mage", "a"), true, "a is seen again");
    // A wind that does not reach the fog leaves it.
    const far = cast(cast(fight(), "mage", "Fog", { x: 10, y: 7 }).state, "druid", "Gust", { x: 10, y: 1 });
    assert.deepEqual(labels(far.state, "mage"), ["Fog"], "out of the wind's reach");
    assert.ok(!far.events.some((one) => one.type === "zone" && one.outcome === "dispersed"));
    // Darkness is no fog: it stays.
    const darkened = cast(fight(), "mage", "Dark", { x: 10, y: 7 });
    const windy = cast(darkened.state, "druid", "Gust", { x: 10, y: 7 });
    assert.deepEqual(labels(windy.state, "mage"), ["Dark"], "darkness is not blown away");
    // A wind that is itself a fog does not blow itself away.
    const stormy = cast(fight(), "mage", "Storm", { x: 10, y: 7 });
    assert.deepEqual(labels(stormy.state, "mage"), ["Storm"], "the storm stays");
    // A fog set down where the wind already blows goes at once.
    const gusty = cast(fight(), "druid", "Gust", { x: 10, y: 7 });
    const late = cast(gusty.state, "mage", "Fog", { x: 10, y: 7 });
    assert.deepEqual(labels(late.state, "mage"), [], "into the wind, gone");
    assert.ok(late.events.some((one) => one.type === "zone" && one.outcome === "dispersed"));
  }

  // ── A cloud the wind takes a whole round to blow away (1.289) ──
  {
    const end = (state: RulesetEncounterState) => {
      const actorId = state.order[state.turn]!;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId, optionId: "end-turn", targetIds: [] },
        () => 10,
      );
      assert.equal(refused(step), undefined, JSON.stringify(step.events));
      return step.state;
    };
    const turnOf = (state: RulesetEncounterState) => `${state.round}:${state.order[state.turn]}`;
    let state = cast(fight(), "mage", "Stink", { x: 10, y: 7 }).state;
    const round = state.round;
    state = cast(state, "druid", "Gust", { x: 12, y: 7 }).state;
    assert.deepEqual(labels(state, "mage"), ["Stink"], "not blown away at once");
    state = end(end(end(end(state))));
    assert.equal(turnOf(state), `${round + 1}:druid`);
    assert.deepEqual(labels(state, "mage"), [], "gone once the wind has blown on it a whole round");
    assert.equal(who(state, "mage").concentrating ?? null, null, "and the concentration with it");
    // A wind that stops before the round is out starts over when it comes again.
    state = cast(fight(), "mage", "Stink", { x: 10, y: 7 }).state;
    state = cast(state, "druid", "Gust", { x: 12, y: 7 }).state;
    state = end(end(end(state)));
    assert.equal(turnOf(state), `${round + 1}:mage`);
    assert.deepEqual(labels(state, "mage"), ["Stink"]);
    who(state, "druid").zones = [];
    state = end(state);
    assert.deepEqual(labels(state, "mage"), ["Stink"], "the wind dropped in time");
    state = cast(state, "druid", "Gust", { x: 12, y: 7 }).state;
    assert.deepEqual(labels(state, "mage"), ["Stink"], "it starts over");
    state = end(end(end(end(state))));
    assert.equal(turnOf(state), `${round + 2}:druid`);
    assert.deepEqual(labels(state, "mage"), [], "a whole round of the new wind");
  }

  // ── Refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [spell("odd", mechanics)] });
      });
    refusedDoc(withSpell(cloud({ light: false })), /light/);
    refusedDoc(withSpell(cloud({ dispersed: "yes" })), /dispersed/);
    refusedDoc(withSpell(cloud({ dispersed: { after: 0 } })), /dispersed/);
    refusedDoc(withSpell(cloud({ dispersed: { after: 1, soon: true } })), /dispersed/);
    refusedDoc(
      withSpell({ area: { shape: "burst", size: 5 }, zone: { rounds: 1, triggers: [], disperses: false } }),
      /disperses/,
    );
    refusedDoc(withSpell({ teleport: { distance: 30, smoke: { light: 1 } } }), /light/);
    // A zone that only blows is a zone that does something.
    parsed(withSpell({ area: { shape: "burst", size: 5 }, zone: { rounds: 1, triggers: [], disperses: true } }));
  }

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
      "A ruleset with a lightly obscuring fog, or a fog or wind that blows it away, requires schemaVersion 2 and capabilityApi 1.286 or newer";
    const only = (entry: RulesetCatalogEntry) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [entry] });
      return doc;
    };
    for (const entry of [fog, haze, gust, cape]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(285) as never, only(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(286) as never, only(entry)), gate, entry.id);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(285) as never, only(dark)), gate, "darkness");
    const slow =
      "A ruleset with a fog a wind disperses only after a while requires schemaVersion 2 and capabilityApi 1.289 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(288) as never, only(stink)), slow);
    assert.equal(getCapabilityPackageInstallIssue(manifest(289) as never, only(stink)), null);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(288) as never, only(fog)), slow, "a fog blown at once");
  }

  console.log(
    "Light and wind: a light fog or the Cape's thin smoke hides nobody but leaves whoever is seen through it lightly obscured; a wind's zone blows away the fogs it reaches with their concentration, not darkness; Stinking Cloud only after a whole round of wind (1.289); refusals; gated at 1.286 and 1.289.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
