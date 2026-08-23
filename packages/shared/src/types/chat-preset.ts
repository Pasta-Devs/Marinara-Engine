// ──────────────────────────────────────────────
// Chat Settings Profile Types
// Legacy exported type names retain "ChatPreset" for storage/API compatibility.
// ──────────────────────────────────────────────
// Reusable bundles of chat settings that the user can apply as defaults
// when creating new chats. One "active" profile per chat mode determines
// the starting state for any newly created chat in that mode.
//
// What profiles DO carry: connection, prompt preset selection, and most metadata
// (agents, tools, lorebook settings, translation, advanced parameters,
// context limit, memory recall, discord mirror, etc.).
//
// What profiles DO NOT carry: per-chat identity (name, characters,
// persona, group, sprites, scene prompt, generated summaries, tags,
// ephemeral lorebook overrides, generated schedules, scene lifecycle
// state, connected chat link, hierarchical map state, folder/sort placement).

import type { ChatMode, ChatMetadata } from "./chat.js";

/** Settings stored in a chat settings profile. All fields optional; only set ones override defaults. */
export interface ChatPresetSettings {
  /** Top-level chat fields */
  connectionId?: string | null;
  promptPresetId?: string | null;
  /** Subset of ChatMetadata — chat-specific keys (sprites, summary, tags, etc.) are stripped before saving. */
  metadata?: Partial<ChatMetadata>;
}

/** A chat settings profile stored in the database. */
export interface ChatPreset {
  id: string;
  name: string;
  /** Which chat mode this profile applies to. */
  mode: ChatMode;
  /** True for the built-in "Default" profile (cannot be deleted, renamed, or saved into). */
  isDefault: boolean;
  /** True for the profile currently used as the starting state for new chats of this mode. */
  isActive: boolean;
  /** Bundled chat settings (JSON). */
  settings: ChatPresetSettings;
  createdAt: string;
  updatedAt: string;
}

/** Metadata keys that must NOT be saved into a profile (chat-specific). */
export const CHAT_PRESET_EXCLUDED_METADATA_KEYS: readonly string[] = [
  // Generated summaries stay with the chat; summary settings can still be profiled.
  "summary",
  "summaryEntries",
  "lastAutomaticSummaryMessageId",
  "daySummaries",
  "weekSummaries",
  "tags",
  "appliedChatPresetId",
  "branchName",
  "branchParentChatId",
  "branchParentMessageId",
  "branchMessageId",
  "agentVariables",
  "presetChoices",
  "spriteCharacterIds",
  "spritePlacements",
  "spriteCharacterVisualSettings",
  "entryStateOverrides",
  "entryTimingStates",
  "trackerStatIconOverrides",
  "groupScenarioOverride",
  "groupScenarioText",
  "characterSchedules",
  "scheduleWeekStart",
  "spotifyRecentTracks",
  "autonomousUnreadCount",
  "autonomousUnreadCharacterIds",
  "autonomousUnreadAt",
  "sceneOriginChatId",
  "sceneInitiatorCharId",
  "sceneDescription",
  "sceneScenario",
  "sceneSystemPrompt",
  "sceneRating",
  "sceneStatus",
  "sceneConversationContext",
  "sceneRelationshipHistory",
  "sceneBackground",
  "activeSceneChatId",
  "sceneBusyCharIds",
  // Lorebooks are owned by the chat, never by the profile.
  "activeLorebookIds",
  // Hierarchical Maps definitions and per-chat editing choices stay with the chat.
  "spatialContext",
  "spatialContextHierarchyProfile",
  "spatialMapGenerationPreferences",
  // Generated Game state is session identity/history, not reusable setup.
  "gameId",
  "gameSessionNumber",
  "gameSessionStatus",
  "gameIntroPresented",
  "gameCurrentSessionStartedAt",
  "gameActiveState",
  "gameGmCharacterId",
  "gamePartyCharacterIds",
  "gamePartyChatId",
  "gameMap",
  "gameMaps",
  "activeGameMapId",
  "gameInitialMapFallback",
  "gamePreviousSessionSummaries",
  "gameStoryArc",
  "gamePlotTwists",
  "gameDialogueChatId",
  "gameCombatChatId",
  "gameCombatState",
  "gameNpcs",
  "gameLastIllustrationTurn",
  "gameLastIllustrationSessionNumber",
  "gameLastIllustrationTag",
  "gameRecentSpotifyTracks",
  "gameLorebookKeeperLorebookId",
  "gameLorebookKeeperLastRun",
  "gameBlueprint",
  "gameCharacterCards",
  "gameWidgetState",
  "gameMorale",
  "lastMapPosition",
  // Engine-owned per-chat write ordinals (#5406). They index one chat's counter space, so saving
  // them into a reusable profile would stamp every chat the profile is applied to with another
  // chat's numbering; being excluded also means an apply PRESERVES the target chat's own mirror
  // instead of wiping the ordering its packages depend on.
  "metadataWriteOrdinals",
] as const;

/** Top-level chat keys that CAN be saved into a profile. */
export const CHAT_PRESET_INCLUDED_CHAT_KEYS: readonly string[] = ["connectionId", "promptPresetId"] as const;
