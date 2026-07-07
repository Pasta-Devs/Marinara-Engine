import {
  NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
  type ChatMode,
} from "@marinara-engine/shared";

import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { wrapContent } from "../prompt/format-engine.js";
import { resolveAgentRunInterval } from "./agent-cadence.js";

export const DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL = 8;
export const DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY = "secretPlotLastAssistantMessageId";

export function normalizeDirectorSecretPlotRunInterval(value: unknown): number {
  return resolveAgentRunInterval({ runInterval: value }, DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL);
}

export function resolveDirectorSecretPlotEnabled(
  settings: Record<string, unknown>,
  chatMeta: Record<string, unknown>,
  chatMode: ChatMode,
): boolean {
  if (chatMode !== "roleplay") return false;
  if (typeof chatMeta.narrativeDirectorSecretPlotEnabled === "boolean") {
    return chatMeta.narrativeDirectorSecretPlotEnabled;
  }
  return settings.secretPlotEnabled === true;
}

export function resolveDirectorSecretPlotRunInterval(
  settings: Record<string, unknown>,
  chatMeta: Record<string, unknown>,
): number {
  return normalizeDirectorSecretPlotRunInterval(
    chatMeta.narrativeDirectorSecretPlotRunInterval ?? settings.secretPlotRunInterval,
  );
}

function normalizeSecretPlotArc(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const description = raw.trim();
    return description ? { description, completed: false } : null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const arc = raw as Record<string, unknown>;
  const description = typeof arc.description === "string" ? arc.description.trim() : "";
  const protagonistArc = typeof arc.protagonistArc === "string" ? arc.protagonistArc.trim() : "";
  const characterArc = typeof arc.characterArc === "string" ? arc.characterArc.trim() : "";
  const normalized: Record<string, unknown> = {
    ...(description ? { description } : {}),
    ...(protagonistArc ? { protagonistArc } : {}),
    ...(characterArc ? { characterArc } : {}),
    completed: arc.completed === true,
  };
  return Object.keys(normalized).length > 1 || normalized.completed === true ? normalized : null;
}

export function buildSecretPlotStateFromMemory(memory: Record<string, unknown>): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  const arc = normalizeSecretPlotArc(memory.overarchingArc);
  if (arc) state.overarchingArc = arc;
  return state;
}

export function secretPlotArcIsCompleted(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const arc = normalizeSecretPlotArc((data as Record<string, unknown>).overarchingArc);
  return arc?.completed === true;
}

export function shouldRunDirectorSecretPlotMaintenance(args: {
  memory: Record<string, unknown>;
  runInterval: number;
  messages: Array<{ id?: string | null; role?: string | null }>;
}): boolean {
  const state = buildSecretPlotStateFromMemory(args.memory);
  const arc = normalizeSecretPlotArc(state.overarchingArc);
  if (!arc) return true;
  if (arc.completed === true) return true;
  if (args.runInterval <= 1) return true;

  const lastMessageId = args.memory[DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY];
  if (typeof lastMessageId !== "string" || !lastMessageId) return true;
  const lastIndex = args.messages.findIndex((message) => message.id === lastMessageId);
  if (lastIndex < 0) return true;
  const assistantMessagesSince = args.messages
    .slice(lastIndex + 1)
    .filter((message) => message.role === "assistant").length;
  return assistantMessagesSince + 1 >= args.runInterval;
}

export function formatSecretPlotSystemBlock(arcRaw: unknown, wrapFormat: "xml" | "markdown" | "none"): string {
  const arc = normalizeSecretPlotArc(arcRaw);
  if (!arc) return "";
  const payload = JSON.stringify({ overarchingArc: arc }, null, 2);
  if (wrapFormat === "none") return `Secret plot\n${payload}`;
  return wrapContent(payload, "Secret plot", wrapFormat);
}

export function appendSecretPlotSystemMessage(
  messages: Array<{ role: string; content: string; [key: string]: unknown }>,
  content: string,
): void {
  if (!content.trim()) return;
  const firstChatIndex = messages.findIndex((message) => message.role === "user" || message.role === "assistant");
  const insertAt = firstChatIndex >= 0 ? firstChatIndex : messages.length;
  messages.splice(insertAt, 0, { role: "system", content });
}

export function buildDirectorSecretPlotAgent(agent: ResolvedAgent): ResolvedAgent {
  return {
    ...agent,
    promptTemplate: NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
    settings: {
      ...agent.settings,
      resultType: "secret_plot",
    },
  };
}
