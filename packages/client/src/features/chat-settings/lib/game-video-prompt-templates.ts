import {
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
  type AgentPromptTemplateOption,
  normalizeAgentPromptTemplateOptions,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
} from "@marinara-engine/shared";

const GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATE_IDS = new Set(
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.map((template) => template.id),
);

function normalizeGameVideoPromptTemplateId(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || fallback;
}

function getUniqueGameVideoPromptTemplateId(
  id: string,
  usedIds: Set<string>,
  fallback = "custom-game-video-prompt",
): string {
  const base = normalizeGameVideoPromptTemplateId(id, fallback);
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
      id: getUniqueGameVideoPromptTemplateId(template.id, usedIds),
    }))
    .slice(0, 20);
}

export function getGameVideoPromptTemplateOptions(
  customTemplates: AgentPromptTemplateOption[],
): AgentPromptTemplateOption[] {
  return [...GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES, ...customTemplates];
}

export function resolveSelectedGameVideoPromptTemplateId(value: unknown, options: AgentPromptTemplateOption[]): string {
  const selected = typeof value === "string" ? value.trim() : "";
  if (selected && options.some((option) => option.id === selected)) return selected;
  return GAME_VIDEO_PROMPT_TEMPLATE_ID;
}
