export type CustomParametersParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

function quoteBareObjectValues(source: string): string {
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character !== ":") continue;

    let valueStart = index + 1;
    while (/\s/u.test(source[valueStart] ?? "")) valueStart += 1;
    const first = source[valueStart];
    if (!first || first === '"' || first === "{" || first === "[") continue;

    let valueEnd = valueStart;
    while (valueEnd < source.length && source[valueEnd] !== "," && source[valueEnd] !== "}") valueEnd += 1;
    let trimmedEnd = valueEnd;
    while (trimmedEnd > valueStart && /\s/u.test(source[trimmedEnd - 1] ?? "")) trimmedEnd -= 1;
    const rawValue = source.slice(valueStart, trimmedEnd);
    if (!rawValue) continue;

    try {
      JSON.parse(rawValue);
    } catch {
      replacements.push({ start: valueStart, end: trimmedEnd, value: JSON.stringify(rawValue) });
      index = valueEnd - 1;
    }
  }

  let normalized = source;
  for (const replacement of replacements.reverse()) {
    normalized = `${normalized.slice(0, replacement.start)}${replacement.value}${normalized.slice(replacement.end)}`;
  }
  return normalized;
}

function normalizePythonLiterals(source: string): string {
  const literals = new Map([
    ["True", "true"],
    ["False", "false"],
    ["None", "null"],
  ]);
  let normalized = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (inString) {
      normalized += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      normalized += character;
      continue;
    }

    const match = [...literals].find(
      ([literal]) =>
        source.startsWith(literal, index) &&
        !/[A-Za-z0-9_$]/u.test(source[index - 1] ?? "") &&
        !/[A-Za-z0-9_$]/u.test(source[index + literal.length] ?? ""),
    );
    if (!match) {
      normalized += character;
      continue;
    }
    normalized += match[1];
    index += match[0].length - 1;
  }

  return normalized;
}

export function parseCustomParametersDraft(draft: string): CustomParametersParseResult {
  const trimmed = draft.trim();
  if (!trimmed) return { ok: true, value: {} };

  const pythonLiteralNormalized = normalizePythonLiterals(trimmed);
  const attempts = Array.from(
    new Set([
      trimmed,
      pythonLiteralNormalized,
      quoteBareObjectValues(trimmed),
      quoteBareObjectValues(pythonLiteralNormalized),
    ]),
  );

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ok: true, value: parsed as Record<string, unknown> };
      }
      return { ok: false, error: "Custom parameters must be a JSON object, not an array or scalar." };
    } catch {
      // Try the next conservative normalization.
    }
  }

  return { ok: false, error: "Invalid object. Check property quotes, commas, and nested JSON values." };
}
