// ──────────────────────────────────────────────
// Storage: Connection accounts (shared credentials for several Models)
// ──────────────────────────────────────────────
//
// An account holds the credential identity (vendor, endpoint origin, key) that several `api_connections`
// rows (Models) share. One account may hold chat AND image/video/audio Models that use the same key
// (concept decision 20), so grouping keys on the credential identity, never on the row type.
//
// Write-through. An account edit is copied onto its linked rows in one transaction, so every row stays a
// complete, self-sufficient row (key resolution and a downgraded build need no account lookup). Only fields
// that are safe across row types are mirrored: the encrypted key, the management token (NanoGPT rows only),
// the usage flags, the local-endpoint flag and the review flag. `baseUrl` is mirrored ONLY to rows whose
// `provider` equals the account's `provider`: an image/video/audio row keeps its own endpoint, because its
// path and meaning differ from the chat endpoint (e.g. NanoGPT chat `/api/v1` vs video `/api`).
import { createHash } from "crypto";
import { eq, and, ne } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { apiConnections, connectionAccounts } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { encryptApiKey, decryptApiKey } from "../../utils/crypto.js";
import {
  DECISION_SOURCE_BASE_URLS,
  IMAGE_GENERATION_SOURCES,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  isLocalAuthProvider,
  localAuthProviderBaseUrl,
  supportsSubscriptionUsageWidget,
  type ConnectionAccountListItem,
  type CreateConnectionAccountInput,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { setConnectionBudgetScope, setAccountRateLimit } from "../llm/connection-rate-limit-registry.js";
import { setAccountParallelLimit } from "../llm/account-budget.js";
import { logger } from "../../lib/logger.js";

export type ConnectionRow = typeof apiConnections.$inferSelect;
export type ConnectionAccountRow = typeof connectionAccounts.$inferSelect;

/** Row input fields that belong to the account: a linked row ignores them in `update`. */
export const ACCOUNT_MIRRORED_INPUT_KEYS = [
  "provider",
  "apiKey",
  "managementToken",
  "showUsageWidget",
  "showUsageFiveHour",
  "showUsageWeekly",
  "treatAsLocalEndpoint",
] as const;

// ── Credential identity ─────────────────────────

/** Image-source ids that use the same vendor credential as the chat provider of the same name. */
const IMAGE_SOURCE_VENDOR: Record<string, string> = {
  openai: "openai",
  openrouter: "openrouter",
  xai: "xai",
  nanogpt: "nanogpt",
  arli: "arli",
  zai: "zai",
  gemini_image: "google",
};
const VIDEO_SOURCE_VENDOR: Record<string, string> = {
  openrouter: "openrouter",
  xai: "xai",
  nanogpt: "nanogpt",
  google_veo: "google",
  gemini_omni: "google",
  google_ai_studio: "google",
};
const AUDIO_SOURCE_VENDOR: Record<string, string> = { openai: "openai", xai: "xai" };

type IdentityRow = { provider: string } & Partial<
  Pick<
    ConnectionRow,
    | "baseUrl"
    | "model"
    | "imageGenerationSource"
    | "imageService"
    | "videoGenerationSource"
    | "videoService"
    | "audioSource"
    | "decisionSource"
  >
>;

function trimUrl(url: string | null | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

function imageSourceOf(row: IdentityRow): string {
  return (
    row.imageGenerationSource?.trim() ||
    row.imageService?.trim() ||
    inferImageSource(row.model ?? "", trimUrl(row.baseUrl))
  );
}

function videoSourceOf(row: IdentityRow): string {
  return (
    row.videoGenerationSource?.trim() ||
    row.videoService?.trim() ||
    inferVideoSource(row.model ?? "", trimUrl(row.baseUrl))
  );
}

/** The service the row's key authenticates against. Chat rows: their provider. Media rows: their source. */
export function credentialVendor(row: IdentityRow): string {
  switch (row.provider) {
    case "image_generation": {
      const source = imageSourceOf(row);
      return IMAGE_SOURCE_VENDOR[source] ?? `image:${source}`;
    }
    case "video_generation": {
      const source = videoSourceOf(row);
      return VIDEO_SOURCE_VENDOR[source] ?? `video:${source}`;
    }
    case "audio": {
      const source = row.audioSource?.trim() ?? "";
      return AUDIO_SOURCE_VENDOR[source] ?? `audio:${source}`;
    }
    case "decision":
      return `decision:${row.decisionSource ?? ""}`;
    default:
      return row.provider;
  }
}

/** The endpoint a row talks to: its own `baseUrl`, else the default of its provider or media source. */
export function credentialEndpoint(row: IdentityRow): string {
  const own = trimUrl(row.baseUrl);
  if (own) return own;
  const localAuth = localAuthProviderBaseUrl(row.provider);
  if (localAuth) return localAuth;
  switch (row.provider) {
    case "image_generation":
      return IMAGE_GENERATION_SOURCES.find((source) => source.id === imageSourceOf(row))?.defaultBaseUrl ?? "";
    case "video_generation":
      return VIDEO_GENERATION_SOURCES.find((source) => source.id === videoSourceOf(row))?.defaultBaseUrl ?? "";
    case "decision":
      return (DECISION_SOURCE_BASE_URLS as Record<string, string>)[row.decisionSource ?? ""] ?? "";
    case "audio":
      return "";
    default:
      return PROVIDERS[row.provider as keyof typeof PROVIDERS]?.defaultBaseUrl ?? "";
  }
}

function originOfUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.origin !== "null" ? parsed.origin : `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Normalized origin (scheme, host, port) of the row's effective endpoint. Paths are not part of the identity. */
export function credentialOrigin(row: IdentityRow): string {
  return originOfUrl(credentialEndpoint(row));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function keyDigest(key: string): string {
  return key ? createHash("sha256").update(key).digest("hex") : "";
}

type GroupableRow = IdentityRow & { apiKeyEncrypted: string; profileImportReviewRequired: string };

/**
 * Rows with the same vendor, origin and key share an account, across chat and media rows. Rows without a
 * key (local servers, ComfyUI) group by their full endpoint instead, so two local servers stay apart.
 * A row under import review never joins a trusted account.
 */
function groupKeyOf(row: GroupableRow, plainKey: string): string {
  return [
    credentialVendor(row),
    credentialOrigin(row),
    keyDigest(plainKey),
    plainKey ? "" : credentialEndpoint(row).toLowerCase(),
    row.profileImportReviewRequired === "true" ? "review" : "",
  ].join("\u0000");
}

// ── Gate ────────────────────────────────────────

type GateAccount = Pick<
  ConnectionAccountRow,
  "enabled" | "profileImportReviewRequired" | "provider" | "baseUrl" | "apiKeyEncrypted" | "treatAsLocalEndpoint"
>;

function providerRequiresApiKey(provider: string): boolean {
  return (
    !isLocalAuthProvider(provider) &&
    !["custom", "image_generation", "video_generation", "audio", "decision"].includes(provider)
  );
}

/**
 * A hosted vendor endpoint without a key cannot answer. A keyless account on another address (a local or proxy
 * server behind a vendor-compatible API) may not need a key, so it is not flagged.
 */
export function accountNeedsKey(account: GateAccount): boolean {
  if (!providerRequiresApiKey(account.provider) || account.treatAsLocalEndpoint === "true") return false;
  if (decryptApiKey(account.apiKeyEncrypted)) return false;
  const vendorDefault = PROVIDERS[account.provider as keyof typeof PROVIDERS]?.defaultBaseUrl ?? "";
  return !account.baseUrl.trim() || originOfUrl(trimUrl(account.baseUrl)) === originOfUrl(trimUrl(vendorDefault));
}

/** A disabled account, one still waiting for review, or a hosted one without a key blocks every Model under it. */
export function accountBlocksRows(account: GateAccount | null | undefined): boolean {
  return (
    !!account &&
    (account.enabled === "false" || account.profileImportReviewRequired === "true" || accountNeedsKey(account))
  );
}

export async function getConnectionAccount(db: DB, id: string): Promise<ConnectionAccountRow | null> {
  const [account] = await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, id));
  return account ?? null;
}

export async function isBlockedByAccount(db: DB, row: { accountId?: string | null }): Promise<boolean> {
  if (!row.accountId) return false;
  return accountBlocksRows(await getConnectionAccount(db, row.accountId));
}

/** Drop the rows whose account blocks them. One read of the account table for the whole list. */
export async function withoutBlockedRows<T extends { accountId?: string | null }>(db: DB, rows: T[]): Promise<T[]> {
  if (!rows.some((row) => row.accountId)) return rows;
  const blocked = new Set(
    (await db.select().from(connectionAccounts)).filter(accountBlocksRows).map((account) => account.id),
  );
  return rows.filter((row) => !row.accountId || !blocked.has(row.accountId));
}

/** Keep the outbound budget registry in sync with the row's account, right before the row is used. */
export async function syncAccountBudget(db: DB, row: { id: string; accountId?: string | null }): Promise<void> {
  const account = row.accountId ? await getConnectionAccount(db, row.accountId) : null;
  if (!account) {
    setConnectionBudgetScope(row.id, null);
    return;
  }
  setAccountRateLimit(account.id, account.maxRequestsPerMinute);
  setAccountParallelLimit(account.id, account.maxParallelJobs);
  setConnectionBudgetScope(row.id, account.maxRequestsPerMinute || account.maxParallelJobs ? account.id : null);
}

/** Copy a value onto the other rows of the same account and provider (pins, saved model list). */
export async function mirrorToAccountPeers(
  tx: DB,
  source: Pick<ConnectionRow, "id" | "accountId" | "provider">,
  values: Partial<ConnectionRow>,
): Promise<void> {
  if (!source.accountId) return;
  await tx
    .update(apiConnections)
    .set(values)
    .where(
      and(
        eq(apiConnections.accountId, source.accountId),
        eq(apiConnections.provider, source.provider),
        ne(apiConnections.id, source.id),
      ),
    );
}

// ── Listing ─────────────────────────────────────

export function toAccountListItem(account: ConnectionAccountRow, modelCount: number): ConnectionAccountListItem {
  const key = decryptApiKey(account.apiKeyEncrypted);
  const review = account.profileImportReviewRequired === "true";
  const enabled = account.enabled !== "false";
  return {
    id: account.id,
    name: account.name,
    provider: account.provider,
    baseUrl: account.baseUrl,
    hasApiKey: !!key,
    // Short keys would be mostly revealed by their last characters.
    apiKeyLast4: key.length >= 8 ? key.slice(-4) : "",
    hasManagementToken: !!decryptApiKey(account.managementTokenEncrypted),
    showUsageWidget: account.showUsageWidget === "true",
    showUsageFiveHour: account.showUsageFiveHour !== "false",
    showUsageWeekly: account.showUsageWeekly !== "false",
    treatAsLocalEndpoint: account.treatAsLocalEndpoint === "true",
    enabled,
    maxRequestsPerMinute: account.maxRequestsPerMinute ?? null,
    maxParallelJobs: account.maxParallelJobs ?? null,
    profileImportReviewRequired: review,
    modelCount,
    state: !enabled ? "off" : review || accountNeedsKey(account) ? "needs_key" : "ok",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

// ── Migration and linking ───────────────────────

function accountLabel(anchor: ConnectionRow, keyless: boolean): string {
  const endpoint = credentialEndpoint(anchor);
  const host = hostOf(endpoint);
  if (anchor.provider === "custom") return host ? `Custom · ${host}` : "Custom";
  let label = PROVIDERS[anchor.provider as keyof typeof PROVIDERS]?.name ?? anchor.provider;
  if (anchor.provider === "image_generation") {
    label = IMAGE_GENERATION_SOURCES.find((source) => source.id === imageSourceOf(anchor))?.name ?? label;
  } else if (anchor.provider === "video_generation") {
    label = VIDEO_GENERATION_SOURCES.find((source) => source.id === videoSourceOf(anchor))?.name ?? label;
  }
  return keyless && host && !isLocalAuthProvider(anchor.provider) ? `${label} · ${host}` : label;
}

const ANCHOR_ORDER = ["chat", "image_generation", "video_generation", "audio", "decision"];
const anchorRank = (row: ConnectionRow) => ANCHOR_ORDER.indexOf(isChatProvider(row.provider) ? "chat" : row.provider);

const newerFirst = (a: ConnectionRow, b: ConnectionRow) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

function accountFromGroup(rows: ConnectionRow[], plainKey: string): ConnectionAccountRow {
  // The account's own provider is the best-ranked row type (chat first); its newest row supplies the flags.
  const anchor = [...rows].sort((a, b) => anchorRank(a) - anchorRank(b) || newerFirst(a, b))[0]!;
  const sameType = rows.filter((row) => row.provider === anchor.provider).sort(newerFirst);
  const flags = sameType[0]!;
  const timestamp = now();
  return {
    id: newId(),
    name: accountLabel(anchor, !plainKey),
    provider: anchor.provider,
    // Stored explicitly (default endpoint included) so the account's origin is known without its rows.
    baseUrl: anchor.baseUrl || (isLocalAuthProvider(anchor.provider) ? "" : credentialEndpoint(anchor)),
    apiKeyEncrypted: sameType.find((row) => row.apiKeyEncrypted)?.apiKeyEncrypted ?? anchor.apiKeyEncrypted,
    managementTokenEncrypted: sameType.find((row) => row.managementTokenEncrypted)?.managementTokenEncrypted ?? "",
    showUsageWidget: flags.showUsageWidget,
    showUsageFiveHour: flags.showUsageFiveHour,
    showUsageWeekly: flags.showUsageWeekly,
    treatAsLocalEndpoint: flags.treatAsLocalEndpoint,
    enabled: "true",
    maxRequestsPerMinute: null,
    maxParallelJobs: null,
    profileImportReviewRequired: rows.some((row) => row.profileImportReviewRequired === "true") ? "true" : "false",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Idempotent: detach rows that drifted from their account, then link every unlinked row to the account that
 * holds its credential identity (creating one when none does). Writes `accountId` on rows and nothing else.
 * Decision rows that borrow another row's credentials stay standalone.
 */
export async function linkConnectionAccounts(db: DB): Promise<{ created: number; linked: number; detached: number }> {
  return db.transaction(async (tx) => {
    const accounts = await tx.select().from(connectionAccounts);
    const rows = (await tx.select().from(apiConnections)).map((row: ConnectionRow) => ({ ...row }));
    const accountById = new Map(accounts.map((account: ConnectionAccountRow) => [account.id, account]));
    const keys = new Map(rows.map((row: ConnectionRow) => [row.id, decryptApiKey(row.apiKeyEncrypted)]));
    let created = 0;
    let linked = 0;
    let detached = 0;

    // 1. Consistency: drift from a downgraded build, an import or an edit leaves the row standalone.
    for (const row of rows) {
      if (!row.accountId) continue;
      const account = accountById.get(row.accountId);
      const consistent =
        !!account &&
        !row.credentialsFromConnectionId &&
        keys.get(row.id) === decryptApiKey(account.apiKeyEncrypted) &&
        credentialOrigin(row) === credentialOrigin(account);
      if (consistent) continue;
      await tx.update(apiConnections).set({ accountId: null }).where(eq(apiConnections.id, row.id));
      row.accountId = null;
      detached++;
    }

    // 2. Grouping by credential identity. Existing accounts are matched through their linked rows.
    const accountForGroup = new Map<string, string>();
    for (const row of rows) {
      if (row.accountId) {
        const key = groupKeyOf(row, keys.get(row.id) ?? "");
        if (!accountForGroup.has(key)) accountForGroup.set(key, row.accountId);
      }
    }
    for (const account of accounts as ConnectionAccountRow[]) {
      // An account without rows can only be matched by its own provider (chat accounts).
      if (rows.some((row) => row.accountId === account.id) || !isChatProvider(account.provider)) continue;
      const key = groupKeyOf(account, decryptApiKey(account.apiKeyEncrypted));
      if (!accountForGroup.has(key)) accountForGroup.set(key, account.id);
    }

    const groups = new Map<string, ConnectionRow[]>();
    const unlinked = rows
      .filter((row) => !row.accountId && !row.credentialsFromConnectionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    for (const row of unlinked) {
      const key = groupKeyOf(row, keys.get(row.id) ?? "");
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const [groupKey, members] of groups) {
      let accountId = accountForGroup.get(groupKey);
      if (!accountId) {
        const account = accountFromGroup(members, keys.get(members[0]!.id) ?? "");
        await tx.insert(connectionAccounts).values(account);
        accountId = account.id;
        accountForGroup.set(groupKey, accountId);
        created++;
      }
      for (const row of members) {
        await tx.update(apiConnections).set({ accountId }).where(eq(apiConnections.id, row.id));
        linked++;
      }
    }

    if (created || linked || detached) {
      logger.info("[connections] Linked %d Model(s) into %d new Connection(s), detached %d", linked, created, detached);
    }
    return { created, linked, detached };
  });
}

// ── Account storage ─────────────────────────────

export function createConnectionAccountsStorage(db: DB) {
  return {
    async list(): Promise<ConnectionAccountRow[]> {
      return db.select().from(connectionAccounts);
    },

    async getById(id: string): Promise<ConnectionAccountRow | null> {
      return getConnectionAccount(db, id);
    },

    async linkedRows(id: string): Promise<ConnectionRow[]> {
      return db.select().from(apiConnections).where(eq(apiConnections.accountId, id));
    },

    /** Insert an account only. The first Model is created through the connections storage. */
    async create(input: CreateConnectionAccountInput): Promise<ConnectionAccountRow> {
      const timestamp = now();
      const values = {
        id: newId(),
        name: input.name,
        provider: input.provider,
        baseUrl: input.baseUrl ?? "",
        apiKeyEncrypted: encryptApiKey(input.apiKey ?? ""),
        managementTokenEncrypted: encryptApiKey(input.provider === "nanogpt" ? (input.managementToken ?? "") : ""),
        showUsageWidget: String(supportsSubscriptionUsageWidget(input.provider) && (input.showUsageWidget ?? false)),
        showUsageFiveHour: String(input.showUsageFiveHour ?? true),
        showUsageWeekly: String(input.showUsageWeekly ?? true),
        treatAsLocalEndpoint: String(input.treatAsLocalEndpoint ?? false),
        enabled: String(input.enabled ?? true),
        maxRequestsPerMinute: input.maxRequestsPerMinute ?? null,
        maxParallelJobs: input.maxParallelJobs ?? null,
        profileImportReviewRequired: "false",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(connectionAccounts).values(values);
      return values;
    },

    /** Update the account and write the safe fields through to every linked row, in one transaction. */
    async update(id: string, input: UpdateConnectionAccountInput): Promise<ConnectionAccountRow | null> {
      return db.transaction(async (tx) => {
        const [account] = await tx.select().from(connectionAccounts).where(eq(connectionAccounts.id, id));
        if (!account) return null;

        const plainOldKey = decryptApiKey(account.apiKeyEncrypted);
        const credentialsTouched = input.apiKey !== undefined || input.baseUrl !== undefined;
        const set: Partial<ConnectionAccountRow> = { updatedAt: now() };
        if (input.name !== undefined) set.name = input.name;
        if (input.baseUrl !== undefined) set.baseUrl = input.baseUrl;
        if (input.apiKey !== undefined) set.apiKeyEncrypted = encryptApiKey(input.apiKey);
        if (input.managementToken !== undefined && account.provider === "nanogpt") {
          set.managementTokenEncrypted = encryptApiKey(input.managementToken);
        }
        if (input.showUsageWidget !== undefined) {
          set.showUsageWidget = String(supportsSubscriptionUsageWidget(account.provider) && input.showUsageWidget);
        }
        if (input.showUsageFiveHour !== undefined) set.showUsageFiveHour = String(input.showUsageFiveHour);
        if (input.showUsageWeekly !== undefined) set.showUsageWeekly = String(input.showUsageWeekly);
        if (input.treatAsLocalEndpoint !== undefined) set.treatAsLocalEndpoint = String(input.treatAsLocalEndpoint);
        if (input.enabled !== undefined) set.enabled = String(input.enabled);
        if (input.maxRequestsPerMinute !== undefined) set.maxRequestsPerMinute = input.maxRequestsPerMinute;
        if (input.maxParallelJobs !== undefined) set.maxParallelJobs = input.maxParallelJobs;
        // Saving an endpoint or key is the explicit local review boundary (as for a single connection).
        if (credentialsTouched) set.profileImportReviewRequired = "false";
        await tx.update(connectionAccounts).set(set).where(eq(connectionAccounts.id, id));
        const updated: ConnectionAccountRow = { ...account, ...set };

        const keyChanged = input.apiKey !== undefined && input.apiKey !== plainOldKey;
        const baseUrlChanged = input.baseUrl !== undefined && input.baseUrl !== account.baseUrl;
        const accountOrigin = credentialOrigin(updated);
        const mirrored =
          input.apiKey !== undefined ||
          input.baseUrl !== undefined ||
          input.managementToken !== undefined ||
          input.showUsageWidget !== undefined ||
          input.showUsageFiveHour !== undefined ||
          input.showUsageWeekly !== undefined ||
          input.treatAsLocalEndpoint !== undefined;
        if (mirrored) {
          const rows = await tx.select().from(apiConnections).where(eq(apiConnections.accountId, id));
          for (const row of rows as ConnectionRow[]) {
            const sameType = row.provider === account.provider;
            const takesBaseUrl = sameType && input.baseUrl !== undefined;
            // A second endpoint (embeddings) on another origin would also receive the row's key.
            const foreignEndpoint =
              !!row.embeddingBaseUrl?.trim() && originOfUrl(trimUrl(row.embeddingBaseUrl)) !== accountOrigin;
            // A row whose own or embedding endpoint is on another origin must not receive the key: it leaves
            // the account and keeps its own key and review state.
            if (
              (!takesBaseUrl && credentialOrigin(row) !== accountOrigin) ||
              (input.apiKey !== undefined && foreignEndpoint)
            ) {
              await tx.update(apiConnections).set({ accountId: null }).where(eq(apiConnections.id, row.id));
              continue;
            }
            const rowSet: Partial<ConnectionRow> = { updatedAt: set.updatedAt! };
            if (input.apiKey !== undefined) rowSet.apiKeyEncrypted = updated.apiKeyEncrypted;
            if (input.managementToken !== undefined && row.provider === "nanogpt") {
              rowSet.managementTokenEncrypted = updated.managementTokenEncrypted;
            }
            if (input.showUsageWidget !== undefined) {
              rowSet.showUsageWidget = String(supportsSubscriptionUsageWidget(row.provider) && input.showUsageWidget);
            }
            if (input.showUsageFiveHour !== undefined) rowSet.showUsageFiveHour = updated.showUsageFiveHour;
            if (input.showUsageWeekly !== undefined) rowSet.showUsageWeekly = updated.showUsageWeekly;
            if (input.treatAsLocalEndpoint !== undefined) rowSet.treatAsLocalEndpoint = updated.treatAsLocalEndpoint;
            if (takesBaseUrl) rowSet.baseUrl = updated.baseUrl;
            // A different key or address can serve a different model list.
            if (keyChanged || (takesBaseUrl && baseUrlChanged)) rowSet.savedModels = null;
            // A row with a second endpoint on another origin stays under review.
            if (credentialsTouched && !foreignEndpoint) rowSet.profileImportReviewRequired = "false";
            await tx.update(apiConnections).set(rowSet).where(eq(apiConnections.id, row.id));
          }
        }
        return updated;
      });
    },

    /** Delete an account that has no Models. Returns the linked rows instead when it still has some. */
    async remove(id: string): Promise<"not_found" | ConnectionRow[] | "deleted"> {
      return db.transaction(async (tx) => {
        const [account] = await tx.select().from(connectionAccounts).where(eq(connectionAccounts.id, id));
        if (!account) return "not_found" as const;
        const linkedRows = await tx.select().from(apiConnections).where(eq(apiConnections.accountId, id));
        if (linkedRows.length) return linkedRows as ConnectionRow[];
        await tx.delete(connectionAccounts).where(eq(connectionAccounts.id, id));
        return "deleted" as const;
      });
    },

    /**
     * Find or create the chat Model for `model` under the account. A new Model clones the account's newest chat
     * row (tuning, caching, parameters, preset override) without its role flags; the source row is untouched.
     */
    async findOrCreateModel(
      id: string,
      input: { model: string; name: string; maxContext?: number; maxTokensOverride?: number },
    ): Promise<{ connectionId: string; created: boolean } | "not_found" | "not_chat"> {
      return db.transaction(async (tx) => {
        const [account] = await tx.select().from(connectionAccounts).where(eq(connectionAccounts.id, id));
        if (!account) return "not_found" as const;
        const chatRows = (
          (await tx.select().from(apiConnections).where(eq(apiConnections.accountId, id))) as ConnectionRow[]
        )
          .filter((row) => isChatProvider(row.provider))
          .sort(newerFirst);
        const existing = chatRows.find((row) => row.model === input.model);
        if (existing) return { connectionId: existing.id, created: false };
        if (!isChatProvider(account.provider) && !chatRows.length) return "not_chat" as const;

        const timestamp = now();
        const template = chatRows[0];
        const base = template
          ? { ...template }
          : {
              provider: account.provider,
              baseUrl: account.baseUrl,
              apiKeyEncrypted: account.apiKeyEncrypted,
              managementTokenEncrypted: account.managementTokenEncrypted,
              showUsageWidget: account.showUsageWidget,
              showUsageFiveHour: account.showUsageFiveHour,
              showUsageWeekly: account.showUsageWeekly,
              treatAsLocalEndpoint: account.treatAsLocalEndpoint,
              profileImportReviewRequired: account.profileImportReviewRequired,
            };
        const connectionId = newId();
        await tx.insert(apiConnections).values({
          ...base,
          id: connectionId,
          name: input.name,
          model: input.model,
          accountId: id,
          isDefault: "false",
          fallbackForMain: "false",
          useForRandom: "false",
          defaultForAgents: "false",
          fallbackForAgents: "false",
          ...(input.maxContext !== undefined ? { maxContext: input.maxContext } : {}),
          ...(input.maxTokensOverride !== undefined ? { maxTokensOverride: input.maxTokensOverride } : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return { connectionId, created: true };
      });
    },
  };
}
