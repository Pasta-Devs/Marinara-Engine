import {
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
  normalizeAgentPromptTemplateOptions,
  type AgentPromptTemplateOption,
} from "@marinara-engine/shared";
import { GAME_VIDEO, renderTemplate, type GameVideoCtx } from "../prompt-overrides/index.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";

const GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATE_IDS = new Set(
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.map((template) => template.id),
);

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ensureUniqueGameVideoPromptTemplateId(id: string, usedIds: Set<string>): string {
  const fallback = "custom-game-video-prompt";
  const base =
    id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback;
  let candidate = base;
  let attempt = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt++;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeGameVideoPromptTemplates(value: unknown): AgentPromptTemplateOption[] {
  const usedIds = new Set(GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATE_IDS);
  return normalizeAgentPromptTemplateOptions(value)
    .map((template) => ({
      ...template,
      id: ensureUniqueGameVideoPromptTemplateId(template.id, usedIds),
    }))
    .slice(0, 20);
}

function resolveGameVideoPromptTemplateId(args: {
  meta: Record<string, unknown>;
  options: AgentPromptTemplateOption[];
}): string {
  const selected = readTrimmedString(args.meta.gameVideoPromptTemplateId);
  if (selected && args.options.some((option) => option.id === selected)) return selected;
  return GAME_VIDEO_PROMPT_TEMPLATE_ID;
}

function renderSelectedGameVideoPromptTemplate(args: {
  template: AgentPromptTemplateOption | undefined;
  ctx: GameVideoCtx;
}) {
  if (!args.template?.promptTemplate.trim()) return GAME_VIDEO.defaultBuilder(args.ctx);
  const declared = GAME_VIDEO.variables.map((variable) => variable.name);
  return renderTemplate(args.template.promptTemplate, args.ctx, declared);
}

function finalizeGameVideoPrompt(args: { prompt: string; source: string; debugMode?: boolean }) {
  const debugOverrideEnabled = args.debugMode === true || isDebugAgentsEnabled();
  logDebugOverride(debugOverrideEnabled, "[debug/game-video] %s prompt:\n%s", args.source, args.prompt);
  return args.prompt;
}

async function loadStoredGameVideoPromptOverride(args: {
  promptOverridesStorage: PromptOverridesStorage;
  ctx: GameVideoCtx;
}): Promise<string | null> {
  const declared = GAME_VIDEO.variables.map((variable) => variable.name);
  try {
    for (const key of [GAME_VIDEO.key, ...(GAME_VIDEO.legacyKeys ?? [])]) {
      const row = await args.promptOverridesStorage.get(key);
      if (!row) continue;
      return row.enabled ? renderTemplate(row.template, args.ctx, declared) : null;
    }
  } catch (error) {
    logger.warn(error, "[game-video] Failed to load stored prompt override");
  }
  return null;
}

export async function loadGameVideoPrompt(args: {
  promptOverridesStorage: PromptOverridesStorage;
  meta: Record<string, unknown>;
  ctx: GameVideoCtx;
  debugMode?: boolean;
}): Promise<string> {
  const options = [
    ...GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
    ...normalizeGameVideoPromptTemplates(args.meta.gameVideoPromptTemplates),
  ];
  const explicitTemplateId = readTrimmedString(args.meta.gameVideoPromptTemplateId);
  const hasExplicitTemplateSelection =
    explicitTemplateId !== null && options.some((option) => option.id === explicitTemplateId);
  const templateId = resolveGameVideoPromptTemplateId({
    meta: args.meta,
    options,
  });
  const selectedTemplate =
    options.find((template) => template.id === templateId) ??
    GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.find((template) => template.id === GAME_VIDEO_PROMPT_TEMPLATE_ID);

  if (hasExplicitTemplateSelection) {
    return finalizeGameVideoPrompt({
      prompt: renderSelectedGameVideoPromptTemplate({ template: selectedTemplate, ctx: args.ctx }),
      source: `selected template ${templateId}`,
      debugMode: args.debugMode,
    });
  }

  const storedOverride = await loadStoredGameVideoPromptOverride({
    promptOverridesStorage: args.promptOverridesStorage,
    ctx: args.ctx,
  });
  if (storedOverride) {
    return finalizeGameVideoPrompt({
      prompt: storedOverride,
      source: "stored override",
      debugMode: args.debugMode,
    });
  }

  return finalizeGameVideoPrompt({
    prompt: renderSelectedGameVideoPromptTemplate({ template: selectedTemplate, ctx: args.ctx }),
    source: `template ${templateId}`,
    debugMode: args.debugMode,
  });
}
