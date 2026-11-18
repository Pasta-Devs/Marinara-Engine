import { BUILT_IN_AGENTS } from "@marinara-engine/shared";
import { isRecord } from "../../utils/large-json.js";

function nonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCustomAgentStyleProfileId({
  usesChatIllustratorSettings,
  agentSettings,
  availableProfiles,
  gameStyleProfileId,
  chatStyleProfileId,
}: {
  usesChatIllustratorSettings: boolean;
  agentSettings: unknown;
  availableProfiles: ReadonlyArray<{ id: string }>;
  gameStyleProfileId: unknown;
  chatStyleProfileId: unknown;
}): string | null {
  const customAgentStyleProfileId = isRecord(agentSettings) ? nonEmptyString(agentSettings.styleProfileId) : "";
  if (
    !usesChatIllustratorSettings &&
    customAgentStyleProfileId &&
    availableProfiles.some((profile) => profile.id === customAgentStyleProfileId)
  ) {
    return customAgentStyleProfileId;
  }
  return nonEmptyString(gameStyleProfileId) || nonEmptyString(chatStyleProfileId) || null;
}

function readCustomAgentImageSettings(
  agentType: string,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  // Built-in agents keep their own dedicated chat-level override keys
  // (illustratorImageConnectionId, gameImageConnectionId, ...); this map is
  // custom-agent-only (#4682).
  if (BUILT_IN_AGENTS.some((agent) => agent.id === agentType)) return null;
  const overrides = chatMetadata?.customAgentImageSettings;
  if (!isRecord(overrides)) return null;
  const settings = overrides[agentType];
  return isRecord(settings) ? settings : null;
}

/**
 * Snapshot force requests (#4682) must resolve to exactly one CUSTOM agent
 * with the Image generation ability: the force flag is applied per
 * image_prompt result (so a multi-agent forced batch would force generation,
 * skip prompt review, and emit decline errors for unrelated agents), the
 * manual-request directive is meaningless for agents whose result schema has
 * no shouldGenerate field, and the vanilla Illustrator has its own manual
 * path (illustratorRetryTargets). The shipped camera button already enforces
 * all of this; this enforces it for hand-crafted requests too. Returns the
 * rejection message, or null when the request is acceptable.
 */
export function forceImageGenerationScopeError(
  forceImageGeneration: boolean,
  targets: Array<{ isCustomAgent: boolean; canEmitImagePrompt: boolean }>,
): string | null {
  if (!forceImageGeneration) return null;
  if (targets.length !== 1) {
    return "Image snapshot requests target exactly one agent. Use the camera button on a single agent's card in Chat Settings.";
  }
  const target = targets[0]!;
  if (!target.isCustomAgent) {
    return "Image snapshots only apply to custom image agents. Built-in agents like the Illustrator have their own manual controls.";
  }
  if (!target.canEmitImagePrompt) {
    return "Image snapshots require an agent with the Image generation ability. Enable it in the agent's settings first.";
  }
  return null;
}

/**
 * A forced snapshot (#4682) whose agent SUCCEEDED without a usable image_prompt
 * payload (different result type, or null/non-object data) never enters the
 * image-generation block, so nothing downstream surfaces the outcome — the
 * camera press would look like a silent no-op. Failed results are excluded:
 * their error already reaches the client via the agent_result event.
 */
export function needsForcedSnapshotFallback(
  forceImageGeneration: boolean,
  result: { success: boolean; type?: string | null; data?: unknown },
): boolean {
  if (!forceImageGeneration || !result.success) return false;
  return !(result.type === "image_prompt" && !!result.data && typeof result.data === "object");
}

/**
 * Apply this chat's per-agent image overrides to a custom image agent's
 * resolved settings, mirroring applyKnowledgeAgentChatSettings. An empty or
 * missing entry leaves the agent's own configuration untouched, so "Agent
 * default" in the chat drawer behaves like no override at all.
 */
export function applyCustomAgentImageChatSettings(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const override = readCustomAgentImageSettings(agentType, chatMetadata);
  if (!override) return settings;

  const next = { ...settings };
  if (typeof override.imageConnectionId === "string" && override.imageConnectionId.trim()) {
    next.imageConnectionId = override.imageConnectionId;
  }
  const styleProfileId = nonEmptyString(override.styleProfileId);
  if (styleProfileId) {
    next.styleProfileId = styleProfileId;
  }
  return next;
}
