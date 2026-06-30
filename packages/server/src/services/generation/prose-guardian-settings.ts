import type { ResolvedAgent } from "../agents/agent-pipeline.js";

export const PROSE_GUARDIAN_PENDING_MESSAGE = "Prose Guardian is working!";
export const CONTINUITY_PENDING_MESSAGE = "Continuity Checker is working!";
export const HTML_PENDING_MESSAGE = "Immersive HTML is working!";
export const TEXT_REWRITE_PENDING_MESSAGE = "Rewrite agents are working!";
const LEGACY_PROSE_GUARDIAN_PROMPT_PREFIX =
  "Study the last few assistant messages and produce concrete, actionable writing directives";
const REWRITE_AGENT_TYPES = new Set(["prose-guardian", "continuity", "html"]);

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readSharedHoldForRewrite(
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): boolean {
  const meta = chatMetadata ?? {};
  return typeof meta.proseGuardianHoldForRewrite === "boolean"
    ? meta.proseGuardianHoldForRewrite
    : settings.holdForRewrite !== false;
}

export function applyProseGuardianChatSettings(
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const meta = chatMetadata ?? {};
  const banned = readString(meta.proseGuardianBannedWords) ?? readString(settings.banned) ?? "ozone";
  const avoid =
    readString(meta.proseGuardianAvoidInstructions) ??
    readString(settings.avoid) ??
    "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";
  const prefer = readString(meta.proseGuardianStyleInstructions) ?? readString(settings.prefer) ?? "";
  const holdForRewrite = readSharedHoldForRewrite(settings, chatMetadata);

  return {
    ...settings,
    banned,
    avoid,
    prefer,
    holdForRewrite,
    resultType: "text_rewrite",
  };
}

export function applyContinuityCheckerChatSettings(
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...settings,
    holdForRewrite: readSharedHoldForRewrite(settings, chatMetadata),
    resultType: "text_rewrite",
  };
}

export function applyImmersiveHtmlChatSettings(
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...settings,
    holdForRewrite: readSharedHoldForRewrite(settings, chatMetadata),
    resultType: "text_rewrite",
  };
}

export function applyTextRewriteAgentChatSettings(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (agentType === "prose-guardian") return applyProseGuardianChatSettings(settings, chatMetadata);
  if (agentType === "continuity") return applyContinuityCheckerChatSettings(settings, chatMetadata);
  if (agentType === "html") return applyImmersiveHtmlChatSettings(settings, chatMetadata);
  return settings;
}

export function isBuiltInTextRewriteAgentType(agentType: string | null | undefined): boolean {
  return typeof agentType === "string" && REWRITE_AGENT_TYPES.has(agentType);
}

export function shouldHoldForTextRewrite(agents: ResolvedAgent[]): boolean {
  return agents.some((agent) => REWRITE_AGENT_TYPES.has(agent.type) && agent.settings.holdForRewrite !== false);
}

export function getTextRewritePendingState(agents: ResolvedAgent[]): { agentType: string; message: string } | null {
  const heldTypes = new Set(
    agents
      .filter((agent) => REWRITE_AGENT_TYPES.has(agent.type) && agent.settings.holdForRewrite !== false)
      .map((agent) => agent.type),
  );
  if (heldTypes.size === 0) return null;
  if (heldTypes.size > 1) {
    return { agentType: "text-rewrite", message: TEXT_REWRITE_PENDING_MESSAGE };
  }
  if (heldTypes.has("continuity")) {
    return { agentType: "continuity", message: CONTINUITY_PENDING_MESSAGE };
  }
  if (heldTypes.has("html")) {
    return { agentType: "html", message: HTML_PENDING_MESSAGE };
  }
  return { agentType: "prose-guardian", message: PROSE_GUARDIAN_PENDING_MESSAGE };
}

export function shouldHoldForProseGuardianRewrite(agents: ResolvedAgent[]): boolean {
  return shouldHoldForTextRewrite(agents);
}

function readPositiveNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function maxSetting(...values: unknown[]): number | undefined {
  const numbers = values.map(readPositiveNumber).filter((value): value is number => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

function getRewritePromptLabel(agentType: string): string {
  switch (agentType) {
    case "prose-guardian":
      return "style_editor";
    case "continuity":
      return "continuity_editor";
    case "html":
      return "immersive_html_editor";
    default:
      return "rewrite_editor";
  }
}

function buildMergedRewritePrompt(agents: ResolvedAgent[]): string {
  const agentBlocks = agents.flatMap((agent) => {
    const label = getRewritePromptLabel(agent.type);
    return [`<${label}>`, `Agent: ${agent.name}`, agent.promptTemplate, `</${label}>`, ``];
  });

  return [
    `You are a combined post-processing editor. Rewrite only <assistant_response>.`,
    `Apply every instruction set below in one pass. Preserve events, facts, dialogue intent, speaker meaning, order, tags, and formatting. Do not add story beats.`,
    `If instructions conflict, physical continuity and preserving meaning outrank style preferences; visual enhancements must stay diegetic and must not introduce new facts.`,
    ``,
    ...agentBlocks,
    `Return only one JSON object:`,
    `{"editNeeded":false,"editedText":"","changes":[]}`,
    `If rewriting is needed, set editNeeded to true:`,
    `{"editNeeded":true,"editedText":"entire replacement message","changes":[{"description":"brief edit summary"}]}`,
    `When editNeeded is false, editedText MUST be an empty string and changes MUST be an empty array. Do not return the original text.`,
    `When editNeeded is true, editedText must be the full final message, never a diff, excerpt, option list, or commentary.`,
  ].join("\n");
}

export function mergePairedBuiltInRewriteAgents(agents: ResolvedAgent[]): ResolvedAgent[] {
  const builtInRewriteAgents = agents.filter((agent) => REWRITE_AGENT_TYPES.has(agent.type));
  if (builtInRewriteAgents.length <= 1) return agents;

  const firstMergeIndex = Math.min(...builtInRewriteAgents.map((agent) => agents.indexOf(agent)));
  const baseAgent = builtInRewriteAgents[0]!;
  const contextSize = maxSetting(...builtInRewriteAgents.map((agent) => agent.settings.contextSize));
  const maxTokens = maxSetting(...builtInRewriteAgents.map((agent) => agent.settings.maxTokens));
  const mergedAgent: ResolvedAgent = {
    ...baseAgent,
    name: builtInRewriteAgents.map((agent) => agent.name).join(" + "),
    promptTemplate: buildMergedRewritePrompt(builtInRewriteAgents),
    settings: {
      ...baseAgent.settings,
      resultType: "text_rewrite",
      holdForRewrite: builtInRewriteAgents.some((agent) => agent.settings.holdForRewrite !== false),
      includePreGenInjections: builtInRewriteAgents.some((agent) => agent.settings.includePreGenInjections === true),
      includeParallelResults: builtInRewriteAgents.some((agent) => agent.settings.includeParallelResults === true),
      ...(contextSize !== undefined ? { contextSize } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
    },
  };

  const merged: ResolvedAgent[] = [];
  for (let index = 0; index < agents.length; index++) {
    const agent = agents[index]!;
    if (index === firstMergeIndex) merged.push(mergedAgent);
    if (REWRITE_AGENT_TYPES.has(agent.type)) continue;
    merged.push(agent);
  }
  return merged;
}

export function normalizeProseGuardianPromptTemplate(agentType: string, promptTemplate: unknown): string {
  const template = typeof promptTemplate === "string" ? promptTemplate : "";
  if (agentType !== "prose-guardian") return template;
  return template.trimStart().startsWith(LEGACY_PROSE_GUARDIAN_PROMPT_PREFIX) ? "" : template;
}
