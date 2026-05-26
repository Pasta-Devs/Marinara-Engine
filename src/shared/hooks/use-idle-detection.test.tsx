// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../stores/ui.store";
import { useIdleDetection } from "./use-idle-detection";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  useIdleDetection();
  return null;
}

describe("useIdleDetection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00Z"));
    useUIStore.setState({
      userStatusManual: "active",
      userStatus: "active",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    useUIStore.setState({
      userStatusManual: "active",
      userStatus: "active",
    });
  });

  it("marks the user idle after ten minutes away and active again on input", () => {
    act(() => {
      root.render(<Harness />);
    });

    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.setSystemTime(new Date("2026-05-26T12:10:01Z"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(useUIStore.getState().userStatus).toBe("idle");

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(useUIStore.getState().userStatus).toBe("active");
  });

  it("keeps do not disturb sticky until the user clears it manually", () => {
    act(() => {
      root.render(<Harness />);
      useUIStore.getState().setUserStatusManual("dnd");
    });

    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1);
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(useUIStore.getState().userStatusManual).toBe("dnd");
    expect(useUIStore.getState().userStatus).toBe("dnd");

    act(() => {
      useUIStore.getState().setUserStatusManual("active");
    });

    expect(useUIStore.getState().userStatusManual).toBe("active");
    expect(useUIStore.getState().userStatus).toBe("active");
  });

  it("treats manual idle as temporary effective idle, not a sticky manual override", () => {
    act(() => {
      root.render(<Harness />);
    });

    act(() => {
      useUIStore.getState().setUserStatusManual("idle");
    });

    expect(useUIStore.getState().userStatusManual).toBe("active");
    expect(useUIStore.getState().userStatus).toBe("idle");

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(useUIStore.getState().userStatus).toBe("active");
  });
});
