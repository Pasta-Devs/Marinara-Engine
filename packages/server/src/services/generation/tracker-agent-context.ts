import { BUILT_IN_AGENTS, type AgentContext, type ChatMode } from "@marinara-engine/shared";

export function getTrackerAgentTypes(): Set<string> {
  return new Set(BUILT_IN_AGENTS.filter((agent) => agent.category === "tracker").map((agent) => agent.id));
}

export function applyTrackerLorebookContextPolicy(args: {
  context: AgentContext;
  chatMode: ChatMode;
  isTracker: boolean;
  attachLorebooksToTrackers: boolean;
}): AgentContext {
  if (args.chatMode !== "roleplay" || !args.isTracker || args.attachLorebooksToTrackers) {
    return args.context;
  }

  const hasActivatedEntries = Boolean(args.context.activatedLorebookEntries?.length);
  const hasSemanticEntries = Boolean(args.context.vectorContext?.semanticLorebookEntries?.length);
  if (!hasActivatedEntries && !hasSemanticEntries) return args.context;

  return {
    ...args.context,
    activatedLorebookEntries: [],
    ...(hasSemanticEntries && args.context.vectorContext
      ? {
          vectorContext: {
            ...args.context.vectorContext,
            semanticLorebookEntries: [],
          },
        }
      : {}),
  };
}

export function appendTrackerLorebookBatchContextKey(
  currentKey: string | undefined,
  attachLorebooksToTrackers: boolean,
): string {
  const policyKey = attachLorebooksToTrackers ? "tracker-lorebooks-on" : "tracker-lorebooks-off";
  return currentKey ? `${currentKey}|${policyKey}` : policyKey;
}
