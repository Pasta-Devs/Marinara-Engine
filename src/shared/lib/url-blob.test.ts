import { beforeEach, describe, expect, it, vi } from "vitest";

import { urlBinaryApi } from "../api/url-binary-api";
import { loadUrlArrayBuffer, loadUrlBlob, urlToDataUrl } from "./url-blob";

vi.mock("../api/url-binary-api", () => ({
  urlBinaryApi: {
    load: vi.fn(),
  },
}));

const loadMock = vi.mocked(urlBinaryApi.load);

describe("url-blob", () => {
  beforeEach(() => {
    loadMock.mockReset();
  });

  it("loads data URLs locally without calling the binary API", async () => {
    const blob = await loadUrlBlob("data:text/plain;base64,aGVsbG8=");

    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("hello");
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("rejects non-GET binary loads before calling the binary API", async () => {
    await expect(
      loadUrlBlob("https://example.com/file.png", {
        init: { method: "POST" },
        errorMessage: "Custom load failure",
      }),
    ).rejects.toThrow("Custom load failure");

    expect(loadMock).not.toHaveBeenCalled();
  });

  it("loads remote URLs through the URL binary API", async () => {
    loadMock.mockResolvedValueOnce(new Blob(["image-bytes"], { type: "image/png" }));

    const blob = await loadUrlBlob("https://example.com/file.png");

    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("image-bytes");
    expect(loadMock).toHaveBeenCalledWith("https://example.com/file.png", "application/octet-stream");
  });

  it("uses caller error copy when a remote binary load fails", async () => {
    loadMock.mockRejectedValueOnce(new Error("Remote file is too large"));

    await expect(
      loadUrlBlob("https://example.com/file.png", {
        errorMessage: "Could not attach image",
      }),
    ).rejects.toThrow("Could not attach image");
  });

  it("converts loaded URL blobs to array buffers", async () => {
    loadMock.mockResolvedValueOnce(new Blob(["audio"], { type: "audio/mpeg" }));

    const buffer = await loadUrlArrayBuffer("https://example.com/file.mp3");

    expect(new TextDecoder().decode(buffer)).toBe("audio");
  });

  it("returns existing data URLs without calling the binary API", async () => {
    const url = "data:image/png;base64,aW1hZ2U=";

    await expect(urlToDataUrl(url)).resolves.toBe(url);

    expect(loadMock).not.toHaveBeenCalled();
  });
});
