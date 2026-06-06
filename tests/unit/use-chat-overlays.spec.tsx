import { StrictMode, useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatOverlays } from "../../src/features/modes/shared/chat-ui/hooks/use-chat-overlays";
import { useChatStore } from "../../src/shared/stores/chat.store";

type OverlaySnapshot = {
  wizardOpen: boolean;
  settingsOpen: boolean;
  newChatSetupChatId: string | null;
};

function OverlayProbe({
  activeChatId,
  onSnapshot,
}: {
  activeChatId: string;
  onSnapshot: (snapshot: OverlaySnapshot) => void;
}) {
  const overlays = useChatOverlays(activeChatId);

  useEffect(() => {
    onSnapshot({
      wizardOpen: overlays.wizardOpen,
      settingsOpen: overlays.settingsOpen,
      newChatSetupChatId: overlays.newChatSetupChatId,
    });
  }, [onSnapshot, overlays.newChatSetupChatId, overlays.settingsOpen, overlays.wizardOpen]);

  return null;
}

async function flushScheduledOverlayOpen() {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

describe("useChatOverlays", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0),
    );
    vi.stubGlobal("cancelIdleCallback", (handle: number) => window.clearTimeout(handle));

    window.localStorage.clear();
    useChatStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
    useChatStore.getState().reset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps targeted new-chat wizard intent alive through StrictMode effect cleanup", async () => {
    const chatId = "chat-1";
    const snapshots: OverlaySnapshot[] = [];

    act(() => {
      const store = useChatStore.getState();
      store.setShouldOpenSettings(true, chatId);
      store.setShouldOpenWizard(true, chatId);
    });

    await act(async () => {
      root = createRoot(container!);
      root.render(
        <StrictMode>
          <OverlayProbe activeChatId={chatId} onSnapshot={(snapshot) => snapshots.push(snapshot)} />
        </StrictMode>,
      );
    });
    await flushScheduledOverlayOpen();

    expect(snapshots.some((snapshot) => snapshot.wizardOpen && snapshot.newChatSetupChatId === chatId)).toBe(true);
    expect(useChatStore.getState().newChatSetupIntent).toBeNull();
    expect(useChatStore.getState().shouldOpenWizard).toBe(false);
    expect(useChatStore.getState().shouldOpenSettings).toBe(false);
  });
});
