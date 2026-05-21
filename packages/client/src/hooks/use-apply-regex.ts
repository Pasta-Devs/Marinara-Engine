// ──────────────────────────────────────────────
// Hook: Apply Regex Scripts to text
// ──────────────────────────────────────────────
import { useCallback, useMemo } from "react";
import { useRegexScripts, type RegexScriptRow } from "./use-regex-scripts";
import { applyRegexReplacement, type RegexPlacement } from "@marinara-engine/shared";

export type ScopedRegexMode = "disabled" | "exclusive" | "chat";

type ParsedScript = ReturnType<typeof parseScript>;

/**
 * Parses a RegexScriptRow from DB into a usable form.
 */
function parseScript(row: RegexScriptRow) {
  const placements: RegexPlacement[] = (() => {
    try {
      return JSON.parse(row.placement);
    } catch {
      return ["ai_output"];
    }
  })();
  const trimStrings: string[] = (() => {
    try {
      return JSON.parse(row.trimStrings);
    } catch {
      return [];
    }
  })();
  return {
    ...row,
    enabledBool: row.enabled === "true",
    promptOnlyBool: row.promptOnly === "true",
    placements,
    trimStrings,
  };
}

function filterForMode(
  scripts: ParsedScript[],
  mode: ScopedRegexMode,
  characterId: string | undefined,
): ParsedScript[] {
  if (mode === "disabled") return scripts.filter((s) => s.characterId === null);
  if (mode === "chat") return scripts;
  // "exclusive": global + only the owning character's scripts
  if (!characterId) return scripts.filter((s) => s.characterId === null);
  return scripts.filter((s) => s.characterId === null || s.characterId === characterId);
}

/**
 * Applies all enabled regex scripts for a given placement to the input text.
 * @param depth — message depth (0 = latest message, 1 = one before, etc.). When
 *   undefined, depth range filtering is skipped (all scripts apply).
 */
function applyScripts(
  text: string,
  scripts: ParsedScript[],
  placement: RegexPlacement,
  options?: { promptOnly?: boolean; depth?: number; resolveMacros?: (value: string) => string },
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabledBool) continue;
    if (!script.placements.includes(placement)) continue;
    // Prompt context is opt-in. Display context runs visual scripts only.
    if (options?.promptOnly) {
      if (!script.promptOnlyBool) continue;
    } else if (script.promptOnlyBool) {
      continue;
    }

    // Depth range filtering
    if (options?.depth != null) {
      if (script.minDepth != null && options.depth < script.minDepth) continue;
      if (script.maxDepth != null && options.depth > script.maxDepth) continue;
    }

    try {
      const findRegex = options?.resolveMacros ? options.resolveMacros(script.findRegex) : script.findRegex;
      if (!findRegex) continue;
      const re = new RegExp(findRegex, script.flags);
      result = applyRegexReplacement(result, re, script.replaceString, (value) =>
        options?.resolveMacros ? options.resolveMacros(value) : value,
      );
      // Apply trim strings
      for (const trim of script.trimStrings) {
        const resolvedTrim = options?.resolveMacros ? options.resolveMacros(trim) : trim;
        if (resolvedTrim) result = result.split(resolvedTrim).join("");
      }
    } catch {
      // Invalid regex — skip silently
    }
  }
  return result;
}

interface RegexApplyOptions {
  scopedMode?: ScopedRegexMode;
  characterId?: string;
  depth?: number;
  resolveMacros?: (value: string) => string;
}

/**
 * Hook that provides functions to apply regex transformations.
 *
 * Scoped regex modes control how character-scoped scripts are applied:
 * - `disabled` — scoped scripts are ignored; only global scripts run.
 * - `exclusive` (default) — scoped scripts only apply to their owning character's messages.
 * - `chat` — all scoped scripts apply to every message, including user input.
 */
export function useApplyRegex(characterIds?: string[]) {
  const { data: regexScripts } = useRegexScripts(characterIds);

  // Pre-parse all scripts (sorted by order, which is done server-side)
  const parsedScripts = useMemo(() => {
    if (!regexScripts) return [];
    return (regexScripts as RegexScriptRow[]).map(parseScript);
  }, [regexScripts]);

  const applyToAIOutput = useCallback(
    (text: string, options?: RegexApplyOptions) => {
      const mode = options?.scopedMode ?? "exclusive";
      const filtered = filterForMode(parsedScripts, mode, options?.characterId);
      return applyScripts(text, filtered, "ai_output", options);
    },
    [parsedScripts],
  );

  const applyToUserInput = useCallback(
    (text: string, options?: RegexApplyOptions) => {
      const mode = options?.scopedMode ?? "exclusive";
      const filtered = filterForMode(parsedScripts, mode, options?.characterId);
      return applyScripts(text, filtered, "user_input", options);
    },
    [parsedScripts],
  );

  // Applies scripts in prompt context. Visual scripts are intentionally skipped.
  const applyPromptOnly = useCallback(
    (text: string, placement: RegexPlacement, options?: RegexApplyOptions) => {
      const mode = options?.scopedMode ?? "exclusive";
      const filtered = filterForMode(parsedScripts, mode, options?.characterId);
      return applyScripts(text, filtered, placement, { promptOnly: true, ...options });
    },
    [parsedScripts],
  );

  return { applyToAIOutput, applyToUserInput, applyPromptOnly };
}
