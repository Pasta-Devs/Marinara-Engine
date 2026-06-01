// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentsPanel } from "./AgentsPanel";
import { storageApi } from "../../../../shared/api/storage-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// All catalog lists (agents / custom-tools / regex-scripts) load through storageApi.list,
// so mocking this single seam exercises the real React Query + AgentsPanel render path.
vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const storageListMock = vi.mocked(storageApi.list);

const REGEX_NAME = "Boolean Enabled Script";

function regexScriptRow() {
  return {
    id: "regex-1",
    name: REGEX_NAME,
    // The fix's target: a real JSON boolean true (not the legacy "true" string).
    enabled: true,
    findRegex: "foo",
    replaceString: "bar",
    trimStrings: [],
    placement: ["ai_output"],
    flags: "gi",
    promptOnly: false,
    order: 0,
    minDepth: null,
    maxDepth: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Find the regex row's name node, then climb to the row wrapper that conditionally
// receives "opacity-50" when the script reads as disabled.
function findRegexRowWrapper(container: HTMLElement): HTMLElement | null {
  const nameNode = Array.from(container.querySelectorAll<HTMLDivElement>("div")).find(
    (node) => node.textContent?.trim() === REGEX_NAME && node.className.includes("font-medium"),
  );
  // name <div> -> name <button> -> row wrapper <div>
  return nameNode?.closest<HTMLElement>("button")?.parentElement ?? null;
}

describe("AgentsPanel regex row enabled state", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    storageListMock.mockImplementation(async (entity: string) => {
      if (entity === "regex-scripts") return [regexScriptRow()] as never;
      return [] as never;
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    storageListMock.mockReset();
    window.localStorage.clear();
  });

  it("does not dim a regex row whose enabled flag is a real boolean true", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentsPanel />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain(REGEX_NAME);
    });

    const rowWrapper = findRegexRowWrapper(container);
    expect(rowWrapper).toBeTruthy();
    // The row wrapper always carries the base layout class.
    expect(rowWrapper!.className).toContain("rounded-lg");
    // GREEN post-fix: boolean true is treated as enabled, so no dimming.
    // RED pre-fix (script.enabled === "true" only): boolean true reads as disabled -> opacity-50.
    expect(rowWrapper!.className).not.toContain("opacity-50");
  });

  it('does not dim a regex row whose enabled flag is the legacy string "1"', async () => {
    storageListMock.mockImplementation(async (entity: string) => {
      if (entity === "regex-scripts") return [{ ...regexScriptRow(), enabled: "1" }] as never;
      return [] as never;
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentsPanel />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain(REGEX_NAME);
    });

    const rowWrapper = findRegexRowWrapper(container);
    expect(rowWrapper).toBeTruthy();
    // Legacy "1" must read as enabled too (parity with parseScript / the engine helper).
    expect(rowWrapper!.className).not.toContain("opacity-50");
  });
});
