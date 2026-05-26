// ──────────────────────────────────────────────
// Hook: Idle Detection
// ──────────────────────────────────────────────
// Detects app presence and auto-sets status to "idle" after
// 10 minutes away/inactive, reverting to "active" on real input.

import { useEffect, useRef } from "react";
import { useUIStore } from "../stores/ui.store";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

export function useIdleDetection() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAtRef = useRef(Date.now());

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const enforceDnd = () => {
      const state = useUIStore.getState();
      clearTimer();
      if (state.userStatus !== "dnd") {
        state.setUserStatus("dnd");
      }
    };

    const markIdleIfDue = () => {
      const state = useUIStore.getState();
      if (state.userStatusManual === "dnd") {
        enforceDnd();
        return;
      }

      const elapsed = Date.now() - lastActivityAtRef.current;
      if (elapsed < IDLE_TIMEOUT_MS) return;
      if (state.userStatus !== "idle") {
        state.setUserStatus("idle");
      }
    };

    const scheduleIdleCheck = () => {
      clearTimer();
      if (useUIStore.getState().userStatusManual === "dnd") return;

      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAtRef.current);
      if (remaining <= 0) {
        markIdleIfDue();
        return;
      }

      timerRef.current = setTimeout(markIdleIfDue, remaining);
    };

    const markActive = () => {
      const state = useUIStore.getState();
      if (state.userStatusManual === "dnd") {
        enforceDnd();
        return;
      }

      lastActivityAtRef.current = Date.now();
      if (state.userStatus !== "active") {
        state.setUserStatus("active");
      }
      scheduleIdleCheck();
    };

    const markAway = () => {
      const state = useUIStore.getState();
      if (state.userStatusManual === "dnd") {
        enforceDnd();
        return;
      }
      if (state.userStatus !== "idle") {
        lastActivityAtRef.current = Date.now();
      }
      scheduleIdleCheck();
    };

    const syncElapsedStatus = () => {
      markIdleIfDue();
      scheduleIdleCheck();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActive, { passive: true });
    }
    document.addEventListener("scroll", markActive, { capture: true, passive: true });
    window.addEventListener("blur", markAway);
    window.addEventListener("focus", syncElapsedStatus);

    const onVisibility = () => {
      if (document.hidden) {
        markAway();
      } else {
        syncElapsedStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const unsubscribe = useUIStore.subscribe((state, previousState) => {
      if (state.userStatusManual === previousState.userStatusManual) return;
      if (state.userStatusManual === "dnd") {
        enforceDnd();
        return;
      }
      lastActivityAtRef.current = Date.now();
      scheduleIdleCheck();
    });

    markActive();

    return () => {
      clearTimer();
      unsubscribe();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActive);
      }
      document.removeEventListener("scroll", markActive, true);
      window.removeEventListener("blur", markAway);
      window.removeEventListener("focus", syncElapsedStatus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
