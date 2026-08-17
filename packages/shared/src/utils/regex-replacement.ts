type RegexReplaceMatch = {
  match: string;
  captures: string[];
  offset: number;
  input: string;
  groups?: Record<string, string>;
};

type CaseMode = "none" | "upper" | "lower";
type OneShotCaseMode = "upper-first" | "lower-first" | null;
const CASE_COMMANDS = new Set(["U", "L", "E", "u", "l"]);
const LITERAL_PLACEHOLDER_PREFIX = "\x1eMARINARA_REGEX_LITERAL_";

type PreparedLiteralMacros = {
  template: string;
  literals: Array<{ token: string; value: string }>;
};

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
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

function replaceBalancedMacros(input: string, replacer: (original: string) => string | undefined): string {
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
    const replacement = replacer(original);
    result += replacement ?? original;
    index = end;
  }

  return result;
}

function prepareLiteralMacroPlaceholders(
  value: string,
  resolveLiteral?: (literal: string) => string,
): PreparedLiteralMacros {
  if (!resolveLiteral || !value.includes("{{")) return { template: value, literals: [] };

  const literals: PreparedLiteralMacros["literals"] = [];
  const template = replaceBalancedMacros(value, (original) => {
    const token = `${LITERAL_PLACEHOLDER_PREFIX}${literals.length}\x1f`;
    literals.push({ token, value: resolveLiteral(original) });
    return token;
  });

  return { template, literals };
}

function restoreLiteralMacroPlaceholders(value: string, literals: PreparedLiteralMacros["literals"]): string {
  let result = value;
  for (const literal of literals) {
    result = result.split(literal.token).join(literal.value);
  }
  return result;
}

function readCapture(captures: string[], index: number): string | null {
  if (index < 1 || index > captures.length) return null;
  return captures[index - 1] ?? "";
}

function applyCase(
  value: string,
  mode: CaseMode,
  oneShot: OneShotCaseMode,
): { value: string; oneShot: OneShotCaseMode } {
  let result = mode === "upper" ? value.toUpperCase() : mode === "lower" ? value.toLowerCase() : value;
  if (oneShot && result.length > 0) {
    result =
      oneShot === "upper-first"
        ? result.charAt(0).toUpperCase() + result.slice(1)
        : result.charAt(0).toLowerCase() + result.slice(1);
    return { value: result, oneShot: null };
  }
  return { value: result, oneShot };
}

function expandRegexReplacementToken(replacement: string, index: number, ctx: RegexReplaceMatch) {
  const next = replacement[index + 1];
  if (!next) return { value: "$", nextIndex: index + 1 };

  if (next === "$") return { value: "$", nextIndex: index + 2 };
  if (next === "&") return { value: ctx.match, nextIndex: index + 2 };
  if (next === "`") return { value: ctx.input.slice(0, ctx.offset), nextIndex: index + 2 };
  if (next === "'") return { value: ctx.input.slice(ctx.offset + ctx.match.length), nextIndex: index + 2 };

  if (next === "<") {
    const closeIndex = replacement.indexOf(">", index + 2);
    if (closeIndex !== -1) {
      const name = replacement.slice(index + 2, closeIndex);
      if (ctx.groups && Object.prototype.hasOwnProperty.call(ctx.groups, name)) {
        return { value: ctx.groups[name] ?? "", nextIndex: closeIndex + 1 };
      }
      if (ctx.groups) {
        return { value: "", nextIndex: closeIndex + 1 };
      }
    }
    return { value: "$", nextIndex: index + 1 };
  }

  if (/\d/.test(next)) {
    const twoDigit = replacement.slice(index + 1, index + 3);
    if (/^\d{2}$/.test(twoDigit)) {
      const twoDigitValue = readCapture(ctx.captures, Number(twoDigit));
      if (twoDigitValue !== null) return { value: twoDigitValue, nextIndex: index + 3 };
    }

    const oneDigitValue = readCapture(ctx.captures, Number(next));
    if (oneDigitValue !== null) return { value: oneDigitValue, nextIndex: index + 2 };
  }

  return { value: "$", nextIndex: index + 1 };
}

export function expandRegexReplacement(replacement: string, ctx: RegexReplaceMatch): string {
  let result = "";
  let index = 0;
  let caseMode: CaseMode = "none";
  let oneShotCaseMode: OneShotCaseMode = null;

  const append = (value: string) => {
    const transformed = applyCase(value, caseMode, oneShotCaseMode);
    result += transformed.value;
    oneShotCaseMode = transformed.oneShot;
  };

  const startsCommandArgument = (command: string) => {
    const afterCommand = replacement[index + 2];
    if (command === "E") return caseMode !== "none" || oneShotCaseMode !== null;
    return afterCommand === "$" || afterCommand === "\\";
  };

  while (index < replacement.length) {
    const char = replacement[index];

    if (char === "\\") {
      const next = replacement[index + 1];
      const escapedCommand = next === "\\" ? replacement[index + 2] : undefined;
      if (escapedCommand && CASE_COMMANDS.has(escapedCommand)) {
        append(`\\${escapedCommand}`);
        index += 3;
        continue;
      }
      if (next === "U" && startsCommandArgument("U")) {
        caseMode = "upper";
        index += 2;
        continue;
      }
      if (next === "L" && startsCommandArgument("L")) {
        caseMode = "lower";
        index += 2;
        continue;
      }
      if (next === "E" && startsCommandArgument("E")) {
        caseMode = "none";
        index += 2;
        continue;
      }
      if (next === "u" && startsCommandArgument("u")) {
        oneShotCaseMode = "upper-first";
        index += 2;
        continue;
      }
      if (next === "l" && startsCommandArgument("l")) {
        oneShotCaseMode = "lower-first";
        index += 2;
        continue;
      }
    }

    if (char === "$") {
      const token = expandRegexReplacementToken(replacement, index, ctx);
      append(token.value);
      index = token.nextIndex;
      continue;
    }

    append(char ?? "");
    index += 1;
  }

  return result;
}

export function resolveRegexPatternLiteralMacros(
  pattern: string,
  resolveLiteral?: (literal: string) => string,
): string {
  if (!resolveLiteral || !pattern.includes("{{")) return pattern;
  return replaceBalancedMacros(pattern, (original) => escapeRegExpLiteral(resolveLiteral(original)));
}

export function applyRegexReplacement(
  text: string,
  regex: RegExp,
  replacement: string,
  resolveReplacement?: (replacement: string) => string,
): string {
  const preparedReplacement = prepareLiteralMacroPlaceholders(replacement, resolveReplacement);
  return text.replace(regex, (...args: unknown[]) => {
    const lastArg = args[args.length - 1];
    const hasGroups = typeof lastArg === "object" && lastArg !== null;
    const groups = hasGroups ? (lastArg as Record<string, string>) : undefined;
    const input = args[args.length - (hasGroups ? 2 : 1)] as string;
    const offset = args[args.length - (hasGroups ? 3 : 2)] as number;
    const match = args[0] as string;
    const captures = args.slice(1, hasGroups ? -3 : -2).map((capture) => (capture == null ? "" : String(capture)));
    const expanded = expandRegexReplacement(preparedReplacement.template, {
      match,
      captures,
      offset,
      input,
      groups,
    });
    return restoreLiteralMacroPlaceholders(expanded, preparedReplacement.literals);
  });
}
