/**
 * Magical darkness against light (Capability API 1.299).
 *
 *   - A darkness zone's `dispelsLight`: light a spell of that level or lower made ends where the two
 *     meet, a zone's `lights` or a condition's `light`, whichever came first: 5e's Darkness.
 *   - Only magical light (a spell's, or a light marked `magical`) lights magical darkness's cells.
 *   - `dispelsDark.within`: Daylight ends only darkness its bright sphere meets.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-darkness-dispels-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 294);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { kind: "utility", cost: [{ pool: `slots_${level}`, amount: 1 }], ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Darkness: a 15-foot sphere of magical darkness that puts out spell light of 2nd level or lower.
  const darkness = spell("darkness", 2, {
    area: { shape: "burst", size: 15 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: { darkness: true }, dispelsLight: { upTo: 2 } },
  });
  // Spell light of 1st level, and of 3rd.
  const glow = spell("glow", 1, {
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 10 } },
  });
  const blaze = spell("blaze", 3, {
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 10 } },
  });
  // Daylight: a 60-foot sphere, ending darkness of 3rd level or lower only within 15 feet of its middle.
  const daylight = spell("daylight", 3, {
    area: { shape: "burst", size: 60 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 30, dim: 30 }, dispelsDark: { upTo: 3, within: 15 } },
  });
  // Flame Blade: a blade of fire in hand, shedding light, held by concentration.
  const flame = spell("flame", 2, {
    kind: "buff",
    targets: "self",
    concentration: true,
    applies: [{ condition: "flaming", duration: { rounds: 100 } }],
  });
  const spells = [darkness, glow, blaze, daylight, flame];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.sheet.live.conditions.push({ id: "flaming", label: "Flaming" });
    doc.combat.conditions.push({ condition: "flaming", effects: [], light: { bright: 10, dim: 10 } });
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
      fields: {
        level: 5,
        ac: 12,
        speed: 30,
        hp_max: 60,
        spellcasting_ability: "wis",
        slots_max_1: 9,
        slots_max_2: 9,
        slots_max_3: 9,
      },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const fight = (beast: Partial<RulesetStatBlock> = {}, light: RulesetBoardLight = "dark"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "druid", name: "Druid", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "a", name: "A", side: "enemy", block: block(beast) },
      ],
      board: {
        grid: { width: 30, height: 15, tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, druid: { x: 2, y: 9 }, a: { x: 12, y: 7 } },
        light,
      },
    });
    state.order = ["mage", "druid", "a"];
    state.turn = 0;
    return state;
  };
  const cast = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    at?: RulesetCombatCell,
    payWith?: string,
  ): RulesetCombatStep => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId,
        optionId: option.id,
        targetIds: at ? [] : [actorId],
        ...(at ? { at } : {}),
        ...(payWith ? { payWith } : {}),
      },
      () => 10,
    );
    const refused = step.events.find((one) => one.type === "refused");
    assert.equal(refused, undefined, JSON.stringify(step.events));
    return step;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const labels = (state: RulesetEncounterState, id: string) => (who(state, id).zones ?? []).map((one) => one.label);
  const light = (state: RulesetEncounterState, x: number, y = 7) => rulesetLightAt(definition, state, { x, y });
  const dispelled = (step: RulesetCombatStep) =>
    step.events.flatMap((one) => (one.type === "zone" && one.outcome === "dispelled" ? [one.label] : []));

  // ── Darkness puts out a lesser spell's light, whichever came first ──
  {
    const dark = cast(fight(), "druid", "Darkness", { x: 12, y: 7 });
    const lit = cast(dark.state, "mage", "Glow", { x: 15, y: 7 });
    assert.deepEqual(dispelled(lit), ["Glow"]);
    assert.deepEqual(labels(lit.state, "mage"), [], "the glow is gone");
    assert.deepEqual(labels(lit.state, "druid"), ["Darkness"], "the darkness stays");
    // Light first, darkness after.
    const first = cast(fight(), "mage", "Glow", { x: 15, y: 7 });
    const after = cast(first.state, "druid", "Darkness", { x: 12, y: 7 });
    assert.deepEqual(dispelled(after), ["Glow"]);
    // Out of its reach, it stays.
    const far = cast(cast(fight(), "druid", "Darkness", { x: 12, y: 7 }).state, "mage", "Glow", { x: 20, y: 7 });
    assert.deepEqual(labels(far.state, "mage"), ["Glow"]);
    // A greater spell's light stays, and lights the darkness: it is magical.
    const blazing = cast(cast(fight(), "druid", "Darkness", { x: 12, y: 7 }).state, "mage", "Blaze", { x: 14, y: 7 });
    assert.deepEqual(labels(blazing.state, "mage"), ["Blaze"]);
    assert.deepEqual(labels(blazing.state, "druid"), ["Darkness"]);
    assert.equal(light(blazing.state, 13), "bright", "magical light in the darkness");
    assert.equal(light(blazing.state, 11), "dark", "past its own cells");
  }

  // ── Nonmagical light does not light it ──
  {
    const torch = cast(fight({ light: { bright: 20, dim: 20 } }), "druid", "Darkness", { x: 12, y: 7 });
    assert.equal(light(torch.state, 12), "dark", "a torch inside the darkness");
    assert.equal(light(torch.state, 16), "bright", "its light outside it");
    // A magical light does.
    const blade = cast(fight({ light: { bright: 20, dim: 20, magical: true } }), "druid", "Darkness", { x: 12, y: 7 });
    assert.equal(light(blade.state, 12), "bright");
    // Darkness on a sunny field is still dark.
    const day = cast(fight({}, "sunlight"), "druid", "Darkness", { x: 12, y: 7 });
    assert.equal(light(day.state, 12), "dark");
    assert.equal(light(day.state, 20), "sunlight");
    // Without darkness, the torch lights the cell.
    assert.equal(light(fight({ light: { bright: 20, dim: 20 } }), 12), "bright");
  }

  // ── A spell's light on its holder ──
  {
    const flaming = cast(fight(), "mage", "Flame");
    assert.ok(who(flaming.state, "mage").tracked.some((one) => one.condition === "flaming"));
    assert.equal(who(flaming.state, "mage").tracked.find((one) => one.condition === "flaming")!.level, 2);
    // Darkness its light reaches puts it out, and the concentration on it.
    const near = cast(flaming.state, "druid", "Darkness", { x: 8, y: 7 });
    assert.ok(!who(near.state, "mage").tracked.some((one) => one.condition === "flaming"), "the flame is out");
    assert.equal(who(near.state, "mage").concentrating ?? null, null, "and the concentration with it");
    assert.ok(
      near.events.some((one) => one.type === "condition" && one.condition === "flaming" && !one.active),
      JSON.stringify(near.events),
    );
    // Darkness it doesn't reach leaves it be.
    const away = cast(cast(fight(), "mage", "Flame").state, "druid", "Darkness", { x: 12, y: 7 });
    assert.ok(who(away.state, "mage").tracked.some((one) => one.condition === "flaming"));
    // Not put on by a spell, nothing puts it out.
    const kept = fight();
    who(kept, "mage").tracked.push({ condition: "flaming", rounds: null } as never);
    const unspelled = cast(kept, "druid", "Darkness", { x: 8, y: 7 });
    assert.ok(
      who(unspelled.state, "mage").tracked.some((one) => one.condition === "flaming"),
      "no spell's light",
    );
    // Cast at 3rd level, it stays.
    const strong = cast(cast(fight(), "mage", "Flame", undefined, "slots_3").state, "druid", "Darkness", {
      x: 8,
      y: 7,
    });
    assert.ok(
      who(strong.state, "mage").tracked.some((one) => one.condition === "flaming"),
      "a 3rd-level flame stays",
    );
  }

  // ── Daylight's dispelling reach ──
  {
    const near = cast(cast(fight(), "druid", "Darkness", { x: 12, y: 7 }).state, "mage", "Daylight", { x: 17, y: 7 });
    assert.deepEqual(labels(near.state, "druid"), [], "within 15 feet of its middle");
    const far = cast(cast(fight(), "druid", "Darkness", { x: 12, y: 7 }).state, "mage", "Daylight", { x: 20, y: 7 });
    assert.deepEqual(labels(far.state, "druid"), ["Darkness"], "only its dim light reaches it");
    assert.deepEqual(labels(far.state, "mage"), ["Daylight"], "a 3rd-level light outlasts a 2nd-level darkness");
  }

  // ── Refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "spells")
          .entries.push(spell("odd", 1, mechanics));
      });
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 5 },
        range: 30,
        zone: { rounds: 1, triggers: [], obscures: {}, dispelsLight: { upTo: 1 } },
      }),
      /puts out spell light is magical darkness/,
    );
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 5 },
        range: 30,
        zone: { rounds: 1, triggers: [], lights: { bright: 5, dim: 5 }, dispelsDark: { upTo: 1, within: 0 } },
      }),
      /within/,
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
      "A ruleset with darkness that puts out spell light, magical light, or a dispelling reach, requires schemaVersion 2 and capabilityApi 1.299 or newer";
    const only = (entry: unknown) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
      return doc;
    };
    const blade = { id: "blade", label: "Blade", rows: [], light: { bright: 15, dim: 15, magical: true } };
    for (const entry of [darkness, daylight, blade]) {
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(298) as never, only(entry)),
        gate,
        (entry as { id: string }).id,
      );
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(299) as never, only(entry)), gate);
    }
  }

  console.log(
    "Darkness dispels: Darkness puts out lesser spell light on a zone or a holder (and its concentration), only magical light lights it, Daylight ends only darkness near its middle; refusals; gated at 1.299.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
