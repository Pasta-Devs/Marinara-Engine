// ──────────────────────────────────────────────
// Branch graph window: every branch of a chat as a lane, joined where it forked
//
// Opened from the Chat Branches header (inline or popped out). The Chat Branches list stays the
// quick switcher; this is the bigger picture, in its own resizable window.
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import { GitGraph } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ChatBranchGraphMessage } from "@marinara-engine/shared";
import { FloatingWindow, PHONE_FULL_SHEET_CLASS, PHONE_SHEET_CLASS } from "../ui/FloatingWindow";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { chatKeys, useChatBranchGraph, useChatGroup } from "../../hooks/use-chats";
import { useMatchMedia } from "../../hooks/use-match-media";
import { getChatDisplayName } from "../../lib/chat-display";
import { buildChatBranchRows } from "../../lib/chat-branch-tree";
import {
  laneSpansGap,
  layoutChatBranchGraph,
  type BranchGraphFit,
  type BranchGraphLayout,
  type BranchGraphSpan,
} from "../../lib/chat-branch-graph-layout";
import type { WindowBounds, WindowLayout } from "../../lib/floating-window-layout";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useFloatingWindowStore } from "../../stores/floating-window.store";
import { readChatWindowArea, readCssPixels } from "./chat-settings-window";

export const CHAT_BRANCH_GRAPH_WINDOW_ID = "chat-branch-graph";

const DEFAULT_WIDTH_REM = 52;
const DEFAULT_HEIGHT_REM = 26;
/** How long the chat must sit still after a message lands before the graph refetches. */
const REFRESH_DELAY_MS = 1500;
/** The scroll area's vertical padding, plus room for a horizontal scrollbar, kept out of the lanes' height. */
const FIT_HEIGHT_ALLOWANCE = 28;

/** Centred over the chat, as wide as a long timeline wants and no wider than the chat. */
function getBranchGraphDefaultLayout(bounds: WindowBounds): WindowLayout {
  const remPx = readCssPixels(document.documentElement, "font-size") || 16;
  const area = readChatWindowArea(bounds);
  const width = Math.max(320, Math.min(DEFAULT_WIDTH_REM * remPx, area.right - area.left));
  const height = Math.max(240, Math.min(DEFAULT_HEIGHT_REM * remPx, area.bottom - area.top));
  return {
    x: area.left + Math.max(0, (area.right - area.left - width) / 2),
    y: area.top + Math.max(0, (area.bottom - area.top - height) / 2),
    width,
    height,
    pinned: false,
    locked: false,
  };
}

/** The long button over the Chat Branches section's other buttons; it opens (or closes) the graph window. */
export function ChatBranchGraphButton() {
  const { t: localizeUi } = useUiTranslation();
  const open = useFloatingWindowStore((state) => state.open[CHAT_BRANCH_GRAPH_WINDOW_ID] === true);
  return (
    <button
      type="button"
      data-chat-branch-graph-button
      aria-pressed={open}
      title={localizeUi("chat.settings.branchGraphOpen")}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]",
        open ? "bg-[var(--accent)]" : "bg-[var(--secondary)]",
      )}
      onClick={(event) =>
        useFloatingWindowStore.getState().toggleWindow(CHAT_BRANCH_GRAPH_WINDOW_ID, event.currentTarget)
      }
    >
      <GitGraph size="0.75rem" />
      {localizeUi("chat.settings.branchGraph")}
    </button>
  );
}

export function ChatBranchGraphWindow({ chatId, groupId }: { chatId: string; groupId: string | null }) {
  const { t: localizeUi } = useUiTranslation();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const open = useFloatingWindowStore((state) => state.open[CHAT_BRANCH_GRAPH_WINDOW_ID] === true);
  if (!open) return null;

  return (
    <FloatingWindow
      id={CHAT_BRANCH_GRAPH_WINDOW_ID}
      title={localizeUi("chat.settings.branchGraph")}
      titleIcon={<GitGraph size="0.8125rem" className="mari-chrome-accent-icon shrink-0" />}
      closeLabel={localizeUi("window.controls.close")}
      presentation={phoneLayout ? "sheet" : "window"}
      sheetClassName={cn(PHONE_SHEET_CLASS, PHONE_FULL_SHEET_CLASS)}
      getDefaultLayout={getBranchGraphDefaultLayout}
      minWidth={320}
      minHeight={200}
      className={cn("marinara-chat-popover", NEUTRAL_SURFACE_VARIABLES)}
      headerClassName="marinara-chat-popover__header"
      titleClassName="marinara-chat-popover__title text-xs font-semibold leading-tight"
      rootAttributes={{ "data-chat-branch-graph": chatId }}
      onRequestClose={(reason) => {
        // Its own close button always closes it; Escape and outside presses leave a pinned window be.
        useFloatingWindowStore.getState().dismissWindow(CHAT_BRANCH_GRAPH_WINDOW_ID, {
          force: reason === "close-button",
        });
      }}
    >
      <BranchGraph chatId={chatId} groupId={groupId} compact={phoneLayout} />
    </FloatingWindow>
  );
}

/** A dot with text: a branch's fork message on the lane that holds it, or a lane's latest message. */
type GraphPoint = {
  lane: number;
  index: number;
  fork: ChatBranchGraphMessage | null;
  tip: ChatBranchGraphMessage | null;
};

type PointerState = { point: GraphPoint; left: number; top: number; below: boolean };

function BranchGraph({ chatId, groupId, compact }: { chatId: string; groupId: string | null; compact: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const { data: groupChats, isError: groupFailed } = useChatGroup(groupId);
  const graph = useChatBranchGraph(groupId);
  useRefreshOnNewMessages(chatId, groupId);
  const [expanded, setExpanded] = useState<readonly BranchGraphSpan[] | "all">([]);
  const [pointer, setPointer] = useState<PointerState | null>(null);
  const [fit, setFit] = useState<BranchGraphFit | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    if (!groupChats || !graph.data) return null;
    const entries = new Map(graph.data.map((entry) => [entry.chatId, entry]));
    // The group list can be a refetch ahead of (or behind) the graph; draw only chats both agree on.
    return layoutChatBranchGraph(
      buildChatBranchRows(groupChats.filter((chat) => entries.has(chat.id))),
      entries,
      expanded,
      fit,
    );
  }, [groupChats, graph.data, expanded, fit]);

  // The graph fills its window: measure the timeline's room, and again whenever the window is resized.
  // `drawn` decides whether the body draws the graph, so the timeline is mounted exactly when it holds. An error
  // keeps the last layout but hides it.
  const failed = graph.isError || groupFailed;
  const drawn = !!groupId && !failed && !!layout && layout.lanes.length >= 2;
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const timeline = timelineRef.current;
    if (!drawn || !scroller || !timeline) return;
    const measure = () => {
      const width = timeline.clientWidth;
      const height = Math.max(0, scroller.clientHeight - FIT_HEIGHT_ALLOWANCE);
      setFit((previous) =>
        previous && previous.width === width && previous.height === height ? previous : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(timeline);
    return () => observer.disconnect();
  }, [drawn]);

  const characterIds = useMemo(
    () =>
      (graph.data ?? []).flatMap((entry) =>
        [entry.fork?.characterId, entry.tip?.characterId].filter((id): id is string => !!id),
      ),
    [graph.data],
  );
  const { data: characters } = useCharacterSummaries(characterIds);
  const characterNames = useMemo(
    () => new Map((characters ?? []).map((character) => [character.id, character.name])),
    [characters],
  );

  const points = useMemo(() => (layout ? collectPoints(layout) : []), [layout]);
  const currentLane = layout?.lanes.findIndex((lane) => lane.chat.id === chatId) ?? -1;

  // Open on the current branch's latest message rather than on message 1 of a long chat.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    const timeline = timelineRef.current;
    if (!layout || !fit || !scroller || !timeline || currentLane < 0 || scrolledFor.current === chatId) return;
    scrolledFor.current = chatId;
    const lane = layout.lanes[currentLane]!;
    const tipX = layout.xOf(Math.max(lane.tip, lane.start)) * layout.scale;
    timeline.scrollLeft = Math.max(0, tipX - timeline.clientWidth / 2);
    scroller.scrollTop = Math.max(0, layout.laneY(currentLane) * layout.scale - scroller.clientHeight / 2);
  }, [layout, fit, chatId, currentLane]);

  const speakerOf = (message: ChatBranchGraphMessage) => {
    if (message.role === "user") return localizeUi("chat.settings.branchGraphSpeakerYou");
    if (message.role === "narrator") return localizeUi("chat.settings.branchGraphSpeakerNarrator");
    if (message.role === "system") return localizeUi("chat.settings.branchGraphSpeakerSystem");
    return (
      (message.characterId && characterNames.get(message.characterId)) ||
      localizeUi("chat.settings.branchGraphSpeakerReply")
    );
  };
  const describe = (message: ChatBranchGraphMessage) =>
    localizeUi("chat.settings.branchGraphPoint", {
      number: message.index + 1,
      speaker: speakerOf(message),
      snippet: message.snippet,
    });

  const showPoint = (point: GraphPoint, event: MouseEvent<SVGElement> | FocusEvent<SVGElement>) => {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame) return;
    const dot = event.currentTarget.getBoundingClientRect();
    const below = dot.top - frame.top < 72;
    setPointer({
      point,
      left: dot.left + dot.width / 2 - frame.left,
      top: below ? dot.bottom - frame.top + 6 : dot.top - frame.top - 6,
      below,
    });
  };
  const hidePoint = () => setPointer(null);

  const labelWidth = compact ? "7rem" : "10rem";
  const status = (text: string) => (
    <div className="mari-chrome-text-muted flex min-h-32 flex-1 items-center justify-center px-4 py-8 text-center text-xs">
      {text}
    </div>
  );

  let body;
  if (!drawn) {
    if (failed) body = status(localizeUi("chat.settings.branchGraphError"));
    else if (groupId && !layout) body = status(localizeUi("chat.settings.branchGraphLoading"));
    else body = status(localizeUi("chat.settings.branchGraphEmpty"));
  } else {
    body = (
      <div
        ref={scrollRef}
        className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto overscroll-contain")}
        onScroll={hidePoint}
      >
        {/* Names stay put and only the timeline scrolls sideways; the panel is translucent, so a sticky
            column over the timeline would let the dots show through it. */}
        <div className="flex items-start py-2">
          <div className="shrink-0 border-r border-[var(--border)]" style={{ width: labelWidth }}>
            {layout.lanes.map((lane, laneIndex) => {
              const name = getChatDisplayName(lane.chat);
              const current = laneIndex === currentLane;
              return (
                <button
                  key={lane.chat.id}
                  type="button"
                  aria-current={current ? "true" : undefined}
                  title={localizeUi("chat.settings.branchGraphSwitchTo", { name })}
                  className={cn(
                    "flex w-full items-center truncate px-2 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
                    current
                      ? "bg-[var(--primary)]/10 font-semibold text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  style={{
                    height: layout.laneHeight * layout.scale,
                    paddingLeft: `${0.5 + Math.min(lane.depth, 6) * 0.5}rem`,
                    // Names grow a little with a zoomed-in graph, not as much: they would soon stop fitting. They
                    // never shrink with it, or they would be too small to read.
                    fontSize: `${0.6875 * Math.min(Math.max(layout.scale, 1), 1.4)}rem`,
                  }}
                  onClick={() => setActiveChatId(lane.chat.id)}
                >
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
          <div
            ref={timelineRef}
            className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-w-0 flex-1 overflow-x-auto overscroll-x-contain")}
            onScroll={hidePoint}
          >
            <BranchGraphCanvas
              layout={layout}
              points={points}
              currentLane={currentLane}
              describePoint={(point) =>
                [point.fork && describe(point.fork), point.tip && describe(point.tip)].filter(Boolean).join(" / ")
              }
              expandRunLabel={(count) => localizeUi("chat.settings.branchGraphExpandRun", { count })}
              onSwitch={(laneIndex) => setActiveChatId(layout.lanes[laneIndex]!.chat.id)}
              onExpand={(span) => setExpanded((previous) => (previous === "all" ? previous : [...previous, span]))}
              onShowPoint={showPoint}
              onHidePoint={hidePoint}
            />
          </div>
        </div>
      </div>
    );
  }

  const anyGuessed = layout?.lanes.some((lane) => lane.anchorLane !== null && !lane.lineageKnown) ?? false;
  const canExpand = layout ? layout.gaps.length > 0 : false;
  const allExpanded = expanded === "all" || (expanded.length > 0 && !canExpand);
  return (
    <div ref={frameRef} className="relative flex min-h-0 flex-1 flex-col">
      {drawn && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] px-3 py-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
          <LegendDot role="u" label={localizeUi("chat.settings.branchGraphSpeakerYou")} />
          <LegendDot role="a" label={localizeUi("chat.settings.branchGraphLegendCharacter")} />
          <LegendDot role="n" label={localizeUi("chat.settings.branchGraphLegendOther")} />
          {anyGuessed && (
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="6" aria-hidden>
                <line x1="0" y1="3" x2="14" y2="3" stroke="var(--muted-foreground)" strokeDasharray="3 2" />
              </svg>
              {localizeUi("chat.settings.branchGraphLegendGuess")}
            </span>
          )}
          {(canExpand || allExpanded) && (
            <button
              type="button"
              className="ml-auto rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              onClick={() => {
                // Every run changes width at once, so find the current branch's tip again.
                scrolledFor.current = null;
                setExpanded(allExpanded ? [] : "all");
              }}
            >
              {localizeUi(allExpanded ? "chat.settings.branchGraphCollapseAll" : "chat.settings.branchGraphExpandAll")}
            </button>
          )}
        </div>
      )}
      {body}
      {pointer && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-max max-w-64 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--popover)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[var(--popover-foreground)] shadow-xl"
          style={{
            // Centred on the dot, but never past the window's edges (half of max-w-64, plus a margin).
            left: `clamp(8.5rem, ${pointer.left}px, calc(100% - 8.5rem))`,
            top: pointer.top,
            transform: `translate(-50%, ${pointer.below ? "0" : "-100%"})`,
          }}
        >
          {pointer.point.fork && (
            <PointText heading={localizeUi("chat.settings.branchGraphFork")} text={describe(pointer.point.fork)} />
          )}
          {pointer.point.tip && (
            <PointText heading={localizeUi("chat.settings.branchGraphLatest")} text={describe(pointer.point.tip)} />
          )}
        </div>
      )}
    </div>
  );
}

function PointText({ heading, text }: { heading: string; text: string }) {
  return (
    <div>
      <div className="text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {heading}
      </div>
      <div className="break-words">{text}</div>
    </div>
  );
}

function LegendDot({ role, label }: { role: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="8" height="8" aria-hidden>
        <circle cx="4" cy="4" r="3" {...roleDotStyle(role)} />
      </svg>
      {label}
    </span>
  );
}

/** You in the muted tone, characters in the accent: the same split as the chat list's peek. */
function roleDotStyle(role: string) {
  if (role === "u") return { fill: "var(--muted-foreground)" };
  if (role === "a") return { fill: "var(--primary)" };
  if (role === "?") return { fill: "var(--muted-foreground)", opacity: 0.35 };
  return { fill: "var(--background)", stroke: "var(--muted-foreground)", strokeWidth: 1.25 };
}

function BranchGraphCanvas({
  layout,
  points,
  currentLane,
  describePoint,
  expandRunLabel,
  onSwitch,
  onExpand,
  onShowPoint,
  onHidePoint,
}: {
  layout: BranchGraphLayout<{ id: string }>;
  points: GraphPoint[];
  currentLane: number;
  describePoint: (point: GraphPoint) => string;
  expandRunLabel: (count: number) => string;
  onSwitch: (lane: number) => void;
  onExpand: (span: BranchGraphSpan) => void;
  onShowPoint: (point: GraphPoint, event: MouseEvent<SVGElement> | FocusEvent<SVGElement>) => void;
  onHidePoint: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { lanes, columns, laneHeight, xOf, laneY } = layout;
  const expandOnKey = (span: BranchGraphSpan) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onExpand(span);
  };

  return (
    <svg
      width={layout.width * layout.scale}
      height={layout.height * layout.scale}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="block shrink-0"
    >
      {/* Elbows first, so the dots sit on top of them. */}
      {lanes.map((lane, laneIndex) => {
        if (lane.anchorLane === null || lane.forkAt === null) return null;
        const fromX = xOf(lane.forkAt);
        const toX = xOf(lane.start);
        const fromY = laneY(lane.anchorLane);
        const toY = laneY(laneIndex);
        const radius = Math.min(6, Math.max(0, toX - fromX), Math.max(0, toY - fromY));
        return (
          <path
            key={`elbow:${lane.chat.id}`}
            d={`M ${fromX} ${fromY} V ${toY - radius} Q ${fromX} ${toY} ${fromX + radius} ${toY} H ${toX}`}
            fill="none"
            stroke={laneIndex === currentLane ? "var(--primary)" : "var(--border)"}
            strokeWidth={1.5}
            strokeDasharray={lane.lineageKnown ? undefined : "3 3"}
          />
        );
      })}
      {lanes.map((lane, laneIndex) => {
        const y = laneY(laneIndex);
        const current = laneIndex === currentLane;
        const lanePoints = points.filter((point) => point.lane === laneIndex);
        return (
          <g key={lane.chat.id} className="cursor-pointer" onClick={() => onSwitch(laneIndex)}>
            <rect
              x={0}
              y={laneIndex * laneHeight}
              width={layout.width}
              height={laneHeight}
              fill={current ? "var(--primary)" : "transparent"}
              fillOpacity={current ? 0.08 : 0}
            />
            {lane.tip >= lane.start ? (
              <line
                x1={xOf(lane.start)}
                x2={xOf(lane.tip)}
                y1={y}
                y2={y}
                stroke={current ? "var(--primary)" : "var(--border)"}
                strokeOpacity={current ? 0.5 : 1}
                strokeWidth={1.5}
              />
            ) : (
              // A branch with nothing of its own yet: just where its next message will go.
              <circle cx={xOf(lane.start)} cy={y} r={3} fill="none" stroke="var(--border)" strokeDasharray="2 2" />
            )}
            {columns.map((column) => {
              if (column.kind === "gap") {
                if (!laneSpansGap(lane, column)) return null;
                const count = column.to - column.from + 1;
                return (
                  <g
                    key={`gap:${column.from}`}
                    role="button"
                    tabIndex={0}
                    aria-label={expandRunLabel(count)}
                    className="focus-visible:outline-none [&:focus-visible>rect]:stroke-[var(--ring)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onExpand({ from: column.from, to: column.to });
                    }}
                    onKeyDown={expandOnKey({ from: column.from, to: column.to })}
                  >
                    <title>{expandRunLabel(count)}</title>
                    <rect
                      x={column.x - 26}
                      y={y - 8}
                      width={52}
                      height={16}
                      rx={8}
                      fill="var(--muted)"
                      stroke="var(--border)"
                    />
                    <text
                      x={column.x}
                      y={y + 3}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--muted-foreground)"
                      className="select-none"
                    >
                      {localizeUi("chat.settings.branchGraphRun", { number: count })}
                    </text>
                  </g>
                );
              }
              if (column.index < lane.start || column.index > lane.tip) return null;
              return (
                <circle
                  key={column.index}
                  cx={column.x}
                  cy={y}
                  r={3.5}
                  {...roleDotStyle(lane.roles[column.index - lane.start] ?? "?")}
                />
              );
            })}
            {lanePoints.map((point) => (
              // A tap shows the point's text instead of switching, since touch has no hover.
              <g
                key={`point:${point.index}`}
                tabIndex={0}
                role="img"
                aria-label={describePoint(point)}
                className="group outline-none"
                onMouseEnter={(event) => onShowPoint(point, event)}
                onMouseLeave={onHidePoint}
                onFocus={(event) => onShowPoint(point, event)}
                onBlur={onHidePoint}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowPoint(point, event);
                }}
              >
                <circle cx={xOf(point.index)} cy={y} r={10} fill="transparent" />
                <circle
                  cx={xOf(point.index)}
                  cy={y}
                  r={6}
                  fill="transparent"
                  stroke={current ? "var(--primary)" : "var(--muted-foreground)"}
                  strokeWidth={1.25}
                  className="pointer-events-none group-focus-visible:[stroke-width:2.5]"
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Fork messages land on the lane that holds them (the top chat's own fork, on its own lane); a lane's tip
 * lands on its own lane. One dot each.
 */
function collectPoints(layout: BranchGraphLayout<{ id: string }>): GraphPoint[] {
  const byKey = new Map<string, GraphPoint>();
  const at = (lane: number, index: number) => {
    const key = `${lane}:${index}`;
    let point = byKey.get(key);
    if (!point) {
      point = { lane, index, fork: null, tip: null };
      byKey.set(key, point);
    }
    return point;
  };
  layout.lanes.forEach((lane, laneIndex) => {
    const entry = lane.entry;
    if (entry?.tip && entry.tip.index >= lane.start) at(laneIndex, entry.tip.index).tip = entry.tip;
    // A top chat that has added nothing since its own fork: its tip ring already marks that message.
    const forkIsOwnTip = lane.anchorLane === null && lane.forkAt === lane.tip;
    if (entry?.fork && lane.forkAt !== null && lane.forkAt >= 0 && !forkIsOwnTip) {
      const point = at(lane.anchorLane ?? laneIndex, lane.forkAt);
      point.fork ??= entry.fork;
    }
  });
  return [...byKey.values()];
}

/** The chat's messages change as it's played; redraw once it settles rather than on every token. */
function useRefreshOnNewMessages(chatId: string, groupId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!groupId) return;
    const watched = hashKey(chatKeys.messages(chatId));
    let timer: number | undefined;
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryHash !== watched) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => void qc.invalidateQueries({ queryKey: chatKeys.branchGraph(groupId), exact: true }),
        REFRESH_DELAY_MS,
      );
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [qc, chatId, groupId]);
}
