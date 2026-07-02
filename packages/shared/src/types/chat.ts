// ──────────────────────────────────────────────
// Chat & Message Types
// ──────────────────────────────────────────────

import type { MariWorkspaceTraceItem } from "./professor-mari-workspace.js";
import type { GenerationGuideSource } from "../utils/generation-guide.js";
import type { HapticFeedbackSensitivity } from "./haptic.js";
import type { CustomEmojiSelectionPrefs } from "../schemas/custom-emoji.schema.js";

/** The four primary chat modes the engine supports. */
export type ChatMode = "conversation" | "roleplay" | "visual_novel" | "game";

/** How a multi-character (group) chat is handled. */
export type GroupChatMode = "merged" | "individual";

/** How individual-mode group chats decide response order. */
export type GroupResponseOrder = "sequential" | "smart" | "manual";

/** Spotify source constraints used by Music DJ. */
export type SpotifySourceType = "liked" | "playlist" | "artist" | "any";

export interface KnowledgeAgentSourceSettings {
  /** When true/omitted, this agent uses the chat's active lorebooks unless fixed sources are selected. */
  useChatActiveLorebooks?: boolean;
  /** Fixed lorebook IDs this agent should read instead of chat-active lorebooks. Empty means no fixed override. */
  sourceLorebookIds?: string[];
  /** Uploaded file source IDs. Used by Knowledge Retrieval only. */
  sourceFileIds?: string[];
}

export const CONVERSATION_COMMAND_KEYS = [
  "schedule_update",
  "cross_post",
  "selfie",
  "memory",
  "scene",
  "uno",
  "chess",
  "music",
  "haptic",
  "influence",
  "note",
] as const;

export type ConversationCommandKey = (typeof CONVERSATION_COMMAND_KEYS)[number];

export type ConversationCommandToggles = Partial<Record<ConversationCommandKey, boolean>>;

export type ConversationPresenceStatus = "online" | "idle" | "dnd" | "offline";

export type ConversationManualPresenceStatus = ConversationPresenceStatus;

export interface ConversationStatusOverride {
  status: ConversationManualPresenceStatus;
  activity?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

/** Role of a message in the conversation. */
export type MessageRole = "user" | "assistant" | "system" | "narrator";

/** Which side sprite sidebars / default sprite layouts prefer. */
export type SpriteSide = "left" | "right";

/** A saved on-screen sprite anchor position within the chat area. */
export interface SpritePlacement {
  /** Horizontal anchor percentage within the chat stage. */
  x: number;
  /** Vertical anchor percentage within the chat stage. */
  y: number;
}

/** A single chat conversation. */
export interface Chat {
  id: string;
  name: string;
  mode: ChatMode;
  characterIds: string[];
  /** Groups related chats together (like ST "chat files" per character) */
  groupId: string | null;
  personaId: string | null;
  promptPresetId: string | null;
  connectionId: string | null;
  /** ID of a linked chat (conversation ↔ roleplay bidirectional link) */
  connectedChatId: string | null;
  /** Folder this chat belongs to (null = root/unfiled) */
  folderId: string | null;
  /** Manual sort order within a folder (lower = higher). 0 = use default updatedAt sort. */
  sortOrder: number;
  /** Timestamp of the newest saved message; null until the chat has messages. */
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: ChatMetadata;
}

/** A folder for organising chats in the sidebar. */
export interface ChatFolder {
  id: string;
  name: string;
  mode: ChatMode;
  color: string;
  sortOrder: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A single day's auto-generated conversation summary. */
export interface DaySummaryEntry {
  /** Narrative recap of the day. */
  summary: string;
  /** Short strings the characters must remember going forward. */
  keyDetails: string[];
}

/** A single week's consolidated conversation summary (Monday → Sunday). */
export interface WeekSummaryEntry {
  /** Narrative recap of the week. */
  summary: string;
  /** Consolidated key details the characters must remember going forward. */
  keyDetails: string[];
}

/** A chat-scoped prompt template used by manual rolling summary generation. */
export interface ChatSummaryPromptTemplate {
  id: string;
  name: string;
  prompt: string;
}

/** Rolling summary entry category. Extensible beyond rolling summaries later. */
export type ChatSummaryEntryKind = "rolling";

/** Whether a rolling summary entry was user-created, agent-created, or migrated from the legacy blob. */
export type ChatSummaryEntryOrigin = "manual" | "automated" | "legacy";

/** Source selector used to create a rolling summary entry. */
export type ChatSummaryEntrySource = "last" | "range" | "agent";

/** A single structured rolling chat summary entry. */
export interface ChatSummaryEntry {
  id: string;
  kind: ChatSummaryEntryKind;
  origin: ChatSummaryEntryOrigin;
  title: string;
  content: string;
  enabled: boolean;
  sourceMode: ChatSummaryEntrySource;
  messageCount?: number;
  rangeStartIndex?: number;
  rangeEndIndex?: number;
  messageIds?: string[];
  /**
   * The exact messages this entry hid from AI when "Hide summarised messages" was
   * on (the summarized set minus the protected tail). Persisted so deletion can
   * restore precisely what was hidden, rather than assuming it equals messageIds.
   * Absent on entries created before this field or when nothing was hidden.
   */
  hiddenMessageIds?: string[];
  promptTemplateId?: string | null;
  tokenEstimate: number;
  createdAt: string;
  updatedAt: string;
}

/** A vectorized recall fragment created from one chat's messages. */
export interface ChatMemoryChunk {
  id: string;
  chatId: string;
  content: string;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  createdAt: string;
  /** False when chunking succeeded but embedding generation was unavailable. */
  hasEmbedding: boolean;
  /** Current vectorization state for display. */
  embeddingStatus?: "vectorized" | "pending" | "unavailable";
}

/**
 * Bounds for `ChatMetadata.summaryTailMessages` — the single source of truth for
 * the tail limits, shared by the server resolver (read) and the popover slider
 * (write) so display and persistence can't drift. `DEFAULT` applies only when the
 * value is unset; an explicit `MIN` (0) means "hide the whole batch".
 */
export const SUMMARY_TAIL_MESSAGES = { MIN: 0, MAX: 50, DEFAULT: 10 } as const;

/** Extra metadata stored on a chat. */
export interface ChatMetadata {
  /** Compiled enabled rolling summary text for context injection. Derived from summaryEntries when present. */
  summary: string | null;
  /** Structured rolling summary entries. Missing means legacy summary-only metadata. */
  summaryEntries?: ChatSummaryEntry[];
  /** Recent message count used by manual rolling summary generation and automatic summaries. */
  summaryContextSize?: number;
  /** User-message cadence for the automated roleplay summary updater. */
  summaryRunInterval?: number;
  /** Whether the Chat Summary popover should automatically generate rolling Roleplay summaries. */
  automaticSummaryEnabled?: boolean;
  /** Last assistant message ID processed by the automatic Roleplay summary updater. */
  lastAutomaticSummaryMessageId?: string | null;
  /** Chat-scoped manual summary prompt templates. Missing or empty uses the built-in default. */
  summaryPromptTemplates?: ChatSummaryPromptTemplate[];
  /** Selected manual summary prompt template ID. Null/omitted uses the built-in default. */
  activeSummaryPromptTemplateId?: string | null;
  /** Optional text connection used for manual and automatic Roleplay chat summaries. Null uses the agent default. */
  summaryConnectionId?: string | null;
  /**
   * When true, the automatic roleplay/visual-novel rolling summary hides the
   * messages it summarized (hiddenFromAI=true) except the most-recent
   * `summaryTailMessages`, so the summary is a net token reduction. Opt-in:
   * undefined/false never hides (back-compat for existing chats). Read by the
   * SERVER auto-summary path; promoted from the browser-local ui.store
   * `summaryPopoverSettings.hideSummarisedMessages` preference.
   */
  hideSummarisedMessages?: boolean;
  /** Custom tags for organisation */
  tags: string[];
  /** Whether agents are enabled for this chat */
  enableAgents: boolean;
  /** When true, agent output proposals such as lorebook, summary, and card updates require user review. */
  agentWriteApprovalRequired?: boolean;
  /** Per-agent enable overrides (agentId → boolean) */
  agentOverrides: Record<string, boolean>;
  /** Agent IDs scoped to this chat. Non-empty = only these agents run; empty = use globally-enabled agents. */
  activeAgentIds: string[];
  /** Per-chat selected named prompt template for each agent type. Missing/default = the agent's default prompt. */
  agentPromptTemplateIds?: Record<string, string>;
  /** Whether Illustrator should append matched character card appearance text to image prompts. */
  illustratorIncludeCharacterAppearance?: boolean;
  /** Whether Illustrator should send matching character/persona avatar references to image providers. */
  illustratorUseAvatarReferences?: boolean;
  /** Optional per-chat LLM connection override used only to write Illustrator/selfie image prompts. */
  illustratorPromptConnectionId?: string | null;
  /** Whether Conversation selfie commands should send the matching character avatar as a reference image. */
  selfieUseAvatarReferences?: boolean;
  /** Whether Game Mode scene illustrations should send matching character/persona avatar references. */
  gameImageUseAvatarReferences?: boolean;
  /** Whether Game Mode scene illustrations should append matched character appearance descriptions. */
  gameImageIncludeCharacterAppearance?: boolean;
  /** When false, Game Mode keeps manual Illustrator controls but stops automatic visual generations. */
  gameImageAutoGenerationEnabled?: boolean;
  /** Per-chat source overrides for knowledge agents. */
  knowledgeAgentSources?: Partial<Record<"knowledge-retrieval" | "knowledge-router", KnowledgeAgentSourceSettings>>;
  /** Narrative Director mode used when Push Story is armed. */
  narrativeDirectorMode?: "natural" | "random";
  /** Whether Narrative Director maintains a hidden Secret Plot arc for this roleplay chat. */
  narrativeDirectorSecretPlotEnabled?: boolean;
  /** Assistant-message cadence for Narrative Director Secret Plot maintenance. */
  narrativeDirectorSecretPlotRunInterval?: number;
  /** Explicit target lorebook for the Lorebook Keeper in this chat. Null/omitted = auto-pick. */
  lorebookKeeperTargetLorebookId?: string | null;
  /** How many assistant responses behind the latest available one Lorebook Keeper should read from. */
  lorebookKeeperReadBehindMessages?: number;
  /** Per-chat custom-emoji selection preferences — how the model is told which custom emojis it may use. */
  customEmojiSelection?: CustomEmojiSelectionPrefs;
  /** Tool/function IDs scoped to this chat. Non-empty = only these tools are sent; empty = use all enabled tools. */
  activeToolIds: string[];
  /** Per-chat variable selections for preset variables (variableName → value or values) */
  presetChoices: Record<string, string | string[]>;
  /** Chat-wide string variables persisted by agent tool calls (key → value). */
  agentVariables?: Record<string, string>;
  /** Group chat mode: "merged" (narrator) or "individual" (separate characters) */
  groupChatMode?: GroupChatMode;
  /** Group individual mode: color dialogues with speaker tags */
  groupSpeakerColors?: boolean;
  /** Group individual mode: prefix chat history turns with the speaker name before prompt merging. */
  groupSpeakerNamesInHistory?: boolean;
  /** Group individual mode response order: "sequential" or "smart" (agent-decided) */
  groupResponseOrder?: GroupResponseOrder;
  /** When true/omitted, individual group turns append a responding-character instruction to the prompt. */
  groupTurnPromptEnabled?: boolean;
  /** Chat members that are temporarily excluded from group prompt/generation participation. */
  inactiveCharacterIds?: string[];
  /** Characters with visible roleplay sprites enabled for this chat. */
  spriteCharacterIds?: string[];
  /** Which sprite file families the roleplay Expression Engine may display. */
  spriteDisplayModes?: Array<"expressions" | "full-body">;
  /** Preferred sidebar / default layout side for chat sprites. */
  spritePosition?: SpriteSide;
  /**
   * How creator-notes card CSS is applied in this chat:
   * "exclusive" (each character's CSS only styles their own messages) or "chat"
   * (all card CSS styles the whole chat area). Defaults to "disabled" (off) —
   * card styling is opt-in per chat.
   */
  cardCssMode?: "disabled" | "exclusive" | "chat";
  /**
   * How character-scoped regex scripts (those with target characters) apply at
   * display time in this chat: "exclusive" (a scoped script only transforms its
   * own character's messages) or "chat" (all scoped scripts transform every
   * message). Defaults to "disabled" — scoped scripts are off at display unless
   * opted in per chat. Global scripts (no target characters) are unaffected.
   */
  scopedRegexMode?: "disabled" | "exclusive" | "chat";
  /** Legacy display scale for roleplay Expression Engine sprites. */
  spriteScale?: number;
  /** Display scale for roleplay Expression Engine expression sprites. Falls back to spriteScale. */
  expressionSpriteScale?: number;
  /** Display scale for roleplay Expression Engine full-body sprites. Falls back to spriteScale. */
  fullBodySpriteScale?: number;
  /** Legacy display opacity for roleplay Expression Engine sprites. */
  spriteOpacity?: number;
  /** Display opacity for roleplay Expression Engine expression sprites. Falls back to spriteOpacity. */
  expressionSpriteOpacity?: number;
  /** Display opacity for roleplay Expression Engine full-body sprites. Falls back to spriteOpacity. */
  fullBodySpriteOpacity?: number;
  /** Saved freeform positions for enabled roleplay sprites. */
  spritePlacements?: Record<string, SpritePlacement>;
  /** When true, roleplay message avatars use the per-message Expression Engine sprite when one is available. */
  expressionAvatarsEnabled?: boolean;
  /** When true, a shared group scenario replaces individual character card scenarios */
  groupScenarioOverride?: boolean;
  /** The shared scenario text used when groupScenarioOverride is enabled */
  groupScenarioText?: string;
  /** Prose Guardian per-chat banned words/settings applied to the rewrite prompt. */
  proseGuardianBannedWords?: string | null;
  /** Prose Guardian per-chat prose habits to remove. */
  proseGuardianAvoidInstructions?: string | null;
  /** Prose Guardian per-chat preferred style instructions. */
  proseGuardianStyleInstructions?: string | null;
  /** Shared Prose Guardian / Continuity Checker toggle. When true/omitted, hide the raw response until rewriting finishes. */
  proseGuardianHoldForRewrite?: boolean;
  /** When true, tracker agents only run when the user manually triggers them (not after every generation) */
  manualTrackers?: boolean;
  /** Whether to recall memories from this chat during generation. Default: true for conversation/scenes, false for roleplay. */
  enableMemoryRecall?: boolean;
  /** Discord webhook URL to mirror messages to a Discord channel. */
  discordWebhookUrl?: string;
  /** Per-chat ephemeral / enabled overrides for lorebook entries (entryId → state).
   *  Tracked per-chat so ephemeral countdown in one chat doesn't affect others. */
  entryStateOverrides?: Record<string, { ephemeral?: number | null; enabled?: boolean }>;
  /** Per-chat sticky/cooldown/delay runtime state for lorebook entries. */
  entryTimingStates?: Record<string, import("./lorebook.js").LorebookEntryTimingState>;
  /** Per-chat global lorebook token budget. Missing uses app default; 0 means unlimited. */
  lorebookTokenBudget?: number | null;
  /** Lorebook IDs the user has explicitly disabled for THIS chat. Auto-activated
   *  books (bound to a present character / global / the active persona) that the
   *  user turned off via the chat Lorebooks panel land here; the scope filter
   *  drops them before injection without unbinding the book. */
  excludedLorebookIds?: string[];
  /** ID of the chat preset most recently applied to this chat (drives the preset bar dropdown). */
  appliedChatPresetId?: string | null;
  /** Custom prompt prefix used by the /impersonate slash command. */
  impersonatePrompt?: string | null;
  /** Show a manual draft translation button beside the send control. */
  showInputTranslateButton?: boolean;
  /** Optional per-chat AI translation system prompt override. Missing or blank uses the default prompt. */
  translationPrompt?: string | null;
  /** Allow roleplay characters to create direct-message conversation chats with hidden [dm] commands. */
  roleplayDmCommandsEnabled?: boolean;
  /** Chat-scoped Intiface Central WebSocket URL for haptic manual and auto-connect. */
  hapticIntifaceUrl?: string | null;
  /** Roleplay haptic intensity scaling. Missing = standard. */
  hapticSensitivity?: HapticFeedbackSensitivity;
  /** When true, very brief accidental brushes may trigger small haptic feedback. Missing/false = only deliberate contact. */
  hapticIncidentalContact?: boolean;
  /** Music source constraint for Music DJ in roleplay and visual novel chats. */
  spotifySourceType?: SpotifySourceType;
  /** Spotify playlist ID used when spotifySourceType is "playlist". */
  spotifyPlaylistId?: string | null;
  /** Human-readable playlist name cached for prompts/display. */
  spotifyPlaylistName?: string | null;
  /** Spotify artist name used when spotifySourceType is "artist". */
  spotifyArtist?: string | null;
  /** Recent Spotify track URIs played by the roleplay/conversation Music DJ. */
  spotifyRecentTracks?: string[];
  /** Durable count of autonomous messages the user has not viewed yet. */
  autonomousUnreadCount?: number;
  /** Character IDs that contributed to the current autonomous unread state. */
  autonomousUnreadCharacterIds?: string[];
  /** Timestamp of the newest autonomous unread message. */
  autonomousUnreadAt?: string | null;
  /** Daily autonomous attention-budget counts by character. */
  autonomousDailyBudget?: { date: string; counts: Record<string, number> };
  /** Per-chat override for the daily autonomous check-in cap. Null/omitted uses talkativeness defaults. */
  autonomousDailyCapOverride?: number | null;
  /** Last successful autonomous message timestamp by character and intent key. */
  intentCooldowns?: Record<string, Record<string, string>>;

  // ── Conversation Mode Fields ──
  /** Whether conversation character schedules are enabled for this chat. */
  conversationSchedulesEnabled?: boolean;
  /** Allow conversation characters to use hidden command tags. Default: true. */
  characterCommands?: boolean;
  /** Per-command Conversation command enable overrides. Missing/true means enabled. */
  conversationCommandToggles?: ConversationCommandToggles;
  /** Chat-scoped generated schedules for conversation characters. */
  characterSchedules?: Record<string, unknown>;
  /** Chat-scoped manual status overrides for conversation characters. */
  conversationStatusOverrides?: Record<string, ConversationStatusOverride>;
  /** Chat-scoped derived presence status per character, updated each generation. Replaces extensions.conversationStatus to avoid cross-chat bleed. */
  conversationCharacterStatuses?: Record<string, { status: ConversationPresenceStatus; activity: string }>;
  /** Week start timestamp for the current generated conversation schedules. */
  scheduleWeekStart?: string;
  /** Chat-scoped selfie prompt-builder template. Empty/null uses the global/default prompt. */
  selfiePrompt?: string | null;
  /** Extra positive prompt/tags appended to generated conversation selfie prompts. */
  selfiePositivePrompt?: string;
  /** Extra negative prompt/tags sent with generated conversation selfies. */
  selfieNegativePrompt?: string;

  // ── Game Mode Fields ──
  /** UUID linking all sessions of one game */
  gameId?: string;
  /** Session number within a game (1-based) */
  gameSessionNumber?: number;
  /** Current session lifecycle status */
  gameSessionStatus?: import("./game.js").GameSessionStatus;
  /** Whether the first game intro screen has been dismissed for this game chat. */
  gameIntroPresented?: boolean;
  /** Timestamp for when the current game session was created/started */
  gameCurrentSessionStartedAt?: string;
  /** Current game state (exploration, dialogue, combat, travel_rest) */
  gameActiveState?: import("./game.js").GameActiveState;
  /** Whether the game should maintain visible custom HUD widgets. */
  enableCustomWidgets?: boolean;
  /** Whether GM is a standalone narrator or an existing character */
  gameGmMode?: import("./game.js").GameGmMode;
  /** Character ID used as GM (when gameGmMode is "character") */
  gameGmCharacterId?: string;
  /** Party member IDs for the player's party; library character IDs or `npc:<slug>` tracked-NPC IDs. */
  gamePartyCharacterIds?: string[];
  /** ID of the linked party chat */
  gamePartyChatId?: string;
  /** Current area map */
  gameMap?: import("./game.js").GameMap | null;
  /** All generated/known maps for this game session/campaign. */
  gameMaps?: import("./game.js").GameMap[];
  /** ID of the map the party is currently on. */
  activeGameMapId?: string | null;
  /** Summaries of all previous sessions */
  gamePreviousSessionSummaries?: import("./game.js").SessionSummary[];
  /** GM-only: overarching story arc and plot (never sent to party agent) */
  gameStoryArc?: string;
  /** GM-only: planned plot twists (never sent to party agent) */
  gamePlotTwists?: string[];
  /** Active dialogue sub-scene chat ID */
  gameDialogueChatId?: string | null;
  /** Active combat sub-scene chat ID */
  gameCombatChatId?: string | null;
  /** Live combat encounter snapshot — restored on page refresh while a fight is in progress. */
  gameCombatState?: import("./game.js").GameCombatStateSnapshot | null;
  /** User's initial game setup preferences */
  gameSetupConfig?: import("./game.js").GameSetupConfig | null;
  /** Generated game blueprint, including campaign plan and initial HUD widgets. */
  gameBlueprint?: Record<string, unknown> | null;
  /** Runtime HUD widget state shown in Game Mode. */
  gameWidgetState?: import("./game.js").HudWidget[];
  /** Tracked NPCs with reputation */
  gameNpcs?: import("./game.js").GameNpc[];
  /** Current-session turn number when the last rare generated scene illustration was created. */
  gameLastIllustrationTurn?: number;
  /** Session number where the last rare generated scene illustration was created. */
  gameLastIllustrationSessionNumber?: number | null;
  /** Background tag for the last rare generated scene illustration. */
  gameLastIllustrationTag?: string;
  /** Game-mode GM instruction override. Empty/null uses the built-in default prompt. */
  gameSystemPrompt?: string | null;
  /** Additional game-mode generation instructions appended to the final GM format reminder. */
  gameSpecialInstructions?: string | null;
  /** Generic Game Mode Music DJ toggle. Legacy gameUseSpotifyMusic remains the Spotify-specific pipeline flag. */
  gameUseMusicDj?: boolean;
  /** Extra user instructions for game scene illustration prompts. */
  gameImagePromptInstructions?: string | null;
  /** Per-game asset browser folder exclusions. Omitted/null means every asset folder is available. */
  gameAssetSelection?: { excludedFolders?: string[] } | null;
  /** When true, Game Mode uses Music DJ for Spotify music instead of local music assets. */
  gameUseSpotifyMusic?: boolean;
  /** Music source constraint for Music DJ in Game Mode. */
  gameSpotifySourceType?: SpotifySourceType;
  /** Spotify playlist ID used when gameSpotifySourceType is "playlist". */
  gameSpotifyPlaylistId?: string | null;
  /** Human-readable playlist name cached for prompts/display. */
  gameSpotifyPlaylistName?: string | null;
  /** Spotify artist name used when gameSpotifySourceType is "artist". */
  gameSpotifyArtist?: string | null;
  /** Recent Spotify track URIs played by Game Mode Spotify music. */
  gameRecentSpotifyTracks?: string[];
  /** Run Game Lorebook Keeper after a session is concluded. */
  gameLorebookKeeperEnabled?: boolean;
  /** Chat-scoped lorebook maintained by Game Lorebook Keeper. */
  gameLorebookKeeperLorebookId?: string | null;
  /** Status of the most recent Game Lorebook Keeper session-end run. */
  gameLorebookKeeperLastRun?: {
    sessionNumber: number;
    status: "running" | "success" | "failed";
    updatedAt: string;
    lorebookId?: string | null;
    entryCount?: number;
    error?: string;
  } | null;

  // ── Conversation-Mode Auto-Summarization ──
  /** Per-day auto-generated conversation summaries (key: "DD.MM.YYYY"). */
  daySummaries?: Record<string, DaySummaryEntry>;
  /** Per-week consolidated conversation summaries (key: Monday "DD.MM.YYYY"). */
  weekSummaries?: Record<string, WeekSummaryEntry>;
  /**
   * Hour of day (0-11, local time) at which a conversation "day" rolls over for
   * summarization. Messages sent before this hour are filed under the previous
   * day, so a late-night session isn't cut off mid-conversation. Default: 4.
   */
  dayRolloverHour?: number;
  /**
   * How many of the most recent messages to keep verbatim even after they've
   * been summarized. In conversation mode this bridges the day boundary so
   * characters pick up the actual flow of recent conversation, not just the
   * gist. In roleplay/visual-novel mode it is the protected tail for
   * `hideSummarisedMessages`: the last N messages stay visible (never hidden)
   * when the auto-summary hides the rest. 0 disables (hide the whole batch).
   * Valid range: 0-50. Default: 10.
   */
  summaryTailMessages?: number;
  /** When true or omitted, prior provider reasoning metadata is not replayed into future prompts. */
  excludePastReasoning?: boolean;

  /** Any extra key-value data */
  [key: string]: unknown;
}

/** A single message within a chat. */
export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  /** Which character sent this (null for user messages / narration) */
  characterId: string | null;
  content: string;
  /** Index into the swipes array for the currently displayed alternative */
  activeSwipeIndex: number;
  /** Number of swipes for this message (0 or 1 = no alternatives) */
  swipeCount?: number;
  /** Server-side SQLite row position used only for stable pagination cursors */
  rowid?: number;
  createdAt: string;
  /** Extra display data */
  extra: MessageExtra;
}

/** A file or image attached to a chat message. */
export interface MessageAttachment {
  type: string;
  data?: string;
  url?: string;
  filename?: string;
  name?: string;
  prompt?: string;
  galleryId?: string;
}

/** A reaction on a Conversation message: an emoji token + who reacted. */
export interface MessageReaction {
  /** The reaction token: a unicode emoji (e.g. "😂") or a custom-emoji ref ":name:". */
  emoji: string;
  /** Resolved image URL for a custom-emoji reaction (snapshot at react time); null/absent for unicode. */
  imageUrl?: string | null;
  /** Who reacted: the "user" sentinel for the human, or character ids for bots. */
  by: string[];
}

/** Additional data attached to a message. */
export interface MessageExtra {
  /** Display-formatted text (may differ from raw content) */
  displayText: string | null;
  /** Whether this message was generated by the AI vs typed by user */
  isGenerated: boolean;
  /** Token count of this message */
  tokenCount: number | null;
  /** Generation metadata */
  generationInfo: GenerationInfo | null;
  /** User-uploaded or generated attachments associated with this message. */
  attachments?: MessageAttachment[] | null;
  /** Persisted translated text for this message, if the user generated one. */
  translation?: string | null;
  /** User hid the persisted translation from display without deleting it. */
  translationHidden?: boolean | null;
  /** Conversation-mode reactions on this message (emoji/custom-emoji + who reacted). */
  reactions?: MessageReaction[] | null;
  /** When true, this message marks the "new start" of the conversation — all earlier messages are excluded from context */
  isConversationStart?: boolean;
  /** Model's reasoning/thinking content (if available) */
  thinking?: string | null;
  /** Original assistant message before a post-processing rewrite, used for one-click restore. */
  proseGuardianOriginalText?: string | null;
  /** Timestamp for the last post-processing rewrite applied to this message. */
  proseGuardianRewrittenAt?: string | null;
  /**
   * Conversation-mode assistant content before hidden character commands were
   * stripped from visible display. Used for future prompt history so commands
   * like [selfie] remain part of the model-visible transcript.
   */
  conversationCommandContent?: string | null;
  /** Professor Mari workspace trace shown on the home assistant transcript. */
  mariWorkspaceTimeline?: MariWorkspaceTraceItem[] | null;
  /** Per-swipe sprite expressions from the Expression Engine agent */
  spriteExpressions?: Record<string, string> | null;
  /** Per-swipe CYOA choices from the CYOA Choices agent */
  cyoaChoices?: Array<{ label: string; text: string }> | null;
  /** Snapshot of the persona that was active when this message was sent (user messages only) */
  personaSnapshot?: {
    personaId: string;
    name: string;
    avatarUrl?: string | null;
    /** JSON-encoded AvatarCrop captured at send time so re-edits don't restyle past messages. */
    avatarCrop?: string | null;
    nameColor?: string | null;
    dialogueColor?: string | null;
    boxColor?: string | null;
  } | null;
  /** Stored for generation context but hidden from the visible chat transcript */
  hiddenFromUser?: boolean;
  /** When true, the visible message is excluded from future AI prompt context */
  hiddenFromAI?: boolean;
  /**
   * Cached pipeline injections (prose-guardian, director, knowledge-retrieval, etc.)
   * saved with this assistant message — reused when regenerating that swipe unless refreshed.
   */
  contextInjections?: Array<{ agentType: string; agentName?: string; text: string }> | null;
  /** Fingerprint of the compiled chat summary used when prompt caches/reasoning were stored. */
  chatSummaryFingerprint?: string | null;
  /**
   * Hidden command-generation options needed to make swipes/regenerations replay
   * the same slash-command or guided-regenerate prompt behavior.
   */
  generationReplay?: {
    impersonate?: true;
    userMessage?: string | null;
    generationGuide?: string | null;
    generationGuideSource?: GenerationGuideSource | null;
    narrativeDirectorMode?: "natural" | "random" | null;
    impersonatePresetId?: string | null;
    impersonateConnectionId?: string | null;
    impersonateBlockAgents?: boolean;
    impersonatePromptTemplate?: string | null;
  } | null;
}

/** Metadata about how a message was generated. */
export interface GenerationInfo {
  model: string;
  provider: string;
  temperature: number | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  tokensCachedPrompt?: number | null;
  tokensCacheWritePrompt?: number | null;
  durationMs: number | null;
  finishReason: string | null;
}

/** A swipe (alternate response) for a message. */
export interface MessageSwipe {
  id: string;
  messageId: string;
  index: number;
  content: string;
  createdAt: string;
  extra: MessageExtra;
}

/** Payload sent to start a generation. */
export interface GenerateRequest {
  chatId: string;
  userMessage: string | null;
  /** If set, regenerate the message at this ID */
  regenerateMessageId: string | null;
  /** If set, append the generated continuation to this assistant message */
  continueMessageId?: string | null;
  /** Override connection for this generation */
  connectionId: string | null;
  /** One-shot attachments sent with the user message. */
  attachments?: MessageAttachment[];
  /** One-shot Narrative Director mode for this generation, if the user armed Push Story. */
  narrativeDirectorMode?: "natural" | "random" | null;
}

/** An SSE event from the generation stream. */
export interface StreamEvent {
  type: "token" | "agent_update" | "game_state" | "done" | "error";
  data: string;
  agentId?: string;
  messageId?: string;
}

/** An OOC influence queued from a conversation chat to be injected into a roleplay chat. */
export interface OocInfluence {
  id: string;
  sourceChatId: string;
  targetChatId: string;
  content: string;
  anchorMessageId: string;
  consumed: boolean;
  createdAt: string;
}

/** A durable note emitted from a conversation chat that persists in the connected roleplay's prompt until cleared. */
export interface ConversationNote {
  id: string;
  sourceChatId: string;
  targetChatId: string;
  content: string;
  anchorMessageId: string;
  createdAt: string;
}
