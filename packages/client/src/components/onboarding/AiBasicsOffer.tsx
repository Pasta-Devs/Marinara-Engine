// ──────────────────────────────────────────────
// AI basics offer: one small window after the welcome tutorial asking whether the person is new to AI
// chat. Skipping the tutorial skips this too, and an answer in one browser counts for every browser. "Teach me the basics" starts the AI basics tour in the docs viewer;
// "I know this, skip" hides it for good. Either way the tour stays in Home's Things to try, See all.
// Phones get it as a bottom sheet (the Modal's phone form). It respects Feature tips being off.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AI_BASICS_QUESTS } from "../../lib/guide-quests";
import { answerAiBasicsOffer } from "../../lib/guide-quests-progress";
import { FEATURE_TIP_FACE } from "../../lib/feature-tips";
import { useGuideQuestsState } from "../../hooks/use-guide-quests";
import { useDeviceWalkthroughDue } from "../../hooks/use-device-walkthrough-due";
import { startGuideQuest } from "../../stores/guide-card.store";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";
import { claimFirstRunSlot, releaseFirstRunSlot, useFirstRunSlotTaken } from "../../lib/first-run-queue";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_SECONDARY } from "../ui/neutral-surface-styles";

export function AiBasicsOffer({
  presentationAllowed,
  onOpenChange,
}: {
  presentationAllowed: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const settingsSyncReady = useUIStore((s) => s.settingsSyncReady);
  const tipsEnabled = useUIStore((s) => s.featureTipsEnabled);
  const walkthroughDue = useDeviceWalkthroughDue();
  const state = useGuideQuestsState();
  const answeredElsewhere = useUIStore((s) => s.aiBasicsOfferAnswered);
  const [open, setOpen] = useState(false);
  // One first-run surface at a time: it waits while the chat help or a tip shows (MOB12).
  const slotTaken = useFirstRunSlotTaken("ai-basics-offer");
  const teachRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (
      open ||
      state.offer ||
      answeredElsewhere ||
      !presentationAllowed ||
      !hasCompletedOnboarding ||
      !settingsSyncReady
    )
      return;
    if (!tipsEnabled || walkthroughDue || slotTaken) return;
    if (!claimFirstRunSlot("ai-basics-offer")) return;
    setOpen(true);
  }, [
    answeredElsewhere,
    hasCompletedOnboarding,
    open,
    presentationAllowed,
    settingsSyncReady,
    slotTaken,
    state.offer,
    tipsEnabled,
    walkthroughDue,
  ]);
  useEffect(() => {
    if (!open) releaseFirstRunSlot("ai-basics-offer");
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  const skip = () => {
    answerAiBasicsOffer("skipped");
    useUIStore.setState({ aiBasicsOfferAnswered: true });
    setOpen(false);
  };
  const teach = () => {
    answerAiBasicsOffer("taught");
    useUIStore.setState({ aiBasicsOfferAnswered: true });
    setOpen(false);
    startGuideQuest(AI_BASICS_QUESTS[0]!.id);
  };

  return (
    <Modal
      open={open}
      onClose={skip}
      title={t("guideQuests.offer.title", "New to AI chat?")}
      initialFocusRef={teachRef}
      width="max-w-md"
      footer={
        <>
          <button ref={teachRef} type="button" onClick={teach} className={SHEET_BUTTON_PRIMARY}>
            {t("guideQuests.offer.teach", "Teach me the basics")}
          </button>
          <button type="button" onClick={skip} className={SHEET_BUTTON_SECONDARY}>
            {t("guideQuests.offer.skip", "I know this, skip")}
          </button>
        </>
      }
    >
      <div data-component="AiBasicsOffer" className="flex items-start gap-3">
        <img
          src={FEATURE_TIP_FACE}
          alt=""
          aria-hidden="true"
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="space-y-2 text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
          <p className="text-[var(--marinara-chat-chrome-panel-title)]">
            {t(
              "guideQuests.offer.intro",
              "Want a 10-minute tour of the basics? I'll explain what an AI model is, why Marinara uses a few different kinds, and help you set one up if you like.",
            )}
          </p>
          <p>
            {t(
              "guideQuests.offer.later",
              "You can skip it and start it any time from Home: Things to try, See all, AI basics.",
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
