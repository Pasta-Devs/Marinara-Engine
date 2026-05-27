import { describe, expect, it } from "vitest";

import {
  chatGalleryUploadFailureError,
  getGalleryChatIds,
  getGameGalleryScopeId,
  listGalleryImagesForChatIds,
} from "./use-gallery";
import type { Chat, ChatMetadata } from "../../../../engine/contracts/types/chat";

function metadata(overrides: Partial<ChatMetadata> = {}): ChatMetadata {
  return {
    summary: null,
    tags: [],
    enableAgents: true,
    agentOverrides: {},
    activeAgentIds: [],
    activeToolIds: [],
    presetChoices: {},
    ...overrides,
  };
}

function chat(overrides: Partial<Chat> & Pick<Chat, "id" | "mode">): Chat {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    mode: overrides.mode,
    characterIds: overrides.characterIds ?? [],
    groupId: overrides.groupId ?? null,
    personaId: overrides.personaId ?? null,
    promptPresetId: overrides.promptPresetId ?? null,
    connectionId: overrides.connectionId ?? null,
    connectedChatId: overrides.connectedChatId ?? null,
    folderId: overrides.folderId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-27T00:00:00.000Z",
    metadata: overrides.metadata ?? metadata(),
  };
}

describe("chatGalleryUploadFailureError", () => {
  it("preserves the underlying remote error for single-file uploads", () => {
    const remoteError = new Error("chat_gallery_upload is not exposed by the remote runtime");

    expect(chatGalleryUploadFailureError(1, [remoteError])).toBe(remoteError);
  });

  it("keeps a batch summary for multi-file partial failures", () => {
    expect(chatGalleryUploadFailureError(2, [new Error("nope")]).message).toBe(
      "One chat gallery image failed to upload.",
    );
  });
});

describe("game gallery scope", () => {
  it("prefers metadata gameId over groupId for game chats", () => {
    expect(
      getGameGalleryScopeId(
        chat({ id: "session-2", mode: "game", groupId: "fallback-game", metadata: metadata({ gameId: "game-1" }) }),
      ),
    ).toBe("game-1");
  });

  it("aggregates only game sessions in the same scope and keeps the active chat included", () => {
    const active = chat({ id: "session-2", mode: "game", groupId: "game-1", metadata: metadata({ gameId: "game-1" }) });
    const sessions = [
      chat({ id: "session-1", mode: "game", groupId: "game-1", metadata: metadata({ gameId: "game-1" }) }),
      active,
      chat({ id: "other-game-session", mode: "game", groupId: "game-2", metadata: metadata({ gameId: "game-2" }) }),
      chat({ id: "conversation-1", mode: "conversation", groupId: "game-1" }),
    ];

    expect(getGalleryChatIds(active, sessions)).toEqual(["session-1", "session-2"]);
    expect(getGalleryChatIds(active, [])).toEqual(["session-2"]);
  });

  it("does not aggregate non-game chats or game chats without a scope id", () => {
    const sessions = [chat({ id: "session-1", mode: "game", groupId: "game-1" })];

    expect(getGalleryChatIds(chat({ id: "conversation-1", mode: "conversation", groupId: "game-1" }), sessions)).toEqual([
      "conversation-1",
    ]);
    expect(getGalleryChatIds(chat({ id: "solo", mode: "game" }), sessions)).toEqual(["solo"]);
  });

  it("lists gallery rows for every scoped chat id and sorts newest first", async () => {
    const calls: string[] = [];
    const images = await listGalleryImagesForChatIds(["session-1", "session-2"], async (chatId) => {
      calls.push(chatId);
      return [
        {
          id: `${chatId}-image`,
          chatId,
          url: `data:image/png;base64,${chatId}`,
          createdAt: chatId === "session-1" ? "2026-05-27T00:00:00.000Z" : "2026-05-27T01:00:00.000Z",
        },
      ];
    });

    expect(calls).toEqual(["session-1", "session-2"]);
    expect(images.map((image) => image.id)).toEqual(["session-2-image", "session-1-image"]);
  });
});
