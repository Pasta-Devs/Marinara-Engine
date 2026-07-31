import {
  GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID,
  normalizeAgentPromptTemplateOptions,
  type AgentPromptTemplateOption,
} from "@marinara-engine/shared";
import { GAME_SCENE_ILLUSTRATION, renderTemplate, type GameSceneIllustrationCtx } from "../prompt-overrides/index.js";

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function renderSelectedStoryboardImagePrompt(
  template: AgentPromptTemplateOption,
  ctx: GameSceneIllustrationCtx,
): string {
  const declared = GAME_SCENE_ILLUSTRATION.variables.map((variable) => variable.name);
  return renderTemplate(template.promptTemplate, ctx, declared);
}

export async function loadGameStoryboardImagePrompt(args: {
  templateId?: string | null;
  customTemplates?: unknown;
  ctx: GameSceneIllustrationCtx;
}): Promise<string> {
  const options = normalizeAgentPromptTemplateOptions(args.customTemplates).slice(0, 20);
  const selectedId = readTrimmedString(args.templateId);
  const selectedTemplate =
    (selectedId ? options.find((template) => template.id === selectedId) : undefined) ??
    options.find((template) => template.id === GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID) ??
    options[0];

  if (!selectedTemplate) {
    throw new Error("The Storyboard Agent does not provide a usable image formatter prompt.");
  }

  return renderSelectedStoryboardImagePrompt(selectedTemplate, args.ctx);
}
