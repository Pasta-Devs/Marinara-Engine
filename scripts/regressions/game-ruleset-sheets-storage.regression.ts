/**
 * Slice 3 of Game Mode rulesets: a ruleset sheet is a starting build stored on a character card
 * (`data.extensions.rulesetSheets`) or a persona (`personaStats.rulesetSheets`), keyed by ruleset id.
 *
 * The rule is KEEP DORMANT, NEVER DROP. A sheet for a ruleset this install lacks rides every
 * schema, normaliser and importer untouched, because dropping it would destroy it for anyone who
 * installs the ruleset later and for everyone downstream of a re-export. The boundary only checks
 * what holds for any ruleset: a usable key, an object, and the 64 KB cap.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  capImportedRulesetSheets,
  characterDataSchema,
  createRulesetSheetEnvelope,
  normalizePersonaStats,
  parseRulesetDefinition,
  personaUpdateInputSchema,
  RULESET_SHEET_MAX_BYTES,
  RULESET_SHEETS_MAX,
  storedRulesetSheetsSchema,
  updateCharacterSchema,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sheets-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { normalizeNativeCharacterData } =
    await import("../../packages/server/src/services/import/marinara.importer.js");

  const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
  const parsedExample = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")));
  assert.ok(parsedExample.ok);
  const fiveE = parsedExample.definition;

  const installedSheet = createRulesetSheetEnvelope(fiveE);
  // A sheet for a ruleset nobody here has, in a shape this Engine has never seen.
  const dormantSheet = { v: 7, build: { attributes: { blood: 3 }, disciplines: ["celerity"] }, futureKey: true };
  const sheets = { "5e-2014": installedSheet, "Kenhito/v20": dormantSheet };
  const oversized = { v: 1, build: { notes: "x".repeat(RULESET_SHEET_MAX_BYTES) } };

  // ── The boundary: bounded, never shape-checked ──
  {
    assert.deepEqual(storedRulesetSheetsSchema.parse(sheets), sheets);
    const tooBig = storedRulesetSheetsSchema.safeParse({ "5e-2014": oversized });
    assert.equal(tooBig.success, false);
    assert.match(JSON.stringify(tooBig.success ? "" : tooBig.error.issues), /over the 65536-byte limit/);
    assert.equal(storedRulesetSheetsSchema.safeParse({ "../escape": installedSheet }).success, false);
    assert.equal(storedRulesetSheetsSchema.safeParse({ "5e-2014": "a string" }).success, false);
    const many = Object.fromEntries(
      Array.from({ length: RULESET_SHEETS_MAX + 1 }, (_, i) => [`ruleset-${i}`, { v: 1 }]),
    );
    assert.equal(storedRulesetSheetsSchema.safeParse(many).success, false);
  }

  // ── Character cards: create, update and native import all keep both sheets ──
  {
    const card = {
      name: "Mira",
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      creator: "",
      character_version: "",
      alternate_greetings: [],
      extensions: { rulesetSheets: sheets, someOtherTool: { kept: true } },
    };
    const created = characterDataSchema.parse(card);
    assert.deepEqual(created.extensions.rulesetSheets, sheets, "a card keeps the dormant sheet byte for byte");
    assert.deepEqual((created.extensions as Record<string, unknown>).someOtherTool, { kept: true });

    const updated = updateCharacterSchema.parse({ data: { extensions: { rulesetSheets: sheets } } });
    assert.deepEqual(updated.data.extensions?.rulesetSheets, sheets);
    assert.equal(
      updateCharacterSchema.safeParse({ data: { extensions: { rulesetSheets: { "5e-2014": oversized } } } }).success,
      false,
    );

    const imported = normalizeNativeCharacterData(card);
    assert.deepEqual(imported?.extensions.rulesetSheets, sheets, "native import keeps the dormant sheet");

    // An unusable sheet costs the import that sheet, never the card and never its neighbours.
    const messy = normalizeNativeCharacterData({
      ...card,
      extensions: {
        ...card.extensions,
        rulesetSheets: { ...sheets, "too-big": oversized, "Bad Key!": installedSheet },
      },
    });
    assert.ok(messy, "one oversized sheet must not fail the whole import");
    assert.deepEqual(messy.extensions.rulesetSheets, sheets);
    const garbage = normalizeNativeCharacterData({ ...card, extensions: { rulesetSheets: "not an object" } });
    assert.ok(garbage);
    assert.equal("rulesetSheets" in garbage.extensions, false);
    // A card with no sheets is untouched.
    const plain = normalizeNativeCharacterData({ ...card, extensions: {} });
    assert.equal("rulesetSheets" in (plain?.extensions ?? {}), false);
  }

  // ── Personas: the update boundary and the tolerant normaliser keep the key ──
  {
    const personaStats = { enabled: true, bars: [], rulesetSheets: sheets, someOtherTool: 1 };
    const update = personaUpdateInputSchema.parse({ personaStats });
    assert.deepEqual(update.personaStats?.rulesetSheets, sheets);
    assert.equal(
      personaUpdateInputSchema.safeParse({ personaStats: { ...personaStats, rulesetSheets: { "5e-2014": oversized } } })
        .success,
      false,
    );

    const normalized = normalizePersonaStats(personaStats);
    assert.deepEqual(normalized?.rulesetSheets, sheets, "persona normalization keeps the dormant sheet");
    assert.equal((normalized as Record<string, unknown>).someOtherTool, 1);
    // Stored as a JSON string, the same holds.
    assert.deepEqual(normalizePersonaStats(JSON.stringify(personaStats))?.rulesetSheets, sheets);
    const capped = normalizePersonaStats({ ...personaStats, rulesetSheets: { ...sheets, "too-big": oversized } });
    assert.deepEqual(capped?.rulesetSheets, sheets, "an oversized sheet is dropped, the persona's stats are not");
    assert.equal("rulesetSheets" in (normalizePersonaStats({ enabled: true, bars: [] }) ?? {}), false);
  }

  // ── A SillyTavern-style card import keeps the sheets too, and never writes an empty key ──
  {
    const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
    const { importSTCharacter } = await import("../../packages/server/src/services/import/st-character.importer.js");
    const { createCharactersStorage } =
      await import("../../packages/server/src/services/storage/characters.storage.js");
    const db = await getDB();
    try {
      const storage = createCharactersStorage(db);
      const v2Card = (rulesetSheets: unknown) => ({
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: { name: "Mira", description: "", extensions: { rulesetSheets } },
      });
      const readExtensions = async (characterId: string | null | undefined) => {
        assert.ok(characterId);
        const row = await storage.getById(characterId);
        assert.ok(row);
        const data = (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as {
          extensions: Record<string, unknown>;
        };
        return data.extensions;
      };

      const kept = await importSTCharacter(v2Card({ ...sheets, "too-big": oversized }), db);
      assert.equal(kept.success, true);
      assert.deepEqual((await readExtensions(kept.characterId)).rulesetSheets, sheets);

      const garbage = await importSTCharacter(v2Card("not an object"), db);
      assert.equal(garbage.success, true);
      assert.equal("rulesetSheets" in (await readExtensions(garbage.characterId)), false);
    } finally {
      await closeDB();
    }
  }

  // ── The importer helper reports what it dropped ──
  {
    const result = capImportedRulesetSheets({ ...sheets, "too-big": oversized });
    assert.deepEqual(result.sheets, sheets);
    assert.deepEqual(result.dropped, ["too-big"]);
    assert.deepEqual(capImportedRulesetSheets(undefined), { sheets: undefined, dropped: [] });
    // Nothing usable left reads as no sheets, so a caller never writes an empty key.
    assert.deepEqual(capImportedRulesetSheets({ "too-big": oversized }), { sheets: undefined, dropped: ["too-big"] });
    assert.deepEqual(capImportedRulesetSheets({}), { sheets: undefined, dropped: [] });
  }

  console.info("game ruleset sheet storage regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
