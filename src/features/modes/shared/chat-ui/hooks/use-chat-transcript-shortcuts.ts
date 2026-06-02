import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import type { MessageWithSwipes, RegenerateOptions } from "../types";

const INTUITIVE_SWIPE_MIN_DISTANCE = 56;
const INTUITIVE_SWIPE_MAX_VERTICAL_DRIFT = 44;

function shouldIgnoreIntuitiveSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        '[contenteditable="true"]',
        '[role="button"]',
        "[data-radix-popper-content-wrapper]",
        "[data-no-intuitive-swipe]",
      ].join(", "),
    ),
  );
}

type UseChatTranscriptShortcutsOptions = {
  activeChatId: string;
  blocked: boolean;
  isStreaming: boolean;
  agentProcessing: boolean;
  latestAssistantMessageForSwipes: MessageWithSwipes | null;
  latestMessageForEdit: MessageWithSwipes | null;
  touchSurfaceRef?: RefObject<HTMLElement | null>;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onRegenerate: (messageId: string, options?: RegenerateOptions) => void | Promise<void>;
};

export function useChatTranscriptShortcuts({
  activeChatId,
  blocked,
  isStreaming,
  agentProcessing,
  latestAssistantMessageForSwipes,
  latestMessageForEdit,
  touchSurfaceRef,
  onSetActiveSwipe,
  onRegenerate,
}: UseChatTranscriptShortcutsOptions) {
  const intuitiveSwipeNavigation = useUIStore((state) => state.intuitiveSwipeNavigation);
  const intuitiveSwipeRerollLatest = useUIStore((state) => state.intuitiveSwipeRerollLatest);
  const editLastMessageOnArrowUp = useUIStore((state) => state.editLastMessageOnArrowUp);
  const intuitiveTouchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);

  const navigateLatestSwipe = useCallback(
    (direction: -1 | 1) => {
      if (!intuitiveSwipeNavigation || blocked) return false;
      if (!activeChatId || isStreaming || agentProcessing || !latestAssistantMessageForSwipes) return false;

      const swipeCount = latestAssistantMessageForSwipes.swipeCount ?? 1;
      const activeIndex = latestAssistantMessageForSwipes.activeSwipeIndex ?? 0;

      if (direction < 0) {
        if (activeIndex <= 0) return false;
        onSetActiveSwipe(latestAssistantMessageForSwipes.id, activeIndex - 1);
        return true;
      }

      if (activeIndex < swipeCount - 1) {
        onSetActiveSwipe(latestAssistantMessageForSwipes.id, activeIndex + 1);
        return true;
      }

      if (!intuitiveSwipeRerollLatest) return false;
      void onRegenerate(latestAssistantMessageForSwipes.id, {
        skipTouchConfirm: true,
        forCharacterId: latestAssistantMessageForSwipes.characterId ?? null,
      });
      return true;
    },
    [
      activeChatId,
      agentProcessing,
      blocked,
      intuitiveSwipeNavigation,
      intuitiveSwipeRerollLatest,
      isStreaming,
      latestAssistantMessageForSwipes,
      onRegenerate,
      onSetActiveSwipe,
    ],
  );

  useEffect(() => {
    if (!intuitiveSwipeNavigation || blocked) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (shouldIgnoreIntuitiveSwipeTarget(event.target)) return;

      if (event.repeat && event.key === "ArrowRight" && latestAssistantMessageForSwipes) {
        const swipeCount = latestAssistantMessageForSwipes.swipeCount ?? 1;
        const activeIndex = latestAssistantMessageForSwipes.activeSwipeIndex ?? 0;
        if (activeIndex >= swipeCount - 1) return;
      }

      const handled = navigateLatestSwipe(event.key === "ArrowLeft" ? -1 : 1);
      if (handled) event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blocked, intuitiveSwipeNavigation, latestAssistantMessageForSwipes, navigateLatestSwipe]);

  useEffect(() => {
    if (!editLastMessageOnArrowUp || blocked) return;

    const handleArrowUp = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowUp") return;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!latestMessageForEdit) return;
      if (isStreaming || agentProcessing) return;

      const target = event.target;
      if (target instanceof Element) {
        if (target.tagName === "TEXTAREA") {
          const textArea = target as HTMLTextAreaElement;
          if (textArea.value.length > 0) return;
        } else if (
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.getAttribute("contenteditable") === "true"
        ) {
          return;
        }
      }

      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("marinara:start-edit-message", {
          detail: { messageId: latestMessageForEdit.id },
        }),
      );
    };

    window.addEventListener("keydown", handleArrowUp);
    return () => window.removeEventListener("keydown", handleArrowUp);
  }, [agentProcessing, blocked, editLastMessageOnArrowUp, isStreaming, latestMessageForEdit]);

  useEffect(() => {
    if (!intuitiveSwipeNavigation || blocked) return;

    const handleTouchStart = (event: TouchEvent) => {
      const surface = touchSurfaceRef?.current;
      const target = event.target;
      if (
        event.touches.length !== 1 ||
        !surface ||
        !(target instanceof Node) ||
        !surface.contains(target) ||
        shouldIgnoreIntuitiveSwipeTarget(target)
      ) {
        intuitiveTouchStartRef.current = null;
        return;
      }
      const touch = event.touches.item(0);
      if (!touch) return;
      intuitiveTouchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: event.target,
      };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = intuitiveTouchStartRef.current;
      intuitiveTouchStartRef.current = null;
      const touch = event.changedTouches.item(0);
      if (!start || !touch || shouldIgnoreIntuitiveSwipeTarget(start.target)) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < INTUITIVE_SWIPE_MIN_DISTANCE || absY > INTUITIVE_SWIPE_MAX_VERTICAL_DRIFT || absX < absY * 1.35) {
        return;
      }

      const handled = navigateLatestSwipe(deltaX < 0 ? 1 : -1);
      if (handled) event.preventDefault();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [blocked, intuitiveSwipeNavigation, navigateLatestSwipe, touchSurfaceRef]);
}
