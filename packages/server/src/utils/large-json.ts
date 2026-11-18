// A native export streams its gallery into one JSON file (#7115), so the file can be larger than
// the biggest string JavaScript can hold (about 512 MiB) even though every value inside it is small.

const MAX_SPLIT_DEPTH = 16;
const isWhitespace = (byte: number | undefined) => byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09;

/**
 * JSON.parse for UTF-8 bytes of any size: an object or array larger than `maxPieceBytes` is split
 * into its members, and each member is parsed on its own. Smaller input is one plain JSON.parse.
 */
export function parseJsonBytes(bytes: Buffer, maxPieceBytes = 64 * 1024 * 1024): unknown {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return parseRange(bytes, bom, bytes.length, maxPieceBytes, 0);
}

function parseRange(bytes: Buffer, start: number, end: number, maxPieceBytes: number, depth: number): unknown {
  while (start < end && isWhitespace(bytes[start])) start++;
  while (end > start && isWhitespace(bytes[end - 1])) end--;
  const open = bytes[start];
  if (end - start <= maxPieceBytes || (open !== 0x7b && open !== 0x5b)) {
    return JSON.parse(bytes.toString("utf8", start, end));
  }
  // Each level rescans its bytes once, so the depth bound keeps the work linear in the input.
  if (depth >= MAX_SPLIT_DEPTH) throw new SyntaxError("JSON is nested too deeply to read in pieces");
  if (bytes[end - 1] !== (open === 0x7b ? 0x7d : 0x5d)) throw new SyntaxError("Unexpected end of JSON input");
  let inner = start + 1;
  while (inner < end - 1 && isWhitespace(bytes[inner])) inner++;
  if (inner === end - 1) return open === 0x5b ? [] : {};

  // Members end at commas outside strings and nested values. UTF-8 multibyte sequences never
  // contain these ASCII bytes, so splitting on them is safe.
  const members: Array<[number, number]> = [];
  let level = 0;
  let inString = false;
  let memberStart = start + 1;
  for (let i = start + 1; i < end - 1; i++) {
    const byte = bytes[i];
    if (inString) {
      if (byte === 0x5c) i++;
      else if (byte === 0x22) inString = false;
    } else if (byte === 0x22) inString = true;
    else if (byte === 0x7b || byte === 0x5b) level++;
    else if (byte === 0x7d || byte === 0x5d) {
      if (--level < 0) throw new SyntaxError("Unexpected token in JSON");
    } else if (byte === 0x2c && level === 0) {
      members.push([memberStart, i]);
      memberStart = i + 1;
    }
  }
  if (inString || level !== 0) throw new SyntaxError("Unexpected end of JSON input");
  members.push([memberStart, end - 1]);

  if (open === 0x5b) return members.map(([from, to]) => parseRange(bytes, from, to, maxPieceBytes, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [from, to] of members) {
    let keyStart = from;
    while (keyStart < to && isWhitespace(bytes[keyStart])) keyStart++;
    if (bytes[keyStart] !== 0x22) throw new SyntaxError("Expected a property name in JSON");
    let keyEnd = keyStart + 1;
    for (; keyEnd < to && bytes[keyEnd] !== 0x22; keyEnd++) if (bytes[keyEnd] === 0x5c) keyEnd++;
    let colon = keyEnd + 1;
    while (colon < to && isWhitespace(bytes[colon])) colon++;
    if (colon >= to || bytes[colon] !== 0x3a) throw new SyntaxError("Expected ':' after a property name in JSON");
    const key = JSON.parse(bytes.toString("utf8", keyStart, keyEnd + 1)) as string;
    // Define, not assign, so a "__proto__" key stays plain data exactly as JSON.parse keeps it.
    Object.defineProperty(result, key, {
      value: parseRange(bytes, colon + 1, to, maxPieceBytes, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Reads a stored JSON object: an object passes through, JSON text is parsed, anything else becomes `{}`. */
export function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return isRecord(value) ? value : {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Reads a stored JSON array: an array passes through, JSON text is parsed, anything else becomes `[]`. */
export function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== "string") return Array.isArray(value) ? value : [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parses JSON text; a value that is not a string passes through, and text that is not JSON becomes `null`. */
export function parseJsonOrNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
