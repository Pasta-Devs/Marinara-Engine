import {
  mergeBuiltInAgentSettings,
  normalizeAgentPromptTemplateOptions,
  normalizeStoryboardAgentSettings,
  STORYBOARD_AGENT_ID,
  type AgentPromptTemplateOption,
  type StoryboardAutoGenerateMode,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { createAgentsStorage } from "../storage/agents.storage.js";

type AgentsStorage = ReturnType<typeof createAgentsStorage>;

function mergeTemplates(overrides: unknown, defaults: unknown): AgentPromptTemplateOption[] {
  const overrideTemplates = normalizeAgentPromptTemplateOptions(overrides);
  const overrideIds = new Set(overrideTemplates.map((template) => template.id));
  return [
    ...overrideTemplates,
    ...normalizeAgentPromptTemplateOptions(defaults).filter((template) => !overrideIds.has(template.id)),
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

export function resolveRoleplayStoryboardAutoGenerateMode(
  meta: Record<string, unknown>,
  fallback: StoryboardAutoGenerateMode,
): StoryboardAutoGenerateMode {
  return meta.roleplayStoryboardAutoGenerateMode === "manual" ||
    meta.roleplayStoryboardAutoGenerateMode === "illustration" ||
    meta.roleplayStoryboardAutoGenerateMode === "animation"
    ? meta.roleplayStoryboardAutoGenerateMode
    : fallback;
}

/** Prevents two foreground-media agents from rendering the same new Roleplay response. */
export function shouldSuppressIllustratorForegroundForStoryboard(args: {
  ownerMode: string;
  storyboardAgentActive: boolean;
  createsAssistantMessage: boolean;
  meta: Record<string, unknown>;
  defaultAutoGenerateMode: StoryboardAutoGenerateMode;
}): boolean {
  return (
    args.ownerMode === "roleplay" &&
    args.storyboardAgentActive &&
    args.createsAssistantMessage &&
    resolveRoleplayStoryboardAutoGenerateMode(args.meta, args.defaultAutoGenerateMode) !== "manual"
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
    const defaultAutoIllustrations = settings.autoGenerateMode !== "manual";
    const defaultAutoAnimations = settings.autoGenerateMode === "animation";
    const runInterval = settings.runInterval;

    if (ownerMode === "roleplay") {
      const autoGenerateMode = resolveRoleplayStoryboardAutoGenerateMode(meta, settings.autoGenerateMode);

      return {
        ...meta,
        storyboardAgentInstalled: true,
        storyboardAgentActive: active,
        storyboardAgentConfigId: config.id,
        storyboardAgentPromptConnectionId: meta.roleplayStoryboardPromptConnectionId ?? config.connectionId ?? null,
        storyboardAgentImageConnectionId: meta.roleplayStoryboardImageConnectionId ?? settings.imageConnectionId,
        storyboardAgentVideoConnectionId: meta.roleplayStoryboardVideoConnectionId ?? settings.videoConnectionId,
        storyboardAgentIncludeCharacterAppearance:
          meta.roleplayStoryboardIncludeCharacterAppearance ?? settings.includeCharacterAppearance,
        storyboardAgentUseAvatarReferences: meta.roleplayStoryboardUseAvatarReferences ?? settings.useAvatarReferences,
        roleplayStoryboardsEnabled: active,
        roleplayStoryboardAutoGenerateMode: autoGenerateMode,
        roleplayStoryboardRunInterval: meta.roleplayStoryboardRunInterval ?? runInterval,
        roleplayStoryboardKeyframeCount: meta.roleplayStoryboardKeyframeCount ?? settings.keyframeCount,
        roleplayStoryboardAnimationDurationSeconds:
          meta.roleplayStoryboardAnimationDurationSeconds ?? settings.animationDurationSeconds,
        roleplayStoryboardUseNovelAiCharacterPrompts:
          meta.roleplayStoryboardUseNovelAiCharacterPrompts ?? settings.useNovelAiCharacterPrompts,
        roleplayStoryboardUsePromptTemplate: meta.roleplayStoryboardUsePromptTemplate ?? settings.usePromptTemplate,
        roleplayStoryboardEpisodeTemplateId:
          meta.roleplayStoryboardEpisodeTemplateId ?? settings.roleplayEpisodeTemplateId,
        roleplayStoryboardStyleTemplateId: meta.roleplayStoryboardStyleTemplateId ?? settings.roleplayStyleTemplateId,
        roleplayStoryboardAnimationTemplateId:
          meta.roleplayStoryboardAnimationTemplateId ?? settings.roleplayAnimationTemplateId,
        roleplayStoryboardOutputTemplateId:
          meta.roleplayStoryboardOutputTemplateId ?? settings.roleplayOutputTemplateId,
        roleplayStoryboardEpisodeTemplates: mergeTemplates(
          meta.roleplayStoryboardEpisodeTemplates,
          settings.roleplayEpisodeTemplates,
        ),
        roleplayStoryboardStyleTemplates: mergeTemplates(
          meta.roleplayStoryboardStyleTemplates,
          settings.roleplayStyleTemplates,
        ),
        roleplayStoryboardAnimationTemplates: mergeTemplates(
          meta.roleplayStoryboardAnimationTemplates,
          settings.roleplayAnimationTemplates,
        ),
        roleplayStoryboardOutputTemplates: mergeTemplates(
          meta.roleplayStoryboardOutputTemplates,
          settings.roleplayOutputTemplates,
        ),
        roleplayStoryboardImagePromptTemplateId:
          meta.roleplayStoryboardImagePromptTemplateId ?? settings.illustrationTemplateId,
        roleplayStoryboardVideoPromptTemplateId:
          meta.roleplayStoryboardVideoPromptTemplateId ?? settings.videoTemplateId,
        roleplayStoryboardImagePromptTemplates: mergeTemplates(
          meta.roleplayStoryboardImagePromptTemplates,
          settings.illustrationTemplates,
        ),
        roleplayStoryboardVideoPromptTemplates: mergeTemplates(
          meta.roleplayStoryboardVideoPromptTemplates,
          settings.videoTemplates,
        ),
      };
    }

    return {
      ...meta,
      storyboardAgentInstalled: true,
      storyboardAgentActive: active,
      storyboardAgentConfigId: config.id,
      storyboardAgentPromptConnectionId: meta.gameSceneConnectionId ?? config.connectionId,
      storyboardAgentImageConnectionId: meta.gameImageConnectionId ?? settings.imageConnectionId,
      storyboardAgentVideoConnectionId: meta.gameVideoConnectionId ?? settings.videoConnectionId,
      storyboardAgentIncludeCharacterAppearance:
        meta.gameImageIncludeCharacterAppearance ?? settings.includeCharacterAppearance,
      storyboardAgentUseAvatarReferences: meta.gameImageUseAvatarReferences ?? settings.useAvatarReferences,
      gameStoryboardsEnabled: active ? true : meta.gameStoryboardsEnabled,
      gameStoryboardAutoIllustrationsEnabled: hasExplicitBoolean(meta, "gameStoryboardAutoIllustrationsEnabled")
        ? meta.gameStoryboardAutoIllustrationsEnabled
        : defaultAutoIllustrations,
      gameStoryboardAutoGenerationEnabled: hasExplicitBoolean(meta, "gameStoryboardAutoGenerationEnabled")
        ? meta.gameStoryboardAutoGenerationEnabled
        : defaultAutoAnimations,
      gameStoryboardKeyframeCount: meta.gameStoryboardKeyframeCount ?? settings.keyframeCount,
      gameStoryboardAnimationDurationSeconds:
        meta.gameStoryboardAnimationDurationSeconds ?? settings.animationDurationSeconds,
      gameStoryboardViewerDisplayMode: meta.gameStoryboardViewerDisplayMode ?? settings.viewerDisplayMode,
      gameStoryboardUseNovelAiCharacterPrompts:
        meta.gameStoryboardUseNovelAiCharacterPrompts ?? settings.useNovelAiCharacterPrompts,
      gameStoryboardUsePromptTemplate: meta.gameStoryboardUsePromptTemplate ?? settings.usePromptTemplate,
      gameStoryboardIllustrationPromptTemplateId:
        meta.gameStoryboardIllustrationPromptTemplateId ?? settings.illustrationPlannerTemplateId,
      gameStoryboardAnimationPromptTemplateId:
        meta.gameStoryboardAnimationPromptTemplateId ?? settings.animationPlannerTemplateId,
      gameStoryboardImagePromptTemplateId: meta.gameStoryboardImagePromptTemplateId ?? settings.illustrationTemplateId,
      gameStoryboardVideoPromptTemplateId: meta.gameStoryboardVideoPromptTemplateId ?? settings.videoTemplateId,
      gameStoryboardPromptTemplates: mergeTemplates(meta.gameStoryboardPromptTemplates, settings.plannerTemplates),
      gameStoryboardIllustrationPlannerTemplateIds: settings.illustrationPlannerTemplateIds,
      gameStoryboardAnimationPlannerTemplateIds: settings.animationPlannerTemplateIds,
      gameStoryboardImagePromptTemplates: mergeTemplates(
        meta.gameStoryboardImagePromptTemplates,
        settings.illustrationTemplates,
      ),
      gameStoryboardVideoPromptTemplates: mergeTemplates(
        meta.gameStoryboardVideoPromptTemplates,
        settings.videoTemplates,
      ),
    };
  } catch (error) {
    logger.warn(error, "[storyboard-agent] Failed to load Storyboard Agent settings");
    return meta;
  }
}
