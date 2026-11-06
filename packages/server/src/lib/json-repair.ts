import { jsonrepair } from "jsonrepair";

function closeOpenJsonContainers(raw: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of raw) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char !== "}" && char !== "]") continue;
    const expected = char === "}" ? "{" : "[";
    if (stack.pop() !== expected) return null;
  }

  if (inString) return null;
  return (
    raw +
    stack
      .reverse()
      .map((opening) => (opening === "{" ? "}" : "]"))
      .join("")
  );
}

/**
 * Models often write dialogue in plain quotes inside a JSON string ("firstMessage": ""Hi," she says.",). When each
 * property sits on its own line, every quote between a string value's opening and closing quote belongs to the text,
 * so it is escaped. Only a `"key": "value"` line that isn't valid on its own is touched, so a valid line is never
 * merged into one value; a broken line holding several properties is split at each `, "key":` and each value is
 * escaped on its own. A split at a single-quoted or bare key (`, key: "`, as models mix them) is used only when every
 * piece is a whole `key: "value"` property, since prose such as `She said, softly: "Come here."` has that shape too.
 */
const PROPERTY_RE = /^(\s*(?:"[^"\n]+"|'[^'\n]+'|[A-Za-z_$][\w$]*)\s*:\s*")(.*)("\s*,?\s*)$/u;

/**
 * A line split at every `, key: "`, quoted or not; null when a piece isn't a whole `key: "value"` property. Dialogue
 * quotes come in pairs, so a piece whose value holds an odd number of them was cut inside dialogue
 * (`"The signs read, "Welcome", warning: "Do not enter.""`): pieces are joined back, left to right, until they make one
 * whole property, so whole properties before and after it (`"name": "x",`, `, mood: "warm"`) still split off.
 */
function anyKeyProperties(line: string): string[] | null {
  const pieces = line.split(/,(?=\s*(?:"[^"\n]+"\s*:|(?:'[^'\n]+'|[A-Za-z_$][\w$]*)\s*:\s*["']))/u);
  const whole = (piece: string) => {
    const value = piece.match(PROPERTY_RE)?.[2];
    return value !== undefined && (value.match(/(?<!\\)"/gu)?.length ?? 0) % 2 === 0;
  };
  const properties: string[] = [];
  let open: string[] = [];
  for (const piece of pieces) {
    open.push(piece);
    if (!whole(open.join(","))) continue;
    properties.push(open.join(","));
    open = [];
  }
  if (!open.length) return properties;
  // A quote left open to the end of the line (`"The sign said "Welcome.", mood: "warm"`) decides nothing about the
  // pieces after it: trailing pieces that are whole properties on their own still split off, and the rest is one value.
  // A value whose own closing quote is missing (`"description": "The lab was cold, title: "The Lab"`) gets it back.
  let head = open.length;
  while (head > 1 && whole(open[head - 1]!)) head--;
  const rest = open.slice(0, head).join(",");
  const closed = PROPERTY_RE.test(rest) ? rest : `${rest.trimEnd()}"`;
  if (head === open.length || !PROPERTY_RE.test(closed)) return null;
  return [...properties, closed, ...open.slice(head)];
}

function escapeQuotesInsideLineValues(raw: string): string {
  const validProperties = (line: string) => {
    try {
      JSON.parse(`{${line.trim().replace(/,$/u, "")}}`);
      return true;
    } catch {
      return false;
    }
  };
  const escapeValue = (property: string) =>
    property.replace(
      PROPERTY_RE,
      (_: string, open: string, value: string, close: string) => `${open}${value.replace(/(?<!\\)"/gu, '\\"')}${close}`,
    );
  const escapeLine = (line: string) =>
    (anyKeyProperties(line) ?? line.split(/,(?=\s*"[^"\n]+"\s*:)/u)).map(escapeValue).join(",");
  return raw
    .split("\n")
    .map((line) => (validProperties(line) ? line : escapeLine(line)))
    .join("\n");
}

/**
 * Every key the model wrote in `text`: quoted (`"key":`, decoded as JSON reads it), single-quoted (`'key':`) or bare
 * (`key:` at the start of a line or after `{`, or after `,` on a line made of whole properties), as models often mix
 * them. A bare `, softly:` inside dialogue is not a key.
 */
function writtenKeysIn(text: string): Set<string> {
  const keys = new Set<string>();
  for (const match of text.matchAll(/"((?:[^"\\\n]|\\.)*)"\s*:/gu)) {
    try {
      keys.add(JSON.parse(`"${match[1]}"`) as string);
    } catch {
      // Not a valid JSON string; it can't be a key jsonrepair kept either.
    }
  }
  for (const match of text.matchAll(/'((?:[^'\\\n]|\\.)*)'\s*:/gu)) keys.add(match[1]!.replace(/\\(.)/gu, "$1"));
  for (const match of text.matchAll(/(?:^|\{)\s*([A-Za-z_$][\w$]*)\s*:/gmu)) keys.add(match[1]!);
  for (const line of text.split("\n")) {
    for (const piece of anyKeyProperties(line) ?? []) {
      const bare = piece.match(/^\s*([A-Za-z_$][\w$]*)\s*:/u)?.[1];
      if (bare) keys.add(bare);
    }
  }
  return keys;
}

/** Whether every object key in `json` was written as a key in `text`, so none was made up from prose. */
function keysAreFromText(json: string, text: string): boolean {
  const keys = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.flatMap(keys)
      : value && typeof value === "object"
        ? Object.entries(value).flatMap(([key, item]) => [key, ...keys(item)])
        : [];
  try {
    const written = writtenKeysIn(text);
    return keys(JSON.parse(json)).every((key) => written.has(key));
  } catch {
    return false;
  }
}

/** Return a valid JSON string after applying the same conservative repair waterfall everywhere. */
export function repairJsonText(raw: string): string | null {
  let repaired: string | null = null;
  try {
    repaired = jsonrepair(raw);
  } catch {
    // Fall through to the conservative container-closing recovery.
  }

  // jsonrepair "repairs" dialogue quotes inside a value by cutting the text off at the first one and turning the rest
  // into a key of its own ("The librarian smiles."). Its reading is trusted only when every key in it was written as a
  // key in the model's text (quoted or not); otherwise the dialogue escape below goes first. Dialogue that itself holds `, "key": "value"`
  // (or `, key: "value"`) reads exactly like another property, so there jsonrepair's reading stands.
  const trustedRepair = repaired && keysAreFromText(repaired, raw) ? repaired : null;
  // Only lines that aren't valid on their own change, so valid JSON is never touched.
  const lineEscaped = (() => {
    const escaped = escapeQuotesInsideLineValues(raw);
    if (escaped === raw) return null;
    try {
      return jsonrepair(escaped);
    } catch {
      return escaped;
    }
  })();
  const candidates = [
    raw,
    trustedRepair,
    lineEscaped,
    repaired,
    closeOpenJsonContainers(raw),
    repaired && closeOpenJsonContainers(repaired),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try the next repair candidate.
    }
  }
  return null;
}

export function tryParseJsonRecord(raw: string): Record<string, unknown> | null {
  const repaired = repairJsonText(raw);
  if (!repaired) return null;
  const parsed = JSON.parse(repaired) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}
