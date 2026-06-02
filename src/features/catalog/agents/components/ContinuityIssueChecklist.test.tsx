/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ContinuityIssueChecklist } from "./ContinuityIssueChecklist";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderChecklist(content: string) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<ContinuityIssueChecklist content={content} />);
  });
  return container;
}

function buttonWithText(scope: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}

function click(button: HTMLButtonElement) {
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("ContinuityIssueChecklist", () => {
  it("disables the selected-only action when all findings are already visible", () => {
    const view = renderChecklist("First continuity issue\nSecond continuity issue");

    const hideUnselected = buttonWithText(view, "Hide unselected");

    expect(hideUnselected.disabled).toBe(true);
    expect(view.textContent).toContain("First continuity issue");
    expect(view.textContent).toContain("Second continuity issue");
  });

  it("hides unselected findings after the user narrows the list", () => {
    const view = renderChecklist("First continuity issue\nSecond continuity issue");

    click(buttonWithText(view, "First continuity issue"));
    const hideUnselected = buttonWithText(view, "Hide unselected");

    expect(hideUnselected.disabled).toBe(false);

    click(hideUnselected);

    expect(view.textContent).not.toContain("First continuity issue");
    expect(view.textContent).toContain("Second continuity issue");
    expect(view.textContent).toContain("1 of 2 selected");
    expect(view.textContent).toContain("Review all");
    expect(view.textContent).toContain("Showing selected");
  });
});
