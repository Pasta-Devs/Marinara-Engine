// ──────────────────────────────────────────────
// Server console: the last log lines, kept in memory
// ──────────────────────────────────────────────
// Server installs (NAS, VPS, Docker, Termux) rarely have their terminal at hand, so the
// in-app console (Settings → Advanced → Open Console) reads the recent lines from here.
// logger.ts tees every serialized Pino line in through hooks.streamWrite, so this holds
// exactly what the terminal or log file got, at the same LOG_LEVEL, with its fields.
// It never writes anywhere and is lost on restart.

/** One stored line: Pino's level number, its time and message, and the remaining fields. */
export interface ServerLogEntry {
  id: number;
  time: number;
  level: number;
  msg: string;
  /** Everything else on the line (requestId, route, err...), without pid/hostname/bootId. */
  fields?: Record<string, unknown>;
}

export interface ServerLogSnapshot {
  entries: ServerLogEntry[];
  /** Id of the newest stored line (0 when empty). Pass it back as `afterId`. */
  latestId: number;
  /** True when lines after `afterId` were dropped before this read, or `limit` cut the reply. */
  truncated: boolean;
}

export const SERVER_LOG_MAX_ENTRIES = 1_500;
/** Budget for the whole buffer, in characters, so a debug run of long prompts stays bounded. */
export const SERVER_LOG_MAX_CHARS = 4_000_000;
/** One message or one field block longer than this is cut. */
export const SERVER_LOG_MAX_PART_CHARS = 16_000;
const SNAPSHOT_MAX_LIMIT = 1_500;

/** Fields every line has and the console does not show. */
const DROPPED_FIELDS = new Set(["pid", "hostname", "bootId", "time", "level", "msg", "v"]);

const entries: ServerLogEntry[] = [];
const sizes: number[] = [];
let totalChars = 0;
let nextId = 1;

function cut(value: string): string {
  return value.length > SERVER_LOG_MAX_PART_CHARS ? `${value.slice(0, SERVER_LOG_MAX_PART_CHARS - 1)}…` : value;
}

function toEntry(line: string): { entry: ServerLogEntry; size: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    const msg = cut(line.trim());
    return msg ? { entry: { id: nextId++, time: Date.now(), level: 30, msg }, size: msg.length } : null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const msg = cut(typeof record.msg === "string" ? record.msg : "");
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) if (!DROPPED_FIELDS.has(key)) rest[key] = value;
  let fields: Record<string, unknown> | undefined;
  let size = msg.length;
  if (Object.keys(rest).length > 0) {
    const json = JSON.stringify(rest);
    // A field block over the cap (a huge error body) is kept as cut text rather than dropped.
    fields = json.length > SERVER_LOG_MAX_PART_CHARS ? { fields: cut(json) } : rest;
    size += Math.min(json.length, SERVER_LOG_MAX_PART_CHARS);
  }
  return {
    entry: {
      id: nextId++,
      time: typeof record.time === "number" ? record.time : Date.now(),
      level: typeof record.level === "number" ? record.level : 30,
      msg,
      ...(fields ? { fields } : {}),
    },
    size,
  };
}

/** Stores one serialized Pino line. Never throws: logging must not fail because of the console. */
export function recordServerLogLine(line: string): void {
  try {
    const parsed = toEntry(line);
    if (!parsed) return;
    entries.push(parsed.entry);
    sizes.push(parsed.size);
    totalChars += parsed.size;
    while (entries.length > SERVER_LOG_MAX_ENTRIES || (totalChars > SERVER_LOG_MAX_CHARS && entries.length > 1)) {
      entries.shift();
      totalChars -= sizes.shift() ?? 0;
    }
  } catch {
    // Ignore: the line still reached the terminal.
  }
}

/** Lines after `afterId`, newest last; at most `limit` of the newest when there are more. */
export function getServerLogSnapshot(afterId = 0, limit = SNAPSHOT_MAX_LIMIT): ServerLogSnapshot {
  const after = Number.isFinite(afterId) && afterId > 0 ? Math.trunc(afterId) : 0;
  const max = Math.min(
    SNAPSHOT_MAX_LIMIT,
    Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : SNAPSHOT_MAX_LIMIT),
  );
  const latestId = entries.at(-1)?.id ?? 0;
  const oldestId = entries[0]?.id ?? nextId;
  let fresh = after > 0 ? entries.filter((entry) => entry.id > after) : entries.slice();
  // The caller had seen up to `after`; anything between it and the oldest stored line was evicted.
  let truncated = after > 0 && after < oldestId - 1;
  if (fresh.length > max) {
    fresh = fresh.slice(-max);
    truncated = true;
  }
  return { entries: fresh, latestId, truncated };
}

/** Test hook: empties the buffer. */
export function clearServerLogBuffer(): void {
  entries.length = 0;
  sizes.length = 0;
  totalChars = 0;
}
