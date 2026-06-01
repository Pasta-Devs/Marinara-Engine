import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageWithSwipes } from "../types";
import { useSpriteMetadataState } from "./use-sprite-metadata-state";

const updateMetaMutate = vi.fn();
const updateMessageExtraMutate = vi.fn();

vi.mock("../../../../catalog/chats/index", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useUpdateChatMetadata: () => ({ mutate: updateMetaMutate }),
  useUpdateMessageExtra: () => ({ mutate: updateMessageExtraMutate }),
}));

vi.mock("../../../../../shared/stores/ui.store", () => ({
  useUIStore: <T,>(selector: (state: { roleplaySpriteScale: number }) => T) =>
    selector({ roleplaySpriteScale: 1 }),
}));

function message(overrides: Partial<MessageWithSwipes>): MessageWithSwipes {
  return {
    id: "message-1",
    chatId: "chat-1",
    role: "assistant",
    content: "",
    orderIndex: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as MessageWithSwipes;
}

function extra(value: Record<string, unknown>): MessageWithSwipes["extra"] {
  return value as unknown as MessageWithSwipes["extra"];
}

type SpriteState = ReturnType<typeof useSpriteMetadataState>;

function renderSpriteState(props: Parameters<typeof useSpriteMetadataState>[0]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  const result: { current: SpriteState | null } = { current: null };

  function Probe() {
    result.current = useSpriteMetadataState(props);
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  if (!result.current) throw new Error("Sprite state did not render");
  return {
    state: result.current,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("useSpriteMetadataState", () => {
  beforeEach(() => {
    updateMetaMutate.mockClear();
    updateMessageExtraMutate.mockClear();
  });

  it("falls back to chat-level sprite expressions when the latest assistant message has none", () => {
    const { state, cleanup } = renderSpriteState({
      chat: { id: "chat-1" } as Parameters<typeof useSpriteMetadataState>[0]["chat"],
      chatMeta: { spriteExpressions: { "character:alice": "happy" } },
      messages: [
        message({
          id: "older",
          extra: extra({ spriteExpressions: { "character:alice": "sad" } }),
        }),
        message({
          id: "latest",
          extra: extra({}),
        }),
      ],
    });

    expect(state.spriteExpressions).toEqual({ "character:alice": "happy" });
    cleanup();
  });

  it("persists manual expression changes to metadata even before an assistant message exists", () => {
    const { state, cleanup } = renderSpriteState({
      chat: { id: "chat-1" } as Parameters<typeof useSpriteMetadataState>[0]["chat"],
      chatMeta: {},
      messages: [message({ id: "user-message", role: "user" })],
    });

    act(() => {
      state.handleExpressionChange("character:alice", "smirk", { immediate: true });
    });

    expect(updateMetaMutate).toHaveBeenCalledWith({
      id: "chat-1",
      spriteExpressions: { "character:alice": "smirk" },
    });
    expect(updateMessageExtraMutate).not.toHaveBeenCalled();
    cleanup();
  });

  it("persists expression changes to both chat metadata and the latest assistant message", () => {
    const { state, cleanup } = renderSpriteState({
      chat: { id: "chat-1" } as Parameters<typeof useSpriteMetadataState>[0]["chat"],
      chatMeta: {},
      messages: [
        message({ id: "assistant-older" }),
        message({ id: "assistant-latest" }),
      ],
    });

    act(() => {
      state.handleExpressionChange("character:alice", "thinking", { immediate: true });
    });

    expect(updateMetaMutate).toHaveBeenCalledWith({
      id: "chat-1",
      spriteExpressions: { "character:alice": "thinking" },
    });
    expect(updateMessageExtraMutate).toHaveBeenCalledWith({
      messageId: "assistant-latest",
      extra: { spriteExpressions: { "character:alice": "thinking" } },
    });
    cleanup();
  });
});
