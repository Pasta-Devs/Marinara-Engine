import {
  ProfessorMariAskContext,
  MariWorkspaceActionResult,
  MessageExtra,
  MessageRole,
  MariWorkspaceStatus,
  MariSuggestionChip,
  MariGuidedPlanStep,
  Chat,
} from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import { RefObject, Dispatch, SetStateAction, useCallback } from "react";
import { professorMariWorkspaceStatusKeys } from "../../../hooks/use-professor-mari-workspace-status";
import { api, isPassiveStreamDisconnect } from "../../../lib/api-client";
import { awaitMariPermissionsModeWrites } from "../../../lib/mari-permissions-write-chain";
import { describeProfessorMariError } from "../../../lib/professor-mari-errors";
import { RafThrottle } from "../../../lib/raf-throttle";
import { useChatStore } from "../../../stores/chat.store";
import { useUIStore } from "../../../stores/ui.store";
import {
  ProfessorMariRecovery,
  isProfessorMariAbortError,
  classifyProfessorMariFailure,
  ProfessorMariAttachment,
  MariWorkspaceRunError,
  waitForWorkspaceRunToSettle,
} from "./mari-chat-helpers";
import {
  WorkspaceTimelineItem,
  appendThinkingTimeline,
  asRecord,
  appendStatusTimeline,
  WorkspaceToolCall,
  getToolCallId,
  previewValue,
  upsertToolTimeline,
  outputValue,
  markNarrationTimeline,
  isMariWorkspaceActionResult,
} from "./mari-tool-presentation";

/** Her run: send one message to the workspace agent, stream its timeline, and refresh what it changed after. */
type MariWorkspaceRunInput = {
  activeChatIdRef: RefObject<string | null>;
  chatId: string | null;
  clearMariPlan: () => void;
  effectiveConnectionId: string;
  handoffContext: ProfessorMariAskContext | null;
  invalidateActionResult: (result: MariWorkspaceActionResult) => Promise<void>;
  invalidateWorkspaceData: () => Promise<void>;
  loadMessages: (
    id: string,
    options?: { restoreFocus?: boolean | (() => boolean); shouldApply?: () => boolean },
  ) => Promise<
    | {
        extra: MessageExtra;
        id: string;
        chatId: string;
        role: MessageRole;
        characterId: string | null;
        content: string;
        activeSwipeIndex: number;
        swipeCount?: number;
        rowid?: number;
        createdAt: string;
      }[]
    | undefined
  >;
  pendingWorkspaceTextRef: RefObject<string>;
  refreshWorkspaceStatus: (shouldApply?: () => boolean) => Promise<MariWorkspaceStatus>;
  setCancelledChatId: Dispatch<SetStateAction<string | null>>;
  setMariChips: (chatId: string | null, chips: MariSuggestionChip[]) => void;
  setMariPlan: (chatId: string | null, steps: MariGuidedPlanStep[]) => void;
  setRecovery: (value: ProfessorMariRecovery | null) => void;
  setWorkspaceActive: Dispatch<SetStateAction<boolean>>;
  setWorkspaceRunClock: Dispatch<SetStateAction<{ startedAt: number; endedAt: number | null } | null>>;
  setWorkspaceTimeline: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
  workspaceAbortRef: RefObject<AbortController | null>;
  workspaceRunIdRef: RefObject<number>;
  workspaceTextThrottle: RafThrottle<void>;
};

export function useMariWorkspaceRun({
  activeChatIdRef,
  chatId,
  clearMariPlan,
  effectiveConnectionId,
  handoffContext,
  invalidateActionResult,
  invalidateWorkspaceData,
  loadMessages,
  pendingWorkspaceTextRef,
  refreshWorkspaceStatus,
  setCancelledChatId,
  setMariChips,
  setMariPlan,
  setRecovery,
  setWorkspaceActive,
  setWorkspaceRunClock,
  setWorkspaceTimeline,
  workspaceAbortRef,
  workspaceRunIdRef,
  workspaceTextThrottle,
}: MariWorkspaceRunInput) {
  const qc = useQueryClient();
  const failRun = useCallback(
    (error: unknown, retry: Pick<ProfessorMariRecovery, "text" | "attachments" | "context" | "localMessageId">) => {
      if (isProfessorMariAbortError(error)) return;
      console.error("[Professor Mari] Run failed", error);
      setRecovery({ ...retry, kind: classifyProfessorMariFailure(error), detail: describeProfessorMariError(error) });
      // F15: the server already saved this failure on the message; without a reload the local copy
      // still lacks mariRunError, so an OLDER failure in the same session loses its quiet line until
      // the next full reload.
      if (chatId) void loadMessages(chatId, { restoreFocus: false });
    },
    [chatId, loadMessages, setRecovery],
  );

  const sendWorkspaceMessage = useCallback(
    async (
      chat: Pick<Chat, "id">,
      text: string,
      attachments: ProfessorMariAttachment[] = [],
      existingUserMessageId?: string,
      context: ProfessorMariAskContext | null = handoffContext,
    ) => {
      // A mode change immediately before send must not race its PUTs: the run
      // resolves the mode server-side, so the WHOLE shared write chain - the
      // per-chat picker AND Settings' global default - lands first.
      await awaitMariPermissionsModeWrites();
      setCancelledChatId(null);
      const runId = ++workspaceRunIdRef.current;
      const controller = new AbortController();
      workspaceAbortRef.current = controller;
      workspaceTextThrottle.cancel();
      pendingWorkspaceTextRef.current = "";
      setWorkspaceActive(true);
      // R14 (item 7): the run's clock starts here, once, so steps, rounds and re-renders never restart it.
      setWorkspaceRunClock({ startedAt: Date.now(), endedAt: null });
      // The shared status query only refreshes on its own poll or on the
      // end-of-run invalidation below - closing the omnibar within that
      // window left the top-bar line with no "active" signal to start from.
      qc.setQueryData(professorMariWorkspaceStatusKeys.all, (data: MariWorkspaceStatus | undefined) =>
        data ? { ...data, active: true } : data,
      );
      setWorkspaceTimeline([]);
      setMariChips(chat.id, []);
      useChatStore.getState().setAbortController(chat.id, controller);
      useChatStore.getState().clearStreamBuffer(chat.id);
      useChatStore.getState().clearThinkingBuffer(chat.id);
      useChatStore.getState().setMariPhase(chat.id, "thinking");
      let received = false;
      let sawDone = false;
      // Mirror use-generate's backgrounding bookkeeping: Android browsers tear
      // down a hidden tab's connection with a plain TypeError, and the shared
      // classifier needs to know the page was hidden to call that passive.
      let pageWasHiddenDuringStream = typeof document !== "undefined" && document.visibilityState !== "visible";
      const markPageHidden = () => {
        pageWasHiddenDuringStream = true;
      };
      const recordBackgroundedStream = () => {
        if (document.visibilityState !== "visible") markPageHidden();
      };
      const canTrackVisibility = typeof document !== "undefined" && typeof window !== "undefined";
      if (canTrackVisibility) {
        document.addEventListener("visibilitychange", recordBackgroundedStream);
        window.addEventListener("pagehide", markPageHidden);
      }
      try {
        for await (const event of api.streamEvents(
          "/professor-mari/workspace/prompt",
          {
            chatId: chat.id,
            message: text,
            connectionId: effectiveConnectionId,
            debugMode: useUIStore.getState().debugMode,
            attachments,
            context: context ?? undefined,
            existingUserMessageId,
          },
          controller.signal,
          // Backgrounding leaves the socket half-open; detach on resume. The
          // server keeps the run going and persists it, so we reload the result
          // (and pending approvals) on return instead of hanging.
          { disconnectOnResume: true },
        )) {
          if (event.type === "token" && typeof event.data === "string") {
            received = true;
            pendingWorkspaceTextRef.current += event.data;
            workspaceTextThrottle.call(undefined);
            useChatStore.getState().appendStreamBuffer(event.data, chat.id);
            continue;
          }
          workspaceTextThrottle.flush();
          if (event.type === "thinking" && typeof event.data === "string") {
            setWorkspaceTimeline((current) => appendThinkingTimeline(current, event.data as string));
            useChatStore.getState().appendThinkingBuffer(event.data, chat.id);
          } else if (event.type === "status") {
            const data = asRecord(event.data);
            const content =
              typeof event.data === "string"
                ? event.data
                : typeof data?.content === "string"
                  ? data.content
                  : "Working...";
            setWorkspaceTimeline((current) => appendStatusTimeline(current, content));
          } else if (event.type === "tool_start") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: "running",
              input: data?.input,
              detail: previewValue(data?.input),
              output: null,
              startedAt: Date.now(),
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
            useChatStore.getState().setMariPhase(chat.id, "updating");
          } else if (event.type === "tool_update") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: "running",
              detail: null,
              output: outputValue(data?.output),
              startedAt: Date.now(),
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
          } else if (event.type === "tool_end") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const isError = data?.isError === true;
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: isError ? "error" : "done",
              detail: null,
              output: outputValue(data?.output),
              startedAt: Date.now(),
              durationMs: typeof data?.durationMs === "number" ? data.durationMs : undefined,
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
          } else if (event.type === "suggestions") {
            const chips = Array.isArray(event.data) ? (event.data as MariSuggestionChip[]) : [];
            if (
              useUIStore.getState().professorMariSuggestionsEnabled ||
              chips.some((chip) => chip.id === "authorization-accept")
            ) {
              setMariChips(chat.id, chips);
            }
          } else if (event.type === "plan") {
            if (useUIStore.getState().professorMariSuggestionsEnabled) {
              const steps = Array.isArray(event.data) ? (event.data as MariGuidedPlanStep[]) : [];
              if (steps.length > 0) setMariPlan(chat.id, steps);
              else clearMariPlan();
            }
          } else if (event.type === "metadata") {
            const data = asRecord(event.data);
            if (data?.narration === true) setWorkspaceTimeline(markNarrationTimeline);
            if (isMariWorkspaceActionResult(data?.actionResult)) {
              void invalidateActionResult(data.actionResult).catch((error) => {
                console.error("[Professor Mari] Failed to refresh action result", error);
              });
            }
          } else if (event.type === "done") {
            received = true;
            sawDone = true;
          } else if (event.type === "error") {
            // The SERVER reported this over a live stream — the run itself
            // failed. It must never be mistaken for a transport death below.
            throw new MariWorkspaceRunError(
              typeof event.data === "string" ? event.data : "Workspace generation failed",
            );
          }
        }
        if (!sawDone && !controller.signal.aborted) {
          // The stream closed CLEANLY without her "done" — mobile browsers and
          // proxies can shut a socket down without an error while the server
          // keeps running (#5719), also after her first round already spoke.
          // If the status endpoint confirms a live run, this was a passive
          // disconnect: wait it out and let the caller reload what the server
          // saved (her reply, or the failure it recorded - R14) instead of
          // ending the turn as if she had simply stopped.
          received = (await waitForWorkspaceRunToSettle(effectiveConnectionId, controller.signal)) || received;
        }
      } catch (error) {
        if (error instanceof MariWorkspaceRunError) throw error;
        if (!isPassiveStreamDisconnect(error, pageWasHiddenDuringStream, controller.signal)) throw error;
        // Detached by backgrounding (the resume watchdog, or the browser
        // killing the hidden tab's socket outright), not a failure — the run
        // continues and persists server-side. Wait for it to actually settle
        // before reporting success, so handleSubmit reloads the finished
        // reply and approvals rather than a half-written state.
        await waitForWorkspaceRunToSettle(effectiveConnectionId, controller.signal);
        received = true;
      } finally {
        if (canTrackVisibility) {
          document.removeEventListener("visibilitychange", recordBackgroundedStream);
          window.removeEventListener("pagehide", markPageHidden);
        }
        workspaceTextThrottle.flush();
        workspaceAbortRef.current = null;
        setWorkspaceActive(false);
        setWorkspaceRunClock((clock) => clock && { ...clock, endedAt: Date.now() });
        useChatStore.getState().setAbortController(chat.id, null);
        useChatStore.getState().setMariPhase(chat.id, "idle");
        // The omnibar's working rings read the status poll; refresh it now so they stop with her.
        void qc.invalidateQueries({ queryKey: professorMariWorkspaceStatusKeys.all });
      }
      // hiddenDuringStream lets callers suppress the "no reply" toast when the
      // page's visibility history makes a false negative likely (the run may
      // have finished before the settle poll could observe it active) — the
      // authoritative reload either shows the persisted reply or the user
      // retries; a red toast beside a visible reply is worse than silence.
      return { received, runId, hiddenDuringStream: pageWasHiddenDuringStream };
    },
    [
      clearMariPlan,
      effectiveConnectionId,
      handoffContext,
      invalidateActionResult,
      pendingWorkspaceTextRef,
      qc,
      setCancelledChatId,
      setMariChips,
      setMariPlan,
      setWorkspaceActive,
      setWorkspaceRunClock,
      setWorkspaceTimeline,
      workspaceAbortRef,
      workspaceRunIdRef,
      workspaceTextThrottle,
    ],
  );

  const refreshAfterWorkspaceRun = useCallback(
    async (completedChatId: string, runId: number) => {
      let messagesReloaded = false;
      try {
        if (workspaceRunIdRef.current !== runId || activeChatIdRef.current !== completedChatId) return;
        // M3: workspaceTimeline is left as the frozen record of this run - the active turn's
        // MariWorkTimeline call site keeps reading it (now with active=false) instead of swapping to a
        // second, freshly-mounted instance. The next send (or a chat switch) resets it for the next run.
        await loadMessages(completedChatId, {
          shouldApply: () => workspaceRunIdRef.current === runId && activeChatIdRef.current === completedChatId,
        });
        messagesReloaded = true;
      } catch (error) {
        console.error("[Professor Mari] Failed to reload messages after completed workspace run", error);
      }
      if (workspaceRunIdRef.current !== runId || activeChatIdRef.current !== completedChatId) return;
      if (messagesReloaded) {
        useChatStore.getState().clearStreamBuffer(completedChatId);
        useChatStore.getState().clearThinkingBuffer(completedChatId);
      }
      await Promise.allSettled([
        refreshWorkspaceStatus(
          () => workspaceRunIdRef.current === runId && activeChatIdRef.current === completedChatId,
        ),
        invalidateWorkspaceData(),
      ]);
    },
    [activeChatIdRef, invalidateWorkspaceData, loadMessages, refreshWorkspaceStatus, workspaceRunIdRef],
  );

  return { failRun, sendWorkspaceMessage, refreshAfterWorkspaceRun };
}
