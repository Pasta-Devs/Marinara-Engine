// ──────────────────────────────────────────────
// Noodle Fake Social Media Types
// ──────────────────────────────────────────────
import type { LegacyPersonaAvatarCrop, PersonaAvatarCrop } from "./persona.js";

export type NoodleAccountKind = "persona" | "character" | "random_user";
export type NoodleAccountVisibility = "public" | "private";
export type NoodleInteractionType = "like" | "repost" | "reply" | "vote";
export type NoodlePostSource = "manual" | "generated";
export type NoodleTheme = "system" | "light" | "dark";
export type NoodleCarryoverMode = "off" | "conversation" | "roleplay" | "game" | "all";
export type NoodleCarryoverTarget = "conversation" | "roleplay" | "game";
export type NoodleParticipantSelectionMode = "all" | "random_range" | "exact";
export type NoodleAvatarCrop = PersonaAvatarCrop | LegacyPersonaAvatarCrop;
export type NoodleIdentityDisclosure = "open" | "hinted" | "secret";

export interface NoodleAccountProfileSettings {
  avatarCrop?: NoodleAvatarCrop | null;
  bannerUrl?: string;
  location?: string;
  profileGenerated?: boolean;
  profileManuallyEdited?: boolean;
}

export interface NoodleAccountSocialSettings {
  followingAccountIds?: string[];
  followingAccountTimestamps?: Record<string, string>;
  notificationsReadAt?: string;
}

export type NoodleAccountSchedulerSettings = Record<string, never>;
export interface NoodleAccountPrivacySettings {
  identityDisclosure?: NoodleIdentityDisclosure;
  stagePersonality?: string;
}

export interface NoodleAccountSettings {
  profile: NoodleAccountProfileSettings;
  social: NoodleAccountSocialSettings;
  scheduler: NoodleAccountSchedulerSettings;
  privacy: NoodleAccountPrivacySettings;
}

export interface NoodlePollOption {
  id: string;
  label: string;
}

export interface NoodlePoll {
  question: string;
  options: NoodlePollOption[];
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
  enableLorebookContext: boolean;
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
  visibility: NoodleAccountVisibility;
  publicAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoodlerStageProfile {
  id: string;
  publicAccountId: string | null;
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
  metadata: Record<string, unknown>;
  authorSnapshot: NoodleAuthorSnapshot | null;
  createdAt: string;
  updatedAt: string;
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
