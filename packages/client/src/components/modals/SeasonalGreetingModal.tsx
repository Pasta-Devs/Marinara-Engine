import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeasonalThemeId } from "../../lib/seasonal-themes";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";

const GREETINGS: Record<SeasonalThemeId, { title: string; intro: string; details: string; art: string; bat: string }> =
  {
    halloween: {
      title: "seasonalThemes.halloween.greetingTitle",
      intro: "seasonalThemes.halloween.greetingIntro",
      details: "seasonalThemes.halloween.greetingDetails",
      art: "/seasonal/halloween/pumpkin.webp",
      bat: "/seasonal/halloween/bat.webp",
    },
  };

/** Says hello once a year when a seasonal theme switches on, after every other startup notice. */
export function SeasonalGreetingModal({
  themeId,
  pending,
  presentationAllowed,
  onShown,
  onTurnOff,
  onOpenChange,
}: {
  themeId: SeasonalThemeId | null;
  /** True while this year's greeting for `themeId` has not been shown yet. */
  pending: boolean;
  presentationAllowed: boolean;
  onShown: () => void;
  onTurnOff: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const hasCompletedOnboarding = useUIStore((state) => state.hasCompletedOnboarding);
  const settingsSyncReady = useUIStore((state) => state.settingsSyncReady);
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const greeting = themeId ? GREETINGS[themeId] : null;

  useEffect(() => {
    if (!themeId || !pending || open || !presentationAllowed || !hasCompletedOnboarding || !settingsSyncReady) return;
    // Recorded on presentation, so closing the app without a choice cannot bring it back this year.
    onShown();
    setOpen(true);
  }, [hasCompletedOnboarding, onShown, open, pending, presentationAllowed, settingsSyncReady, themeId]);

  // Turning seasonal themes off in Settings while this is open closes it too.
  useEffect(() => {
    if (!themeId) setOpen(false);
  }, [themeId]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  if (!greeting) return null;

  const turnOff = () => {
    setOpen(false);
    onTurnOff();
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t(greeting.title)} initialFocusRef={keepRef}>
      <div data-component="SeasonalGreetingModal" data-seasonal-greeting={themeId} className="space-y-4">
        <div aria-hidden="true" className="relative mx-auto h-28 w-full max-w-xs">
          <img
            src={greeting.art}
            alt=""
            className="absolute bottom-0 left-1/2 h-24 w-auto -translate-x-1/2 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.3)]"
          />
          <img src={greeting.bat} alt="" className="absolute left-6 top-1 h-8 w-auto -rotate-6 object-contain" />
          <img src={greeting.bat} alt="" className="absolute right-8 top-6 h-6 w-auto rotate-6 object-contain" />
        </div>
        <p className="text-sm leading-6 text-[var(--marinara-chat-chrome-panel-title)]">{t(greeting.intro)}</p>
        <p className="text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">{t(greeting.details)}</p>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={turnOff}
            className="mari-chrome-control min-h-10 justify-center px-4 py-2 text-sm"
          >
            {t("seasonalThemes.greeting.turnOff")}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={() => setOpen(false)}
            className="mari-chrome-control mari-chrome-control--primary min-h-10 justify-center px-5 py-2 text-sm"
          >
            {t("seasonalThemes.greeting.keep")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
