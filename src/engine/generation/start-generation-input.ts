import { z } from "zod";
import type { AgentContext } from "../contracts/types/agent";
import { GENERATION_GUIDE_SOURCES, type GenerationGuideSource } from "../shared/text/generation-guide";
import type { PromptAttachment } from "./generate-route-utils";
import type { JsonRecord } from "./runtime-records";

export interface AgentInjectionOverride {
  agentType: string;
  agentName?: string;
  text: string;
}

export interface StartGenerationInput extends JsonRecord {
  chatId: string;
  connectionId?: string | null;
  message?: string;
  userMessage?: string | null;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  parameters?: Record<string, unknown>;
  promptPresetId?: string | null;
  generationGuide?: string | null;
  generationGuideSource?: GenerationGuideSource | null;
  regenerateMessageId?: string | null;
  impersonate?: boolean;
  impersonateBlockAgents?: boolean;
  impersonatePresetId?: string | null;
  impersonateConnectionId?: string | null;
  impersonatePromptTemplate?: string | null;
  forCharacterId?: string | null;
  mentionedCharacterNames?: string[];
  attachments?: PromptAttachment[];
  /**
   * IANA timezone resolved on the client (e.g. via
   * `Intl.DateTimeFormat().resolvedOptions().timeZone`). When set, prompt-time
   * macros like {{date}} and {{time}} resolve in this zone instead of UTC.
   * A persisted per-chat `metadata.promptTimeZone` takes precedence.
   */
  userTimeZone?: string;
  userStatus?: "active" | "idle" | "dnd";
  userActivity?: string;
  streaming?: boolean;
  trimIncompleteModelOutput?: boolean;
  imagePromptSettings?: {
    includeAppearances?: boolean;
    format?: "descriptive" | "tags";
  };
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
  hideAutomatedSummarySourceMessages?: boolean;
  agentInjectionOverrides?: AgentInjectionOverride[];
  historyLimit?: number | string | null;
  options?: Record<string, unknown> | null;
}

const optionalRecordSchema = z.preprocess(
  (value) => (value == null ? undefined : value),
  z.record(z.unknown()).default({}),
);

const optionalStringArraySchema = z.preprocess(
  (value) => (value == null ? undefined : value),
  z.array(z.string()).default([]),
);

const optionalAttachmentArraySchema = z.preprocess(
  (value) => (value == null ? undefined : value),
  z.array(z.record(z.unknown())).default([]),
);

const optionalMessagesSchema = z.preprocess(
  (value) => (value == null ? undefined : value),
  z
    .array(
      z
        .object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
        .passthrough(),
    )
    .optional(),
);

const optionalAgentInjectionOverridesSchema = z.preprocess(
  (value) => (value == null ? undefined : value),
  z
    .array(
      z
        .object({
          agentType: z.string().min(1).max(100),
          agentName: z.string().min(1).max(200).optional(),
          text: z.string().max(50_000),
        })
        .passthrough(),
    )
    .default([]),
);

const optionalImagePromptSettingsSchema = z
  .object({
    includeAppearances: z.boolean().optional(),
    format: z.enum(["descriptive", "tags"]).optional(),
  })
  .passthrough()
  .optional();

const optionalNullableStringSchema = z.preprocess(
  (value) => (value === undefined ? null : value),
  z.string().nullable(),
);

const startGenerationInputSchema = z
  .object({
    chatId: z.string(),
    connectionId: optionalNullableStringSchema,
    message: z.preprocess((value) => (value == null ? undefined : value), z.string().optional()),
    userMessage: optionalNullableStringSchema,
    messages: optionalMessagesSchema,
    parameters: optionalRecordSchema,
    promptPresetId: optionalNullableStringSchema,
    generationGuide: optionalNullableStringSchema,
    generationGuideSource: z.enum(GENERATION_GUIDE_SOURCES).nullable().optional().default(null),
    regenerateMessageId: optionalNullableStringSchema,
    impersonate: z.boolean().optional().default(false),
    impersonateBlockAgents: z.boolean().optional().default(false),
    impersonatePresetId: optionalNullableStringSchema,
    impersonateConnectionId: optionalNullableStringSchema,
    impersonatePromptTemplate: optionalNullableStringSchema,
    forCharacterId: optionalNullableStringSchema,
    mentionedCharacterNames: optionalStringArraySchema,
    attachments: optionalAttachmentArraySchema,
    userTimeZone: z.string().max(128).optional(),
    userStatus: z.enum(["active", "idle", "dnd"]).optional().default("active"),
    userActivity: z.string().max(120).optional().default(""),
    streaming: z.boolean().optional().default(true),
    trimIncompleteModelOutput: z.boolean().optional().default(false),
    imagePromptSettings: optionalImagePromptSettingsSchema,
    debugMode: z.boolean().optional().default(false),
    hideAutomatedSummarySourceMessages: z.boolean().optional().default(false),
    agentInjectionOverrides: optionalAgentInjectionOverridesSchema,
    historyLimit: z.union([z.number(), z.string()]).nullable().optional(),
    options: z.preprocess((value) => (value == null ? undefined : value), z.record(z.unknown()).optional()),
  })
  .passthrough();

function requestIssueText(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "request";
  return `${path}: ${issue.message}`;
}

export function normalizeStartGenerationInput(input: unknown): StartGenerationInput {
  const parsed = startGenerationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid generation request: ${parsed.error.issues.map(requestIssueText).join("; ")}`);
  }
  return parsed.data as StartGenerationInput;
}
