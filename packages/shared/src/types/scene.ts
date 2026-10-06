// ──────────────────────────────────────────────
// Scene Types
// ──────────────────────────────────────────────
// A "scene" is a character-initiated (or user-initiated) mini-roleplay
// session that branches off from a conversation chat. The character
// sets up the scenario, background, and participants. After the scene
// concludes, a summary is injected as a permanent memory and the user
// returns to the conversation.
// ──────────────────────────────────────────────

/**
 * A package-owned place a scene can branch from instead of a Conversation, such as a direct-message
 * thread inside a package. The package registers a scene origin provider (capability API 1.66,
 * `scenes` permission) that supplies the planning context, holds the lock while the scene runs and
 * receives the outcome when it ends.
 */
export interface ScenePackageOrigin {
  packageId: string;
  /** The package's own id for the thread, opaque to the Engine. */
  originId: string;
}

/** What a package scene origin hands the planner and the scene chat. */
export interface SceneOriginContext {
  /** Engine character IDs the scene may cast. At least one. */
  characterIds: string[];
  /** The persona the player uses in this origin, or null for none. */
  personaId: string | null;
  /** Connection for the scene's generations. Null uses the Engine's default connection. */
  connectionId?: string | null;
  /** Recent exchanges in the origin, oldest first. */
  transcript: Array<{ speaker: string; content: string }>;
  /** Extra context the origin owns, given to the planner and the scene writer (for example a stage persona and limits). */
  notes?: string | null;
  /** Lorebooks the scene chat starts with. */
  lorebookIds?: string[];
}

/**
 * Per-scene settings a package attaches when it starts a scene (`packageData` on create, `data` on
 * `startScene`). The Engine stores them with the scene and hands them to `claim` and `release`, so the
 * package decides per scene whether to lock, what to do with the recap, and anything else of its own.
 * A plain JSON object of at most 4,000 characters.
 */
export type ScenePackageData = Record<string, unknown>;

/** How a package-origin scene ended. `data` is the scene's `packageData`, or null. */
export type SceneOriginEnd = { data: ScenePackageData | null } & (
  | {
      kind: "concluded";
      sceneChatId: string;
      /** The narrative recap the Engine also stores as character memory. */
      summary: string;
      description: string | null;
      scenario: string | null;
      rating: "sfw" | "nsfw";
      characterIds: string[];
    }
  /** Discarded, deleted, or converted into a standalone roleplay: no recap. */
  | { kind: "abandoned" | "deleted" | "converted"; sceneChatId: string }
);

/**
 * Registered by a package through `api.registerSceneOrigin`. Only `getContext` is required: a package
 * that just starts scenes leaves out `claim` (no lock, any number of scenes at once) and `release`
 * (nothing is delivered when a scene ends).
 */
export interface SceneOriginProvider {
  /** Planning context for the origin, or null when it no longer exists. */
  getContext(originId: string): Promise<SceneOriginContext | null>;
  /** Lock the origin for this scene. Return false when it already has an active scene. */
  claim?(
    originId: string,
    scene: { sceneChatId: string; characterIds: string[]; data: ScenePackageData | null },
  ): Promise<boolean>;
  /**
   * Unlock the origin and receive the outcome. Must ignore an end for a scene that does not hold
   * the lock, and must be idempotent: a retry or a later delete can deliver the same scene again.
   */
  release?(originId: string, end: SceneOriginEnd): Promise<void>;
}

/** Metadata stored on the scene's roleplay chat. */
export interface SceneMeta {
  /** The conversation chat that spawned this scene. Absent when a package origin did. */
  sceneOriginChatId?: string;
  /** The package thread that spawned this scene. */
  scenePackageOrigin?: ScenePackageOrigin;
  /** The package's per-scene settings. */
  scenePackageData?: ScenePackageData;
  /** The character who initiated the scene (or null if user-initiated). */
  sceneInitiatorCharId: string | null;
  /** Human-readable scenario description (shown as narrator message). */
  sceneDescription: string;
  /** Hidden scenario / plot outline — not shown to user. */
  sceneScenario: string | null;
  /** Background filename to apply. */
  sceneBackground: string | null;
  /** Custom system prompt crafted by the LLM for this scene. */
  sceneSystemPrompt: string | null;
  /** A concise summary of the characters' relationship and shared history. */
  sceneRelationshipHistory: string | null;
  /** Whether the scene is SFW or NSFW. */
  sceneRating: "sfw" | "nsfw";
  /** Lifecycle status. */
  sceneStatus: "active" | "concluded";
  /** The recap, kept on a concluded package-origin scene so the package can reconcile a missed release. */
  sceneSummary?: string;
}

/** The comprehensive plan the LLM generates for a scene. */
export interface SceneFullPlan {
  /** Display name for the scene chat. */
  name: string;
  /** Short description shown to the user as a narrator message. */
  description: string;
  /** Hidden scenario / plot arc — kept secret from the user. */
  scenario: string;
  /** The first in-character message the character sends to start the scene. */
  firstMessage: string;
  /** Background filename (from the available list) or null. */
  background: string | null;
  /** Character IDs to include (defaults to origin chat chars). */
  characterIds: string[];
  /** Custom system prompt: writing style, narration POV, tense, participation style. */
  systemPrompt: string;
  /** SFW or NSFW. */
  rating: "sfw" | "nsfw";
  /** A concise summary of who the characters are to each other and their shared history. */
  relationshipHistory: string;
  /** A short, fun, user-visible guide about how to play/participate in this scene. */
  participationGuide: string;
}

export type ScenePromptPov = "first_person" | "second_person" | "third_person";
export type ScenePromptTense = "past" | "present" | "future";

export interface ScenePromptPreferences {
  pov: ScenePromptPov;
  tense: ScenePromptTense;
  extraInstructions?: string;
  promptPresetId?: string | null;
  /** Scene-local selections, confirmed before planning; not remembered as UI defaults. */
  presetChoices?: Record<string, string | string[]>;
  /** Scene-local overrides. Omit to retain automatic selection and the source persona. */
  participantCharacterIds?: string[];
  personaId?: string | null;
}

/** Request body for POST /scene/create. */
export interface SceneCreateRequest {
  /** The conversation chat to branch from. Exactly one of this and `packageOrigin`. */
  originChatId?: string;
  /** The package thread to branch from. */
  packageOrigin?: ScenePackageOrigin;
  /** Per-scene settings for the package origin; see `ScenePackageData`. */
  packageData?: ScenePackageData;
  /** Which character initiated the scene (null if user-initiated). */
  initiatorCharId: string | null;
  /** The full plan from the LLM. */
  plan: SceneFullPlan;
  /** Connection to use for the scene's generations. */
  connectionId?: string | null;
  /** Optional preset for the scene's generations, alongside its scene instructions. */
  promptPresetId?: string | null;
  presetChoices?: Record<string, string | string[]>;
  participantCharacterIds?: string[];
  personaId?: string | null;
}

/** Response from POST /scene/create. */
export interface SceneCreateResponse {
  /** The newly created scene (roleplay) chat. */
  chatId: string;
  chatName: string;
  description: string;
  /** Background filename chosen for the scene (null if none). */
  background: string | null;
}

/** Request body for POST /scene/conclude. */
export interface SceneConcludeRequest {
  /** The scene (roleplay) chat to conclude. */
  sceneChatId: string;
  /** Connection override. */
  connectionId?: string | null;
}

/** Response from POST /scene/conclude. */
export interface SceneConcludeResponse {
  /** The generated narrative summary. */
  summary: string;
  /** The origin conversation chat ID to navigate back to; null for a package origin. */
  originChatId: string | null;
  packageOrigin: ScenePackageOrigin | null;
}

/** Request body for POST /scene/abandon. */
export interface SceneAbandonRequest {
  /** The scene (roleplay) chat to abandon and delete. */
  sceneChatId: string;
}

/** Response from POST /scene/abandon. */
export interface SceneAbandonResponse {
  /** The origin conversation chat ID to navigate back to; null for a package origin. */
  originChatId: string | null;
  packageOrigin: ScenePackageOrigin | null;
}

/** Scene fork behavior: clone preserves the source scene, convert consumes it. */
export type SceneForkMode = "clone" | "convert";

/**
 * Request body for POST /scene/fork.
 *
 * Forking preserves roleplay continuity, messages, and safe roleplay settings,
 * but intentionally does not copy scene lifecycle metadata into the new chat.
 */
export interface SceneForkRequest {
  /** The scene (roleplay) chat to copy into a standalone roleplay. */
  sceneChatId: string;
  /** Clone keeps the original scene active; convert detaches and discards it. */
  mode: SceneForkMode;
  /** Clone only: copy scene messages chronologically up to and including this message. */
  upToMessageId?: string;
  /** Include origin conversation and relationship context as a hidden narrator note. */
  includePreSceneSummary?: boolean;
  /** Include scene participation guidance messages when copying scene messages. */
  includeParticipationGuide?: boolean;
}

/** Response from POST /scene/fork. */
export interface SceneForkResponse {
  /** The newly created standalone roleplay chat. */
  chatId: string;
  /** The origin conversation chat ID, if the scene had one. */
  originChatId: string | null;
  packageOrigin: ScenePackageOrigin | null;
  mode: SceneForkMode;
}

/** Request body for POST /scene/plan (user-initiated via /scene command). */
export interface ScenePlanRequest {
  /** Show the final provider prompt when UI debug mode is enabled. */
  debugMode?: boolean;
  /** The conversation chat where the user typed /scene. Exactly one of this and `packageOrigin`. */
  chatId?: string;
  /** The package thread the scene branches from. */
  packageOrigin?: ScenePackageOrigin;
  /** The user's description of what kind of scene they want. */
  prompt: string;
  /** Connection override. */
  connectionId?: string | null;
  /** Optional user preferences for the generated scene prompt and opening message. */
  promptPreferences?: ScenePromptPreferences | null;
}

/** Response from POST /scene/plan — the LLM plans everything. */
export interface ScenePlanResponse {
  plan: SceneFullPlan | null;
  /** Set when planning failed (e.g. model didn't return valid JSON). */
  error?: string;
}
