#!/usr/bin/env node
// Where do two consecutive provider requests stop sharing a prefix?
//
// Reads a server log written with Debug mode on and compares each "[debug/openai] responses
// request body" with the one before it, in the order a provider caches them: tools, then
// instructions, then input. Prints the first difference with its approximate token offset.
//
//   node scripts/eval/diff-request-bodies.mjs <server.log> [--last 6]
import { readFile } from "node:fs/promises";

const [logPath, ...rest] = process.argv.slice(2);
if (!logPath) {
  console.error("usage: node scripts/eval/diff-request-bodies.mjs <server.log> [--last N]");
  process.exit(2);
}
const last = Number(rest[rest.indexOf("--last") + 1]) || 6;
const marker = "[debug/openai] responses request body: ";
const bodies = [];
for (const raw of (await readFile(logPath, "utf8")).split("\n")) {
  // A JSON log line carries the message in its msg field; a pretty one carries it as is.
  let line = raw;
  if (raw.startsWith("{")) {
    try {
      line = String(JSON.parse(raw).msg ?? "");
    } catch {
      // Not a JSON log line after all.
    }
  }
  const at = line.indexOf(marker);
  if (at < 0) continue;
  try {
    bodies.push(JSON.parse(line.slice(at + marker.length)));
  } catch {
    // A log line cut short by the logger; skip it.
  }
}
if (bodies.length < 2) {
  console.error(`found ${bodies.length} request bodies; turn Debug mode on and play two turns`);
  process.exit(1);
}

// The cached prefix as one string, in cache order, and where each part starts.
function prefixText(body) {
  const parts = [
    ["tools", JSON.stringify(body.tools ?? [])],
    ["instructions", String(body.instructions ?? "")],
    ["input", JSON.stringify(body.input ?? [])],
  ];
  let text = "";
  const starts = [];
  for (const [name, value] of parts) {
    starts.push([name, text.length]);
    text += value;
  }
  return { text, starts };
}

const recent = bodies.slice(-last);
for (let i = 1; i < recent.length; i++) {
  const a = prefixText(recent[i - 1]);
  const b = prefixText(recent[i]);
  let n = 0;
  while (n < a.text.length && n < b.text.length && a.text[n] === b.text[n]) n++;
  const part = [...b.starts].reverse().find(([, start]) => start <= n)?.[0];
  const same = n === a.text.length && n === b.text.length;
  console.log(
    `\nrequest ${bodies.length - recent.length + i} vs ${bodies.length - recent.length + i + 1}: model=${recent[i].model} key=${recent[i].prompt_cache_key ?? "none"} tools=${(recent[i].tools ?? []).length}`,
  );
  if (same) {
    console.log("  identical");
    continue;
  }
  console.log(`  shared prefix: ${n} chars (~${Math.round(n / 4)} tokens), first difference in ${part}`);
  console.log(`  before: ${JSON.stringify(a.text.slice(Math.max(0, n - 120), n + 160))}`);
  console.log(`  after:  ${JSON.stringify(b.text.slice(Math.max(0, n - 120), n + 160))}`);
}
