import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { DEFAULT_GENERATION_PARAMS } from "../contracts/constants/defaults";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { assembleGenerationPrompt } from "./prompt-assembly";

type Row = Record<string, unknown>;

function section(overrides: Row & Pick<Row, "id" | "name" | "role">): Row {
  return {
    presetId: "preset",
    identifier: overrides.id,
    content: "",
    enabled: true,
    isMarker: false,
    markerConfig: null,
    sortOrder: 0,
    ...overrides,
  };
}

function storageWithSections(sections: Row[]): StorageGateway {
  return {
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "prompts") return [{ id: "preset", isDefault: false }] as T[];
      if (entity === "prompt-sections") {
        return sections.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      return [] as T[];
    },
    get: async <T,>() => null as T | null,
    create: async <T,>() => ({}) as T,
    update: async <T,>() => ({}) as T,
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T,>() => ({}) as T,
    updateChatMessage: async <T,>() => ({}) as T,
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T,>() => ({}) as T,
    addChatMessageSwipe: async <T,>() => ({}) as T,
    patchChatMetadata: async <T,>() => ({}) as T,
    patchChatSummaries: async <T,>() => ({}) as T,
    listChatMemories: async () => [],
    getWorldState: async <T,>() => null as T | null,
    saveTrackerSnapshot: async <T,>() => ({}) as T,
    listLorebookEntries: async () => [],
    createLorebookEntries: async () => [],
    promptFull: async <T,>() => null as T | null,
  };
}

function storageWithSectionsAndRegex(sections: Row[], regexScripts: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "regex-scripts") return regexScripts as T[];
      return base.list<T>(entity, options);
    },
  };
}

function storageWithCharacters(characters: Row[]): StorageGateway {
  return {
    ...storageWithSections([]),
    list: async <T,>(entity: string) => {
      if (entity === "characters") return characters as T[];
      if (entity === "personas") return [] as T[];
      if (entity === "prompts") return [] as T[];
      if (entity === "lorebooks") return [] as T[];
      if (entity === "regex-scripts") return [] as T[];
      return [] as T[];
    },
    get: async <T,>(entity: string, id: string) => {
      if (entity === "characters") return (characters.find((character) => character.id === id) as T) ?? null;
      return null;
    },
  };
}

function storageWithSectionsAndCharacters(sections: Row[], characters: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "characters") return characters as T[];
      return base.list<T>(entity, options);
    },
    get: async <T,>(entity: string, id: string) => {
      if (entity === "characters") return (characters.find((character) => character.id === id) as T) ?? null;
      return base.get<T>(entity, id);
    },
  };
}

function storageWithLore(entries: Row[]): StorageGateway {
  return {
    ...storageWithSections([]),
    list: async <T,>(entity: string) => {
      if (entity === "lorebooks") return [{ id: "lorebook", enabled: true, isGlobal: true }] as T[];
      if (entity === "regex-scripts") return [] as T[];
      if (entity === "personas") return [] as T[];
      if (entity === "prompts") return [] as T[];
      return [] as T[];
    },
    listLorebookEntries: async <T,>() => entries as T[],
  };
}

const request = {
  ...DEFAULT_GENERATION_PARAMS,
  promptPresetId: "preset",
  historyLimit: 10,
  strictRoleFormatting: true,
  singleUserMessage: false,
};

describe("assembleGenerationPrompt macro parity", () => {
  it("resolves charSysInfo and charPostHistory from active character instruction fields", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSectionsAndCharacters(
        [
          section({
            id: "main",
            name: "main",
            role: "system",
            content: "Sys={{charSysInfo}}\nPost={{charPostHistory}}",
            sortOrder: 0,
          }),
        ],
        [
          {
            id: "char-a",
            data: {
              name: "Aster",
              description: "A roleplay card.",
              system_prompt: "Always keep Aster's system guidance.",
              post_history_instructions: "Always keep Aster's post-history guidance.",
            },
          },
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", characterIds: ["char-a"] },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Sys=Always keep Aster's system guidance.");
    expect(prompt).toContain("Post=Always keep Aster's post-history guidance.");
    expect(prompt).not.toContain("{{charSysInfo}}");
    expect(prompt).not.toContain("{{charPostHistory}}");
  });
});

describe("assembleGenerationPrompt strict roles", () => {
  it("preserves preset chat history roles when history begins with an assistant greeting", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSections([
        section({ id: "main", name: "main", role: "system", content: "Main rules.", sortOrder: 0 }),
        section({
          id: "history",
          name: "chat_history",
          role: "user",
          markerConfig: { type: "chat_history" },
          sortOrder: 1,
        }),
      ]),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [
          { role: "assistant", content: "Welcome back.", contextKind: "history" },
          { role: "user", content: "I missed you.", contextKind: "history" },
        ],
        connection: {},
        request,
        latestUserInput: "I missed you.",
      },
    );

    const history = assembly.messages.filter((message) => message.contextKind === "history");
    expect(history.map((message) => [message.role, message.content])).toEqual([
      ["assistant", "Welcome back."],
      ["user", "I missed you."],
    ]);
  });

  it("preserves fallback chat history roles when no preset is active", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: { id: "chat", mode: "roleplay" },
      storedMessages: [
        { role: "assistant", content: "Welcome back.", contextKind: "history" },
        { role: "user", content: "I missed you.", contextKind: "history" },
      ],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "I missed you.",
    });

    const history = assembly.messages.filter((message) => message.contextKind === "history");
    expect(history.map((message) => [message.role, message.content])).toEqual([
      ["assistant", "Welcome back."],
      ["user", "I missed you."],
    ]);
  });

  it("merges post-history system sections into the preceding user-side message", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSections([
        section({ id: "main", name: "main", role: "system", content: "Main rules.", sortOrder: 0 }),
        section({
          id: "history",
          name: "chat_history",
          role: "user",
          markerConfig: { type: "chat_history" },
          sortOrder: 1,
        }),
        section({ id: "output", name: "output_format", role: "system", content: "Return only prose.", sortOrder: 2 }),
      ]),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [{ role: "user", content: "Pantalone speaks first.", contextKind: "history" }],
        connection: {},
        request,
        latestUserInput: "Pantalone speaks first.",
      },
    );

    const finalMessage = assembly.messages.at(-1);
    expect(finalMessage?.role).toBe("user");
    expect(finalMessage?.content).toMatch(/Pantalone speaks first\./);
    expect(finalMessage?.content).toMatch(/<output_format>\s*Return only prose\.\s*<\/output_format>/);
    expect(finalMessage?.characterId).toBeUndefined();
    expect(assembly.messages.filter((message) => message.role === "system")).toHaveLength(1);
  });

  it("merges same-role post-history preset sections instead of forcing alternation", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSections([
        section({ id: "main", name: "main", role: "system", content: "Main rules.", sortOrder: 0 }),
        section({
          id: "history",
          name: "chat_history",
          role: "user",
          markerConfig: { type: "chat_history" },
          sortOrder: 1,
        }),
        section({
          id: "post_user",
          name: "style_note",
          role: "user",
          content: "Keep the response concise.",
          sortOrder: 2,
        }),
      ]),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [{ role: "user", content: "What happens next?", contextKind: "history" }],
        connection: {},
        request,
        latestUserInput: "What happens next?",
      },
    );

    const finalMessage = assembly.messages.at(-1);
    expect(finalMessage?.role).toBe("user");
    expect(finalMessage?.content).toMatch(/What happens next\?/);
    expect(finalMessage?.content).toMatch(/<style_note>\s*Keep the response concise\.\s*<\/style_note>/);
  });
});

describe("assembleGenerationPrompt lorebook game-state gates", () => {
  const gatedEntry = {
    id: "entry-1",
    lorebookId: "lorebook",
    name: "Moonlit grove only",
    content: "This lore should only appear in the moonlit grove.",
    keys: ["moonlit"],
    enabled: true,
    activationConditions: [{ field: "location", operator: "equals", value: "moonlit grove" }],
    schedule: {
      activeTimes: ["midnight"],
      activeDates: [],
      activeLocations: ["moonlit grove"],
    },
  };

  it("does not activate lorebook entries when visible game state fails their gates", async () => {
    const assembly = await assembleGenerationPrompt(storageWithLore([gatedEntry]), {
      chat: {
        id: "chat",
        mode: "roleplay",
        gameState: { location: "sunny market", time: "noon" },
      },
      storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "Tell me about the moonlit path.",
    });

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
  });

  it("does not activate lorebook entries with game-state gates when game state is unavailable", async () => {
    const assembly = await assembleGenerationPrompt(storageWithLore([gatedEntry]), {
      chat: {
        id: "chat",
        mode: "roleplay",
      },
      storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "Tell me about the moonlit path.",
    });

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
  });

  it("activates lorebook entries when visible game state satisfies their gates", async () => {
    const assembly = await assembleGenerationPrompt(storageWithLore([gatedEntry]), {
      chat: {
        id: "chat",
        mode: "roleplay",
        gameState: { location: "moonlit grove", time: "midnight" },
      },
      storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "Tell me about the moonlit path.",
    });

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual(["Moonlit grove only"]);
  });

  it("keeps ungated lorebook entries active when game state is unavailable", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore([
        {
          id: "entry-2",
          lorebookId: "lorebook",
          name: "Ungated moonlit lore",
          content: "This lore only needs the keyword.",
          keys: ["moonlit"],
          enabled: true,
        },
      ]),
      {
        chat: {
          id: "chat",
          mode: "roleplay",
        },
        storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Tell me about the moonlit path.",
      },
    );

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual(["Ungated moonlit lore"]);
  });
});

describe("assembleGenerationPrompt inactive chat characters", () => {
  it("excludes inactive chat characters from character prompt context", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithCharacters([
        {
          id: "char-active",
          data: { name: "Aster", description: "ACTIVE CARD SHOULD APPEAR" },
        },
        {
          id: "char-inactive",
          data: { name: "Briar", description: "INACTIVE CARD SHOULD NOT APPEAR" },
        },
      ]),
      {
        chat: {
          id: "group-chat",
          mode: "roleplay",
          characterIds: ["char-active", "char-inactive"],
          metadata: { inactiveCharacterIds: ["char-inactive"] },
        },
        storedMessages: [{ role: "user", content: "Who is here?", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Who is here?",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(assembly.characters.map((character) => character.id)).toEqual(["char-active"]);
    expect(prompt).toContain("ACTIVE CARD SHOULD APPEAR");
    expect(prompt).not.toContain("INACTIVE CARD SHOULD NOT APPEAR");
  });
});

describe("assembleGenerationPrompt chat summary fingerprints", () => {
  it("fingerprints the current summary even when prompt regex scripts transform the final prompt text", async () => {
    const summary = "The user met Nia at the market.";
    const assembly = await assembleGenerationPrompt(
      storageWithSectionsAndRegex(
        [
          section({
            id: "summary",
            name: "Summary",
            role: "system",
            markerConfig: { type: "chat_summary" },
            sortOrder: 0,
          }),
        ],
        [
          {
            enabled: true,
            promptOnly: true,
            placement: ["ai_output"],
            findRegex: "Nia at the market",
            replaceString: "Nia near the docks",
          },
        ],
      ),
      {
        chat: {
          id: "conversation-chat",
          mode: "conversation",
          characterIds: [],
          metadata: { summary },
        },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "hello",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("The user met Nia near the docks.");
    expect(prompt).not.toContain(summary);
    expect(assembly.chatSummaryFingerprint).toBe(fingerprintChatSummary(summary));
  });
});

describe("assembleGenerationPrompt conversation scene awareness gates", () => {
  it("does not inject prior scene summaries when conversation cross-chat awareness and memory recall are off", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "conversation-chat",
        mode: "conversation",
        characterIds: [],
        metadata: {
          crossChatAwareness: false,
          enableMemoryRecall: false,
          lastRoleplaySceneSummary: "STALE SCENE CONTINUITY SHOULD NOT BE IN CONVO PROMPT",
        },
      },
      storedMessages: [{ role: "user", content: "fresh hello", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "fresh hello",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).not.toContain("STALE SCENE CONTINUITY SHOULD NOT BE IN CONVO PROMPT");
    expect(prompt).not.toContain("<memories>");
  });

  it("keeps normal conversation summaries when conversation cross-chat awareness is off", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "conversation-chat",
        mode: "conversation",
        characterIds: [],
        metadata: {
          crossChatAwareness: false,
          conversationSummary: "Keep this same-chat conversation summary.",
          lastRoleplaySceneSummary: "Drop this prior scene summary.",
        },
      },
      storedMessages: [{ role: "user", content: "fresh hello", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "fresh hello",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Keep this same-chat conversation summary.");
    expect(prompt).not.toContain("Drop this prior scene summary.");
  });

  it("keeps prior scene summaries when conversation cross-chat awareness is enabled by default", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "conversation-chat",
        mode: "conversation",
        characterIds: [],
        metadata: {
          lastRoleplaySceneSummary: "Keep this prior scene summary.",
        },
      },
      storedMessages: [{ role: "user", content: "fresh hello", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "fresh hello",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Keep this prior scene summary.");
  });

  it("keeps prior scene summaries in roleplay prompts", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "roleplay-chat",
        mode: "roleplay",
        characterIds: [],
        metadata: {
          crossChatAwareness: false,
          lastRoleplaySceneSummary: "Keep this roleplay scene summary.",
        },
      },
      storedMessages: [{ role: "user", content: "what happens next?", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "what happens next?",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Keep this roleplay scene summary.");
  });

  it("does not inject hidden character scene memories from a conversation card", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithCharacters([
        {
          id: "char-a",
          data: {
            name: "Aster",
            description: "A normal conversation card.",
            extensions: {
              characterMemories: [
                {
                  sceneChatId: "deleted-scene",
                  summary: "HIDDEN CHARACTER SCENE MEMORY SHOULD NOT BE IN CONVO PROMPT",
                },
              ],
            },
          },
        },
      ]),
      {
        chat: {
          id: "conversation-chat",
          mode: "conversation",
          characterIds: ["char-a"],
          metadata: {
            crossChatAwareness: false,
            enableMemoryRecall: false,
          },
        },
        storedMessages: [{ role: "user", content: "fresh hello", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "fresh hello",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("A normal conversation card.");
    expect(prompt).not.toContain("HIDDEN CHARACTER SCENE MEMORY SHOULD NOT BE IN CONVO PROMPT");
    expect(prompt).not.toContain("<memories>");
  });
});
