// ──────────────────────────────────────────────
// Tavily Web Search Provider
// ──────────────────────────────────────────────
// Thin wrapper around https://api.tavily.com/search.
// Designed for LLM agents: Tavily returns a pre-synthesized `answer` plus the
// top results already cleaned of boilerplate, which drastically reduces the
// token footprint compared to raw scraping.
// ──────────────────────────────────────────────
import type { OracleSearchResponse, OracleSearchResult } from "@marinara-engine/shared";
import type { WebSearchProvider, WebSearchOptions } from "./web-search-provider.js";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

function normalizeResult(raw: TavilyResult): OracleSearchResult | null {
  const url = typeof raw.url === "string" && raw.url ? raw.url : "";
  const content = typeof raw.content === "string" ? raw.content.trim() : "";
  if (!url || !content) return null;
  return {
    title: typeof raw.title === "string" && raw.title ? raw.title : url,
    url,
    content,
    score: typeof raw.score === "number" ? raw.score : undefined,
  };
}

export function createTavilyProvider(apiKey: string): WebSearchProvider {
  return {
    name: "tavily",
    async search(query: string, options: WebSearchOptions): Promise<OracleSearchResponse> {
      if (!apiKey) {
        throw new Error("Tavily API key is not configured");
      }
      if (!query.trim()) {
        throw new Error("Search query is empty");
      }

      const body = {
        api_key: apiKey,
        query: query.trim(),
        max_results: Math.max(1, Math.min(10, options.maxResults ?? 3)),
        include_answer: true,
        // "advanced" returns richer content extracts per result (~2-4× more text
        // than "basic") while staying on the free tier. Adds ~1s latency but
        // gives the summariser real material to work with.
        search_depth: "advanced",
      };

      const res = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Tavily returned ${res.status}: ${detail.slice(0, 200)}`);
      }

      const data = (await res.json()) as TavilyResponse;
      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      const results = Array.isArray(data.results)
        ? data.results.map(normalizeResult).filter((r): r is OracleSearchResult => r !== null)
        : [];

      return { answer, results };
    },
  };
}
