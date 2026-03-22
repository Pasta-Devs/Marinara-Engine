// ──────────────────────────────────────────────
// Routes: Prompt Reviewer (AI Analysis via SSE)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { assemblePrompt, type AssemblerInput } from "../services/prompt/index.js";

const reviewRequestSchema = z.object({
  presetId: z.string().min(1),
  connectionId: z.string().min(1),
  /** Optional chat ID to preview with real data; otherwise uses a mock context */
  chatId: z.string().optional(),
  /** Focus areas for the review */
  focusAreas: z
    .array(z.enum(["clarity", "consistency", "coverage", "jailbreak_safety", "token_efficiency", "role_balance"]))
    .default(["clarity", "consistency", "coverage"]),
});

const SYSTEM_PROMPT = `You are an expert prompt engineer reviewing prompt presets for AI roleplay applications. Your job is to analyze the assembled prompt and provide actionable feedback.

Analyze the prompt structure and content, then return a structured review in JSON:

{
  "overall_score": 8,  // 1-10 rating
  "summary": "Brief 1-2 sentence overall assessment",
  "sections": [
    {
      "area": "clarity",
      "score": 8,
      "findings": "What you found",
      "suggestions": ["Specific improvement 1", "Specific improvement 2"]
    }
  ],
  "token_estimate": 2500,
  "warnings": ["Any critical issues"],
  "best_practices": ["Things done well"]
}

Review areas:
- **clarity**: Are instructions clear and unambiguous? Will the AI understand what's expected?
- **consistency**: Are there contradictory instructions? Do sections work together?
- **coverage**: Are all important aspects covered (character, scenario, rules, format)?
- **jailbreak_safety**: Are there safeguards? Could the prompt be easily bypassed?
- **token_efficiency**: Is the prompt concise? Are there redundant sections? Wasted context?
- **role_balance**: Are system/user/assistant roles used appropriately?

Be specific and actionable. Reference exact sections when possible.`;

export async function promptReviewerRoutes(app: FastifyInstance) {
  const connections = createConnectionsStorage(app.db);
  const presets = createPromptsStorage(app.db);
  const chats = createChatsStorage(app.db);
  const chars = createCharactersStorage(app.db);

  /**
   * POST /api/prompt-reviewer/review
   * Streams AI-generated prompt review via SSE.
   */
  app.post("/review", async (req, reply) => {
    const input = reviewRequestSchema.parse(req.body);

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

    // Resolve preset
    const preset = await presets.getById(input.presetId);
    if (!preset) {
      return reply.status(404).send({ error: "Preset not found" });
    }

    // Build assembled prompt for review
    let assembledView = "";
    try {
      const [sections, groups, choiceBlocks] = await Promise.all([
        presets.listSections(input.presetId),
        presets.listGroups(input.presetId),
        presets.listChoiceBlocksForPreset(input.presetId),
      ]);

      // If a chatId is provided, use real context; otherwise, use mock data
      let chatId = input.chatId ?? "";
      let characterIds: string[] = [];
      let personaName = "User";
      let personaDescription = "A roleplay participant.";
      let personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string } = {};
      let chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

      if (input.chatId) {
        const chat = await chats.getById(input.chatId);
        if (chat) {
          chatId = chat.id;
          characterIds = JSON.parse(chat.characterIds as string);
          const dbMessages = await chats.listMessages(chatId);
          chatMessages = dbMessages.slice(-10).map((m: any) => ({
            role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
            content: m.content as string,
          }));
        }
      } else {
        // Mock context for preview
        chatMessages = [
          { role: "user", content: "Hello, how are you?" },
          { role: "assistant", content: "*waves* I'm doing well, thanks for asking!" },
        ];
      }

      // Resolve persona
      const allPersonas = await chars.listPersonas();
      const activePersona = allPersonas.find((p: any) => p.isActive === "true");
      if (activePersona) {
        personaName = activePersona.name;
        personaDescription = activePersona.description;
        personaFields = {
          personality: activePersona.personality ?? "",
          scenario: activePersona.scenario ?? "",
          backstory: activePersona.backstory ?? "",
          appearance: activePersona.appearance ?? "",
        };
      }

      const assemblerInput: AssemblerInput = {
        db: app.db,
        preset: preset as any,
        sections: sections as any,
        groups: groups as any,
        choiceBlocks: choiceBlocks as any,
        chatChoices: {},
        chatId,
        characterIds,
        personaName,
        personaDescription,
        personaFields,
        chatMessages,
      };

      const result = await assemblePrompt(assemblerInput);

      // Format assembled prompt for the reviewer to see
      assembledView = result.messages
        .map((m, i) => `[Message ${i + 1} | ${m.role.toUpperCase()}]\n${m.content}`)
        .join("\n\n---\n\n");
    } catch {
      assembledView = "(Could not assemble prompt — preset may have no sections)";
    }

    // Set up SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);
      let fullResponse = "";

      const userPrompt = `Review this prompt preset. Focus areas: ${input.focusAreas.join(", ")}

**Preset Name:** ${preset.name}
**Wrap Format:** ${preset.wrapFormat || "xml"}
**Description:** ${preset.description || "(none)"}

**Assembled Prompt (${assembledView.length} characters):**

${assembledView}`;

      for await (const chunk of provider.chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        {
          model: conn.model,
          temperature: 0.7,
          maxTokens: 8192,
          stream: true,
        },
      )) {
        fullResponse += chunk;
        reply.raw.write(`data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`);
      }

      // Try to parse JSON review
      let reviewData: Record<string, unknown> | null = null;
      try {
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, fullResponse];
        const jsonStr = (jsonMatch[1] ?? fullResponse).trim();
        reviewData = JSON.parse(jsonStr);
      } catch {
        reviewData = null;
      }

      reply.raw.write(
        `data: ${JSON.stringify({
          type: "done",
          data: reviewData ? JSON.stringify(reviewData) : fullResponse,
        })}\n\n`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Prompt review failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
