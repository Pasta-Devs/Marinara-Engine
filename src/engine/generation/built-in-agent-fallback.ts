import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultBuiltInAgentSettings,
} from "../contracts/types/agent";
import { readString, type JsonRecord } from "./runtime-records";

export const BUILT_IN_AGENT_TYPES = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));
const BUILT_IN_AGENT_ID_PREFIX = "builtin:";

function canonicalAgentActiveId(value: unknown): string {
  const id = readString(value).trim();
  if (!id.startsWith(BUILT_IN_AGENT_ID_PREFIX)) return id;
  const type = id.slice(BUILT_IN_AGENT_ID_PREFIX.length).trim();
  return BUILT_IN_AGENT_TYPES.has(type) ? type : id;
}

export function canonicalAgentActiveIdSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map(canonicalAgentActiveId).filter(Boolean));
}

export function builtInAgentType(agent: JsonRecord): string {
  return typeof agent.type === "string"
    ? agent.type.trim()
    : typeof agent.agentType === "string"
      ? agent.agentType.trim()
      : "";
}

export function isBuiltInAgent(agent: JsonRecord): boolean {
  return BUILT_IN_AGENT_TYPES.has(builtInAgentType(agent));
}

export function buildBuiltInAgentFallback(
  type: string,
  options: { allowDisabled?: boolean } = {},
): JsonRecord | null {
  const meta = BUILT_IN_AGENTS.find((agent) => agent.id === type) ?? null;
  if (!meta) return null;
  if (!meta.enabledByDefault && !options.allowDisabled) return null;
  const settings = {
    ...getDefaultBuiltInAgentSettings(type),
    enabledTools: DEFAULT_AGENT_TOOLS[type] ?? [],
  };
  return {
    id: `builtin:${type}`,
    type,
    name: meta.name,
    description: meta.description,
    enabled: true,
    phase: meta.phase,
    connectionId: null,
    promptTemplate: "",
    settings,
  };
}
