// ──────────────────────────────────────────────
// Routes: Lorebook Maker (AI Generation via SSE)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";

const lorebookMakerSchema = z.object({
  prompt: z.string().min(1),
  connectionId: z.string().min(1),
  /** Optionally attach generated entries to an existing lorebook */
  lorebookId: z.string().optional(),
  /** Number of entries to generate */
  entryCount: z.number().int().min(1).max(50).default(10),
});

const SYSTEM_PROMPT = `You are a world-building assistant for roleplay and fiction. Given a topic or concept, generate a set of lorebook entries that flesh out the world. Each entry should activate when relevant keywords appear in conversation.

Return ONLY valid JSON — an object with these fields:
{
  "lorebook_name": "Short descriptive name for this lorebook",
  "lorebook_description": "One paragraph overview of what this lorebook covers",
  "category": "world" | "character" | "npc" | "uncategorized",
  "entries": [
    {
      "name": "Entry title",
      "content": "The lore content that gets injected into context. Be detailed, 1-3 paragraphs. Write in a neutral, encyclopedic style suitable for an AI to reference.",
      "keys": ["keyword1", "keyword2"],
      "secondary_keys": [],
      "tag": "optional tag like 'location', 'item', 'faction', 'history', 'magic'",
      "constant": false,
      "order": 100
    }
  ]
}

Guidelines:
- Each entry should have 2-5 relevant keywords that would naturally appear in RP conversation
- Content should be written as world-info — facts, descriptions, rules — not dialogue
- Make entries self-contained but interconnected
- Vary the tags across entries (locations, characters, items, factions, history, etc.)
- Set "constant": true only for the most fundamental world rules (max 1-2 entries)
- Use increasing order values (100, 200, 300…) so entries inject in logical order`;

export async function lorebookMakerRoutes(app: FastifyInstance) {
  const connections = createConnectionsStorage(app.db);
  const lorebooks = createLorebooksStorage(app.db);

  /**
   * POST /api/lorebook-maker/generate
   * Streams AI-generated lorebook data via SSE.
   */
  app.post("/generate", async (req, reply) => {
    const input = lorebookMakerSchema.parse(req.body);

    // Resolve connection
    const conn = await connections.getWithKey(input.connectionId);
    if (!conn) {
      return reply.status(400).send({ error: "API connection not found" });
    }

    let baseUrl = conn.baseUrl;
    if (!baseUrl) {
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      baseUrl = providerDef?.defaultBaseUrl ?? "";
    }
    if (!baseUrl) {
      return reply.status(400).send({ error: "No base URL configured for this connection" });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);
      let fullResponse = "";

      const userPrompt = `Generate ${input.entryCount} lorebook entries based on: ${input.prompt}`;

      for await (const chunk of provider.chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        {
          model: conn.model,
          temperature: 1,
          maxTokens: 8192,
          stream: true,
        },
      )) {
        fullResponse += chunk;
        reply.raw.write(`data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`);
      }

      // Try to parse the JSON from the response
      let lorebookData: Record<string, unknown> | null = null;
      try {
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, fullResponse];
        const jsonStr = (jsonMatch[1] ?? fullResponse).trim();
        lorebookData = JSON.parse(jsonStr);
      } catch {
        lorebookData = null;
      }

      // If we parsed valid data AND a lorebookId was given, auto-save entries
      if (lorebookData && input.lorebookId) {
        try {
          const rawEntries = (lorebookData as { entries?: unknown[] }).entries ?? [];
          const entriesToCreate = rawEntries.map((raw: unknown) => {
            const e = raw as Record<string, unknown>;
            return {
              name: String(e.name ?? "Untitled"),
              content: String(e.content ?? ""),
              keys: Array.isArray(e.keys) ? e.keys.map(String) : [],
              secondaryKeys: Array.isArray(e.secondary_keys) ? e.secondary_keys.map(String) : [],
              tag: String(e.tag ?? ""),
              constant: e.constant === true,
              order: typeof e.order === "number" ? e.order : 100,
            };
          });

          if (entriesToCreate.length > 0) {
            await lorebooks.bulkCreateEntries(input.lorebookId!, entriesToCreate);
            reply.raw.write(
              `data: ${JSON.stringify({
                type: "saved",
                data: JSON.stringify({ count: entriesToCreate.length, lorebookId: input.lorebookId }),
              })}\n\n`,
            );
          }
        } catch (saveErr) {
          reply.raw.write(
            `data: ${JSON.stringify({
              type: "save_error",
              data: saveErr instanceof Error ? saveErr.message : "Failed to save entries",
            })}\n\n`,
          );
        }
      }

      reply.raw.write(
        `data: ${JSON.stringify({
          type: "done",
          data: lorebookData ? JSON.stringify(lorebookData) : fullResponse,
        })}\n\n`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lorebook generation failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
