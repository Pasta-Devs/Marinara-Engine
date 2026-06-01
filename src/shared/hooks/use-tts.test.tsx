// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TTSConfig } from "../../engine/contracts/types/tts";
import { useCachedTTSConfig, useTTSConfig } from "./use-tts";
import { invokeTauri } from "../api/tauri-client";

vi.mock("../api/tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactNode, client: QueryClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });

  return { container, root };
}

async function waitForText(container: HTMLElement, testId: string, expected: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.querySelector(`[data-testid="${testId}"]`)?.textContent === expected) return;
  }
  expect(container.querySelector(`[data-testid="${testId}"]`)?.textContent).toBe(expected);
}

function CachedProbe() {
  const { data } = useCachedTTSConfig();
  return <span data-testid="enabled">{data?.enabled ? "enabled" : "disabled"}</span>;
}

function FetchProbe() {
  const { data } = useTTSConfig();
  return <span data-testid="enabled">{data?.enabled ? "enabled" : "disabled"}</span>;
}

describe("TTS config query ownership", () => {
  let roots: Root[];

  beforeEach(() => {
    roots = [];
    vi.mocked(invokeTauri).mockReset();
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  it("does not invoke tts_config for cache-only message consumers", () => {
    const client = createClient();
    const { container, root } = renderWithClient(<CachedProbe />, client);
    roots.push(root);

    expect(container.querySelector('[data-testid="enabled"]')?.textContent).toBe("disabled");
    expect(invokeTauri).not.toHaveBeenCalled();
  });

  it("keeps cache-only consumers subscribed to config loaded by owning surfaces", async () => {
    const client = createClient();
    const config: Partial<TTSConfig> = { enabled: true };
    vi.mocked(invokeTauri).mockResolvedValueOnce(config);

    const cached = renderWithClient(<CachedProbe />, client);
    const fetcher = renderWithClient(<FetchProbe />, client);
    roots.push(cached.root, fetcher.root);

    await waitForText(fetcher.container, "enabled", "enabled");
    await waitForText(cached.container, "enabled", "enabled");

    expect(invokeTauri).toHaveBeenCalledTimes(1);
    expect(invokeTauri).toHaveBeenCalledWith("tts_config");
  });
});
