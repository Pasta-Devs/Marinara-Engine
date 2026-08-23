import type { DB } from "../../db/connection.js";
import { migrateLegacyNoodleAccountRow } from "../../db/noodle-platform-migration.js";
import {
  noodleAccountSubscriptions,
  noodleAccounts,
  noodleInteractions,
  noodlePostUnlocks,
} from "../../db/schema/noodle.js";
import { remapNoodlerReservePolicyFingerprint } from "../storage/noodle.storage.js";
import { newId } from "../../utils/id-generator.js";
import { ProfileImportRequestError } from "./profile-import-errors.js";

type Row = Record<string, unknown>;
type Snapshot = { tables: Record<string, Row[]> };
export type ProfileNoodleImportWarning = {
  type: "noodle_handle_conflict";
  path?: string;
  message: string;
};
type ProfileImportWarning = ProfileNoodleImportWarning | { type: "missing_asset"; path: string; message: string };

type AccountIdentity = { platform: string; kind: string; entityId: string };

function accountIdentity(row: Row): AccountIdentity {
  return {
    platform: typeof row.platform === "string" ? row.platform : "noodle",
    kind: typeof row.kind === "string" ? row.kind : "",
    entityId: typeof row.entityId === "string" ? row.entityId : "",
  };
}

function identityKey(identity: AccountIdentity) {
  return `${identity.platform}\u0000${identity.kind}\u0000${identity.entityId}`;
}

function normalizeHandle(value: unknown, fallback: string) {
  const base = (typeof value === "string" && value ? value : fallback || "noodle")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return base || "noodle";
}

function suffixedHandle(base: string, suffix: number) {
  const text = `_${suffix}`;
  return `${base.slice(0, Math.max(1, 36 - text.length))}${text}`;
}

function allocateHandle(base: string, reserved: ReadonlySet<string>) {
  if (!reserved.has(base)) return base;
  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = suffixedHandle(base, suffix);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique Noodle handle");
}

function addProfileNoodleImportWarning(warnings: ProfileImportWarning[], warning: ProfileNoodleImportWarning) {
  if (!warnings.some((candidate) => candidate.type === warning.type && candidate.message === warning.message)) {
    warnings.push(warning);
  }
}

function parseObject(value: unknown): Row {
  if (typeof value === "string") {
    try {
      return parseObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Row) } : {};
}

function remapStringArray(value: unknown, accountMap: ReadonlyMap<string, string>) {
  const parsed = Array.isArray(value) ? value : parseJson(value);
  if (!Array.isArray(parsed)) return value;
  return parsed.map((entry) => (typeof entry === "string" ? (accountMap.get(entry) ?? entry) : entry));
}

function remapAccountSettings(value: unknown, accountMap: ReadonlyMap<string, string>) {
  const settings = parseObject(value);
  const privacy = parseObject(settings.privacy);
  const access = parseObject(privacy.access);
  const social = parseObject(settings.social);
  const followingAccountIds = remapStringArray(social.followingAccountIds, accountMap);
  const followingAccountTimestamps = parseObject(social.followingAccountTimestamps);
  const remappedTimestamps = Object.fromEntries(
    Object.entries(followingAccountTimestamps).map(([id, timestamp]) => [accountMap.get(id) ?? id, timestamp]),
  );

  return JSON.stringify({
    ...settings,
    privacy: {
      ...privacy,
      access: { ...access, hiddenFromAccountIds: remapStringArray(access.hiddenFromAccountIds, accountMap) },
    },
    social: { ...social, followingAccountIds, followingAccountTimestamps: remappedTimestamps },
  });
}

function remapJsonArray(value: unknown, accountMap: ReadonlyMap<string, string>) {
  const parsed = Array.isArray(value) ? value : parseJson(value);
  if (!Array.isArray(parsed)) return value;
  return JSON.stringify(parsed.map((entry) => (typeof entry === "string" ? (accountMap.get(entry) ?? entry) : entry)));
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function remapSnapshotRows(snapshot: Snapshot, accountMap: ReadonlyMap<string, string>) {
  if ([...accountMap].every(([sourceId, destinationId]) => sourceId === destinationId)) return snapshot;

  const tables = { ...snapshot.tables };
  for (const tableName of [
    "noodle_accounts",
    "noodle_posts",
    "noodle_account_subscriptions",
    "noodle_post_unlocks",
    "noodle_interactions",
    "noodle_activity_digests",
    "noodle_refresh_runs",
    "noodler_prepared_posts",
    "noodler_creator_reply_claims",
  ]) {
    const sourceRows = snapshot.tables[tableName];
    if (!sourceRows) continue;
    tables[tableName] = sourceRows.map((sourceRow) => {
      const row = { ...sourceRow };
      if (tableName === "noodle_accounts") {
        row.id = accountMap.get(String(row.id)) ?? row.id;
        if (row.noodleAccountId != null)
          row.noodleAccountId = accountMap.get(String(row.noodleAccountId)) ?? row.noodleAccountId;
        row.settings = remapAccountSettings(row.settings, accountMap);
      } else if (tableName === "noodle_posts") {
        row.authorAccountId = accountMap.get(String(row.authorAccountId)) ?? row.authorAccountId;
      } else if (tableName === "noodle_account_subscriptions") {
        row.viewerAccountId = accountMap.get(String(row.viewerAccountId)) ?? row.viewerAccountId;
        row.creatorAccountId = accountMap.get(String(row.creatorAccountId)) ?? row.creatorAccountId;
      } else if (tableName === "noodle_post_unlocks") {
        row.viewerAccountId = accountMap.get(String(row.viewerAccountId)) ?? row.viewerAccountId;
      } else if (tableName === "noodle_interactions") {
        row.actorAccountId = accountMap.get(String(row.actorAccountId)) ?? row.actorAccountId;
      } else if (tableName === "noodle_activity_digests") {
        row.accountIds = remapJsonArray(row.accountIds, accountMap);
      } else if (tableName === "noodle_refresh_runs") {
        row.activeAccountIds = remapJsonArray(row.activeAccountIds, accountMap);
      } else if (tableName === "noodler_prepared_posts" || tableName === "noodler_creator_reply_claims") {
        // Reserve rows and reply claims point at the creator account; left unremapped they dangle
        // or attach to whichever creator happens to hold the source ID after the collision rename.
        row.creatorAccountId = accountMap.get(String(row.creatorAccountId)) ?? row.creatorAccountId;
        // The prepared row's policy fingerprint embeds the linked source account ID too, and a
        // stale one makes reconciliation discard the restored reserve on the next poll.
        if (tableName === "noodler_prepared_posts") {
          row.policyFingerprint = remapNoodlerReservePolicyFingerprint(row.policyFingerprint, accountMap);
        }
      }
      return row;
    });
  }
  return { ...snapshot, tables };
}

export async function planProfileNoodleImport(
  db: DB,
  snapshot: Snapshot,
  warnings: ProfileImportWarning[],
): Promise<Snapshot> {
  const importedRows = (snapshot.tables.noodle_accounts ?? []).map((row) => migrateLegacyNoodleAccountRow({ ...row }));
  if (importedRows.length === 0) return snapshot;

  const importedByIdentity = new Map<string, Row>();
  for (const row of importedRows) {
    const key = identityKey(accountIdentity(row));
    if (importedByIdentity.has(key)) {
      throw new ProfileImportRequestError(`Profile contains duplicate Noodle account identity: ${key}`);
    }
    importedByIdentity.set(key, row);
  }

  const destinationRows = (await db.select().from(noodleAccounts)) as Row[];
  const destinationByIdentity = new Map<string, Row>();
  const destinationById = new Map<string, Row>();
  const destinationByNoodleAccountId = new Map<string, Row>();
  for (const row of destinationRows) {
    destinationById.set(String(row.id), row);
    destinationByIdentity.set(identityKey(accountIdentity(row)), row);
    if (row.noodleAccountId != null) destinationByNoodleAccountId.set(String(row.noodleAccountId), row);
  }

  const accountMap = new Map<string, string>();
  for (const sourceRow of importedRows) {
    const sourceId = String(sourceRow.id);
    const identity = accountIdentity(sourceRow);
    const existingById = destinationById.get(sourceId);
    const existingByIdentity = destinationByIdentity.get(identityKey(identity));
    const destination =
      existingById && identityKey(accountIdentity(existingById)) === identityKey(identity)
        ? existingById
        : existingByIdentity;
    let destinationId = destination ? String(destination.id) : sourceId;
    if (!destination && destinationById.has(destinationId)) {
      do destinationId = newId();
      while (destinationById.has(destinationId) || accountMapHasValue(accountMap, destinationId));
    }
    accountMap.set(sourceId, destinationId);
  }

  const importedByNoodleAccountId = new Map<string, Row>();
  for (const sourceRow of importedRows) {
    if (sourceRow.noodleAccountId == null) continue;
    const sourceId = String(sourceRow.id);
    const destinationNoodleAccountId =
      accountMap.get(String(sourceRow.noodleAccountId)) ?? String(sourceRow.noodleAccountId);
    const existingSource = importedByNoodleAccountId.get(destinationNoodleAccountId);
    const destinationOwner = destinationByNoodleAccountId.get(destinationNoodleAccountId);
    const identity = identityKey(accountIdentity(sourceRow));

    if (existingSource && identityKey(accountIdentity(existingSource)) !== identity) {
      throw new ProfileImportRequestError(
        `Profile contains multiple Noodle account identities linked to ${destinationNoodleAccountId}.`,
      );
    }
    importedByNoodleAccountId.set(destinationNoodleAccountId, sourceRow);

    if (!destinationOwner) continue;
    if (identityKey(accountIdentity(destinationOwner)) !== identity) {
      throw new ProfileImportRequestError(
        `Noodle account ${destinationNoodleAccountId} is already linked to another profile identity.`,
      );
    }

    const ownerId = String(destinationOwner.id);
    const currentDestinationId = accountMap.get(sourceId);
    if (currentDestinationId !== ownerId && accountMapHasValue(accountMap, ownerId)) {
      throw new ProfileImportRequestError(`Profile contains conflicting Noodle account mapping for ${ownerId}.`);
    }
    accountMap.set(sourceId, ownerId);
  }

  const reservedHandles = new Set(
    destinationRows
      .filter((row) => accountIdentity(row).platform !== "noodler")
      .map((row) => normalizeHandle(row.handle, String(row.entityId))),
  );
  for (const sourceRow of importedRows) {
    if (accountIdentity(sourceRow).platform === "noodler") continue;
    const sourceId = String(sourceRow.id);
    const destinationId = accountMap.get(sourceId)!;
    const destination = destinationById.get(destinationId);
    const desired = normalizeHandle(sourceRow.handle, String(sourceRow.entityId));
    const ownHandle = destination ? normalizeHandle(destination.handle, String(destination.entityId)) : null;
    if (ownHandle === desired) continue;
    if (reservedHandles.has(desired) && desired !== ownHandle) {
      const replacement = allocateHandle(desired, reservedHandles);
      const message = `Noodle handle "${desired}" was already used by another account and was imported as "${replacement}".`;
      addProfileNoodleImportWarning(warnings, { type: "noodle_handle_conflict", message });
      sourceRow.handle = replacement;
      reservedHandles.add(replacement);
    } else {
      sourceRow.handle = desired;
      reservedHandles.add(desired);
    }
  }

  const planned = remapSnapshotRows(
    { ...snapshot, tables: { ...snapshot.tables, noodle_accounts: importedRows } },
    accountMap,
  );
  return remapExistingDependentIds(db, planned);
}

function accountMapHasValue(accountMap: ReadonlyMap<string, string>, value: string) {
  for (const mapped of accountMap.values()) if (mapped === value) return true;
  return false;
}

async function remapExistingDependentIds(db: DB, snapshot: Snapshot) {
  const reconcile = async (tableName: string, key: (row: Row) => string, table: unknown) => {
    const existingRows = (await db.select().from(table as any)) as Row[];
    const existingByKey = new Map(existingRows.map((row) => [key(row), String(row.id)]));
    const sourceRows = snapshot.tables[tableName] ?? [];
    let remappedRows: Row[] | null = null;
    for (const [index, row] of sourceRows.entries()) {
      const existingId = existingByKey.get(key(row));
      if (!existingId || existingId === row.id) continue;
      remappedRows ??= [...sourceRows];
      remappedRows[index] = { ...row, id: existingId };
    }
    if (remappedRows) snapshot = { ...snapshot, tables: { ...snapshot.tables, [tableName]: remappedRows } };
  };

  await reconcile(
    "noodle_account_subscriptions",
    (row) => `${row.viewerAccountId}\u0000${row.creatorAccountId}`,
    noodleAccountSubscriptions,
  );
  await reconcile("noodle_post_unlocks", (row) => `${row.viewerAccountId}\u0000${row.postId}`, noodlePostUnlocks);
  await reconcile(
    "noodle_interactions",
    (row) =>
      row.type === "like" || row.type === "repost"
        ? `${row.postId}\u0000${row.actorAccountId}\u0000${row.type}\u0000${row.parentInteractionId ?? ""}`
        : String(row.id),
    noodleInteractions,
  );
  return snapshot;
}
