// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { DISCOVERY_ENTRIES } from "../discovery-registry";
import { DiscoverPanel } from "./DiscoverPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DiscoverPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUIStore.setState({ rightPanelOpen: false, rightPanel: "settings", settingsTab: "general" });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the seeded feature entries", () => {
    act(() => {
      root.render(<DiscoverPanel />);
    });

    expect(container.textContent).toContain("Discover Marinara");
    expect(container.textContent).toContain(`${DISCOVERY_ENTRIES.length} tracked`);
  });

  it("keeps the default feature list compact until expanded", () => {
    act(() => {
      root.render(<DiscoverPanel />);
    });

    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(container.textContent).toContain(`${DISCOVERY_ENTRIES.length} features tracked`);
    expect(container.textContent).toContain(`Browse all ${DISCOVERY_ENTRIES.length}`);

    const showAllButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Browse all"),
    );
    act(() => {
      showAllButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelectorAll("article")).toHaveLength(DISCOVERY_ENTRIES.length);
    expect(container.textContent).toContain("Show fewer");

    const showFewerButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Show fewer"),
    );
    act(() => {
      showFewerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(container.textContent).toContain(`${DISCOVERY_ENTRIES.length} features tracked`);
    expect(container.textContent).toContain(`Browse all ${DISCOVERY_ENTRIES.length}`);
  });

  it("shows the empty state for unmatched searches", () => {
    act(() => {
      root.render(<DiscoverPanel />);
    });

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      changeInput(input, "zzzz-no-feature");
    });

    expect(container.textContent).toContain("No matching features");
    expect(container.textContent).toContain("Ask Professor Mari");
  });

  it("runs panel actions from entry buttons", () => {
    act(() => {
      root.render(<DiscoverPanel />);
    });

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      changeInput(input, "characters");
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const charactersButton = buttons.find((button) => button.textContent?.includes("Open Characters"));
    expect(charactersButton).toBeTruthy();

    act(() => {
      charactersButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const state = useUIStore.getState();
    expect(state.rightPanelOpen).toBe(true);
    expect(state.rightPanel).toBe("characters");
  });
});
