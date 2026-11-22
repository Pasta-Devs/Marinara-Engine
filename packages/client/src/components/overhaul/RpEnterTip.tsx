// ──────────────────────────────────────────────
// New layout on a computer: a one-time "Enter starts a new line" tip
//
// With Send on Enter off (the Roleplay default), Enter adds a line and nothing
// on screen said how to send (QC panel 2, D2). The first time Enter adds a
// line in a Roleplay composer that already holds text, this small card says
// how to send, with the Send on Enter switch right there. It closes on
// "Got it", on a send, or when the switch is flipped, once per kind of device.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { hasSeenRpEnterTip, markRpEnterTipSeen, useWalkthroughRecord } from "../../lib/walkthroughs";
import { claimFirstRunSlot, releaseFirstRunSlot, useChatCovered } from "../../lib/first-run-queue";
import { isApplePlatform } from "../../lib/command-center";
import { useUIStore } from "../../stores/ui.store";
import { Switch } from "../ui/Switch";

const EDGE = 8;

export function RpEnterTip({
  requested,
  composer,
  onClosed,
}: {
  /** Enter just added a line in a composer that holds text. */
  requested: boolean;
  /** The composer the tip sits above. */
  composer: HTMLElement | null;
  onClosed: () => void;
}) {
  const { t } = useTranslation();
  useWalkthroughRecord();
  const seen = hasSeenRpEnterTip();
  const covered = useChatCovered();
  const enterToSend = useUIStore((s) => s.enterToSendRP);
  const setEnterToSend = useUIStore((s) => s.setEnterToSendRP);
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    if (!requested) return;
    if (open || seen || covered || enterToSend) {
      if (!open) onClosed();
      return;
    }
    if (claimFirstRunSlot("rp-enter-tip")) setOpen(true);
    else onClosed();
  }, [covered, enterToSend, onClosed, open, requested, seen]);

  // A send (the composer asks to close it) or a sheet over the chat ends it.
  useEffect(() => {
    if (open && (!requested || covered)) {
      markRpEnterTipSeen();
      setOpen(false);
    }
  }, [covered, open, requested]);

  useEffect(() => {
    if (!open) return;
    return () => releaseFirstRunSlot("rp-enter-tip");
  }, [open]);

  const dismiss = () => {
    markRpEnterTipSeen();
    setOpen(false);
    onClosed();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(tipRef.current?.offsetWidth ?? 300, vw - EDGE * 2);
      const box = composer?.getBoundingClientRect();
      const left = Math.min(Math.max(EDGE, (box?.left ?? EDGE) + 12), vw - width - EDGE);
      const above = box?.top ?? window.innerHeight - 80;
      setPos({ bottom: Math.max(EDGE, window.innerHeight - above + 8), left });
    };
    place();
    const observer = new ResizeObserver(place);
    if (tipRef.current) observer.observe(tipRef.current);
    if (composer) observer.observe(composer);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [composer, open]);

  if (!open || typeof document === "undefined") return null;
  const mod = isApplePlatform() ? "⌘" : "Ctrl";
  return createPortal(
    <div
      ref={tipRef}
      data-rp-enter-tip
      role="status"
      className="ov-cs-tip ov-rp-enter-tip"
      style={pos ? { bottom: pos.bottom, left: pos.left } : { visibility: "hidden" }}
    >
      <p className="ov-cs-tip__body">{t("chat.enterTip.body", { mod })}</p>
      <div className="ov-cs-tip__foot ov-rp-enter-tip__foot">
        <label className="ov-rp-enter-tip__switch">
          <Switch
            checked={enterToSend}
            onCheckedChange={(next) => {
              setEnterToSend(next);
              dismiss();
            }}
            aria-label={t("chat.enterTip.sendOnEnter")}
          />
          <span>{t("chat.enterTip.sendOnEnter")}</span>
        </label>
        <button
          data-rp-enter-tip-dismiss
          type="button"
          className="ov-btn ov-btn--primary"
          // Keep the caret in the composer: the tip is read while typing.
          onMouseDown={(event) => event.preventDefault()}
          onClick={dismiss}
        >
          {t("chat.enterTip.gotIt")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
