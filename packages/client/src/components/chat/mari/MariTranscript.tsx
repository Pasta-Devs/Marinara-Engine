import {
  MariSuggestionChip,
  MariGuidedPlanStep,
  ProfessorMariAskContext,
  MariWorkspaceActionResult,
  MariWorkspaceStatus,
} from "@marinara-engine/shared";
import { Sparkles } from "lucide-react";
import type { MariWorkspacePendingApproval, Message } from "@marinara-engine/shared";
import { RefObject, ReactElement, ReactNode, Dispatch, SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import { CharacterPreviewModel } from "../../../lib/character-preview";
import { LorebookPreviewModel } from "../../../lib/lorebook-preview";
import { MariArrival, MariThreadContext } from "../../../lib/mari-arrival";
import { MariReferencedResource } from "../../../lib/mari-referenced-resources";
import { MariStoryState } from "../../../lib/mari-work-animations";
import { ProfessorMariPresentationState } from "../../../lib/professor-mari-presentation";
import { cn } from "../../../lib/utils";
import { MariNote } from "../mari-primitives";
import { MariStorySprite } from "../MariStorySprite";
import { MariSuggestionChips, MariNextStepCards } from "../MariSuggestionChips";
import { TranscriptRow } from "../MariTranscriptRow";
import { MariTurnReviews, MariWorkTimelineOutcome } from "./CompactMariMessage";
import { ProfessorMariRecovery, continuedThereByContext } from "./mari-chat-helpers";
import { WorkspaceTimelineItem, getMessageRunError, getMessageRunTime } from "./mari-tool-presentation";
import { LoadingHistoryState } from "./MariChatStates";
import { CompactMarkdown } from "./MariReplyContent";
import { MariWorkTimeline } from "./MariWorkTimeline";

/** Her transcript: the arrival or empty welcome, earlier turns, the active turn with its live timeline, reviews and errors. */
/** One review in a turn: still pending (`outcome: null`) or already decided. */
export type MariTurnReviewEntry =
  | { requestedAt: string; approval: MariWorkspacePendingApproval; outcome: null }
  | { requestedAt: string; approval: MariWorkspacePendingApproval; outcome: "applied" | "discarded" };

type MariTranscriptProps = {
  activeRunError: { kind: "general" | "provider" | "tool" | "context"; detail: string | undefined } | null;
  activeTurnMessages: Message[];
  activeTurnRef: RefObject<HTMLDivElement | null>;
  appendedArrival: MariArrival | null;
  appendedArrivalNodeRef: RefObject<HTMLDivElement | null>;
  arrival: MariArrival | null;
  arrivalChoiceChatId: string | null;
  arrivalThread: MariThreadContext | null;
  characterPreviewById: Map<string, CharacterPreviewModel>;
  chatId: string | null;
  chipRowChips: MariSuggestionChip[];
  emptyStateReady: boolean;
  focusedCharacter: CharacterPreviewModel | null;
  focusedLorebook: LorebookPreviewModel | null;
  guidedPlanStep: MariGuidedPlanStep | null;
  handleDeleteMessage: (messageId: string) => Promise<void>;
  handleNewAboutContext: () => Promise<void>;
  handleRegenerateMessage: (messageId: string) => Promise<void>;
  handleSuggestionSelect: (chip: MariSuggestionChip, draft?: boolean, context?: ProfessorMariAskContext) => void;
  handleTranscriptScroll: () => void;
  heldCardNode: ReactElement | null;
  isBusy: boolean;
  lastAssistantId: string | null;
  lastUserMessage: Message | undefined;
  latestActionResults: MariWorkspaceActionResult[];
  latestMessage: Message;
  latestTurnHasTrace: boolean;
  latestTurnRestStory: MariStoryState | null;
  loadingHistory: boolean;
  lorebookPreviewById: Map<string, LorebookPreviewModel>;
  mariPresentationState: ProfessorMariPresentationState;
  messages: Message[];
  omnibarMode: boolean;
  openActionResult: (result: MariWorkspaceActionResult) => Promise<void>;
  openReferencedResource: (resource: MariReferencedResource) => void;
  renderArrival: (
    data: MariArrival,
    component: string,
    ref?: RefObject<HTMLDivElement | null>,
    choice?: ReactNode,
  ) => ReactElement;
  renderDisplayMessage: (message: Message) => ReactElement;
  renderGoal: (message: Message) => ReactElement | null;
  renderRunErrorCard: (
    error: { kind?: ProfessorMariRecovery["kind"]; detail?: string },
    retry: boolean,
  ) => ReactElement;
  renderTurnPrompt: (entry: MariTurnReviewEntry) => ReactElement;
  renderTurnReviews: (messageId: string) => MariTurnReviews;
  restingStory: MariStoryState | null;
  reviewsByTurn: { byMessageId: Map<string, MariTurnReviewEntry[]>; unassigned: MariTurnReviewEntry[] };
  setArrivalChoiceChatId: Dispatch<SetStateAction<string | null>>;
  setTranscriptScrollNode: (node: HTMLDivElement | null) => void;
  setTranscriptStackNode: (node: HTMLDivElement | null) => void;
  showConnectionFirstHint: boolean;
  showJumpToLatest: boolean;
  showNextStepCards: boolean;
  showSuggestionPrompt: boolean;
  suggestionQuestion: string | null;
  transcriptHeadMessages: Message[];
  workspaceRunClock: { startedAt: number; endedAt: number | null } | null;
  workspaceStatus: MariWorkspaceStatus | null;
  workspaceTimeline: WorkspaceTimelineItem[];
  workspaceTimelineActive: boolean;
  workspaceTimelineVisible: boolean;
  workspaceToolsIssue: string | null;
};

export function MariTranscript({
  activeRunError,
  activeTurnMessages,
  activeTurnRef,
  appendedArrival,
  appendedArrivalNodeRef,
  arrival,
  arrivalChoiceChatId,
  arrivalThread,
  characterPreviewById,
  chatId,
  chipRowChips,
  emptyStateReady,
  focusedCharacter,
  focusedLorebook,
  guidedPlanStep,
  handleDeleteMessage,
  handleNewAboutContext,
  handleRegenerateMessage,
  handleSuggestionSelect,
  handleTranscriptScroll,
  heldCardNode,
  isBusy,
  lastAssistantId,
  lastUserMessage,
  latestActionResults,
  latestMessage,
  latestTurnHasTrace,
  latestTurnRestStory,
  loadingHistory,
  lorebookPreviewById,
  mariPresentationState,
  messages,
  omnibarMode,
  openActionResult,
  openReferencedResource,
  renderArrival,
  renderDisplayMessage,
  renderGoal,
  renderRunErrorCard,
  renderTurnPrompt,
  renderTurnReviews,
  restingStory,
  reviewsByTurn,
  setArrivalChoiceChatId,
  setTranscriptScrollNode,
  setTranscriptStackNode,
  showConnectionFirstHint,
  showJumpToLatest,
  showNextStepCards,
  showSuggestionPrompt,
  suggestionQuestion,
  transcriptHeadMessages,
  workspaceRunClock,
  workspaceStatus,
  workspaceTimeline,
  workspaceTimelineActive,
  workspaceTimelineVisible,
  workspaceToolsIssue,
}: MariTranscriptProps) {
  const { t: localizeUi } = useTranslation();
  const { t } = useTranslation();
  // The fade-in follows the loading skeleton only; a thread drawn at once (a cached reopen) shows as it is.
  const [showedSkeleton, setShowedSkeleton] = useState(loadingHistory);
  if (loadingHistory && !showedSkeleton) setShowedSkeleton(true);
  const runErrorCard = activeRunError
    ? renderRunErrorCard(activeRunError, true)
    : workspaceStatus?.error && !isBusy
      ? renderRunErrorCard({ detail: workspaceStatus.error }, false)
      : null;
  return (
    <div
      ref={setTranscriptScrollNode}
      onScroll={handleTranscriptScroll}
      data-component="HomeProfessorMariChat.Transcript"
      data-anchor={messages.length === 0 ? "bottom" : undefined}
      data-more-below={showJumpToLatest ? "true" : undefined}
      data-mari-state={mariPresentationState}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-5 text-left sm:px-7",
        omnibarMode
          ? "mari-workspace-transcript bg-transparent"
          : "bg-[radial-gradient(circle_at_12%_8%,oklch(0.79_0.16_205/0.06),transparent_26%),radial-gradient(circle_at_88%_12%,oklch(0.73_0.21_345/0.07),transparent_28%)]",
      )}
    >
      <div
        ref={setTranscriptStackNode}
        className="mari-transcript-stack space-y-3"
        data-history={loadingHistory ? "loading" : "loaded"}
        data-arrive={showedSkeleton ? "" : undefined}
      >
        {loadingHistory ? (
          <LoadingHistoryState />
        ) : (
          <>
            {workspaceToolsIssue ? (
              <MariNote tone="accent" role="status">
                {localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsAreUnavailable")}{" "}
                <span className="mari-note__detail">{workspaceToolsIssue}</span>
              </MariNote>
            ) : null}
            {transcriptHeadMessages.map((message) => (
              // Older turns skip style and layout while off screen (mari.css).
              <div key={message.id} className="mari-transcript-past-turn">
                {renderDisplayMessage(message)}
              </div>
            ))}
            {/* Not before her chat has loaded: null === null would show the empty state, then the
                                  history loader, then the empty state again. */}
            {emptyStateReady && arrival ? (
              // M9: she arrives knowing the screen she was opened from. Nothing is sent until
              // a card is picked or you type (R22); the composer's chips say what would go.
              renderArrival(arrival, "HomeProfessorMariChat.Arrival")
            ) : emptyStateReady ? (
              <div className="mari-omnibar-empty-welcome">
                <span className="mari-welcome-story" aria-hidden="true">
                  <MariStorySprite state="idle" />
                </span>
                <div className="mari-omnibar-empty-welcome__copy">
                  <h3>{localizeUi("ui.chat.homeprofessormarichat.emptyWelcomeTitle")}</h3>
                  <p>{localizeUi("ui.chat.homeprofessormarichat.emptyWelcomeDescription")}</p>
                  <MariSuggestionChips
                    chips={chipRowChips}
                    onSelect={(chip) => handleSuggestionSelect(chip, true)}
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : null}
            {showConnectionFirstHint && (
              <p className="px-3 py-1 text-center text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.selectAConnectionFirst")}
              </p>
            )}
            {/* M4: the active turn reserves the transcript's visible height (set on send) so
                                  nothing below it changes the scrollable height until a new turn replaces it. */}
            <div ref={activeTurnRef} data-component="HomeProfessorMariChat.ActiveTurn" className="space-y-3">
              {/* M3: one timeline per turn. The unified MariWorkTimeline call site below never
                                    changes between the live run and the persisted reply - only its props do - so
                                    React updates it in place instead of unmounting and remounting it (which
                                    replayed every row's entrance animation and snapped its height). The persisted
                                    assistant reply it stands in for is skipped here (not merely hidden - an
                                    empty sibling would still add its own space-y-3 gap and shift every row). */}
              {activeTurnMessages
                .filter(
                  (message) =>
                    !(message.id === latestMessage?.id && workspaceTimelineVisible && message.role === "assistant"),
                )
                .map(renderDisplayMessage)}
              {/* Sending, before the run is confirmed: she stays on screen until the live line takes over. */}
              {isBusy && !workspaceTimelineVisible ? (
                <div className="mari-work-timeline__live">
                  <MariStorySprite state="thinking" pullTarget={false} />
                </div>
              ) : null}
              {workspaceTimelineVisible ? (
                <MariWorkTimeline
                  items={workspaceTimeline}
                  character={focusedCharacter}
                  lorebook={focusedLorebook}
                  active={workspaceTimelineActive}
                  restStory={latestTurnRestStory}
                  pullTarget={!appendedArrival}
                  runFailed={
                    Boolean(activeRunError) ||
                    Boolean(latestMessage && getMessageRunError(latestMessage, { includeDismissed: true }))
                  }
                  startedAtMs={
                    workspaceRunClock?.startedAt ??
                    (lastUserMessage
                      ? getMessageRunTime(lastUserMessage, "mariRunStartedAt") ||
                        Date.parse(lastUserMessage.createdAt) ||
                        null
                      : null)
                  }
                  endedAtMs={workspaceRunClock?.endedAt ?? null}
                  characterPreviews={characterPreviewById}
                  lorebookPreviews={lorebookPreviewById}
                  actionResults={latestActionResults}
                  onOpenResource={openReferencedResource}
                  goal={!workspaceTimelineActive && latestMessage ? renderGoal(latestMessage) : null}
                  held={typeof latestMessage?.extra === "object" && latestMessage.extra?.mariDeferredMutations === true}
                >
                  {!workspaceTimelineActive && latestMessage?.role === "assistant" ? (
                    <MariWorkTimelineOutcome
                      content={latestMessage.content ?? ""}
                      actionResults={latestActionResults}
                      characterPreviews={characterPreviewById}
                      lorebookPreviews={lorebookPreviewById}
                      onOpenActionResult={openActionResult}
                      onRegenerate={!isBusy ? () => handleRegenerateMessage(latestMessage.id) : undefined}
                      onDelete={!isBusy ? () => handleDeleteMessage(latestMessage.id) : undefined}
                      reviews={renderTurnReviews(latestMessage.id)}
                    />
                  ) : null}
                </MariWorkTimeline>
              ) : null}
              {/* Mari tells her story (stopped, retry, review) under her newest turn; she rests beside her reply.
                                    A failed send is its red line under your message, not also a line of hers.
                                    Held back while the live timeline is still mounted (M4): the reload that
                                    clears it also brings the trace whose timeline then shows her. */}
              {restingStory && !latestTurnHasTrace && !runErrorCard && !workspaceTimelineVisible ? (
                <div
                  className="mari-work-timeline__live"
                  data-past={latestMessage?.role === "assistant" ? "true" : undefined}
                >
                  {/* Beside her reply when there is one (MariAnswer); here otherwise. */}
                  {latestMessage?.role === "assistant" ? null : (
                    <MariStorySprite
                      key={`${chatId}:${latestMessage?.id}:${restingStory ?? "idle"}`}
                      state={restingStory ?? "idle"}
                      pullTarget={!appendedArrival}
                    />
                  )}
                  {restingStory && restingStory !== "approval" ? (
                    <span className="text-xs text-[var(--muted-foreground)]">{t(`mari.stories.${restingStory}`)}</span>
                  ) : null}
                </div>
              ) : null}
              {/* A failed run keeps her beside the error card, in her retry pose, so the hand-over has no gap. */}
              {runErrorCard ? (
                <div className="mari-work-timeline__live mari-run-error-row">
                  <MariStorySprite state="retry" pullTarget={!appendedArrival} />
                  {runErrorCard}
                </div>
              ) : null}
              {reviewsByTurn.unassigned.length > 0 || (heldCardNode && !lastAssistantId) ? (
                <div className="space-y-3">
                  {lastAssistantId ? null : heldCardNode}
                  {reviewsByTurn.unassigned.map(renderTurnPrompt)}
                </div>
              ) : null}
              {/* Only a real question gets a line (a guided plan step, or held changes); generic
                                    "what next?" prompts are left to the chips, as in Claude and Gemini. */}
              {omnibarMode && messages.length > 0 && showSuggestionPrompt && suggestionQuestion && guidedPlanStep ? (
                <TranscriptRow layout="document" marker={null} className="mari-suggestion-turn">
                  <div className="mari-suggestion-question-turn">
                    <Sparkles size="0.8rem" aria-hidden="true" />
                    <CompactMarkdown content={suggestionQuestion} />
                  </div>
                </TranscriptRow>
              ) : null}
              {showNextStepCards ? (
                <MariNextStepCards chips={chipRowChips} onSelect={handleSuggestionSelect} disabled={isBusy} />
              ) : null}
            </div>
            {appendedArrival
              ? // D1: an arrival door (⌘J, the pull, the drag, Home's "Ask Professor Mari")
                // opened into a chat she already has history in. The same arrival content
                // empty chats get (buildMariArrival, unchanged) appends at the bottom here
                // instead, local UI only (R22): never persisted, cleared on send.
                renderArrival(
                  appendedArrival,
                  "HomeProfessorMariChat.AppendedArrival",
                  appendedArrivalNodeRef,
                  arrivalThread && chatId && arrivalChoiceChatId === chatId ? (
                    // R7/R13: no thread for this screen yet, so she continued her latest one; one quiet choice, no prompt.
                    <div
                      className="mari-arrival__choice"
                      role="group"
                      aria-label={localizeUi("ui.chat.homeprofessormarichat.arrivalChoice.label")}
                    >
                      <button
                        type="button"
                        className="mari-btn"
                        disabled={isBusy}
                        onClick={() => {
                          continuedThereByContext.set(arrivalThread.key, chatId);
                          setArrivalChoiceChatId(null);
                        }}
                      >
                        {localizeUi("ui.chat.homeprofessormarichat.arrivalChoice.continueHere")}
                      </button>
                      <button
                        type="button"
                        className="mari-btn min-w-0"
                        disabled={isBusy}
                        onClick={() => void handleNewAboutContext()}
                      >
                        <span className="truncate">
                          {arrivalThread.label
                            ? localizeUi("ui.chat.homeprofessormarichat.arrivalChoice.newAbout", {
                                context: arrivalThread.label,
                              })
                            : localizeUi("ui.chat.homeprofessormarichat.newChat")}
                        </span>
                      </button>
                    </div>
                  ) : null,
                )
              : null}
          </>
        )}
      </div>
    </div>
  );
}
