/**
 * A character's tags read off several fields (Capability API 1.713): `creatureTypes.tagsFrom` as a
 * list, `["race", "alignment"]`, so a ghoul's Claws pass over an elf player character.
 *
 *   - Each field is read as one is (1.699), and the tags of all of them kept, once each.
 *   - A one-field `tagsFrom` reads as before.
 *   - A rider that excepts elves (1.698) passes over the elf.
 *   - Import refusals and the install gate.
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
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tags-from-fields-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 713);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (tagsFrom: unknown = ["race", "alignment"]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: [{ id: "humanoid", label: "Humanoid" }],
      default: "humanoid",
      tags: ["good", "evil", "elf", "dwarf", "neutral"].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
      })),
      tagsFrom,
    };
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
  const party = (definition: RulesetDefinition) =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        ["elf", "High Elf", "Neutral Good"],
        ["dwarf", "Hill Dwarf", "Lawful Neutral"],
        ["half", "Half-Elf", ""],
      ].map(([id, race, alignment]) => ({
        id: id!,
        name: id!,
        side: "party" as const,
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          fields: { level: 3, ac: 12, speed: 30, hp_max: 20, race, alignment },
        }),
      })),
    });

  // ── Race and alignment both read ──
  {
    const definition = parsed(fiveE());
    const state = party(definition);
    const tags = (id: string) => rulesetCreatureKind(definition, rulesetCombatant(state, id)!).tags;
    assert.deepEqual(tags("elf"), ["elf", "good", "neutral"]);
    assert.deepEqual(tags("dwarf"), ["dwarf", "neutral"]);
    // A half-elf is not an elf: a hyphen joins it into another word.
    assert.deepEqual(tags("half"), []);
    const notElf = { except: { tags: ["elf"] } };
    assert.deepEqual(
      state.combatants.filter((one) => rulesetTargetIs(definition, one, notElf)).map((one) => one.id),
      ["dwarf", "half"],
    );
  }

  // ── One field reads as before ──
  {
    const definition = parsed(fiveE("alignment"));
    const state = party(definition);
    assert.deepEqual(rulesetCreatureKind(definition, rulesetCombatant(state, "elf")!).tags, ["good", "neutral"]);
  }

  // ── Refusals ──
  refused(fiveE(["race", "nowhere"]), /Unknown field "nowhere"/);
  refused(fiveE(["race", "level"]), /text or choice field/);
  refused(fiveE(["race", "race"]), /tagsFrom/);
  refused(fiveE([]), /tagsFrom/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset that reads a character's tags off several fields (creatureTypes.tagsFrom as a list) requires schemaVersion 2 and capabilityApi 1.713 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(712) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(713) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(712) as never, fiveE("alignment")), gate);
  }

  console.log(
    "Tags from fields: a High Elf of Neutral Good alignment carries elf, good and neutral; a ghoul's except-elves passes over the elf but not the half-elf; gated at 1.713.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
