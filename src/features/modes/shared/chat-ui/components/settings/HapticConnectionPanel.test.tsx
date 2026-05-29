// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HapticConnectionPanel } from "./HapticConnectionPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hapticHookMocks = vi.hoisted(() => ({
  commandMutate: vi.fn(),
  connectMutate: vi.fn(),
  disconnectMutate: vi.fn(),
  startScanMutate: vi.fn(),
  stopAllMutate: vi.fn(),
  stopScanMutate: vi.fn(),
  useHapticCommand: vi.fn(),
  useHapticConnect: vi.fn(),
  useHapticDisconnect: vi.fn(),
  useHapticStartScan: vi.fn(),
  useHapticStatus: vi.fn(),
  useHapticStopAll: vi.fn(),
  useHapticStopScan: vi.fn(),
}));

vi.mock("../../../../../runtime/haptics/index", () => ({
  HAPTIC_INTIFACE_URL_STORAGE_KEY: "marinara_haptic_intiface_url",
  useHapticCommand: hapticHookMocks.useHapticCommand,
  useHapticConnect: hapticHookMocks.useHapticConnect,
  useHapticDisconnect: hapticHookMocks.useHapticDisconnect,
  useHapticStartScan: hapticHookMocks.useHapticStartScan,
  useHapticStatus: hapticHookMocks.useHapticStatus,
  useHapticStopAll: hapticHookMocks.useHapticStopAll,
  useHapticStopScan: hapticHookMocks.useHapticStopScan,
}));

type MutationOptions = { onError?: (error: unknown) => void };

function pendingMutation(mutate: ReturnType<typeof vi.fn>, overrides: Record<string, unknown> = {}) {
  return { mutate, isPending: false, isError: false, error: null, ...overrides };
}

describe("HapticConnectionPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    hapticHookMocks.useHapticStatus.mockReturnValue({
      data: {
        connected: true,
        devices: [{ index: 2, name: "Lovense Edge", capabilities: ["vibrate", "rotate"] }],
        scanning: true,
        serverUrl: "ws://127.0.0.1:12345",
        defaultServerUrl: "ws://127.0.0.1:12345",
      },
      isLoading: false,
    });
    hapticHookMocks.useHapticConnect.mockReturnValue(pendingMutation(hapticHookMocks.connectMutate));
    hapticHookMocks.useHapticDisconnect.mockReturnValue(pendingMutation(hapticHookMocks.disconnectMutate));
    hapticHookMocks.useHapticStartScan.mockReturnValue(pendingMutation(hapticHookMocks.startScanMutate));
    hapticHookMocks.useHapticStopScan.mockReturnValue(pendingMutation(hapticHookMocks.stopScanMutate));
    hapticHookMocks.useHapticCommand.mockReturnValue(pendingMutation(hapticHookMocks.commandMutate));
    hapticHookMocks.useHapticStopAll.mockReturnValue(pendingMutation(hapticHookMocks.stopAllMutate));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderPanel() {
    act(() => {
      root.render(<HapticConnectionPanel onIntifaceUrlChange={vi.fn()} />);
    });
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();

    act(() => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("routes restored stop controls through haptic mutations", () => {
    renderPanel();

    clickButton("Stop scan");
    clickButton("Stop all");
    clickButton("Stop");

    expect(hapticHookMocks.stopScanMutate).toHaveBeenCalledTimes(1);
    expect(hapticHookMocks.stopAllMutate).toHaveBeenCalledTimes(1);
    expect(hapticHookMocks.commandMutate).toHaveBeenCalledWith(
      { deviceIndex: 2, action: "stop" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("starts scanning when no scan is active", () => {
    hapticHookMocks.useHapticStatus.mockReturnValue({
      data: {
        connected: true,
        devices: [],
        scanning: false,
        serverUrl: "ws://127.0.0.1:12345",
        defaultServerUrl: "ws://127.0.0.1:12345",
      },
      isLoading: false,
    });

    renderPanel();
    clickButton("Scan for devices");

    expect(hapticHookMocks.startScanMutate).toHaveBeenCalledTimes(1);
    expect(hapticHookMocks.stopScanMutate).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Stop all");
  });

  it("shows restored haptic action failures", () => {
    hapticHookMocks.stopAllMutate.mockImplementation((_variables: unknown, options?: MutationOptions) => {
      options?.onError?.(new Error("Intiface Central rejected stop all"));
    });

    renderPanel();
    clickButton("Stop all");

    expect(container.textContent).toContain("Haptic action failed - Intiface Central rejected stop all");
  });
});
