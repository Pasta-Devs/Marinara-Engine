import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulLook, useOverhaulMobile } from "../../stores/overhaul.store";
import { CHAT_SETTINGS_WINDOW_ID } from "../../stores/floating-window.store";
import { Modal } from "../ui/Modal";

/** New layout: a small tip that points at the Chat settings button in the top bar (desktop, phone and tablet). */
function OvChatSettingsTip({ onDismiss }: { onDismiss: () => void }) {
  const mobile = useOverhaulMobile();
  const { t } = useTranslation();
  const [pos, setPos] = useState<{ top: number; right: number; arrow: number } | null>(null);
  useLayoutEffect(() => {
    // The tip points into the top bar, so an auto-hidden bar stays in view while it shows (panel 3, PG6/PR8).
    document.documentElement.setAttribute("data-ov-topbar-pinned", "");
    const place = () => {
      const target = document.querySelector<HTMLElement>(
        `:is(.ov-topbar, .ovm-topbar) [data-window-opener="${CHAT_SETTINGS_WINDOW_ID}"]`,
      );
      if (!target) {
        setPos({ top: 52, right: 16, arrow: -1 });
        return;
      }
      const rect = target.getBoundingClientRect();
      // On a phone the tip can't be narrower than the screen allows, so it keeps an 8 px edge.
      const right = Math.max(8, window.innerWidth - rect.right);
      // Arrow sits under the button's middle, measured from the tip's right edge.
      setPos({ top: rect.bottom + 10, right, arrow: Math.max(12, rect.width / 2 - 6) });
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      document.documentElement.removeAttribute("data-ov-topbar-pinned");
    };
  }, []);
  if (!pos) return null;
  return createPortal(
    <div
      data-chat-window-intro
      role="dialog"
      aria-labelledby="ov-cs-tip-title"
      className="ov-cs-tip"
      style={{ top: pos.top, right: pos.right }}
    >
      {pos.arrow >= 0 ? <span className="ov-cs-tip__arrow" style={{ right: pos.arrow }} aria-hidden="true" /> : null}
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
    <Modal open={open} onClose={dismiss} title={t("chatWindowIntro.title")} width="max-w-3xl">
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
        <div className="flex justify-end">
          <button
            data-chat-window-intro-dismiss
            type="button"
            onClick={dismiss}
            className="mari-chrome-control mari-chrome-control--primary min-h-11 w-full justify-center px-5 py-2 text-sm sm:w-auto"
          >
            {t("chatWindowIntro.gotIt")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
