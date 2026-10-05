import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ChatMode } from "@marinara-engine/shared";
import {
  Bookmark,
  Brain,
  ChevronsLeftRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Headphones,
  EyeOff,
  Flag,
  GitBranch,
  Languages,
  Lock,
  Pencil,
  RefreshCw,
  Reply,
  RotateCcw,
  ScrollText,
  Search,
  Shield,
  SmilePlus,
  Star,
  Trash2,
  Unlock,
  X,
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
import { getChatHelpTargets, type ChatHelpTargetDefinition, type ChatHelpTargetId } from "../../lib/chat-help-targets";
import { useUIStore } from "../../stores/ui.store";
import { NEUTRAL_PANEL_SHELL } from "../ui/neutral-surface-styles";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MeasuredTarget extends ChatHelpTargetDefinition {
  rect: Rect;
}

interface HelpActionDefinition {
  icon: LucideIcon;
  labelKey: string;
}

const HELP_OVERLAY_SELECTOR = "[data-chat-help-overlay]";
const FLOATING_WINDOW_SELECTOR = ".mari-window";
const TARGET_PADDING = 5;
const HIGHLIGHT_GAP = 5;
const MOBILE_TOOLBAR_HIGHLIGHT_SIZE = 32;
const SMALL_TARGET_PX = 40;
const SMALL_TARGET_BADGE_OFFSET = 12;
const PADDED_TARGET_IDS = new Set<ChatHelpTargetId>([
  "agents",
  "messages",
  "composer",
  "map",
  "party",
  "widgets",
  "dialogue",
]);

const ACTIONS_BY_MODE: Record<ChatMode, HelpActionDefinition[]> = {
  conversation: [
    { icon: Headphones, labelKey: "ui.chat.chatmessage.voiceControls" },
    { icon: Copy, labelKey: "chat.help.actions.copy" },
    { icon: Bookmark, labelKey: "chat.help.actions.bookmark" },
    { icon: Reply, labelKey: "chat.help.actions.reply" },
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
    { icon: Bookmark, labelKey: "chat.help.actions.bookmark" },
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
    { icon: Headphones, labelKey: "ui.chat.chatmessage.voiceControls" },
  ],
  game: [
    { icon: Copy, labelKey: "chat.help.actions.copyLog" },
    { icon: Pencil, labelKey: "chat.help.actions.editLog" },
    { icon: Languages, labelKey: "chat.help.actions.translateLog" },
    { icon: Search, labelKey: "chat.help.actions.prompt" },
    { icon: GitBranch, labelKey: "chat.help.actions.branchLog" },
    { icon: Trash2, labelKey: "chat.help.actions.deleteLog" },
    { icon: Headphones, labelKey: "ui.chat.chatmessage.voiceControls" },
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

function containsDeep(ancestor: Element, node: Element): boolean {
  let current: Element | null = node;
  while (current) {
    if (ancestor.contains(current)) return true;
    const rootNode = current.getRootNode();
    current = rootNode instanceof ShadowRoot ? rootNode.host : null;
  }
  return false;
}

/** True when something else, such as a floating window or an open menu, sits over the middle of a control. */
function isCoveredAtCenter(element: Element, rect: Rect): boolean {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
  const hit = document.elementsFromPoint(x, y).find((candidate) => !closestDeep(candidate, HELP_OVERLAY_SELECTOR));
  return !!hit && !containsDeep(element, hit) && !containsDeep(hit, element);
}

/** Open windows and the bubbles of minimized ones: large callouts stop short of both. */
function visibleFloatingWindowRects(): Rect[] {
  return Array.from(document.querySelectorAll(`${FLOATING_WINDOW_SELECTOR}, .mari-window-bubble`))
    .map((element) => rectFromDomRect(element.getBoundingClientRect()))
    .filter((rect) => rect.width > 1 && rect.height > 1);
}

/** The largest part of `rect` that `cut` leaves uncovered, or null when too little is left to point at. */
function subtractRect(rect: Rect, cut: Rect): Rect | null {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const cutLeft = Math.max(rect.left, cut.left);
  const cutTop = Math.max(rect.top, cut.top);
  const cutRight = Math.min(right, cut.left + cut.width);
  const cutBottom = Math.min(bottom, cut.top + cut.height);
  if (cutRight <= cutLeft || cutBottom <= cutTop) return rect;
  const remaining = [
    { top: rect.top, left: rect.left, width: cutLeft - rect.left, height: rect.height },
    { top: rect.top, left: cutRight, width: right - cutRight, height: rect.height },
    { top: rect.top, left: rect.left, width: rect.width, height: cutTop - rect.top },
    { top: cutBottom, left: rect.left, width: rect.width, height: bottom - cutBottom },
  ].sort((first, second) => second.width * second.height - first.width * first.height)[0]!;
  return remaining.width * remaining.height >= rect.width * rect.height * 0.25 ? remaining : null;
}

function inflateRect(rect: Rect, amount: number): Rect {
  return {
    top: rect.top - amount,
    left: rect.left - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function rectContainsCenter(bounds: Rect, rect: Rect): boolean {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return x >= bounds.left && x <= bounds.left + bounds.width && y >= bounds.top && y <= bounds.top + bounds.height;
}

function findTargetRect(definition: ChatHelpTargetDefinition, root: HTMLElement, mode: ChatMode): Rect | null {
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
    const topControls = Array.from(root.querySelectorAll<HTMLElement>("[data-chat-help]"))
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
  const elements = [
    ...new Set([
      ...querySelectorAllDeep(root, definition.selector),
      ...querySelectorAllDeep(document, definition.selector),
    ]),
  ];
  // Large regions are trimmed around windows later; a covered control is left out instead.
  const skipCovered = !PADDED_TARGET_IDS.has(definition.id) && !definition.mergeMatches;
  const rects = elements
    .map((element) => {
      const rect = readVisibleRect(element, preferInteractive);
      if (!rect || (skipCovered && isCoveredAtCenter(element, rect))) return null;
      return normalizeMobileToolbarRect(element, rect);
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
  // Controls outside the chat, such as the topbar button and the Chat Settings window, stay within the viewport.
  const viewport = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  const separated = targets.map((target) => ({
    ...target,
    rect: expandRectWithin(
      target.rect,
      rectContainsCenter(bounds, target.rect) ? bounds : viewport,
      PADDED_TARGET_IDS.has(target.id) ? padding : 0,
    ),
  }));
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
  if (!root) return { rootRect: null, surfaces: [] as Rect[], targets: [] as MeasuredTarget[] };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rootRect = clipRect(rectFromDomRect(root.getBoundingClientRect()), viewportWidth, viewportHeight);
  const highlightPadding = window.innerWidth < 768 ? 0 : TARGET_PADDING;
  const windowRects = visibleFloatingWindowRects();
  let targets = getChatHelpTargets(mode).flatMap((definition) => {
    const measured = findTargetRect(definition, root, mode);
    let rect = measured ? clipRect(measured, viewportWidth, viewportHeight) : null;
    if (rect && PADDED_TARGET_IDS.has(definition.id)) {
      // Leave room for the highlight padding, so a large region stops at a window's edge.
      rect = windowRects.reduce<Rect | null>(
        (visible, windowRect) => visible && subtractRect(visible, inflateRect(windowRect, highlightPadding)),
        rect,
      );
    }
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
  if (!rootRect) return { rootRect, surfaces: [], targets };

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
    // The overlay dims the chat and any open window around the labelled controls.
    surfaces: [rootRect, ...windowRects.flatMap((rect) => clipRect(rect, viewportWidth, viewportHeight) ?? [])],
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

/**
 * Number badges sit inside large regions. On small controls, such as the window's pin, lock and close
 * buttons, they sit on the top-left corner instead, so the icon or label underneath stays readable.
 */
function getBadgeOffset(rect: Rect, mobile: boolean): CSSProperties {
  // Phones keep the badge inside: their toolbar controls sit in a tight column.
  if (mobile || (rect.width >= SMALL_TARGET_PX && rect.height >= SMALL_TARGET_PX)) return { left: 4, top: 4 };
  // Kept on screen for controls at the very edge, such as the topbar button.
  return {
    left: Math.max(-SMALL_TARGET_BADGE_OFFSET, 2 - rect.left),
    top: Math.max(-SMALL_TARGET_BADGE_OFFSET, 2 - rect.top),
  };
}

function targetIncludesActionLegend(mode: ChatMode, id: ChatHelpTargetId): boolean {
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

function SettingsActionLegend({ mode }: { mode: ChatMode }) {
  const { t } = useTranslation();
  const actions = [
    { icon: <RotateCcw size="0.875rem" />, labelKey: "chat.help.settings.resetView" },
    { icon: <Star size="0.875rem" />, labelKey: "chat.help.settings.favoriteLayout" },
    ...(mode === "roleplay"
      ? [{ icon: <TrackerPanelIcon size="0.875rem" />, labelKey: "chat.help.settings.trackerPanel" }]
      : []),
    {
      icon: (
        <>
          <Lock size="0.875rem" />
          <Unlock size="0.875rem" />
        </>
      ),
      labelKey: "chat.help.settings.lock",
    },
    { icon: <X size="0.875rem" />, labelKey: "chat.help.settings.close" },
    { icon: <ExternalLink size="0.875rem" />, labelKey: "chat.help.settings.popOut" },
  ];
  return (
    <section
      data-chat-help-settings-legend={mode}
      className="border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5"
    >
      <h3 className="mb-2 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
        {t("chat.help.settings.iconsTitle")}
      </h3>
      <ul className="space-y-2">
        {actions.map(({ icon, labelKey }) => (
          <li
            key={labelKey}
            className="flex min-w-0 items-start gap-2 text-xs leading-4 text-[var(--marinara-chat-chrome-panel-muted)]"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-4 w-8 shrink-0 items-center justify-center gap-0.5 text-[var(--marinara-chat-chrome-button-text-active)]"
            >
              {icon}
            </span>
            <span>{t(labelKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function measurementsSignature(rootRect: Rect | null, surfaces: Rect[], targets: MeasuredTarget[]) {
  return JSON.stringify([
    window.innerWidth,
    window.innerHeight,
    rootRect,
    surfaces,
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
  const [surfaces, setSurfaces] = useState<Rect[]>([]);
  const [targets, setTargets] = useState<MeasuredTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<ChatHelpTargetId | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<ChatHelpTargetId | null>(null);
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
      const signature = measurementsSignature(next.rootRect, next.surfaces, next.targets);
      if (signature !== measurementSignatureRef.current) {
        measurementSignatureRef.current = signature;
        setRootRect(next.rootRect);
        setSurfaces(next.surfaces);
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
    // Controls can move without the chat resizing, e.g. a toolbar expanding after a window resize
    // or Chat Settings mounting, so re-measure when the chat or a window changes too.
    const mutations = new MutationObserver(scheduleMeasure);
    for (const element of document.querySelectorAll<HTMLElement>(`[data-chat-mode="${mode}"], .mari-window`)) {
      observer.observe(element);
      mutations.observe(element, { attributes: true, childList: true, subtree: true });
    }
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Captured on the document and marked handled, so a window under the overlay keeps this press.
        event.preventDefault();
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
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [markChatHelpSeen, mode, open]);

  // The overlay renders once the chat is measured, which can be a render after it opens.
  const overlayShown = open && rootRect !== null;
  useEffect(() => {
    if (overlayShown) overlayRef.current?.focus({ preventScroll: true });
  }, [overlayShown]);

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
  const hideHelpButtonControl = (
    <button
      type="button"
      className="mari-chrome-control pointer-events-auto min-h-7 px-2.5 text-[0.625rem] shadow-lg"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={hideHelpButton}
    >
      <EyeOff size="0.6875rem" />
      {t("chat.help.hidePermanently")}
    </button>
  );

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
            {surfaces.map((surface, index) => (
              <rect
                key={index}
                x={surface.left}
                y={surface.top}
                width={surface.width}
                height={surface.height}
                fill="white"
              />
            ))}
            {targets.map(({ id, rect }) => (
              <rect key={id} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="8" fill="black" />
            ))}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
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
            "fixed rounded-lg bg-transparent ring-2 ring-[var(--marinara-chat-chrome-focus-ring)] shadow-[0_0_18px_color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_45%,transparent)] outline-none transition-[box-shadow,background-color] duration-150 focus-visible:bg-[color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_9%,transparent)] focus-visible:shadow-[0_0_30px_color-mix(in_srgb,var(--marinara-chat-chrome-focus-ring)_72%,transparent)]",
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
          <span
            className="pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-button-bg-active)] px-1 text-[0.5625rem] font-bold leading-none text-[var(--marinara-chat-chrome-button-text-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]"
            style={getBadgeOffset(target.rect, mobile)}
          >
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

      {mobile && (
        <div
          className="pointer-events-none fixed flex max-w-[calc(100vw-1.5rem)] flex-col items-center gap-1.5"
          style={{
            top: rootRect.top + 10,
            left: Math.max(rootRect.left + 12, rootRect.left + rootRect.width / 2),
            transform: "translateX(-50%)",
          }}
        >
          <button
            type="button"
            className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--card)] px-3 py-2 text-left text-xs font-semibold leading-4 text-[var(--foreground)] shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={dismiss}
          >
            <CircleHelp size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span>{t("chat.help.mobileInstruction")}</span>
          </button>
          {hideHelpButtonControl}
        </div>
      )}

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
          {/* On desktop the exit hint lives here, so it never covers the chat's controls or an open window. */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2">
            <span className="text-[0.6875rem] font-medium leading-4 text-[var(--marinara-chat-chrome-panel-muted)]">
              {t("chat.help.exitInstruction")}
            </span>
            {hideHelpButtonControl}
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
              {t(selectedTarget.id === "settings" ? "chat.help.settings.introduction" : selectedTarget.bodyKey)}
            </p>
          </div>
          {selectedTarget.id === "settings" && <SettingsActionLegend mode={mode} />}
          {targetIncludesActionLegend(mode, selectedTarget.id) && <MessageActionLegend mode={mode} />}
        </div>
      )}
    </div>,
    document.body,
  );
}
