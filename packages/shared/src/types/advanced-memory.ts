import { z } from "zod";

/** Distinguishes explicit scene participants from legacy visibility-based assignments. */
export const ADVANCED_MEMORY_SCENE_AUDIENCE = { id: "scene-audience", revision: "participants-v1" } as const;

export const advancedMemorySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxContextTokens: z.number().int().min(1024).max(10_000_000).default(65_000),
  summaryBudgetTokens: z.number().int().min(64).max(131_072).default(4096),
  helperConnectionId: z.string().nullable().default(null),
  decisionEnabled: z.boolean().default(false),
  decisionConnectionId: z.string().nullable().default(null),
  initialProcessingModel: z.enum(["main", "helper"]).default("helper"),
  /** Cadence and recent-message window for standalone post-generation scene checks. */
  sceneCheckInterval: z.number().int().min(1).max(100).default(5),
  retrieveMaxScenes: z.number().int().min(0).max(50).default(3),
  retrieveMinMessages: z.number().int().min(0).max(50).default(3),
  retrieveMaxMessages: z.number().int().min(0).max(50).default(10),
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

/** Compact, saved evidence from actual memory decisions, never a new preview call. */
export const advancedMemoryDecisionDiagnosticsSchema = z.object({
  createdAt: z.string(),
  model: z.string().nullable(),
  sourceEndMessageId: z.string().nullable(),
  fallback: z.boolean(),
  threshold: z.number().min(0).max(1),
  omittedCount: z.number().int().nonnegative(),
  results: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["scene", "excerpt", "message", "scene_end"]),
        text: z.string().max(160),
        score: z.number().min(0).max(1).optional(),
        binary: z.boolean().optional(),
        selected: z.boolean(),
      }),
    )
    .max(128),
});
export type AdvancedMemoryDecisionDiagnostics = z.infer<typeof advancedMemoryDecisionDiagnosticsSchema>;

export interface AdvancedMemoryJob {
  id?: string;
  blocking?: boolean;
  status: "idle" | "running" | "ready" | "cancelled" | "error" | "needs_confirmation";
  stage: "idle" | "classifying" | "summarizing" | "indexing" | "compacting" | "ready";
  completed: number;
  total: number;
  error: string | null;
  reviewRecordId?: string | null;
  processedMessageId?: string | null;
  decisionSceneCheck?: AdvancedMemoryDecisionDiagnostics;
  /** Invalidates cached prompts when a user removes an automatic context flag. */
  contextStartRevision?: number;
  /** Shared automatic scene reset, controlled by the existing New Start flag UI. */
  contextStarts?: Array<{
    messageId: string;
    audienceCharacterIds: string[];
    /** Keep this scene boundary until the live window reaches its budget again. */
    sceneStartMessageId?: string | null;
    /** A changed manual flag replaces the automatic window. */
    manualStartMessageId?: string | null;
  }>;
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
  /** Scene/excerpt access: empty means narrator only, never all characters. */
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
  unpreparedScenes?: Array<{
    sceneId: string;
    startIndex: number;
    endIndex: number;
    /** Regeneration is available only through an explicit single-scene request. */
    deleted?: boolean;
  }>;
  latestReceipt?: AdvancedMemoryReceipt;
}

export interface AdvancedMemoryReceipt {
  decisionRecall?: AdvancedMemoryDecisionDiagnostics;
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
  /** Persisted IDs used only by optional recall; constant-summary dependencies remain when recall is omitted. */
  recalledRecordIds: string[];
  receipt: AdvancedMemoryReceipt;
}
