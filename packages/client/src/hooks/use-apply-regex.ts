// ──────────────────────────────────────────────
// Hook: Apply Regex Scripts to text
// ──────────────────────────────────────────────
import { useCallback, useMemo } from "react";
import { useRegexScripts, type RegexScriptRow } from "./use-regex-scripts";
import {
  applyRegexReplacement,
  formatTextQuotes,
  isPatternSafe,
  resolveRegexPatternLiteralMacros,
  type RegexPlacement,
} from "@marinara-engine/shared";
import { useUIStore } from "../stores/ui.store";
import { useChatStore } from "../stores/chat.store";

/** How character-scoped regex scripts apply at display time (mirrors card CSS modes). */
export type ScopedRegexMode = "disabled" | "exclusive" | "chat";
type RegexApplyMode = "prompt" | "display" | "both";

function getApplyMode(row: RegexScriptRow): RegexApplyMode {
  return row.applyMode === "prompt" || row.applyMode === "display" || row.applyMode === "both"
    ? row.applyMode
    : row.promptOnly === "true"
      ? "prompt"
      : "display";
}

/**
 * Parses a RegexScriptRow from DB into a usable form.
 */
function parseScript(row: RegexScriptRow) {
  const placements: RegexPlacement[] = (() => {
    try {
      const parsed = JSON.parse(row.placement) as unknown;
      if (!Array.isArray(parsed)) return ["ai_output"];
      return parsed.filter(
        (placement): placement is RegexPlacement => placement === "ai_output" || placement === "user_input",
      );
    } catch {
      return ["ai_output"];
    }
  })();
  const trimStrings: string[] = (() => {
    try {
      const parsed = JSON.parse(row.trimStrings) as unknown;
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  })();
  const targetCharacterIds: string[] = (() => {
    try {
      const parsed = JSON.parse(row.targetCharacterIds);
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  })();
  const targetPromptPresetIds: string[] = (() => {
    try {
      const parsed = JSON.parse(row.targetPromptPresetIds);
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  })();
  return {
    ...row,
    enabledBool: row.enabled === "true",
    applyMode: getApplyMode(row),
    placements,
    trimStrings,
    targetCharacterIds,
    targetPromptPresetIds,
  };
}

/**
 * Applies all enabled regex scripts for a given placement to the input text.
 * @param depth — message depth (0 = latest message, 1 = one before, etc.). When
 *   undefined, depth range filtering is skipped (all scripts apply).
 */
function applyScripts(
  text: string,
  scripts: ReturnType<typeof parseScript>[],
  placement: RegexPlacement,
  options?: {
    promptOnly?: boolean;
    depth?: number;
    resolveMacros?: (value: string) => string;
    targetCharacterId?: string | null;
    targetedOnly?: boolean;
    scopedMode?: ScopedRegexMode;
    characterId?: string | null;
    promptPresetId?: string | null;
  },
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabledBool) continue;
    if (!script.placements.includes(placement)) continue;
    // Prompt context is opt-in. Display context runs visual scripts only.
    if (options?.promptOnly) {
      if (script.applyMode !== "prompt" && script.applyMode !== "both") continue;
    } else if (script.applyMode !== "display" && script.applyMode !== "both") {
      continue;
    }

    if (options?.targetedOnly && script.targetCharacterIds.length === 0) continue;
    if (script.targetCharacterIds.length > 0) {
      if (options?.promptOnly) {
        // Prompt context: match the character whose prompt is being assembled.
        if (!options.targetCharacterId || !script.targetCharacterIds.includes(options.targetCharacterId)) continue;
      } else {
        // Display context: gate the scoped script by the chat's tri-state mode —
        // disabled → off; exclusive → only on a target character's own messages;
        // chat → on every message.
        const rawMode = options?.scopedMode;
        const mode: ScopedRegexMode = rawMode === "exclusive" || rawMode === "chat" ? rawMode : "disabled";
        if (mode === "disabled") continue;
        if (mode === "exclusive") {
          const charId = options?.characterId;
          if (!charId || !script.targetCharacterIds.includes(charId)) continue;
        }
      }
    }
    if (script.targetPromptPresetIds.length > 0) {
      if (!options?.promptPresetId || !script.targetPromptPresetIds.includes(options.promptPresetId)) continue;
    }

    // Depth range filtering
    if (options?.depth != null) {
      if (script.minDepth != null && options.depth < script.minDepth) continue;
      if (script.maxDepth != null && options.depth > script.maxDepth) continue;
    }

    try {
      const findRegex = options?.resolveMacros
        ? resolveRegexPatternLiteralMacros(script.findRegex, options.resolveMacros)
        : script.findRegex;
      if (!findRegex) continue;
      if (!isPatternSafe(findRegex)) continue;
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

/**
 * Hook that provides functions to apply regex transformations.
 *
 * Usage:
 *   const { applyToAIOutput, applyToUserInput } = useApplyRegex();
 *   const displayText = applyToAIOutput(message.content);
 */
export function useApplyRegex() {
  const { data: regexScripts } = useRegexScripts();
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const activePromptPresetId = useChatStore((s) => s.activeChat?.promptPresetId ?? null);

  // Pre-parse all scripts (sorted by order, which is done server-side)
  const parsedScripts = useMemo(() => {
    if (!regexScripts) return [];
    return (regexScripts as RegexScriptRow[]).map(parseScript);
  }, [regexScripts]);

  const applyToAIOutput = useCallback(
    (
      text: string,
      options?: {
        depth?: number;
        resolveMacros?: (value: string) => string;
        scopedMode?: ScopedRegexMode;
        characterId?: string | null;
      },
    ) =>
      formatTextQuotes(
        applyScripts(text, parsedScripts, "ai_output", { ...options, promptPresetId: activePromptPresetId }),
        quoteFormat,
      ),
    [activePromptPresetId, parsedScripts, quoteFormat],
  );

  const applyToUserInput = useCallback(
    (
      text: string,
      options?: { depth?: number; resolveMacros?: (value: string) => string; scopedMode?: ScopedRegexMode },
    ) =>
      formatTextQuotes(
        applyScripts(text, parsedScripts, "user_input", { ...options, promptPresetId: activePromptPresetId }),
        quoteFormat,
      ),
    [activePromptPresetId, parsedScripts, quoteFormat],
  );

  return { applyToAIOutput, applyToUserInput };
}
