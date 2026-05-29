import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { DEFAULT_GENERATION_PARAMS } from "../contracts/constants/defaults";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { scanActiveLorebookEntries } from "./active-lorebooks";
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
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "prompts") return [{ id: "preset", isDefault: false }] as T[];
      if (entity === "prompt-sections") {
        return sections.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      return [] as T[];
    },
    get: async <T>() => null as T | null,
    create: async <T>() => ({}) as T,
    update: async <T>() => ({}) as T,
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T>() => ({}) as T,
    updateChatMessage: async <T>() => ({}) as T,
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T>() => ({}) as T,
    addChatMessageSwipe: async <T>() => ({}) as T,
    patchChatMetadata: async <T>() => ({}) as T,
    patchChatSummaries: async <T>() => ({}) as T,
    listChatMemories: async () => [],
    getWorldState: async <T>() => null as T | null,
    saveTrackerSnapshot: async <T>() => ({}) as T,
    listLorebookEntries: async () => [],
    createLorebookEntries: async () => [],
    promptFull: async <T>() => null as T | null,
  };
}

function storageWithPreset(preset: Row, sections: Row[], variables: Row[] = []): StorageGateway {
  return {
    ...storageWithSections(sections),
    get: async <T>(entity: string, id: string) => {
      if (entity === "prompts" && id === preset.id) return preset as T;
      return null;
    },
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "prompts") return [preset] as T[];
      if (entity === "prompt-sections") {
        return sections.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      if (entity === "prompt-variables") {
        return variables.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      return [] as T[];
    },
  };
}

function storageWithPrompts(prompts: Row[], sections: Row[], variables: Row[] = []): StorageGateway {
  return {
    ...storageWithSections(sections),
    get: async <T>(entity: string, id: string) => {
      if (entity === "prompts") return (prompts.find((prompt) => prompt.id === id) as T) ?? null;
      return null;
    },
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "prompts") return prompts as T[];
      if (entity === "prompt-sections") {
        return sections.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      if (entity === "prompt-variables") {
        return variables.filter((row) => row.presetId === options?.filters?.presetId) as T[];
      }
      return [] as T[];
    },
  };
}

function storageWithSectionsAndRegex(sections: Row[], regexScripts: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "regex-scripts") return regexScripts as T[];
      return base.list<T>(entity, options);
    },
  };
}

function storageWithCharacters(characters: Row[]): StorageGateway {
  return {
    ...storageWithSections([]),
    list: async <T>(entity: string) => {
      if (entity === "characters") return characters as T[];
      if (entity === "personas") return [] as T[];
      if (entity === "prompts") return [] as T[];
      if (entity === "lorebooks") return [] as T[];
      if (entity === "regex-scripts") return [] as T[];
      return [] as T[];
    },
    get: async <T>(entity: string, id: string) => {
      if (entity === "characters") return (characters.find((character) => character.id === id) as T) ?? null;
      return null;
    },
  };
}

function storageWithPersonas(sections: Row[], personas: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "personas") return personas as T[];
      return base.list<T>(entity, options);
    },
    get: async <T>(entity: string, id: string) => {
      if (entity === "personas") return (personas.find((persona) => persona.id === id) as T) ?? null;
      return base.get<T>(entity, id);
    },
  };
}

function storageWithSectionsAndCharacters(sections: Row[], characters: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "characters") return characters as T[];
      return base.list<T>(entity, options);
    },
    get: async <T>(entity: string, id: string) => {
      if (entity === "characters") return (characters.find((character) => character.id === id) as T) ?? null;
      return base.get<T>(entity, id);
    },
  };
}

function storageWithLore(
  entries: Row[],
  lorebooks: Row[] = [{ id: "lorebook", enabled: true, isGlobal: true }],
  folders: Row[] = [],
): StorageGateway {
  return {
    ...storageWithSections([]),
    list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "lorebooks") return lorebooks as T[];
      if (entity === "lorebook-folders") {
        return folders.filter((folder) => folder.lorebookId === options?.filters?.lorebookId) as T[];
      }
      if (entity === "regex-scripts") return [] as T[];
      if (entity === "personas") return [] as T[];
      if (entity === "prompts") return [] as T[];
      return [] as T[];
    },
    listLorebookEntries: async <T>(lorebookId: string) =>
      entries.filter((entry) => !entry.lorebookId || entry.lorebookId === lorebookId) as T[],
  };
}

function promptText(assembly: Awaited<ReturnType<typeof assembleGenerationPrompt>>): string {
  return assembly.messages.map((message) => message.content).join("\n\n");
}

const request = {
  ...DEFAULT_GENERATION_PARAMS,
  promptPresetId: "preset",
  historyLimit: 10,
  strictRoleFormatting: true,
  singleUserMessage: false,
};

describe("assembleGenerationPrompt macro parity", () => {
  it("injects roleplay author notes at the configured depth", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "chat",
        mode: "roleplay",
        metadata: {
          authorNotes: "A5_AUTHOR_NOTES_MARKER\n{{// hidden author note }}",
          authorNotesDepth: 1,
        },
      },
      storedMessages: [
        { role: "user", content: "First user" },
        { role: "assistant", content: "Assistant response" },
        { role: "user", content: "Latest user" },
      ],
      connection: {},
      request,
      latestUserInput: "Latest user",
    });

    const previewAuthorIndex = assembly.previewMessages.findIndex((message) =>
      message.content.includes("A5_AUTHOR_NOTES_MARKER"),
    );
    expect(previewAuthorIndex).toBeGreaterThanOrEqual(0);
    expect(assembly.previewMessages[previewAuthorIndex]?.role).toBe("system");
    expect(assembly.previewMessages[previewAuthorIndex + 1]?.content).toBe("Latest user");

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("A5_AUTHOR_NOTES_MARKER");
    expect(prompt).not.toContain("hidden author note");
    expect(prompt).not.toContain("{{//");
  });

  it("strips prompt comments from persona fields and preset sections", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPersonas(
        [
          section({
            id: "persona",
            name: "Persona",
            role: "system",
            markerConfig: { type: "persona" },
            sortOrder: 0,
          }),
          section({
            id: "main",
            name: "Main",
            role: "system",
            content: "Visible preset instruction. {{// hidden preset note }}",
            sortOrder: 1,
          }),
        ],
        [
          {
            id: "persona-1",
            name: "Mari",
            description: "Visible persona details. {{// hidden persona note }}",
            personality: "{{// remove this line }}\nPrecise and curious.",
          },
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", personaId: "persona-1" },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Visible persona details.");
    expect(prompt).toContain("Precise and curious.");
    expect(prompt).toContain("Visible preset instruction.");
    expect(prompt).not.toContain("hidden persona note");
    expect(prompt).not.toContain("hidden preset note");
    expect(prompt).not.toContain("{{//");
  });

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

  it("loads extension fields and dialogue examples into wrapped character markers", async () => {
    const assembly = await assembleGenerationPrompt(
      {
        ...storageWithPreset({ id: "preset", wrapFormat: "xml" }, [
          section({
            id: "character",
            name: "Character Definitions",
            role: "system",
            markerConfig: { type: "character" },
            sortOrder: 0,
          }),
        ]),
        get: async <T>(entity: string, id: string) => {
          if (entity === "prompts" && id === "preset") return { id: "preset", wrapFormat: "xml" } as T;
          if (entity === "characters" && id === "char-a") {
            return {
              id: "char-a",
              data: {
                name: "Aster",
                description: "Base description.",
                personality: "Sharp.",
                first_mes: "Hello.",
                mes_example: "{{char}}: Example line.",
                system_prompt: "Keep secrets.",
                post_history_instructions: "Remember the last clue.",
                creator_notes: "Author note.",
                extensions: {
                  backstory: "Extension backstory.",
                  appearance: "Extension appearance.",
                  altDescriptions: [{ active: true, content: "Active description extension." }],
                },
              },
            } as T;
          }
          return null;
        },
      },
      {
        chat: { id: "chat", mode: "roleplay", characterIds: ["char-a"] },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("<description>");
    expect(prompt).toContain("Base description.");
    expect(prompt).toContain("Active description extension.");
    expect(prompt).toContain("<backstory>");
    expect(prompt).toContain("Extension backstory.");
    expect(prompt).toContain("<appearance>");
    expect(prompt).toContain("Extension appearance.");
    expect(prompt).toContain("<example_dialogue>");
    expect(prompt).toContain("Aster: Example line.");
  });

  it("keeps preset XML wrappers when prompt-only regex cleanup strips HTML from history", async () => {
    const baseStorage = storageWithPreset({ id: "preset", wrapFormat: "xml" }, [
      section({
        id: "role",
        name: "Role",
        role: "system",
        content: "You are {{char}}.",
        sortOrder: 0,
      }),
      section({
        id: "character",
        name: "Characters",
        role: "system",
        markerConfig: { type: "character" },
        sortOrder: 1,
      }),
      section({
        id: "history",
        name: "History",
        role: "system",
        markerConfig: { type: "chat_history" },
        sortOrder: 2,
      }),
    ]);
    const assembly = await assembleGenerationPrompt(
      {
        ...baseStorage,
        get: async <T>(entity: string, id: string) => {
          if (entity === "prompts" && id === "preset") return { id: "preset", wrapFormat: "xml" } as T;
          if (entity === "characters" && id === "char-a") {
            return { id: "char-a", data: { name: "Aster", description: "A roleplay card." } } as T;
          }
          return null;
        },
        list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
          if (entity === "regex-scripts") {
            return [
              {
                id: "clean-html",
                enabled: true,
                promptOnly: true,
                placement: ["user_input", "ai_output"],
                findRegex: "[ \t]?<(?!--)(?!\\/?(?:font|lie|filter)\\b)(?:\"[^\"]*\"|'[^']*'|[^'\">])*>",
                flags: "g",
                replaceString: "",
                trimStrings: [],
              },
            ] as T[];
          }
          return baseStorage.list<T>(entity, options);
        },
      },
      {
        chat: { id: "chat", mode: "roleplay", characterIds: ["char-a"] },
        storedMessages: [{ id: "old", role: "assistant", content: "<b>Old reply</b>" }],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("<role>");
    expect(prompt).toContain("<characters>");
    expect(prompt).toContain("<description>");
    expect(prompt).toContain("Old reply");
    expect(prompt).not.toContain("<b>Old reply</b>");
  });

  it("sends only the responding character card for individual roleplay groups", async () => {
    const storage = {
      ...storageWithPreset({ id: "preset", wrapFormat: "xml" }, [
        section({
          id: "character",
          name: "Character Definitions",
          role: "system",
          markerConfig: { type: "character" },
          sortOrder: 0,
        }),
      ]),
      get: async <T>(entity: string, id: string) => {
        if (entity === "prompts" && id === "preset") return { id: "preset", wrapFormat: "xml" } as T;
        if (entity === "characters" && id === "char-a") {
          return { id: "char-a", data: { name: "Aster", description: "ASTER CARD" } } as T;
        }
        if (entity === "characters" && id === "char-b") {
          return { id: "char-b", data: { name: "Briar", description: "BRIAR CARD" } } as T;
        }
        return null;
      },
    };
    const assembly = await assembleGenerationPrompt(storage, {
      chat: {
        id: "chat",
        mode: "roleplay",
        characterIds: ["char-a", "char-b"],
        metadata: { groupChatMode: "individual" },
      },
      storedMessages: [],
      connection: {},
      request: { ...request, forCharacterId: "char-b" },
      latestUserInput: "",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("BRIAR CARD");
    expect(prompt).not.toContain("ASTER CARD");
  });

  it("uses selected preset wrap format and chat choice variables", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPreset(
        {
          id: "preset",
          isDefault: false,
          wrapFormat: "markdown",
          variableValues: { TONE: "gentle" },
          defaultChoices: { POV: "second person" },
          parameters: {},
        },
        [
          section({
            id: "main",
            name: "Main Prompt",
            role: "system",
            content: "POV={{POV}}\nTone={{TONE}}\nTags={{TAGS}}",
            sortOrder: 0,
          }),
        ],
        [{ id: "tags", presetId: "preset", variableName: "TAGS", separator: " | ", randomPick: false }],
      ),
      {
        chat: {
          id: "chat",
          mode: "roleplay",
          promptPresetId: "preset",
          metadata: { presetChoices: { POV: "first person", TAGS: ["slow burn", "soft tension"] } },
        },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(assembly.wrapFormat).toBe("markdown");
    expect(prompt).toContain("## Main Prompt");
    expect(prompt).toContain("POV=first person");
    expect(prompt).toContain("Tone=gentle");
    expect(prompt).toContain("Tags=slow burn | soft tension");
    expect(prompt).not.toContain("{{POV}}");
    expect(prompt).not.toContain("{{TAGS}}");
  });

  it("does not append the generic roleplay scene scaffold after a selected preset", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPreset({ id: "preset", wrapFormat: "xml" }, [
        section({
          id: "role",
          name: "Role",
          role: "system",
          content: "<role>You are {{char}}.</role>",
          sortOrder: 0,
        }),
      ]),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "preset" },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("<role>");
    expect(prompt).toContain("You are Character.");
    expect(prompt).not.toContain("This is a dedicated roleplay scene");
    expect(prompt).not.toContain("Continue directly from the last visible message");
    expect(prompt).not.toContain("<scene_role>");
    expect(prompt).not.toContain("<output_format>");
  });

  it("keeps explicit scene metadata without adding the generic roleplay scaffold", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPreset({ id: "preset", wrapFormat: "xml" }, [
        section({
          id: "role",
          name: "Role",
          role: "system",
          content: "Preset role only.",
          sortOrder: 0,
        }),
      ]),
      {
        chat: {
          id: "chat",
          mode: "roleplay",
          promptPresetId: "preset",
          metadata: {
            sceneScenario: "A moonlit laboratory scene.",
            sceneSystemPrompt: "Keep the current scene objective in focus.",
          },
        },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("<scene_scenario>");
    expect(prompt).toContain("A moonlit laboratory scene.");
    expect(prompt).toContain("<scene_instructions>");
    expect(prompt).toContain("Keep the current scene objective in focus.");
    expect(prompt).not.toContain("This is a dedicated roleplay scene");
    expect(prompt).not.toContain("Continue directly from the last visible message");
  });

  it("falls back to the chat preset when a connection override points at a missing preset", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPrompts(
        [{ id: "chat-preset", isDefault: false, wrapFormat: "xml", parameters: {} }],
        [
          section({
            id: "main",
            presetId: "chat-preset",
            name: "Main Prompt",
            role: "system",
            content: "Use the Dottore XML format.",
            sortOrder: 0,
          }),
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "chat-preset" },
        storedMessages: [],
        connection: { promptPresetId: "missing-connection-preset" },
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.promptPresetId).toBe("chat-preset");
    expect(assembly.messages[0]?.content).toContain("<main_prompt>");
    expect(assembly.messages[0]?.content).toContain("Use the Dottore XML format.");
  });

  it("uses the chat preset before an existing connection preset", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPrompts(
        [
          { id: "chat-preset", isDefault: false, wrapFormat: "xml", parameters: {} },
          { id: "connection-preset", isDefault: false, wrapFormat: "xml", parameters: {} },
        ],
        [
          section({
            id: "chat-main",
            presetId: "chat-preset",
            name: "Main Prompt",
            role: "system",
            content: "Use the selected Dottore chat preset.",
            sortOrder: 0,
          }),
          section({
            id: "connection-main",
            presetId: "connection-preset",
            name: "Main Prompt",
            role: "system",
            content: "Use the generic connection preset.",
            sortOrder: 0,
          }),
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "chat-preset" },
        storedMessages: [],
        connection: { promptPresetId: "connection-preset" },
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(assembly.promptPresetId).toBe("chat-preset");
    expect(prompt).toContain("Use the selected Dottore chat preset.");
    expect(prompt).not.toContain("Use the generic connection preset.");
  });

  it("uses the chat preset before a request preset for roleplay generations", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPrompts(
        [
          { id: "chat-preset", isDefault: false, wrapFormat: "xml", parameters: {} },
          { id: "request-preset", isDefault: false, wrapFormat: "markdown", parameters: {} },
        ],
        [
          section({
            id: "chat-main",
            presetId: "chat-preset",
            name: "Main Prompt",
            role: "system",
            content: "Use the selected chat settings preset.",
            sortOrder: 0,
          }),
          section({
            id: "request-main",
            presetId: "request-preset",
            name: "Main Prompt",
            role: "system",
            content: "Use the transient request preset.",
            sortOrder: 0,
          }),
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "chat-preset" },
        storedMessages: [],
        connection: {},
        request: { ...request, promptPresetId: "request-preset" },
        latestUserInput: "",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(assembly.promptPresetId).toBe("chat-preset");
    expect(prompt).toContain("Use the selected chat settings preset.");
    expect(prompt).not.toContain("Use the transient request preset.");
  });

  it("collapses excessive blank lines in preset sections and history messages", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPreset(
        {
          id: "preset",
          isDefault: false,
          wrapFormat: "xml",
          parameters: {},
        },
        [
          section({
            id: "main",
            name: "Main",
            role: "system",
            content: "Rules.\n\n\n\nKeep prose tight.",
            sortOrder: 0,
          }),
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "preset" },
        storedMessages: [{ role: "user", content: "Hello.\n\n\n\nContinue.", contextKind: "history" }],
        connection: {},
        request,
        latestUserInput: "Continue.",
      },
    );

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toMatch(/Rules\.\n\n\s+Keep prose tight\./);
    expect(prompt).toContain("Hello.\n\nContinue.");
    expect(prompt).not.toMatch(/\n{3,}/);
  });
});

describe("assembleGenerationPrompt preset parameters", () => {
  it("uses preset formatting parameters during prompt assembly", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithPreset(
        {
          id: "preset",
          isDefault: false,
          wrapFormat: "xml",
          parameters: { strictRoleFormatting: false, singleUserMessage: true },
        },
        [
          section({ id: "main", name: "Main", role: "system", content: "Rules.", sortOrder: 0 }),
          section({
            id: "history",
            name: "History",
            role: "user",
            markerConfig: { type: "chat_history" },
            sortOrder: 1,
          }),
        ],
      ),
      {
        chat: { id: "chat", mode: "roleplay", promptPresetId: "preset" },
        storedMessages: [{ role: "assistant", content: "Welcome back.", contextKind: "history" }],
        connection: {},
        request: { promptPresetId: "preset", historyLimit: 10 },
        latestUserInput: "",
      },
    );

    expect(assembly.parameters).toMatchObject({ strictRoleFormatting: false, singleUserMessage: true });
    expect(assembly.messages).toHaveLength(1);
    expect(assembly.messages[0]).toMatchObject({ role: "user" });
    expect(assembly.messages[0]?.content).toContain("[SYSTEM]");
    expect(assembly.messages[0]?.content).toContain("Rules.");
    expect(assembly.messages[0]?.content).toContain("[ASSISTANT]");
    expect(assembly.messages[0]?.content).toContain("Welcome back.");
    expect(assembly.previewMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "system", displayName: "Main" }),
        expect.objectContaining({ role: "assistant", content: "Welcome back." }),
      ]),
    );
  });

  it("uses connection and chat-scoped formatting parameters during prompt assembly", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSections([
        section({ id: "main", name: "Main", role: "system", content: "Rules.", sortOrder: 0 }),
        section({
          id: "history",
          name: "History",
          role: "user",
          markerConfig: { type: "chat_history" },
          sortOrder: 1,
        }),
      ]),
      {
        chat: {
          id: "chat",
          mode: "roleplay",
          metadata: {
            chatParameters: {
              singleUserMessage: true,
            },
          },
        },
        storedMessages: [{ role: "assistant", content: "Welcome back.", contextKind: "history" }],
        connection: {
          defaultParameters: {
            strictRoleFormatting: false,
          },
        },
        request: { promptPresetId: "preset", historyLimit: 10 },
        latestUserInput: "",
      },
    );

    expect(assembly.parameters).toBeNull();
    expect(assembly.messages).toHaveLength(1);
    expect(assembly.messages[0]).toMatchObject({ role: "user" });
    expect(assembly.messages[0]?.content).toContain("[SYSTEM]");
    expect(assembly.messages[0]?.content).toContain("Rules.");
    expect(assembly.messages[0]?.content).toContain("[ASSISTANT]");
    expect(assembly.messages[0]?.content).toContain("Welcome back.");
  });
});

describe("assembleGenerationPrompt strict roles", () => {
  it("keeps leading system history out of the merged prompt scaffold", async () => {
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
          { role: "system", content: "Imported provider system turn.", contextKind: "history" },
          { role: "user", content: "Continue from here.", contextKind: "history" },
        ],
        connection: {},
        request,
        latestUserInput: "Continue from here.",
      },
    );

    expect(assembly.messages[0]).toMatchObject({ role: "system", contextKind: "prompt" });
    expect(assembly.messages[0]?.content).toContain("Main rules.");
    expect(assembly.messages[0]?.content).not.toContain("Imported provider system turn.");
    expect(assembly.messages.slice(1).map((message) => [message.role, message.contextKind, message.content])).toEqual([
      ["system", "history", "Imported provider system turn."],
      ["user", "history", "Continue from here."],
    ]);
  });

  it("forces preset chat history into strict user/assistant order when history begins with an assistant greeting", async () => {
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
      ["user", "Welcome back.\n\nI missed you."],
    ]);
  });

  it("forces fallback chat history into strict user/assistant order when no preset is active", async () => {
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
      ["user", "Welcome back.\n\nI missed you."],
    ]);
  });

  it("scopes individual group history around the responding character before enforcing strict roles", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSectionsAndCharacters(
        [
          section({ id: "main", name: "main", role: "system", content: "Main rules.", sortOrder: 0 }),
          section({
            id: "history",
            name: "chat_history",
            role: "user",
            markerConfig: { type: "chat_history" },
            sortOrder: 1,
          }),
        ],
        [
          { id: "char-a", name: "Ada", description: "Target character." },
          { id: "char-b", name: "Bryn", description: "Other character." },
        ],
      ),
      {
        chat: {
          id: "chat",
          mode: "roleplay",
          characterIds: ["char-a", "char-b"],
          metadata: { groupChatMode: "individual" },
        },
        storedMessages: [
          { role: "user", content: "User opens.", contextKind: "history" },
          { role: "assistant", characterId: "char-b", content: "Bryn reacts.", contextKind: "history" },
          { role: "assistant", characterId: "char-a", content: "Ada answers.", contextKind: "history" },
          { role: "assistant", characterId: "char-b", content: "Bryn follows up.", contextKind: "history" },
        ],
        connection: {},
        request: { ...request, forCharacterId: "char-a" },
        latestUserInput: "User opens.",
      },
    );

    const history = assembly.messages.filter((message) => message.contextKind === "history");
    expect(history.map((message) => [message.role, message.content])).toEqual([
      ["user", "User opens.\n\nBryn reacts."],
      ["assistant", "Ada answers."],
      ["user", "Bryn follows up."],
    ]);
  });

  it("excludes stored reasoning from history by default", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: { id: "chat", mode: "roleplay", metadata: {} },
      storedMessages: [
        {
          role: "assistant",
          content: "Visible answer.",
          extra: { thinking: "private chain of thought" },
        },
      ],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "",
    });

    const history = assembly.messages.filter((message) => message.contextKind === "history");
    expect(history[0]?.content).toBe("Visible answer.");
    expect(history[0]?.content).not.toContain("private chain of thought");
  });

  it("can opt into replaying stored reasoning metadata in history", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: { id: "chat", mode: "roleplay", metadata: { excludePastReasoning: false } },
      storedMessages: [
        {
          role: "assistant",
          content: "Visible answer.",
          extra: { thinking: "brief provider summary" },
        },
      ],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "",
    });

    const history = assembly.messages.filter((message) => message.contextKind === "history");
    expect(history[0]?.content).toContain("Visible answer.");
    expect(history[0]?.content).toContain("<provider_reasoning>");
    expect(history[0]?.content).toContain("brief provider summary");
  });

  it("preserves post-history system sections as system messages", async () => {
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
    expect(finalMessage?.role).toBe("system");
    expect(finalMessage?.content).toMatch(/<output_format>\s*Return only prose\.\s*<\/output_format>/);
    expect(finalMessage?.characterId).toBeUndefined();
    expect(assembly.messages.filter((message) => message.role === "system")).toHaveLength(2);
    expect(assembly.messages.find((message) => message.contextKind === "history")).toMatchObject({
      role: "user",
      content: "Pantalone speaks first.",
    });
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

describe("assembleGenerationPrompt connected conversation notes", () => {
  it("injects durable notes and unconsumed influences into linked roleplay prompts", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "roleplay-1",
        mode: "roleplay",
        connectedChatId: "conversation-1",
        notes: [
          {
            id: "note-1",
            type: "note",
            content: "[12:01] Remember that Mari hates being underestimated.",
            targetChatId: "roleplay-1",
          },
          {
            id: "influence-1",
            type: "influence",
            content: "Let the next scene reveal the locked lab door.",
            targetChatId: "roleplay-1",
            consumed: false,
          },
          {
            id: "influence-2",
            type: "influence",
            content: "This one was already spent.",
            targetChatId: "roleplay-1",
            consumed: true,
          },
        ],
      },
      storedMessages: [{ role: "user", content: "What do I see?", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "", strictRoleFormatting: false },
      latestUserInput: "What do I see?",
    });

    const joined = assembly.messages.map((message) => message.content).join("\n\n");
    expect(joined).toContain("<conversation_notes>");
    expect(joined).toContain("- Remember that Mari hates being underestimated.");
    expect(joined).not.toContain("[12:01] Remember");
    expect(joined).toContain("<ooc_influences>");
    expect(joined).toContain("- Let the next scene reveal the locked lab door.");
    expect(joined).not.toContain("This one was already spent.");
  });
});

describe("assembleGenerationPrompt game character sheets", () => {
  it("includes RPG stats from game character cards in the GM context", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithSectionsAndCharacters(
        [],
        [
          {
            id: "char-a",
            data: {
              name: "Aster",
              description: "A careful scout.",
            },
          },
        ],
      ),
      {
        chat: {
          id: "game-chat",
          mode: "game",
          characterIds: ["char-a"],
          metadata: {
            gameSetupConfig: { genre: "Fantasy", setting: "Ruins", tone: "Tense", difficulty: "Normal" },
            gameCharacterCards: [
              {
                name: "Aster",
                class: "Scout",
                rpgStats: {
                  attributes: [
                    { name: "Strength", value: 8 },
                    { name: "Dexterity", value: 16 },
                  ],
                  hp: { value: 18, max: 24 },
                },
              },
            ],
          },
        },
        storedMessages: [{ role: "user", content: "What happens?", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "What happens?",
      },
    );

    const joined = assembly.messages.map((message) => message.content).join("\n\n");
    expect(joined).toContain("RPG Attributes: Strength: 8, Dexterity: 16");
    expect(joined).toContain("RPG HP: 18/24");
  });
});

describe("assembleGenerationPrompt lorebook activation settings", () => {
  it("skips entries inside disabled lorebook folders", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-disabled-folder",
            lorebookId: "lorebook",
            folderId: "folder-disabled",
            name: "Disabled folder entry",
            content: "LQA_DISABLED_FOLDER_CONTENT_SHOULD_NOT_APPEAR",
            enabled: true,
            constant: true,
          },
        ],
        [{ id: "lorebook", enabled: true, isGlobal: true }],
        [{ id: "folder-disabled", lorebookId: "lorebook", enabled: false }],
      ),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
    expect(promptText(assembly)).not.toContain("LQA_DISABLED_FOLDER_CONTENT_SHOULD_NOT_APPEAR");
  });

  it("activates chat-scoped lorebooks without activeLorebookIds metadata", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-chat-scoped",
            lorebookId: "chat-book",
            name: "Chat scoped entry",
            content: "LQA_CHAT_SCOPED_CONTENT_SHOULD_APPEAR",
            enabled: true,
            constant: true,
          },
        ],
        [{ id: "chat-book", enabled: true, isGlobal: false, chatId: "chat" }],
      ),
      {
        chat: { id: "chat", mode: "roleplay", metadata: {} },
        storedMessages: [],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual(["Chat scoped entry"]);
    expect(promptText(assembly)).toContain("LQA_CHAT_SCOPED_CONTENT_SHOULD_APPEAR");
  });

  it("uses character and persona additional matching sources during activation", async () => {
    const baseStorage = storageWithLore([
      {
        id: "entry-character-source",
        lorebookId: "lorebook",
        name: "Character source entry",
        content: "LQA_ADDITIONAL_CHARACTER_SOURCE_CONTENT",
        keys: ["LQA_CHAR_SOURCE_KEY"],
        additionalMatchingSources: ["character_description"],
        enabled: true,
        order: 0,
      },
      {
        id: "entry-persona-source",
        lorebookId: "lorebook",
        name: "Persona source entry",
        content: "LQA_ADDITIONAL_PERSONA_SOURCE_CONTENT",
        keys: ["LQA_PERSONA_SOURCE_KEY"],
        additionalMatchingSources: ["persona_description"],
        enabled: true,
        order: 1,
      },
    ]);
    const storage: StorageGateway = {
      ...baseStorage,
      get: async <T>(entity: string, id: string) => {
        if (entity === "characters" && id === "char-a") {
          return {
            id: "char-a",
            data: { name: "Aster", description: "Character detail with LQA_CHAR_SOURCE_KEY." },
          } as T;
        }
        if (entity === "personas" && id === "persona-1") {
          return {
            id: "persona-1",
            data: { name: "Mari", description: "Persona detail with LQA_PERSONA_SOURCE_KEY." },
          } as T;
        }
        return baseStorage.get<T>(entity, id);
      },
    };

    const assembly = await assembleGenerationPrompt(storage, {
      chat: { id: "chat", mode: "roleplay", characterIds: ["char-a"], personaId: "persona-1" },
      storedMessages: [{ role: "user", content: "No lorebook keys are in chat history.", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "No lorebook keys are in chat history.",
    });

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual([
      "Character source entry",
      "Persona source entry",
    ]);
    expect(promptText(assembly)).toContain("LQA_ADDITIONAL_CHARACTER_SOURCE_CONTENT");
    expect(promptText(assembly)).toContain("LQA_ADDITIONAL_PERSONA_SOURCE_CONTENT");
  });

  it("applies lorebook-level scan depth to entries without an override", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-scan-depth",
            lorebookId: "lorebook",
            name: "Scan depth entry",
            content: "LQA_SCAN_DEPTH_CONTENT_SHOULD_NOT_APPEAR",
            keys: ["LQA_OLD_KEY"],
            enabled: true,
          },
        ],
        [{ id: "lorebook", enabled: true, isGlobal: true, scanDepth: 1 }],
      ),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [
          { role: "user", content: "Older message has LQA_OLD_KEY.", contextKind: "history" },
          { role: "assistant", content: "Latest message has no trigger.", contextKind: "history" },
        ],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
    expect(promptText(assembly)).not.toContain("LQA_SCAN_DEPTH_CONTENT_SHOULD_NOT_APPEAR");
  });

  it("recursively scans activated lorebook content when the lorebook enables recursion", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-recursive-parent",
            lorebookId: "lorebook",
            name: "Recursive parent",
            content: "LQA_RECURSIVE_PARENT_CONTENT mentions LQA_CHILD_KEY.",
            keys: ["LQA_PARENT_KEY"],
            enabled: true,
            order: 0,
          },
          {
            id: "entry-recursive-child",
            lorebookId: "lorebook",
            name: "Recursive child",
            content: "LQA_RECURSIVE_CHILD_CONTENT_SHOULD_APPEAR",
            keys: ["LQA_CHILD_KEY"],
            enabled: true,
            order: 1,
          },
        ],
        [{ id: "lorebook", enabled: true, isGlobal: true, recursiveScanning: true, maxRecursionDepth: 3 }],
      ),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [{ role: "user", content: "Trigger LQA_PARENT_KEY.", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Trigger LQA_PARENT_KEY.",
      },
    );

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual([
      "Recursive parent",
      "Recursive child",
    ]);
    expect(promptText(assembly)).toContain("LQA_RECURSIVE_CHILD_CONTENT_SHOULD_APPEAR");
  });

  it("caps malformed lorebook recursion depth to the schema maximum", async () => {
    const chainEntries = Array.from({ length: 12 }, (_, index) => ({
      id: `entry-recursive-cap-${index}`,
      lorebookId: "lorebook",
      name: `Recursive cap ${index}`,
      content: `LQA_RECURSION_CAP_CONTENT_${index}${index < 11 ? ` LQA_CAP_KEY_${index + 1}` : ""}`,
      keys: [`LQA_CAP_KEY_${index}`],
      enabled: true,
      order: index,
    }));
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        chainEntries,
        [{ id: "lorebook", enabled: true, isGlobal: true, recursiveScanning: true, maxRecursionDepth: 99 }],
      ),
      {
        chat: { id: "chat", mode: "roleplay" },
        storedMessages: [{ role: "user", content: "Trigger LQA_CAP_KEY_0.", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Trigger LQA_CAP_KEY_0.",
      },
    );

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual(
      Array.from({ length: 11 }, (_, index) => `Recursive cap ${index}`),
    );
    expect(promptText(assembly)).not.toContain("LQA_RECURSION_CAP_CONTENT_11");
  });

  it("applies chat metadata lorebook token budget during prompt injection", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore([
        {
          id: "entry-chat-budget",
          lorebookId: "lorebook",
          name: "Chat budgeted entry",
          content: "LQA_CHAT_BUDGET_CONTENT_SHOULD_NOT_APPEAR",
          enabled: true,
          constant: true,
        },
      ]),
      {
        chat: { id: "chat", mode: "roleplay", metadata: { lorebookTokenBudget: 1 } },
        storedMessages: [],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
    expect(assembly.budgetSkippedLorebookEntries).toMatchObject([
      {
        id: "entry-chat-budget",
        blockedBy: "chat",
        chatBudget: 1,
        chatUsedTokens: 0,
      },
    ]);
    expect(promptText(assembly)).not.toContain("LQA_CHAT_BUDGET_CONTENT_SHOULD_NOT_APPEAR");
  });

  it("returns budget skipped lorebook entries for active-world-info scans", async () => {
    const baseStorage = storageWithLore(
      [
        {
          id: "entry-active-scan-budget",
          lorebookId: "lorebook",
          name: "Active scan budgeted entry",
          content: "LQA_ACTIVE_SCAN_BUDGET_CONTENT_SHOULD_NOT_APPEAR",
          enabled: true,
          constant: true,
        },
      ],
      [{ id: "lorebook", name: "Budget test book", enabled: true, isGlobal: true }],
    );
    const storage: StorageGateway = {
      ...baseStorage,
      get: async <T>(entity: string, id: string) => {
        if (entity === "chats" && id === "chat") {
          return { id: "chat", mode: "roleplay", metadata: { lorebookTokenBudget: 1 } } as T;
        }
        return baseStorage.get<T>(entity, id);
      },
      list: async <T>(entity: string, options?: { filters?: Record<string, unknown> }) => {
        if (entity === "connections") return [{}] as T[];
        return baseStorage.list<T>(entity, options);
      },
      listChatMessages: async () => [],
    };

    const scan = await scanActiveLorebookEntries(storage, "chat");

    expect(scan.entries).toHaveLength(0);
    expect(scan.budgetSkippedEntries).toMatchObject([
      {
        id: "entry-active-scan-budget",
        lorebookName: "Budget test book",
        blockedBy: "chat",
        chatBudget: 1,
      },
    ]);
  });

  it("applies per-lorebook token budgets before prompt injection", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-book-budget",
            lorebookId: "lorebook",
            name: "Book budgeted entry",
            content: "LQA_LOREBOOK_BUDGET_CONTENT_SHOULD_NOT_APPEAR",
            enabled: true,
            constant: true,
          },
        ],
        [{ id: "lorebook", enabled: true, isGlobal: true, tokenBudget: 1 }],
      ),
      {
        chat: { id: "chat", mode: "roleplay", metadata: { lorebookTokenBudget: 0 } },
        storedMessages: [],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "",
      },
    );

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
    expect(assembly.budgetSkippedLorebookEntries).toMatchObject([
      {
        id: "entry-book-budget",
        blockedBy: "lorebook",
        lorebookBudget: 1,
        lorebookUsedTokens: 0,
      },
    ]);
    expect(promptText(assembly)).not.toContain("LQA_LOREBOOK_BUDGET_CONTENT_SHOULD_NOT_APPEAR");
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

  it("excludes generated game lorebook-keeper books when the keeper is disabled", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-keeper",
            lorebookId: "keeper-book",
            name: "Keeper generated moonlit lore",
            content: "This lore came from the game lorebook keeper.",
            keys: ["moonlit"],
            enabled: true,
          },
        ],
        [{ id: "keeper-book", enabled: true, isGlobal: true, sourceAgentId: "game-lorebook-keeper" }],
      ),
      {
        chat: {
          id: "chat",
          mode: "game",
          metadata: {
            gameLorebookKeeperEnabled: false,
            gameLorebookKeeperLorebookId: "keeper-book",
          },
        },
        storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Tell me about the moonlit path.",
      },
    );

    expect(assembly.activatedLorebookEntries).toHaveLength(0);
  });

  it("keeps generated game lorebook-keeper books active when the keeper is enabled", async () => {
    const assembly = await assembleGenerationPrompt(
      storageWithLore(
        [
          {
            id: "entry-keeper",
            lorebookId: "keeper-book",
            name: "Keeper generated moonlit lore",
            content: "This lore came from the game lorebook keeper.",
            keys: ["moonlit"],
            enabled: true,
          },
        ],
        [{ id: "keeper-book", enabled: true, isGlobal: true, sourceAgentId: "game-lorebook-keeper" }],
      ),
      {
        chat: {
          id: "chat",
          mode: "game",
          metadata: {
            gameLorebookKeeperEnabled: true,
            gameLorebookKeeperLorebookId: "keeper-book",
          },
        },
        storedMessages: [{ role: "user", content: "Tell me about the moonlit path.", contextKind: "history" }],
        connection: {},
        request: { ...request, promptPresetId: "" },
        latestUserInput: "Tell me about the moonlit path.",
      },
    );

    expect(assembly.activatedLorebookEntries.map((entry) => entry.name)).toEqual(["Keeper generated moonlit lore"]);
  });

  it("injects passive perception hints into game GM prompts", async () => {
    const assembly = await assembleGenerationPrompt(storageWithSections([]), {
      chat: {
        id: "game-chat",
        mode: "game",
        characterIds: [],
        gameState: {
          playerStats: {
            attributes: { WIS: 14 },
            skills: { Perception: 5 },
            stats: [],
            inventory: [],
            activeQuests: [],
            status: "",
          },
          presentCharacters: [{ name: "Mira" }],
        },
        metadata: {
          gameActiveState: "dialogue",
          gameSetupConfig: {
            genre: "fantasy",
            setting: "market district",
            tone: "tense",
            difficulty: "normal",
          },
        },
      },
      storedMessages: [{ role: "user", content: "Watch Mira closely.", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "Watch Mira closely.",
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("<passive_perception>");
    expect(prompt).toContain("notices Mira glancing nervously at exits");
    expect(prompt).toContain("Weave these observations naturally into the narration.");
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
  it("appends roleplay summaries to the system prompt when a preset has no summary marker", async () => {
    const summary = "The party escaped the greenhouse and Nia still has the brass key.";
    const assembly = await assembleGenerationPrompt(
      storageWithSections([
        section({
          id: "main",
          name: "Main",
          role: "system",
          content: "Continue the roleplay with careful continuity.",
          sortOrder: 0,
        }),
      ]),
      {
        chat: {
          id: "roleplay-chat",
          mode: "roleplay",
          characterIds: [],
          metadata: { summary },
        },
        storedMessages: [],
        connection: {},
        request,
        latestUserInput: "continue",
      },
    );

    expect(assembly.messages[0]?.role).toBe("system");
    expect(assembly.messages[0]?.content).toContain("Continue the roleplay with careful continuity.");
    expect(assembly.messages[0]?.content).toContain("<chat_summary>");
    expect(assembly.messages[0]?.content).toContain(summary);
    expect(assembly.chatSummaryFingerprint).toBe(fingerprintChatSummary(summary));
  });

  it("keeps prompt summaries stable when prompt-only regex scripts clean chat content", async () => {
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
    expect(prompt).toContain(summary);
    expect(prompt).not.toContain("The user met Nia near the docks.");
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

  it("uses provider query embeddings for memory recall when available", async () => {
    const base = storageWithSections([]);
    const storage: StorageGateway = {
      ...base,
      listChatMemories: async <T>() =>
        [
          {
            id: "provider-hit",
            content: "A memory found only by provider vector.",
            embedding: [1, 0, 0],
            embeddingSource: "provider",
          },
          {
            id: "provider-miss",
            content: "A memory with another vector.",
            embedding: [0, 1, 0],
            embeddingSource: "provider",
          },
        ] as T[],
    };

    const assembly = await assembleGenerationPrompt(storage, {
      chat: {
        id: "conversation-chat",
        mode: "conversation",
        characterIds: [],
        metadata: {},
      },
      storedMessages: [{ role: "user", content: "fresh hello", contextKind: "history" }],
      connection: {},
      request: { ...request, promptPresetId: "" },
      latestUserInput: "semantic-only query",
      embeddingSource: { embed: async () => [[1, 0, 0]] },
    });

    const prompt = assembly.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("A memory found only by provider vector.");
    expect(prompt).not.toContain("A memory with another vector.");
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
