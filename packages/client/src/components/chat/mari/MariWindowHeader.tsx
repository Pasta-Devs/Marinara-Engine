import { ProfessorMariAskContext, MariInstructionDetail, MariWorkspacePendingApproval } from "@marinara-engine/shared";
import { Sparkles, BookOpen, ArrowDown, Brain, ShieldAlert, Plus, X, Menu } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMariAppearancePack } from "../../../hooks/use-mari-appearance-pack";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { CharacterPreviewModel } from "../../../lib/character-preview";
import { LorebookPreviewModel } from "../../../lib/lorebook-preview";
import { mariImgLoading, MARI_ASSET_TIER } from "../../../lib/mari-work-animations";
import { cn } from "../../../lib/utils";
import { professorMariContextCount } from "../../../lib/professor-mari-presentation";
import { ProfessorMariContextControl } from "../ProfessorMariContextControl";

/** The floating window's header (hidden in the omnibar, which has its own): name, destinations, review count, New and Close. */
type MariWindowHeaderProps = {
  activeMemoryCount: number;
  activeSkillCount: number;
  attachedContext: MariWorkspaceContextItem[] | undefined;
  chatHistoryOpen: boolean;
  closeChatWindow: () => void;
  embeddedTab: boolean;
  focusedCharacter: CharacterPreviewModel | null;
  focusedLorebook: LorebookPreviewModel | null;
  handleOpenContextViewer: () => Promise<void>;
  handoffContext: ProfessorMariAskContext | null;
  isBusy: boolean;
  /** UX-30: no model connection yet, so she is not ready to help. */
  noConnection?: boolean;
  memories: MariInstructionDetail[];
  memoriesMenuOpen: boolean;
  omnibarMode: boolean;
  openPendingApprovals: (reviewId?: string | null) => void;
  runRestart: () => Promise<void>;
  setConnectionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setHandoffContext: Dispatch<SetStateAction<ProfessorMariAskContext | null>>;
  skillsMenuOpen: boolean;
  toggleChatHistory: () => void;
  toggleMemoriesMenu: () => void;
  toggleSkillsMenu: () => void;
  visiblePendingChangeReviews: MariWorkspacePendingApproval[];
  workspaceTimelineActive: boolean;
};

export function MariWindowHeader({
  activeMemoryCount,
  activeSkillCount,
  attachedContext,
  chatHistoryOpen,
  closeChatWindow,
  embeddedTab,
  focusedCharacter,
  focusedLorebook,
  handleOpenContextViewer,
  handoffContext,
  isBusy,
  noConnection = false,
  memories,
  memoriesMenuOpen,
  omnibarMode,
  openPendingApprovals,
  runRestart,
  setConnectionMenuOpen,
  setHandoffContext,
  skillsMenuOpen,
  toggleChatHistory,
  toggleMemoriesMenu,
  toggleSkillsMenu,
  visiblePendingChangeReviews,
  workspaceTimelineActive,
}: MariWindowHeaderProps) {
  const appearance = useMariAppearancePack();
  const { t: localizeUi } = useTranslation();
  const { t } = useTranslation();
  // Phones: Chats, Skills, Memories, Context and New did not fit beside her name and ran off the
  // page, so below 640px they move into one ☰ menu (the omnibar's phone menu, same rows).
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || menuTriggerRef.current?.contains(target))) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const contextCount = professorMariContextCount(attachedContext?.length ?? 0, handoffContext);
  const menuItems = [
    {
      id: "chats",
      Icon: BookOpen,
      label: localizeUi("navigation.common.chats"),
      count: 0,
      pressed: chatHistoryOpen,
      disabled: isBusy && !chatHistoryOpen,
      onSelect: toggleChatHistory,
    },
    {
      id: "skills",
      Icon: ArrowDown,
      label: localizeUi("ui.chat.homeprofessormarichat.skills"),
      count: activeSkillCount,
      pressed: skillsMenuOpen,
      disabled: false,
      onSelect: toggleSkillsMenu,
    },
    {
      id: "memories",
      Icon: Brain,
      label: localizeUi("ui.chat.homeprofessormarichat.memories"),
      count: memories.length > 0 ? activeMemoryCount : 0,
      pressed: memoriesMenuOpen,
      disabled: false,
      onSelect: toggleMemoriesMenu,
    },
    {
      id: "context",
      Icon: Sparkles,
      label: localizeUi("ui.chat.homeprofessormarichat.awareOf"),
      count: contextCount,
      pressed: contextOpen,
      disabled: false,
      onSelect: () => {
        setConnectionMenuOpen(false);
        setContextOpen(true);
      },
    },
    {
      id: "new",
      Icon: Plus,
      label: localizeUi("ui.chat.homeprofessormarichat.newChat"),
      count: 0,
      pressed: undefined,
      disabled: isBusy,
      onSelect: () => void runRestart(),
    },
  ];
  return (
    <div
      data-mari-window-header=""
      className={cn(
        "flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)]/60 px-2 pt-2 sm:px-3 sm:py-2",
        omnibarMode ? "hidden" : "bg-[var(--card)]/80",
      )}
    >
      {omnibarMode ? (
        <div />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--mari-home-pink)_40%,transparent)] bg-[color-mix(in_srgb,var(--mari-home-pink)_10%,transparent)] text-[var(--primary)] shadow-[0_0_18px_color-mix(in_srgb,var(--mari-home-pink)_18%,transparent)]">
            {workspaceTimelineActive ? (
              <Sparkles size="0.9rem" aria-hidden="true" />
            ) : (
              <img
                src={appearance.portraits.idle}
                {...mariImgLoading(MARI_ASSET_TIER.portraits.idle)}
                alt=""
                className="h-full w-full object-cover object-top"
              />
            )}
          </span>
          {/* Her name and status; on phones the buttons are in the ☰ menu, so there is room for it. */}
          <span className="block min-w-0">
            <span className="block truncate text-xs font-bold text-[var(--foreground)]">
              {localizeUi("ui.chat.homefaq.professorMari")}
            </span>
            <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {isBusy
                ? localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
                : localizeUi(
                    noConnection
                      ? "ui.chat.homeprofessormarichat.needsConnection"
                      : "ui.chat.homeprofessormarichat.readyToHelp",
                  )}
            </span>
          </span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={toggleChatHistory}
            disabled={isBusy && !chatHistoryOpen}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
            )}
            title={t("home.professorMari.openPreviousChats")}
            aria-expanded={chatHistoryOpen}
          >
            <BookOpen size="0.75rem" />
            <span>{localizeUi("navigation.common.chats")}</span>
          </button>
          <button
            type="button"
            onClick={toggleSkillsMenu}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
            )}
            title={localizeUi("ui.chat.homeprofessormarichat.openSkills")}
            aria-expanded={skillsMenuOpen}
          >
            <ArrowDown size="0.75rem" />
            <span>{localizeUi("ui.chat.homeprofessormarichat.skills")}</span>
            {activeSkillCount > 0 && (
              <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">{activeSkillCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleMemoriesMenu}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
            )}
            title={localizeUi("ui.chat.homeprofessormarichat.openMemories")}
            aria-expanded={memoriesMenuOpen}
          >
            <Brain size="0.75rem" />
            <span>{localizeUi("ui.chat.homeprofessormarichat.memories")}</span>
            {memories.length > 0 && (
              <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">{activeMemoryCount}</span>
            )}
          </button>
        </div>
        {/* Phones open it from the ☰ menu; its panel is portaled, so hiding this wrapper hides only the pill. */}
        <span className="hidden sm:contents">
          <ProfessorMariContextControl
            open={contextOpen}
            onOpenChange={setContextOpen}
            context={handoffContext}
            character={focusedCharacter}
            lorebook={focusedLorebook}
            attachedContextCount={attachedContext?.length ?? 0}
            onOpen={() => {
              setConnectionMenuOpen(false);
            }}
            onRemoveFocus={() => setHandoffContext(null)}
            onViewAttachedContext={() => void handleOpenContextViewer()}
          />
        </span>
        {visiblePendingChangeReviews.length > 0 ? (
          <button
            type="button"
            onClick={() => openPendingApprovals()}
            className="mari-chrome-control mari-chrome-control--compact font-semibold"
          >
            <ShieldAlert size="0.75rem" />
            <span>
              {localizeUi("ui.chat.homeprofessormarichat.pendingApprovals", {
                count: visiblePendingChangeReviews.length,
              })}
            </span>
          </button>
        ) : null}
        <span className="hidden sm:contents">
          <button
            type="button"
            onClick={() => void runRestart()}
            disabled={isBusy}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-accent-text-muted mari-accent-animated disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={localizeUi("ui.chat.homeprofessormarichat.newChat")}
            title={t("home.professorMari.newChat")}
          >
            <Plus size="0.75rem" />
            <span>{localizeUi("ui.chat.homeprofessormarichat.newChat")}</span>
          </button>
        </span>
        <div className="relative sm:hidden">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="mari-omnibar-header-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={localizeUi("ui.chat.homeprofessormarichat.headerMenu")}
            title={localizeUi("ui.chat.homeprofessormarichat.headerMenu")}
          >
            <Menu size="1.125rem" aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div
              ref={menuRef}
              role="menu"
              aria-label={localizeUi("ui.chat.homeprofessormarichat.headerMenu")}
              className="mari-omnibar-header-menu__popover"
              // --card is translucent in some themes, and this opens over the transcript.
              style={{ background: "linear-gradient(var(--card), var(--card)) var(--background)" }}
            >
              {menuItems.map(({ id, Icon, label, count, pressed, disabled, onSelect }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  aria-current={pressed ? "true" : undefined}
                  disabled={disabled}
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect();
                  }}
                >
                  <Icon size="0.875rem" aria-hidden="true" />
                  <span>{label}</span>
                  {count > 0 ? <b>{count}</b> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!embeddedTab && (
          <button
            type="button"
            onClick={closeChatWindow}
            className="mari-editor-action mari-accent-animated inline-flex shrink-0"
            aria-label={t("home.professorMari.close")}
            title={t("home.professorMari.close")}
          >
            <X size="1.125rem" />
          </button>
        )}
      </div>
    </div>
  );
}
