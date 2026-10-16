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
// state, connected chat link, hierarchical map state, folder/sort placement,
// or running state such as multiplayer rooms and macro variables).

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
  "scenePackageOrigin",
  "scenePackageData",
  "sceneInitiatorCharId",
  "sceneDescription",
  "sceneScenario",
  "sceneSystemPrompt",
  "sceneRating",
  "sceneStatus",
  "sceneOriginRepliesAllowed",
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
  "gameInventoryTurn",
  "gameInventedItems",
  "lastMapPosition",
  // Engine-owned per-chat write ordinals (#5406). They index one chat's counter space, so saving
  // them into a reusable profile would stamp every chat the profile is applied to with another
  // chat's numbering; being excluded also means an apply PRESERVES the target chat's own mirror
  // instead of wiping the ordering its packages depend on.
  "metadataWriteOrdinals",
  // Running state of this one chat (#7409): its multiplayer room, memory upkeep, macro variables,
  // paused members, autonomous message counters, and its characters' statuses and about-me text.
  "multiplayer",
  "multiplayerSetup",
  "multiplayerSetupComplete",
  "multiplayerGameSetup",
  "multiplayerCharacterMemories",
  "multiplayerGameAppliedMessages",
  "multiplayerGameTurn",
  "advancedMemoryState",
  "macroVariables",
  "inactiveCharacterIds",
  "intentCooldowns",
  "autonomousDailyBudget",
  "conversationCharacterStatuses",
  "conversationStatusOverrides",
  "conversationAboutMeOverrides",
  // Also this chat's own: Advanced Memory roster events (message ids), a running encounter, removed
  // members' names, summary retries, current sprite expressions, and the link a Roleplay DM thread
  // keeps to the chat it came from.
  "advancedMemoryRosterChanges",
  "encounterActive",
  "archivedCharacterSnapshots",
  "conversationSummaryFailures",
  "spriteExpressions",
  "roleplayDmThread",
  "dmOriginChatId",
  "dmOriginChatName",
  "dmOriginMessageId",
  "dmSourceUserMessageId",
  "dmTargetCharacterId",
  // Also kept for this one chat: Decision sticky and cooldown timers, a Hierarchical Maps shared-world
  // link, the characters featured in the Tracker Panel, and whether the Conversation setup was finished.
  "decisionTimers",
  "spatialSharedWorldLink",
  "trackerFeaturedCharacterKeys",
  "conversationSetupComplete",
] as const;

/**
 * State a capability package keeps for one chat under its own name, also left out of profiles. It is
 * a separate list because the one above also marks names the Engine owns, which packages may not
 * claim (see ENGINE_OWNED_METADATA_KEY_PREFIXES), and these names belong to the package.
 */
export const CHAT_PRESET_EXCLUDED_PACKAGE_METADATA_KEYS: readonly string[] = [
  "pixelforge", // PixelForge's save for this chat
  "pixelforgeCorruptExcerpt", // A damaged PixelForge save, kept for repair
] as const;

/**
 * The only chat settings "Save and update N other chats" copies from a profile (#7409). Each is a
 * setting Chat Settings controls in Conversation or Roleplay that should match across the chats
 * using one profile. A chat updated this way keeps every other key exactly as it is: its story, cast,
 * lorebooks, files, background, notes, progress, and anything agents or packages keep in it. Each
 * listed key gets what applying the profile by hand gives it, so a key the profile has no value for
 * goes back to its default. Applying a profile by hand still sets everything the profile holds. Game
 * mode has no profiles, so its keys are not listed.
 *
 * Left off on purpose: who may use narrator-only Roleplay commands (it only works with the chat's own
 * narrator) and Noodle's permission to use the chat's messages (each chat gives that itself).
 *
 * Some keys copy only in part (see syncFollowerMetadata in chat-presets.storage.ts). Advanced
 * Parameters and image captioning's switch and connection reach only chats on the profile's
 * connection, because they are edited against it and otherwise use each chat's own connection's
 * defaults. Character schedules change only when the profile has a value, because without one they
 * follow each chat's own characters. The agents each chat sets up itself (knowledge sources, a target
 * lorebook, sprite characters) stay on or off, with their prompt templates, as the chat has them.
 * Older names of listed settings are listed too, so a chat's old value cannot come back.
 */
export const CHAT_PROFILE_FOLLOWER_SYNC_KEYS: readonly string[] = [
  // Generation and context
  "chatParameters", // Advanced Parameters: only for chats on the profile's connection
  "contextMessageLimit", // How many messages go into the context
  "excludePastReasoning", // Leave earlier reasoning out of the context
  "pastReasoningLimit", // How many earlier reasoning blocks to keep
  "lorebookTokenBudget", // Token budget for lorebook entries
  "imageCaptioningEnabled", // Describe attached images for the model: only on the profile's connection
  "imageCaptioningConnectionId", // Connection that describes images: only on the profile's connection
  "imageCaptioningPrompt", // Instructions for image descriptions
  "enableTools", // Function calling on or off
  "forceToolCall", // Make the model call a tool
  "activeToolIds", // Tools the model may call
  "cardCssMode", // How character card styles apply
  "scopedRegexMode", // Which scoped regex scripts run
  // Group chats
  "groupChatMode", // Merged or individual narration
  "groupResponseOrder", // Who answers next
  "groupTurnPromptEnabled", // Tell each character it is their turn
  "groupSpeakerColors", // Colour speaker names
  "groupSpeakerNamesInHistory", // Speaker names in the history
  // Conversation features
  "crossChatAwareness", // Characters remember their other chats
  "autonomousMessages", // Characters message on their own
  "autonomousDailyCapOverride", // Daily cap for those messages
  "characterExchanges", // Characters talk to each other
  "conversationSchedulesEnabled", // Character schedules on or off: only when the profile has a value
  "characterCommands", // Conversation commands on or off
  "conversationCommandToggles", // Which Conversation commands are on
  "imageGenConnectionId", // Selfie image connection
  "selfieResolution", // Selfie size
  "selfieUseAvatarReferences", // Send avatars as selfie references
  "selfieIncludeCharacterAppearance", // Add card appearance to selfie prompts
  "sceneVideoFirstFrame", // Video messages: the picture a clip starts from
  "conversationCallsEnabled", // Calls: the call button
  "conversationCallVoiceCues", // Calls: voice cues in replies
  "conversationCallSummaryConnectionId", // Calls: connection that summarises calls
  "slurp2ActivityContextEnabled", // Characters remember their Slurp activity
  // Roleplay commands
  "roleplayCommandsEnabled", // Roleplay commands on or off
  "roleplayDmCommandsEnabled", // Older switch for character DMs, read when roleplayCommandsEnabled is missing
  "roleplayCommandToggles", // Which Roleplay commands are on
  "roleplaySoundConnectionId", // Connection for sound effects
  // Agents
  "enableAgents", // Agents on or off
  "activeAgentIds", // Which agents run, except the agents each chat sets up itself
  "agentPromptTemplateIds", // Prompt template per agent, except the agents each chat sets up itself
  "customAgentImageSettings", // Image connection and style per custom agent
  "agentWriteApprovalRequired", // Review agent changes before they are saved
  "attachSummariesToAgents", // Give agents the chat summary
  "attachLorebooksToTrackers", // Give trackers the lorebooks
  "manualTrackers", // Trackers run only when asked
  "manualTrackerAgentTypes", // Which trackers run only when asked
  "illustratorImageConnectionId", // Illustrator: image connection
  "illustratorPromptConnectionId", // Illustrator: prompt connection
  "illustratorIncludeCharacterAppearance", // Illustrator: add card appearance
  "illustratorUseAvatarReferences", // Illustrator: send avatars as references
  "illustratorAutoBackgroundsEnabled", // Illustrator: make a background when the scene moves
  "illustratorImagesPerGeneration", // Illustrator: images per run
  "illustratorRunInterval", // Illustrator: run interval
  "sceneVideoConnectionId", // Illustrator: connection for scene videos
  "imageStyleProfileId", // Illustrator: image style
  "narrativeDirectorSecretPlotEnabled", // Director: secret plot
  "narrativeDirectorSecretPlotRunInterval", // Director: secret plot interval
  "proseGuardianBannedWords", // Prose Guardian: banned words
  "proseGuardianAvoidInstructions", // Prose Guardian: what to avoid
  "proseGuardianStyleInstructions", // Prose Guardian: preferred style
  "proseGuardianHoldForRewrite", // Hold a reply until it is rewritten
  "lorebookKeeperReadBehindMessages", // Lorebook Keeper: how far behind it reads
  "customMusicFolder", // Music DJ: music folder
  "spotifySourceType", // Music DJ: playlist or artist
  "spotifyPlaylistId", // Music DJ: playlist
  "spotifyPlaylistName", // Music DJ: playlist name
  "spotifyArtist", // Music DJ: artist
  "enableHapticFeedback", // Haptics on or off
  "hapticSensitivity", // Haptics: strength
  "hapticIncidentalContact", // Haptics: light contact
  "hapticIntifaceUrl", // Haptics: device server address
  "spriteDisplayModes", // Expressions: sprite types shown
  "spritePosition", // Expressions: sprite side
  "spriteScale", // Expressions: sprite size
  "spriteOpacity", // Expressions: sprite opacity
  "expressionSpriteScale", // Expressions: expression sprite size
  "fullBodySpriteScale", // Expressions: full-body sprite size
  "expressionSpriteOpacity", // Expressions: expression sprite opacity
  "fullBodySpriteOpacity", // Expressions: full-body sprite opacity
  "expressionOnlyActiveSprites", // Expressions: show only the latest result's sprites
  "expressionAvatarsEnabled", // Expressions: change avatars too
  "storyboardAgentImageAwareShotPlanningEnabled", // Storyboard: plan shots from images
  "storyboardAgentAnimationRefinementTemplateId", // Storyboard: animation refinement template
  "roleplayStoryboardAutoGenerateMode", // Storyboard: what it makes on its own
  "roleplayStoryboardRunInterval", // Storyboard: run interval
  "roleplayStoryboardKeyframeCount", // Storyboard: keyframes
  "roleplayStoryboardAnimationDurationSeconds", // Storyboard: animation length
  "roleplayStoryboardPromptConnectionId", // Storyboard: prompt connection
  "roleplayStoryboardImageConnectionId", // Storyboard: image connection
  "roleplayStoryboardVideoConnectionId", // Storyboard: video connection
  "roleplayStoryboardEpisodeTemplateId", // Storyboard: episode template
  "roleplayStoryboardStyleTemplateId", // Storyboard: style template
  "roleplayStoryboardAnimationTemplateId", // Storyboard: animation template
  "roleplayStoryboardOutputTemplateId", // Storyboard: output template
  "roleplayStoryboardIncludeCharacterAppearance", // Storyboard: add card appearance
  "roleplayStoryboardUseAvatarReferences", // Storyboard: send avatars as references
  "roleplayStoryboardUseNovelAiCharacterPrompts", // Storyboard: NovelAI character prompts
  "roleplayStoryboardUsePromptTemplate", // Storyboard: use a prompt template
  "roleplayStoryboardImagePromptTemplateId", // Storyboard: image prompt template
  "roleplayStoryboardVideoPromptTemplateId", // Storyboard: video prompt template
  "longTermMemoryRecallStyle", // Long-term memory: recall style
  "longTermMemoryBudgetTokens", // Long-term memory: token budget
  "longTermMemoryMaxChunks", // Long-term memory: most memories per reply
  // Memory and summaries
  "enableMemoryRecall", // Memory Recall on or off
  "advancedMemory", // Advanced Memory settings; each chat keeps its own knowledge anchors and narrator
  "summaryConnectionId", // Summary connection
  "summaryMaxTokens", // Summary length
  "summaryTailMessages", // Recent messages left visible when summarised ones are hidden
  "dayRolloverHour", // Hour a new day starts for day summaries
  "semanticSummaryRetrievalEnabled", // Find older summaries by meaning
  "semanticSummaryRecentCount", // How many recent weeks to include
  "semanticSummaryOlderCount", // How many older weeks to include
  "semanticSummaryMinSimilarity", // How close an older week must be
  // Translation
  "translationProvider", // Translator service
  "translationConnectionId", // Translator connection
  "translationTargetLang", // Older language for both directions, read when one of the next two is missing
  "translationInputTargetLang", // Language your messages are translated to
  "translationOutputTargetLang", // Language replies are translated to
  "translationDeeplApiKey", // DeepL key
  "translationDeeplxUrl", // DeepLX address
  "translationPrompt", // Older instructions for both directions, read when one of the next two is missing
  "translationInputPrompt", // Instructions for translating your messages
  "translationOutputPrompt", // Instructions for translating replies
  "autoTranslate", // Translate replies on their own
  "translateInput", // Translate your messages
  "showInputTranslateButton", // Translate button in the message box
  "translationDisplayOnly", // Show only the translation once there is one
  // Display and layout
  "windowLayout", // Window and button layout
  "chatSettingsHintDismissed", // Chat Settings tips hidden
] as const;

/**
 * Whether saving a profile may also update this chat: it still uses the profile and is not a
 * multiplayer room, which keeps its own settings (Chat Settings is hidden there).
 */
export function chatFollowsChatPreset(
  metadata: { appliedChatPresetId?: unknown; multiplayer?: unknown; multiplayerSetup?: unknown } | null | undefined,
  presetId: string,
): boolean {
  return (
    !!metadata &&
    metadata.appliedChatPresetId === presetId &&
    !metadata.multiplayer &&
    metadata.multiplayerSetup !== true
  );
}

/** Top-level chat keys that CAN be saved into a profile. */
export const CHAT_PRESET_INCLUDED_CHAT_KEYS: readonly string[] = ["connectionId", "promptPresetId"] as const;
