import { ApiError } from "../../../../shared/api/api-errors";
import { botBrowserCommandApi } from "../../../../shared/api/bot-browser-command-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jannySearchWithBrowserFallback } from "./bot-browser-api";

vi.mock("../../../../shared/api/bot-browser-command-api", () => ({
  botBrowserCommandApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const commandApi = vi.mocked(botBrowserCommandApi);

describe("jannySearchWithBrowserFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    commandApi.get.mockReset();
    commandApi.post.mockReset();
  });

  it("falls back to browser-side search when the backend reports Cloudflare mitigation", async () => {
    const payload = { queries: [{ indexUid: "janny-characters", q: "marinara" }] };
    commandApi.post.mockRejectedValue(
      new ApiError("JannyAI is blocking this request with Cloudflare bot mitigation", 500, {
        code: "upstream_blocked",
      }),
    );
    commandApi.get.mockResolvedValue({ token: "browser-token" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [{ hits: [{ id: "hit-1" }] }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(jannySearchWithBrowserFallback(payload)).resolves.toEqual({
      results: [{ hits: [{ id: "hit-1" }] }],
    });

    expect(commandApi.post).toHaveBeenCalledWith("/bot-browser/janny/search", { payload });
    expect(commandApi.get).toHaveBeenCalledWith("/bot-browser/janny/token?force=true");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://search.jannyai.com/multi-search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: "Bearer browser-token",
        }),
      }),
    );
  });
});
