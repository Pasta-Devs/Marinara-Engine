// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentDebugEntry } from "../../../../engine/contracts/types/agent";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { AgentDebugPanel } from "./AgentDebugPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// framer-motion's motion.div animates via layout effects that are noisy in jsdom.
// Replace it with a plain element that forwards className/children and drops the
// animation-only props (initial/animate/exit) so the rendered DOM carries the
// real className the fix changed.
vi.mock("framer-motion", () => {
  const passthrough =
    (tag: string) =>
    ({
      initial: _initial,
      animate: _animate,
      exit: _exit,
      children,
      ...rest
    }: {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      children?: ReactNode;
      [key: string]: unknown;
    }) =>
      createElement(tag, rest, children);
  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => passthrough(tag),
      },
    ),
  };
});

function minimalDebugEntry(): AgentDebugEntry {
  // The visibility gate only needs a single entry in debugLog; phase + timestamp
  // are the only required fields on AgentDebugEntry.
  return { phase: "pre_generation", timestamp: 0 };
}

function findRootElement(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("div")).find((el) => {
    const className = el.getAttribute("class") ?? "";
    return className.includes("fixed") && className.includes("w-80");
  });
}

describe("AgentDebugPanel docking position", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // Seed the stores so the visibility gate passes:
    // debugMode === true AND debugLog has at least one entry.
    useUIStore.setState({ debugMode: true });
    useAgentStore.setState({ debugLog: [minimalDebugEntry()], lastResults: new Map() });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    useUIStore.setState({ debugMode: false });
    useAgentStore.getState().reset();
  });

  it("docks the panel bottom-right (bottom-96 right-4), clear of the left-anchored editor body", () => {
    act(() => {
      root.render(createElement(AgentDebugPanel));
    });

    const rootElement = findRootElement(container);
    expect(rootElement).toBeTruthy();

    const className = rootElement!.getAttribute("class") ?? "";

    // GREEN (post-fix): docked bottom-right.
    expect(className).toContain("bottom-96");
    expect(className).toContain("right-4");

    // RED (pre-fix): was anchored bottom-left over the editor body.
    expect(className).not.toContain("left-4");
    expect(className).not.toContain("bottom-20");
  });
});
