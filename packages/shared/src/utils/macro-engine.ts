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
}

export interface SupportedMacroDefinition {
  category: string;
  syntax: string;
  description: string;
}

const CHARACTER_MACRO_PATTERN =
  /\{\{(?:char|charName|description|personality|backstory|appearance|scenario|example|charSysInfo|charPostHistory)\}\}|\{\{\s*#if\s+[^}]*\b(?:char|charName|character|speaker|description|personality|backstory|appearance|scenario|example|charSysInfo|charPostHistory)\b/i;
const MAX_CHARACTER_FIELD_RESOLUTION_DEPTH = 4;
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
};

export function stripMacroComments(template: string): string {
  return template.replace(MACRO_COMMENT_PATTERN, "");
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

function parseDeferredConditionalPayload(encoded: string): ConditionalBlockPayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<ConditionalBlockPayload>;
    if (typeof parsed.condition !== "string" || typeof parsed.truthy !== "string" || typeof parsed.falsy !== "string") {
      return null;
    }
    return { condition: parsed.condition, truthy: parsed.truthy, falsy: parsed.falsy };
  } catch {
    return null;
  }
}

function resolveDeferredCharacterConditionals(template: string, ctx: MacroContext): string {
  return template.replace(DEFERRED_CHARACTER_CONDITIONAL_TOKEN_RE, (match, encoded: string) => {
    const payload = parseDeferredConditionalPayload(encoded);
    if (!payload) return match;
    const selected = evaluateCondition(payload.condition, ctx) ? payload.truthy : payload.falsy;
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

function encodeDeferredConditional(payload: ConditionalBlockPayload): string {
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
    /^(.+?)\s*(==|!=|=|is\s+not|is|not\s+contains|not\s+includes|contains|includes)\s*(.+)$/i,
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

function compareConditionValues(left: string, operator: string, right: string): boolean {
  const leftNormalized = left.trim().toLowerCase();
  const rightNormalized = right.trim().toLowerCase();
  switch (operator) {
    case "=":
    case "==":
    case "is":
      return leftNormalized === rightNormalized;
    case "!=":
    case "is not":
      return leftNormalized !== rightNormalized;
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

function evaluateCondition(condition: string, ctx: MacroContext): boolean {
  const parsed = parseConditionExpression(condition);
  const left = resolveConditionalOperand(parsed.left, ctx);
  if (parsed.operator === "truthy") return left.trim().length > 0 && !/^(false|0|no|off|null|undefined)$/i.test(left);
  const right = resolveConditionalOperand(parsed.right ?? "", ctx);
  return compareConditionValues(left, parsed.operator, right);
}

function findConditionalStart(input: string, fromIndex: number): RegExpExecArray | null {
  const startRe = /\{\{\s*#if\s+([\s\S]*?)\s*\}\}/gi;
  startRe.lastIndex = fromIndex;
  return startRe.exec(input);
}

function findConditionalEnd(
  input: string,
  contentStart: number,
): { elseStart: number | null; elseEnd: number | null; endStart: number; endEnd: number } | null {
  const tagRe = /\{\{\s*(#if\b[\s\S]*?|else|\/if)\s*\}\}/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1;
  let elseStart: number | null = null;
  let elseEnd: number | null = null;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(input)) !== null) {
    const body = (match[1] ?? "").trim().toLowerCase();
    if (body.startsWith("#if")) {
      depth += 1;
      continue;
    }
    if (body === "/if") {
      depth -= 1;
      if (depth === 0) {
        return { elseStart, elseEnd, endStart: match.index, endEnd: tagRe.lastIndex };
      }
      continue;
    }
    if (body === "else" && depth === 1 && elseStart === null) {
      elseStart = match.index;
      elseEnd = tagRe.lastIndex;
    }
  }

  return null;
}

function resolveConditionalBlocks(input: string, ctx: MacroContext, options: ResolveMacroOptions): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const startMatch = findConditionalStart(input, index);
    if (!startMatch) {
      result += input.slice(index);
      break;
    }

    const blockStart = startMatch.index;
    const condition = (startMatch[1] ?? "").trim();
    const contentStart = startMatch.index + startMatch[0].length;
    const blockEnd = findConditionalEnd(input, contentStart);
    if (!blockEnd) {
      result += input.slice(index);
      break;
    }

    const truthy = input.slice(contentStart, blockEnd.elseStart ?? blockEnd.endStart);
    const falsy =
      blockEnd.elseStart === null ? "" : input.slice(blockEnd.elseEnd ?? blockEnd.endStart, blockEnd.endStart);

    result += input.slice(index, blockStart);
    if (options.deferCharacterMacros && conditionDependsOnCharacter(condition)) {
      result += encodeDeferredConditional({ condition, truthy, falsy });
    } else {
      const selected = evaluateCondition(condition, ctx) ? truthy : falsy;
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

function pickWeightedRandomChoice(choices: string[]): string {
  const weightedChoices = choices.map(parseWeightedRandomChoice).filter((choice) => choice.text.length > 0);
  const totalWeight = weightedChoices.reduce((total, choice) => total + choice.weight, 0);

  if (totalWeight <= 0) return "";

  let roll = Math.random() * totalWeight;
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
      timeZone:
        timeZone ??
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone ??
        "",
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
  let result = template;
  const personaText = [
    ctx.personaFields?.description,
    ctx.personaFields?.personality,
    ctx.personaFields?.backstory,
    ctx.personaFields?.appearance,
    ctx.personaFields?.scenario,
  ]
    .map((part) => (typeof part === "string" ? stripMacroComments(part) : part))
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");
  const deferCharacterMacros = options.deferCharacterMacros;
  const characterReplacement = (field: keyof typeof DEFERRED_CHARACTER_MACRO_TOKENS): string => {
    if (deferCharacterMacros === "all" || (deferCharacterMacros === "names" && field === "char")) {
      return DEFERRED_CHARACTER_MACRO_TOKENS[field];
    }
    if (field === "char") return ctx.char;
    return stripMacroComments(ctx.characterFields?.[field] ?? "");
  };

  // ── Comments — strip first so they don't interfere ──
  result = stripMacroComments(result);

  // ── Multi-character bracket blocks — expand before global substitutions ──
  result = expandBracketedCharacterBlocks(result, ctx);

  // ── Conditional blocks — choose a branch before resolving branch-local macros. ──
  result = resolveConditionalBlocks(result, ctx, options);

  // ── No-op & banned ──
  result = result.replace(/\{\{noop\}\}/gi, "");
  result = replaceBalancedMacros(result, (body) => (/^banned(?:\s+[\s\S]*)?$/i.test(body.trim()) ? "" : undefined));

  // ── Static substitutions ──
  result = result.replace(/\{\{user(?:Name)?\}\}/gi, ctx.user);
  result = result.replace(/\{\{persona\}\}/gi, personaText);
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

  // ── Agent data ──
  result = result.replace(/\{\{agent::([\w-]+)\}\}/gi, (_, type) => {
    return ctx.agentData?.[type] ?? "";
  });

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
  result = result.replace(/\{\{random\}\}/gi, () => String(Math.floor(Math.random() * 101)));
  result = replaceBalancedMacros(result, (body) => {
    const match = body.match(/^random::([\s\S]*)$/i);
    if (!match) return undefined;

    const choices = splitTopLevelDoubleColon(match[1] ?? "")
      .map((choice) => choice.trim())
      .filter(Boolean);
    if (choices.length === 0) return "";
    const choice = pickWeightedRandomChoice(choices);
    return resolveMacros(choice, ctx, { ...options, trimResult: false });
  });
  result = result.replace(/\{\{random:(\d+):(\d+)\}\}/gi, (_, min, max) => {
    const lo = parseInt(min, 10);
    const hi = parseInt(max, 10);
    return String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
  });

  // ── Dice rolls: {{roll:2d6}} ──
  result = result.replace(/\{\{roll:(\d+)d(\d+)\}\}/gi, (_, count, sides) => {
    const n = parseInt(count, 10);
    const s = parseInt(sides, 10);
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.floor(Math.random() * s) + 1;
    return String(total);
  });

  // ── Variable operations — resolve left-to-right so lorebook entries can set values for later entries. ──
  result = replaceBalancedMacros(result, (body) => {
    const readMatch = body.match(/^(getvar|incvar|decvar)::([\w.-]+)$/i);
    const writeMatch = body.match(/^(setvar|addvar)::([\w.-]+)::([\s\S]*)$/i);
    const op = String(readMatch?.[1] ?? writeMatch?.[1] ?? "").toLowerCase();
    const name = readMatch?.[2] ?? writeMatch?.[2];
    if (!op || !name) return undefined;

    switch (op) {
      case "getvar":
        return ctx.variables[name] ?? "";
      case "setvar":
        ctx.variables[name] = resolveMacros(writeMatch?.[3] ?? "", ctx, { ...options, trimResult: false });
        return "";
      case "addvar":
        ctx.variables[name] =
          (ctx.variables[name] ?? "") + resolveMacros(writeMatch?.[3] ?? "", ctx, { ...options, trimResult: false });
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

  if (options.trimResult !== false) {
    result = result.trim();
  }

  return result;
}
