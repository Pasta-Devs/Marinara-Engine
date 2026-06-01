// ──────────────────────────────────────────────
// ST Card Regex Script Extraction & Import
// ──────────────────────────────────────────────
import { storageApi } from "../../shared/api/storage-api";
import {
  createRegexScriptSchema,
  type CreateRegexScriptInput,
} from "../../engine/contracts/schemas/regex.schema";
import { isPatternSafe } from "../../engine/shared/regex/regex-safety";

/** Numeric placement map from ST card format to engine placement strings. */
type RegexPlacement = CreateRegexScriptInput["placement"][number];

const PLACEMENT_MAP: Record<number, RegexPlacement> = {
  1: "user_input",
  2: "ai_output",
};

const DEFAULT_PLACEMENT: RegexPlacement[] = ["user_input", "ai_output"];

interface STRegexScriptEntry {
  scriptName?: string;
  findRegex?: string;
  replaceString?: string;
  trimStrings?: string[];
  placement?: number[];
  disabled?: boolean;
  flags?: string;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

type ExtractedRegexScript = CreateRegexScriptInput;

/**
 * Parse a `/pattern/flags` string into { pattern, flags }.
 * Falls back to treating the whole string as a pattern if no delimiters found.
 */
function parseRegexLiteral(value: string): { pattern: string; flags?: string } {
  const match = value.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (match) return { pattern: match[1]!, flags: match[2]! };
  return { pattern: value };
}

function warnUnsupportedOptions(entry: STRegexScriptEntry, scriptName: string) {
  const hasUnsupportedRunOnEdit = entry.runOnEdit === true;
  const hasUnsupportedSubstituteRegex = entry.substituteRegex != null && entry.substituteRegex !== 0;
  if (!hasUnsupportedRunOnEdit && !hasUnsupportedSubstituteRegex) return;

  console.warn("[regex-import] Unsupported SillyTavern regex options were skipped.", {
    scriptName,
    runOnEdit: entry.runOnEdit,
    substituteRegex: entry.substituteRegex,
  });
}

/**
 * Extract embedded regex scripts from a character's ST card extensions data.
 */
function extractEmbeddedRegexScripts(
  characterData: Record<string, unknown>,
  characterId: string,
): ExtractedRegexScript[] {
  const extensions = characterData.extensions as Record<string, unknown> | undefined;
  if (!extensions) return [];

  const regexScripts = extensions.regex_scripts as STRegexScriptEntry[] | undefined;
  if (!Array.isArray(regexScripts) || regexScripts.length === 0) return [];

  const results: ExtractedRegexScript[] = [];

  for (let i = 0; i < regexScripts.length; i++) {
    const entry = regexScripts[i]!;
    if (!entry.findRegex) continue;

    const { pattern, flags: parsedFlags } = parseRegexLiteral(entry.findRegex);

    // Skip patterns that could cause catastrophic backtracking (ReDoS)
    if (!isPatternSafe(pattern)) continue;

    const scriptName = entry.scriptName || `Regex ${i + 1}`;
    warnUnsupportedOptions(entry, scriptName);

    // Map numeric placements to engine placement strings.
    const placements: RegexPlacement[] = [];
    if (Array.isArray(entry.placement)) {
      for (const p of entry.placement) {
        const mapped = PLACEMENT_MAP[p];
        if (mapped) placements.push(mapped);
      }
    }
    // ST cards can omit placement; Marinara defaults those imports to both visible directions.
    if (placements.length === 0) placements.push(...DEFAULT_PLACEMENT);

    results.push({
      name: scriptName,
      characterId,
      enabled: !entry.disabled,
      findRegex: pattern,
      replaceString: entry.replaceString ?? "",
      trimStrings: Array.isArray(entry.trimStrings) ? entry.trimStrings : [],
      placement: placements,
      flags: entry.flags ?? parsedFlags ?? "gi",
      promptOnly: entry.promptOnly === true,
      order: i,
      minDepth: entry.minDepth ?? null,
      maxDepth: entry.maxDepth ?? null,
    });
  }

  return results;
}

/**
 * Import regex scripts from a character import result into storage.
 * Returns the number of scripts imported.
 */
export async function importRegexScriptsForCharacter(importResult: {
  characterId?: string;
  character?: { data?: Record<string, unknown> } | unknown;
}): Promise<number> {
  const characterId = importResult.characterId;
  if (!characterId) return 0;

  const character = importResult.character as { data?: Record<string, unknown> } | undefined;
  const characterData = character?.data;
  if (!characterData || typeof characterData !== "object") return 0;

  const scripts = extractEmbeddedRegexScripts(characterData, characterId);
  if (scripts.length === 0) return 0;

  const results = await Promise.allSettled(
    scripts.map((script) => {
      const payload = createRegexScriptSchema.parse(script);
      return storageApi.create("regex-scripts", { ...payload });
    }),
  );

  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    console.warn("[regex-import] Failed to import one or more scoped regex scripts.", {
      failed: failures.length,
      total: scripts.length,
      errors: failures.map((failure) => failure.reason),
    });
  }

  return results.length - failures.length;
}
