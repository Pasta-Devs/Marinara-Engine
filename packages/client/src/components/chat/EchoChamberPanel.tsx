// ──────────────────────────────────────────────
// Echo Chamber Overlay — compact translucent stream-chat widget
// Messages appear one-by-one with a short stream-chat delay, auto-scrolling.
// Positions itself within the chat area, respecting sidebar, right panel,
// HUD widget position (top/left/right), and the top bar.
// ──────────────────────────────────────────────
import { useRef, useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import { MessageCircle, Trash2, RefreshCw } from "lucide-react";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import type { EchoChamberSide } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { hasActiveTextSelection } from "../../lib/text-selection";
import { useChat } from "../../hooks/use-chats";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useGenerate } from "../../hooks/use-generate";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { FloatingWindow, readFloatingWindowBounds, usePhoneBubbleBounds } from "../ui/FloatingWindow";
import { WindowBubble } from "../ui/WindowBubble";
import {
  PHONE_BUBBLE_Z_INDEX,
  TRACKER_PANEL_BUBBLE_ID,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";
import { PHONE_BUBBLE_SIZE_PX, type WindowBounds, type WindowLayout } from "../../lib/floating-window-layout";
import {
  getEchoChamberMessageInterval,
  normalizeEchoChamberMessageDelaySeconds,
  resolveEchoChamberPersistedBaseline,
} from "../../lib/echo-chamber-queue";
import { resolveEchoChamberTopLayout } from "../../lib/echo-chamber-layout";
import { useTranslation as useUiTranslation } from "react-i18next";
import { parseAgentSettingsRecord } from "@marinara-engine/shared";

const NAME_COLORS = [
  "text-red-400",
  "text-blue-400",
  "text-green-400",
  "text-yellow-400",
  "text-cyan-400",
  "text-orange-400",
  "text-emerald-400",
  "text-amber-400",
  "text-teal-400",
  "text-lime-400",
  "text-sky-400",
  "text-stone-300",
];

const CORNERS: EchoChamberSide[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const CORNER_LABELS: Record<EchoChamberSide, string> = {
  "top-left": "ui.chat.echochamberpanel.corner.topLeft",
  "top-right": "ui.chat.echochamberpanel.corner.topRight",
  "bottom-left": "ui.chat.echochamberpanel.corner.bottomLeft",
  "bottom-right": "ui.chat.echochamberpanel.corner.bottomRight",
};

// Layout constants (px)
const WIDGET_BAR_H = 76; // top HUD toolbar: py-2 (16px) + widget buttons h-[3.75rem] (60px)
const INPUT_BOX_H = 72; // bottom chat input area height
const FLOATING_EDGE_GAP = 16;
const FLOATING_PANEL_STACK_GAP = 8;
const TOP_BUTTON_GAP = 6; // Matches the tracker panel gap below the top controls.
const DESKTOP_PANEL_WIDTH = 236;
const DEFAULT_DESKTOP_PANEL_MAX_HEIGHT = 352;
const DEFAULT_MOBILE_PANEL_HEIGHT = 112;
const MIN_MOBILE_PANEL_WIDTH = 240;
const MIN_PANEL_WIDTH = 176;
const MIN_PANEL_HEIGHT = 96;
const ECHO_WINDOW_ID = "echo-chamber";
const ROLEPLAY_AREA_SELECTOR = ".rpg-chat-area";
const ROLEPLAY_TOP_ANCHOR_SELECTOR = '[data-tracker-panel-anchor="roleplay-hud"]';
const ROLEPLAY_TOP_RIGHT_CONTROLS_SELECTOR = '[data-roleplay-top-controls="right"]';
const TRACKER_PANEL_SELECTOR_PREFIX = '[data-component="TrackerDataSidebarDesktop.';

interface EchoChamberPanelProps {
  hiddenOnMobile?: boolean;
}

function readVisibleRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(element).display === "none") return null;
  return rect;
}

function findVisibleHud(): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(".rpg-hud");
  for (const el of els) {
    if (readVisibleRect(el)) return el;
  }
  return null;
}

function findVisibleElement(selector: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(selector);
  for (const el of els) {
    if (readVisibleRect(el)) return el;
  }
  return null;
}

function getRoleplayAreaRect() {
  return document.querySelector<HTMLElement>(ROLEPLAY_AREA_SELECTOR)?.getBoundingClientRect() ?? null;
}

function getDesktopAlignmentElement(isLeft: boolean) {
  return isLeft
    ? (findVisibleHud() ?? findVisibleElement(ROLEPLAY_TOP_ANCHOR_SELECTOR))
    : findVisibleElement(ROLEPLAY_TOP_RIGHT_CONTROLS_SELECTOR);
}

function getDesktopTrackerPanel(isLeft: boolean) {
  return document.querySelector<HTMLElement>(`${TRACKER_PANEL_SELECTOR_PREFIX}${isLeft ? "left" : "right"}"]`);
}

function getTopChromeBottomOffset(containerRect: DOMRect, alignmentRect: DOMRect | null) {
  const candidates: number[] = [];
  const anchors = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_TOP_ANCHOR_SELECTOR));
  anchors.forEach((anchor) => {
    const rect = readVisibleRect(anchor);
    if (rect) candidates.push(Math.ceil(rect.bottom - containerRect.top + TOP_BUTTON_GAP));
  });
  if (alignmentRect) candidates.push(Math.ceil(alignmentRect.bottom - containerRect.top + TOP_BUTTON_GAP));

  return candidates.length > 0 ? Math.max(TOP_BUTTON_GAP, ...candidates) : WIDGET_BAR_H + TOP_BUTTON_GAP;
}

function getDesktopPanelPosition(isTop: boolean, isLeft: boolean, stackBelowTracker: boolean): CSSProperties {
  const containerRect = getRoleplayAreaRect();
  const alignmentElement = getDesktopAlignmentElement(isLeft);
  const alignmentRect = alignmentElement ? readVisibleRect(alignmentElement) : null;
  const trackerPanel = isTop && stackBelowTracker ? getDesktopTrackerPanel(isLeft) : null;
  const edgeOffset =
    alignmentRect && containerRect
      ? Math.max(0, Math.round(alignmentRect.left - containerRect.left))
      : FLOATING_EDGE_GAP;
  const baseTop = isTop && containerRect ? getTopChromeBottomOffset(containerRect, alignmentRect) : undefined;
  const topLayout =
    baseTop !== undefined && containerRect
      ? resolveEchoChamberTopLayout({
          baseTop,
          containerTop: containerRect.top,
          containerBottom: containerRect.bottom,
          viewportBottom: window.innerHeight,
          bottomClearance: INPUT_BOX_H + FLOATING_EDGE_GAP,
          trackerBottom: trackerPanel ? trackerPanel.offsetTop + trackerPanel.offsetHeight : null,
          stackGap: FLOATING_PANEL_STACK_GAP,
        })
      : null;

  return {
    ...(topLayout && { top: topLayout.top, maxHeight: topLayout.maxHeight }),
    ...(!isTop && { bottom: INPUT_BOX_H + FLOATING_EDGE_GAP }),
    ...(isLeft && { left: `${edgeOffset}px` }),
    ...(!isLeft && { right: FLOATING_EDGE_GAP }),
    width: `${DESKTOP_PANEL_WIDTH}px`,
  };
}

/** Tiny 4-square grid icon; the active corner is highlighted. */
function CornerPicker({
  current,
  onChange,
  disabled,
}: {
  current: EchoChamberSide;
  onChange: (c: EchoChamberSide) => void;
  disabled: boolean;
}) {
  const { t } = useUiTranslation();
  if (typeof window !== "undefined" && window.innerWidth < 768) return null;
  return (
    <div className="grid grid-cols-2 gap-px">
      {CORNERS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          disabled={disabled}
          className={cn(
            "h-[0.4375rem] w-[0.4375rem] rounded-[0.09375rem] transition-colors disabled:opacity-40",
            c === current ? "bg-current" : "bg-current opacity-30 hover:opacity-70",
          )}
          title={t(CORNER_LABELS[c])}
          aria-label={t(CORNER_LABELS[c])}
          aria-pressed={c === current}
        />
      ))}
    </div>
  );
}

export function EchoChamberPanel({ hiddenOnMobile = false }: EchoChamberPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const echoChamberSide = useUIStore((s) =>
    activeChatId ? (s.echoChamberSideByChatId[activeChatId] ?? s.echoChamberSide) : s.echoChamberSide,
  );
  const setEchoChamberSideForChat = useUIStore((s) => s.setEchoChamberSideForChat);
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const useWidgetTextColor = useUIStore((s) => s.chatWidgetPreset !== "default" || !!s.chatWidgetTextColor);
  const rememberedPanelSize = useUIStore((s) =>
    activeChatId ? (s.echoChamberSizeByChatId[activeChatId] ?? null) : null,
  );
  const savedLayout = useFloatingWindowStore((s) => s.layouts[ECHO_WINDOW_ID]);
  const savedPhoneBubble = useFloatingWindowStore((s) => s.phoneBubbles[ECHO_WINDOW_ID]);
  const saveLayout = useFloatingWindowStore((s) => s.saveLayout);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelSelected = useUIStore((s) => s.trackerPanelOpen);
  const trackerPanelSurfaceOpen = useFloatingWindowStore((s) => s.open[TRACKER_PANEL_BUBBLE_ID] === true);
  const trackerPanelOpen = trackerPanelSelected && trackerPanelSurfaceOpen;
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  const echoMessages = useAgentStore((s) => s.echoMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phoneBubbleRef = useRef<HTMLButtonElement>(null);
  const [defaultPanelHeight, setDefaultPanelHeight] = useState(MIN_PANEL_HEIGHT);

  const isAgentProcessing = useAgentStore((s) =>
    activeChatId ? s.processingChatIds.includes(activeChatId) : s.isProcessing,
  );
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const { data: chat } = useChat(activeChatId);
  const { data: agentConfigs } = useAgentConfigs();
  const { retryAgents } = useGenerate();
  const echoRetryBusy = isAgentProcessing || (isStreaming && streamingChatId === activeChatId);

  // Mirror the enabledAgentTypes logic from ChatArea so per-chat overrides are respected
  const echoEnabled = useMemo(() => {
    if (!chat) return false;
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> }).metadata;
    let meta: Record<string, unknown>;
    try {
      meta = typeof raw === "string" ? JSON.parse(raw) : ((raw ?? {}) as Record<string, unknown>);
    } catch {
      return false;
    }
    if (!meta.enableAgents) return false;
    const activeAgentIds: string[] = Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : [];
    return activeAgentIds.includes("echo-chamber");
  }, [chat]);
  const messageDelaySeconds = useMemo(() => {
    const config = agentConfigs?.find((agent) => agent.type === "echo-chamber");
    return normalizeEchoChamberMessageDelaySeconds(parseAgentSettingsRecord(config?.settings).messageDelaySeconds);
  }, [agentConfigs]);

  // ── Timed reveal: show one more message after each short chat-like delay ──
  // visibleCount and baseline live in the Zustand store so they survive
  // component remounts (e.g. when the panel is toggled or the HUD re-renders).
  const visibleCount = useAgentStore((s) => s.echoVisibleCount);
  const baseline = useAgentStore((s) => s.echoBaseline);
  const setEchoVisibleCount = useAgentStore((s) => s.setEchoVisibleCount);
  const revealNextEchoMessage = useAgentStore((s) => s.revealNextEchoMessage);
  const setEchoBaseline = useAgentStore((s) => s.setEchoBaseline);

  // ── Load persisted echo messages when chat changes ──
  const setEchoMessages = useAgentStore((s) => s.setEchoMessages);
  const clearEchoMessages = useAgentStore((s) => s.clearEchoMessages);
  const echoLoadedChatId = useAgentStore((s) => s.echoLoadedChatId);
  const setEchoLoadedChatId = useAgentStore((s) => s.setEchoLoadedChatId);

  useEffect(() => {
    if (!activeChatId || !echoEnabled) return;
    // Already loaded for this chat (survives component remounts)
    if (echoLoadedChatId === activeChatId) return;

    const previousChatId = echoLoadedChatId;

    // Only clear + reset when switching to a *different* chat
    if (previousChatId !== null && previousChatId !== activeChatId) {
      clearEchoMessages();
    }
    // clearEchoMessages resets the loaded ID, so claim the new chat after it.
    setEchoLoadedChatId(activeChatId);

    const loadStartedAt = Date.now();
    api
      .get<Array<{ characterName: string; reaction: string; timestamp: number }>>(
        `/agents/echo-messages/${activeChatId}`,
      )
      .then((msgs) => {
        if (useAgentStore.getState().echoLoadedChatId !== activeChatId) return; // stale
        if (msgs.length > 0) {
          // If real-time messages already arrived (via addEchoMessage from SSE),
          // don't overwrite visibleCount — the stagger timer owns it.
          const alreadyHasMessages = useAgentStore.getState().echoMessages.length > 0;
          setEchoMessages(msgs);
          if (!alreadyHasMessages) {
            // Fresh load (page refresh) — show all persisted immediately.
            // Read the actual store length (may be capped) rather than the API
            // response length — a mismatch causes the stagger guard to skip,
            // making new messages dump all at once instead of one-by-one.
            const loadedMessages = useAgentStore.getState().echoMessages;
            const persistedBaseline = resolveEchoChamberPersistedBaseline(loadedMessages, loadStartedAt);
            setEchoVisibleCount(persistedBaseline);
            setEchoBaseline(persistedBaseline);
          }
        }
      })
      .catch(() => {
        /* silently ignore load failures */
      });
  }, [
    activeChatId,
    echoEnabled,
    echoLoadedChatId,
    setEchoLoadedChatId,
    setEchoMessages,
    clearEchoMessages,
    setEchoVisibleCount,
    setEchoBaseline,
  ]);

  // When new messages arrive beyond the baseline, stagger them one-by-one.
  useEffect(() => {
    if (visibleCount >= echoMessages.length) return;
    // Messages at or below the baseline are already visible
    if (visibleCount < baseline) {
      setEchoVisibleCount(baseline);
      return;
    }
    const id = setTimeout(revealNextEchoMessage, getEchoChamberMessageInterval(messageDelaySeconds));
    return () => clearTimeout(id);
  }, [visibleCount, echoMessages.length, baseline, messageDelaySeconds, revealNextEchoMessage, setEchoVisibleCount]);

  // Auto-scroll when a new message becomes visible
  useEffect(() => {
    if (hasActiveTextSelection()) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: streamingChatId === activeChatId ? "auto" : "smooth",
      });
    }
  }, [activeChatId, streamingChatId, visibleCount]);

  // Name → color map
  const nameColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of echoMessages) {
      if (!map.has(msg.characterName)) {
        let hash = 0;
        for (let i = 0; i < msg.characterName.length; i++)
          hash = msg.characterName.charCodeAt(i) + ((hash << 5) - hash);
        map.set(msg.characterName, NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]!);
      }
    }
    return map;
  }, [echoMessages]);

  // ── Compute position style relative to the chat area container ──
  const [posStyle, setPosStyle] = useState<CSSProperties>({});
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const minimized = savedLayout?.minimized ?? !echoChamberOpen;
  const mobileCollapsed = isMobile && minimized;
  const phoneBounds = usePhoneBubbleBounds(isMobile);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Only the initial height follows the reaction stream; a saved resize always wins.
  useEffect(() => {
    if (isMobile || minimized || rememberedPanelSize || !echoEnabled) return;
    const content = scrollRef.current?.firstElementChild;
    const header = scrollRef.current?.closest(".mari-window")?.querySelector(".mari-window__header");
    if (!content || !header) return;
    setDefaultPanelHeight(
      Math.min(
        DEFAULT_DESKTOP_PANEL_MAX_HEIGHT,
        Math.max(
          MIN_PANEL_HEIGHT,
          Math.ceil(content.getBoundingClientRect().height + header.getBoundingClientRect().height + 8),
        ),
      ),
    );
  }, [echoEnabled, isMobile, minimized, rememberedPanelSize, visibleCount]);

  const getDefaultLayout = useCallback(
    (bounds: WindowBounds): WindowLayout => {
      const area = getRoleplayAreaRect();
      if (isMobile) {
        return {
          x: bounds.left + 8,
          y: (area?.top ?? bounds.top) + Number(posStyle.top ?? WIDGET_BAR_H),
          width: rememberedPanelSize?.width ?? bounds.right - bounds.left - 16,
          height: rememberedPanelSize?.height ?? DEFAULT_MOBILE_PANEL_HEIGHT,
          pinned: true,
          locked: false,
          minimized: !echoChamberOpen,
        };
      }
      const isTop = echoChamberSide.startsWith("top");
      const isLeft = echoChamberSide.endsWith("left");
      const position = getDesktopPanelPosition(
        isTop,
        isLeft,
        isTop && trackerPanelEnabled && trackerPanelOpen && trackerPanelSide === (isLeft ? "left" : "right"),
      );
      const width = rememberedPanelSize?.width ?? DESKTOP_PANEL_WIDTH;
      const availableHeight = typeof position.maxHeight === "number" ? position.maxHeight : bounds.bottom - bounds.top;
      const height = Math.min(rememberedPanelSize?.height ?? defaultPanelHeight, availableHeight);
      return {
        x: isLeft
          ? (area?.left ?? bounds.left) + Number.parseFloat(String(position.left ?? FLOATING_EDGE_GAP))
          : (area?.right ?? bounds.right) - FLOATING_EDGE_GAP - width,
        y: isTop
          ? (area?.top ?? bounds.top) + Number(position.top ?? WIDGET_BAR_H)
          : (area?.bottom ?? bounds.bottom) - INPUT_BOX_H - FLOATING_EDGE_GAP - height,
        width,
        height,
        pinned: true,
        locked: false,
        minimized: !echoChamberOpen,
      };
    },
    [
      defaultPanelHeight,
      echoChamberOpen,
      echoChamberSide,
      isMobile,
      posStyle.top,
      rememberedPanelSize,
      trackerPanelEnabled,
      trackerPanelOpen,
      trackerPanelSide,
    ],
  );

  const setEchoChamberSide = (side: EchoChamberSide) => {
    if (!activeChatId || savedLayout?.locked) return;
    setEchoChamberSideForChat(activeChatId, side);
    const current = savedLayout ?? getDefaultLayout(readFloatingWindowBounds());
    const area = getRoleplayAreaRect();
    const bounds = readFloatingWindowBounds();
    const isTop = side.startsWith("top");
    const isLeft = side.endsWith("left");
    const position = getDesktopPanelPosition(
      isTop,
      isLeft,
      isTop && trackerPanelEnabled && trackerPanelOpen && trackerPanelSide === (isLeft ? "left" : "right"),
    );
    saveLayout(ECHO_WINDOW_ID, {
      ...current,
      x: isLeft
        ? (area?.left ?? bounds.left) + Number.parseFloat(String(position.left ?? FLOATING_EDGE_GAP))
        : (area?.right ?? bounds.right) - FLOATING_EDGE_GAP - current.width,
      y: isTop
        ? (area?.top ?? bounds.top) + Number(position.top ?? WIDGET_BAR_H)
        : (area?.bottom ?? bounds.bottom) - INPUT_BOX_H - FLOATING_EDGE_GAP - current.height,
    });
  };

  useEffect(() => {
    if (!echoEnabled) return;
    // On mobile, position below the HUD bar.
    if (isMobile) {
      const update = () => {
        const hudEl = findVisibleHud();
        // Position relative to container, so measure HUD bottom relative to rpg-chat-area
        const container = hudEl?.closest(".rpg-chat-area");
        const containerTop = container?.getBoundingClientRect().top ?? 0;
        const hudBottom = hudEl ? hudEl.getBoundingClientRect().bottom - containerTop : WIDGET_BAR_H;
        setPosStyle({ top: hudBottom + 8, left: 16, right: 16 });
      };

      update();

      const hudEl = findVisibleHud();
      let ro: ResizeObserver | undefined;
      if (hudEl) {
        ro = new ResizeObserver(update);
        ro.observe(hudEl);
      }

      return () => ro?.disconnect();
    }
    // Legacy anchors only choose the default. Saved shared-window geometry wins.
    const isTop = echoChamberSide.startsWith("top");
    const isLeft = echoChamberSide.endsWith("left");
    const stackBelowTracker =
      isTop && trackerPanelEnabled && trackerPanelOpen && trackerPanelSide === (isLeft ? "left" : "right");
    const update = () => {
      setPosStyle(getDesktopPanelPosition(isTop, isLeft, stackBelowTracker));
    };

    update();

    let frame = 0;
    let discoveryObserver: MutationObserver | null = null;
    const observedTargets = new Set<HTMLElement>();
    const observer = new ResizeObserver(() => scheduleUpdate());
    const observeTargets = () => {
      const roleplayAreas = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_AREA_SELECTOR));
      const topAnchors = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_TOP_ANCHOR_SELECTOR));
      const topRightControls = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_TOP_RIGHT_CONTROLS_SELECTOR));
      const huds = Array.from(document.querySelectorAll<HTMLElement>(".rpg-hud"));
      const trackerPanels = stackBelowTracker
        ? Array.from(
            document.querySelectorAll<HTMLElement>(`${TRACKER_PANEL_SELECTOR_PREFIX}${isLeft ? "left" : "right"}"]`),
          )
        : [];
      const targets = [...roleplayAreas, ...topAnchors, ...topRightControls, ...huds, ...trackerPanels];
      targets.forEach((target) => {
        if (observedTargets.has(target)) return;
        observer.observe(target);
        observedTargets.add(target);
      });
      return (
        roleplayAreas.length > 0 &&
        (isLeft ? huds.length > 0 : topRightControls.length > 0) &&
        (!stackBelowTracker || trackerPanels.length > 0)
      );
    };
    function scheduleUpdate() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const foundTargets = observeTargets();
        update();
        if (foundTargets) {
          discoveryObserver?.disconnect();
          discoveryObserver = null;
        }
      });
    }

    scheduleUpdate();
    discoveryObserver = new MutationObserver(() => scheduleUpdate());
    discoveryObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      discoveryObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [echoEnabled, echoChamberSide, isMobile, trackerPanelEnabled, trackerPanelOpen, trackerPanelSide]);

  useEffect(() => {
    if (!echoEnabled || (isMobile && hiddenOnMobile) || minimized) return;

    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl || hasActiveTextSelection()) return;
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "auto" });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [echoEnabled, hiddenOnMobile, isMobile, minimized]);

  if (!echoEnabled || (isMobile && hiddenOnMobile)) return null;
  const visibleMessages = echoMessages.slice(0, visibleCount);
  const title = localizeUi("ui.chat.echochamberpanel.title");
  const rootAttributes = {
    "data-roleplay-agent-window": "echo",
    "data-header-ornament": isMobile ? "inline" : undefined,
  };
  const status = (
    <span aria-hidden="true" className="relative flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
    </span>
  );

  // Echo keeps its compact phone view. Its saved minimized state and movable button
  // use the same layout as the desktop window, rather than a second position store.
  if (mobileCollapsed) {
    return (
      <WindowBubble
        buttonRef={phoneBubbleRef}
        id={ECHO_WINDOW_ID}
        point={
          savedPhoneBubble ?? {
            automatic: true,
            x: phoneBounds.left + FLOATING_EDGE_GAP,
            y: (getRoleplayAreaRect()?.top ?? 0) + Number(posStyle.top ?? WIDGET_BAR_H),
          }
        }
        bounds={phoneBounds}
        size={PHONE_BUBBLE_SIZE_PX}
        icon={<MessageCircle size="1rem" />}
        label={title}
        locked={savedLayout?.locked ?? false}
        zIndex={PHONE_BUBBLE_Z_INDEX}
        attributes={{ ...rootAttributes, "data-presentation": "sheet" }}
        onMove={(point) => useFloatingWindowStore.getState().savePhoneBubble(ECHO_WINDOW_ID, point)}
        onOpen={(bubble) => {
          saveLayout(ECHO_WINDOW_ID, {
            ...(savedLayout ?? getDefaultLayout(readFloatingWindowBounds())),
            minimized: false,
          });
          useFloatingWindowStore.getState().openWindow(ECHO_WINDOW_ID, bubble);
        }}
      />
    );
  }

  return (
    <FloatingWindow
      id={ECHO_WINDOW_ID}
      title={localizeUi("ui.chat.echochamberpanel.echo")}
      titleIcon={status}
      titleAccessory={
        visibleMessages.length > 0 ? <span className="text-[0.5625rem]">{visibleMessages.length}</span> : undefined
      }
      closeLabel={localizeUi("window.controls.close")}
      getDefaultLayout={getDefaultLayout}
      defaultLayoutKey={JSON.stringify([
        activeChatId,
        posStyle,
        rememberedPanelSize,
        defaultPanelHeight,
        echoChamberOpen,
        isMobile,
      ])}
      minWidth={isMobile ? MIN_MOBILE_PANEL_WIDTH : MIN_PANEL_WIDTH}
      minHeight={isMobile ? DEFAULT_MOBILE_PANEL_HEIGHT : MIN_PANEL_HEIGHT}
      autoFocus={false}
      className="pointer-events-auto min-w-0"
      headerClassName="flex-wrap"
      titleClassName="text-[0.625rem] font-semibold uppercase tracking-wider"
      bodyClassName="overflow-hidden"
      rootAttributes={rootAttributes}
      minimizable={isMobile ? undefined : { icon: <MessageCircle size="1rem" />, label: title }}
      onRequestClose={(reason) => {
        saveLayout(ECHO_WINDOW_ID, {
          ...(savedLayout ?? getDefaultLayout(readFloatingWindowBounds())),
          minimized: true,
        });
        useFloatingWindowStore.getState().closeWindow(ECHO_WINDOW_ID);
        if (reason !== "outside-pointer") {
          requestAnimationFrame(() => phoneBubbleRef.current?.focus({ preventScroll: true }));
        }
      }}
      headerControls={
        <>
          <button
            type="button"
            onClick={() => {
              if (!activeChatId || echoRetryBusy) return;
              void retryAgents(activeChatId, ["echo-chamber"]);
            }}
            disabled={echoRetryBusy}
            title={
              echoRetryBusy
                ? localizeUi("ui.chat.echochamberpanel.aReplyOrAgentIsAlreadyRunning")
                : localizeUi("ui.chat.echochamberpanel.reRunEchoChamber")
            }
            className="mari-window__control disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCw size="0.75rem" className={echoRetryBusy ? "animate-spin" : ""} />
          </button>
          {visibleMessages.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                if (!activeChatId) return;
                clearEchoMessages();
                setEchoVisibleCount(0);
                setEchoBaseline(0);
                try {
                  await api.delete(`/agents/echo-messages/${activeChatId}`);
                } catch {
                  /* best-effort */
                }
              }}
              className="mari-window__control"
              title={localizeUi("ui.chat.echochamberpanel.clearMessages")}
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
          <span className="hidden md:inline-flex px-1">
            <CornerPicker
              current={echoChamberSide}
              onChange={setEchoChamberSide}
              disabled={savedLayout?.locked ?? false}
            />
          </span>
        </>
      }
    >
      {/* Scrollable message area */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-1.5 scrollbar-thin">
        {visibleMessages.length === 0 ? (
          <p className="py-1.5 text-center text-[0.625rem] opacity-70">
            {localizeUi("ui.chat.echochamberpanel.waitingForReactions")}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleMessages.map((msg, i) => (
              <div
                key={i}
                className="min-w-0 animate-in fade-in slide-in-from-bottom-1 [animation-duration:300ms] break-words"
              >
                <span
                  className={cn(
                    "text-[0.6875rem] font-bold",
                    !useWidgetTextColor && nameColorMap.get(msg.characterName),
                  )}
                >
                  {msg.characterName}
                </span>
                <span className="text-[0.6875rem] opacity-70">: </span>
                <span className="text-[0.6875rem] leading-snug">{msg.reaction}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
