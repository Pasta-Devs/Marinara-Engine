import {
  MariSuggestionChip,
  ProfessorMariAskContext,
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_PERMISSIONS_MODE_LABELS,
  MARI_PERMISSIONS_MODES,
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
  Plus,
  ArrowUp,
  Square,
  RotateCcw,
} from "lucide-react";
import type { MariPermissionsMode, Message } from "@marinara-engine/shared";
import { RefObject, Dispatch, SetStateAction, ChangeEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { ProfessorMariContextFacet } from "../../../lib/professor-mari-presentation";
import { cn } from "../../../lib/utils";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { useUIStore } from "../../../stores/ui.store";
import { InlineGhostText } from "../../ui/InlineGhostText";
import { MariRow } from "../mari-primitives";
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
import { CompactMarkdown, ProfessorMariAttachmentPreviews } from "./MariReplyContent";

/** R11 (composer v5): her composer dock: the question strip, context chips, the field, attach, connection and mode menus, and Send/Stop. */
type MariComposerProps = {
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
  handleAttachmentUpload: (files: FileList | null) => Promise<void>;
  handleConnectionChange: (id: string) => void;
  handleOpenContextViewer: () => Promise<void>;
  handleOpenHistoryPicker: () => Promise<void>;
  handleSubmit: (
    overrideText?: string,
    overrideRecovery?: Pick<ProfessorMariRecovery, "attachments" | "context" | "localMessageId"> & {
      reuseSavedMessage?: boolean;
    },
    overrideContext?: ProfessorMariAskContext | null,
  ) => Promise<void>;
  handleSuggestionSelect: (chip: MariSuggestionChip, draft?: boolean, context?: ProfessorMariAskContext) => void;
  isBusy: boolean;
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
};

export function MariComposer({
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
}: MariComposerProps) {
  const localize = useLocalizedUiText();
  const { t: localizeUi } = useTranslation();
  const { t } = useTranslation();
  const ActivePermissionsModeIcon = MARI_PERMISSIONS_MODE_ICONS[permissionsMode];
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
      {/* R11 (composer v5): Mari's own shell, not the regular chat input's: neutral at rest, a primary
                              ring only on focus, quiet controls and one neutral filled Send. */}
      <div
        className="mari-workspace-composer outline-none"
        tabIndex={-1}
        data-busy={isBusy ? "true" : undefined}
        data-collapsed={workspaceTimelineActive ? "true" : undefined}
      >
        {attachments.length > 0 || isReadingAttachments || composerContextFacets.length > 0 || oneShotContext?.query ? (
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
          </div>
        ) : null}

        <div className="relative flex min-w-0 flex-1 basis-full">
          <InlineGhostText
            value={draft}
            suffix={draftSuffix}
            multiline
            scrollLeft={composerScroll.left}
            scrollTop={composerScroll.top}
            className="mari-workspace-composer__text"
          />
          <textarea
            ref={floatingTextareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (mobileFocusMode) event.currentTarget.scrollIntoView({ block: "end" });
            }}
            onScroll={(event) => {
              const { scrollLeft, scrollTop } = event.currentTarget;
              event.currentTarget.toggleAttribute("data-scrolled", scrollTop > 0);
              setComposerScroll({ left: scrollLeft, top: scrollTop });
            }}
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.shiftKey && draftSuffix) {
                event.preventDefault();
                acceptDraftCompletion();
                return;
              }
              const shouldSend =
                event.key === "Enter" && !event.shiftKey && (enterToSend || event.metaKey || event.ctrlKey);
              if (shouldSend) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            rows={1}
            placeholder={t("home.professorMari.placeholder")}
            className="mari-workspace-composer__text mari-workspace-composer__input"
            disabled={isBusy}
          />
        </div>
        {/* Under the text, like Claude's: attach, the connection and the Permissions Mode. */}
        <div className="mari-composer-toolbar">
          <div className="mari-workspace-composer__attach">
            <MariAttachButton
              onAttachFiles={() => attachmentInputRef.current?.click()}
              onAddChatHistory={() => void handleOpenHistoryPicker()}
              onViewContext={() => void handleOpenContextViewer()}
              attachedFileCount={attachments.length}
              attachedContextCount={attachedContext?.length ?? 0}
              disabled={isBusy || isReadingAttachments}
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
              <span>
                {effectiveConnection
                  ? effectiveConnection.name || effectiveConnection.id
                  : localizeUi("ui.chat.homeprofessormarichat.selectConnection")}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
            {connectionMenuOpen && (
              <div ref={connectionMenuRef} className="mari-composer-menu__popover" onKeyDown={onConnectionMenuKeyDown}>
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
                        onClick={() => handleConnectionChange(connection.id)}
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
        {/* While she works the whole bar folds into one labelled Stop pill, and unfolds again after. */}
        <button
          type={workspaceTimelineActive ? "button" : "submit"}
          onClick={workspaceTimelineActive ? () => void stopWorkspace() : undefined}
          disabled={workspaceTimelineActive ? false : !canSubmitMessage || isBusy}
          data-mode={workspaceTimelineActive ? "stop" : "send"}
          className="mari-workspace-composer__send"
          aria-label={
            workspaceTimelineActive
              ? localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")
              : t("home.professorMari.send")
          }
          title={
            workspaceTimelineActive
              ? localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")
              : t("home.professorMari.send")
          }
        >
          <ArrowUp size="1rem" strokeWidth={2.25} data-icon="send" aria-hidden="true" />
          <span data-icon="stop" aria-hidden="true">
            <Square size="0.7rem" fill="currentColor" strokeWidth={0} />
            {localizeUi("ui.chat.homeprofessormarichat.stop")}
          </span>
        </button>
      </div>
    </form>
  );
}
