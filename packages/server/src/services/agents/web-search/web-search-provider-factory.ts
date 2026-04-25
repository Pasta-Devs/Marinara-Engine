// ──────────────────────────────────────────────
// Web Search Provider Factory
// ──────────────────────────────────────────────
// Resolves an OracleProvider name to a concrete implementation.
// Extending Oracle with new providers (Serper, Brave) means adding a branch
// here and a new *-provider.ts module — no changes needed in callers.
// ──────────────────────────────────────────────
import type { OracleProvider } from "@marinara-engine/shared";
import type { WebSearchProvider } from "./web-search-provider.js";
import { createTavilyProvider } from "./tavily-provider.js";

export function getWebSearchProvider(name: OracleProvider, apiKey: string): WebSearchProvider {
  switch (name) {
    case "tavily":
      return createTavilyProvider(apiKey);
    default: {
      // Exhaustiveness check — new OracleProvider values will surface here at compile time.
      const _exhaustive: never = name;
      throw new Error(`Unknown web search provider: ${_exhaustive}`);
    }
  }
}
