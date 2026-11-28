import { create } from "zustand";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { translate } from "../localization/i18n";
import { useChatStore } from "./chat.store";
import { useUIStore } from "./ui.store";

/**
 * Impersonate as a message draft: the model writes the persona's next message into the message box
 * instead of posting it. Nothing is saved until the user sends it, so no character reply, agent,
 * tracker or world-state update runs. One draft per chat; it keeps writing while the user is in
 * another chat or tab, and lands in that chat's message box.
 */
export interface ImpersonateDraft {
  status: "writing" | "ready";
  /** The text written so far (writing) or the finished draft (ready). */
  text: string;
  /** The direction it was asked for, reused by Redo. */
  direction: string;
  /** What was in the message box before, which Undo puts back. */
  before: string;
}

interface ImpersonateDraftState {
  drafts: Record<string, ImpersonateDraft>;
}

export const useImpersonateDraftStore = create<ImpersonateDraftState>(() => ({ drafts: {} }));

const controllers = new Map<string, AbortController>();

function setDraft(chatId: string, draft: ImpersonateDraft | null) {
  useImpersonateDraftStore.setState((state) => {
    const drafts = { ...state.drafts };
    if (draft) drafts[chatId] = draft;
    else delete drafts[chatId];
    return { drafts };
  });
}

export function getImpersonateDraft(chatId: string | null | undefined): ImpersonateDraft | null {
  return chatId ? (useImpersonateDraftStore.getState().drafts[chatId] ?? null) : null;
}

export function isImpersonateDraftWriting(chatId: string | null | undefined): boolean {
  return getImpersonateDraft(chatId)?.status === "writing";
}

/** Where an impersonate's result goes when nothing per-use says otherwise. */
export function impersonateResultsGoToDraft(): boolean {
  return useUIStore.getState().impersonateResult === "draft";
}

/** Puts the finished (or stopped) draft into the chat's stored message box text. */
function landDraft(chatId: string, text: string, before: string, direction: string) {
  if (text.trim()) {
    setDraft(chatId, { status: "ready", text, direction, before });
    useChatStore.getState().setInputDraft(chatId, text);
    return;
  }
  // Nothing was written: the box gets back what it had.
  setDraft(chatId, null);
  if (before.trim()) useChatStore.getState().setInputDraft(chatId, before);
  else useChatStore.getState().clearInputDraft(chatId);
}

/**
 * Writes an impersonate draft for a chat. Returns false when one is already writing there.
 * `before` is the message box text to give back on Undo (and on a failure).
 */
export async function startImpersonateDraft(input: {
  chatId: string;
  direction: string;
  before: string;
}): Promise<boolean> {
  const { chatId } = input;
  const direction = input.direction.trim();
  if (controllers.has(chatId)) return false;
  if (useChatStore.getState().abortControllers.has(chatId)) {
    toast.info(translate("ui.chat.impersonateDraft.busy"));
    return false;
  }
  const controller = new AbortController();
  controllers.set(chatId, controller);
  let text = "";
  const before = input.before;
  setDraft(chatId, { status: "writing", text, direction, before });

  const {
    impersonatePresetId,
    impersonatePublicFaces,
    impersonatePromptTemplate,
    userStatus,
    userActivity,
    debugMode,
    trimIncompleteModelOutput,
  } = useUIStore.getState();
  const promptTemplate = impersonatePromptTemplate.trim();
  let failure: string | null = null;
  try {
    for await (const event of api.streamEvents(
      "/generate",
      {
        chatId,
        connectionId: null,
        impersonate: true,
        impersonateDraft: true,
        ...(direction ? { userMessage: direction } : {}),
        ...(impersonatePresetId ? { impersonatePresetId } : {}),
        // A draft never runs agents; the server holds to that too.
        impersonateBlockAgents: true,
        ...(impersonatePublicFaces ? { impersonatePublicFaces: true } : {}),
        ...(promptTemplate ? { impersonatePromptTemplate: promptTemplate } : {}),
        userStatus,
        userActivity,
        userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
        debugMode,
        trimIncompleteModelOutput,
        streaming: true,
      },
      controller.signal,
    )) {
      if (event.type === "token" && typeof event.data === "string") {
        text += event.data;
      } else if (event.type === "content_replace" && typeof event.data === "string") {
        text = event.data;
      } else if (event.type === "impersonate_draft") {
        const finished = (event.data as { text?: unknown } | null)?.text;
        if (typeof finished === "string") text = finished;
      } else if (event.type === "error") {
        failure =
          typeof event.data === "string" && event.data ? event.data : translate("ui.chat.impersonateDraft.failed");
        break;
      } else if (event.type === "done") {
        break;
      } else {
        continue;
      }
      if (getImpersonateDraft(chatId)?.status === "writing")
        setDraft(chatId, { status: "writing", text, direction, before });
    }
  } catch (error) {
    if (!controller.signal.aborted)
      failure = error instanceof Error ? error.message : translate("ui.chat.impersonateDraft.failed");
  } finally {
    controllers.delete(chatId);
  }
  // A Stop keeps what was written so far; a failure keeps it too, and says why.
  if (failure && !controller.signal.aborted) toast.error(failure);
  // Undo or a new chat state may already have cleared it.
  if (getImpersonateDraft(chatId)) landDraft(chatId, text, before, direction);
  return !failure;
}

/** Stops a draft that is writing; what it wrote so far stays in the box. */
export function stopImpersonateDraft(chatId: string) {
  const controller = controllers.get(chatId);
  if (!controller) return;
  controller.abort();
  void api.post("/generate/abort", { chatId }).catch(() => undefined);
}

/** Writes the draft again with the same direction, replacing the one in the box. */
export function redoImpersonateDraft(chatId: string) {
  const draft = getImpersonateDraft(chatId);
  if (!draft || draft.status !== "ready") return;
  void startImpersonateDraft({ chatId, direction: draft.direction, before: draft.before });
}

/** Throws the draft away and puts back what the box had before. */
export function undoImpersonateDraft(chatId: string): string {
  const draft = getImpersonateDraft(chatId);
  if (!draft) return "";
  stopImpersonateDraft(chatId);
  setDraft(chatId, null);
  if (draft.before.trim()) useChatStore.getState().setInputDraft(chatId, draft.before);
  else useChatStore.getState().clearInputDraft(chatId);
  return draft.before;
}

/** Forgets a finished draft (it was sent, or the box was emptied). The box text is left alone. */
export function forgetImpersonateDraft(chatId: string) {
  const draft = getImpersonateDraft(chatId);
  if (draft?.status === "ready") setDraft(chatId, null);
}

/** Gives a draft its Redo and Undo back when sending it failed and nothing was posted. */
export function restoreImpersonateDraft(chatId: string, draft: ImpersonateDraft) {
  if (getImpersonateDraft(chatId)) return;
  setDraft(chatId, { ...draft, status: "ready" });
}
