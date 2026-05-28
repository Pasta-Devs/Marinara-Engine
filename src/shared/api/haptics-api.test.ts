import { beforeEach, describe, expect, it, vi } from "vitest";
import { hapticsApi } from "./haptics-api";
import { invokeTauri } from "./tauri-client";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

describe("hapticsApi", () => {
  const invokeMock = vi.mocked(invokeTauri);

  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("keeps haptic connection commands behind a focused API wrapper", async () => {
    await hapticsApi.status();
    await hapticsApi.connect("ws://127.0.0.1:12345");
    await hapticsApi.connect();
    await hapticsApi.disconnect();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "haptic_status");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "haptic_connect", {
      body: { url: "ws://127.0.0.1:12345" },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "haptic_connect", { body: null });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "haptic_disconnect");
  });

  it("passes scan and device commands through without reshaping payloads", async () => {
    const command = {
      deviceIndex: "all",
      action: "vibrate",
      intensity: 0.45,
      duration: 1.5,
    } as const;

    await hapticsApi.startScan();
    await hapticsApi.stopScan();
    await hapticsApi.command(command);
    await hapticsApi.stopAll();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "haptic_start_scan");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "haptic_stop_scan");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "haptic_command", { command });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "haptic_stop_all");
  });
});
