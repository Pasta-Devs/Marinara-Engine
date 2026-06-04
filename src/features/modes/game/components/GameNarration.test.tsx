/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../../../engine/contracts/types/chat";
import { parseSegmentInventoryUpdates } from "../lib/game-tag-parser";
import { GameNarration } from "./GameNarration";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn(() => Promise.resolve()),
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: vi.fn(),
});

vi.mock("../../../../shared/hooks/use-translate", () => ({
  useTranslate: () => ({ translations: {}, translating: {} }),
}));

vi.mock("../../../../shared/hooks/use-tts", () => ({
  useTTSConfig: () => ({ data: null }),
}));

vi.mock("../../../catalog/agents/regex-application", () => ({
  useApplyRegex: () => ({ applyToAIOutput: (text: string) => text }),
}));

vi.mock("../../../../shared/stores/chat.store", () => ({
  useChatStore: <T,>(selector: (state: { activeChat: { metadata: Record<string, unknown> } }) => T) =>
    selector({ activeChat: { metadata: {} } }),
}));

vi.mock("../stores/game-asset.store", () => ({
  useGameAssetStore: <T,>(selector: (state: { manifest: null }) => T) => selector({ manifest: null }),
}));

vi.mock("../stores/game-mode.store", () => ({
  useGameModeStore: <T,>(selector: (state: { npcs: [] }) => T) => selector({ npcs: [] }),
}));

vi.mock("../../../../shared/stores/ui.store", () => ({
  useUIStore: <T,>(
    selector: (state: {
      messagesPerPage: number;
      gameDialogueDisplayMode: "single";
      gameInstantTextReveal: boolean;
      gameTextSpeed: number;
      gameAutoPlayDelay: number;
      chatFontColor: string;
      chatFontSize: number;
      gameAvatarScale: number;
      textBlipMode: "off";
      customTextBlipSound: null;
    }) => T,
  ) =>
    selector({
      messagesPerPage: 20,
      gameDialogueDisplayMode: "single",
      gameInstantTextReveal: true,
      gameTextSpeed: 100,
      gameAutoPlayDelay: 1000,
      chatFontColor: "",
      chatFontSize: 16,
      gameAvatarScale: 1,
      textBlipMode: "off",
      customTextBlipSound: null,
    }),
}));

const legacyContent = [
  "Narration: The old road bends toward the village.",
  'Dialogue [Alice] [happy]: "We made it."',
  'Dialogue [Cara]: "No sprite needed."',
  '[Bob] [thinking]: "Something feels off."',
].join("\n");

const legacyMessage: Message = {
  id: "legacy-message",
  role: "assistant",
  chatId: "game-chat",
  characterId: null,
  content: legacyContent,
  activeSwipeIndex: 0,
  createdAt: "2026-06-04T00:00:00.000Z",
  extra: {
    displayText: null,
    isGenerated: true,
    tokenCount: null,
    generationInfo: null,
  },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderGameNarration(onInterruptRequest = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <GameNarration
        messages={[legacyMessage]}
        isStreaming={false}
        characterMap={new Map()}
        onInterruptRequest={onInterruptRequest}
      />,
    );
  });

  return { container, onInterruptRequest };
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("GameNarration legacy segment parsing", () => {
  it("renders legacy narration without leaking its prefix", () => {
    const view = renderGameNarration().container;

    expect(view.textContent).toContain("The old road bends toward the village.");
    expect(view.textContent).not.toContain("Narration:");
  });

  it("truncates unread legacy content at the active segment boundary when interrupting", () => {
    const onInterruptRequest = vi.fn();
    const view = renderGameNarration(onInterruptRequest).container;

    const interruptButton = view.querySelector<HTMLButtonElement>('button[aria-label="Interrupt"]');
    expect(interruptButton).not.toBeNull();
    act(() => {
      interruptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onInterruptRequest).toHaveBeenCalledWith({
      messageId: "legacy-message",
      truncatedContent: "Narration: The old road bends toward the village.",
    });
  });

  it("keeps inventory timing aligned with legacy segment boundaries", () => {
    const rawContent = [
      "Narration: The old road bends toward the village.",
      'Dialogue [Alice] [happy]: "We made it." [inventory: action=add item="Map"]',
      '[Bob] [thinking]: "Something feels off."',
    ].join("\n");

    expect(parseSegmentInventoryUpdates(rawContent)).toEqual([
      {
        segment: 1,
        update: {
          action: "add",
          items: ["Map"],
        },
      },
    ]);
  });
});
