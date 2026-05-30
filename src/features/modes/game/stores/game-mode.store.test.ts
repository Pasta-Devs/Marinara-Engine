import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameNpc, HudWidget } from "../../../../engine/contracts/types/game";
import { BUILT_IN_MARI_AVATAR } from "../../../../engine/modes/game/assets/npc-avatar-utils";
import { storageApi } from "../../../../shared/api/storage-api";
import { resetGameMetadataPersistenceForTest } from "../lib/game-metadata-persistence";
import { useSyncGameState } from "../hooks/use-game";
import {
  getHudWidgetStateSignature,
  getPendingHudWidgetPersistenceSignature,
  resetHudWidgetPersistenceForTest,
  useGameModeStore,
} from "./game-mode.store";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    patchChatMetadata: vi.fn(),
  },
}));

const patchChatMetadataMock = vi.mocked(storageApi.patchChatMetadata);

function npc(overrides: Partial<GameNpc>): GameNpc {
  return {
    id: overrides.id ?? "npc-1",
    emoji: overrides.emoji ?? "",
    name: overrides.name ?? "NPC",
    description: overrides.description ?? "",
    location: overrides.location ?? "",
    reputation: overrides.reputation ?? 0,
    met: overrides.met ?? true,
    notes: overrides.notes ?? [],
    avatarUrl: overrides.avatarUrl ?? null,
  };
}

function widget(overrides: Partial<HudWidget> = {}): HudWidget {
  return {
    id: overrides.id ?? "inventory",
    type: overrides.type ?? "inventory_grid",
    label: overrides.label ?? "Inventory",
    position: overrides.position ?? "hud_right",
    config: overrides.config ?? { contents: [] },
  } as HudWidget;
}

function chat(metadata: Record<string, unknown> = {}) {
  return {
    id: "chat-1",
    name: "Game",
    mode: "game",
    characterIds: [],
    metadata,
  };
}

async function resetStoreTestState() {
  useGameModeStore.getState().reset();
  resetHudWidgetPersistenceForTest();
  await resetGameMetadataPersistenceForTest();
  patchChatMetadataMock.mockReset();
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await resetStoreTestState();
});

afterEach(async () => {
  await resetStoreTestState();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useGameModeStore NPC avatar handling", () => {
  it("removes the built-in Mari avatar from non-Mari NPCs when syncing metadata", () => {
    useGameModeStore
      .getState()
      .setNpcs([
        npc({ id: "npc-caretaker", name: "Caretaker", avatarUrl: BUILT_IN_MARI_AVATAR }),
        npc({ id: "npc-mari", name: "Professor Mari", avatarUrl: BUILT_IN_MARI_AVATAR }),
      ]);

    const npcs = useGameModeStore.getState().npcs;
    expect(npcs.find((entry) => entry.id === "npc-caretaker")?.avatarUrl).toBeUndefined();
    expect(npcs.find((entry) => entry.id === "npc-mari")?.avatarUrl).toBe(BUILT_IN_MARI_AVATAR);
  });

  it("does not preserve a stale Mari avatar onto a non-Mari NPC from existing state", () => {
    useGameModeStore.getState().patchNpcAvatars([{ name: "Caretaker", avatarUrl: BUILT_IN_MARI_AVATAR }]);
    useGameModeStore.getState().setNpcs([npc({ id: "npc-caretaker", name: "Caretaker", avatarUrl: null })]);

    const [storedNpc] = useGameModeStore.getState().npcs;
    expect(storedNpc).toEqual(
      expect.objectContaining({
        id: "npc-caretaker",
        name: "Caretaker",
        avatarUrl: null,
      }),
    );
    expect(storedNpc?.avatarUrl).not.toBe(BUILT_IN_MARI_AVATAR);
  });

  it("scrubs a stale Mari avatar when patching the same generated URL", () => {
    useGameModeStore.setState({
      npcs: [npc({ id: "npc-caretaker", name: "Caretaker", avatarUrl: BUILT_IN_MARI_AVATAR })],
    });

    useGameModeStore.getState().patchNpcAvatars([{ name: "Caretaker", avatarUrl: BUILT_IN_MARI_AVATAR }]);

    const [storedNpc] = useGameModeStore.getState().npcs;
    expect(storedNpc?.avatarUrl).toBeUndefined();
  });
});

describe("useGameModeStore widget persistence", () => {
  it("keeps failed debounced widget persistence pending", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline"));
    const initialWidget = widget();
    useGameModeStore.getState().setActiveGame("game-1", "chat-1");
    useGameModeStore.getState().setHudWidgets([initialWidget]);

    const updatedWidgets = useGameModeStore.getState().applyWidgetUpdate({
      widgetId: "inventory",
      changes: { add: "Moon Key" },
    });
    const expectedSignature = getHudWidgetStateSignature(updatedWidgets);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(patchChatMetadataMock).toHaveBeenCalledWith("chat-1", { gameWidgetState: updatedWidgets });
    expect(getPendingHudWidgetPersistenceSignature("chat-1")).toBe(expectedSignature);
  });

  it("clears failed widget persistence after the retry succeeds", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline")).mockResolvedValueOnce(chat());
    useGameModeStore.getState().setActiveGame("game-1", "chat-1");
    useGameModeStore.getState().setHudWidgets([widget()]);

    useGameModeStore.getState().applyWidgetUpdate({
      widgetId: "inventory",
      changes: { add: "Moon Key" },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(getPendingHudWidgetPersistenceSignature("chat-1")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(patchChatMetadataMock).toHaveBeenCalledTimes(2);
    expect(getPendingHudWidgetPersistenceSignature("chat-1")).toBeNull();
  });

  it("does not let stale metadata clobber widgets while a failed save is pending", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline"));
    useGameModeStore.getState().setActiveGame("game-1", "chat-1");
    useGameModeStore.getState().setHudWidgets([widget()]);

    const updatedWidgets = useGameModeStore.getState().applyWidgetUpdate({
      widgetId: "inventory",
      changes: { add: "Moon Key" },
    });
    await vi.advanceTimersByTimeAsync(1_000);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      useSyncGameState("chat-1", {
        gameId: "game-1",
        gameWidgetState: [widget({ config: { contents: [] } })],
      });
      return null;
    }

    await act(async () => {
      root.render(createElement(Harness));
    });

    expect(useGameModeStore.getState().hudWidgets).toEqual(updatedWidgets);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
