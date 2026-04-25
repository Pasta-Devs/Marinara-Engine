// ──────────────────────────────────────────────
// Oracle Agent — Web Search + Strict Summarization
// ──────────────────────────────────────────────
// Runs during pre_generation when the user's message contains <search>...</search>.
// Fetches results from the configured provider (Tavily in MVP), then hands them to
// executeAgent() with anti-hallucination constraints so the summary only repeats
// facts present in the retrieved text. The summary is injected into the character's
// prompt and, if autoPersist is on, also persisted to the lorebook by the caller.
// ──────────────────────────────────────────────
import type { AgentContext, AgentResult, OracleConfig, OracleSearchResponse } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { logger } from "../../lib/logger.js";
import { executeAgent, type AgentExecConfig } from "./agent-executor.js";
import { getWebSearchProvider } from "./web-search/web-search-provider-factory.js";

/** Payload attached to the Oracle AgentResult so the route can persist to the lorebook. */
export interface OraclePersistPayload {
  query: string;
  /** Summary body without the "Sources:" footer — used by the takeaway extractor as grounding. */
  summaryBody: string;
  /** Keyword triggers extracted from the summary body — used as lorebook entry keys. */
  keys: string[];
  sourceUrls: string[];
}

/**
 * Post-generation extractor: given the character's response after an Oracle
 * search, distils the character's durable takeaway — preferences, choices, or
 * opinions they committed to. Returns null when the character made no lasting
 * commitment (the search was acknowledged but not acted on).
 *
 * Persisting the takeaway instead of the raw search facts keeps lorebook
 * entries minimalist and roleplay-relevant: future turns recall what the
 * character owns, not what Wikipedia says.
 */
export async function extractCharacterTakeaway(args: {
  agentConfig: AgentExecConfig;
  provider: BaseLLMProvider;
  model: string;
  characterName: string;
  characterResponse: string;
  oracleFindings: string;
  query: string;
  baseContext: AgentContext;
}): Promise<string | null> {
  const { agentConfig, provider, model, characterName, characterResponse, oracleFindings, query, baseContext } = args;

  if (!characterResponse.trim() || !oracleFindings.trim()) return null;

  const takeawayPrompt = `You are a memory extractor. After a character responded to a web search, your job is to distil what the character committed to — preferences voiced, choices made, opinions expressed, or facts they adopted as meaningful to them. These commitments will be stored in the character's long-term memory for future conversations.

INPUT FORMAT:
<search_query>${query}</search_query>
<web_findings>
${oracleFindings}
</web_findings>
<character_name>${characterName}</character_name>
<character_response>
${characterResponse}
</character_response>

RULES:
1. Write a SINGLE short sentence in third person past tense, starting with the character's name.
2. Capture ONLY what the character personally committed to. Examples: "picked X over Y", "expressed interest in Z", "decided they prefer A", "found B the most appealing", "dismissed C".
3. When the character chose among options, mention what they passed over: "picked Nino over Ichika, Miku, Yotsuba, and Itsuki".
4. Do NOT list facts the character merely acknowledged. Do NOT repeat the web findings.
5. Do NOT include URLs, emoji, first person, or flowery prose.
6. If the character made no durable commitment (they just acknowledged the info, asked a follow-up question, or changed the subject without voicing a preference), output EXACTLY the token: NO_MEMORY

OUTPUT: a single sentence OR the literal token NO_MEMORY. Nothing else.`;

  const extractionContext: AgentContext = {
    chatId: baseContext.chatId,
    chatMode: baseContext.chatMode,
    recentMessages: [],
    mainResponse: null,
    gameState: null,
    characters: [],
    persona: null,
    activatedLorebookEntries: null,
    writableLorebookIds: null,
    chatSummary: null,
    streaming: false,
    signal: baseContext.signal,
    memory: {},
  };

  // Swap the agent's prompt template for our extraction prompt without touching the DB row.
  const extractionConfig: AgentExecConfig = {
    ...agentConfig,
    promptTemplate: takeawayPrompt,
    settings: { ...agentConfig.settings, maxTokens: 200, temperature: 0.2, contextSize: 0 },
  };

  const result = await executeAgent(extractionConfig, extractionContext, provider, model);
  if (!result.success) return null;

  const rawText =
    typeof result.data === "string" ? result.data : ((result.data as { text?: string } | null)?.text ?? "");
  const cleaned = rawText.trim().replace(/^["']|["']$/g, "").trim();
  if (!cleaned || cleaned === "NO_MEMORY" || /^no[_ ]memory$/i.test(cleaned)) return null;

  // Guard against runaway output — cap at ~400 chars so a single entry stays focused.
  return cleaned.slice(0, 400);
}

/** Split a summary into body (facts only) and the trailing "Sources:" footer. */
function splitSummary(raw: string): { body: string; hadFooter: boolean } {
  const match = raw.match(/\n+Sources?:\s*\n/i);
  if (!match || match.index === undefined) return { body: raw.trim(), hadFooter: false };
  return { body: raw.slice(0, match.index).trim(), hadFooter: true };
}

/**
 * Extract lorebook activation keys from the summary body.
 * Strategy: grab capitalized multi-word phrases (proper nouns), plus the raw
 * query as a whole. Filters stop-word-only matches and short single capitals.
 */
function extractKeys(summaryBody: string, query: string): string[] {
  const keys = new Set<string>();
  // Whole query is always a key — covers the user's exact phrasing
  if (query.trim()) keys.add(query.trim());

  // Proper-noun-like phrases: Capitalized word optionally followed by more Capitalized words
  const properNounRe = /\b[A-Z][a-zA-Z]{2,}(?:\s+(?:[A-Z][a-zA-Z]+|of|the|de|du|des|la|le|les))*(?:\s+[A-Z][a-zA-Z]+)?\b/g;
  for (const match of summaryBody.matchAll(properNounRe)) {
    const phrase = match[0].trim();
    if (phrase.length < 3) continue;
    keys.add(phrase);
    if (keys.size >= 12) break;
  }

  return Array.from(keys).slice(0, 12);
}

function buildSourceMaterial(response: OracleSearchResponse): string {
  const parts: string[] = [];
  if (response.answer) {
    parts.push(`## Provider Summary\n${response.answer}`);
  }
  for (let i = 0; i < response.results.length; i++) {
    const r = response.results[i]!;
    parts.push(`## Result ${i + 1}: ${r.title}\nURL: ${r.url}\n${r.content}`);
  }
  return parts.join("\n\n");
}

/**
 * Run a web search and summarize it via the agent's configured LLM.
 * Returns a `context_injection` result and (when successful) a persist payload
 * so the caller can store the summary as a lorebook entry.
 */
export async function executeOracle(args: {
  agentConfig: AgentExecConfig;
  oracleConfig: OracleConfig;
  baseContext: AgentContext;
  provider: BaseLLMProvider;
  model: string;
  query: string;
}): Promise<{ result: AgentResult; persist: OraclePersistPayload | null }> {
  const { agentConfig, oracleConfig, baseContext, provider, model, query } = args;
  const startTime = Date.now();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      result: {
        agentId: agentConfig.id,
        agentType: agentConfig.type,
        type: "context_injection",
        data: { text: "" },
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: "Empty search query",
      },
      persist: null,
    };
  }

  // ── 1. Fetch results from the web search provider ──
  let searchResponse: OracleSearchResponse;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), oracleConfig.timeoutMs);
    try {
      const webProvider = getWebSearchProvider(oracleConfig.provider, oracleConfig.apiKey);
      searchResponse = await webProvider.search(trimmedQuery, {
        maxResults: oracleConfig.maxResults,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Web search failed";
    logger.warn({ err }, "[oracle] Search failed for %s: %s", trimmedQuery, msg);
    return {
      result: {
        agentId: agentConfig.id,
        agentType: agentConfig.type,
        type: "context_injection",
        data: { text: "" },
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: msg,
      },
      persist: null,
    };
  }

  if (searchResponse.results.length === 0 && !searchResponse.answer) {
    return {
      result: {
        agentId: agentConfig.id,
        agentType: agentConfig.type,
        type: "context_injection",
        data: { text: "" },
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        success: true,
        error: null,
      },
      persist: null,
    };
  }

  // ── 2. Hand the raw results to the summarizer (strict anti-hallucination prompt) ──
  const sourceMaterial = buildSourceMaterial(searchResponse);
  const sourceUrls = searchResponse.results.map((r) => r.url).filter((u) => u.length > 0);

  logger.info(
    "[oracle] Search returned %d result(s), answer=%s, sourceMaterial=%d chars",
    searchResponse.results.length,
    searchResponse.answer.length > 0 ? "yes" : "no",
    sourceMaterial.length,
  );

  // Oracle is a pure text summariser — it must NOT inherit the chat's recentMessages,
  // characters, or persona, otherwise small models continue the roleplay instead of
  // extracting facts. We keep only the fields executeAgent strictly needs (chatId,
  // chatMode, signal, streaming) and empty everything else.
  const context: AgentContext = {
    chatId: baseContext.chatId,
    chatMode: baseContext.chatMode,
    recentMessages: [],
    mainResponse: null,
    gameState: null,
    characters: [],
    persona: null,
    activatedLorebookEntries: null,
    writableLorebookIds: null,
    chatSummary: null,
    streaming: baseContext.streaming,
    signal: baseContext.signal,
    memory: {
      _sourceMaterial: sourceMaterial,
      _searchQuery: trimmedQuery,
      _sourceUrls: sourceUrls,
      _summaryTokenCap: oracleConfig.summaryTokenCap,
    },
  };

  // Oracle's output is bounded by summaryTokenCap (≤2000 by schema). Pass an explicit
  // maxTokens so executeAgent skips its 16384 floor and frees input budget for the
  // source material — without this, prompts get aggressively trimmed on small-context
  // models even when the cap is just a few hundred tokens.
  const summaryMaxTokens = Math.max(256, oracleConfig.summaryTokenCap + 200);
  const summaryConfig: AgentExecConfig = {
    ...agentConfig,
    settings: { ...agentConfig.settings, maxTokens: summaryMaxTokens },
  };
  const summaryResult = await executeAgent(summaryConfig, context, provider, model);

  const summaryText =
    typeof summaryResult.data === "string"
      ? summaryResult.data
      : ((summaryResult.data as { text?: string } | null)?.text ?? "");

  logger.debug(
    "[oracle] Summariser result — success=%s error=%s textLen=%d preview=%s",
    summaryResult.success,
    summaryResult.error ?? "none",
    summaryText.length,
    JSON.stringify(summaryText.slice(0, 200)),
  );

  const trimmedSummary = summaryText.trim();
  const isInformative =
    summaryResult.success && trimmedSummary.length > 0 && trimmedSummary !== "No relevant information found.";

  // Split body/footer for persistence: the "Sources:" footer is useful to show
  // provenance in the current-turn injection, but useless inside a lorebook
  // entry that will be re-injected later — URLs pollute the character's context.
  const { body: summaryBody } = splitSummary(trimmedSummary);
  const persistKeys = isInformative ? extractKeys(summaryBody, trimmedQuery) : [];

  return {
    result: {
      ...summaryResult,
      type: "context_injection",
      data: { text: trimmedSummary }, // full text (with footer) for in-turn injection
      durationMs: Date.now() - startTime,
    },
    persist: isInformative
      ? {
          query: trimmedQuery,
          summaryBody, // footer-stripped for lorebook
          keys: persistKeys,
          sourceUrls,
        }
      : null,
  };
}
