import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../../../capabilities/storage";
import type { SceneCreateRequest, SceneForkRequest, SceneFullPlan } from "../../../contracts/types/scene";
import { createRoleplayScene, forkRoleplayScene } from "./scene-service";

type JsonRecord = Record<string, unknown>;

interface CreateCall {
  entity: string;
  value: JsonRecord;
}

interface UpdateCall {
  entity: string;
  id: string;
  patch: JsonRecord;
}

interface RecordingStorage {
  gateway: StorageGateway;
  createCalls: CreateCall[];
  updateCalls: UpdateCall[];
  chatMessages: JsonRecord[];
}

function recordingStorage(chatsById: Record<string, JsonRecord>): RecordingStorage {
  const createCalls: CreateCall[] = [];
  const updateCalls: UpdateCall[] = [];
  const chatMessages: JsonRecord[] = [];
  let createCounter = 0;
  const gateway: StorageGateway = {
    list: async <T,>() => [] as T[],
    get: async <T,>(entity: string, id: string) => {
      if (entity === "chats") {
        return ((chatsById[id] ?? null) as T | null) ?? null;
      }
      return null as T | null;
    },
    create: async <T,>(entity: string, value: Record<string, unknown>) => {
      createCounter += 1;
      const id = `${entity}-${createCounter}`;
      const stored = { id, ...value };
      createCalls.push({ entity, value: { ...value } });
      if (entity === "chats") {
        chatsById[id] = stored;
      }
      return stored as T;
    },
    update: async <T,>(entity: string, id: string, patch: Record<string, unknown>) => {
      updateCalls.push({ entity, id, patch: { ...patch } });
      if (entity === "chats" && chatsById[id]) {
        chatsById[id] = { ...chatsById[id], ...patch };
      }
      return ({ id, ...patch }) as T;
    },
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T,>(chatId: string, value: Record<string, unknown>) => {
      const stored = { id: `message-${chatMessages.length + 1}`, chatId, ...value };
      chatMessages.push(stored);
      return stored as T;
    },
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
  return { gateway, createCalls, updateCalls, chatMessages };
}

function makePlan(overrides: Partial<SceneFullPlan> = {}): SceneFullPlan {
  return {
    name: "Scene: Test",
    description: "A test scene begins.",
    scenario: "Test scenario.",
    firstMessage: "The scene begins.",
    background: null,
    characterIds: [],
    systemPrompt: "Write immersive roleplay prose.",
    rating: "sfw",
    relationshipHistory: "",
    participationGuide: "",
    ...overrides,
  };
}

function createdChatPayloads(storage: RecordingStorage): JsonRecord[] {
  return storage.createCalls.filter((call) => call.entity === "chats").map((call) => call.value);
}

describe("createRoleplayScene folderId inheritance", () => {
  it("inherits folderId from the origin chat when the origin sits inside a folder", async () => {
    const storage = recordingStorage({
      "origin-1": {
        id: "origin-1",
        name: "Origin",
        mode: "conversation",
        characterIds: ["char-a"],
        folderId: "folder-abc",
        groupId: null,
        personaId: null,
        promptPresetId: null,
        connectionId: null,
        metadata: {},
      },
    });

    const input: SceneCreateRequest = {
      originChatId: "origin-1",
      initiatorCharId: null,
      plan: makePlan({ characterIds: ["char-a"] }),
      connectionId: null,
    };

    await createRoleplayScene(storage.gateway, input);

    const payloads = createdChatPayloads(storage);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBe("folder-abc");
  });

  it("preserves a null folderId from a root-level origin chat", async () => {
    const storage = recordingStorage({
      "origin-2": {
        id: "origin-2",
        name: "Origin",
        mode: "conversation",
        characterIds: ["char-a"],
        folderId: null,
        groupId: null,
        personaId: null,
        promptPresetId: null,
        connectionId: null,
        metadata: {},
      },
    });

    const input: SceneCreateRequest = {
      originChatId: "origin-2",
      initiatorCharId: null,
      plan: makePlan({ characterIds: ["char-a"] }),
      connectionId: null,
    };

    await createRoleplayScene(storage.gateway, input);

    const payloads = createdChatPayloads(storage);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBeNull();
  });
});

describe("forkRoleplayScene folderId inheritance", () => {
  it("inherits folderId from the scene chat when cloning a scene that lives in a folder", async () => {
    const storage = recordingStorage({
      "scene-1": {
        id: "scene-1",
        name: "Scene: Cloned",
        mode: "roleplay",
        characterIds: ["char-a"],
        folderId: "folder-xyz",
        groupId: null,
        personaId: null,
        promptPresetId: null,
        connectionId: null,
        metadata: {
          sceneOriginChatId: "origin-x",
          sceneStatus: "active",
        },
      },
    });

    const input: SceneForkRequest = {
      sceneChatId: "scene-1",
      mode: "clone",
      includePreSceneSummary: false,
      includeParticipationGuide: false,
    };

    await forkRoleplayScene(storage.gateway, input);

    const payloads = createdChatPayloads(storage);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBe("folder-xyz");
  });

  it("inherits folderId from the scene chat when converting", async () => {
    const storage = recordingStorage({
      "origin-x": {
        id: "origin-x",
        name: "Origin",
        mode: "conversation",
        characterIds: ["char-a"],
        folderId: "folder-xyz",
        groupId: null,
        personaId: null,
        promptPresetId: null,
        connectionId: null,
        metadata: {},
      },
      "scene-1": {
        id: "scene-1",
        name: "Scene: Converted",
        mode: "roleplay",
        characterIds: ["char-a"],
        folderId: "folder-xyz",
        groupId: null,
        personaId: null,
        promptPresetId: null,
        connectionId: null,
        metadata: {
          sceneOriginChatId: "origin-x",
          sceneStatus: "active",
        },
      },
    });

    const input: SceneForkRequest = {
      sceneChatId: "scene-1",
      mode: "convert",
      includePreSceneSummary: false,
      includeParticipationGuide: false,
    };

    await forkRoleplayScene(storage.gateway, input);

    const payloads = createdChatPayloads(storage);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBe("folder-xyz");
  });
});
