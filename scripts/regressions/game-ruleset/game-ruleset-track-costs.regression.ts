/** Capability API 1.218: applying a row to a roll may mark a live track, Blades' 2 Stress for
 *  Rook's Gambit, and a name with a curly apostrophe answers to a straight one. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-track-costs-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildSkillCheckRulesetContext, resolveSkillCheckWithContext }, { getCapabilityPackageInstallIssue }] =
    await Promise.all([
      import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
      import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
    ]);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    const old = document.resolution;
    document.resolution = {
      kind: "dice-highest",
      die: { sides: 6 },
      abilityModifier: old.abilityModifier,
      proficiencyTiers: old.proficiencyTiers,
      adjust: old.adjust,
      pool: { min: 0, max: 8 },
      difficultyLadder: [
        { label: "Partial", dc: 4 },
        { label: "Full", dc: 6 },
      ],
    };
    document.sheet.lists.push({
      id: "abilities",
      label: "Special abilities",
      maxItems: 10,
      columns: [{ id: "name", label: "Name", type: "text", maxLength: 80 }],
      contextual: { name: "name", check: { best: true }, cost: [{ track: "heat", by: 2 }] },
    });
    edit?.(document);
    return document;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(doc());
  const blank = defaultRulesetSheetBuild(definition);
  const build: RulesetSheetBuild = {
    ...blank,
    abilities: { ...blank.abilities, brawn: 2, wits: 1 },
    skills: { ...blank.skills, scrap: "expert" },
    lists: { ...blank.lists, abilities: [{ name: "Rook\u2019s Gambit" }] },
  };
  const cards = [{ name: "Wren", rulesetSheet: { v: definition.sheet.version, build } }];
  const context = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(definition, cards, cards[0]),
  };
  const spent: Record<string, unknown>[] = [];
  const roll = (request: Record<string, unknown>) =>
    resolveSkillCheckWithContext(context as any, { dc: 4, ...request } as any, undefined, (_key, live) =>
      spent.push(live as Record<string, unknown>),
    );
  const scrap = roll({ skill: "Scrap" }).rolls.length;
  // Applied by its straight-apostrophe name: Scrap's dice, and 2 heat marked.
  const gambit = roll({ skill: "Sneak", apply: ["Rook's Gambit"] });
  assert.equal(gambit.rolls.length, scrap);
  assert.deepEqual((spent.at(-1) as { tracks?: Record<string, number> }).tracks?.heat, 2);
  // Without a caller to keep the mark, nothing is applied.
  const unpaid = resolveSkillCheckWithContext(
    context as any,
    { dc: 4, skill: "Sneak", apply: ["Rook's Gambit"] } as any,
  );
  assert.ok(unpaid.rolls.length < scrap);

  // ── The schema ──
  const refused = parseRulesetDefinition(
    doc((d) => (d.sheet.lists.at(-1).contextual.cost = [{ track: "strain", by: 1 }])),
  );
  assert.ok(!refused.ok && refused.issues.some((issue) => /No live track "strain" to mark/.test(issue)));

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "track-costs",
    name: "Track costs",
    version: "0.1.0",
    description: "Track costs proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(217) as any, doc()) ?? "", /1\.218/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(218) as any, doc()), null);
  console.log("game-ruleset-track-costs: passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
