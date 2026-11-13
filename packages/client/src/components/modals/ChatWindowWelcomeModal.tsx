import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulLook, useOverhaulMobile } from "../../stores/overhaul.store";
import { CHAT_SETTINGS_WINDOW_ID } from "../../stores/floating-window.store";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY } from "../ui/neutral-surface-styles";

/** Keeps a tip this far from every screen edge. */
const TIP_EDGE = 8;

/**
 * New layout: a small tip that points at the Chat settings button in the top bar (desktop, phone and
 * tablet). It measures itself and stays fully on screen however wide a theme or font makes it, and the
 * button it points at gets a highlight ring while it shows.
 */
function OvChatSettingsTip({ onDismiss }: { onDismiss: () => void }) {
  const mobile = useOverhaulMobile();
  const { t } = useTranslation();
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number }>({ top: 52, left: -9999, arrow: -1 });
  useLayoutEffect(() => {
    // The tip points into the top bar, so an auto-hidden bar stays in view while it shows (panel 3, PG6/PR8).
    document.documentElement.setAttribute("data-ov-topbar-pinned", "");
    let highlighted: HTMLElement | null = null;
    const place = () => {
      const tip = tipRef.current;
      const target = document.querySelector<HTMLElement>(
        `:is(.ov-topbar, .ovm-topbar) [data-window-opener="${CHAT_SETTINGS_WINDOW_ID}"]`,
      );
      if (target !== highlighted) {
        highlighted?.removeAttribute("data-ov-tip-target");
        target?.setAttribute("data-ov-tip-target", "");
        highlighted = target;
      }
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(tip?.offsetWidth ?? 280, vw - TIP_EDGE * 2);
      const height = tip?.offsetHeight ?? 0;
      if (!target) {
        setPos({ top: 52, left: Math.max(TIP_EDGE, vw - width - 16), arrow: -1 });
        return;
      }
      const rect = target.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      // Right-aligned under the button when it fits, then pulled in to stay inside the screen.
      const left = Math.min(Math.max(TIP_EDGE, rect.right - width), vw - width - TIP_EDGE);
      const top = Math.min(rect.bottom + 10, Math.max(TIP_EDGE, vh - height - TIP_EDGE));
      // The arrow sits under the button's middle, never past the tip's rounded corners.
      const arrow = Math.min(Math.max(14, center - left - 6), width - 26);
      setPos((before) =>
        before.top === top && before.left === left && before.arrow === arrow ? before : { top, left, arrow },
      );
    };
    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    // Fonts, themes and the top bar's own layout can move the button or resize the tip after it opens.
    const observer = new ResizeObserver(place);
    if (tipRef.current) observer.observe(tipRef.current);
    const bar = document.querySelector(".ov-topbar, .ovm-topbar");
    if (bar) observer.observe(bar);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", place);
      highlighted?.removeAttribute("data-ov-tip-target");
      document.documentElement.removeAttribute("data-ov-topbar-pinned");
    };
  }, []);
  return createPortal(
    <div
      ref={tipRef}
      data-chat-window-intro
      role="dialog"
      aria-labelledby="ov-cs-tip-title"
      className="ov-cs-tip"
      style={{ top: pos.top, left: pos.left }}
    >
      {pos.arrow >= 0 ? <span className="ov-cs-tip__arrow" style={{ left: pos.arrow }} aria-hidden="true" /> : null}
      <p id="ov-cs-tip-title" className="ov-cs-tip__title">
        {t("chatWindowIntro.ovTitle")}
      </p>
      <p className="ov-cs-tip__body">{t(mobile ? "chatWindowIntro.ovPhoneBody" : "chatWindowIntro.ovBody")}</p>
      <div className="ov-cs-tip__foot">
        <button data-chat-window-intro-dismiss type="button" className="ov-btn ov-btn--primary" onClick={onDismiss}>
          {t("chatWindowIntro.gotIt")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** A single introduction for new and returning users, after they actually enter a private chat. */
export function ChatWindowWelcomeModal({
  presentationAllowed,
  onOpenChange,
}: {
  presentationAllowed: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const settingsSyncReady = useUIStore((state) => state.settingsSyncReady);
  const hasCompletedOnboarding = useUIStore((state) => state.hasCompletedOnboarding);
  const dismissed = useUIStore((state) => state.chatWindowIntroDismissed);
  const dismiss = useUIStore((state) => state.dismissChatWindowIntro);
  const open = presentationAllowed && settingsSyncReady && hasCompletedOnboarding && !dismissed;

  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [onOpenChange, open]);

  // The new layout never shows the desktop drag-and-drop video: phones and tablets get the same small tip.
  const overhaulLook = useOverhaulLook();
  if (overhaulLook) return open ? <OvChatSettingsTip onDismiss={dismiss} /> : null;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={t("chatWindowIntro.title")}
      width="max-w-3xl"
      footer={
        <button data-chat-window-intro-dismiss type="button" onClick={dismiss} className={SHEET_BUTTON_PRIMARY}>
          {t("chatWindowIntro.gotIt")}
        </button>
      }
    >
      <div data-chat-window-intro className="space-y-4">
        <video
          data-chat-window-intro-video
          src="/tutorials/chat-layout.mp4"
          aria-label={t("chatWindowIntro.videoLabel")}
          controls
          playsInline
          preload="metadata"
          className="mx-auto max-h-[50dvh] w-full rounded-xl border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] object-contain"
        />
        <p className="text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
          {t("chatWindowIntro.description")}
        </p>
      </div>
    </Modal>
  );
}
