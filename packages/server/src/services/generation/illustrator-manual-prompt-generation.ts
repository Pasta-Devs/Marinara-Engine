import type { AgentContext } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { normalizeAgentContextSize, renderAgentPromptTemplate } from "../agents/agent-executor.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import type { ChatCompletionResult, ChatMessage } from "../llm/base-provider.js";

const MANUAL_ILLUSTRATION_MAX_TOKENS = 1_800;
const MANUAL_ILLUSTRATOR_PROMPT_MODE_MAX_LENGTH = 12_000;
const MANUAL_ILLUSTRATION_SYSTEM_PROMPT = [
  "You are the Illustrator prompt writer for a manual Gallery illustration request.",
  "The user already pressed Illustration. Do not decide whether to generate an image, do not discuss that decision, and do not return shouldGenerate or generateBackground fields.",
  "Write one detailed, provider-ready prompt for an image model that depicts the most visually important current scene established by the supplied conversation.",
  "Use the supplied character cards and user persona to keep identities, clothing, physical traits, relationships, and setting details consistent.",
  "Name every character who should be visible in the characters array. Do not add characters who are absent from the chosen moment.",
  "The selected Illustrator prompt mode controls the required visual format, layout, framing, text behavior, and aspect ratio. Preserve comic pages, manga pages, selfies, backgrounds, and other selected formats exactly; never collapse a requested multi-panel page into one ordinary scene.",
  "The prompt should describe subjects, actions, expressions, environment, camera/framing, lighting, atmosphere, and important props without narrating your reasoning.",
  "Return valid JSON only, with no markdown:",
  '{"prompt":"detailed provider-ready image prompt","negativePrompt":"optional exclusions","style":"optional scene-specific art direction","characters":["visible names"],"aspectRatio":"portrait|landscape|square","reason":"brief description of the chosen moment"}',
].join("\n");

export type ManualIllustratorPromptPlan = {
  prompt: string;
  negativePrompt: string;
  style: string;
  characters: string[];
  aspectRatio: "portrait" | "landscape" | "square" | "";
  reason: string;
};

export type ManualIllustratorPromptResult = {
  plan: ManualIllustratorPromptPlan;
  tokensUsed: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeCharacterNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(readTrimmedString)
        .filter(Boolean)
        .map((name) => name.slice(0, 120)),
    ),
  ).slice(0, 16);
}

function normalizeAspectRatio(value: unknown): ManualIllustratorPromptPlan["aspectRatio"] {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "portrait" || normalized === "landscape" || normalized === "square") {
    return normalized;
  }
  return "";
}

export function normalizeManualIllustratorPromptModeInstruction(promptTemplate: string): string {
  const withoutTaggedOutputSchemas = promptTemplate.replace(
    /<(?:output_format|output_schema|response_format|json_schema)\b[^>]*>[\s\S]*?<\/(?:output_format|output_schema|response_format|json_schema)>/giu,
    "",
  );
  const withoutOutputSchemaFences = withoutTaggedOutputSchemas.replace(
    /```(?:json)?\s*[\s\S]*?```/giu,
    (block) =>
      /\b(?:shouldGenerate|generateBackground)\b|["'](?:prompt|negativePrompt|style|characters|aspectRatio|reason)["']\s*:/iu.test(
        block,
      )
        ? ""
        : block,
  );
  const lines = withoutOutputSchemaFences.split("\n");
  const outputSchemaStart = lines.findIndex((line) => {
    const normalized = line.trim();
    return (
      /^(?:#{1,6}\s*)?(?:output|response)\s+(?:format|schema|structure)\s*:/iu.test(normalized) ||
      /^(?:#{1,6}\s*)?json\s+schema\s*:/iu.test(normalized) ||
      /^(?:return|respond|reply|output|emit|provide|produce)\b[^\n]{0,180}\b(?:json|schema|object|structure)\b/iu.test(
        normalized,
      )
    );
  });
  const promptModeLines = outputSchemaStart >= 0 ? lines.slice(0, outputSchemaStart) : lines;

  return promptModeLines
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) return true;
      if (/\b(?:shouldGenerate|generateBackground)\b/iu.test(normalized)) return false;
      if (/^Anchor the decision\b/iu.test(normalized)) return false;
      if (/^Generate only for\b/iu.test(normalized)) return false;
      if (/^If not worth illustrating\b/iu.test(normalized)) return false;
      if (/^No prose outside the JSON\b/iu.test(normalized)) return false;
      if (
        /\b(?:decide|determine|evaluate|assess|choose)\b[^\n]{0,160}\b(?:whether|if)\b[^\n]{0,160}\b(?:generate|generation|illustrate|illustration|image|picture)\b/iu.test(
          normalized,
        )
      ) {
        return false;
      }
      if (
        /\b(?:generate|illustrate|create|draw)\b[^\n]{0,100}\bonly\b[^\n]{0,100}\b(?:if|when|for)\b/iu.test(
          normalized,
        ) ||
        /\bonly\b[^\n]{0,100}\b(?:generate|illustrate|create|draw)\b[^\n]{0,100}\b(?:if|when|for)\b/iu.test(
          normalized,
        )
      ) {
        return false;
      }
      if (
        /\b(?:if|when)\b[^\n]{0,140}\b(?:not worth|do not|don't|skip|avoid)\b[^\n]{0,140}\b(?:generate|illustrate|illustration|image|picture)\b/iu.test(
          normalized,
        ) ||
        /\b(?:if|when)\b[^\n]{0,140}\b(?:generate|illustrate|illustration|image|picture)\b[^\n]{0,140}\b(?:do not|don't|skip|avoid)\b/iu.test(
          normalized,
        )
      ) {
        return false;
      }
      if (
        /\b(?:generation|illustration)\s+(?:decision|cadence|interval|frequency|cooldown)\b/iu.test(
          normalized,
        ) ||
        /\b(?:run|trigger|generate|illustrate)\b[^\n]{0,100}\bevery\s+\d+\b[^\n]{0,60}\b(?:turn|message|response)s?\b/iu.test(
          normalized,
        )
      ) {
        return false;
      }
      return true;
    })
    .join("\n")
    .trim()
    .slice(0, MANUAL_ILLUSTRATOR_PROMPT_MODE_MAX_LENGTH);
}

export function parseManualIllustratorPromptPlan(value: unknown): ManualIllustratorPromptPlan | null {
  const record = parseRecord(value);
  const prompt = readTrimmedString(record.prompt ?? record.imagePrompt ?? record.description).slice(0, 7_000);
  if (!prompt) return null;
  return {
    prompt,
    negativePrompt: readTrimmedString(record.negativePrompt ?? record.negative_prompt).slice(0, 5_000),
    style: readTrimmedString(record.style ?? record.artStyle).slice(0, 1_000),
    characters: normalizeCharacterNames(record.characters ?? record.visibleCharacters),
    aspectRatio: normalizeAspectRatio(record.aspectRatio ?? record.aspect_ratio),
    reason: readTrimmedString(record.reason).slice(0, 500),
  };
}

function appendContextField(parts: string[], label: string, value: string | undefined, maxLength: number): void {
  const text = value?.trim();
  if (text) parts.push(`${label}: ${text.slice(0, maxLength)}`);
}

function escapeContextAttribute(value: string): string {
  return value
    .trim()
    .slice(0, 120)
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function buildCharacterPersonaContext(context: AgentContext): string {
  const parts: string[] = ["<visual_identity_context>"];
  if (context.characters.length > 0) {
    parts.push("<characters>");
    for (const character of context.characters) {
      parts.push(`<character name="${escapeContextAttribute(character.name)}">`);
      appendContextField(parts, "Description", character.description, 2_000);
      appendContextField(parts, "Appearance", character.appearance, 1_500);
      appendContextField(parts, "Personality", character.personality, 1_000);
      appendContextField(parts, "Backstory", character.backstory, 1_000);
      appendContextField(parts, "Scenario", character.scenario, 1_000);
      parts.push("</character>");
    }
    parts.push("</characters>");
  }
  if (context.persona) {
    parts.push("<user_persona>");
    appendContextField(parts, "Name", context.persona.name, 120);
    appendContextField(parts, "Description", context.persona.description, 2_000);
    appendContextField(parts, "Appearance", context.persona.appearance, 1_500);
    appendContextField(parts, "Personality", context.persona.personality, 1_000);
    appendContextField(parts, "Backstory", context.persona.backstory, 1_000);
    appendContextField(parts, "Scenario", context.persona.scenario, 1_000);
    parts.push("</user_persona>");
  }
  if (context.gameState) {
    parts.push("<current_tracker_state>");
    parts.push(JSON.stringify(context.gameState));
    parts.push("</current_tracker_state>");
  }
  parts.push("</visual_identity_context>");
  return parts.join("\n");
}

function appendConversationMessage(messages: ChatMessage[], role: "user" | "assistant", content: string): void {
  const clean = content.trim().slice(0, 4_000);
  if (!clean) return;
  const previous = messages.at(-1);
  if (previous?.role === role) {
    previous.content = `${previous.content}\n\n${clean}`;
    return;
  }
  messages.push({ role, content: clean, contextKind: "history" });
}

export function buildManualIllustratorPromptMessages(args: {
  context: AgentContext;
  contextSize: unknown;
  selectedPromptTemplate?: string;
  styleInstruction?: string;
}): ChatMessage[] {
  const promptModeInstruction = normalizeManualIllustratorPromptModeInstruction(args.selectedPromptTemplate ?? "");
  const systemPrompt = [
    MANUAL_ILLUSTRATION_SYSTEM_PROMPT,
    promptModeInstruction
      ? [
          "<selected_illustrator_prompt_mode>",
          "Follow these content and format requirements. Generation-decision and output-schema instructions have already been resolved by the Gallery button:",
          promptModeInstruction,
          "</selected_illustrator_prompt_mode>",
        ].join("\n")
      : "No selected Illustrator prompt mode supplied; use one coherent scene illustration.",
    args.styleInstruction
      ? `Additional Image Style instruction for the image prompt you write: ${args.styleInstruction}\nCombine it with the selected Illustrator prompt mode. It may refine rendering and visual treatment, but it must not replace or weaken the selected format, layout, framing, or text requirements.`
      : "No visual style profile is selected. Infer only the visual treatment supported by the scene context.",
    buildCharacterPersonaContext(args.context),
  ].join("\n\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
      contextKind: "prompt",
    },
  ];
  const recentMessages = args.context.recentMessages.slice(-normalizeAgentContextSize(args.contextSize));
  for (const message of recentMessages) {
    appendConversationMessage(messages, message.role === "assistant" ? "assistant" : "user", message.content);
  }
  const instruction = [
    "<manual_gallery_illustration_request>",
    "Write the image-model prompt now for the current scene. The Illustration button has already selected the output type.",
    "</manual_gallery_illustration_request>",
  ].join("\n");
  const last = messages.at(-1);
  if (last?.role === "user") {
    last.content = `${last.content}\n\n${instruction}`;
  } else {
    messages.push({ role: "user", content: instruction, contextKind: "prompt" });
  }
  return messages;
}

function resolveManualIllustratorMaxTokens(agent: ResolvedAgent): number {
  const configured = Number(agent.settings.maxTokens);
  const configuredLimit =
    Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : MANUAL_ILLUSTRATION_MAX_TOKENS;
  const modelLimit =
    typeof agent.maxOutputTokens === "number" && agent.maxOutputTokens > 0
      ? Math.trunc(agent.maxOutputTokens)
      : MANUAL_ILLUSTRATION_MAX_TOKENS;
  return Math.max(256, Math.min(MANUAL_ILLUSTRATION_MAX_TOKENS, configuredLimit, modelLimit));
}

export async function writeManualIllustratorPromptPlan(args: {
  illustratorAgent: ResolvedAgent;
  context: AgentContext;
  styleInstruction?: string;
  signal?: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
}): Promise<ManualIllustratorPromptResult> {
  const selectedPromptTemplate = renderAgentPromptTemplate(
    args.illustratorAgent.promptTemplate,
    args.illustratorAgent.settings,
    args.context,
    { escapeValues: true },
  );
  const messages = buildManualIllustratorPromptMessages({
    context: args.context,
    contextSize: args.illustratorAgent.settings.contextSize,
    selectedPromptTemplate,
    styleInstruction: args.styleInstruction,
  });
  args.debugLog?.(
    "[debug/illustrator/manual-illustration-prompt] messages:\n%s",
    messages.map((message) => `${message.role}:\n${message.content}`).join("\n\n"),
  );

  const callPromptWriter = (requestMessages: ChatMessage[]): Promise<ChatCompletionResult> =>
    args.illustratorAgent.provider.chatComplete(requestMessages, {
      model: args.illustratorAgent.model,
      temperature: 0.55,
      maxTokens: resolveManualIllustratorMaxTokens(args.illustratorAgent),
      enableCaching: args.illustratorAgent.enableCaching,
      anthropicExtendedCacheTtl: args.illustratorAgent.anthropicExtendedCacheTtl,
      cachingAtDepth: args.illustratorAgent.cachingAtDepth,
      customParameters: args.illustratorAgent.customParameters,
      signal: args.signal,
    });

  let response = await callPromptWriter(messages);
  let tokensUsed = response.usage?.totalTokens ?? 0;
  let raw = response.content ?? "";
  let plan = parseManualIllustratorPromptPlan(raw);
  if (!plan && !args.signal?.aborted) {
    logger.warn("[illustrator-manual] Prompt writer returned invalid JSON; retrying once");
    response = await callPromptWriter([
      ...messages,
      { role: "assistant", content: raw.slice(0, 7_000), contextKind: "history" },
      {
        role: "user",
        content:
          'Return the requested JSON object now. "prompt" must be a non-empty string. Do not include shouldGenerate or generateBackground.',
        contextKind: "prompt",
      },
    ]);
    tokensUsed += response.usage?.totalTokens ?? 0;
    raw = response.content ?? "";
    plan = parseManualIllustratorPromptPlan(raw);
  }
  if (!plan) throw new Error("Illustrator returned an invalid manual illustration prompt.");
  args.debugLog?.("[debug/illustrator/manual-illustration-prompt] plan:\n%s", JSON.stringify(plan, null, 2));
  return { plan, tokensUsed };
}
