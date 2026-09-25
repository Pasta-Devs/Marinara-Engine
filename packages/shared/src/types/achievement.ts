export type AchievementRank = "bronze" | "silver" | "gold";

export type AchievementIconKey =
  | "graduation"
  | "discord"
  | "heart"
  | "credits"
  | "mari"
  | "mari-drag"
  | "conversation"
  | "roleplay"
  | "game"
  | "character"
  | "lorebook"
  | "persona"
  | "trophy";

export type AchievementCategory = "community" | "collection" | "creation" | "milestone";

export type AchievementMetric =
  "conversationChats" | "roleplayChats" | "gameChats" | "characters" | "lorebooks" | "personas";

/** The package that contributed an achievement. Absent means the Engine's own catalog. */
export interface AchievementSource {
  packageId: string;
  packageName: string;
  packageVersion: string;
}

export interface AchievementDefinition {
  id: string;
  /** Stable UI catalog key. `title` remains the canonical fallback for older clients and partial locales. */
  titleKey: string;
  title: string;
  /** Stable UI catalog key. Ranked descriptions receive `target` for interpolation/pluralization. */
  descriptionKey: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIconKey;
  rank?: AchievementRank;
  rankLabel?: string;
  groupId?: string;
  target?: number;
  metric?: AchievementMetric;
  /** Package-served badge art. Wins over `icon` when the image loads. */
  iconUrl?: string;
  source?: AchievementSource;
}

/** What a capability package hands to `api.registerAchievements`. The Engine namespaces `id`
 *  under the package id, so a package only ever names its own badges. */
export interface PackagedAchievementDefinition {
  /** Package-local id. The stored id becomes `<packageId>.<id>`. */
  id: string;
  title: string;
  description: string;
  category?: AchievementCategory;
  icon?: AchievementIconKey;
  /** Path of an asset the package ships, relative to its asset root. */
  iconPath?: string;
  /** Ranked badge. Unlocks on its own when `readProgress` reaches this. */
  target?: number;
  /** Current count for a ranked badge. The package owns the counter. */
  readProgress?: () => number | Promise<number>;
}

export interface CapabilityAchievementHost {
  /** This package's own achievements, with current progress. */
  list(): Promise<AchievementProgress[]>;
  isUnlocked(id: string): Promise<boolean>;
  /** Marks the badge fulfilled. Resolves true only for the call that unlocked it. */
  unlock(id: string): Promise<boolean>;
}

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number | null;
}

export interface AchievementStatusResponse {
  definitions: AchievementDefinition[];
  progress: AchievementProgress[];
  unlockedCount: number;
  totalCount: number;
}

export interface AchievementTrackRequest {
  event: AchievementEvent;
}

export interface AchievementTrackResponse {
  newlyUnlocked: AchievementProgress[];
}

export type AchievementEvent =
  | "tutorial_completed"
  | "discord_clicked"
  | "kofi_clicked"
  | "credits_viewed"
  | "prof_mari_message_sent"
  | "prof_mari_dragged"
  | "chat_created"
  | "library_changed";
