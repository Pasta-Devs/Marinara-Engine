/**
 * Tags read off an alignment in words (Capability API 1.699): a creature's `alignment` and a
 * character's `creatureTypes.tagsFrom` field name the tags a target test reads, so the Talisman of
 * Pure Good's fissure slays only the evil.
 *
 *   - "lawful evil" names lawful and evil; "any non-good alignment" and "unaligned" name nothing.
 *   - A character's "Neutral Good" names neutral and good.
 *   - A target test by tag reads both.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCreatureKind,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  rulesetTagsNamed,
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-alignment-tags-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 699);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: [
        { id: "humanoid", label: "Humanoid" },
        { id: "fiend", label: "Fiend" },
      ],
      default: "humanoid",
      tags: ["lawful", "chaotic", "good", "evil", "neutral"].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
      })),
      tagsFrom: "alignment",
    };
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.alignment = "lawful evil";
    edit(doc);
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
  const definition = parsed(fiveE());

  // ── The words ──
  assert.deepEqual(rulesetTagsNamed(definition, "lawful evil"), ["lawful", "evil"]);
  assert.deepEqual(rulesetTagsNamed(definition, "Chaotic Good"), ["chaotic", "good"]);
  assert.deepEqual(rulesetTagsNamed(definition, "any non-good alignment"), []);
  assert.deepEqual(rulesetTagsNamed(definition, "any non good alignment"), []);
  assert.deepEqual(rulesetTagsNamed(definition, "not evil"), []);
  assert.deepEqual(rulesetTagsNamed(definition, "any evil alignment"), ["evil"]);
  assert.deepEqual(rulesetTagsNamed(definition, "unaligned"), []);
  assert.deepEqual(rulesetTagsNamed(definition, "any alignment"), []);
  assert.deepEqual(rulesetTagsNamed(definition, "Goodly"), [], "whole words only");
  assert.deepEqual(rulesetTagsNamed(definition, "neutral"), ["neutral"]);

  // ── A creature and a character, read by a target test ──
  {
    const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    const devil = rulesetStatBlockFromCreature(definition, creature)!;
    assert.equal(devil.alignment, "lawful evil", "copied to the block");
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      combatants: [
        { id: "devil", name: "Devil", side: "enemy", block: { ...devil, type: "fiend" } },
        {
          id: "cultist",
          name: "Cultist",
          side: "enemy",
          block: {
            health: 9,
            defense: 12,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
            alignment: "any non-good alignment",
          } as unknown as RulesetStatBlock,
        },
        {
          id: "paladin",
          name: "Paladin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 16 },
            fields: { level: 5, ac: 18, speed: 30, hp_max: 44, alignment: "Neutral Good" },
          }),
        },
      ],
    } as never);
    const devilOne = rulesetCombatant(state, "devil")!;
    const cultist = rulesetCombatant(state, "cultist")!;
    const paladin = rulesetCombatant(state, "paladin")!;
    assert.deepEqual(rulesetCreatureKind(definition, devilOne), { type: "fiend", tags: ["lawful", "evil"] });
    assert.deepEqual(rulesetCreatureKind(definition, cultist).tags, []);
    assert.deepEqual(rulesetCreatureKind(definition, paladin), { type: "humanoid", tags: ["good", "neutral"] });
    const evil = { tags: ["evil"] };
    assert.equal(rulesetTargetIs(definition, devilOne, evil), true);
    assert.equal(rulesetTargetIs(definition, cultist, evil), false);
    assert.equal(rulesetTargetIs(definition, paladin, evil), false);
    assert.equal(rulesetTargetIs(definition, paladin, { tags: ["good"] }), true);
  }

  // ── Refused ──
  refused(
    fiveE((doc) => (doc.combat.creatureTypes.tagsFrom = "nowhere")),
    /Unknown field "nowhere"/,
  );
  refused(
    fiveE((doc) => (doc.combat.creatureTypes.tagsFrom = "level")),
    /A character's tags are read off a text or choice field, not "number"/,
  );
  refused(
    fiveE((doc) => delete doc.combat.creatureTypes.tags),
    /"tagsFrom" reads the words of "tags", so it declares them/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with tags read off an alignment in words (a creature's alignment, creatureTypes.tagsFrom) requires schemaVersion 2 and capabilityApi 1.699 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(698) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(699) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(698) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Alignment tags: a devil's lawful evil and a paladin's Neutral Good read as tags; gated at 1.699.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
