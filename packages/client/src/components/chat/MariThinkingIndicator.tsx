// ──────────────────────────────────────────────
// Chat: Mari Thinking Indicator
// ──────────────────────────────────────────────
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useChat } from "../../hooks/use-chats";

/** Minimum visible duration so fast command runs (single DB write) still register. */
const MIN_VISIBLE_MS = 600;

/**
 * Visible-while-working signal for the post-stream command window.
 *
 * Mari's embedded commands (create_character, update_character, fetch, …)
 * execute in a server-side loop after her reply finishes streaming. During
 * that window the UI is otherwise silent — no tokens, no typing indicator —
 * so a user who asked her to modify their data can't tell whether she's
 * still working or stalled.
 *
 * The server emits `assistant_commands_start` / `assistant_commands_end`
 * SSE events around the command loop; `commandsExecutingChatId` mirrors
 * that window. We only surface the indicator in chats where Mari is a
 * participant so non-Mari commands (schedule_update, cross_post, etc.)
 * don't mistakenly trigger a "Mari is thinking" pill.
 *
 * The store is observed via Zustand's direct `subscribe` rather than a
 * selector hook: simple DB commands complete in a fraction of a tick, so
 * the start and end state updates land in the same React batch and the
 * component would never render the intermediate active state. The direct
 * subscribe fires once per state change, capturing both transitions.
 *
 * A minimum visible duration (MIN_VISIBLE_MS) keeps the pill on-screen
 * long enough to perceive even when a command finishes in under a
 * millisecond.
 */
export const MariThinkingIndicator = memo(function MariThinkingIndicator() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: activeChat } = useChat(activeChatId);

  const isMariChat = useMemo(() => {
    // characterIds can arrive as an array or a JSON-encoded string depending on endpoint.
    const raw = (activeChat as { characterIds?: unknown } | null | undefined)?.characterIds;
    if (Array.isArray(raw)) return raw.includes(PROFESSOR_MARI_ID);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.includes(PROFESSOR_MARI_ID);
      } catch {
        return false;
      }
    }
    return false;
  }, [activeChat]);

  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isMariChat) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setVisible(false);
      return;
    }

    const evaluate = () => {
      const { commandsExecutingChatId, activeChatId: currentActive } = useChatStore.getState();
      const shouldShow = !!currentActive && commandsExecutingChatId === currentActive;
      if (shouldShow) {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        shownAtRef.current = Date.now();
        setVisible(true);
      } else {
        if (hideTimerRef.current) return;
        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
        hideTimerRef.current = setTimeout(() => {
          hideTimerRef.current = null;
          setVisible(false);
        }, remaining);
      }
    };

    evaluate();
    const unsubChatId = useChatStore.subscribe((s) => s.commandsExecutingChatId, evaluate);
    const unsubActive = useChatStore.subscribe((s) => s.activeChatId, evaluate);
    return () => {
      unsubChatId();
      unsubActive();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isMariChat]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-1.5 text-xs text-foreground/60"
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:400ms]" />
      </span>
      <span>Mari is thinking…</span>
    </div>
  );
});
