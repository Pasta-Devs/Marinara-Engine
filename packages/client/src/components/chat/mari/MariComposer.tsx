import {
  MariWorkspaceStatus,
  MariSuggestionChip,
  ProfessorMariAskContext,
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_PERMISSIONS_MODE_LABELS,
  MARI_PERMISSIONS_MODES,
  type MariPendingMessageSummary,
} from "@marinara-engine/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  LucideIcon,
  ArrowDown,
  Sparkles,
  X,
  Link,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUp,
  Clock,
  Square,
  RotateCcw,
} from "lucide-react";
import type { MariComposerReference, MariPermissionsMode, Message } from "@marinara-engine/shared";
import {
  RefObject,
  Dispatch,
  SetStateAction,
  ChangeEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { ProfessorMariContextFacet } from "../../../lib/professor-mari-presentation";
import { RESULT_TYPE_ICONS, resourceResultType } from "../../../lib/command-icons";
import {
  activeToken,
  composerKeyAction,
  pastedFiles,
  type ComposerMark,
  type ComposerPickerAction,
} from "../../../lib/composer-triggers";
import type { MariCommandId } from "../../../lib/mari-commands";
import { cn } from "../../../lib/utils";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { useUIStore } from "../../../stores/ui.store";
import { InlineDraftOverlay } from "../../ui/InlineDraftOverlay";
import { ConnectionModelPicker } from "../../connections/ConnectionModelPicker";
import { MariRow } from "../mari-primitives";
import { MariPendingQueue } from "./MariPendingQueue";
import { MariConnectionGuidance } from "./MariConnectionGuidance";
import { MariAttachButton } from "../MariAttachButton";
import { MariContextFacetChips } from "../MariContextFacetChips";
import { MariSuggestionChips } from "../MariSuggestionChips";
import {
  ProfessorMariAttachment,
  ProfessorMariConnectionOption,
  ProfessorMariRecovery,
  PROFESSOR_MARI_ATTACHMENT_ACCEPT,
  MARI_PERMISSIONS_MODE_ICONS,
  MARI_PERMISSIONS_MODE_FACT_KEYS,
} from "./mari-chat-helpers";
import { MariReferencePicker, type MariReferencePickerProps } from "./MariReferencePicker";
import { MariRuntimeRecovery } from "./MariRuntimeRecovery";
import { CompactMarkdown, ProfessorMariAttachmentPreviews } from "./MariReplyContent";
import { useInDialogFocusScope } from "../../../hooks/use-in-dialog-focus-scope";

/** R11 (composer v5): her composer dock: the question strip, context chips, the field, attach, connection and mode menus, and Send/Stop. */
type MariComposerProps = {
  workspaceStatus: MariWorkspaceStatus | null;
  refreshWorkspaceStatus: () => Promise<MariWorkspaceStatus>;
  acceptDraftCompletion: () => void;
  attachComposerDock: (dock: HTMLFormElement | null) => (() => void) | undefined;
  attachedContext: MariWorkspaceContextItem[] | undefined;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  attachments: ProfessorMariAttachment[];
  canSubmitMessage: boolean;
  chipRowChips: MariSuggestionChip[];
  composerContextFacets: ProfessorMariContextFacet[];
  composerScroll: { left: number; top: number };
  connectionButtonRef: RefObject<HTMLButtonElement | null>;
  connectionMenuOpen: boolean;
  connectionMenuRef: RefObject<HTMLDivElement | null>;
  connectionOptions: ProfessorMariConnectionOption[];
  draft: string;
  draftSuffix: string;
  effectiveConnection: ProfessorMariConnectionOption;
  effectiveConnectionId: string;
  enterToSend: boolean;
  floatingTextareaRef: RefObject<HTMLTextAreaElement | null>;
  handleAttachmentUpload: (files: FileList | readonly File[] | null) => Promise<void>;
  handleConnectionChange: (id: string) => void;
  handleOpenContextViewer: () => Promise<void>;
  handleOpenHistoryPicker: () => Promise<void>;
  handleSubmit: (
    overrideText?: string,
    overrideRecovery?: Pick<
      ProfessorMariRecovery,
      "attachments" | "context" | "localMessageId" | "references" | "pendingMessageId"
    > & {
      reuseSavedMessage?: boolean;
    },
    overrideContext?: ProfessorMariAskContext | null,
    queueLater?: boolean,
  ) => Promise<void>;
  handleSuggestionSelect: (chip: MariSuggestionChip, draft?: boolean, context?: ProfessorMariAskContext) => void;
  isBusy: boolean;
  pendingMessages: MariPendingMessageSummary[];
  onRemovePendingMessage: (id: string) => void;
  onSendPendingNow: (id: string) => void;
  onSendHeldMessage: (message: MariPendingMessageSummary) => void;
  isReadingAttachments: boolean;
  jumpToLatest: () => void;
  messages: Message[];
  mobileFocusMode: boolean;
  omnibarMode: boolean;
  onConnectionMenuKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPermissionsMenuKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  oneShotContext: ProfessorMariAskContext | null;
  permissionsButtonRef: RefObject<HTMLButtonElement | null>;
  permissionsMenuOpen: boolean;
  permissionsMenuRef: RefObject<HTMLDivElement | null>;
  permissionsMode: MariPermissionsMode;
  permissionsModeDefault: MariPermissionsMode;
  permissionsModeOverridden: boolean;
  changePermissionsMode: (mode: MariPermissionsMode | null) => Promise<void>;
  reduceMotion: boolean | null;
  removeOneShotFacet: (facet: ProfessorMariContextFacet) => void;
  setAttachments: Dispatch<SetStateAction<ProfessorMariAttachment[]>>;
  setComposerScroll: Dispatch<SetStateAction<{ left: number; top: number }>>;
  setConnectionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setDraft: (next: string | ((current: string) => string)) => void;
  setHandoffContext: Dispatch<SetStateAction<ProfessorMariAskContext | null>>;
  setPermissionsMenuOpen: Dispatch<SetStateAction<boolean>>;
  showJumpToLatest: boolean;
  showNextStepCards: boolean;
  showSuggestionPrompt: boolean;
  sidecarNativeToolCalls: boolean;
  stopWorkspace: () => Promise<void>;
  suggestionQuestion: string | null;
  workspaceTimelineActive: boolean;
  /** The `@` / `/` picker owns Arrow, Enter, Tab and Escape while it is open. */
  pickerOpen?: boolean;
  onPickerAction?: (action: ComposerPickerAction) => void;
  onActiveTokenChange?: (token: ReturnType<typeof activeToken>) => void;
  /** The commands the `/` picker and the paperclip menu offer, how to run one, and the counts shown beside some. */
  availableCommands?: readonly MariCommandId[];
  onCommand?: (id: MariCommandId) => void;
  commandCounts?: Partial<Record<MariCommandId, number>>;
  /** Resolved `@` references to mark in the draft. */
  referenceMarks?: ComposerMark[];
  /** The `@` picker's rows, its highlighted option, and the references picked so far (shown as chips). */
  referenceUi?: {
    picker: MariReferencePickerProps | null;
    activeOptionId?: string;
    canDrillIn: boolean;
    canDrillOut: boolean;
    /** A name just completed with Tab ends the draft: Tab again links it. */
    canLinkCompletion?: boolean;
    /** Where the caret goes after a pick; `n` makes the same position a new request. */
    caretRequest: { pos: number; n: number } | null;
    references: readonly MariComposerReference[];
    onRemove: (reference: MariComposerReference) => void;
  };
};

/** The link hint names the input the device has: Tab, a tap, or both. */
function linkHintKey() {
  if (window.matchMedia("(pointer: coarse)").matches) return "mari.composerReferences.linkHintTouch";
  // A touch laptop reports a fine pointer but can still be tapped, so it gets both words.
  if (window.matchMedia("(any-pointer: coarse)").matches) return "mari.composerReferences.linkHintHybrid";
  return "mari.composerReferences.linkHint";
}

export function MariComposer({
  workspaceStatus,
  refreshWorkspaceStatus,
  acceptDraftCompletion,
  attachComposerDock,
  attachedContext,
  attachmentInputRef,
  attachments,
  canSubmitMessage,
  chipRowChips,
  composerContextFacets,
  composerScroll,
  connectionButtonRef,
  connectionMenuOpen,
  connectionMenuRef,
  connectionOptions,
  draft,
  draftSuffix,
  referenceMarks = [],
  effectiveConnection,
  effectiveConnectionId,
  enterToSend,
  floatingTextareaRef,
  handleAttachmentUpload,
  handleConnectionChange,
  handleOpenContextViewer,
  handleOpenHistoryPicker,
  handleSubmit,
  handleSuggestionSelect,
  isBusy,
  pendingMessages,
  onRemovePendingMessage,
  onSendPendingNow,
  onSendHeldMessage,
  isReadingAttachments,
  jumpToLatest,
  messages,
  mobileFocusMode,
  omnibarMode,
  onConnectionMenuKeyDown,
  onPermissionsMenuKeyDown,
  oneShotContext,
  permissionsButtonRef,
  permissionsMenuOpen,
  permissionsMenuRef,
  permissionsMode,
  permissionsModeDefault,
  permissionsModeOverridden,
  changePermissionsMode,
  reduceMotion,
  removeOneShotFacet,
  setAttachments,
  setComposerScroll,
  setConnectionMenuOpen,
  setDraft,
  setHandoffContext,
  setPermissionsMenuOpen,
  showJumpToLatest,
  showNextStepCards,
  showSuggestionPrompt,
  sidecarNativeToolCalls,
  stopWorkspace,
  suggestionQuestion,
  workspaceTimelineActive,
  pickerOpen = false,
  onPickerAction,
  onActiveTokenChange,
  referenceUi,
  availableCommands = [],
  onCommand,
  commandCounts,
}: MariComposerProps) {
  const localize = useLocalizedUiText();
  const { t: localizeUi } = useTranslation();
  const { t } = useTranslation();
  // Send's small menu, for phones and anyone who hasn't learned the keys. It only exists while she works.
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement | null>(null);
  const sendMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const sendMenuVisible = sendMenuOpen && workspaceTimelineActive && canSubmitMessage;
  // Inside the omnibar, Escape closes this menu and not the dialog behind it.
  const handleSendMenuKeyDown = useInDialogFocusScope(
    sendMenuPopoverRef,
    () => setSendMenuOpen(false),
    sendMenuVisible,
  );
  useEffect(() => {
    if (!sendMenuVisible) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!sendMenuRef.current?.contains(event.target as Node)) setSendMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sendMenuVisible]);
  // Where the caret sits in the draft, so a live `@` / `/` token can be found.
  const [caret, setCaret] = useState(draft.length);
  const liveToken = activeToken(draft, Math.min(caret, draft.length));
  const liveTokenKey = liveToken ? `${liveToken.trigger}:${liveToken.start}:${liveToken.end}:${liveToken.query}` : "";
  // Report only when the token itself changes; the ref keeps the latest callback without re-firing on each render.
  const tokenChangeRef = useRef(onActiveTokenChange);
  tokenChangeRef.current = onActiveTokenChange;
  const liveTokenRef = useRef(liveToken);
  liveTokenRef.current = liveToken;
  useEffect(() => {
    tokenChangeRef.current?.(liveTokenRef.current);
  }, [liveTokenKey]);
  const trackCaret = (element: HTMLTextAreaElement) => setCaret(element.selectionStart ?? element.value.length);
  // A pick rewrites the draft: put the caret after the new token before the next paint.
  const caretRequest = referenceUi?.caretRequest ?? null;
  useLayoutEffect(() => {
    const textarea = floatingTextareaRef.current;
    if (!caretRequest || !textarea) return;
    textarea.setSelectionRange(caretRequest.pos, caretRequest.pos);
    setCaret(caretRequest.pos);
  }, [caretRequest, floatingTextareaRef]);
  // The paperclip's "Link with @" types the trigger at the caret, which opens the picker.
  const [atRequest, setAtRequest] = useState<{ pos: number; n: number } | null>(null);
  const linkWithAt = () => {
    const at = Math.min(caret, draft.length);
    const before = draft.slice(0, at);
    const lead = before === "" || /\s$/.test(before) ? "" : " ";
    setDraft(`${before}${lead}@${draft.slice(at)}`);
    setAtRequest((current) => ({ pos: at + lead.length + 1, n: (current?.n ?? 0) + 1 }));
  };
  useLayoutEffect(() => {
    const textarea = floatingTextareaRef.current;
    if (!atRequest || !textarea) return;
    textarea.focus();
    textarea.setSelectionRange(atRequest.pos, atRequest.pos);
    setCaret(atRequest.pos);
  }, [atRequest, floatingTextareaRef]);
  // The ghost may sit in an `@` token that ends the draft (a Tab there links it); the open picker replaces it.
  const ghostInToken = liveToken?.trigger === "@" && liveToken.end === draft.length;
  const ghostAvailable = Boolean(draftSuffix) && (!liveToken || ghostInToken);
  // A completed name ends the draft and a second Tab would link it: say so where the ghost was, and let a
  // tap link it, since touch screens have no Tab.
  const linkHint = Boolean(referenceUi?.canLinkCompletion) && !ghostAvailable && !pickerOpen;
  const linkHintText = linkHint ? t(linkHintKey()) : "";
  const ActivePermissionsModeIcon = MARI_PERMISSIONS_MODE_ICONS[permissionsMode];
  // The connection menu shows the chosen connection's models beside the list, like the chat input's
  // Connections menu. A narrow composer shows one step at a time: the list, then the chosen models.
  const [shownConnectionId, setShownConnectionId] = useState<string | null>(null);
  // Narrow only: the row's arrow opens the models step; tapping the row itself just switches.
  const [modelsStep, setModelsStep] = useState(false);
  const modelsConnection = connectionOptions.find(
    (connection) => connection.id === (shownConnectionId ?? effectiveConnectionId),
  );
  // R11 (composer v5): one-line facts; the full description stays in the row's tooltip and in Settings.
  const renderPermissionsModeRow = ({
    key,
    Icon,
    mode,
    label,
    fact,
    description,
    selected,
    onSelect,
  }: {
    key: string;
    Icon: LucideIcon;
    mode?: MariPermissionsMode;
    label: string;
    fact: string;
    description: string;
    selected: boolean;
    onSelect: () => void;
  }) => (
    <MariRow
      key={key}
      slot={<Icon aria-hidden="true" />}
      title={label}
      fact={fact}
      hint={description}
      trail={selected ? <Check aria-hidden="true" /> : undefined}
      state={selected ? "selected" : undefined}
      onClick={onSelect}
      aria-pressed={selected}
      data-mode={mode}
    />
  );
  const permissionsModeOptions = (
    <>
      <p className="mari-composer-menu__head">
        {localizeUi("ui.chat.homeprofessormarichat.permissionsModeForThisChat")}
      </p>
      {renderPermissionsModeRow({
        key: "default",
        Icon: RotateCcw,
        label: localizeUi("ui.chat.homeprofessormarichat.useDefaultMode", {
          value1: localize(MARI_PERMISSIONS_MODE_LABELS[permissionsModeDefault].label),
        }),
        fact: localizeUi("ui.chat.homeprofessormarichat.modeFact.default"),
        description: localizeUi("ui.chat.homeprofessormarichat.followsTheGlobalDefaultFromSettings"),
        selected: !permissionsModeOverridden,
        onSelect: () => void changePermissionsMode(null),
      })}
      <hr className="mari-composer-menu__divider" />
      {MARI_PERMISSIONS_MODES.map((mode) =>
        renderPermissionsModeRow({
          key: mode,
          Icon: MARI_PERMISSIONS_MODE_ICONS[mode],
          mode,
          label: localize(MARI_PERMISSIONS_MODE_LABELS[mode].label),
          fact: localizeUi(MARI_PERMISSIONS_MODE_FACT_KEYS[mode]),
          description: localize(MARI_PERMISSIONS_MODE_LABELS[mode].description),
          selected: permissionsModeOverridden && mode === permissionsMode,
          onSelect: () => void changePermissionsMode(mode),
        }),
      )}
    </>
  );
  return (
    <form
      ref={attachComposerDock}
      className={cn(
        "px-2.5 py-2.5",
        omnibarMode && "mari-workspace-composer-dock absolute inset-x-0 bottom-0 z-10 px-3 py-3 sm:px-7",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <MariRuntimeRecovery status={workspaceStatus} busy={isBusy} refreshStatus={refreshWorkspaceStatus} />
      <AnimatePresence>
        {showJumpToLatest ? (
          <motion.button
            key="jump-to-latest"
            type="button"
            onClick={jumpToLatest}
            className="mari-jump-to-latest"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            aria-label={localizeUi("ui.chat.homeprofessormarichat.jumpToLatest")}
            title={localizeUi("ui.chat.homeprofessormarichat.jumpToLatest")}
          >
            <ArrowDown size="1rem" aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>
      {showSuggestionPrompt && !showNextStepCards && suggestionQuestion && (!omnibarMode || messages.length > 0) ? (
        <div className="mari-workspace-question-dock mb-2">
          {!omnibarMode ? (
            <div className="mari-workspace-question-dock__prompt">
              <Sparkles size="0.875rem" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <CompactMarkdown content={suggestionQuestion} />
              </div>
            </div>
          ) : null}
          <div className="mari-workspace-answer-strip">
            <MariSuggestionChips
              chips={chipRowChips}
              // N4 covers the next-step cards; the starter and plan/approval chips still draft.
              onSelect={(chip) => handleSuggestionSelect(chip, true)}
              disabled={isBusy}
            />
          </div>
        </div>
      ) : null}
      <input
        ref={attachmentInputRef}
        type="file"
        accept={PROFESSOR_MARI_ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void handleAttachmentUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <MariPendingQueue
        messages={pendingMessages}
        running={workspaceTimelineActive}
        onRemove={onRemovePendingMessage}
        onSend={onSendHeldMessage}
        onSendNow={onSendPendingNow}
      />
      {/* R11 (composer v5): Mari's own shell, not the regular chat input's: neutral at rest, a primary
                              ring only on focus, quiet controls and one neutral filled Send. */}
      <div className="mari-workspace-composer outline-none" tabIndex={-1}>
        {pickerOpen && referenceUi?.picker ? <MariReferencePicker {...referenceUi.picker} /> : null}
        {attachments.length > 0 ||
        isReadingAttachments ||
        composerContextFacets.length > 0 ||
        oneShotContext?.query ||
        (referenceUi?.references.length ?? 0) > 0 ? (
          <div className="mari-workspace-composer__context">
            <ProfessorMariAttachmentPreviews
              attachments={attachments}
              isReading={isReadingAttachments}
              onRemove={(index) => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            />
            {composerContextFacets.length > 0 ? (
              <MariContextFacetChips
                facets={composerContextFacets}
                onRemove={removeOneShotFacet}
                className="contents"
              />
            ) : oneShotContext?.query ? (
              <span className="mari-workspace-context-chip">
                <Sparkles aria-hidden="true" />
                <span className="min-w-0 truncate">
                  {localizeUi("ui.chat.homeprofessormarichat.searchContextValue1", {
                    value1: oneShotContext.query,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setHandoffContext(null)}
                  className="mari-workspace-context-chip__remove"
                  aria-label={localizeUi("ui.chat.homeprofessormarichat.contextControlRemoveFocus")}
                >
                  <X size="0.625rem" aria-hidden="true" />
                </button>
              </span>
            ) : null}
            {referenceUi?.references.map((reference) => {
              const Icon = RESULT_TYPE_ICONS[resourceResultType(reference.kind)];
              return (
                <span key={`${reference.kind}:${reference.id}`} className="mari-workspace-context-chip" data-reference>
                  <Icon aria-hidden="true" />
                  <span className="min-w-0 truncate">{reference.label}</span>
                  <button
                    type="button"
                    onClick={() => referenceUi.onRemove(reference)}
                    className="mari-workspace-context-chip__remove"
                    aria-label={t("mari.composerReferences.remove", { name: reference.label })}
                    title={t("mari.composerReferences.remove", { name: reference.label })}
                  >
                    <X size="0.625rem" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="relative flex min-w-0 flex-1 basis-full">
          <InlineDraftOverlay
            value={draft}
            suffix={linkHintText || (ghostAvailable && !pickerOpen ? draftSuffix : "")}
            hint={linkHint}
            marks={[
              ...referenceMarks,
              ...(liveToken ? [{ start: liveToken.start, end: liveToken.end, tone: "pending" as const }] : []),
            ]}
            multiline
            scrollLeft={composerScroll.left}
            scrollTop={composerScroll.top}
            className="mari-workspace-composer__text"
            onAccept={ghostInToken || linkHint ? () => onPickerAction?.("ghost-link") : acceptDraftCompletion}
          />
          <textarea
            ref={floatingTextareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              trackCaret(event.currentTarget);
              if (mobileFocusMode) event.currentTarget.scrollIntoView({ block: "end" });
            }}
            onScroll={(event) => {
              const { scrollLeft, scrollTop } = event.currentTarget;
              // Display scaling leaves a fraction of a pixel to scroll even on one line: that must not fade the text.
              event.currentTarget.toggleAttribute("data-scrolled", scrollTop >= 1);
              setComposerScroll({ left: scrollLeft, top: scrollTop });
            }}
            onPaste={(event) => {
              const files = pastedFiles(event.clipboardData);
              if (files.length === 0) return;
              event.preventDefault();
              void handleAttachmentUpload(files);
            }}
            onSelect={(event) => trackCaret(event.currentTarget)}
            onKeyUp={(event) => trackCaret(event.currentTarget)}
            onClick={(event) => trackCaret(event.currentTarget)}
            onKeyDown={(event) => {
              const action = composerKeyAction({
                key: event.key,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                isComposing: event.nativeEvent.isComposing,
                pickerOpen,
                hasGhost: ghostAvailable,
                inReferenceToken: ghostInToken,
                canDrillIn: referenceUi?.canDrillIn,
                canDrillOut: referenceUi?.canDrillOut,
                canLinkCompletion: referenceUi?.canLinkCompletion,
                enterToSend,
              });
              if (action === "none") return;
              event.preventDefault();
              if (action === "ghost-accept") acceptDraftCompletion();
              else if (action === "send") void handleSubmit();
              else if (action === "queue") void handleSubmit(undefined, undefined, undefined, true);
              else {
                // In companion mode the first Escape closes only the picker, not the omnibar behind it.
                if (action === "picker-close") event.stopPropagation();
                onPickerAction?.(action);
              }
            }}
            // The overlay is hidden from screen readers, so the field itself carries the hint.
            aria-description={linkHintText || undefined}
            aria-controls={pickerOpen ? referenceUi?.picker?.id : undefined}
            aria-activedescendant={pickerOpen ? referenceUi?.activeOptionId : undefined}
            rows={1}
            placeholder={t("home.professorMari.placeholder")}
            className="mari-workspace-composer__text mari-workspace-composer__input"
          />
        </div>
        {/* Under the text, like Claude's: attach, the connection and the Permissions Mode. */}
        <div className="mari-composer-toolbar">
          <div className="mari-workspace-composer__attach mari-composer-menu">
            <MariAttachButton
              onAttachFiles={() => attachmentInputRef.current?.click()}
              onAddChatHistory={() => void handleOpenHistoryPicker()}
              onViewContext={() => void handleOpenContextViewer()}
              onLinkWithAt={linkWithAt}
              onCommand={(id) => onCommand?.(id)}
              availableCommands={availableCommands}
              commandCounts={commandCounts}
              attachedFileCount={attachments.length}
              attachedContextCount={attachedContext?.length ?? 0}
              disabled={isReadingAttachments}
              isReading={isReadingAttachments}
            />
          </div>

          <div className="mari-composer-menu mari-composer-menu--connection">
            <button
              ref={connectionButtonRef}
              type="button"
              onClick={() => {
                setPermissionsMenuOpen(false);
                setShownConnectionId(null);
                setModelsStep(false);
                setConnectionMenuOpen((current) => !current);
              }}
              disabled={isBusy}
              className={cn(
                "mari-composer-menu__trigger mari-workspace-composer__connection",
                !effectiveConnection && "mari-workspace-composer__connection--missing",
              )}
              aria-expanded={connectionMenuOpen}
              aria-label={
                effectiveConnection?.name
                  ? localizeUi("ui.chat.homeprofessormarichat.connectionValue1", {
                      value1: effectiveConnection.name,
                    })
                  : localizeUi("ui.chat.homeprofessormarichat.selectConnection")
              }
              title={
                effectiveConnection?.name
                  ? localizeUi("ui.chat.homeprofessormarichat.connectionValue1", {
                      value1: effectiveConnection.name,
                    })
                  : localizeUi("ui.chat.homeprofessormarichat.selectConnection")
              }
            >
              <Link aria-hidden="true" />
              <span>
                {effectiveConnection
                  ? effectiveConnection.name || effectiveConnection.id
                  : localizeUi("ui.chat.homeprofessormarichat.selectConnection")}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
            {connectionMenuOpen && (
              <div
                ref={connectionMenuRef}
                className="mari-composer-menu__popover mari-connection-picker"
                data-step={modelsStep ? "models" : "list"}
                onKeyDown={(event) => {
                  // Enter in the model search must not send the message: the menu sits inside the composer form.
                  if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
                  onConnectionMenuKeyDown(event);
                }}
              >
                <div className="mari-connection-picker__list">
                  <p className="mari-composer-menu__head">{localizeUi("navigation.topbar.connections")}</p>
                  {connectionOptions.length > 0 ? (
                    connectionOptions.map((connection) => {
                      const isActive = effectiveConnectionId === connection.id;
                      return (
                        <MariRow
                          key={connection.id}
                          slot={<Link aria-hidden="true" />}
                          title={connection.name || connection.id}
                          fact={
                            connection.id === LOCAL_SIDECAR_CONNECTION_ID
                              ? sidecarNativeToolCalls
                                ? localizeUi("ui.chat.homeprofessormarichat.nativeTools")
                                : localizeUi("ui.chat.homeprofessormarichat.toolsOff")
                              : [connection.provider, connection.model].filter(Boolean).join(" · ")
                          }
                          trail={isActive ? <Check aria-hidden="true" /> : undefined}
                          state={isActive ? "selected" : undefined}
                          onClick={() => {
                            if (!isActive) handleConnectionChange(connection.id);
                            setShownConnectionId(connection.id);
                            // Choosing is the last step when no models show beside the list: a narrow composer
                            // (its arrow opens them), or the local model, which has no list to pick from.
                            const modelsShown = connectionMenuRef.current
                              ?.querySelector(".mari-connection-picker__models")
                              ?.getClientRects().length;
                            if (connection.id === LOCAL_SIDECAR_CONNECTION_ID || !modelsShown) {
                              setConnectionMenuOpen(false);
                              connectionButtonRef.current?.focus();
                            }
                          }}
                          action={
                            connection.id !== LOCAL_SIDECAR_CONNECTION_ID ? (
                              <button
                                type="button"
                                className="mari-connection-picker__open"
                                onClick={() => {
                                  setShownConnectionId(connection.id);
                                  setModelsStep(true);
                                }}
                                aria-label={localizeUi("connections.modelPicker.showModels", {
                                  connection: connection.name || connection.id,
                                })}
                                title={localizeUi("connections.modelPicker.showModels", {
                                  connection: connection.name || connection.id,
                                })}
                              >
                                <ChevronRight aria-hidden="true" />
                              </button>
                            ) : undefined
                          }
                        />
                      );
                    })
                  ) : (
                    <MariRow
                      slot={<Plus aria-hidden="true" />}
                      title={localizeUi("ui.chat.homeprofessormarichat.addAConnection")}
                      onClick={() => {
                        setConnectionMenuOpen(false);
                        useUIStore.getState().openModal("create-connection");
                      }}
                    />
                  )}
                  <div className="px-3 py-2">
                    <MariConnectionGuidance />
                  </div>
                </div>
                {modelsConnection && (
                  <div className="mari-connection-picker__models">
                    {modelsConnection.id !== LOCAL_SIDECAR_CONNECTION_ID ? (
                      <ConnectionModelPicker
                        key={modelsConnection.id}
                        connection={modelsConnection}
                        autoFocusSearch
                        onPicked={() => {
                          if (modelsConnection.id !== effectiveConnectionId)
                            handleConnectionChange(modelsConnection.id);
                          setConnectionMenuOpen(false);
                          connectionButtonRef.current?.focus();
                        }}
                        leading={
                          <button
                            type="button"
                            className="mari-connection-picker__back"
                            onClick={() => {
                              setShownConnectionId(null);
                              setModelsStep(false);
                            }}
                            aria-label={localizeUi("connections.modelPicker.back")}
                            title={localizeUi("connections.modelPicker.back")}
                          >
                            <ChevronLeft aria-hidden="true" />
                          </button>
                        }
                      />
                    ) : (
                      <p className="mari-composer-menu__head">{localizeUi("connections.modelPicker.localModel")}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mari-composer-menu">
            <button
              ref={permissionsButtonRef}
              type="button"
              onClick={() => {
                setConnectionMenuOpen(false);
                setPermissionsMenuOpen((current) => !current);
              }}
              className="mari-composer-menu__trigger"
              data-mode={permissionsMode}
              aria-expanded={permissionsMenuOpen}
              aria-label={localizeUi("ui.chat.quickreplymenu.value1Value2", {
                value1: localizeUi("ui.chat.homeprofessormarichat.permissionsMode"),
                value2: localize(MARI_PERMISSIONS_MODE_LABELS[permissionsMode].label),
              })}
              title={localizeUi("ui.chat.homeprofessormarichat.permissionsMode")}
            >
              <ActivePermissionsModeIcon aria-hidden="true" />
              <span>{localize(MARI_PERMISSIONS_MODE_LABELS[permissionsMode].label)}</span>
              <ChevronDown aria-hidden="true" />
            </button>
            {permissionsMenuOpen ? (
              <div
                ref={permissionsMenuRef}
                className="mari-composer-menu__popover"
                onKeyDown={onPermissionsMenuKeyDown}
              >
                {permissionsModeOptions}
              </div>
            ) : null}
          </div>
        </div>
        {/* While she works the field stays open, so a message can wait its turn; Stop sits beside Send. */}
        {workspaceTimelineActive ? (
          <button
            type="button"
            onClick={() => void stopWorkspace()}
            className="mari-workspace-composer__stop"
            aria-label={localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")}
            title={localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")}
          >
            <Square size="0.7rem" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {localizeUi("ui.chat.homeprofessormarichat.stop")}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmitMessage}
          className="mari-workspace-composer__send"
          aria-label={t("home.professorMari.send")}
          title={t("home.professorMari.send")}
        >
          <ArrowUp size="1rem" strokeWidth={2.25} aria-hidden="true" />
        </button>
        {workspaceTimelineActive ? (
          <div ref={sendMenuRef} className="mari-composer-menu mari-workspace-composer__send-menu">
            <button
              type="button"
              disabled={!canSubmitMessage}
              onClick={() => setSendMenuOpen((current) => !current)}
              className="mari-workspace-composer__send-more"
              aria-expanded={sendMenuVisible}
              aria-label={t("mari.queue.sendOptions")}
              title={t("mari.queue.sendOptions")}
            >
              <ChevronDown aria-hidden="true" />
            </button>
            {sendMenuVisible ? (
              <div ref={sendMenuPopoverRef} onKeyDown={handleSendMenuKeyDown} className="mari-composer-menu__popover">
                <MariRow
                  slot={<ArrowUp aria-hidden="true" />}
                  title={t("mari.queue.sendNow")}
                  fact={t("mari.queue.sendNowFact")}
                  onClick={() => {
                    setSendMenuOpen(false);
                    void handleSubmit();
                  }}
                />
                <MariRow
                  slot={<Clock aria-hidden="true" />}
                  title={t("mari.queue.later")}
                  fact={t("mari.queue.waiting")}
                  onClick={() => {
                    setSendMenuOpen(false);
                    void handleSubmit(undefined, undefined, undefined, true);
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
