import { isRecord } from "./is-record";
import { type KnowledgeAgentSourceSettings, getDefaultBuiltInAgentSettings } from "@marinara-engine/shared";

export type KnowledgeAgentType = "knowledge-retrieval" | "knowledge-router";

export function isKnowledgeAgentType(value: string): value is KnowledgeAgentType {
  return value === "knowledge-retrieval" || value === "knowledge-router";
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeStringArraySetting(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function readKnowledgeAgentSourceOverride(
  sources: unknown,
  agentType: KnowledgeAgentType,
): Record<string, unknown> | null {
  if (!isRecord(sources)) return null;
  const entry = sources[agentType];
  return isRecord(entry) ? entry : null;
}

export function normalizeKnowledgeAgentSourceSettings(
  agentType: KnowledgeAgentType,
  baseSettings: Record<string, unknown>,
  metadataSources: unknown,
): KnowledgeAgentSourceSettings {
  const defaultSettings = getDefaultBuiltInAgentSettings(agentType);
  const override = readKnowledgeAgentSourceOverride(metadataSources, agentType);
  const useChatActiveLorebooks =
    typeof override?.useChatActiveLorebooks === "boolean"
      ? override.useChatActiveLorebooks
      : typeof baseSettings.useChatActiveLorebooks === "boolean"
        ? baseSettings.useChatActiveLorebooks
        : defaultSettings.useChatActiveLorebooks === true;
  const sourceLorebookIds =
    override && hasOwn(override, "sourceLorebookIds")
      ? normalizeStringArraySetting(override.sourceLorebookIds)
      : normalizeStringArraySetting(baseSettings.sourceLorebookIds);
  const sourceFileIds =
    agentType === "knowledge-retrieval"
      ? override && hasOwn(override, "sourceFileIds")
        ? normalizeStringArraySetting(override.sourceFileIds)
        : normalizeStringArraySetting(baseSettings.sourceFileIds)
      : [];

  return {
    useChatActiveLorebooks,
    sourceLorebookIds,
    ...(agentType === "knowledge-retrieval" ? { sourceFileIds } : {}),
  };
}
