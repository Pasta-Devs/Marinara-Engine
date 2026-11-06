/**
 * A cage (Capability API 1.602): 5e's Forcecage.
 *
 *   - `area.ringOnly`: a wall that may be laid as a ring is always laid as one.
 *   - Zone `blocks: ["spells"]`, a wall or not: no spell is cast into, out of or across it. A spell
 *     aimed at someone inside is refused, an area is not aimed into it and one beside it stops at its
 *     edge; a weapon shot is not stopped, nor a spell cast from inside at someone inside.
 *   - A scroll's use, and a further use, laid only as a ring too.
 *   - Refusals, and the install gate.
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
  rulesetTargetRefusal,
  rulesetSheetBuildSchema,
  rulesetAimLegal,
  rulesetAimedCells,
  rulesetSpellsBlocked,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 602);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics: { budget: "action", ...mechanics },
  });
  const box = spell("cage", "Cage", {
    kind: "utility",
    budget: "bonus",
    area: { shape: "burst", size: 5 },
    range: 100,
    zone: { rounds: 10, triggers: [], blocks: ["spells"] },
  });
  const bars = spell("bars", "Bars", {
    kind: "utility",
    area: { shape: "wall", size: 80, ring: 20, ringOnly: true },
    range: 100,
    zone: { rounds: 10, triggers: [], blocks: ["move"] },
  });
  const spark = spell("spark", "Spark", {
    kind: "attack",
    targets: "enemy",
    range: 120,
    autoHit: true,
    amount: { flat: 1 },
    damageType: "fire",
  });
  const frost = spell("frost", "Frost", {
    kind: "attack",
    autoHit: true,
    area: { shape: "burst", size: 5 },
    range: 120,
    amount: { flat: 1 },
    damageType: "cold",
  });
  const fiveE = (entries: unknown[] = [box, bars, spark, frost]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = {
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Bow", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 }, reach: 60 }],
  } as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "wizard",
        name: "Wizard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
          fields: { level: 13, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int", slots_max_1: 9 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "giant", name: "Giant", side: "enemy", block },
    ],
    board: {
      grid: { width: 24, height: 12, tiles: Array.from({ length: 12 }, () => Array(24).fill("plains")) },
      placements: { wizard: { x: 1, y: 5 }, giant: { x: 12, y: 5 } },
    },
  });
  state.order = ["wizard", "giant"];
  state.turn = 0;
  const optionOf = (label: string) =>
    rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === label)!;

  // ── Laid only as a ring, whichever way it is asked for ──
  {
    const ring = optionOf("Bars");
    assert.equal(ring.area?.ringOnly, true);
    const plain = rulesetAimedCells(state, "wizard", ring.id, { x: 12, y: 5 });
    const asked = rulesetAimedCells(state, "wizard", ring.id, { x: 12, y: 5 }, { ring: true });
    assert.deepEqual(plain, asked);
    const ys = new Set(plain.map((cell) => cell.y));
    assert.ok(ys.size > 1, "a ring, not a straight run");
  }

  // ── The box, over the giant ──
  const cast = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "wizard", optionId: optionOf("Cage").id, targetIds: [], at: { x: 12, y: 5 } },
    () => 10,
  );
  assert.deepEqual(of(cast.events, "refused"), []);
  const after = cast.state;
  const wizard = rulesetCombatant(after, "wizard")!;
  const sparkAction = wizard.actions.find((one) => one.label === "Spark")!;
  const sparkOption = rulesetCombatOptions(definition, after, "wizard").find((one) => one.label === "Spark")!;
  const frostOption = rulesetCombatOptions(definition, after, "wizard").find((one) => one.label === "Frost")!;

  // Into it, out of it and across it, a spell is stopped; inside it, or well clear of it, not.
  assert.equal(rulesetSpellsBlocked(after, sparkAction, { x: 1, y: 5 }, { x: 12, y: 5 }), true);
  assert.equal(rulesetSpellsBlocked(after, sparkAction, { x: 12, y: 5 }, { x: 1, y: 5 }), true);
  assert.equal(rulesetSpellsBlocked(after, sparkAction, { x: 1, y: 5 }, { x: 20, y: 5 }), true);
  assert.equal(rulesetSpellsBlocked(after, sparkAction, { x: 11, y: 5 }, { x: 13, y: 5 }), false);
  assert.equal(rulesetSpellsBlocked(after, sparkAction, { x: 1, y: 0 }, { x: 20, y: 0 }), false);
  // Aimed at the giant inside, Spark is refused.
  assert.equal(rulesetTargetRefusal(after, "wizard", sparkOption.id, "giant"), "no-line-of-sight");
  const shot = applyRulesetCombatChoice(
    definition,
    after,
    { actorId: "wizard", optionId: sparkOption.id, targetIds: ["giant"] },
    () => 10,
  );
  assert.ok(of(shot.events, "refused").length > 0, "stopped at the cage");
  // Frost is not aimed into it, and aimed beside it stops at its edge.
  assert.equal(rulesetAimLegal(after, "wizard", frostOption.id, { x: 12, y: 5 }), false);
  assert.equal(rulesetAimLegal(after, "wizard", frostOption.id, { x: 10, y: 5 }), true);
  const caught = rulesetAimedCells(after, "wizard", frostOption.id, { x: 10, y: 5 }).map(
    (cell) => `${cell.x},${cell.y}`,
  );
  assert.ok(caught.includes("9,5") && caught.includes("10,5"));
  assert.ok(!caught.includes("11,5"), "not over into the cage");
  // The giant's bow is no spell.
  after.turn = 1;
  const bow = rulesetCombatOptions(definition, after, "giant").find((one) => one.label === "Bow")!;
  assert.equal(rulesetTargetRefusal(after, "giant", bow.id, "wizard"), null);

  // ── A scroll's use, and a further use, laid only as a ring too ──
  {
    const cageUse = () => ({
      kind: "utility",
      budget: "action",
      area: { shape: "wall", size: 80, ring: 20, ringOnly: true },
      range: 100,
      zone: { rounds: 10, triggers: [], blocks: ["move"] },
    });
    const scrolls = fiveE();
    scrolls.items = { categories: [{ id: "gear", label: "Gear" }] };
    scrolls.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "scroll",
          label: "Scroll of Bars",
          item: {
            category: "gear",
            use: cageUse(),
            moreUses: [{ label: "Box form", use: cageUse() }],
          },
        },
      ],
    });
    const withScroll = parsed(scrolls);
    const scroll = withScroll.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
    assert.equal(scroll.use?.area?.ringOnly, true);
    assert.equal(scroll.moreUses?.[0]?.use.area?.ringOnly, true);
    const holding = createRulesetEncounter({
      definition: withScroll,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
            fields: { level: 13, ac: 12, speed: 30, hp_max: 60 },
          }),
          items: [{ item: scroll, quantity: 1, worn: false, name: "Scroll of Bars" }],
        },
        { id: "giant", name: "Giant", side: "enemy", block },
      ],
      board: {
        grid: { width: 24, height: 12, tiles: Array.from({ length: 12 }, () => Array(24).fill("plains")) },
        placements: { wizard: { x: 1, y: 5 }, giant: { x: 12, y: 5 } },
      },
    });
    holding.order = ["wizard", "giant"];
    holding.turn = 0;
    const uses = rulesetCombatOptions(withScroll, holding, "wizard").filter((one) => one.area?.shape === "wall");
    assert.equal(uses.length, 2, uses.map((one) => one.label).join(", "));
    for (const use of uses) {
      assert.equal(use.area?.ringOnly, true, use.label);
      const ys = new Set(rulesetAimedCells(holding, "wizard", use.id, { x: 12, y: 5 }).map((cell) => cell.y));
      assert.ok(ys.size > 1, `${use.label}: a ring`);
    }
  }

  // ── Refusals ──
  refused(
    fiveE([
      spell("bad", "Bad", {
        kind: "utility",
        area: { shape: "wall", size: 80, ringOnly: true },
        range: 100,
        zone: { rounds: 10, triggers: [] },
      }),
    ]),
    /"ringOnly" lays it as its ring, so it has "ring"/,
  );
  refused(
    fiveE([
      spell("bad", "Bad", {
        kind: "utility",
        area: { shape: "burst", size: 5 },
        range: 100,
        zone: { rounds: 10, triggers: [], blocks: ["spells", "move"] },
      }),
    ]),
    /Only a wall "blocks" or has a "side"/,
  );

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a wall laid only as a ring (area.ringOnly) or a zone that blocks spells (zone.blocks "spells") requires schemaVersion 2 and capabilityApi 1.602 or newer';
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(601) as never, fiveE([box])), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(601) as never, fiveE([bars])), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(602) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(601) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Cage: a wall laid only as a ring; a box that stops spells cast into, out of or across it, not a bow; gated at 1.602.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
