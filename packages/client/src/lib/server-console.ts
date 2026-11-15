// ──────────────────────────────────────────────
// Server console: the server's log lines, laid out like pino-pretty
//
// The server keeps its recent lines in memory (GET /api/admin/logs). This turns each one into the text the
// console shows, copies and downloads, so the three always agree. Log content is never translated.
// ──────────────────────────────────────────────

/** One line as the server sends it: Pino's level number, its time and message, and the remaining fields. */
export interface ServerLogEntry {
  id: number;
  time: number;
  level: number;
  msg: string;
  fields?: Record<string, unknown>;
}

export interface ServerLogReply {
  entries: ServerLogEntry[];
  latestId: number;
  /** Lines were missed before this read. */
  truncated: boolean;
  /** The server's LOG_LEVEL, such as "warn". */
  logLevel: string;
}

export const LEVEL_FILTERS = ["debug", "info", "warn", "error"] as const;
export type LevelFilter = (typeof LEVEL_FILTERS)[number];

const PINO_LEVELS: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

/** The filter chip a Pino level belongs to: trace and debug share one, fatal joins error. */
export function getLevelFilter(level: number): LevelFilter {
  if (level <= 20) return "debug";
  if (level <= 30) return "info";
  if (level <= 40) return "warn";
  return "error";
}

function getLevelLabel(level: number): string {
  if (level <= 10) return "TRACE";
  if (level <= 20) return "DEBUG";
  if (level <= 30) return "INFO";
  if (level <= 40) return "WARN";
  if (level <= 50) return "ERROR";
  return "FATAL";
}

/** The Pino number of a LOG_LEVEL name, or null when it is not one (such as "silent"). */
export function parseLogLevel(name: string | null | undefined): number | null {
  return PINO_LEVELS[(name ?? "").toLowerCase()] ?? null;
}

export interface ConsoleFieldText {
  key: string;
  value: string;
  multiline: boolean;
}

export interface ConsoleLine {
  kind: "line";
  /** Unique across a server restart, which starts the server's ids over. */
  key: string;
  level: number;
  filter: LevelFilter;
  timeText: string;
  label: string;
  /** A leading `[tag]` of the message, shown stronger. */
  tag: string | null;
  message: string;
  fields: ConsoleFieldText[];
  /** The same line as plain text, for copy and download. */
  text: string;
  /** `text` in lower case, for the search box. */
  searchText: string;
}

export interface ConsoleGap {
  kind: "gap";
  key: string;
}

export type ConsoleRow = ConsoleLine | ConsoleGap;

const FIELD_INDENT = "    ";
const BLOCK_INDENT = "      ";

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function formatTime(time: number): string {
  const date = new Date(time);
  return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function toFieldText(key: string, value: string): ConsoleFieldText {
  return { key, value, multiline: value.includes("\n") };
}

/** Fields in order; an error object's stack becomes its own `<key>.stack` block, with its real line breaks. */
function collectFields(fields: Record<string, unknown> | undefined): ConsoleFieldText[] {
  const result: ConsoleFieldText[] = [];
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value === undefined) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const { stack, ...rest } = value as Record<string, unknown>;
      if (typeof stack === "string") {
        if (Object.keys(rest).length > 0) result.push(toFieldText(key, stringifyValue(rest)));
        result.push(toFieldText(`${key}.stack`, stack));
        continue;
      }
    }
    result.push(toFieldText(key, stringifyValue(value)));
  }
  return result;
}

const TAG_PATTERN = /^(\[[^\]\r\n]+\])([\s\S]*)$/u;

/** One server line as a console row; `epoch` counts server restarts, so keys never repeat. */
export function toConsoleLine(entry: ServerLogEntry, epoch: number): ConsoleLine {
  const timeText = formatTime(entry.time);
  const label = getLevelLabel(entry.level);
  const tagMatch = TAG_PATTERN.exec(entry.msg);
  const fields = collectFields(entry.fields);
  const lines = [`[${timeText}] ${label.padEnd(5)} ${entry.msg}`];
  for (const field of fields) {
    if (!field.multiline) {
      lines.push(`${FIELD_INDENT}${field.key}: ${field.value}`);
      continue;
    }
    lines.push(`${FIELD_INDENT}${field.key}:`);
    for (const line of field.value.split("\n")) lines.push(`${BLOCK_INDENT}${line}`);
  }
  const text = lines.join("\n");
  return {
    kind: "line",
    key: `${epoch}-${entry.id}`,
    level: entry.level,
    filter: getLevelFilter(entry.level),
    timeText,
    label,
    tag: tagMatch ? tagMatch[1]! : null,
    message: tagMatch ? tagMatch[2]! : entry.msg,
    fields,
    text,
    searchText: text.toLowerCase(),
  };
}
