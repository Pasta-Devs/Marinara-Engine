import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { DEFAULT_GENERATION_PARAMS } from "../contracts/constants/defaults";
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

const request = {
  ...DEFAULT_GENERATION_PARAMS,
  promptPresetId: "preset",
  historyLimit: 10,
  strictRoleFormatting: true,
  singleUserMessage: false,
};

describe("assembleGenerationPrompt strict roles", () => {
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
