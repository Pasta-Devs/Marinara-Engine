import {
  BookOpen,
  Bot,
  Dices,
  Link2,
  MessageCircle,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MariChipEntity, MariSuggestionChip } from "@marinara-engine/shared";
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
};

const ENTITY_DEFAULT_ICON: Partial<Record<MariChipEntity, LucideIcon>> = {
  characters: UserPlus,
  lorebooks: BookOpen,
  personas: UserRound,
  presets: SlidersHorizontal,
  connections: Link2,
  agents: Bot,
  settings: Settings,
  chat: MessageCircle,
};

const ENTITY_LABEL_MATCHERS: Array<[MariChipEntity, RegExp]> = [
  ["characters", /\b(character|characters|character card|character cards)\b/i],
  ["lorebooks", /\b(lorebook|lorebooks|lore book|lore books)\b/i],
  ["personas", /\b(persona|personas)\b/i],
];

function inferChipEntity(chip: MariSuggestionChip): MariChipEntity | undefined {
  if (chip.entity) return chip.entity;
  return ENTITY_LABEL_MATCHERS.find(([, matcher]) => matcher.test(chip.label))?.[0];
}

// Fade + rise + scale, keyed per chip set, mode="wait" so the old set fully exits before the
// next enters - this is the exact recipe GameSetupWizard/ChatSetupWizard use for step changes
// (see GameSetupWizard.tsx / ChatSetupWizard.tsx step transitions), reused here so a new
// suggestion set reads as "the next step" rather than an abrupt content swap.
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
    <AnimatePresence mode="wait">
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
            const Icon = (chip.icon && CHIP_ICONS[chip.icon]) || (entity && ENTITY_DEFAULT_ICON[entity]) || undefined;
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
                title={chip.prompt}
              >
                {Icon ? <Icon size={compact ? "0.6875rem" : "0.8125rem"} className="shrink-0" /> : null}
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
