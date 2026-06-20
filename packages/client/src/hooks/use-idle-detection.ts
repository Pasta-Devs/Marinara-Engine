// ──────────────────────────────────────────────
// Hook: Idle Detection
// ──────────────────────────────────────────────
// Detects user inactivity (mouse, keyboard, touch) and
// auto-sets status to "idle" after 10 minutes, reverting
// to "active" when the user returns.

import { useEffect, useRef } from "react";
import { useUIStore } from "../stores/ui.store";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function useIdleDetection() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isIdleRef = useRef(false);

  useEffect(() => {
    const resetTimer = () => {
      const { userStatus, userStatusManual, setUserStatus } = useUIStore.getState();
      // Only manage idle if the user's manual choice is "active"
      if (userStatusManual !== "active") return;

      if (isIdleRef.current || userStatus === "idle") {
        isIdleRef.current = false;
        setUserStatus("active");
      }

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const state = useUIStore.getState();
        if (state.userStatusManual === "active") {
          isIdleRef.current = true;
          state.setUserStatus("idle");
        }
      }, IDLE_TIMEOUT_MS);
    };

    // Activity events
    const events = ["pointermove", "pointerdown", "mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;
    for (const evt of events) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    // Also detect visibility change (tab switch back)
    const onVisibility = () => {
      if (!document.hidden) resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Start the timer
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      for (const evt of events) {
        window.removeEventListener(evt, resetTimer);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
