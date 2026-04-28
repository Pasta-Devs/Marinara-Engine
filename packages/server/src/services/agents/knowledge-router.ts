// ──────────────────────────────────────────────
// Knowledge Router Agent — Catalog-based entry selection
// ──────────────────────────────────────────────
// A lower-cost alternative to the knowledge-retrieval agent. Instead of
// summarizing every lorebook entry, the router reads a short catalog
// (entry id + name + summary) and returns the IDs of the entries it
// thinks are relevant to the current scene. The selected entries are
// then injected verbatim — no per-entry summarization pass.
//
// The summary used in the catalog is the entry's user-written
// `description` if non-empty, otherwise a fallback snippet of the
// entry's content (~60 tokens). This keeps the router useful out of
// the box for casual users while letting power users tune precision
// by writing tight descriptions.
// ──────────────────────────────────────────────
import type { AgentContext, AgentResult, LorebookEntry } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { executeAgent, type AgentExecConfig } from "./agent-executor.js";
import { logger } from "../../lib/logger.js";

/** Approx ~4 chars per token for English text. Used for the content fallback budget. */
const FALLBACK_TOKEN_BUDGET = 60;
/** How many primary keys to surface per catalog entry. */
const KEYS_PER_ENTRY = 3;

/** Single catalog row the LLM sees for routing. */
export interface CatalogItem {
  id: string;
  name: string;
  keys: string[];
  /** Short summary — user-written description, or content fallback. */
  summary: string;
}

interface RouterResponse {
  entryIds: string[];
}

/** Take the first ~N tokens of text (rough char-count approximation). */
function firstNTokens(text: string, n: number): string {
  return text.slice(0, n * 4).trim();
}

/**
 * Build the catalog the router sees. For each entry:
 *   - If `description` is non-empty, use it verbatim.
 *   - Otherwise fall back to the first ~60 tokens of content.
 *   - If both are empty, the entry still appears with name + keys only.
 */
export function buildCatalog(entries: LorebookEntry[]): CatalogItem[] {
  return entries.map((entry) => {
    const description = entry.description?.trim() ?? "";
    const summary = description.length > 0 ? description : firstNTokens(entry.content, FALLBACK_TOKEN_BUDGET);
    return {
      id: entry.id,
      name: entry.name,
      keys: (entry.keys ?? []).slice(0, KEYS_PER_ENTRY),
      summary,
    };
  });
}

/** Render the catalog as the text the LLM sees inside <entry_catalog> tags. */
export function formatCatalogForPrompt(items: CatalogItem[]): string {
  return items
    .map((item) => {
      const keyAttr = item.keys.length > 0 ? ` keys="${item.keys.join(", ")}"` : "";
      const body = item.summary.length > 0 ? item.summary : "(no description)";
      return `<entry id="${item.id}" name="${escapeXmlAttr(item.name)}"${keyAttr}>\n${body}\n</entry>`;
    })
    .join("\n");
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Parse the LLM response into a list of entry IDs.
 * Tolerates markdown code fences and extra prose around the JSON.
 */
export function parseRouterResponse(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Strip ```json … ``` or ``` … ``` fences if the model wrapped its output.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1]! : trimmed;

  // Find the first { and last } to be robust to leading/trailing prose.
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return [];
  const jsonSlice = candidate.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(jsonSlice) as RouterResponse;
    if (!parsed || !Array.isArray(parsed.entryIds)) return [];
    return parsed.entryIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

/**
 * Execute the knowledge-router agent.
 *
 *   1. Build a catalog (one short row per candidate entry).
 *   2. Run the agent LLM with the catalog injected as <entry_catalog>.
 *   3. Parse {"entryIds": [...]} from the response.
 *   4. Look up the selected entries and return their content verbatim,
 *      joined into a single context_injection text block.
 *
 * The route layer is responsible for pre-filtering entries (e.g. dropping
 * `constant: true` entries — those are already injected unconditionally
 * by the standard activation pipeline, so routing them would duplicate).
 */
export async function executeKnowledgeRouter(
  config: AgentExecConfig,
  baseContext: AgentContext,
  provider: BaseLLMProvider,
  model: string,
  entries: LorebookEntry[],
): Promise<AgentResult> {
  const startTime = Date.now();

  // Empty input → no work, no LLM call.
  if (entries.length === 0) {
    return {
      agentId: config.id,
      agentType: config.type,
      type: "context_injection",
      data: { text: "" },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      success: true,
      error: null,
    };
  }

  const catalog = buildCatalog(entries);
  const catalogText = formatCatalogForPrompt(catalog);

  const context: AgentContext = {
    ...baseContext,
    memory: {
      ...baseContext.memory,
      _routerCatalog: catalogText,
    },
  };

  const result = await executeAgent(config, context, provider, model);

  if (!result.success) {
    logger.warn(
      "[knowledge-router] agent execution failed: %s",
      result.error ?? "unknown error",
    );
    return result;
  }

  const responseText =
    typeof result.data === "string"
      ? result.data
      : ((result.data as { text?: string } | null)?.text ?? "");
  const selectedIds = parseRouterResponse(responseText);

  // Build the verbatim injection text from the entries the router picked.
  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const selectedEntries = selectedIds
    .map((id) => entriesById.get(id))
    .filter((entry): entry is LorebookEntry => entry !== undefined);

  if (selectedEntries.length === 0) {
    logger.debug("[knowledge-router] no entries selected from %d candidates", entries.length);
    return {
      ...result,
      type: "context_injection",
      data: { text: "" },
    };
  }

  const injectionText = selectedEntries
    .map((entry) => `### ${entry.name}\n${entry.content}`)
    .join("\n\n");

  logger.debug(
    "[knowledge-router] selected %d/%d entries (%d ids ignored as unknown)",
    selectedEntries.length,
    entries.length,
    selectedIds.length - selectedEntries.length,
  );

  return {
    ...result,
    type: "context_injection",
    data: { text: injectionText },
  };
}
