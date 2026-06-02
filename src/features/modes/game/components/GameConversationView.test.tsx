/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConversationView } from "./GameConversationView";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  refetchChat: vi.fn(),
}));

vi.mock("../../../../shared/stores/ui.store", () => ({
  useUIStore: <T,>(selector: (state: { messagesPerPage: number }) => T) => selector({ messagesPerPage: 20 }),
}));

vi.mock("../../shared/chat-ui/index", () => ({
  ChatCommonOverlays: () => null,
  CreatorNotesCssInjector: () => null,
  useChatMetadataSync: () => ({ chatBackground: null }),
  useChatOverlays: () => ({
    settingsOpen: false,
    filesOpen: false,
    galleryOpen: false,
    wizardOpen: false,
    spriteArrangeMode: false,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    closeFiles: vi.fn(),
    closeGallery: vi.fn(),
    toggleSpriteArrange: vi.fn(),
    finishWizard: vi.fn(),
  }),
  useChatSurfaceData: () => ({
    chat: { id: "game-chat", mode: "game", name: "Restored Game", metadata: "{}" },
    chatError: null,
    refetchChat: mocks.refetchChat,
    chatMeta: { gameId: "game-1" },
    messages: [{ id: "m1", role: "assistant", content: "Welcome back.", createdAt: "2026-06-02T00:00:00.000Z" }],
    pageCount: 1,
    isLoading: false,
    fetchNextPage: mocks.fetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
    loadedMessageCount: 1,
    totalMessageCount: 120,
    messageIdByOrderIndex: new Map([[119, "m1"]]),
    characterMap: new Map(),
    chatCharIds: [],
    gameCharacters: [],
    personaInfo: undefined,
    allCharacters: [],
  }),
  useChatTimelineActions: () => ({
    isStreaming: false,
    peekPromptData: null,
    deleteDialogMessageId: null,
    deleteDialogCanDeleteSwipe: false,
    deleteDialogActiveSwipeIndex: 0,
    deleteDialogSwipeCount: 0,
    multiSelectMode: false,
    selectedMessageIds: new Set(),
    handleDelete: vi.fn(),
    handleIllustrate: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleDeleteSwipe: vi.fn(),
    handleDeleteMore: vi.fn(),
    closeDeleteDialog: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleCancelMultiSelect: vi.fn(),
    handleUnselectAllMessages: vi.fn(),
    handleSelectAllAboveSelection: vi.fn(),
    handleSelectAllBelowSelection: vi.fn(),
  }),
  useSpriteMetadataState: () => ({
    handleResetSpritePlacements: vi.fn(),
    handleSetSpritePosition: vi.fn(),
  }),
}));

vi.mock("./GameSurface", () => ({
  GameSurface: () => <div data-testid="game-surface" />,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderGameConversationView() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<GameConversationView activeChatId="game-chat" />);
  });
  return container;
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

describe("GameConversationView", () => {
  it("does not eagerly fetch every older page when a restored game chat mounts", () => {
    const view = renderGameConversationView();

    expect(view.querySelector("[data-testid='game-surface']")).not.toBeNull();
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
  });
});
