// ──────────────────────────────────────────────
// Connection Account Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { apiProviderSchema, connectionIconSchema, connectionModelIdSchema } from "./connection.schema.js";
import type { ConnectionBilling } from "../constants/model-lists.js";

// One account may hold BOTH chat and image/media Models sharing one key (concept decision 20),
// so `provider` is the credential vendor/service and nothing here assumes a single Model type.
const accountFields = {
  baseUrl: z.string().url().or(z.literal("")).default(""),
  apiKey: z.string().default(""),
  managementToken: z.string().default(""),
  showUsageWidget: z.boolean().default(false),
  showUsageFiveHour: z.boolean().default(true),
  showUsageWeekly: z.boolean().default(true),
  treatAsLocalEndpoint: z.boolean().default(false),
  enabled: z.boolean().default(true),
  maxRequestsPerMinute: z.number().int().min(1).max(600).nullable().default(null),
  maxParallelJobs: z.number().int().min(1).max(16).nullable().default(null),
  /** Picture choice; any change clears the uploaded image (upload goes through `POST /:id/image`). */
  icon: connectionIconSchema.default(null),
};

export const createConnectionAccountSchema = z.object({
  name: z.string().min(1).max(200),
  provider: apiProviderSchema,
  ...accountFields,
});

/** `provider` is immutable after create, so it is not part of the update shape. */
export const updateConnectionAccountSchema = z.object({ name: z.string().min(1).max(200), ...accountFields }).partial();

export type CreateConnectionAccountInput = z.infer<typeof createConnectionAccountSchema>;
export type UpdateConnectionAccountInput = z.infer<typeof updateConnectionAccountSchema>;

export type ConnectionAccountState = "ok" | "off" | "needs_key";

/** Account as the list endpoint returns it: secrets masked. */
export interface ConnectionAccountListItem {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyLast4: string;
  hasManagementToken: boolean;
  showUsageWidget: boolean;
  showUsageFiveHour: boolean;
  showUsageWeekly: boolean;
  treatAsLocalEndpoint: boolean;
  enabled: boolean;
  maxRequestsPerMinute: number | null;
  maxParallelJobs: number | null;
  /** Picture: `icon` (brand/letters) or an uploaded `imagePath`; both null = the service logo. */
  icon: string | null;
  imagePath: string | null;
  /** "plan" for plan services (Arli, subscriptions), "free" for Horde/Pollinations, else null. */
  billing: ConnectionBilling;
  profileImportReviewRequired: boolean;
  modelCount: number;
  state: ConnectionAccountState;
  createdAt: string;
  updatedAt: string;
}

/**
 * A chat's model choice. Without `model`: the saved Model `connectionId` as it is. With `model`: a catalog model
 * run on that Model's Connection for this chat only (maintainer decision 25). No row is created; the chat keeps
 * the catalog limits, and every other setting is the neutral default.
 */
export const chatModelChoiceSchema = z.object({
  connectionId: z.string().trim().min(1).max(200),
  model: connectionModelIdSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  maxContext: z.number().int().min(1).optional(),
  maxTokensOverride: z.number().int().min(1).optional(),
});
export type ChatModelChoice = z.infer<typeof chatModelChoiceSchema>;

/** The body of a chat's model pick: a choice, or `connectionId: null` to drop the chat's own pick and follow Main. */
export const chatModelPickSchema = z.union([chatModelChoiceSchema, z.object({ connectionId: z.null() }).strict()]);
export type ChatModelPick = z.infer<typeof chatModelPickSchema>;

/** Chat metadata keys: the current per-chat catalog pick, and the chat's last two choices (newest first). */
export const CHAT_MODEL_OVERRIDE_KEY = "modelOverride";
export const CHAT_RECENT_MODELS_KEY = "recentModels";
export const CHAT_RECENT_MODELS_LIMIT = 2;
/** Set when the user chose "Use default": the chat has no Model of its own and answers through Main, silently. */
export const CHAT_FOLLOWS_MAIN_KEY = "followsMainModel";

export type ChatModelOverride = ChatModelChoice & { model: string };

function chatMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object") return metadata as Record<string, unknown>;
  if (typeof metadata !== "string" || !metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The chat's catalog pick, only while it still belongs to the chat's Model: any other way of setting the chat's
 * Model (Chat Settings before decision 26, a preset, an import that changed the id) leaves a stale pick that is
 * ignored.
 */
export function readChatModelOverride(chat: {
  connectionId?: string | null;
  metadata?: unknown;
}): ChatModelOverride | null {
  const parsed = chatModelChoiceSchema.safeParse(chatMetadataRecord(chat.metadata)[CHAT_MODEL_OVERRIDE_KEY]);
  if (!parsed.success || !parsed.data.model || parsed.data.connectionId !== chat.connectionId) return null;
  return parsed.data as ChatModelOverride;
}

/** The chat's last choices, newest first; malformed entries are dropped. */
export function readChatRecentModels(chat: { metadata?: unknown }): ChatModelChoice[] {
  const stored = chatMetadataRecord(chat.metadata)[CHAT_RECENT_MODELS_KEY];
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry) => {
    const parsed = chatModelChoiceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The chat follows the Main default by choice (decision 27), not because its Model was deleted. */
export function readChatFollowsMain(chat: { connectionId?: string | null; metadata?: unknown }): boolean {
  return !chat.connectionId && chatMetadataRecord(chat.metadata)[CHAT_FOLLOWS_MAIN_KEY] === true;
}

/**
 * An automatic Connection name with the key's last 4 ("OpenAI · …a1b2"), for when another Connection of the same
 * provider exists (decision 28). Short keys would be mostly revealed, so they add nothing.
 */
export function withKeyTail(label: string, apiKey: string | null | undefined): string {
  const key = apiKey?.trim() ?? "";
  return key.length >= 8 ? `${label} · …${key.slice(-4)}` : label;
}
