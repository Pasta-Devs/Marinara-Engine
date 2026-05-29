import { beforeEach, describe, expect, it, vi } from "vitest";

import { openExternalUrl } from "./external-link-api";

const openUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
}));

describe("openExternalUrl", () => {
  beforeEach(() => {
    openUrlMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal("__TAURI__", undefined);
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);
  });

  it("opens links with the browser fallback outside embedded Tauri", async () => {
    const openedLink = { href: "", rel: "", target: "", click: vi.fn() };
    const appendLink = vi.fn();
    const openedWindow = {
      opener: {},
      document: {
        body: { append: appendLink },
        createElement: vi.fn(() => openedLink),
      },
    } as unknown as Window;
    const windowOpen = vi.fn(() => openedWindow) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);

    await openExternalUrl("https://example.com/docs");

    expect(windowOpen).toHaveBeenCalledWith("about:blank", "_blank");
    expect(openedWindow.opener).toBeNull();
    expect(openedWindow.document.createElement).toHaveBeenCalledWith("a");
    expect(openedLink.href).toBe("https://example.com/docs");
    expect(openedLink.rel).toBe("noreferrer");
    expect(openedLink.target).toBe("_self");
    expect(appendLink).toHaveBeenCalledWith(openedLink);
    expect(openedLink.click).toHaveBeenCalled();
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("rejects blocked browser popups outside embedded Tauri", async () => {
    const windowOpen = vi.fn(() => null) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);

    await expect(openExternalUrl("https://example.com/docs")).rejects.toThrow(
      "The browser blocked the external URL popup.",
    );

    expect(windowOpen).toHaveBeenCalledWith("about:blank", "_blank");
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("opens external-handler protocols without treating null as a blocked popup", async () => {
    const windowOpen = vi.fn(() => null) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);

    await openExternalUrl("mailto:mari@example.com");

    expect(windowOpen).toHaveBeenCalledWith("mailto:mari@example.com", "_blank", "noopener,noreferrer");
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("uses the Tauri opener plugin in embedded Tauri", async () => {
    const windowOpen = vi.fn(() => ({})) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);
    vi.stubGlobal("__TAURI_INTERNALS__", {});

    await openExternalUrl("https://example.com/native");

    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/native");
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it("rejects unsupported URL protocols", async () => {
    const windowOpen = vi.fn(() => ({})) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);

    await expect(openExternalUrl("javascript:alert(1)")).rejects.toThrow("Unsupported external URL protocol");

    expect(windowOpen).not.toHaveBeenCalled();
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("reports empty and malformed URLs with stable errors", async () => {
    const windowOpen = vi.fn(() => ({})) as unknown as typeof window.open;
    vi.stubGlobal("open", windowOpen);

    await expect(openExternalUrl("")).rejects.toThrow("External URL is empty.");
    await expect(openExternalUrl("not a url")).rejects.toThrow("External URL is invalid.");

    expect(windowOpen).not.toHaveBeenCalled();
    expect(openUrlMock).not.toHaveBeenCalled();
  });
});
