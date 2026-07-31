import { normalizeAgentPromptTemplateOptions, type AgentPromptTemplateOption } from "@marinara-engine/shared";
import type { ChatMessage } from "../llm/base-provider.js";
import { escapeXmlAttribute } from "../prompt/xml-escaping.js";
import { renderTemplate } from "../prompt-overrides/index.js";
import type { RoleplayStoryboardEpisodeSection } from "./storyboard-episode.js";

const ROLEPLAY_STORYBOARD_PROMPT_VARIABLES = ["keyframeCount", "durationSeconds", "aspectRatio"] as const;

type RoleplayStoryboardPromptContext = Record<(typeof ROLEPLAY_STORYBOARD_PROMPT_VARIABLES)[number], string | number>;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function selectTemplate(rawTemplates: unknown, selectedId: unknown, label: string): AgentPromptTemplateOption {
  const templates = normalizeAgentPromptTemplateOptions(rawTemplates);
  const requestedId = readString(selectedId);
  const selected = (requestedId ? templates.find((template) => template.id === requestedId) : null) ?? templates[0];
  if (!selected?.promptTemplate.trim()) throw new Error(`The Storyboard Agent has no ${label} configured.`);
  return selected;
}

function buildEpisodeBlock(sections: RoleplayStoryboardEpisodeSection[]): string {
  const rows = sections.map(
    (section) =>
      `<section index="${section.index}" kind="${section.kind}" message_id="${escapeXmlAttribute(section.messageId)}">${section.content}</section>`,
  );
  return `<roleplay_episode>\n${rows.join("\n")}\n</roleplay_episode>`;
}

export function buildRoleplayStoryboardMessages(args: {
  meta: Record<string, unknown>;
  sections: RoleplayStoryboardEpisodeSection[];
  keyframeCount: number;
  durationSeconds: number;
  aspectRatio: string;
  generateVideos: boolean;
  continuityContextBlock?: string | null;
  characterAppearanceContextBlock?: string | null;
}): { systemPrompt: string; messages: ChatMessage[]; selectedTemplateIds: string[] } {
  const episodeTemplate = selectTemplate(
    args.meta.roleplayStoryboardEpisodeTemplates,
    args.meta.roleplayStoryboardEpisodeTemplateId,
    "Roleplay episode prompt",
  );
  const styleTemplate = selectTemplate(
    args.meta.roleplayStoryboardStyleTemplates,
    args.meta.roleplayStoryboardStyleTemplateId,
    "Roleplay visual style",
  );
  const outputTemplate = selectTemplate(
    args.meta.roleplayStoryboardOutputTemplates,
    args.meta.roleplayStoryboardOutputTemplateId,
    "Roleplay output contract",
  );
  const animationTemplate = args.generateVideos
    ? selectTemplate(
        args.meta.roleplayStoryboardAnimationTemplates,
        args.meta.roleplayStoryboardAnimationTemplateId,
        "Roleplay animation addon",
      )
    : null;
  const promptContext: RoleplayStoryboardPromptContext = {
    keyframeCount: args.keyframeCount,
    durationSeconds: args.durationSeconds,
    aspectRatio: args.aspectRatio,
  };
  const render = (template: AgentPromptTemplateOption) =>
    renderTemplate(template.promptTemplate, promptContext, [...ROLEPLAY_STORYBOARD_PROMPT_VARIABLES]);
  const systemPrompt = [
    render(episodeTemplate),
    render(styleTemplate),
    animationTemplate ? render(animationTemplate) : "",
    render(outputTemplate),
    args.characterAppearanceContextBlock?.trim() ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const episodeBlock = buildEpisodeBlock(args.sections);
  const task = args.generateVideos
    ? "Create the animation-ready Roleplay storyboard JSON now."
    : "Create the still Roleplay storyboard JSON now.";

  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [args.continuityContextBlock?.trim() ?? "", episodeBlock, task].filter(Boolean).join("\n\n"),
      },
    ],
    selectedTemplateIds: [episodeTemplate.id, styleTemplate.id, animationTemplate?.id, outputTemplate.id].filter(
      (id): id is string => Boolean(id),
    ),
  };
}
