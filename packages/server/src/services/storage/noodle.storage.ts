// ──────────────────────────────────────────────
// Storage: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { and, desc, eq, gt, inArray, isNull, lt } from "../../db/file-query.js";
import {
  createNoodlePoll,
  DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS,
  DEFAULT_NOODLE_SETTINGS,
  DEFAULT_NOODLE_WALLET_COINS,
  noodleAccountProfileSettingsSchema,
  noodleAccountPrivacySettingsSchema,
  noodleAccountSocialSettingsSchema,
  noodleSettingsSchema,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodleAccountKind,
  type NoodleAccountProfileUpdateInput,
  type NoodleAccountSchedulerSettings,
  type NoodleAccountSettings,
  type NoodleAccountSettingsPatchInput,
  type NoodleAccountSubscription,
  type NoodleAccountUpdateInput,
  type NoodlerReserveStatus,
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
  type NoodlePlatform,
  type NoodlePost,
  type NoodlePostAccess,
  type NoodlePollInput,
  type NoodlePostUnlock,
  type NoodlePostUpdateInput,
  type NoodlePostSource,
  type NoodlerPostUpdateInput,
  type NoodleStageProfileInput,
  type NoodlerManagedPost,
  type NoodlerManagedStageProfile,
  type NoodleRefreshAttempt,
  type NoodleRefreshRun,
  type NoodleRemoveInteractionInput,
  type NoodleSettings,
  type NoodleSettingsUpdateInput,
  type NoodlerCreateInteractionInput,
  type NoodlerRemoveInteractionInput,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { logger } from "../../lib/logger.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../noodle/noodler-access.js";
import { noodlerPostMediaUrl, unlinkNoodlerMedia } from "../noodle/noodle-noodler-media.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
  noodlerCreatorReplyClaims,
  noodlerAutomaticAttempts,
  noodlerPreparedPosts,
  noodlerReserveState,
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
export const NOODLER_UNLOCK_COST = 1;
export const NOODLER_SUBSCRIPTION_COST = 5;
const NOODLER_RESERVE_STATE_ID = "noodler-reserve";
const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;
const MANUAL_POST_INVALIDATION_MS = 60 * 60 * 1000;

export type NoodlerPreparedPostPayload = {
  title: string | null;
  content: string;
  access: NoodlePostAccess;
  imagePrompt: string | null;
  metadata: Record<string, unknown>;
};

export type NoodlerPreparedPostState = "prepared" | "published" | "discarded";
export type NoodlerPreparedImageState = "none" | "pending" | "generating" | "attached" | "rejected" | "closed";

export function noodlerReservePolicyFingerprint(
  account: NoodleAccount,
  settings?: Pick<
    NoodleSettings,
    | "imageGenerationConnectionId"
    | "imageGenerationPrompt"
    | "imageGenerationUseAvatarReferences"
    | "imageGenerationIncludeDescriptions"
    | "includeCharacterSchedules"
    | "noodlerNightQuiet"
  >,
  sourceUpdatedAt?: string | null,
): string {
  // Pick the policy fields explicitly: callers pass the whole settings object, and
  // serializing it wholesale would invalidate every prepared post on any unrelated
  // NoodleR setting change (onboarding state, refresh cadence, …).
  const mediaPolicy = settings
    ? {
        imageGenerationConnectionId: settings.imageGenerationConnectionId,
        imageGenerationPrompt: settings.imageGenerationPrompt,
        imageGenerationUseAvatarReferences: settings.imageGenerationUseAvatarReferences,
        imageGenerationIncludeDescriptions: settings.imageGenerationIncludeDescriptions,
        includeCharacterSchedules: settings.includeCharacterSchedules,
        noodlerNightQuiet: settings.noodlerNightQuiet,
      }
    : null;
  return JSON.stringify({
    sourceId: account.noodleAccountId,
    sourceUpdatedAt: sourceUpdatedAt ?? null,
    stageProfileUpdatedAt: account.updatedAt,
    disclosure: account.settings.privacy.identityDisclosure ?? "secret",
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    access: account.settings.privacy.access,
    scheduler: account.settings.scheduler.autoPosting,
    mediaPolicy,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

type AccountRow = typeof noodleAccounts.$inferSelect;
type PostRow = typeof noodlePosts.$inferSelect;
type InteractionRow = typeof noodleInteractions.$inferSelect;
type DigestRow = typeof noodleActivityDigests.$inferSelect;
type RefreshRunRow = typeof noodleRefreshRuns.$inferSelect;
type SubscriptionRow = typeof noodleAccountSubscriptions.$inferSelect;
type PostUnlockRow = typeof noodlePostUnlocks.$inferSelect;
type PublicCreateInteractionCommand = Omit<NoodleCreateInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};
type PublicRemoveInteractionCommand = Omit<NoodleRemoveInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};
type NoodlerCreateInteractionCommand = Omit<NoodlerCreateInteractionInput, "personaId"> & {
  actorAccountId: string;
};
type NoodlerRemoveInteractionCommand = Omit<NoodlerRemoveInteractionInput, "personaId"> & {
  actorAccountId: string;
};
type DeleteStoredInteractionCommand = {
  actorAccountId: string;
  type: "like" | "repost";
  parentInteractionId?: string | null;
};
type InsertInteractionCommand = {
  actor: NoodleAccount;
  type: NoodleInteractionType;
  content?: string | null;
  imageUrl?: string | null;
  parentInteractionId: string | null;
};
type NoodlerPostPersistenceInput = {
  /** Optional caller-supplied id so a serving URL can be derived before the row is inserted. */
  id?: string;
  authorAccountId: string;
  title?: string | null;
  content: string;
  source?: NoodlePostSource;
  access?: NoodlePostAccess;
  metadata?: Record<string, unknown>;
  imageUrl?: string | null;
  imagePrompt?: string | null;
};

export type NoodlerCreatorReplyClaimResult =
  | { status: "claimed"; claimId: string; creator: NoodleAccount; post: NoodlerManagedPost; parent: NoodleInteraction; viewer: NoodleAccount }
  | { status: "duplicate"; interaction: NoodleInteraction | null }
  | { status: "exhausted" }
  | { status: "ineligible" };

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
    scheduler: { autoPosting: defaultAutoPostingSettings() },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: DEFAULT_NOODLE_WALLET_COINS },
  };
}

function defaultAutoPostingSettings(): NonNullable<NoodleAccountSchedulerSettings["autoPosting"]> {
  return { enabled: false, imagesEnabled: false };
}

export function normalizeScheduler(value: unknown): NoodleAccountSchedulerSettings {
  const defaults = defaultAutoPostingSettings();
  const raw = parseRecord(parseRecord(value).autoPosting);
  return {
    autoPosting: {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
      imagesEnabled: typeof raw.imagesEnabled === "boolean" ? raw.imagesEnabled : defaults.imagesEnabled,
    },
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

export function normalizePersistedInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
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
  const empty = { access: { hiddenFromAccountIds: [] } };
  if (value === undefined) return empty;
  const parsed = noodleAccountPrivacySettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : empty;
}

export function normalizeNoodleAccountSettings(value: unknown): NoodleAccountSettings {
  const raw = parseRecord(value);
  const rawProfile = parseRecord(raw.profile);
  const rawSocial = parseRecord(raw.social);
  const rawPrivacy = parseRecord(raw.privacy);
  const rawWallet = parseRecord(raw.wallet);
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
    },
  };
  return {
    profile,
    social,
    scheduler: normalizeScheduler(raw.scheduler),
    privacy,
    wallet: { coins: normalizePersistedInteger(rawWallet.coins) ?? DEFAULT_NOODLE_WALLET_COINS },
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

function suffixedPublicHandle(base: string, suffixNumber: number): string {
  const suffix = `_${suffixNumber}`;
  return `${base.slice(0, Math.max(1, 36 - suffix.length))}${suffix}`;
}

function nextAvailablePublicHandle(base: string, reserved: ReadonlySet<string>): string {
  if (!reserved.has(base)) return base;
  for (let suffixNumber = 2; suffixNumber < Number.MAX_SAFE_INTEGER; suffixNumber += 1) {
    const candidate = suffixedPublicHandle(base, suffixNumber);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique Noodle handle");
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
  // Renamed from privateGenerationGuidance; without the alias an existing user's
  // customized guidance would silently revert to the shipped default.
  const migratedNoodlerGenerationGuidance =
    rawRecord.noodlerGenerationGuidance ??
    rawRecord.privateGenerationGuidance ??
    DEFAULT_NOODLE_SETTINGS.noodlerGenerationGuidance;
  const migratedImageCaptioningUseConnectionDefault =
    typeof rawRecord.imageCaptioningUseConnectionDefault === "boolean"
      ? rawRecord.imageCaptioningUseConnectionDefault
      : rawRecord.imageCaptioningEnabled === true
        ? false
        : DEFAULT_NOODLE_SETTINGS.imageCaptioningUseConnectionDefault;
  const candidate: Record<string, unknown> = {
    ...DEFAULT_NOODLE_SETTINGS,
    ...rawRecord,
    maxImagesPerRefresh: migratedMaxImagesPerRefresh,
    noodlerGenerationGuidance: migratedNoodlerGenerationGuidance,
    imageCaptioningUseConnectionDefault: migratedImageCaptioningUseConnectionDefault,
    noodlerOnboardingState:
      rawRecord.noodlerOnboardingState ??
      (rawRecord.noodlerOnboardingComplete === true ? "completed" : DEFAULT_NOODLE_SETTINGS.noodlerOnboardingState),
  };
  let parsed = noodleSettingsSchema.safeParse(candidate);
  if (!parsed.success) {
    // One unparseable field used to discard *every* stored Noodle setting, silently resetting
    // things the user never touched (lorebook context, invited character folders, connection).
    // Drop only the fields that failed and let the schema default those instead.
    const rejectedKeys = new Set(
      parsed.error.issues.map((issue) => String(issue.path[0] ?? "")).filter((key) => key.length > 0),
    );
    logger.warn(
      "Noodle settings had invalid field(s); falling back to defaults for: %s",
      [...rejectedKeys].join(", ") || "(unknown)",
    );
    for (const key of rejectedKeys) delete candidate[key];
    parsed = noodleSettingsSchema.safeParse({ ...DEFAULT_NOODLE_SETTINGS, ...candidate });
    if (!parsed.success) {
      logger.error(parsed.error, "Noodle settings could not be recovered; resetting to defaults");
      return noodleSettingsSchema.parse(DEFAULT_NOODLE_SETTINGS);
    }
  }
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
    platform: row.platform === "noodler" ? "noodler" : "noodle",
    noodleAccountId: row.noodleAccountId ?? null,
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
    access: row.access === "public" ? "public" : "locked",
    metadata: parseRecord(row.metadata),
    authorSnapshot: parseAuthorSnapshot(row.authorSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapManagedPost(row: PostRow): NoodlerManagedPost {
  return {
    ...mapPost(row),
    title: row.title?.trim() || null,
  };
}

function updatePollMetadata(
  metadata: Record<string, unknown>,
  pollUpdate: NoodlePollInput | null | undefined,
): Record<string, unknown> {
  if (pollUpdate === undefined) return { ...metadata };
  const currentPoll = readNoodlePollFromMetadata(metadata);
  const generatedPoll = pollUpdate ? createNoodlePoll(pollUpdate) : null;
  const historicalOptionIds = Array.isArray(metadata.pollOptionIds)
    ? metadata.pollOptionIds.filter((id): id is string => typeof id === "string")
    : [];
  const usedOptionIds = new Set([...historicalOptionIds, ...(currentPoll?.options.map((option) => option.id) ?? [])]);
  const currentOptions = currentPoll?.options ?? [];
  const matchedCurrentOptionIds = new Set<string>();
  const normalizeOptionLabel = (label: string) => label.trim().toLocaleLowerCase();
  const retainedOptionIds =
    generatedPoll?.options.map((option) => {
      const matched = currentOptions.find(
        (current) =>
          !matchedCurrentOptionIds.has(current.id) &&
          normalizeOptionLabel(current.label) === normalizeOptionLabel(option.label),
      );
      if (!matched) return null;
      matchedCurrentOptionIds.add(matched.id);
      return matched.id;
    }) ?? [];
  for (let index = 0; index < retainedOptionIds.length; index += 1) {
    if (retainedOptionIds[index]) continue;
    const samePosition = currentOptions[index];
    const matched =
      samePosition && !matchedCurrentOptionIds.has(samePosition.id)
        ? samePosition
        : currentOptions.find((current) => !matchedCurrentOptionIds.has(current.id));
    if (!matched) continue;
    matchedCurrentOptionIds.add(matched.id);
    retainedOptionIds[index] = matched.id;
  }
  let nextOptionNumber = 1;
  const nextPoll = generatedPoll
    ? {
        ...generatedPoll,
        options: generatedPoll.options.map((option, index) => {
          const retainedOptionId = retainedOptionIds[index];
          if (retainedOptionId) return { ...option, id: retainedOptionId };
          while (usedOptionIds.has(`option-${nextOptionNumber}`)) nextOptionNumber += 1;
          const id = `option-${nextOptionNumber}`;
          usedOptionIds.add(id);
          nextOptionNumber += 1;
          return { ...option, id };
        }),
      }
    : null;
  const nextMetadata = { ...metadata };
  if (nextPoll) nextMetadata.poll = nextPoll;
  else delete nextMetadata.poll;
  nextMetadata.pollOptionIds = [...usedOptionIds];
  return nextMetadata;
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
  let publicHandleReconciliation: Promise<void> | null = null;

  const reconcilePublicHandles = () => {
    if (publicHandleReconciliation) return publicHandleReconciliation;
    publicHandleReconciliation = db
      .transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"));
        const groups = new Map<string, AccountRow[]>();
        for (const row of rows) {
          const normalized = normalizeHandle(row.handle, row.entityId);
          const group = groups.get(normalized);
          if (group) group.push(row);
          else groups.set(normalized, [row]);
        }

        const reserved = new Set(groups.keys());
        for (const [base, group] of groups) {
          group.sort(
            (left, right) =>
              String(left.createdAt).localeCompare(String(right.createdAt)) || left.id.localeCompare(right.id),
          );
          const keeper = group.find((row) => row.handle === base) ?? group[0]!;
          for (const duplicate of group) {
            if (duplicate.id === keeper.id) continue;
            const handle = nextAvailablePublicHandle(base, reserved);
            reserved.add(handle);
            await tx
              .update(noodleAccounts)
              .set({ handle, updatedAt: now() })
              .where(eq(noodleAccounts.id, duplicate.id));
          }
          if (keeper.handle !== base) {
            await tx
              .update(noodleAccounts)
              .set({ handle: base, updatedAt: now() })
              .where(eq(noodleAccounts.id, keeper.id));
          }
        }
      })
      .catch((error) => {
        publicHandleReconciliation = null;
        throw error;
      });
    return publicHandleReconciliation;
  };

  const insertInteraction = async (
    postId: string,
    input: InsertInteractionCommand,
  ): Promise<NoodleInteraction | null> => {
    const readExistingToggleInteraction = async () => {
      if (!isToggleInteractionType(input.type)) return null;
      const existing = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, input.actor.id),
            eq(noodleInteractions.type, input.type),
            input.parentInteractionId
              ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
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
        parentInteractionId: input.parentInteractionId,
        actorAccountId: input.actor.id,
        type: input.type,
        content: input.content?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        actorSnapshot: JSON.stringify(snapshotForAccount(input.actor)),
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
  };

  const upsertPollVote = async (
    postId: string,
    actorAccountId: string,
    optionId: string,
    authorPlatform: NoodlePlatform,
    imageUrl: string | null,
  ): Promise<NoodleInteraction | null> => {
    return db.transaction(async (tx) => {
      const [postRows, actorRows] = await Promise.all([
        tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)),
        tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, actorAccountId), eq(noodleAccounts.platform, "noodle"))),
      ]);
      const currentPost = postRows[0];
      if (!currentPost || !actorRows[0]) return null;
      const authorRows = await tx
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, currentPost.authorAccountId), eq(noodleAccounts.platform, authorPlatform)));
      const currentPoll = readNoodlePollFromMetadata(parseRecord(currentPost.metadata));
      if (!authorRows[0] || !currentPoll?.options.some((option) => option.id === optionId)) return null;

      const currentActor = mapAccount(actorRows[0]);
      if (authorPlatform === "noodler") {
        const currentAuthor = mapAccount(authorRows[0]);
        if (
          currentActor.kind !== "persona" ||
          currentAuthor.noodleAccountId === currentActor.id ||
          isNoodlerHiddenFromViewer(currentAuthor, currentActor.id)
        ) {
          return null;
        }
        const currentPostView = mapPost(currentPost);
        const subscriptionRows =
          currentPostView.access === "public"
            ? []
            : await tx
                .select()
                .from(noodleAccountSubscriptions)
                .where(
                  and(
                    eq(noodleAccountSubscriptions.viewerAccountId, currentActor.id),
                    eq(noodleAccountSubscriptions.creatorAccountId, currentAuthor.id),
                  ),
                );
        const unlockRows =
          currentPostView.access === "locked"
            ? await tx
                .select()
                .from(noodlePostUnlocks)
                .where(
                  and(
                    eq(noodlePostUnlocks.viewerAccountId, currentActor.id),
                    eq(noodlePostUnlocks.postId, currentPostView.id),
                  ),
                )
            : [];
        if (
          !canViewNoodlerPost({
            post: currentPostView,
            subscribed: subscriptionRows.length > 0,
            unlockedPostIds: new Set(unlockRows.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
      }
      const existingVotes = await tx
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, actorAccountId),
            eq(noodleInteractions.type, "vote"),
            isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const existingVote = existingVotes[0];
      const voteId = existingVote?.id ?? newId();
      if (existingVotes.length > 1) {
        await tx
          .delete(noodleInteractions)
          .where(inArray(noodleInteractions.id, existingVotes.slice(1).map((vote) => vote.id)));
      }
      if (existingVote) {
        await tx
          .update(noodleInteractions)
          .set({
            content: optionId,
            actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          })
          .where(eq(noodleInteractions.id, voteId));
      } else {
        await tx.insert(noodleInteractions).values({
          id: voteId,
          postId,
          parentInteractionId: null,
          actorAccountId: currentActor.id,
          type: "vote",
          content: optionId,
          imageUrl,
          actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          createdAt: now(),
        });
      }
      const updated = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, voteId));
      return updated[0] ? mapInteraction(updated[0]) : null;
    });
  };

  const deleteStoredInteraction = async (
    postId: string,
    input: DeleteStoredInteractionCommand,
    digestDeletionPolicy: "protect-public-digests" | "delete-directly",
  ): Promise<NoodleInteraction | null> => {
    const parentInteractionId = input.parentInteractionId ?? null;
    const rows = await db
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
    const existing = rows[0];
    if (!existing) return null;

    if (digestDeletionPolicy === "delete-directly") {
      await db.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
      return mapInteraction(existing);
    }

    const relatedDigests = await db
      .select()
      .from(noodleActivityDigests)
      .where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
    const noodleAccountIds = new Set(
      (await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"))).map((row) => row.id),
    );
    if (
      relatedDigests.some(
        (digest) => !parseStringArray(digest.accountIds).every((accountId) => noodleAccountIds.has(accountId)),
      )
    ) {
      return null;
    }
    await db.transaction(async (tx) => {
      await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
      await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
    });
    return mapInteraction(existing);
  };

  return {
    async getSettings(): Promise<NoodleSettings> {
      const raw = await settingsStore.get(NOODLE_SETTINGS_KEY);
      return normalizeNoodleSettings(raw);
    },

    async updateSettings(input: NoodleSettingsUpdateInput): Promise<NoodleSettings> {
      const current = await this.getSettings();
      const next = normalizeNoodleSettings({ ...current, ...input });
      // Write-only rollback mirror: a pre-rename build reads only the old key, so dropping it
      // here would silently reset a customized guidance string on downgrade. Drop once no
      // supported version reads `privateGenerationGuidance`.
      await settingsStore.set(
        NOODLE_SETTINGS_KEY,
        JSON.stringify({ ...next, privateGenerationGuidance: next.noodlerGenerationGuidance }),
      );
      const currentSchedule = await this.getRefreshSchedule();
      const reconciled = reconcileNoodleRefreshSchedule(currentSchedule, next.refreshesPerDay, new Date());
      await this.saveRefreshSchedule(clearNoodleRefreshFailure(reconciled));
      if (!current.autoPostingScheduleEnabled && next.autoPostingScheduleEnabled) {
        const timestamp = now();
        const rows = await db.select().from(noodlerPreparedPosts);
        const expired = rows.filter(
          (row) => row.state === "prepared" && Date.parse(row.publishAt) <= Date.parse(timestamp),
        );
        for (const row of expired) {
          unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
        }
        if (expired.length > 0) {
          await db
            .update(noodlerPreparedPosts)
            .set({ state: "discarded", updatedAt: timestamp })
            .where(inArray(noodlerPreparedPosts.id, expired.map((row) => row.id)));
        }
      }
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
      await reconcilePublicHandles();
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "noodle"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getAccountById(id: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    /**
     * Delete the noodle account for a deleted entity (e.g. a character) along with its
     * posts/interactions/subscriptions. Dependent rows go via the file-store cascade;
     * activity digests have no cascade, so they are cleared explicitly.
     */
    async deleteAccountByEntity(kind: NoodleAccountKind, entityId: string): Promise<NoodleAccount | null> {
      const existing = await this.getAccountByEntity(kind, entityId);
      if (!existing) return null;
      const postIds = (await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, existing.id))).map(
        (post) => post.id,
      );
      // Interactions on the account's own posts die with the posts via cascade, but the
      // account's interactions on *other* posts have no cascade — delete those explicitly.
      const ownInteractionIds =
        postIds.length > 0
          ? (await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))).map(
              (interaction) => interaction.id,
            )
          : [];
      const authoredRows = await db
        .select()
        .from(noodleInteractions)
        .where(eq(noodleInteractions.actorAccountId, existing.id));
      // Replies to an authored interaction would keep a dangling parentInteractionId, so
      // take the whole descendant subtree (same closure as deleteInteractionById).
      const authoredPostIds = Array.from(new Set(authoredRows.map((row) => row.postId)));
      const siblingRows =
        authoredPostIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, authoredPostIds))
          : [];
      const doomed = new Set(authoredRows.map((row) => row.id));
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of siblingRows) {
          if (doomed.has(row.id) || !row.parentInteractionId || !doomed.has(row.parentInteractionId)) continue;
          doomed.add(row.id);
          changed = true;
        }
      }
      const authoredInteractionIds = [...doomed];
      const interactionIds = Array.from(new Set([...ownInteractionIds, ...authoredInteractionIds]));
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        if (authoredInteractionIds.length > 0) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, authoredInteractionIds));
        }
        await tx.delete(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async getAccountByEntity(kind: NoodleAccountKind, entityId: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            eq(noodleAccounts.entityId, entityId),
            eq(noodleAccounts.platform, "noodle"),
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
            eq(noodleAccounts.platform, "noodle"),
          ),
        );
      return rows.map(mapAccount);
    },

    async listNoodlerAccounts(): Promise<NoodleAccount[]> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "noodler"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getNoodlerAccountById(id: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodler")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getNoodlerAccountForNoodleAccount(noodleAccountId: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.platform, "noodler"), eq(noodleAccounts.noodleAccountId, noodleAccountId)));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async deleteNoodlerAccount(id: string): Promise<NoodleAccount | null> {
      const existing = await this.getNoodlerAccountById(id);
      if (!existing) return null;
      const postRows = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, id));
      const postIds = postRows.map((post) => post.id);
      const interactionRows =
        postIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))
          : [];
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx
          .delete(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodler")));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async listNoodlerStageProfiles(): Promise<NoodlerManagedStageProfile[]> {
      const accounts = await this.listNoodlerAccounts();
      return Promise.all(
        accounts.map(async (account) => {
          const disclosureMode = account.settings.privacy.identityDisclosure ?? null;
          const publicAccount =
            (disclosureMode === "open" || disclosureMode === "hinted") && account.noodleAccountId
              ? await this.getAccountById(account.noodleAccountId)
              : null;
          return {
            id: account.id,
            noodleAccountId: account.noodleAccountId,
            handle: account.handle,
            displayName: account.displayName,
            bio: account.bio,
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            disclosureMode,
            stagePersonality: account.settings.privacy.stagePersonality ?? "",
            access: account.settings.privacy.access,
            autoPosting: account.settings.scheduler.autoPosting ?? defaultAutoPostingSettings(),
            publicIdentity: publicAccount
              ? { displayName: publicAccount.displayName, handle: publicAccount.handle }
              : null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          };
        }),
      );
    },

    async createNoodlerAccount(
      noodleAccountId: string,
      stageProfile: NoodleStageProfileInput,
      wizardExecutionId?: string,
    ): Promise<NoodleAccount | null> {
      const publicAccount = await this.getAccountById(noodleAccountId);
      if (!publicAccount || (publicAccount.kind !== "persona" && publicAccount.kind !== "character")) return null;
      const timestamp = now();
      const id = newId();
      const base = emptyNoodleAccountSettings();
      const accountSettings: NoodleAccountSettings = {
        ...base,
        profile: wizardExecutionId ? { noodlerWizardExecutionId: wizardExecutionId } : base.profile,
        scheduler: { autoPosting: defaultAutoPostingSettings() },
        privacy: {
          identityDisclosure: stageProfile.disclosureMode,
          stagePersonality: stageProfile.stagePersonality,
          access: { hiddenFromAccountIds: [] },
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
        platform: "noodler",
        noodleAccountId,
        // Rollback mirrors; see schema/noodle.ts.
        visibility: "private",
        publicAccountId: noodleAccountId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getNoodlerAccountById(id);
    },

    async updateNoodlerStageProfile(id: string, stageProfile: NoodleStageProfileInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodler")));
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
      await reconcilePublicHandles();
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

      const id = await db.transaction(async (tx) => {
        const timestamp = now();
        const accountId = newId();
        const displayName = input.displayName.trim() || (input.kind === "persona" ? "User" : "Character");
        const publicRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"));
        const reserved = new Set(publicRows.map((row) => normalizeHandle(row.handle, row.entityId)));
        const handle = nextAvailablePublicHandle(normalizeHandle(displayName, input.entityId), reserved);
        await tx.insert(noodleAccounts).values({
          id: accountId,
          kind: input.kind,
          entityId: input.entityId,
          handle,
          displayName,
          bio: input.bio?.trim() ?? "",
          avatarUrl: input.avatarUrl ?? null,
          invited: String(input.invited ?? input.kind === "persona"),
          settings: JSON.stringify({
            ...emptyNoodleAccountSettings(),
            profile: input.avatarCrop !== undefined ? { avatarCrop: input.avatarCrop } : {},
          }),
          platform: "noodle",
          noodleAccountId: null,
          // Rollback mirrors; see schema/noodle.ts.
          visibility: "public",
          publicAccountId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return accountId;
      });
      return (await this.getAccountById(id))!;
    },

    async updateAccount(id: string, input: NoodleAccountUpdateInput): Promise<NoodleAccount | null> {
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
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
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
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
        if (row.platform === "noodler" && input.subtree !== "privacy" && input.subtree !== "scheduler") return null;
        if (row.platform !== "noodler" && input.subtree === "scheduler") return null;
        if (row.platform !== "noodler" && input.subtree === "privacy" && input.patch.access !== undefined)
          return null;
        if (
          row.platform === "noodler" &&
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
          const currentAuto = current.scheduler.autoPosting ?? defaultAutoPostingSettings();
          const patchAuto = input.patch.autoPosting;
          const config = patchAuto
            ? {
                enabled: patchAuto.enabled ?? currentAuto.enabled,
                imagesEnabled: patchAuto.imagesEnabled ?? currentAuto.imagesEnabled,
              }
            : currentAuto;
          next = { ...current, scheduler: { autoPosting: config } };
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

    /** Every NoodleR creator account with automatic posting enabled, settings attached. */
    async listAutoPostEnabledAccounts(): Promise<NoodleAccount[]> {
      const rows = await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodler"));
      return rows.map(mapAccount).filter((account) => account.settings.scheduler.autoPosting?.enabled === true);
    },

    async ensureNoodlerReserveState(at = new Date()): Promise<{
      lastObservedBudgetTime: string;
      preparationNotBefore: string;
    }> {
      return db.transaction(async (tx) => {
        const existing = (await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID)))[0];
        const observedMs = Math.max(at.getTime(), existing ? Date.parse(existing.lastObservedBudgetTime) : 0);
        if (existing) {
          const observed = new Date(observedMs).toISOString();
          if (observed !== existing.lastObservedBudgetTime) {
            await tx.update(noodlerReserveState).set({ lastObservedBudgetTime: observed, updatedAt: at.toISOString() }).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          }
          return { lastObservedBudgetTime: observed, preparationNotBefore: existing.preparationNotBefore };
        }
        const timestamp = at.toISOString();
        const preparationNotBefore = new Date(at.getTime() + ROLLING_DAY_MS).toISOString();
        await tx.insert(noodlerReserveState).values({
          id: NOODLER_RESERVE_STATE_ID,
          lastObservedBudgetTime: timestamp,
          preparationNotBefore,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return { lastObservedBudgetTime: timestamp, preparationNotBefore };
      });
    },

    async claimNoodlerAutomaticAttempt(
      kind: "text" | "image",
      limit: number,
      at = new Date(),
    ): Promise<{ status: "claimed"; claimId: string; claimedAt: string } | { status: "exhausted" | "holding" }> {
      return db.transaction(async (tx) => {
        let state = (await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID)))[0];
        if (!state) {
          const timestamp = at.toISOString();
          await tx.insert(noodlerReserveState).values({
            id: NOODLER_RESERVE_STATE_ID,
            lastObservedBudgetTime: timestamp,
            preparationNotBefore: new Date(at.getTime() + ROLLING_DAY_MS).toISOString(),
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          return { status: "holding" };
        }
        const effectiveMs = Math.max(at.getTime(), Date.parse(state.lastObservedBudgetTime));
        const effectiveIso = new Date(effectiveMs).toISOString();
        if (effectiveIso !== state.lastObservedBudgetTime) {
          await tx.update(noodlerReserveState).set({ lastObservedBudgetTime: effectiveIso, updatedAt: at.toISOString() }).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          state = { ...state, lastObservedBudgetTime: effectiveIso };
        }
        if (effectiveMs < Date.parse(state.preparationNotBefore)) return { status: "holding" };
        const cutoff = effectiveMs - ROLLING_DAY_MS;
        // Prune claims that have left the rolling window, in the same transaction that
        // counts them: they can never affect the budget again, and the ledger is scanned
        // on every claim.
        const cutoffIso = new Date(cutoff).toISOString();
        await tx.delete(noodlerAutomaticAttempts).where(lt(noodlerAutomaticAttempts.claimedAt, cutoffIso));
        const attempts = (await tx.select().from(noodlerAutomaticAttempts)).filter(
          (row) => row.kind === kind && Date.parse(row.claimedAt) > cutoff,
        );
        if (attempts.length >= limit) return { status: "exhausted" };
        const claimId = newId();
        await tx.insert(noodlerAutomaticAttempts).values({
          id: claimId,
          kind,
          claimedAt: effectiveIso,
          outcome: "claimed",
        });
        return { status: "claimed", claimId, claimedAt: effectiveIso };
      });
    },

    async completeNoodlerAutomaticAttempt(claimId: string, outcome: "completed" | "failed"): Promise<void> {
      await db.update(noodlerAutomaticAttempts).set({ outcome }).where(eq(noodlerAutomaticAttempts.id, claimId));
    },

    async createNoodlerPreparedPost(input: {
      creatorAccountId: string;
      generatedAt: string;
      publishAt: string;
      payload: NoodlerPreparedPostPayload;
      policyFingerprint: string;
    }): Promise<string> {
      const id = newId();
      await db.insert(noodlerPreparedPosts).values({
        id,
        creatorAccountId: input.creatorAccountId,
        generatedAt: input.generatedAt,
        publishAt: input.publishAt,
        payload: JSON.stringify(input.payload),
        policyFingerprint: input.policyFingerprint,
        state: "prepared",
        publishedPostId: null,
        imageState: input.payload.metadata.noodlerMediaPath ? "attached" : "none",
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        updatedAt: input.generatedAt,
      });
      return id;
    },

    async listNoodlerPreparedPosts(): Promise<Array<{
      id: string;
      creatorAccountId: string;
      generatedAt: string;
      publishAt: string;
      payload: NoodlerPreparedPostPayload;
      policyFingerprint: string;
      state: NoodlerPreparedPostState;
      publishedPostId: string | null;
      imageState: NoodlerPreparedImageState;
      imageClaimToken: string | null;
      imageClaimLeaseUntil: string | null;
    }>> {
      const rows = await db.select().from(noodlerPreparedPosts).orderBy(noodlerPreparedPosts.publishAt);
      return rows.map((row) => ({
        ...row,
        state: (row.state === "prepared" || row.state === "published" ? row.state : "discarded") as NoodlerPreparedPostState,
        imageState: (row.imageState === "pending" || row.imageState === "generating" || row.imageState === "attached" || row.imageState === "rejected" || row.imageState === "closed"
          ? row.imageState
          : "none") as NoodlerPreparedImageState,
        payload: parseRecord(row.payload) as NoodlerPreparedPostPayload,
      }));
    },

    async discardNoodlerPreparedPost(id: string, at = new Date()): Promise<void> {
      const current = (await db.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
      if (current) unlinkNoodlerMedia(String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null);
      await db.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: at.toISOString() }).where(eq(noodlerPreparedPosts.id, id));
    },

    async discardPreparedPostsAfterManualPost(creatorAccountId: string, manualCreatedAt: string): Promise<number> {
      const start = Date.parse(manualCreatedAt);
      const end = start + MANUAL_POST_INVALIDATION_MS;
      const rows = await db.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.creatorAccountId, creatorAccountId));
      const ids = rows
        .filter((row) => row.state === "prepared" && Date.parse(row.publishAt) > start && Date.parse(row.publishAt) <= end)
        .map((row) => row.id);
      if (ids.length > 0) {
        for (const row of rows.filter((candidate) => ids.includes(candidate.id))) {
          unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
        }
        await db.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: now() }).where(inArray(noodlerPreparedPosts.id, ids));
      }
      return ids.length;
    },

    async publishDueNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      if (!settings.enableNoodler || !settings.autoPostingScheduleEnabled) return 0;
      const due = (await this.listNoodlerPreparedPosts()).filter(
        (item) => item.state === "prepared" && Date.parse(item.publishAt) <= at.getTime(),
      );
      if (due.length === 0) return 0;
      // One pass over posts for the whole batch: the crash-recovery lookup below only needs
      // to know which prepared items already published, not to rescan every post per item.
      const publishedPreparedIds = new Map<string, { id: string }>();
      for (const post of await db.select().from(noodlePosts)) {
        const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
        if (typeof preparedId === "string" && !publishedPreparedIds.has(preparedId)) {
          publishedPreparedIds.set(preparedId, { id: post.id });
        }
      }
      let published = 0;
      for (const item of due) {
        const didPublish = await db.transaction(async (tx) => {
          const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, item.id)))[0];
          if (!current || current.state !== "prepared" || Date.parse(current.publishAt) > at.getTime()) return false;
          const existingPost = publishedPreparedIds.get(current.id);
          if (existingPost) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "published", publishedPostId: existingPost.id, updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const accountRow = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, current.creatorAccountId)))[0];
          if (!accountRow || accountRow.platform !== "noodler") {
            await tx.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: at.toISOString() }).where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const account = mapAccount(accountRow);
          const sourceRow = account.noodleAccountId
            ? (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, account.noodleAccountId)))[0]
            : null;
          if (
            !account.settings.scheduler.autoPosting?.enabled ||
            !sourceRow ||
            current.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, sourceRow.updatedAt)
          ) {
            await tx.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: at.toISOString() }).where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const payload = parseRecord(current.payload) as NoodlerPreparedPostPayload;
          if (typeof payload.content !== "string" || !payload.content.trim()) {
            await tx.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: at.toISOString() }).where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const postId = newId();
          const imageState = current.imageState === "attached" ? "attached" : "closed";
          await tx.insert(noodlePosts).values({
            id: postId,
            authorAccountId: account.id,
            title: typeof payload.title === "string" ? payload.title : null,
            content: payload.content,
            imageUrl: typeof parseRecord(payload.metadata).noodlerMediaPath === "string" ? noodlerPostMediaUrl(postId) : null,
            imagePrompt: typeof payload.imagePrompt === "string" ? payload.imagePrompt : null,
            parentPostId: null,
            quotePostId: null,
            source: "generated",
            access: payload.access === "public" ? "public" : "locked",
            metadata: JSON.stringify({ ...parseRecord(payload.metadata), noodlerPreparedPostId: current.id }),
            authorSnapshot: JSON.stringify(snapshotForAccount(account)),
            createdAt: current.publishAt,
            updatedAt: at.toISOString(),
          });
          await tx
            .update(noodlerPreparedPosts)
            .set({
              state: "published",
              publishedPostId: postId,
              imageState,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
              updatedAt: at.toISOString(),
            })
            .where(eq(noodlerPreparedPosts.id, current.id));
          return true;
        });
        if (didPublish) published += 1;
      }
      return published;
    },

    async reconcileNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      const repaired = await db.transaction(async (tx) => {
        const [items, posts] = await Promise.all([
          tx.select().from(noodlerPreparedPosts),
          tx.select().from(noodlePosts),
        ]);
        const postsByPreparedId = new Map<string, typeof posts>();
        for (const post of posts) {
          const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
          if (typeof preparedId !== "string") continue;
          const existing = postsByPreparedId.get(preparedId) ?? [];
          existing.push(post);
          postsByPreparedId.set(preparedId, existing);
        }
        let count = 0;
        for (const item of items) {
          const linkedPosts = (postsByPreparedId.get(item.id) ?? []).sort((left, right) =>
            left.id.localeCompare(right.id),
          );
          const linkedPost = linkedPosts[0];
          if (linkedPost) {
            if (item.state !== "published" || item.publishedPostId !== linkedPost.id) {
              await tx
                .update(noodlerPreparedPosts)
                .set({ state: "published", publishedPostId: linkedPost.id, updatedAt: at.toISOString() })
                .where(eq(noodlerPreparedPosts.id, item.id));
              count += 1;
            }
          } else if (item.state === "published") {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "prepared", publishedPostId: null, updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, item.id));
            count += 1;
          }
        }
        return count;
      });
      const items = await this.listNoodlerPreparedPosts();
      const prepared = items.filter((item) => item.state === "prepared");
      const accounts = new Map(
        [...(await this.listAccounts()), ...(await this.listNoodlerAccounts())].map((account) => [account.id, account]),
      );
      const invalidIds = prepared
        .filter((item) => {
          const account = accounts.get(item.creatorAccountId);
          const source = account?.noodleAccountId ? accounts.get(account.noodleAccountId) : null;
          return (
            !account ||
            !source ||
            !account.settings.scheduler.autoPosting?.enabled ||
            item.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, source.updatedAt)
          );
        })
        .map((item) => item.id);
      // Soonest first, so lowering postsPerDay discards the latest excess items and leaves
      // the imminent ones intact.
      const validFuture = prepared
        .filter((item) => !invalidIds.includes(item.id) && Date.parse(item.publishAt) > at.getTime())
        .sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
      const excessIds = validFuture.slice(settings.postsPerDay).map((item) => item.id);
      const discarded = [...new Set([...invalidIds, ...excessIds])];
      if (discarded.length > 0) {
        for (const item of prepared.filter((candidate) => discarded.includes(candidate.id))) {
          unlinkNoodlerMedia(String(parseRecord(item.payload.metadata).noodlerMediaPath ?? "") || null);
        }
        await db.update(noodlerPreparedPosts).set({ state: "discarded", updatedAt: at.toISOString() }).where(inArray(noodlerPreparedPosts.id, discarded));
      }
      return repaired + discarded.length;
    },

    async getNoodlerReserveStatus(at = new Date()): Promise<NoodlerReserveStatus> {
      const settings = await this.getSettings();
      const state = await this.ensureNoodlerReserveState(at);
      const effectiveMs = Date.parse(state.lastObservedBudgetTime);
      const cutoff = effectiveMs - ROLLING_DAY_MS;
      const [items, attempts, creators] = await Promise.all([
        this.listNoodlerPreparedPosts(),
        db.select().from(noodlerAutomaticAttempts),
        this.listAutoPostEnabledAccounts(),
      ]);
      const prepared = items.filter((item) => item.state === "prepared");
      return {
        preparedCount: prepared.length,
        preparedThrough: prepared.reduce<string | null>((latest, item) => !latest || item.publishAt > latest ? item.publishAt : latest, null),
        textAttemptsUsed: attempts.filter((row) => row.kind === "text" && Date.parse(row.claimedAt) > cutoff).length,
        imageAttemptsUsed: attempts.filter((row) => row.kind === "image" && Date.parse(row.claimedAt) > cutoff).length,
        postsPerDay: settings.postsPerDay,
        preparationNotBefore: state.preparationNotBefore,
        creators: creators.map((account) => ({
          accountId: account.id,
          nextPreparedAt: prepared.find((item) => item.creatorAccountId === account.id)?.publishAt ?? null,
        })),
      };
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
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
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
            eq(noodleAccounts.platform, "noodle"),
          ),
        );
    },

    async listPosts(options: { limit?: number; since?: string } = {}): Promise<NoodlePost[]> {
      const limit = Math.max(1, Math.min(300, Math.floor(options.limit ?? 120)));
      const noodleAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (noodleAccountIds.length === 0) return [];
      const rows = options.since
        ? await db
            .select()
            .from(noodlePosts)
            .where(
              and(gt(noodlePosts.createdAt, options.since), inArray(noodlePosts.authorAccountId, noodleAccountIds)),
            )
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit)
        : await db
            .select()
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, noodleAccountIds))
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit);
      return rows.map((row) => mapPost(row));
    },

    async listPostsBefore(before: string): Promise<NoodlePost[]> {
      const noodleAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (noodleAccountIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(and(lt(noodlePosts.createdAt, before), inArray(noodlePosts.authorAccountId, noodleAccountIds)))
        .orderBy(desc(noodlePosts.createdAt));
      return rows.map((row) => mapPost(row));
    },

    async listNoodlerPostsByAccount(accountId: string, limit = 8): Promise<NoodlerManagedPost[]> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(eq(noodlePosts.authorAccountId, accountId))
        .orderBy(desc(noodlePosts.createdAt))
        .limit(Math.max(1, Math.min(50, Math.floor(limit))));
      return rows.map(mapManagedPost);
    },

    async listNoodlerPostsByAccounts(accountIds: string[], limit = 8): Promise<Map<string, NoodlerManagedPost[]>> {
      const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
      const result = new Map<string, NoodlerManagedPost[]>();
      if (accountIds.length === 0) return result;
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(inArray(noodlePosts.authorAccountId, accountIds))
        .orderBy(desc(noodlePosts.createdAt));
      for (const row of rows) {
        const post = mapManagedPost(row);
        const existing = result.get(post.authorAccountId);
        if (existing) {
          if (existing.length < boundedLimit) existing.push(post);
        } else {
          result.set(post.authorAccountId, [post]);
        }
      }
      return result;
    },

    async getNoodlerPostById(id: string): Promise<NoodlerManagedPost | null> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getNoodlerAccountById(row.authorAccountId))) return null;
      return mapManagedPost(row);
    },

    async getNoodlerPostByWizardExecution(
      accountId: string,
      executionId: string,
    ): Promise<NoodlerManagedPost | null> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return null;
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, accountId));
      const row = rows.find((candidate) => parseRecord(candidate.metadata).noodlerWizardExecutionId === executionId);
      return row ? mapManagedPost(row) : null;
    },

    async createNoodlerPost(input: NoodlerPostPersistenceInput): Promise<NoodlerManagedPost | null> {
      const account = await this.getNoodlerAccountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = input.id ?? newId();
      return db.transaction(async (tx) => {
        await tx.insert(noodlePosts).values({
          id,
          authorAccountId: input.authorAccountId,
          title: input.title?.trim() || null,
          content: input.content,
          imageUrl: input.imageUrl ?? null,
          imagePrompt: input.imagePrompt ?? null,
          parentPostId: null,
          quotePostId: null,
          source: input.source ?? "manual",
          access: input.access ?? "public",
          metadata: JSON.stringify(input.metadata ?? {}),
          authorSnapshot: JSON.stringify(snapshotForAccount(account)),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        return rows[0] ? mapManagedPost(rows[0]) : null;
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
        title: null,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: input.parentPostId ?? null,
        quotePostId: input.quotePostId ?? null,
        source: input.source ?? "manual",
        access: "public",
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
        // Finalization owns the terminal transition: drop the pending-review marker so a
        // finalized (success or failed) row never keeps contradictory pending lifecycle state.
        const mergedMetadata = { ...parseRecord(row.metadata), ...input.metadata };
        delete mergedMetadata.imagePendingReview;
        await tx
          .update(noodlePosts)
          .set({
            imageUrl: input.imageUrl,
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            metadata: JSON.stringify(mergedMetadata),
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: now(),
          })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async updatePost(id: string, input: NoodlePostUpdateInput): Promise<NoodlePost | null> {
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, existing.authorAccountId), eq(noodleAccounts.platform, "noodle")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapPost(existing).metadata, input.poll);
        if (input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(noodlePosts)
          .set({
            ...(input.content !== undefined && { content: input.content.trim().slice(0, 4000) }),
            ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(noodlePosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getPostById(id);
    },

    async deletePost(id: string): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      const interactions = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (interactions.some((interaction) => !noodleAccountIds.has(interaction.actorAccountId))) return null;
      const interactionIds = interactions.map((interaction) => interaction.id);
      const digests = await db.select().from(noodleActivityDigests);
      const relatedDigests = digests.filter(
        (digest) =>
          digest.sourcePostId === id ||
          (digest.sourceInteractionId !== null && interactionIds.includes(digest.sourceInteractionId)),
      );
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => noodleAccountIds.has(accountId)),
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

    async updateNoodlerPost(
      id: string,
      input: NoodlerPostUpdateInput,
      media?: { imageUrl: string; noodlerMediaPath: string },
    ): Promise<NoodlerManagedPost | null> {
      const imageChanged = Boolean(media || input.removeImage);
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, existing.authorAccountId), eq(noodleAccounts.platform, "noodler")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapManagedPost(existing).metadata, input.poll);
        if (imageChanged) {
          for (const key of [
            "noodlerMediaPath",
            "imageGenerated",
            "imageProvider",
            "imageModel",
            "imageStyleProfileId",
            "imageGenerationFailed",
            "imageGenerationError",
            "imagePendingReview",
          ]) {
            delete nextMetadata[key];
          }
        }
        if (media) nextMetadata.noodlerMediaPath = media.noodlerMediaPath;
        if (input.removeImage || input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(noodlePosts)
          .set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.content !== undefined && { content: input.content.trim().slice(0, 4000) }),
            ...(imageChanged && {
              imageUrl: media?.imageUrl ?? null,
              imagePrompt: null,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((imageChanged || input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(noodlePosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getNoodlerPostById(id);
    },

    async deleteNoodlerPost(id: string): Promise<NoodlerManagedPost | null> {
      const existing = await this.getNoodlerPostById(id);
      if (!existing) return null;
      const interactionRows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async resetTimeline(): Promise<void> {
      const noodleAccountIds = (await this.listAccounts()).map((account) => account.id);
      const publicPosts =
        noodleAccountIds.length > 0
          ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, noodleAccountIds))
          : [];
      const publicPostIds = publicPosts.map((post) => post.id);
      const publicInteractions = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, publicPostIds));
      const noodleAccountIdSet = new Set(noodleAccountIds);
      const protectedPostIds = new Set(
        publicInteractions
          .filter((interaction) => !noodleAccountIdSet.has(interaction.actorAccountId))
          .map((interaction) => interaction.postId),
      );
      const interactionPostById = new Map(
        publicInteractions.map((interaction) => [interaction.id, interaction.postId]),
      );
      const digests = await db.select().from(noodleActivityDigests);
      for (const digest of digests) {
        if (parseStringArray(digest.accountIds).every((accountId) => noodleAccountIdSet.has(accountId))) continue;
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
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, [...publicPostIds]))
        .orderBy(noodleInteractions.createdAt);
      return rows.filter((row) => noodleAccountIds.has(row.actorAccountId)).map(mapInteraction);
    },

    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100): Promise<NoodleInteraction[]> {
      if (!(await this.getAccountById(actorAccountId))) return [];
      const noodleAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (noodleAccountIds.length === 0) return [];
      const publicPostIds = new Set(
        (
          await db
            .select({ id: noodlePosts.id })
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, noodleAccountIds))
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
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (deletedRows.some((row) => !noodleAccountIds.has(row.actorAccountId))) return [];
      const relatedDigests = await db
        .select()
        .from(noodleActivityDigests)
        .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => noodleAccountIds.has(accountId)),
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

    async createInteraction(postId: string, input: PublicCreateInteractionCommand): Promise<NoodleInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        return upsertPollVote(
          postId,
          input.actorAccountId,
          input.content?.trim() ?? "",
          "noodle",
          input.imageUrl?.trim() || null,
        );
      }

      const [post, actor] = await Promise.all([this.getPostById(postId), this.getAccountById(input.actorAccountId)]);
      if (!post || !actor) return null;

      if (parentInteractionId) {
        const parent = await this.getInteractionById(parentInteractionId);
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }

      return insertInteraction(postId, {
        actor,
        type: input.type,
        content: input.content,
        imageUrl: input.imageUrl,
        parentInteractionId,
      });
    },

    async deleteInteraction(postId: string, input: PublicRemoveInteractionCommand): Promise<NoodleInteraction | null> {
      const post = await this.getPostById(postId);
      if (!post) return null;
      return deleteStoredInteraction(postId, input, "protect-public-digests");
    },

    // Callers pass post IDs already resolved from NoodleR-account queries
    // (listNoodlerPostsByAccounts), so this trusts them and issues a single bulk
    // read instead of re-validating each ID with getNoodlerPostById (2N reads).
    async listNoodlerInteractions(noodlerPostIds: string[] = []): Promise<NoodleInteraction[]> {
      if (noodlerPostIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, noodlerPostIds))
        .orderBy(noodleInteractions.createdAt);
      return rows.map(mapInteraction);
    },

    async claimNoodlerCreatorReply(
      creatorAccountId: string,
      postId: string,
      parentInteractionId: string,
      viewerAccountId: string,
      at = now(),
      ceiling = DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS,
    ): Promise<NoodlerCreatorReplyClaimResult> {
      return db.transaction(async (tx) => {
        const existingClaims = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(
            and(
              eq(noodlerCreatorReplyClaims.parentInteractionId, parentInteractionId),
              eq(noodlerCreatorReplyClaims.creatorAccountId, creatorAccountId),
            ),
          );
        const existing = existingClaims[0];
        if (existing) {
          const replyRows = existing.replyInteractionId
            ? await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, existing.replyInteractionId))
            : [];
          return { status: "duplicate", interaction: replyRows[0] ? mapInteraction(replyRows[0]) : null };
        }

        const [creatorRows, parentRows, viewerRows] = await Promise.all([
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "noodler"))),
          tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentInteractionId)),
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, viewerAccountId), eq(noodleAccounts.platform, "noodle"))),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        const viewerRow = viewerRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          !viewerRow ||
          viewerRow.kind !== "persona" ||
          parentRow.type !== "reply" ||
          (!parentRow.content?.trim() && !parentRow.imageUrl?.trim()) ||
          parentRow.postId !== postId ||
          parentRow.actorAccountId !== viewerAccountId ||
          creatorRow.noodleAccountId === viewerAccountId ||
          parentRow.actorAccountId === creatorAccountId
        ) {
          return { status: "ineligible" };
        }
        const postRows = await tx
          .select()
          .from(noodlePosts)
          .where(and(eq(noodlePosts.id, postId), eq(noodlePosts.authorAccountId, creatorAccountId)));
        const postRow = postRows[0];
        if (!postRow) return { status: "ineligible" };

        const creator = mapAccount(creatorRow);
        if (isNoodlerHiddenFromViewer(creator, viewerAccountId)) return { status: "ineligible" };
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            ),
          tx
            .select()
            .from(noodlePostUnlocks)
            .where(
              and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, post.id)),
            ),
        ]);
        if (
          !canViewNoodlerPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return { status: "ineligible" };
        }

        const cutoff = new Date(Date.parse(at) - ROLLING_DAY_MS).toISOString();
        // Prune only expired claims that never produced a reply. A claim that did is the
        // permanent "this comment already has a creator reply" key and must outlive the
        // budget window; an orphan one gates nothing once it leaves it.
        const expiredOrphans = (await tx.select().from(noodlerCreatorReplyClaims)).filter(
          (row) => !row.replyInteractionId && row.claimedAt < cutoff,
        );
        if (expiredOrphans.length > 0) {
          await tx.delete(noodlerCreatorReplyClaims).where(
            inArray(
              noodlerCreatorReplyClaims.id,
              expiredOrphans.map((row) => row.id),
            ),
          );
        }
        const recentClaims = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(gt(noodlerCreatorReplyClaims.claimedAt, cutoff));
        if (recentClaims.length >= ceiling) return { status: "exhausted" };

        const claimId = newId();
        await tx.insert(noodlerCreatorReplyClaims).values({
          id: claimId,
          postId: post.id,
          parentInteractionId,
          creatorAccountId,
          replyInteractionId: null,
          claimedAt: at,
        });
        return {
          status: "claimed",
          claimId,
          creator,
          post,
          parent: mapInteraction(parentRow),
          viewer: mapAccount(viewerRow),
        };
      });
    },

    /**
     * Release a claim whose generation never produced a reply. The claim is the dedupe key
     * for "this comment already has a creator reply", so keeping it after a failure would
     * block that comment forever; no provider call succeeded, so nothing is billed twice.
     */
    async releaseNoodlerCreatorReplyClaim(claimId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(eq(noodlerCreatorReplyClaims.id, claimId));
        if (!rows[0] || rows[0].replyInteractionId) return;
        await tx.delete(noodlerCreatorReplyClaims).where(eq(noodlerCreatorReplyClaims.id, claimId));
      });
    },

    async finalizeNoodlerCreatorReplyClaim(
      claimId: string,
      content: string,
    ): Promise<NoodleInteraction | null> {
      return db.transaction(async (tx) => {
        const claimRows = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(eq(noodlerCreatorReplyClaims.id, claimId));
        const claim = claimRows[0];
        if (!claim) return null;
        if (claim.replyInteractionId) {
          const existing = await tx
            .select()
            .from(noodleInteractions)
            .where(eq(noodleInteractions.id, claim.replyInteractionId));
          return existing[0] ? mapInteraction(existing[0]) : null;
        }
        const [creatorRows, parentRows, postRows] = await Promise.all([
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, claim.creatorAccountId), eq(noodleAccounts.platform, "noodler"))),
          tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, claim.parentInteractionId)),
          tx.select().from(noodlePosts).where(eq(noodlePosts.id, claim.postId)),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        const postRow = postRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          !postRow ||
          parentRow.type !== "reply" ||
          parentRow.postId !== postRow.id ||
          postRow.authorAccountId !== creatorRow.id
        ) {
          return null;
        }
        const creator = mapAccount(creatorRow);
        if (isNoodlerHiddenFromViewer(creator, parentRow.actorAccountId)) return null;
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, parentRow.actorAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorRow.id),
              ),
            ),
          tx
            .select()
            .from(noodlePostUnlocks)
            .where(
              and(
                eq(noodlePostUnlocks.viewerAccountId, parentRow.actorAccountId),
                eq(noodlePostUnlocks.postId, postRow.id),
              ),
            ),
        ]);
        if (
          !canViewNoodlerPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
        const replyId = newId();
        await tx.insert(noodleInteractions).values({
          id: replyId,
          postId: postRow.id,
          parentInteractionId: parentRow.id,
          actorAccountId: creatorRow.id,
          type: "reply",
          content: content.trim(),
          imageUrl: null,
          actorSnapshot: JSON.stringify(snapshotForAccount(creator)),
          createdAt: now(),
        });
        await tx
          .update(noodlerCreatorReplyClaims)
          .set({ replyInteractionId: replyId })
          .where(eq(noodlerCreatorReplyClaims.id, claimId));
        const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, replyId));
        return rows[0] ? mapInteraction(rows[0]) : null;
      });
    },

    async createNoodlerInteraction(
      postId: string,
      input: NoodlerCreateInteractionCommand,
    ): Promise<NoodleInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        return upsertPollVote(postId, input.actorAccountId, input.content?.trim() ?? "", "noodler", null);
      }

      const [post, actor] = await Promise.all([
        this.getNoodlerPostById(postId),
        this.getAccountById(input.actorAccountId),
      ]);
      if (!post || !actor) return null;

      if (parentInteractionId) {
        const parentRows = await db
          .select()
          .from(noodleInteractions)
          .where(eq(noodleInteractions.id, parentInteractionId));
        const parent = parentRows[0];
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }

      return insertInteraction(postId, {
        actor,
        type: input.type,
        content: input.content,
        parentInteractionId,
      });
    },

    async deleteNoodlerInteraction(
      postId: string,
      input: NoodlerRemoveInteractionCommand,
    ): Promise<NoodleInteraction | null> {
      const post = await this.getNoodlerPostById(postId);
      if (!post) return null;
      return deleteStoredInteraction(postId, input, "delete-directly");
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
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (!uniqueAccountIds.every((accountId) => noodleAccountIds.has(accountId))) {
        throw new Error("Public Noodle digests cannot reference NoodleR accounts.");
      }
      await db.transaction(async (tx) => {
        if (input.sourceInteractionId) {
          const existingDigests = await tx
            .select()
            .from(noodleActivityDigests)
            .where(eq(noodleActivityDigests.sourceInteractionId, input.sourceInteractionId));
          const publicDigestIds = existingDigests
            .filter((digest) =>
              parseStringArray(digest.accountIds).every((accountId) => noodleAccountIds.has(accountId)),
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
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (
        !parseStringArray(existing.accountIds).every((accountId) => noodleAccountIds.has(accountId)) ||
        !uniqueAccountIds.every((accountId) => noodleAccountIds.has(accountId))
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
      const noodleAccountIds = new Set((await this.listAccounts()).map((account) => account.id));

      return rows
        .filter((row) => {
          const digest = mapDigest(row);
          if (!digest.accountIds.every((accountId) => noodleAccountIds.has(accountId))) return false;
          if (row.sourceInteractionId) {
            const interaction = sourceInteractionById.get(row.sourceInteractionId);
            if (!interaction || !noodleAccountIds.has(interaction.actorAccountId)) return false;
            const sourcePost = sourcePostById.get(interaction.postId);
            return Boolean(sourcePost && noodleAccountIds.has(sourcePost.authorAccountId));
          }
          // Older model-authored summaries had only a refresh-run reference,
          // so there is no way to invalidate them when their source post or
          // comment is deleted. Deterministic event digests supersede them.
          if (row.sourceRunId && !row.sourcePostId) return false;
          if (!row.sourcePostId) return true;
          const sourcePost = sourcePostById.get(row.sourcePostId);
          if (!sourcePost || !noodleAccountIds.has(sourcePost.authorAccountId)) return false;
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
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "noodler"))),
        ]);
        const viewer = viewerRows[0] ? mapAccount(viewerRows[0]) : null;
        const creator = creatorRows[0] ? mapAccount(creatorRows[0]) : null;
        if (
          !viewer ||
          viewer.kind !== "persona" ||
          viewer.platform !== "noodle" ||
          !creator ||
          creator.noodleAccountId === viewerAccountId ||
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
        if (existing[0]) {
          const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
          const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
          if (!followingAccountIds.includes(creatorAccountId)) {
            followingAccountTimestamps[creatorAccountId] ??= existing[0].createdAt;
            await tx
              .update(noodleAccounts)
              .set({
                settings: JSON.stringify({
                  ...viewer.settings,
                  social: {
                    ...viewer.settings.social,
                    followingAccountIds: [...followingAccountIds, creatorAccountId],
                    followingAccountTimestamps,
                  },
                }),
                updatedAt: now(),
              })
              .where(eq(noodleAccounts.id, viewerAccountId));
          }
          return mapSubscription(existing[0]);
        }
        if (viewer.settings.wallet.coins < NOODLER_SUBSCRIPTION_COST) return null;
        const timestamp = now();
        const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
        const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
        followingAccountTimestamps[creatorAccountId] ??= timestamp;
        const nextViewerSettings: NoodleAccountSettings = {
          ...viewer.settings,
          social: {
            ...viewer.settings.social,
            followingAccountIds: followingAccountIds.includes(creatorAccountId)
              ? followingAccountIds
              : [...followingAccountIds, creatorAccountId],
            followingAccountTimestamps,
          },
          wallet: { coins: viewer.settings.wallet.coins - NOODLER_SUBSCRIPTION_COST },
        };
        // Insert before debiting: a duplicate row means the subscription already existed,
        // and that path must stay idempotent rather than charging again or throwing.
        try {
          await tx.insert(noodleAccountSubscriptions).values({
            id: newId(),
            viewerAccountId,
            creatorAccountId,
            createdAt: timestamp,
          });
        } catch (error) {
          if (
            !isFileUniqueConstraintError(error, "noodle_account_subscriptions", ["viewerAccountId", "creatorAccountId"])
          ) {
            throw error;
          }
          const duplicate = await tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            );
          return duplicate[0] ? mapSubscription(duplicate[0]) : null;
        }
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(nextViewerSettings), updatedAt: timestamp })
          .where(eq(noodleAccounts.id, viewerAccountId));
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

    async listSubscriptionsForCreator(creatorAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId))
        .orderBy(desc(noodleAccountSubscriptions.createdAt));
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
        if (
          !viewer ||
          viewer.kind !== "persona" ||
          viewer.platform !== "noodle" ||
          !postRow ||
          mapPost(postRow).access !== "locked"
        ) {
          return null;
        }
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.platform, "noodler")));
        const author = authorRows[0] ? mapAccount(authorRows[0]) : null;
        if (
          !author ||
          author.noodleAccountId === viewerAccountId ||
          isNoodlerHiddenFromViewer(author, viewerAccountId)
        ) {
          return null;
        }
        const existing = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
        if (existing[0]) return mapPostUnlock(existing[0]);
        if (viewer.settings.wallet.coins < NOODLER_UNLOCK_COST) return null;
        const timestamp = now();
        const nextViewerSettings: NoodleAccountSettings = {
          ...viewer.settings,
          wallet: { coins: viewer.settings.wallet.coins - NOODLER_UNLOCK_COST },
        };
        // Insert before debiting, so an already-unlocked post stays idempotent and free.
        try {
          await tx.insert(noodlePostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: timestamp });
        } catch (error) {
          if (!isFileUniqueConstraintError(error, "noodle_post_unlocks", ["viewerAccountId", "postId"])) throw error;
          const duplicate = await tx
            .select()
            .from(noodlePostUnlocks)
            .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
          return duplicate[0] ? mapPostUnlock(duplicate[0]) : null;
        }
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(nextViewerSettings), updatedAt: timestamp })
          .where(eq(noodleAccounts.id, viewerAccountId));
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
