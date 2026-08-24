// ──────────────────────────────────────────────
// Macro Engine — {{user}}, {{char}}, {{date}}, etc.
// ──────────────────────────────────────────────

export interface MacroContext {
  user: string;
  userPhonetic?: string;
  char: string;
  charPhonetic?: string;
  /** Character names in the current prompt scope (used by {{characters}}) */
  characters: string[];
  /** Full active chat character roster (used by {{group}} when the prompt is scoped to one responder) */
  groupCharacters?: string[];
  /** Full per-character card fields for grouped macro expansion */
  characterProfiles?: Array<{
    name: string;
    phoneticName?: string;
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    example?: string;
    systemPrompt?: string;
    postHistoryInstructions?: string;
  }>;
  /** Custom variables from prompt toggle groups */
  variables: Record<string, string>;
  /** SillyTavern-compatible local variables persisted in the current chat. */
  localVariables?: Record<string, string>;
  /** Last user input message (for {{input}}) */
  lastInput?: string;
  /** Chat ID (for {{chatId}}) */
  chatId?: string;
  /** Model name (for {{model}}) */
  model?: string;
  /** Generation trigger/type label (for {{lastGenerationType}}) */
  lastGenerationType?: string;
  /** Human-readable time since the last chat activity before this generation (for {{idle_duration}}) */
  idleDuration?: string;
  /** IANA timezone name from the active browser/session, used by time macros */
  timeZone?: string;
  /** Agent data keyed by agent type (for {{agent::TYPE}}) */
  agentData?: Record<string, string>;
  /** Referenced character names keyed by exact card ID (for {{CHARACTER_ID}}) */
  characterReferences?: Record<string, string>;
  /** Referenced persona names keyed by exact card ID (for {{persona-PERSONA_ID}}) */
  personaReferences?: Record<string, string>;
  /** Activated lorebook Outlet content keyed by its exact, case-sensitive name */
  outlets?: Record<string, string>;
  /** Per-lorebook total entry counts, keyed by lorebook ID (for {{lorebooksize::ID}}) */
  lorebookEntryCounts?: Record<string, number>;
  /** Current character card fields used by macros like {{description}} */
  characterFields?: {
    phoneticName?: string;
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    example?: string;
    systemPrompt?: string;
    postHistoryInstructions?: string;
  };
  /** Active persona card fields used by {{persona}} */
  personaFields?: {
    phoneticName?: string;
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
  };
  /** Conversation-mode-only fields for {{convo_display}}/{{char_about}}/{{persona_about}}/{{convo_behavior}}.
   *  Populated ONLY by the conversation prompt branch, so these macros resolve to ""
   *  in Roleplay/Game — even if placed in a shared surface those modes render. */
  convoFields?: {
    charDisplayName?: string;
    charAbout?: string;
    personaAbout?: string;
    convoBehavior?: string;
  };
}

export interface ResolveMacroOptions {
  trimResult?: boolean;
  /**
   * Preserve character macros as internal tokens for a later known-speaker pass.
   * "names" delays {{char}}/{{charName}} and {{group}}; "all" also delays character field macros.
   */
  deferCharacterMacros?: "names" | "all";
  /**
   * Opt-in hook to defer a {{#if}} block whose condition references an operand
   * whose value isn't known during macro resolution (e.g. conversation
   * relocation macros the route fills in afterward). When the predicate returns
   * true for a condition operand, the block is encoded as a deferred token
   * instead of being evaluated; the caller decodes it later against the real
   * value (see DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE + selectConditionalPayloadBranch).
   * The engine stays mode-agnostic — it never hardcodes which operands defer.
   */
  deferConditionalOperand?: (operand: string) => boolean;
  /** Internal guard for recursive character/persona field macro expansion. */
  fieldResolutionDepth?: number;
  /** Stable seed used to resolve random/dice macros consistently for one message. */
  randomSeed?: string;
  /** Shared budget used internally to stop runaway recursive expansion. */
  macroBudget?: MacroResolutionBudget;
  /** Internal recursion depth for nested macro expansion. */
  macroDepth?: number;
  /** Maximum nested resolveMacros calls before expansion stops. */
  maxMacroDepth?: number;
  /** Maximum macro replacement operations in one resolution tree. */
  maxMacroExpansions?: number;
  /** Maximum resolved output length. */
  maxMacroOutputLength?: number;
}

export interface SupportedMacroDefinition {
  category: string;
  syntax: string;
  description: string;
}

export const CHARACTER_REFERENCE_ID_PATTERN = /\{\{([A-Za-z0-9_-]{21})\}\}/g;
export const PERSONA_REFERENCE_ID_PATTERN = /\{\{persona-([A-Za-z0-9_-]{21})\}\}/gi;

const CHARACTER_MACRO_NAMES = new Set([
  "appearance",
  "backstory",
  "char",
  "char_about",
  "charname",
  "charnamephonetic",
  "charphonetic",
  "charposthistory",
  "charsysinfo",
  "convo_behavior",
  "convo_display",
  "description",
  "example",
  "group",
  "personality",
  "scenario",
]);
const CHARACTER_CONDITIONAL_OPERAND_NAMES = new Set([
  ...CHARACTER_MACRO_NAMES,
  "character",
  "characterphonetic",
  "speaker",
  "speakerphonetic",
]);
const MAX_CHARACTER_FIELD_RESOLUTION_DEPTH = 4;
const MAX_DICE_COUNT = 1000;
const MAX_DICE_SIDES = 1_000_000;
const MAX_MACRO_RESOLUTION_DEPTH = 16;
const MAX_MACRO_EXPANSIONS = 2_000;
const MAX_MACRO_OUTPUT_LENGTH = 200_000;
// Private placeholders used while character macros are deferred.
// Internal-only and should be resolved before provider requests.
const DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX = "\x1eMARINARA_DEFERRED_CHARACTER_";
const DEFERRED_CHARACTER_CONDITIONAL_TOKEN_PREFIX = "\x1eMARINARA_DEFERRED_CHARACTER_IF:";
const DEFERRED_CHARACTER_CONDITIONAL_TOKEN_RE = new RegExp(
  `${DEFERRED_CHARACTER_CONDITIONAL_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\x1f]+)\\x1f`,
  "g",
);
// Placeholder for a {{#if}} block whose condition depends on a caller-deferred
// operand (e.g. a conversation relocation macro whose value is injected later).
// The prefix deliberately does NOT contain "DEFERRED_CHARACTER_", so the
// per-character decode and hasDeferredCharacterMacros never touch it.
const DEFERRED_RELOCATION_CONDITIONAL_TOKEN_PREFIX = "\x1eMARINARA_DEFERRED_RELOCATION_IF:";
export const DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE = new RegExp(
  `${DEFERRED_RELOCATION_CONDITIONAL_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\x1f]+)\\x1f`,
  "g",
);
const DEFERRED_CHARACTER_MACRO_TOKENS = {
  char: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CHAR\x1f`,
  charPhonetic: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CHAR_PHONETIC\x1f`,
  group: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}GROUP\x1f`,
  description: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}DESCRIPTION\x1f`,
  personality: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}PERSONALITY\x1f`,
  backstory: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}BACKSTORY\x1f`,
  appearance: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}APPEARANCE\x1f`,
  scenario: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}SCENARIO\x1f`,
  example: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}EXAMPLE\x1f`,
  systemPrompt: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}SYSTEM_PROMPT\x1f`,
  postHistoryInstructions: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}POST_HISTORY\x1f`,
  convoDisplay: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CONVO_DISPLAY\x1f`,
  charAbout: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CHAR_ABOUT\x1f`,
  convoBehavior: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CONVO_BEHAVIOR\x1f`,
} as const;

export type CharacterMacroProfile = NonNullable<MacroContext["characterProfiles"]>[number];
type CharacterFieldMacroName = Exclude<
  keyof typeof DEFERRED_CHARACTER_MACRO_TOKENS,
  "char" | "charPhonetic" | "group" | "convoDisplay" | "charAbout" | "convoBehavior"
>;
type ConditionalBlockPayload = {
  condition: string;
  truthy: string;
  falsy: string;
  branches?: never;
};
type ConditionalBranchPayload = {
  condition: string | null;
  content: string;
};
type ConditionalChainPayload = {
  branches: ConditionalBranchPayload[];
  condition?: never;
  truthy?: never;
  falsy?: never;
};
type DeferredConditionalPayload = ConditionalBlockPayload | ConditionalChainPayload;

export type MacroResolutionBudget = {
  expansions: number;
  exceeded?: boolean;
};

export function stripMacroComments(template: string): string {
  let result = "";
  let cursor = 0;
  while (cursor < template.length) {
    const start = template.indexOf("{{//", cursor);
    if (start < 0) break;
    const firstClose = template.indexOf("}}", start + 4);
    if (firstClose < 0) break;
    result += template.slice(cursor, start);
    cursor = firstClose + 2;
  }
  return result + template.slice(cursor);
}

function getMacroBudget(options: ResolveMacroOptions): MacroResolutionBudget {
  if (options.macroBudget) return options.macroBudget;
  const budget: MacroResolutionBudget = { expansions: 0 };
  options.macroBudget = budget;
  return budget;
}

function macroLimit(
  options: ResolveMacroOptions,
  key: "maxMacroDepth" | "maxMacroExpansions" | "maxMacroOutputLength",
) {
  switch (key) {
    case "maxMacroDepth":
      return options.maxMacroDepth ?? MAX_MACRO_RESOLUTION_DEPTH;
    case "maxMacroExpansions":
      return options.maxMacroExpansions ?? MAX_MACRO_EXPANSIONS;
    case "maxMacroOutputLength":
      return options.maxMacroOutputLength ?? MAX_MACRO_OUTPUT_LENGTH;
  }
}

function consumeMacroExpansion(options: ResolveMacroOptions): boolean {
  const budget = getMacroBudget(options);
  budget.expansions += 1;
  if (budget.expansions > macroLimit(options, "maxMacroExpansions")) {
    budget.exceeded = true;
    return false;
  }
  return true;
}

function nestedMacroOptions(options: ResolveMacroOptions): ResolveMacroOptions {
  return {
    ...options,
    macroBudget: getMacroBudget(options),
    macroDepth: (options.macroDepth ?? 0) + 1,
  };
}

function clampMacroOutput(value: string, options: ResolveMacroOptions): string {
  const maxLength = macroLimit(options, "maxMacroOutputLength");
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function hashStringToUint32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnitRandom(seed: string): number {
  let state = hashStringToUint32(seed) || 0x9e3779b9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 0x100000000;
}

function randomUnit(options: ResolveMacroOptions, original: string): number {
  return options.randomSeed ? seededUnitRandom(`${options.randomSeed}:${original}`) : Math.random();
}

function randomInteger(options: ResolveMacroOptions, original: string, min: number, max: number): number {
  return Math.floor(randomUnit(options, original) * (max - min + 1)) + min;
}

export function hasDeferredCharacterMacros(template: string): boolean {
  return (
    template.includes(DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX) ||
    template.includes(DEFERRED_CHARACTER_CONDITIONAL_TOKEN_PREFIX)
  );
}

/** True if any deferred relocation conditional token is still unresolved. */
export function hasDeferredRelocationConditionals(template: string): boolean {
  return template.includes(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_PREFIX);
}

/**
 * Extract the condition operands (left/right of each branch) from every deferred
 * relocation conditional token in `text`. Lets the caller decide which of its
 * slots the deferred blocks actually reference using the SAME parse the deferral
 * used — so slot detection can never disagree with the defer decision (#3449).
 */
export function collectDeferredRelocationConditionOperands(text: string): string[] {
  if (!text.includes(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_PREFIX)) return [];
  const operands: string[] = [];
  for (const match of text.matchAll(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE)) {
    const payload = parseDeferredConditionalPayload(match[1]!);
    if (!payload) continue;
    const chainBranches = (payload as ConditionalChainPayload).branches;
    const branches = Array.isArray(chainBranches)
      ? chainBranches
      : [{ condition: (payload as ConditionalBlockPayload).condition, content: "" }];
    for (const branch of branches) {
      if (branch.condition === null) continue;
      for (const parsed of parseConditionComparisons(branch.condition)) {
        operands.push(parsed.left);
        if (parsed.right !== undefined) operands.push(parsed.right);
      }
    }
  }
  return operands;
}

export const SUPPORTED_MACROS: readonly SupportedMacroDefinition[] = [
  { category: "Identity", syntax: "{{user}}", description: "Current user or persona name" },
  { category: "Identity", syntax: "{{userName}}", description: "Alias for {{user}}" },
  {
    category: "Identity",
    syntax: "{{userNamePhonetic}}",
    description: "Active persona phonetic name, or {{user}} when none is configured",
  },
  {
    category: "Identity",
    syntax: "{{persona}}",
    description: "Active persona description, personality, backstory, appearance, and scenario joined by new lines",
  },
  { category: "Identity", syntax: "{{personaDescription}}", description: "Active persona description" },
  { category: "Identity", syntax: "{{personaPersonality}}", description: "Active persona personality" },
  { category: "Identity", syntax: "{{personaBackstory}}", description: "Active persona backstory" },
  { category: "Identity", syntax: "{{personaAppearance}}", description: "Active persona appearance" },
  { category: "Identity", syntax: "{{personaScenario}}", description: "Active persona scenario" },
  { category: "Identity", syntax: "{{char}}", description: "Current character name" },
  { category: "Identity", syntax: "{{charName}}", description: "Alias for {{char}}" },
  {
    category: "Identity",
    syntax: "{{21-character-card-ID}}",
    description: "Name of another character, pulls the card into the context; referenced by its exact 21-character ID",
  },
  {
    category: "Identity",
    syntax: "{{persona-21-character-card-ID}}",
    description: "Name of another persona, pulls the card into the context; referenced by its exact 21-character ID",
  },
  {
    category: "Identity",
    syntax: "{{charNamePhonetic}}",
    description: "Current character phonetic name, or {{char}} when none is configured",
  },
  { category: "Identity", syntax: "{{characters}}", description: "All character names, comma-separated" },
  {
    category: "Identity",
    syntax: "{{group}}",
    description: "Other active chat characters, excluding the current responder",
  },
  { category: "Character", syntax: "{{description}}", description: "Current character description" },
  { category: "Character", syntax: "{{personality}}", description: "Current character personality" },
  { category: "Character", syntax: "{{backstory}}", description: "Current character backstory" },
  { category: "Character", syntax: "{{appearance}}", description: "Current character appearance" },
  { category: "Character", syntax: "{{scenario}}", description: "Current character scenario" },
  { category: "Character", syntax: "{{example}}", description: "Current character example dialogue" },
  { category: "Character", syntax: "{{charSysInfo}}", description: "Current character system prompt" },
  {
    category: "Character",
    syntax: "{{charPostHistory}}",
    description: "Current character post-history instructions",
  },
  {
    category: "Conversation",
    syntax: "{{convo_display}}",
    description: "Convo display name (Conversation mode only)",
  },
  { category: "Conversation", syntax: "{{char_about}}", description: "Character about-me (Conversation mode only)" },
  { category: "Conversation", syntax: "{{persona_about}}", description: "Persona about-me (Conversation mode only)" },
  {
    category: "Conversation",
    syntax: "{{convo_behavior}}",
    description: "Character convo behavior directive (Conversation mode only)",
  },
  {
    category: "Conversation",
    syntax: "{{context}} / {{status}}",
    description: "Place the context/status block here and skip its auto insertion (Conversation mode)",
  },
  {
    category: "Conversation",
    syntax: "{{commands}}",
    description: "Place the commands reminder here and skip its auto insertion (Conversation mode)",
  },
  {
    category: "Conversation",
    syntax: "{{reactRules}}",
    description: "Legacy placeholder; reaction syntax is now included in {{commands}} (Conversation mode)",
  },
  {
    category: "Conversation",
    syntax: "{{replyRules}}",
    description: "Place the custom-emoji/sticker reply rules here and skip their auto insertion (Conversation mode)",
  },
  {
    category: "Conversation",
    syntax: "{{memories}}",
    description: "Place the memory-recall block here and skip its auto insertion (Conversation mode)",
  },
  {
    category: "Conversation",
    syntax: "{{lorebook}}",
    description: "Place lorebook injections here and skip their auto insertion (Conversation mode)",
  },
  { category: "Context", syntax: "{{input}}", description: "Most recent user message" },
  { category: "Context", syntax: "{{model}}", description: "Current model name" },
  { category: "Context", syntax: "{{chatId}}", description: "Current chat ID" },
  { category: "Context", syntax: "{{lastGenerationType}}", description: "Current generation type label" },
  { category: "Context", syntax: "{{idle_duration}}", description: "Time since the last chat activity" },
  { category: "Context", syntax: "{{agent::TYPE}}", description: "Cached output for an agent or tracker type" },
  {
    category: "Lorebooks",
    syntax: "{{outlet::name}}",
    description: "Activated lorebook entries assigned to the exact, case-sensitive Outlet name",
  },
  {
    category: "Lorebooks",
    syntax: "{{lorebooksize::ID}}",
    description: "Total number of entries in the lorebook with the given ID",
  },
  {
    category: "Game",
    syntax: "{{gameStoryboardKeyframeCount}}",
    description: "Current Game Mode Keyframes per Turn target (1-6, default 3)",
  },
  { category: "Time", syntax: "{{date}}", description: "Current real date in the user's timezone" },
  { category: "Time", syntax: "{{time}}", description: "Current real time in the user's timezone" },
  { category: "Time", syntax: "{{datetime}} / {{isotime}}", description: "Current timestamp in the user's timezone" },
  { category: "Time", syntax: "{{weekday}}", description: "Current weekday name in the user's timezone" },
  { category: "Time", syntax: "{{timezone}}", description: "Current user/browser timezone" },
  { category: "Random", syntax: "{{random}}", description: "Random number from 0 to 100" },
  { category: "Random", syntax: "{{random:X:Y}}", description: "Random number between X and Y" },
  { category: "Random", syntax: "{{random::A::B::C}}", description: "Randomly choose one of the provided options" },
  {
    category: "Random",
    syntax: "{{random::A@2::B@0.5}}",
    description: "Weighted random choice; weights are relative and may be decimals",
  },
  { category: "Random", syntax: "{{roll:XdY}}", description: "Dice roll total such as 2d6" },
  { category: "Variables", syntax: "{{getvar::name}}", description: "Read a dynamic variable" },
  { category: "Variables", syntax: "{{setvar::name::value}}", description: "Set a dynamic variable" },
  { category: "Variables", syntax: "{{addvar::name::value}}", description: "Append to a dynamic variable" },
  { category: "Variables", syntax: "{{addnumvar::name::value}}", description: "Add to a numeric variable" },
  {
    category: "Variables",
    syntax: "{{incvar::name}} / {{decvar::name}}",
    description: "Increment or decrement a numeric variable",
  },
  { category: "Variables", syntax: "{{NAME}}", description: "Resolve a preset variable named NAME" },
  { category: "Formatting", syntax: "{{newline}} / {{\\n}}", description: "Insert a literal newline" },
  { category: "Formatting", syntax: "{{trim}}", description: "Trim the final output" },
  {
    category: "Formatting",
    syntax: "{{trimStart}} / {{trimEnd}}",
    description: "Trim whitespace at one edge of the output",
  },
  {
    category: "Formatting",
    syntax: "{{uppercase}}...{{/uppercase}}",
    description: "Uppercase a wrapped block",
  },
  {
    category: "Formatting",
    syntax: "{{lowercase}}...{{/lowercase}}",
    description: "Lowercase a wrapped block",
  },
  {
    category: "Formatting",
    syntax: '{{#if char == "Name" || "Other"}}...{{else}}...{{/if}}',
    description: "Conditional block with ||, &&, parentheses, else branches, and straight or typographic quotes",
  },
  {
    category: "Formatting",
    syntax: '{{#if character != "Maukie"}}...{{/if}}',
    description: 'Negated comparison; "is not", "not contains", and "not includes" are also supported',
  },
  { category: "Formatting", syntax: "{{noop}}", description: "No-op placeholder removed from output" },
  { category: "Formatting", syntax: "{{// comment}}", description: "Inline author comment removed from output" },
  {
    category: "Formatting",
    syntax: '{{banned "text"}}',
    description: "Accepted with straight or typographic quotes, but currently stripped from output",
  },
];

function normalizeMacroIdentity(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function resolveGroupCharacters(ctx: Pick<MacroContext, "characters" | "groupCharacters" | "char">): string {
  const responderName = normalizeMacroIdentity(ctx.char);
  return (ctx.groupCharacters ?? ctx.characters)
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && normalizeMacroIdentity(name) !== responderName)
    .join(", ");
}

function getCharacterFieldValue(profile: CharacterMacroProfile, field: CharacterFieldMacroName): string {
  return stripMacroComments(profile[field] ?? "");
}

function resolveCharacterFieldValue(
  profile: CharacterMacroProfile,
  field: CharacterFieldMacroName,
  depth: number,
  baseContext?: MacroContext,
): string {
  const value = getCharacterFieldValue(profile, field);
  if (!value) return "";
  if (depth >= MAX_CHARACTER_FIELD_RESOLUTION_DEPTH) return "";
  return resolveCharacterScopedMacros(value, profile, depth + 1, baseContext);
}

function macroContextForCharacterProfile(profile: CharacterMacroProfile, base?: MacroContext): MacroContext {
  return {
    user: base?.user ?? "User",
    userPhonetic: base?.userPhonetic,
    char: profile.name,
    charPhonetic: profile.phoneticName ?? profile.name,
    characters: base?.characters ?? [profile.name],
    groupCharacters: base?.groupCharacters,
    characterProfiles: base?.characterProfiles ?? [profile],
    variables: base?.variables ?? {},
    localVariables: base?.localVariables,
    lastInput: base?.lastInput,
    chatId: base?.chatId,
    model: base?.model,
    lastGenerationType: base?.lastGenerationType,
    idleDuration: base?.idleDuration,
    timeZone: base?.timeZone,
    agentData: base?.agentData,
    personaReferences: base?.personaReferences,
    personaFields: base?.personaFields,
    convoFields: base?.convoFields,
    characterFields: {
      phoneticName: profile.phoneticName ?? "",
      description: profile.description ?? "",
      personality: profile.personality ?? "",
      backstory: profile.backstory ?? "",
      appearance: profile.appearance ?? "",
      scenario: profile.scenario ?? "",
      example: profile.example ?? "",
      systemPrompt: profile.systemPrompt ?? "",
      postHistoryInstructions: profile.postHistoryInstructions ?? "",
    },
  };
}

export function resolveCharacterScopedMacros(
  template: string,
  profile: CharacterMacroProfile,
  depth = 0,
  baseContext?: MacroContext,
): string {
  const scopedContext = macroContextForCharacterProfile(profile, baseContext);
  const scoped = resolveConditionalBlocks(stripMacroComments(template), scopedContext, {});
  return scoped
    .replace(/\{\{\s*char(?:Name)?\s*\}\}/gi, profile.name)
    .replace(/\{\{\s*char(?:Name)?Phonetic\s*\}\}/gi, profile.phoneticName ?? profile.name)
    .replace(/\{\{\s*group\s*\}\}/gi, resolveGroupCharacters(scopedContext))
    .replace(/\{\{\s*description\s*\}\}/gi, () =>
      resolveCharacterFieldValue(profile, "description", depth, baseContext),
    )
    .replace(/\{\{\s*personality\s*\}\}/gi, () =>
      resolveCharacterFieldValue(profile, "personality", depth, baseContext),
    )
    .replace(/\{\{\s*backstory\s*\}\}/gi, () => resolveCharacterFieldValue(profile, "backstory", depth, baseContext))
    .replace(/\{\{\s*appearance\s*\}\}/gi, () => resolveCharacterFieldValue(profile, "appearance", depth, baseContext))
    .replace(/\{\{\s*scenario\s*\}\}/gi, () => resolveCharacterFieldValue(profile, "scenario", depth, baseContext))
    .replace(/\{\{\s*example\s*\}\}/gi, () => resolveCharacterFieldValue(profile, "example", depth, baseContext))
    .replace(/\{\{\s*charSysInfo\s*\}\}/gi, () =>
      resolveCharacterFieldValue(profile, "systemPrompt", depth, baseContext),
    )
    .replace(/\{\{\s*charPostHistory\s*\}\}/gi, () =>
      resolveCharacterFieldValue(profile, "postHistoryInstructions", depth, baseContext),
    );
}

export function resolveDeferredCharacterMacros(
  template: string,
  profile: CharacterMacroProfile,
  baseContext?: MacroContext,
): string {
  if (!hasDeferredCharacterMacros(template)) return template;
  const scopedContext = macroContextForCharacterProfile(profile, baseContext);
  let result = resolveDeferredCharacterConditionals(template, scopedContext);
  result = result.split(DEFERRED_CHARACTER_MACRO_TOKENS.char).join(profile.name);
  result = result.split(DEFERRED_CHARACTER_MACRO_TOKENS.charPhonetic).join(profile.phoneticName ?? profile.name);
  result = result.split(DEFERRED_CHARACTER_MACRO_TOKENS.group).join(resolveGroupCharacters(scopedContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.description)
    .join(resolveCharacterFieldValue(profile, "description", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.personality)
    .join(resolveCharacterFieldValue(profile, "personality", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.backstory)
    .join(resolveCharacterFieldValue(profile, "backstory", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.appearance)
    .join(resolveCharacterFieldValue(profile, "appearance", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.scenario)
    .join(resolveCharacterFieldValue(profile, "scenario", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.example)
    .join(resolveCharacterFieldValue(profile, "example", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.systemPrompt)
    .join(resolveCharacterFieldValue(profile, "systemPrompt", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.postHistoryInstructions)
    .join(resolveCharacterFieldValue(profile, "postHistoryInstructions", 0, baseContext));
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.convoDisplay)
    .join(scopedContext.convoFields?.charDisplayName ?? "");
  result = result.split(DEFERRED_CHARACTER_MACRO_TOKENS.charAbout).join(scopedContext.convoFields?.charAbout ?? "");
  result = result
    .split(DEFERRED_CHARACTER_MACRO_TOKENS.convoBehavior)
    .join(scopedContext.convoFields?.convoBehavior ?? "");
  return result;
}

export function parseDeferredConditionalPayload(encoded: string): DeferredConditionalPayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<DeferredConditionalPayload>;
    const branches = (parsed as Partial<ConditionalChainPayload>).branches;
    if (Array.isArray(branches)) {
      if (
        branches.every(
          (branch) =>
            !!branch &&
            typeof branch === "object" &&
            (typeof branch.condition === "string" || branch.condition === null) &&
            typeof branch.content === "string",
        )
      ) {
        return { branches };
      }
      return null;
    }
    const block = parsed as Partial<ConditionalBlockPayload>;
    if (typeof block.condition !== "string" || typeof block.truthy !== "string" || typeof block.falsy !== "string") {
      return null;
    }
    return { condition: block.condition, truthy: block.truthy, falsy: block.falsy };
  } catch {
    return null;
  }
}

function resolveDeferredCharacterConditionals(template: string, ctx: MacroContext): string {
  return template.replace(DEFERRED_CHARACTER_CONDITIONAL_TOKEN_RE, (match, encoded: string) => {
    const payload = parseDeferredConditionalPayload(encoded);
    if (!payload) return match;
    const selected = selectConditionalPayloadBranch(payload, ctx, { trimResult: false });
    return resolveMacros(selected, ctx, { trimResult: false });
  });
}

function hasCharacterConditionalOperandCandidate(condition: string): boolean {
  let quote: "single" | "double" | null = null;
  let escaped = false;

  for (let index = 0; index < condition.length; index++) {
    const character = condition[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (quoteKind(character) === quote) quote = null;
      continue;
    }

    const nextQuote = quoteKind(character);
    if (nextQuote) {
      quote = nextQuote;
      continue;
    }

    const candidateStart = character === "@" ? index + 1 : index;
    let candidateEnd = candidateStart;
    while (candidateEnd < condition.length) {
      const code = condition.charCodeAt(candidateEnd);
      const isIdentifierCharacter =
        (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || code === 95 || (code >= 97 && code <= 122);
      if (!isIdentifierCharacter) break;
      candidateEnd++;
    }
    if (candidateEnd === candidateStart) continue;
    if (CHARACTER_CONDITIONAL_OPERAND_NAMES.has(condition.slice(candidateStart, candidateEnd).toLowerCase())) {
      return true;
    }
    index = candidateEnd - 1;
  }
  return false;
}

function hasCharacterMacro(template: string): boolean {
  const lowerTemplate = template.toLowerCase();
  for (const name of CHARACTER_MACRO_NAMES) {
    if (lowerTemplate.includes(`{{${name}}}`)) return true;
  }

  let searchIndex = 0;
  while (searchIndex < template.length) {
    const start = template.indexOf("{{", searchIndex);
    if (start === -1) return false;
    let bodyStart = start + 2;
    while (bodyStart < template.length && /\s/u.test(template[bodyStart]!)) bodyStart++;
    let nameEnd = bodyStart;
    while (nameEnd < template.length && /[A-Za-z_]/u.test(template[nameEnd]!)) nameEnd++;
    const name = template.slice(bodyStart, nameEnd).toLowerCase();
    let directEnd = nameEnd;
    while (directEnd < template.length && /\s/u.test(template[directEnd]!)) directEnd++;
    if (template.startsWith("}}", directEnd) && CHARACTER_MACRO_NAMES.has(name)) return true;

    const ifEnd = bodyStart + 3;
    const elseIfEnd = directEnd + 2;
    const isIf =
      template.slice(bodyStart, ifEnd).toLowerCase() === "#if" &&
      (template.startsWith("}}", ifEnd) || (ifEnd < template.length && /\s/u.test(template[ifEnd]!)));
    const isElseIf =
      name === "else" &&
      directEnd > nameEnd &&
      template.slice(directEnd, elseIfEnd).toLowerCase() === "if" &&
      (template.startsWith("}}", elseIfEnd) || (elseIfEnd < template.length && /\s/u.test(template[elseIfEnd]!)));
    if (!isIf && !isElseIf) {
      searchIndex = Math.max(start + 2, nameEnd);
      continue;
    }

    const end = findBalancedMacroEnd(template, start);
    if (end === -1) {
      return hasCharacterConditionalOperandCandidate(template.slice(bodyStart));
    }
    const body = template.slice(start + 2, end - 2).trim();
    const condition = parseIfCondition(body) ?? parseElseIfCondition(body);
    if (
      condition !== null &&
      hasCharacterConditionalOperandCandidate(condition) &&
      (conditionDependsOnCharacter(condition) || conditionHasLegacyAdjacentCharacterReference(condition))
    ) {
      return true;
    }
    searchIndex = end;
  }
  return false;
}

function expandBracketedCharacterBlocks(template: string, ctx: MacroContext): string {
  const profiles = ctx.characterProfiles ?? [];
  if (profiles.length <= 1 || !hasCharacterMacro(template)) {
    return template;
  }

  const lines = template.split(/\r?\n/);
  const expandedLines: string[] = [];
  let changed = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.trim() !== "[") {
      expandedLines.push(line);
      continue;
    }

    let endIndex = index + 1;
    while (endIndex < lines.length && lines[endIndex]!.trim() !== "]") {
      endIndex += 1;
    }

    if (endIndex >= lines.length) {
      expandedLines.push(line);
      continue;
    }

    const block = lines.slice(index, endIndex + 1).join("\n");
    if (!hasCharacterMacro(block)) {
      expandedLines.push(...lines.slice(index, endIndex + 1));
      index = endIndex;
      continue;
    }

    changed = true;
    expandedLines.push(
      ...profiles
        .map((profile) => resolveCharacterScopedMacros(block, profile, 0, ctx))
        .join("\n")
        .split("\n"),
    );
    index = endIndex;
  }

  return changed ? expandedLines.join("\n") : template;
}

function findBalancedMacroEnd(input: string, start: number): number {
  let depth = 0;

  for (let index = start; index < input.length - 1; index++) {
    if (input[index] === "{" && input[index + 1] === "{") {
      depth += 1;
      index += 1;
      continue;
    }

    if (input[index] === "}" && input[index + 1] === "}") {
      depth -= 1;
      index += 1;
      if (depth === 0) return index + 1;
    }
  }

  return -1;
}

function replaceBalancedMacros(
  input: string,
  replacer: (body: string, original: string) => string | undefined,
): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const start = input.indexOf("{{", index);
    if (start === -1) {
      result += input.slice(index);
      break;
    }

    result += input.slice(index, start);

    const end = findBalancedMacroEnd(input, start);
    if (end === -1) {
      result += input.slice(start);
      break;
    }

    const original = input.slice(start, end);
    const body = input.slice(start + 2, end - 2);
    const replacement = replacer(body, original);

    if (replacement !== undefined) {
      result += replacement;
      index = end;
    } else {
      result += "{{";
      index = start + 2;
    }
  }

  return result;
}

function encodeDeferredConditional(
  payload: DeferredConditionalPayload,
  prefix: string = DEFERRED_CHARACTER_CONDITIONAL_TOKEN_PREFIX,
): string {
  return `${prefix}${encodeURIComponent(JSON.stringify(payload))}\x1f`;
}

function quoteKind(value?: string): "single" | "double" | null {
  if (!value) return null;
  if (/["\u201c\u201d\u201e\u201f]/u.test(value)) return "double";
  if (/['\u2018\u2019\u201a\u201b]/u.test(value)) return "single";
  return null;
}

function stripOuterQuotes(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return null;
  const openingKind = quoteKind(trimmed[0]);
  if (!openingKind || quoteKind(trimmed[trimmed.length - 1]) !== openingKind) return null;
  return trimmed
    .slice(1, -1)
    .replace(/\\(["'\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f\\])/g, "$1")
    .replace(/\\n/g, "\n");
}

function normalizeConditionKey(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function resolvePersonaText(ctx: MacroContext): string {
  return [
    ctx.personaFields?.description,
    ctx.personaFields?.personality,
    ctx.personaFields?.backstory,
    ctx.personaFields?.appearance,
    ctx.personaFields?.scenario,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");
}

function resolveConditionalOperand(raw: string, ctx: MacroContext, options: ResolveMacroOptions): string {
  const quoted = stripOuterQuotes(raw);
  if (quoted !== null) return quoted;

  const token = raw.trim();
  const normalized = normalizeConditionKey(token);
  switch (normalized) {
    case "char":
    case "charname":
    case "character":
    case "speaker":
      return ctx.char;
    case "charphonetic":
    case "charnamephonetic":
    case "characterphonetic":
    case "speakerphonetic":
      return ctx.charPhonetic || ctx.characterFields?.phoneticName || ctx.char;
    case "user":
    case "username":
      return ctx.user;
    case "userphonetic":
    case "usernamephonetic":
      return ctx.userPhonetic || ctx.personaFields?.phoneticName || ctx.user;
    case "persona":
      return resolvePersonaText(ctx);
    case "personadescription":
      return ctx.personaFields?.description ?? "";
    case "personapersonality":
      return ctx.personaFields?.personality ?? "";
    case "personabackstory":
      return ctx.personaFields?.backstory ?? "";
    case "personaappearance":
      return ctx.personaFields?.appearance ?? "";
    case "personascenario":
      return ctx.personaFields?.scenario ?? "";
    case "characters":
      return ctx.characters.join(", ");
    case "group":
      return resolveGroupCharacters(ctx);
    case "input":
      return ctx.lastInput ?? "";
    case "model":
      return ctx.model ?? "";
    case "chatid":
      return ctx.chatId ?? "";
    case "description":
      return ctx.characterFields?.description ?? "";
    case "personality":
      return ctx.characterFields?.personality ?? "";
    case "backstory":
      return ctx.characterFields?.backstory ?? "";
    case "appearance":
      return ctx.characterFields?.appearance ?? "";
    case "scenario":
      return ctx.characterFields?.scenario ?? "";
    case "example":
      return ctx.characterFields?.example ?? "";
    case "charsysinfo":
      return ctx.characterFields?.systemPrompt ?? "";
    case "charposthistory":
      return ctx.characterFields?.postHistoryInstructions ?? "";
    default:
      if (/^var[:.]/i.test(token)) {
        const name = token.replace(/^var[:.]/i, "").trim();
        return ctx.variables[name] ?? "";
      }
      // Resolve any other bare operand through the same flat pass used for
      // {{token}}, so every read macro valid in {{...}} is also testable bare in
      // {{#if}} — conversation macros ({{char_about}} …), {{date}}/{{time}},
      // {{agent::TYPE}}, {{lastGenerationType}}, etc. — instead of drifting out
      // of sync with a hand-maintained switch (#3435). Guards:
      //   • never run a variable-WRITE macro (side effect) as an operand;
      //   • unknown tokens stay literal (the flat pass leaves them as-is), so a
      //     plain word or number still compares as itself — unchanged behavior;
      //   • force concrete resolution (deferCharacterMacros off) so a group chat
      //     compares the real value, not a deferred per-character placeholder.
      if (!/^(setvar|addvar|addnumvar|incvar|decvar)\b/i.test(token)) {
        const braced = `{{${token}}}`;
        const resolved = resolveMacros(braced, ctx, {
          ...nestedMacroOptions(options),
          trimResult: false,
          deferCharacterMacros: undefined,
        });
        if (resolved !== braced) return resolved;
      }
      return ctx.variables[token] ?? token;
  }
}

function isCharacterConditionalOperand(raw: string): boolean {
  return CHARACTER_CONDITIONAL_OPERAND_NAMES.has(normalizeConditionKey(raw));
}

type ParsedConditionExpression = { left: string; operator: string; right?: string };
const CONDITION_WORD_OPERATOR_RE = /(?:is\s+not|not\s+contains|not\s+includes|contains|includes|is)(?=\s|$)/iuy;

function parseConditionExpression(condition: string): ParsedConditionExpression {
  const symbolicOperators = [">=", "<=", "==", "!=", ">", "<", "="] as const;
  let quote: "single" | "double" | null = null;
  let escaped = false;
  let macroDepth = 0;

  for (let index = 0; index < condition.length; index += 1) {
    const character = condition[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (quoteKind(character) === quote) quote = null;
      continue;
    }
    if (macroDepth > 0) {
      if (character === "{" && condition[index + 1] === "{") {
        macroDepth += 1;
        index += 1;
      } else if (character === "}" && condition[index + 1] === "}") {
        macroDepth -= 1;
        index += 1;
      }
      continue;
    }
    const nextQuote = quoteKind(character);
    if (nextQuote) {
      quote = nextQuote;
      continue;
    }
    if (character === "{" && condition[index + 1] === "{") {
      macroDepth = 1;
      index += 1;
      continue;
    }

    const symbolicOperator = symbolicOperators.find((operator) => condition.startsWith(operator, index));
    if (symbolicOperator) {
      const left = condition.slice(0, index).trim();
      const right = condition.slice(index + symbolicOperator.length).trim();
      if (left && right) return { left, operator: symbolicOperator, right };
    }

    if (index === 0 || /\s/u.test(condition[index - 1]!)) {
      CONDITION_WORD_OPERATOR_RE.lastIndex = index;
      const wordMatch = CONDITION_WORD_OPERATOR_RE.exec(condition);
      if (wordMatch?.[0]) {
        const left = condition.slice(0, index).trim();
        const right = condition.slice(index + wordMatch[0].length).trim();
        if (left && right) {
          return { left, operator: wordMatch[0].toLowerCase().replace(/\s+/g, " "), right };
        }
      }
    }
  }

  return { left: condition.trim(), operator: "truthy" };
}

type ConditionSyntaxNode =
  | { kind: "atom"; value: string }
  | { kind: "and" | "or"; children: ConditionSyntaxNode[] }
  | { kind: "group"; child: ConditionSyntaxNode }
  | { kind: "adjacent"; children: ConditionSyntaxNode[] };

type ConditionSyntaxFrame = {
  atomStart: number;
  andChildren: ConditionSyntaxNode[];
  orChildren: ConditionSyntaxNode[];
  expectsOperand: boolean;
  literalParenthesisDepth: number;
};

function createConditionSyntaxFrame(atomStart: number): ConditionSyntaxFrame {
  return {
    atomStart,
    andChildren: [],
    orChildren: [],
    expectsOperand: true,
    literalParenthesisDepth: 0,
  };
}

function appendConditionSyntaxNode(frame: ConditionSyntaxFrame, node: ConditionSyntaxNode): void {
  if (!frame.expectsOperand) {
    const previous = frame.andChildren.pop()!;
    if (previous.kind === "adjacent") {
      previous.children.push(node);
      frame.andChildren.push(previous);
    } else {
      frame.andChildren.push({ kind: "adjacent", children: [previous, node] });
    }
    frame.expectsOperand = false;
    return;
  }
  frame.andChildren.push(node);
  frame.expectsOperand = false;
}

function conditionSyntaxNodeText(node: ConditionSyntaxNode): string {
  const parts: string[] = [];
  const pending: Array<ConditionSyntaxNode | string> = [node];
  while (pending.length > 0) {
    const part = pending.pop()!;
    if (typeof part === "string") {
      parts.push(part);
    } else if (part.kind === "atom") {
      parts.push(part.value);
    } else if (part.kind === "group") {
      pending.push(")", part.child, "(");
    } else {
      const separator = part.kind === "and" ? " && " : part.kind === "or" ? " || " : "";
      for (let index = part.children.length - 1; index >= 0; index -= 1) {
        pending.push(part.children[index]!);
        if (index > 0 && separator) pending.push(separator);
      }
    }
  }
  return parts.join("");
}

function appendConditionAtom(frame: ConditionSyntaxFrame, condition: string, end: number, forceEmpty: boolean): void {
  const value = condition.slice(frame.atomStart, end).trim();
  frame.atomStart = end;
  if (!value && !(forceEmpty && frame.expectsOperand)) return;
  appendConditionSyntaxNode(frame, { kind: "atom", value });
}

function combineConditionNodes(kind: "and" | "or", children: ConditionSyntaxNode[]): ConditionSyntaxNode {
  return children.length === 1 ? children[0]! : { kind, children };
}

function finishConditionSyntaxFrame(frame: ConditionSyntaxFrame): ConditionSyntaxNode {
  const andNode = combineConditionNodes("and", frame.andChildren);
  if (frame.orChildren.length === 0) return andNode;
  return combineConditionNodes("or", [...frame.orChildren, andNode]);
}

/** Parse the supported boolean grammar in one quote- and macro-aware pass. */
function parseConditionSyntax(condition: string): ConditionSyntaxNode {
  const frames = [createConditionSyntaxFrame(0)];
  let quote: "single" | "double" | null = null;
  let escaped = false;
  let macroDepth = 0;

  for (let index = 0; index < condition.length; index += 1) {
    const character = condition[index]!;
    const frame = frames[frames.length - 1]!;

    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (quoteKind(character) === quote) quote = null;
      continue;
    }
    if (macroDepth > 0) {
      if (character === "{" && condition[index + 1] === "{") {
        macroDepth += 1;
        index += 1;
      } else if (character === "}" && condition[index + 1] === "}") {
        macroDepth -= 1;
        index += 1;
      }
      continue;
    }

    const nextQuote = quoteKind(character);
    if (nextQuote) {
      quote = nextQuote;
      continue;
    }
    if (character === "{" && condition[index + 1] === "{") {
      macroDepth = 1;
      index += 1;
      continue;
    }

    if (character === "(") {
      const prefix = condition.slice(frame.atomStart, index);
      if (frame.literalParenthesisDepth === 0 && frame.expectsOperand && prefix.trim().length === 0) {
        frames.push(createConditionSyntaxFrame(index + 1));
      } else {
        frame.literalParenthesisDepth += 1;
      }
      continue;
    }

    if (character === ")") {
      if (frame.literalParenthesisDepth > 0) {
        frame.literalParenthesisDepth -= 1;
        continue;
      }
      if (frames.length === 1) {
        if (frame.andChildren.length > 0) {
          appendConditionSyntaxNode(frame, { kind: "atom", value: ")" });
          frame.atomStart = index + 1;
        }
        continue;
      }

      appendConditionAtom(frame, condition, index, true);
      const groupedNode = finishConditionSyntaxFrame(frame);
      frames.pop();
      const parent = frames[frames.length - 1]!;
      appendConditionSyntaxNode(parent, { kind: "group", child: groupedNode });
      parent.atomStart = index + 1;
      continue;
    }

    const operator = frame.literalParenthesisDepth === 0 ? condition.slice(index, index + 2) : "";
    if (operator !== "&&" && operator !== "||") continue;

    appendConditionAtom(frame, condition, index, true);
    if (operator === "||") {
      frame.orChildren.push(combineConditionNodes("and", frame.andChildren));
      frame.andChildren = [];
    }
    frame.expectsOperand = true;
    frame.atomStart = index + 2;
    index += 1;
  }

  // An unmatched opening parenthesis makes every operator after it nested in
  // the legacy grammar. Treat that suffix as one atom without rescanning it.
  const root = frames[0]!;
  appendConditionAtom(root, condition, condition.length, true);
  return finishConditionSyntaxFrame(root);
}

function parseConditionComparisons(condition: string): ParsedConditionExpression[] {
  const comparisons: ParsedConditionExpression[] = [];
  const pending = [parseConditionSyntax(condition)];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.kind === "atom") {
      comparisons.push(parseConditionExpression(node.value));
    } else if (node.kind === "group") {
      pending.push(node.child);
    } else if (node.kind === "adjacent") {
      comparisons.push(parseConditionExpression(conditionSyntaxNodeText(node)));
    } else {
      for (let index = node.children.length - 1; index >= 0; index -= 1) pending.push(node.children[index]!);
    }
  }
  return comparisons;
}

// Bracket expansion historically recognized character operands even in
// malformed adjacent groups such as `(char)()`. Keep that compatibility local
// while comparison/deferred-operand consumers match the atom actually evaluated.
function conditionHasLegacyAdjacentCharacterReference(condition: string): boolean {
  const pending: Array<{ node: ConditionSyntaxNode; insideAdjacent: boolean }> = [
    { node: parseConditionSyntax(condition), insideAdjacent: false },
  ];
  while (pending.length > 0) {
    const { node, insideAdjacent } = pending.pop()!;
    if (node.kind === "atom") {
      if (!insideAdjacent) continue;
      const parsed = parseConditionExpression(node.value);
      if (
        isCharacterConditionalOperand(parsed.left) ||
        (parsed.right ? isCharacterConditionalOperand(parsed.right) : false)
      ) {
        return true;
      }
    } else if (node.kind === "group") {
      pending.push({ node: node.child, insideAdjacent });
    } else {
      const childInsideAdjacent = insideAdjacent || node.kind === "adjacent";
      for (const child of node.children) pending.push({ node: child, insideAdjacent: childInsideAdjacent });
    }
  }
  return false;
}

function conditionDependsOnCharacter(condition: string): boolean {
  return parseConditionComparisons(condition).some(
    (parsed) =>
      isCharacterConditionalOperand(parsed.left) ||
      (parsed.right ? isCharacterConditionalOperand(parsed.right) : false),
  );
}

function parseConditionNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareConditionValues(left: string, operator: string, right: string): boolean {
  const leftNormalized = left.trim().toLowerCase();
  const rightNormalized = right.trim().toLowerCase();
  const leftNumber = parseConditionNumber(left);
  const rightNumber = parseConditionNumber(right);
  const bothNumeric = leftNumber !== null && rightNumber !== null;
  switch (operator) {
    case "=":
    case "==":
    case "is":
      if (bothNumeric) return leftNumber === rightNumber;
      return leftNormalized === rightNormalized;
    case "!=":
    case "is not":
      if (bothNumeric) return leftNumber !== rightNumber;
      return leftNormalized !== rightNormalized;
    case ">":
      return bothNumeric ? leftNumber > rightNumber : false;
    case "<":
      return bothNumeric ? leftNumber < rightNumber : false;
    case ">=":
      return bothNumeric ? leftNumber >= rightNumber : false;
    case "<=":
      return bothNumeric ? leftNumber <= rightNumber : false;
    case "contains":
    case "includes":
      return leftNormalized.includes(rightNormalized);
    case "not contains":
    case "not includes":
      return !leftNormalized.includes(rightNormalized);
    default:
      return false;
  }
}

function resolveConditionMacros(condition: string, ctx: MacroContext, options: ResolveMacroOptions): string {
  if (!condition.includes("{{")) return condition;
  return resolveMacros(condition, ctx, {
    ...nestedMacroOptions(options),
    trimResult: false,
  });
}

function evaluateParsedCondition(
  parsed: ParsedConditionExpression,
  ctx: MacroContext,
  options: ResolveMacroOptions,
): boolean {
  const left = resolveConditionalOperand(parsed.left, ctx, options);
  if (parsed.operator === "truthy") return left.trim().length > 0 && !/^(false|0|no|off|null|undefined)$/i.test(left);
  const right = resolveConditionalOperand(parsed.right ?? "", ctx, options);
  return compareConditionValues(left, parsed.operator, right);
}

type EqualityShorthand = Pick<ParsedConditionExpression, "left" | "operator">;

type ConditionEvaluationFrame =
  | { kind: "group" }
  | { kind: "and"; children: ConditionSyntaxNode[]; index: number }
  | {
      kind: "or";
      children: ConditionSyntaxNode[];
      index: number;
      equalityShorthand: EqualityShorthand | null;
    };

function parseResolvedConditionAtom(
  atom: string,
  ctx: MacroContext,
  options: ResolveMacroOptions,
): ParsedConditionExpression {
  return parseConditionExpression(resolveConditionMacros(atom, ctx, options));
}

function conditionSyntaxAtomValue(node: ConditionSyntaxNode): string | null {
  if (node.kind === "atom") return node.value;
  return node.kind === "adjacent" ? conditionSyntaxNodeText(node) : null;
}

function evaluateOrConditionAtom(
  atom: string,
  equalityShorthand: EqualityShorthand | null,
  ctx: MacroContext,
  options: ResolveMacroOptions,
): { matches: boolean; equalityShorthand: EqualityShorthand | null } {
  const parsed = parseResolvedConditionAtom(atom, ctx, options);
  let effective = parsed;
  let nextShorthand = equalityShorthand;
  if (["=", "==", "is"].includes(parsed.operator) && parsed.right !== undefined) {
    nextShorthand = { left: parsed.left, operator: parsed.operator };
  } else if (equalityShorthand && parsed.operator === "truthy" && stripOuterQuotes(parsed.left) !== null) {
    effective = { ...equalityShorthand, right: parsed.left };
  }
  return { matches: evaluateParsedCondition(effective, ctx, options), equalityShorthand: nextShorthand };
}

function evaluateConditionExpression(condition: string, ctx: MacroContext, options: ResolveMacroOptions): boolean {
  const frames: ConditionEvaluationFrame[] = [];
  let current: ConditionSyntaxNode | null = parseConditionSyntax(condition);
  let result = false;

  while (true) {
    if (current) {
      if (current.kind === "atom" || current.kind === "adjacent") {
        result = evaluateParsedCondition(
          parseResolvedConditionAtom(conditionSyntaxAtomValue(current)!, ctx, options),
          ctx,
          options,
        );
        current = null;
      } else if (current.kind === "group") {
        frames.push({ kind: "group" });
        current = current.child;
        continue;
      } else if (current.kind === "and") {
        frames.push({ kind: "and", children: current.children, index: 0 });
        current = current.children[0]!;
        continue;
      } else {
        const frame: ConditionEvaluationFrame = {
          kind: "or",
          children: current.children,
          index: 0,
          equalityShorthand: null,
        };
        frames.push(frame);
        const child: ConditionSyntaxNode = current.children[0]!;
        if (child.kind === "atom" || child.kind === "adjacent") {
          const evaluated = evaluateOrConditionAtom(
            conditionSyntaxAtomValue(child)!,
            frame.equalityShorthand,
            ctx,
            options,
          );
          frame.equalityShorthand = evaluated.equalityShorthand;
          result = evaluated.matches;
          current = null;
        } else {
          current = child;
        }
        continue;
      }
    }

    const frame = frames[frames.length - 1];
    if (!frame) return result;
    if (frame.kind === "group") {
      frames.pop();
      continue;
    }
    if (frame.kind === "and") {
      if (!result) {
        frames.pop();
        continue;
      }
      frame.index += 1;
      if (frame.index >= frame.children.length) {
        frames.pop();
        result = true;
      } else {
        current = frame.children[frame.index]!;
      }
      continue;
    }

    if (result) {
      frames.pop();
      continue;
    }
    frame.index += 1;
    if (frame.index >= frame.children.length) {
      frames.pop();
      result = false;
      continue;
    }
    const child = frame.children[frame.index]!;
    if (child.kind === "atom" || child.kind === "adjacent") {
      const evaluated = evaluateOrConditionAtom(
        conditionSyntaxAtomValue(child)!,
        frame.equalityShorthand,
        ctx,
        options,
      );
      frame.equalityShorthand = evaluated.equalityShorthand;
      result = evaluated.matches;
    } else {
      current = child;
    }
  }
}

function evaluateCondition(condition: string, ctx: MacroContext, options: ResolveMacroOptions = {}): boolean {
  return evaluateConditionExpression(condition, ctx, options);
}

type MacroTag = {
  start: number;
  end: number;
  body: string;
};

type ConditionalStartTag = MacroTag & {
  condition: string;
};

type ConditionalBranch = {
  condition: string | null;
  contentStart: number;
  contentEnd: number;
};

function readNextMacroTag(input: string, fromIndex: number): MacroTag | null {
  let searchIndex = fromIndex;
  while (searchIndex < input.length) {
    const start = input.indexOf("{{", searchIndex);
    if (start === -1) return null;
    const end = findBalancedMacroEnd(input, start);
    if (end === -1) return null;
    return { start, end, body: input.slice(start + 2, end - 2).trim() };
  }
  return null;
}

function parseIfCondition(body: string): string | null {
  const match = body.match(/^#if(?:\s+([\s\S]*))?$/i);
  return match ? (match[1] ?? "").trim() : null;
}

function parseElseIfCondition(body: string): string | null {
  const match = body.match(/^else\s+if(?:\s+([\s\S]*))?$/i);
  return match ? (match[1] ?? "").trim() : null;
}

function findConditionalStart(input: string, fromIndex: number): ConditionalStartTag | null {
  let searchIndex = fromIndex;
  while (searchIndex < input.length) {
    const tag = readNextMacroTag(input, searchIndex);
    if (!tag) return null;
    const condition = parseIfCondition(tag.body);
    if (condition !== null) return { ...tag, condition };
    searchIndex = tag.end;
  }
  return null;
}

function findConditionalBranches(
  input: string,
  contentStart: number,
  initialCondition: string,
): { branches: ConditionalBranch[]; endStart: number; endEnd: number } | null {
  let depth = 1;
  let currentBranch: Omit<ConditionalBranch, "contentEnd"> = {
    condition: initialCondition,
    contentStart,
  };
  const branches: ConditionalBranch[] = [];
  let searchIndex = contentStart;

  while (searchIndex < input.length) {
    const tag = readNextMacroTag(input, searchIndex);
    if (!tag) return null;
    const body = tag.body;
    const normalized = body.toLowerCase();

    if (parseIfCondition(body) !== null) {
      depth += 1;
      searchIndex = tag.end;
      continue;
    }

    if (normalized === "/if") {
      depth -= 1;
      if (depth === 0) {
        branches.push({ ...currentBranch, contentEnd: tag.start });
        return { branches, endStart: tag.start, endEnd: tag.end };
      }
      searchIndex = tag.end;
      continue;
    }

    if (depth === 1) {
      const elseIfCondition = parseElseIfCondition(body);
      if (normalized === "else" || elseIfCondition !== null) {
        branches.push({ ...currentBranch, contentEnd: tag.start });
        currentBranch = {
          condition: normalized === "else" ? null : (elseIfCondition ?? ""),
          contentStart: tag.end,
        };
        searchIndex = tag.end;
        continue;
      }
    }

    searchIndex = tag.end;
  }

  return null;
}

function branchDependsOnCharacter(branches: ConditionalBranchPayload[]): boolean {
  return branches.some((branch) => branch.condition !== null && conditionDependsOnCharacter(branch.condition));
}

function conditionDependsOnDeferredOperand(condition: string, predicate: (operand: string) => boolean): boolean {
  return parseConditionComparisons(condition).some(
    (parsed) => predicate(parsed.left) || (parsed.right ? predicate(parsed.right) : false),
  );
}

function branchDependsOnDeferredOperand(
  branches: ConditionalBranchPayload[],
  predicate: (operand: string) => boolean,
): boolean {
  return branches.some(
    (branch) => branch.condition !== null && conditionDependsOnDeferredOperand(branch.condition, predicate),
  );
}

/**
 * Bake the standalone-block whitespace trim into a deferred block's branch
 * contents so the later-filled value collapses onto the surrounding lines the
 * same way an evaluated block would. Each branch's content starts right after
 * its governing tag ({{#if}}/{{else}}/{{else if}}), so under a standalone
 * opening the leading newline of WHICHEVER branch is later selected must be
 * dropped — matching the evaluate-now path, which strips the selected branch's
 * leading newline regardless of which one it is (#3449). The trailing {{/if}}
 * indent trim applies only to the last branch (only its line's standalone-ness
 * was measured).
 */
function trimDeferredStandaloneBranches(
  branches: ConditionalBranchPayload[],
  openStandalone: boolean,
  closeStandalone: boolean,
): ConditionalBranchPayload[] {
  if (!openStandalone && !closeStandalone) return branches;
  return branches.map((branch, index) => {
    let content = branch.content;
    if (openStandalone) content = content.replace(/^[ \t]*\n/, "");
    if (closeStandalone && index === branches.length - 1) content = content.replace(/\n[ \t]*$/, "\n");
    return { condition: branch.condition, content };
  });
}

export function selectConditionalPayloadBranch(
  payload: DeferredConditionalPayload,
  ctx: MacroContext,
  options: ResolveMacroOptions,
): string {
  const chainBranches = (payload as ConditionalChainPayload).branches;
  const branches: ConditionalBranchPayload[] = Array.isArray(chainBranches)
    ? chainBranches
    : [
        {
          condition: (payload as ConditionalBlockPayload).condition,
          content: (payload as ConditionalBlockPayload).truthy,
        },
        { condition: null, content: (payload as ConditionalBlockPayload).falsy },
      ];

  for (const branch of branches) {
    if (branch.condition === null || evaluateCondition(branch.condition, ctx, options)) {
      return branch.content;
    }
  }
  return "";
}

function resolveVariableOperationMacros(input: string, ctx: MacroContext, options: ResolveMacroOptions): string {
  return replaceBalancedMacros(input, (body, original) => {
    const readMatch = body.match(/^(getvar|incvar|decvar)::([\w.-]+)$/i);
    const writeMatch = body.match(/^(setvar|addvar|addnumvar)::([\w.-]+)::([\s\S]*)$/i);
    const op = String(readMatch?.[1] ?? writeMatch?.[1] ?? "").toLowerCase();
    const name = readMatch?.[2] ?? writeMatch?.[2];
    if (!op || !name) return undefined;
    if (!consumeMacroExpansion(options)) return original;
    // Older internal callers provide only `variables`; retain that in-memory
    // fallback while production prompt contexts supply a distinct chat-local map.
    const localVariables = (ctx.localVariables ??= ctx.variables);
    const readLocalVariable = () =>
      Object.prototype.hasOwnProperty.call(localVariables, name) ? localVariables[name] : undefined;
    const writeLocalVariable = (value: string) => {
      Object.defineProperty(localVariables, name, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return value;
    };

    switch (op) {
      case "getvar":
        return readLocalVariable() ?? "";
      case "setvar":
        writeLocalVariable(
          resolveMacros(writeMatch?.[3] ?? "", ctx, {
            ...nestedMacroOptions(options),
            trimResult: false,
          }),
        );
        return "";
      case "addvar": {
        const current = readLocalVariable() ?? "";
        const added = resolveMacros(writeMatch?.[3] ?? "", ctx, {
          ...nestedMacroOptions(options),
          trimResult: false,
        });
        const currentNumber = Number(current);
        const addedNumber = Number(added);
        writeLocalVariable(
          current.trim() && added.trim() && Number.isFinite(currentNumber) && Number.isFinite(addedNumber)
            ? String(currentNumber + addedNumber)
            : current + added,
        );
        return "";
      }
      case "addnumvar": {
        const currentValue = Number(readLocalVariable() ?? "0");
        const addedValue = Number(
          resolveMacros(writeMatch?.[3] ?? "", ctx, { ...nestedMacroOptions(options), trimResult: false }),
        );
        const currentNumber = Number.isFinite(currentValue) ? currentValue : 0;
        const addedNumber = Number.isFinite(addedValue) ? addedValue : 0;
        const sum = currentNumber + addedNumber;
        writeLocalVariable(String(Number.isFinite(sum) ? sum : currentNumber));
        return "";
      }
      case "incvar": {
        const current = Number(readLocalVariable() ?? "0");
        const next = (Number.isFinite(current) ? current : 0) + 1;
        return writeLocalVariable(String(next));
      }
      case "decvar": {
        const current = Number(readLocalVariable() ?? "0");
        const next = (Number.isFinite(current) ? current : 0) - 1;
        return writeLocalVariable(String(next));
      }
      default:
        return "";
    }
  });
}

function resolveConditionalBlocks(input: string, ctx: MacroContext, options: ResolveMacroOptions): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const startMatch = findConditionalStart(input, index);
    if (!startMatch) {
      result += resolveVariableOperationMacros(input.slice(index), ctx, options);
      break;
    }

    const blockStart = startMatch.start;
    const condition = startMatch.condition;
    const contentStart = startMatch.end;
    const blockEnd = findConditionalBranches(input, contentStart, condition);
    if (!blockEnd) {
      result += resolveVariableOperationMacros(input.slice(index), ctx, options);
      break;
    }

    const branches = blockEnd.branches.map((branch) => ({
      condition: branch.condition,
      content: input.slice(branch.contentStart, branch.contentEnd),
    }));

    const preTag = input.slice(index, blockStart);
    // Resolve the pre-tag text first so its side effects (e.g. {{setvar}}) are
    // applied before the condition is evaluated — preserves original ordering.
    const resolvedPreTag = resolveVariableOperationMacros(preTag, ctx, options);

    // Standalone-block whitespace control (Jinja trim_blocks / lstrip_blocks):
    // when the {{#if}} and/or {{/if}} tag occupies its own line, collapse that
    // tag line so a block — whether removed, rendered, or deferred — never
    // leaves a stray blank line (#3435). Judged from the raw layout; each side
    // is decided independently, so inline tags stay exactly as authored.
    const openLineStart = /(^|\n)[ \t]*$/.test(preTag);
    const openLineEnd = /^[ \t]*\n/.test(input.slice(contentStart));
    const openStandalone = openLineStart && openLineEnd;
    const closeLineIndentStart = input.lastIndexOf("\n", blockEnd.endStart - 1) + 1;
    const closeLineStart = /^[ \t]*$/.test(input.slice(closeLineIndentStart, blockEnd.endStart));
    const closeTrailing = input.slice(blockEnd.endEnd).match(/^[ \t]*\n/);
    const closeStandalone = closeLineStart && closeTrailing !== null;

    const deferCharacter = Boolean(options.deferCharacterMacros) && branchDependsOnCharacter(branches);
    const deferRelocation =
      !deferCharacter &&
      options.deferConditionalOperand !== undefined &&
      branchDependsOnDeferredOperand(branches, options.deferConditionalOperand);

    if (deferCharacter) {
      // Per-character deferral keeps its original (untrimmed) behavior.
      result += resolvedPreTag;
      result += encodeDeferredConditional({ branches });
      index = blockEnd.endEnd;
    } else if (deferRelocation) {
      // The operand's value isn't known during macro resolution; encode the
      // block — with the standalone trim baked into the stored branches — for
      // the caller to evaluate later against the real value.
      result += openStandalone ? resolvedPreTag.replace(/[ \t]*$/, "") : resolvedPreTag;
      result += encodeDeferredConditional(
        { branches: trimDeferredStandaloneBranches(branches, openStandalone, closeStandalone) },
        DEFERRED_RELOCATION_CONDITIONAL_TOKEN_PREFIX,
      );
      index = closeStandalone && closeTrailing ? blockEnd.endEnd + closeTrailing[0].length : blockEnd.endEnd;
    } else {
      const selected = selectConditionalPayloadBranch({ branches }, ctx, options);
      const resolvedBlock = resolveConditionalBlocks(selected, ctx, options);
      let emittedPre = resolvedPreTag;
      let emittedBlock = resolvedBlock;
      let nextIndex = blockEnd.endEnd;
      if (openStandalone) {
        emittedPre = emittedPre.replace(/[ \t]*$/, ""); // lstrip {{#if}} indent
        emittedBlock = emittedBlock.replace(/^[ \t]*\n/, ""); // trim newline after {{#if}}
      }
      if (closeStandalone) {
        emittedBlock = emittedBlock.replace(/[ \t]*$/, ""); // lstrip {{/if}} indent
        nextIndex = blockEnd.endEnd + closeTrailing![0].length; // trim newline after {{/if}}
      }
      result += emittedPre + emittedBlock;
      index = nextIndex;
    }
  }

  return result;
}

const AGENT_CONDITIONAL_ENTITY_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/&quot;|&#34;|&#x22;/gi, '"'],
  [/&apos;|&#39;|&#x27;/gi, "'"],
  [/&lt;|&#60;|&#x3c;/gi, "<"],
  [/&gt;|&#62;|&#x3e;/gi, ">"],
  [/&amp;|&#38;|&#x26;/gi, "&"],
];

function decodeAgentConditionalTextEntities(input: string): string {
  return AGENT_CONDITIONAL_ENTITY_REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    input,
  );
}

function decodeAgentConditionalEntities(input: string): string {
  return replaceBalancedMacros(input, (body) => {
    if (parseIfCondition(body) === null && parseElseIfCondition(body) === null) return undefined;
    return `{{${decodeAgentConditionalTextEntities(body)}}}`;
  });
}

/**
 * Remove conditional control syntax from agent-bound text while keeping every
 * authored branch. Agent calls need the prose as context, not the main prompt's
 * character-specific control flow.
 */
export function flattenAgentConditionalMacros(input: string): string {
  return flattenAgentConditionalMacrosInner(input, false);
}

function flattenAgentConditionalMacrosInner(input: string, decodeTextEntities: boolean): string {
  const normalized = decodeAgentConditionalEntities(
    decodeTextEntities ? decodeAgentConditionalTextEntities(input) : input,
  );
  let result = "";
  let index = 0;

  while (index < normalized.length) {
    const start = findConditionalStart(normalized, index);
    if (!start) return result + normalized.slice(index);
    const block = findConditionalBranches(normalized, start.end, start.condition);
    if (!block) return result + normalized.slice(index);

    result += normalized.slice(index, start.start);
    result += block.branches
      .map((branch) =>
        flattenAgentConditionalMacrosInner(normalized.slice(branch.contentStart, branch.contentEnd), true),
      )
      .join("");
    index = block.endEnd;
  }

  return result;
}

function splitTopLevelDoubleColon(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let index = 0; index < input.length; index++) {
    if (input[index] === "{" && input[index + 1] === "{") {
      depth += 1;
      current += "{{";
      index += 1;
      continue;
    }

    if (input[index] === "}" && input[index + 1] === "}" && depth > 0) {
      depth -= 1;
      current += "}}";
      index += 1;
      continue;
    }

    if (depth === 0 && input[index] === ":" && input[index + 1] === ":") {
      parts.push(current);
      current = "";
      index += 1;
      continue;
    }

    current += input[index];
  }

  parts.push(current);
  return parts;
}

function findTopLevelWeightMarker(input: string): number {
  let depth = 0;
  let markerIndex = -1;

  for (let index = 0; index < input.length; index++) {
    if (input[index] === "{" && input[index + 1] === "{") {
      depth += 1;
      index += 1;
      continue;
    }

    if (input[index] === "}" && input[index + 1] === "}" && depth > 0) {
      depth -= 1;
      index += 1;
      continue;
    }

    if (depth === 0 && input[index] === "@") {
      markerIndex = index;
    }
  }

  return markerIndex;
}

function parseWeightedRandomChoice(choice: string): { text: string; weight: number } {
  const markerIndex = findTopLevelWeightMarker(choice);
  if (markerIndex === -1) return { text: choice, weight: 1 };

  const weightText = choice.slice(markerIndex + 1).trim();
  if (!/^(?:\d+|\d*\.\d+)$/.test(weightText)) {
    return { text: choice, weight: 1 };
  }

  const weight = Number(weightText);
  if (!Number.isFinite(weight) || weight < 0) {
    return { text: choice, weight: 1 };
  }

  return { text: choice.slice(0, markerIndex).trim(), weight };
}

function pickWeightedRandomChoice(choices: string[], options: ResolveMacroOptions, original: string): string {
  const weightedChoices = choices.map(parseWeightedRandomChoice).filter((choice) => choice.text.length > 0);
  const totalWeight = weightedChoices.reduce((total, choice) => total + choice.weight, 0);

  if (totalWeight <= 0) return "";

  let roll = randomUnit(options, original) * totalWeight;
  for (const choice of weightedChoices) {
    roll -= choice.weight;
    if (roll < 0) return choice.text;
  }

  return weightedChoices[weightedChoices.length - 1]?.text ?? "";
}

type MacroDateTimeParts = {
  date: string;
  time: string;
  datetime: string;
  isoTime: string;
  weekday: string;
  timeZone: string;
};

function shortOffsetToIsoSuffix(value: string | undefined): string {
  if (!value || value === "GMT" || value === "UTC") return "Z";
  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/u);
  if (!match) return "";
  const sign = match[1];
  const hours = match[2];
  const minutes = match[3] ?? "00";
  if (!sign || !hours) return "";
  return `${sign}${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function formatMacroDateTime(now: Date, requestedTimeZone?: string): MacroDateTimeParts {
  const preferredTimeZone =
    typeof requestedTimeZone === "string" && requestedTimeZone.trim() ? requestedTimeZone.trim() : undefined;
  const build = (timeZone?: string): MacroDateTimeParts => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      ...(timeZone ? { timeZone } : {}),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "long",
      timeZoneName: "shortOffset",
    });
    const parts = new Map(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    const year = parts.get("year") ?? String(now.getFullYear()).padStart(4, "0");
    const month = parts.get("month") ?? String(now.getMonth() + 1).padStart(2, "0");
    const day = parts.get("day") ?? String(now.getDate()).padStart(2, "0");
    const hour = parts.get("hour") ?? String(now.getHours()).padStart(2, "0");
    const minute = parts.get("minute") ?? String(now.getMinutes()).padStart(2, "0");
    const second = parts.get("second") ?? String(now.getSeconds()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const time = `${hour}:${minute}`;
    const offset = shortOffsetToIsoSuffix(parts.get("timeZoneName"));
    const datetime = `${date}T${time}:${second}${offset}`;
    return {
      date,
      time,
      datetime,
      isoTime: datetime,
      weekday: parts.get("weekday") ?? now.toLocaleDateString("en-US", { weekday: "long" }),
      timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    };
  };

  try {
    return build(preferredTimeZone);
  } catch {
    return build();
  }
}

/**
 * Replace macros in a prompt string with their values.
 *
 * Supported macros (SillyTavern-compatible):
 *  - {{user}} — user's display name
 *  - {{persona}} — active persona description, personality, backstory, appearance, and scenario joined by new lines
 *  - {{char}} — current character name
 *  - {{CHARACTER_ID}} — name of another character card referenced by its exact ID
 *  - {{persona-PERSONA_ID}} — name of another persona card referenced by its exact ID
 *  - {{characters}} — comma-separated list of all character names
 *  - {{group}} — comma-separated list of other active chat characters
 *  - {{description}} / {{personality}} / {{backstory}} / {{appearance}} / {{scenario}} / {{example}} — current character card fields
 *  - {{charSysInfo}} / {{charPostHistory}} — current character instruction fields
 *  - {{date}} — current real date in the user's timezone (YYYY-MM-DD)
 *  - {{time}} — current real time in the user's timezone (HH:MM)
 *  - {{datetime}} — current datetime in the user's timezone
 *  - {{weekday}} — current day name in the user's timezone (Monday, etc.)
 *  - {{isotime}} — timestamp in the user's timezone
 *  - {{timezone}} — current user/browser timezone
 *  - {{random}} — random number 0-100
 *  - {{random:X:Y}} — random number X-Y
 *  - {{random::A::B::C}} — random choice from A, B, C
 *  - {{random::A@2::B@0.5}} — weighted random choice; weights are relative
 *  - {{roll:XdY}} — dice roll (e.g. {{roll:2d6}})
 *  - {{getvar::name}} — read a dynamic variable
 *  - {{setvar::name::value}} — set a variable
 *  - {{addvar::name::value}} — append to a variable
 *  - {{addnumvar::name::value}} — add to a numeric variable
 *  - {{incvar::name}} — increment numeric variable by 1
 *  - {{decvar::name}} — decrement numeric variable by 1
 *  - {{input}} — last user message
 *  - {{model}} — current model name
 *  - {{chatId}} — current chat ID
 *  - {{lastGenerationType}} — current generation type label
 *  - {{idle_duration}} — time since the last chat activity
 *  - {{outlet::name}} — activated lorebook entries assigned to a named Outlet
 *  - {{lorebooksize::ID}} — total number of entries in the lorebook with the given ID
 *  - {{gameStoryboardKeyframeCount}} — current Game Mode Keyframes per Turn target
 *  - {{// comment}} — removed (author comments)
 *  - {{trim}} — remove surrounding whitespace
 *  - {{trimStart}} / {{trimEnd}} — directional trim markers
 *  - {{newline}} / {{\n}} — literal newline
 *  - {{noop}} — no operation, removed
 *  - {{banned "text"}} — content filter (removed for now)
 *  - {{uppercase}}...{{/uppercase}} — convert to uppercase
 *  - {{lowercase}}...{{/lowercase}} — convert to lowercase
 *  - {{#if char == "Name" || "Other"}}...{{else}}...{{/if}} — conditional block with OR/AND logic
 */
export function resolveMacros(template: string, ctx: MacroContext, options: ResolveMacroOptions = {}): string {
  const macroDepth = options.macroDepth ?? 0;
  if (macroDepth > macroLimit(options, "maxMacroDepth")) {
    getMacroBudget(options).exceeded = true;
    return clampMacroOutput(template, options);
  }
  getMacroBudget(options);
  // #3104: content with no macro syntax has nothing to resolve. Every step below
  // is triggered by "{{" (live macros), the "\x1e" deferred-character token
  // sentinel, or the "\x00" trim-marker sentinel, so a template containing none
  // of them is returned unchanged — skipping the comment strip,
  // bracket/conditional expansion, the global substitution passes, and the
  // persona-field build. Output is identical.
  if (!template.includes("{{") && !template.includes("\x1e") && !template.includes("\x00")) {
    const passthrough = options.trimResult !== false ? template.trim() : template;
    return clampMacroOutput(passthrough, options);
  }
  let result = template;
  const fieldResolutionDepth = options.fieldResolutionDepth ?? 0;
  const resolveNestedFieldMacros = (value: string): string => {
    const stripped = stripMacroComments(value);
    if (!stripped.includes("{{")) return stripped;
    if (fieldResolutionDepth >= MAX_CHARACTER_FIELD_RESOLUTION_DEPTH) return "";
    return resolveMacros(stripped, ctx, {
      ...nestedMacroOptions(options),
      trimResult: false,
      fieldResolutionDepth: fieldResolutionDepth + 1,
    });
  };
  const deferCharacterMacros = options.deferCharacterMacros;
  const characterReplacement = (field: keyof typeof DEFERRED_CHARACTER_MACRO_TOKENS): string => {
    const isNameField = field === "char" || field === "charPhonetic" || field === "group";
    if (deferCharacterMacros === "all" || (deferCharacterMacros === "names" && isNameField)) {
      return DEFERRED_CHARACTER_MACRO_TOKENS[field];
    }
    if (field === "char") return ctx.char;
    if (field === "charPhonetic") return ctx.charPhonetic || ctx.characterFields?.phoneticName || ctx.char;
    if (field === "group") return resolveGroupCharacters(ctx);
    return resolveNestedFieldMacros(ctx.characterFields?.[field as CharacterFieldMacroName] ?? "");
  };
  const conversationCharacterReplacement = (
    field: "convoDisplay" | "charAbout" | "convoBehavior",
    value: string | undefined,
  ): string => (deferCharacterMacros === "all" ? DEFERRED_CHARACTER_MACRO_TOKENS[field] : (value ?? ""));

  // ── Comments — strip first so they don't interfere ──
  result = stripMacroComments(result);

  // #3104: resolve the persona fields lazily — only when {{persona}} can appear
  // in the output — instead of unconditionally on every call (the root cause of
  // the freeze). The gated build stays at the original eager build's pipeline
  // position, before the conditional/variable-op passes, so persona-field side
  // effects such as {{setvar::…}} still land before conditions that read them.
  let personaText: string | null = null;
  const buildPersonaText = (): string =>
    [
      ctx.personaFields?.description,
      ctx.personaFields?.personality,
      ctx.personaFields?.backstory,
      ctx.personaFields?.appearance,
      ctx.personaFields?.scenario,
    ]
      .map((part) => (typeof part === "string" ? resolveNestedFieldMacros(part) : part))
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n");
  if (/\{\{persona\}\}/i.test(result)) personaText = buildPersonaText();

  // ── Multi-character bracket blocks — expand before global substitutions ──
  result = expandBracketedCharacterBlocks(result, ctx);

  // ── Conditional blocks — choose a branch before resolving branch-local macros. ──
  result = resolveConditionalBlocks(result, ctx, options);

  // ── No-op & banned ──
  result = result.replace(/\{\{noop\}\}/gi, "");
  result = replaceBalancedMacros(result, (body) => (/^banned(?:\s+[\s\S]*)?$/i.test(body.trim()) ? "" : undefined));

  // ── Static substitutions ──
  result = result.replace(/\{\{user(?:Name)?\}\}/gi, ctx.user);
  result = result.replace(
    /\{\{user(?:Name)?Phonetic\}\}/gi,
    ctx.userPhonetic || ctx.personaFields?.phoneticName || ctx.user,
  );
  // The gated build above can be skipped when {{persona}} only materializes
  // mid-pipeline (e.g. substituted in by an earlier pass), so fall back to
  // building here. String form is kept so $-sequences in persona text
  // substitute exactly as before.
  if (/\{\{persona\}\}/i.test(result)) {
    result = result.replace(/\{\{persona\}\}/gi, (personaText ??= buildPersonaText()));
  }
  result = result.replace(/\{\{personaDescription\}\}/gi, () =>
    resolveNestedFieldMacros(ctx.personaFields?.description ?? ""),
  );
  result = result.replace(/\{\{personaPersonality\}\}/gi, () =>
    resolveNestedFieldMacros(ctx.personaFields?.personality ?? ""),
  );
  result = result.replace(/\{\{personaBackstory\}\}/gi, () =>
    resolveNestedFieldMacros(ctx.personaFields?.backstory ?? ""),
  );
  result = result.replace(/\{\{personaAppearance\}\}/gi, () =>
    resolveNestedFieldMacros(ctx.personaFields?.appearance ?? ""),
  );
  result = result.replace(/\{\{personaScenario\}\}/gi, () =>
    resolveNestedFieldMacros(ctx.personaFields?.scenario ?? ""),
  );
  result = result.replace(/\{\{char(?:Name)?\}\}/gi, characterReplacement("char"));
  result = result.replace(/\{\{char(?:Name)?Phonetic\}\}/gi, characterReplacement("charPhonetic"));
  result = result.replace(/\{\{characters\}\}/gi, ctx.characters.join(", "));
  result = result.replace(/\{\{group\}\}/gi, characterReplacement("group"));
  result = result.replace(/\{\{description\}\}/gi, characterReplacement("description"));
  result = result.replace(/\{\{personality\}\}/gi, characterReplacement("personality"));
  result = result.replace(/\{\{backstory\}\}/gi, characterReplacement("backstory"));
  result = result.replace(/\{\{appearance\}\}/gi, characterReplacement("appearance"));
  result = result.replace(/\{\{scenario\}\}/gi, characterReplacement("scenario"));
  result = result.replace(/\{\{example\}\}/gi, characterReplacement("example"));
  result = result.replace(/\{\{charSysInfo\}\}/gi, characterReplacement("systemPrompt"));
  result = result.replace(/\{\{charPostHistory\}\}/gi, characterReplacement("postHistoryInstructions"));
  // Conversation-mode-only macros. `convoFields` is set only by the convo prompt
  // branch, so these are "" in every other mode.
  result = result.replace(/\{\{convo_display\}\}/gi, () =>
    conversationCharacterReplacement("convoDisplay", ctx.convoFields?.charDisplayName),
  );
  result = result.replace(/\{\{char_about\}\}/gi, () =>
    conversationCharacterReplacement("charAbout", ctx.convoFields?.charAbout),
  );
  result = result.replace(/\{\{persona_about\}\}/gi, () => ctx.convoFields?.personaAbout ?? "");
  result = result.replace(/\{\{convo_behavior\}\}/gi, () =>
    conversationCharacterReplacement("convoBehavior", ctx.convoFields?.convoBehavior),
  );
  result = result.replace(/\{\{input\}\}/gi, ctx.lastInput ?? "");
  result = result.replace(/\{\{model\}\}/gi, ctx.model ?? "");
  result = result.replace(/\{\{chatId\}\}/gi, ctx.chatId ?? "");
  result = result.replace(/\{\{lastGenerationType\}\}/gi, ctx.lastGenerationType ?? "");
  result = result.replace(/\{\{idle_duration\}\}/gi, ctx.idleDuration ?? "");
  result = result.replace(PERSONA_REFERENCE_ID_PATTERN, (match, personaId: string) => {
    const reference = ctx.personaReferences?.[personaId];
    return reference !== undefined ? reference : match;
  });
  const unresolvedCharacterReferences = new Set<string>();
  result = result.replace(CHARACTER_REFERENCE_ID_PATTERN, (match, characterId: string) => {
    const reference = ctx.characterReferences?.[characterId];
    if (reference !== undefined) return reference;
    unresolvedCharacterReferences.add(characterId);
    return match;
  });

  // ── Date/time ──
  // #3164: formatting the date/time parts constructs Intl.DateTimeFormat — a
  // large share of the pipeline's fixed cost — so build them only when a
  // date/time macro is actually present. `now` is still captured once per
  // invocation so all six macros agree on the instant. (Function replacers
  // are output-identical here: date strings never contain "$" sequences.)
  const now = new Date();
  let macroDateTime: ReturnType<typeof formatMacroDateTime> | null = null;
  const getMacroDateTime = () => (macroDateTime ??= formatMacroDateTime(now, ctx.timeZone));
  result = result.replace(/\{\{date\}\}/gi, () => getMacroDateTime().date);
  result = result.replace(/\{\{time\}\}/gi, () => getMacroDateTime().time);
  result = result.replace(/\{\{datetime\}\}/gi, () => getMacroDateTime().datetime);
  result = result.replace(/\{\{isotime\}\}/gi, () => getMacroDateTime().isoTime);
  result = result.replace(/\{\{weekday\}\}/gi, () => getMacroDateTime().weekday);
  result = result.replace(/\{\{timezone\}\}/gi, () => getMacroDateTime().timeZone);

  // ── Random values ──
  result = result.replace(/\{\{random\}\}/gi, (original) => {
    if (!consumeMacroExpansion(options)) return original;
    return String(randomInteger(options, original, 0, 100));
  });
  result = replaceBalancedMacros(result, (body, original) => {
    const match = body.match(/^random::([\s\S]*)$/i);
    if (!match) return undefined;
    if (!consumeMacroExpansion(options)) return original;

    const choices = splitTopLevelDoubleColon(match[1] ?? "")
      .map((choice) => choice.trim())
      .filter(Boolean);
    if (choices.length === 0) return "";
    const choice = pickWeightedRandomChoice(choices, options, original);
    return resolveMacros(choice, ctx, { ...nestedMacroOptions(options), trimResult: false });
  });
  result = result.replace(/\{\{random:(\d+):(\d+)\}\}/gi, (original, min, max) => {
    if (!consumeMacroExpansion(options)) return original;
    const first = parseInt(min, 10);
    const second = parseInt(max, 10);
    const lo = Math.min(first, second);
    const hi = Math.max(first, second);
    return String(randomInteger(options, original, lo, hi));
  });

  // ── Dice rolls: {{roll:2d6}} ──
  result = result.replace(/\{\{roll:(\d+)d(\d+)\}\}/gi, (original, count, sides) => {
    if (!consumeMacroExpansion(options)) return original;
    const n = Math.min(parseInt(count, 10), MAX_DICE_COUNT);
    const s = Math.min(parseInt(sides, 10), MAX_DICE_SIDES);
    if (n < 1 || s < 1) return "0";
    let total = 0;
    for (let i = 0; i < n; i++) total += randomInteger(options, `${original}:${i}`, 1, s);
    return String(total);
  });

  // ── Variable operations — resolve left-to-right so lorebook entries can set values for later entries. ──
  result = resolveVariableOperationMacros(result, ctx, options);

  // ── Case transforms ──
  result = result.replace(/\{\{uppercase\}\}([\s\S]*?)\{\{\/uppercase\}\}/gi, (_, inner) =>
    (inner as string).toUpperCase(),
  );
  result = result.replace(/\{\{lowercase\}\}([\s\S]*?)\{\{\/lowercase\}\}/gi, (_, inner) =>
    (inner as string).toLowerCase(),
  );

  // ── Newlines ──
  result = result.replace(/\{\{newline\}\}/gi, "\n");
  result = result.replace(/\{\{\\n\}\}/g, "\n");

  // ── Trim markers (processed last) ──
  result = result.replace(/\{\{trimStart\}\}/gi, "\x00TRIM_START\x00");
  result = result.replace(/\{\{trimEnd\}\}/gi, "\x00TRIM_END\x00");
  result = result.replace(/\{\{trim\}\}/gi, "");

  // Apply directional trims
  if (result.includes("\x00TRIM_START\x00")) {
    result = result.replace(/\x00TRIM_START\x00\s*/g, "");
  }
  if (result.includes("\x00TRIM_END\x00")) {
    result = result.replace(/\s*\x00TRIM_END\x00/g, "");
  }

  // ── Catch-all: resolve any remaining {{name}} from variables ──
  // This allows preset variables like {{POV}} to resolve directly
  result = result.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    if (unresolvedCharacterReferences.has(name)) return match;
    const val = ctx.variables[name];
    return val !== undefined ? val : match; // leave unknown macros as-is
  });

  // ── Agent data ──
  // Agent/tracker output is model-generated text. Insert it only after every
  // executable macro pass has finished so `{{agent::TYPE}}` cannot smuggle
  // dice rolls, variable writes, or other macros back into this resolution.
  result = result.replace(/\{\{agent::([\w-]+)\}\}/gi, (_, type) => {
    return ctx.agentData?.[type] ?? "";
  });

  // Outlet content has already passed through lorebook macro resolution before
  // it is collected. Insert it after every executable macro pass so Outlet
  // content cannot recursively invoke another Outlet or introduce side effects.
  result = replaceBalancedMacros(result, (body) => {
    const match = body.match(/^outlet::([\s\S]*)$/i);
    if (!match) return undefined;
    const name = (match[1] ?? "").trim();
    return name && ctx.outlets && Object.prototype.hasOwnProperty.call(ctx.outlets, name) ? ctx.outlets[name]! : "";
  });

  // ── Lorebook entry count ──
  // Resolves {{lorebooksize::ID}} to the total number of entries in the
  // referenced lorebook. Unknown IDs resolve to 0.
  result = result.replace(/\{\{lorebooksize::([\w-]+)\}\}/gi, (_, id) => {
    const counts = ctx.lorebookEntryCounts;
    return counts && Object.prototype.hasOwnProperty.call(counts, id) ? String(counts[id]) : "0";
  });

  if (options.trimResult !== false) {
    result = result.trim();
  }

  return clampMacroOutput(result, options);
}
