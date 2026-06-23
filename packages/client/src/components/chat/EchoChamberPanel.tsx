// ──────────────────────────────────────────────
// Echo Chamber Overlay — compact translucent stream-chat widget
// Messages appear one-by-one every 30 s, auto-scrolling.
// Positions itself within the chat area, respecting sidebar, right panel,
// HUD widget position (top/left/right), and the top bar.
// ──────────────────────────────────────────────
import { useRef, useEffect, useMemo, useState, type CSSProperties } from "react";
import { X, Trash2, RefreshCw } from "lucide-react";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import type { EchoChamberSide } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useChat } from "../../hooks/use-chats";
import { useGenerate } from "../../hooks/use-generate";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";

const MESSAGE_INTERVAL_MS = 30_000; // 30 s between reveals
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

// Layout constants (px)
const WIDGET_BAR_H = 76; // top HUD toolbar: py-2 (16px) + widget buttons h-[3.75rem] (60px)
const INPUT_BOX_H = 72; // bottom chat input area height
const HUD_EDGE_GAP = 16; // Aligns with the roleplay HUD edge padding.
const FLOATING_EDGE_GAP = 16;
const TOP_BUTTON_GAP = 6; // Matches the tracker panel gap below the top controls.
const DESKTOP_PANEL_WIDTH = 236;
const ROLEPLAY_AREA_SELECTOR = ".rpg-chat-area";
const ROLEPLAY_TOP_ANCHOR_SELECTOR = '[data-tracker-panel-anchor="roleplay-hud"]';
const ROLEPLAY_TOP_RIGHT_CONTROLS_SELECTOR = '[data-roleplay-top-controls="right"]';

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

function getDesktopPanelPosition(isTop: boolean, isLeft: boolean): CSSProperties {
  const containerRect = getRoleplayAreaRect();
  const alignmentElement = getDesktopAlignmentElement(isLeft);
  const alignmentRect = alignmentElement ? readVisibleRect(alignmentElement) : null;
  const edgeOffset = alignmentRect && containerRect ? Math.max(0, Math.round(alignmentRect.left - containerRect.left)) : null;
  const rightEdgeOffset =
    alignmentRect && containerRect ? Math.max(0, Math.round(containerRect.right - alignmentRect.right)) : null;
  const topOffset = isTop && containerRect ? getTopChromeBottomOffset(containerRect, alignmentRect) : undefined;

  return {
    ...(topOffset !== undefined && { top: topOffset }),
    ...(!isTop && { bottom: INPUT_BOX_H + FLOATING_EDGE_GAP }),
    ...(isLeft && {
      left: edgeOffset !== null ? `${edgeOffset}px` : `calc(${HUD_EDGE_GAP}px + var(--tracker-panel-hud-clear-left, 0px))`,
    }),
    ...(!isLeft && {
      right:
        rightEdgeOffset !== null
          ? `${rightEdgeOffset}px`
          : `calc(${HUD_EDGE_GAP}px + var(--tracker-panel-hud-clear-right, 0px))`,
    }),
    width: `${DESKTOP_PANEL_WIDTH}px`,
  };
}

/** Tiny 4-square grid icon; the active corner is highlighted. */
function CornerPicker({ current, onChange }: { current: EchoChamberSide; onChange: (c: EchoChamberSide) => void }) {
  if (typeof window !== "undefined" && window.innerWidth < 768) return null;
  return (
    <div className="grid grid-cols-2 gap-px">
      {CORNERS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "h-[0.4375rem] w-[0.4375rem] rounded-[0.09375rem] transition-colors",
            c === current
              ? "bg-[var(--marinara-chat-chrome-button-text-hover)]"
              : "bg-[var(--marinara-chat-chrome-highlight-bg)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]",
          )}
          title={c.replace("-", " ")}
        />
      ))}
    </div>
  );
}

export function EchoChamberPanel({ hiddenOnMobile = false }: EchoChamberPanelProps) {
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const echoChamberSide = useUIStore((s) => s.echoChamberSide);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const setEchoChamberSide = useUIStore((s) => s.setEchoChamberSide);
  const echoMessages = useAgentStore((s) => s.echoMessages);
  const isAgentProcessing = useAgentStore((s) => s.isProcessing);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const { data: chat } = useChat(activeChatId);
  const { retryAgents } = useGenerate();
  const echoRetryBusy = isAgentProcessing || (isStreaming && streamingChatId === activeChatId);

  // Mirror the enabledAgentTypes logic from ChatArea so per-chat overrides are respected
  const echoEnabled = useMemo(() => {
    if (!chat) return false;
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> }).metadata;
    const meta = typeof raw === "string" ? JSON.parse(raw) : ((raw ?? {}) as Record<string, unknown>);
    if (!meta.enableAgents) return false;
    const activeAgentIds: string[] = Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : [];
    return activeAgentIds.includes("echo-chamber");
  }, [chat]);

  // ── Timed reveal: show one more message every 30 s ──
  // visibleCount and baseline live in the Zustand store so they survive
  // component remounts (e.g. when the panel is toggled or the HUD re-renders).
  const visibleCount = useAgentStore((s) => s.echoVisibleCount);
  const baseline = useAgentStore((s) => s.echoBaseline);
  const setEchoVisibleCount = useAgentStore((s) => s.setEchoVisibleCount);
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
    setEchoLoadedChatId(activeChatId);

    // Only clear + reset when switching to a *different* chat
    if (previousChatId !== null && previousChatId !== activeChatId) {
      clearEchoMessages();
    }

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
            const loaded = useAgentStore.getState().echoMessages.length;
            setEchoVisibleCount(loaded);
            setEchoBaseline(loaded);
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
    const id = setTimeout(() => setEchoVisibleCount(visibleCount + 1), MESSAGE_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [visibleCount, echoMessages.length, baseline, setEchoVisibleCount]);

  // Auto-scroll when a new message becomes visible
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [visibleCount]);

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
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    if (!echoChamberOpen) return;
    // On mobile, position below the HUD bar.
    if (typeof window !== "undefined" && window.innerWidth < 768) {
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
    // Desktop: position within the chat area container (absolute, not fixed)
    const isTop = echoChamberSide.startsWith("top");
    const isLeft = echoChamberSide.endsWith("left");
    const update = () => {
      setPosStyle(getDesktopPanelPosition(isTop, isLeft));
    };

    update();

    let frame = 0;
    let discoveryObserver: MutationObserver | null = null;
    const observedTargets = new Set<HTMLElement>();
    const observer = new ResizeObserver(() => scheduleUpdate());
    const observeTargets = () => {
      const roleplayAreas = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_AREA_SELECTOR));
      const topAnchors = Array.from(document.querySelectorAll<HTMLElement>(ROLEPLAY_TOP_ANCHOR_SELECTOR));
      const topRightControls = Array.from(
        document.querySelectorAll<HTMLElement>(ROLEPLAY_TOP_RIGHT_CONTROLS_SELECTOR),
      );
      const huds = Array.from(document.querySelectorAll<HTMLElement>(".rpg-hud"));
      const targets = [...roleplayAreas, ...topAnchors, ...topRightControls, ...huds];
      targets.forEach((target) => {
        if (observedTargets.has(target)) return;
        observer.observe(target);
        observedTargets.add(target);
      });
      return roleplayAreas.length > 0 && (isLeft ? huds.length > 0 : topRightControls.length > 0);
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
  }, [echoChamberOpen, echoChamberSide]);

  useEffect(() => {
    if (!echoChamberOpen || !echoEnabled || (isMobile && hiddenOnMobile)) return;

    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "auto" });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [echoChamberOpen, echoEnabled, hiddenOnMobile, isMobile]);

  if (!echoChamberOpen || !echoEnabled || (isMobile && hiddenOnMobile)) return null;
  const visibleMessages = echoMessages.slice(0, visibleCount);

  return (
    <div
      className={cn(
        ROLEPLAY_POPOVER_SHELL,
        "absolute z-[60] flex flex-col",
        "pointer-events-auto max-md:w-auto md:w-[14.75rem] md:max-h-[22rem] max-md:max-h-28",
      )}
      style={posStyle}
    >
      {/* Header — live dot, corner picker, close */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          Echo
          {visibleMessages.length > 0 && (
            <span className="ml-0.5 text-[0.5625rem] font-normal text-[var(--marinara-chat-chrome-panel-muted)]">
              {visibleMessages.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (!activeChatId || echoRetryBusy) return;
              void retryAgents(activeChatId, ["echo-chamber"]);
            }}
            disabled={echoRetryBusy}
            title={echoRetryBusy ? "A reply or agent is already running" : "Re-run Echo Chamber"}
            className="rounded p-0.5 text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCw size="0.5625rem" className={echoRetryBusy ? "animate-spin" : ""} />
          </button>
          {visibleMessages.length > 0 && (
            <button
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
              className="rounded p-0.5 text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
              title="Clear messages"
            >
              <Trash2 size="0.5625rem" />
            </button>
          )}
          {/* Hide position button on mobile */}
          <span className="hidden md:inline-flex">
            <CornerPicker current={echoChamberSide} onChange={setEchoChamberSide} />
          </span>
          <button
            onClick={toggleEchoChamber}
            className="rounded p-0.5 text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
          >
            <X size="0.625rem" />
          </button>
        </div>
      </div>

      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-1.5 scrollbar-thin">
        {visibleMessages.length === 0 ? (
          <p className="py-1.5 text-center text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
            Waiting for reactions…
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleMessages.map((msg, i) => (
              <div key={i} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                <span className={cn("text-[0.6875rem] font-bold", nameColorMap.get(msg.characterName))}>
                  {msg.characterName}
                </span>
                <span className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">: </span>
                <span className="text-[0.6875rem] leading-snug text-[var(--marinara-chat-chrome-panel-text)]">
                  {msg.reaction}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
