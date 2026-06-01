import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { assembleGenerationPrompt } from "./prompt-assembly";
import type { JsonRecord } from "./runtime-records";

function createStorage(args: {
  chats?: JsonRecord[];
  characters?: JsonRecord[];
  personas?: JsonRecord[];
  messages?: Record<string, JsonRecord[]>;
}): StorageGateway {
  const chats = args.chats ?? [];
  const characters = args.characters ?? [];
  const personas = args.personas ?? [];
  const messages = args.messages ?? {};

  const byEntity: Record<string, JsonRecord[]> = {
    chats,
    characters,
    personas,
    "regex-scripts": [],
    lorebooks: [],
    agents: [],
  };

  return {
    async list<T = unknown>(entity: string, _options?: unknown): Promise<T[]> {
      return ((byEntity[entity] ?? []) as T[]).slice();
    },
    async get<T = unknown>(entity: string, id: string, _options?: unknown): Promise<T | null> {
      return ((byEntity[entity] ?? []).find((row) => row.id === id) as T | undefined) ?? null;
    },
    async create<T = unknown>(_entity: string, value: Record<string, unknown>): Promise<T> {
      return value as T;
    },
    async update<T = unknown>(_entity: string, _id: string, patch: Record<string, unknown>): Promise<T> {
      return patch as T;
    },
    async delete(_entity?: unknown, _id?: unknown) {
      return { deleted: true };
    },
    async listChatMessages<T = unknown>(chatId: string, _options?: unknown): Promise<T[]> {
      return ((messages[chatId] ?? []) as T[]).slice();
    },
    async createChatMessage<T = unknown>(_chatId: string, value: Record<string, unknown>): Promise<T> {
      return value as T;
    },
    async updateChatMessage<T = unknown>(_messageId: string, patch: Record<string, unknown>): Promise<T> {
      return patch as T;
    },
    async deleteChatMessage() {
      return { deleted: true };
    },
    async patchChatMessageExtra<T = unknown>(_messageId: string, patch: Record<string, unknown>): Promise<T> {
      return patch as T;
    },
    async addChatMessageSwipe<T = unknown>(_chatId: string, _messageId: string, content: string): Promise<T> {
      return { content } as T;
    },
    async patchChatMetadata<T = unknown>(_chatId: string, patch: Record<string, unknown>): Promise<T> {
      return patch as T;
    },
    async patchChatSummaries<T = unknown>(_chatId: string, patch: Record<string, unknown>): Promise<T> {
      return patch as T;
    },
    async listChatMemories<T = unknown>(): Promise<T[]> {
      return [];
    },
    async getWorldState<T = unknown>(): Promise<T | null> {
      return null;
    },
    async saveTrackerSnapshot<T = unknown>(_chatId: string, snapshot: Record<string, unknown>): Promise<T> {
      return snapshot as T;
    },
    async listLorebookEntries<T = unknown>(): Promise<T[]> {
      return [];
    },
    async createLorebookEntries<T = unknown>(_lorebookId: string, entries: Array<Record<string, unknown>>): Promise<T[]> {
      return entries as T[];
    },
    async promptFull<T = unknown>(): Promise<T | null> {
      return null;
    },
  };
}

const alice = {
  id: "alice",
  data: { name: "Alice", description: "A careful friend." },
};

const bob = {
  id: "bob",
  data: { name: "Bob", description: "A curious friend." },
};

const persona = {
  id: "persona-1",
  isActive: true,
  data: { name: "Celia", description: "The user." },
};

const connection = {
  id: "conn-1",
  provider: "test",
  model: "test-model",
};

async function promptText(storage: StorageGateway, chat: JsonRecord, request: JsonRecord = {}) {
  const result = await assembleGenerationPrompt(storage, {
    chat,
    storedMessages: [{ id: "m1", chatId: chat.id, role: "user", content: "How is tonight looking?" }],
    connection,
    request,
    latestUserInput: "How is tonight looking?",
  });
  return result.previewMessages.map((message) => message.content).join("\n\n");
}

describe("assembleGenerationPrompt conversation parity", () => {
  it("includes live user status, activity, and character schedules for conversation prompts", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      personaId: "persona-1",
      metadata: {
        conversationSchedulesEnabled: true,
        characterSchedules: {
          alice: {
            days: {
              Monday: [{ time: "19:00-21:00", status: "online", activity: "reading texts" }],
            },
          },
        },
      },
    };
    const storage = createStorage({ chats: [chat], characters: [alice], personas: [persona] });

    const text = await promptText(storage, chat, { userStatus: "idle", userActivity: "making tea" });

    expect(text).toContain("<conversation_presence>");
    expect(text).toContain("User status: idle");
    expect(text).toContain("User activity: making tea");
    expect(text).toContain("<character_schedules>");
    expect(text).toContain("Alice");
    expect(text).toContain("19:00-21:00 online - reading texts");
  });

  it("injects recent sibling conversation messages only when cross-chat awareness is enabled", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      metadata: { crossChatAwareness: true },
    };
    const emptyNewerSibling = {
      id: "chat-empty",
      name: "Empty newer chat",
      mode: "conversation",
      characterIds: ["alice"],
      updatedAt: "2026-06-01T15:00:00Z",
      metadata: {},
    };
    const staleSibling = {
      id: "chat-stale",
      name: "Stale chat",
      mode: "conversation",
      characterIds: ["alice"],
      updatedAt: "2026-05-01T15:00:00Z",
      metadata: {},
    };
    const sibling = {
      id: "chat-2",
      name: "Sibling chat",
      mode: "conversation",
      characterIds: ["alice", "bob"],
      updatedAt: "2026-06-01T14:00:00Z",
      metadata: {},
    };
    const storage = createStorage({
      chats: [chat, staleSibling, emptyNewerSibling, sibling],
      characters: [alice, bob],
      messages: {
        "chat-stale": [{ id: "old", chatId: "chat-stale", role: "user", content: "Old continuity." }],
        "chat-2": [
          { id: "s1", chatId: "chat-2", role: "user", content: "We talked about the comet." },
          { id: "s2", chatId: "chat-2", role: "assistant", characterId: "alice", content: "I will remember it." },
        ],
      },
    });

    const enabled = await promptText(storage, chat);
    const disabled = await promptText(storage, { ...chat, metadata: { crossChatAwareness: false } });

    expect(enabled).toContain("<cross_chat_awareness>");
    expect(enabled).toContain("Sibling chat");
    expect(enabled).toContain("We talked about the comet.");
    expect(enabled.indexOf("We talked about the comet.")).toBeLessThan(enabled.indexOf("Old continuity."));
    expect(enabled).not.toContain("Empty newer chat");
    expect(disabled).not.toContain("<cross_chat_awareness>");
    expect(disabled).not.toContain("We talked about the comet.");
  });

  it("keeps cross-chat and command instructions quiet when conversation metadata is absent", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      connectedChatId: "roleplay-1",
      metadata: {},
    };
    const sibling = {
      id: "chat-2",
      name: "Sibling chat",
      mode: "conversation",
      characterIds: ["alice"],
      updatedAt: "2026-06-01T14:00:00Z",
      metadata: {},
    };
    const roleplay = { id: "roleplay-1", mode: "roleplay", characterIds: ["alice"], metadata: {} };
    const storage = createStorage({
      chats: [chat, sibling, roleplay],
      characters: [alice],
      messages: {
        "chat-2": [{ id: "s1", chatId: "chat-2", role: "user", content: "Private sibling continuity." }],
      },
    });

    const text = await promptText(storage, chat);

    expect(text).not.toContain("<cross_chat_awareness>");
    expect(text).not.toContain("Private sibling continuity.");
    expect(text).not.toContain("<conversation_commands>");
    expect(text).not.toContain("[cross_post:");
    expect(text).not.toContain("[selfie");
    expect(text).not.toContain("[memory:");
    expect(text).not.toContain("[scene:");
  });

  it("bounds cross-chat sibling message reads to recent candidates", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      metadata: { crossChatAwareness: true },
    };
    const emptyRecentSiblings = Array.from({ length: 24 }, (_, index) => ({
      id: `chat-empty-${index}`,
      name: `Empty recent ${index}`,
      mode: "conversation",
      characterIds: ["alice"],
      updatedAt: `2026-06-01T14:${String(index).padStart(2, "0")}:00Z`,
      metadata: {},
    }));
    const oldSibling = {
      id: "chat-old",
      name: "Old sibling",
      mode: "conversation",
      characterIds: ["alice"],
      updatedAt: "2026-05-01T14:00:00Z",
      metadata: {},
    };
    const storage = createStorage({
      chats: [chat, oldSibling, ...emptyRecentSiblings],
      characters: [alice],
      messages: {
        "chat-old": [{ id: "old", chatId: "chat-old", role: "user", content: "Old but non-empty continuity." }],
      },
    });

    const text = await promptText(storage, chat);

    expect(text).not.toContain("<cross_chat_awareness>");
    expect(text).not.toContain("Old but non-empty continuity.");
  });

  it("injects linked roleplay and game context into conversation prompts", async () => {
    const conversation = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      connectedChatId: "roleplay-1",
      metadata: {},
    };
    const roleplay = {
      id: "roleplay-1",
      name: "Moonlit scene",
      mode: "roleplay",
      characterIds: ["alice"],
      metadata: { sceneDescription: "Alice is investigating moonlit ruins." },
    };
    const gameConversation = { ...conversation, id: "chat-game", connectedChatId: "game-1" };
    const game = {
      id: "game-1",
      name: "Dungeon run",
      mode: "game",
      characterIds: ["alice"],
      metadata: { gameState: { location: "Crystal Gate", objective: "Find the key" } },
    };
    const storage = createStorage({
      chats: [conversation, roleplay, gameConversation, game],
      characters: [alice],
      messages: {
        "roleplay-1": [{ id: "r1", chatId: "roleplay-1", role: "assistant", content: "The ruins hum softly." }],
        "game-1": [{ id: "g1", chatId: "game-1", role: "assistant", content: "The party reaches the gate." }],
      },
    });

    const roleplayText = await promptText(storage, conversation);
    const gameText = await promptText(storage, gameConversation);

    expect(roleplayText).toContain("<connected_roleplay>");
    expect(roleplayText).toContain("Moonlit scene");
    expect(roleplayText).toContain("Alice is investigating moonlit ruins.");
    expect(roleplayText).toContain("The ruins hum softly.");
    expect(gameText).toContain("<connected_game>");
    expect(gameText).toContain("Dungeon run");
    expect(gameText).toContain("Crystal Gate");
    expect(gameText).toContain("The party reaches the gate.");
  });

  it("adds gated conversation command instructions when commands are enabled", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      connectedChatId: "roleplay-1",
      metadata: {
        characterCommands: true,
        conversationSchedulesEnabled: true,
        characterSchedules: { alice: { days: { Monday: [] } } },
      },
    };
    const roleplay = { id: "roleplay-1", mode: "roleplay", characterIds: ["alice"], metadata: {} };
    const storage = createStorage({ chats: [chat, roleplay], characters: [alice] });

    const enabled = await promptText(storage, chat);
    const disabled = await promptText(storage, { ...chat, metadata: { ...chat.metadata, characterCommands: false } });

    expect(enabled).toContain("<conversation_commands>");
    expect(enabled).toContain("[schedule_update:");
    expect(enabled).toContain("[cross_post:");
    expect(enabled).toContain("[selfie");
    expect(enabled).toContain("[memory:");
    expect(enabled).toContain("[scene:");
    expect(enabled).toContain("<note>");
    expect(disabled).not.toContain("<conversation_commands>");
  });

  it("honors explicit conversation command capability false flags", async () => {
    const chat = {
      id: "chat-1",
      mode: "conversation",
      characterIds: ["alice"],
      metadata: {
        characterCommands: true,
        commandCapabilities: {
          canCrossPost: false,
          canSelfie: false,
          canStartScenes: false,
          canSaveMemory: false,
          canScheduleUpdate: false,
        },
        conversationSchedulesEnabled: true,
        characterSchedules: { alice: { days: { Monday: [{ time: "10:00", activity: "available" }] } } },
      },
    };
    const storage = createStorage({ chats: [chat], characters: [alice] });

    const text = await promptText(storage, chat);

    expect(text).not.toContain("<conversation_commands>");
    expect(text).not.toContain("[schedule_update:");
    expect(text).not.toContain("[cross_post:");
    expect(text).not.toContain("[selfie");
    expect(text).not.toContain("[memory:");
    expect(text).not.toContain("[scene:");
  });

  it("does not inject conversation-only context into roleplay prompts", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      characterIds: ["alice"],
      metadata: {
        characterCommands: true,
        crossChatAwareness: true,
        conversationSchedulesEnabled: true,
        characterSchedules: { alice: { days: { Monday: [{ time: "09:00-10:00", activity: "texts" }] } } },
      },
    };
    const storage = createStorage({ chats: [roleplay], characters: [alice] });

    const text = await promptText(storage, roleplay, { userStatus: "idle", userActivity: "reading" });

    expect(text).not.toContain("<conversation_presence>");
    expect(text).not.toContain("<character_schedules>");
    expect(text).not.toContain("<cross_chat_awareness>");
    expect(text).not.toContain("<conversation_commands>");
  });
});
