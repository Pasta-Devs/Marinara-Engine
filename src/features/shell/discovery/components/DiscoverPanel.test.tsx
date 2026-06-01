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
    expect(container.textContent).toContain("Conversation Mode");
    expect(container.textContent).toContain(`${DISCOVERY_ENTRIES.length} tracked`);
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
