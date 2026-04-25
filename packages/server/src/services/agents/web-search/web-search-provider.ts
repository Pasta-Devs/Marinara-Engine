// ──────────────────────────────────────────────
// Web Search Provider Interface
// ──────────────────────────────────────────────
import type { OracleProvider, OracleSearchResponse } from "@marinara-engine/shared";

export interface WebSearchOptions {
  maxResults?: number;
  /** AbortSignal to cancel the HTTP request — honoured by the underlying fetch. */
  signal?: AbortSignal;
}

export interface WebSearchProvider {
  name: OracleProvider;
  search(query: string, options: WebSearchOptions): Promise<OracleSearchResponse>;
}
