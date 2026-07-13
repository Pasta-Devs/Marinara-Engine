import { createHash, randomUUID } from "node:crypto";
import type { AgentContext, HumanOSContextSnapshot, HumanOSTurnSnapshot } from "@marinara-engine/shared";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function fingerprintHumanOSSnapshot(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function cloneAndFreeze<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    for (const child of Object.values(item as Record<string, unknown>)) freeze(child);
    Object.freeze(item);
  };
  freeze(clone);
  return clone;
}

export function createHumanOSTurnSnapshots(input: {
  sourceMessageId: string | null;
  generationType: string;
  chat: { id: string; mode: string; presetId: string | null; metadata?: unknown };
  recentMessages: AgentContext["recentMessages"];
  characters: AgentContext["characters"];
  persona: AgentContext["persona"];
  runtime: AgentContext["gameState"];
  activatedLorebookEntries: AgentContext["activatedLorebookEntries"];
  chatSummary: string | null;
}): { turn: HumanOSTurnSnapshot; context: HumanOSContextSnapshot } {
  const turnId = randomUUID();
  const generationId = randomUUID();
  const revisions = {
    chat: fingerprintHumanOSSnapshot({ id: input.chat.id, mode: input.chat.mode, metadata: input.chat.metadata }),
    characters: fingerprintHumanOSSnapshot(input.characters),
    persona: fingerprintHumanOSSnapshot(input.persona),
    runtime: fingerprintHumanOSSnapshot(input.runtime),
    lorebook: fingerprintHumanOSSnapshot(input.activatedLorebookEntries),
    preset: fingerprintHumanOSSnapshot(input.chat.presetId),
  };
  const snapshotContent = {
    schemaVersion: "humanos-turn-snapshot/v1" as const,
    sourceMessageId: input.sourceMessageId,
    generationType: input.generationType,
    revisions,
    chat: { id: input.chat.id, mode: input.chat.mode, presetId: input.chat.presetId },
    recentMessages: input.recentMessages,
    characters: input.characters,
    persona: input.persona,
    runtime: input.runtime,
    activatedLorebookEntries: input.activatedLorebookEntries,
  };
  const turn = cloneAndFreeze({
    ...snapshotContent,
    turnId,
    generationId,
    capturedAt: new Date().toISOString(),
    snapshotHash: fingerprintHumanOSSnapshot(snapshotContent),
  });
  const unavailableSources = [
    ...(input.activatedLorebookEntries === null ? ["activated_lorebook_entries"] : []),
    ...(input.runtime === null ? ["runtime"] : []),
    ...(input.chatSummary === null ? ["chat_summary"] : []),
  ];
  const contextCore = {
    schemaVersion: "humanos-context-snapshot/v1" as const,
    turnId,
    sourceSnapshotHash: turn.snapshotHash,
    unavailableSources,
    activatedLorebookEntries: input.activatedLorebookEntries,
    chatSummary: input.chatSummary,
  };
  const context = cloneAndFreeze({ ...contextCore, snapshotHash: fingerprintHumanOSSnapshot(contextCore) });
  return { turn, context };
}
