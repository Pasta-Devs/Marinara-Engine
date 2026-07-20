function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json|markdown)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
}

function findJsonRegionEnd(raw: string, start: number): number | null {
  let inString = false;
  let escaped = false;
  const closers: string[] = [];

  for (let i = start; i < raw.length; i++) {
    const char = raw[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      closers.push("}");
      continue;
    }
    if (char === "[") {
      closers.push("]");
      continue;
    }
    if (char === "}" || char === "]") {
      if (closers.at(-1) !== char) return null;
      closers.pop();
      if (closers.length === 0) return i + 1;
    }
  }

  return null;
}

function extractRepairCandidate(raw: string): string {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) return raw.trim();

  const start = Math.min(...starts);
  const end = findJsonRegionEnd(raw, start);
  return raw.slice(start, end ?? undefined).trim();
}

function collectBalancedJsonRegions(raw: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  const stack: Array<{ start: number; closer: "}" | "]" }> = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]!;
    if (stack.length === 0) {
      if (char === "{") stack.push({ start: index, closer: "}" });
      else if (char === "[") stack.push({ start: index, closer: "]" });
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      stack.push({ start: index, closer: "}" });
      continue;
    }
    if (char === "[") {
      stack.push({ start: index, closer: "]" });
      continue;
    }
    if (char !== "}" && char !== "]") continue;
    if (stack.at(-1)?.closer !== char) {
      stack.length = 0;
      inString = false;
      escaped = false;
      continue;
    }
    const opened = stack.pop()!;
    regions.push({ start: opened.start, end: index + 1 });
  }

  return regions;
}

/** Return top-level balanced JSON regions in source order, excluding nested regions. */
function collectIndependentJsonRegions(raw: string): Array<{ start: number; end: number }> {
  const regions = collectBalancedJsonRegions(raw).sort(
    (left, right) => left.start - right.start || right.end - left.end,
  );
  const independentRegions: Array<{ start: number; end: number }> = [];
  let enclosingEnd = -1;
  for (const region of regions) {
    if (region.end <= enclosingEnd) continue;
    independentRegions.push(region);
    enclosingEnd = region.end;
  }
  return independentRegions;
}

function parseEmbeddedJson(raw: string): unknown | undefined {
  const independentRegions = collectIndependentJsonRegions(raw);
  independentRegions.sort((left, right) => right.start - left.start);
  for (const region of independentRegions) {
    try {
      return unwrapJsonString(JSON.parse(raw.slice(region.start, region.end)));
    } catch {
      // This balanced brace region was not valid JSON; an earlier independent region may be.
    }
  }
  return undefined;
}

function extractJsonishCandidate(raw: string): string {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) return raw.trim();
  return raw.slice(Math.min(...starts)).trim();
}

function scanJsonishStructure(raw: string): {
  started: boolean;
  mismatched: boolean;
  inString: boolean;
  escaped: boolean;
  closers: string[];
} {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : -1;
  if (start === -1) {
    return { started: false, mismatched: false, inString: false, escaped: false, closers: [] };
  }

  let inString = false;
  let escaped = false;
  let mismatched = false;
  const closers: string[] = [];

  for (let i = start; i < raw.length; i++) {
    const char = raw[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      closers.push("}");
      continue;
    }
    if (char === "[") {
      closers.push("]");
      continue;
    }
    if (char === "}" || char === "]") {
      if (closers.at(-1) === char) {
        closers.pop();
      } else {
        mismatched = true;
      }
    }
  }

  return { started: true, mismatched, inString, escaped, closers };
}

function sanitizeControlCharsInStrings(raw: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }
    if (inString) {
      const code = char.charCodeAt(0);
      if (code < 0x20) {
        if (char === "\n") output += "\\n";
        else if (char === "\r") output += "\\r";
        else if (char === "\t") output += "\\t";
        else output += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    output += char;
  }

  return output;
}

function stripCommentsOutsideStrings(raw: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    const next = raw[i + 1];
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }
    if (!inString && char === "/" && next === "/") {
      while (i < raw.length && raw[i] !== "\n") i += 1;
      output += "\n";
      continue;
    }
    if (!inString && char === "/" && next === "*") {
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    output += char;
  }

  return output;
}

function insertMissingPropertyCommas(raw: string): string {
  return raw.replace(/(["}\]])(\s*\n\s*)("[$A-Za-z_][^"\n]{0,120}"\s*:)/g, "$1,$2$3");
}

function removeTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, "$1");
}

function closeUnbalancedJsonish(raw: string): string {
  const scan = scanJsonishStructure(raw);
  if (!scan.started || scan.mismatched || (!scan.inString && scan.closers.length === 0)) return raw;

  let output = raw.trimEnd();
  if (scan.escaped) output += "\\";
  if (scan.inString) output += '"';
  output = output.replace(/,\s*$/, "");
  return `${output}${scan.closers.reverse().join("")}`;
}

function repairJsonish(raw: string): string {
  const sanitized = sanitizeControlCharsInStrings(raw);
  const uncommented = stripCommentsOutsideStrings(sanitized);
  const commaRepaired = insertMissingPropertyCommas(uncommented);
  return closeUnbalancedJsonish(removeTrailingCommas(commaRepaired));
}

function unwrapJsonString(value: unknown): unknown {
  let next = value;
  for (let depth = 0; depth < 2 && typeof next === "string"; depth++) {
    const nested = stripFences(next.trim());
    if (!nested.startsWith("{") && !nested.startsWith("[")) break;

    try {
      next = JSON.parse(nested);
    } catch {
      break;
    }
  }
  return next;
}

export function parseGameJsonish(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return unwrapJsonString(JSON.parse(trimmed));
  } catch {
    // Continue through the increasingly tolerant parse path below.
  }

  const unfenced = stripFences(trimmed);
  try {
    return unwrapJsonString(JSON.parse(unfenced.trim()));
  } catch {
    // Continue.
  }

  const embedded = parseEmbeddedJson(unfenced);
  if (embedded !== undefined) return embedded;

  const candidate = extractRepairCandidate(unfenced);
  try {
    return unwrapJsonString(JSON.parse(repairJsonish(candidate)));
  } catch {
    return unwrapJsonString(JSON.parse(candidate));
  }
}

/**
 * Parse every independent JSON-ish value emitted in one model response. Some
 * local models serialize a requested object as adjacent collection fragments
 * instead of one enclosing object. Callers that support fragment merging can
 * use this without changing the single-value behavior of parseGameJsonish.
 */
export function parseGameJsonishSequence(raw: string): unknown[] {
  const unfenced = stripFences(raw.trim());
  const regions = collectIndependentJsonRegions(unfenced);
  if (regions.length <= 1) return [parseGameJsonish(raw)];

  const parsed: unknown[] = [];
  for (const region of regions) {
    try {
      parsed.push(parseGameJsonish(unfenced.slice(region.start, region.end)));
    } catch {
      // Keep other complete fragments usable. If every fragment fails, the
      // normal parser below retains its existing error and repair behavior.
    }
  }
  return parsed.length > 0 ? parsed : [parseGameJsonish(raw)];
}

export function jsonishLooksTruncated(raw: string): boolean {
  const candidate = extractJsonishCandidate(stripFences(raw.trim()));
  const scan = scanJsonishStructure(candidate);
  return scan.started && !scan.mismatched && (scan.inString || scan.escaped || scan.closers.length > 0);
}
