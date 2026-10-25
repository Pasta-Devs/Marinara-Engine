// ──────────────────────────────────────────────
// Connection groups: pure helpers that arrange saved Models (api_connections rows)
// under their Connection (account) for the switcher, the panel and ConnectionSelect.
// ──────────────────────────────────────────────
import { PROVIDERS, type APIProvider, type ConnectionAccountListItem } from "@marinara-engine/shared";
import { isConnectionFlagTrue } from "./connection-filters";
import { sortBasicPanelItems, type BasicPanelSort } from "./panel-sort";

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
  folderId?: string | null;
  sortOrder?: number;
};

export type ConnectionGroup<R extends ConnectionModelRow = ConnectionModelRow> = {
  account: ConnectionAccountListItem;
  rows: R[];
};

/** The first saved Model places the whole account card; old split folders stay intact until a card moves. */
export function connectionGroupFolder(group: ConnectionGroup): string | null {
  return (
    [...group.rows].sort(
      (a, b) =>
        (Number.isFinite(a.sortOrder) ? a.sortOrder! : Number.MAX_SAFE_INTEGER) -
          (Number.isFinite(b.sortOrder) ? b.sortOrder! : Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
    )[0]?.folderId ?? null
  );
}

/** Existing Model sortOrder also orders account cards. Empty accounts use the saved library order. */
export function sortConnectionGroups<R extends ConnectionModelRow>(
  groups: readonly ConnectionGroup<R>[],
  sort: BasicPanelSort | "custom",
  emptyOrder: readonly string[] = [],
): ConnectionGroup<R>[] {
  if (sort !== "custom")
    return sortBasicPanelItems(
      groups,
      sort,
      (group) => group.account.name,
      (group) => group.account.createdAt,
    );
  const rank = (group: ConnectionGroup<R>) => {
    const orders = group.rows.map((row) => row.sortOrder).filter((value): value is number => Number.isFinite(value));
    return orders.length ? Math.min(...orders) : Infinity;
  };
  // The library order includes empty cards and permits a single order across provider families and folders.
  const saved = new Map(emptyOrder.map((id, index) => [id, index]));
  return [...groups].sort(
    (a, b) =>
      (saved.get(a.account.id) ?? Infinity) - (saved.get(b.account.id) ?? Infinity) ||
      rank(a) - rank(b) ||
      a.account.name.localeCompare(b.account.name),
  );
}

/** The panel's account-card order: the sort mode, then a saved Custom order on top when active. */
export function orderAccountGroups<R extends ConnectionModelRow>(
  groups: readonly ConnectionGroup<R>[],
  sort: BasicPanelSort | "custom",
  saved?: { active?: boolean; ids?: readonly string[] },
): ConnectionGroup<R>[] {
  const sorted = sortConnectionGroups(groups, sort, saved?.ids ?? []);
  if (sort !== "custom" || !saved?.active) return sorted;
  const rank = new Map((saved.ids ?? []).map((id, index) => [id, index]));
  return sorted.sort((a, b) => (rank.get(a.account.id) ?? Infinity) - (rank.get(b.account.id) ?? Infinity));
}

/** Move an account card block while keeping hidden cards and every model row in its account together. */
export function reorderConnectionGroups<R extends ConnectionModelRow>(
  groups: readonly ConnectionGroup<R>[],
  orderedIds: readonly string[],
  accountIds: readonly string[],
) {
  const moving = new Set(accountIds);
  const byAccount = new Map(groups.map((group) => [group.account.id, group]));
  const ordered = orderedIds.flatMap((id) => byAccount.get(id)?.rows ?? []);
  return [...ordered, ...groups.filter((group) => !moving.has(group.account.id)).flatMap((group) => group.rows)];
}

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

/** Names for model-id prefixes that are not a Marinara service id. */
const PREFIX_NAMES: Record<string, string> = {
  linkapi: "LinkAPI",
  arliai: "ArliAI",
  "zai-org": "Z.AI",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  "deepseek-ai": "DeepSeek",
  mistralai: "Mistral",
  moonshotai: "Moonshot",
  qwen: "Qwen",
  google: "Google",
  minimax: "MiniMax",
  nousresearch: "Nous Research",
  nvidia: "NVIDIA",
  microsoft: "Microsoft",
};

/** The display name of a model-id prefix (a gateway route or a model maker), or undefined when it is not known. */
export function knownPrefixName(prefix: string): string | undefined {
  const key = prefix.toLowerCase();
  return PROVIDERS[key as APIProvider]?.name ?? PREFIX_NAMES[key];
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

/** The roles a Model holds, as plain keys; the row badges take their names from the job table (`modelRoleLabels`). */
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
