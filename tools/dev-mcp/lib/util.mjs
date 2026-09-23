// Output bounding, JSON helpers, activity log.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIVITY_FILE, AGENT, OUT_DIR } from "./config.mjs";

export const parse = (value) => {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tool result text, capped. Anything longer is written in full to a file and the path is returned with a preview,
 * so a client never has its context flooded but can still read the whole thing.
 */
export function out(value, maxChars = 20_000, label = "result") {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return { content: [{ type: "text", text }] };
  const file = join(OUT_DIR, `${label}-${stamp()}.${typeof value === "string" ? "txt" : "json"}`);
  writeFileSync(file, text, "utf8");
  return {
    content: [
      {
        type: "text",
        text: `${text.slice(0, maxChars)}\n\n[truncated: ${text.length} chars total; full output saved to ${file}]`,
      },
    ],
  };
}

export const fail = (message) => ({ content: [{ type: "text", text: `ERROR: ${message}` }], isError: true });

/** Wrap a tool handler so thrown errors come back as tool errors instead of crashing the server. */
export const safe = (handler) => async (args) => {
  try {
    return await handler(args ?? {});
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
};

/**
 * Activity log: every write, build and restart made through this server lands here with the agent name, so when
 * several agents (or several people) share one engine, nobody is surprised by someone else's change.
 */
export function record(action, details = {}) {
  const entry = { at: new Date().toISOString(), agent: AGENT, action, ...details };
  appendFileSync(ACTIVITY_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export function readActivity(limit = 30, filter) {
  if (!existsSync(ACTIVITY_FILE)) return [];
  const rows = readFileSync(ACTIVITY_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => parse(line))
    .filter((row) => row && typeof row === "object");
  const matched = filter
    ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()))
    : rows;
  return matched.slice(-limit);
}

export const trimText = (text, max) => {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max)}... [+${value.length - max} chars]` : value;
};
