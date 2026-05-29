// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "../../../../../engine/contracts/types/chat";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { useChatMetadataSync } from "./use-chat-metadata-sync";

const catalogMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("../../../../catalog/chats/index", () => ({
  useUpdateChatMetadata: () => ({ mutate: catalogMocks.mutate }),
}));

type HarnessProps = {
  chatId: string;
  background: string | null;
};

function Harness({ chatId, background }: HarnessProps) {
  useChatMetadataSync({
    chat: { id: chatId } as Chat,
    chatMeta: { background },
    messages: [],
    messagePageCount: 1,
  });
  return null;
}

describe("useChatMetadataSync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    catalogMocks.mutate.mockReset();
    useUIStore.getState().setChatBackground(null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    useUIStore.getState().setChatBackground(null);
  });

  it("clears a stale chat background when the active chat metadata hydrates to no background", () => {
    act(() => {
      root.render(<Harness chatId="chat-with-background" background="old-background.png" />);
    });
    expect(useUIStore.getState().chatBackground).toBe("marinara-background:old-background.png");

    act(() => {
      root.render(<Harness chatId="chat-without-background" background="old-background.png" />);
    });
    expect(useUIStore.getState().chatBackground).toBe("marinara-background:old-background.png");

    act(() => {
      root.render(<Harness chatId="chat-without-background" background={null} />);
    });

    expect(useUIStore.getState().chatBackground).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(catalogMocks.mutate).not.toHaveBeenCalled();
  });

  it("restores a chat background when the active chat metadata hydrates with a background", () => {
    act(() => {
      root.render(<Harness chatId="chat-with-delayed-background" background={null} />);
    });
    expect(useUIStore.getState().chatBackground).toBeNull();

    act(() => {
      root.render(<Harness chatId="chat-with-delayed-background" background="new-background.png" />);
    });

    expect(useUIStore.getState().chatBackground).toBe("marinara-background:new-background.png");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(catalogMocks.mutate).not.toHaveBeenCalled();
  });

  it("does not clobber a local background change when stale metadata refreshes before persistence", () => {
    act(() => {
      root.render(<Harness chatId="chat-with-local-change" background="persisted-background.png" />);
    });
    expect(useUIStore.getState().chatBackground).toBe("marinara-background:persisted-background.png");

    act(() => {
      useUIStore.getState().setChatBackground("https://media.local/new-background.png");
    });

    act(() => {
      root.render(<Harness chatId="chat-with-local-change" background="stale-background.png" />);
    });

    expect(useUIStore.getState().chatBackground).toBe("https://media.local/new-background.png");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(catalogMocks.mutate).toHaveBeenCalledWith({
      id: "chat-with-local-change",
      background: "https://media.local/new-background.png",
    });
  });

  it("cancels a pending write when the active chat background returns to the saved value", () => {
    act(() => {
      root.render(<Harness chatId="chat-with-reverted-change" background="saved-background.png" />);
    });

    act(() => {
      useUIStore.getState().setChatBackground("https://media.local/temporary-background.png");
    });
    act(() => {
      useUIStore.getState().setChatBackground("marinara-background:saved-background.png");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(catalogMocks.mutate).not.toHaveBeenCalled();
  });

  it("cancels a pending write when metadata catches up before the debounce fires", () => {
    act(() => {
      root.render(<Harness chatId="chat-with-caught-up-change" background="old-background.png" />);
    });

    act(() => {
      useUIStore.getState().setChatBackground("https://media.local/new-background.png");
    });
    act(() => {
      root.render(<Harness chatId="chat-with-caught-up-change" background="https://media.local/new-background.png" />);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(catalogMocks.mutate).not.toHaveBeenCalled();
  });

  it("keeps pending background writes isolated per chat", () => {
    act(() => {
      root.render(<Harness chatId="first-chat" background="first-saved.png" />);
    });
    act(() => {
      useUIStore.getState().setChatBackground("https://media.local/first-new.png");
    });

    act(() => {
      root.render(<Harness chatId="second-chat" background="second-saved.png" />);
    });
    act(() => {
      useUIStore.getState().setChatBackground("https://media.local/second-new.png");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(catalogMocks.mutate).toHaveBeenCalledTimes(2);
    expect(catalogMocks.mutate).toHaveBeenCalledWith({
      id: "first-chat",
      background: "https://media.local/first-new.png",
    });
    expect(catalogMocks.mutate).toHaveBeenCalledWith({
      id: "second-chat",
      background: "https://media.local/second-new.png",
    });
  });
});
