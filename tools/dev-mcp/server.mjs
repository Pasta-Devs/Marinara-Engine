#!/usr/bin/env node
// Marinara Engine developer MCP server (optional; nothing in the app depends on it).
//
// Lets an MCP client (Claude Code, Codex, or any other) inspect and drive a local Marinara Engine while you develop
// it: logs and error references, the exact prompts the engine sent, prompt-cache health, characters and chat
// settings, typecheck / regressions / build, a guarded restart, and a sanitized sandbox copy on another port.
// Read tools are free; write, build and restart tools are backed up, recorded in an activity log, and serialized by
// an engine lock so several agents cannot restart the engine over each other. See README.md.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  AGENT,
  API,
  BACKUP_DIR,
  DATA_DIR,
  INSTANCE,
  LIVE_PORT,
  LOG_DIR,
  OUT_DIR,
  REPO,
  REPO_LOOKS_RIGHT,
  SANDBOX_PORT,
  STATE_DIR,
  VERSION,
} from "./lib/config.mjs";
import { SANDBOX_LOG, refreshSandboxData, sandboxInfo, startSandboxProcess } from "./lib/sandbox.mjs";
import { isAlive, tail } from "./lib/proc.mjs";
import {
  api,
  getChat,
  getCharacter,
  getMessages,
  health,
  listChats,
  listCharacters,
  requireOnline,
  resolveCharacter,
  resolveChat,
} from "./lib/api.mjs";
import { acquireLock, build, deploy, readLock, regressions, releaseLock, status, stopEngine, typecheck } from "./lib/engine.mjs";
import { groupedProblems, lookupReference } from "./lib/logs.mjs";
import { cacheReport, diffPrompts, latestSavedPrompts, outline, peekPrompt } from "./lib/prompts.mjs";
import { fail, fileSafe, out, pathInside, readActivity, record, safe, sleep, stamp, trimText } from "./lib/util.mjs";

const server = new McpServer({ name: INSTANCE === "sandbox" ? "marinara-sandbox" : "marinara-dev", version: VERSION });

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const RISKY = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
const tool = (name, description, inputSchema, annotations, handler) =>
  server.registerTool(name, { description, inputSchema, annotations }, safe(handler));

const chatRef = z.string().describe("Chat id, or part of its name (the most recently updated match wins), e.g. 'Session 3'");

// ------------------------------------------------------------------ orientation

tool(
  "engine_status",
  "Start here. Is the engine running, which process, its startup summary (boot id, time to ready, failed phases or " +
    "packages, stale build), when each package was last built, git branch and uncommitted files, who holds the engine " +
    "lock, seconds since the last player generation, and the latest activity-log entries.",
  {},
  READ,
  async () =>
    out({
      tool: `dev-mcp ${VERSION}`,
      instance: INSTANCE,
      repo: REPO,
      repoLooksRight: REPO_LOOKS_RIGHT,
      api: API,
      dataDir: DATA_DIR,
      logDir: LOG_DIR,
      stateDir: STATE_DIR,
      agent: AGENT,
      ...(await status()),
      sandbox: sandboxInfo(),
      recentActivity: readActivity(10),
    }),
);

tool(
  "activity_log",
  "Read or add to the activity log shared by every agent using this server. Writes, builds and restarts made through " +
    "this server are recorded automatically; add a note after changes made elsewhere (code edits, manual data fixes) " +
    "so other agents know about them.",
  {
    note: z.string().optional().describe("If given, append this note (what you changed and why, with file paths)"),
    files: z.array(z.string()).optional().describe("Files touched, for the note"),
    limit: z.number().int().min(1).max(200).default(30),
    filter: z.string().optional().describe("Only entries containing this text"),
  },
  WRITE,
  async ({ note, files, limit, filter }) => {
    if (note) record("note", { note, files });
    return out(readActivity(limit, filter));
  },
);

// ------------------------------------------------------------------ sandbox

const sandboxBase = `http://127.0.0.1:${SANDBOX_PORT}`;
const sandboxOnline = async () => (await health({ base: `${sandboxBase}/api`, origin: sandboxBase, timeoutMs: 3000 })) !== null;

function assertSandboxPort() {
  if (SANDBOX_PORT === LIVE_PORT) throw new Error(`the sandbox port (${SANDBOX_PORT}) must differ from the live port`);
}

tool(
  "sandbox_refresh",
  "Create or refresh the sandbox engine: copy the live store (not images or assets) into the sandbox folder, " +
    "sanitize it (API keys blanked, remote base URLs pointed at a closed local port, webhooks removed; at run time " +
    "home folders are redirected so no subscription login exists and credential-looking env vars are dropped), then " +
    `(re)start it on port ${SANDBOX_PORT}. The live engine and its data are only read. Model calls fail there by ` +
    "design; use it for prompt previews, UI checks, code verification and restart testing. Register a second copy of " +
    "this server with MARINARA_DEV_INSTANCE=sandbox to point every tool at it.",
  {
    start: z.boolean().default(true),
    dist: z
      .string()
      .regex(/^dist[\w-]*$/)
      .default("dist")
      .describe("Server build folder under packages/server to run, e.g. 'dist-sandbox' for a private test build"),
    copyData: z.boolean().default(true).describe("false = just restart the sandbox on its current data"),
  },
  WRITE,
  async ({ start, dist, copyData }) => {
    assertSandboxPort();
    const steps = [];
    // If the old sandbox cannot be stopped, copying data under it (or starting a second one) is unsafe.
    const stopped = await stopEngine(SANDBOX_PORT);
    if (stopped.stopped) steps.push({ step: "stop", ...stopped });
    const started = Date.now();
    if (copyData) steps.push({ step: "copy+sanitize", ...refreshSandboxData(), seconds: Math.round((Date.now() - started) / 1000) });
    if (start) {
      const pid = await startSandboxProcess(dist);
      // Same bound as restart_engine (a cold start of a large store can take minutes), but stop early if the
      // process exits, and return the end of its output when it does not come up.
      const deadline = Date.now() + 720_000;
      let online = false;
      while (!online && Date.now() < deadline && isAlive(pid)) {
        online = await sandboxOnline();
        if (!online) await sleep(2000);
      }
      steps.push({ step: "start", pid, online, dist, url: sandboxBase, ...(online ? {} : { outputTail: tail(SANDBOX_LOG, 30) }) });
      if (!online) {
        record("sandbox_refresh", { steps, ok: false });
        return fail(`the sandbox did not come up: ${JSON.stringify(steps, null, 2)}`);
      }
    }
    record("sandbox_refresh", { steps });
    return out({ ok: true, steps });
  },
);

tool("sandbox_stop", "Stop the sandbox engine (never the live one).", {}, WRITE, async () => {
  assertSandboxPort();
  const result = await stopEngine(SANDBOX_PORT);
  if (result.stopped) record("sandbox_stop", { pid: result.pid });
  return out(result);
});

// ------------------------------------------------------------------ chats and prompts

tool(
  "list_chats",
  "List chats (id, name, mode, game session number, connection, last update). Filter by mode or name.",
  {
    mode: z.enum(["game", "roleplay", "conversation"]).optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(40),
  },
  READ,
  async ({ mode, query, limit }) => {
    await requireOnline();
    const rows = (await listChats())
      .filter((c) => !mode || c.mode === mode)
      .filter((c) => !query || String(c.name ?? "").toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        name: c.name,
        mode: c.mode,
        session: c.metadata?.gameSessionNumber ?? null,
        gameId: c.metadata?.gameId ?? c.groupId ?? null,
        connectionId: c.connectionId ?? null,
        updatedAt: c.updatedAt,
      }));
    return out(rows);
  },
);

tool(
  "read_messages",
  "Read the latest messages of a chat (active swipe), with ids, roles, speaker and token usage. Use `before` to page back.",
  {
    chat: chatRef,
    last: z.number().int().min(1).max(100).default(8),
    before: z.string().optional().describe("Only messages created before this message id"),
    maxCharsEach: z.number().int().min(100).max(50_000).default(3000),
  },
  READ,
  async ({ chat, last, before, maxCharsEach }) => {
    await requireOnline();
    const c = await resolveChat(chat);
    let messages = await getMessages(c.id);
    if (before) {
      const index = messages.findIndex((m) => m.id === before);
      if (index >= 0) messages = messages.slice(0, index);
    }
    const rows = messages.slice(-last).map((m) => ({
      id: m.id,
      role: m.role,
      characterId: m.characterId ?? null,
      at: m.createdAt,
      hiddenFromAI: m.extra?.hiddenFromAI === true || undefined,
      tokens: m.extra?.generationInfo
        ? {
            prompt: m.extra.generationInfo.tokensPrompt,
            cached: m.extra.generationInfo.tokensCachedPrompt,
            out: m.extra.generationInfo.tokensCompletion,
            model: m.extra.generationInfo.model,
          }
        : undefined,
      content: trimText(m.content, maxCharsEach),
    }));
    return out({ chat: { id: c.id, name: c.name, total: messages.length }, messages: rows }, 60_000, "messages");
  },
);

tool(
  "get_prompt",
  "A prompt the engine sends to the model (Peek Prompt data). which='sent' (default) is the exact saved request of a " +
    "reply (the latest reply that has one, or messageId); which='next' is the engine's live preview of what the NEXT " +
    "turn would send, built without calling the model (free). Returns an outline (one row per message: role, chars, " +
    "opening line). Pass `messages` indexes to get those in full, or `grep` to find text inside the prompt. Every call " +
    "saves the full prompt to `fullPromptFile`; pass such files to diff_prompts to compare before/after a code change. " +
    "The engine keeps exact saved requests only for the most recent replies of a chat, so for older turns use " +
    "which='next' snapshots.",
  {
    chat: chatRef,
    which: z.enum(["sent", "next"]).default("sent"),
    messageId: z.string().optional().describe("Assistant message id (implies which='sent')"),
    messages: z.array(z.number().int().min(0)).optional().describe("Prompt message indexes to return in full"),
    grep: z.string().optional().describe("Case-insensitive text to locate in the prompt (returns hits with context)"),
    maxChars: z.number().int().min(1000).max(200_000).default(40_000),
  },
  READ,
  async ({ chat, which, messageId, messages, grep, maxChars }) => {
    await requireOnline();
    const c = await resolveChat(chat);
    let peek;
    if (messageId) peek = { ...(await peekPrompt(c.id, messageId)), messageId };
    else if (which === "next") peek = await peekPrompt(c.id);
    else {
      const [latest] = await latestSavedPrompts(c.id, 1);
      if (!latest) throw new Error("none of the last 15 replies has a saved request; try which='next'");
      peek = { ...latest.peek, messageId: latest.messageId };
    }
    const promptMessages = Array.isArray(peek?.messages) ? peek.messages : [];
    if (!promptMessages.length) return out({ chat: c.name, note: "no stored prompt for that message", raw: Object.keys(peek ?? {}) });
    const file = join(OUT_DIR, `prompt-${fileSafe(c.id)}-${stamp()}.json`);
    writeFileSync(file, JSON.stringify(promptMessages, null, 2), "utf8");
    const result = {
      chat: { id: c.id, name: c.name },
      messageId: peek.messageId ?? null,
      exact: peek.exact ?? null,
      source: peek.source ?? null,
      note: peek.agentNote ?? undefined,
      generationInfo: peek.generationInfo ?? null,
      totalChars: promptMessages.reduce((sum, m) => sum + String(m.content ?? "").length, 0),
      fullPromptFile: file,
      outline: outline(promptMessages),
    };
    if (messages?.length) {
      result.selected = messages.map((i) => ({ index: i, role: promptMessages[i]?.role, content: promptMessages[i]?.content ?? null }));
    }
    if (grep) {
      const needle = grep.toLowerCase();
      result.hits = promptMessages.flatMap((m, index) => {
        const text = String(m.content ?? "");
        const lower = text.toLowerCase();
        const hits = [];
        for (let at = lower.indexOf(needle); at >= 0 && hits.length < 10; at = lower.indexOf(needle, at + needle.length)) {
          hits.push({ index, at, text: text.slice(Math.max(0, at - 200), at + needle.length + 300) });
        }
        return hits;
      });
    }
    return out(result, maxChars, "prompt");
  },
);

tool(
  "cache_report",
  "Prompt-cache health for a chat: per reply prompt tokens, cached tokens, hit %, model, reasoning, duration, and the " +
    "turns that dropped under 70%. Use with diff_prompts to find what broke the cache.",
  { chat: chatRef, last: z.number().int().min(1).max(200).default(20) },
  READ,
  async ({ chat, last }) => {
    await requireOnline();
    const c = await resolveChat(chat);
    return out({ chat: { id: c.id, name: c.name }, ...(await cacheReport(c.id, last)) });
  },
);

tool(
  "diff_prompts",
  "Where two prompts first differ (the prompt-cache break point): message index, offset, shared prefix %, and the " +
    "text on both sides. mode='last-two' (default) compares the two newest replies with saved requests; mode='next' " +
    "compares the newest sent request with a free live preview of the next turn ('will my next message hit the " +
    "cache?'). Or give both message ids, or saved prompt files (`fileA`, and optionally `fileB`; without `fileB` the " +
    "file is compared with the live next-turn preview). Typical loop: get_prompt which='next' (saves a file), change " +
    "code, restart_engine, diff_prompts fileA=<that file>.",
  {
    chat: chatRef,
    mode: z.enum(["last-two", "next"]).default("last-two"),
    messageIdA: z.string().optional(),
    messageIdB: z.string().optional(),
    fileA: z.string().optional().describe("A fullPromptFile saved by get_prompt (must be inside the state folder)"),
    fileB: z.string().optional(),
  },
  READ,
  async ({ chat, mode, messageIdA, messageIdB, fileA, fileB }) => {
    await requireOnline();
    const c = await resolveChat(chat);
    let a;
    let b;
    // Only prompt files this tool saved (under the state folder) can be read; a relative name is taken from out/.
    const readFile = (path) => {
      const full = pathInside(STATE_DIR, path, OUT_DIR);
      if (!existsSync(full)) throw new Error(`no such file: ${full}`);
      return JSON.parse(readFileSync(full, "utf8"));
    };
    if (fileA) {
      a = { id: fileA, messages: readFile(fileA) };
      b = fileB ? { id: fileB, messages: readFile(fileB) } : { id: "next-turn-preview", messages: (await peekPrompt(c.id)).messages };
    } else if (messageIdA && messageIdB) {
      a = { id: messageIdA, messages: (await peekPrompt(c.id, messageIdA)).messages };
      b = { id: messageIdB, messages: (await peekPrompt(c.id, messageIdB)).messages };
    } else if (mode === "next") {
      const [latest] = await latestSavedPrompts(c.id, 1);
      if (!latest) throw new Error("no recent reply has a saved request");
      a = { id: latest.messageId, messages: latest.peek.messages };
      b = { id: "next-turn-preview", messages: (await peekPrompt(c.id)).messages };
    } else {
      const saved = await latestSavedPrompts(c.id, 2);
      if (saved.length < 2) throw new Error("fewer than two recent replies have saved requests; try mode='next'");
      b = { id: saved[0].messageId, messages: saved[0].peek.messages };
      a = { id: saved[1].messageId, messages: saved[1].peek.messages };
    }
    if (!Array.isArray(a.messages) || !Array.isArray(b.messages)) throw new Error("a prompt could not be read");
    return out({ a: a.id, b: b.id, ...diffPrompts(a.messages, b.messages) });
  },
);

tool(
  "chat_settings",
  "A chat's working settings: connection, preset, game special instructions (with length vs the 2000-character " +
    "limit), party, and any metadata keys you name.",
  { chat: chatRef, keys: z.array(z.string()).optional().describe("Extra metadata keys to include verbatim") },
  READ,
  async ({ chat, keys }) => {
    await requireOnline();
    const c = await getChat((await resolveChat(chat)).id);
    const m = c.metadata ?? {};
    const special = typeof m.gameSpecialInstructions === "string" ? m.gameSpecialInstructions : null;
    return out({
      id: c.id,
      name: c.name,
      mode: c.mode,
      connectionId: c.connectionId,
      promptPresetId: c.promptPresetId ?? null,
      characterIds: c.characterIds,
      session: m.gameSessionNumber ?? null,
      gameSpecialInstructions: special,
      gameSpecialInstructionsLength: special?.length ?? 0,
      metadataKeys: Object.keys(m).sort(),
      ...(keys?.length ? { extra: Object.fromEntries(keys.map((k) => [k, m[k] ?? null])) } : {}),
    });
  },
);

// ------------------------------------------------------------------ diagnostics

tool(
  "logs",
  "Warnings and errors from the engine's log files, grouped by event/operation and message (count, first/last time, " +
    "error text and code, last errorId and requestId, which lookup_error can follow). Prompt dumps are filtered out.",
  {
    minutes: z.number().min(1).max(60 * 24 * 14).default(120),
    level: z.enum(["warn", "error"]).default("warn"),
    grep: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(30),
  },
  READ,
  async ({ minutes, level, grep, limit }) => out(groupedProblems({ minutes, minLevel: level, grep }).slice(0, limit)),
);

tool(
  "lookup_error",
  "Follow a reference through the logs: an errorId (the reference shown in an error toast or API error) or a request " +
    "id (the x-request-id response header). Returns the matching lines with stack traces and the whole trail of the " +
    "same requestId (or operationId for background work) in time order, including the request.end line.",
  { reference: z.string().min(5) },
  READ,
  async ({ reference }) => out(lookupReference(reference), 40_000, "error"),
);

tool(
  "list_connections",
  "Configured model connections (id, provider, model, name, default flags). Keys and base URLs are never returned.",
  {},
  READ,
  async () => {
    await requireOnline();
    const rows = await api("/connections");
    return out(
      (Array.isArray(rows) ? rows : []).map((c) => ({
        id: c.id,
        provider: c.provider,
        model: c.model,
        name: c.name,
        isDefault: c.isDefault,
        defaultForAgents: c.defaultForAgents,
      })),
    );
  },
);

// ------------------------------------------------------------------ characters

tool(
  "find_characters",
  "Search the character library by name or by text anywhere in the card (description, personality, backstory, " +
    "appearance, notes). Returns id, name and the matching snippets.",
  { query: z.string().min(2), limit: z.number().int().min(1).max(200).default(30) },
  READ,
  async ({ query, limit }) => {
    await requireOnline();
    const needle = query.toLowerCase();
    const rows = [];
    for (const c of await listCharacters()) {
      const d = c.data ?? {};
      const ext = d.extensions ?? {};
      const fields = {
        name: d.name,
        description: d.description,
        personality: d.personality,
        scenario: d.scenario,
        first_mes: d.first_mes,
        creator_notes: d.creator_notes,
        backstory: ext.backstory ?? d.backstory,
        appearance: ext.appearance ?? d.appearance,
      };
      const snippets = Object.entries(fields).flatMap(([field, value]) => {
        const text = String(value ?? "");
        const at = text.toLowerCase().indexOf(needle);
        return at >= 0 ? [{ field, text: text.slice(Math.max(0, at - 120), at + needle.length + 200) }] : [];
      });
      if (snippets.length) rows.push({ id: c.id, name: d.name, snippets: snippets.slice(0, 4) });
      if (rows.length >= limit) break;
    }
    return out(rows, 40_000, "characters");
  },
);

tool(
  "get_character",
  "Full character card (all text fields including extensions.backstory / appearance) by id or name.",
  { character: z.string(), fields: z.array(z.string()).optional().describe("Only these top-level data fields") },
  READ,
  async ({ character, fields }) => {
    await requireOnline();
    const c = await getCharacter((await resolveCharacter(character)).id);
    const data = fields?.length
      ? Object.fromEntries(fields.map((f) => [f, c.data?.[f] ?? c.data?.extensions?.[f] ?? null]))
      : c.data;
    return out({ id: c.id, data }, 60_000, "character");
  },
);

const EDITABLE = ["description", "personality", "scenario", "first_mes", "mes_example", "system_prompt", "creator_notes", "post_history_instructions"];
const EXT_EDITABLE = ["backstory", "appearance"];

tool(
  "edit_character",
  "Edit a character card through the engine's API (the card in the app is the current version; edit it there rather " +
    "than re-importing an older file over it). Either set whole fields, or replace an exact snippet inside a field. " +
    "The current card is backed up first, the engine keeps a version snapshot with your reason, and the change is " +
    "recorded in the activity log. Fails if a `replace.find` is not found exactly once. Use dryRun to preview.",
  {
    character: z.string(),
    reason: z.string().min(5).describe("Why; shown in the card's version history and the activity log"),
    set: z.record(z.string()).optional().describe(`Whole-field values. Allowed: ${[...EDITABLE, ...EXT_EDITABLE].join(", ")}`),
    replace: z
      .array(z.object({ field: z.string(), find: z.string().min(1), with: z.string() }))
      .optional()
      .describe("Exact snippet replacements"),
    dryRun: z.boolean().default(false),
  },
  WRITE,
  async ({ character, reason, set, replace, dryRun }) => {
    await requireOnline();
    const ref = await resolveCharacter(character);
    const live = await getCharacter(ref.id);
    const data = live.data ?? {};
    const ext = { ...(data.extensions ?? {}) };
    const patch = {};
    const read = (field) => (EXT_EDITABLE.includes(field) ? String(ext[field] ?? "") : String(patch[field] ?? data[field] ?? ""));
    const write = (field, value) => {
      if (EXT_EDITABLE.includes(field)) {
        ext[field] = value;
        patch.extensions = ext;
      } else patch[field] = value;
    };
    for (const [field, value] of Object.entries(set ?? {})) {
      if (![...EDITABLE, ...EXT_EDITABLE].includes(field)) throw new Error(`field ${field} is not editable here`);
      write(field, value);
    }
    for (const item of replace ?? []) {
      if (![...EDITABLE, ...EXT_EDITABLE].includes(item.field)) throw new Error(`field ${item.field} is not editable here`);
      const current = read(item.field);
      const count = current.split(item.find).length - 1;
      if (count !== 1) throw new Error(`"${trimText(item.find, 80)}" found ${count} times in ${item.field}; must be exactly once`);
      write(item.field, current.replace(item.find, () => item.with));
    }
    if (!Object.keys(patch).length) throw new Error("nothing to change");
    if (dryRun) return out({ id: ref.id, name: data.name, wouldPatch: patch });
    const backup = join(BACKUP_DIR, `character-${fileSafe(ref.id)}-${stamp()}.json`);
    writeFileSync(backup, JSON.stringify(live, null, 2), "utf8");
    await api(`/characters/${encodeURIComponent(ref.id)}`, { method: "PATCH", body: { data: patch, versionReason: reason } });
    const after = await getCharacter(ref.id);
    const verified = Object.entries(patch).every(([field, value]) =>
      field === "extensions"
        ? EXT_EDITABLE.every((f) => value[f] === undefined || after.data?.extensions?.[f] === value[f])
        : after.data?.[field] === value,
    );
    record("edit_character", { id: ref.id, name: data.name, fields: Object.keys(patch), reason, backup, verified });
    return out({ id: ref.id, name: data.name, changed: Object.keys(patch), verified, backup });
  },
);

// ------------------------------------------------------------------ chat settings writes

tool(
  "set_chat_metadata",
  "Set chat metadata keys through the engine's API (e.g. gameSpecialInstructions). The previous " +
    "values are backed up and the change recorded in the activity log. gameSpecialInstructions is refused over 2000 " +
    "characters (the engine's limit). For a text edit inside a string value, use `replace` instead of `set`. Use dryRun " +
    "to preview.",
  {
    chat: chatRef,
    reason: z.string().min(5),
    set: z.record(z.any()).optional(),
    replace: z.object({ key: z.string(), find: z.string().min(1), with: z.string() }).optional(),
    dryRun: z.boolean().default(false),
  },
  WRITE,
  async ({ chat, reason, set, replace, dryRun }) => {
    await requireOnline();
    const c = await getChat((await resolveChat(chat)).id);
    const meta = c.metadata ?? {};
    const patch = { ...(set ?? {}) };
    if (replace) {
      const current = String(patch[replace.key] ?? meta[replace.key] ?? "");
      const count = current.split(replace.find).length - 1;
      if (count !== 1) throw new Error(`"${trimText(replace.find, 80)}" found ${count} times in ${replace.key}; must be exactly once`);
      patch[replace.key] = current.replace(replace.find, () => replace.with);
    }
    if (!Object.keys(patch).length) throw new Error("nothing to change");
    if (typeof patch.gameSpecialInstructions === "string" && patch.gameSpecialInstructions.length > 2000) {
      throw new Error(`gameSpecialInstructions would be ${patch.gameSpecialInstructions.length} chars; the limit is 2000`);
    }
    if (dryRun) return out({ chat: c.name, wouldSet: patch });
    const backup = join(BACKUP_DIR, `chatmeta-${fileSafe(c.id)}-${stamp()}.json`);
    writeFileSync(backup, JSON.stringify(Object.fromEntries(Object.keys(patch).map((k) => [k, meta[k] ?? null])), null, 2), "utf8");
    await api(`/chats/${encodeURIComponent(c.id)}/metadata`, { method: "PATCH", body: patch });
    const after = (await getChat(c.id)).metadata ?? {};
    const verified = Object.entries(patch).every(([k, v]) => JSON.stringify(after[k]) === JSON.stringify(v));
    record("set_chat_metadata", { chatId: c.id, chat: c.name, keys: Object.keys(patch), reason, backup, verified });
    return out({ chat: c.name, keys: Object.keys(patch), verified, backup });
  },
);

// ------------------------------------------------------------------ development

tool(
  "git_status",
  "Branch, ahead/behind upstream, recent commits and uncommitted files of the repository.",
  {},
  READ,
  async () => out((await status()).git),
);

tool(
  "typecheck",
  "TypeScript check (tsc --noEmit) for server, client or both. Builds shared first (its types feed the others).",
  { package: z.enum(["server", "client", "all"]).default("all") },
  WRITE,
  async ({ package: pkg }) => out(await typecheck(pkg), 40_000, "typecheck"),
);

tool(
  "run_regressions",
  "Run regression scripts (scripts/run-regressions.mjs). Pass a filter unless you really mean the whole suite, which " +
    "is slow. Returns the pass count, failed scripts and assertion lines. Build shared first if its types changed.",
  {
    filter: z.string().optional().describe("Substring of the regression file path"),
    timeoutMinutes: z.number().min(1).max(120).default(20),
  },
  READ,
  async ({ filter, timeoutMinutes }) => out(await regressions(filter, timeoutMinutes * 60_000), 40_000, "regressions"),
);

tool(
  "build",
  "Build packages without restarting (client builds are picked up after a page reload; server builds need " +
    "restart_engine). Each touched dist is backed up first and restored if any build fails.",
  { packages: z.array(z.enum(["shared", "server", "client", "all"])).min(1), reason: z.string().min(5) },
  RISKY,
  async ({ packages, reason }) => {
    // Hold the lock for the whole build, so nobody restarts or rebuilds from a half-written dist.
    acquireLock(`build: ${reason}`);
    let result;
    try {
      result = await build(packages);
    } finally {
      releaseLock();
    }
    record("build", { packages, reason, ok: result.ok, backup: result.backup });
    return out(result, 30_000, "build");
  },
);

tool(
  "restart_engine",
  "Stop and relaunch the engine, optionally rebuilding first. Takes the engine lock (refused while another agent " +
    "holds it); by default waits until nobody has generated for `quietSeconds`, so a turn in progress is never cut " +
    "off; backs up dist and relaunches the previous build if a build fails; records the result in the activity log. " +
    "Launches `node ../../scripts/run-server.mjs dist/index.js` in packages/server (the launchers' final step), never " +
    "start.bat / start.sh, with browser auto-open off.",
  {
    reason: z.string().min(5),
    rebuild: z.array(z.enum(["shared", "server", "client", "all"])).default([]),
    waitForQuiet: z.boolean().default(true),
    quietSeconds: z.number().int().min(0).max(3600).default(150),
    maxWaitSeconds: z.number().int().min(0).max(4 * 3600).default(1800),
  },
  RISKY,
  async ({ reason, rebuild, waitForQuiet, quietSeconds, maxWaitSeconds }) =>
    out(await deploy({ packages: rebuild, waitQuiet: waitForQuiet, quietSeconds, maxWaitSeconds, reason }), 30_000, "restart"),
);

tool(
  "api_request",
  "Raw engine API call for anything the other tools do not cover (path after /api, e.g. /chats/<id>). GET is always " +
    "allowed. Other methods need `confirm: true` and a reason, and are recorded in the activity log; prefer the " +
    "dedicated tools for writes, since they back up first.",
  {
    path: z.string().startsWith("/"),
    method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
    body: z.any().optional(),
    confirm: z.boolean().default(false),
    reason: z.string().optional(),
    maxChars: z.number().int().min(1000).max(200_000).default(30_000),
  },
  RISKY,
  async ({ path, method, body, confirm, reason, maxChars }) => {
    await requireOnline();
    if (method !== "GET" && (!confirm || !reason || reason.trim().length < 5)) {
      throw new Error("non-GET requests need confirm: true and a reason of at least 5 characters");
    }
    const result = await api(path, { method, body, timeoutMs: 120_000 });
    if (method !== "GET") record("api_request", { method, path, reason });
    return out(result, maxChars, "api");
  },
);

await server.connect(new StdioServerTransport());
