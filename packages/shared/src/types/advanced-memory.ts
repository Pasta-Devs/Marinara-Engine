import { z } from "zod";

/** Distinguishes explicit scene participants from legacy visibility-based assignments. */
export const ADVANCED_MEMORY_SCENE_AUDIENCE = { id: "scene-audience", revision: "participants-v1" } as const;
/** The helper named participants that match no character, or none in a group chat. Saving access clears it. */
export const ADVANCED_MEMORY_SCENE_AUDIENCE_UNMATCHED = "scene-audience-unmatched";
/** Fix asked the helper again and it still couldn't tell who was there, so the user decides. */
export const ADVANCED_MEMORY_SCENE_AUDIENCE_UNRESOLVED = {
  id: "scene-audience-unresolved",
  revision: "fix-v1",
} as const;

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
  /** Individual group chats only: hide each new message from characters the memory model finds absent. */
  autoMessageVisibility: z.boolean().default(false),
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
        kind: z.enum(["scene", "excerpt", "message", "scene_end", "scene_start"]),
        text: z.string().max(160),
        score: z.number().min(0).max(1).optional(),
        binary: z.boolean().optional(),
        selected: z.boolean(),
      }),
    )
    .max(128),
  /** Receipt reason codes about excerpts, such as why a recalled scene has none. Never names or message text. */
  notes: z.array(z.string().max(64)).max(8).optional(),
});
export type AdvancedMemoryDecisionDiagnostics = z.infer<typeof advancedMemoryDecisionDiagnosticsSchema>;

export interface AdvancedMemoryJob {
  id?: string;
  blocking?: boolean;
  /** Explicit user pause; ordinary interruptions and correction recovery may also be cancelled. */
  paused?: boolean;
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
  /** The last finished Fix run; kept until the next Fix or a reset. */
  fixResult?: AdvancedMemoryFixResult | null;
}

export interface AdvancedMemoryFixResult {
  /** The Fix job's `id`. */
  jobId: string;
  /** Scenes that were flagged before Fix and are healthy after it. */
  fixedSceneIds: string[];
  /** Scenes Fix left for the user: hand-edited summaries, unclear participants or failed checks. */
  reviewSceneIds: string[];
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
  /** The finished scenes this audience could recall; a swipe recalls again when they change. */
  archiveRevision?: string;
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

export interface AdvancedMemoryProblems {
  /** Scenes Fix repairs with the helper: unclear or unchecked participants, outdated or missing summaries. */
  fixSceneIds: string[];
  /** Scenes only the user can settle: hand-edited summaries that no longer match, or participants Fix couldn't decide. */
  reviewSceneIds: string[];
  /** Settings the user has to change; Fix can't. */
  blockers: Array<"needs_confirmation" | "decision-connection-unavailable">;
  /** The last memory job stopped with an error; Fix or Resume continues it. */
  stopped: boolean;
}

/**
 * Every Advanced Memory problem that needs the user's attention, from one status. Shared by the badge, the
 * notice, the Fix box and the server's Fix report. Advisories (unscoped summaries or agents) are not problems.
 */
export function advancedMemoryProblems(
  status: Pick<
    AdvancedMemoryStatus,
    "job" | "records" | "unpreparedScenes" | "warnings" | "missingKnowledgeCharacterIds"
  >,
): AdvancedMemoryProblems {
  const fix = new Set<string>();
  const review = new Set<string>();
  const has = (record: AdvancedMemoryRecord, id: string) => record.dependencies.some((item) => item.id === id);
  for (const record of status.records) {
    // Excluded and deleted summaries are the user's choice, not problems.
    if (record.kind !== "scene" || record.id === record.sceneId || !record.content || !record.enabled) continue;
    if (record.manualOverride) {
      if (record.embeddingStatus === "stale" || record.id === status.job.reviewRecordId) review.add(record.sceneId);
    } else if (
      has(record, ADVANCED_MEMORY_SCENE_AUDIENCE_UNMATCHED) &&
      has(record, ADVANCED_MEMORY_SCENE_AUDIENCE_UNRESOLVED.id)
    )
      review.add(record.sceneId);
    else if (
      has(record, ADVANCED_MEMORY_SCENE_AUDIENCE_UNMATCHED) ||
      !record.dependencies.some(
        (item) =>
          item.id === ADVANCED_MEMORY_SCENE_AUDIENCE.id && item.revision === ADVANCED_MEMORY_SCENE_AUDIENCE.revision,
      ) ||
      record.embeddingStatus === "stale"
    )
      fix.add(record.sceneId);
  }
  for (const scene of status.unpreparedScenes ?? []) {
    if (scene.deleted) continue;
    const manual = status.records.some(
      (record) => record.kind === "scene" && record.sceneId === scene.sceneId && record.manualOverride,
    );
    (manual ? review : fix).add(scene.sceneId);
  }
  for (const id of review) fix.delete(id);
  const blockers: AdvancedMemoryProblems["blockers"] = [];
  if (status.job.status === "needs_confirmation" || status.missingKnowledgeCharacterIds.length)
    blockers.push("needs_confirmation");
  if (status.warnings.includes("decision-connection-unavailable")) blockers.push("decision-connection-unavailable");
  return { fixSceneIds: [...fix], reviewSceneIds: [...review], blockers, stopped: status.job.status === "error" };
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
