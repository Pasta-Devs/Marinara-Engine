import { useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ProfessorMariAskContext } from "@marinara-engine/shared";

import type { MariArrival, MariArrivalAction, MariThreadContext } from "../../../lib/mari-arrival";
import type { OmnibarCompletionAction } from "../../../lib/omnibar-completion-actions";
import { useUIStore } from "../../../stores/ui.store";
// Static: this pane is its own lazy chunk already, and a second lazy level here meant a second Suspense
// reveal throttle (300 ms) before her chat could start loading.
import { HomeProfessorMariChat as OmnibarProfessorMariChat } from "../../chat/HomeProfessorMariChat";

export interface OmnibarMariPaneProps {
  /** False while the pane stays mounted but parked behind another pane. */
  active: boolean;
  reduceMotion: boolean | null;
  mariContext: ProfessorMariAskContext | null;
  /** Increments on every handoff that should send its query at once. */
  submitDraftRequest: number;
  mariOpenChatId: string | null;
  mariPendingReviewRequest: number;
  /** The specific review `mariPendingReviewRequest` should jump to, or null for "any" (R9). */
  mariPendingReviewId: string | null;
  mariChatOpen: boolean;
  onChatWindowOpenChange: (open: boolean) => void;
  completionActions: readonly OmnibarCompletionAction[];
  onCompletionAction: (action: OmnibarCompletionAction) => void;
  omnibarHeaderSlot: HTMLElement | null;
  omnibarStatusSlot: HTMLElement | null;
  omnibarMenuSlot: HTMLElement | null;
  arrival: MariArrival | null;
  /** Increments on every arrival-door open (⌘J, the pull, the drag, Home's "Ask Professor Mari"). */
  arrivalAppendRequest: number;
  /** R7: the context of the screen she opens over; arrivals go to its thread. */
  arrivalThread: MariThreadContext;
  onArrivalAction: (action: MariArrivalAction) => void;
  arrivalFixContext: ProfessorMariAskContext | null;
}

export function OmnibarMariPane({
  active,
  reduceMotion,
  mariContext,
  submitDraftRequest,
  mariOpenChatId,
  mariPendingReviewRequest,
  mariPendingReviewId,
  mariChatOpen,
  onChatWindowOpenChange,
  completionActions,
  onCompletionAction,
  omnibarHeaderSlot,
  omnibarStatusSlot,
  omnibarMenuSlot,
  arrival,
  arrivalAppendRequest,
  arrivalThread,
  onArrivalAction,
  arrivalFixContext,
}: OmnibarMariPaneProps) {
  const { t } = useTranslation();
  const setMariPaneVisible = useUIStore((state) => state.setMariPaneVisible);
  // Her pane on screen is the user seeing her result; it clears the top-bar edge line (P3).
  useEffect(() => {
    setMariPaneVisible(active);
    return () => setMariPaneVisible(false);
  }, [active, setMariPaneVisible]);
  const openActions = completionActions.filter(
    (action) => action.kind === "open-resource" || action.kind === "open-field",
  );
  return (
    <motion.div
      key="omnibar-mari-pane"
      data-component="GlobalOmnibar.Mari"
      initial={active ? { opacity: 0, y: -14, scale: 0.985 } : false}
      animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -12, scale: 0.995 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 30, mass: 0.75 }}
      // UX-10: a column, so her window shrinks for the completion bar instead of overflowing the clipped pane
      // (a card's scrollIntoView then scrolled the pane and lifted the composer off the bottom).
      className={`mari-workspace-canvas flex min-h-0 flex-col overflow-hidden ${active ? "relative flex-1" : "pointer-events-none absolute inset-0"}`}
      aria-hidden={!active}
      inert={!active}
    >
      <OmnibarProfessorMariChat
        pageActive
        embeddedTab
        omnibarMode
        launchHidden
        initialAskContext={mariContext}
        submitDraftRequest={submitDraftRequest}
        openChatId={mariOpenChatId}
        pendingReviewRequest={mariPendingReviewRequest}
        pendingReviewId={mariPendingReviewId}
        chatWindowOpen={mariChatOpen}
        omnibarHeaderSlot={omnibarHeaderSlot}
        omnibarStatusSlot={omnibarStatusSlot}
        omnibarMenuSlot={omnibarMenuSlot}
        arrival={arrival}
        arrivalAppendRequest={arrivalAppendRequest}
        arrivalThread={arrivalThread}
        onArrivalAction={onArrivalAction}
        arrivalFixContext={arrivalFixContext}
        onChatWindowOpenChange={onChatWindowOpenChange}
      />
      {/* Review and return live on the receipt cards and the header's back arrow, so this bar only opens things. */}
      {openActions.length > 0 ? (
        <div
          data-component="GlobalOmnibar.CompletionActions"
          className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2"
        >
          {openActions.map((action) => (
            <button
              key={action.kind}
              type="button"
              onClick={() => onCompletionAction(action)}
              className="mari-chrome-control mari-chrome-control--small"
            >
              {action.kind === "open-resource"
                ? t("commandCenter.completion.openResource", "Open {{label}}", {
                    label: action.resource?.label ?? "",
                  })
                : t("commandCenter.completion.openField", "Open {{field}}", { field: action.field ?? "" })}
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
