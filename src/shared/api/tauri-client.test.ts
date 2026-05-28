import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "../stores/ui.store";
import { ApiError } from "./api-errors";
import { invokeTauri } from "./tauri-client";

const tauriInvoke = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriInvoke,
}));

describe("invokeTauri remote runtime routing", () => {
  beforeEach(() => {
    tauriInvoke.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    useUIStore.setState({ remoteRuntimeUrl: "" });
  });

  it("falls back to embedded Tauri when no remote runtime URL is configured", async () => {
    tauriInvoke.mockResolvedValueOnce(["local-character"]);

    await expect(invokeTauri("storage_list", { entity: "characters" })).resolves.toEqual(["local-character"]);

    expect(tauriInvoke).toHaveBeenCalledWith("storage_list", { entity: "characters" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes supported commands to a valid configured remote runtime", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "https://remote.example/runtime///" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(["remote-character"]), { status: 200 }));

    await expect(invokeTauri("storage_list", { entity: "characters" })).resolves.toEqual(["remote-character"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://remote.example/runtime/api/invoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ command: "storage_list", args: { entity: "characters" } }),
      }),
    );
    expect(tauriInvoke).not.toHaveBeenCalled();
  });

  it.each([
    ["haptic_status", undefined],
    ["haptic_connect", { body: { url: "ws://127.0.0.1:12345" } }],
    ["haptic_disconnect", undefined],
    ["haptic_start_scan", undefined],
    ["haptic_stop_scan", undefined],
    ["haptic_command", { command: { deviceIndex: "all", action: "stop" } }],
    ["haptic_stop_all", undefined],
  ])("keeps local-only %s on embedded Tauri when remote runtime is configured", async (command, args) => {
    useUIStore.setState({ remoteRuntimeUrl: "https://remote.example/runtime" });
    tauriInvoke.mockResolvedValueOnce({ connected: false, serverUrl: null, scanning: false, devices: [] });

    await expect(invokeTauri(command, args)).resolves.toEqual({
      connected: false,
      serverUrl: null,
      scanning: false,
      devices: [],
    });

    expect(tauriInvoke).toHaveBeenCalledWith(command, args);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves Retry-After metadata from remote runtime 429 responses", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "https://remote.example/runtime" });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Too Many Requests" }), {
        status: 429,
        headers: { "Retry-After": "2.5" },
      }),
    );

    await expect(invokeTauri("storage_list", { entity: "chats" })).rejects.toMatchObject({
      message: "Too Many Requests",
      status: 429,
      details: { retryAfterMs: 2500 },
    } satisfies Partial<ApiError>);
  });

  it("fails closed when a configured remote runtime URL is malformed", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://[bad" });
    tauriInvoke.mockResolvedValueOnce(["local-character"]);

    await expect(invokeTauri("storage_list", { entity: "characters" })).rejects.toMatchObject({
      message: "Invalid Remote Runtime URL. Check Settings and enter a valid runtime URL.",
      status: 400,
      details: { code: "invalid_remote_runtime_url" },
    });

    expect(tauriInvoke).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
