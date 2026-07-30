import {
  mergeBuiltInAgentSettings,
  normalizeAgentPromptTemplateOptions,
  normalizeStoryboardAgentSettings,
  STORYBOARD_AGENT_ID,
  type AgentPromptTemplateOption,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { createAgentsStorage } from "../storage/agents.storage.js";

type AgentsStorage = ReturnType<typeof createAgentsStorage>;

function mergeTemplates(primary: unknown, legacy: unknown): AgentPromptTemplateOption[] {
  const primaryTemplates = normalizeAgentPromptTemplateOptions(primary);
  const primaryIds = new Set(primaryTemplates.map((template) => template.id));
  return [
    ...primaryTemplates,
    ...normalizeAgentPromptTemplateOptions(legacy).filter((template) => !primaryIds.has(template.id)),
  ];
}

function hasExplicitBoolean(meta: Record<string, unknown>, key: string): boolean {
  return typeof meta[key] === "boolean";
}

function hasActiveStoryboardAgent(meta: Record<string, unknown>): boolean {
  return (
    Array.isArray(meta.activeAgentIds) &&
    meta.activeAgentIds.some((id) => typeof id === "string" && id.trim() === STORYBOARD_AGENT_ID)
  );
}

/**
 * Projects the installed Storyboard Agent's global settings onto the legacy
 * Game storyboard fields consumed by the host generation workflow. Existing
 * per-chat values remain explicit overrides during migration.
 */
export async function applyStoryboardAgentSettings(
  meta: Record<string, unknown>,
  agents: AgentsStorage,
  ownerMode: "game" | "roleplay" = "game",
): Promise<Record<string, unknown>> {
  try {
    const config = await agents.ensureBuiltinConfig(STORYBOARD_AGENT_ID);
    if (!config) return meta;

    const mergedSettings = mergeBuiltInAgentSettings(STORYBOARD_AGENT_ID, config.settings);
    const settings = normalizeStoryboardAgentSettings(mergedSettings);
    const active = hasActiveStoryboardAgent(meta);
    const isRoleplay = ownerMode === "roleplay";
    const defaultAutoIllustrations = settings.autoGenerateMode !== "manual";
    const defaultAutoAnimations = settings.autoGenerateMode === "animation";
    const configuredRunInterval = Number(mergedSettings.runInterval);
    const runInterval =
      Number.isFinite(configuredRunInterval) && configuredRunInterval >= 1
        ? Math.min(100, Math.floor(configuredRunInterval))
        : 5;

    return {
      ...meta,
      storyboardAgentInstalled: true,
      storyboardAgentActive: active,
      storyboardAgentConfigId: config.id,
      storyboardAgentRunInterval: runInterval,
      storyboardAgentPromptConnectionId: isRoleplay
        ? config.connectionId
        : (meta.gameSceneConnectionId ?? config.connectionId),
      storyboardAgentImageConnectionId: isRoleplay
        ? settings.imageConnectionId
        : (meta.gameImageConnectionId ?? settings.imageConnectionId),
      storyboardAgentVideoConnectionId: isRoleplay
        ? settings.videoConnectionId
        : (meta.gameVideoConnectionId ?? settings.videoConnectionId),
      storyboardAgentIncludeCharacterAppearance: isRoleplay
        ? settings.includeCharacterAppearance
        : (meta.gameImageIncludeCharacterAppearance ?? settings.includeCharacterAppearance),
      storyboardAgentUseAvatarReferences: isRoleplay
        ? settings.useAvatarReferences
        : (meta.gameImageUseAvatarReferences ?? settings.useAvatarReferences),
      gameStoryboardsEnabled: active ? true : meta.gameStoryboardsEnabled,
      gameStoryboardAutoIllustrationsEnabled: hasExplicitBoolean(meta, "gameStoryboardAutoIllustrationsEnabled")
        ? meta.gameStoryboardAutoIllustrationsEnabled
        : defaultAutoIllustrations,
      gameStoryboardAutoGenerationEnabled: hasExplicitBoolean(meta, "gameStoryboardAutoGenerationEnabled")
        ? meta.gameStoryboardAutoGenerationEnabled
        : defaultAutoAnimations,
      gameStoryboardKeyframeCount: meta.gameStoryboardKeyframeCount ?? (isRoleplay ? 1 : settings.keyframeCount),
      gameStoryboardAnimationDurationSeconds:
        meta.gameStoryboardAnimationDurationSeconds ?? settings.animationDurationSeconds,
      gameStoryboardViewerDisplayMode:
        meta.gameStoryboardViewerDisplayMode ?? (isRoleplay ? "inline" : settings.viewerDisplayMode),
      gameStoryboardUseNovelAiCharacterPrompts:
        meta.gameStoryboardUseNovelAiCharacterPrompts ?? settings.useNovelAiCharacterPrompts,
      gameStoryboardUsePromptTemplate: meta.gameStoryboardUsePromptTemplate ?? settings.usePromptTemplate,
      gameStoryboardIllustrationPromptTemplateId:
        meta.gameStoryboardIllustrationPromptTemplateId ?? settings.illustrationPlannerTemplateId,
      gameStoryboardAnimationPromptTemplateId:
        meta.gameStoryboardAnimationPromptTemplateId ?? settings.animationPlannerTemplateId,
      gameStoryboardImagePromptTemplateId: meta.gameStoryboardImagePromptTemplateId ?? settings.illustrationTemplateId,
      gameStoryboardVideoPromptTemplateId: meta.gameStoryboardVideoPromptTemplateId ?? settings.videoTemplateId,
      gameStoryboardPromptTemplates: mergeTemplates(settings.plannerTemplates, meta.gameStoryboardPromptTemplates),
      gameStoryboardIllustrationPlannerTemplateIds: settings.illustrationPlannerTemplateIds,
      gameStoryboardAnimationPlannerTemplateIds: settings.animationPlannerTemplateIds,
      gameStoryboardImagePromptTemplates: mergeTemplates(
        settings.illustrationTemplates,
        meta.gameStoryboardImagePromptTemplates,
      ),
      gameStoryboardVideoPromptTemplates: mergeTemplates(
        settings.videoTemplates,
        meta.gameStoryboardVideoPromptTemplates,
      ),
    };
  } catch (error) {
    logger.warn(error, "[storyboard-agent] Failed to load Storyboard Agent settings");
    return meta;
  }
}
