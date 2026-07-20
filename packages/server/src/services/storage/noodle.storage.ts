// ──────────────────────────────────────────────
// Storage: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { and, desc, eq, gt, inArray, isNull, lt } from "../../db/file-query.js";
import {
  DEFAULT_NOODLE_SETTINGS,
  noodleAccountProfileSettingsSchema,
  noodleAccountPrivacySettingsSchema,
  noodleAccountSocialSettingsSchema,
  noodleSettingsSchema,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodleAccountKind,
  type NoodleAccountProfileUpdateInput,
  type NoodleAccountSettings,
  type NoodleAccountSettingsPatchInput,
  type NoodleAccountSubscription,
  type NoodleAccountUpdateInput,
  type NoodleAvatarCrop,
  type NoodleAuthorSnapshot,
  type NoodleBootstrap,
  type NoodleCreateInteractionInput,
  type NoodleCreatePostInput,
  type NoodleDigestEntry,
  type NoodleInteraction,
  type NoodleInteractionType,
  type NoodleCarryoverMode,
  type NoodleCarryoverTarget,
  type NoodlePost,
  type NoodlePostAccess,
  type NoodlePostUnlock,
  type NoodlePostUpdateInput,
  type NoodlePostSource,
  type NoodleStageProfileInput,
  type NoodlerStageProfile,
  type NoodlerManagedStageProfile,
  type NoodleRefreshAttempt,
  type NoodleRefreshRun,
  type NoodleRemoveInteractionInput,
  type NoodleSettings,
  type NoodleSettingsUpdateInput,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { isNoodlerHiddenFromViewer } from "../noodle/noodler-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
} from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import {
  clearNoodleRefreshFailure,
  noodleRefreshSchedulerStatus,
  parsePersistedNoodleRefreshSchedule,
  reconcileNoodleRefreshSchedule,
  type PersistedNoodleRefreshSchedule,
} from "../noodle/noodle-refresh-schedule.js";

const NOODLE_SETTINGS_KEY = "noodle.settings";
const NOODLE_REFRESH_SCHEDULE_KEY = "noodle.refresh-schedule";
const NOODLE_CARRYOVER_TARGETS: NoodleCarryoverTarget[] = ["conversation", "roleplay", "game"];

type AccountRow = typeof noodleAccounts.$inferSelect;
type PostRow = typeof noodlePosts.$inferSelect;
type InteractionRow = typeof noodleInteractions.$inferSelect;
type DigestRow = typeof noodleActivityDigests.$inferSelect;
type RefreshRunRow = typeof noodleRefreshRuns.$inferSelect;
type SubscriptionRow = typeof noodleAccountSubscriptions.$inferSelect;
type PostUnlockRow = typeof noodlePostUnlocks.$inferSelect;

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function emptyNoodleAccountSettings(): NoodleAccountSettings {
  return {
    profile: {},
    social: {},
    scheduler: {},
    privacy: { access: { hiddenFromAccountIds: [], subscriptionIncludesPpv: false } },
  };
}

function nestedOrLegacy(nested: Record<string, unknown>, legacy: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : legacy[key];
}

function normalizePersistedBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function validProfileField(key: string, value: unknown): NoodleAccountSettings["profile"] {
  if (value === undefined) return {};
  const parsed = noodleAccountProfileSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

function validSocialField(key: string, value: unknown): NoodleAccountSettings["social"] {
  if (value === undefined) return {};
  const parsed = noodleAccountSocialSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

function validPrivacyField(key: string, value: unknown): NoodleAccountSettings["privacy"] {
  const empty = { access: { hiddenFromAccountIds: [], subscriptionIncludesPpv: false } };
  if (value === undefined) return empty;
  const parsed = noodleAccountPrivacySettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : empty;
}

export function normalizeNoodleAccountSettings(value: unknown): NoodleAccountSettings {
  const raw = parseRecord(value);
  const rawProfile = parseRecord(raw.profile);
  const rawSocial = parseRecord(raw.social);
  const rawPrivacy = parseRecord(raw.privacy);
  const rawAvatarCrop = nestedOrLegacy(rawProfile, raw, "avatarCrop");
  const rawBannerUrl = nestedOrLegacy(rawProfile, raw, "bannerUrl");
  const rawLocation = nestedOrLegacy(rawProfile, raw, "location");
  const rawProfileGenerated = nestedOrLegacy(rawProfile, raw, "profileGenerated");
  const rawProfileManuallyEdited = nestedOrLegacy(rawProfile, raw, "profileManuallyEdited");
  const rawFollowingAccountIds = nestedOrLegacy(rawSocial, raw, "followingAccountIds");
  const rawFollowingAccountTimestamps = nestedOrLegacy(rawSocial, raw, "followingAccountTimestamps");
  const rawNotificationsReadAt = nestedOrLegacy(rawSocial, raw, "notificationsReadAt");
  const rawIdentityDisclosure = nestedOrLegacy(rawPrivacy, raw, "identityDisclosure");
  const rawStagePersonality = nestedOrLegacy(rawPrivacy, raw, "stagePersonality");
  const rawAccess = parseRecord(rawPrivacy.access);
  const normalizedAvatarCrop = rawAvatarCrop === null ? null : parseNoodleAvatarCrop(rawAvatarCrop);
  const profile = {
    ...(rawAvatarCrop !== undefined &&
      (rawAvatarCrop === null || normalizedAvatarCrop !== null) &&
      validProfileField("avatarCrop", normalizedAvatarCrop)),
    ...(rawBannerUrl !== undefined && validProfileField("bannerUrl", rawBannerUrl)),
    ...(rawLocation !== undefined && validProfileField("location", rawLocation)),
    ...(rawProfileGenerated !== undefined &&
      validProfileField("profileGenerated", normalizePersistedBoolean(rawProfileGenerated))),
    ...(rawProfileManuallyEdited !== undefined &&
      validProfileField("profileManuallyEdited", normalizePersistedBoolean(rawProfileManuallyEdited))),
  };
  const followingAccountTimestamps = Object.fromEntries(
    Object.entries(parseRecord(rawFollowingAccountTimestamps)).filter(
      ([accountId, timestamp]) =>
        noodleAccountSocialSettingsSchema.safeParse({ followingAccountTimestamps: { [accountId]: timestamp } }).success,
    ),
  );
  const social = {
    ...(rawFollowingAccountIds !== undefined &&
      validSocialField("followingAccountIds", parseStringArray(rawFollowingAccountIds))),
    ...(rawFollowingAccountTimestamps !== undefined &&
      validSocialField("followingAccountTimestamps", followingAccountTimestamps)),
    ...(rawNotificationsReadAt !== undefined && validSocialField("notificationsReadAt", rawNotificationsReadAt)),
  };
  const privacy = {
    ...(rawIdentityDisclosure !== undefined && validPrivacyField("identityDisclosure", rawIdentityDisclosure)),
    ...(rawStagePersonality !== undefined && validPrivacyField("stagePersonality", rawStagePersonality)),
    access: {
      hiddenFromAccountIds: parseStringArray(rawAccess.hiddenFromAccountIds),
      subscriptionIncludesPpv: normalizePersistedBoolean(rawAccess.subscriptionIncludesPpv) ?? false,
    },
  };
  return {
    profile,
    social,
    scheduler: {},
    privacy,
  };
}

function parseRefreshAttempts(value: unknown): NoodleRefreshAttempt[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): NoodleRefreshAttempt[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const kind = candidate.kind;
    if (kind !== "initial" && kind !== "text_only_fallback" && kind !== "correction") return [];
    if (
      typeof candidate.sequence !== "number" ||
      !Number.isInteger(candidate.sequence) ||
      candidate.sequence < 1 ||
      typeof candidate.response !== "string" ||
      (candidate.rejectionReason !== null && typeof candidate.rejectionReason !== "string") ||
      typeof candidate.createdAt !== "string"
    ) {
      return [];
    }
    return [
      {
        sequence: candidate.sequence,
        kind,
        response: candidate.response,
        rejectionReason: candidate.rejectionReason,
        createdAt: candidate.createdAt,
      },
    ];
  });
}

export function parseNoodleAvatarCrop(value: unknown): NoodleAvatarCrop | null {
  let parsed = value;
  if (typeof parsed === "string") {
    if (!parsed.trim()) return null;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const crop = parsed as Record<string, unknown>;
  const finite = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry);
  if (
    finite(crop.srcX) &&
    finite(crop.srcY) &&
    finite(crop.srcWidth) &&
    finite(crop.srcHeight) &&
    crop.srcWidth > 0 &&
    crop.srcHeight > 0
  ) {
    return { srcX: crop.srcX, srcY: crop.srcY, srcWidth: crop.srcWidth, srcHeight: crop.srcHeight };
  }
  if (finite(crop.zoom) && finite(crop.offsetX) && finite(crop.offsetY) && crop.zoom > 0) {
    return {
      zoom: crop.zoom,
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
      ...(crop.fullImage === true ? { fullImage: true } : {}),
    };
  }
  return null;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseAuthorSnapshot(value: unknown): NoodleAuthorSnapshot | null {
  const parsed = parseRecord(value);
  const id = typeof parsed.id === "string" ? parsed.id : "";
  const kind =
    parsed.kind === "persona" || parsed.kind === "character" || parsed.kind === "random_user" ? parsed.kind : null;
  const entityId = typeof parsed.entityId === "string" ? parsed.entityId : "";
  const handle = typeof parsed.handle === "string" ? parsed.handle : "";
  const displayName = typeof parsed.displayName === "string" ? parsed.displayName : "";
  if (!id || !kind || !entityId || !handle || !displayName) return null;
  return {
    id,
    kind,
    entityId,
    handle,
    displayName,
    avatarUrl: typeof parsed.avatarUrl === "string" && parsed.avatarUrl ? parsed.avatarUrl : null,
    avatarCrop: parseNoodleAvatarCrop(parsed.avatarCrop),
  };
}

function normalizeBool(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeHandle(name: string, fallback: string) {
  const base = (name || fallback || "noodle")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return base || "noodle";
}

function normalizeAccountKind(kind: string): NoodleAccountKind {
  if (kind === "character" || kind === "random_user") return kind;
  return "persona";
}

function legacyCarryoverTargets(mode: NoodleCarryoverMode): NoodleCarryoverTarget[] {
  if (mode === "all") return [...NOODLE_CARRYOVER_TARGETS];
  if (mode === "conversation" || mode === "roleplay" || mode === "game") return [mode];
  return [];
}

function legacyCarryoverMode(targets: NoodleCarryoverTarget[]): NoodleCarryoverMode {
  const selected = new Set(targets);
  if (NOODLE_CARRYOVER_TARGETS.every((target) => selected.has(target))) return "all";
  if (targets.length === 1) return targets[0]!;
  return "off";
}

function isToggleInteractionType(type: NoodleInteractionType) {
  return type === "like" || type === "repost";
}

export function normalizeNoodleSettings(raw: unknown): NoodleSettings {
  const rawRecord = parseRecord(raw);
  const migratedMaxImagesPerRefresh =
    rawRecord.maxImagesPerRefresh ?? rawRecord.maxImagePromptsPerDay ?? DEFAULT_NOODLE_SETTINGS.maxImagesPerRefresh;
  const parsed = noodleSettingsSchema.safeParse({
    ...DEFAULT_NOODLE_SETTINGS,
    ...rawRecord,
    maxImagesPerRefresh: migratedMaxImagesPerRefresh,
  });
  if (!parsed.success) return noodleSettingsSchema.parse(DEFAULT_NOODLE_SETTINGS);
  const min = Math.min(parsed.data.participantMin, parsed.data.participantMax);
  const max = Math.max(parsed.data.participantMin, parsed.data.participantMax);
  const providedCarryoverModes = Array.isArray(rawRecord.carryoverModes);
  const carryoverModes = Array.from(
    new Set(parsed.data.carryoverModes.filter((mode) => NOODLE_CARRYOVER_TARGETS.includes(mode))),
  );
  const normalizedCarryoverModes =
    carryoverModes.length > 0 || providedCarryoverModes
      ? carryoverModes
      : legacyCarryoverTargets(parsed.data.carryoverMode);
  return {
    ...parsed.data,
    participantMin: min,
    participantMax: max,
    carryoverModes: normalizedCarryoverModes,
    carryoverMode: legacyCarryoverMode(normalizedCarryoverModes),
  };
}

function mapAccount(row: AccountRow): NoodleAccount {
  const settings = normalizeNoodleAccountSettings(row.settings);
  return {
    id: row.id,
    kind: normalizeAccountKind(row.kind),
    entityId: row.entityId,
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio ?? "",
    avatarUrl: row.avatarUrl ?? null,
    avatarCrop: settings.profile.avatarCrop ?? null,
    invited: normalizeBool(row.invited),
    settings,
    visibility: row.visibility === "private" ? "private" : "public",
    publicAccountId: row.publicAccountId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshotForAccount(account: NoodleAccount): NoodleAuthorSnapshot {
  return {
    id: account.id,
    kind: account.kind,
    entityId: account.entityId,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    avatarCrop: account.avatarCrop,
  };
}

function mapPost(row: PostRow): NoodlePost {
  return {
    id: row.id,
    authorAccountId: row.authorAccountId,
    content: row.content ?? "",
    imageUrl: row.imageUrl ?? null,
    imagePrompt: row.imagePrompt ?? null,
    parentPostId: row.parentPostId ?? null,
    quotePostId: row.quotePostId ?? null,
    source: row.source === "generated" ? "generated" : "manual",
    access: row.access === "subscriber" || row.access === "ppv" ? row.access : "public",
    ppvPrice: typeof row.ppvPrice === "number" && Number.isFinite(row.ppvPrice) ? row.ppvPrice : null,
    metadata: parseRecord(row.metadata),
    authorSnapshot: parseAuthorSnapshot(row.authorSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSubscription(row: SubscriptionRow): NoodleAccountSubscription {
  return {
    id: row.id,
    viewerAccountId: row.viewerAccountId,
    creatorAccountId: row.creatorAccountId,
    createdAt: row.createdAt,
  };
}

function mapPostUnlock(row: PostUnlockRow): NoodlePostUnlock {
  return { id: row.id, viewerAccountId: row.viewerAccountId, postId: row.postId, createdAt: row.createdAt };
}

function imageClaimIsAvailable(row: PostRow, at: string) {
  return (
    Boolean(row.imagePrompt) &&
    !row.imageUrl &&
    (!row.imageClaimToken || !row.imageClaimLeaseUntil || row.imageClaimLeaseUntil <= at)
  );
}

function mapInteraction(row: InteractionRow): NoodleInteraction {
  return {
    id: row.id,
    postId: row.postId,
    parentInteractionId: row.parentInteractionId ?? null,
    actorAccountId: row.actorAccountId,
    type:
      row.type === "repost" || row.type === "reply" || row.type === "like" || row.type === "vote"
        ? (row.type as NoodleInteractionType)
        : "like",
    content: row.content ?? null,
    imageUrl: row.imageUrl ?? null,
    actorSnapshot: parseAuthorSnapshot(row.actorSnapshot),
    createdAt: row.createdAt,
  };
}

function mapDigest(row: DigestRow): NoodleDigestEntry {
  return {
    id: row.id,
    accountIds: parseStringArray(row.accountIds),
    content: row.content ?? "",
    sourceRunId: row.sourceRunId ?? null,
    sourcePostId: row.sourcePostId ?? null,
    sourceInteractionId: row.sourceInteractionId ?? null,
    createdAt: row.createdAt,
  };
}

function mapRefreshRun(row: RefreshRunRow): NoodleRefreshRun {
  return {
    id: row.id,
    status: row.status === "completed" || row.status === "failed" ? row.status : "running",
    activeAccountIds: parseStringArray(row.activeAccountIds),
    prompt: row.prompt ?? "",
    result: row.result ?? null,
    error: row.error ?? null,
    attempts: parseRefreshAttempts(row.attempts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createNoodleStorage(db: DB) {
  const settingsStore = createAppSettingsStorage(db);

  return {
    async getSettings(): Promise<NoodleSettings> {
      const raw = await settingsStore.get(NOODLE_SETTINGS_KEY);
      return normalizeNoodleSettings(raw);
    },

    async updateSettings(input: NoodleSettingsUpdateInput): Promise<NoodleSettings> {
      const current = await this.getSettings();
      const next = normalizeNoodleSettings({ ...current, ...input });
      await settingsStore.set(NOODLE_SETTINGS_KEY, JSON.stringify(next));
      const currentSchedule = await this.getRefreshSchedule();
      const reconciled = reconcileNoodleRefreshSchedule(currentSchedule, next.refreshesPerDay, new Date());
      await this.saveRefreshSchedule(clearNoodleRefreshFailure(reconciled));
      return this.getSettings();
    },

    async getRefreshSchedule(): Promise<PersistedNoodleRefreshSchedule | null> {
      const raw = await settingsStore.get(NOODLE_REFRESH_SCHEDULE_KEY);
      if (!raw) return null;
      try {
        return parsePersistedNoodleRefreshSchedule(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async saveRefreshSchedule(schedule: PersistedNoodleRefreshSchedule): Promise<void> {
      await settingsStore.set(NOODLE_REFRESH_SCHEDULE_KEY, JSON.stringify(schedule));
    },

    async ensureRefreshSchedule(
      at = new Date(),
      settingsOverride?: NoodleSettings,
    ): Promise<PersistedNoodleRefreshSchedule> {
      const settings = settingsOverride ?? (await this.getSettings());
      const current = await this.getRefreshSchedule();
      const reconciled = reconcileNoodleRefreshSchedule(current, settings.refreshesPerDay, at);
      if (!current || JSON.stringify(current) !== JSON.stringify(reconciled)) {
        await this.saveRefreshSchedule(reconciled);
      }
      return reconciled;
    },

    async listAccounts(): Promise<NoodleAccount[]> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.visibility, "public"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getAccountById(id: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "public")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getAccountByEntity(kind: NoodleAccountKind, entityId: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            eq(noodleAccounts.entityId, entityId),
            eq(noodleAccounts.visibility, "public"),
          ),
        );
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getAccountsByEntities(kind: NoodleAccountKind, entityIds: string[]): Promise<NoodleAccount[]> {
      if (entityIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            inArray(noodleAccounts.entityId, entityIds),
            eq(noodleAccounts.visibility, "public"),
          ),
        );
      return rows.map(mapAccount);
    },

    async listPrivateAccounts(): Promise<NoodleAccount[]> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.visibility, "private"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getPrivateAccountById(id: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "private")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getPrivateAccountForPublicAccount(publicAccountId: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.visibility, "private"), eq(noodleAccounts.publicAccountId, publicAccountId)));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async deletePrivateAccount(id: string): Promise<NoodleAccount | null> {
      const existing = await this.getPrivateAccountById(id);
      if (!existing) return null;
      await db.delete(noodleAccounts).where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "private")));
      return existing;
    },

    async listNoodlerStageProfiles(): Promise<NoodlerManagedStageProfile[]> {
      const accounts = await this.listPrivateAccounts();
      return Promise.all(
        accounts.map(async (account) => {
          const disclosureMode = account.settings.privacy.identityDisclosure ?? null;
          const publicAccount =
            disclosureMode === "open" && account.publicAccountId
              ? await this.getAccountById(account.publicAccountId)
              : null;
          return {
            id: account.id,
            publicAccountId: account.publicAccountId,
            handle: account.handle,
            displayName: account.displayName,
            bio: account.bio,
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            disclosureMode,
            stagePersonality: account.settings.privacy.stagePersonality ?? "",
            access: account.settings.privacy.access,
            publicIdentity: publicAccount
              ? { displayName: publicAccount.displayName, handle: publicAccount.handle }
              : null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          };
        }),
      );
    },

    async createPrivateAccount(
      publicAccountId: string,
      stageProfile: NoodleStageProfileInput,
    ): Promise<NoodleAccount | null> {
      const publicAccount = await this.getAccountById(publicAccountId);
      if (!publicAccount || (publicAccount.kind !== "persona" && publicAccount.kind !== "character")) return null;
      const timestamp = now();
      const id = newId();
      const accountSettings: NoodleAccountSettings = {
        ...emptyNoodleAccountSettings(),
        privacy: {
          identityDisclosure: stageProfile.disclosureMode,
          stagePersonality: stageProfile.stagePersonality,
          access: { hiddenFromAccountIds: [], subscriptionIncludesPpv: false },
        },
      };
      await db.insert(noodleAccounts).values({
        id,
        kind: publicAccount.kind,
        entityId: publicAccount.entityId,
        handle: normalizeHandle(stageProfile.handle, publicAccount.entityId),
        displayName: stageProfile.displayName,
        bio: stageProfile.bio,
        avatarUrl: null,
        invited: "false",
        settings: JSON.stringify(accountSettings),
        visibility: "private",
        publicAccountId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getPrivateAccountById(id);
    },

    async updateNoodlerStageProfile(id: string, stageProfile: NoodleStageProfileInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "private")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        await tx
          .update(noodleAccounts)
          .set({
            handle: normalizeHandle(stageProfile.handle, row.entityId),
            displayName: stageProfile.displayName,
            bio: stageProfile.bio,
            settings: JSON.stringify({
              ...settings,
              privacy: {
                ...settings.privacy,
                identityDisclosure: stageProfile.disclosureMode,
                stagePersonality: stageProfile.stagePersonality,
              },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async upsertAccountFromProfile(input: {
      kind: NoodleAccountKind;
      entityId: string;
      displayName: string;
      avatarUrl?: string | null;
      avatarCrop?: NoodleAvatarCrop | null;
      bio?: string | null;
      invited?: boolean;
      /** Keep entity-owned identity fields current without replacing generated profile copy. */
      syncIdentity?: boolean;
    }): Promise<NoodleAccount> {
      const existing = await this.getAccountByEntity(input.kind, input.entityId);
      if (existing) {
        return db.transaction(async (tx) => {
          const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
          const row = rows[0];
          if (!row) return existing;
          const settings = normalizeNoodleAccountSettings(row.settings);
          const profileManuallyEdited = settings.profile.profileManuallyEdited === true;
          const updates: Record<string, unknown> = { updatedAt: now() };
          if (input.syncIdentity && !profileManuallyEdited) {
            updates.displayName = input.displayName.trim().slice(0, 120) || row.handle;
            if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
          } else if (!String(row.displayName ?? "").trim()) {
            updates.displayName = input.displayName || row.handle;
          }
          if (!profileManuallyEdited && !String(row.bio ?? "").trim() && input.bio) updates.bio = input.bio;
          if (!input.syncIdentity && !row.avatarUrl && input.avatarUrl) updates.avatarUrl = input.avatarUrl;
          if (input.invited !== undefined) updates.invited = String(input.invited);
          if (input.avatarCrop !== undefined && !profileManuallyEdited) {
            updates.settings = JSON.stringify({
              ...settings,
              profile: { ...settings.profile, avatarCrop: input.avatarCrop },
            });
          }
          await tx.update(noodleAccounts).set(updates).where(eq(noodleAccounts.id, existing.id));
          const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
          return updatedRows[0] ? mapAccount(updatedRows[0]) : existing;
        });
      }

      const timestamp = now();
      const id = newId();
      const displayName = input.displayName.trim() || (input.kind === "persona" ? "User" : "Character");
      await db.insert(noodleAccounts).values({
        id,
        kind: input.kind,
        entityId: input.entityId,
        handle: normalizeHandle(displayName, input.entityId),
        displayName,
        bio: input.bio?.trim() ?? "",
        avatarUrl: input.avatarUrl ?? null,
        invited: String(input.invited ?? input.kind === "persona"),
        settings: JSON.stringify({
          ...emptyNoodleAccountSettings(),
          profile: input.avatarCrop !== undefined ? { avatarCrop: input.avatarCrop } : {},
        }),
        visibility: "public",
        publicAccountId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return (await this.getAccountById(id))!;
    },

    async updateAccount(id: string, input: NoodleAccountUpdateInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "public")));
        const row = rows[0];
        if (!row) return null;
        await tx
          .update(noodleAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            ...(input.invited !== undefined && { invited: String(input.invited) }),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async updateAccountProfile(id: string, input: NoodleAccountProfileUpdateInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "public")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        const nextSettings: NoodleAccountSettings = {
          ...settings,
          profile: { ...settings.profile, ...input.profile },
        };
        await tx
          .update(noodleAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            settings: JSON.stringify(nextSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async patchAccountSettings(id: string, input: NoodleAccountSettingsPatchInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        const row = rows[0];
        if (!row) return null;
        if (row.visibility === "private" && input.subtree !== "privacy") return null;
        if (row.visibility !== "private" && input.subtree === "privacy" && input.patch.access !== undefined)
          return null;
        if (
          row.visibility === "private" &&
          input.subtree === "privacy" &&
          (input.patch.identityDisclosure !== undefined || input.patch.stagePersonality !== undefined)
        ) {
          return null;
        }
        const current = normalizeNoodleAccountSettings(row.settings);
        let next: NoodleAccountSettings;
        if (input.subtree === "social") {
          next = { ...current, social: { ...current.social, ...input.patch } };
        } else if (input.subtree === "scheduler") {
          next = { ...current, scheduler: { ...current.scheduler, ...input.patch } };
        } else {
          next = {
            ...current,
            privacy: {
              ...current.privacy,
              ...input.patch,
              access: { ...current.privacy.access, ...input.patch.access },
            },
          };
        }
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async updateAccountFollow(
      id: string,
      targetAccountId: string,
      followed: boolean,
      followedAt = new Date().toISOString(),
    ): Promise<{ account: NoodleAccount; changed: boolean } | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.visibility, "public")));
        const row = rows[0];
        if (!row) return null;
        const current = normalizeNoodleAccountSettings(row.settings);
        const followingAccountIds = current.social.followingAccountIds ?? [];
        const isFollowing = followingAccountIds.includes(targetAccountId);
        const followingAccountTimestamps = { ...current.social.followingAccountTimestamps };
        const hasFollowTimestamp = typeof followingAccountTimestamps[targetAccountId] === "string";
        if (isFollowing === followed && (!followed || hasFollowTimestamp)) {
          return { account: mapAccount(row), changed: false };
        }
        if (followed) followingAccountTimestamps[targetAccountId] = followedAt;
        else delete followingAccountTimestamps[targetAccountId];
        const next: NoodleAccountSettings = {
          ...current,
          social: {
            ...current.social,
            followingAccountIds: followed
              ? [...followingAccountIds, targetAccountId]
              : followingAccountIds.filter((accountId) => accountId !== targetAccountId),
            followingAccountTimestamps,
          },
        };
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? { account: mapAccount(updatedRows[0]), changed: true } : null;
      });
    },

    async setCharacterInvited(characterId: string, invited: boolean): Promise<NoodleAccount | null> {
      const existing = await this.getAccountByEntity("character", characterId);
      if (!existing) return null;
      return this.updateAccount(existing.id, { invited });
    },

    /** Mark every currently invited character account as uninvited. */
    async clearCharacterInvites(): Promise<void> {
      await db
        .update(noodleAccounts)
        .set({ invited: "false", updatedAt: now() })
        .where(
          and(
            eq(noodleAccounts.kind, "character"),
            eq(noodleAccounts.invited, "true"),
            eq(noodleAccounts.visibility, "public"),
          ),
        );
    },

    async listPosts(options: { limit?: number; since?: string } = {}): Promise<NoodlePost[]> {
      const limit = Math.max(1, Math.min(300, Math.floor(options.limit ?? 120)));
      const publicAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (publicAccountIds.length === 0) return [];
      const rows = options.since
        ? await db
            .select()
            .from(noodlePosts)
            .where(
              and(gt(noodlePosts.createdAt, options.since), inArray(noodlePosts.authorAccountId, publicAccountIds)),
            )
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit)
        : await db
            .select()
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, publicAccountIds))
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit);
      return rows.map(mapPost);
    },

    async listPostsBefore(before: string): Promise<NoodlePost[]> {
      const publicAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (publicAccountIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(and(lt(noodlePosts.createdAt, before), inArray(noodlePosts.authorAccountId, publicAccountIds)))
        .orderBy(desc(noodlePosts.createdAt));
      return rows.map(mapPost);
    },

    async listPrivatePostsByAccount(accountId: string, limit = 8): Promise<NoodlePost[]> {
      const account = await this.getPrivateAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(eq(noodlePosts.authorAccountId, accountId))
        .orderBy(desc(noodlePosts.createdAt))
        .limit(Math.max(1, Math.min(50, Math.floor(limit))));
      return rows.map(mapPost);
    },

    async listPrivatePostsByAccounts(accountIds: string[], limit = 8): Promise<Map<string, NoodlePost[]>> {
      const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
      const result = new Map<string, NoodlePost[]>();
      if (accountIds.length === 0) return result;
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(inArray(noodlePosts.authorAccountId, accountIds))
        .orderBy(desc(noodlePosts.createdAt));
      for (const row of rows) {
        const post = mapPost(row);
        const existing = result.get(post.authorAccountId);
        if (existing) {
          if (existing.length < boundedLimit) existing.push(post);
        } else {
          result.set(post.authorAccountId, [post]);
        }
      }
      return result;
    },

    async getPrivatePostById(id: string): Promise<NoodlePost | null> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getPrivateAccountById(row.authorAccountId))) return null;
      return mapPost(row);
    },

    async createPrivatePost(
      input: Omit<NoodleCreatePostInput, "authorKind" | "authorEntityId"> & {
        authorAccountId: string;
        source?: NoodlePostSource;
        access?: NoodlePostAccess;
        ppvPrice?: number | null;
        metadata?: Record<string, unknown>;
      },
    ): Promise<NoodlePost | null> {
      const account = await this.getPrivateAccountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = newId();
      return db.transaction(async (tx) => {
        await tx.insert(noodlePosts).values({
          id,
          authorAccountId: input.authorAccountId,
          content: input.content,
          imageUrl: input.imageUrl ?? null,
          imagePrompt: input.imagePrompt ?? null,
          parentPostId: input.parentPostId ?? null,
          quotePostId: input.quotePostId ?? null,
          source: input.source ?? "manual",
          access: input.access ?? "public",
          ppvPrice: input.access === "ppv" ? (input.ppvPrice ?? null) : null,
          metadata: JSON.stringify(input.metadata ?? {}),
          authorSnapshot: JSON.stringify(snapshotForAccount(account)),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        return rows[0] ? mapPost(rows[0]) : null;
      });
    },

    async createPost(
      input: Omit<NoodleCreatePostInput, "authorKind" | "authorEntityId"> & {
        authorAccountId: string;
        source?: NoodlePostSource;
        metadata?: Record<string, unknown>;
      },
    ): Promise<NoodlePost | null> {
      const account = await this.getAccountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = newId();
      await db.insert(noodlePosts).values({
        id,
        authorAccountId: input.authorAccountId,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: input.parentPostId ?? null,
        quotePostId: input.quotePostId ?? null,
        source: input.source ?? "manual",
        access: "public",
        ppvPrice: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshotForAccount(account)),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return (await this.getPostById(id))!;
    },

    async getPostById(id: string): Promise<NoodlePost | null> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getAccountById(row.authorAccountId))) return null;
      return mapPost(row);
    },

    async updatePostMedia(
      id: string,
      input: { imageUrl?: string | null; imagePrompt?: string | null; metadata?: Record<string, unknown> },
    ): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db
        .update(noodlePosts)
        .set({
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
          ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.metadata !== undefined && {
            metadata: JSON.stringify({ ...existing.metadata, ...input.metadata }),
          }),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, id));
      return this.getPostById(id);
    },

    async claimPostImage(id: string, token: string, leaseUntil: string, at = now()): Promise<NoodlePost | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (!row || !imageClaimIsAvailable(row, at)) return null;
        await tx
          .update(noodlePosts)
          .set({ imageClaimToken: token, imageClaimLeaseUntil: leaseUntil })
          .where(eq(noodlePosts.id, id));
        return mapPost(row);
      });
    },

    async renewPostImageClaim(id: string, token: string, leaseUntil: string, at = now()): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        await tx
          .update(noodlePosts)
          .set({ imageClaimLeaseUntil: leaseUntil })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async releasePostImageClaim(id: string, token: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        if (rows[0]?.imageClaimToken !== token) return false;
        await tx
          .update(noodlePosts)
          .set({ imageClaimToken: null, imageClaimLeaseUntil: null })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async finalizePostImageClaim(
      id: string,
      token: string,
      input: { imageUrl: string | null; imagePrompt?: string | null; metadata: Record<string, unknown> },
      at = now(),
    ): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        await tx
          .update(noodlePosts)
          .set({
            imageUrl: input.imageUrl,
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            metadata: JSON.stringify({ ...parseRecord(row.metadata), ...input.metadata }),
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: now(),
          })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async updatePost(id: string, input: NoodlePostUpdateInput): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db
        .update(noodlePosts)
        .set({
          ...(input.content !== undefined && { content: input.content.trim().slice(0, 4000) }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
          ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, id));
      return this.getPostById(id);
    },

    async deletePost(id: string): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      const interactions = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (interactions.some((interaction) => !publicAccountIds.has(interaction.actorAccountId))) return null;
      const interactionIds = interactions.map((interaction) => interaction.id);
      const digests = await db.select().from(noodleActivityDigests);
      const relatedDigests = digests.filter(
        (digest) =>
          digest.sourcePostId === id ||
          (digest.sourceInteractionId !== null && interactionIds.includes(digest.sourceInteractionId)),
      );
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => publicAccountIds.has(accountId)),
        )
      ) {
        return null;
      }
      await db.transaction(async (tx) => {
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.postId, id));
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.postId, id));
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
      });
      return existing;
    },

    async resetTimeline(): Promise<void> {
      const publicAccountIds = (await this.listAccounts()).map((account) => account.id);
      const publicPosts =
        publicAccountIds.length > 0
          ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, publicAccountIds))
          : [];
      const publicPostIds = publicPosts.map((post) => post.id);
      const publicInteractions = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, publicPostIds));
      const publicAccountIdSet = new Set(publicAccountIds);
      const protectedPostIds = new Set(
        publicInteractions
          .filter((interaction) => !publicAccountIdSet.has(interaction.actorAccountId))
          .map((interaction) => interaction.postId),
      );
      const interactionPostById = new Map(
        publicInteractions.map((interaction) => [interaction.id, interaction.postId]),
      );
      const digests = await db.select().from(noodleActivityDigests);
      for (const digest of digests) {
        if (parseStringArray(digest.accountIds).every((accountId) => publicAccountIdSet.has(accountId))) continue;
        if (digest.sourcePostId && publicPostIds.includes(digest.sourcePostId)) {
          protectedPostIds.add(digest.sourcePostId);
        }
        if (digest.sourceInteractionId) {
          const postId = interactionPostById.get(digest.sourceInteractionId);
          if (postId) protectedPostIds.add(postId);
        }
      }
      const deletablePostIds = publicPostIds.filter((postId) => !protectedPostIds.has(postId));
      const deletableInteractionIds = publicInteractions
        .filter((interaction) => deletablePostIds.includes(interaction.postId))
        .map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (deletableInteractionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, deletableInteractionIds));
        }
        if (deletablePostIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, deletablePostIds));
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, deletablePostIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, deletablePostIds));
        }
        await tx.delete(noodleRefreshRuns);
      });
    },

    async listInteractions(postIds: string[] = []): Promise<NoodleInteraction[]> {
      if (postIds.length === 0) return [];
      const publicPostIds = new Set(
        (await Promise.all(postIds.map((postId) => this.getPostById(postId))))
          .filter((post): post is NoodlePost => post !== null)
          .map((post) => post.id),
      );
      if (publicPostIds.size === 0) return [];
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, [...publicPostIds]))
        .orderBy(noodleInteractions.createdAt);
      return rows.filter((row) => publicAccountIds.has(row.actorAccountId)).map(mapInteraction);
    },

    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100): Promise<NoodleInteraction[]> {
      if (!(await this.getAccountById(actorAccountId))) return [];
      const publicAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (publicAccountIds.length === 0) return [];
      const publicPostIds = new Set(
        (
          await db
            .select({ id: noodlePosts.id })
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, publicAccountIds))
        ).map((post) => post.id),
      );
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.actorAccountId, actorAccountId),
            eq(noodleInteractions.type, "reply"),
            gt(noodleInteractions.createdAt, since),
          ),
        )
        .orderBy(desc(noodleInteractions.createdAt))
        .limit(Math.max(1, Math.min(200, Math.floor(limit))));
      return rows.filter((row) => publicPostIds.has(row.postId)).map(mapInteraction);
    },

    async getInteractionById(id: string): Promise<NoodleInteraction | null> {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      const row = rows[0];
      if (!row) return null;
      const [post, actor] = await Promise.all([this.getPostById(row.postId), this.getAccountById(row.actorAccountId)]);
      return post && actor ? mapInteraction(row) : null;
    },

    async updateInteraction(
      id: string,
      input: { content?: string | null; imageUrl?: string | null },
    ): Promise<NoodleInteraction | null> {
      const existing = await this.getInteractionById(id);
      if (!existing) return null;
      await db
        .update(noodleInteractions)
        .set({
          ...(input.content !== undefined && { content: input.content?.trim() || null }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() || null }),
        })
        .where(eq(noodleInteractions.id, id));
      return this.getInteractionById(id);
    },

    async deleteInteractionById(id: string): Promise<NoodleInteraction[]> {
      const existing = await this.getInteractionById(id);
      if (!existing) return [];
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, existing.postId));
      const deletedIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (deletedIds.has(row.id) || !row.parentInteractionId || !deletedIds.has(row.parentInteractionId)) continue;
          deletedIds.add(row.id);
          changed = true;
        }
      }
      const deletedRows = rows.filter((row) => deletedIds.has(row.id));
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (deletedRows.some((row) => !publicAccountIds.has(row.actorAccountId))) return [];
      const relatedDigests = await db
        .select()
        .from(noodleActivityDigests)
        .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => publicAccountIds.has(accountId)),
        )
      ) {
        return [];
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(noodleActivityDigests)
          .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
        await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, [...deletedIds]));
      });
      return deletedRows.map(mapInteraction);
    },

    async createInteraction(
      postId: string,
      input: Omit<NoodleCreateInteractionInput, "actorKind" | "actorEntityId"> & { actorAccountId: string },
    ): Promise<NoodleInteraction | null> {
      const [post, actor] = await Promise.all([this.getPostById(postId), this.getAccountById(input.actorAccountId)]);
      if (!post || !actor) return null;

      const parentInteractionId = input.parentInteractionId ?? null;
      if (parentInteractionId) {
        const parent = await this.getInteractionById(parentInteractionId);
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }

      if (input.type === "vote") {
        if (parentInteractionId) return null;
        const poll = readNoodlePollFromMetadata(post.metadata);
        const optionId = input.content?.trim() ?? "";
        if (!poll || !poll.options.some((option) => option.id === optionId)) return null;
        const existingVotes = await db
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.postId, postId),
              eq(noodleInteractions.actorAccountId, input.actorAccountId),
              eq(noodleInteractions.type, "vote"),
              isNull(noodleInteractions.parentInteractionId),
            ),
          );
        const existingVote = existingVotes[0];
        if (existingVote) {
          await db
            .update(noodleInteractions)
            .set({
              content: optionId,
              actorSnapshot: JSON.stringify(snapshotForAccount(actor)),
            })
            .where(eq(noodleInteractions.id, existingVote.id));
          const updated = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, existingVote.id));
          return updated[0] ? mapInteraction(updated[0]) : null;
        }
      }

      const readExistingToggleInteraction = async () => {
        if (!isToggleInteractionType(input.type)) return null;
        const existing = await db
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.postId, postId),
              eq(noodleInteractions.actorAccountId, input.actorAccountId),
              eq(noodleInteractions.type, input.type),
              parentInteractionId
                ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
                : isNull(noodleInteractions.parentInteractionId),
            ),
          );
        return existing[0] ? mapInteraction(existing[0]) : null;
      };

      const existingToggleInteraction = await readExistingToggleInteraction();
      if (existingToggleInteraction) return existingToggleInteraction;

      const id = newId();
      try {
        await db.insert(noodleInteractions).values({
          id,
          postId,
          parentInteractionId,
          actorAccountId: input.actorAccountId,
          type: input.type,
          content: input.content?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          actorSnapshot: JSON.stringify(snapshotForAccount(actor)),
          createdAt: now(),
        });
      } catch (error) {
        const toggleKeys = ["postId", "actorAccountId", "type", "parentInteractionId"];
        if (
          isToggleInteractionType(input.type) &&
          isFileUniqueConstraintError(error, "noodle_interactions", toggleKeys)
        ) {
          const existing = await readExistingToggleInteraction();
          if (existing) return existing;
        }
        throw error;
      }
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      return rows[0] ? mapInteraction(rows[0]) : null;
    },

    async deleteInteraction(
      postId: string,
      input: Omit<NoodleRemoveInteractionInput, "actorKind" | "actorEntityId"> & { actorAccountId: string },
    ): Promise<NoodleInteraction | null> {
      const post = await this.getPostById(postId);
      if (!post) return null;
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, input.actorAccountId),
            eq(noodleInteractions.type, input.type),
            input.parentInteractionId
              ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
              : isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const existing = rows[0];
      if (!existing) return null;
      const relatedDigests = await db
        .select()
        .from(noodleActivityDigests)
        .where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => publicAccountIds.has(accountId)),
        )
      ) {
        return null;
      }
      await db.transaction(async (tx) => {
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
      });
      return mapInteraction(existing);
    },

    async createDigest(input: {
      accountIds: string[];
      content: string;
      sourceRunId?: string | null;
      sourcePostId?: string | null;
      sourceInteractionId?: string | null;
    }): Promise<NoodleDigestEntry> {
      const id = newId();
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (!uniqueAccountIds.every((accountId) => publicAccountIds.has(accountId))) {
        throw new Error("Public Noodle digests cannot reference private accounts.");
      }
      await db.transaction(async (tx) => {
        if (input.sourceInteractionId) {
          const existingDigests = await tx
            .select()
            .from(noodleActivityDigests)
            .where(eq(noodleActivityDigests.sourceInteractionId, input.sourceInteractionId));
          const publicDigestIds = existingDigests
            .filter((digest) =>
              parseStringArray(digest.accountIds).every((accountId) => publicAccountIds.has(accountId)),
            )
            .map((digest) => digest.id);
          if (publicDigestIds.length > 0) {
            await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.id, publicDigestIds));
          }
        }
        await tx.insert(noodleActivityDigests).values({
          id,
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
          sourceRunId: input.sourceRunId ?? null,
          sourcePostId: input.sourcePostId ?? null,
          sourceInteractionId: input.sourceInteractionId ?? null,
          createdAt: now(),
        });
      });
      const rows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      return mapDigest(rows[0]!);
    },

    async updateDigest(
      id: string,
      input: { accountIds: string[]; content: string },
    ): Promise<NoodleDigestEntry | null> {
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const existingRows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      const existing = existingRows[0];
      if (!existing) return null;
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (
        !parseStringArray(existing.accountIds).every((accountId) => publicAccountIds.has(accountId)) ||
        !uniqueAccountIds.every((accountId) => publicAccountIds.has(accountId))
      ) {
        return null;
      }
      await db
        .update(noodleActivityDigests)
        .set({
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
        })
        .where(eq(noodleActivityDigests.id, id));
      const rows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      return rows[0] ? mapDigest(rows[0]) : null;
    },

    async listDigests(options: { limit?: number; since?: string } = {}): Promise<NoodleDigestEntry[]> {
      const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 80)));
      const fetchLimit = 200;
      const rows = options.since
        ? await db
            .select()
            .from(noodleActivityDigests)
            .where(gt(noodleActivityDigests.createdAt, options.since))
            .orderBy(desc(noodleActivityDigests.createdAt))
            .limit(fetchLimit)
        : await db
            .select()
            .from(noodleActivityDigests)
            .orderBy(desc(noodleActivityDigests.createdAt))
            .limit(fetchLimit);

      const sourcePostIds = Array.from(new Set(rows.flatMap((row) => (row.sourcePostId ? [row.sourcePostId] : []))));
      const sourceInteractionIds = Array.from(
        new Set(rows.flatMap((row) => (row.sourceInteractionId ? [row.sourceInteractionId] : []))),
      );
      const [sourcePosts, sourceInteractions] = await Promise.all([
        sourcePostIds.length > 0
          ? db.select().from(noodlePosts).where(inArray(noodlePosts.id, sourcePostIds))
          : Promise.resolve([]),
        sourceInteractionIds.length > 0
          ? db.select().from(noodleInteractions).where(inArray(noodleInteractions.id, sourceInteractionIds))
          : Promise.resolve([]),
      ]);
      const sourcePostById = new Map(sourcePosts.map((post) => [post.id, post]));
      const sourceInteractionById = new Map(sourceInteractions.map((interaction) => [interaction.id, interaction]));
      const publicAccountIds = new Set((await this.listAccounts()).map((account) => account.id));

      return rows
        .filter((row) => {
          const digest = mapDigest(row);
          if (!digest.accountIds.every((accountId) => publicAccountIds.has(accountId))) return false;
          if (row.sourceInteractionId) {
            const interaction = sourceInteractionById.get(row.sourceInteractionId);
            if (!interaction || !publicAccountIds.has(interaction.actorAccountId)) return false;
            const sourcePost = sourcePostById.get(interaction.postId);
            return Boolean(sourcePost && publicAccountIds.has(sourcePost.authorAccountId));
          }
          // Older model-authored summaries had only a refresh-run reference,
          // so there is no way to invalidate them when their source post or
          // comment is deleted. Deterministic event digests supersede them.
          if (row.sourceRunId && !row.sourcePostId) return false;
          if (!row.sourcePostId) return true;
          const sourcePost = sourcePostById.get(row.sourcePostId);
          if (!sourcePost || !publicAccountIds.has(sourcePost.authorAccountId)) return false;
          // Digests created before source_interaction_id existed cannot be tied
          // safely to a still-live comment. Keep only the post's canonical digest;
          // stale legacy comment digests must never re-enter generation context.
          return parseRecord(sourcePost.metadata).activityDigestId === row.id;
        })
        .slice(0, limit)
        .map(mapDigest);
    },

    async createRefreshRun(input: { activeAccountIds: string[]; prompt: string }): Promise<NoodleRefreshRun> {
      const timestamp = now();
      const id = newId();
      await db.insert(noodleRefreshRuns).values({
        id,
        status: "running",
        activeAccountIds: JSON.stringify(input.activeAccountIds),
        prompt: input.prompt,
        result: null,
        error: null,
        attempts: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      return mapRefreshRun(rows[0]!);
    },

    async listRefreshRuns(options: { limit?: number; status?: NoodleRefreshRun["status"] } = {}) {
      const limit = Math.max(1, Math.min(20, Math.floor(options.limit ?? 5)));
      const baseQuery = db.select().from(noodleRefreshRuns);
      const rows = options.status
        ? await baseQuery
            .where(eq(noodleRefreshRuns.status, options.status))
            .orderBy(desc(noodleRefreshRuns.createdAt))
            .limit(limit)
        : await baseQuery.orderBy(desc(noodleRefreshRuns.createdAt)).limit(limit);
      return rows.map(mapRefreshRun);
    },

    async recordRefreshAttempt(id: string, attempt: NoodleRefreshAttempt): Promise<NoodleRefreshRun | null> {
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      const current = rows[0];
      if (!current) return null;
      await db
        .update(noodleRefreshRuns)
        .set({
          attempts: JSON.stringify([...parseRefreshAttempts(current.attempts), attempt]),
          updatedAt: now(),
        })
        .where(eq(noodleRefreshRuns.id, id));
      const updatedRows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      return updatedRows[0] ? mapRefreshRun(updatedRows[0]) : null;
    },

    async finishRefreshRun(
      id: string,
      patch: { status: "completed" | "failed"; result?: string | null; error?: string | null },
    ): Promise<NoodleRefreshRun | null> {
      await db
        .update(noodleRefreshRuns)
        .set({
          status: patch.status,
          result: patch.result ?? null,
          error: patch.error ?? null,
          updatedAt: now(),
        })
        .where(eq(noodleRefreshRuns.id, id));
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      return rows[0] ? mapRefreshRun(rows[0]) : null;
    },

    async subscribe(viewerAccountId: string, creatorAccountId: string): Promise<NoodleAccountSubscription | null> {
      if (viewerAccountId === creatorAccountId) return null;
      return db.transaction(async (tx) => {
        const [viewerRows, creatorRows] = await Promise.all([
          tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, viewerAccountId)),
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.visibility, "private"))),
        ]);
        const viewer = viewerRows[0] ? mapAccount(viewerRows[0]) : null;
        const creator = creatorRows[0] ? mapAccount(creatorRows[0]) : null;
        if (
          !viewer ||
          viewer.kind !== "persona" ||
          viewer.visibility !== "public" ||
          !creator ||
          creator.publicAccountId === viewerAccountId ||
          isNoodlerHiddenFromViewer(creator, viewerAccountId)
        )
          return null;
        const existing = await tx
          .select()
          .from(noodleAccountSubscriptions)
          .where(
            and(
              eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
              eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
            ),
          );
        if (existing[0]) return mapSubscription(existing[0]);
        try {
          await tx.insert(noodleAccountSubscriptions).values({
            id: newId(),
            viewerAccountId,
            creatorAccountId,
            createdAt: now(),
          });
        } catch (error) {
          if (
            !isFileUniqueConstraintError(error, "noodle_account_subscriptions", ["viewerAccountId", "creatorAccountId"])
          ) {
            throw error;
          }
        }
        const rows = await tx
          .select()
          .from(noodleAccountSubscriptions)
          .where(
            and(
              eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
              eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
            ),
          );
        return rows[0] ? mapSubscription(rows[0]) : null;
      });
    },

    async unsubscribe(viewerAccountId: string, creatorAccountId: string): Promise<void> {
      await db
        .delete(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
          ),
        );
    },

    async listSubscriptionsForViewer(viewerAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId));
      return rows.map(mapSubscription);
    },

    async unlockPost(viewerAccountId: string, postId: string): Promise<NoodlePostUnlock | null> {
      return db.transaction(async (tx) => {
        const [viewerRows, postRows] = await Promise.all([
          tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, viewerAccountId)),
          tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)),
        ]);
        const viewer = viewerRows[0] ? mapAccount(viewerRows[0]) : null;
        const postRow = postRows[0];
        if (!viewer || viewer.kind !== "persona" || viewer.visibility !== "public" || postRow?.access !== "ppv") {
          return null;
        }
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.visibility, "private")));
        const author = authorRows[0] ? mapAccount(authorRows[0]) : null;
        if (
          !author ||
          author.publicAccountId === viewerAccountId ||
          isNoodlerHiddenFromViewer(author, viewerAccountId)
        ) {
          return null;
        }
        const existing = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
        if (existing[0]) return mapPostUnlock(existing[0]);
        try {
          await tx.insert(noodlePostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: now() });
        } catch (error) {
          if (!isFileUniqueConstraintError(error, "noodle_post_unlocks", ["viewerAccountId", "postId"])) throw error;
        }
        const rows = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
        return rows[0] ? mapPostUnlock(rows[0]) : null;
      });
    },

    async listPostUnlocksForViewer(viewerAccountId: string): Promise<NoodlePostUnlock[]> {
      const rows = await db
        .select()
        .from(noodlePostUnlocks)
        .where(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId));
      return rows.map(mapPostUnlock);
    },

    async bootstrap(): Promise<NoodleBootstrap> {
      const posts = await this.listPosts({ limit: 160 });
      const settings = await this.getSettings();
      const scheduler = noodleRefreshSchedulerStatus(
        await this.ensureRefreshSchedule(new Date(), settings),
        new Date(),
      );
      return {
        settings,
        scheduler,
        accounts: await this.listAccounts(),
        posts,
        interactions: await this.listInteractions(posts.map((post) => post.id)),
        digests: await this.listDigests({ limit: 80 }),
      };
    },
  };
}
