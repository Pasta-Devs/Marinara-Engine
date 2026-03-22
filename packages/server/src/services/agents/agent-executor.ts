// ──────────────────────────────────────────────
// Agent Executor — Single & Batched LLM execution
// ──────────────────────────────────────────────
import type { BaseLLMProvider, ChatMessage, LLMToolDefinition, LLMToolCall } from "../llm/base-provider.js";
import type { AgentResult, AgentContext, AgentResultType } from "@marinara-engine/shared";
import { getDefaultAgentPrompt } from "@marinara-engine/shared";

/** Minimal agent config needed for execution. */
export interface AgentExecConfig {
  id: string;
  type: string;
  name: string;
  phase: string;
  promptTemplate: string;
  connectionId: string | null;
  settings: Record<string, unknown>;
}

/** Optional tool context for agents that need function calling. */
export interface AgentToolContext {
  tools: LLMToolDefinition[];
  executeToolCall: (call: LLMToolCall) => Promise<string>;
}

/**
 * Execute a single agent: build prompt → call LLM → parse response.
 * If toolContext is provided, the agent can make tool calls in a loop.
 */
export async function executeAgent(
  config: AgentExecConfig,
  context: AgentContext,
  provider: BaseLLMProvider,
  model: string,
  toolContext?: AgentToolContext,
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    // Build the agent's system prompt
    const template = config.promptTemplate || getDefaultAgentPrompt(config.type);
    if (!template) {
      return makeError(config, "No prompt template configured", startTime);
    }

    // Build multi-turn message array for this agent
    const messages = buildAgentMessages(template, context, config.type);

    // Agents use lower temperature for reliability
    const temperature = (config.settings.temperature as number) ?? 0.3;
    const maxTokens = Math.max((config.settings.maxTokens as number) ?? 4096, 16384);

    // If tools are available, use the tool call loop
    if (toolContext && toolContext.tools.length > 0) {
      return executeAgentWithTools(
        config,
        messages,
        provider,
        model,
        temperature,
        maxTokens,
        toolContext,
        startTime,
        context.signal,
      );
    }

    // Call LLM (streaming to avoid proxy timeouts, no tools)
    let responseText = "";
    const result = await provider.chatComplete(messages, {
      model,
      temperature,
      maxTokens,
      onToken: (chunk) => {
        responseText += chunk;
      },
      signal: context.signal,
    });

    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    const durationMs = Date.now() - startTime;

    // Parse the result based on agent type
    const parsed = parseAgentResponse(config.type, responseText);

    return {
      agentId: config.id,
      agentType: config.type,
      type: parsed.type,
      data: parsed.data,
      tokensUsed: result.usage?.totalTokens ?? 0,
      durationMs,
      success: true,
      error: null,
    };
  } catch (err) {
    return makeError(config, extractErrorMessage(err), startTime);
  }
}

/**
 * Execute an agent with tool-calling support.
 * Loops: call LLM → handle tool calls → feed results back → repeat until final response.
 */
async function executeAgentWithTools(
  config: AgentExecConfig,
  initialMessages: ChatMessage[],
  provider: BaseLLMProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  toolContext: AgentToolContext,
  startTime: number,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const MAX_TOOL_ROUNDS = 5;
  const loopMessages = [...initialMessages];
  let totalTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await provider.chatComplete(loopMessages, {
      model,
      temperature,
      maxTokens,
      tools: toolContext.tools,
      signal,
    });

    totalTokens += result.usage?.totalTokens ?? 0;

    // No tool calls → final response
    if (!result.toolCalls || result.toolCalls.length === 0) {
      const responseText = result.content?.trim() ?? "";
      const parsed = parseAgentResponse(config.type, responseText);
      return {
        agentId: config.id,
        agentType: config.type,
        type: parsed.type,
        data: parsed.data,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        success: true,
        error: null,
      };
    }

    // Append assistant message with tool calls
    loopMessages.push({
      role: "assistant",
      content: result.content ?? "",
      tool_calls: result.toolCalls,
    });

    // Execute each tool call and append results
    for (const tc of result.toolCalls) {
      const toolResult = await toolContext.executeToolCall(tc);
      loopMessages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: tc.id,
      });
    }
  }

  // Exhausted tool rounds — make one final call without tools to get JSON response
  const finalResult = await provider.chatComplete(loopMessages, { model, temperature, maxTokens, signal });
  totalTokens += finalResult.usage?.totalTokens ?? 0;
  const responseText = finalResult.content?.trim() ?? "";
  const parsed = parseAgentResponse(config.type, responseText);
  return {
    agentId: config.id,
    agentType: config.type,
    type: parsed.type,
    data: parsed.data,
    tokensUsed: totalTokens,
    durationMs: Date.now() - startTime,
    success: true,
    error: null,
  };
}

// ──────────────────────────────────────────────
// Batched Execution — Multiple agents in one LLM call
// ──────────────────────────────────────────────

/**
 * Execute multiple agents in a single LLM call.
 * Combines all agent prompts into one request using XML-delimited sections,
 * then parses the combined response back into individual AgentResults.
 *
 * All agents in the batch MUST share the same provider+model.
 * Falls back to individual calls if the batch response can't be parsed.
 */
export async function executeAgentBatch(
  configs: AgentExecConfig[],
  context: AgentContext,
  provider: BaseLLMProvider,
  model: string,
): Promise<AgentResult[]> {
  if (configs.length === 0) return [];
  if (configs.length === 1) {
    console.log(`[agent-batch] Only 1 agent (${configs[0]!.type}), running individually`);
    return [await executeAgent(configs[0]!, context, provider, model)];
  }

  console.log(`[agent-batch] Batching ${configs.length} agents: [${configs.map((c) => c.type).join(", ")}]`);

  const startTime = Date.now();

  try {
    // Build merged system prompt
    const systemPrompt = buildBatchSystemPrompt(configs);
    const messages = buildAgentMessages(systemPrompt, context, "__batch__");

    // Each agent needs enough room for its full JSON output.
    // Use a generous floor (16384) so the model never runs out mid-response.
    const maxTokensPerAgent = Math.max(...configs.map((c) => (c.settings.maxTokens as number) ?? 4096));
    const temperature = Math.min(...configs.map((c) => (c.settings.temperature as number) ?? 0.3));
    const batchMaxTokens = Math.max(maxTokensPerAgent * configs.length, 16384);
    console.log(
      `[agent-batch] maxTokens: ${batchMaxTokens} (${maxTokensPerAgent} × ${configs.length} agents, floor 16384)`,
    );

    // Use streaming (onToken) to keep the connection alive — avoids proxy
    // timeouts (e.g. Cloudflare 524) on large batch responses.
    let responseText = "";
    const result = await provider.chatComplete(messages, {
      model,
      temperature,
      maxTokens: batchMaxTokens,
      onToken: (chunk) => {
        responseText += chunk;
      },
      signal: context.signal,
    });

    // chatComplete also accumulates content, but streaming via onToken is
    // the primary path — use whichever is populated.
    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    const durationMs = Date.now() - startTime;
    const totalTokens = result.usage?.totalTokens ?? 0;

    console.log(`[agent-batch] Got response (${responseText.length} chars, ${durationMs}ms, ${totalTokens} tokens)`);
    console.log(`[agent-batch] Response preview: ${responseText.slice(0, 500)}`);

    // Parse the batched response into individual results
    const { parsed, failed } = parseBatchResponse(configs, responseText, durationMs, totalTokens);

    console.log(
      `[agent-batch] Batch parse: ${parsed.length} parsed, ${failed.length} failed`,
      failed.length > 0 ? `Failed: [${failed.map((f) => f.type).join(", ")}]` : "",
    );

    // Retry failed agents individually (batch fallback)
    if (failed.length > 0) {
      console.log(`[agent-batch] Retrying ${failed.length} failed agents individually...`);
      const retrySettled = await Promise.allSettled(
        failed.map((config) => executeAgent(config, context, provider, model)),
      );
      const retries: AgentResult[] = [];
      for (let i = 0; i < retrySettled.length; i++) {
        const entry = retrySettled[i]!;
        if (entry.status === "fulfilled") {
          retries.push(entry.value);
        } else {
          // Individual retry also failed — produce error result
          console.error(`[agent-batch] Individual retry FAILED for ${failed[i]!.type}:`, entry.reason);
          retries.push(
            makeError(failed[i]!, entry.reason instanceof Error ? entry.reason.message : "Retry failed", startTime),
          );
        }
      }
      return [...parsed, ...retries];
    }

    return parsed;
  } catch (err) {
    // On failure, return errors for all agents in the batch
    const errMsg = err instanceof Error ? err.message : "Batch execution failed";
    console.error(`[agent-batch] Batch call FAILED: ${errMsg}`);
    return configs.map((c) => makeError(c, errMsg, startTime));
  }
}

/**
 * Build a combined system prompt that instructs the model to produce
 * output for all agents in clearly delimited sections.
 */
function buildBatchSystemPrompt(configs: AgentExecConfig[]): string {
  const parts: string[] = [];

  parts.push(
    `You are a multi-purpose analysis agent that combines the roles of ${configs.length} specialized agents into a SINGLE response.`,
    `You MUST perform ALL of the following tasks and output results in the exact XML format shown below.`,
    ``,
    `─── YOUR TASKS ───`,
  );

  for (const config of configs) {
    const template = config.promptTemplate || getDefaultAgentPrompt(config.type);
    parts.push(``, `<agent_task id="${config.type}" name="${config.name}">`, template, `</agent_task>`);
  }

  parts.push(
    ``,
    `─── REQUIRED OUTPUT FORMAT ───`,
    `You MUST wrap each task's output in a <result> tag with the agent ID. Output ALL ${configs.length} result blocks:`,
    ``,
  );

  for (const config of configs) {
    const isJson = JSON_AGENTS.has(config.type);
    parts.push(
      `<result agent="${config.type}">`,
      isJson ? `{ ... valid JSON ... }` : `... your text output ...`,
      `</result>`,
      ``,
    );
  }

  parts.push(
    `CRITICAL RULES:`,
    `- You MUST output ALL ${configs.length} <result> blocks. Missing any is a failure. Count them before finishing.`,
    `- Use the exact agent IDs: ${configs.map((c) => c.type).join(", ")}.`,
    `- JSON agents MUST output valid JSON (no markdown fences inside the tags).`,
    `- Text agents output plain text.`,
    `- Do not add any text outside the <result> blocks.`,
    `- CHECKLIST — verify you included ALL of these before stopping: ${configs.map((c) => `<result agent="${c.type}">`).join(" , ")}`,
  );

  return parts.join("\n");
}

/**
 * Parse a batched LLM response into individual AgentResults.
 * Looks for <result agent="type">...</result> blocks.
 */
function parseBatchResponse(
  configs: AgentExecConfig[],
  responseText: string,
  totalDurationMs: number,
  totalTokens: number = 0,
): { parsed: AgentResult[]; failed: AgentExecConfig[] } {
  const perAgentDuration = Math.round(totalDurationMs / configs.length);
  const perAgentTokens = Math.round(totalTokens / configs.length);
  const parsed: AgentResult[] = [];
  const failed: AgentExecConfig[] = [];

  for (const config of configs) {
    const escaped = escapeRegex(config.type);
    // Try several patterns the model might use:
    // 1. <result agent="type">...</result>
    // 2. <result agent='type'>...</result>
    // 3. <result agent=type>...</result>  (unquoted)
    // 4. <result_type>...</result_type>   (underscore variant)
    // 5. <type>...</type>                 (bare agent ID as tag)
    //
    // We use GREEDY match ([\s\S]*) with a lookahead for the closing tag
    // or the next <result to avoid stopping at a </result> inside JSON strings.
    const patterns = [
      new RegExp(
        `<result\\s+agent\\s*=\\s*["']${escaped}["']\\s*>([\\s\\S]*?)</result\\s*>(?=\\s*(?:<result\\b|$))`,
        "i",
      ),
      new RegExp(`<result\\s+agent\\s*=\\s*["']${escaped}["']\\s*>([\\s\\S]*?)</result>`, "i"),
      new RegExp(`<result\\s+agent\\s*=\\s*${escaped}\\s*>([\\s\\S]*?)</result>`, "i"),
      new RegExp(`<result_${escaped}>([\\s\\S]*?)</result_${escaped}>`, "i"),
      new RegExp(`<${escaped}>([\\s\\S]*?)</${escaped}>`, "i"),
    ];

    let matchedOutput: string | null = null;
    for (const pattern of patterns) {
      const match = responseText.match(pattern);
      if (match) {
        matchedOutput = match[1]!.trim();
        break;
      }
    }

    if (matchedOutput !== null) {
      const parsedResult = parseAgentResponse(config.type, matchedOutput);
      parsed.push({
        agentId: config.id,
        agentType: config.type,
        type: parsedResult.type,
        data: parsedResult.data,
        tokensUsed: perAgentTokens,
        durationMs: perAgentDuration,
        success: true,
        error: null,
      });
    } else {
      // Could not find this agent's output — mark for individual retry
      failed.push(config);
    }
  }

  return { parsed, failed };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Helpers ──

function makeError(config: AgentExecConfig, error: string, startTime: number): AgentResult {
  return {
    agentId: config.id,
    agentType: config.type,
    type: AGENT_RESULT_TYPE_MAP[config.type] ?? "context_injection",
    data: null,
    tokensUsed: 0,
    durationMs: Date.now() - startTime,
    success: false,
    error,
  };
}

/** Extract a useful message from fetch/network errors (preserves err.cause). */
export function extractErrorMessage(err: unknown, fallback = "Agent execution failed"): string {
  if (!(err instanceof Error)) return fallback;
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${err.message}: ${cause.message}`;
  }
  return err.message || fallback;
}

/**
 * Build the full multi-turn message array for an agent call.
 *
 * Layout:
 *   1. System   — the agent's own prompt template (or merged batch prompt)
 *   2. User     — structured context (characters, persona, game state, memory, …)
 *   3. User/Assistant turns — recent chat history as proper multi-turn messages,
 *      with committed tracker data appended to assistant messages
 *   4. User     — final instruction (assistant response for post-processing, agent results, etc.)
 */
function buildAgentMessages(systemPrompt: string, context: AgentContext, agentType: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // ── 1. Structured context (user message) ──
  const ctxParts: string[] = [];

  ctxParts.push(`<chat_info>`);
  ctxParts.push(`Chat ID: ${context.chatId}`);
  ctxParts.push(`Mode: ${context.chatMode}`);
  ctxParts.push(`</chat_info>`);

  if (context.characters.length > 0) {
    ctxParts.push(`\n<characters>`);
    for (const char of context.characters) {
      ctxParts.push(`- ${char.name}: ${char.description.slice(0, 2000)}`);
    }
    ctxParts.push(`</characters>`);
  }

  if (context.persona) {
    ctxParts.push(`\n<user_persona>`);
    ctxParts.push(`Name: ${context.persona.name}`);
    if (context.persona.description) ctxParts.push(context.persona.description.slice(0, 2000));
    if (context.persona.personaStats?.enabled && context.persona.personaStats.bars.length > 0) {
      ctxParts.push(`\nConfigured persona stat bars:`);
      for (const bar of context.persona.personaStats.bars) {
        ctxParts.push(`- ${bar.name}: ${bar.value}/${bar.max} (color: ${bar.color})`);
      }
    }
    ctxParts.push(`</user_persona>`);
  }

  if (context.gameState) {
    ctxParts.push(`\n<current_game_state>`);
    ctxParts.push(JSON.stringify(context.gameState, null, 2));
    ctxParts.push(`</current_game_state>`);
  }

  if (Object.keys(context.memory).length > 0) {
    ctxParts.push(`\n<agent_memory>`);
    ctxParts.push(JSON.stringify(context.memory, null, 2));
    ctxParts.push(`</agent_memory>`);
  }

  if (context.activatedLorebookEntries && context.activatedLorebookEntries.length > 0) {
    ctxParts.push(`\n<lorebook_entries>`);
    for (const entry of context.activatedLorebookEntries) {
      ctxParts.push(`[${entry.tag}] ${entry.name}: ${entry.content}`);
    }
    ctxParts.push(`</lorebook_entries>`);
  }

  if (context.memory._availableSprites) {
    const sprites = context.memory._availableSprites as Array<{
      characterId: string;
      characterName: string;
      expressions: string[];
    }>;
    ctxParts.push(`\n<available_sprites>`);
    for (const char of sprites) {
      ctxParts.push(`${char.characterName} (${char.characterId}): ${char.expressions.join(", ")}`);
    }
    ctxParts.push(`</available_sprites>`);
  }

  if ((agentType === "background" || agentType === "__batch__") && context.memory._availableBackgrounds) {
    const bgs = context.memory._availableBackgrounds as Array<{
      filename: string;
      originalName?: string | null;
      tags: string[];
    }>;
    ctxParts.push(`\n<available_backgrounds>`);
    for (const bg of bgs) {
      const label = bg.originalName ? `${bg.filename} (${bg.originalName})` : bg.filename;
      const tagStr = bg.tags.length > 0 ? ` [tags: ${bg.tags.join(", ")}]` : "";
      ctxParts.push(`- ${label}${tagStr}`);
    }
    ctxParts.push(`</available_backgrounds>`);
    if (context.memory._currentBackground) {
      ctxParts.push(`\n<current_background>${context.memory._currentBackground}</current_background>`);
    }
  }

  if (context.memory._sourceMaterial) {
    const material = context.memory._sourceMaterial as string;
    ctxParts.push(`\n<source_material>`);
    ctxParts.push(material);
    ctxParts.push(`</source_material>`);
  }

  if (context.memory._chunkInfo) {
    const info = context.memory._chunkInfo as { current: number; total: number };
    ctxParts.push(
      `\n<chunk_info>Chunk ${info.current} of ${info.total} — extract relevant information from this chunk.</chunk_info>`,
    );
  }

  if (context.memory._previousExtractions) {
    const extractions = context.memory._previousExtractions as string[];
    ctxParts.push(`\n<previous_extractions>`);
    ctxParts.push(
      `The following relevant excerpts were extracted from prior chunks of the same source material. Consolidate them into a single, coherent summary along with any new relevant information from the current chunk.`,
    );
    for (let i = 0; i < extractions.length; i++) {
      ctxParts.push(`\n--- Chunk ${i + 1} ---`);
      ctxParts.push(extractions[i]!);
    }
    ctxParts.push(`</previous_extractions>`);
  }

  messages.push({ role: "user", content: ctxParts.join("\n") });

  // ── 2. Chat history as proper multi-turn messages ──
  if (context.recentMessages.length > 0) {
    for (const msg of context.recentMessages) {
      const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";
      let content = msg.content.slice(0, 2000);

      // Append committed tracker data to assistant messages
      if (msg.gameState) {
        const gs = msg.gameState;
        const trackerSummary: Record<string, unknown> = {};
        if (gs.date || gs.time || gs.location || gs.weather || gs.temperature) {
          trackerSummary.scene = {
            ...(gs.date ? { date: gs.date } : {}),
            ...(gs.time ? { time: gs.time } : {}),
            ...(gs.location ? { location: gs.location } : {}),
            ...(gs.weather ? { weather: gs.weather } : {}),
            ...(gs.temperature ? { temperature: gs.temperature } : {}),
          };
        }
        if (gs.presentCharacters?.length) trackerSummary.presentCharacters = gs.presentCharacters;
        if (gs.recentEvents?.length) trackerSummary.recentEvents = gs.recentEvents;
        if (gs.playerStats) trackerSummary.playerStats = gs.playerStats;
        if (gs.personaStats?.length) trackerSummary.personaStats = gs.personaStats;
        if (Object.keys(trackerSummary).length > 0) {
          content += `\n\n<committed_tracker_state>\n${JSON.stringify(trackerSummary, null, 2)}\n</committed_tracker_state>`;
        }
      }

      // Merge consecutive messages with the same role (API requirement)
      const last = messages[messages.length - 1]!;
      if (last.role === role) {
        messages[messages.length - 1] = { ...last, content: last.content + "\n\n" + content };
      } else {
        messages.push({ role, content });
      }
    }
  }

  // ── 3. Final instruction (user message) ──
  const finalParts: string[] = [];

  if (context.mainResponse) {
    finalParts.push(`<assistant_response>`);
    finalParts.push(context.mainResponse);
    finalParts.push(`</assistant_response>`);
  }

  if (context.memory._agentResults) {
    finalParts.push(`\n<agent_results>`);
    finalParts.push(JSON.stringify(context.memory._agentResults, null, 2));
    finalParts.push(`</agent_results>`);
  }

  if (finalParts.length > 0) {
    finalParts.unshift("Now analyze the above conversation and produce your output.");
    // If the last message is already user role, merge to avoid consecutive user messages
    const last = messages[messages.length - 1]!;
    const finalContent = finalParts.join("\n");
    if (last.role === "user") {
      messages[messages.length - 1] = { ...last, content: last.content + "\n\n" + finalContent };
    } else {
      messages.push({ role: "user", content: finalContent });
    }
  }

  return messages;
}

/** Map agent type → its primary result type. */
const AGENT_RESULT_TYPE_MAP: Record<string, AgentResultType> = {
  "world-state": "game_state_update",
  "prose-guardian": "context_injection",
  continuity: "continuity_check",
  expression: "sprite_change",
  "echo-chamber": "echo_message",
  director: "director_event",
  quest: "quest_update",
  illustrator: "image_prompt",
  "lorebook-keeper": "lorebook_update",
  "prompt-reviewer": "prompt_review",
  combat: "game_state_update",
  background: "background_change",
  "character-tracker": "character_tracker_update",
  "persona-stats": "persona_stats_update",
  "custom-tracker": "custom_tracker_update",
  "chat-summary": "chat_summary",
  spotify: "spotify_control",
  editor: "text_rewrite",
  "knowledge-retrieval": "context_injection",
};

/** Agents that return structured JSON. */
const JSON_AGENTS = new Set([
  "world-state",
  "continuity",
  "expression",
  "echo-chamber",
  "quest",
  "illustrator",
  "lorebook-keeper",
  "prompt-reviewer",
  "combat",
  "background",
  "character-tracker",
  "persona-stats",
  "custom-tracker",
  "chat-summary",
  "spotify",
  "editor",
]);

/**
 * Parse the raw LLM response into a typed result.
 */
function parseAgentResponse(agentType: string, responseText: string): { type: AgentResultType; data: unknown } {
  const resultType = AGENT_RESULT_TYPE_MAP[agentType] ?? "context_injection";

  if (JSON_AGENTS.has(agentType)) {
    try {
      const jsonStr = extractJson(responseText);
      const data = JSON.parse(jsonStr);
      return { type: resultType, data };
    } catch {
      return { type: resultType, data: { raw: responseText, parseError: true } };
    }
  }

  // Text-based agents (prose-guardian, director)
  return { type: resultType, data: { text: responseText } };
}

/** Extract JSON from a response that may contain markdown fences. */
function extractJson(text: string): string {
  // Try markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1]!.trim();
  else {
    // Try to find a bare JSON object or array
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) text = jsonMatch[1]!;
  }

  // Repair common LLM JSON issues
  text = repairJson(text);
  return text;
}

/** Fix common LLM JSON mistakes: trailing commas, comments, ellipsis placeholders. */
function repairJson(str: string): string {
  return str
    .replace(/\/\/[^\n]*/g, "") // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove multi-line comments
    .replace(/,\s*([\]\}])/g, "$1") // remove trailing commas before ] or }
    .replace(/\.\.\.[^"\n]*/g, ""); // remove ... continuations/placeholders
}
