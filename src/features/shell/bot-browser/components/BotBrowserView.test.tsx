// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotBrowserView } from "./BotBrowserView";
import { botBrowserGet } from "../api/bot-browser-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api/bot-browser-api", () => ({
  botBrowserAssetUrl: (path: string) => `tauri-api:/bot-browser/${path}`,
  botBrowserBlob: vi.fn(),
  botBrowserGet: vi.fn(),
  botBrowserPost: vi.fn(),
  fetchBotBrowserAssetBlob: vi.fn(),
  importStCharacter: vi.fn(),
  resolveBotBrowserAssetUrl: vi.fn(async (src: string) => src),
}));

vi.mock("../../../catalog/characters/index", () => ({
  cacheCharacterListRecordFromResult: vi.fn(() => false),
  invalidateCharacterCollectionQueries: vi.fn(),
}));

vi.mock("../../../catalog/lorebooks/index", () => ({
  lorebookKeys: {
    all: ["lorebooks"],
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const botBrowserGetMock = vi.mocked(botBrowserGet);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function chubSearchResult(name = "Retry Bot") {
  const pathName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    data: {
      nodes: [
        {
          fullPath: `marinara/${pathName}`,
          name,
          tagline: `${name} result`,
          topics: ["test"],
          starCount: 12,
          nChats: 34,
          nTokens: 567,
          nsfw: false,
        },
      ],
      cursor: null,
    },
  };
}

function searchCallCount() {
  return botBrowserGetMock.mock.calls.filter(([path]) => String(path).startsWith("chub/search?")).length;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function flushSearchTimer() {
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
}

describe("BotBrowserView provider error UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    botBrowserGetMock.mockImplementation(async (path) => {
      const textPath = String(path);
      if (textPath.endsWith("/session") || textPath === "pygmalion/session" || textPath === "chartavern/session") {
        return { active: false };
      }
      if (textPath.startsWith("chub/search?")) {
        return searchCallCount() === 1 ? Promise.reject(new Error("Chub provider unavailable")) : chubSearchResult();
      }
      return {};
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    botBrowserGetMock.mockReset();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("shows provider search failures as retryable errors instead of an empty result state", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BotBrowserView />
        </QueryClientProvider>,
      );
    });

    await flushSearchTimer();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Chub provider unavailable");
    });
    expect(container.textContent).toContain("Retry");
    expect(container.textContent).not.toContain("No characters found");

    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    expect(retryButton).toBeTruthy();

    await act(async () => {
      retryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Retry Bot");
    });
    expect(searchCallCount()).toBe(2);
    expect(container.textContent).not.toContain("Chub provider unavailable");
  });

  it("keeps newer search results visible when an older provider request fails late", async () => {
    const firstSearch = deferred<ReturnType<typeof chubSearchResult>>();
    botBrowserGetMock.mockImplementation(async (path) => {
      const textPath = String(path);
      if (textPath.endsWith("/session") || textPath === "pygmalion/session" || textPath === "chartavern/session") {
        return { active: false };
      }
      if (textPath.startsWith("chub/search?")) {
        return searchCallCount() === 1 ? firstSearch.promise : chubSearchResult();
      }
      return {};
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BotBrowserView />
        </QueryClientProvider>,
      );
    });

    await flushSearchTimer();
    expect(searchCallCount()).toBe(1);

    const refreshButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("title") === "Refresh",
    );
    expect(refreshButton).toBeTruthy();

    await act(async () => {
      refreshButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Retry Bot");
    });

    await act(async () => {
      firstSearch.reject(new Error("late provider failure"));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Retry Bot");
    });
    expect(container.textContent).not.toContain("late provider failure");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Retry"),
    ).toBe(false);
  });

  it("does not paint older results during the debounce gap after search criteria changes", async () => {
    const firstSearch = deferred<ReturnType<typeof chubSearchResult>>();
    botBrowserGetMock.mockImplementation(async (path) => {
      const textPath = String(path);
      if (textPath.endsWith("/session") || textPath === "pygmalion/session" || textPath === "chartavern/session") {
        return { active: false };
      }
      if (textPath.startsWith("chub/search?")) {
        return searchCallCount() === 1 ? firstSearch.promise : chubSearchResult("New Query Bot");
      }
      return {};
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BotBrowserView />
        </QueryClientProvider>,
      );
    });

    await flushSearchTimer();
    expect(searchCallCount()).toBe(1);

    const searchInput = container.querySelector<HTMLInputElement>('input[placeholder="Search characters..."]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      setInputValue(searchInput!, "new query");
    });
    expect(searchInput!.value).toBe("new query");

    await act(async () => {
      firstSearch.resolve(chubSearchResult("Old Query Bot"));
      await firstSearch.promise;
    });

    expect(container.textContent).not.toContain("Old Query Bot");
    expect(searchCallCount()).toBe(1);

    await flushSearchTimer();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("New Query Bot");
    });
    expect(container.textContent).not.toContain("Old Query Bot");
  });

  it("surfaces a failed detail fetch as a retryable error instead of the empty-definition state", async () => {
    // Search succeeds with one card; the detail fetch (chub/character/...) rejects.
    botBrowserGetMock.mockImplementation(async (path) => {
      const textPath = String(path);
      if (textPath.endsWith("/session") || textPath === "pygmalion/session" || textPath === "chartavern/session") {
        return { active: false };
      }
      if (textPath.includes("chub/character/")) {
        return Promise.reject(new Error("Network down"));
      }
      if (textPath.startsWith("chub/search?")) {
        return chubSearchResult("Detail Bot");
      }
      return {};
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BotBrowserView />
        </QueryClientProvider>,
      );
    });

    await flushSearchTimer();

    // The card tile renders as a grid button (onClick -> openDetail). Locate it by its name,
    // excluding the "Refresh" search-bar button and any error Retry button.
    let cardTile: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      cardTile = Array.from(container.querySelectorAll("button")).find(
        (button) =>
          button.getAttribute("title") !== "Refresh" &&
          button.textContent?.includes("Detail Bot") &&
          !button.textContent?.includes("Retry"),
      ) as HTMLButtonElement | undefined;
      expect(cardTile).toBeTruthy();
    });

    await act(async () => {
      cardTile!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Post-fix (GREEN): the transport error is surfaced with a Retry control.
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Network down");
    });
    expect(container.textContent).not.toContain("No detailed definition available");

    const detailRetryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    expect(detailRetryButton).toBeTruthy();

    // Retry path: a now-succeeding detail fetch clears the error and renders the definition.
    botBrowserGetMock.mockImplementation(async (path) => {
      const textPath = String(path);
      if (textPath.endsWith("/session") || textPath === "pygmalion/session" || textPath === "chartavern/session") {
        return { active: false };
      }
      if (textPath.includes("chub/character/")) {
        return { node: { definition: { personality: "Recovered personality text." } } };
      }
      if (textPath.startsWith("chub/search?")) {
        return chubSearchResult("Detail Bot");
      }
      return {};
    });

    await act(async () => {
      detailRetryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Recovered personality text.");
    });
    expect(container.textContent).not.toContain("Network down");
    expect(container.textContent).not.toContain("No detailed definition available");
  });
});
