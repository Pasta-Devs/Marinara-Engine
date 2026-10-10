import { ProfessorMariAskContext } from "@marinara-engine/shared";
import { Brain, BookOpen, Eye, MessageCircle, Plus, EllipsisVertical } from "lucide-react";
import { type Dispatch, type KeyboardEvent, type RefObject, type SetStateAction, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import {
  ProfessorMariContextFacet,
  ProfessorMariPresentationState,
  isMariReviewWaiting,
  countBlockingReviews,
} from "../../../lib/professor-mari-presentation";
import { ProfessorMariWorkspaceDestination } from "../../../lib/professor-mari-workspace-navigation";
import { MariTurnReviewEntry } from "./MariTranscript";

/** The omnibar header's Mari parts, portaled into its slots: destinations, her status line, and the phone menu. */
type MariOmnibarHeaderChromeProps = {
  activeMemoryCount: number;
  activeSkillCount: number;
  attachedContext: MariWorkspaceContextItem[] | undefined;
  composerContextFacets: ProfessorMariContextFacet[];
  headerCompact: boolean;
  headerMenuOpen: boolean;
  headerMenuRef: RefObject<HTMLDivElement | null>;
  heldChangeCard: boolean;
  isBusy: boolean;
  /** UX-30: no model connection yet, so she is not ready to help. */
  noConnection?: boolean;
  mariPresentationState: ProfessorMariPresentationState;
  omnibarHeaderSlot: HTMLElement | null;
  omnibarMenuSlot: HTMLElement | null;
  omnibarMode: boolean;
  omnibarStatusSlot: HTMLElement | null;
  onHeaderMenuKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  oneShotContext: ProfessorMariAskContext | null;
  reviewsByTurn: { byMessageId: Map<string, MariTurnReviewEntry[]>; unassigned: MariTurnReviewEntry[] };
  runRestart: () => Promise<void>;
  setHeaderMenuOpen: Dispatch<SetStateAction<boolean>>;
  setWorkspaceDestination: Dispatch<SetStateAction<ProfessorMariWorkspaceDestination>>;
  workspaceDestination: ProfessorMariWorkspaceDestination;
};

export function MariOmnibarHeaderChrome({
  activeMemoryCount,
  activeSkillCount,
  attachedContext,
  composerContextFacets,
  headerCompact,
  headerMenuOpen,
  headerMenuRef,
  heldChangeCard,
  isBusy,
  noConnection = false,
  mariPresentationState,
  omnibarHeaderSlot,
  omnibarMenuSlot,
  omnibarMode,
  omnibarStatusSlot,
  onHeaderMenuKeyDown,
  oneShotContext,
  reviewsByTurn,
  runRestart,
  setHeaderMenuOpen,
  setWorkspaceDestination,
  workspaceDestination,
}: MariOmnibarHeaderChromeProps) {
  const { t } = useTranslation();
  const { t: localizeUi } = useTranslation();
  // Q5: "Chats · +" is last, so the group sits at the right of the row, under settings and Close.
  const headerDestinations = [
    {
      id: "skills",
      Icon: Brain,
      label: localizeUi("ui.chat.homeprofessormarichat.skills"),
      shortLabel: undefined,
      count: activeSkillCount,
    },
    {
      id: "memories",
      Icon: BookOpen,
      label: localizeUi("ui.chat.homeprofessormarichat.memories"),
      shortLabel: undefined,
      count: activeMemoryCount,
    },
    {
      id: "context",
      Icon: Eye,
      label: localizeUi("ui.chat.homeprofessormarichat.awareOf"),
      shortLabel: localizeUi("ui.chat.homeprofessormarichat.awareOf"),
      // Slice 74 (slice 73 leftover): one per chip the composer shows, plus what is attached for good.
      count: (attachedContext?.length ?? 0) + (composerContextFacets.length || (oneShotContext?.query ? 1 : 0)),
    },
    {
      id: "chats",
      Icon: MessageCircle,
      label: localizeUi("navigation.common.chats"),
      shortLabel: undefined,
      count: 0,
    },
  ] as const satisfies ReadonlyArray<{
    id: Exclude<ProfessorMariWorkspaceDestination, "chat">;
    Icon: typeof MessageCircle;
    label: string;
    shortLabel?: string;
    count: number;
  }>;

  const selectHeaderDestination = (destination: Exclude<ProfessorMariWorkspaceDestination, "chat">) => {
    setWorkspaceDestination(workspaceDestination === destination ? "chat" : destination);
  };
  // Tabs, manual activation: arrows and Home/End move focus; Enter or Space (the click) selects. A
  // selected tab would open its panel, and that panel takes focus on mount, so focus must not move with it.
  const tabRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const [focusedTabId, setFocusedTabId] = useState<string | null>(null);
  const preferredTabStop = focusedTabId ?? (workspaceDestination === "chat" ? "skills" : workspaceDestination);
  // A disabled tab cannot take focus, so it never holds the one tab stop (Chats while she works).
  const tabStop = preferredTabStop === "chats" && isBusy ? "skills" : preferredTabStop;
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledTabs = headerDestinations.filter(({ id }) => !(id === "chats" && isBusy));
    const currentId = (event.target as HTMLElement).closest<HTMLElement>("[data-destination]")?.dataset.destination;
    const index = enabledTabs.findIndex(({ id }) => id === currentId);
    if (index < 0) return;
    const last = enabledTabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    tabRefs.current[enabledTabs[next]!.id]?.focus();
  };

  const omnibarHeaderChrome =
    omnibarMode && omnibarHeaderSlot
      ? createPortal(
          <div className="mari-omnibar-header-controls" data-compact={headerCompact ? "true" : undefined}>
            <nav
              className="mari-omnibar-header-destinations"
              aria-label={localizeUi("ui.chat.homeprofessormarichat.workspaceDestinations")}
            >
              <div
                role="tablist"
                className="mari-omnibar-header-tablist"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.workspaceDestinations")}
                onKeyDown={onTabKeyDown}
              >
                {headerDestinations.map(({ id, Icon, label, shortLabel, count }) => (
                  <button
                    key={id}
                    ref={(element) => {
                      tabRefs.current[id] = element;
                    }}
                    type="button"
                    role="tab"
                    id={`mari-tab-${id}`}
                    aria-selected={workspaceDestination === id}
                    tabIndex={tabStop === id ? 0 : -1}
                    onClick={() => selectHeaderDestination(id)}
                    onFocus={() => setFocusedTabId(id)}
                    disabled={id === "chats" && isBusy}
                    data-destination={id}
                    data-active={workspaceDestination === id ? "true" : "false"}
                    aria-label={label}
                    title={label}
                  >
                    <Icon size="0.8rem" aria-hidden="true" />
                    <span className="mari-omnibar-header-destination-label-full" aria-hidden="true">
                      {label}
                    </span>
                    <span className="mari-omnibar-header-destination-label-short" aria-hidden="true">
                      {shortLabel ?? label}
                    </span>
                    {count > 0 ? <b>{count}</b> : null}
                  </button>
                ))}
              </div>
              {/* Q1: New chat sits right after Chats, one "Chats · +" group; every destination fits the
                  bar at every width, so the header has no ⋮ menu. Q5: the group closes the row. */}
              <button
                type="button"
                onClick={() => void runRestart()}
                disabled={isBusy}
                className="mari-omnibar-header-new-chat"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.newChat")}
                title={t("home.professorMari.newChat")}
              >
                <Plus size="0.85rem" aria-hidden="true" />
              </button>
            </nav>
          </div>,
          omnibarHeaderSlot,
        )
      : null;
  const omnibarMenuChrome =
    omnibarMode && omnibarMenuSlot && headerCompact
      ? createPortal(
          <>
            <button
              type="button"
              // Keeps the caret (and the phone keyboard) in the composer until the menu takes focus.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setHeaderMenuOpen((current) => !current)}
              className="mari-omnibar-header-menu__trigger"
              aria-expanded={headerMenuOpen}
              aria-label={localizeUi("ui.chat.homeprofessormarichat.headerMenu")}
              title={localizeUi("ui.chat.homeprofessormarichat.headerMenu")}
            >
              <EllipsisVertical size="1rem" aria-hidden="true" />
            </button>
            {headerMenuOpen ? (
              <div ref={headerMenuRef} className="mari-omnibar-header-menu__popover" onKeyDown={onHeaderMenuKeyDown}>
                {headerDestinations.map(({ id, Icon, label, count }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={workspaceDestination === id}
                    disabled={id === "chats" && isBusy}
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      selectHeaderDestination(id);
                    }}
                  >
                    <Icon size="0.875rem" aria-hidden="true" />
                    <span>{label}</span>
                    {count > 0 ? <b>{count}</b> : null}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void runRestart();
                  }}
                >
                  <Plus size="0.875rem" aria-hidden="true" />
                  <span>{localizeUi("ui.chat.homeprofessormarichat.newChat")}</span>
                </button>
              </div>
            ) : null}
          </>,
          omnibarMenuSlot,
        )
      : null;
  // One per "Needs you" card: a turn's deletes are one card, a held change is one more.
  const needsYouCount =
    [...reviewsByTurn.byMessageId.values()].reduce((count, entries) => {
      const waiting = entries.filter(({ approval, outcome }) => !outcome && isMariReviewWaiting(approval));
      const deletes = waiting.filter(({ approval }) => approval.kind === "applied_review").length;
      return count + waiting.length - Math.max(0, deletes - 1);
    }, 0) +
    countBlockingReviews(reviewsByTurn.unassigned.filter(({ outcome }) => !outcome).map(({ approval }) => approval)) +
    (heldChangeCard ? 1 : 0);
  const scrollToNeedsYou = () =>
    document.querySelector<HTMLElement>('[data-needs-you="true"]')?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  const omnibarStatusChrome =
    omnibarMode && omnibarStatusSlot
      ? createPortal(
          <span
            className="mari-status-shimmer"
            data-active={isBusy ? "true" : undefined}
            data-state={mariPresentationState === "broken" ? "error" : undefined}
          >
            {isBusy ? (
              localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
            ) : mariPresentationState === "broken" ? (
              localizeUi("ui.chat.homeprofessormarichat.statusFailed")
            ) : needsYouCount > 0 ? (
              // Slice 71 (N7): names the open choices; a tap brings the first card into view.
              <button type="button" className="mari-status-needs-you" onClick={scrollToNeedsYou}>
                {localizeUi("mari.needsYou.headerStatus", { count: needsYouCount })}
              </button>
            ) : (
              localizeUi(
                noConnection
                  ? "ui.chat.homeprofessormarichat.needsConnection"
                  : "ui.chat.homeprofessormarichat.readyToHelp",
              )
            )}
          </span>,
          omnibarStatusSlot,
        )
      : null;

  return (
    <>
      {omnibarHeaderChrome}
      {omnibarStatusChrome}
      {omnibarMenuChrome}
    </>
  );
}
