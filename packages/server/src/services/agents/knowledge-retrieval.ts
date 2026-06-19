// ──────────────────────────────────────────────
// Knowledge Retrieval Agent — Chunked RAG Pipeline
// ──────────────────────────────────────────────
// Scans lorebook entries (or other reference material) for information
// relevant to the current conversation. If the material doesn't fit in
// a single LLM context window, it splits it into chunks and runs
// multiple extraction passes, then consolidates the results.
// ──────────────────────────────────────────────
import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { executeAgent, type AgentExecConfig } from "./agent-executor.js";

/**
 * Rough token estimate: ~4 characters per token for English text.
 * We leave headroom for the system prompt + context block.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks of approximately `maxTokens` tokens each.
 * Splits on double-newlines (entry boundaries) to keep entries intact.
 */
function chunkText(text: string, maxTokens: number): string[] {
  const entries = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const entry of entries) {
    const combined = current ? current + "\n\n" + entry : entry;
    if (estimateTokens(combined) > maxTokens && current) {
      chunks.push(current.trim());
      current = entry;
    } else {
      current = combined;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Execute the knowledge-retrieval agent with automatic chunking.
 *
 * If the source material fits the agent's context budget, runs a single pass.
 * Otherwise, splits into chunks and runs:
 *   - N extraction passes (one per chunk)
 *   - 1 final consolidation pass that merges all extractions
 *
 * Returns the standard AgentResult with type "context_injection".
 */
export async function executeKnowledgeRetrieval(
  config: AgentExecConfig,
  baseContext: AgentContext,
  provider: BaseLLMProvider,
  model: string,
  sourceMaterial: string,
): Promise<AgentResult> {
  // Reserve tokens for system prompt (~600) and context block (~1500).
  // Rough budget for source material: whatever's left
  const contextBudget = (config.settings.sourceContextBudget as number) ?? 6000;

  const materialTokens = estimateTokens(sourceMaterial);

  // ── Single-pass: material fits in one call ──
  if (materialTokens <= contextBudget) {
    const context: AgentContext = {
      ...baseContext,
      memory: {
        ...baseContext.memory,
        _sourceMaterial: sourceMaterial,
      },
    };
    return executeAgent(config, context, provider, model);
  }

  // ── Multi-pass: split into chunks ──
  const chunks = chunkText(sourceMaterial, contextBudget);
  const extractions: string[] = [];
  let consolidatedText: string | null = null;
  let totalTokens = 0;
  let totalDuration = 0;

  for (let i = 0; i < chunks.length; i++) {
    const isLastChunk = i === chunks.length - 1;
    // The final chunk runs as a consolidation pass only when earlier chunks
    // produced extractions to merge (so it receives `_previousExtractions`).
    const isConsolidationPass = isLastChunk && extractions.length > 0;
    const chunkContext: AgentContext = {
      ...baseContext,
      memory: {
        ...baseContext.memory,
        _sourceMaterial: chunks[i]!,
        _chunkInfo: { current: i + 1, total: chunks.length },
        ...(isConsolidationPass ? { _previousExtractions: extractions } : {}),
      },
    };

    const result = await executeAgent(config, chunkContext, provider, model);
    totalTokens += result.tokensUsed;
    totalDuration += result.durationMs;

    if (result.success && result.data) {
      const text = typeof result.data === "string" ? result.data : ((result.data as { text?: string })?.text ?? "");
      if (text && text !== "No relevant information found.") {
        if (isConsolidationPass) {
          // The consolidation pass already merged every prior extraction with the
          // final chunk; track its output explicitly so we return it alone instead
          // of re-injecting the partials it absorbed.
          consolidatedText = text;
        } else {
          extractions.push(text);
        }
      }
    }
  }

  // Prefer the consolidated output when the final consolidation pass produced text.
  // Only fall back to concatenating the raw partial extractions when the
  // consolidation pass itself produced nothing (or never ran) — so we neither drop
  // earlier results nor double-inject facts the consolidation already merged. This
  // covers the case where a middle chunk returned "No relevant information found.":
  // `extractions.length < chunks.length` no longer forces a partial concatenation
  // that would duplicate the facts the final pass already consolidated.
  const finalText = consolidatedText && consolidatedText.length > 0 ? consolidatedText : extractions.filter(Boolean).join("\n\n");
  return {
    agentId: config.id,
    agentType: config.type,
    type: "context_injection",
    data: { text: finalText },
    tokensUsed: totalTokens,
    durationMs: totalDuration,
    success: true,
    error: null,
  };
}
