// ──────────────────────────────────────────────
// Macro Engine — {{user}}, {{char}}, {{date}}, etc.
// ──────────────────────────────────────────────

import {
  formatZonedDate,
  formatZonedIsoDateTime,
  formatZonedTime,
  getZonedWeekdayName,
} from "../time/timezone";

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
  }>;
  /** Custom variables from prompt toggle groups */
  variables: Record<string, string>;
  /** Last user input message (for {{input}}) */
  lastInput?: string;
  /** Chat ID (for {{chatId}}) */
  chatId?: string;
  /** Model name (for {{model}}) */
  model?: string;
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
  };
  /** Active persona card fields used by {{persona}} */
  personaFields?: {
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
  };
  /**
   * IANA timezone (e.g. "America/Los_Angeles") used to resolve {{date}},
   * {{time}}, {{datetime}}, {{isotime}}, and {{weekday}}. When unset, macros
   * fall back to the host machine's local timezone.
   */
  timeZone?: string;
}

export interface ResolveMacroOptions {
  trimResult?: boolean;
}

export interface SupportedMacroDefinition {
  category: string;
  syntax: string;
  description: string;
}

const CHARACTER_MACRO_PATTERN =
  /\{\{(?:char|charName|description|personality|backstory|appearance|scenario|example)\}\}|\{\{\s*#if\s+[^}]*\b(?:char|charName|character|speaker|description|personality|backstory|appearance|scenario|example)\b/i;

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
  { category: "Context", syntax: "{{input}}", description: "Most recent user message" },
  { category: "Context", syntax: "{{model}}", description: "Current model name" },
  { category: "Context", syntax: "{{chatId}}", description: "Current chat ID" },
  { category: "Context", syntax: "{{agent::TYPE}}", description: "Cached output for an agent or tracker type" },
  { category: "Time", syntax: "{{date}}", description: "Current real date in YYYY-MM-DD format" },
  { category: "Time", syntax: "{{time}}", description: "Current real time in HH:MM format" },
  { category: "Time", syntax: "{{datetime}} / {{isotime}}", description: "Current ISO timestamp" },
  { category: "Time", syntax: "{{weekday}}", description: "Current weekday name" },
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
    description: "Conditional block; supports ==, !=, contains, and straight or typographic quotes",
  },
  { category: "Formatting", syntax: "{{noop}}", description: "No-op placeholder removed from output" },
  { category: "Formatting", syntax: "{{// comment}}", description: "Inline author comment removed from output" },
  {
    category: "Formatting",
    syntax: '{{banned "text"}}',
    description: "Accepted but currently stripped from output",
  },
];

function macroContextForCharacterProfile(
  profile: NonNullable<MacroContext["characterProfiles"]>[number],
  base?: MacroContext,
): MacroContext {
  return {
    user: base?.user ?? "User",
    char: profile.name,
    characters: base?.characters ?? [profile.name],
    characterProfiles: base?.characterProfiles ?? [profile],
    variables: base?.variables ?? {},
    lastInput: base?.lastInput,
    chatId: base?.chatId,
    model: base?.model,
    agentData: base?.agentData,
    personaFields: base?.personaFields,
    timeZone: base?.timeZone,
    characterFields: {
      description: profile.description ?? "",
      personality: profile.personality ?? "",
      backstory: profile.backstory ?? "",
      appearance: profile.appearance ?? "",
      scenario: profile.scenario ?? "",
      example: profile.example ?? "",
    },
  };
}

function resolveCharacterScopedMacros(
  template: string,
  profile: NonNullable<MacroContext["characterProfiles"]>[number],
  baseContext?: MacroContext,
): string {
  const scoped = resolveConditionalBlocks(template, macroContextForCharacterProfile(profile, baseContext));
  return scoped
    .replace(/\{\{char(?:Name)?\}\}/gi, profile.name)
    .replace(/\{\{description\}\}/gi, profile.description ?? "")
    .replace(/\{\{personality\}\}/gi, profile.personality ?? "")
    .replace(/\{\{backstory\}\}/gi, profile.backstory ?? "")
    .replace(/\{\{appearance\}\}/gi, profile.appearance ?? "")
    .replace(/\{\{scenario\}\}/gi, profile.scenario ?? "")
    .replace(/\{\{example\}\}/gi, profile.example ?? "");
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
        .map((profile) => resolveCharacterScopedMacros(block, profile, ctx))
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
  if (quoted !== null) return quoted.includes("{{") ? resolveMacros(quoted, ctx, { trimResult: false }) : quoted;

  const token = raw.trim();
  if (token.includes("{{")) return resolveMacros(token, ctx, { trimResult: false });

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
    default:
      if (/^var[:.]/i.test(token)) {
        const name = token.replace(/^var[:.]/i, "").trim();
        return ctx.variables[name] ?? "";
      }
      return ctx.variables[token] ?? "";
  }
}

function parseConditionExpression(condition: string): { left: string; operator: string; right?: string } {
  const symbolicMatch = condition.match(/^(.+?)\s*(==|!=|=)\s*(.+)$/i);
  const wordMatch =
    symbolicMatch ??
    condition.match(/^(.+?)\s+(is\s+not|not\s+contains|not\s+includes|contains|includes|is)\s+(.+)$/i);
  if (!wordMatch) return { left: condition.trim(), operator: "truthy" };
  return {
    left: wordMatch[1]?.trim() ?? "",
    operator: (wordMatch[2] ?? "").toLowerCase().replace(/\s+/g, " "),
    right: wordMatch[3]?.trim() ?? "",
  };
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

function readConditionalTag(input: string, start: number): { body: string; end: number } | null {
  if (input[start] !== "{" || input[start + 1] !== "{") return null;
  const end = findBalancedMacroEnd(input, start);
  if (end === -1) return null;
  return { body: input.slice(start + 2, end - 2).trim(), end };
}

function findConditionalStart(
  input: string,
  fromIndex: number,
): { index: number; end: number; condition: string } | null {
  let start = input.indexOf("{{", fromIndex);
  while (start !== -1) {
    const tag = readConditionalTag(input, start);
    if (tag) {
      const match = tag.body.match(/^#if\b([\s\S]*)$/i);
      if (match) {
        return { index: start, end: tag.end, condition: (match[1] ?? "").trim() };
      }
      start = input.indexOf("{{", tag.end);
      continue;
    }
    start = input.indexOf("{{", start + 2);
  }

  return null;
}

function findConditionalEnd(
  input: string,
  contentStart: number,
): { elseStart: number | null; elseEnd: number | null; endStart: number; endEnd: number } | null {
  let depth = 1;
  let elseStart: number | null = null;
  let elseEnd: number | null = null;

  let start = input.indexOf("{{", contentStart);
  while (start !== -1) {
    const tag = readConditionalTag(input, start);
    if (!tag) {
      start = input.indexOf("{{", start + 2);
      continue;
    }

    const body = tag.body.toLowerCase();
    if (/^#if\b/.test(body)) {
      depth += 1;
      start = input.indexOf("{{", tag.end);
      continue;
    }
    if (body === "/if") {
      depth -= 1;
      if (depth === 0) {
        return { elseStart, elseEnd, endStart: start, endEnd: tag.end };
      }
      start = input.indexOf("{{", tag.end);
      continue;
    }
    if (body === "else" && depth === 1 && elseStart === null) {
      elseStart = start;
      elseEnd = tag.end;
    }
    start = input.indexOf("{{", tag.end);
  }

  return null;
}

function resolveConditionalBlocks(input: string, ctx: MacroContext): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const startMatch = findConditionalStart(input, index);
    if (!startMatch) {
      result += input.slice(index);
      break;
    }

    const blockStart = startMatch.index;
    const condition = startMatch.condition;
    const contentStart = startMatch.end;
    const blockEnd = findConditionalEnd(input, contentStart);
    if (!blockEnd) {
      result += input.slice(index, contentStart);
      index = contentStart;
      continue;
    }

    const truthy = input.slice(contentStart, blockEnd.elseStart ?? blockEnd.endStart);
    const falsy =
      blockEnd.elseStart === null ? "" : input.slice(blockEnd.elseEnd ?? blockEnd.endStart, blockEnd.endStart);
    const selected = evaluateCondition(condition, ctx) ? truthy : falsy;

    result += input.slice(index, blockStart);
    result += resolveConditionalBlocks(selected, ctx);
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

/**
 * Replace macros in a prompt string with their values.
 *
 * Supported macros (SillyTavern-compatible):
 *  - {{user}} — user's display name
 *  - {{persona}} — active persona description, personality, backstory, appearance, and scenario joined by new lines
 *  - {{char}} — current character name
 *  - {{characters}} — comma-separated list of all character names
 *  - {{description}} / {{personality}} / {{backstory}} / {{appearance}} / {{scenario}} / {{example}} — current character card fields
 *  - {{date}} — current real date (YYYY-MM-DD)
 *  - {{time}} — current real time (HH:MM)
 *  - {{datetime}} — full ISO datetime string
 *  - {{weekday}} — current day name (Monday, etc.)
 *  - {{isotime}} — ISO timestamp
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
 *  - {{// comment}} — removed (author comments)
 *  - {{trim}} — remove surrounding whitespace
 *  - {{trimStart}} / {{trimEnd}} — directional trim markers
 *  - {{newline}} / {{\n}} — literal newline
 *  - {{noop}} — no operation, removed
 *  - {{banned "text"}} — content filter (removed for now)
 *  - {{uppercase}}...{{/uppercase}} — convert to uppercase
 *  - {{lowercase}}...{{/lowercase}} — convert to lowercase
 *  - {{#if char == "Name"}}...{{else}}...{{/if}} - conditional block
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
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");

  // ── Comments — strip first so they don't interfere ──
  result = result.replace(/\{\{\/\/[^}]*\}\}/g, "");

  // ── Multi-character bracket blocks — expand before global substitutions ──
  result = expandBracketedCharacterBlocks(result, ctx);
  result = resolveConditionalBlocks(result, ctx);

  // ── No-op & banned ──
  result = result.replace(/\{\{noop\}\}/gi, "");
  result = result.replace(/\{\{banned\s+"[^"]*"\}\}/gi, "");

  // ── Static substitutions ──
  result = result.replace(/\{\{user(?:Name)?\}\}/gi, ctx.user);
  result = result.replace(/\{\{persona\}\}/gi, personaText);
  result = result.replace(/\{\{char(?:Name)?\}\}/gi, ctx.char);
  result = result.replace(/\{\{characters\}\}/gi, ctx.characters.join(", "));
  result = result.replace(/\{\{description\}\}/gi, ctx.characterFields?.description ?? "");
  result = result.replace(/\{\{personality\}\}/gi, ctx.characterFields?.personality ?? "");
  result = result.replace(/\{\{backstory\}\}/gi, ctx.characterFields?.backstory ?? "");
  result = result.replace(/\{\{appearance\}\}/gi, ctx.characterFields?.appearance ?? "");
  result = result.replace(/\{\{scenario\}\}/gi, ctx.characterFields?.scenario ?? "");
  result = result.replace(/\{\{example\}\}/gi, ctx.characterFields?.example ?? "");
  result = result.replace(/\{\{input\}\}/gi, ctx.lastInput ?? "");
  result = result.replace(/\{\{model\}\}/gi, ctx.model ?? "");
  result = result.replace(/\{\{chatId\}\}/gi, ctx.chatId ?? "");

  // ── Agent data ──
  result = result.replace(/\{\{agent::([\w-]+)\}\}/gi, (_, type) => {
    return ctx.agentData?.[type] ?? "";
  });

  // ── Date/time ──
  // Resolve in the caller-provided IANA timezone so prompts reflect the user's
  // local frame rather than UTC. Falls back to the host machine's local zone.
  const now = new Date();
  const tz = ctx.timeZone;
  result = result.replace(/\{\{date\}\}/gi, formatZonedDate(now, tz));
  result = result.replace(/\{\{time\}\}/gi, formatZonedTime(now, tz));
  result = result.replace(/\{\{datetime\}\}/gi, formatZonedIsoDateTime(now, tz));
  result = result.replace(/\{\{isotime\}\}/gi, formatZonedIsoDateTime(now, tz));
  result = result.replace(/\{\{weekday\}\}/gi, getZonedWeekdayName(now, tz));

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
