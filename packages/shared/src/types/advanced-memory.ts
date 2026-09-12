import { z } from "zod";

export const advancedMemorySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxContextTokens: z.number().int().min(1024).max(10_000_000).default(65_000),
  summaryBudgetTokens: z.number().int().min(64).max(131_072).default(4096),
  helperConnectionId: z.string().nullable().default(null),
  initialProcessingModel: z.enum(["main", "helper"]).default("helper"),
  retrieveMinMessages: z.number().int().min(1).max(50).default(3),
  retrieveMaxMessages: z.number().int().min(1).max(50).default(10),
  narratorCharacterId: z.string().nullable().default(null),
  /** A null value explicitly confirms knowledge from the beginning. Missing means unconfirmed. */
  knowledgeStarts: z.record(z.string().nullable()).default({}),
  knowledgeConfirmed: z.boolean().default(false),
});

export type AdvancedMemorySettings = z.infer<typeof advancedMemorySettingsSchema>;
export const DEFAULT_ADVANCED_MEMORY_SETTINGS: AdvancedMemorySettings = advancedMemorySettingsSchema.parse({});

export function normalizeAdvancedMemorySettings(value: unknown): AdvancedMemorySettings {
  const parsed = advancedMemorySettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, knowledgeStarts: {} };
}

export interface AdvancedMemoryJob {
  id?: string;
  blocking?: boolean;
  status: "idle" | "running" | "ready" | "cancelled" | "error" | "needs_confirmation";
  stage: "idle" | "classifying" | "summarizing" | "indexing" | "compacting" | "ready";
  completed: number;
  total: number;
  error: string | null;
  processedMessageId?: string | null;
}

export interface AdvancedMemoryRecord {
  id: string;
  chatId: string;
  sceneId: string;
  kind: "scene" | "continuity" | "temporary" | "excerpt";
  status: "open" | "closed";
  startMessageId: string;
  endMessageId: string;
  /** Current 1-based transcript numbers; IDs are authoritative. */
  startIndex: number;
  endIndex: number;
  messageIds: string[];
  /** Empty means the shared, non-Individual audience. */
  audienceCharacterIds: string[];
  content: string;
  title: string;
  timeline: string | null;
  enabled: boolean;
  manualOverride: boolean;
  sourceFingerprint: string;
  dependencies: Array<{ id: string; revision: string }>;
  embeddingStatus: "vectorized" | "pending" | "stale";
  createdAt: string;
  updatedAt: string;
}

export interface AdvancedMemoryStatus {
  settings: AdvancedMemorySettings;
  job: AdvancedMemoryJob;
  missingKnowledgeCharacterIds: string[];
  effectiveKnowledgeStarts?: Record<string, string | null>;
  records: AdvancedMemoryRecord[];
  helperModel: string | null;
  summaryModel: string | null;
  warnings: string[];
  latestReceipt?: AdvancedMemoryReceipt;
}

export interface AdvancedMemoryReceipt {
  sourceEndMessageId?: string | null;
  sourceFingerprint: string;
  policyRevision: string;
  recordRevisions: Record<string, string>;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  budgetTokens: number;
  boundaryMessageId: string | null;
  checkpointId: string | null;
  recalledSceneIds: string[];
  recalledMessageIds: string[];
  reasons: string[];
}

export interface PreparedAdvancedMemory {
  messageIds: string[];
  chatSummary: string | null;
  currentSceneSummary: string | null;
  recalledScenes: string | null;
  recalledMessages: string | null;
  receipt: AdvancedMemoryReceipt;
}
