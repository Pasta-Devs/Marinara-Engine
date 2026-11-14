/** Capability API 1.217: a row or entry applied to a roll that throws the character's best skill
 *  rating in place of the one asked for, as Blades' Rook's Gambit does, on a highest-die check. */
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-best-rating-"));
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
      contextual: { name: "name", check: { best: true } },
    });
    document.sheet.lists.push({
      id: "lores",
      label: "Lores",
      maxItems: 4,
      columns: [
        { id: "name", label: "Lore", type: "text", maxLength: 60 },
        { id: "rating", label: "Rating", type: "number", min: 0, max: 6, default: 0 },
      ],
      checks: [{ id: "lore", name: "name", rating: "rating", ability: "brawn" }],
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
    lists: { ...blank.lists, abilities: [{ name: "Rook's Gambit" }] },
  };
  const cards = [{ name: "Wren", rulesetSheet: { v: definition.sheet.version, build } }];
  const context = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(definition, cards, cards[0]),
  };
  const dice = (request: Record<string, unknown>) =>
    resolveSkillCheckWithContext(context as any, { dc: 4, ...request } as any).rolls.length;
  const scrap = dice({ skill: "Scrap" });
  const sneak = dice({ skill: "Sneak" });
  assert.ok(scrap > sneak, "the fixture's best rating is Scrap");
  // Sneak rolled with Rook's Gambit throws Scrap's dice; Scrap itself is no higher.
  assert.equal(dice({ skill: "Sneak", apply: ["Rook's Gambit"] }), scrap);
  assert.equal(dice({ skill: "Scrap", apply: ["Rook's Gambit"] }), scrap);

  // A row check (1.161) is one of the character's ratings too, and here it is the best.
  const lorist: RulesetSheetBuild = { ...build, lists: { ...build.lists, lores: [{ name: "Old Roads", rating: 5 }] } };
  const loristCards = [{ name: "Wren", rulesetSheet: { v: definition.sheet.version, build: lorist } }];
  const loristContext = { ...context, ruleset: buildSkillCheckRulesetContext(definition, loristCards, loristCards[0]) };
  const loristDice = (request: Record<string, unknown>) =>
    resolveSkillCheckWithContext(loristContext as any, { dc: 4, ...request } as any).rolls.length;
  const roads = loristDice({ skill: "Old Roads" });
  assert.ok(roads > scrap, "the lore outrates Scrap");
  assert.equal(loristDice({ skill: "Sneak", apply: ["Rook's Gambit"] }), roads);

  // ── The schema ──
  const refused = parseRulesetDefinition(
    doc(
      (d) =>
        (d.sheet.lists.find((list: { id: string }) => list.id === "abilities").contextual.check = {
          best: true,
          dice: 1,
        }),
    ),
  );
  assert.ok(!refused.ok && refused.issues.some((issue) => /no pool for a check effect to change/.test(issue)));

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "best-rating",
    name: "Best rating",
    version: "0.1.0",
    description: "Best rating proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(216) as any, doc()) ?? "", /1\.217/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(217) as any, doc()), null);
  console.log("game-ruleset-best-rating: passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
