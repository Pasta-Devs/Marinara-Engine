// ──────────────────────────────────────────────
// LLM Provider — Claude (Subscription via Claude Agent SDK)
// ──────────────────────────────────────────────
//
// Routes chat requests through the locally-installed Claude Agent SDK so the
// signed-in Pro / Max subscription is used for billing instead of an
// `sk-ant-*` API key. The SDK shells out to the Claude Code CLI (which must
// be installed on the host: `npm i -g @anthropic-ai/claude-code` followed by
// `claude login`). When `apiKey` is supplied on the connection, it is
// forwarded as `ANTHROPIC_API_KEY` and the SDK falls back to API billing —
// useful as a safety net if subscription auth is unavailable.
//
// This provider only supports text chat — built-in agent tools (Bash, Read,
// Write, etc.) are explicitly disabled because Marinara drives its own
// agent/tool layer.
//
// References:
//   • Subscription terms: Anthropic permits Claude Code / Agent SDK usage on
//     the user's own machine under their Pro / Max subscription. This is the
//     same mechanism Zed and other IDE integrations use.
//   • SDK docs: https://docs.anthropic.com/en/docs/claude-code/sdk
//
import { randomUUID } from "node:crypto";
import { isClaudeAdaptiveOnlyNoSamplingModel, shouldSuppressUnknownModelParameters } from "@marinara-engine/shared";
import { BaseLLMProvider, type ChatMessage, type ChatOptions, type LLMUsage } from "../base-provider.js";
import { logger } from "../../../lib/logger.js";
import { isClaudeSubscriptionResumeEnabled } from "../../../config/runtime-config.js";
import {
  assembleEntries,
  currentToSdkUserMessage,
  SDK_VERSION,
  splitHistoryForResume,
  type SdkUserMessageForPrompt,
} from "./claude-subscription/jsonl-entries.js";
import { ResumeSessionStore, resumeScratchCwd } from "./claude-subscription/session-store.js";

/**
 * Prompt-cache cost multipliers relative to one fresh (uncached) input token.
 * The Agent SDK uses Claude's default 5-minute cache: writing a token into the
 * cache is billed at 1.25x, reading one back at 0.1x, an uncached token at 1x.
 * Used to estimate — in fresh-input-token equivalents — whether caching is a
 * net saving on a request. Break-even is ~2 uses of a cached prefix:
 * 1.25x (write) + 0.1x (one read) = 1.35x, vs 2x for two uncached sends.
 */
const CACHE_WRITE_COST_MULTIPLIER = 1.25;
const CACHE_READ_COST_MULTIPLIER = 0.1;

/**
 * SDK option keys the resume path owns exclusively. A connection's
 * `customParameters` must never set these: a forged `resume`/`sessionStore`
 * could inject an attacker-controlled transcript, and a forged `cwd` controls
 * where the SDK subprocess runs. They are stripped unconditionally after
 * `applyCustomParameters` and re-applied only from provider-derived values
 * (see `chat()`).
 */
const RESERVED_SDK_OPTION_KEYS = ["resume", "cwd", "sessionStore"] as const;

/**
 * Lazy import wrapper. The SDK is heavy and pulls in optional native pieces;
 * keeping the import inside `chat()` avoids loading it for the (common) case
 * where no `claude_subscription` connection has been used yet.
 */
type SdkModule = typeof import("@anthropic-ai/claude-agent-sdk");
let cachedSdk: Promise<SdkModule> | null = null;
function loadSdk(): Promise<SdkModule> {
  if (!cachedSdk) {
    cachedSdk = import("@anthropic-ai/claude-agent-sdk").catch((err) => {
      cachedSdk = null;
      throw new Error(
        `Failed to load @anthropic-ai/claude-agent-sdk. Install Claude Code on this host (npm i -g @anthropic-ai/claude-code) and run \`claude login\` once. Underlying error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }
  return cachedSdk;
}

const SDK_ERROR_DETAIL_LIMIT = 1600;

function compactSdkErrorText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s+/g, " ");
  return compact ? compact.slice(0, SDK_ERROR_DETAIL_LIMIT) : null;
}

function collectSdkErrorDetails(err: unknown, seen = new Set<unknown>()): string[] {
  if (!err || seen.has(err)) return [];
  seen.add(err);

  const parts: string[] = [];
  if (err instanceof Error) {
    const message = compactSdkErrorText(err.message);
    if (message) parts.push(message);
  } else {
    const message = compactSdkErrorText(String(err));
    if (message && message !== "[object Object]") parts.push(message);
  }

  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    for (const key of ["stderr", "stdout", "details", "detail", "code", "status"]) {
      const value = compactSdkErrorText(record[key]);
      if (value) parts.push(`${key}: ${value}`);
    }
    const errors = record.errors;
    if (Array.isArray(errors)) {
      for (const item of errors) parts.push(...collectSdkErrorDetails(item, seen));
    }
    if (record.cause) parts.push(...collectSdkErrorDetails(record.cause, seen));
  }

  return Array.from(new Set(parts));
}

function formatClaudeSdkError(err: unknown): string {
  const parts = collectSdkErrorDetails(err);
  const message = parts.length > 0 ? parts.join(" | ") : err instanceof Error ? err.message : String(err);
  if (/Claude Code request failed/i.test(message)) {
    return `${message}. Confirm \`claude login\` was run by the same OS user/HOME as the Marinara server, or set ANTHROPIC_API_KEY/CLAUDE_CODE_OAUTH_TOKEN in the server environment. HOME=${process.env.HOME ?? "unset"}.`;
  }
  return message;
}

/** @internal Test-only seam. Replaces the cached SDK module with a fake or clears it. */
export function __setSdkForTesting(mod: Pick<SdkModule, "query"> | null): void {
  cachedSdk = mod ? (Promise.resolve(mod as SdkModule) as Promise<SdkModule>) : null;
}

/**
 * Wrap a single SDK-shaped user message in an AsyncIterable suitable for the
 * SDK's `prompt: AsyncIterable<SDKUserMessage>` form. We yield once and
 * return — the SDK consumes one message and proceeds to generation.
 *
 * The `unknown` cast on the yielded value is because `SdkUserMessageForPrompt`
 * is declared locally (in `jsonl-entries.ts`, kept SDK-free); structurally it
 * matches the SDK's `SDKUserMessage` shape for the fields we set. The cast
 * happens at the `query()` call site where the SDK type narrows it.
 */
async function* singleMessageIterable(msg: SdkUserMessageForPrompt): AsyncIterable<unknown> {
  yield msg;
}

/**
 * Extract system-role messages into a single concatenated string for the
 * SDK's `systemPrompt` option, used by both the fold path and the resume
 * path. System messages never ride in the JSONL.
 */
function extractSystemPrompt(messages: ChatMessage[]): string | undefined {
  const blocks: string[] = [];
  for (const m of messages) {
    if (m.role !== "system") continue;
    const text = m.content?.trim();
    if (text) blocks.push(text);
  }
  return blocks.length > 0 ? blocks.join("\n\n") : undefined;
}

/**
 * Render the chat history into the single-string `prompt` form the Agent SDK
 * accepts. We extract system messages so they can be passed through the
 * dedicated `systemPrompt` option (preserving system/user separation), then
 * fold the rest of the conversation into a labelled transcript so the model
 * sees prior turns even though the SDK is one-shot per call.
 *
 * Used by the fold path (legacy / fallback). The resume path uses
 * `splitHistoryForResume` + synthetic JSONL session instead.
 */
function renderTranscript(messages: ChatMessage[]): { systemPrompt: string | undefined; prompt: string } {
  const systemBlocks: string[] = [];
  const turns: string[] = [];

  for (const message of messages) {
    const text = message.content?.trim();
    if (!text) continue;
    if (message.role === "system") {
      systemBlocks.push(text);
      continue;
    }
    const label = message.role === "user" ? "User" : "Assistant";
    turns.push(`${label}: ${text}`);
  }

  // Claude Agent SDK requires a non-empty prompt; if the caller only supplied
  // system content (rare but possible during connection-test pings), inject a
  // minimal user turn so the SDK accepts the request.
  if (turns.length === 0) turns.push("User: [Start]");

  return {
    systemPrompt: systemBlocks.length ? systemBlocks.join("\n\n") : undefined,
    prompt: turns.join("\n\n"),
  };
}

/**
 * The set of values the SDK call needs from the path-selection step. Pulled
 * out so `chat()` reads as a straight line — pick a path, build options,
 * call the SDK — instead of carrying several `let` declarations across a
 * 30-line branch.
 *
 * `sessionStore` / `resumeSessionId` / `resumeCwd` are all non-null together
 * (resume path with prior history) or all null together (fold path, or the
 * empty-history resume sub-path which sends the current turn directly).
 */
interface PromptSelection {
  promptArg: string | AsyncIterable<unknown>;
  systemPrompt: string | undefined;
  resumeSessionId: string | null;
  resumeCwd: string | null;
  sessionStore: ResumeSessionStore | null;
}

/**
 * Pick the resume path or the fold path for this request, and produce
 * everything the SDK call needs. Resolved per-call so env-var changes take
 * effect on the next request without a restart.
 */
function selectPromptPath(messages: ChatMessage[], model: string): PromptSelection {
  if (isClaudeSubscriptionResumeEnabled()) {
    try {
      return buildResumeSelection(messages, model);
    } catch (err) {
      // The only realistic failure is creating the scratch working directory
      // on a read-only / permission-locked data dir. Degrade to the fold path
      // for this request rather than failing the chat outright.
      logger.warn(err, "[claude-subscription] resume path setup failed; using transcript fold for this request");
    }
  }
  return buildFoldSelection(messages);
}

function buildResumeSelection(messages: ChatMessage[], model: string): PromptSelection {
  const split = splitHistoryForResume(messages);
  const systemPrompt = extractSystemPrompt(messages);

  if (split.history.length === 0) {
    // Resuming an empty transcript makes the SDK throw "No conversation found
    // with session ID: ..." — its loader treats a zero-entry session as
    // missing, not as a valid zero-turn resume. So when the caller's history
    // has nothing to resume from (single-turn requests, connection pings,
    // system-only context), skip resume entirely and send the current turn
    // straight through the AsyncIterable prompt.
    logger.debug("[claude-subscription] resume path: shape=%s history=empty (direct prompt, no resume)", split.shape);
    return {
      promptArg: singleMessageIterable(currentToSdkUserMessage(split.current)),
      systemPrompt,
      resumeSessionId: null,
      resumeCwd: null,
      sessionStore: null,
    };
  }

  // Mint a fresh sessionId per request; it keys the in-process SessionStore
  // and is what the SDK resumes by. The SDK calls `sessionStore.load()` once
  // before subprocess spawn, materializes the entries to its own temp JSONL,
  // and resumes from there — Marinara writes nothing to disk itself.
  const sessionId = randomUUID();
  const cwd = resumeScratchCwd();
  const entries = assembleEntries(
    split.history,
    { sessionId, cwd, version: SDK_VERSION, gitBranch: "main", permissionMode: "bypassPermissions" },
    model,
  );
  logger.debug(
    "[claude-subscription] resume path: shape=%s sessionId=%s historyLen=%d",
    split.shape,
    sessionId,
    split.history.length,
  );
  return {
    promptArg: singleMessageIterable(currentToSdkUserMessage(split.current)),
    systemPrompt,
    resumeSessionId: sessionId,
    resumeCwd: cwd,
    sessionStore: new ResumeSessionStore(sessionId, entries),
  };
}

function buildFoldSelection(messages: ChatMessage[]): PromptSelection {
  // Fold path (legacy / fallback). Unchanged from the pre-resume implementation.
  const folded = renderTranscript(messages);
  return {
    promptArg: folded.prompt,
    systemPrompt: folded.systemPrompt,
    resumeSessionId: null,
    resumeCwd: null,
    sessionStore: null,
  };
}

/**
 * Provider that uses the local Claude Agent SDK for billing-via-subscription.
 *
 * `baseUrl` is ignored (the SDK manages the endpoint). `apiKey`, when set, is
 * forwarded to the spawned Claude Code process as `ANTHROPIC_API_KEY` so the
 * connection can opt into API billing instead of subscription billing.
 */
export class ClaudeSubscriptionProvider extends BaseLLMProvider {
  constructor(
    baseUrl: string,
    apiKey: string,
    defaultMaxContext?: number,
    defaultOpenrouterProvider?: string | null,
    maxTokensOverride?: number | null,
    /**
     * Connection-level fast-mode preference. When `true`, the SDK is asked to
     * route the request through its faster (and quality-degraded) path. When
     * `false`, fast mode is explicitly forced off so a persisted CLI setting
     * can't downgrade Marinara queries silently.
     */
    private readonly fastMode: boolean = false,
  ) {
    super(baseUrl, apiKey, defaultMaxContext, defaultOpenrouterProvider, maxTokensOverride);
  }

  private shouldSuppressModelParameters(options: ChatOptions): boolean {
    return (
      options.suppressModelParameters === true ||
      shouldSuppressUnknownModelParameters("claude_subscription", options.model)
    );
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const suppressModelParameters = this.shouldSuppressModelParameters(options);
    const configuredMaxTokens = suppressModelParameters ? undefined : (options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    this.logContextTrim(contextFit, options.model);

    const { promptArg, systemPrompt, resumeSessionId, resumeCwd, sessionStore } = selectPromptPath(
      contextFit.messages,
      options.model,
    );

    const { query } = await loadSdk();

    const abortController = new AbortController();
    const onUpstreamAbort = () => abortController.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener("abort", onUpstreamAbort, { once: true });
      }
    }

    // Claude adaptive-only models reject sampling parameters; other models
    // accept temperature etc. but the Agent SDK doesn't expose those knobs
    // directly, so we skip them and rely on the SDK defaults.
    const isAdaptiveOnly = isClaudeAdaptiveOnlyNoSamplingModel(options.model);

    // Outbound-context strip strategy: this provider is a text-chat surface
    // (roleplay / character DM), not an agent runner. The SDK's default
    // posture leaks several things the user never asked for into every
    // request, so we override each one explicitly:
    //
    //   • Use a plain-string `systemPrompt` (the caller's content as-is)
    //     instead of wrapping it under the `claude_code` preset. The preset
    //     injects ~thousands of tokens of Claude-Code-agent framing
    //     ("You are Claude Code, Anthropic's CLI...") which is wrong for
    //     a character-chat. Side effect: when asked "which model are you?"
    //     the model may fall back to its training-data prior (typically
    //     "Sonnet") instead of self-identifying accurately — acceptable for
    //     this provider's use case since the user-supplied persona prompt
    //     dominates identity.
    //   • `settingSources: []` — prevents the SDK from auto-loading
    //     `~/.claude/settings.json` + the project's `CLAUDE.md` + any
    //     workspace `.claude/settings.json` into the request context.
    //   • `skills: []` — prevents auto-load of skill metadata (~3000 tokens
    //     of installed-skill descriptions, hooks, etc.).
    //   • `allowDangerouslySkipPermissions: true` — explicit; matches the
    //     `permissionMode: "bypassPermissions"` intent and skips additional
    //     permission resolution framing.
    //   • `maxTurns: 1` — single assistant turn per call; we drive any
    //     multi-turn agent loop ourselves at the route layer.
    //
    // Wire-level artifacts the SDK still injects (`<system-reminder>`
    // userEmail/currentDate, metadata account/device UUIDs, the SDK
    // preamble system block) need a loopback passthrough to strip; that's
    // tracked as future work.

    const sdkOptions: Parameters<SdkModule["query"]>[0]["options"] = {
      abortController,
      model: options.model,
      includePartialMessages: options.stream ?? true,
      tools: [],
      skills: [],
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: [],
      // Always pass `settings.fastMode` explicitly so the SDK can't fall back
      // on a persisted CLI value that would silently downgrade the model. The
      // value comes from the connection-level toggle — default `false` so
      // unconfigured connections keep the requested model.
      settings: { fastMode: this.fastMode },
    };
    if (systemPrompt !== undefined) sdkOptions.systemPrompt = systemPrompt;

    if (!suppressModelParameters && options.enableThinking) {
      sdkOptions.thinking = { type: "adaptive" };
      // EffortLevel covers low|medium|high|xhigh|max; reasoningEffort matches
      // that provider-facing set.
      sdkOptions.effort = (options.reasoningEffort ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
    } else if (!suppressModelParameters && isAdaptiveOnly) {
      // Adaptive-only Claude models always think; let the SDK pick a default effort.
      sdkOptions.thinking = { type: "adaptive" };
    }

    // Subprocess environment. `ENABLE_CLAUDEAI_MCP_SERVERS=false` opts out of
    // the signed-in account's claude.ai connectors (Notion / Gmail / Calendar),
    // which ride the `claudeai` MCP scope that `settingSources: []` does not
    // gate — and this provider is a text-chat surface that must expose zero
    // tools. It is a documented opt-out flag (see "Use MCP servers from
    // Claude.ai": https://code.claude.com/docs/en/mcp). Those docs note the
    // connectors only load under subscription auth, not when ANTHROPIC_API_KEY
    // is set — so the flag is harmlessly redundant on the API-key path below,
    // but set unconditionally so the subscription path is always covered. The
    // `init`-message guard above warns if a future CLI stops honoring it.
    //
    // `ANTHROPIC_API_KEY` is the opt-in API-billing fallback when the
    // connection sets an explicit key.
    sdkOptions.env = {
      ...process.env,
      ENABLE_CLAUDEAI_MCP_SERVERS: "false",
      ...(this.apiKey ? { ANTHROPIC_API_KEY: this.apiKey } : {}),
    };

    const reserved = sdkOptions as Record<string, unknown>;
    this.applyCustomParameters(reserved, options);

    // RESERVED keys are load-bearing for the resume path's contract: the SDK
    // loads the injected history from `sessionStore.load()` and resumes the
    // session by ID. Strip any caller-supplied values unconditionally — a
    // connection's customParameters must not reach the SDK even on the fold
    // path and the empty-history resume sub-path, where the guard below stays
    // closed.
    for (const key of RESERVED_SDK_OPTION_KEYS) delete reserved[key];
    if (resumeSessionId && resumeCwd && sessionStore) {
      reserved["resume"] = resumeSessionId;
      reserved["cwd"] = resumeCwd;
      reserved["sessionStore"] = sessionStore;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let cacheWriteTokens = 0;
    let emittedText = false;
    let sawSuccessResult = false;
    let finalFastModeState: string | null = null;
    let finalUsedModels: string[] = [];

    try {
      // Cast on `prompt` is needed because we type `promptArg` locally as
      // `string | AsyncIterable<unknown>` (the AsyncIterable element type is
      // declared in jsonl-entries.ts to keep that module SDK-free). The SDK's
      // own type narrows it correctly at runtime.
      const queryHandle = query({
        prompt: promptArg as Parameters<SdkModule["query"]>[0]["prompt"],
        options: sdkOptions,
      });

      for await (const message of queryHandle) {
        if (message.type === "stream_event") {
          const event = message.event as {
            type: string;
            delta?: { type: string; text?: string; thinking?: string };
          };
          if (event.type === "content_block_delta" && event.delta) {
            if (event.delta.type === "text_delta" && event.delta.text) {
              yield event.delta.text;
              emittedText = true;
            } else if (event.delta.type === "thinking_delta" && event.delta.thinking && options.onThinking) {
              options.onThinking(event.delta.thinking);
            }
          }
        } else if (message.type === "system" && message.subtype === "init") {
          // Isolation guard — the SDK's `init` message enumerates every tool,
          // MCP server, and skill it is exposing to the model. This provider is
          // a zero-tool, text-only surface, so any non-empty set here means
          // something slipped past the isolation options (`tools: []`,
          // `settingSources: []`, `ENABLE_CLAUDEAI_MCP_SERVERS=false`). The
          // `warn` below fires if that regresses — e.g. a CLI predating the
          // opt-out flag, or a future change to connector defaults.
          const mcpServers = message.mcp_servers;
          const mcpTools = message.tools.filter((t) => t.startsWith("mcp__"));
          logger.debug(
            {
              tools: message.tools,
              mcpServers,
              skills: message.skills,
              slashCommandCount: message.slash_commands.length,
              claudeCodeVersion: message.claude_code_version,
              apiKeySource: message.apiKeySource,
            },
            "[claude-subscription] SDK init surface",
          );
          if (mcpServers.length > 0 || mcpTools.length > 0) {
            logger.warn(
              {
                mcpServers: mcpServers.map((s) => `${s.name} (${s.status})`),
                mcpTools,
              },
              "[claude-subscription] SDK exposed MCP servers/tools to the model despite zero-tool config — likely account-level claude.ai connectors",
            );
          }
        } else if (message.type === "assistant" && !(options.stream ?? true)) {
          // Non-streaming path: the SDK still yields the full assistant
          // message at the end; emit the text blocks once.
          const blocks = (message.message?.content ?? []) as Array<{ type: string; text?: string; thinking?: string }>;
          for (const block of blocks) {
            if (block.type === "text" && block.text) {
              yield block.text;
              emittedText = true;
            } else if (block.type === "thinking" && block.thinking && options.onThinking) {
              options.onThinking(block.thinking);
            }
          }
        } else if (message.type === "result") {
          if (message.subtype === "success") {
            sawSuccessResult = true;
            const usage = message.usage ?? null;
            if (usage) {
              inputTokens = usage.input_tokens ?? 0;
              outputTokens = usage.output_tokens ?? 0;
              cachedTokens = usage.cache_read_input_tokens ?? 0;
              cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
            }
            // Prompt-cache economics — a per-request breakdown so cache
            // behavior can be audited and confirmed to be a real saving, not
            // just token-shuffling. Costs are in fresh-input-token equivalents
            // (write 1.25x, read 0.1x, uncached 1x). `savingsPct` < 0 means the
            // cache cost more than it saved this request — expected on the
            // first turn (pure write) or after the 5-minute TTL lapses; across
            // a live multi-turn chat it should trend positive.
            const totalInputTokens = inputTokens + cachedTokens + cacheWriteTokens;
            if (totalInputTokens > 0) {
              const effectiveInputCost =
                inputTokens +
                cacheWriteTokens * CACHE_WRITE_COST_MULTIPLIER +
                cachedTokens * CACHE_READ_COST_MULTIPLIER;
              const savedTokenEquiv = totalInputTokens - effectiveInputCost;
              logger.debug(
                {
                  session: resumeSessionId ?? "fold-path",
                  model: options.model,
                  freshInputTokens: inputTokens,
                  cacheReadTokens: cachedTokens,
                  cacheWriteTokens,
                  outputTokens,
                  cacheHitRatio: Number((cachedTokens / totalInputTokens).toFixed(3)),
                  effectiveInputCostEquiv: Math.round(effectiveInputCost),
                  uncachedInputCostEquiv: totalInputTokens,
                  savedTokenEquiv: Math.round(savedTokenEquiv),
                  savingsPct: Number(((savedTokenEquiv / totalInputTokens) * 100).toFixed(1)),
                  verdict: savedTokenEquiv > 0 ? "cache-saving" : "cache-cost",
                },
                "[claude-subscription] prompt-cache usage",
              );
            }
            // The SDK can bill against a different model than the one we
            // asked for (fast mode, post-rate-limit cooldown, account-tier
            // gating). `modelUsage` is keyed by the model that actually ran,
            // so any key that isn't our requested ID is a silent downgrade
            // worth surfacing.
            const usedModels = Object.keys(message.modelUsage ?? {});
            const fastModeState = message.fast_mode_state;
            finalUsedModels = usedModels;
            finalFastModeState = fastModeState ?? null;
            const billedDifferent = usedModels.length > 0 && !usedModels.includes(options.model);
            if (billedDifferent) {
              logger.warn(
                "[claude-subscription] Requested %s but SDK billed against %s (fast_mode_state=%s, session=%s) — check `claude` CLI fast mode / rate-limit cooldown",
                options.model,
                usedModels.join(", "),
                fastModeState ?? "unknown",
                resumeSessionId ?? "fold-path",
              );
            } else if (fastModeState && fastModeState !== "off") {
              logger.warn(
                "[claude-subscription] fast_mode_state=%s for %s (session=%s) — output may come from a smaller model than requested",
                fastModeState,
                options.model,
                resumeSessionId ?? "fold-path",
              );
            }
            const finalResult = typeof message.result === "string" ? message.result : "";
            if (!emittedText && finalResult.trim()) {
              yield finalResult;
              emittedText = true;
            }
          } else {
            const detail = message.errors?.length ? ` — ${message.errors.join("; ")}` : "";
            throw new Error(`Claude (Subscription) request failed (${message.subtype})${detail}`);
          }
        }
      }
    } catch (err) {
      logger.error(
        err,
        "Claude Agent SDK query failed for model %s (session=%s)",
        options.model,
        resumeSessionId ?? "fold-path",
      );
      const friendly = formatClaudeSdkError(err);
      throw new Error(`Claude (Subscription) request failed: ${friendly}`);
    } finally {
      if (options.signal) options.signal.removeEventListener("abort", onUpstreamAbort);
      // No session-file cleanup: the SDK owns the temp JSONL it materializes
      // from `sessionStore.load()` and reaps it itself. The in-process
      // ResumeSessionStore is just a GC'd object.
    }

    if (!emittedText) {
      const diagnostic = [
        `model=${options.model}`,
        `successResult=${sawSuccessResult}`,
        `inputTokens=${inputTokens}`,
        `outputTokens=${outputTokens}`,
        `fast_mode_state=${finalFastModeState ?? "unknown"}`,
        `billedModels=${finalUsedModels.length ? finalUsedModels.join(",") : "none"}`,
        `HOME=${process.env.HOME ?? "unset"}`,
      ].join(", ");
      logger.warn("[claude-subscription] SDK completed without usable text (%s)", diagnostic);
      throw new Error(
        `Claude (Subscription) returned no content. Check that \`claude login\` was run for the same HOME/user as the Marinara server, then retry with LOG_LEVEL=debug if needed (${diagnostic}).`,
      );
    }

    if (inputTokens || outputTokens) {
      return {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        ...(cachedTokens ? { cachedPromptTokens: cachedTokens } : {}),
        ...(cacheWriteTokens ? { cacheWritePromptTokens: cacheWriteTokens } : {}),
      };
    }
  }

  /**
   * Embeddings are not exposed by the Claude Agent SDK. Surface a clear error
   * so callers can route embedding work to a separate connection.
   */
  override async embed(_texts: string[], _model: string): Promise<number[][]> {
    throw new Error(
      "The Claude (Subscription) provider does not support embeddings. Configure a separate embedding connection (OpenAI, Google, or local).",
    );
  }
}
