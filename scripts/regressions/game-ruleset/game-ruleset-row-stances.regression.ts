/** Capability API 1.212: a list's row checks in a resolution stance, so Stewpot's "Fishing
 *  (STILLNESS)" counts dice the way the stance says. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCheckStance,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-row-stances-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const gravewatchText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url)),
    "utf8",
  );
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(gravewatchText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    for (const catalog of document.catalogs) {
      for (const entry of catalog.entries ?? []) {
        const check = entry.mechanics?.check;
        if (!check) continue;
        delete check.explode;
        delete check.double;
        if (Object.keys(check).length === 0) delete entry.mechanics.check;
      }
    }
    const resolution = document.resolution;
    for (const key of ["explode", "double", "cancel", "botch", "reroll"]) delete resolution[key];
    for (const step of resolution.difficultyLadder) delete step.target;
    resolution.die = { sides: 6 };
    resolution.target = { default: 4, min: 2, max: 5, from: { abilityScore: "warmth" } };
    resolution.stances = [
      { id: "stillness", label: "STILLNESS", count: "below", skills: ["dig"] },
      { id: "motion", label: "MOTION", count: "above", skills: ["soothe"] },
    ];
    document.sheet.lists.push({
      id: "pursuits",
      label: "Pursuits",
      maxItems: 20,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 60 },
        { id: "rating", label: "Rating", type: "number", min: 0, max: 5, default: 1 },
      ],
      checks: [{ id: "pursuit", name: "name", rating: "rating", stance: "stillness" }],
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

  // The helper: a skill a stance names, and a row check whose list is in one.
  assert.equal(rulesetCheckStance(definition, "soothe")?.id, "motion");
  assert.equal(rulesetCheckStance(definition, "row:pursuits:pursuit:fishing")?.id, "stillness");
  assert.equal(rulesetCheckStance(definition, "barter"), undefined);
  const plain = parsed(doc((d) => delete d.sheet.lists.at(-1).checks[0].stance));
  assert.equal(rulesetCheckStance(plain, "row:pursuits:pursuit:fishing"), undefined);

  // Through the resolver: "Fishing" off Kit's own row counts dice below Kit's Number.
  const build = defaultRulesetSheetBuild(definition);
  const cards = [
    {
      name: "Kit",
      rulesetSheet: {
        v: definition.sheet.version,
        build: {
          ...build,
          abilities: { ...build.abilities, warmth: 4 },
          lists: { ...build.lists, pursuits: [{ name: "Fishing", rating: 2 }] },
        },
      },
    },
  ];
  const context = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(definition, cards, cards[0]),
  };
  const fishing = resolveSkillCheckWithContext(context as any, { skill: "Fishing", dc: 1 } as any);
  assert.deepEqual([fishing.threshold, fishing.compare], [4, "below"]);
  const soothe = resolveSkillCheckWithContext(context as any, { skill: "Soothe", dc: 1 } as any);
  assert.equal(soothe.compare, "above");

  // The Game Master is told which rows are in the stance.
  const reminder = buildGmFormatReminder({
    turnNumber: 2,
    gameActiveState: "exploration" as const,
    partyNames: ["Kit"],
    playerName: "Kit",
    ruleset: definition,
  });
  assert.match(reminder, /STILLNESS checks \(Dig, every Pursuits row\) count dice below the target\./);

  // ── The schema ──
  const refused = parseRulesetDefinition(doc((d) => (d.sheet.lists.at(-1).checks[0].stance = "nope")));
  assert.ok(!refused.ok && refused.issues.some((issue) => /No resolution stance "nope"/.test(issue)));

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "row-stances",
    name: "Row stances",
    version: "0.1.0",
    description: "Row stances proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(211) as any, doc()) ?? "", /1\.212/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(212) as any, doc()), null);
  console.log("game-ruleset-row-stances: passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
