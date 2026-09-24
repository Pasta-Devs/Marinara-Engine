// ──────────────────────────────────────────────
// Synthetic JSONL entry builder for Claude Code session replay
// ──────────────────────────────────────────────
//
// The Claude Agent SDK's `resume` option replays a JSONL transcript as the
// conversation history the model sees. Marinara builds these entries in-process
// from its `ChatMessage[]` history and hands them to the SDK through a
// `SessionStore` adapter (see `session-store.ts`), so prior turns reach the
// model as real multi-turn context instead of being folded into one big
// `User: ... / Assistant: ...` string prompt. The SDK — not Marinara — owns
// the on-disk materialization of these entries.
//
// Schema mirrors what the CLI writes (observed in SDK v2.1.x sessions) but
// omits hook/UI noise entries (queue-operation, last-prompt, attachment,
// permission-mode, file-history-snapshot, ai-title) — those aren't required
// for resume. The same minimal shape is used by `claude-openai-proxy` and
// validated to round-trip cleanly.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ChatMessage } from "../../base-provider.js";
import { logger } from "../../../../lib/logger.js";

// Content block shapes the Anthropic API accepts. Re-declared locally rather
// than imported from the SDK so this module stays SDK-free (callers can
// unit-test it without triggering the lazy SDK import cascade).

export interface TextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" };
}
export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

export type UserContentBlock = TextBlock | ToolResultBlock | ImageBlock;
export type AssistantContentBlock = TextBlock | ThinkingBlock | ToolUseBlock;

export interface CommonSessionMeta {
  sessionId: string;
  cwd: string;
  version: string;
  gitBranch: string;
  permissionMode: string;
}

// Declared as `type` aliases (not `interface`) so the union is assignable to
// the SDK's loose `SessionStoreEntry` (`{ type: string; [k: string]: unknown }`)
// without a cast — object-literal type aliases carry an implicit index
// signature; interfaces do not.
export type SyntheticUserEntry = {
  parentUuid: string | null;
  isSidechain: false;
  promptId: string;
  type: "user";
  message: { role: "user"; content: string | UserContentBlock[] };
  uuid: string;
  timestamp: string;
  permissionMode: string;
  userType: "external";
  entrypoint: "cli";
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
};

export interface SyntheticAssistantMessage {
  model: string;
  id: string;
  type: "message";
  role: "assistant";
  content: AssistantContentBlock[];
  stop_reason: "end_turn" | "tool_use";
  stop_sequence: null;
  usage: { input_tokens: number; output_tokens: number };
}

export type SyntheticAssistantEntry = {
  parentUuid: string | null;
  isSidechain: false;
  message: SyntheticAssistantMessage;
  requestId: string;
  type: "assistant";
  uuid: string;
  timestamp: string;
  userType: "external";
  entrypoint: "cli";
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
};

export type SyntheticEntry = SyntheticUserEntry | SyntheticAssistantEntry;

// Constrain the payload to the legal base64 alphabet so the regex engine
// fails fast on garbage instead of backtracking across multi-KB inputs.
const DATA_URL_RE = /^data:(image\/[^;]+);base64,([A-Za-z0-9+/]+=*)$/;

function shortHex(): string {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

function parseToolArguments(args: string, toolName: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    logger.warn("[claude-subscription/jsonl] tool_use input for %s was not a JSON object; substituting {}", toolName);
    return {};
  } catch (err) {
    logger.warn(
      err,
      "[claude-subscription/jsonl] failed to parse tool_use arguments for %s; substituting {}",
      toolName,
    );
    return {};
  }
}

function imageBlocksFromDataUrls(urls: readonly string[]): ImageBlock[] {
  const blocks: ImageBlock[] = [];
  for (const url of urls) {
    const match = url.match(DATA_URL_RE);
    if (!match) {
      logger.warn("[claude-subscription/jsonl] dropping image: not a recognised base64 data URL");
      continue;
    }
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: match[1]!, data: match[2]! },
    });
  }
  return blocks;
}

/**
 * Build a JSONL user entry from a Marinara `ChatMessage`.
 *
 * Handles three shapes:
 *  - role "tool" with `tool_call_id` → single `tool_result` block.
 *  - role "user" with `images` → image blocks (Anthropic-conventional first)
 *    followed by an optional text block.
 *  - plain text → string content (smaller files, identical wire result), or
 *    one text block when `textBlocks` is set. A cache-marked request uses the
 *    block form so a turn replayed as history keeps the shape the SDK sent it
 *    in as the current turn, and the cached prefix still matches.
 */
export function buildUserEntry(args: {
  message: ChatMessage;
  parentUuid: string | null;
  meta: CommonSessionMeta;
  timestamp?: string;
  uuid?: string;
  promptId?: string;
  textBlocks?: boolean;
}): SyntheticUserEntry {
  const { message } = args;
  const text = message.content ?? "";
  let content: string | UserContentBlock[] = args.textBlocks ? [{ type: "text", text }] : text;

  if (message.role === "tool") {
    // `tool_call_id` is optional on ChatMessage but mandatory for a valid
    // tool_result block. Falling through to the text path would silently
    // erase the tool linkage on resume, so warn and emit a placeholder
    // block instead — at least the entry is still recognisably a tool result.
    if (!message.tool_call_id) {
      logger.warn(
        "[claude-subscription/jsonl] role=tool message missing tool_call_id; emitting tool_result with empty tool_use_id",
      );
    }
    content = [
      {
        type: "tool_result",
        tool_use_id: message.tool_call_id ?? "",
        content: text,
      },
    ];
  } else {
    const images = imageBlocksFromDataUrls(message.images ?? []);
    if (images.length > 0) {
      const blocks: UserContentBlock[] = [...images];
      if (text) blocks.push({ type: "text", text });
      content = blocks;
    }
  }

  return {
    parentUuid: args.parentUuid,
    isSidechain: false,
    promptId: args.promptId ?? randomUUID(),
    type: "user",
    message: { role: "user", content },
    uuid: args.uuid ?? randomUUID(),
    timestamp: args.timestamp ?? new Date().toISOString(),
    permissionMode: args.meta.permissionMode,
    userType: "external",
    entrypoint: "cli",
    cwd: args.meta.cwd,
    sessionId: args.meta.sessionId,
    version: args.meta.version,
    gitBranch: args.meta.gitBranch,
  };
}

/**
 * Build a JSONL assistant entry from a Marinara `ChatMessage`.
 *
 * `tool_calls` from the agent loop become `tool_use` blocks; their string
 * `arguments` are parsed back into the object shape Anthropic expects on
 * `input`. Parse failures emit a warn and fall through to `{}`.
 *
 * The Anthropic API rejects empty `content`; an assistant turn with neither
 * text nor tool_calls gets a single empty text block so resume still loads.
 */
export function buildAssistantEntry(args: {
  message: ChatMessage;
  parentUuid: string | null;
  meta: CommonSessionMeta;
  model: string;
  timestamp?: string;
  uuid?: string;
  messageId?: string;
  requestId?: string;
  cacheBreakpointTtl?: "5m" | "1h";
}): SyntheticAssistantEntry {
  const { message } = args;
  const text = message.content ?? "";
  const toolCalls = message.tool_calls ?? [];

  const blocks: AssistantContentBlock[] = [];
  if (text)
    blocks.push({
      type: "text",
      text,
      ...(args.cacheBreakpointTtl
        ? { cache_control: { type: "ephemeral" as const, ttl: args.cacheBreakpointTtl } }
        : {}),
    });
  for (const tc of toolCalls) {
    blocks.push({
      type: "tool_use",
      id: tc.id,
      name: tc.function.name,
      input: parseToolArguments(tc.function.arguments, tc.function.name),
    });
  }
  if (blocks.length === 0) blocks.push({ type: "text", text: "" });

  const stopReason: "end_turn" | "tool_use" = toolCalls.length > 0 ? "tool_use" : "end_turn";

  return {
    parentUuid: args.parentUuid,
    isSidechain: false,
    message: {
      model: args.model,
      id: args.messageId ?? `msg_${shortHex()}`,
      type: "message",
      role: "assistant",
      content: blocks,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
    requestId: args.requestId ?? `req_${shortHex()}`,
    type: "assistant",
    uuid: args.uuid ?? randomUUID(),
    timestamp: args.timestamp ?? new Date().toISOString(),
    userType: "external",
    entrypoint: "cli",
    cwd: args.meta.cwd,
    sessionId: args.meta.sessionId,
    version: args.meta.version,
    gitBranch: args.meta.gitBranch,
  };
}

/**
 * Build the parent-uuid-chained entry list the SDK's resume path replays.
 * System messages are excluded — they ride the SDK's `systemPrompt` option,
 * not the transcript. Each entry points its `parentUuid` at the prior entry's
 * `uuid` so the SDK can walk the conversation back to its root.
 *
 * `historyBreakpointIndex` (from selectHistoryBreakpointIndex) puts one cache
 * marker on that assistant entry; `textBlocks` writes plain user text as one
 * text block. Both are only set for cache-marked requests.
 */
export function assembleEntries(
  history: readonly ChatMessage[],
  meta: CommonSessionMeta,
  model: string,
  options: {
    historyBreakpointIndex?: number | null;
    historyBreakpointTtl?: "5m" | "1h";
    textBlocks?: boolean;
  } = {},
): SyntheticEntry[] {
  const entries: SyntheticEntry[] = [];
  let parentUuid: string | null = null;

  for (const m of history) {
    if (m.role === "system") continue;

    if (m.role === "user" || m.role === "tool") {
      const entry = buildUserEntry({ message: m, parentUuid, meta, textBlocks: options.textBlocks });
      entries.push(entry);
      parentUuid = entry.uuid;
    } else if (m.role === "assistant") {
      const entry = buildAssistantEntry({
        message: m,
        parentUuid,
        meta,
        model,
        cacheBreakpointTtl:
          options.historyBreakpointIndex === entries.length ? options.historyBreakpointTtl : undefined,
      });
      entries.push(entry);
      parentUuid = entry.uuid;
    }
  }
  return entries;
}

/**
 * Pick the completed history assistant turn that ends the stable part of a
 * cache-marked request, or null. Only requests that carry the marked full-lore
 * prefix (`providerMetadata.marinaraFullLoreContext`) qualify, and only when
 * they are plain text with no runtime system block left in the system prompt.
 * The SDK may already spend up to three ephemeral markers on its own request
 * sections; this adds one history marker, keeping the total at four.
 *
 * The mutable tail is everything after that assistant turn: per-turn
 * injections and the single current user turn, in whatever order the prompt
 * builder placed them. A turn that ends on an injection placed after the user
 * turn still gets the marker; requiring the user turn to be last left those
 * requests without one, so the next turn wrote the whole history again.
 */
export function selectHistoryBreakpointIndex(messages: readonly ChatMessage[]): number | null {
  if (
    !messages.some((message) => message.role === "system" && message.providerMetadata?.marinaraFullLoreContext === true)
  ) {
    return null;
  }
  if (
    messages.some(
      (message) =>
        message.role === "system" &&
        (message.providerMetadata?.marinaraRuntimeContext === true ||
          message.providerMetadata?.marinaraDynamicLoreContext === true) &&
        message.content.trim(),
    )
  ) {
    return null;
  }
  if (
    messages.some((message) => {
      const rawMessage = message as ChatMessage & { cache_control?: unknown; cacheControl?: unknown };
      return (
        message.role === "tool" ||
        Array.isArray(message.content) ||
        (message.images?.length ?? 0) > 0 ||
        (message.files?.length ?? 0) > 0 ||
        (message.media?.length ?? 0) > 0 ||
        (message.tool_calls?.length ?? 0) > 0 ||
        rawMessage.cache_control !== undefined ||
        rawMessage.cacheControl !== undefined
      );
    })
  ) {
    return null;
  }

  const nonSystem = messages.filter((message) => message.role !== "system");
  if (nonSystem.length < 2 || nonSystem.at(-1)?.role !== "user") return null;
  const lastIndex = nonSystem.length - 1;
  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const candidate = nonSystem[index]!;
    if (candidate.role !== "assistant" || candidate.contextKind !== "history" || !candidate.content.trim()) continue;
    const tail = nonSystem.slice(index + 1);
    const tailUserTurns = tail.filter((message) => message.contextKind === "history").length;
    if (
      tailUserTurns === 1 &&
      tail.every(
        (message) =>
          message.role === "user" &&
          (message.contextKind === "injection" ||
            message.contextKind === undefined ||
            message.contextKind === "history"),
      )
    ) {
      return index;
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// History split for SDK resume + current-turn shaping
// ──────────────────────────────────────────────

/** Synthetic user prompt when no history exists (connection-test pings, dry runs). */
const SYNTHETIC_START = "[Start]";
/**
 * Build the closest in-SDK approximation of Anthropic Messages API native
 * assistant prefill. The Claude Agent SDK `prompt` is user-only, and Marinara
 * already streams/saves the prefill before provider output, so the synthetic
 * turn tells Claude to continue after the prefilled text rather than repeat it.
 *
 * TODO(passthrough): If/when loopback-passthrough is added, rewrite the
 * outbound API body to keep the trailing assistant in its proper position and
 * elide this synthetic continuation — that unlocks native prefill semantics
 * (model extends the prefill turn directly).
 */
export function buildAssistantPrefillContinuationPrompt(prefill: string): string {
  const normalized = prefill.trimEnd();
  if (!normalized.trim()) {
    return "Continue the assistant's reply.";
  }
  const safePrefill = normalized.replaceAll("</assistant_prefill>", "&lt;/assistant_prefill&gt;");
  return [
    "Continue the assistant's reply as if it already began with the prefill below.",
    "The prefill is already part of the assistant message, so do not repeat it.",
    "Start with the very next text that should follow it, preserving the same voice, format, and momentum.",
    "",
    "<assistant_prefill>",
    safePrefill,
    "</assistant_prefill>",
  ].join("\n");
}

export interface SplitResult {
  /** Messages that go into the JSONL session file as prior history. */
  history: ChatMessage[];
  /** The message used to build the SDK `query()` prompt. */
  current: ChatMessage;
  /** Diagnostic tag describing which branch shaped `current`. */
  shape: "trailing-user" | "trailing-tool" | "trailing-assistant-continue" | "synthetic-start";
  /** Present when a trailing assistant prefill was converted into synthetic continuation steering. */
  assistantPrefillLength?: number;
}

/**
 * Split a flat ChatMessage history into the (history → JSONL) + (current →
 * SDK prompt) shape the resume path needs.
 *
 * - Trailing `user` or `tool`: JSONL = all-but-trailing; prompt source = trailing.
 * - Trailing `assistant`: JSONL = all-but-trailing; prompt source =
 *   synthetic continuation instruction containing the prefill text.
 * - Empty or system-only: JSONL = [] (system messages ride `systemPrompt`,
 *   not the JSONL); prompt source = synthetic "[Start]" user turn.
 *
 * No "drop trailing assistants" logic. Load-bearing upstream contract:
 * Marinara's regen flow (generate.routes.ts) removes the to-be-regenerated
 * assistant turn from `finalMessages` BEFORE calling provider.chat(). Any
 * trailing assistant reaching this function is therefore intentional —
 * specifically the `assistantPrefill` feature (see
 * packages/shared/src/types/prompt.ts and appendGenerationTailMessages(),
 * where the prefill is pushed as the final assistant message).
 *
 * If that upstream contract ever changes — i.e. regen starts leaving the
 * to-be-regenerated assistant in the messages array — the
 * "trailing-assistant-continue" branch will silently fire on plain regens,
 * which would inject a synthetic "(continue)" prompt instead of regenerating
 * cleanly. Either fix it here, or add a regression test at the route layer.
 */
export function splitHistoryForResume(messages: readonly ChatMessage[]): SplitResult {
  // Strip system messages up front. They never go in the JSONL (they ride
  // the SDK's `systemPrompt` option instead) so they must not count toward
  // `history.length` — otherwise the provider's "empty history → skip
  // resume" gate misfires for the common `[system, user]` shape (persona /
  // character prompt followed by the user's first message), producing an
  // empty JSONL that the SDK rejects with "No conversation found."
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length === 0) {
    return {
      history: [],
      current: { role: "user", content: SYNTHETIC_START },
      shape: "synthetic-start",
    };
  }

  const trailing = nonSystem[nonSystem.length - 1]!;

  if (trailing.role === "assistant") {
    return {
      history: nonSystem.slice(0, nonSystem.length - 1),
      current: { role: "user", content: buildAssistantPrefillContinuationPrompt(trailing.content ?? "") },
      shape: "trailing-assistant-continue",
      assistantPrefillLength: (trailing.content ?? "").length,
    };
  }

  return {
    history: nonSystem.slice(0, nonSystem.length - 1),
    current: trailing,
    shape: trailing.role === "tool" ? "trailing-tool" : "trailing-user",
  };
}

// ──────────────────────────────────────────────
// Current-turn → SDK prompt message shape
// ──────────────────────────────────────────────

/**
 * Shape of `SDKUserMessage` from `@anthropic-ai/claude-agent-sdk` that the
 * SDK accepts when `prompt` is an AsyncIterable. Re-declared locally so this
 * module stays SDK-free (the provider does the SDK import at call time).
 *
 * The SDK's actual type has more optional fields (priority, origin,
 * tool_use_result, etc.) but only `type`, `message`, and `parent_tool_use_id`
 * are mandatory for the resume + prompt path.
 */
export interface SdkUserMessageForPrompt {
  type: "user";
  message: {
    role: "user";
    content: string | Array<TextBlock | ToolResultBlock | ImageBlock>;
  };
  parent_tool_use_id: null;
}

/**
 * Convert a Marinara `ChatMessage` into an `SDKUserMessage`-shaped object the
 * SDK accepts as the yielded prompt value.
 *
 *  - role "tool" → single `tool_result` block (with empty `tool_use_id` if
 *    upstream omitted it; matches the same defensive policy as `buildUserEntry`).
 *  - images present → image blocks followed by an optional text block.
 *  - plain text → string content (smaller wire form; same semantics).
 */
export function currentToSdkUserMessage(message: ChatMessage): SdkUserMessageForPrompt {
  const text = message.content ?? "";
  let content: SdkUserMessageForPrompt["message"]["content"] = text;

  if (message.role === "tool") {
    if (!message.tool_call_id) {
      logger.warn(
        "[claude-subscription/jsonl] role=tool current turn missing tool_call_id; emitting tool_result with empty tool_use_id",
      );
    }
    content = [{ type: "tool_result", tool_use_id: message.tool_call_id ?? "", content: text }];
  } else {
    const images: ImageBlock[] = [];
    for (const url of message.images ?? []) {
      const match = url.match(DATA_URL_RE);
      if (!match) {
        logger.warn("[claude-subscription/jsonl] dropping current-turn image: not a base64 data URL");
        continue;
      }
      images.push({
        type: "image",
        source: { type: "base64", media_type: match[1]!, data: match[2]! },
      });
    }
    if (images.length > 0) {
      const blocks: Array<TextBlock | ImageBlock> = [...images];
      if (text) blocks.push({ type: "text", text });
      content = blocks;
    }
  }

  return {
    type: "user",
    message: { role: "user", content },
    parent_tool_use_id: null,
  };
}

// ──────────────────────────────────────────────
// SDK version stamp
// ──────────────────────────────────────────────

/**
 * Read the @anthropic-ai/claude-agent-sdk version once at module load and
 * cache. Stamped on synthetic JSONL entries as `version`.
 *
 * INTENT: telemetry / forensic stamp only. The "unknown" fallback is
 * intentionally NOT a safety gate — the SDK accepts arbitrary version
 * strings on resume (validated against live sessions), and refusing to
 * resume just because we couldn't read our own package.json would punish
 * users for our packaging glitches. If a future change needs a real safety
 * check ("written by SDK vX, refuse if installed is incompatible"), it
 * should be a separate explicit comparison — not a degradation of this
 * fallback.
 *
 * Assumption: the SDK's `main` entry lives at the package root next to its
 * `package.json` (true for v0.2.x). If a future version moves the entry
 * into a subdir, this falls back cleanly to "unknown".
 */
function detectSdkVersion(): string {
  try {
    const req = createRequire(import.meta.url);
    const mainPath = req.resolve("@anthropic-ai/claude-agent-sdk");
    const pkgPath = join(dirname(mainPath), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) return pkg.version;
  } catch {
    // fall through to "unknown"
  }
  return "unknown";
}

export const SDK_VERSION: string = detectSdkVersion();
