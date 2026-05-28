import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeTauri } from "./tauri-client";
import { urlBinaryApi } from "./url-binary-api";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

const invokeMock = vi.mocked(invokeTauri);

describe("urlBinaryApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("loads URL binary data through the load_url_binary command", async () => {
    invokeMock.mockResolvedValueOnce({ base64: "aGVsbG8=", mimeType: "image/png" });

    const blob = await urlBinaryApi.load("https://example.com/image.png", "application/octet-stream");

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("hello");
    expect(invokeMock).toHaveBeenCalledWith("load_url_binary", {
      url: "https://example.com/image.png",
      fallbackMime: "application/octet-stream",
    });
  });

  it("uses the fallback MIME type when the response MIME type is missing", async () => {
    invokeMock.mockResolvedValueOnce({ base64: "YXVkaW8=", mimeType: "" });

    const blob = await urlBinaryApi.load("https://example.com/audio", "audio/mpeg");

    expect(blob.type).toBe("audio/mpeg");
  });

  it.each([null, "bytes", 42, false, []])("rejects malformed binary responses before reading fields", async (response) => {
    invokeMock.mockResolvedValueOnce(response);

    await expect(urlBinaryApi.load("https://example.com/file")).rejects.toThrow(
      "URL binary request returned an invalid response",
    );
  });

  it("rejects object responses without base64 data using the response error message", async () => {
    invokeMock.mockResolvedValueOnce({ error: "Remote file is too large" });

    await expect(urlBinaryApi.load("https://example.com/file")).rejects.toThrow("Remote file is too large");
  });

  it("rejects invalid base64 data with a URL binary error", async () => {
    invokeMock.mockResolvedValueOnce({ base64: "not base64!", mimeType: "image/png" });

    await expect(urlBinaryApi.load("https://example.com/file")).rejects.toThrow(
      "URL binary request returned invalid base64 data.",
    );
  });
});
