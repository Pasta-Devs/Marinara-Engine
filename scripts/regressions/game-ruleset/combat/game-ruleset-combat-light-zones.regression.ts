/**
 * Light from zones (Capability API 1.297).
 *
 *   - A zone's `lights`: bright within `bright` of its middle and dim in the rest of its own cells.
 *     5e's Daylight at a point, a bullseye lantern's cone held by its caster.
 *   - A zone's `dispelsDark`: magical darkness (`obscures.darkness`) of that level or lower ends
 *     where it meets it.
 *   - A light that `reveals`: whoever a condition hides is seen in its bright light (a lantern of
 *     revealing).
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
  rowsFromCatalogEntry,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-light-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 292);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "utility", cost: [{ pool: "slots_1", amount: 1 }], ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Daylight, small: a 20-foot burst, bright 10 feet from its middle and dim to its edge, ending
  // magical darkness of 1st level or lower.
  const daylight = spell("daylight", {
    area: { shape: "burst", size: 20 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 10 }, dispelsDark: { upTo: 1 } },
  });
  // The same, too weak to end a 1st-level darkness.
  const glow = spell("glow", {
    area: { shape: "burst", size: 20 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 10 }, dispelsDark: { upTo: 0 } },
  });
  // Darkness, magical.
  const dark = spell("dark", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: { darkness: true } },
  });
  // A bullseye lantern: a 30-foot cone held by its caster, bright 15 feet and dim the rest.
  const bullseye = spell("bullseye", {
    area: { shape: "cone", size: 30 },
    zone: { rounds: 10, triggers: [], anchor: "caster", lights: { bright: 15, dim: 15 } },
  });
  // A light that shows the invisible in its bright light.
  const reveal = spell("reveal", {
    area: { shape: "burst", size: 15 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 5, dim: 10, reveals: true } },
  });
  // The same over a single cell's burst, shining past its own cells.
  const peek = spell("peek", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 0, reveals: true } },
  });
  // Fog that is not magical darkness.
  const fog = spell("fog", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: {} },
  });
  // Sunlight over a single cell's burst (1.298).
  const sunbeam = spell("sunbeam", {
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 5, dim: 0, sunlight: true } },
  });
  const spells = [daylight, glow, dark, bullseye, reveal, peek, fog, sunbeam];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [
      { id: "darkvision", label: "Darkvision" },
      { id: "truesight", label: "Truesight" },
    ];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    for (const entry of doc.combat.conditions)
      if (entry.condition === "invisible") entry.unseen = { pierced: ["truesight"] };
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
      ],
      board: {
        grid: { width: 24, height: 15, tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, druid: { x: 2, y: 9 }, a: { x: 12, y: 7 } },
        light: "dark",
      },
    });
    state.order = ["mage", "druid", "a"];
    state.turn = 0;
    return state;
  };
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
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
  const light = (state: RulesetEncounterState, x: number, y: number) => rulesetLightAt(definition, state, { x, y });
  const labels = (state: RulesetEncounterState, id: string) => (who(state, id).zones ?? []).map((one) => one.label);

  // ── Daylight at a point ──
  {
    const state = fight();
    assert.equal(sees(state, "mage", "a"), false, "a in the dark");
    const lit = cast(state, "mage", "Daylight", { x: 12, y: 7 });
    assert.equal(light(lit.state, 12, 7), "bright", "its middle");
    assert.equal(light(lit.state, 14, 7), "bright", "10 feet off");
    assert.equal(light(lit.state, 15, 7), "dim", "15 feet off");
    assert.equal(light(lit.state, 16, 7), "dim", "its edge");
    assert.equal(light(lit.state, 17, 7), "dark", "past its own cells");
    assert.equal(sees(lit.state, "mage", "a"), true, "a lit up");
  }

  // ── A zone's sunlight (1.298) ──
  {
    const lit = cast(fight(), "mage", "Sunbeam", { x: 12, y: 7 });
    assert.equal(light(lit.state, 12, 7), "sunlight", "its middle");
    assert.equal(light(lit.state, 13, 7), "sunlight", "its edge");
    assert.equal(light(lit.state, 14, 7), "dark", "past it");
  }

  // ── A bullseye lantern's cone ──
  {
    const lit = cast(fight(), "mage", "Bullseye", { x: 3, y: 7 });
    assert.equal(light(lit.state, 4, 7), "bright", "ahead");
    assert.equal(light(lit.state, 5, 7), "bright", "15 feet ahead");
    assert.equal(light(lit.state, 8, 7), "dim", "30 feet ahead");
    assert.equal(light(lit.state, 6, 7), "dim", "20 feet ahead");
    assert.equal(light(lit.state, 9, 7), "dark", "past the cone");
    assert.equal(light(lit.state, 1, 7), "dark", "behind");
    assert.equal(light(lit.state, 2, 12), "dark", "beside");
  }

  // ── Daylight ends the darkness it meets, at its level or lower ──
  {
    const darkened = cast(fight(), "druid", "Dark", { x: 12, y: 7 });
    assert.deepEqual(labels(darkened.state, "druid"), ["Dark"]);
    const lit = cast(darkened.state, "mage", "Daylight", { x: 14, y: 7 });
    const event = lit.events.find((one) => one.type === "zone" && one.outcome === "dispelled");
    assert.ok(event && event.type === "zone" && event.actorId === "druid", JSON.stringify(lit.events));
    assert.deepEqual(labels(lit.state, "druid"), [], "the darkness is gone");
    // Too weak for it, it stays.
    const weak = cast(cast(fight(), "druid", "Dark", { x: 12, y: 7 }).state, "mage", "Glow", { x: 14, y: 7 });
    assert.deepEqual(labels(weak.state, "druid"), ["Dark"], "a 1st-level darkness outlasts a cantrip's light");
    // Out of its reach, it stays.
    const far = cast(cast(fight(), "druid", "Dark", { x: 12, y: 7 }).state, "mage", "Daylight", { x: 20, y: 2 });
    assert.deepEqual(labels(far.state, "druid"), ["Dark"]);
    // Darkness cast into Daylight goes at once.
    // Fog that is not darkness, it leaves alone.
    const fogged = cast(cast(fight(), "druid", "Fog", { x: 12, y: 7 }).state, "mage", "Daylight", { x: 14, y: 7 });
    assert.deepEqual(labels(fogged.state, "druid"), ["Fog"], "plain fog stays");
    const into = cast(cast(fight(), "mage", "Daylight", { x: 14, y: 7 }).state, "druid", "Dark", { x: 12, y: 7 });
    assert.deepEqual(labels(into.state, "druid"), []);
  }

  // ── A light that reveals the invisible ──
  {
    const state = fight();
    who(state, "a").tracked.push({ condition: "invisible", rounds: null } as never);
    const lit = cast(state, "mage", "Daylight", { x: 12, y: 7 });
    assert.equal(sees(lit.state, "mage", "a"), false, "invisible in plain daylight");
    const revealed = cast(lit.state, "druid", "Reveal", { x: 12, y: 7 });
    assert.equal(sees(revealed.state, "mage", "a"), true, "seen in the revealing light");
    // Moved into its dim light, invisible again.
    who(revealed.state, "a").x = 14;
    assert.equal(sees(revealed.state, "mage", "a"), false, "dim light shows nobody");
    // Bright reach past its own cells shows nobody there.
    const peeked = cast(lit.state, "druid", "Peek", { x: 14, y: 7 });
    assert.equal(sees(peeked.state, "mage", "a"), false, "outside the peek's own cell");
    // A creature's own revealing light: a lantern of revealing it carries.
    const lantern = fight();
    who(lantern, "a").tracked.push({ condition: "invisible", rounds: null } as never);
    who(lantern, "a").block!.light = { bright: 10, dim: 0, reveals: true };
    assert.equal(sees(lantern, "mage", "a"), true, "shown by its own lantern");
    who(lantern, "a").block!.light = { bright: 10, dim: 0 };
    assert.equal(sees(lantern, "mage", "a"), false, "a plain lantern shows nobody invisible");
  }

  // ── Refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(spell("odd", mechanics));
      });
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 5 },
        range: 30,
        zone: { rounds: 1, triggers: [], lights: { bright: 0, dim: 0 } },
      }),
      /A light reaches somewhere/,
    );
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 5 },
        range: 30,
        zone: { rounds: 1, triggers: [], dispelsDark: { upTo: -1 } },
      }),
      /dispelsDark/,
    );
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 5 },
        range: 30,
        zone: { rounds: 1, triggers: [], obscures: { darkness: "yes" } },
      }),
      /darkness/,
    );
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
      "A ruleset with zones that shed light or end magical darkness, or light that shows the invisible, requires schemaVersion 2 and capabilityApi 1.297 or newer";
    const only = (entry: RulesetCatalogEntry) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
      return doc;
    };
    const dispels = spell("dispels", {
      area: { shape: "burst", size: 5 },
      range: 30,
      zone: { rounds: 1, triggers: [], dispelsDark: { upTo: 3 } },
    });
    const lantern = {
      id: "lantern",
      label: "Lantern",
      rows: [],
      light: { bright: 30, dim: 30, reveals: true },
    } as never;
    for (const entry of [bullseye, dispels, dark, reveal, lantern]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(296) as never, only(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(297) as never, only(entry)), gate, entry.id);
    }
  }

  console.log(
    "Light zones: Daylight at a point, a bullseye lantern's cone, darkness ended by a light of its level or more, the invisible shown in a revealing light; refusals; gated at 1.297.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
