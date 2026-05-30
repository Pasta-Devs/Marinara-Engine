import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameAssetsApi } from "./assets-api";
import { invalidateRemoteManagedAssetObjectUrls } from "./local-file-api";
import { invokeTauri } from "./tauri-client";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

vi.mock("./local-file-api", () => ({
  invalidateRemoteManagedAssetObjectUrls: vi.fn(),
}));

const invokeTauriMock = vi.mocked(invokeTauri);
const invalidateRemoteManagedAssetObjectUrlsMock = vi.mocked(invalidateRemoteManagedAssetObjectUrls);

describe("gameAssetsApi remote asset cache invalidation", () => {
  beforeEach(() => {
    invokeTauriMock.mockReset();
    invalidateRemoteManagedAssetObjectUrlsMock.mockReset();
    invokeTauriMock.mockResolvedValue(undefined);
  });

  it("invalidates cached remote game asset blobs after mutating asset commands", async () => {
    await gameAssetsApi.deleteFile("music/theme.mp3");
    await gameAssetsApi.rescan();

    expect(invalidateRemoteManagedAssetObjectUrlsMock).toHaveBeenCalledTimes(2);
    expect(invalidateRemoteManagedAssetObjectUrlsMock).toHaveBeenNthCalledWith(1, "game");
    expect(invalidateRemoteManagedAssetObjectUrlsMock).toHaveBeenNthCalledWith(2, "game");
  });

  it("does not invalidate cached remote game asset blobs when a mutating command fails", async () => {
    invokeTauriMock.mockRejectedValueOnce(new Error("delete failed"));

    await expect(gameAssetsApi.deleteFile("music/theme.mp3")).rejects.toThrow("delete failed");
    expect(invalidateRemoteManagedAssetObjectUrlsMock).not.toHaveBeenCalled();
  });
});
