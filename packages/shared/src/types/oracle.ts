// ──────────────────────────────────────────────
// Oracle Agent Types — Web Search Configuration
// ──────────────────────────────────────────────
import { z } from "zod";

export const ORACLE_SETTINGS_KEY = "oracle";
export const ORACLE_API_KEY_MASK = "••••••";

/** Web-search providers Oracle can dispatch to. Only Tavily is implemented in the MVP. */
export const ORACLE_PROVIDERS = ["tavily"] as const;
export type OracleProvider = (typeof ORACLE_PROVIDERS)[number];

export const oracleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(ORACLE_PROVIDERS).default("tavily"),
  /** Plain text on write; masked "••••••" on read when a key is saved */
  apiKey: z.string().default(""),
  /** How many raw results Tavily returns (1–10). The summarizer still caps its own output. */
  maxResults: z.number().int().min(1).max(10).default(3),
  /** Hard cap on the summary length handed back to the character. */
  summaryTokenCap: z.number().int().min(100).max(2000).default(400),
  /** Fetch timeout before Oracle gives up and returns an empty injection. */
  timeoutMs: z.number().int().min(2000).max(30_000).default(8000),
  /** Auto-save each summary as a lorebook entry tagged "web-research". */
  autoPersist: z.boolean().default(true),
});

export type OracleConfig = z.infer<typeof oracleConfigSchema>;

/** A single normalized search result. */
export interface OracleSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

/** Raw response passed from the provider layer into the summarizer. */
export interface OracleSearchResponse {
  /** Provider-supplied short answer (Tavily's `answer` field) — may be empty. */
  answer: string;
  results: OracleSearchResult[];
}

/** Payload returned by POST /api/oracle/test — validates the API key. */
export interface OracleTestResponse {
  ok: boolean;
  resultCount: number;
  error?: string;
}

/** Lorebook tag attached to every Oracle-persisted entry. */
export const ORACLE_LOREBOOK_TAG = "web-research";
