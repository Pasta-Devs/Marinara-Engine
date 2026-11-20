// ──────────────────────────────────────────────
// Hook: Apply Regex Scripts to text
// ──────────────────────────────────────────────
import { useCallback, useMemo } from "react";
import { useRegexScripts, type RegexScriptRow } from "./use-regex-scripts";
import {
  applyRegexReplacement,
  formatTextQuotes,
  isPatternSafe,
  isRegexApplyMode,
  resolveRegexPatternLiteralMacros,
  resolveScopedRegexMode,
  type RegexPlacement,
  type ScopedRegexMode,
  type RegexApplyMode,
} from "@marinara-engine/shared";
import { useUIStore } from "../stores/ui.store";
import { useChatStore } from "../stores/chat.store";
import { usePresets } from "./use-presets";

/** How character-scoped regex scripts apply at display time (mirrors card CSS modes). */
export type { ScopedRegexMode } from "@marinara-engine/shared";
function getApplyMode(row: RegexScriptRow): RegexApplyMode {
  return isRegexApplyMode(row.applyMode) ? row.applyMode : row.promptOnly === "true" ? "prompt" : "display";
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
    enabledBool: row.enabled === "true" && (!row.pausedByFolder || targetCharacterIds.length > 0),
    applyMode: getApplyMode(row),
    placements,
    trimStrings,
    targetCharacterIds,
    targetPromptPresetIds,
  };
}

// Each script's pattern is checked and compiled once, not once per message it touches. Patterns with
// macros resolve to a different source per speaker, so the key is the resolved source and its flags.
const COMPILED_PATTERN_LIMIT = 500;
const compiledPatterns = new Map<string, RegExp | null>();

export function compileRegexScriptPattern(source: string, flags: string): RegExp | null {
  const key = `${flags}\u0000${source}`;
  if (compiledPatterns.has(key)) return compiledPatterns.get(key)!;
  let compiled: RegExp | null = null;
  if (isPatternSafe(source)) {
    try {
      compiled = new RegExp(source, flags);
    } catch {
      compiled = null;
    }
  }
  if (compiledPatterns.size >= COMPILED_PATTERN_LIMIT) {
    const oldest = compiledPatterns.keys().next().value;
    if (oldest !== undefined) compiledPatterns.delete(oldest);
  }
  compiledPatterns.set(key, compiled);
  return compiled;
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
    scopedMode?: ScopedRegexMode | null;
    characterId?: string | null;
    promptPresetId?: string | null;
    /** An edited message being saved: only scripts that change the saved message run. */
    savedMessage?: boolean;
  },
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabledBool) continue;
    if (!script.placements.includes(placement)) continue;
    // Prompt context is opt-in. Display context runs visual scripts only. User input runs once, as the
    // message is sent and saved, so scripts that rewrite the saved message run there too; the server
    // rewrites new AI replies, and an edited message runs them again here as it is saved.
    if (options?.savedMessage) {
      if (script.applyMode !== "message") continue;
    } else if (options?.promptOnly) {
      if (script.applyMode !== "prompt" && script.applyMode !== "both") continue;
    } else if (
      script.applyMode !== "display" &&
      script.applyMode !== "both" &&
      !(script.applyMode === "message" && placement === "user_input")
    ) {
      continue;
    }

    if (options?.targetedOnly && script.targetCharacterIds.length === 0) continue;
    if (script.targetCharacterIds.length > 0) {
      if (options?.savedMessage) {
        // An edited message: match the character who wrote it.
        if (!options.characterId || !script.targetCharacterIds.includes(options.characterId)) continue;
      } else if (options?.promptOnly) {
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
      const re = compileRegexScriptPattern(findRegex, script.flags);
      if (!re) continue;
      // A shared sticky pattern resumes from its last match, so every use starts at the beginning.
      re.lastIndex = 0;
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
  const { data: presets } = usePresets();
  const presetScopedRegexMode = presets?.find((preset) => preset.id === activePromptPresetId)?.scopedRegexMode;

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
        scopedMode?: ScopedRegexMode | null;
        characterId?: string | null;
      },
    ) =>
      formatTextQuotes(
        applyScripts(text, parsedScripts, "ai_output", {
          ...options,
          scopedMode: resolveScopedRegexMode(options?.scopedMode, presetScopedRegexMode),
          promptPresetId: activePromptPresetId,
        }),
        quoteFormat,
      ),
    [activePromptPresetId, parsedScripts, presetScopedRegexMode, quoteFormat],
  );

  const applyToUserInput = useCallback(
    (
      text: string,
      options?: { depth?: number; resolveMacros?: (value: string) => string; scopedMode?: ScopedRegexMode | null },
    ) =>
      formatTextQuotes(
        applyScripts(text, parsedScripts, "user_input", {
          ...options,
          scopedMode: resolveScopedRegexMode(options?.scopedMode, presetScopedRegexMode),
          promptPresetId: activePromptPresetId,
        }),
        quoteFormat,
      ),
    [activePromptPresetId, parsedScripts, presetScopedRegexMode, quoteFormat],
  );

  // An edited message, as it is saved: only the scripts that change the saved message, no quote formatting.
  const applyToSavedMessage = useCallback(
    (
      text: string,
      placement: RegexPlacement,
      options?: { resolveMacros?: (value: string) => string; characterId?: string | null },
    ) =>
      applyScripts(text, parsedScripts, placement, {
        ...options,
        savedMessage: true,
        promptPresetId: activePromptPresetId,
      }),
    [activePromptPresetId, parsedScripts],
  );
  const hasSavedMessageScripts = useMemo(
    () => parsedScripts.some((script) => script.enabledBool && script.applyMode === "message"),
    [parsedScripts],
  );

  // Depth counts back from the newest message, so a new message changes it for every older one. Callers
  // that keep finished text per message only need to rebuild on a new message when some script uses it.
  const usesDepthRange = useMemo(
    () => parsedScripts.some((script) => script.enabledBool && (script.minDepth != null || script.maxDepth != null)),
    [parsedScripts],
  );

  return { applyToAIOutput, applyToUserInput, applyToSavedMessage, hasSavedMessageScripts, usesDepthRange };
}
