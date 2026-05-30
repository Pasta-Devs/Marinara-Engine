import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { consumePendingConnectedInfluences, persistConnectedCommandTags } from "./connected-commands";

type Row = Record<string, unknown>;

function storageWithChats(chats: Map<string, Row>, entities: Record<string, Row[]> = {}): StorageGateway {
  return {
    list: vi.fn(async (entity: string) => {
      if (entity === "chats") return Array.from(chats.values()) as never;
      return (entities[entity] ?? []) as never;
    }),
    get: vi.fn(async (entity: string, id: string) => (entity === "chats" ? ((chats.get(id) as never) ?? null) : null)),
    create: vi.fn(async (entity: string, value: Record<string, unknown>) => {
      if (entity === "chats") {
        const row = { ...value, id: value.id ?? `chat-${chats.size + 1}` };
        chats.set(String(row.id), row);
        return row as never;
      }
      return value as never;
    }),
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
    addChatMessageSwipe: vi.fn(async () => ({}) as never),
    patchChatMetadata: vi.fn(async () => ({}) as never),
    patchChatSummaries: vi.fn(async () => ({}) as never),
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

describe("persistConnectedCommandTags roleplay direct messages", () => {
  const mira = { id: "char-mira", name: "Mira", data: { name: "Mira" } };

  it("posts roleplay direct-message commands to an existing conversation chat when enabled", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const chats = new Map<string, Row>([
      ["roleplay-1", roleplay],
      ["conversation-mira", { id: "conversation-mira", mode: "conversation", name: "Mira", characterIds: ["char-mira"] }],
    ]);
    const storage = storageWithChats(chats, { characters: [mira] });

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      'She looks away. [dm: character="Mira", message="[12:01] Meet me outside."]',
    );

    expect(result.displayContent).toBe("She looks away.");
    expect(result.executedCommands).toEqual(["dm"]);
    expect(storage.createChatMessage).toHaveBeenCalledWith(
      "conversation-mira",
      expect.objectContaining({
        chatId: "conversation-mira",
        role: "assistant",
        characterId: "char-mira",
        content: "Meet me outside.",
      }),
    );
    expect(result.events).toContainEqual({
      type: "ooc_posted",
      data: { chatId: "conversation-mira", chatName: "Mira", count: 1, createdChat: false },
    });
  });

  it("creates a conversation DM chat when the target character has no existing conversation", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      folderId: "folder-1",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const chats = new Map<string, Row>([["roleplay-1", roleplay]]);
    const storage = storageWithChats(chats, { characters: [mira] });

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      'She keeps narrating. [dm: character="Mira", message="I found the key."]',
    );

    expect(result.displayContent).toBe("She keeps narrating.");
    expect(storage.create).toHaveBeenCalledWith(
      "chats",
      expect.objectContaining({
        name: "Mira",
        mode: "conversation",
        characterIds: ["char-mira"],
        folderId: "folder-1",
        metadata: {},
      }),
    );
    expect(storage.createChatMessage).toHaveBeenCalledWith(
      "chat-2",
      expect.objectContaining({
        chatId: "chat-2",
        role: "assistant",
        characterId: "char-mira",
        content: "I found the key.",
      }),
    );
    expect(result.events).toContainEqual({
      type: "ooc_posted",
      data: { chatId: "chat-2", chatName: "Mira", count: 1, createdChat: true },
    });
  });

  it("suppresses the source assistant message when a direct-message command has no visible roleplay text", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const chats = new Map<string, Row>([
      ["roleplay-1", roleplay],
      ["conversation-mira", { id: "conversation-mira", mode: "conversation", name: "Mira", characterIds: ["char-mira"] }],
    ]);
    const storage = storageWithChats(chats, { characters: [mira] });

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      '[dm: character="Mira", message="I found the key."]',
    );

    expect(result.displayContent).toBe("");
    expect(result.executedCommands).toEqual(["dm"]);
    expect(result.suppressAssistantMessage).toBe(true);
    expect(storage.createChatMessage).toHaveBeenCalledWith(
      "conversation-mira",
      expect.objectContaining({ content: "I found the key." }),
    );
  });

  it("leaves direct-message tags visible when the roleplay setting is disabled", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: false },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["roleplay-1", roleplay]]), { characters: [mira] });
    const content = 'Visible. [dm: character="Mira", message="Do not route this."]';

    const result = await persistConnectedCommandTags(storage, roleplay, content);

    expect(result.displayContent).toBe(content);
    expect(result.executedCommands).toEqual([]);
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });

  it("does not enable direct-message commands outside roleplay mode", async () => {
    const conversation = {
      id: "conversation-1",
      mode: "conversation",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["conversation-1", conversation]]), { characters: [mira] });
    const content = 'Visible. [dm: character="Mira", message="Do not route this."]';

    const result = await persistConnectedCommandTags(storage, conversation, content);

    expect(result.displayContent).toBe(content);
    expect(result.executedCommands).toEqual([]);
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });

  it("emits command_error when a roleplay direct-message target character cannot be found", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["roleplay-1", roleplay]]), { characters: [] });

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      'Visible. [dm: character="Missing", message="This should not vanish silently."]',
    );

    expect(result.displayContent).toBe("Visible.");
    expect(result.executedCommands).toEqual([]);
    expect(result.events).toContainEqual({
      type: "command_error",
      data: {
        command: "dm",
        error: 'No character named "Missing" was found for the direct-message command.',
      },
    });
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });

  it("suppresses the source assistant message when a failed direct-message command has no visible text", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["roleplay-1", roleplay]]), { characters: [] });

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      '[dm: character="Missing", message="This should not force a blank source turn."]',
    );

    expect(result.displayContent).toBe("");
    expect(result.executedCommands).toEqual([]);
    expect(result.suppressAssistantMessage).toBe(true);
    expect(result.events).toContainEqual({
      type: "command_error",
      data: {
        command: "dm",
        error: 'No character named "Missing" was found for the direct-message command.',
      },
    });
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });

  it("reports malformed direct-message commands and suppresses an empty source turn", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["roleplay-1", roleplay]]), { characters: [mira] });

    const result = await persistConnectedCommandTags(storage, roleplay, '[dm: character="Mira"]');

    expect(result.displayContent).toBe("");
    expect(result.executedCommands).toEqual([]);
    expect(result.suppressAssistantMessage).toBe(true);
    expect(result.events).toContainEqual({
      type: "command_error",
      data: {
        command: "dm",
        error: "Direct-message command must include both character and message.",
      },
    });
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });

  it("emits command_error when a new direct-message conversation cannot be resolved", async () => {
    const roleplay = {
      id: "roleplay-1",
      mode: "roleplay",
      metadata: { roleplayDmCommandsEnabled: true },
      notes: [],
    };
    const storage = storageWithChats(new Map<string, Row>([["roleplay-1", roleplay]]), { characters: [mira] });
    storage.create = vi.fn(async () => ({ name: "Mira", mode: "conversation", characterIds: ["char-mira"] }) as never);

    const result = await persistConnectedCommandTags(
      storage,
      roleplay,
      'Visible. [dm: character="Mira", message="This should report failure."]',
    );

    expect(result.displayContent).toBe("Visible.");
    expect(result.executedCommands).toEqual([]);
    expect(result.events).toContainEqual({
      type: "command_error",
      data: {
        command: "dm",
        error: "Could not resolve a conversation for the direct-message command.",
      },
    });
    expect(storage.createChatMessage).not.toHaveBeenCalled();
  });
});

describe("persistConnectedCommandTags command failures", () => {
  it("emits command_error when a command throws during execution instead of swallowing it", async () => {
    const conversation = { id: "conversation-1", mode: "conversation", notes: [] };
    const chats = new Map<string, Row>([["conversation-1", conversation]]);
    const storage = storageWithChats(chats);
    storage.create = vi.fn(async () => {
      throw new Error("disk full");
    });

    const result = await persistConnectedCommandTags(
      storage,
      conversation,
      'Sure thing. [create_character: name="Ada"]',
    );

    expect(result.events).toContainEqual({
      type: "command_error",
      data: { command: "create_character", error: "disk full" },
    });
    expect(result.executedCommands).not.toContain("create_character");
    // The failure is now surfaced, but the command tag is still stripped from the visible message.
    expect(result.displayContent).toBe("Sure thing.");
  });

  it("continues processing remaining commands after one throws", async () => {
    const conversation = { id: "conversation-1", mode: "conversation", notes: [] };
    const chats = new Map<string, Row>([["conversation-1", conversation]]);
    const storage = storageWithChats(chats);
    storage.create = vi.fn(async () => {
      throw new Error("disk full");
    });

    const result = await persistConnectedCommandTags(
      storage,
      conversation,
      '[create_character: name="Ada"]\n<note>[12:01] Remember the door.</note>',
    );

    const commandErrors = result.events.filter((event) => event.type === "command_error");
    expect(commandErrors).toHaveLength(1);
    // The note after the failing command still runs — no rethrow / no abort.
    expect(result.executedCommands).toContain("note");
  });

  it("emits command_error for an unsupported haptic command when integrations are absent", async () => {
    const conversation = { id: "conversation-1", mode: "conversation", notes: [] };
    const chats = new Map<string, Row>([["conversation-1", conversation]]);
    const storage = storageWithChats(chats);

    const result = await persistConnectedCommandTags(storage, conversation, '[haptic: action="vibrate"]');

    expect(result.events.some((event) => event.type === "command_error")).toBe(true);
    const haptic = result.events.find(
      (event): event is Extract<typeof event, { type: "command_error" }> => event.type === "command_error",
    );
    expect(haptic?.data.command).toBe("haptic");
    expect(result.executedCommands).not.toContain("haptic");
  });

  it("does not emit command_error for a successful note (intentional no-ops stay silent)", async () => {
    const conversation = { id: "conversation-1", mode: "conversation", notes: [] };
    const chats = new Map<string, Row>([["conversation-1", conversation]]);
    const storage = storageWithChats(chats);

    const result = await persistConnectedCommandTags(storage, conversation, "<note>[12:01] Remember the door.</note>");

    expect(result.events.some((event) => event.type === "command_error")).toBe(false);
    expect(result.executedCommands).toContain("note");
  });
});
