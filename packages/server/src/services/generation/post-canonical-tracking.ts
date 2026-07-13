import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { fingerprintHumanOSSnapshot } from "./humanos-turn-snapshot.js";

export interface CanonicalAssistantMessage {
  id: string;
  chatId: string;
  role: string;
  content: string;
  activeSwipeIndex?: number | null;
}

export interface PostCanonicalTrackingResult {
  status: "skipped" | "completed";
  reason?: "aborted" | "review_not_approved" | "no_agents" | "missing_message_id" | "canonical_message_unavailable";
  results: AgentResult[];
}

/**
 * Execute trackers only after the final assistant text has been persisted and
 * reloaded from storage. The Runtime anchor is derived exclusively from that
 * canonical stored message; candidates and intermediate rewrites never receive
 * commit authority.
 */
export async function runPostCanonicalTracking(args: {
  agents: ResolvedAgent[];
  chatId: string;
  messageId: string | null | undefined;
  aborted: boolean;
  canonicalApproved?: boolean;
  baseContext: AgentContext;
  preGenInjections: AgentContext["preGenInjections"];
  parallelResults: AgentContext["parallelResults"];
  loadMessage: (messageId: string) => Promise<CanonicalAssistantMessage | null | undefined>;
  setRuntimeAnchor: (anchor: { messageId: string; swipeIndex: number; sourceContentHash: string } | null) => void;
  onCanonicalMessage?: (message: CanonicalAssistantMessage, swipeIndex: number) => void;
  executeTrackers: (agents: ResolvedAgent[], context: AgentContext) => Promise<AgentResult[]>;
  saveRun: (result: AgentResult, messageId: string) => Promise<void>;
  onSaveError?: (error: unknown) => void;
}): Promise<PostCanonicalTrackingResult> {
  if (args.aborted) return { status: "skipped", reason: "aborted", results: [] };
  if (args.canonicalApproved === false) return { status: "skipped", reason: "review_not_approved", results: [] };
  if (args.agents.length === 0) return { status: "skipped", reason: "no_agents", results: [] };
  if (!args.messageId) return { status: "skipped", reason: "missing_message_id", results: [] };

  const canonicalMessage = await args.loadMessage(args.messageId);
  if (canonicalMessage?.role !== "assistant" || canonicalMessage.chatId !== args.chatId) {
    return { status: "skipped", reason: "canonical_message_unavailable", results: [] };
  }

  const canonicalSwipeIndex = canonicalMessage.activeSwipeIndex ?? 0;
  args.setRuntimeAnchor({
    messageId: canonicalMessage.id,
    swipeIndex: canonicalSwipeIndex,
    sourceContentHash: fingerprintHumanOSSnapshot(canonicalMessage.content),
  });
  args.onCanonicalMessage?.(canonicalMessage, canonicalSwipeIndex);

  const canonicalContext: AgentContext = {
    ...args.baseContext,
    mainResponse: canonicalMessage.content,
    preGenInjections: args.preGenInjections,
    parallelResults: args.parallelResults,
  };
  const results = await args.executeTrackers(args.agents, canonicalContext);

  for (const result of results) {
    try {
      await args.saveRun(result, canonicalMessage.id);
    } catch (error) {
      args.onSaveError?.(error);
    }
  }

  return { status: "completed", results };
}
