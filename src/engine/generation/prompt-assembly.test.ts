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

function storageWithPreset(preset: Row, sections: Row[], variables: Row[] = []): StorageGateway {
  return {
    ...storageWithSections(sections),
    get: async <T,>(entity: string, id: string) => {
      if (entity === "prompts" && id === preset.id) return preset as T;
      return null;
    },
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
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
    get: async <T,>(entity: string, id: string) => {
      if (entity === "prompts") return (prompts.find((prompt) => prompt.id === id) as T) ?? null;
      return null;
    },
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
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

function storageWithPersonas(sections: Row[], personas: Row[]): StorageGateway {
  const base = storageWithSections(sections);
  return {
    ...base,
    list: async <T,>(entity: string, options?: { filters?: Record<string, unknown> }) => {
      if (entity === "personas") return personas as T[];
      return base.list<T>(entity, options);
    },
    get: async <T,>(entity: string, id: string) => {
      if (entity === "personas") return (personas.find((persona) => persona.id === id) as T) ?? null;
      return base.get<T>(entity, id);
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
        ...storageWithPreset(
          { id: "preset", wrapFormat: "xml" },
          [
            section({
              id: "character",
              name: "Character Definitions",
              role: "system",
              markerConfig: { type: "character" },
              sortOrder: 0,
            }),
          ],
        ),
        get: async <T,>(entity: string, id: string) => {
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

  it("sends only the responding character card for individual roleplay groups", async () => {
    const storage = {
      ...storageWithPreset(
        { id: "preset", wrapFormat: "xml" },
        [
          section({
            id: "character",
            name: "Character Definitions",
            role: "system",
            markerConfig: { type: "character" },
            sortOrder: 0,
          }),
        ],
      ),
      get: async <T,>(entity: string, id: string) => {
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
      storageWithSectionsAndCharacters([], [
        {
          id: "char-a",
          data: {
            name: "Aster",
            description: "A careful scout.",
          },
        },
      ]),
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

  it("uses provider query embeddings for memory recall when available", async () => {
    const base = storageWithSections([]);
    const storage: StorageGateway = {
      ...base,
      listChatMemories: async <T,>() =>
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
