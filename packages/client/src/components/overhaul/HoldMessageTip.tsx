// ──────────────────────────────────────────────
// New layout on touch: a one-time "Hold a message for more" tip
//
// Phones keep every message action in the hold sheet (no buttons on the
// messages, by design), so nothing on screen says the hold exists. Right after
// the first reply lands, this small tip says it once per kind of device. It
// goes away on "Got it", on the first hold, or when a sheet or page covers the
// chat (QC panel Nov 21, MOB3).
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { hasSeenHoldTip, markHoldTipSeen, useWalkthroughRecord } from "../../lib/walkthroughs";
import {
  claimFirstRunSlot,
  releaseFirstRunSlot,
  useChatCovered,
  useFirstRunSlotTaken,
} from "../../lib/first-run-queue";
import { useBackDismiss } from "../../hooks/use-back-dismiss";
import { MESSAGE_HOLD_EVENT } from "./MobileMessageSheet";

const EDGE = 8;

function textFieldFocused(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable || active instanceof HTMLTextAreaElement) return true;
  return (
    active instanceof HTMLInputElement && !/^(button|checkbox|radio|range|submit|reset|file|color)$/.test(active.type)
  );
}

/**
 * Whether the on-screen keyboard is (probably) up: a text field has focus, or the visible viewport lost a fifth of the
 * window's height. Browsers say nothing direct about the keyboard; these two cover iOS and Android.
 */
function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const viewport = window.visualViewport;
      setKeyboardOpen(textFieldFocused() || (!!viewport && viewport.height < window.innerHeight * 0.8));
    };
    // focusout fires before the next field takes focus: measure a frame later.
    const checkSoon = () => window.requestAnimationFrame(check);
    check();
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", checkSoon);
    window.visualViewport?.addEventListener("resize", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", checkSoon);
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, []);
  return keyboardOpen;
}

export function HoldMessageTip({ armed, mode }: { armed: boolean; mode: string }) {
  const { t } = useTranslation();
  // Re-read when Settings > Replay clears the record.
  useWalkthroughRecord();
  const seen = hasSeenHoldTip();
  const covered = useChatCovered();
  const slotTaken = useFirstRunSlotTaken("hold-tip");
  // While typing, the tip would cover much of the little chat the keyboard leaves (QC panel 3): it waits until the
  // keyboard goes down, and shows a moment after.
  const keyboardOpen = useKeyboardOpen();
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  // The first hold teaches it by itself: never show the tip after that.
  useEffect(() => {
    const onHold = () => {
      markHoldTipSeen();
      setOpen(false);
    };
    window.addEventListener(MESSAGE_HOLD_EVENT, onHold);
    return () => window.removeEventListener(MESSAGE_HOLD_EVENT, onHold);
  }, []);

  useEffect(() => {
    if (open || seen || !armed || covered || slotTaken || keyboardOpen) return;
    // A moment after the reply lands, so it never jumps in while the last words are still painting.
    const timer = window.setTimeout(() => {
      if (claimFirstRunSlot("hold-tip")) setOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [armed, covered, keyboardOpen, open, seen, slotTaken]);

  useEffect(() => {
    if (!open) return;
    return () => releaseFirstRunSlot("hold-tip");
  }, [open]);

  // A sheet or page over the chat hides it; it has not been read, so it comes back after.
  // The keyboard coming up hides it the same way.
  useEffect(() => {
    if (open && (covered || keyboardOpen)) setOpen(false);
  }, [covered, keyboardOpen, open]);

  const dismiss = () => {
    markHoldTipSeen();
    setOpen(false);
  };
  useBackDismiss(open, dismiss);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const root = document.querySelector<HTMLElement>(`[data-chat-mode="${mode}"]`);
      const composer = root?.querySelector<HTMLElement>("[data-chat-composer]");
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(tipRef.current?.offsetWidth ?? 280, vw - EDGE * 2);
      const area = root?.getBoundingClientRect();
      const center = area ? area.left + area.width / 2 : vw / 2;
      const left = Math.min(Math.max(EDGE, center - width / 2), vw - width - EDGE);
      const above = composer?.getBoundingClientRect().top ?? window.innerHeight - 80;
      setPos({ bottom: Math.max(EDGE, window.innerHeight - above + 10), left });
    };
    place();
    const observer = new ResizeObserver(place);
    if (tipRef.current) observer.observe(tipRef.current);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [mode, open]);

  // The tip sits over the bottom of the chat, which is the reply it talks about (QC panel 2, #23). While it shows,
  // the chat gets that much room at its end and moves up by it, so the reply's last lines sit above the tip.
  const placed = pos !== null;
  useLayoutEffect(() => {
    if (!open || !placed) return;
    const root = document.querySelector<HTMLElement>(`[data-chat-mode="${mode}"]`);
    const messages = root?.querySelectorAll<HTMLElement>("[data-message-id]");
    let scroller = messages?.length ? messages[messages.length - 1].parentElement : null;
    while (scroller && scroller !== root && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const tip = tipRef.current;
    if (!scroller || !tip) return;
    const room = Math.round(tip.offsetHeight + 10);
    const target = scroller;
    const before = target.style.paddingBottom;
    const base = parseFloat(getComputedStyle(target).paddingBottom) || 0;
    target.style.paddingBottom = `${base + room}px`;
    const nearEnd = target.scrollHeight - target.scrollTop - target.clientHeight < room + 200;
    if (nearEnd) target.scrollBy({ top: room });
    return () => {
      target.style.paddingBottom = before;
    };
  }, [mode, open, placed]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={tipRef}
      data-hold-message-tip
      role="dialog"
      aria-labelledby="ov-hold-tip-title"
      className="ov-cs-tip ov-hold-tip"
      style={pos ? { bottom: pos.bottom, left: pos.left } : { visibility: "hidden" }}
    >
      <p id="ov-hold-tip-title" className="ov-cs-tip__title">
        {t("chat.holdTip.title")}
      </p>
      <p className="ov-cs-tip__body">{t("chat.holdTip.body")}</p>
      <div className="ov-cs-tip__foot">
        <button data-hold-message-tip-dismiss type="button" className="ov-btn ov-btn--primary" onClick={dismiss}>
          {t("chatWindowIntro.gotIt")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
