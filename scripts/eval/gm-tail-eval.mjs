#!/usr/bin/env node
// GM turn-tail caching eval: plays the same saved game turns under each reminder layout and model,
// scores every reply, and measures cached prompt tokens across consecutive turns.
//
// It drives a running Engine over HTTP, so the prompt is the real one: start the server with
//   MARINARA_GM_TAIL_EVAL_DIR=<dir>   (the server writes each turn's prompt, reply and usage there)
// then run
//   node scripts/eval/gm-tail-eval.mjs --config <config.json>
//
// config.json:
// {
//   "baseUrl": "http://127.0.0.1:7991",
//   "recordDir": "<the same dir as MARINARA_GM_TAIL_EVAL_DIR>",
//   "outDir": "<where results go>",
//   "chatId": "<a saved game chat to branch from>",
//   "connectionId": "<connection whose model is switched per model>",
//   "models": ["gemini-2.5-flash", "claude-haiku-5-5"],
//   "layouts": ["legacy", "split", "split-history"],
//   "repeats": 3,
//   "concurrency": 2,
//   "partyNames": ["Aldric", "Kesh", "Vyre", "Mara"],
//   "scenarios": "scripts/eval/gm-tail-scenarios.json",
//   "probeTurns": ["...", "...", "..."],
//   "restoreModel": "claude-opus-5-5"
// }
//
// Every run branches the saved chat, so the saved game itself is never changed; branches are
// deleted afterwards. The connection's model is switched for each model and put back at the end.
import { readFile, readdir, writeFile, mkdir, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { scoreReply } from "./gm-tail-score.mjs";

const args = process.argv.slice(2);
const configPath = args[args.indexOf("--config") + 1];
if (!configPath || !args.includes("--config")) {
  console.error("usage: node scripts/eval/gm-tail-eval.mjs --config <config.json> [--only-probe] [--no-probe]");
  process.exit(2);
}
const config = JSON.parse(await readFile(configPath, "utf8"));
const base = config.baseUrl.replace(/\/$/, "");
const outDir = resolve(config.outDir);
await mkdir(outDir, { recursive: true });
const scenarios = JSON.parse(fill(await readFile(resolve(config.scenarios), "utf8")));
const resultsFile = join(outDir, "results.jsonl");

function fill(text) {
  return (config.partyNames ?? []).reduce((acc, name, i) => acc.replaceAll(`{party${i}}`, name), text);
}

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? { origin: base } : { "content-type": "application/json", origin: base },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function records(chatId) {
  const names = (await readdir(config.recordDir)).filter((name) => name.endsWith(`-${chatId}.json`)).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(config.recordDir, name), "utf8"))));
}

/** One player turn on a chat; returns the first provider call's record. */
async function playTurn(chatId, input) {
  const before = (await records(chatId)).length;
  const started = Date.now();
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      chatId,
      userMessage: input,
      connectionId: config.connectionId,
      streaming: config.streaming ?? true,
    }),
  });
  const body = await response.text(); // the SSE stream, read to its end
  if (!response.ok) throw new Error(`generate -> ${response.status}: ${body.slice(0, 300)}`);
  const error = /"type":"error","data":"([^"]*)"/.exec(body)?.[1];
  const after = await records(chatId);
  if (after.length <= before) throw new Error(`no eval record written${error ? `: ${error}` : ""}`);
  return { record: after[before], all: after.slice(before), seconds: (Date.now() - started) / 1000 };
}

async function withBranch(layout, fn) {
  const branch = await api("POST", `/api/chats/${config.chatId}/branch`, {});
  try {
    await api("PATCH", `/api/chats/${branch.id}/metadata`, {
      gmTailLayout: layout,
      gmTailCheckpointDepth: config.checkpointDepth ?? 4,
    });
    return await fn(branch.id);
  } finally {
    await api("DELETE", `/api/chats/${branch.id}?force=true`).catch((error) =>
      console.warn(`could not delete ${branch.id}: ${error.message}`),
    );
  }
}

function usageOf(record) {
  const usage = record.usage ?? {};
  return {
    promptTokens: usage.promptTokens ?? null,
    cachedTokens: usage.cachedPromptTokens ?? null,
    completionTokens: usage.completionTokens ?? null,
    promptChars: record.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0),
  };
}

async function pool(items, size, worker) {
  const queue = [...items];
  const running = Array.from({ length: Math.max(1, size) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(running);
}

const startedAt = new Date();
const jobs = [];
for (const layout of config.layouts)
  for (const scenario of scenarios)
    for (let r = 0; r < (config.repeats ?? 3); r++) jobs.push({ layout, scenario, repeat: r });
console.log(`start ${startedAt.toISOString()}: ${config.models.length} models x ${jobs.length} scenario runs`);

try {
  for (const model of config.models) {
    await api("PATCH", `/api/connections/${config.connectionId}`, { model });
    const modelStart = Date.now();
    let done = 0;
    if (!args.includes("--only-probe")) {
      await pool(jobs, config.concurrency ?? 2, async ({ layout, scenario, repeat }) => {
        const row = { kind: "scenario", model, layout, scenario: scenario.id, repeat };
        try {
          await withBranch(layout, async (chatId) => {
            const turn = await playTurn(chatId, scenario.input);
            const { checks, notes } = scoreReply({
              reply: turn.record.response,
              messages: turn.record.messages,
              scenario,
              partyNames: config.partyNames ?? [],
            });
            Object.assign(row, {
              checks,
              notes,
              ...usageOf(turn.record),
              seconds: turn.seconds,
              reply: turn.record.response,
            });
          });
        } catch (error) {
          row.error = error.message;
        }
        await appendFile(resultsFile, `${JSON.stringify(row)}\n`);
        done++;
        const perJob = (Date.now() - modelStart) / done;
        const eta = new Date(
          Date.now() +
            perJob * (jobs.length - done + (config.models.length - config.models.indexOf(model) - 1) * jobs.length),
        );
        console.log(
          `${model} ${layout} ${scenario.id}#${repeat} ${row.error ? `ERROR ${row.error}` : Object.values(row.checks).every((v) => v !== false) ? "pass" : `FAIL ${row.notes.join("; ")}`} (${done}/${jobs.length}, ETA ${eta.toISOString()})`,
        );
      });
    }
    // Caching across consecutive turns of one chat: the share of the prompt read from cache.
    if (!args.includes("--no-probe") && config.probeTurns?.length) {
      for (const layout of config.layouts) {
        const row = { kind: "probe", model, layout, turns: [] };
        try {
          await withBranch(layout, async (chatId) => {
            for (const input of config.probeTurns.map(fill)) {
              const turn = await playTurn(chatId, input);
              row.turns.push(usageOf(turn.record));
            }
          });
        } catch (error) {
          row.error = error.message;
        }
        await appendFile(resultsFile, `${JSON.stringify(row)}\n`);
        console.log(
          `${model} ${layout} probe ${row.error ?? row.turns.map((t) => `${t.cachedTokens}/${t.promptTokens}`).join(" ")}`,
        );
      }
    }
  }
} finally {
  if (config.restoreModel)
    await api("PATCH", `/api/connections/${config.connectionId}`, { model: config.restoreModel }).catch(() => {});
}

// Summary: per model and layout, the pass rate of each check and the cache share.
const rows = (await readFile(resultsFile, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const groups = new Map();
for (const row of rows.filter((r) => r.kind === "scenario")) {
  const key = `${row.model}|${row.layout}`;
  const g = groups.get(key) ?? { runs: 0, errors: 0, clean: 0, checks: {}, promptTokens: [] };
  g.runs++;
  if (row.error) g.errors++;
  else {
    if (Object.values(row.checks).every((v) => v !== false)) g.clean++;
    for (const [name, value] of Object.entries(row.checks)) {
      if (value === null) continue;
      const c = (g.checks[name] ??= { pass: 0, of: 0 });
      c.of++;
      if (value) c.pass++;
    }
    if (row.promptTokens) g.promptTokens.push(row.promptTokens);
  }
  groups.set(key, g);
}
const probes = new Map(rows.filter((r) => r.kind === "probe" && !r.error).map((r) => [`${r.model}|${r.layout}`, r]));
const checkNames = [...new Set([...groups.values()].flatMap((g) => Object.keys(g.checks)))];
const lines = [
  `# GM tail layout eval`,
  ``,
  `Started ${startedAt.toISOString()}, finished ${new Date().toISOString()}. ${rows.length} rows in results.jsonl.`,
  ``,
  `| Model | Layout | Runs | Errors | Clean replies | ${checkNames.join(" | ")} | Avg prompt tokens | Cached on later probe turns |`,
  `| --- | --- | --- | --- | --- | ${checkNames.map(() => "---").join(" | ")} | --- | --- |`,
];
for (const [key, g] of groups) {
  const [model, layout] = key.split("|");
  const probe = probes.get(key);
  const later = probe?.turns.slice(1) ?? [];
  const share =
    later.length && later.every((t) => t.promptTokens)
      ? `${Math.round((100 * later.reduce((n, t) => n + (t.cachedTokens ?? 0), 0)) / later.reduce((n, t) => n + t.promptTokens, 0))}%`
      : "n/a";
  const avg = g.promptTokens.length
    ? Math.round(g.promptTokens.reduce((a, b) => a + b, 0) / g.promptTokens.length)
    : "n/a";
  lines.push(
    `| ${model} | ${layout} | ${g.runs} | ${g.errors} | ${g.clean}/${g.runs - g.errors} | ${checkNames.map((name) => (g.checks[name] ? `${g.checks[name].pass}/${g.checks[name].of}` : "-")).join(" | ")} | ${avg} | ${share} |`,
  );
}
await writeFile(join(outDir, "summary.md"), `${lines.join("\n")}\n`);
console.log(`done ${new Date().toISOString()}: ${join(outDir, "summary.md")}`);
