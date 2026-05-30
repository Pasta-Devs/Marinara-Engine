// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui.store";
import { partializeUiState } from "./ui/persistence";

// Snapshot the pristine store state once at module load so each case starts clean.
// The store does not expose a reset action, so we restore the captured initial
// state (actions + defaults) via setState before every test.
const INITIAL_STATE = useUIStore.getState();
const originalInnerWidth = window.innerWidth;

function setInnerWidth(value: number) {
  // jsdom's window.innerWidth is configurable; override it before driving actions
  // so mobilePanelReopenPatch()/mobilePanelClosePatch() read the intended viewport.
  Object.defineProperty(window, "innerWidth", { value, configurable: true, writable: true });
}

describe("useUIStore closeAgentDetail mobile panel reopen (issue #1554)", () => {
  beforeEach(() => {
    useUIStore.setState(INITIAL_STATE, true);
  });

  afterEach(() => {
    setInnerWidth(originalInnerWidth);
  });

  it("restores the right catalog panel on narrow viewports so Back returns to the Agents list", () => {
    setInnerWidth(480);

    // Open the Agents catalog panel, then open the full-page agent editor.
    useUIStore.getState().openRightPanel("agents");
    useUIStore.getState().openAgentDetail("world-state");

    // Intermediate state: opening the editor closes the overlay panel on mobile.
    const opened = useUIStore.getState();
    expect(opened.rightPanelOpen).toBe(false);
    expect(opened.agentDetailId).toBe("world-state");

    // Back out of the editor.
    useUIStore.getState().closeAgentDetail();

    // Post-fix: the panel is reopened (and still shows Agents) so Back lands on
    // the Agents list instead of falling through to chat.
    const closed = useUIStore.getState();
    expect(closed.agentDetailId).toBe(null);
    expect(closed.rightPanelOpen).toBe(true);
    expect(closed.rightPanel).toBe("agents");
  });

  it("does not reopen the right panel on desktop viewports", () => {
    setInnerWidth(1280);

    useUIStore.getState().openRightPanel("agents");
    useUIStore.getState().openAgentDetail("world-state");

    // On desktop the overlay never closed, so openDetailRouteState left it open.
    expect(useUIStore.getState().rightPanelOpen).toBe(true);

    // Simulate the desktop state the guard protects: the panel is closed when the
    // editor opens (mobilePanelClosePatch returns {} on desktop, so this models the
    // generic "panel already closed" case the reopen patch must not override).
    useUIStore.setState({ rightPanelOpen: false });
    useUIStore.getState().closeAgentDetail();

    // mobilePanelReopenPatch() returns {} on desktop, so closeAgentDetail must not
    // flip rightPanelOpen back to true.
    const closed = useUIStore.getState();
    expect(closed.agentDetailId).toBe(null);
    expect(closed.rightPanelOpen).toBe(false);
  });
});

describe("useUIStore right-panel resize flag (issue #1586)", () => {
  beforeEach(() => {
    useUIStore.setState(INITIAL_STATE, true);
  });

  it("defaults to not resizing", () => {
    expect(useUIStore.getState().rightPanelResizing).toBe(false);
  });

  it("toggles rightPanelResizing through its setter", () => {
    useUIStore.getState().setRightPanelResizing(true);
    expect(useUIStore.getState().rightPanelResizing).toBe(true);
    useUIStore.getState().setRightPanelResizing(false);
    expect(useUIStore.getState().rightPanelResizing).toBe(false);
  });

  it("never persists the transient resize flag to storage", () => {
    useUIStore.getState().setRightPanelResizing(true);
    const persisted = partializeUiState(useUIStore.getState());
    expect(Object.prototype.hasOwnProperty.call(persisted, "rightPanelResizing")).toBe(false);
  });
});
