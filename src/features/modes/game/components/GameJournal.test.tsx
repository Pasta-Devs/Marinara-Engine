// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameJournal } from "./GameJournal";
import { gameApi } from "../api/game-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ──────────────────────────────────────────────
// Seam under test: GameJournal must turn a rejected getJournal/updateNotes
// into a retryable error surface instead of a stuck "Loading..."/"Saving..."
// spinner. Mock the feature api + the heavy chats-index barrel + render-only
// helpers so the component mounts in jsdom.
// ──────────────────────────────────────────────
vi.mock("../api/game-api", () => ({
  gameApi: {
    getJournal: vi.fn(),
    updateNotes: vi.fn(),
  },
}));

vi.mock("../../../catalog/chats/index", () => ({
  chatKeys: { detail: (id: string) => ["chats", id] },
}));

vi.mock("../../../../shared/lib/markdown", () => ({
  applyInlineMarkdown: (text: string) => text,
  renderMarkdownBlocks: (text: string) => text,
}));

vi.mock("./AnimatedText", () => ({
  AnimatedText: ({ text }: { text: string }) => text,
}));

vi.mock("../../../../shared/stores/chat.store", () => ({
  useChatStore: Object.assign(() => null, {
    getState: () => ({ activeChatId: null, setActiveChat: vi.fn() }),
  }),
}));

const getJournalMock = vi.mocked(gameApi.getJournal);
const updateNotesMock = vi.mocked(gameApi.updateNotes);

const VALID_JOURNAL = {
  journal: { entries: [], quests: [], locations: [], npcLog: [], inventoryLog: [] },
  playerNotes: "remember the locked door",
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("GameJournal load/save failure UI (issue #1536)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    vi.clearAllMocks();
  });

  function render() {
    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <GameJournal chatId="chat-1" onClose={vi.fn()} />
        </QueryClientProvider>,
      );
    });
  }

  function retryButton() {
    return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Retry"));
  }

  it("renders a retryable error panel (not a stuck spinner) when getJournal fails", async () => {
    getJournalMock.mockRejectedValue(new Error("journal blew up"));

    await render();
    await flush();

    expect(container.textContent).toContain("Couldn't load the journal.");
    expect(container.textContent).toContain("journal blew up");
    expect(container.textContent).not.toContain("Loading journal...");
    expect(retryButton()).toBeTruthy();
  });

  it("retries the load and shows the journal when getJournal succeeds on retry", async () => {
    getJournalMock.mockRejectedValueOnce(new Error("journal blew up")).mockResolvedValueOnce(VALID_JOURNAL as never);

    await render();
    await flush();
    expect(retryButton()).toBeTruthy();

    await act(async () => {
      retryButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(getJournalMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Couldn't load the journal.");
    // Journal panel chrome rendered.
    expect(container.textContent).toContain("Adventure Journal");
  });

  it("surfaces a save failure with retry instead of a stuck 'Saving...'", async () => {
    vi.useFakeTimers();
    try {
      getJournalMock.mockResolvedValue(VALID_JOURNAL as never);
      updateNotesMock.mockRejectedValue(new Error("save blew up"));

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <GameJournal chatId="chat-1" onClose={vi.fn()} />
          </QueryClientProvider>,
        );
      });
      // Flush the resolved getJournal microtasks under fake timers.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Switch to the Notes tab.
      const notesTab = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Notes"));
      await act(async () => {
        notesTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      // Type into the notes textarea, then let the 800ms debounce fire.
      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();
      // Use the native value setter so React's controlled-input value tracker
      // registers the change and fires onChange.
      const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      await act(async () => {
        nativeValueSetter.call(textarea, "a new clue");
        textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        vi.advanceTimersByTime(800);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("Save failed");
      expect(container.textContent).not.toContain("Saving...");
      expect(retryButton()).toBeTruthy();

      // Retry: the next save succeeds, so the failure clears back to "Saved".
      updateNotesMock.mockResolvedValueOnce({
        sessionChat: { id: "chat-1" },
      } as never);
      await act(async () => {
        retryButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(updateNotesMock).toHaveBeenCalledTimes(2);
      expect(container.textContent).not.toContain("Save failed");
      expect(container.textContent).toContain("Saved");
    } finally {
      vi.useRealTimers();
    }
  });
});
