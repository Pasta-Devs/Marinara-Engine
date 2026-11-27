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
  ArrowUp,
  Clock,
  Square,
  RotateCcw,
} from "lucide-react";
import type { ChatModelChoice, MariComposerReference, MariPermissionsMode, Message } from "@marinara-engine/shared";
import {
  RefObject,
  Dispatch,
  SetStateAction,
  ChangeEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { ProfessorMariContextFacet } from "../../../lib/professor-mari-presentation";
import { RESULT_TYPE_ICONS, resourceResultType } from "../../../lib/command-icons";
import {
  type activeToken,
  composerKeyAction,
  pastedFiles,
  showsReferenceGuess,
  unlinkedActiveToken,
  type ComposerMark,
  type ComposerPickerAction,
} from "../../../lib/composer-triggers";
import type { MariCommandId } from "../../../lib/mari-commands";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { openAddConnection } from "../../../lib/add-connection";
import { ConnectionSwitcherBody } from "../../connections/ConnectionSwitcherBody";
import { Modal } from "../../ui/Modal";
import { useMatchMedia } from "../../../hooks/use-match-media";
import { usePickModel, useSetFeatureModels } from "../../../hooks/use-connection-accounts";
import { useConnections } from "../../../hooks/use-connections";
import { InlineDraftOverlay } from "../../ui/InlineDraftOverlay";
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
import { useDismiss } from "../../../hooks/use-dismiss";
import { useInDialogFocusScope } from "../../../hooks/use-in-dialog-focus-scope";

/** R11 (composer v5): her composer dock: the question strip, context chips, the field, attach, connection and mode menus, and Send/Stop. */
type MariComposerProps = {
  workspaceStatus: MariWorkspaceStatus | null;
  refreshWorkspaceStatus: () => Promise<MariWorkspaceStatus>;
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
  /** Where the guessed fragment starts in the draft: a guess shows only when it continues the live `@` token. */
  draftSuffixStart?: number;
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
    /** Where the caret goes after a pick; `n` makes the same position a new request. */
    caretRequest: { pos: number; n: number } | null;
    references: readonly MariComposerReference[];
    onRemove: (reference: MariComposerReference) => void;
  };
};

export function MariComposer({
  workspaceStatus,
  refreshWorkspaceStatus,
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
  draftSuffixStart = -1,
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
  // Folding the suggestions box is remembered (and follows you to every window and device).
  const suggestionsCollapsed = useUIStore((state) => state.professorMariSuggestionsCollapsed);
  const setSuggestionsCollapsed = useUIStore((state) => state.setProfessorMariSuggestionsCollapsed);
  const suggestionsBodyId = useId();
  const chipStrip = (
    <MariSuggestionChips
      chips={chipRowChips}
      onSelect={(chip) => handleSuggestionSelect(chip, true)}
      disabled={isBusy}
    />
  );
  // While she works, Send opens this choice of now or after her answer. It only exists while she works.
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement | null>(null);
  const sendMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const sendMenuVisible = sendMenuOpen && workspaceTimelineActive && canSubmitMessage;
  // A cleared field or a finished run closes it, so it does not pop open again on the next message.
  if (sendMenuOpen && !sendMenuVisible) setSendMenuOpen(false);
  // Inside the omnibar, Escape closes this menu and not the dialog behind it.
  const handleSendMenuKeyDown = useInDialogFocusScope(
    sendMenuPopoverRef,
    () => setSendMenuOpen(false),
    sendMenuVisible,
  );
  useDismiss(sendMenuRef, sendMenuVisible, () => setSendMenuOpen(false));
  // Where the caret sits in the draft, so a live `@` / `/` token can be found.
  const [caret, setCaret] = useState(draft.length);
  // An `@` already linked to a reference ends at its name: words typed after it (`@Alice and then`) are
  // prose, not more of the name, so they get no picker, highlight or guess. Inside the name it stays editable.
  const { token: liveToken, linked: liveTokenLinked } = unlinkedActiveToken(
    draft,
    Math.min(caret, draft.length),
    referenceMarks,
  );
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
  // Names are only guessed inside an `@` token that ends the draft (a Tab there links it), never in plain
  // sentences, where a guess after two letters reads as autocorrect. The guess must continue the whole
  // token from its `@`, not a later word in it (`@Alice and ha` guesses nothing), and a linked name gets
  // none. The open picker replaces it.
  const ghostInToken = liveToken?.trigger === "@" && liveToken.end === draft.length;
  const ghostAvailable =
    Boolean(draftSuffix) && showsReferenceGuess(draft, liveToken, liveTokenLinked, draftSuffixStart);
  const ActivePermissionsModeIcon = MARI_PERMISSIONS_MODE_ICONS[permissionsMode];
  // The connection menu is the chat's quick switch: the list, with the chosen Connection's models beside it.
  const setFeatureModels = useSetFeatureModels();
  const pickModel = usePickModel();
  const { data: connectionRows } = useConnections();
  // Her Model is a global setting with no chat to hold a per-chat pick, so a catalog pick is saved to the library.
  // The local selection keeps working while the server copy saves.
  const applyMariPick = async (choice: ChatModelChoice) => {
    let connectionId = choice.connectionId;
    if (choice.model) {
      const accountId = (connectionRows as Array<{ id: string; accountId?: string | null }> | undefined)?.find(
        (row) => row.id === choice.connectionId,
      )?.accountId;
      if (!accountId) throw new Error(t("connections.switcher.noConnection"));
      const { model, name, maxContext, maxTokensOverride } = choice;
      ({ connectionId } = await pickModel.mutateAsync({ accountId, model, name, maxContext, maxTokensOverride }));
    }
    handleConnectionChange(connectionId);
    setFeatureModels.mutate({ mariConnectionId: connectionId });
  };
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
  // Phones open the same full-height Modal sheet as the ConnectionPicker; wider screens keep the popover.
  const phone = useMatchMedia("(max-width: 39.99rem)");
  // The menus open upward from the composer. A tall draft leaves little room above it, and the header sits on a
  // higher layer, so the menus cap their height to the room between the composer and the top of her pane.
  const composerBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = composerBoxRef.current;
    const pane = box?.closest("form")?.parentElement;
    if (!box || !pane) return;
    const sync = () => {
      const room = box.getBoundingClientRect().top - Math.max(0, pane.getBoundingClientRect().top) - 12;
      box.style.setProperty("--mari-menu-room", `${Math.max(120, Math.round(room))}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(box);
    observer.observe(pane);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);
  // Enter in the model search must not send the message: the menu sits inside the composer form.
  const connectionMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
    onConnectionMenuKeyDown(event);
  };
  const connectionBody = (
    <ConnectionSwitcherBody
      current={effectiveConnectionId ? { connectionId: effectiveConnectionId } : null}
      onApply={applyMariPick}
      onDone={() => {
        setConnectionMenuOpen(false);
        connectionButtonRef.current?.focus();
      }}
      autoFocusSearch
      showLocalModel={connectionOptions.some((connection) => connection.id === LOCAL_SIDECAR_CONNECTION_ID)}
      localModelHint={localizeUi(
        sidecarNativeToolCalls ? "ui.chat.homeprofessormarichat.nativeTools" : "ui.chat.homeprofessormarichat.toolsOff",
      )}
      listHeader={
        phone ? undefined : (
          <p className="mari-composer-menu__head">
            {t("connections.picker.modelFor", { job: t("connections.picker.jobMari") })}
          </p>
        )
      }
      onAdd={() => {
        setConnectionMenuOpen(false);
        openAddConnection({ job: "mari" });
      }}
      listFooter={
        <div className="px-3 py-2">
          <MariConnectionGuidance compact />
        </div>
      }
    />
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
      {/* N4 covers the next-step cards; the starter and plan/approval chips still draft. */}
      {showSuggestionPrompt && !showNextStepCards && suggestionQuestion && (!omnibarMode || messages.length > 0) ? (
        <div
          className="mari-workspace-question-dock mb-2"
          data-collapsible={!omnibarMode || undefined}
          data-collapsed={(!omnibarMode && suggestionsCollapsed) || undefined}
        >
          {!omnibarMode ? (
            <div className="mari-workspace-question-dock__prompt">
              {/* The fold sits top left with her sparkle beneath it. Folded, the box is one quiet line that is
                  itself the button, so it opens from anywhere on it. */}
              {suggestionsCollapsed ? (
                <button
                  type="button"
                  className="mari-workspace-question-dock__folded"
                  onClick={() => setSuggestionsCollapsed(false)}
                  aria-expanded={false}
                  title={t("mari.suggestions.show")}
                >
                  <span className="mari-workspace-question-dock__toggle" aria-hidden="true">
                    <ChevronDown />
                  </span>
                  <span className="mari-workspace-question-dock__folded-label">{t("mari.suggestions.folded")}</span>
                </button>
              ) : (
                <>
                  {/* Two lines: the fold beside her question, her sparkle beside the suggestions. */}
                  <button
                    type="button"
                    className="mari-workspace-question-dock__toggle"
                    onClick={() => setSuggestionsCollapsed(true)}
                    aria-expanded
                    aria-controls={suggestionsBodyId}
                    aria-label={t("mari.suggestions.hide")}
                    title={t("mari.suggestions.hide")}
                  >
                    <ChevronDown aria-hidden="true" />
                  </button>
                  <div className="mari-workspace-question-dock__question min-w-0">
                    <CompactMarkdown content={suggestionQuestion} />
                  </div>
                  {/* An invisible chip gives the slot a chip's exact height in every theme, so the sparkle sits
                      in the middle of the first row of suggestions (they wrap on a narrow box). */}
                  <span className="mari-workspace-question-dock__sparkle" aria-hidden="true">
                    <span className="mari-suggestion-chip mari-workspace-question-dock__sparkle-sizer">&#8203;</span>
                    <Sparkles size="0.875rem" />
                  </span>
                  <div id={suggestionsBodyId} className="mari-workspace-answer-strip">
                    {chipStrip}
                  </div>
                </>
              )}
            </div>
          ) : null}
          {omnibarMode ? <div className="mari-workspace-answer-strip">{chipStrip}</div> : null}
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
      <div ref={composerBoxRef} className="mari-workspace-composer outline-none" tabIndex={-1}>
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

        {/* Attach and the connection sit before the text, as in the chat composer; the Permissions Mode sits by
            Send. Narrow composers put the text on its own row above them. */}
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
            </button>
            {connectionMenuOpen &&
              (phone ? (
                <Modal
                  open
                  onClose={() => {
                    setConnectionMenuOpen(false);
                    connectionButtonRef.current?.focus();
                  }}
                  title={t("connections.picker.modelFor", { job: t("connections.picker.jobMari") })}
                  opaque
                  panelClassName="max-sm:h-[calc(100dvh-1.5rem)]"
                  contentClassName="flex flex-col overflow-hidden !p-0"
                >
                  <div
                    ref={connectionMenuRef}
                    className="mari-connection-picker-sheet"
                    onKeyDown={connectionMenuKeyDown}
                  >
                    <div className="mari-connection-picker">{connectionBody}</div>
                  </div>
                </Modal>
              ) : (
                <div
                  ref={connectionMenuRef}
                  className="mari-composer-menu__popover mari-connection-picker"
                  onKeyDown={connectionMenuKeyDown}
                >
                  {connectionBody}
                </div>
              ))}
          </div>
        </div>
        <div className="mari-workspace-composer__text-row relative flex min-w-0 flex-1 basis-full">
          <InlineDraftOverlay
            value={draft}
            suffix={ghostAvailable && !pickerOpen ? draftSuffix : ""}
            marks={[
              ...referenceMarks,
              ...(liveToken ? [{ start: liveToken.start, end: liveToken.end, tone: "pending" as const }] : []),
            ]}
            multiline
            scrollLeft={composerScroll.left}
            scrollTop={composerScroll.top}
            className="mari-workspace-composer__text"
            onAccept={() => onPickerAction?.("ghost-link")}
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
                // Safari confirms an IME candidate with an Enter whose isComposing is already false (keyCode 229).
                isComposing: event.nativeEvent.isComposing || event.keyCode === 229,
                pickerOpen,
                hasGhost: ghostAvailable,
                inReferenceToken: ghostInToken,
                canDrillIn: referenceUi?.canDrillIn,
                canDrillOut: referenceUi?.canDrillOut,
                enterToSend,
              });
              if (action === "none") return;
              event.preventDefault();
              // The ghost only shows inside an `@` token, where a Tab links (never plain completion).
              if (action === "ghost-accept") return;
              if (action === "send") void handleSubmit();
              else if (action === "queue") void handleSubmit(undefined, undefined, undefined, true);
              else {
                // In companion mode the first Escape closes only the picker, not the omnibar behind it.
                if (action === "picker-close") event.stopPropagation();
                onPickerAction?.(action);
              }
            }}
            aria-controls={pickerOpen ? referenceUi?.picker?.id : undefined}
            aria-activedescendant={pickerOpen ? referenceUi?.activeOptionId : undefined}
            rows={1}
            placeholder={phone ? t("home.professorMari.placeholderPhone") : t("home.professorMari.placeholder")}
            className="mari-workspace-composer__text mari-workspace-composer__input"
          />
        </div>
        <div className="mari-composer-menu mari-composer-mode">
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
            <div ref={permissionsMenuRef} className="mari-composer-menu__popover" onKeyDown={onPermissionsMenuKeyDown}>
              {permissionsModeOptions}
            </div>
          ) : null}
        </div>
        {/* While she works one button shows: Stop on an empty field, Send once there is a message.
            That Send opens the full-width choice of now or after her answer. */}
        {workspaceTimelineActive && !canSubmitMessage ? (
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
        ) : workspaceTimelineActive ? (
          <div ref={sendMenuRef} className="mari-composer-menu mari-workspace-composer__send-menu">
            <button
              type="button"
              onClick={() => setSendMenuOpen((current) => !current)}
              className="mari-workspace-composer__send"
              aria-expanded={sendMenuVisible}
              aria-label={t("mari.queue.sendOptions")}
              title={t("mari.queue.sendOptions")}
            >
              <ArrowUp size="1rem" strokeWidth={2.25} aria-hidden="true" />
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
        ) : (
          <button
            type="submit"
            disabled={!canSubmitMessage}
            // Keep the keyboard up for a follow-up, as the chat's Send does (keyboard QC round 2, IR2-3).
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse") event.preventDefault();
            }}
            className="mari-workspace-composer__send"
            aria-label={t("home.professorMari.send")}
            title={t("home.professorMari.send")}
          >
            <ArrowUp size="1rem" strokeWidth={2.25} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
