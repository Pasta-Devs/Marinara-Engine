function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function readKnowledgeAgentSourceSettings(
  agentType: string,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (agentType !== "knowledge-retrieval" && agentType !== "knowledge-router") return null;
  const sources = chatMetadata?.knowledgeAgentSources;
  if (!isRecord(sources)) return null;
  const settings = sources[agentType];
  return isRecord(settings) ? settings : null;
}

export function applyKnowledgeAgentChatSettings(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const override = readKnowledgeAgentSourceSettings(agentType, chatMetadata);
  if (!override) return settings;

  const next = { ...settings };
  if (typeof override.useChatActiveLorebooks === "boolean") {
    next.useChatActiveLorebooks = override.useChatActiveLorebooks;
  }
  if (hasOwn(override, "sourceLorebookIds")) {
    next.sourceLorebookIds = normalizeStringArray(override.sourceLorebookIds);
  }
  if (agentType === "knowledge-retrieval" && hasOwn(override, "sourceFileIds")) {
    next.sourceFileIds = normalizeStringArray(override.sourceFileIds);
  }
  return next;
}
