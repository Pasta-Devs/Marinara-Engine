// ──────────────────────────────────────────────
// Noodle Fake Social Media Types
// ──────────────────────────────────────────────
import type { LegacyPersonaAvatarCrop, PersonaAvatarCrop } from "./persona.js";

export type NoodleAccountKind = "persona" | "character" | "random_user";
/**
 * Which simulated platform an account lives on. This is content separation
 * between two fictional products, NOT a privacy or security control — see
 * `NoodlePostAccess` for the actual paywall/visibility concept.
 */
export type NoodlePlatform = "noodle" | "noodler";
export type NoodleInteractionType = "like" | "repost" | "reply" | "vote";
export type NoodlePostSource = "manual" | "generated";
/** The real privacy concept: who may read a NoodleR post. Deliberately keeps the word "public". */
export type NoodlePostAccess = "public" | "locked";
export type NoodleTheme = "system" | "light" | "dark";
export type NoodleCarryoverMode = "off" | "conversation" | "roleplay" | "game" | "all";
export type NoodleCarryoverTarget = "conversation" | "roleplay" | "game";
export type NoodleParticipantSelectionMode = "all" | "random_range" | "exact";
export type NoodleAvatarCrop = PersonaAvatarCrop | LegacyPersonaAvatarCrop;
export type NoodleIdentityDisclosure = "open" | "hinted" | "secret";
export type NoodlerOnboardingState = "incomplete" | "zero" | "completed";

export interface NoodleAccountAccessSettings {
  hiddenFromAccountIds: string[];
}

export interface NoodleWalletSettings {
  coins: number;
}

export interface NoodleAccountProfileSettings {
  avatarCrop?: NoodleAvatarCrop | null;
  bannerUrl?: string;
  location?: string;
  profileGenerated?: boolean;
  profileManuallyEdited?: boolean;
  noodlerWizardExecutionId?: string;
}

export interface NoodleAccountSocialSettings {
  followingAccountIds?: string[];
  followingAccountTimestamps?: Record<string, string>;
  notificationsReadAt?: string;
}

export interface NoodleAutoPostingSettings {
  enabled: boolean;
  /** NoodleR-owned image enablement; independent of public Noodle's enableImagePrompts. */
  imagesEnabled: boolean;
}

export interface NoodleAccountSchedulerSettings {
  autoPosting?: NoodleAutoPostingSettings;
}

/** Per-creator outcome of the global "Refresh NoodleR now" action; one creator never rolls back another. */
export type NoodlerRefreshNowOutcomeStatus =
  | "generated"
  | "disabled"
  | "busy"
  | "connection_required"
  | "connection_not_found"
  | "noodler_account_not_found"
  | "skipped"
  | "error";

export interface NoodlerRefreshNowOutcome {
  accountId: string;
  status: NoodlerRefreshNowOutcomeStatus;
}
export interface NoodleAccountPrivacySettings {
  identityDisclosure?: NoodleIdentityDisclosure;
  stagePersonality?: string;
  access: NoodleAccountAccessSettings;
}

export interface NoodleAccountSettings {
  profile: NoodleAccountProfileSettings;
  social: NoodleAccountSocialSettings;
  scheduler: NoodleAccountSchedulerSettings;
  privacy: NoodleAccountPrivacySettings;
  wallet: NoodleWalletSettings;
}

export interface NoodlePollOption {
  id: string;
  label: string;
}

export interface NoodlePoll {
  question: string;
  options: NoodlePollOption[];
}

export interface NoodlePostImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface NoodleSettings {
  refreshesPerDay: number;
  participantSelectionMode: NoodleParticipantSelectionMode;
  participantMin: number;
  participantMax: number;
  maxGeneratedPostsPerRefresh: number;
  maxRepliesPerRefresh: number;
  maxRepostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxImagesPerRefresh: number;
  enableImagePrompts: boolean;
  imageGenerationConnectionId: string | null;
  imageGenerationPrompt: string;
  imageGenerationUseAvatarReferences: boolean;
  imageGenerationIncludeDescriptions: boolean;
  allowGalleryImageAttachments: boolean;
  imageCaptioningEnabled: boolean;
  imageCaptioningConnectionId: string | null;
  imageCaptioningUseConnectionDefault: boolean;
  enableLorebookContext: boolean;
  includeCharacterSchedules: boolean;
  enableEnhancedTimelineWriting: boolean;
  allowProfessorMari: boolean;
  allowRandomUsers: boolean;
  invitedCharacterGroupIds: string[];
  carryoverMode: NoodleCarryoverMode;
  carryoverModes: NoodleCarryoverTarget[];
  carryoverHours: number;
  carryoverMaxItems: number;
  theme: NoodleTheme;
  generationConnectionId: string | null;
  enableNoodler: boolean;
  /** Editable creative guidance injected into every NoodleR post generation. */
  noodlerGenerationGuidance: string;
  /** Master switch for automatic posting; pauses the scheduler without disabling NoodleR. */
  autoPostingScheduleEnabled: boolean;
  /** Rolling text-attempt ceiling and target maximum publication density. */
  postsPerDay: number;
  /** Durable first-run completion flag shared by every client. */
  noodlerOnboardingComplete: boolean;
  /** Explicit durable first-run sentinel, including an intentional zero-creator completion. */
  noodlerOnboardingState: NoodlerOnboardingState;
  /** Avoid overnight automatic posts for creators without a character schedule. */
  noodlerNightQuiet: boolean;
}

export interface NoodlerReserveCreatorStatus {
  accountId: string;
  nextPreparedAt: string | null;
}

export interface NoodlerReserveStatus {
  preparedCount: number;
  preparedThrough: string | null;
  textAttemptsUsed: number;
  imageAttemptsUsed: number;
  postsPerDay: number;
  preparationNotBefore: string;
  creators: NoodlerReserveCreatorStatus[];
}

export interface NoodleAccount {
  id: string;
  kind: NoodleAccountKind;
  entityId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarCrop: NoodleAvatarCrop | null;
  invited: boolean;
  settings: NoodleAccountSettings;
  platform: NoodlePlatform;
  noodleAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoodlerStageProfile {
  id: string;
  noodleAccountId: string | null;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarCrop: NoodleAvatarCrop | null;
  disclosureMode: NoodleIdentityDisclosure | null;
  stagePersonality: string;
  publicIdentity: { displayName: string; handle: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoodlerManagedStageProfile extends NoodlerStageProfile {
  access: NoodleAccountAccessSettings;
  autoPosting: NoodleAutoPostingSettings;
}

export interface NoodlerProfileSource {
  id: string;
  kind: NoodleAccountKind;
  entityId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
}

export interface NoodleAuthorSnapshot {
  id: string;
  kind: NoodleAccountKind;
  entityId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarCrop: NoodleAvatarCrop | null;
}

export interface NoodlePost {
  id: string;
  authorAccountId: string;
  content: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  parentPostId: string | null;
  quotePostId: string | null;
  source: NoodlePostSource;
  access: NoodlePostAccess;
  metadata: Record<string, unknown>;
  authorSnapshot: NoodleAuthorSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoodlerManagedPost extends NoodlePost {
  title: string | null;
}

export interface NoodleAccountSubscription {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  createdAt: string;
}

export interface NoodlerSubscriber {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarCrop: NoodleAvatarCrop | null;
  subscribedAt: string;
}

export interface NoodlePostUnlock {
  id: string;
  viewerAccountId: string;
  postId: string;
  createdAt: string;
}

export interface NoodlerPostView {
  id: string;
  authorAccountId: string;
  access: NoodlePostAccess;
  locked: boolean;
  title: string | null;
  content: string | null;
  /** True when the post owns media, including while locked (imageUrl stays null then). */
  hasImage: boolean;
  imageUrl: string | null;
  imagePrompt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  /** Empty for locked posts — use likeCount/replyCount for the teaser footer. */
  interactions: NoodleInteraction[];
  likeCount: number;
  replyCount: number;
}

export interface NoodlerViewerCreator {
  profile: NoodlerStageProfile;
  subscribed: boolean;
  followed: boolean;
  posts: NoodlerPostView[];
}

export interface NoodlerViewerScope {
  viewer: NoodleAccount;
  creators: NoodlerViewerCreator[];
}

export interface NoodleInteraction {
  id: string;
  postId: string;
  parentInteractionId: string | null;
  actorAccountId: string;
  type: NoodleInteractionType;
  content: string | null;
  imageUrl: string | null;
  actorSnapshot: NoodleAuthorSnapshot | null;
  createdAt: string;
}

export type NoodlerCreatorReplyResult =
  | { status: "generated"; interaction: NoodleInteraction }
  | { status: "duplicate"; interaction: NoodleInteraction | null }
  | { status: "exhausted" }
  | { status: "busy" }
  | { status: "ineligible" }
  | { status: "connection_required" }
  | { status: "connection_not_found" };

export interface NoodleDigestEntry {
  id: string;
  accountIds: string[];
  content: string;
  sourceRunId: string | null;
  sourcePostId: string | null;
  sourceInteractionId: string | null;
  createdAt: string;
}

export type NoodleRefreshAttemptKind = "initial" | "text_only_fallback" | "correction";

export interface NoodleRefreshAttempt {
  sequence: number;
  kind: NoodleRefreshAttemptKind;
  response: string;
  rejectionReason: string | null;
  createdAt: string;
}

export interface NoodleRefreshRun {
  id: string;
  status: "running" | "completed" | "failed";
  activeAccountIds: string[];
  prompt: string;
  result: string | null;
  error: string | null;
  attempts: NoodleRefreshAttempt[];
  createdAt: string;
  updatedAt: string;
}

export type NoodleRefreshSchedulerState = "disabled" | "scheduled" | "due" | "retrying" | "completed";

export interface NoodleRefreshSchedulerStatus {
  state: NoodleRefreshSchedulerState;
  scheduleDate: string;
  timezone: string;
  refreshesPerDay: number;
  scheduledTimes: string[];
  completedTimes: string[];
  completedSlots: number;
  successfulRefreshes: number;
  skippedSlots: number;
  nextRefreshAt: string | null;
  nextAttemptAt: string | null;
  lastAutomaticRefreshAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface NoodleBootstrap {
  settings: NoodleSettings;
  scheduler: NoodleRefreshSchedulerStatus;
  accounts: NoodleAccount[];
  posts: NoodlePost[];
  interactions: NoodleInteraction[];
  digests: NoodleDigestEntry[];
}
