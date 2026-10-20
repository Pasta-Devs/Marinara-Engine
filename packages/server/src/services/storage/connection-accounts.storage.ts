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
  IMAGE_SOURCE_VENDOR,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  connectionBalanceSource,
  connectionBilling,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  isLocalAuthProvider,
  localAuthProviderBaseUrl,
  supportsSubscriptionUsageWidget,
  takesBalanceToken,
  withKeyTail,
  type ConnectionAccountListItem,
  type CreateConnectionAccountInput,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { setConnectionBudgetScope, setAccountRateLimit } from "../llm/connection-rate-limit-registry.js";
import { setAccountParallelLimit } from "../llm/account-budget.js";
import { logger } from "../../lib/logger.js";
// A cycle with connections.storage, safe: the functions are only called at request time.
import { catalogOf, readAccountCatalogs, readSavedModelList, withAccountCatalog } from "./connections.storage.js";

export type ConnectionRow = typeof apiConnections.$inferSelect;
export type ConnectionAccountRow = typeof connectionAccounts.$inferSelect;
/** What an account's saved catalog says about one model id. */
export type CatalogModelInfo = { name?: string; maxContext?: number; maxTokensOverride?: number };

/** The limits a pick sends, else the catalog's; a missing one stays absent so the schema default applies. */
export function pickLimits(
  sent: { maxContext?: number; maxTokensOverride?: number },
  catalog: CatalogModelInfo,
): { maxContext?: number; maxTokensOverride?: number } {
  const maxContext = sent.maxContext ?? catalog.maxContext;
  const maxTokensOverride = sent.maxTokensOverride ?? catalog.maxTokensOverride;
  return {
    ...(maxContext !== undefined ? { maxContext } : {}),
    ...(maxTokensOverride !== undefined ? { maxTokensOverride } : {}),
  };
}

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

/** NanoGPT keeps a usage-only management token; LinkAPI a dashboard access token for the account balance. */
const takesManagementToken = (row: { provider: string; baseUrl?: string | null }) =>
  row.provider === "nanogpt" || takesBalanceToken(row);

// ── Credential identity ─────────────────────────

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
      return IMAGE_SOURCE_VENDOR[source] ?? `media:${source}`;
    }
    case "video_generation": {
      const source = videoSourceOf(row);
      return VIDEO_SOURCE_VENDOR[source] ?? `media:${source}`;
    }
    case "audio": {
      const source = row.audioSource?.trim() ?? "";
      return AUDIO_SOURCE_VENDOR[source] ?? `audio:${source}`;
    }
    case "decision": {
      // A chat decision Model on a hosted service's address uses that service's key, so it
      // belongs to its Connection (NanoGPT, OpenRouter, …). A server the user runs stays apart,
      // so a local chat Model never joins an old Decision Connection at the same address.
      const origin = row.decisionSource === "openai_compatible" ? originOfUrl(trimUrl(row.baseUrl)) : "";
      const vendor = Object.values(PROVIDERS).find(
        (provider) =>
          provider.protocol === "openai_chat" && !!origin && originOfUrl(provider.defaultBaseUrl) === origin,
      );
      return vendor?.id ?? `decision:${row.decisionSource ?? ""}`;
    }
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

/** Whether two rows talk to the same effective endpoint (trailing slashes ignored, paths are case-sensitive). */
export function sameEndpoint(a: IdentityRow, b: IdentityRow): boolean {
  return credentialEndpoint(a) === credentialEndpoint(b);
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
function groupKeyOf(row: GroupableRow, plainKey: string, importedAccountId = ""): string {
  return [
    credentialVendor(row),
    credentialOrigin(row),
    keyDigest(plainKey),
    plainKey ? "" : credentialEndpoint(row).toLowerCase(),
    // Imported keys are blanked, so two keys on one endpoint look the same: their exported account keeps
    // them apart.
    row.profileImportReviewRequired === "true" ? `review:${importedAccountId}` : "",
  ].join("\u0000");
}

/**
 * A row that sends its key to an embeddings host on another origin keeps its own key: it never joins an account
 * by itself (an account key change detaches it for the same reason), so it stays a standalone Model.
 */
export function hasForeignEmbeddingHost(row: Pick<ConnectionRow, "embeddingBaseUrl"> & IdentityRow): boolean {
  return !!row.embeddingBaseUrl?.trim() && originOfUrl(trimUrl(row.embeddingBaseUrl)) !== credentialOrigin(row);
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

// ── Usage keys ("via X" upstreams) ──────────────

export type UsageKeyEntry = { accountId?: string; tokenEncrypted?: string };

/** The account's usage keys; a broken value reads as none. */
export function readUsageKeys(account: Pick<ConnectionAccountRow, "usageKeys">): Record<string, UsageKeyEntry> {
  try {
    const parsed: unknown = JSON.parse(account.usageKeys ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const keys: Record<string, UsageKeyEntry> = {};
    for (const [upstream, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const { accountId, tokenEncrypted } = value as Record<string, unknown>;
      if (typeof accountId === "string" && accountId) keys[upstream] = { accountId };
      else if (typeof tokenEncrypted === "string" && tokenEncrypted) keys[upstream] = { tokenEncrypted };
    }
    return keys;
  } catch {
    return {};
  }
}

/** For backups and profile exports: links stay, pasted keys stay on this install. */
export function withoutUsageKeyTokens(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const links = Object.entries(readUsageKeys({ usageKeys: value })).filter(([, entry]) => entry.accountId);
  return links.length ? JSON.stringify(Object.fromEntries(links)) : null;
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
    balanceUserId: account.balanceUserId ?? "",
    showUsageWidget: account.showUsageWidget === "true",
    showUsageFiveHour: account.showUsageFiveHour !== "false",
    showUsageWeekly: account.showUsageWeekly !== "false",
    treatAsLocalEndpoint: account.treatAsLocalEndpoint === "true",
    enabled,
    maxRequestsPerMinute: account.maxRequestsPerMinute ?? null,
    maxParallelJobs: account.maxParallelJobs ?? null,
    icon: account.icon ?? null,
    imagePath: account.imagePath ?? null,
    billing: connectionBilling(account),
    balanceSource: connectionBalanceSource({ ...account, apiKey: key }),
    usageKeys: Object.fromEntries(
      Object.entries(readUsageKeys(account)).map(([upstream, entry]) => [
        upstream,
        entry.accountId ? { accountId: entry.accountId, hasKey: false } : { hasKey: true },
      ]),
    ),
    profileImportReviewRequired: review,
    modelCount,
    state: !enabled ? "off" : review || accountNeedsKey(account) ? "needs_key" : "ok",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

// ── Migration and linking ───────────────────────

/** The automatic name of a Connection: the service, with the host for a custom or keyless remote endpoint. */
export function accountLabel(anchor: IdentityRow, keyless: boolean): string {
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

/**
 * Connections with the same key here get the same automatic name, so a new one adds its key's end (decision 28):
 * the service, and for a custom endpoint its address too ("Custom · host" already tells two hosts apart).
 */
export function accountSiblingKey(row: IdentityRow, keyless: boolean): string {
  return row.provider === "custom" ? accountLabel(row, keyless) : credentialVendor(row);
}

const ANCHOR_ORDER = ["chat", "image_generation", "video_generation", "audio", "decision"];
const anchorRank = (row: ConnectionRow) => ANCHOR_ORDER.indexOf(isChatProvider(row.provider) ? "chat" : row.provider);

const newerFirst = (a: ConnectionRow, b: ConnectionRow) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

// The account's own provider is the best-ranked row type (chat first).
const anchorOf = (rows: ConnectionRow[]) =>
  [...rows].sort((a, b) => anchorRank(a) - anchorRank(b) || newerFirst(a, b))[0]!;

function accountFromGroup(rows: ConnectionRow[], plainKey: string, hasSibling = false): ConnectionAccountRow {
  const anchor = anchorOf(rows);
  // Its newest row of the anchor's type supplies the flags.
  const sameType = rows.filter((row) => row.provider === anchor.provider).sort(newerFirst);
  const flags = sameType[0]!;
  const timestamp = now();
  const label = accountLabel(anchor, !plainKey);
  return {
    id: newId(),
    // Several keys of one provider get distinct names (decision 28); a Connection the user named stays as it is.
    name: hasSibling ? withKeyTail(label, plainKey) : label,
    provider: anchor.provider,
    // Stored explicitly (default endpoint included) so the account's origin is known without its rows.
    baseUrl: anchor.baseUrl || (isLocalAuthProvider(anchor.provider) ? "" : credentialEndpoint(anchor)),
    apiKeyEncrypted: sameType.find((row) => row.apiKeyEncrypted)?.apiKeyEncrypted ?? anchor.apiKeyEncrypted,
    managementTokenEncrypted: sameType.find((row) => row.managementTokenEncrypted)?.managementTokenEncrypted ?? "",
    balanceUserId: null,
    showUsageWidget: flags.showUsageWidget,
    showUsageFiveHour: flags.showUsageFiveHour,
    showUsageWeekly: flags.showUsageWeekly,
    treatAsLocalEndpoint: flags.treatAsLocalEndpoint,
    enabled: "true",
    maxRequestsPerMinute: null,
    maxParallelJobs: null,
    icon: null,
    imagePath: null,
    modelCatalogs: null,
    usageKeys: null,
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
    // An imported row that left its exported account still groups with the rows of that account only.
    const importedAccount = new Map<string, string>();

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
      if (row.profileImportReviewRequired === "true") importedAccount.set(row.id, row.accountId);
      await tx.update(apiConnections).set({ accountId: null }).where(eq(apiConnections.id, row.id));
      row.accountId = null;
      detached++;
    }

    // 2. Grouping by credential identity. Existing accounts are matched through their linked rows.
    const accountForGroup = new Map<string, string>();
    const byAge = (a: ConnectionRow, b: ConnectionRow) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    for (const row of [...rows].sort(byAge)) {
      if (row.accountId) {
        const key = groupKeyOf(row, keys.get(row.id) ?? "", row.accountId);
        if (!accountForGroup.has(key)) accountForGroup.set(key, row.accountId);
      }
    }
    for (const account of [...(accounts as ConnectionAccountRow[])].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )) {
      // An account without rows can only be matched by its own provider (chat accounts).
      if (rows.some((row) => row.accountId === account.id) || !isChatProvider(account.provider)) continue;
      const key = groupKeyOf(account, decryptApiKey(account.apiKeyEncrypted), account.id);
      if (!accountForGroup.has(key)) accountForGroup.set(key, account.id);
    }

    const groups = new Map<string, ConnectionRow[]>();
    const unlinked = rows
      .filter((row) => !row.accountId && !row.credentialsFromConnectionId && !hasForeignEmbeddingHost(row))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    for (const row of unlinked) {
      const key = groupKeyOf(row, keys.get(row.id) ?? "", importedAccount.get(row.id));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    // Services that will have more than one Connection: existing accounts plus the ones created below.
    const siblings = new Map<string, number>();
    const count = (key: string) => siblings.set(key, (siblings.get(key) ?? 0) + 1);
    const groupSiblingKey = (members: ConnectionRow[]) =>
      accountSiblingKey(anchorOf(members), !keys.get(members[0]!.id));
    for (const account of accounts as ConnectionAccountRow[]) {
      count(accountSiblingKey(account, !decryptApiKey(account.apiKeyEncrypted)));
    }
    for (const [groupKey, members] of groups) if (!accountForGroup.has(groupKey)) count(groupSiblingKey(members));

    for (const [groupKey, members] of groups) {
      let accountId = accountForGroup.get(groupKey);
      if (!accountId) {
        const hasSibling = (siblings.get(groupSiblingKey(members)) ?? 0) > 1;
        const account = accountFromGroup(members, keys.get(members[0]!.id) ?? "", hasSibling);
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
    await moveCatalogsToAccounts(tx);
    return { created, linked, detached };
  });
}

/**
 * Idempotent: a linked Model's own saved model list moves onto its Connection (one catalog per provider), so the
 * ~300 KB lists are kept once instead of once per Model. The newest list of a provider wins; Models of one Connection
 * and provider carried the same mirrored list before, so nothing else is lost. Pins stay on the rows.
 */
export async function moveCatalogsToAccounts(tx: DB): Promise<number> {
  const rows = ((await tx.select().from(apiConnections)) as ConnectionRow[]).filter(
    (row) => row.accountId && row.savedModels,
  );
  if (!rows.length) return 0;
  const accounts = new Map(
    ((await tx.select().from(connectionAccounts)) as ConnectionAccountRow[]).map((account) => [account.id, account]),
  );
  const changed = new Map<string, ConnectionAccountRow>();
  let moved = 0;
  for (const row of rows) {
    const account = changed.get(row.accountId!) ?? accounts.get(row.accountId!);
    // A row whose account is gone keeps its list; linking detaches it first.
    if (!account) continue;
    const list = readSavedModelList(row);
    const current = readAccountCatalogs(account)[row.provider];
    if (list && (!current || current.fetchedAt < list.fetchedAt)) {
      changed.set(account.id, { ...account, modelCatalogs: withAccountCatalog(account, row.provider, list) });
    }
    await tx.update(apiConnections).set({ savedModels: null }).where(eq(apiConnections.id, row.id));
    moved++;
  }
  for (const account of changed.values()) {
    await tx
      .update(connectionAccounts)
      .set({ modelCatalogs: account.modelCatalogs })
      .where(eq(connectionAccounts.id, account.id));
  }
  logger.info("[connections] Moved %d saved model list(s) onto their Connection", moved);
  return moved;
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
        managementTokenEncrypted: encryptApiKey(takesManagementToken(input) ? (input.managementToken ?? "") : ""),
        balanceUserId: takesBalanceToken(input) ? input.balanceUserId || null : null,
        showUsageWidget: String(supportsSubscriptionUsageWidget(input.provider) && (input.showUsageWidget ?? false)),
        showUsageFiveHour: String(input.showUsageFiveHour ?? true),
        showUsageWeekly: String(input.showUsageWeekly ?? true),
        treatAsLocalEndpoint: String(input.treatAsLocalEndpoint ?? false),
        enabled: String(input.enabled ?? true),
        maxRequestsPerMinute: input.maxRequestsPerMinute ?? null,
        maxParallelJobs: input.maxParallelJobs ?? null,
        icon: input.icon ?? null,
        imagePath: null as string | null,
        modelCatalogs: null as string | null,
        usageKeys: null as string | null,
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
        const target = { provider: account.provider, baseUrl: input.baseUrl ?? account.baseUrl };
        if (input.managementToken !== undefined && takesManagementToken(target)) {
          set.managementTokenEncrypted = encryptApiKey(input.managementToken);
        }
        if (input.balanceUserId !== undefined && takesBalanceToken(target)) {
          set.balanceUserId = input.balanceUserId || null;
        }
        // A LinkAPI Connection moved to another address keeps no LinkAPI token.
        if (input.baseUrl !== undefined && account.provider !== "nanogpt" && !takesBalanceToken(target)) {
          set.managementTokenEncrypted = encryptApiKey("");
          set.balanceUserId = null;
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
        // One picture at a time: a chosen logo, letters or a reset replaces an uploaded image.
        if (input.icon !== undefined) Object.assign(set, { icon: input.icon, imagePath: null });
        // Saving an endpoint or key is the explicit local review boundary (as for a single connection).
        if (credentialsTouched) set.profileImportReviewRequired = "false";
        const keyChanged = input.apiKey !== undefined && input.apiKey !== plainOldKey;
        const baseUrlChanged = input.baseUrl !== undefined && input.baseUrl !== account.baseUrl;
        // A different key or address can serve a different model list. The address belongs to the account's
        // own provider; other kinds keep their endpoint and so their list.
        if (keyChanged) set.modelCatalogs = null;
        else if (baseUrlChanged) set.modelCatalogs = withAccountCatalog(account, account.provider, null);
        await tx.update(connectionAccounts).set(set).where(eq(connectionAccounts.id, id));
        const updated: ConnectionAccountRow = { ...account, ...set };

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
          const detached = new Set<string>();
          const kept = new Set<string>();
          const isMedia = (provider: string) => provider === "image_generation" || provider === "video_generation";
          // The account row has no media source: the oldest linked row stands for the account's service.
          const representative = [...(rows as ConnectionRow[])].sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          )[0];
          for (const row of rows as ConnectionRow[]) {
            const sameType = row.provider === account.provider;
            // Image and video rows of one media server (Comfy) share its exact address, so an address edit moves both.
            const sharesMediaEndpoint =
              isMedia(row.provider) &&
              !!representative &&
              isMedia(representative.provider) &&
              credentialVendor(row) === credentialVendor(representative) &&
              !!trimUrl(account.baseUrl) &&
              credentialEndpoint(row) === trimUrl(account.baseUrl);
            const takesBaseUrl = (sameType || sharesMediaEndpoint) && input.baseUrl !== undefined;
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
              detached.add(row.provider);
              continue;
            }
            kept.add(row.provider);
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
          // A provider whose last Model left the account leaves no reader for its catalog, which may be stale too.
          const orphaned = [...detached].filter((provider) => !kept.has(provider));
          if (orphaned.length) {
            for (const provider of orphaned) updated.modelCatalogs = withAccountCatalog(updated, provider, null);
            await tx
              .update(connectionAccounts)
              .set({ modelCatalogs: updated.modelCatalogs })
              .where(eq(connectionAccounts.id, id));
          }
        }
        return updated;
      });
    },

    /** Link a Connection or save a usage-only key for one upstream; null removes it. */
    async setUsageKey(
      id: string,
      upstream: string,
      value: { accountId: string } | { key: string } | null,
    ): Promise<ConnectionAccountRow | null> {
      return db.transaction(async (tx) => {
        const [account] = await tx.select().from(connectionAccounts).where(eq(connectionAccounts.id, id));
        if (!account) return null;
        const keys = readUsageKeys(account);
        if (!value) delete keys[upstream];
        else
          keys[upstream] =
            "key" in value ? { tokenEncrypted: encryptApiKey(value.key) } : { accountId: value.accountId };
        const set = { usageKeys: Object.keys(keys).length ? JSON.stringify(keys) : null, updatedAt: now() };
        await tx.update(connectionAccounts).set(set).where(eq(connectionAccounts.id, id));
        return { ...account, ...set };
      });
    },

    /** Set an uploaded picture; it replaces a chosen logo or letters. */
    async setImage(id: string, imagePath: string): Promise<ConnectionAccountRow | null> {
      const account = await getConnectionAccount(db, id);
      if (!account) return null;
      const set = { icon: null, imagePath, updatedAt: now() };
      await db.update(connectionAccounts).set(set).where(eq(connectionAccounts.id, id));
      return { ...account, ...set };
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
     * The account's saved chat Model for `model`, the chat provider a new one would use, and what the
     * account's saved catalog says about `model` (name and limits).
     */
    async findChatModel(
      id: string,
      model: string,
    ): Promise<
      | { account: ConnectionAccountRow; existing: ConnectionRow | null; provider: string; catalog: CatalogModelInfo }
      | "not_found"
      | "not_chat"
    > {
      const account = await getConnectionAccount(db, id);
      if (!account) return "not_found";
      const linked = (await this.linkedRows(id)) as ConnectionRow[];
      const chatRows = linked.filter((row) => isChatProvider(row.provider)).sort(newerFirst);
      const provider = isChatProvider(account.provider) ? account.provider : chatRows[0]?.provider;
      if (!provider) return "not_chat";
      const entry = linked.map((row) => catalogOf(row, account)?.models.find((m) => m.id === model)).find(Boolean);
      const positive = (value: unknown) => (typeof value === "number" && value >= 1 ? Math.floor(value) : undefined);
      const catalog: CatalogModelInfo = {
        ...(entry?.name ? { name: entry.name } : {}),
        ...(positive(entry?.context) ? { maxContext: positive(entry?.context) } : {}),
        ...(positive(entry?.maxOutput) ? { maxTokensOverride: positive(entry?.maxOutput) } : {}),
      };
      return { account, existing: chatRows.find((row) => row.model === model) ?? null, provider, catalog };
    },
  };
}
