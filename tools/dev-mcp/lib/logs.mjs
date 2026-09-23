// Engine log access. The server writes JSON lines to LOG_DIR/marinara-<pid>-<run>.log (see LOGGING.md and
// docs/development/logging.md). Field names follow the server's shared vocabulary: event, requestId, operationId,
// operation, stage, errorId, errorCode (older lines: code), err, elapsedMs, bootId.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOG_DIR } from "./config.mjs";

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

export function logFiles(limit = 3, dir = LOG_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^marinara-.*\.log$/.test(name))
    .map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

function* entries(files) {
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.startsWith("{")) continue;
      try {
        yield { file: file.name, ...JSON.parse(line) };
      } catch {
        /* partial last line of a file that is still being written */
      }
    }
  }
}

const errorOf = (entry) => entry.err ?? entry.error;
function errorText(entry) {
  const e = errorOf(entry);
  if (!e) return "";
  return typeof e === "object" ? String(e.message ?? "") : String(e);
}
const errorIdOf = (entry) => entry.errorId ?? entry.diagnostic?.errorId ?? null;
const errorCodeOf = (entry) => entry.errorCode ?? entry.code ?? entry.diagnostic?.code ?? null;
// `reqId` is Fastify's default name; the server's vocabulary uses `requestId`. Read both so older logs still work.
const requestIdOf = (entry) => entry.requestId ?? entry.reqId ?? null;

/** Warnings and errors since `minutes` ago, grouped by event/operation, message and error text. */
export function groupedProblems({ minutes = 60, minLevel = "warn", grep, files = 3 } = {}) {
  const since = Date.now() - minutes * 60_000;
  const floor = LEVELS[minLevel] ?? 40;
  const groups = new Map();
  for (const entry of entries(logFiles(files))) {
    if ((entry.level ?? 0) < floor || (entry.time ?? 0) < since) continue;
    const msg = String(entry.msg ?? "");
    // Prompt dumps belong in logs/prompt-debug, but older builds wrote them to the main file at warn. Not problems.
    if (/^\s*\[(SYSTEM|USER|ASSISTANT)\]/.test(msg) || msg.startsWith("[debug]") || msg.includes("Prompt (")) continue;
    const err = errorText(entry);
    const where = entry.event ?? entry.operation ?? "";
    if (grep && !`${msg} ${err} ${where} ${entry.operation ?? ""} ${errorCodeOf(entry) ?? ""}`.toLowerCase().includes(grep.toLowerCase())) {
      continue;
    }
    const key = `${entry.level}|${where}|${msg.slice(0, 120)}|${err.slice(0, 160)}`;
    const group = groups.get(key) ?? {
      level: entry.level,
      event: entry.event ?? null,
      operation: entry.operation ?? null,
      msg: msg.slice(0, 300),
      error: err.slice(0, 400),
      errorCode: errorCodeOf(entry),
      count: 0,
      firstAt: new Date(entry.time).toISOString(),
      lastAt: null,
      lastErrorId: null,
      lastRequestId: null,
    };
    group.count += 1;
    group.lastAt = new Date(entry.time).toISOString();
    group.lastErrorId = errorIdOf(entry) ?? group.lastErrorId;
    group.lastRequestId = requestIdOf(entry) ?? group.lastRequestId;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

const shape = (entry) => {
  const e = errorOf(entry);
  return {
    time: entry.time ? new Date(entry.time).toISOString() : null,
    level: entry.level,
    event: entry.event,
    operation: entry.operation,
    stage: entry.stage,
    route: entry.route,
    statusCode: entry.statusCode,
    elapsedMs: entry.elapsedMs,
    errorId: errorIdOf(entry) ?? undefined,
    errorCode: errorCodeOf(entry) ?? undefined,
    msg: String(entry.msg ?? "").slice(0, 600),
    error: errorText(entry).slice(0, 1200) || undefined,
    stack: typeof e?.stack === "string" ? e.stack.slice(0, 2000) : undefined,
    bootId: entry.bootId,
    file: entry.file,
  };
};

/**
 * Follow a reference through the logs, the way docs/development/logging.md section 12 describes:
 * 1. find lines carrying the reference (an errorId from an error toast, or a request id from the x-request-id
 *    response header);
 * 2. take the requestId from those lines, or the operationId for background work that has no request;
 * 3. return every line with that id, in time order, as the request's trail.
 */
export function lookupReference(reference, files = 10) {
  const all = [...entries(logFiles(files))];
  const hits = all.filter((entry) => {
    if (requestIdOf(entry) === reference || entry.operationId === reference || errorIdOf(entry) === reference) return true;
    return JSON.stringify(entry).includes(reference);
  });
  let requestId = null;
  let operationId = null;
  for (const entry of hits) {
    requestId ??= requestIdOf(entry);
    if (!requestIdOf(entry)) operationId ??= entry.operationId ?? null;
  }
  const trailKey = requestId ? "requestId" : operationId ? "operationId" : null;
  const trailId = requestId ?? operationId;
  const trail = trailId
    ? all
        .filter((entry) => (trailKey === "requestId" ? requestIdOf(entry) : entry.operationId) === trailId)
        .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    : [];
  const requestEnd =
    trail.find((entry) => entry.event === "request.end" || entry.event === "request.stream.end") ??
    trail.find((entry) => String(entry.event ?? "").startsWith("request.") && entry.statusCode);
  return {
    reference,
    followedBy: trailKey ? { [trailKey]: trailId } : null,
    request: requestEnd
      ? { method: requestEnd.method, route: requestEnd.route, statusCode: requestEnd.statusCode, elapsedMs: requestEnd.elapsedMs }
      : undefined,
    matches: hits.slice(0, 20).map(shape),
    trail: trail.slice(-60).map(shape),
    note: hits.length
      ? undefined
      : "not found in the newest log files; it may be older than the retained logs, or from another data folder",
  };
}

/** The newest `startup.ready` line (the summary /api/health also returns as `startup`), or null. */
export function lastStartupReady() {
  let last = null;
  for (const entry of entries(logFiles(3))) {
    if (entry.event === "startup.ready" && (!last || (entry.time ?? 0) > (last.time ?? 0))) last = entry;
  }
  return last;
}

/**
 * Seconds since the last player-facing generation, or null if none is in the recent logs. Background work
 * (continuity, llm.provider calls from agents) does not count, so it cannot block a restart forever.
 */
export function secondsSinceLastGeneration() {
  let last = 0;
  for (const entry of entries(logFiles(2))) {
    const op = String(entry.operation ?? "");
    const event = String(entry.event ?? "");
    const player =
      event.startsWith("generation.") ||
      /^POST \/api\/(generate|game\/)/.test(op) ||
      op.startsWith("/api/generate") ||
      op.includes("/game/session");
    if (player && (entry.time ?? 0) > last) last = entry.time;
  }
  return last ? Math.round((Date.now() - last) / 1000) : null;
}
