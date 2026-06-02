import { useCallback, useMemo } from "react";
import { applyRegexScriptReplacement } from "../../../engine/shared/regex/regex-script-application";
import { useRegexScripts, type RegexScriptRow } from "./hooks/use-regex-scripts";

type RegexPlacement = "ai_output" | "user_input";

export type ScopedRegexMode = "disabled" | "exclusive" | "chat";

export function readScopedRegexMode(value: unknown): ScopedRegexMode | undefined {
  return value === "disabled" || value === "exclusive" || value === "chat" ? value : undefined;
}

interface ApplyRegexOptions {
  depth?: number;
  resolveMacros?: (value: string) => string;
  scopedMode?: ScopedRegexMode;
  characterId?: string | null;
}

interface ParsedRegexScript extends RegexScriptRow {
  enabledBool: boolean;
  promptOnlyBool: boolean;
  placements: RegexPlacement[];
  trimList: string[];
}

function parseJsonArray<T extends string>(value: unknown, allowed?: Set<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is T => typeof entry === "string" && (!allowed || allowed.has(entry as T)));
}

function parseScript(row: RegexScriptRow): ParsedRegexScript {
  return {
    ...row,
    // Storage round-trips these as real booleans; tolerate the legacy string
    // shapes too so an enabled script actually applies on send / on display.
    enabledBool: row.enabled === true || row.enabled === "true" || row.enabled === "1",
    promptOnlyBool: row.promptOnly === true || row.promptOnly === "true" || row.promptOnly === "1",
    placements: parseJsonArray(row.placement, new Set<RegexPlacement>(["ai_output", "user_input"])),
    trimList: parseJsonArray(row.trimStrings),
  };
}

function resolveText(value: string, options?: ApplyRegexOptions): string {
  return options?.resolveMacros ? options.resolveMacros(value) : value;
}

function applyScripts(
  text: string,
  scripts: ParsedRegexScript[],
  placement: RegexPlacement,
  options?: ApplyRegexOptions & { promptOnly?: boolean },
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabledBool) continue;
    if (!script.placements.includes(placement)) continue;
    if (options?.promptOnly ? !script.promptOnlyBool : script.promptOnlyBool) continue;
    if (options?.depth != null) {
      if (script.minDepth != null && options.depth < script.minDepth) continue;
      if (script.maxDepth != null && options.depth > script.maxDepth) continue;
    }

    try {
      const findRegex = resolveText(script.findRegex, options);
      if (!findRegex) continue;
      const regex = new RegExp(findRegex, script.flags);
      result = applyRegexScriptReplacement(result, regex, script.replaceString, script.trimList, (value) =>
        resolveText(value, options),
      );
    } catch {
      // Invalid user regexes are skipped; the editor remains the validation surface.
    }
  }
  return result;
}

/**
 * Filter parsed scripts based on the scoped regex mode and the target characterId.
 * - "disabled": only global scripts (no characterId)
 * - "exclusive": only scoped scripts matching the characterId (skip globals)
 * - "chat": all loaded scripts for the chat, including scoped scripts on user input
 */
function filterForMode(
  scripts: ParsedRegexScript[],
  mode: ScopedRegexMode | undefined,
  characterId: string | null | undefined,
): ParsedRegexScript[] {
  const normalizedMode = mode ?? "chat";
  if (normalizedMode === "disabled") {
    return scripts.filter((s) => !s.characterId);
  }
  if (normalizedMode === "exclusive") {
    if (!characterId) return [];
    return scripts.filter((s) => !!s.characterId && s.characterId === characterId);
  }
  return scripts;
}

export function useApplyRegex(characterIds?: string[]) {
  const { data: regexScripts } = useRegexScripts(characterIds);
  const scripts = useMemo(() => (regexScripts ?? []).map(parseScript), [regexScripts]);

  const applyToAIOutput = useCallback(
    (text: string, options?: ApplyRegexOptions) => {
      const filtered = filterForMode(scripts, options?.scopedMode, options?.characterId);
      return applyScripts(text, filtered, "ai_output", options);
    },
    [scripts],
  );
  const applyToUserInput = useCallback(
    (text: string, options?: ApplyRegexOptions) => {
      const filtered = filterForMode(scripts, options?.scopedMode, options?.characterId);
      return applyScripts(text, filtered, "user_input", options);
    },
    [scripts],
  );
  const applyPromptOnly = useCallback(
    (text: string, placement: RegexPlacement, options?: ApplyRegexOptions) => {
      const filtered = filterForMode(scripts, options?.scopedMode, options?.characterId);
      return applyScripts(text, filtered, placement, { ...options, promptOnly: true });
    },
    [scripts],
  );

  return { applyToAIOutput, applyToUserInput, applyPromptOnly };
}
