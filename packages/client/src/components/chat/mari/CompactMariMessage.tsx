// One message in Mari's transcript, with its reply actions, referenced records and the outcome of her run.
import { type ReactNode, memo, useEffect, useState } from "react";
import { Check, Copy, ChevronRight, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BUILT_IN_AGENTS,
  type MariWorkspaceActionResult,
  type Message,
  type ProfessorMariAskContext,
  MARI_AUTHORIZATION_ACCEPT_CHIP,
} from "@marinara-engine/shared";
import { useChats } from "../../../hooks/use-chats";
import { type CharacterPreviewModel } from "../../../lib/character-preview";
import { type LorebookPreviewModel } from "../../../lib/lorebook-preview";
import { type MariStoryState } from "../../../lib/mari-work-animations";
import { splitMariAnswerWhy } from "../../../lib/mari-work-timeline";
import { MariContextFacetChips } from "../MariContextFacetChips";
import {
  professorMariContextFacets,
  stripProfessorMariSpeakerPrefix,
  withoutReviewedResults,
} from "../../../lib/professor-mari-presentation";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { MariChangeReceipt, type MariReceiptControls } from "../MariChangeReceipt";

import { TranscriptRow } from "../MariTranscriptRow";
import { cn, copyToClipboard } from "../../../lib/utils";
import {
  mariReferenceFact,
  mariReferenceTarget,
  type MariReferencedResource,
} from "../../../lib/mari-referenced-resources";
import { formatRelativeContact } from "../../../lib/relative-time";
import { getOmnibarSettingsDestinations } from "../../../lib/omnibar-settings";
import { useAgentConfigs } from "../../../hooks/use-agents";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { chatResultType, resourceResultType } from "../../../lib/command-icons";
import { MacroTextarea } from "../../ui/MacroTextarea";
import { MariList, MariRow } from "../mari-primitives";
import { useTranslation as useUiTranslation } from "react-i18next";
import { getProfessorMariAttachments, formatMariMessageTime } from "./mari-chat-helpers";
import {
  getMessageWorkspaceActionResults,
  getMessageWorkspaceTrace,
  timelineItemsFromTrace,
  getMessageRunError,
  getMessageRunTime,
} from "./mari-tool-presentation";
import {
  CompactMarkdown,
  MariFace,
  ProfessorMariAttachedFiles,
  buildMariReplyLinks,
  MariReasoningPanel,
} from "./MariReplyContent";
import { MariWorkTimeline, MariResourceSubject, MariAnswer } from "./MariWorkTimeline";

/**
 * The quick answer her question came from, under the user's question: "From Search · Quick answer",
 * three lines unless it is opened, and the docs pages it used. Read-only; it changes nothing.
 */
function QuickAnswerHandoff({
  handoff,
}: {
  handoff: NonNullable<NonNullable<ProfessorMariAskContext>["asideAnswer"]>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const long = handoff.answer.length > 160;
  return (
    <div
      data-component="HomeProfessorMariChat.QuickAnswerHandoff"
      // Capped like the question bubble: the one-line sources would otherwise widen it past the left edge.
      className="mt-1 flex max-w-[min(85%,36rem)] flex-col gap-1 self-end rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]"
    >
      <span className="font-semibold">{t("mari.handoff.quickAnswer", "From Search · Quick answer")}</span>
      <div className={cn("text-[var(--foreground)]", !expanded && long && "max-h-[4.5em] overflow-hidden")}>
        <CompactMarkdown content={handoff.answer} />
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start font-semibold underline-offset-2 hover:underline"
        >
          {expanded ? t("mari.handoff.showLess", "Show less") : t("mari.handoff.showAll", "Show all")}
        </button>
      ) : null}
      {handoff.sources?.length ? (
        <span className="truncate">
          {t("mari.handoff.sources", "From the docs")} · {handoff.sources.map((source) => source.heading).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

const MARI_MESSAGE_ACTIONS_CLASS =
  "mt-1 flex gap-1.5 opacity-100 transition-opacity [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100";
// UX-16: mari-message-action gives the 22px icon a 44px-high hit area on touch (mari.css).
const MARI_MESSAGE_ACTION_BUTTON_CLASS =
  "mari-message-action rounded p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]";

/** Copy, regenerate and delete under one of her replies: shown on hover with a mouse, always on touch. */
function MariReplyActions({
  content,
  onRegenerate,
  onDelete,
}: {
  content: string;
  onRegenerate?: () => void;
  onDelete?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copyLabel = localizeUi(copied ? "markdown.copied" : "markdown.copy");
  return (
    // Slice 71 (G7): -ml-1 cancels the buttons' padding, so the first icon sits on L0 under her words.
    <div className={cn(MARI_MESSAGE_ACTIONS_CLASS, "-ml-1")}>
      {content.trim() ? (
        <button
          type="button"
          onClick={() =>
            void copyToClipboard(content).then((ok) =>
              ok ? setCopied(true) : toast.error(localizeUi("markdown.copyFailed")),
            )
          }
          className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
          aria-label={copyLabel}
          title={copyLabel}
        >
          {copied ? <Check size="0.8rem" /> : <Copy size="0.8rem" />}
        </button>
      ) : null}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
          aria-label={localizeUi("ui.chat.chatmessage.regenerate")}
          title={localizeUi("ui.chat.chatmessage.regenerate")}
        >
          <RefreshCw size="0.8rem" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
          aria-label={localizeUi("lorebook.editor.batch.delete")}
          title={localizeUi("lorebook.editor.batch.delete")}
        >
          <Trash2 size="0.8rem" />
        </button>
      )}
    </div>
  );
}

/**
 * I3 / R10: something she made or changed, as a row of the outcome group: its face, its name (with "New"
 * when she made it), one fact in words ("Changed description", "New lorebook · 4 entries") and › to open.
 */
/**
 * What her answer is about, as rows of one group right under her words (R10): a face or type icon, the
 * name and one fact about that thing (never its type), and › to open it at once. The description is the
 * row's tooltip. `bare` returns the rows only, for a group the caller already draws (the arrival).
 */
export function MariReferencedResources({
  resources,
  characterPreviews,
  lorebookPreviews,
  onOpen,
  bare = false,
  skipName,
}: {
  resources: readonly MariReferencedResource[];
  characterPreviews: ReadonlyMap<string, CharacterPreviewModel>;
  lorebookPreviews: ReadonlyMap<string, LorebookPreviewModel>;
  onOpen: (resource: MariReferencedResource) => void;
  bare?: boolean;
  /** A name the line above already shows: its row stays only when it adds a fact. */
  skipName?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const hasAgents = resources.some((resource) => resource.kind === "agent");
  // The live config says whether an agent is on now; what she read may be older.
  const { data: agentConfigs } = useAgentConfigs(hasAgents);
  // A chat row shows its mode badge (Q6) and when it last moved; the list is usually cached already.
  const { data: chatList } = useChats({
    enabled: resources.some((resource) => resource.kind === "chat"),
    refetchOnMount: false,
  });
  const settings = getOmnibarSettingsDestinations();
  const rows = resources.flatMap((resource) => {
    // A row that cannot open anything (an entry without its lorebook, a renamed setting) is not shown.
    if (!mariReferenceTarget(resource, settings)) return [];
    const character = resource.kind === "character" ? characterPreviews.get(resource.id) : undefined;
    const lorebook = resource.kind === "lorebook" ? lorebookPreviews.get(resource.id) : undefined;
    const agent = resource.kind === "agent" ? agentConfigs?.find((row) => row.type === resource.id) : undefined;
    const builtInAgent = resource.kind === "agent" ? BUILT_IN_AGENTS.find((row) => row.id === resource.id) : undefined;
    const setting = resource.kind === "setting" ? settings.find((row) => row.id === resource.id) : undefined;
    const chat = resource.kind === "chat" ? chatList?.find((row) => row.id === resource.id) : undefined;
    const name =
      character?.name ??
      lorebook?.name ??
      agent?.name ??
      (setting ? localize(setting.title) : null) ??
      resource.name ??
      builtInAgent?.name;
    // A record she read that no longer exists (or never loaded) has nothing to show.
    if (!name) return [];
    const description =
      character?.summary ??
      character?.description ??
      lorebook?.description ??
      agent?.description ??
      (setting ? localize(setting.description) : undefined) ??
      resource.detail ??
      builtInAgent?.description;
    const agentState =
      resource.state === "failed"
        ? "failed"
        : agent
          ? agent.enabled === "true"
            ? "on"
            : "off"
          : (resource.state ?? null);
    const lastMoved = chat ? (chat.lastMessageAt ?? chat.updatedAt) : null;
    const people = (chat?.characterIds ?? []).flatMap((id) => {
      const person = characterPreviews.get(id);
      return person ? [{ name: person.name, src: person.avatarSrc, avatarCropStyle: person.avatarCropStyle }] : [];
    });
    const fact = mariReferenceFact(
      resource.kind,
      {
        description,
        agentState,
        entryCount: lorebook?.entryCount,
        lorebookName:
          lorebookPreviews.get(resource.parentId ?? "")?.name ??
          // The lorebook she read the entry from, when it is not loaded here.
          resources.find((other) => other.kind === "lorebook" && other.id === resource.parentId)?.name ??
          undefined,
        entryKey: resource.key,
        people: people
          .slice(0, 2)
          .map((person) => person.name)
          .join(", "),
        time: lastMoved ? formatRelativeContact(lastMoved) : null,
        section: setting ? localize(setting.sectionLabel) : undefined,
      },
      localizeUi,
    );
    return [
      {
        resource,
        key: `${resource.kind}:${resource.id}`,
        name,
        fact,
        description,
        failed: resource.state === "failed",
        // A chat shows who is in it (Q6 stacked faces), with its mode as the badge.
        faces: people,
        src: character?.avatarSrc ?? lorebook?.imageSrc ?? agent?.imagePath ?? people[0]?.src,
        avatarCropStyle: character?.avatarCropStyle ?? people[0]?.avatarCropStyle,
        type: resource.kind === "chat" ? chatResultType(chat?.mode) : resourceResultType(resource.kind),
      },
    ];
  });
  // Two records with the same name read as a glitch in a list; the first one stands for both. The
  // arrival does not repeat a name its line already shows unless the row adds a fact.
  const seenNames = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const nameKey = `${row.resource.kind}:${row.name.toLocaleLowerCase()}`;
    if (seenNames.has(nameKey)) return false;
    seenNames.add(nameKey);
    return !(skipName && row.name === skipName && !row.fact);
  });
  if (uniqueRows.length === 0) return null;
  const items = uniqueRows.map((row) => (
    <MariRow
      key={row.key}
      compact={!bare}
      slot={
        <ResultTypeIcon
          type={row.type}
          src={row.src}
          kind="avatar"
          avatarCropStyle={row.avatarCropStyle}
          faces={row.faces}
        />
      }
      title={row.name}
      fact={row.fact}
      hint={row.description}
      state={row.failed ? "failed" : undefined}
      trail="open"
      trailLabel={localizeUi("ui.chat.marisuggestionchips.actsNow")}
      onClick={() => onOpen(row.resource)}
    />
  ));
  if (bare) return <>{items}</>;
  return (
    <MariList cols={items.length > 1} data-cards="refs">
      {items}
    </MariList>
  );
}

/**
 * The reviews a turn holds, split by whether they already changed something or wait for your answer.
 * `records` names what they show (`review:<id>`, `<type>:<record id>`), so a turn draws one row per record.
 */
export type MariTurnReviews = {
  changed: ReactNode[];
  needsOk: ReactNode[];
  records: ReadonlySet<string>;
  /** Slice 74: Keep / Undo for the turn's change receipt. */
  receipt?: MariReceiptControls;
};

/**
 * M5a / R10: what a run needs from you and what it changed, as two groups after her answer. What needs
 * you comes first. The labels show only when both kinds are there; one kind needs no heading.
 */
/** Slice 71 (N7): what needs you comes first, each card on its own with its accent edge; what changed
 * follows as one quiet group, headed only when a card stands above it. */
function MariOutcomeGroup({
  changed,
  needsOk,
  receipt,
}: Pick<MariTurnReviews, "changed" | "needsOk"> & { receipt?: ReactNode }) {
  const { t: localizeUi } = useUiTranslation();
  if (changed.length === 0 && needsOk.length === 0 && !receipt) return null;
  const label = localizeUi("ui.chat.homeprofessormarichat.outcomeChanged");
  return (
    <div className="mari-list-stack" data-cards="outcome">
      {needsOk}
      {receipt}
      {changed.length > 0 ? (
        <MariList head={needsOk.length > 0 ? label : undefined} role="group" aria-label={label}>
          {changed}
        </MariList>
      ) : null}
    </div>
  );
}

/** Her reasons, folded to one "Why" line you can open (the server asks for at most three). */
function MariWhyDisclosure({ points }: { points: string[] }) {
  const { t: localizeUi } = useUiTranslation();
  if (points.length === 0) return null;
  return (
    <details className="mari-why">
      <summary className="mari-disclosure">
        {localizeUi("ui.chat.homeprofessormarichat.why")}
        <ChevronRight size="0.7rem" className="mari-disclosure__chevron shrink-0" aria-hidden="true" />
      </summary>
      <CompactMarkdown content={points.map((point) => `- ${point}`).join("\n")} />
    </details>
  );
}

/** What a finished run made, under her answer: reference cards, the outcome group, her reasons, then the
 * reply actions. Shared by the historic-turn render and the active turn's own timeline (M3) so the two
 * never diverge. */
export function MariWorkTimelineOutcome({
  content,
  actionResults,
  characterPreviews,
  lorebookPreviews,
  onOpenActionResult,
  onRegenerate,
  onDelete,
  reviews,
}: {
  content: string;
  actionResults: MariWorkspaceActionResult[];
  characterPreviews: ReadonlyMap<string, CharacterPreviewModel>;
  lorebookPreviews: ReadonlyMap<string, LorebookPreviewModel>;
  onOpenActionResult: (result: MariWorkspaceActionResult) => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  reviews?: MariTurnReviews;
}) {
  // Slice 72: no reference cards here - the names in her answer are the links; cards are for what changed
  // and what needs you.
  // R10: one row per record. A review of the same record that the receipt does not cover shows it instead.
  const receiptResults = withoutReviewedResults(actionResults, reviews?.records ?? new Set());
  const whyPoints = splitMariAnswerWhy(stripProfessorMariSpeakerPrefix(content)).why;
  // Slice 74: the receipt's Why is her reason, else her first Why point (which then leaves the list).
  const receiptWhy = receiptResults.some((result) => result.reason) ? undefined : whyPoints[0];
  const receiptName = (result: MariWorkspaceActionResult) =>
    (result.resource.kind === "character" ? characterPreviews.get(result.resource.id)?.name : undefined) ??
    (result.resource.kind === "lorebook" ? lorebookPreviews.get(result.resource.id)?.name : undefined) ??
    result.resource.label ??
    result.summary;
  return (
    <div className="mari-run-outcome">
      <MariOutcomeGroup
        changed={reviews?.changed ?? []}
        needsOk={reviews?.needsOk ?? []}
        receipt={
          receiptResults.length > 0 ? (
            <MariChangeReceipt
              results={receiptResults}
              fallbackWhy={receiptWhy}
              controls={reviews?.receipt}
              onOpen={onOpenActionResult}
              nameOf={receiptName}
              faceOf={(result) => {
                const character = characterPreviews.get(result.resource.id);
                const lorebook = result.resource.kind === "lorebook" ? lorebookPreviews.get(result.resource.id) : null;
                return (
                  <MariFace
                    type={resourceResultType(result.resource.kind)}
                    name={receiptName(result)}
                    src={character?.avatarSrc ?? lorebook?.imageSrc}
                    avatarCropStyle={character?.avatarCropStyle}
                  />
                );
              }}
            />
          ) : null
        }
      />
      {/* UX-26: one Why per turn. A change card carries it, so the fold only shows without a card. */}
      {receiptResults.length > 0 ? null : <MariWhyDisclosure points={whyPoints} />}
      <MariReplyActions
        content={stripProfessorMariSpeakerPrefix(content)}
        onRegenerate={onRegenerate}
        onDelete={onDelete}
      />
    </div>
  );
}

export const CompactMariMessage = memo(function CompactMariMessage({
  message,
  thinking,
  onDelete,
  onEdit,
  onEditAndResend,
  onRegenerate,
  canRegenerate = false,
  onRemoveAttachment,
  onOpenActionResult,
  onOpenResource,
  characterSubject,
  lorebookSubject,
  characterPreviews,
  lorebookPreviews,
  messageContext,
  restStory = null,
  pullTarget = true,
  reviews,
  goal = null,
  runStartedAtMs = null,
}: {
  message: Message;
  thinking?: string | null;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  /** Only on your latest message: save the edit and run Mari again from it, like Claude and Gemini. */
  onEditAndResend?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  canRegenerate?: boolean;
  onRemoveAttachment?: (messageId: string, attachmentIndex: number) => void;
  onOpenActionResult: (result: MariWorkspaceActionResult) => void;
  onOpenResource: (resource: MariReferencedResource) => void;
  characterSubject?: CharacterPreviewModel | null;
  lorebookSubject?: LorebookPreviewModel | null;
  characterPreviews: ReadonlyMap<string, CharacterPreviewModel>;
  lorebookPreviews: ReadonlyMap<string, LorebookPreviewModel>;
  /** What was sent with this message, so its chip (C2) survives the send. */
  messageContext?: ProfessorMariAskContext | null;
  /** Only on the newest finished turn: the story Mari plays on its "Worked for" line. */
  restStory?: MariStoryState | null;
  /** D1: suppressed while an appended arrival at the bottom of the transcript owns the marker instead. */
  pullTarget?: boolean;
  /** The reviews this turn holds, in its outcome group before the "Worked for" line. */
  reviews?: MariTurnReviews;
  /** M5a: the request she reported acting on, as the turn's first line. */
  goal?: ReactNode;
  /** R14 (item 7): when you sent the message this reply answers, so "Worked for" counts from there. */
  runStartedAtMs?: number | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const content = message.content ?? "";
  const attachments = getProfessorMariAttachments(message);
  const actionResults = getMessageWorkspaceActionResults(message);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const messageTime = formatMariMessageTime(message.createdAt);

  // UX-15: Accept is a card action, not something you said; the receipt card that follows is its record.
  if (message.role === "user" && content.trim() === MARI_AUTHORIZATION_ACCEPT_CHIP.prompt) return null;
  if (message.role === "user") {
    // Your side is a plain bubble on the right, like Claude and Gemini: no avatar and no name label.
    return (
      <TranscriptRow layout="document" className="mari-user-request group" marker={null}>
        {isEditing ? (
          <div className="mt-1 w-full">
            <MacroTextarea
              value={editContent}
              onChange={setEditContent}
              rows={8}
              title={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
              ariaLabel={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
              showMacroReference={false}
              showMarkdownPreview={false}
              className="w-full"
            />
            <div className="mt-1 flex justify-end gap-2">
              {onEditAndResend ? (
                <button
                  type="button"
                  disabled={!editContent.trim()}
                  onClick={() => {
                    onEditAndResend(message.id, editContent);
                    setIsEditing(false);
                  }}
                  className="rounded bg-[var(--primary)] px-2 py-1 text-xs text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {localizeUi("ui.chat.homeprofessormarichat.saveAndSend")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={!editContent.trim()}
                onClick={() => {
                  onEdit?.(message.id, editContent);
                  setIsEditing(false);
                }}
                className={cn(
                  "rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50",
                  onEditAndResend
                    ? "text-[var(--foreground)] hover:bg-[var(--accent)]"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)]",
                )}
              >
                {localizeUi("ui.noodle.noodlehome.save")}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                {localizeUi("ui.chat.homeprofessormarichat.cancelSelection")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mari-user-request__bubble" title={messageTime ?? undefined}>
            <CompactMarkdown content={content} />
          </div>
        )}
        {messageContext?.asideAnswer?.answer ? <QuickAnswerHandoff handoff={messageContext.asideAnswer} /> : null}
        <MariContextFacetChips
          facets={professorMariContextFacets(messageContext).filter((facet) => facet.kind !== "asideAnswer")}
          className="mt-1 justify-end"
        />
        <ProfessorMariAttachedFiles
          attachments={attachments}
          onRemove={onRemoveAttachment ? (index) => onRemoveAttachment(message.id, index) : undefined}
        />
        {/* M3: the row's own existence (not just its buttons) is reserved regardless of busy state -
          onEdit/onDelete only go from disabled to enabled, so this row never pops in and pushes the
          timeline below it down the instant a run finishes. */}
        <div className={MARI_MESSAGE_ACTIONS_CLASS}>
          <button
            type="button"
            onClick={() => {
              if (!onEdit) return;
              setEditContent(content);
              setIsEditing(true);
            }}
            disabled={!onEdit}
            className={cn(MARI_MESSAGE_ACTION_BUTTON_CLASS, "disabled:cursor-not-allowed disabled:opacity-40")}
            aria-label={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
            title={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
          >
            <Pencil size="0.8rem" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(message.id)}
            disabled={!onDelete}
            className={cn(MARI_MESSAGE_ACTION_BUTTON_CLASS, "disabled:cursor-not-allowed disabled:opacity-40")}
            aria-label={localizeUi("ui.chat.homeprofessormarichat.deleteMessage")}
            title={localizeUi("ui.chat.homeprofessormarichat.deleteMessage")}
          >
            <Trash2 size="0.8rem" />
          </button>
        </div>
      </TranscriptRow>
    );
  }

  const workspaceTrace = getMessageWorkspaceTrace(message);
  if (workspaceTrace) {
    const traceItems = timelineItemsFromTrace(workspaceTrace, message);
    return (
      <div className="group">
        <MariWorkTimeline
          items={traceItems}
          character={characterSubject}
          lorebook={lorebookSubject}
          active={false}
          restStory={restStory}
          pullTarget={pullTarget}
          goal={goal}
          runFailed={Boolean(getMessageRunError(message, { includeDismissed: true }))}
          // ponytail: a retry that reused your saved message counts from your first send; a per-attempt
          // start would need the server to stamp each run. Add it if long retries make this misleading.
          startedAtMs={runStartedAtMs}
          endedAtMs={getMessageRunTime(message, "mariRunFinishedAt") || Date.parse(message.createdAt) || null}
          characterPreviews={characterPreviews}
          lorebookPreviews={lorebookPreviews}
          actionResults={actionResults}
          onOpenResource={onOpenResource}
          held={typeof message.extra === "object" && message.extra?.mariDeferredMutations === true}
        >
          <MariWorkTimelineOutcome
            content={content}
            actionResults={actionResults}
            characterPreviews={characterPreviews}
            lorebookPreviews={lorebookPreviews}
            onOpenActionResult={onOpenActionResult}
            onRegenerate={onRegenerate && canRegenerate ? () => onRegenerate(message.id) : undefined}
            onDelete={onDelete ? () => onDelete(message.id) : undefined}
            reviews={reviews}
          />
        </MariWorkTimeline>
      </div>
    );
  }

  return (
    <>
      <TranscriptRow layout="document" className="group" marker={null}>
        <MariResourceSubject character={characterSubject} lorebook={lorebookSubject} className="mb-2" />
        {goal}
        <MariAnswer restStory={restStory} pullTarget={pullTarget}>
          <CompactMarkdown
            content={splitMariAnswerWhy(stripProfessorMariSpeakerPrefix(content)).answer}
            links={buildMariReplyLinks(content, [], actionResults, characterPreviews, lorebookPreviews)}
            onOpenLink={onOpenResource}
          />
          <MariWorkTimelineOutcome
            content={content}
            actionResults={actionResults}
            characterPreviews={characterPreviews}
            lorebookPreviews={lorebookPreviews}
            onOpenActionResult={onOpenActionResult}
            onRegenerate={onRegenerate && canRegenerate ? () => onRegenerate(message.id) : undefined}
            onDelete={onDelete ? () => onDelete(message.id) : undefined}
            reviews={reviews}
          />
        </MariAnswer>
      </TranscriptRow>
      {thinking && (
        <TranscriptRow layout="document" marker={null}>
          <MariReasoningPanel thinking={thinking} />
        </TranscriptRow>
      )}
    </>
  );
});
