import {
  IMAGE_TAG_CATEGORIES,
  IMAGE_TAG_LIMITS,
  type ImageTagCategory,
  type ImageTagImportIssue,
  type ImageTagImportReport,
  type ImageTagRecord,
} from "@marinara-engine/shared";

type ParseOptions = {
  category?: ImageTagCategory;
  maxRecords?: number;
};

type CsvRecord = {
  row: number;
  cells: string[];
};

type Shape = 3 | 4;

type RowResult = { record: ImageTagRecord } | { issue: ImageTagImportIssue["code"] };

const NAME_HEADERS = new Set(["name", "tag_name"]);
const CATEGORY_HEADERS = new Set(["category", "category_id"]);
const COUNT_HEADERS = new Set(["post_count", "count"]);
const ALIAS_HEADERS = new Set(["aliases"]);
const CATEGORY_BY_TEXT = new Map<string, ImageTagCategory>(
  IMAGE_TAG_CATEGORIES.map((category): [string, ImageTagCategory] => [String(category), category]),
);
const DIGITS = /^\d+$/;

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) {
      return true;
    }
  }
  return false;
}

function resolveOptions(options: ParseOptions): { category?: ImageTagCategory; maxRecords: number } {
  if (options.category !== undefined && !IMAGE_TAG_CATEGORIES.includes(options.category)) {
    throw new Error(`Invalid image tag category: ${String(options.category)}`);
  }

  const hardCap = IMAGE_TAG_LIMITS.recordsPerSource;
  if (options.maxRecords !== undefined) {
    if (!Number.isSafeInteger(options.maxRecords) || options.maxRecords < 1) {
      throw new Error(`Invalid maxRecords: ${String(options.maxRecords)}`);
    }
    if (options.maxRecords > hardCap) {
      throw new Error(`maxRecords cannot exceed the hard cap of ${hardCap}`);
    }
  }

  return { category: options.category, maxRecords: options.maxRecords ?? hardCap };
}

/**
 * Strict RFC 4180-style reader. It never guesses where a malformed record ends: an unmatched quote, a quote in an
 * unquoted field, or a non-delimiter after a closing quote fails the whole import.
 */
function* parseCsv(text: string): Generator<CsvRecord> {
  let cells: string[] = [];
  let field = "";
  let fieldStarted = false;
  let recordStarted = false;
  let inQuotes = false;
  let afterQuote = false;
  let row = 1;
  let index = 0;
  // Retain an overlong sentinel for row validation without growing a rope to the upload size.
  const maxField = IMAGE_TAG_LIMITS.aliasesPerRecord * (IMAGE_TAG_LIMITS.fieldCharacters + 1) + 1;
  const append = (value: string) => {
    if (field.length < maxField) field += value;
  };

  const finishField = () => {
    // Keep only enough columns to recognize an invalid row, even for comma-heavy uploads.
    if (cells.length < 5) cells.push(field.trim());
    field = "";
    fieldStarted = false;
    afterQuote = false;
  };

  const finishRecord = () => {
    finishField();
    const record = { row, cells };
    cells = [];
    row += 1;
    recordStarted = false;
    return record;
  };

  while (index < text.length) {
    const character = text.charAt(index);

    if (inQuotes) {
      if (character === '"') {
        if (text.charAt(index + 1) === '"') {
          append('"');
          index += 2;
          continue;
        }
        inQuotes = false;
        afterQuote = true;
        index += 1;
        continue;
      }
      if (character === "\r" && text.charAt(index + 1) === "\n") {
        append("\n");
        index += 2;
        continue;
      }
      append(character);
      index += 1;
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        finishField();
        recordStarted = true;
        index += 1;
        continue;
      }
      if (character === "\n" || (character === "\r" && text.charAt(index + 1) === "\n")) {
        yield finishRecord();
        index += character === "\r" ? 2 : 1;
        continue;
      }
      throw new Error(`Malformed CSV: unexpected character after a closing quote in record ${row}`);
    }

    if (character === ",") {
      finishField();
      recordStarted = true;
      index += 1;
      continue;
    }

    if (character === "\n" || (character === "\r" && text.charAt(index + 1) === "\n")) {
      yield finishRecord();
      index += character === "\r" ? 2 : 1;
      continue;
    }

    if (character === '"') {
      if (!fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
        recordStarted = true;
        index += 1;
        continue;
      }
      throw new Error(`Malformed CSV: unquoted quote in record ${row}`);
    }

    append(character);
    fieldStarted = true;
    recordStarted = true;
    index += 1;
  }

  if (inQuotes) throw new Error(`Malformed CSV: unmatched quote in record ${row}`);
  if (afterQuote || fieldStarted || recordStarted || cells.length > 0) yield finishRecord();
}

function isBlank(cells: string[]): boolean {
  return cells.every((cell) => cell.trim().length === 0);
}

function detectHeader(cells: string[]): Shape | null {
  const values = cells.map((cell) => cell.trim().toLowerCase());
  const first = values[0] ?? "";
  const second = values[1] ?? "";
  const third = values[2] ?? "";
  const fourth = values[3] ?? "";

  if (
    values.length === 4 &&
    NAME_HEADERS.has(first) &&
    CATEGORY_HEADERS.has(second) &&
    COUNT_HEADERS.has(third) &&
    ALIAS_HEADERS.has(fourth)
  ) {
    return 4;
  }

  if (values.length === 3 && NAME_HEADERS.has(first) && COUNT_HEADERS.has(second) && ALIAS_HEADERS.has(third)) {
    return 3;
  }

  return null;
}

function parsePostCount(raw: string): number | undefined {
  const value = raw.trim();
  if (!DIGITS.test(value)) return undefined;

  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

function parseAliases(raw: string): string[] | undefined {
  if (raw.length > IMAGE_TAG_LIMITS.aliasesPerRecord * (IMAGE_TAG_LIMITS.fieldCharacters + 1)) return undefined;
  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(",")) {
    const alias = part.trim();
    if (alias.length === 0) continue;
    if (alias.length > IMAGE_TAG_LIMITS.fieldCharacters || hasControlCharacters(alias)) {
      return undefined;
    }
    if (!seen.has(alias)) {
      seen.add(alias);
      aliases.push(alias);
    }
  }

  return aliases.length > IMAGE_TAG_LIMITS.aliasesPerRecord ? undefined : aliases;
}

function parseRow(cells: string[], shape: Shape, fixedCategory: ImageTagCategory | undefined): RowResult {
  if (cells.length !== shape) return { issue: "invalid_columns" };

  const name = (cells[0] ?? "").trim();
  if (name.length === 0 || name.length > IMAGE_TAG_LIMITS.fieldCharacters || hasControlCharacters(name)) {
    return { issue: "invalid_name" };
  }

  const category = shape === 4 ? CATEGORY_BY_TEXT.get((cells[1] ?? "").trim()) : fixedCategory;
  if (category === undefined) return { issue: "invalid_category" };

  const countRaw = shape === 4 ? (cells[2] ?? "") : (cells[1] ?? "");
  const aliasesRaw = shape === 4 ? (cells[3] ?? "") : (cells[2] ?? "");

  const postCount = parsePostCount(countRaw);
  if (postCount === undefined) return { issue: "invalid_count" };

  const aliases = parseAliases(aliasesRaw);
  if (aliases === undefined) return { issue: "invalid_aliases" };

  return { record: { name, category, postCount, aliases } };
}

export function parseImageTagCsv(
  text: string,
  options: ParseOptions = {},
): { records: ImageTagRecord[]; report: ImageTagImportReport } {
  const { category: fixedCategory, maxRecords } = resolveOptions(options);

  if (Buffer.byteLength(text, "utf8") > IMAGE_TAG_LIMITS.uploadBytes) {
    throw new Error(`Image tag CSV exceeds the ${IMAGE_TAG_LIMITS.uploadBytes}-byte upload limit`);
  }

  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const csvRecords = parseCsv(source);
  const records: ImageTagRecord[] = [];
  const seen = new Set<string>();

  const report: ImageTagImportReport = {
    // Every parsed CSV record is counted here; the row counters below partition this total.
    totalRows: 0,
    acceptedRows: 0,
    blankRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    headerRows: 0,
    issues: [],
    omittedIssues: 0,
  };

  const addIssue = (row: number, code: ImageTagImportIssue["code"]) => {
    if (report.issues.length < IMAGE_TAG_LIMITS.issueExamples) {
      report.issues.push({ row, code });
    } else {
      report.omittedIssues += 1;
    }
  };

  let shape: Shape | undefined;
  for (const record of csvRecords) {
    report.totalRows += 1;
    if (isBlank(record.cells)) {
      report.blankRows += 1;
      continue;
    }
    // Match the entire first nonblank record, never a literal tag such as "name".
    if (shape === undefined) {
      const header = detectHeader(record.cells);
      shape = header ?? (record.cells.length === 3 ? 3 : 4);
      if (shape === 3 && fixedCategory === undefined) {
        throw new Error("Three-column image tag CSV requires an explicit category option");
      }
      if (header !== null) {
        report.headerRows = 1;
        continue;
      }
    }

    const parsed = parseRow(record.cells, shape, fixedCategory);
    if ("issue" in parsed) {
      report.invalidRows += 1;
      addIssue(record.row, parsed.issue);
      continue;
    }

    const key = `${parsed.record.category}\u0000${parsed.record.name}`;
    if (seen.has(key)) {
      report.duplicateRows += 1;
      addIssue(record.row, "duplicate");
      continue;
    }

    if (records.length >= maxRecords) {
      throw new Error(`Image tag CSV exceeds the maximum of ${maxRecords} records`);
    }

    seen.add(key);
    records.push(parsed.record);
    report.acceptedRows += 1;
  }

  if (records.length === 0) throw new Error("Image tag CSV contains no accepted rows");

  return { records, report };
}

export function normalizeImageTagQuery(value: string): string {
  return value
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLowerCase();
}
