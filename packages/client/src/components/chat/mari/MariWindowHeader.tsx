import {
  ProfessorMariAskContext,
  MariInstructionDetail,
  MariWorkspaceSkillDetail,
  MariWorkspacePendingApproval,
} from "@marinara-engine/shared";
import { Sparkles, BookOpen, ArrowDown, Brain, ShieldAlert, Plus, X } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useMariAppearancePack } from "../../../hooks/use-mari-appearance-pack";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { CharacterPreviewModel } from "../../../lib/character-preview";
import { LorebookPreviewModel } from "../../../lib/lorebook-preview";
import { mariImgLoading, MARI_ASSET_TIER } from "../../../lib/mari-work-animations";
import { cn } from "../../../lib/utils";
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
  skills: MariWorkspaceSkillDetail[];
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
  skills,
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
  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)]/60 px-2 pt-2 sm:px-3 sm:py-2",
        omnibarMode ? "hidden" : "bg-[var(--card)]/80",
      )}
    >
      {omnibarMode ? (
        <div />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[oklch(0.73_0.21_345/0.4)] bg-[oklch(0.73_0.21_345/0.1)] text-[var(--primary)] shadow-[0_0_18px_oklch(0.73_0.21_345/0.18)]">
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
          {/* At phone widths the header buttons crush this into "P. / R…" -
                                the avatar carries the identity VISUALLY there, so hide the
                                text but keep a screen-reader label (the avatar's alt is empty). */}
          <span className="sr-only sm:hidden">{localizeUi("ui.chat.homefaq.professorMari")}</span>
          <span className="hidden min-w-0 sm:block">
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
          {skills.length > 0 && (
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
        <ProfessorMariContextControl
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
