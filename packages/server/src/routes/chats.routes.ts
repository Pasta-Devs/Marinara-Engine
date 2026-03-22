// ──────────────────────────────────────────────
// Routes: Chats
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createChatSchema, createMessageSchema, getDefaultAgentPrompt } from "@marinara-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { newId } from "../utils/id-generator.js";
import { characters } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export async function chatsRoutes(app: FastifyInstance) {
  const storage = createChatsStorage(app.db);

  // List all chats
  app.get("/", async () => {
    return storage.list();
  });

  // List chats by group
  app.get<{ Params: { groupId: string } }>("/group/:groupId", async (req) => {
    return storage.listByGroup(req.params.groupId);
  });

  // Get single chat
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    return chat;
  });

  // Create chat
  app.post("/", async (req) => {
    const input = createChatSchema.parse(req.body);
    return storage.create(input);
  });

  // Update chat
  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = createChatSchema.partial().parse(req.body);
    return storage.update(req.params.id, data);
  });

  // Update chat metadata (partial merge)
  app.patch<{ Params: { id: string } }>("/:id/metadata", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const existing = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const incoming = req.body as Record<string, unknown>;
    // Validate Discord webhook URL if provided
    if (typeof incoming.discordWebhookUrl === "string" && incoming.discordWebhookUrl.trim()) {
      const url = incoming.discordWebhookUrl.trim();
      if (!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) {
        return reply.status(400).send({ error: "Invalid Discord webhook URL" });
      }
      incoming.discordWebhookUrl = url;
    }
    const merged = { ...existing, ...incoming };
    return storage.updateMetadata(req.params.id, merged);
  });

  // ── Chat Connections (OOC ↔ Roleplay) ──

  // Connect two chats bidirectionally
  app.post<{ Params: { id: string } }>("/:id/connect", async (req, reply) => {
    const { targetChatId } = req.body as { targetChatId: string };
    if (!targetChatId || typeof targetChatId !== "string") {
      return reply.status(400).send({ error: "targetChatId is required" });
    }
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const target = await storage.getById(targetChatId);
    if (!target) return reply.status(404).send({ error: "Target chat not found" });
    // Don't allow self-connection
    if (req.params.id === targetChatId) {
      return reply.status(400).send({ error: "Cannot connect a chat to itself" });
    }
    await storage.connectChats(req.params.id, targetChatId);
    return { connected: true, chatId: req.params.id, targetChatId };
  });

  // Disconnect a chat from its partner
  app.post<{ Params: { id: string } }>("/:id/disconnect", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    await storage.disconnectChat(req.params.id);
    await storage.deleteInfluencesForChat(req.params.id);
    return { disconnected: true };
  });

  // List pending OOC influences for a chat
  app.get<{ Params: { id: string } }>("/:id/influences", async (req) => {
    return storage.listPendingInfluences(req.params.id);
  });

  // Delete all chats in a group (all branches)
  app.delete<{ Params: { groupId: string } }>("/group/:groupId", async (req, reply) => {
    await storage.removeGroup(req.params.groupId);
    return reply.status(204).send();
  });

  // Delete chat
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    // If this is a scene chat, clean up the origin chat's scene pointer
    const chat = await storage.getById(req.params.id);
    if (chat) {
      const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
      const originId = meta.sceneOriginChatId;
      if (originId) {
        const origin = await storage.getById(originId);
        if (origin) {
          const originMeta =
            typeof origin.metadata === "string" ? JSON.parse(origin.metadata) : (origin.metadata ?? {});
          delete originMeta.activeSceneChatId;
          delete originMeta.sceneBusyCharIds;
          await storage.updateMetadata(originId, originMeta);
        }
      }
    }
    // Disconnect from partner chat before deleting
    await storage.disconnectChat(req.params.id);
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Messages ──

  // List messages for a chat (supports pagination via ?limit=N&before=CURSOR)
  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
    "/:id/messages",
    async (req) => {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0;
      if (limit > 0) {
        return storage.listMessagesPaginated(req.params.id, limit, req.query.before || undefined);
      }
      return storage.listMessages(req.params.id);
    },
  );

  // Create message
  app.post<{ Params: { id: string } }>("/:id/messages", async (req) => {
    const input = createMessageSchema.parse({ ...(req.body as Record<string, unknown>), chatId: req.params.id });
    return storage.createMessage(input);
  });

  // Delete message
  app.delete<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId", async (req, reply) => {
    await storage.removeMessage(req.params.messageId);
    return reply.status(204).send();
  });

  // Edit message content
  app.patch<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId", async (req, reply) => {
    const { content } = req.body as { content: string };
    if (typeof content !== "string") return reply.status(400).send({ error: "content is required" });
    const updated = await storage.updateMessageContent(req.params.messageId, content);
    if (!updated) return reply.status(404).send({ error: "Message not found" });
    return updated;
  });

  // Update message extra (partial merge)
  app.patch<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/extra",
    async (req, reply) => {
      const partial = req.body as Record<string, unknown>;
      const updated = await storage.updateMessageExtra(req.params.messageId, partial);
      if (!updated) return reply.status(404).send({ error: "Message not found" });
      return updated;
    },
  );

  // Get latest game state for a chat (respects the active swipe of the last assistant message)
  app.get<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);

    // Try to find the snapshot for the last assistant message's active swipe
    let row: Awaited<ReturnType<typeof gameStateStore.getLatest>> = null;
    const msgs = await storage.listMessages(req.params.id);
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]!.role === "assistant") {
        row = await gameStateStore.getByMessage(msgs[i]!.id, msgs[i]!.activeSwipeIndex);
        break;
      }
    }
    // Fall back to most recent snapshot if no swipe-specific one exists
    const usedFallback = !row;
    if (!row) row = await gameStateStore.getLatest(req.params.id);
    if (!row) return reply.send(null);
    const presentCharacters = JSON.parse((row.presentCharacters as string) ?? "[]");
    const playerStats = row.playerStats ? JSON.parse(row.playerStats as string) : null;
    const personaStats = row.personaStats ? JSON.parse(row.personaStats as string) : null;
    console.log(
      `[GET /game-state] chatId=${req.params.id} snapshotId=${row.id} msgId=${row.messageId} swipe=${row.swipeIndex} fallback=${usedFallback} chars=${presentCharacters.length} personaStats=${personaStats ? "present" : "null"} playerStats=${playerStats ? "present" : "null"} date=${row.date ?? "null"} location=${row.location ?? "null"}`,
    );
    return {
      id: row.id,
      chatId: row.chatId,
      messageId: row.messageId,
      swipeIndex: row.swipeIndex,
      date: row.date,
      time: row.time,
      location: row.location,
      weather: row.weather,
      temperature: row.temperature,
      presentCharacters,
      recentEvents: JSON.parse((row.recentEvents as string) ?? "[]"),
      playerStats,
      personaStats,
      manualOverrides: row.manualOverrides ? JSON.parse(row.manualOverrides as string) : null,
      createdAt: row.createdAt,
    };
  });

  // Update game state fields for a chat
  app.patch<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);
    const body = req.body as Record<string, unknown>;
    const manual = body.manual === true;
    const fields = body as Partial<{
      date: string;
      time: string;
      location: string;
      weather: string;
      temperature: string;
      presentCharacters: any[];
      playerStats: any;
      personaStats: any[];
    }>;
    let updated = await gameStateStore.updateLatest(req.params.id, fields, manual);
    // If no snapshot exists yet, create one so manual edits aren't lost
    if (!updated && manual) {
      const manualOverrides: Record<string, string> = {};
      const TRACKABLE = ["date", "time", "location", "weather", "temperature"] as const;
      for (const key of TRACKABLE) {
        if (fields[key] !== undefined) manualOverrides[key] = fields[key] as string;
      }
      await gameStateStore.create(
        {
          chatId: req.params.id,
          messageId: "",
          swipeIndex: 0,
          date: (fields.date as string) ?? null,
          time: (fields.time as string) ?? null,
          location: (fields.location as string) ?? null,
          weather: (fields.weather as string) ?? null,
          temperature: (fields.temperature as string) ?? null,
          presentCharacters: (fields.presentCharacters as any[]) ?? [],
          recentEvents: [],
          playerStats: (fields.playerStats as any) ?? null,
          personaStats: (fields.personaStats as any) ?? null,
        },
        Object.keys(manualOverrides).length > 0 ? manualOverrides : null,
      );
      updated = await gameStateStore.getLatest(req.params.id);
    }
    if (!updated) return reply.status(404).send({ error: "No game state found" });
    return updated;
  });

  // Delete all game state for a chat
  app.delete<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);
    await gameStateStore.deleteForChat(req.params.id);
    return reply.status(204).send();
  });

  // Peek prompt — assemble the prompt for this chat as if generating right now
  app.post<{ Params: { id: string } }>("/:id/peek-prompt", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const chatMessages = await storage.listMessages(req.params.id);

    // Find the latest assistant message and return its cached prompt.
    // This is the exact messages array that was sent to the model,
    // including pre-gen agent injections (Prose Guardian, Director) but
    // NOT post-processing agent results (game state, etc.).
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const m = chatMessages[i]! as any;
      if (m.role === "assistant") {
        let extra = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
        let cachedPrompt = extra.cachedPrompt as Array<{ role: string; content: string }> | undefined;
        let generationInfo = extra.generationInfo as Record<string, unknown> | undefined;

        // If message-level extra doesn't have it (swipe overwrite), check swipes
        if (!cachedPrompt && m.id) {
          const swipes = await storage.getSwipes(m.id);
          // Check the active swipe first, then fall back to any swipe that has it
          const activeSwipe = swipes.find((s: any) => s.index === m.activeSwipeIndex);
          if (activeSwipe) {
            const swExtra =
              typeof activeSwipe.extra === "string" ? JSON.parse(activeSwipe.extra) : (activeSwipe.extra ?? {});
            cachedPrompt = swExtra.cachedPrompt;
            if (swExtra.generationInfo) generationInfo = swExtra.generationInfo;
          }
          if (!cachedPrompt) {
            for (const sw of swipes) {
              const swExtra = typeof sw.extra === "string" ? JSON.parse(sw.extra) : (sw.extra ?? {});
              if (swExtra.cachedPrompt) {
                cachedPrompt = swExtra.cachedPrompt;
                if (swExtra.generationInfo) generationInfo = swExtra.generationInfo;
                break;
              }
            }
          }
        }

        if (cachedPrompt) {
          return { messages: cachedPrompt, parameters: null, generationInfo: generationInfo ?? null, cached: true };
        }
        break;
      }
    }

    // ── Fallback: live assembly for messages generated before caching was added ──
    const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});

    // Apply conversation-start filter
    let filteredMessages = chatMessages;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const extra =
        typeof chatMessages[i]!.extra === "string"
          ? JSON.parse(chatMessages[i]!.extra as string)
          : (chatMessages[i]!.extra ?? {});
      if (extra.isConversationStart) {
        filteredMessages = chatMessages.slice(i);
        break;
      }
    }

    // Apply context message limit
    const contextLimit = chatMeta.contextMessageLimit as number | null;
    if (contextLimit && contextLimit > 0 && filteredMessages.length > contextLimit) {
      filteredMessages = filteredMessages.slice(-contextLimit);
    }

    const mappedMessages = filteredMessages.map((m: any) => ({
      role: m.role === "narrator" ? "system" : m.role,
      content: m.content as string,
    }));

    // Strip trailing assistant messages — peek should show only what we SEND to the model
    while (mappedMessages.length > 0 && mappedMessages[mappedMessages.length - 1]!.role === "assistant") {
      mappedMessages.pop();
    }

    // If chat has a preset, run the full assembler
    const presetId = chat.promptPresetId ?? chatMeta.presetId;
    if (presetId) {
      try {
        const { createPromptsStorage } = await import("../services/storage/prompts.storage.js");
        const { createCharactersStorage } = await import("../services/storage/characters.storage.js");
        const { assemblePrompt } = await import("../services/prompt/index.js");
        const presetStore = createPromptsStorage(app.db);
        const charStore = createCharactersStorage(app.db);

        const preset = await presetStore.getById(presetId);
        if (preset) {
          const [sections, groups, choiceBlocks] = await Promise.all([
            presetStore.listSections(presetId),
            presetStore.listGroups(presetId),
            presetStore.listChoiceBlocksForPreset(presetId),
          ]);

          const characterIds: string[] = (() => {
            try {
              return JSON.parse(chat.characterIds as string);
            } catch {
              return [];
            }
          })();

          let personaName = "User";
          let personaDescription = "";
          let personaFields: Record<string, string> = {};
          const allPersonas = await charStore.listPersonas();
          const persona =
            (chat.personaId ? allPersonas.find((p: any) => p.id === chat.personaId) : null) ??
            allPersonas.find((p: any) => p.isActive === "true");
          if (persona) {
            personaName = persona.name;
            personaDescription = persona.description;

            // Append active alt description extensions
            if (persona.altDescriptions) {
              try {
                const altDescs = JSON.parse(persona.altDescriptions as string) as Array<{
                  active: boolean;
                  content: string;
                }>;
                for (const ext of altDescs) {
                  if (ext.active && ext.content) {
                    personaDescription += "\n" + ext.content;
                  }
                }
              } catch {
                /* ignore malformed JSON */
              }
            }

            personaFields = {
              personality: persona.personality ?? "",
              scenario: persona.scenario ?? "",
              backstory: persona.backstory ?? "",
              appearance: persona.appearance ?? "",
            };
          }

          const chatChoices = (chatMeta.presetChoices ?? {}) as Record<string, string | string[]>;
          const assembled = await assemblePrompt({
            db: app.db,
            preset: preset as any,
            sections: sections as any,
            groups: groups as any,
            choiceBlocks: choiceBlocks as any,
            chatChoices,
            chatId: req.params.id,
            characterIds,
            personaName,
            personaDescription,
            personaFields,
            chatMessages: mappedMessages,
            enableAgents: chatMeta.enableAgents === true,
            activeAgentIds: Array.isArray(chatMeta.activeAgentIds) ? (chatMeta.activeAgentIds as string[]) : [],
          });

          return { messages: assembled.messages, parameters: assembled.parameters, generationInfo: null };
        }
      } catch (e) {
        console.error("[peek-prompt] Assembler failed, falling through to raw messages:", e);
      }
    }

    return { messages: mappedMessages, parameters: null, generationInfo: null };
  });

  // ── Swipes ──

  // List swipes for a message
  app.get<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId/swipes", async (req) => {
    return storage.getSwipes(req.params.messageId);
  });

  // Add a swipe
  app.post<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId/swipes", async (req) => {
    const { content } = req.body as { content: string };
    return storage.addSwipe(req.params.messageId, content);
  });

  // Set active swipe
  app.put<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/active-swipe",
    async (req) => {
      const { index } = req.body as { index: number };
      return storage.setActiveSwipe(req.params.messageId, index);
    },
  );

  // ── Export ──

  // Export chat as JSONL (SillyTavern-compatible format)
  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const msgs = await storage.listMessages(req.params.id);

    // Parse characterIds to resolve character names
    const charIds: string[] = (() => {
      try {
        return JSON.parse(chat.characterIds as string);
      } catch {
        return [];
      }
    })();

    // Resolve primary character name
    let characterName = chat.name;
    if (charIds.length > 0) {
      try {
        const rows = await app.db.select().from(characters).where(eq(characters.id, charIds[0]!));
        if (rows[0]) {
          const data = JSON.parse(rows[0].data);
          characterName = data?.name ?? chat.name;
        }
      } catch {
        // use chat name
      }
    }

    // Build JSONL lines
    const lines: string[] = [];

    // Header line
    lines.push(
      JSON.stringify({
        user_name: "User",
        character_name: characterName,
        create_date: chat.createdAt,
        chat_metadata: {},
      }),
    );

    // Message lines
    for (const msg of msgs) {
      lines.push(
        JSON.stringify({
          name: msg.role === "user" ? "User" : characterName,
          is_user: msg.role === "user",
          is_system: msg.role === "system" || msg.role === "narrator",
          mes: msg.content,
          send_date: msg.createdAt,
        }),
      );
    }

    const jsonl = lines.join("\n");

    return reply
      .header("Content-Type", "application/jsonl")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(chat.name)}.jsonl"`)
      .send(jsonl);
  });

  // ── Branch (duplicate) ──

  // Create a branch (copy) of an existing chat
  app.post<{ Params: { id: string } }>("/:id/branch", async (req, reply) => {
    const sourceChat = await storage.getById(req.params.id);
    if (!sourceChat) return reply.status(404).send({ error: "Chat not found" });

    const { upToMessageId } = (req.body ?? {}) as { upToMessageId?: string };

    // Ensure the source chat belongs to a group so branches are linked
    let groupId = sourceChat.groupId as string | null;
    if (!groupId) {
      groupId = newId();
      await storage.update(req.params.id, { groupId });
    }

    // Create a new chat as a branch
    const branchName = `${sourceChat.name} (branch)`;
    const newChat = await storage.create({
      name: branchName,
      mode: sourceChat.mode as "conversation" | "roleplay" | "visual_novel",
      characterIds: (() => {
        try {
          return JSON.parse(sourceChat.characterIds as string);
        } catch {
          return [];
        }
      })(),
      groupId,
      personaId: sourceChat.personaId,
      promptPresetId: sourceChat.promptPresetId,
      connectionId: sourceChat.connectionId,
    });

    if (!newChat) return reply.status(500).send({ error: "Failed to create branch" });

    // Copy messages from source chat
    const msgs = await storage.listMessages(req.params.id);
    for (const msg of msgs) {
      await storage.createMessage({
        chatId: newChat.id,
        role: msg.role as "user" | "assistant" | "system" | "narrator",
        characterId: msg.characterId,
        content: msg.content,
      });
      // Stop if we hit the specified message
      if (upToMessageId && msg.id === upToMessageId) break;
    }

    return newChat;
  });

  // ── Generate Summary ──
  // Calls the LLM to produce a rolling summary from the chat history,
  // saves it into chatMetadata.summary, and returns it.
  app.post<{ Params: { id: string } }>("/:id/generate-summary", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const connId = chat.connectionId;
    if (!connId) return reply.status(400).send({ error: "No API connection configured for this chat" });

    const connections = createConnectionsStorage(app.db);
    let id = connId;
    if (id === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) return reply.status(400).send({ error: "No connections in random pool" });
      id = pool[Math.floor(Math.random() * pool.length)]!.id;
    }
    const conn = await connections.getWithKey(id);
    if (!conn) return reply.status(400).send({ error: "API connection not found" });

    let baseUrl = conn.baseUrl;
    if (!baseUrl) {
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      baseUrl = providerDef?.defaultBaseUrl ?? "";
    }
    if (!baseUrl) return reply.status(400).send({ error: "No base URL for this connection" });

    const { createLLMProvider } = await import("../services/llm/provider-registry.js");
    const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);

    // Build conversation context
    const allMessages = await storage.listMessages(req.params.id);
    const recentMessages = allMessages.slice(-60); // last 60 messages for context
    const chatLog = recentMessages.map((m: any) => `[${m.role}]: ${(m.content as string).slice(0, 2000)}`).join("\n\n");

    const previousSummary = chatMeta.summary ?? null;
    const summaryPrompt = getDefaultAgentPrompt("chat-summary");

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: summaryPrompt },
      {
        role: "user",
        content:
          (previousSummary ? `Previous summary:\n${previousSummary}\n\n` : "") + `Recent conversation:\n${chatLog}`,
      },
    ];

    const result = await provider.chatComplete(messages, {
      model: conn.model,
      temperature: 0.5,
      maxTokens: 2048,
    });

    if (!result.content) {
      return reply.status(500).send({ error: "No response from AI" });
    }

    // Parse JSON response
    let summaryText: string;
    try {
      const cleaned = result.content
        .trim()
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      const json = JSON.parse(cleaned.slice(first, last + 1));
      summaryText = json.summary ?? result.content;
    } catch {
      summaryText = result.content.trim();
    }

    // Append to existing summary (don't replace)
    const existing = ((chatMeta.summary as string) ?? "").trim();
    const combined = existing ? `${existing}\n\n${summaryText}` : summaryText;
    const merged = { ...chatMeta, summary: combined };
    await storage.updateMetadata(req.params.id, merged);

    return { summary: combined };
  });
}
