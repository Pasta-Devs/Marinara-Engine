import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { consumePendingConnectedInfluences, persistConnectedCommandTags } from "./connected-commands";

type Row = Record<string, unknown>;

function storageWithChats(chats: Map<string, Row>): StorageGateway {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async (entity: string, id: string) => (entity === "chats" ? ((chats.get(id) as never) ?? null) : null)),
    create: vi.fn(async (_entity: string, value: Record<string, unknown>) => value as never),
    update: vi.fn(async (entity: string, id: string, patch: Record<string, unknown>) => {
      if (entity === "chats") {
        const next = { ...(chats.get(id) ?? { id }), ...patch };
        chats.set(id, next);
        return next as never;
      }
      return patch as never;
    }),
    delete: vi.fn(async () => ({ deleted: true })),
    listChatMessages: vi.fn(async () => []),
    createChatMessage: vi.fn(async (_chatId: string, value: Record<string, unknown>) => value as never),
    updateChatMessage: vi.fn(async (_messageId: string, patch: Record<string, unknown>) => patch as never),
    deleteChatMessage: vi.fn(async () => ({ deleted: true })),
    patchChatMessageExtra: vi.fn(async (_messageId: string, patch: Record<string, unknown>) => patch as never),
    addChatMessageSwipe: vi.fn(async () => ({} as never)),
    patchChatMetadata: vi.fn(async () => ({} as never)),
    patchChatSummaries: vi.fn(async () => ({} as never)),
    listChatMemories: vi.fn(async () => []),
    getWorldState: vi.fn(async () => null),
    saveTrackerSnapshot: vi.fn(async (_chatId: string, snapshot: Record<string, unknown>) => snapshot as never),
    listLorebookEntries: vi.fn(async () => []),
    createLorebookEntries: vi.fn(async () => []),
    promptFull: vi.fn(async () => null),
  };
}

describe("persistConnectedCommandTags connected notes", () => {
  it("stores conversation note and influence tags on the linked roleplay chat", async () => {
    const conversation = {
      id: "conversation-1",
      mode: "conversation",
      connectedChatId: "roleplay-1",
      notes: [],
    };
    const chats = new Map<string, Row>([
      ["conversation-1", conversation],
      ["roleplay-1", { id: "roleplay-1", mode: "roleplay", connectedChatId: "conversation-1", notes: [] }],
    ]);
    const storage = storageWithChats(chats);

    const result = await persistConnectedCommandTags(
      storage,
      conversation,
      "<note>[12:01] Remember the hidden door.</note>\n<influence>Open with the lab alarm.</influence>",
    );

    expect(new Set(result.executedCommands)).toEqual(new Set(["note", "influence"]));
    expect(chats.get("conversation-1")?.notes).toEqual([]);
    const targetNotes = chats.get("roleplay-1")?.notes as Row[];
    expect(targetNotes).toHaveLength(2);
    const note = targetNotes.find((entry) => entry.type === "note");
    const influence = targetNotes.find((entry) => entry.type === "influence");
    expect(note).toMatchObject({
      content: "Remember the hidden door.",
      sourceChatId: "conversation-1",
      targetChatId: "roleplay-1",
    });
    expect(influence).toMatchObject({
      content: "Open with the lab alarm.",
      consumed: false,
      sourceChatId: "conversation-1",
      targetChatId: "roleplay-1",
    });
  });

  it("marks pending linked influences consumed after prompt assembly uses them", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      connectedChatId: "conversation-1",
      notes: [
        { id: "note-1", type: "note", content: "Persistent fact.", targetChatId: "roleplay-1" },
        { id: "influence-1", type: "influence", content: "One-shot.", targetChatId: "roleplay-1", consumed: false },
      ],
    };
    const chats = new Map<string, Row>([["roleplay-1", roleplay]]);
    const storage = storageWithChats(chats);

    await consumePendingConnectedInfluences(storage, roleplay);

    const notes = chats.get("roleplay-1")?.notes as Row[];
    expect(notes[0]?.consumed).toBeUndefined();
    expect(notes[1]).toMatchObject({ consumed: true });
    expect(typeof notes[1]?.consumedAt).toBe("string");
  });
});
