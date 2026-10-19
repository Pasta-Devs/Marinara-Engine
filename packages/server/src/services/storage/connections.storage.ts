// ──────────────────────────────────────────────
// Storage: API Connections
// ──────────────────────────────────────────────
import { eq, desc, and, ne } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { apiConnections, chats, connectionAccounts } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { encryptApiKey, decryptApiKey } from "../../utils/crypto.js";
import {
  MAX_PINNED_MODELS,
  connectionBilling,
  CHAT_MODEL_OVERRIDE_KEY,
  CHAT_RECENT_MODELS_KEY,
  GENERATION_PARAMETER_KEYS,
  isChatProvider,
  isLocalAuthProvider,
  parsePinnedModels,
  rankModelMoveCandidates,
  relevantGenerationParameters,
  supportsSubscriptionUsageWidget,
  type CreateConnectionInput,
  type GenerationParameterContext,
  type GenerationParameterKey,
  type ModelParameterCapabilities,
} from "@marinara-engine/shared";
import { sweepDanglingConnectionReferences } from "./connection-reference-cleanup.js";
import {
  ACCOUNT_MIRRORED_INPUT_KEYS,
  accountBlocksRows,
  credentialOrigin,
  credentialVendor,
  sameEndpoint,
  getConnectionAccount,
  hasForeignEmbeddingHost,
  isBlockedByAccount,
  linkConnectionAccounts,
  mirrorToAccountPeers,
  syncAccountBudget,
  withoutBlockedRows,
  type ConnectionAccountRow,
  type ConnectionRow,
} from "./connection-accounts.storage.js";
import { clearConnectionRateLimit, setConnectionRateLimit } from "../llm/connection-rate-limit-registry.js";
import { logger } from "../../lib/logger.js";

type ConnectionDefaultCategory = "image_generation" | "video_generation" | "audio" | "decision" | "language";

/**
 * Decrypt a stored connection for internal use and keep the per-connection outbound throttle
 * registry in sync. Every provider-building read goes through here, so the registry is refreshed
 * exactly when a connection is about to be used.
 */
function withDecryptedKey<T extends { id: string; apiKeyEncrypted: string; maxRequestsPerMinute?: number | null }>(
  row: T,
): T & { apiKey: string } {
  setConnectionRateLimit(row.id, row.maxRequestsPerMinute ?? null);
  return { ...row, apiKey: decryptApiKey(row.apiKeyEncrypted) };
}

function definedFields<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function defaultCategoryForProvider(provider: string): ConnectionDefaultCategory {
  if (provider === "image_generation") return "image_generation";
  if (provider === "video_generation") return "video_generation";
  if (provider === "audio") return "audio";
  if (provider === "decision") return "decision";
  return "language";
}

/** Decision connections never become the main connection, a random pick or an agent fallback. */
function takesChatDefaults(provider: string): boolean {
  return provider !== "decision";
}

/** One model in a saved provider list: display and limit fields only, never credentials. */
export type SavedConnectionModel = { id: string; name: string } & Record<string, unknown>;
export type SavedConnectionModelList = { fetchedAt: string; models: SavedConnectionModel[] };

/** The only fields kept from a provider's model entry when its list is saved. */
const SAVED_MODEL_EXTRA_FIELDS = [
  "context",
  "maxOutput",
  "capabilities",
  "subscriptionIncluded",
  "inputTokenMultiplier",
  "pricing",
  "inputModalities",
  "outputModalities",
  "free",
  "deprecated",
  "retiresAt",
] as const;

/** The fields that decide which list a provider returns; when one changes, the saved list is stale. */
const MODEL_LIST_SOURCE_FIELDS = ["provider", "baseUrl", "apiKeyEncrypted"] as const;

/** Whether a connection keeps its fetched model list. Claude (Subscription) answers from a built-in list. */
export function connectionSavesModelList(provider: string): boolean {
  return defaultCategoryForProvider(provider) === "language" && provider !== "claude_subscription";
}

/** Keep the known model fields, drop entries without an ID, and keep the first of any duplicate IDs. */
function toSavedModels(models: readonly unknown[]): SavedConnectionModel[] {
  const seen = new Set<string>();
  const saved: SavedConnectionModel[] = [];
  for (const entry of models) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const model: SavedConnectionModel = {
      id,
      name: typeof record.name === "string" && record.name.trim() ? record.name : id,
    };
    for (const key of SAVED_MODEL_EXTRA_FIELDS) if (record[key] !== undefined) model[key] = record[key];
    saved.push(model);
  }
  return saved;
}

function toSavedModelList(value: unknown): SavedConnectionModelList | null {
  const parsed = value && typeof value === "object" ? (value as { fetchedAt?: unknown; models?: unknown }) : null;
  if (typeof parsed?.fetchedAt !== "string" || !Array.isArray(parsed.models)) return null;
  return { fetchedAt: parsed.fetchedAt, models: toSavedModels(parsed.models) };
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read a row's own saved model list, or null when there is none or it is malformed. */
export function readSavedModelList(row: { savedModels?: unknown } | null | undefined): SavedConnectionModelList | null {
  return toSavedModelList(parseJson(row?.savedModels));
}

/** A Connection's catalogs by row provider; malformed entries are dropped. */
export function readAccountCatalogs(
  account: { modelCatalogs?: unknown } | null | undefined,
): Record<string, SavedConnectionModelList> {
  const all = parseJson(account?.modelCatalogs);
  const catalogs: Record<string, SavedConnectionModelList> = {};
  if (!all || typeof all !== "object" || Array.isArray(all)) return catalogs;
  for (const [provider, value] of Object.entries(all)) {
    const list = toSavedModelList(value);
    if (list) catalogs[provider] = list;
  }
  return catalogs;
}

/** The Connection's catalogs JSON with one provider's catalog set (or removed with null). */
export function withAccountCatalog(
  account: { modelCatalogs?: unknown },
  provider: string,
  list: SavedConnectionModelList | null,
): string | null {
  const catalogs = readAccountCatalogs(account);
  if (list) catalogs[provider] = list;
  else delete catalogs[provider];
  return Object.keys(catalogs).length ? JSON.stringify(catalogs) : null;
}

/**
 * The catalog a Model reads: its Connection's catalog for the Model's provider (one copy for all linked Models),
 * else its own saved list (a standalone Model, or one whose list was not moved yet).
 */
export function catalogOf(
  row: { accountId?: string | null; provider: string; savedModels?: unknown },
  account: { id: string; modelCatalogs?: unknown } | null | undefined,
): SavedConnectionModelList | null {
  const shared = row.accountId && account?.id === row.accountId ? readAccountCatalogs(account)[row.provider] : null;
  return shared ?? readSavedModelList(row);
}

/** What a Model takes from the Connection it moves to: the key, the usage settings and the review state. */
function takenFromAccount(account: ConnectionAccountRow, provider: string): Partial<ConnectionRow> {
  return {
    accountId: account.id,
    apiKeyEncrypted: account.apiKeyEncrypted,
    managementTokenEncrypted: provider === "nanogpt" ? account.managementTokenEncrypted : "",
    showUsageWidget: String(supportsSubscriptionUsageWidget(provider) && account.showUsageWidget === "true"),
    showUsageFiveHour: account.showUsageFiveHour,
    showUsageWeekly: account.showUsageWeekly,
    treatAsLocalEndpoint: account.treatAsLocalEndpoint,
    profileImportReviewRequired: account.profileImportReviewRequired,
  };
}

/** The account row has no media source, so a media account's vendor comes from its oldest linked row. */
function representativeOf(linked: ConnectionRow[]): ConnectionRow | undefined {
  return [...linked].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}

/**
 * How a Model may move to a Connection: within its service and endpoint ("same"), to a chat Connection of another
 * service or endpoint ("cross", a new model id is needed), or not at all. A Model that borrows another row's key or
 * sends its key to a second host never moves; media, decision and local-login Models never change service.
 */
function moveKind(row: ConnectionRow, account: ConnectionAccountRow, linked: ConnectionRow[]): MoveKind {
  if (row.accountId === account.id || row.credentialsFromConnectionId || hasForeignEmbeddingHost(row)) {
    return "mismatch";
  }
  if (
    credentialVendor(row) === credentialVendor(representativeOf(linked) ?? account) &&
    credentialOrigin(row) === credentialOrigin(account)
  ) {
    return "same";
  }
  const portable = (provider: string) => isChatProvider(provider) && !isLocalAuthProvider(provider);
  return portable(row.provider) && portable(account.provider) ? "cross" : "mismatch";
}

export type MoveKind = "same" | "cross" | "mismatch";

/** Default parameters without the settings the target provider and model never send. */
function clampDefaultParameters(raw: string | null, context: GenerationParameterContext): string | null {
  const params = parseJson(raw);
  if (!params || typeof params !== "object" || Array.isArray(params)) return raw;
  const relevant = relevantGenerationParameters(context);
  const kept = Object.fromEntries(
    Object.entries(params).filter(
      ([key]) =>
        !(GENERATION_PARAMETER_KEYS as readonly string[]).includes(key) || relevant.has(key as GenerationParameterKey),
    ),
  );
  return JSON.stringify(kept);
}

/** The cross-service branch of `moveToAccount`, inside its transaction (the shared checks already passed). */
async function moveAcrossServices(
  tx: DB,
  row: ConnectionRow,
  account: ConnectionAccountRow,
  linked: ConnectionRow[],
  model: string | undefined,
): Promise<"model_required" | "model_not_offered" | null> {
  const provider = account.provider as ConnectionRow["provider"];
  if (!model) return "model_required";
  const peers = linked.filter((candidate) => candidate.provider === provider);
  const peer = [...peers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const catalog = readAccountCatalogs(account)[provider]?.models ?? [];
  const entry = catalog.find((saved) => saved.id === model);
  // Custom endpoints often have no model list, so they take any id; every other service runs what it offers.
  if (!entry && provider !== "custom") return "model_not_offered";
  // The star follows the model: the old id means nothing on the new service.
  const pins = peer ? parsePinnedModels(peer.pinnedModels) : [];
  if (
    parsePinnedModels(row.pinnedModels).includes(row.model) &&
    !pins.includes(model) &&
    pins.length < MAX_PINNED_MODELS
  ) {
    pins.push(model);
  }
  const pinnedModels = JSON.stringify(pins);
  const context = typeof entry?.context === "number" && entry.context >= 1 ? entry.context : null;
  const maxOutput = typeof entry?.maxOutput === "number" && entry.maxOutput >= 1 ? entry.maxOutput : null;
  const capabilities =
    entry?.capabilities && typeof entry.capabilities === "object"
      ? (entry.capabilities as ModelParameterCapabilities)
      : null;
  await tx
    .update(apiConnections)
    .set({
      ...takenFromAccount(account, provider),
      provider,
      baseUrl: account.baseUrl,
      model,
      // An automatic name (the old id) becomes the new model's name; a typed name stays.
      name: row.name.trim() === row.model ? (entry?.name ?? model) : row.name,
      ...(context ? { maxContext: context } : {}),
      ...(maxOutput && row.maxTokensOverride && row.maxTokensOverride > maxOutput
        ? { maxTokensOverride: maxOutput }
        : {}),
      defaultParameters: clampDefaultParameters(row.defaultParameters, {
        provider,
        model,
        baseUrl: account.baseUrl,
        capabilities,
      }),
      savedModels: null,
      pinnedModels,
      // Service-only settings: OpenRouter routing, Anthropic flags, the old host's embeddings, media fields.
      openrouterProvider: null,
      ...(provider === "anthropic" ? {} : { claudeFastMode: "false", anthropicExtendedCacheTtl: "false" }),
      embeddingModel: null,
      embeddingBaseUrl: null,
      comfyuiWorkflow: null,
      imageGenerationSource: null,
      imageService: null,
      imageEndpointId: null,
      videoGenerationSource: null,
      videoService: null,
      audioSource: null,
      decisionSource: null,
      updatedAt: now(),
    })
    .where(eq(apiConnections.id, row.id));
  // Stars are shared by the Connection's Models of one provider.
  if (peer && pinnedModels !== peer.pinnedModels) {
    await mirrorToAccountPeers(tx, { id: row.id, accountId: account.id, provider }, { pinnedModels });
  }
  const picks = await retargetChatPicks(tx, row.id, row.model, model, catalog);
  if (picks.rewritten || picks.cleared) {
    logger.info(
      "[connections] Moved Model %s to another service: %d chat pick(s) rewritten, %d cleared",
      row.id,
      picks.rewritten,
      picks.cleared,
    );
  }
  return null;
}

/**
 * A chat's catalog pick on a Model that changed service (its pick and its recent list). The old model becomes the
 * new one; another old-catalog model is kept only when the target offers the same id (exact or without the gateway
 * path, never a variant); else the pick is cleared and the chat runs the Model's new model. Agents and feature picks
 * store only the Model id, so they need nothing.
 */
function retargetPick(
  choice: unknown,
  rowId: string,
  oldModel: string,
  newModel: string,
  catalog: readonly SavedConnectionModel[],
): { choice: unknown; change: "rewritten" | "cleared" | null } {
  const pick = choice && typeof choice === "object" ? (choice as Record<string, unknown>) : null;
  if (!pick || pick.connectionId !== rowId || typeof pick.model !== "string" || !pick.model) {
    return { choice, change: null };
  }
  const target =
    pick.model === oldModel
      ? newModel
      : rankModelMoveCandidates(pick.model, catalog).find((hit) => !hit.variant && hit.match !== "catalog")?.model.id;
  if (!target) return { choice: null, change: "cleared" };
  // The old catalog's limits do not apply to the new model; the target catalog's do.
  const entry = catalog.find((saved) => saved.id === target);
  return {
    choice: {
      connectionId: rowId,
      model: target,
      ...(entry?.name ? { name: entry.name } : {}),
      ...(typeof entry?.context === "number" && entry.context >= 1 ? { maxContext: entry.context } : {}),
    },
    change: "rewritten",
  };
}

// ponytail: reads every chat once per cross-service move (rare, user-started); batch like the reference sweep if
// profiles with very many chats make the move slow.
async function retargetChatPicks(
  tx: DB,
  rowId: string,
  oldModel: string,
  newModel: string,
  catalog: readonly SavedConnectionModel[],
): Promise<{ rewritten: number; cleared: number }> {
  const counts = { rewritten: 0, cleared: 0 };
  for (const chat of await tx.select().from(chats)) {
    const raw = chat.metadata;
    if (typeof raw !== "string" || !raw.includes(JSON.stringify(rowId))) continue;
    const metadata = parseJson(raw);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
    const record = metadata as Record<string, unknown>;
    let changed = false;
    const count = (change: "rewritten" | "cleared" | null) => {
      if (change) counts[change] += 1;
      changed ||= !!change;
    };
    if (CHAT_MODEL_OVERRIDE_KEY in record) {
      const next = retargetPick(record[CHAT_MODEL_OVERRIDE_KEY], rowId, oldModel, newModel, catalog);
      count(next.change);
      record[CHAT_MODEL_OVERRIDE_KEY] = next.choice;
    }
    if (Array.isArray(record[CHAT_RECENT_MODELS_KEY])) {
      record[CHAT_RECENT_MODELS_KEY] = (record[CHAT_RECENT_MODELS_KEY] as unknown[]).flatMap((entry) => {
        const next = retargetPick(entry, rowId, oldModel, newModel, catalog);
        count(next.change);
        // A cleared recent entry becomes the Model itself.
        return [next.change === "cleared" ? { connectionId: rowId } : next.choice];
      });
    }
    if (changed) {
      await tx
        .update(chats)
        .set({ metadata: JSON.stringify(record), updatedAt: now() })
        .where(eq(chats.id, chat.id));
    }
  }
  return counts;
}

/** API responses never carry the saved model list; `/connections/:id/models` serves it. */
/**
 * Whether a saved Model has settings of its own (decision 30): a name, tuning or limits the user set. Such a Model
 * stays in "Your models" without its star; a Model with only catalog values goes when its star is removed.
 */
export function hasOwnModelSettings(
  row: Record<string, unknown>,
  catalog: SavedConnectionModelList | null = readSavedModelList(row),
): boolean {
  const model = typeof row.model === "string" ? row.model : "";
  const entry = catalog?.models.find((saved) => saved.id === model);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name && name !== model && name !== entry?.name) return true;
  const set = (value: unknown) => value !== null && value !== undefined && value !== "";
  const on = (value: unknown) => value === true || value === "true";
  const params = typeof row.defaultParameters === "string" ? row.defaultParameters.trim() : row.defaultParameters;
  if (set(params) && params !== "{}" && params !== "null") return true;
  if ([row.promptPresetId, row.openrouterProvider, row.maxStateTokens, row.maxRequestsPerMinute].some(set)) return true;
  if ([row.imagePath, row.icon, row.embeddingModel, row.embeddingConnectionId].some(set)) return true;
  if (on(row.enableCaching) || on(row.claudeFastMode)) return true;
  if (typeof row.maxParallelJobs === "number" && row.maxParallelJobs !== 1) return true;
  // Limits count only where the catalog tells what the model's own limit is.
  if (typeof entry?.context === "number" && row.maxContext !== entry.context) return true;
  if (typeof entry?.maxOutput === "number" && set(row.maxTokensOverride) && row.maxTokensOverride !== entry.maxOutput) {
    return true;
  }
  return false;
}

export function withoutSavedModels<T extends Record<string, unknown>>(row: T): Omit<T, "savedModels"> {
  const { savedModels: _savedModels, ...rest } = row;
  return rest;
}

export function createConnectionsStorage(db: DB) {
  /** Decrypt for use, and keep the throttle and shared-account budget registries in sync with the row. */
  const withKey = async <
    T extends { id: string; apiKeyEncrypted: string; accountId?: string | null; maxRequestsPerMinute?: number | null },
  >(
    row: T,
  ) => {
    await syncAccountBudget(db, row);
    return withDecryptedKey(row);
  };

  return {
    async list() {
      const rows = await db.select().from(apiConnections).orderBy(desc(apiConnections.updatedAt));
      const accounts = new Map(
        ((await db.select().from(connectionAccounts)) as ConnectionAccountRow[]).map((account) => [
          account.id,
          account,
        ]),
      );
      // Mask API keys and management tokens in list response
      return rows.map(({ savedModels: _savedModels, ...r }: any) => ({
        ...r,
        ownSettings: hasOwnModelSettings(r, catalogOf({ ...r, savedModels: _savedModels }, accounts.get(r.accountId))),
        billing: connectionBilling(r),
        apiKeyEncrypted: r.apiKeyEncrypted ? "••••••••" : "",
        managementTokenEncrypted: r.managementTokenEncrypted ? "••••••••" : "",
      }));
    },

    /** The catalog this Model reads (its Connection's, else its own). */
    async readCatalog(row: ConnectionRow): Promise<SavedConnectionModelList | null> {
      return catalogOf(row, row.accountId ? await getConnectionAccount(db, row.accountId) : null);
    },

    async getById(id: string) {
      const rows = await db.select().from(apiConnections).where(eq(apiConnections.id, id));
      return rows[0] ?? null;
    },

    /** Get connection with decrypted API key (for internal use only). */
    async getWithKey(id: string) {
      const conn = await this.getById(id);
      if (!conn || conn.profileImportReviewRequired === "true" || (await isBlockedByAccount(db, conn))) return null;
      return withKey(conn);
    },

    /** Why `getWithKey` returns null for this id: the Model is gone, under review, or its Connection blocks it. */
    async unavailableReason(id: string): Promise<{
      reason: "deleted" | "review" | "off" | "needs_key";
      row: ConnectionRow | null;
    } | null> {
      const row = (await this.getById(id)) as ConnectionRow | null;
      if (!row) return { reason: "deleted", row: null };
      if (row.profileImportReviewRequired === "true") return { reason: "review", row };
      const account = row.accountId ? await getConnectionAccount(db, row.accountId) : null;
      if (!account || !accountBlocksRows(account)) return null;
      if (account.enabled === "false") return { reason: "off", row };
      return { reason: account.profileImportReviewRequired === "true" ? "review" : "needs_key", row };
    },

    /**
     * Read only the decrypted NanoGPT management token for the usage widget.
     * Deliberately separate from `withDecryptedKey` so the token never rides
     * along on ordinary provider-building reads.
     */
    async getManagementToken(id: string) {
      const conn = await this.getById(id);
      if (!conn || conn.profileImportReviewRequired === "true" || (await isBlockedByAccount(db, conn))) return null;
      if (conn.provider !== "nanogpt") return null;
      const token = decryptApiKey(conn.managementTokenEncrypted ?? "");
      return token ? token : null;
    },

    async getDefault() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.isDefault, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      return (await withoutBlockedRows(db, rows))[0] ?? null;
    },

    /** Get the language connection used after a main generation failure. */
    async getFallbackForMain() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.fallbackForMain, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      const row = (await withoutBlockedRows(db, rows)).find(
        (candidate) => defaultCategoryForProvider(candidate.provider) === "language",
      );
      if (!row) return null;
      return withKey(row);
    },

    /** Get the connection marked as default for agents (with decrypted key). */
    async getDefaultForAgents() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(eq(apiConnections.defaultForAgents, "true"), ne(apiConnections.profileImportReviewRequired, "true")),
        );
      const row = (await withoutBlockedRows(db, rows)).find(
        (candidate) => defaultCategoryForProvider(candidate.provider) === "language",
      );
      if (!row) return null;
      return withKey(row);
    },

    /** Get the language connection used after an agent generation failure. */
    async getFallbackForAgents() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(eq(apiConnections.fallbackForAgents, "true"), ne(apiConnections.profileImportReviewRequired, "true")),
        );
      const row = (await withoutBlockedRows(db, rows)).find(
        (candidate) => defaultCategoryForProvider(candidate.provider) === "language",
      );
      if (!row) return null;
      return withKey(row);
    },

    /** Get the image-generation connection selected under Defaults → Images (with decrypted key). */
    async getDefaultForImageGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "image_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Get the image-generation connection used after an image generation failure. */
    async getFallbackForImageGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "image_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Get the video-generation connection marked as default for scene videos (with decrypted key). */
    async getDefaultForVideoGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "video_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Get the video-generation connection used after a video generation failure. */
    async getFallbackForVideoGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "video_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Get the audio connection marked as default (with decrypted key). */
    async getDefaultForAudio() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "audio"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Get the audio connection used when the preferred one fails or is gone. */
    async getFallbackForAudio() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "audio"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0] ?? null;
      if (!row) return null;
      return withKey(row);
    },

    /** Decision defaults are independent of chat, agent, and media defaults. */
    async getDefaultForDecision() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "decision"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = (await withoutBlockedRows(db, rows))[0];
      return row ? withKey(row) : null;
    },

    async create(input: CreateConnectionInput) {
      const id = newId();
      const timestamp = now();
      const providerCategory = defaultCategoryForProvider(input.provider);
      const account = input.accountId ? await getConnectionAccount(db, input.accountId) : null;
      if (input.accountId && !account)
        logger.warn("[connections] Unknown account %s: creating a standalone Model", input.accountId);
      const values = {
        id,
        name: input.name,
        provider: input.provider,
        baseUrl: input.baseUrl ?? "",
        apiKeyEncrypted: encryptApiKey(
          input.provider === "decision" && input.credentialsFromConnectionId ? "" : (input.apiKey ?? ""),
        ),
        managementTokenEncrypted: encryptApiKey(input.provider === "nanogpt" ? (input.managementToken ?? "") : ""),
        showUsageWidget: String(supportsSubscriptionUsageWidget(input.provider) && (input.showUsageWidget ?? false)),
        showUsageFiveHour: String(input.showUsageFiveHour ?? true),
        showUsageWeekly: String(input.showUsageWeekly ?? true),
        profileImportReviewRequired: "false",
        model: input.model ?? "",
        pinnedModels: JSON.stringify(parsePinnedModels(input.pinnedModels ?? [])),
        savedModels: null as string | null,
        imagePath: input.imagePath ?? null,
        icon: input.icon ?? null,
        maxContext: input.maxContext ?? 128000,
        isDefault: String(takesChatDefaults(input.provider) && (input.isDefault ?? false)),
        fallbackForMain: String(providerCategory === "language" && (input.fallbackForMain ?? false)),
        useForRandom: String(takesChatDefaults(input.provider) && (input.useForRandom ?? false)),
        defaultForAgents: String(input.defaultForAgents ?? false),
        fallbackForAgents: String(takesChatDefaults(input.provider) && (input.fallbackForAgents ?? false)),
        enableCaching: String(input.enableCaching ?? false),
        anthropicExtendedCacheTtl: String(input.anthropicExtendedCacheTtl ?? false),
        cachingAtDepth: input.cachingAtDepth ?? 5,
        maxParallelJobs: input.maxParallelJobs ?? 1,
        maxRequestsPerMinute: input.maxRequestsPerMinute ?? null,
        embeddingModel: input.embeddingModel ?? "",
        embeddingBaseUrl: input.embeddingBaseUrl ?? "",
        embeddingConnectionId: input.embeddingConnectionId ?? null,
        openrouterProvider: input.openrouterProvider ?? null,
        imageGenerationSource: input.imageGenerationSource ?? null,
        comfyuiWorkflow: input.comfyuiWorkflow ?? null,
        imageService: input.imageService ?? null,
        imageEndpointId: input.imageEndpointId ?? null,
        imagePromptInstructions: input.imagePromptInstructions ?? null,
        imageGenerationQuality: input.imageGenerationQuality ?? "auto",
        videoGenerationSource: input.videoGenerationSource ?? null,
        videoService: input.videoService ?? null,
        videoPromptInstructions: input.videoPromptInstructions ?? null,
        audioSource: input.audioSource ?? null,
        decisionSource: input.decisionSource ?? null,
        credentialsFromConnectionId: input.provider === "decision" ? (input.credentialsFromConnectionId ?? null) : null,
        maxStateTokens: input.maxStateTokens ?? null,
        decisionTimeoutMs: input.decisionTimeoutMs ?? null,
        audioVoice: input.audioVoice ?? null,
        audioTimeoutMs: input.audioTimeoutMs ?? null,
        audioSoundEffects: String(input.audioSoundEffects ?? false),
        audioMusic: String(input.audioMusic ?? false),
        promptPresetId: input.promptPresetId ?? null,
        maxTokensOverride: input.maxTokensOverride ?? null,
        claudeFastMode: String(input.claudeFastMode ?? false),
        treatAsLocalEndpoint: String(input.treatAsLocalEndpoint ?? false),
        accountId: null as string | null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      // A Model under an account copies the account's credentials and ignores any in the input. It joins only
      // when its own endpoint is on the account's origin, so the key is never sent to another host.
      if (account && credentialOrigin({ ...input, baseUrl: input.baseUrl ?? "" }) === credentialOrigin(account)) {
        const sameType = input.provider === account.provider;
        values.accountId = account.id;
        values.apiKeyEncrypted = account.apiKeyEncrypted;
        values.managementTokenEncrypted = input.provider === "nanogpt" ? account.managementTokenEncrypted : "";
        values.showUsageWidget = String(
          supportsSubscriptionUsageWidget(input.provider) && account.showUsageWidget === "true",
        );
        values.showUsageFiveHour = account.showUsageFiveHour;
        values.showUsageWeekly = account.showUsageWeekly;
        values.treatAsLocalEndpoint = account.treatAsLocalEndpoint;
        values.profileImportReviewRequired = account.profileImportReviewRequired;
        if (sameType) values.baseUrl = account.baseUrl;
        // Models of one provider under an account share the pins; the catalog lives on the account.
        const peer = (await db.select().from(apiConnections).where(eq(apiConnections.accountId, account.id)))
          .filter((row) => row.provider === input.provider)
          .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
        // The schema defaults the pins to [], so an empty list also takes the shared one.
        if (peer && !input.pinnedModels?.length) values.pinnedModels = peer.pinnedModels;
      } else if (account) {
        logger.warn("[connections] Model endpoint is outside account %s: creating a standalone Model", account.id);
      }
      await db.transaction(async (tx) => {
        // If this is set as default, unset others.
        if (input.isDefault && takesChatDefaults(input.provider)) {
          await tx.update(apiConnections).set({ isDefault: "false" });
          values.fallbackForMain = "false";
        }
        if (providerCategory === "language" && input.fallbackForMain) {
          await tx.update(apiConnections).set({ fallbackForMain: "false" });
          values.isDefault = "false";
        }
        // If this is set as default for agents, unset others in the same provider category.
        if (input.defaultForAgents) {
          values.fallbackForAgents = "false";
          const category = defaultCategoryForProvider(input.provider);
          if (category !== "language") {
            await tx
              .update(apiConnections)
              .set({ defaultForAgents: "false" })
              .where(and(eq(apiConnections.defaultForAgents, "true"), eq(apiConnections.provider, category)));
          } else {
            const existingDefaults = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.defaultForAgents, "true"));
            for (const row of existingDefaults) {
              if (defaultCategoryForProvider(row.provider) === "language") {
                await tx.update(apiConnections).set({ defaultForAgents: "false" }).where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        if (input.fallbackForAgents && takesChatDefaults(input.provider)) {
          values.defaultForAgents = "false";
          const category = defaultCategoryForProvider(input.provider);
          if (category !== "language") {
            await tx
              .update(apiConnections)
              .set({ fallbackForAgents: "false" })
              .where(and(eq(apiConnections.fallbackForAgents, "true"), eq(apiConnections.provider, category)));
          } else {
            const existingFallbacks = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.fallbackForAgents, "true"));
            for (const row of existingFallbacks) {
              if (defaultCategoryForProvider(row.provider) === "language") {
                await tx
                  .update(apiConnections)
                  .set({ fallbackForAgents: "false" })
                  .where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        await tx.insert(apiConnections).values(values);
      });
      setConnectionRateLimit(id, input.maxRequestsPerMinute ?? null);
      // A standalone Model joins the account that already holds its credentials, or starts one.
      if (!values.accountId) await linkConnectionAccounts(db);
      return this.getById(id);
    },

    /** Commit background metadata only while the captured connection is still current. */
    async updateContextIfUnchanged(expected: typeof apiConnections.$inferSelect, maxContext: number): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(apiConnections).where(eq(apiConnections.id, expected.id));
        // Compare stored scalar fields too: two settings saves can share the same millisecond timestamp.
        if (
          !current ||
          Object.entries(current).some(([key, value]) => value !== expected[key as keyof typeof expected])
        )
          return false;
        await tx.update(apiConnections).set({ maxContext, updatedAt: now() }).where(eq(apiConnections.id, expected.id));
        return true;
      });
    },

    async update(id: string, input: Partial<CreateConnectionInput>) {
      const existing = await this.getById(id);
      if (!existing) return null;
      // A linked row takes its credentials from the account: those fields are ignored here, and the account
      // editor writes them through. `baseUrl` is the account's only on rows of the account's own type.
      const account = existing.accountId ? await getConnectionAccount(db, existing.accountId) : null;
      const data = { ...input };
      if (account) {
        for (const key of ACCOUNT_MIRRORED_INPUT_KEYS) delete data[key];
        if (existing.provider === account.provider) delete data.baseUrl;
      }

      const effectiveProvider = data.provider ?? existing.provider;
      const effectiveProviderCategory = defaultCategoryForProvider(effectiveProvider);
      // Saving through the connection editor is the explicit local review
      // boundary for a connection restored from someone else's profile.
      const updateFields: Record<string, unknown> = {
        updatedAt: now(),
      };
      if (
        !account &&
        (data.provider !== undefined ||
          data.baseUrl !== undefined ||
          data.apiKey !== undefined ||
          data.model !== undefined)
      ) {
        updateFields.profileImportReviewRequired = "false";
      }
      // Detach explicitly, or when the row's own endpoint moved off the account's origin.
      const movedOffAccount =
        !!account && credentialOrigin({ ...existing, ...definedFields(data) }) !== credentialOrigin(account);
      if (account && (input.accountId === null || movedOffAccount)) {
        updateFields.accountId = null;
      }
      const shouldClearDefault = data.isDefault === true;
      const shouldClearMainFallback = effectiveProviderCategory === "language" && data.fallbackForMain === true;
      const shouldClearAgentDefaults =
        data.defaultForAgents === true ||
        (data.defaultForAgents === undefined && data.provider !== undefined && existing.defaultForAgents === "true");
      const shouldClearAgentFallbacks =
        data.fallbackForAgents === true ||
        (data.fallbackForAgents === undefined && data.provider !== undefined && existing.fallbackForAgents === "true");
      if (data.decisionSource !== undefined) updateFields.decisionSource = data.decisionSource;
      if (data.credentialsFromConnectionId !== undefined)
        updateFields.credentialsFromConnectionId = data.credentialsFromConnectionId;
      if (data.maxStateTokens !== undefined) updateFields.maxStateTokens = data.maxStateTokens;
      if (data.decisionTimeoutMs !== undefined) updateFields.decisionTimeoutMs = data.decisionTimeoutMs;
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.provider !== undefined) updateFields.provider = data.provider;
      if (data.baseUrl !== undefined) updateFields.baseUrl = data.baseUrl;
      if (data.apiKey !== undefined) updateFields.apiKeyEncrypted = encryptApiKey(data.apiKey);
      if (
        effectiveProvider === "decision" &&
        (data.credentialsFromConnectionId === undefined
          ? existing.credentialsFromConnectionId
          : data.credentialsFromConnectionId)
      ) {
        updateFields.apiKeyEncrypted = encryptApiKey("");
      }
      if (effectiveProvider !== "decision") updateFields.credentialsFromConnectionId = null;
      if (data.managementToken !== undefined) {
        updateFields.managementTokenEncrypted = encryptApiKey(data.managementToken);
      }
      if (data.showUsageWidget !== undefined) {
        updateFields.showUsageWidget = String(data.showUsageWidget);
      }
      if (data.showUsageFiveHour !== undefined) updateFields.showUsageFiveHour = String(data.showUsageFiveHour);
      if (data.showUsageWeekly !== undefined) updateFields.showUsageWeekly = String(data.showUsageWeekly);
      if (effectiveProvider !== "nanogpt") updateFields.managementTokenEncrypted = encryptApiKey("");
      // As on create, the account's credentials never go to another host: a Model that moves off its account
      // keeps only what this save sends.
      if (movedOffAccount) {
        updateFields.apiKeyEncrypted = encryptApiKey(input.apiKey ?? "");
        updateFields.managementTokenEncrypted = encryptApiKey(
          effectiveProvider === "nanogpt" ? (input.managementToken ?? "") : "",
        );
      }
      if (!supportsSubscriptionUsageWidget(effectiveProvider)) updateFields.showUsageWidget = "false";
      if (data.model !== undefined) updateFields.model = data.model;
      if (data.pinnedModels !== undefined)
        updateFields.pinnedModels = JSON.stringify(parsePinnedModels(data.pinnedModels));
      // A different provider, address or key can serve a different model list, so the saved one is dropped
      // and the next look at the list fetches it again. The editor resends unchanged values, so compare them.
      if (
        (data.provider !== undefined && data.provider !== existing.provider) ||
        (data.baseUrl !== undefined && data.baseUrl !== existing.baseUrl) ||
        (data.apiKey !== undefined && data.apiKey !== decryptApiKey(existing.apiKeyEncrypted))
      ) {
        updateFields.savedModels = null;
      }
      if (data.imagePath !== undefined) updateFields.imagePath = data.imagePath;
      // One picture at a time: a chosen logo, letters or a reset replaces an uploaded image.
      if (data.icon !== undefined) {
        updateFields.icon = data.icon;
        if (data.imagePath === undefined) updateFields.imagePath = null;
      }
      if (data.maxContext !== undefined) updateFields.maxContext = data.maxContext;
      if (data.isDefault !== undefined) {
        updateFields.isDefault = String(data.isDefault);
      }
      if (data.fallbackForMain !== undefined) {
        updateFields.fallbackForMain = String(effectiveProviderCategory === "language" && data.fallbackForMain);
      }
      if (data.provider !== undefined && effectiveProviderCategory !== "language") {
        updateFields.fallbackForMain = "false";
      }
      if (data.useForRandom !== undefined) {
        updateFields.useForRandom = String(data.useForRandom);
      }
      if (data.defaultForAgents !== undefined) {
        updateFields.defaultForAgents = String(data.defaultForAgents);
      }
      if (data.fallbackForAgents !== undefined) {
        updateFields.fallbackForAgents = String(data.fallbackForAgents);
      }
      if (data.enableCaching !== undefined) {
        updateFields.enableCaching = String(data.enableCaching);
      }
      if (data.anthropicExtendedCacheTtl !== undefined) {
        updateFields.anthropicExtendedCacheTtl = String(data.anthropicExtendedCacheTtl);
      }
      if (data.cachingAtDepth !== undefined) {
        updateFields.cachingAtDepth = data.cachingAtDepth;
      }
      if (data.embeddingModel !== undefined) {
        updateFields.embeddingModel = data.embeddingModel;
      }
      if (data.embeddingBaseUrl !== undefined) {
        updateFields.embeddingBaseUrl = data.embeddingBaseUrl;
      }
      if (data.embeddingConnectionId !== undefined) {
        updateFields.embeddingConnectionId = data.embeddingConnectionId;
      }
      if (data.openrouterProvider !== undefined) {
        updateFields.openrouterProvider = data.openrouterProvider;
      }
      if (data.imageGenerationSource !== undefined) {
        updateFields.imageGenerationSource = data.imageGenerationSource;
      }
      if (data.comfyuiWorkflow !== undefined) {
        updateFields.comfyuiWorkflow = data.comfyuiWorkflow;
      }
      if (data.imageService !== undefined) {
        updateFields.imageService = data.imageService;
      }
      if (data.imageEndpointId !== undefined) {
        updateFields.imageEndpointId = data.imageEndpointId;
      }
      if (data.imagePromptInstructions !== undefined) {
        updateFields.imagePromptInstructions = data.imagePromptInstructions;
      }
      if (data.imageGenerationQuality !== undefined) {
        updateFields.imageGenerationQuality = data.imageGenerationQuality;
      }
      if (data.videoGenerationSource !== undefined) {
        updateFields.videoGenerationSource = data.videoGenerationSource;
      }
      if (data.videoService !== undefined) {
        updateFields.videoService = data.videoService;
      }
      if (data.videoPromptInstructions !== undefined) {
        updateFields.videoPromptInstructions = data.videoPromptInstructions;
      }
      if (data.audioSource !== undefined) {
        updateFields.audioSource = data.audioSource;
      }
      if (data.audioVoice !== undefined) {
        updateFields.audioVoice = data.audioVoice;
      }
      if (data.audioTimeoutMs !== undefined) updateFields.audioTimeoutMs = data.audioTimeoutMs;
      if (data.audioSoundEffects !== undefined) {
        updateFields.audioSoundEffects = String(data.audioSoundEffects);
      }
      if (data.audioMusic !== undefined) {
        updateFields.audioMusic = String(data.audioMusic);
      }
      if (data.promptPresetId !== undefined) {
        updateFields.promptPresetId = data.promptPresetId;
      }
      if (data.maxTokensOverride !== undefined) {
        updateFields.maxTokensOverride = data.maxTokensOverride;
      }
      if (data.maxParallelJobs !== undefined) {
        updateFields.maxParallelJobs = data.maxParallelJobs;
      }
      if (data.maxRequestsPerMinute !== undefined) {
        updateFields.maxRequestsPerMinute = data.maxRequestsPerMinute;
      }
      if (data.claudeFastMode !== undefined) {
        updateFields.claudeFastMode = String(data.claudeFastMode);
      }
      if (data.treatAsLocalEndpoint !== undefined) {
        updateFields.treatAsLocalEndpoint = String(data.treatAsLocalEndpoint);
      }
      if (!takesChatDefaults(effectiveProvider)) {
        updateFields.isDefault = "false";
        updateFields.useForRandom = "false";
        updateFields.fallbackForAgents = "false";
      }
      await db.transaction(async (tx) => {
        if (shouldClearDefault && takesChatDefaults(effectiveProvider)) {
          await tx.update(apiConnections).set({ isDefault: "false" });
          // "Make it my Main model" keeps the row's fallback flag: it rests while the row is Main (a fallback
          // equal to the primary is skipped) and works again once Main moves on.
        }
        if (shouldClearMainFallback) {
          await tx.update(apiConnections).set({ fallbackForMain: "false" });
          updateFields.isDefault = "false";
        }
        if (shouldClearAgentDefaults) {
          updateFields.fallbackForAgents = "false";
          const category = defaultCategoryForProvider(effectiveProvider);
          if (category !== "language") {
            await tx
              .update(apiConnections)
              .set({ defaultForAgents: "false" })
              .where(
                data.defaultForAgents === true
                  ? and(eq(apiConnections.defaultForAgents, "true"), eq(apiConnections.provider, category))
                  : and(
                      eq(apiConnections.defaultForAgents, "true"),
                      eq(apiConnections.provider, category),
                      ne(apiConnections.id, id),
                    ),
              );
          } else {
            const existingDefaults = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.defaultForAgents, "true"));
            for (const row of existingDefaults) {
              if (
                defaultCategoryForProvider(row.provider) === "language" &&
                (data.defaultForAgents === true || row.id !== id)
              ) {
                await tx.update(apiConnections).set({ defaultForAgents: "false" }).where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        if (shouldClearAgentFallbacks && takesChatDefaults(effectiveProvider)) {
          updateFields.defaultForAgents = "false";
          const category = defaultCategoryForProvider(effectiveProvider);
          if (category !== "language") {
            await tx
              .update(apiConnections)
              .set({ fallbackForAgents: "false" })
              .where(
                data.fallbackForAgents === true
                  ? and(eq(apiConnections.fallbackForAgents, "true"), eq(apiConnections.provider, category))
                  : and(
                      eq(apiConnections.fallbackForAgents, "true"),
                      eq(apiConnections.provider, category),
                      ne(apiConnections.id, id),
                    ),
              );
          } else {
            const existingFallbacks = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.fallbackForAgents, "true"));
            for (const row of existingFallbacks) {
              if (
                defaultCategoryForProvider(row.provider) === "language" &&
                (data.fallbackForAgents === true || row.id !== id)
              ) {
                await tx
                  .update(apiConnections)
                  .set({ fallbackForAgents: "false" })
                  .where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        await tx.update(apiConnections).set(updateFields).where(eq(apiConnections.id, id));
      });
      // Sync the throttle registry only after the write commits, so a failed update never installs
      // an unpersisted cap.
      if (data.maxRequestsPerMinute !== undefined) {
        setConnectionRateLimit(id, data.maxRequestsPerMinute ?? null);
      }
      // A Model whose endpoint moved off its account joins the account for its new address (as on create), so
      // a quick-switch pick never has to edit a shared standalone row. An explicit detach stays detached.
      if (input.accountId !== null && updateFields.accountId === null) await linkConnectionAccounts(db);
      return this.getById(id);
    },

    /** Duplicate a connection (including the encrypted API key). */
    async duplicate(id: string) {
      const source = await this.getById(id);
      if (!source) return null;
      const newConnId = newId();
      const timestamp = now();
      await db.insert(apiConnections).values({
        id: newConnId,
        name: `${source.name} (Copy)`,
        provider: source.provider,
        baseUrl: source.baseUrl,
        apiKeyEncrypted: source.apiKeyEncrypted,
        profileImportReviewRequired: source.profileImportReviewRequired,
        model: source.model,
        pinnedModels: source.pinnedModels,
        // The copy keeps the same provider, address and key, so the saved list still applies.
        savedModels: source.savedModels,
        accountId: source.accountId,
        imagePath: source.imagePath,
        icon: source.icon,
        maxContext: source.maxContext,
        isDefault: "false",
        fallbackForMain: "false",
        useForRandom: "false",
        defaultForAgents: "false",
        fallbackForAgents: "false",
        enableCaching: source.enableCaching,
        anthropicExtendedCacheTtl: source.anthropicExtendedCacheTtl,
        cachingAtDepth: source.cachingAtDepth,
        embeddingModel: source.embeddingModel,
        embeddingConnectionId: source.embeddingConnectionId,
        defaultParameters: source.defaultParameters,
        openrouterProvider: source.openrouterProvider,
        embeddingBaseUrl: source.embeddingBaseUrl,
        imageGenerationSource: source.imageGenerationSource,
        comfyuiWorkflow: source.comfyuiWorkflow,
        imageService: source.imageService,
        imageEndpointId: source.imageEndpointId,
        imagePromptInstructions: source.imagePromptInstructions,
        imageGenerationQuality: source.imageGenerationQuality,
        videoGenerationSource: source.videoGenerationSource,
        videoService: source.videoService,
        videoPromptInstructions: source.videoPromptInstructions,
        audioSource: source.audioSource,
        decisionSource: source.decisionSource,
        credentialsFromConnectionId: source.credentialsFromConnectionId,
        maxStateTokens: source.maxStateTokens,
        decisionTimeoutMs: source.decisionTimeoutMs,
        audioVoice: source.audioVoice,
        audioTimeoutMs: source.audioTimeoutMs,
        audioSoundEffects: source.audioSoundEffects,
        audioMusic: source.audioMusic,
        promptPresetId: source.promptPresetId,
        maxTokensOverride: source.maxTokensOverride,
        maxParallelJobs: source.maxParallelJobs,
        maxRequestsPerMinute: source.maxRequestsPerMinute,
        managementTokenEncrypted: source.managementTokenEncrypted,
        showUsageWidget: source.showUsageWidget,
        showUsageFiveHour: source.showUsageFiveHour,
        showUsageWeekly: source.showUsageWeekly,
        claudeFastMode: source.claudeFastMode,
        treatAsLocalEndpoint: source.treatAsLocalEndpoint,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      setConnectionRateLimit(newConnId, source.maxRequestsPerMinute ?? null);
      return this.getById(newConnId);
    },

    /** Get all connections marked for the random pool (with decrypted keys). */
    async listRandomPool() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.useForRandom, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      // The pool is drawn as the live chat LLM — media connections can never
      // serve a chat turn, so they are excluded even if a row was flagged
      // before its provider changed.
      const available = await withoutBlockedRows(
        db,
        rows.filter((r: any) => isChatProvider(r.provider)),
      );
      return Promise.all(available.map((r: any) => withKey(r)));
    },

    /** `keepChatPicks`: chats that use this Model keep it as a catalog pick on a sibling Model (unstar, decision 30). */
    async remove(id: string, keepChatPicks = false) {
      const cleanup = await db.transaction(async (tx) => {
        const [row] = (await tx.select().from(apiConnections).where(eq(apiConnections.id, id))) as ConnectionRow[];
        // A chat's catalog pick runs on this Model's key; another chat Model of the same Connection can carry it.
        const peers = row?.accountId
          ? ((await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.accountId, row.accountId))) as ConnectionRow[])
          : [];
        const carrier = peers
          .filter((peer) => peer.id !== id && isChatProvider(peer.provider))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        await tx.delete(apiConnections).where(eq(apiConnections.id, id));
        const keptPick =
          keepChatPicks && row?.model
            ? {
                connectionId: id,
                model: row.model,
                ...(row.name.trim() && row.name !== row.model ? { name: row.name.trim().slice(0, 200) } : {}),
                ...(row.maxContext >= 1 ? { maxContext: row.maxContext } : {}),
                ...(row.maxTokensOverride && row.maxTokensOverride >= 1
                  ? { maxTokensOverride: row.maxTokensOverride }
                  : {}),
              }
            : null;
        return sweepDanglingConnectionReferences(tx, id, carrier?.id ?? null, keptPick);
      });
      // Clear the throttle registry only after the delete commits.
      clearConnectionRateLimit(id);
      const totalCleaned = cleanup.chatsUpdated + cleanup.agentsUpdated + cleanup.connectionsUpdated;
      if (totalCleaned > 0) {
        logger.info(
          "[connections] Cleared dangling references to deleted connection %s: %d chat(s), %d agent(s), %d connection(s)",
          id,
          cleanup.chatsUpdated,
          cleanup.agentsUpdated,
          cleanup.connectionsUpdated,
        );
      }
    },

    /**
     * Save a freshly fetched model list, unless the provider, address or key changed while it was being
     * fetched. It is a cache, so `updatedAt` stays as it is.
     */
    async saveModelListIfUnchanged(
      expected: typeof apiConnections.$inferSelect,
      models: readonly unknown[],
    ): Promise<SavedConnectionModelList | null> {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(apiConnections).where(eq(apiConnections.id, expected.id));
        if (!current || MODEL_LIST_SOURCE_FIELDS.some((field) => current[field] !== expected[field])) return null;
        const list: SavedConnectionModelList = { fetchedAt: now(), models: toSavedModels(models) };
        const account = current.accountId ? await getConnectionAccount(tx, current.accountId) : null;
        if (!account) {
          await tx
            .update(apiConnections)
            .set({ savedModels: JSON.stringify(list) })
            .where(eq(apiConnections.id, expected.id));
          return list;
        }
        // One copy per Connection and provider: every linked Model of that provider reads it.
        await tx
          .update(connectionAccounts)
          .set({ modelCatalogs: withAccountCatalog(account, current.provider, list) })
          .where(eq(connectionAccounts.id, account.id));
        if (current.savedModels) {
          await tx.update(apiConnections).set({ savedModels: null }).where(eq(apiConnections.id, current.id));
        }
        return list;
      });
    },

    /**
     * Save a Connection's catalog for its own provider, fetched with its key before any linked Model of that provider
     * read it (a move from another service). Null when the provider, address or key changed while it loaded.
     */
    async saveAccountCatalogIfUnchanged(
      expected: ConnectionAccountRow,
      models: readonly unknown[],
    ): Promise<SavedConnectionModelList | null> {
      return db.transaction(async (tx) => {
        const current = await getConnectionAccount(tx, expected.id);
        if (
          !current ||
          (["provider", "baseUrl", "apiKeyEncrypted"] as const).some((field) => current[field] !== expected[field])
        ) {
          return null;
        }
        const list: SavedConnectionModelList = { fetchedAt: now(), models: toSavedModels(models) };
        await tx
          .update(connectionAccounts)
          .set({ modelCatalogs: withAccountCatalog(current, current.provider, list) })
          .where(eq(connectionAccounts.id, current.id));
        return list;
      });
    },

    /** Pin or unpin one model. Pins stay in the order they were added. */
    async setModelPinned(
      id: string,
      model: string,
      pinned: boolean,
    ): Promise<{ pinnedModels: string[] } | "not_found" | "limit"> {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(apiConnections).where(eq(apiConnections.id, id));
        if (!row) return "not_found" as const;
        const current = parsePinnedModels(row.pinnedModels);
        if (pinned && current.includes(model)) return { pinnedModels: current };
        if (pinned && current.length >= MAX_PINNED_MODELS) return "limit" as const;
        const pinnedModels = pinned ? [...current, model] : current.filter((entry) => entry !== model);
        await tx
          .update(apiConnections)
          .set({ pinnedModels: JSON.stringify(pinnedModels), updatedAt: now() })
          .where(eq(apiConnections.id, id));
        // Pins are account-wide for Models of the same provider (the favourites of one Connection).
        await mirrorToAccountPeers(tx, row, { pinnedModels: JSON.stringify(pinnedModels) });
        return { pinnedModels };
      });
    },

    /** What a move needs, for the picker: the kind, and for another service the target's catalog for its provider. */
    async planMove(
      id: string,
      accountId: string,
    ): Promise<
      | { kind: MoveKind; account: ConnectionAccountRow; row: ConnectionRow; catalog: SavedConnectionModelList | null }
      | "not_found"
      | "account_not_found"
    > {
      const row = (await this.getById(id)) as ConnectionRow | null;
      if (!row) return "not_found";
      const account = await getConnectionAccount(db, accountId);
      if (!account) return "account_not_found";
      const linked = (await db
        .select()
        .from(apiConnections)
        .where(eq(apiConnections.accountId, account.id))) as ConnectionRow[];
      const kind = moveKind(row, account, linked);
      return { kind, account, row, catalog: readAccountCatalogs(account)[account.provider] ?? null };
    },

    /**
     * "Move to connection…" (decision 28): the Model joins another Connection of the same service and endpoint and
     * takes that Connection's key, usage settings, review state and catalog. Its id stays, so chats, per-chat picks
     * and agents that point at it keep working. A Model under import review, one that borrows another row's key
     * or one that sends its key to a second host cannot move: that would hand a key across the review boundary.
     *
     * A chat Model can also move to a chat Connection of another service: then `model` (from the target catalog, any
     * id on a custom endpoint) replaces its model id, the provider, address and key come from the target, the star
     * moves to the new id, settings the target ignores are dropped, and service-only fields are reset. Media,
     * decision and local-login (subscription) Models never change service this way.
     */
    async moveToAccount(
      id: string,
      accountId: string,
      model?: string,
    ): Promise<
      ConnectionRow | "not_found" | "account_not_found" | "mismatch" | "review" | "model_required" | "model_not_offered"
    > {
      // Reads, checks and the write share one transaction, so a host change in between cannot slip past the checks.
      const refused = await db.transaction(async (tx) => {
        const [row] = (await tx.select().from(apiConnections).where(eq(apiConnections.id, id))) as ConnectionRow[];
        if (!row) return "not_found" as const;
        const [account] = (await tx
          .select()
          .from(connectionAccounts)
          .where(eq(connectionAccounts.id, accountId))) as ConnectionAccountRow[];
        if (!account) return "account_not_found" as const;
        if (row.profileImportReviewRequired === "true") return "review" as const;
        const linked = (await tx
          .select()
          .from(apiConnections)
          .where(eq(apiConnections.accountId, account.id))) as ConnectionRow[];
        const kind = moveKind(row, account, linked);
        if (kind === "mismatch") return "mismatch" as const;
        if (kind === "cross") return moveAcrossServices(tx, row, account, linked, model);
        const representative = representativeOf(linked);
        const peer = linked
          .filter(
            (candidate) =>
              candidate.provider === row.provider &&
              credentialVendor(candidate) === credentialVendor(row) &&
              sameEndpoint(candidate, row.provider === account.provider ? account : row),
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const sameServer =
          !!representative &&
          decryptApiKey(row.apiKeyEncrypted) === decryptApiKey(account.apiKeyEncrypted) &&
          sameEndpoint(row, representative);
        // Another key can serve another model list. Without a same-kind peer the Model's catalog still applies when
        // key and address are unchanged (the same server), so it becomes the Connection's catalog for that provider.
        const ownCatalog = sameServer
          ? catalogOf(row, row.accountId ? await getConnectionAccount(tx, row.accountId) : null)
          : null;
        const accountCatalog = readAccountCatalogs(account)[row.provider];
        if (!peer && ownCatalog && (!accountCatalog || accountCatalog.fetchedAt < ownCatalog.fetchedAt)) {
          await tx
            .update(connectionAccounts)
            .set({ modelCatalogs: withAccountCatalog(account, row.provider, ownCatalog) })
            .where(eq(connectionAccounts.id, account.id));
        }
        await tx
          .update(apiConnections)
          .set({
            ...takenFromAccount(account, row.provider),
            ...(row.provider === account.provider ? { baseUrl: account.baseUrl } : {}),
            // The new Connection's catalog and favorites apply.
            savedModels: null,
            ...(peer ? { pinnedModels: peer.pinnedModels } : {}),
            updatedAt: now(),
          })
          .where(eq(apiConnections.id, id));
        return null;
      });
      if (refused) return refused;
      const moved = (await this.getById(id)) as ConnectionRow;
      await syncAccountBudget(db, moved);
      return moved;
    },

    async updateDefaultParameters(id: string, params: Record<string, unknown> | null) {
      await db
        .update(apiConnections)
        .set({ defaultParameters: params ? JSON.stringify(params) : null, updatedAt: now() })
        .where(eq(apiConnections.id, id));
    },
  };
}
