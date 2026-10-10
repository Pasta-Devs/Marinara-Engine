import {
  BookOpen,
  Dices,
  Eye,
  FileText,
  Link2,
  Pencil,
  Search,
  Sparkles,
  Undo2,
  UserPlus,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MariChipEntity, MariSuggestionAction, MariSuggestionChip } from "@marinara-engine/shared";
import { useChats } from "../../hooks/use-chats";
import { chatResultType, type ResultType } from "../../lib/command-icons";
import { mariCardIntent } from "../../lib/mari-arrival";
import { ResultTypeIcon } from "../command-center/ResultTypeIcon";
import { MariList, MariRow } from "./mari-primitives";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface MariSuggestionChipsProps {
  chips: MariSuggestionChip[];
  onSelect: (chip: MariSuggestionChip) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface ChipDragState {
  pointerId: number;
  startClientX: number;
  startScrollLeft: number;
  dragging: boolean;
}

interface ChipFadeState {
  left: boolean;
  right: boolean;
}

// N4: how long a touch press on a Mari card waits before it drafts instead of sending.
const CARD_LONG_PRESS_MS = 500;

// Pointer travel before a press turns into a scroll drag. Small enough that flicking the row
// feels immediate, large enough that a normal click on a chip never registers as a drag.
const CHIP_DRAG_THRESHOLD_PX = 5;

const CHIP_ICONS: Record<string, LucideIcon> = {
  UserPlus,
  BookOpen,
  Sparkles,
  UserRound,
  Wand2,
  Dices,
  // M9 arrival cards.
  FileText,
  Link2,
  Pencil,
  Search,
  Undo2,
};

// Q6: an entity card shows its kind's icon, the same one the omnibar and the panels use.
const ENTITY_RESULT_TYPE: Record<MariChipEntity, ResultType> = {
  characters: "character",
  lorebooks: "lorebook",
  personas: "persona",
  presets: "preset",
  connections: "connection",
  agents: "agent",
  settings: "setting",
  chat: "chat",
};

const ENTITY_LABEL_MATCHERS: Array<[MariChipEntity, RegExp]> = [
  ["characters", /\b(character|characters|character card|character cards)\b/i],
  ["lorebooks", /\b(lorebook|lorebooks|lore book|lore books)\b/i],
  ["personas", /\b(persona|personas)\b/i],
];

const ACTION_ENTITY: Partial<Record<string, MariChipEntity>> = {
  character: "characters",
  persona: "personas",
  preset: "presets",
  lorebook: "lorebooks",
  agent: "agents",
};

function actionEntity(action: MariSuggestionAction): MariChipEntity | undefined {
  if (action.kind === "resource") return ACTION_ENTITY[action.resource];
  if (action.kind === "panel") return action.panel;
  if (action.kind === "chat" || action.kind === "start-chat") return "chat";
  return undefined;
}

function inferChipEntity(chip: MariSuggestionChip): MariChipEntity | undefined {
  if (chip.entity) return chip.entity;
  if (chip.action) return actionEntity(chip.action);
  return ENTITY_LABEL_MATCHERS.find(([, matcher]) => matcher.test(chip.label))?.[0];
}

export function MariSuggestionChips({ chips, onSelect, disabled = false, compact = false }: MariSuggestionChipsProps) {
  const { t: localizeUi } = useUiTranslation();
  const reducedMotion = useReducedMotion();
  const setKey = chips.map((chip) => chip.id).join("|");
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [fade, setFade] = useState<ChipFadeState>({ left: false, right: false });
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<ChipDragState | null>(null);
  const wasDraggedRef = useRef(false);

  // Drive the edge fades from the live scroll position so each side only fades while there is
  // still something behind it. AnimatePresence remounts the row for every new chip set, which
  // swaps `scroller` and re-runs this, so a new set is measured as it mounts. Layout effect
  // rather than useEffect: the fade state has to land in the same frame the row paints.
  useLayoutEffect(() => {
    if (!scroller) return;
    // A new chip set starts at its first chip, not wherever the previous row was scrolled.
    scroller.scrollLeft = 0;
    const isRtl = getComputedStyle(scroller).direction === "rtl";
    const syncFade = () => {
      // scrollLeft counts up from 0 in LTR; in RTL it RESTS at 0 (right edge, all overflow
      // hidden to the left) and goes negative - so a sign check alone misreads the RTL rest
      // position, and the writing direction has to pick the normalization.
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const hiddenLeft = isRtl ? maxScroll + scroller.scrollLeft : scroller.scrollLeft;
      const next: ChipFadeState = { left: hiddenLeft > 1, right: maxScroll - hiddenLeft > 1 };
      setFade((current) => (current.left === next.left && current.right === next.right ? current : next));
    };
    syncFade();
    scroller.addEventListener("scroll", syncFade, { passive: true });
    window.addEventListener("resize", syncFade);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncFade);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", syncFade);
      window.removeEventListener("resize", syncFade);
      observer?.disconnect();
    };
  }, [scroller]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    wasDraggedRef.current = false;
    dragStateRef.current = null;
    // Touch and pen keep the browser's own panning - the row is a scroll-snap carousel at
    // narrow widths and hijacking those pointers would mean preventDefault on a touch pan.
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = event.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startScrollLeft: el.scrollLeft,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const el = event.currentTarget;
    // Before capture is taken, a release outside the row never reaches endDrag - the armed
    // state would otherwise survive with a stale start position and turn a later re-entry
    // into a phantom jump-scroll. buttons === 0 means the press already ended elsewhere.
    if (!dragState.dragging && event.buttons === 0) {
      dragStateRef.current = null;
      return;
    }
    const delta = event.clientX - dragState.startClientX;
    if (!dragState.dragging) {
      if (Math.abs(delta) < CHIP_DRAG_THRESHOLD_PX) return;
      dragState.dragging = true;
      wasDraggedRef.current = true;
      setIsDragging(true);
      el.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    el.scrollLeft = dragState.startScrollLeft - delta;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A cancelled pointer never produces the trailing click that normally clears the
    // suppression flag, so drop it here - otherwise the next keyboard activation of a chip,
    // which has no pointerdown to reset it either, would be swallowed instead.
    wasDraggedRef.current = false;
    endDrag(event);
  };

  const handlePointerLeave = () => {
    // Pre-threshold there is no capture, so the cursor leaving the row is the last event
    // this element sees for the press - disarm rather than keep stale drag state. During a
    // real (captured) drag, moves keep flowing to the capture target, so this only clears
    // the un-promoted case.
    if (dragStateRef.current && !dragStateRef.current.dragging) dragStateRef.current = null;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!wasDraggedRef.current) return;
    // Swallow exactly the one click that closes a real drag, so releasing the mouse over a
    // chip scrolls instead of firing it. Clearing the flag here (as well as on the next
    // pointerdown) keeps a later keyboard activation, which has no pointerdown, working.
    wasDraggedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          key={setKey}
          ref={setScroller}
          role="group"
          aria-label={localizeUi("ui.chat.marisuggestionchips.suggestedReplies")}
          className={cn("mari-suggestion-chips", compact && "mari-suggestion-chips--compact")}
          data-fade-left={fade.left ? "true" : undefined}
          data-fade-right={fade.right ? "true" : undefined}
          data-dragging={isDragging ? "true" : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onPointerLeave={handlePointerLeave}
          onClickCapture={handleClickCapture}
          initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {chips.map((chip) => {
            const entity = inferChipEntity(chip);
            const Icon = chip.icon ? CHIP_ICONS[chip.icon] : undefined;
            const label =
              chip.id === "authorization-accept"
                ? localizeUi("ui.chat.marisuggestionchips.acceptAuthorization")
                : chip.label;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onSelect(chip)}
                disabled={disabled}
                className={cn(
                  "mari-suggestion-chip text-left",
                  entity && `mari-panel-gradient--${entity}`,
                  !entity && !chip.tone && "mari-suggestion-chip--neutral",
                  chip.tone === "danger" && "mari-suggestion-chip--danger",
                  chip.tone === "caution" && "mari-suggestion-chip--caution",
                  chip.tone === "success" && "mari-suggestion-chip--success",
                )}
                aria-label={label}
                title={label}
              >
                {entity ? (
                  <ResultTypeIcon
                    type={ENTITY_RESULT_TYPE[entity]}
                    glyph
                    className={compact ? "size-[0.6875rem]" : "size-[0.8125rem]"}
                  />
                ) : Icon ? (
                  <Icon size={compact ? "0.6875rem" : "0.8125rem"} className="shrink-0" />
                ) : null}
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** R10: at most this many next steps; more is a menu, not a suggestion. */
const MAX_NEXT_STEPS = 4;

/**
 * M5b / R10: what next, as rows of one group under the finished turn (type icon, label, one fact). The
 * trailing glyph says what a tap does: › runs the row's `action` at once, a gold ✦ asks Mari. N4: with
 * Shift held, or after a long press on touch, `draft` is true and the caller puts the prompt in the
 * composer instead. `bare` returns the rows only, for a group the caller already draws (the arrival).
 */
export function MariNextStepCards<Chip extends Omit<MariSuggestionChip, "action"> & { action?: { kind: string } }>({
  chips,
  onSelect,
  disabled = false,
  bare = false,
}: {
  chips: readonly Chip[];
  onSelect: (chip: Chip, draft: boolean) => void;
  disabled?: boolean;
  bare?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // An "Open <chat>" row shows the chat's mode; the list is usually cached, so no refetch on mount.
  const { data: chatList } = useChats({
    enabled: chips.some((chip) => chip.action?.kind === "chat"),
    refetchOnMount: false,
  });
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({
    timer: null,
    fired: false,
  });
  const clearLongPress = () => {
    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);
    longPressRef.current.timer = null;
  };
  useEffect(() => clearLongPress, []);
  if (chips.length === 0) return null;
  const rows = chips.slice(0, MAX_NEXT_STEPS).map((chip) => {
    // M9's omnibar-only actions name no entity, so the shared inference reads them as none.
    const entity = inferChipEntity(chip as MariSuggestionChip);
    const chatId = chip.action?.kind === "chat" ? (chip.action as { chatId?: string }).chatId : undefined;
    const type =
      chip.action?.kind === "peek-prompt" || !entity
        ? undefined
        : entity === "chat"
          ? chatResultType(chatList?.find((chat) => chat.id === chatId)?.mode)
          : ENTITY_RESULT_TYPE[entity];
    const Icon = chip.action?.kind === "peek-prompt" ? Eye : (chip.icon && CHIP_ICONS[chip.icon]) || Wand2;
    const trailLabel = localizeUi(
      chip.action ? "ui.chat.marisuggestionchips.actsNow" : "ui.chat.marisuggestionchips.asksMariHint",
    );
    return (
      <MariRow
        key={chip.id}
        className={chip.tone === "danger" ? "mari-list__item--danger" : undefined}
        slot={type ? <ResultTypeIcon type={type} glyph /> : <Icon />}
        title={chip.label}
        fact={chip.detail}
        trail={chip.action ? "open" : "ask"}
        trailLabel={trailLabel}
        hint={trailLabel}
        onPointerDown={(event) => {
          clearLongPress();
          longPressRef.current.fired = false;
          if (event.pointerType !== "touch" || chip.action) return;
          longPressRef.current.timer = setTimeout(() => {
            longPressRef.current = { timer: null, fired: true };
            onSelect(chip, mariCardIntent(chip, { longPress: true }) === "draft");
          }, CARD_LONG_PRESS_MS);
        }}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        // The long press already drafted: no system menu, and no trailing click that would send.
        // A long press that ended without a click must not swallow a later keyboard activation.
        onKeyDown={() => {
          longPressRef.current.fired = false;
        }}
        onContextMenu={(event) => {
          if (longPressRef.current.fired) event.preventDefault();
        }}
        onClick={(event) => {
          if (longPressRef.current.fired) {
            longPressRef.current.fired = false;
            return;
          }
          onSelect(chip, mariCardIntent(chip, { shiftKey: event.shiftKey }) === "draft");
        }}
        disabled={disabled}
      />
    );
  });
  if (bare) return <>{rows}</>;
  return (
    <div className="mari-list-stack">
      <MariList
        cols={rows.length > 1}
        head={localizeUi("ui.chat.marisuggestionchips.next")}
        role="group"
        aria-label={localizeUi("ui.chat.marisuggestionchips.nextSteps")}
        data-cards="next"
      >
        {rows}
      </MariList>
    </div>
  );
}
