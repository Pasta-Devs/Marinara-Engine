// ──────────────────────────────────────────────
// Prompt System Types
// ──────────────────────────────────────────────

import type { ThinkingTagPair } from "../utils/thinking-tags.js";

export const MARINARA_UNIVERSAL_PRESET_NAME = "Marinara's Universal Preset";
export const MARINARA_UNIVERSAL_PRESET_AUTHOR = "Marinara";
export const MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY = "marinara-universal-preset";

export function isStockMarinaraUniversalPreset(preset: { systemKey?: unknown }): boolean {
  return preset.systemKey === MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY;
}

/** Role for a prompt section. */
export type PromptRole = "system" | "user" | "assistant";

/** Where in the prompt a section is injected. */
export type InjectionPosition =
  /** Placed in order relative to other sections */
  | "ordered"
  /** Injected at a depth relative to the end of chat history */
  | "depth";

/** Auto-wrapping format for prompt sections. */
export type WrapFormat = "xml" | "markdown" | "none";

/** Marker section type for special insertion blocks. */
export type MarkerType =
  | "character"
  | "lorebook"
  | "persona"
  | "chat_history"
  | "chat_summary"
  | "id_macro_cards"
  | "world_info_before"
  | "world_info_after"
  | "dialogue_examples"
  | "agent_data";

/** Configuration for marker-type sections. */
export interface MarkerConfig {
  type: MarkerType;
  /** Which character fields to include (for character markers) */
  characterFields?: string[];
  /** Lorebook format filter */
  lorebookFormat?: "full" | "worldbook_only" | "character_only";
  /** Chat history options */
  chatHistoryOptions?: {
    maxMessages?: number;
    includeSystemMessages?: boolean;
  };
  /** For agent_data markers: the agent type whose output to inject */
  agentType?: string;
}

/** A complete prompt preset (template). */
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  /** Optional custom picture shown in preset lists and editors. */
  imagePath: string | null;
  /** Conversation-mode system prompt template. Empty means use the built-in fallback. */
  conversationPrompt: string;
  /** Game-mode GM prompt template. Empty means use the built-in fallback. */
  gamePrompt: string;
  /** Ordered list of section IDs defining the prompt structure */
  sectionOrder: string[];
  /** Ordered list of group IDs */
  groupOrder: string[];
  /** Variable toggle groups (for legacy / simple vars) */
  variableGroups: PromptVariableGroup[];
  /** Current values for all variables */
  variableValues: Record<string, string>;
  /** Generation parameters */
  parameters: GenerationParameters;
  /** Auto-wrapping format: XML (default) or Markdown */
  wrapFormat: WrapFormat;
  /** Saved default variable selections (variableName → value or values) */
  defaultChoices: Record<string, string | string[]>;
  /** Whether this is the built-in default preset */
  isDefault: boolean;
  /** Author of this preset */
  author: string;
  /** Reserved identifier for Engine-owned presets. Empty for user presets. */
  systemKey: string;
  createdAt: string;
  updatedAt: string;
}

/** A group that organises prompt sections (becomes a wrapper tag / heading). */
export interface PromptGroup {
  id: string;
  presetId: string;
  /** Display name (becomes <snake_case_name> in XML or ## Name in Markdown) */
  name: string;
  /** Parent group ID for nesting (null = top-level) */
  parentGroupId: string | null;
  /** Sort order within parent */
  order: number;
  /** Whether this group is enabled */
  enabled: boolean;
  createdAt: string;
}

/** A single section/block within a prompt preset. */
export interface PromptSection {
  id: string;
  presetId: string;
  /** Unique identifier (e.g. "main", "charDescription", or UUID for custom) */
  identifier: string;
  /** Display name */
  name: string;
  /** The prompt text content (supports macros like {{user}}, {{char}}) */
  content: string;
  /** Message role */
  role: PromptRole;
  /** Whether this section is enabled */
  enabled: boolean;
  /** Whether this is a built-in marker (charDescription, chatHistory, etc.) */
  isMarker: boolean;
  /** Group this section belongs to (null = ungrouped / top-level) */
  groupId: string | null;
  /** Configuration for marker sections (null for regular sections) */
  markerConfig: MarkerConfig | null;

  // ── Injection ──
  injectionPosition: InjectionPosition;
  /** Depth from the bottom of chat (0 = after last message) */
  injectionDepth: number;
  /** Priority when multiple sections share the same depth */
  injectionOrder: number;

  // ── Overrides ──
  /** If true, character cards cannot override this section */
  forbidOverrides: boolean;
}

/** A preset-level variable — the user picks one option per chat, referenced via {{variableName}} in prompts. */
export type ChoiceDisplayMode = "auto" | "buttons" | "listbox";
export type ChoiceOptionSort = "manual" | "alphabetical";

export interface ChoiceBlock {
  id: string;
  presetId: string;
  /** Machine name used in macros, e.g. "POV" → {{POV}} */
  variableName: string;
  /** Human-readable question shown when selecting (e.g. "What POV do you prefer?") */
  question: string;
  options: ChoiceOption[];
  /** If true, the user can select multiple options instead of just one. */
  multiSelect: boolean;
  /** Separator used to join multiple selected values (default ", "). Only used when multiSelect=true and randomPick=false. */
  separator: string;
  /** If true, one of the user's selected options is randomly picked each generation instead of joining all. */
  randomPick: boolean;
  /** How choices are presented in the selection modal. */
  displayMode: ChoiceDisplayMode;
  /** Whether options keep manual order or render alphabetically for users. */
  optionSort: ChoiceOptionSort;
  createdAt: string;
}

/** A single option within a preset variable. */
export interface ChoiceOption {
  id: string;
  label: string;
  /** The value injected when this option is selected */
  value: string;
}

/** A group of mutually exclusive variable options (radio toggle). */
export interface PromptVariableGroup {
  /** Variable name (used in {{getvar::name}}) */
  name: string;
  /** Display label */
  label: string;
  /** Available options */
  options: PromptVariableOption[];
}

/** A single option within a variable group. */
export interface PromptVariableOption {
  label: string;
  value: string;
}

export const GENERATION_PARAMETER_SEND_KEYS = [
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "reasoningEffort",
  "verbosity",
] as const;

export type GenerationParameterSendKey = (typeof GENERATION_PARAMETER_SEND_KEYS)[number];
export type GenerationParameterSendMap = Partial<Record<GenerationParameterSendKey, boolean>>;

export const CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY = "custom-generation-parameters";

/** A reusable numeric provider parameter defined in Settings → Advanced. */
export interface ManagedGenerationParameterDefinition {
  id: string;
  name: string;
  requestKey: string;
  min: number;
  max: number;
  tooltip?: string;
}

export interface ManagedGenerationParameterValue {
  enabled: boolean;
  value: number;
}

export type ManagedGenerationParameterValueMap = Record<string, ManagedGenerationParameterValue>;

/** Generation parameters sent with each API call. */
export interface GenerationParameters {
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  maxTokens: number;
  maxContext: number;
  frequencyPenalty: number;
  presencePenalty: number;
  /** For reasoning models */
  reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null;
  /** Output verbosity for models that support it (GPT-5+) */
  verbosity: "low" | "medium" | "high" | null;
  /** OpenRouter-only service tier. Null uses the provider/default tier. */
  serviceTier: "flex" | "priority" | null;
  /** Optional assistant-role prefill appended after the final user message. */
  assistantPrefill: string;
  /** Optional reasoning_content prefill on the final assistant message. */
  assistantReasoningPrefill: string;
  /** Extra inline thinking tag pairs to strip from streamed and saved responses. */
  customThinkingTags: ThinkingTagPair[];
  /** Raw provider request parameters merged into the outgoing request body. */
  customParameters: Record<string, unknown>;
  /** Values for reusable user-defined numeric provider parameters, keyed by definition ID. */
  managedCustomParameters: ManagedGenerationParameterValueMap;
  /** Per-parameter request switches. Missing map preserves legacy send behavior. */
  enabledParameters?: GenerationParameterSendMap;
  /** Merge consecutive system messages */
  squashSystemMessages: boolean;
  /** Show model reasoning/thinking */
  showThoughts: boolean;
  /** Automatically use the model's maximum context window instead of the manual value */
  useMaxContext: boolean;
  /** Custom stop sequences */
  stopSequences: string[];
  /** Strict role formatting: system first, then alternating user/assistant. Sections after chat_history become user role. */
  strictRoleFormatting: boolean;
  /** Send entire prompt + chat history as a single user message */
  singleUserMessage: boolean;
}

/** Well-known built-in marker identifiers (match ST). */
export const BUILTIN_MARKERS = {
  MAIN: "main",
  NSFW: "nsfw",
  JAILBREAK: "jailbreak",
  ENHANCE_DEFINITIONS: "enhanceDefinitions",
  CHAR_DESCRIPTION: "charDescription",
  CHAR_PERSONALITY: "charPersonality",
  SCENARIO: "scenario",
  PERSONA_DESCRIPTION: "personaDescription",
  DIALOGUE_EXAMPLES: "dialogueExamples",
  CHAT_HISTORY: "chatHistory",
  WORLD_INFO_BEFORE: "worldInfoBefore",
  WORLD_INFO_AFTER: "worldInfoAfter",
} as const;

/** A ChatML-format message (internal lingua franca). */
export interface ChatMLMessage {
  role: PromptRole;
  content: string;
  /** Internal context-fitting hint: prompt data is preserved before chat history. */
  contextKind?: "prompt" | "history" | "injection";
  /** Optional: name of the speaker for multi-character */
  name?: string;
  /** Internal speaker identity for group chat history role scoping. */
  characterId?: string | null;
  /** Internal Roleplay audience filter. Removed before messages reach a provider. */
  hiddenFromAICharacterIds?: string[];
  /** Internal per-character Roleplay context boundary. Removed before messages reach a provider. */
  conversationStartForCharacterIds?: string[];
  /** Base64 data URLs for multimodal image inputs */
  images?: string[];
  /** Base64 data URLs for provider-native file/document inputs */
  files?: Array<{ type: string; data: string; filename?: string }>;
  /** Provider-specific metadata (e.g. Gemini parts with thought signatures) */
  providerMetadata?: Record<string, unknown>;
}
