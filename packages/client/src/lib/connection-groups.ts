// ──────────────────────────────────────────────
// Connection groups: pure helpers that arrange saved Models (api_connections rows)
// under their Connection (account) for the switcher, the panel and ConnectionSelect.
// ──────────────────────────────────────────────
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { isConnectionFlagTrue } from "./connection-filters";

/** The Model row fields these helpers read. Flags may be "true"/"false" strings or booleans. */
export type ConnectionModelRow = {
  id: string;
  name?: string | null;
  model?: string | null;
  provider?: string | null;
  accountId?: string | null;
  credentialsFromConnectionId?: string | null;
  isDefault?: unknown;
  defaultForAgents?: unknown;
  fallbackForMain?: unknown;
  fallbackForAgents?: unknown;
  useForRandom?: unknown;
  /** The picture menu's choice and an uploaded picture. */
  icon?: string | null;
  imagePath?: string | null;
};

export type ConnectionGroup<R extends ConnectionModelRow = ConnectionModelRow> = {
  account: ConnectionAccountListItem;
  rows: R[];
};

/**
 * One group per Connection, in account order (empty Connections included), plus the standalone rows.
 * A Model that borrows credentials (a decision row) sits under its lender's Connection.
 * Chat and image Models of one key share a group (concept decision 20).
 */
export function groupModelsByAccount<R extends ConnectionModelRow>(
  rows: readonly R[],
  accounts: readonly ConnectionAccountListItem[],
): { groups: ConnectionGroup<R>[]; standalone: R[] } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const groups = new Map(accounts.map((account) => [account.id, { account, rows: [] as R[] }]));
  const standalone: R[] = [];
  for (const row of rows) {
    const lender = row.credentialsFromConnectionId ? byId.get(row.credentialsFromConnectionId) : undefined;
    const group = groups.get((lender ? lender.accountId : row.accountId) ?? "");
    if (group) group.rows.push(row);
    else standalone.push(row);
  }
  return { groups: [...groups.values()], standalone };
}

/** By model id: lists keep their places when a star or an edit touches a Model. */
export function sortByModelId<R extends { id: string; model?: string | null }>(rows: readonly R[]): R[] {
  return [...rows].sort((a, b) => (a.model ?? "").localeCompare(b.model ?? "") || a.id.localeCompare(b.id));
}

/** The gateway upstream of a model id: everything before the first "/" (`nanogpt/zai-org/glm` → `nanogpt`). */
export function upstreamOf(modelId: string | null | undefined): string | null {
  const id = modelId?.trim() ?? "";
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash) : null;
}

/**
 * Sub-headings by upstream, only when the rows show two or more distinct prefixes.
 * Otherwise one group with `upstream: null`. Rows without a prefix come last.
 */
export function subgroupByUpstream<R extends { model?: string | null }>(
  rows: readonly R[],
): Array<{ upstream: string | null; rows: R[] }> {
  const groups = new Map<string | null, R[]>();
  for (const row of rows) {
    const upstream = upstreamOf(row.model);
    groups.set(upstream, [...(groups.get(upstream) ?? []), row]);
  }
  const prefixes = [...groups.keys()].filter((key): key is string => key !== null);
  if (prefixes.length < 2) return [{ upstream: null, rows: [...rows] }];
  const result: Array<{ upstream: string | null; rows: R[] }> = prefixes.map((upstream) => ({
    upstream,
    rows: groups.get(upstream)!,
  }));
  const bare = groups.get(null);
  if (bare) result.push({ upstream: null, rows: bare });
  return result;
}

/**
 * The Models of the most recently updated chats: distinct, newest first, at most `limit`.
 * `currentId` (the Model in use) is left out.
 */
export function recentModels<R extends ConnectionModelRow>(
  chats: ReadonlyArray<{ connectionId?: string | null; updatedAt?: string | null }>,
  rows: readonly R[],
  limit = 3,
  currentId?: string | null,
): R[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const sorted = [...chats].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const seen = new Set<string>();
  const result: R[] = [];
  for (const chat of sorted) {
    const row = chat.connectionId ? byId.get(chat.connectionId) : undefined;
    if (!row || row.id === currentId || seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
    if (result.length >= limit) break;
  }
  return result;
}

export type RoleBadge = "main" | "agents" | "fallback" | "random";

/** The roles a Model holds; localized as `connections.switcher.role.<badge>`. */
export function roleBadges(row: ConnectionModelRow): RoleBadge[] {
  const badges: RoleBadge[] = [];
  if (isConnectionFlagTrue(row.isDefault)) badges.push("main");
  if (isConnectionFlagTrue(row.defaultForAgents)) badges.push("agents");
  if (isConnectionFlagTrue(row.fallbackForMain) || isConnectionFlagTrue(row.fallbackForAgents)) badges.push("fallback");
  if (isConnectionFlagTrue(row.useForRandom)) badges.push("random");
  return badges;
}

/** The i18n key of the one-word state shown on a Connection card. */
export function accountStateLabel(account: Pick<ConnectionAccountListItem, "state">): string {
  return `connections.accounts.state.${account.state}`;
}
