// ──────────────────────────────────────────────
// Regex Scripts — Prompt Application
// ──────────────────────────────────────────────
import { applyRegexReplacement, isPatternSafe, resolveRegexPatternLiteralMacros } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { vmRegexReplaceGuard } from "../lorebook/regex-timeout.js";

type RegexPlacement = "ai_output" | "user_input";
type RegexApplyMode = "prompt" | "display" | "both";

type RegexScriptLike = {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  findRegex?: unknown;
  flags?: unknown;
  replaceString?: unknown;
  trimStrings?: unknown;
  placement?: unknown;
  promptOnly?: unknown;
  applyMode?: unknown;
  targetCharacterIds?: unknown;
  minDepth?: unknown;
  maxDepth?: unknown;
};

const warnedInvalidPlacementScripts = new Set<string>();
const REGEX_REPLACE_TIMEOUT_MIN_LENGTH = 256;

export type RegexMessageLike = {
  id?: string | null;
  role: string;
  content: string;
};

type RegexMacroResolver = (value: string, randomSeed?: string) => string;

type ApplyRegexScriptOptions = {
  resolveMacros?: RegexMacroResolver;
  randomSeed?: string;
  targetCharacterId?: string | null;
  targetedOnly?: boolean;
};

function isEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function isPromptOnly(value: unknown): boolean {
  return value === true || value === "true";
}

function getApplyMode(script: RegexScriptLike): RegexApplyMode {
  return script.applyMode === "prompt" || script.applyMode === "display" || script.applyMode === "both"
    ? script.applyMode
    : isPromptOnly(script.promptOnly)
      ? "prompt"
      : "display";
}

function parsePlacement(value: unknown): RegexPlacement[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is RegexPlacement => entry === "ai_output" || entry === "user_input");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsePlacement(parsed);
  } catch {
    return value === "ai_output" || value === "user_input" ? [value] : [];
  }
}

function parseTrimStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry !== "");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return parseStringArray(parsed);
  } catch {
    return [];
  }
}

function depthValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveScriptString(value: string, options: ApplyRegexScriptOptions | undefined): string {
  return options?.resolveMacros ? options.resolveMacros(value, options.randomSeed) : value;
}

function resolveFindPattern(value: string, options: ApplyRegexScriptOptions | undefined): string {
  return options?.resolveMacros
    ? resolveRegexPatternLiteralMacros(value, (macro) => options.resolveMacros!(macro, options.randomSeed))
    : value;
}

function warnInvalidPlacement(script: RegexScriptLike): void {
  const key =
    typeof script.id === "string"
      ? script.id
      : typeof script.name === "string"
        ? script.name
        : typeof script.findRegex === "string"
          ? script.findRegex
          : "unknown";
  if (warnedInvalidPlacementScripts.has(key)) return;
  warnedInvalidPlacementScripts.add(key);
  logger.warn(
    "[regex] Skipping enabled prompt regex script with empty or invalid placement: %s",
    typeof script.name === "string" ? script.name : key,
  );
}

export function applyRegexScriptsToPromptText(
  text: string,
  scripts: RegexScriptLike[],
  placement: RegexPlacement,
  depth: number,
  options?: ApplyRegexScriptOptions,
): string {
  let result = text;
  for (const script of scripts) {
    if (!isEnabled(script.enabled)) continue;
    const applyMode = getApplyMode(script);
    if (applyMode !== "prompt" && applyMode !== "both") continue;
    const placements = parsePlacement(script.placement);
    if (placements.length === 0) {
      warnInvalidPlacement(script);
      continue;
    }
    if (!placements.includes(placement)) continue;

    const targetCharacterIds = parseStringArray(script.targetCharacterIds);
    if (options?.targetedOnly && targetCharacterIds.length === 0) continue;
    if (targetCharacterIds.length > 0) {
      const targetCharacterId = options?.targetCharacterId;
      if (!targetCharacterId || !targetCharacterIds.includes(targetCharacterId)) continue;
    }

    const minDepth = depthValue(script.minDepth);
    const maxDepth = depthValue(script.maxDepth);
    if (minDepth != null && depth < minDepth) continue;
    if (maxDepth != null && depth > maxDepth) continue;

    const findRegex = typeof script.findRegex === "string" ? resolveFindPattern(script.findRegex, options) : "";
    if (!findRegex) continue;
    // Skip ReDoS-prone patterns instead of compiling + running them against every
    // prompt message with no timeout — mirrors the lorebook keyword-scan posture.
    if (!isPatternSafe(findRegex)) continue;

    try {
      const flags = typeof script.flags === "string" ? script.flags : "";
      const re = new RegExp(findRegex, flags);
      const replacement = typeof script.replaceString === "string" ? script.replaceString : "";
      if (result.length >= REGEX_REPLACE_TIMEOUT_MIN_LENGTH && !vmRegexReplaceGuard(re, result)) continue;
      result = applyRegexReplacement(result, re, replacement, (value) => resolveScriptString(value, options));
      for (const trim of parseTrimStrings(script.trimStrings)) {
        const resolvedTrim = resolveScriptString(trim, options);
        if (resolvedTrim) result = result.split(resolvedTrim).join("");
      }
    } catch {
      /* invalid regex — skip */
    }
  }
  return result;
}

export function applyRegexScriptsToPromptMessages<T extends RegexMessageLike>(
  messages: T[],
  scripts: RegexScriptLike[],
  options?: ApplyRegexScriptOptions,
): void {
  if (scripts.length === 0 || messages.length === 0) return;
  const totalMessages = messages.length;
  for (let index = 0; index < totalMessages; index++) {
    const message = messages[index]!;
    const placement = message.role === "user" ? "user_input" : "ai_output";
    const depth = totalMessages - 1 - index;
    const randomSeed =
      "id" in message && typeof message.id === "string" && message.id
        ? `${message.id}:${message.content}`
        : options?.randomSeed;
    message.content = applyRegexScriptsToPromptText(message.content, scripts, placement, depth, {
      ...options,
      randomSeed,
    });
  }
}
