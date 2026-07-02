// ──────────────────────────────────────────────
// Macro Engine — {{user}}, {{char}}, {{date}}, etc.
// ──────────────────────────────────────────────

export interface MacroContext {
  user: string;
  char: string;
  /** All characters in the chat */
  characters: string[];
  /** Full per-character card fields for grouped macro expansion */
  characterProfiles?: Array<{
    name: string;
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
  /** Current character card fields used by macros like {{description}} */
  characterFields?: {
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
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
  };
}

export interface ResolveMacroOptions {
  trimResult?: boolean;
  /**
   * Preserve character macros as internal tokens for a later known-speaker pass.
   * "names" delays only {{char}}/{{charName}}; "all" also delays character field macros.
   */
  deferCharacterMacros?: "names" | "all";
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

const CHARACTER_MACRO_PATTERN =
  /\{\{(?:char|charName|description|personality|backstory|appearance|scenario|example|charSysInfo|charPostHistory)\}\}|\{\{\s*#if\s+[^}]*\b(?:char|charName|character|speaker|description|personality|backstory|appearance|scenario|example|charSysInfo|charPostHistory)\b/i;
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
const MACRO_COMMENT_PATTERN = /\{\{\/\/[^}]*\}\}/g;
const DEFERRED_CHARACTER_MACRO_TOKENS = {
  char: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}CHAR\x1f`,
  description: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}DESCRIPTION\x1f`,
  personality: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}PERSONALITY\x1f`,
  backstory: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}BACKSTORY\x1f`,
  appearance: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}APPEARANCE\x1f`,
  scenario: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}SCENARIO\x1f`,
  example: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}EXAMPLE\x1f`,
  systemPrompt: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}SYSTEM_PROMPT\x1f`,
  postHistoryInstructions: `${DEFERRED_CHARACTER_MACRO_TOKEN_PREFIX}POST_HISTORY\x1f`,
} as const;

export type CharacterMacroProfile = NonNullable<MacroContext["characterProfiles"]>[number];
type CharacterFieldMacroName = Exclude<keyof typeof DEFERRED_CHARACTER_MACRO_TOKENS, "char">;
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
  return template.replace(MACRO_COMMENT_PATTERN, "");
}

function getMacroBudget(options: ResolveMacroOptions): MacroResolutionBudget {
  if (options.macroBudget) return options.macroBudget;
  const budget: MacroResolutionBudget = { expansions: 0 };
  options.macroBudget = budget;
  return budget;
}

function macroLimit(options: ResolveMacroOptions, key: "maxMacroDepth" | "maxMacroExpansions" | "maxMacroOutputLength") {
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

export const SUPPORTED_MACROS: readonly SupportedMacroDefinition[] = [
  { category: "Identity", syntax: "{{user}}", description: "Current user or persona name" },
  { category: "Identity", syntax: "{{userName}}", description: "Alias for {{user}}" },
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
  { category: "Identity", syntax: "{{characters}}", description: "All character names, comma-separated" },
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
  { category: "Context", syntax: "{{input}}", description: "Most recent user message" },
  { category: "Context", syntax: "{{model}}", description: "Current model name" },
  { category: "Context", syntax: "{{chatId}}", description: "Current chat ID" },
  { category: "Context", syntax: "{{lastGenerationType}}", description: "Current generation type label" },
  { category: "Context", syntax: "{{idle_duration}}", description: "Time since the last chat activity" },
  { category: "Context", syntax: "{{agent::TYPE}}", description: "Cached output for an agent or tracker type" },
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
    syntax: '{{#if char == "Name"}}...{{else}}...{{/if}}',
    description: "Conditional block; supports straight or typographic quotes",
  },
  { category: "Formatting", syntax: "{{noop}}", description: "No-op placeholder removed from output" },
  { category: "Formatting", syntax: "{{// comment}}", description: "Inline author comment removed from output" },
  {
    category: "Formatting",
    syntax: '{{banned "text"}}',
    description: "Accepted with straight or typographic quotes, but currently stripped from output",
  },
];

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
    char: profile.name,
    characters: base?.characters ?? [profile.name],
    characterProfiles: base?.characterProfiles ?? [profile],
    variables: base?.variables ?? {},
    lastInput: base?.lastInput,
    chatId: base?.chatId,
    model: base?.model,
    lastGenerationType: base?.lastGenerationType,
    idleDuration: base?.idleDuration,
    timeZone: base?.timeZone,
    agentData: base?.agentData,
    personaFields: base?.personaFields,
    characterFields: {
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
  const scoped = resolveConditionalBlocks(
    stripMacroComments(template),
    macroContextForCharacterProfile(profile, baseContext),
    {},
  );
  return scoped
    .replace(/\{\{char(?:Name)?\}\}/gi, profile.name)
    .replace(/\{\{description\}\}/gi, () => resolveCharacterFieldValue(profile, "description", depth, baseContext))
    .replace(/\{\{personality\}\}/gi, () => resolveCharacterFieldValue(profile, "personality", depth, baseContext))
    .replace(/\{\{backstory\}\}/gi, () => resolveCharacterFieldValue(profile, "backstory", depth, baseContext))
    .replace(/\{\{appearance\}\}/gi, () => resolveCharacterFieldValue(profile, "appearance", depth, baseContext))
    .replace(/\{\{scenario\}\}/gi, () => resolveCharacterFieldValue(profile, "scenario", depth, baseContext))
    .replace(/\{\{example\}\}/gi, () => resolveCharacterFieldValue(profile, "example", depth, baseContext))
    .replace(/\{\{charSysInfo\}\}/gi, () => resolveCharacterFieldValue(profile, "systemPrompt", depth, baseContext))
    .replace(/\{\{charPostHistory\}\}/gi, () =>
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
  return result;
}

function parseDeferredConditionalPayload(encoded: string): DeferredConditionalPayload | null {
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

function expandBracketedCharacterBlocks(template: string, ctx: MacroContext): string {
  const profiles = ctx.characterProfiles ?? [];
  if (profiles.length <= 1 || !CHARACTER_MACRO_PATTERN.test(template)) {
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
    if (!CHARACTER_MACRO_PATTERN.test(block)) {
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

function encodeDeferredConditional(payload: DeferredConditionalPayload): string {
  return `${DEFERRED_CHARACTER_CONDITIONAL_TOKEN_PREFIX}${encodeURIComponent(JSON.stringify(payload))}\x1f`;
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
  if (!openingKind || quoteKind(trimmed.at(-1)) !== openingKind) return null;
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

function resolveConditionalOperand(raw: string, ctx: MacroContext): string {
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
    case "user":
    case "username":
      return ctx.user;
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
      return ctx.variables[token] ?? token;
  }
}

function isCharacterConditionalOperand(raw: string): boolean {
  const normalized = normalizeConditionKey(raw);
  return /^(char|charname|character|speaker|description|personality|backstory|appearance|scenario|example|charsysinfo|charposthistory)$/.test(
    normalized,
  );
}

function parseConditionExpression(condition: string): { left: string; operator: string; right?: string } {
  const match = condition.match(
    /^(.+?)\s*(>=|<=|>|<|==|!=|=|is\s+not|is|not\s+contains|not\s+includes|contains|includes)\s*(.+)$/i,
  );
  if (!match) return { left: condition.trim(), operator: "truthy" };
  return {
    left: match[1]?.trim() ?? "",
    operator: (match[2] ?? "").toLowerCase().replace(/\s+/g, " "),
    right: match[3]?.trim() ?? "",
  };
}

function conditionDependsOnCharacter(condition: string): boolean {
  const parsed = parseConditionExpression(condition);
  return (
    isCharacterConditionalOperand(parsed.left) || (parsed.right ? isCharacterConditionalOperand(parsed.right) : false)
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

function evaluateCondition(condition: string, ctx: MacroContext, options: ResolveMacroOptions = {}): boolean {
  const parsed = parseConditionExpression(resolveConditionMacros(condition, ctx, options));
  const left = resolveConditionalOperand(parsed.left, ctx);
  if (parsed.operator === "truthy") return left.trim().length > 0 && !/^(false|0|no|off|null|undefined)$/i.test(left);
  const right = resolveConditionalOperand(parsed.right ?? "", ctx);
  return compareConditionValues(left, parsed.operator, right);
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

function selectConditionalPayloadBranch(
  payload: DeferredConditionalPayload,
  ctx: MacroContext,
  options: ResolveMacroOptions,
): string {
  const chainBranches = (payload as ConditionalChainPayload).branches;
  const branches: ConditionalBranchPayload[] = Array.isArray(chainBranches)
    ? chainBranches
    : [
        { condition: (payload as ConditionalBlockPayload).condition, content: (payload as ConditionalBlockPayload).truthy },
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
    const writeMatch = body.match(/^(setvar|addvar)::([\w.-]+)::([\s\S]*)$/i);
    const op = String(readMatch?.[1] ?? writeMatch?.[1] ?? "").toLowerCase();
    const name = readMatch?.[2] ?? writeMatch?.[2];
    if (!op || !name) return undefined;
    if (!consumeMacroExpansion(options)) return original;

    switch (op) {
      case "getvar":
        return ctx.variables[name] ?? "";
      case "setvar":
        ctx.variables[name] = resolveMacros(writeMatch?.[3] ?? "", ctx, {
          ...nestedMacroOptions(options),
          trimResult: false,
        });
        return "";
      case "addvar":
        ctx.variables[name] =
          (ctx.variables[name] ?? "") +
          resolveMacros(writeMatch?.[3] ?? "", ctx, { ...nestedMacroOptions(options), trimResult: false });
        return "";
      case "incvar":
        ctx.variables[name] = String((parseInt(ctx.variables[name] ?? "0", 10) || 0) + 1);
        return "";
      case "decvar":
        ctx.variables[name] = String((parseInt(ctx.variables[name] ?? "0", 10) || 0) - 1);
        return "";
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

    result += resolveVariableOperationMacros(input.slice(index, blockStart), ctx, options);
    if (options.deferCharacterMacros && branchDependsOnCharacter(branches)) {
      result += encodeDeferredConditional({ branches });
    } else {
      const selected = selectConditionalPayloadBranch({ branches }, ctx, options);
      result += resolveConditionalBlocks(selected, ctx, options);
    }
    index = blockEnd.endEnd;
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

  return weightedChoices.at(-1)?.text ?? "";
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
 *  - {{characters}} — comma-separated list of all character names
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
 *  - {{incvar::name}} — increment numeric variable by 1
 *  - {{decvar::name}} — decrement numeric variable by 1
 *  - {{input}} — last user message
 *  - {{model}} — current model name
 *  - {{chatId}} — current chat ID
 *  - {{lastGenerationType}} — current generation type label
 *  - {{idle_duration}} — time since the last chat activity
 *  - {{// comment}} — removed (author comments)
 *  - {{trim}} — remove surrounding whitespace
 *  - {{trimStart}} / {{trimEnd}} — directional trim markers
 *  - {{newline}} / {{\n}} — literal newline
 *  - {{noop}} — no operation, removed
 *  - {{banned "text"}} — content filter (removed for now)
 *  - {{uppercase}}...{{/uppercase}} — convert to uppercase
 *  - {{lowercase}}...{{/lowercase}} — convert to lowercase
 *  - {{#if char == "Name"}}...{{else}}...{{/if}} — conditional block
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
    if (deferCharacterMacros === "all" || (deferCharacterMacros === "names" && field === "char")) {
      return DEFERRED_CHARACTER_MACRO_TOKENS[field];
    }
    if (field === "char") return ctx.char;
    return resolveNestedFieldMacros(ctx.characterFields?.[field] ?? "");
  };

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
  result = result.replace(/\{\{characters\}\}/gi, ctx.characters.join(", "));
  result = result.replace(/\{\{description\}\}/gi, characterReplacement("description"));
  result = result.replace(/\{\{personality\}\}/gi, characterReplacement("personality"));
  result = result.replace(/\{\{backstory\}\}/gi, characterReplacement("backstory"));
  result = result.replace(/\{\{appearance\}\}/gi, characterReplacement("appearance"));
  result = result.replace(/\{\{scenario\}\}/gi, characterReplacement("scenario"));
  result = result.replace(/\{\{example\}\}/gi, characterReplacement("example"));
  result = result.replace(/\{\{charSysInfo\}\}/gi, characterReplacement("systemPrompt"));
  result = result.replace(/\{\{charPostHistory\}\}/gi, characterReplacement("postHistoryInstructions"));
  result = result.replace(/\{\{input\}\}/gi, ctx.lastInput ?? "");
  result = result.replace(/\{\{model\}\}/gi, ctx.model ?? "");
  result = result.replace(/\{\{chatId\}\}/gi, ctx.chatId ?? "");
  result = result.replace(/\{\{lastGenerationType\}\}/gi, ctx.lastGenerationType ?? "");
  result = result.replace(/\{\{idle_duration\}\}/gi, ctx.idleDuration ?? "");

  // ── Date/time ──
  const now = new Date();
  const macroDateTime = formatMacroDateTime(now, ctx.timeZone);
  result = result.replace(/\{\{date\}\}/gi, macroDateTime.date);
  result = result.replace(/\{\{time\}\}/gi, macroDateTime.time);
  result = result.replace(/\{\{datetime\}\}/gi, macroDateTime.datetime);
  result = result.replace(/\{\{isotime\}\}/gi, macroDateTime.isoTime);
  result = result.replace(/\{\{weekday\}\}/gi, macroDateTime.weekday);
  result = result.replace(/\{\{timezone\}\}/gi, macroDateTime.timeZone);

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

  if (options.trimResult !== false) {
    result = result.trim();
  }

  return clampMacroOutput(result, options);
}
