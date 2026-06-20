export type AchievementRank = "bronze" | "silver" | "gold";

export type AchievementIconKey =
  | "graduation"
  | "discord"
  | "heart"
  | "credits"
  | "mari"
  | "conversation"
  | "roleplay"
  | "game"
  | "character"
  | "lorebook"
  | "persona";

export type AchievementCategory = "community" | "collection" | "creation" | "milestone";

export type AchievementMetric =
  | "conversationChats"
  | "roleplayChats"
  | "gameChats"
  | "characters"
  | "lorebooks"
  | "personas";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIconKey;
  rank?: AchievementRank;
  rankLabel?: string;
  groupId?: string;
  target?: number;
  metric?: AchievementMetric;
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
  | "chat_created"
  | "library_changed";
