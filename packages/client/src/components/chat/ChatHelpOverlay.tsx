import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ChatMode } from "@marinara-engine/shared";
import {
  Brain,
  ChevronsLeftRight,
  CircleHelp,
  Copy,
  EyeOff,
  Flag,
  GitBranch,
  Languages,
  Pencil,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  SmilePlus,
  Trash2,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  CHAT_HELP_CLOSE_EVENT,
  CHAT_HELP_OPEN_REQUEST_EVENT,
  closeChatHelp,
  readChatHelpEventMode,
  requestChatHelp,
} from "../../lib/chat-help-events";
import { useUIStore } from "../../stores/ui.store";
import { NEUTRAL_PANEL_SHELL } from "../ui/neutral-surface-styles";

type HelpTargetId =
  | "identity"
  | "agents"
  | "branches"
  | "call"
  | "agent-controls"
  | "summary"
  | "context"
  | "author-notes"
  | "gallery"
  | "connected-chat"
  | "search"
  | "settings"
  | "help"
  | "messages"
  | "composer"
  | "map"
  | "party"
  | "scene-media"
  | "retry"
  | "session"
  | "volume"
  | "assets"
  | "widgets"
  | "dialogue";

interface HelpTargetDefinition {
  id: HelpTargetId;
  titleKey: string;
  bodyKey: string;
  selector?: string;
  mergeMatches?: boolean;
  virtual?: "messages" | "composer";
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MeasuredTarget extends HelpTargetDefinition {
  rect: Rect;
}

interface HelpActionDefinition {
  icon: LucideIcon;
  labelKey: string;
}

const HELP_TARGET: HelpTargetDefinition = {
  id: "help",
  selector: '[data-chat-help="help"]',
  titleKey: "chat.help.targets.help.title",
  bodyKey: "chat.help.targets.help.body",
};

const COMMON_TOOLBAR_TARGETS: HelpTargetDefinition[] = [
  {
    id: "branches",
    selector: '[data-chat-help="branches"]',
    titleKey: "chat.help.targets.branches.title",
    bodyKey: "chat.help.targets.branches.body",
  },
  {
    id: "agent-controls",
    selector: '[data-chat-help="agent-controls"]',
    titleKey: "chat.help.targets.agentControls.title",
    bodyKey: "chat.help.targets.agentControls.body",
  },
  {
    id: "context",
    selector: '[data-chat-help="context"]',
    titleKey: "chat.help.targets.context.title",
    bodyKey: "chat.help.targets.context.body",
  },
  {
    id: "gallery",
    selector: '[data-chat-help="gallery"]',
    titleKey: "chat.help.targets.gallery.title",
    bodyKey: "chat.help.targets.gallery.body",
  },
  {
    id: "connected-chat",
    selector: '[data-chat-help="connected-chat"]',
    titleKey: "chat.help.targets.connectedChat.title",
    bodyKey: "chat.help.targets.connectedChat.body",
  },
  {
    id: "search",
    selector: '[data-chat-help="search"]',
    titleKey: "chat.help.targets.search.title",
    bodyKey: "chat.help.targets.search.body",
  },
  {
    id: "settings",
    selector: '[data-chat-help="settings"]',
    titleKey: "chat.help.targets.settings.title",
    bodyKey: "chat.help.targets.settings.body",
  },
];

function commonToolbarTargets(...ids: HelpTargetId[]): HelpTargetDefinition[] {
  return ids.map((id) => {
    const target = COMMON_TOOLBAR_TARGETS.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Unknown common toolbar help target: ${id}`);
    return target;
  });
}

const TARGETS_BY_MODE: Record<ChatMode, HelpTargetDefinition[]> = {
  conversation: [
    {
      id: "identity",
      selector: '[data-chat-help="identity"]',
      titleKey: "chat.help.targets.identity.title",
      bodyKey: "chat.help.targets.identity.body",
    },
    HELP_TARGET,
    ...COMMON_TOOLBAR_TARGETS,
    {
      id: "call",
      selector: '[data-chat-help="call"]',
      titleKey: "chat.help.targets.call.title",
      bodyKey: "chat.help.targets.call.body",
    },
    {
      id: "messages",
      virtual: "messages",
      titleKey: "chat.help.targets.conversationMessages.title",
      bodyKey: "chat.help.targets.conversationMessages.body",
    },
    {
      id: "composer",
      virtual: "composer",
      titleKey: "chat.help.targets.composer.title",
      bodyKey: "chat.help.targets.composer.body",
    },
  ],
  roleplay: [
    {
      id: "agents",
      selector: '[data-chat-help="agents"]',
      titleKey: "chat.help.targets.agents.title",
      bodyKey: "chat.help.targets.agents.body",
    },
    HELP_TARGET,
    ...commonToolbarTargets("branches", "agent-controls"),
    {
      id: "summary",
      selector: '[data-chat-help="summary"]',
      titleKey: "chat.help.targets.summary.title",
      bodyKey: "chat.help.targets.summary.body",
    },
    ...commonToolbarTargets("context"),
    {
      id: "author-notes",
      selector: '[data-chat-help="author-notes"]',
      titleKey: "chat.help.targets.authorNotes.title",
      bodyKey: "chat.help.targets.authorNotes.body",
    },
    ...commonToolbarTargets("gallery", "connected-chat", "search", "settings"),
    {
      id: "messages",
      virtual: "messages",
      titleKey: "chat.help.targets.roleplayMessages.title",
      bodyKey: "chat.help.targets.roleplayMessages.body",
    },
    {
      id: "composer",
      virtual: "composer",
      titleKey: "chat.help.targets.composer.title",
      bodyKey: "chat.help.targets.composer.body",
    },
  ],
  game: [
    {
      id: "map",
      selector: '[data-tour="game-map"]',
      titleKey: "chat.help.targets.map.title",
      bodyKey: "chat.help.targets.map.body",
    },
    {
      id: "party",
      selector: '[data-tour="game-party"]',
      titleKey: "chat.help.targets.party.title",
      bodyKey: "chat.help.targets.party.body",
    },
    {
      id: "scene-media",
      selector: '[data-chat-help="scene-media"]',
      titleKey: "chat.help.targets.sceneMedia.title",
      bodyKey: "chat.help.targets.sceneMedia.body",
    },
    HELP_TARGET,
    ...commonToolbarTargets("branches"),
    {
      id: "retry",
      selector: '[data-chat-help="retry"]',
      titleKey: "chat.help.targets.retry.title",
      bodyKey: "chat.help.targets.retry.body",
    },
    {
      id: "session",
      selector: '[data-chat-help="session"]',
      titleKey: "chat.help.targets.session.title",
      bodyKey: "chat.help.targets.session.body",
    },
    {
      id: "volume",
      selector: '[data-chat-help="volume"]',
      titleKey: "chat.help.targets.volume.title",
      bodyKey: "chat.help.targets.volume.body",
    },
    {
      id: "assets",
      selector: '[data-chat-help="assets"]',
      titleKey: "chat.help.targets.assets.title",
      bodyKey: "chat.help.targets.assets.body",
    },
    ...commonToolbarTargets("context", "gallery", "connected-chat", "settings"),
    {
      id: "widgets",
      selector: "[data-game-widget-rail]",
      mergeMatches: true,
      titleKey: "chat.help.targets.widgets.title",
      bodyKey: "chat.help.targets.widgets.body",
    },
    {
      id: "dialogue",
      selector: '[data-tour="game-dialogue"]',
      titleKey: "chat.help.targets.dialogue.title",
      bodyKey: "chat.help.targets.dialogue.body",
    },
  ],
};

const TARGET_PADDING = 5;
const HIGHLIGHT_GAP = 5;
const MOBILE_TOOLBAR_HIGHLIGHT_SIZE = 32;

const ACTIONS_BY_MODE: Record<ChatMode, HelpActionDefinition[]> = {
  conversation: [
    { icon: Copy, labelKey: "chat.help.actions.copy" },
    { icon: SmilePlus, labelKey: "chat.help.actions.react" },
    { icon: Languages, labelKey: "chat.help.actions.translate" },
    { icon: Pencil, labelKey: "chat.help.actions.edit" },
    { icon: RefreshCw, labelKey: "chat.help.actions.regenerate" },
    { icon: ChevronsLeftRight, labelKey: "chat.help.actions.swipes" },
    { icon: EyeOff, labelKey: "chat.help.actions.aiVisibility" },
    { icon: Search, labelKey: "chat.help.actions.prompt" },
    { icon: GitBranch, labelKey: "chat.help.actions.branch" },
    { icon: ScrollText, labelKey: "chat.help.actions.guidance" },
    { icon: Brain, labelKey: "chat.help.actions.thinking" },
    { icon: Trash2, labelKey: "chat.help.actions.delete" },
  ],
  roleplay: [
    { icon: Copy, labelKey: "chat.help.actions.copy" },
    { icon: Languages, labelKey: "chat.help.actions.translate" },
    { icon: Pencil, labelKey: "chat.help.actions.edit" },
    { icon: Shield, labelKey: "chat.help.actions.rewrite" },
    { icon: RefreshCw, labelKey: "chat.help.actions.regenerateOrRestart" },
    { icon: ChevronsLeftRight, labelKey: "chat.help.actions.swipes" },
    { icon: Flag, labelKey: "chat.help.actions.conversationStart" },
    { icon: EyeOff, labelKey: "chat.help.actions.aiVisibility" },
    { icon: Search, labelKey: "chat.help.actions.prompt" },
    { icon: ScrollText, labelKey: "chat.help.actions.guidance" },
    { icon: Brain, labelKey: "chat.help.actions.thinking" },
    { icon: GitBranch, labelKey: "chat.help.actions.branchOrClone" },
    { icon: Trash2, labelKey: "chat.help.actions.delete" },
    { icon: Volume2, labelKey: "chat.help.actions.voice" },
    { icon: Play, labelKey: "chat.help.actions.voicePlayback" },
  ],
  game: [
    { icon: Copy, labelKey: "chat.help.actions.copyLog" },
    { icon: Pencil, labelKey: "chat.help.actions.editLog" },
    { icon: Languages, labelKey: "chat.help.actions.translateLog" },
    { icon: Search, labelKey: "chat.help.actions.prompt" },
    { icon: GitBranch, labelKey: "chat.help.actions.branchLog" },
    { icon: Trash2, labelKey: "chat.help.actions.deleteLog" },
    { icon: Volume2, labelKey: "chat.help.actions.voice" },
  ],
};

function rectFromDomRect(rect: DOMRect): Rect {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
  return { top, left, width: right - left, height: bottom - top };
}

function querySelectorAllDeep(root: Document | ShadowRoot | Element, selector: string): Element[] {
  const matches = Array.from(root.querySelectorAll(selector));
  if (root instanceof Element && root.shadowRoot) {
    matches.push(...querySelectorAllDeep(root.shadowRoot, selector));
  }
  for (const element of root.querySelectorAll("*")) {
    const shadowRoot = (element as HTMLElement).shadowRoot;
    if (shadowRoot) matches.push(...querySelectorAllDeep(shadowRoot, selector));
  }
  return matches;
}

function closestDeep(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    const match = current.closest(selector);
    if (match) return match;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

function visibleInteractiveElements(element: Element): HTMLElement[] {
  const descendants = querySelectorAllDeep(element, "button, [role='button'], input, textarea") as HTMLElement[];
  const candidates = element.matches("button, [role='button'], input, textarea")
    ? [element as HTMLElement, ...descendants]
    : descendants;
  return candidates.filter((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
}

function readVisibleRect(element: Element, preferInteractive = false): Rect | null {
  const ownRect = rectFromDomRect((element as HTMLElement).getBoundingClientRect());
  if (!preferInteractive && ownRect.width > 1 && ownRect.height > 1) return ownRect;

  const interactive = visibleInteractiveElements(element);
  const interactiveRects = interactive
    .map((child) => rectFromDomRect(child.getBoundingClientRect()))
    .filter((rect) => rect.width > 1 && rect.height > 1);
  const interactiveRect = unionRects(interactiveRects);
  if (interactiveRect) return interactiveRect;

  if (ownRect.width > 1 && ownRect.height > 1) return ownRect;
  return null;
}

function normalizeMobileToolbarRect(element: Element, rect: Rect): Rect {
  if (window.innerWidth >= 768) return rect;
  const interactive = visibleInteractiveElements(element).find((candidate) =>
    candidate.matches("button, [role='button']"),
  );
  if (!interactive || !closestDeep(interactive, "[data-chat-toolbar-overflow-menu]")) return rect;

  const interactiveRect = rectFromDomRect(interactive.getBoundingClientRect());
  return {
    top: interactiveRect.top + (interactiveRect.height - MOBILE_TOOLBAR_HIGHLIGHT_SIZE) / 2,
    left: interactiveRect.left + (interactiveRect.width - MOBILE_TOOLBAR_HIGHLIGHT_SIZE) / 2,
    width: MOBILE_TOOLBAR_HIGHLIGHT_SIZE,
    height: MOBILE_TOOLBAR_HIGHLIGHT_SIZE,
  };
}

function clipRect(rect: Rect, viewportWidth: number, viewportHeight: number): Rect | null {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.left + rect.width);
  const bottom = Math.min(viewportHeight, rect.top + rect.height);
  if (right - left <= 1 || bottom - top <= 1) return null;
  return { top, left, width: right - left, height: bottom - top };
}

function findTargetRect(definition: HelpTargetDefinition, root: HTMLElement, mode: ChatMode): Rect | null {
  if (definition.virtual === "composer") {
    const composer = root.querySelector<HTMLElement>("[data-chat-composer]");
    const shell = composer?.closest<HTMLElement>("[data-chat-resource-drop-exclude]") ?? composer;
    return shell ? readVisibleRect(shell) : null;
  }

  if (definition.virtual === "messages") {
    const scrollArea = root.querySelector<HTMLElement>("[data-chat-scroll]");
    if (!scrollArea) return null;
    const scrollRect = rectFromDomRect(scrollArea.getBoundingClientRect());
    const composer = root.querySelector<HTMLElement>("[data-chat-composer]");
    const composerShell = composer?.closest<HTMLElement>("[data-chat-resource-drop-exclude]") ?? composer;
    const composerRect = composerShell ? readVisibleRect(composerShell) : null;
    const topControls = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-chat-help="identity"], [data-roleplay-top-controls="right"], [data-chat-help="agents"]',
      ),
    )
      .map((element) => readVisibleRect(element, true))
      .filter((rect): rect is Rect => rect !== null);
    const top = Math.max(scrollRect.top + 8, ...topControls.map((rect) => rect.top + rect.height + 8));
    const bottom = Math.min(scrollRect.top + scrollRect.height - 8, (composerRect?.top ?? Infinity) - 8);
    if (bottom <= top) return null;

    const roleplayColumn = mode === "roleplay" ? root.querySelector<HTMLElement>("[data-roleplay-chat-column]") : null;
    const roleplayColumnRect = roleplayColumn ? readVisibleRect(roleplayColumn) : null;
    const columnInset = roleplayColumnRect ? TARGET_PADDING : 0;
    const left = Math.max(scrollRect.left + 8, (roleplayColumnRect?.left ?? -Infinity) + columnInset);
    const right = Math.min(
      scrollRect.left + scrollRect.width - 8,
      roleplayColumnRect?.left != null ? roleplayColumnRect.left + roleplayColumnRect.width - columnInset : Infinity,
    );
    return right > left ? { top, left, width: right - left, height: bottom - top } : null;
  }

  if (!definition.selector) return null;
  const preferInteractive = definition.selector.startsWith("[data-chat-help=");
  const rects = querySelectorAllDeep(document, definition.selector)
    .map((element) => {
      const rect = readVisibleRect(element, preferInteractive);
      return rect ? normalizeMobileToolbarRect(element, rect) : null;
    })
    .filter((rect): rect is Rect => rect !== null);
  return definition.mergeMatches ? unionRects(rects) : (rects[0] ?? null);
}

function expandRectWithin(rect: Rect, bounds: Rect, padding: number): Rect {
  const left = Math.max(bounds.left, rect.left - padding);
  const top = Math.max(bounds.top, rect.top - padding);
  const right = Math.min(bounds.left + bounds.width, rect.left + rect.width + padding);
  const bottom = Math.min(bounds.top + bounds.height, rect.top + rect.height + padding);
  return { top, left, width: right - left, height: bottom - top };
}

function separateHighlightRects(targets: MeasuredTarget[], bounds: Rect, padding = TARGET_PADDING): MeasuredTarget[] {
  const separated = targets.map((target) => ({ ...target, rect: expandRectWithin(target.rect, bounds, padding) }));
  for (let firstIndex = 0; firstIndex < separated.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < separated.length; secondIndex += 1) {
      const first = separated[firstIndex]!;
      const second = separated[secondIndex]!;
      const firstRight = first.rect.left + first.rect.width;
      const secondRight = second.rect.left + second.rect.width;
      const firstBottom = first.rect.top + first.rect.height;
      const secondBottom = second.rect.top + second.rect.height;
      const overlapX = Math.min(firstRight, secondRight) - Math.max(first.rect.left, second.rect.left);
      const overlapY = Math.min(firstBottom, secondBottom) - Math.max(first.rect.top, second.rect.top);
      if (overlapX <= 0 || overlapY <= 0) continue;

      const firstCenterX = first.rect.left + first.rect.width / 2;
      const secondCenterX = second.rect.left + second.rect.width / 2;
      const firstCenterY = first.rect.top + first.rect.height / 2;
      const secondCenterY = second.rect.top + second.rect.height / 2;
      const separateHorizontally = overlapX <= overlapY;

      if (separateHorizontally) {
        const [leftTarget, rightTarget] = firstCenterX <= secondCenterX ? [first, second] : [second, first];
        const overlapLeft = Math.max(leftTarget.rect.left, rightTarget.rect.left);
        const overlapRight = Math.min(
          leftTarget.rect.left + leftTarget.rect.width,
          rightTarget.rect.left + rightTarget.rect.width,
        );
        const split = (overlapLeft + overlapRight) / 2;
        const leftEdge = Math.max(leftTarget.rect.left + 1, split - HIGHLIGHT_GAP / 2);
        const rightEdge = Math.min(rightTarget.rect.left + rightTarget.rect.width - 1, split + HIGHLIGHT_GAP / 2);
        leftTarget.rect.width = Math.max(1, leftEdge - leftTarget.rect.left);
        const rightBoundary = rightTarget.rect.left + rightTarget.rect.width;
        rightTarget.rect.left = rightEdge;
        rightTarget.rect.width = Math.max(1, rightBoundary - rightEdge);
      } else {
        const [topTarget, bottomTarget] = firstCenterY <= secondCenterY ? [first, second] : [second, first];
        const overlapTop = Math.max(topTarget.rect.top, bottomTarget.rect.top);
        const overlapBottom = Math.min(
          topTarget.rect.top + topTarget.rect.height,
          bottomTarget.rect.top + bottomTarget.rect.height,
        );
        const split = (overlapTop + overlapBottom) / 2;
        const topEdge = Math.max(topTarget.rect.top + 1, split - HIGHLIGHT_GAP / 2);
        const bottomEdge = Math.min(bottomTarget.rect.top + bottomTarget.rect.height - 1, split + HIGHLIGHT_GAP / 2);
        topTarget.rect.height = Math.max(1, topEdge - topTarget.rect.top);
        const bottomBoundary = bottomTarget.rect.top + bottomTarget.rect.height;
        bottomTarget.rect.top = bottomEdge;
        bottomTarget.rect.height = Math.max(1, bottomBoundary - bottomEdge);
      }
    }
  }
  return separated;
}

function measureTargets(mode: ChatMode) {
  const root = Array.from(document.querySelectorAll<HTMLElement>(`[data-chat-mode="${mode}"]`)).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
  if (!root) return { rootRect: null, targets: [] as MeasuredTarget[] };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rootRect = clipRect(rectFromDomRect(root.getBoundingClientRect()), viewportWidth, viewportHeight);
  let targets = TARGETS_BY_MODE[mode].flatMap((definition) => {
    const measured = findTargetRect(definition, root, mode);
    const rect = measured ? clipRect(measured, viewportWidth, viewportHeight) : null;
    return rect ? [{ ...definition, rect }] : [];
  });
  const mobileOverflowRect =
    window.innerWidth < 768
      ? querySelectorAllDeep(document, "[data-chat-toolbar-overflow-menu]")
          .map((element) => readVisibleRect(element))
          .find((rect): rect is Rect => rect !== null)
      : null;
  if (mobileOverflowRect) {
    const railLeft = mobileOverflowRect.left - TARGET_PADDING;
    targets = targets.map((target) => {
      const targetBottom = target.rect.top + target.rect.height;
      const railBottom = mobileOverflowRect.top + mobileOverflowRect.height;
      const overlapsRailVertically = target.rect.top < railBottom && targetBottom > mobileOverflowRect.top;
      const reachesBehindRail = target.rect.left < railLeft && target.rect.left + target.rect.width > railLeft;
      return overlapsRailVertically && reachesBehindRail
        ? { ...target, rect: { ...target.rect, width: railLeft - target.rect.left } }
        : target;
    });
  }
  const highlightPadding = window.innerWidth < 768 ? 0 : TARGET_PADDING;
  if (!rootRect) return { rootRect, targets };

  const fixedMobileToolbarRects = new Map(
    mobileOverflowRect
      ? targets
          .filter((target) => {
            const centerX = target.rect.left + target.rect.width / 2;
            const centerY = target.rect.top + target.rect.height / 2;
            return (
              centerX >= mobileOverflowRect.left &&
              centerX <= mobileOverflowRect.left + mobileOverflowRect.width &&
              centerY >= mobileOverflowRect.top &&
              centerY <= mobileOverflowRect.top + mobileOverflowRect.height &&
              target.rect.width === MOBILE_TOOLBAR_HIGHLIGHT_SIZE &&
              target.rect.height === MOBILE_TOOLBAR_HIGHLIGHT_SIZE
            );
          })
          .map((target) => [target.id, target.rect] as const)
      : [],
  );
  const separated = separateHighlightRects(targets, rootRect, highlightPadding);
  return {
    rootRect,
    targets: separated.map((target) => ({
      ...target,
      rect: fixedMobileToolbarRects.get(target.id) ?? target.rect,
    })),
  };
}

function getLegendStyle(rootRect: Rect): CSSProperties {
  return {
    left: rootRect.left + 16,
    bottom: Math.max(16, window.innerHeight - rootRect.top - rootRect.height + 16),
    width: Math.min(390, Math.max(280, rootRect.width * 0.38)),
    maxHeight: `min(58dvh, ${Math.max(240, rootRect.height - 96)}px)`,
  };
}

function getMobileDetailStyle(rootRect: Rect): CSSProperties {
  return {
    left: Math.max(12, rootRect.left + 12),
    right: Math.max(12, window.innerWidth - rootRect.left - rootRect.width + 12),
    bottom: Math.max(12, window.innerHeight - rootRect.top - rootRect.height + 12),
    maxHeight: "min(44dvh, 22rem)",
  };
}

function getHoverCardStyle(point: { x: number; y: number }): CSSProperties {
  const showToRight = point.x + 304 <= window.innerWidth;
  const showBelow = point.y + 128 <= window.innerHeight;
  return {
    ...(showToRight ? { left: point.x + 14 } : { right: window.innerWidth - point.x + 14 }),
    ...(showBelow ? { top: point.y + 14 } : { bottom: window.innerHeight - point.y + 14 }),
    width: "min(18rem, calc(100vw - 1.5rem))",
  };
}

function targetIncludesActionLegend(mode: ChatMode, id: HelpTargetId): boolean {
  return id === "messages" || (mode === "game" && id === "dialogue");
}

function MessageActionLegend({ mode }: { mode: ChatMode }) {
  const { t } = useTranslation();
  return (
    <section
      data-chat-help-action-legend={mode}
      className="border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5"
    >
      <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--marinara-chat-chrome-panel-title)]">
        {t(mode === "game" ? "chat.help.actions.logTitle" : "chat.help.actions.messageTitle")}
      </h3>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {ACTIONS_BY_MODE[mode].map(({ icon: Icon, labelKey }) => (
          <li
            key={labelKey}
            className="flex min-w-0 items-start gap-1.5 text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)]"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]">
              <Icon size="0.6875rem" />
            </span>
            <span>{t(labelKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function measurementsSignature(rootRect: Rect | null, targets: MeasuredTarget[]) {
  return JSON.stringify([
    rootRect,
    targets.map(({ id, rect }) => [
      id,
      Math.round(rect.top),
      Math.round(rect.left),
      Math.round(rect.width),
      Math.round(rect.height),
    ]),
  ]);
}

export function ChatHelpOverlay({
  mode,
  activeChatId,
  isFirstChat,
  autoOpenBlocked,
}: {
  mode: ChatMode;
  activeChatId: string;
  isFirstChat: boolean;
  autoOpenBlocked: boolean;
}) {
  const { t } = useTranslation();
  const seenModes = useUIStore((state) => state.chatHelpSeenModes ?? []);
  const chatHelpButtonHidden = useUIStore((state) => state.chatHelpButtonHidden ?? false);
  const markChatHelpSeen = useUIStore((state) => state.markChatHelpSeen);
  const setChatHelpButtonHidden = useUIStore((state) => state.setChatHelpButtonHidden);
  const [open, setOpen] = useState(false);
  const [rootRect, setRootRect] = useState<Rect | null>(null);
  const [targets, setTargets] = useState<MeasuredTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<HelpTargetId | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<HelpTargetId | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const measurementSignatureRef = useRef("");
  const autoOpenedChatRef = useRef<string | null>(null);
  const maskId = `chat-help-mask-${useId().replace(/:/gu, "")}`;

  useEffect(() => {
    const handleOpen = (event: Event) => {
      if (chatHelpButtonHidden || readChatHelpEventMode(event) !== mode) return;
      setOpen(true);
    };
    const handleClose = (event: Event) => {
      if (readChatHelpEventMode(event) === mode) setOpen(false);
    };
    window.addEventListener(CHAT_HELP_OPEN_REQUEST_EVENT, handleOpen);
    window.addEventListener(CHAT_HELP_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(CHAT_HELP_OPEN_REQUEST_EVENT, handleOpen);
      window.removeEventListener(CHAT_HELP_CLOSE_EVENT, handleClose);
    };
  }, [chatHelpButtonHidden, mode]);

  useEffect(() => {
    if (
      chatHelpButtonHidden ||
      autoOpenBlocked ||
      !isFirstChat ||
      seenModes.includes(mode) ||
      autoOpenedChatRef.current === activeChatId
    ) {
      return;
    }
    const root = document.querySelector<HTMLElement>(`[data-chat-mode="${mode}"]`);
    if (!root || root.getBoundingClientRect().width <= 1) return;
    const timer = window.setTimeout(() => {
      autoOpenedChatRef.current = activeChatId;
      requestChatHelp(mode);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeChatId, autoOpenBlocked, chatHelpButtonHidden, isFirstChat, mode, seenModes]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      const next = measureTargets(mode);
      const signature = measurementsSignature(next.rootRect, next.targets);
      if (signature !== measurementSignatureRef.current) {
        measurementSignatureRef.current = signature;
        setRootRect(next.rootRect);
        setTargets(next.targets);
      }
    };
    const scheduleMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    for (const element of document.querySelectorAll<HTMLElement>(`[data-chat-mode="${mode}"]`)) {
      observer.observe(element);
    }
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        markChatHelpSeen(mode);
        closeChatHelp(mode);
        return;
      }
      if (event.key !== "Tab" || !overlayRef.current) return;

      const focusable = Array.from(
        overlayRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && (document.activeElement === first || document.activeElement === overlayRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [markChatHelpSeen, mode, open]);

  const dismiss = useCallback(() => {
    markChatHelpSeen(mode);
    closeChatHelp(mode);
  }, [markChatHelpSeen, mode]);
  const hideHelpButton = useCallback(() => {
    setChatHelpButtonHidden(true);
    closeChatHelp(mode);
  }, [mode, setChatHelpButtonHidden]);

  const legendStyle = useMemo(() => (rootRect ? getLegendStyle(rootRect) : undefined), [rootRect]);
  const mobileDetailStyle = useMemo(() => (rootRect ? getMobileDetailStyle(rootRect) : undefined), [rootRect]);
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const selectedTarget = targets.find((target) => target.id === selectedTargetId) ?? null;
  const hoveredTarget = targets.find((target) => target.id === hoveredTargetId) ?? null;

  useEffect(() => {
    if (open) return;
    setSelectedTargetId(null);
    setHoveredTargetId(null);
    setHoverPoint(null);
  }, [open]);

  if (!open || !rootRect || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      data-chat-help-overlay={mode}
      role="dialog"
      aria-modal="true"
      aria-label={t("chat.help.overlayLabel")}
      tabIndex={-1}
      className={cn(
        "mari-chrome-token-scope fixed inset-0 z-[10050] outline-none",
        mobile ? "cursor-default" : "cursor-pointer",
      )}
      onPointerDown={mobile ? undefined : dismiss}
    >
      <svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <rect x={rootRect.left} y={rootRect.top} width={rootRect.width} height={rootRect.height} fill="white" />
            {targets.map(({ id, rect }) => (
              <rect key={id} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="10" fill="black" />
            ))}
          </mask>
        </defs>
        <rect
          x={rootRect.left}
          y={rootRect.top}
          width={rootRect.width}
          height={rootRect.height}
          mask={`url(#${maskId})`}
          style={{ fill: "color-mix(in srgb, var(--background) 82%, transparent)" }}
        />
      </svg>

      {targets.map((target, index) => (
        <button
          type="button"
          aria-label={[t(target.titleKey), t(target.bodyKey)].join(": ")}
          key={target.id}
          data-chat-help-highlight={target.id}
          className={cn(
            "fixed rounded-[0.625rem] bg-transparent ring-2 ring-[var(--marinara-chat-chrome-focus-ring)] shadow-[0_0_18px_color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_45%,transparent)] outline-none transition-[box-shadow,background-color] duration-150 focus-visible:bg-[color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_9%,transparent)] focus-visible:shadow-[0_0_30px_color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_72%,transparent)]",
            mobile
              ? "cursor-pointer"
              : "cursor-help hover:bg-[color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_9%,transparent)] hover:shadow-[0_0_30px_color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_72%,transparent)]",
          )}
          style={{
            top: target.rect.top,
            left: target.rect.left,
            width: target.rect.width,
            height: target.rect.height,
          }}
          onPointerDown={(event) => {
            if (mobile) event.stopPropagation();
          }}
          onClick={() => {
            if (mobile) setSelectedTargetId(target.id);
          }}
          onPointerEnter={(event) => {
            if (mobile) return;
            setHoveredTargetId(target.id);
            setHoverPoint({ x: event.clientX, y: event.clientY });
          }}
          onPointerMove={(event) => {
            if (mobile) return;
            setHoverPoint({ x: event.clientX, y: event.clientY });
          }}
          onPointerLeave={() => {
            setHoveredTargetId(null);
            setHoverPoint(null);
          }}
          onFocus={() => {
            if (mobile) return;
            setHoveredTargetId(target.id);
            setHoverPoint({
              x: target.rect.left + target.rect.width / 2,
              y: target.rect.top + target.rect.height / 2,
            });
          }}
          onBlur={() => {
            setHoveredTargetId(null);
            setHoverPoint(null);
          }}
        >
          <span className="pointer-events-none absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-button-bg-active)] px-1 text-[0.5625rem] font-bold leading-none text-[var(--marinara-chat-chrome-button-text-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]">
            {index + 1}
          </span>
        </button>
      ))}

      {!mobile && hoveredTarget && hoverPoint && (
        <div
          data-chat-help-hover-card={hoveredTarget.id}
          className={cn(
            NEUTRAL_PANEL_SHELL,
            "pointer-events-none fixed border-[var(--marinara-chat-chrome-button-border-active)] px-3 py-2 text-xs leading-4 shadow-xl",
          )}
          style={getHoverCardStyle(hoverPoint)}
        >
          <strong className="font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            {t(hoveredTarget.titleKey)}
          </strong>
          <p className="mt-0.5 text-[var(--marinara-chat-chrome-panel-muted)]">{t(hoveredTarget.bodyKey)}</p>
        </div>
      )}

      <div
        className="pointer-events-none fixed flex max-w-[calc(100vw-1.5rem)] flex-col items-center gap-1.5"
        style={{
          top: rootRect.top + 10,
          left: Math.max(rootRect.left + 12, rootRect.left + rootRect.width / 2),
          transform: "translateX(-50%)",
        }}
      >
        {mobile ? (
          <button
            type="button"
            className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--card)] px-3 py-2 text-left text-xs font-semibold leading-4 text-[var(--foreground)] shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={dismiss}
          >
            <CircleHelp size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span>{t("chat.help.mobileInstruction")}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-lg">
            <CircleHelp size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span>{t("chat.help.exitInstruction")}</span>
          </div>
        )}
        <button
          type="button"
          className="mari-chrome-control pointer-events-auto min-h-7 px-2.5 text-[0.625rem] shadow-lg"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={hideHelpButton}
        >
          <EyeOff size="0.6875rem" />
          {t("chat.help.hidePermanently")}
        </button>
      </div>

      {!mobile && (
        <div
          data-chat-help-legend
          className={cn(
            NEUTRAL_PANEL_SHELL,
            "pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden border-[var(--marinara-chat-chrome-button-border-active)] shadow-xl",
          )}
          style={legendStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5">
            <CircleHelp size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              {t(`chat.help.mode.${mode}`)}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ol className="space-y-2 px-3 py-2.5">
              {targets.map((target, index) => (
                <li key={target.id} data-chat-help-entry={target.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-button-bg-active)] px-1 text-[0.5625rem] font-bold text-[var(--marinara-chat-chrome-button-text-active)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-xs leading-4 text-[var(--marinara-chat-chrome-panel-muted)]">
                    <strong className="font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                      {t(target.titleKey)}:
                    </strong>{" "}
                    {t(target.bodyKey)}
                  </span>
                </li>
              ))}
            </ol>
            <MessageActionLegend mode={mode} />
          </div>
        </div>
      )}

      {mobile && selectedTarget && (
        <div
          data-chat-help-mobile-detail={selectedTarget.id}
          aria-live="polite"
          className={cn(
            NEUTRAL_PANEL_SHELL,
            "pointer-events-auto fixed min-h-0 overflow-y-auto overscroll-contain border-[var(--marinara-chat-chrome-button-border-active)] shadow-xl",
          )}
          style={mobileDetailStyle}
        >
          <div className="px-3 py-2.5">
            <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              {t(selectedTarget.titleKey)}
            </h2>
            <p className="mt-1 text-xs leading-4 text-[var(--marinara-chat-chrome-panel-muted)]">
              {t(selectedTarget.bodyKey)}
            </p>
          </div>
          {targetIncludesActionLegend(mode, selectedTarget.id) && <MessageActionLegend mode={mode} />}
        </div>
      )}
    </div>,
    document.body,
  );
}
