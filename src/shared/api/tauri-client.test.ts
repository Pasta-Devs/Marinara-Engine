import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "../stores/ui.store";
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
