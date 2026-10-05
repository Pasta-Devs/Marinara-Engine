import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";

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
