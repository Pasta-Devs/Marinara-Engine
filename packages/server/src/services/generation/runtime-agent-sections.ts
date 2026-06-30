import {
  BUILT_IN_AGENTS,
  getDefaultBuiltInAgentSettings,
  isAgentAvailableInChatMode,
  nameToXmlTag,
  type ChatMode,
} from "@marinara-engine/shared";
import type { AgentInjection } from "../agents/agent-pipeline.js";
import { resolveAgentResultType } from "../agents/agent-executor.js";

export type RuntimeAgentSectionType = string;

export interface RuntimeAgentSectionTokens {
  placeholder: string;
  start: string;
  end: string;
}

const RUNTIME_AGENT_SECTION_TOKEN_PREFIX = "__MARINARA_RUNTIME_AGENT_SECTION__";

export const REVIEWABLE_WRITER_AGENT_TYPES = new Set(
  BUILT_IN_AGENTS.filter(
    (agent) =>
      agent.category === "writer" &&
      agent.phase === "pre_generation" &&
      !["director", "knowledge-retrieval", "knowledge-router"].includes(agent.id),
  ).map((agent) => agent.id),
);

export function formatAgentInjections(injections: AgentInjection[], wrapFormat: string): string {
  if (injections.length === 1) {
    const { agentType, agentName, text } = injections[0]!;
    const label = agentName?.trim() || agentType;
    const tag = agentInjectionXmlTag(label, agentType);
    if (wrapFormat === "markdown") return `## ${label}\n${text}`;
    if (wrapFormat === "xml") return `<${tag}>\n${text}\n</${tag}>`;
    return text;
  }

  const parts: string[] = [];
  const usedXmlTags = new Set<string>();
  for (const { agentType, agentName, text } of injections) {
    const label = agentName?.trim() || agentType;
    const tag = uniqueAgentInjectionXmlTag(label, agentType, usedXmlTags);
    if (wrapFormat === "markdown") {
      parts.push(`## ${label}\n${text}`);
    } else if (wrapFormat === "xml") {
      parts.push(`<${tag}>\n${text}\n</${tag}>`);
    } else {
      parts.push(text);
    }
  }
  return parts.join("\n\n");
}

function agentInjectionXmlTag(label: string, agentType: string): string {
  const tag = nameToXmlTag(label) || nameToXmlTag(agentType) || "agent";
  return /^[a-z_]/i.test(tag) ? tag : `agent_${tag}`;
}

function uniqueAgentInjectionXmlTag(label: string, agentType: string, usedTags: Set<string>): string {
  const base = agentInjectionXmlTag(label, agentType);
  let tag = base;
  let index = 2;
  while (usedTags.has(tag)) {
    tag = `${base}-${index}`;
    index += 1;
  }
  usedTags.add(tag);
  return tag;
}

export function toRuntimeAgentSectionType(
  agentType: string,
  eligibleAgentTypes: ReadonlySet<string>,
): RuntimeAgentSectionType | null {
  return eligibleAgentTypes.has(agentType) ? agentType : null;
}

function parseRuntimeAgentSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "string") {
    try {
      const parsed = JSON.parse(settings) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
}

export function buildRuntimeAgentSectionEligibleTypes(input: {
  enableAgents: boolean;
  activeAgentIds: string[];
  chatMode?: ChatMode;
  configuredAgents?: Array<{ type: string; phase: string; settings?: unknown }>;
}): Set<RuntimeAgentSectionType> {
  const eligible = new Set<RuntimeAgentSectionType>();
  if (!input.enableAgents || input.activeAgentIds.length === 0) return eligible;

  const activeAgentIds = new Set(input.activeAgentIds);

  for (const agent of BUILT_IN_AGENTS) {
    if (!activeAgentIds.has(agent.id)) continue;
    if (input.chatMode && !isAgentAvailableInChatMode(input.chatMode, agent.id)) continue;
    if (agent.phase !== "pre_generation") continue;
    if (
      resolveAgentResultType({ type: agent.id, settings: getDefaultBuiltInAgentSettings(agent.id) }) !==
      "context_injection"
    ) {
      continue;
    }
    eligible.add(agent.id);
  }

  for (const agent of input.configuredAgents ?? []) {
    if (!activeAgentIds.has(agent.type)) continue;
    if (input.chatMode && !isAgentAvailableInChatMode(input.chatMode, agent.type)) continue;
    if (agent.phase !== "pre_generation") continue;
    const settings = parseRuntimeAgentSettings(agent.settings);
    if (resolveAgentResultType({ type: agent.type, settings }) !== "context_injection") continue;
    eligible.add(agent.type);
  }

  return eligible;
}

export const buildRuntimeAgentSectionEligibleTypesForTest = buildRuntimeAgentSectionEligibleTypes;

export function makeRuntimeAgentSectionTokens(
  agentType: RuntimeAgentSectionType,
  nonce: string,
): RuntimeAgentSectionTokens {
  return {
    placeholder: `${RUNTIME_AGENT_SECTION_TOKEN_PREFIX}${nonce}__${agentType}__VALUE__`,
    start: `${RUNTIME_AGENT_SECTION_TOKEN_PREFIX}${nonce}__${agentType}__START__`,
    end: `${RUNTIME_AGENT_SECTION_TOKEN_PREFIX}${nonce}__${agentType}__END__`,
  };
}

export function replaceRuntimeAgentSection(
  messages: Array<{ content: string }>,
  tokens: RuntimeAgentSectionTokens,
  text: string,
): boolean {
  let replaced = false;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;
    if (!message.content.includes(tokens.placeholder)) continue;
    messages[i] = {
      ...message,
      content: message.content
        .split(tokens.start)
        .join("")
        .split(tokens.end)
        .join("")
        .split(tokens.placeholder)
        .join(text),
    };
    replaced = true;
  }
  return replaced;
}

export function splitRuntimeHandledAgentInjections(
  messages: Array<{ content: string }>,
  tokenMap: ReadonlyMap<RuntimeAgentSectionType, RuntimeAgentSectionTokens>,
  injections: AgentInjection[],
): { fallbackInjections: AgentInjection[]; handledTypes: Set<string> } {
  const fallbackInjections: AgentInjection[] = [];
  const handledTypes = new Set<string>();
  for (const injection of injections) {
    const tokens = tokenMap.get(injection.agentType);
    const handledByPresetSection = tokens !== undefined && replaceRuntimeAgentSection(messages, tokens, injection.text);
    if (handledByPresetSection) {
      handledTypes.add(injection.agentType);
    } else {
      fallbackInjections.push(injection);
    }
  }
  return { fallbackInjections, handledTypes };
}

export const splitRuntimeHandledAgentInjectionsForTest = splitRuntimeHandledAgentInjections;

export function clearUnusedRuntimeAgentSections(
  messages: Array<{ content: string }>,
  tokenEntries: Iterable<[RuntimeAgentSectionType, RuntimeAgentSectionTokens]>,
): void {
  let changed = false;
  for (const [, tokens] of tokenEntries) {
    const sectionPattern = new RegExp(escapeRegExp(tokens.start) + "[\\s\\S]*?" + escapeRegExp(tokens.end), "g");
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]!;
      if (!message.content.includes(tokens.start)) continue;
      const content = message.content.replace(sectionPattern, "").trim();
      if (content) {
        messages[i] = { ...message, content };
      } else {
        messages.splice(i, 1);
      }
      changed = true;
    }
  }
  if (changed) {
    pruneEmptyPromptWrappers(messages);
  }
}

export const clearUnusedRuntimeAgentSectionsForTest = clearUnusedRuntimeAgentSections;

export function pruneEmptyPromptWrappers(messages: Array<{ content: string }>): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i]!.content.trim();
    if (isEmptyPromptWrapper(content)) {
      messages.splice(i, 1);
    } else if (content !== messages[i]!.content) {
      messages[i] = { ...messages[i]!, content };
    }
  }
}

function isEmptyPromptWrapper(content: string): boolean {
  if (!content) return true;
  const xmlMatch = content.match(/^<([A-Za-z][\w.-]*)>\s*<\/\1>$/);
  if (xmlMatch) return true;
  return (
    /^#{1,6}\s+\S.*$/m.test(content) &&
    content
      .split(/\r?\n/)
      .slice(1)
      .every((line) => !line.trim())
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
