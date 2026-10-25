// Professor Mari's optional second runtime, built on the pi SDK: native tool calls instead of the JSON frame.
// It calls Marinara's own provider layer for the model, runs every tool through WorkspaceCommands, and applies
// the same Permissions Mode, claim audit and repeated-failure rules as the classic loop. The sandbox is closed
// on purpose: no pi built-in tools, no resources read from disk, no pi auth/model files, in-memory session.
import { randomUUID } from "node:crypto";
import type {
  AssistantMessage,
  ToolResultMessage,
  AssistantMessageEventStream,
  Message,
  SimpleStreamOptions,
  TranscriptContext,
} from "@earendil-works/pi-ai";
import type { AgentSession, ResourceLoader, ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  MARI_AUTHORIZATION_ACCEPT_CHIP,
  type ChatCompletionResult,
  type ChatMessage,
  type LLMToolDefinition,
  type MariHeldChange,
  type MariPermissionsMode,
  type MariSuggestionChip,
  type MariWorkspaceActionResult,
  type MariWorkspaceTraceItem,
  supportsNativeToolCalls,
} from "@marinara-engine/shared";
import { parseTextualToolCalls, stripTextualToolCalls } from "../llm/textual-tool-call-parser.js";
import {
  appendTraceStatus,
  appendVisibleText,
  appliedMutationReadBackMismatched,
  auditWorkspaceCompletionClaim,
  chunkText,
  dedupeWorkspaceCommandCalls,
  describeHeldCommands,
  emitRoundText,
  formatCommandResultForPrompt,
  isLengthFinishReason,
  isLocalSidecarConnection,
  isMutatingWorkspaceCommand,
  isStagedSensitiveMutation,
  MAX_PROTOCOL_REPAIR_ROUNDS,
  MAX_PROTOCOL_REPAIR_ROUNDS_LOCAL_SIDECAR,
  sanitizePlanSteps,
  sanitizeSuggestionChips,
  createDraftStream,
  scrubInternalNames,
  answerEndsWithQuestion,
  visibleTextAsksApplyPermission,
  workspaceTextClaimsHeldChange,
  workspaceTextClaimsMutationCompletion,
  WORKSPACE_TOOL_DEFINITIONS,
  type PromptEventSink,
  type WorkspaceCommandCall,
  type WorkspaceCommandResult,
  type WorkspaceConnection,
} from "./workspace-agent.service.js";
import type { WorkspaceCommands } from "./workspace-commands.js";
import {
  newRoundReviewState,
  reviewRepeatedFailures,
  reviewRoundClaim,
  shouldDeferRoundMutations,
} from "./workspace-round-review.js";

// ponytail: a generous safety net per run, not a budget. Upgrade path: derive it from the token budget.
export const MAX_PI_TOOL_ROUNDS = 400;

const PI_PROVIDER = "marinara";
const PI_API = "marinara-chat";
const PARALLEL_TOOLS = new Set(["docs_search", "docs_read", "read", "grep", "find", "ls", "suggestions", "plan"]);
const UI_TOOLS = ["suggestions", "plan"] as const;
const HELD_RESULT =
  "HELD for the user's approval; NOT applied. When the user accepts, repeat exactly this call with the same input.";
const NOTHING_HELD = "I did not make or hold any change. Ask me again if you want it made.";
/** A reply cut at the output limit is redone in smaller steps this many times per run, then the run stops. */
export const MAX_OUTPUT_LIMIT_REPAIRS = 2;
const OUTPUT_LIMIT_RETRY =
  "The reply was too long for this model's output limit, so Professor Mari is redoing it in smaller steps.";
const OUTPUT_LIMIT_STOP =
  "Professor Mari's replies kept hitting this model's output limit, so she stopped. Raise Max Output Tokens on the connection, or ask for a smaller piece.";
/** About half a reply's budget in characters (~3 characters per token): room for one call with words around it. */
const CUT_TARGET_CHARS_PER_TOKEN = 1.5;
const HELD_WITHOUT_WORDS = "I have changes ready. Review them below and accept to apply them; nothing was applied yet.";

/** The run state prompt() persists on the saved message; the pi loop writes it, prompt() copies it back. */
export type PiRunState = {
  assistantText: string;
  endedWithDeferral: boolean;
  heldChanges: MariHeldChange[];
  heldCalls: WorkspaceCommandCall[];
  suggestions: MariSuggestionChip[];
};

export type PiRunInput = {
  signal: AbortSignal;
  state: PiRunState;
  /** What buildPromptMessages built: system prompts, then the stored chat ending in the current user message. */
  messages: ChatMessage[];
  connection: WorkspaceConnection;
  permissionsMode: MariPermissionsMode;
  manualApprovalArmed: boolean;
  trace: MariWorkspaceTraceItem[];
  actionResults: MariWorkspaceActionResult[];
  /** Every command result of the run; the claim audit reads it. */
  commandResults: WorkspaceCommandResult[];
  onEvent: PromptEventSink;
  /** One provider call through Marinara's provider layer. */
  complete: (
    messages: ChatMessage[],
    tools: LLMToolDefinition[],
    /** Streamed reply text, when the provider streams; it feeds the provisional draft only. */
    onText?: (delta: string) => void,
  ) => Promise<ChatCompletionResult>;
  setRoundFlags: (flags: { manualSilentMutationBlocked: boolean; askLatchSilentMutationBlocked: boolean }) => void;
  /** Tool rounds allowed in one run; defaults to MAX_PI_TOOL_ROUNDS. Injected only by the regression. */
  maxToolRounds?: number;
  /** The connection's output token limit, when known; the output-limit recovery quotes it. */
  maxOutputTokens?: number;
  /** Called once the session exists, with the tools it really has active. The regression inspects the boundary here. */
  /** #5740: the understood-request record. `record` runs once per round with mutating calls; `settle` after they ran. */
  understood?: {
    record: (text: string | null, mutating: WorkspaceCommandCall[], held: boolean) => void;
    settle: (failed: boolean, staged: boolean) => void;
  };
  onSession?: (session: AgentSession, tools: ToolDefinition[]) => void;
};

type Round = {
  text: string;
  /** Tool calls in order, UI tools included. */
  calls: WorkspaceCommandCall[];
  results: WorkspaceCommandResult[];
  deferred: boolean | null;
  /** The one chips-only round a question without chips gets; only UI tools run in it and its words are dropped. */
  chipRound: boolean;
  truncated: boolean;
  /** A truncated turn whose cut-off calls included a change: the user gets a chip to continue. */
  droppedMutating: boolean;
  /** What a turn cut at the output limit was writing (not a failed stream): it is redone in smaller steps. */
  cut: CutReply | null;
  /** Ids of calls identical to an earlier one in the same turn; they are answered, not run. */
  duplicates: Set<string>;
  /** Provider replay data (Anthropic thinking, Gemini parts, ...) to send back with this turn's assistant message. */
  providerMetadata?: Record<string, unknown>;
};

/**
 * Fail closed: pi keeps its built-in tools registered under an allowlist, so check that every ACTIVE tool is one of
 * Marinara's own definitions (same object, same executor) before the model can call anything.
 */
export function assertClosedToolSet(
  session: Pick<AgentSession, "getActiveToolNames" | "getToolDefinition">,
  tools: readonly ToolDefinition[],
) {
  for (const name of session.getActiveToolNames()) {
    const mine = tools.find((tool) => tool.name === name);
    const registered = session.getToolDefinition(name);
    if (!mine || !registered || registered.execute !== mine.execute) {
      throw new Error(`The pi runtime stopped: tool "${name}" is not one of Professor Mari's own tools.`);
    }
  }
}

const UI_TOOL_SCHEMAS: Record<(typeof UI_TOOLS)[number], { description: string; parameters: Record<string, unknown> }> =
  {
    suggestions: {
      description:
        "Show quick-reply chips under your answer (at most 5). Changes nothing. Each chip: label (short button text), prompt (the exact message sent when tapped), optional detail, entity, tone (danger|caution|success) and action.",
      parameters: {
        type: "object",
        properties: { chips: { type: "array", items: { type: "object" }, maxItems: 6 } },
        required: ["chips"],
      },
    },
    plan: {
      description:
        "Show a guided plan for a vague create or edit request, one step per field. Changes nothing. Each step: fieldKey, question and chips (label, prompt).",
      parameters: {
        type: "object",
        properties: { steps: { type: "array", items: { type: "object" }, maxItems: 8 } },
        required: ["steps"],
      },
    },
  };

// The one call format parseTextualToolCalls reads best; used on connections without native tool calls.
const TEXT_CALL_RE = /<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi;
const textCall = (name: string, args: unknown) => `<tool_call>${JSON.stringify({ name, arguments: args })}</tool_call>`;

function textualToolPrompt(tools: readonly ToolDefinition[]) {
  const docs = tools
    .map((tool) => `- ${tool.name}: ${tool.description}\n  JSON arguments: ${JSON.stringify(tool.parameters)}`)
    .join("\n");
  return `<text_tool_calls>
This connection has no native tool calls. Wherever the rules above say to call a tool, write the call as text instead: one \`<tool_call>{"name":"TOOL","arguments":{...}}</tool_call>\` tag per call, with valid JSON inside. You may write several tags in one reply, after your words. Marinara runs them and answers in the next user message with the results. Never write a tag you do not want to run.
Example: ${textCall("ls", { path: "." })}
Tools:
${docs}
</text_tool_calls>`;
}

/** What a reply cut at the output limit was writing. Only names and a size: the cut-off call itself never runs. */
export type CutReply = { kind: "call" | "thinking" | "prose"; tool?: string; action?: string; chars: number };

export function describeCutReply(
  result: Pick<ChatCompletionResult, "content" | "toolCalls">,
  textual: boolean,
): CutReply {
  const content = result.content ?? "";
  const tagAt = textual ? content.lastIndexOf("<tool_call>") : -1;
  const openTag = tagAt >= 0 && tagAt > content.lastIndexOf("</tool_call>");
  const native = result.toolCalls.at(-1);
  const raw = openTag ? content.slice(tagAt) : native ? native.function.arguments : null;
  if (raw === null) return { kind: content.trim() ? "prose" : "thinking", chars: content.length };
  return {
    kind: "call",
    tool: (openTag ? undefined : native?.function.name) ?? /"name"\s*:\s*"([^"]+)"/u.exec(raw)?.[1],
    action: /"action"\s*:\s*"([\w.]+)"/u.exec(raw)?.[1],
    // Arguments cut before any arrived come back as "{}"; that size says nothing.
    chars: raw.trim() === "{}" ? 0 : raw.length,
  };
}

/** The steered repair for a cut reply. Short lines, one instruction each: small models are the ones that get cut. */
export function outputLimitRepairPrompt(cut: CutReply, attempt: number, maxOutputTokens?: number): string {
  const limit = maxOutputTokens ? ` (about ${maxOutputTokens} tokens)` : "";
  const target = maxOutputTokens ? Math.round(maxOutputTokens * CUT_TARGET_CHARS_PER_TOKEN) : null;
  const quiet =
    "While you work, say nothing about the limit. In your final answer you may mention it in one short, light sentence.";
  const lines = ["[Engine note, not from the user]"];
  if (attempt > 1) lines.push("It was cut off again. Make it much smaller: one field or one item per call.");
  if (cut.kind === "thinking") {
    lines.push(
      `Your last reply was cut off before you wrote anything: your thinking used up this model's output limit${limit}. Nothing ran.`,
      "Think briefly. Pick the next single small step and do it now with one tool call, or answer in a few sentences.",
      quiet,
    );
  } else if (cut.kind === "prose") {
    lines.push(
      `Your last answer was cut off by this model's output limit${limit}.`,
      `Write it again, shorter${target ? `: at most ${target} characters` : ""}. If there is more to say, offer it as a follow-up.`,
    );
  } else {
    const what = cut.tool ? `\`${cut.tool}\`${cut.action ? ` with action \`${cut.action}\`` : ""}` : "a tool call";
    lines.push(
      `Your last reply was cut off: it reached this model's output limit${limit}. Nothing from it ran or was saved.`,
      `You were writing ${what}${cut.chars ? ` (about ${cut.chars} characters)` : ""} when it stopped.`,
      "Do the same work again in smaller pieces:",
      "- Send one tool call per reply.",
      ...(target ? [`- Keep each call under about ${target} characters.`] : []),
      "- Split a big write into several: create it with the main fields, then add the rest with updates.",
      "- Do not redo steps that already succeeded.",
      `- ${quiet}`,
      "Make the first small call now.",
    );
  }
  return lines.join("\n");
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Unparsable arguments reach the tool as {}: schema validation answers the model with an error.
  }
  return {};
}

function textOf(content: string | readonly { type: string; text?: string }[]): string {
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? (part.text ?? "") : "")).join("");
}

export async function runPiLoop(input: PiRunInput & { commands: WorkspaceCommands }): Promise<void> {
  const { signal, state, commands, trace, onEvent } = input;
  const { createAgentSession, createExtensionRuntime, ModelRuntime, SessionManager, SettingsManager } =
    await import("@earendil-works/pi-coding-agent");
  const { InMemoryCredentialStore, createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools } =
    await import("@earendil-works/pi-ai");

  const reviewState = newRoundReviewState();
  // Decided once per connection: only these connections ever parse text as tool calls.
  const textualTools =
    isLocalSidecarConnection(input.connection) || !supportsNativeToolCalls(input.connection.provider);
  const systemPrompt = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const history = input.messages.filter((message) => message.role !== "system");
  const last = history[history.length - 1];
  if (!last || last.role !== "user") throw new Error("The pi runtime needs the current user message last.");
  // Images and files ride on the stored chat messages; pi only sees text, so they are re-attached by text.
  const attachmentsByText = new Map<string, Pick<ChatMessage, "images" | "files">>();
  for (const message of history) {
    if (message.role === "user" && (message.images?.length || message.files?.length)) {
      attachmentsByText.set(message.content, { images: message.images, files: message.files });
    }
  }

  let stopRequested = false;
  let providerError: unknown = null;
  let runAskedForApproval = false;
  let armedSpent = false;
  let heldClaimRepaired = false;
  let chipRepair: "unused" | "pending" | "used" = "unused";
  let planShown = false;
  let toolRounds = 0;
  let limitReached = false;
  let emptyRepairs = 0;
  let outputLimitRepairs = 0;
  const maxEmptyRepairs = isLocalSidecarConnection(input.connection)
    ? MAX_PROTOCOL_REPAIR_ROUNDS_LOCAL_SIDECAR
    : MAX_PROTOCOL_REPAIR_ROUNDS;
  let round: Round | null = null;
  let session: AgentSession | null = null;

  /**
   * One provider call whose words stream to the client as a provisional draft (never saved, never the answer;
   * the audited text still lands as tokens). Each event carries the full scrubbed visible text so far.
   */
  const completeWithDraft = async (messages: ChatMessage[], tools: LLMToolDefinition[], draft: boolean) => {
    const stream = createDraftStream((data) => onEvent({ type: "draft", data }));
    try {
      return await input.complete(messages, tools, draft ? stream.push : undefined);
    } finally {
      stream.end();
    }
  };
  const maxToolRounds = input.maxToolRounds ?? MAX_PI_TOOL_ROUNDS;
  // Replay metadata of each tool turn, by its first tool call id (the id is stable across the transcript).
  const metadataByCallId = new Map<string, Record<string, unknown>>();

  const addNote = (content: string, kind: "retry" | "info" | "output_limit", level: "info" | "warning") => {
    state.assistantText = appendVisibleText(state.assistantText, content);
    appendTraceStatus(trace, content);
    onEvent({ type: "status", data: { content, kind, level } });
    for (const chunk of chunkText(content)) onEvent({ type: "token", data: chunk });
  };
  /** Ends a run on a truncated turn: a chip to continue when a change was dropped, then the note. */
  const stopTruncated = (current: Round, note: string) => {
    if (current.droppedMutating) {
      onEvent({
        type: "suggestions",
        data: [{ id: "authorization-accept", label: "Accept", prompt: "Continue the task.", tone: "success" }],
      });
    }
    addNote(note, "output_limit", "warning");
    stopRequested = true;
    return "done" as const;
  };

  const withToolFormat = (prompt: string) => (textualTools ? `${prompt}\n\n${textualToolPrompt(tools)}` : prompt);

  const toChatMessages = (context: TranscriptContext, asText = textualTools): ChatMessage[] => {
    const out: ChatMessage[] = [];
    const prompt = getCurrentSystemPrompt(context.messages);
    if (prompt) out.push({ role: "system", content: withToolFormat(prompt), contextKind: "prompt" });
    let lastResult: ChatMessage | null = null;
    for (const message of context.messages as Message[]) {
      if (message.role !== "toolResult") lastResult = null;
      if (message.role === "user") {
        const content = textOf(message.content as never);
        out.push({ role: "user", content, contextKind: "history", ...attachmentsByText.get(content) });
      } else if (message.role === "assistant") {
        const toolCalls = message.content.flatMap((part) =>
          part.type === "toolCall"
            ? [
                {
                  id: part.id,
                  type: "function" as const,
                  function: { name: part.name, arguments: JSON.stringify(part.arguments) },
                },
              ]
            : [],
        );
        if (asText) {
          // No tool_calls field for a provider without native calls: the calls are replayed as text.
          const written = message.content.flatMap((part) =>
            part.type === "toolCall" ? [textCall(part.name, part.arguments)] : [],
          );
          out.push({
            role: "assistant",
            content: [textOf(message.content as never), ...written].filter(Boolean).join("\n"),
            contextKind: "history",
          });
          continue;
        }
        const providerMetadata = toolCalls[0] ? metadataByCallId.get(toolCalls[0].id) : undefined;
        out.push({
          role: "assistant",
          content: textOf(message.content as never),
          contextKind: "history",
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          ...(providerMetadata ? { providerMetadata } : {}),
        });
      } else if (message.role === "toolResult" && asText) {
        // Results come back as user messages; several results of one turn share one.
        const previous = out[out.length - 1];
        if (previous && previous === lastResult) previous.content += `\n\n${textOf(message.content)}`;
        else out.push((lastResult = { role: "user", content: textOf(message.content), contextKind: "history" }));
      } else if (message.role === "toolResult") {
        out.push({
          role: "tool",
          tool_call_id: message.toolCallId,
          content: textOf(message.content),
          contextKind: "history",
        });
      }
    }
    return out;
  };

  const streamSimple = (
    model: { api: string; provider: string; id: string },
    context: TranscriptContext,
    _options?: SimpleStreamOptions,
  ): AssistantMessageEventStream => {
    const stream = createAssistantMessageEventStream();
    const message: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };
    void (async () => {
      try {
        stream.push({ type: "start", partial: message });
        const tools = getCurrentTools(context.messages);
        // Summaries from pi's own compaction come through here without tools; only the agent's turns are rounds.
        const isAgentTurn = tools.length > 0;
        if (stopRequested && isAgentTurn) {
          stream.push({ type: "done", reason: "stop", message });
          return;
        }
        signal.throwIfAborted();
        const toolDefs: LLMToolDefinition[] = tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: JSON.parse(JSON.stringify(tool.parameters)),
          },
        }));
        // A textual connection gets no tools in the request: the calls are in the prompt and in the reply text.
        // Only the agent's own turns draft; a chips-only round drops its words, so it shows none.
        const result = await completeWithDraft(
          toChatMessages(context),
          textualTools ? [] : toolDefs,
          isAgentTurn && chipRepair !== "pending",
        );
        // A reply cut short (a stream that failed, or a textual tag left open) may hold half a call: run none.
        // Rounds stream for the live draft, so a failed stream can leave partial words on any connection; an
        // error with no words at all (the Gemini repair) stays an empty answer and gets its retry.
        const truncated =
          isLengthFinishReason(result.finishReason) ||
          (result.finishReason === "error" && (textualTools || Boolean(result.content?.trim()))) ||
          (textualTools &&
            (result.content ?? "").lastIndexOf("<tool_call>") > (result.content ?? "").lastIndexOf("</tool_call>"));
        const reply = textualTools ? textualReply(result.content) : null;
        const parsedCalls = reply?.calls ?? result.toolCalls;
        const shown = scrubInternalNames(reply ? reply.text : (result.content ?? ""));
        const text = shown.trim() ? shown : "";
        // A truncated frame never runs: its tool calls may be cut off mid-argument.
        const calls = truncated ? [] : parsedCalls;
        if (result.usage) {
          message.usage = {
            ...message.usage,
            input: result.usage.promptTokens,
            output: result.usage.completionTokens,
            cacheRead: result.usage.cachedPromptTokens ?? 0,
            totalTokens: result.usage.totalTokens,
          };
        }
        if (text) {
          message.content.push({ type: "text", text });
          stream.push({ type: "text_start", contentIndex: 0, partial: message });
          stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: message });
          stream.push({ type: "text_end", contentIndex: 0, content: text, partial: message });
        }
        const asCall = (call: (typeof calls)[number]): WorkspaceCommandCall => ({
          id: call.id || randomUUID(),
          name: call.function.name as WorkspaceCommandCall["name"],
          arguments: parseArguments(call.function.arguments),
        });
        const allCalls = calls.map(asCall);
        for (const { id, name, arguments: args } of allCalls) {
          const toolCall = { type: "toolCall" as const, id, name, arguments: args as never };
          const index = message.content.length;
          message.content.push(toolCall);
          stream.push({ type: "toolcall_start", contentIndex: index, partial: message });
          stream.push({ type: "toolcall_end", contentIndex: index, toolCall, partial: message });
        }
        // Like classic, an identical call in one turn runs once; pi still needs a result for each call it was given.
        const workspaceCalls = dedupeWorkspaceCommandCalls(allCalls);
        const duplicates = new Set(allCalls.filter((call) => !workspaceCalls.includes(call)).map((call) => call.id));
        const droppedMutating = truncated && parsedCalls.map(asCall).some(isMutatingWorkspaceCommand);
        if (result.providerMetadata && workspaceCalls[0])
          metadataByCallId.set(workspaceCalls[0].id, result.providerMetadata);
        if (isAgentTurn) {
          round = {
            text,
            calls: workspaceCalls,
            results: [],
            deferred: null,
            truncated,
            droppedMutating,
            cut: isLengthFinishReason(result.finishReason)
              ? describeCutReply({ content: result.content, toolCalls: parsedCalls }, textualTools)
              : null,
            duplicates,
            chipRound: chipRepair === "pending",
          };
          if (round.chipRound) chipRepair = "used";
          if (workspaceCalls.length > 0) toolRounds += 1;
        }
        message.stopReason = truncated ? "length" : workspaceCalls.length > 0 ? "toolUse" : "stop";
        stream.push({ type: "done", reason: message.stopReason as "stop" | "length" | "toolUse", message });
      } catch (error) {
        const aborted = signal.aborted;
        if (!aborted) providerError = error;
        message.stopReason = aborted ? "aborted" : "error";
        message.errorMessage = error instanceof Error ? error.message : String(error);
        stream.push({ type: "error", reason: aborted ? "aborted" : "error", error: message });
      }
    })();
    return stream;
  };

  const textualReply = (content: string | null) => {
    const defs: LLMToolDefinition[] = tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters as never },
    }));
    const calls = parseTextualToolCalls(content, defs);
    // Whatever the parser read as a call leaves the visible text; with no call, only a stray (cut-off) tag does.
    return {
      calls,
      text:
        calls.length > 0
          ? stripTextualToolCalls(content ?? "", defs)
          : (content ?? "").replace(TEXT_CALL_RE, "").trim(),
    };
  };

  /**
   * Review one finished model turn (pi's `turn_end`, so it runs whatever happened to the turn's calls): claim audit,
   * then its words, then the repeated-failure stop and the round cap. A repair is returned for the caller to queue.
   */
  const finishRound = (current: Round, toolResults: readonly ToolResultMessage[]) => {
    if (current.chipRound) {
      // The answer before it stands; this round only added chips (or nothing).
      stopRequested = true;
      return "done" as const;
    }
    if (current.calls.length === 0 && !current.text.trim() && !current.truncated) {
      // Same as classic: an empty turn is retried within a budget, then ends with a note.
      emptyRepairs += 1;
      if (emptyRepairs <= maxEmptyRepairs) {
        return {
          kind: "repair" as const,
          prompt:
            "Your previous response was empty. Continue the task now. Call tools when work remains, or write a concise answer for the user.",
        };
      }
      addNote(
        "Professor Mari kept returning an empty response. Please try again; the request and any completed workspace steps remain in this chat.",
        "retry",
        "warning",
      );
      stopRequested = true;
      return "done" as const;
    }
    emptyRepairs = 0;
    // A turn cut at the output limit ran nothing, so no claim audit spends a repair on its half-written words: it is
    // redone smaller, and its words are not kept. Once that budget is spent the run stops with a note. A failed stream
    // is not a limit cut: it is audited like any turn and stops further down.
    if (current.cut) {
      if (outputLimitRepairs < MAX_OUTPUT_LIMIT_REPAIRS) {
        outputLimitRepairs += 1;
        appendTraceStatus(trace, OUTPUT_LIMIT_RETRY);
        onEvent({ type: "status", data: { content: OUTPUT_LIMIT_RETRY, kind: "output_limit", level: "info" } });
        return {
          kind: "repair" as const,
          prompt: outputLimitRepairPrompt(current.cut, outputLimitRepairs, input.maxOutputTokens),
        };
      }
      if (current.text.trim()) {
        state.assistantText = current.text.trim();
        emitRoundText(trace, current.text, onEvent);
      }
      return stopTruncated(current, OUTPUT_LIMIT_STOP);
    }
    const workspaceCalls = current.calls.filter((call) => !isUiTool(call.name));
    const hasWorkspaceCalls = workspaceCalls.length > 0;
    const mutating = workspaceCalls.filter(isMutatingWorkspaceCommand);
    // Only calls that reached the executor have a result yet; a rejected call never counts for the record.
    const reached = new Set(mutating.filter((call) => current.results.some((r) => r.id === call.id)).map((c) => c.id));
    if (!current.deferred && reached.size > 0) {
      input.understood?.settle(
        current.results.some(
          (result) => reached.has(result.id) && (!result.success || appliedMutationReadBackMismatched(result)),
        ),
        current.results.some(isStagedSensitiveMutation),
      );
    }
    if (!current.deferred) {
      // pi answers an unknown tool or invalid arguments itself, so the call never reached runTool: count it as the failed
      // attempt it is, with pi's own error text, so the claim audit and the repeated-failure stop see it.
      for (const call of workspaceCalls) {
        if (current.results.some((result) => result.id === call.id)) continue;
        const rejected = toolResults.find((toolResult) => toolResult.toolCallId === call.id);
        const result: WorkspaceCommandResult = {
          id: call.id,
          name: call.name,
          input: call.arguments,
          output: rejected ? textOf(rejected.content) : "The call was rejected before it ran.",
          success: false,
        };
        input.commandResults.push(result);
        current.results.push(result);
      }
    }
    const action = {
      visibleText: current.text,
      commands: workspaceCalls,
      stop: !hasWorkspaceCalls,
      protocolValid: true,
    };
    if (current.deferred) {
      // Same outcome as classic: the words show, the held changes wait behind Accept, the run ends.
      const content =
        "Deferred hidden mutating workspace commands because the assistant asked the user for approval in the same turn.";
      appendTraceStatus(trace, content);
      onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
      // A silent hold still needs words on the saved message: they carry the deferral flag and the held changes.
      // Held calls were not applied, so words that say they were are replaced.
      const words =
        current.text.trim() && !workspaceTextClaimsMutationCompletion(current.text)
          ? current.text.trim()
          : HELD_WITHOUT_WORDS;
      state.assistantText = words;
      emitRoundText(trace, words, onEvent);
      state.suggestions = [
        MARI_AUTHORIZATION_ACCEPT_CHIP,
        ...state.suggestions.filter((chip) => chip.id !== MARI_AUTHORIZATION_ACCEPT_CHIP.id),
      ];
      onEvent({ type: "suggestions", data: state.suggestions });
      stopRequested = true;
      return "done" as const;
    }
    const decision = reviewRoundClaim(reviewState, {
      action,
      commandResultsForContinuity: input.commandResults,
      truncated: current.truncated,
    });
    if (decision.kind === "repair") return decision;
    if (decision.kind === "stop") {
      addNote(decision.content, "retry", "warning");
      stopRequested = true;
      return "done" as const;
    }
    // A final answer that says a change is held, when nothing was held, is false: one repair, then an honest line.
    // Not after an applied change: a summary of real work must not be replaced by "nothing changed".
    const appliedAny = input.commandResults.some(
      (result) =>
        result.success && isMutatingWorkspaceCommand({ id: result.id, name: result.name, arguments: result.input }),
    );
    if (!hasWorkspaceCalls && !state.endedWithDeferral && !appliedAny && workspaceTextClaimsHeldChange(current.text)) {
      if (!heldClaimRepaired) {
        heldClaimRepaired = true;
        return {
          kind: "repair" as const,
          prompt:
            "Nothing is held and no change card exists. Either make the change now with the tools, or say plainly that it was not made.",
        };
      }
      state.assistantText = NOTHING_HELD;
      emitRoundText(trace, NOTHING_HELD, onEvent);
      stopRequested = true;
      return "done" as const;
    }
    if (current.text.trim()) {
      if (visibleTextAsksApplyPermission(current.text)) runAskedForApproval = true;
      state.assistantText = current.text.trim();
      emitRoundText(trace, current.text, onEvent);
      if (current.results.length > 0 && hasWorkspaceCalls) onEvent({ type: "metadata", data: { narration: true } });
    }
    if (current.truncated) {
      return stopTruncated(
        current,
        "Professor Mari hit the model output limit. Ask her to continue and she can pick up from here.",
      );
    }
    // Same as classic (Slice 70): an answer that ends on a question with no chips and no plan gets one chips-only round.
    if (
      current.calls.length === 0 &&
      chipRepair === "unused" &&
      !planShown &&
      state.suggestions.length === 0 &&
      answerEndsWithQuestion(current.text)
    ) {
      chipRepair = "pending";
      return {
        kind: "repair" as const,
        prompt:
          "Your answer ends with a question but offers no chips. Call only the `suggestions` tool now: 2-4 chips, each one a possible answer to that question (for a list of proposals: apply all, then the main single ones), label under 40 characters. Write no text.",
      };
    }
    if (current.calls.length === 0) return "done" as const;
    const repeatedFailure = reviewRepeatedFailures(reviewState, current.results);
    if (repeatedFailure !== null) {
      addNote(repeatedFailure, "retry", "warning");
      stopRequested = true;
    } else if (toolRounds >= maxToolRounds) {
      // The final summary and the note follow once pi's loop has ended.
      limitReached = true;
      stopRequested = true;
    }
    return "done" as const;
  };

  /** Same as classic at its round limit: one last answer with no tools, audited like any completion claim. */
  const summarizeAtLimit = async (finished: AgentSession) => {
    signal.throwIfAborted();
    // No provider has a "no tools" choice, and some reject tool history sent without tools: the history goes as text.
    const messages: ChatMessage[] = [
      { role: "system", content: withToolFormat(systemPrompt), contextKind: "prompt" },
      ...toChatMessages({ messages: finished.messages } as never, true).filter((message) => message.role !== "system"),
      {
        role: "user",
        content:
          "You reached the tool round limit. Do not call more tools. Summarize what you learned or what remains blocked.",
        contextKind: "history",
      },
    ];
    const result = await completeWithDraft(messages, [], true);
    signal.throwIfAborted();
    // Calls in this turn never run; they only decide which line the user reads.
    const reply = textualTools ? textualReply(result.content) : null;
    const text = scrubInternalNames(reply ? reply.text : (result.content ?? "")).trim();
    const tried = (reply?.calls ?? result.toolCalls).length > 0;
    const issue = auditWorkspaceCompletionClaim({ visibleText: text, commands: [], stop: true }, input.commandResults, {
      auditFrom: reviewState.claimAuditWatermark,
      hadPassedClaimAudit: reviewState.hadPassedClaimAudit,
      lastPassedClaimText: reviewState.lastPassedClaimText,
    }).issue;
    if (issue) {
      addNote(
        "Professor Mari reached the tool round limit without verification, so I stopped before showing an unsupported completion claim. Ask her to continue from the saved trace.",
        "retry",
        "warning",
      );
    } else if (text) {
      state.assistantText = text;
      emitRoundText(trace, text, onEvent);
    } else if (tried) {
      addNote(
        "Professor Mari tried to call more tools after the round limit, so I stopped the loop. Ask her to continue if you want her to keep working from the saved trace.",
        "info",
        "warning",
      );
    }
    addNote(
      "Tool round limit reached for this run. Ask Professor Mari to continue and she can pick up from here.",
      "info",
      "warning",
    );
  };

  const runTool = async (name: string, toolCallId: string, params: Record<string, unknown>) => {
    const current = round;
    if (!current) throw new Error("A tool ran outside a model round.");
    // Before the hold logic: a chips-only round must not hold or run anything.
    if (current.chipRound && !isUiTool(name)) {
      return {
        content: [{ type: "text" as const, text: "Only the suggestions tool can run in this turn." }],
        details: {},
        isError: true,
        terminate: true,
      };
    }
    if (current.duplicates.has(toolCallId)) {
      return {
        content: [
          { type: "text" as const, text: "Duplicate call, skipped: an identical call in this turn already ran." },
        ],
        details: {},
        isError: false,
        // Like the call it repeats: a turn that only showed chips next to its words is a final answer.
        ...(current.calls.every((entry) => isUiTool(entry.name)) && current.text.trim() ? { terminate: true } : {}),
      };
    }
    const call = current.calls.find((entry) => entry.id === toolCallId) ?? {
      id: toolCallId,
      name: name as never,
      arguments: params,
    };
    const onlyUiTools = current.calls.every((entry) => isUiTool(entry.name));
    if (current.deferred === null) {
      const mutating = current.calls.filter((entry) => !isUiTool(entry.name) && isMutatingWorkspaceCommand(entry));
      // Manual always holds an un-approved mutation, with or without words: a model that thinks instead of writing
      // would otherwise be refused in a loop. Only the run right after the user's Accept may apply silently.
      // The Accept pass covers only the first round with a mutating call, and never a run that already asked.
      // ponytail: the Accept button applies the stored held calls server-side, so this armed pass only serves typed
      // replies ("yes"), and there the approval is tied to the turn, not to the exact held calls.
      const armedManual =
        input.permissionsMode === "manual" && input.manualApprovalArmed && !armedSpent && !runAskedForApproval;
      if (armedManual && mutating.length > 0) armedSpent = true;
      const holdSilentManual =
        input.permissionsMode === "manual" && mutating.length > 0 && !current.text && !armedManual;
      // That round's calls apply, with or without words, unless the words ask a new question.
      current.deferred = armedManual
        ? mutating.length > 0 && visibleTextAsksApplyPermission(current.text)
        : holdSilentManual ||
          shouldDeferRoundMutations({
            permissionsMode: input.permissionsMode,
            parsedAction: { visibleText: current.text, awaitingAuthorization: false, commands: mutating },
            runAskedForApproval,
          });
      if (mutating.length > 0)
        input.understood?.record(current.text.trim().slice(0, 2000) || null, mutating, current.deferred);
      if (current.deferred) {
        state.endedWithDeferral = true;
        state.heldChanges = describeHeldCommands(mutating);
        state.heldCalls = mutating;
        // The held calls ride in the hidden continuity record, so the Accept run repeats exactly them.
        for (const call of mutating) {
          input.commandResults.push({
            id: call.id,
            name: call.name,
            input: call.arguments,
            output: HELD_RESULT,
            success: false,
          });
        }
      } else {
        const silent = !current.text;
        input.setRoundFlags({
          manualSilentMutationBlocked: input.permissionsMode === "manual" && silent && !armedManual,
          askLatchSilentMutationBlocked:
            runAskedForApproval && silent && input.permissionsMode !== "manual" && input.permissionsMode !== "bypass",
        });
      }
    }
    let text: string;
    let isError = false;
    if (name === "suggestions") {
      const chips = sanitizeSuggestionChips(params.chips).map((chip) => ({
        ...chip,
        label: scrubInternalNames(chip.label),
        ...(chip.detail ? { detail: scrubInternalNames(chip.detail) } : {}),
      }));
      if (chips.length > 0) {
        state.suggestions = chips;
        onEvent({ type: "suggestions", data: chips });
      }
      text = chips.length > 0 ? "Chips shown." : "No valid chips; nothing was shown.";
    } else if (name === "plan") {
      const steps = sanitizePlanSteps(params.steps);
      if (steps.length > 0) {
        planShown = true;
        onEvent({ type: "plan", data: steps });
      }
      text = steps.length > 0 ? "Plan shown." : "No valid plan steps; nothing was shown.";
    } else if (current.deferred) {
      text = "Held: this change waits for the user's Accept and was not applied. Do not repeat it.";
    } else {
      const result = await commands.executeWorkspaceCommand(call, signal, trace, onEvent, input.actionResults);
      input.commandResults.push(result);
      current.results.push(result);
      // The executor's refusals are shared with the JSON runtime and name its `say` field; say it in pi's words.
      text = formatCommandResultForPrompt([result]);
      if (!result.success) {
        text = text.replace(
          /in say WITH the commands in the same response/gu,
          "as text in the same turn as the tool calls",
        );
      }
      isError = !result.success;
    }
    // A turn with words that only showed chips or a plan is a final answer: end it here instead of paying for another model round.
    return {
      content: [{ type: "text" as const, text }],
      details: {},
      isError,
      ...(current.chipRound || (onlyUiTools && current.text.trim()) ? { terminate: true } : {}),
    };
  };

  const tools: ToolDefinition[] = [
    ...WORKSPACE_TOOL_DEFINITIONS.map((definition) => ({
      name: definition.name as string,
      description: definition.description,
      parameters: definition.parameters,
    })),
    ...UI_TOOLS.map((name) => ({ name: name as string, ...UI_TOOL_SCHEMAS[name] })),
  ].map(
    (tool) =>
      ({
        name: tool.name,
        label: tool.name,
        description: tool.description,
        // Plain JSON Schema, validated by pi before execute.
        parameters: tool.parameters as never,
        // Pure read tools may run together; any other call in the turn makes pi run the whole turn in order.
        executionMode: PARALLEL_TOOLS.has(tool.name) ? "parallel" : "sequential",
        execute: (toolCallId: string, params: unknown) =>
          runTool(tool.name, toolCallId, params as Record<string, unknown>),
      }) satisfies ToolDefinition,
  );

  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: null,
    refreshOnCreate: false,
  });
  const modelId = input.connection.model || "model";
  modelRuntime.registerProvider(PI_PROVIDER, {
    api: PI_API as never,
    baseUrl: "http://marinara.invalid",
    apiKey: "unused",
    streamSimple: streamSimple as never,
    models: [
      {
        id: modelId,
        name: modelId,
        // Thinking stays with the provider layer and the connection's own settings; pi never asks for it.
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: input.connection.maxContext || 128_000,
        maxTokens: 16_384,
      },
    ],
  });
  const model = modelRuntime.getModel(PI_PROVIDER, modelId);
  if (!model) throw new Error("The pi runtime could not register the Marinara model.");

  // Nothing is discovered or loaded from disk: no extensions, skills, prompt templates, themes or context files.
  const resourceLoader: ResourceLoader = {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };

  const cwd = commands.workspaceRoot;
  // ponytail: the session starts from the stored chat every turn, so a compaction summary does not persist
  // across turns. Upgrade path: store the summary with the chat and seed it here.
  const sessionManager = SessionManager.inMemory(cwd);
  const zeroUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
  history.slice(0, -1).forEach((message, index) => {
    const timestamp = index + 1;
    if (message.role === "user") sessionManager.appendMessage({ role: "user", content: message.content, timestamp });
    else if (message.role === "assistant") {
      sessionManager.appendMessage({
        role: "assistant",
        content: [{ type: "text", text: message.content }],
        api: PI_API,
        provider: PI_PROVIDER,
        model: modelId,
        usage: zeroUsage,
        stopReason: "stop",
        timestamp,
      } as never);
    }
  });

  ({ session } = await createAgentSession({
    cwd,
    agentDir: cwd,
    model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader,
    sessionManager,
    // Marinara's own rate-limit layer retries; pi compacts long runs.
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: true }, retry: { enabled: false } }),
    // Security boundary: no pi built-in tools, only the allowlisted Marinara tools below.
    noTools: "builtin",
    tools: tools.map((tool) => tool.name),
    customTools: tools,
  }));
  const onAbort = () => void session?.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    assertClosedToolSet(session, tools);
    input.onSession?.(session, tools);
    // Agent listeners are awaited, so the review and a queued repair land before pi's next step.
    session.agent.subscribe((event) => {
      if (event.type !== "turn_end" || event.message.role !== "assistant") return;
      const finished = round;
      round = null;
      if (!finished || event.message.stopReason === "error" || event.message.stopReason === "aborted") return;
      const decision = finishRound(finished, event.toolResults);
      if (decision !== "done") {
        session!.agent.steer({
          role: "user",
          content: [{ type: "text", text: decision.prompt }],
          timestamp: Date.now(),
        });
      }
    });
    await session.prompt(last.content, { expandPromptTemplates: false });
    if (providerError) throw providerError;
    if (signal.aborted) throw new Error("aborted");
    if (limitReached) await summarizeAtLimit(session);
  } finally {
    signal.removeEventListener("abort", onAbort);
    session.dispose();
  }
}

function isUiTool(name: string): boolean {
  return (UI_TOOLS as readonly string[]).includes(name);
}
