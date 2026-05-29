// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChatSettingsSection } from "./ChatSettingsSections";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ChatSettingsSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uses the visible header row as the toggle target", () => {
    act(() => {
      root.render(
        <ChatSettingsSection label="Behavior">
          <span>Expanded settings</span>
        </ChatSettingsSection>,
      );
    });

    const section = container.firstElementChild as HTMLElement;
    const headerWrapper = section.firstElementChild as HTMLElement;
    const header = headerWrapper.firstElementChild as HTMLElement;

    expect(headerWrapper.className).toContain("relative");
    expect(header.tagName).toBe("BUTTON");

    act(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Expanded settings");
  });

  it("keeps the help tooltip from toggling the section", () => {
    act(() => {
      root.render(
        <ChatSettingsSection label="Behavior" help="Explain the setting.">
          <span>Expanded settings</span>
        </ChatSettingsSection>,
      );
    });

    const helpButton = container.querySelector('button[aria-label="Show help"]') as HTMLButtonElement;
    const headerWrapper = container.firstElementChild?.firstElementChild as HTMLElement;
    const header = headerWrapper.firstElementChild as HTMLElement;

    expect(headerWrapper.contains(helpButton)).toBe(true);
    expect(header.contains(helpButton)).toBe(false);

    act(() => {
      helpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Expanded settings");
  });
});
