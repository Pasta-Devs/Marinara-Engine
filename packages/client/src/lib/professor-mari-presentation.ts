import { SETTINGS_TABS, type MariHeldChange, type ProfessorMariAskContext } from "@marinara-engine/shared";
import { chatResultType, recordFaceResultType, resourceResultType, type ResultType } from "./command-icons";

export type ProfessorMariPresentationState =
  "empty" | "working" | "composing" | "history" | "completed" | "waiting-approval" | "broken";

/** Slice 67: an already-applied change's optional Keep/Undo is not a question; only real approvals wait on you. */
/**
 * Slice 71 (F1): whether a review still waits on you. An applied change only offers Undo, so it does
 * not; a delete is applied too, but its rows stay hidden until you choose Delete or Put back, so it does.
 * Install, file and legacy approvals always wait.
 */
export function isMariReviewWaiting(review: {
  kind?: string;
  affectedRows?: number;
  diffPreview?: ReadonlyArray<{ table: string; action: string }>;
}): boolean {
  if (review.kind !== "applied_review") return true;
  return Boolean(
    review.diffPreview &&
    summarizeDeleteReview({ affectedRows: review.affectedRows ?? 0, diffPreview: review.diffPreview }),
  );
}

export function countBlockingReviews(reviews: readonly Parameters<typeof isMariReviewWaiting>[0][]): number {
  return reviews.filter(isMariReviewWaiting).length;
}

/**
 * Slice 71 (N3): what Accept on a held change would do, from the saved commands (never her prose). One
 * command: update (with the fields it sets), create, delete, or a plain change; several: how many and
 * their names. `nameOf` resolves a record id the command named only by id.
 */
export function describeMariHeldChanges(
  held: readonly MariHeldChange[] | null | undefined,
  nameOf: (id: string) => string | undefined,
): {
  kind: "update" | "create" | "delete" | "change" | "many";
  name: string;
  count: number;
  fields: NonNullable<MariHeldChange["fields"]>;
} {
  const list = held ?? [];
  const nameFor = (change: MariHeldChange) => change.name || (change.id ? nameOf(change.id) : undefined) || "";
  if (list.length > 1) {
    const names = [...new Set(list.map(nameFor).filter(Boolean))];
    return { kind: "many", name: names.join(", "), count: list.length, fields: [] };
  }
  const change = list[0];
  if (!change) return { kind: "change", name: "", count: 0, fields: [] };
  const action = change.action.toLowerCase();
  const fields = change.fields ?? [];
  const kind = /delete|remove/u.test(action)
    ? "delete"
    : /create|\badd/u.test(action)
      ? "create"
      : fields.length > 0
        ? "update"
        : "change";
  return { kind, name: nameFor(change), count: fields.length, fields };
}

export function resolveProfessorMariPresentationState({
  hasRecovery,
  hasWorkspaceError,
  pendingReviewCount,
  working,
  hasDraft,
  attachmentCount,
  hasActionResult,
  messageCount,
}: {
  hasRecovery: boolean;
  hasWorkspaceError: boolean;
  pendingReviewCount: number;
  working: boolean;
  hasDraft: boolean;
  attachmentCount: number;
  hasActionResult: boolean;
  messageCount: number;
}): ProfessorMariPresentationState {
  // R14: a new run or a retry answers the failure, so a stale error never reads as "broken" while she works.
  if (!working && (hasRecovery || hasWorkspaceError)) return "broken";
  if (pendingReviewCount > 0) return "waiting-approval";
  if (working) return "working";
  if (hasDraft || attachmentCount > 0) return "composing";
  if (hasActionResult) return "completed";
  if (messageCount > 0) return "history";
  return "empty";
}

export function stripProfessorMariSpeakerPrefix(value: string): string {
  return value.replace(/^\s*(?:Professor\s+Mari|Mari)\s*:\s*/iu, "");
}

export function isPersistentProfessorMariContext(context: ProfessorMariAskContext | null | undefined): boolean {
  return context?.resource?.kind === "character" || context?.resource?.kind === "lorebook";
}

export function professorMariContextCount(
  attachedContextCount: number,
  context: ProfessorMariAskContext | null | undefined,
): number {
  return Math.max(0, attachedContextCount) + (isPersistentProfessorMariContext(context) ? 1 : 0);
}

export type ProfessorMariContextFacetKind = "resource" | "chat" | "field" | "settings" | "error" | "asideAnswer";

export interface ProfessorMariContextFacet {
  kind: ProfessorMariContextFacetKind;
  text: string;
  /** Q6: what the resource, chat or settings page is, so its chip shows that kind's icon. */
  type?: ResultType;
}

/**
 * Every facet a handoff context carries, so the composer chip and the chip
 * left on a sent message (C2) can render the same list instead of picking
 * one field to show.
 */
export function professorMariContextFacets(
  context: ProfessorMariAskContext | null | undefined,
): ProfessorMariContextFacet[] {
  if (!context) return [];
  const facets: ProfessorMariContextFacet[] = [];
  // UX-24: the open chat picked as the resource ("Current chat: X") is already the chat facet.
  const resourceIsActiveChat = context.resource?.kind === "chat" && context.resource.id === context.activeChat?.id;
  if (context.resource?.label && !resourceIsActiveChat)
    facets.push({ kind: "resource", text: context.resource.label, type: resourceResultType(context.resource.kind) });
  if (context.activeChat?.label)
    facets.push({ kind: "chat", text: context.activeChat.label, type: chatResultType(context.activeChat.mode) });
  if (context.field) facets.push({ kind: "field", text: context.field });
  if (context.settingsLocation?.tab) {
    const tabLabel =
      SETTINGS_TABS.find((tab) => tab.id === context.settingsLocation!.tab)?.label ?? context.settingsLocation.tab;
    facets.push({ kind: "settings", text: tabLabel, type: "setting" });
  }
  if (context.error?.message) facets.push({ kind: "error", text: context.error.message });
  if (context.asideAnswer?.answer) facets.push({ kind: "asideAnswer", text: context.asideAnswer.answer });
  return facets;
}

/**
 * M7 (R22 made visible): before Send the chip shows only a name; the chat's
 * messages, the error text and the field's value are read when you send.
 */
export function professorMariFacetSendsContentLater(kind: ProfessorMariContextFacetKind): boolean {
  return kind === "chat" || kind === "field" || kind === "error";
}

/**
 * The context without one facet, so the composer's X on one chip keeps the
 * others. Null once no facet is left: the rest (source, capability, the typed
 * query) is nothing the user can see, so it is not worth keeping.
 */
export function withoutProfessorMariContextFacet(
  context: ProfessorMariAskContext | null | undefined,
  kind: ProfessorMariContextFacetKind,
): ProfessorMariAskContext | null {
  if (!context) return null;
  const next = { ...context };
  if (kind === "resource") {
    delete next.resource;
    delete next.relatedResources;
  } else if (kind === "chat") delete next.activeChat;
  else if (kind === "field") {
    delete next.field;
    delete next.fieldId;
  } else if (kind === "settings") delete next.settingsLocation;
  else if (kind === "error") delete next.error;
  else delete next.asideAnswer;
  return professorMariContextFacets(next).length > 0 ? next : null;
}

export function shouldShowProfessorMariConnectionHint({
  chatId,
  loadedMessagesChatId,
  sending,
  effectiveConnectionId,
}: {
  chatId: string | null;
  loadedMessagesChatId: string | null;
  sending: boolean;
  effectiveConnectionId: string | null;
}): boolean {
  return chatId !== null && loadedMessagesChatId === chatId && !sending && effectiveConnectionId === null;
}

/**
 * D1: an arrival door (⌘J, the pull, the drag, Home's "Ask Professor Mari") should still show the
 * arrival — appended at the bottom of the transcript — when Mari's own chat already has history,
 * not only on an empty chat. Gated the same way the empty-state arrival already is: a real chat is
 * selected and its history has actually loaded (never mid-load, never for a different chat).
 */
export function shouldAppendMariArrival({
  omnibarMode,
  messageCount,
  chatId,
  loadedMessagesChatId,
}: {
  omnibarMode: boolean;
  messageCount: number;
  chatId: string | null;
  loadedMessagesChatId: string | null;
}): boolean {
  return omnibarMode && messageCount > 0 && chatId !== null && loadedMessagesChatId === chatId;
}

export function shouldOfferProfessorMariStarterSuggestions({
  chatId,
  loadedMessagesChatId,
  messageCount,
  busy,
}: {
  chatId: string | null;
  loadedMessagesChatId: string | null;
  messageCount: number;
  busy: boolean;
}): boolean {
  return chatId !== null && loadedMessagesChatId === chatId && messageCount === 0 && !busy;
}

/**
 * Which assistant turn a held review belongs to: the last reply between the user message sent
 * before the review was requested and the next user message. A review whose turn has no reply (or
 * an unreadable time) stays unassigned, and the caller shows it after the transcript.
 */
export function assignReviewsToTurns<R extends { requestedAt: string }>(
  messages: ReadonlyArray<{ id: string; role: string; createdAt: string }>,
  reviews: ReadonlyArray<R>,
): { byMessageId: Map<string, R[]>; unassigned: R[] } {
  const byMessageId = new Map<string, R[]>();
  const unassigned: R[] = [];
  for (const review of reviews) {
    const requestedAt = Date.parse(review.requestedAt);
    let turnStart = -1;
    messages.forEach((message, index) => {
      if (message.role === "user" && Date.parse(message.createdAt) <= requestedAt) turnStart = index;
    });
    let replyId: string | null = null;
    for (let index = turnStart + 1; turnStart >= 0 && index < messages.length; index++) {
      if (messages[index]!.role === "user") break;
      if (messages[index]!.role === "assistant") replyId = messages[index]!.id;
    }
    if (replyId) byMessageId.set(replyId, [...(byMessageId.get(replyId) ?? []), review]);
    else unassigned.push(review);
  }
  return { byMessageId, unassigned };
}

/**
 * A delete review's main record and totals. The planner lists the selected rows first, their cascade
 * children after, and any side-effect updates before the deletes, while diffPreview stops at 50 rows:
 * so the total comes from affectedRows, not the preview length.
 */
export function summarizeDeleteReview<C extends { table: string; action: string }>(review: {
  affectedRows: number;
  diffPreview: ReadonlyArray<C>;
}) {
  const deleted = review.diffPreview.filter((change) => change.action === "delete");
  const parent = deleted[0];
  if (!parent) return null;
  const count = review.affectedRows - (review.diffPreview.length - deleted.length);
  const selected = deleted.filter((change) => change.table === parent.table);
  return { parent, selected, count, linkedCount: count - selected.length };
}

/**
 * R10: what a turn's reviews show, as keys: `review:<id>` and `<type>:<record id>` for every record in
 * their previews. See `withoutReviewedResults`.
 */
export function reviewRecordKeys(
  approvals: ReadonlyArray<{ id: string; diffPreview?: ReadonlyArray<{ table: string; id: string }> }>,
): Set<string> {
  const keys = new Set<string>();
  for (const approval of approvals) {
    keys.add(`review:${approval.id}`);
    for (const change of approval.diffPreview ?? []) keys.add(`${recordFaceResultType(change.table)}:${change.id}`);
  }
  return keys;
}

/**
 * R10: one row per record. An action result that a review in the same turn already shows (its own
 * review, or the same record) is dropped; the review row stands for both and carries the Undo.
 */
export function withoutReviewedResults<R extends { reviewId?: string; resource: { kind: string; id: string } }>(
  results: readonly R[],
  reviewed: ReadonlySet<string>,
): R[] {
  return results.filter(
    (result) =>
      !(result.reviewId && reviewed.has(`review:${result.reviewId}`)) &&
      !reviewed.has(`${resourceResultType(result.resource.kind)}:${result.resource.id}`),
  );
}
