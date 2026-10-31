// The board a positioned ruleset fight is fought on.
//
// Presentational, and only that. Which cells a walk may end on, what each one costs, who a path
// would be struck at by, who an option may be pointed at and where a shape may be aimed all arrive
// on the view the server built; this file indexes them by square and draws them. It measures no
// distance, decides no legality and adds nothing up.
//
// It looks like the Tactical style's board on purpose, out of the same palettes, textures and token
// shapes (`lib/tactical-board-look.ts`), because it IS the same battlefield: the same generator,
// the same terrain and the same deployment. What it does with it is the ruleset's.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Flag, Skull, Sword, Zap } from "lucide-react";
import {
  creatureArtVariant,
  type Combatant,
  type DirectedRulesetView,
  type RulesetCombatCell,
} from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import {
  TACTICAL_BOARD_KEYFRAMES,
  TERRAIN_PALETTES,
  TILE_ALPHA,
  TILE_TEXTURES,
  TILE_TINT_ALPHA,
  TILE_TINT_ALPHA_THEMED,
  initialsOf,
  resolveSprite,
  resolveTerrainIcon,
  tileShadow,
  heightWash,
} from "../../lib/tactical-board-look";
import {
  rulesetAimCatchesAllies,
  rulesetAimTake,
  rulesetAimTemplate,
  rulesetAimTurning,
  rulesetBoardCells,
  type RulesetCellChoice,
  RULESET_BOARD_FOG_KEYS,
  RULESET_BOARD_LIGHT_KEYS,
  rulesetCellKey,
  rulesetCellSentences,
  rulesetDistanceText,
  rulesetHealthPercent,
  rulesetHeldCaught,
  rulesetNothingInReach,
  rulesetPathTo,
  type RulesetBoardCell,
} from "../../lib/ruleset-combat-board";
import {
  rulesetOptionForecastText,
  rulesetPickTarget,
  rulesetSendsOnPick,
  rulesetPicksStep,
  type RulesetMenuStep,
} from "../../lib/ruleset-combat-menu";
import { boardCellArt, boardSliceStyle, useBoardArt } from "../../lib/board-art";
import { CreatureArtFigure, findCreatureArtIn, useCreatureFacings, useCreaturePacks } from "./CreatureArt";
import { ArtIcon } from "./ArtIcon";
import { cn } from "../../lib/utils";
import { rulesetHealthTone } from "./RulesetTurnOrder";
import { useMatchMedia } from "../../hooks/use-match-media";

/** The tints lasting areas are drawn in, one for each kind (`rulesetZoneTint`), none of them the blue
 *  of water. */
const ZONE_TINT_CLASSES = [
  "bg-violet-400/30 ring-violet-200/70",
  "bg-amber-300/30 ring-amber-200/70",
  "bg-rose-400/30 ring-rose-200/70",
  "bg-lime-300/30 ring-lime-200/70",
  "bg-fuchsia-400/30 ring-fuchsia-200/70",
] as const;

export interface RulesetCombatBoardProps {
  /** A view that carries a grid. Without one the caller keeps the Classic stage. */
  view: DirectedRulesetView;
  /** The Engine's own combatants, for the portraits and who plays them: every number on screen is the
   *  view's. */
  units: Combatant[];
  /** The scene's terrain theme, which is the same string the board was generated from. */
  environment?: string;
  busy: boolean;
  onChoose: (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    cell?: RulesetCellChoice,
    style?: string,
    mode?: string,
    amount?: number,
    alters?: string[],
    spares?: string[],
    heightens?: string,
  ) => void;
  /** The half-made choice, held by the screen so the pane's option list and the board are never two
   *  steps apart. */
  step: RulesetMenuStep | null;
  onStepChange: (step: RulesetMenuStep | null) => void;
  /** The option list, so Escape from a square can put the keyboard back where the step was opened. */
  menuRef: RefObject<HTMLDivElement | null>;
  /** Whose token the pointer or the keyboard is on, so the pane can open their details. */
  onHover?: (id: string | null) => void;
  /** Before the first turn (2026-10-24): the squares the player may set their party down on, lit,
   *  and every square clicked handed to `onPlace`. */
  placing?: Set<string>;
  onPlace?: (cell: { x: number; y: number }) => void;
  className?: string;
}

export function RulesetCombatBoard({
  view,
  units,
  environment,
  busy,
  onChoose,
  step,
  onStepChange: setStep,
  menuRef: menuRoot,
  onHover,
  placing,
  onPlace,
  className,
}: RulesetCombatBoardProps) {
  const { t } = useTranslation();
  const grid = view.grid!;
  /** The cell the pointer or the keyboard is on, which is what the hint below the board describes. */
  const [reading, setReading] = useState<RulesetCombatCell | null>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const actor = view.combatants.find((combatant) => combatant.id === view.actorId);
  const cells = useMemo(() => rulesetBoardCells(view, step), [view, step]);
  const byKey = useMemo(() => new Map(cells.map((cell) => [rulesetCellKey(cell), cell])), [cells]);
  // The walk being read, or the one a first tap picked on a touch screen, still drawn once the finger lifts.
  const path = useMemo(() => {
    const end = reading ?? step?.to;
    if (!end) return new Set<string>();
    return new Set(rulesetPathTo(step, end).map(rulesetCellKey));
  }, [step, reading]);
  const aimed = reading && step?.stage === "aim" ? byKey.get(rulesetCellKey(reading))?.aim : undefined;
  // Who an area being aimed would catch: the player's own while they aim, or, while a window holds the
  // fight open on somebody else's area, whoever that one catches (its cells come with the window).
  const held = view.window?.moment === "aimed" ? view.window : undefined;
  const caught = useMemo(
    () => new Set(aimed?.targetIds ?? (held?.cells ? rulesetHeldCaught(view) : [])),
    [aimed, held, view],
  );
  const heldCells = useMemo(() => new Set((held?.cells ?? []).map(rulesetCellKey)), [held]);
  const readingId = reading ? byKey.get(rulesetCellKey(reading))?.occupant?.id : undefined;
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;
  useEffect(() => {
    hoverRef.current?.(readingId ?? null);
  }, [readingId]);
  // The shape it would land in, drawn on the board while it is aimed, and who of the caster's own
  // side it would catch, who are marked apart and warned about before the cast.
  const aimedAt = aimed ? reading : null;
  const template = useMemo(
    () => new Set(rulesetAimTemplate(view, step, aimedAt).map(rulesetCellKey)),
    [view, step, aimedAt],
  );
  const aimedOption = step?.stage === "aim" ? step.option : undefined;
  const alliesCaught = useMemo(
    () => new Set(rulesetAimCatchesAllies(view, aimed?.targetIds ?? [], aimedOption)),
    [view, aimed, aimedOption],
  );
  // An aim clicked or tapped, and by the keyboard one that catches allies, is armed by the first pick
  // of its square and cast by the second: the first only shows what it would do.
  const [armed, setArmed] = useState<string | null>(null);
  // Used with one that spares its user's side (Sculpt Spells), who is spared is picked next, so
  // catching them is nothing to stop the cast for.
  const sparing = !!step?.alters?.some((id) => step.option.alters?.find((offer) => offer.id === id)?.spares);
  // A touch screen's first tap arms like every later one: before any pointer is seen, a coarse
  // pointer is taken for a finger.
  const lastPointer = useRef<string>(
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "mouse",
  );

  // The keyboard starts on whoever is up, so a player who never touches the pointer is already
  // where the turn is. It follows the turn, and nothing else moves it.
  const [cursor, setCursor] = useState<RulesetCombatCell>({ x: 0, y: 0 });
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  useEffect(() => {
    if (typeof actor?.x === "number" && typeof actor?.y === "number") setCursor({ x: actor.x, y: actor.y });
  }, [actor?.x, actor?.y]);
  // A board too big for its room scrolls (2026-10-24: a lair, a war's battlefield): its squares keep
  // a size a finger can pick, and the room brings whoever is up into the middle of it.
  const scrolls = grid.width > 14 || grid.height > 10;
  const room = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrolls || typeof actor?.x !== "number" || typeof actor?.y !== "number") return;
    const box = room.current;
    const tile = tiles.current.get(rulesetCellKey({ x: actor.x, y: actor.y }));
    if (!box || !tile) return;
    const at = tile.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    box.scrollTo({
      left: box.scrollLeft + at.left - frame.left - (box.clientWidth - at.width) / 2,
      top: box.scrollTop + at.top - frame.top - (box.clientHeight - at.height) / 2,
      behavior: "smooth",
    });
  }, [scrolls, actor?.x, actor?.y]);
  // Setting the party down, the room opens on the squares they may stand on (laptop playtest
  // 2026-10-24: a 40 by 26 board opened at its top, the party's rows off below it): once, at the
  // middle of them, and the player scrolls from there.
  const placed = useRef(false);
  useEffect(() => {
    if (!placing?.size) {
      placed.current = false;
      return;
    }
    if (!scrolls || placed.current) return;
    const cells = [...placing].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x: x!, y: y! };
    });
    const mid = {
      x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length,
      y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length,
    };
    const near = cells.reduce((best, cell) =>
      Math.hypot(cell.x - mid.x, cell.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y) ? cell : best,
    );
    const box = room.current;
    const tile = tiles.current.get(rulesetCellKey(near));
    if (!box || !tile) return;
    placed.current = true;
    const at = tile.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    box.scrollTo({
      left: box.scrollLeft + at.left - frame.left - (box.clientWidth - at.width) / 2,
      top: box.scrollTop + at.top - frame.top - (box.clientHeight - at.height) / 2,
    });
  }, [scrolls, placing]);
  // Opponents past the room's edge on a board that scrolls (re-test 2026-10-24: on a phone nothing
  // said where the rest of the fight was): a mark on that edge counts them, and takes the room to
  // the nearest.
  const foes = useMemo(
    () =>
      view.combatants.flatMap((one) =>
        one.side === "enemy" && !one.defeated && typeof one.x === "number" && typeof one.y === "number"
          ? [{ id: one.id, x: one.x, y: one.y }]
          : [],
      ),
    [view.combatants],
  );
  const [away, setAway] = useState<Record<"left" | "right" | "up" | "down", Array<{ x: number; y: number }>>>({
    left: [],
    right: [],
    up: [],
    down: [],
  });
  // The part of the room that is actually on screen, where the marks sit (laptop playtest 2026-10-24:
  // a "▶19" stood at the middle of the whole room, 311px above the window, when the room ran past
  // what its column and the window show). Measured against the box the marks are laid out in.
  const stage = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const box = room.current;
    if (!scrolls || !box) return;
    const measure = () => {
      const whole = box.getBoundingClientRect();
      let left = whole.left;
      let top = whole.top;
      let right = whole.right;
      let bottom = whole.bottom;
      // Every box above that clips (the board's column, the chat area), then the window itself.
      for (let up = box.parentElement; up; up = up.parentElement) {
        const style = window.getComputedStyle(up);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const clip = up.getBoundingClientRect();
        if (style.overflowX !== "visible") {
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (style.overflowY !== "visible") {
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
      }
      left = Math.max(left, 0);
      top = Math.max(top, 0);
      right = Math.min(right, window.innerWidth);
      bottom = Math.min(bottom, window.innerHeight);
      const origin = stage.current?.getBoundingClientRect();
      const nextSeen =
        origin && right > left && bottom > top
          ? {
              left: Math.round(left - origin.left),
              top: Math.round(top - origin.top),
              width: Math.round(right - left),
              height: Math.round(bottom - top),
            }
          : null;
      setSeen((before) => (JSON.stringify(before) === JSON.stringify(nextSeen) ? before : nextSeen));
      const frame = { left, top, right, bottom };
      const next: Record<"left" | "right" | "up" | "down", Array<{ x: number; y: number }>> = {
        left: [],
        right: [],
        up: [],
        down: [],
      };
      for (const foe of foes) {
        const tile = tiles.current.get(rulesetCellKey(foe));
        if (!tile) continue;
        const at = tile.getBoundingClientRect();
        const edge =
          at.right <= frame.left
            ? "left"
            : at.left >= frame.right
              ? "right"
              : at.bottom <= frame.top
                ? "up"
                : at.top >= frame.bottom
                  ? "down"
                  : null;
        if (edge) next[edge].push({ x: foe.x, y: foe.y });
      }
      setAway((before) => (JSON.stringify(before) === JSON.stringify(next) ? before : next));
    };
    measure();
    // Any scroll counts, the room's own or a box's above it; and the room changes size without the
    // window doing so when the log or the combat pane is put away.
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    const sized = new ResizeObserver(measure);
    sized.observe(box);
    return () => {
      document.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
      sized.disconnect();
    };
  }, [scrolls, foes]);
  const bring = (cell: { x: number; y: number }) => {
    const box = room.current;
    const tile = tiles.current.get(rulesetCellKey(cell));
    if (!box || !tile) return;
    const at = tile.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    box.scrollTo({
      left: box.scrollLeft + at.left - frame.left - (box.clientWidth - at.width) / 2,
      top: box.scrollTop + at.top - frame.top - (box.clientHeight - at.height) / 2,
      behavior: "smooth",
    });
  };
  // A step that ends, or a turn that moves on, leaves nothing half-described under the board.
  useEffect(() => {
    setReading(null);
    setArmed(null);
  }, [step?.stage, step?.option.id, view.actorId, view.round]);

  // Escape is the PLAYER closing the step, so the keyboard goes back to the menu the choice was
  // made on. Not in the handler: the menu only draws the root it lands on once the step is gone,
  // so the move waits for the render that puts it back.
  const returnFocus = useRef(false);
  const leaveStep = useCallback(() => {
    returnFocus.current = true;
    setStep(null);
  }, [setStep]);
  useEffect(() => {
    if (step !== null || !returnFocus.current) return;
    returnFocus.current = false;
    menuRoot.current?.focus();
  }, [step, menuRoot]);

  // Opening a step that is finished ON THE BOARD (walking, aiming) takes the keyboard to the board,
  // onto the square of whoever is up. The button that opened the step has just been unmounted, so
  // without this the focus falls to the page and neither the arrows nor Escape reach anything,
  // which is exactly what a player who clicked the option with a mouse and then pressed Escape got.
  const boardStage = step?.stage === "move" || step?.stage === "aim" || step?.stage === "carry" ? step.stage : null;
  const boardStepOption = boardStage ? step?.option.id : undefined;
  useEffect(() => {
    if (!boardStage) return;
    tiles.current.get(rulesetCellKey(cursorRef.current))?.focus();
  }, [boardStage, boardStepOption]);

  const focusCell = (x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(grid.width - 1, x));
    const clampedY = Math.max(0, Math.min(grid.height - 1, y));
    // Off the map is no square to stand the cursor on (2026-10-24).
    if (byKey.get(rulesetCellKey({ x: clampedX, y: clampedY }))?.outside) return;
    setCursor({ x: clampedX, y: clampedY });
    tiles.current.get(rulesetCellKey({ x: clampedX, y: clampedY }))?.focus();
  };

  const touch = useMatchMedia("(pointer: coarse)");
  /** What clicking or pressing Enter on this square does, which is only ever finishing a step the
   *  player opened. A square outside the step is inert: it is information, not a command. */
  const takeCell = (cell: RulesetBoardCell) => {
    if (busy) return;
    if (placing && onPlace) {
      onPlace({ x: cell.x, y: cell.y });
      return;
    }
    if (!step) return;
    if (step.stage === "move" && cell.reach) {
      // A finger is easily a square off, and a walk cannot be taken back: on a touch screen the
      // first tap picks the square and a second tap on it walks, as an aim is laid.
      if (touch && (step.to?.x !== cell.x || step.to?.y !== cell.y)) {
        setStep({ ...step, to: { x: cell.x, y: cell.y } });
        setCursor({ x: cell.x, y: cell.y });
        return;
      }
      setStep(null);
      onChoose(step.option.id, [], step.payWith, { to: { x: cell.x, y: cell.y } }, step.style, step.mode);
      return;
    }
    // A wall set down waits for the way it runs, and any square turns it (1.177).
    if (step.stage === "aim" && (cell.aim || rulesetAimTurning(step.option, step.lay))) {
      const key = rulesetCellKey(cell);
      const friendly = !sparing && rulesetAimCatchesAllies(view, cell.aim?.targetIds ?? [], step.option).length > 0;
      if ((friendly || lastPointer.current !== "keyboard") && armed !== key) {
        setArmed(key);
        setReading({ x: cell.x, y: cell.y });
        return;
      }
      setArmed(null);
      const taken = rulesetAimTake(step.option, step.lay, cell);
      if ("lay" in taken) {
        setStep({ ...step, lay: taken.lay });
        return;
      }
      // Who it spares and who it heightens are picked in the menu first, where there is a pick
      // (1.254, 1.255).
      const picks = rulesetPicksStep(view, step, [], taken.send);
      if (picks) {
        setStep(picks);
        return;
      }
      setStep(null);
      // Who goes along on a teleport (1.276), or whom a layered wall spares (1.492), picked in the
      // menu while it is aimed.
      const carries = step.option.teleport ? step.targets : [];
      const designates = step.option.designates ? step.targets : [];
      onChoose(
        step.option.id,
        [],
        step.payWith,
        carries.length ? { ...taken.send, carries } : designates.length ? { ...taken.send, designates } : taken.send,
        step.style,
        step.mode,
        step.amount,
        step.alters,
      );
      return;
    }
    // Where its target is moved to (1.565), lifted as the menu says: Telekinesis.
    if (step.stage === "carry" && cell.aim?.carry) {
      setStep(null);
      onChoose(
        step.option.id,
        step.targets,
        step.payWith,
        { to: { x: cell.x, y: cell.y }, ...(step.rises ? { rises: step.rises } : {}) },
        step.style,
        step.mode,
        step.amount,
        step.alters,
      );
      return;
    }
    // A wall's section the attack may strike (1.200): sent at once, as one target is.
    if (step.stage === "target" && cell.strikable) {
      setStep(null);
      onChoose(
        step.option.id,
        [],
        step.payWith,
        { wall: { x: cell.x, y: cell.y } },
        step.style,
        step.mode,
        step.amount,
        step.alters,
      );
      return;
    }
    // The same two rules the list in the menu picks by, so clicking a token and clicking its name
    // can never disagree about what was picked.
    if (step.stage === "target" && cell.targetable && cell.occupant) {
      const targets = rulesetPickTarget(step.option, step.targets, cell.occupant.id);
      if (rulesetSendsOnPick(step.option) && targets.length === 1) {
        // Where it moves them is picked next (1.565).
        const picks = rulesetPicksStep(view, step, targets);
        if (picks) {
          setStep(picks);
          return;
        }
        setStep(null);
        onChoose(step.option.id, targets, step.payWith, undefined, step.style, step.mode, step.amount, step.alters);
        return;
      }
      setStep({ ...step, targets });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: RulesetBoardCell) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = moves[event.key];
    if (delta) {
      event.preventDefault();
      focusCell(cell.x + delta[0], cell.y + delta[1]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusCell(0, cell.y);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusCell(grid.width - 1, cell.y);
      return;
    }
    // Leaving a step is the PLAYER closing it, so the keyboard goes back where the choice was made.
    if (event.key === "Escape" && step) {
      event.preventDefault();
      leaveStep();
    }
  };

  const palette = TERRAIN_PALETTES[environment ?? "default"] ?? TERRAIN_PALETTES.default;
  const tintAlpha = environment && TERRAIN_PALETTES[environment] ? TILE_TINT_ALPHA_THEMED : TILE_TINT_ALPHA;
  const sprites = useMemo(() => new Map(units.map((unit) => [unit.id, unit.sprite])), [units]);
  // Who the AI plays: every party member but the leader, unless the player took them, as the
  // turn order's Control column says.
  const played = useMemo(() => {
    const leader = units.find((unit) => unit.side === "player" && unit.hp > 0)?.id;
    return new Set(
      units
        .filter((unit) => unit.side === "player" && unit.id !== leader && (unit.controller ?? "ai") === "ai")
        .map((unit) => unit.id),
    );
  }, [units]);
  // Board art (1.333): the pack the board names, else its environment's, and the props pack. Without
  // one, every square is drawn as before.
  const boardArt = useBoardArt(grid.pack, grid.scene ?? grid.environment ?? environment);
  const cellArt = useMemo(
    () =>
      new Map(
        cells.map((cell) => [
          rulesetCellKey(cell),
          boardCellArt(boardArt, cell, (x, y) => grid.tiles[y]?.[x] ?? "plains", grid.width, grid.height),
        ]),
      ),
    [cells, boardArt, grid],
  );
  const drawn = !!boardArt.board;
  // Creature art (design-game-creature-art.md): the library's creature pack, and which way each fighter faces.
  const creaturePacks = useCreaturePacks();
  const facings = useCreatureFacings(
    cells.flatMap((cell) =>
      cell.occupant && cell.anchor ? [{ id: cell.occupant.id, x: cell.x, y: cell.y, side: cell.occupant.side }] : [],
    ),
    // A ruleset fight has no id of its own on screen: its fighters, as it began, tell one from the next.
    view.order.join(","),
  );

  // What the strip under the board says: the square being read, or, failing that, the one line a
  // fight nobody can reach has to say out loud.
  // Every square's sentences, worked out once per view and step, for the square's own name and for
  // the strip alike.
  const sentences = useMemo(
    () => new Map(cells.map((cell) => [rulesetCellKey(cell), rulesetCellSentences(cell, view, t).join(" ")])),
    [cells, view, t],
  );
  const readingKey = reading ? rulesetCellKey(reading) : undefined;
  const readingHint = readingKey === undefined ? undefined : sentences.get(readingKey);
  const said =
    readingHint ??
    (held?.cells?.length
      ? t("game.combat.ruleset.screen.areaHint", { label: held.label ?? "" })
      : rulesetNothingInReach(view)
        ? t("game.combat.ruleset.board.nothingInReach")
        : "");
  // While a step is finished on the board, the line also says how.
  // A finger has no Enter or Escape to be told about.
  const hint = [said, boardStage && !touch ? t("game.combat.ruleset.screen.stepHint") : ""].filter(Boolean).join(" ");
  const allyNames = view.combatants.filter((one) => alliesCaught.has(one.id)).map((one) => one.name);
  const warning =
    allyNames.length > 0
      ? t(sparing ? "game.combat.ruleset.board.catchesAlliesSpared" : "game.combat.ruleset.board.catchesAllies", {
          names: allyNames.join(", "),
        })
      : armed && readingKey === armed
        ? t("game.combat.ruleset.board.tapAgain")
        : "";

  return (
    <div className={cn("relative flex min-h-0 flex-col text-white", className)}>
      <style>{TACTICAL_BOARD_KEYFRAMES}</style>
      {/* The board keeps a floor of its own height, and takes whatever the log and the pane leave. */}
      {/* The room and the marks on its edges, which stay where they are while it scrolls. */}
      <div ref={stage} className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={room}
          className={cn(
            "relative z-10 flex min-h-[9rem] flex-1 items-start px-1.5 pt-1.5 [container-type:size] sm:min-h-[12rem] sm:px-3 sm:pt-3",
            scrolls ? "overflow-auto pb-1.5 sm:pb-3" : "justify-center overflow-hidden",
          )}
        >
          <div
            role="group"
            aria-label={t("game.combat.ruleset.board.title")}
            // Whole and square, whichever way the room runs out. The box above is a size container, so
            // the board can ask how wide AND how tall its room is: it takes the full width, or the
            // width its own shape allows at the full height, whichever is smaller. (A width of 100%
            // with a ceiling on the height does NOT do this: the ceiling clamps the height and the
            // width stays, which stretched every square sideways on a wide screen.)
            className="relative mx-auto mb-auto mt-0 shrink-0 md:m-auto"
            style={{
              aspectRatio: `${grid.width} / ${grid.height}`,
              width: scrolls
                ? `max(${grid.width} * 1.75rem, min(100cqw, calc(100cqh * ${grid.width} / ${grid.height})))`
                : `min(100cqw, calc(100cqh * ${grid.width} / ${grid.height}))`,
            }}
          >
            <div
              className={cn("absolute inset-0 grid", drawn ? "gap-0" : "gap-[2px]")}
              style={{
                gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                gridTemplateRows: `repeat(${grid.height}, 1fr)`,
              }}
            >
              {cells.map((cell) => {
                const key = rulesetCellKey(cell);
                // Beyond the board's outline (2026-10-24): nothing, not even a square's frame.
                if (cell.outside) return <div key={key} aria-hidden="true" className="pointer-events-none" />;
                const icon = resolveTerrainIcon(environment, cell.terrain);
                const onPath = path.has(key);
                const provokes = (cell.reach?.provokes.length ?? 0) > 0;
                const isCursor = cursor.x === cell.x && cursor.y === cell.y;
                const isActor = actor?.x === cell.x && actor?.y === cell.y;
                const isAimed = !!aimed && reading?.x === cell.x && reading?.y === cell.y;
                const art = cellArt.get(key);
                return (
                  <button
                    type="button"
                    key={key}
                    data-cell={key}
                    ref={(node) => {
                      if (node) tiles.current.set(key, node);
                      else tiles.current.delete(key);
                    }}
                    tabIndex={isCursor ? 0 : -1}
                    aria-label={[
                      t("game.combat.ruleset.board.cell", { x: cell.x, y: cell.y }),
                      sentences.get(key) ?? "",
                      cell.zones ? t("game.combat.ruleset.board.zones", { zones: cell.zones.join(", ") }) : "",
                      cell.summons ? t("game.combat.ruleset.board.summons", { names: cell.summons.join(", ") }) : "",
                    ].join(" ")}
                    // Who stands here, said on hover as the token's letters cannot, with the odds against
                    // them while a target is being picked.
                    title={
                      cell.occupant
                        ? [
                            cell.occupant.name,
                            step?.stage === "target" && cell.targetable && step.option.forecastFor?.[cell.occupant.id]
                              ? rulesetOptionForecastText(
                                  { ...step.option, forecast: step.option.forecastFor[cell.occupant.id] },
                                  t,
                                )
                              : "",
                          ]
                            .filter(Boolean)
                            .join(": ")
                        : undefined
                    }
                    onPointerDown={(event) => {
                      lastPointer.current = event.pointerType;
                    }}
                    onClick={(event) => {
                      // A click the keyboard made has no pointer behind it.
                      if (event.detail === 0) lastPointer.current = "keyboard";
                      takeCell(cell);
                    }}
                    onKeyDown={(event) => onKeyDown(event, cell)}
                    onFocus={() => {
                      setCursor({ x: cell.x, y: cell.y });
                      setReading({ x: cell.x, y: cell.y });
                    }}
                    onBlur={() =>
                      setReading((current) => (current?.x === cell.x && current.y === cell.y ? null : current))
                    }
                    // Hover reads a square for a mouse or a pen only. A phone fires the mouse's enter as
                    // part of a tap, and a page that changes under that enter has its tap taken for a
                    // hover (Safari drops the click), which is how the first tap on a square did nothing.
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "touch") setReading({ x: cell.x, y: cell.y });
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType === "touch") return;
                      setReading((current) => (current?.x === cell.x && current.y === cell.y ? null : current));
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-[3px] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
                      cell.solid && "cursor-not-allowed",
                    )}
                    style={{ backgroundColor: palette[cell.terrain] + TILE_ALPHA, boxShadow: tileShadow(cell.terrain) }}
                  >
                    {art?.ground ? (
                      // The pack's ground (1.333), then its edge blocks over it, a quarter of a corner each.
                      <>
                        <span className="pointer-events-none absolute inset-0" style={boardSliceStyle(art.ground)} />
                        {art.edges.map(({ quarter, slice }) => (
                          <span
                            key={quarter}
                            className={cn(
                              "pointer-events-none absolute h-1/2 w-1/2",
                              quarter % 2 ? "left-1/2" : "left-0",
                              quarter > 1 ? "top-1/2" : "top-0",
                            )}
                            style={boardSliceStyle(slice)}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: `url(${TILE_TEXTURES[cell.terrain]})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            transform: `rotate(${((cell.x * 7 + cell.y * 13) % 4) * 90}deg) scale(1.03)`,
                          }}
                        />
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{ backgroundColor: palette[cell.terrain] + tintAlpha }}
                        />
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
                      </>
                    )}
                    {cell.terrain === "water" && !art?.ground && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 30%, rgba(125,211,252,0.35) 50%, transparent 70%)",
                          backgroundSize: "200% 200%",
                          animation: "tc-shimmer 3.5s linear infinite",
                        }}
                      />
                    )}
                    {/* Raised ground (combat C6b): lighter a level, marked in the corner. */}
                    {cell.height > 0 && art?.rim && (
                      <span className="pointer-events-none absolute inset-0" style={boardSliceStyle(art.rim)} />
                    )}
                    {cell.height > 0 && !art?.rim && (
                      <span className="pointer-events-none absolute inset-0" style={heightWash(cell.height)}>
                        <span className="absolute right-0.5 top-0 text-[0.5em] font-bold leading-none text-white/75">
                          {"▲".repeat(Math.min(cell.height, 3))}
                        </span>
                      </span>
                    )}
                    {/* Nothing walks in and nothing sees through: drawn solid rather than merely dark. */}
                    {cell.solid && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25",
                          !art?.ground && "bg-black/45",
                        )}
                      />
                    )}
                    {icon && !art?.ground && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.7em] opacity-45">
                        {icon}
                      </span>
                    )}
                    {placing?.has(key) && (
                      <span
                        className="pointer-events-none absolute inset-0 bg-emerald-400/50 ring-2 ring-inset ring-emerald-100/90"
                        style={{ animation: "tc-move-range 1.5s ease-in-out infinite" }}
                      />
                    )}
                    {cell.reach && art?.reach && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{ ...boardSliceStyle(art.reach), animation: "tc-move-range 1.5s ease-in-out infinite" }}
                      />
                    )}
                    {cell.reach && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0 ring-1 ring-inset",
                          provokes
                            ? "bg-amber-400/35 ring-amber-300/70"
                            : cn(!art?.reach && "bg-sky-400/35", "ring-sky-300/70"),
                        )}
                        style={{ animation: "tc-move-range 1.5s ease-in-out infinite" }}
                      />
                    )}
                    {/* The walk itself, over the highlight: every cell it passes through, drawn as it
                      is hovered or focused so the way round a wall is visible before it is taken. */}
                    {onPath && (
                      <span className="pointer-events-none absolute inset-0 bg-white/30 ring-2 ring-inset ring-white/70" />
                    )}
                    {/* Somebody would swing at this walk on the way. The cell is amber above; this is
                      the mark that says why, and the strip under the board names them. */}
                    {provokes && (
                      <span className="pointer-events-none absolute left-0 top-0 bg-amber-300/90 px-[2px] text-[0.5rem] font-black leading-tight text-black">
                        !
                      </span>
                    )}
                    {cell.reach && (
                      <span className="pointer-events-none absolute bottom-0 right-0 bg-black/60 px-[2px] text-[0.5rem] font-bold leading-tight tabular-nums text-white/90">
                        {rulesetDistanceText(cell.reach.cost, grid.distance, t)}
                      </span>
                    )}
                    {/* The light on the square when it is not bright, and a fog or haze over it. */}
                    {cell.light && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0",
                          !art?.light && cell.light === "dark" && "bg-black/60",
                          !art?.light && cell.light === "dim" && "bg-black/30",
                          !art?.light && cell.light === "sunlight" && "bg-white/20",
                        )}
                        style={art?.light ? boardSliceStyle(art.light) : undefined}
                        title={t(RULESET_BOARD_LIGHT_KEYS[cell.light])}
                      />
                    )}
                    {cell.fog && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0",
                          !art?.fog && (cell.fog === "heavy" ? "bg-white/50" : "bg-white/25"),
                        )}
                        style={art?.fog ? boardSliceStyle(art.fog) : undefined}
                        title={t(RULESET_BOARD_FOG_KEYS[cell.fog])}
                      />
                    )}
                    {art?.ice && (
                      <span className="pointer-events-none absolute inset-0" style={boardSliceStyle(art.ice)} />
                    )}
                    {/* A lasting area (1.172): the pack's art for it, under a clear tint that is always drawn,
                      because a pack's area art alone can read as no more than a shadow on the ground. */}
                    {cell.zones && (
                      <>
                        {art?.zones.map((slice, n) => (
                          <span
                            key={n}
                            className="pointer-events-none absolute inset-0"
                            style={boardSliceStyle(slice)}
                          />
                        ))}
                        {/* Each area's own tint, side by side where two overlap. */}
                        {(cell.zoneTints ?? [0]).map((tint, n, tints) => (
                          <span
                            key={`tint-${tint}`}
                            className={cn(
                              "pointer-events-none absolute inset-y-0 ring-1 ring-inset",
                              ZONE_TINT_CLASSES[tint],
                            )}
                            style={{ left: `${(n * 100) / tints.length}%`, width: `${100 / tints.length}%` }}
                            title={cell.zones?.join(", ")}
                          />
                        ))}
                      </>
                    )}
                    {/* What a spell called up strikes from here (a Spiritual Weapon). */}
                    {cell.summons && (
                      <span
                        className="pointer-events-none absolute right-0 top-0 z-[1] flex h-1/2 w-1/2 items-center justify-center rounded-bl bg-black/70 text-amber-200 ring-1 ring-amber-300/60"
                        title={cell.summons.join(", ")}
                      >
                        <Sword className="h-[80%] w-[80%]" aria-hidden="true" />
                      </span>
                    )}
                    {/* A wall's section (1.200): how much it has left, and a ring while it may be struck. */}
                    {cell.section && cell.section.health > 0 && (
                      <span className="pointer-events-none absolute bottom-0 left-0 bg-black/60 px-[2px] text-[0.5rem] font-bold leading-tight tabular-nums text-white">
                        {cell.section.health}
                      </span>
                    )}
                    {/* Growth (1.318): a tangle over the square, in the theme's primary colour until art draws it. */}
                    {cell.growth && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0",
                          !art?.growth && "bg-[var(--primary)]/30 ring-1 ring-inset ring-[var(--primary)]/40",
                        )}
                        style={art?.growth ? boardSliceStyle(art.growth) : undefined}
                        title={t("game.combat.ruleset.board.growth")}
                      />
                    )}
                    {/* A prop (1.316): drawn as a crate standing in the square, its health in the corner;
                      broken, as its rubble. */}
                    {cell.prop && (
                      <span
                        className={cn(
                          "pointer-events-none absolute",
                          art?.prop
                            ? "inset-0"
                            : cn(
                                "inset-[18%] rounded-[2px] border",
                                cell.prop.health > 0
                                  ? "border-[var(--foreground)]/60 bg-[var(--muted)]/80"
                                  : "border-dashed border-[var(--foreground)]/40 bg-transparent",
                              ),
                        )}
                        style={art?.prop ? boardSliceStyle(art.prop) : undefined}
                        title={
                          cell.prop.health > 0
                            ? t("game.combat.ruleset.board.prop", {
                                label: cell.prop.label,
                                health: cell.prop.health,
                                max: cell.prop.max,
                              })
                            : t("game.combat.ruleset.board.propBroken", { label: cell.prop.label })
                        }
                      />
                    )}
                    {cell.prop && cell.prop.health > 0 && (
                      <span className="pointer-events-none absolute bottom-0 right-0 bg-black/60 px-[2px] text-[0.5rem] font-bold leading-tight tabular-nums text-white">
                        {cell.prop.health}
                      </span>
                    )}
                    {cell.strikable && (
                      <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[var(--destructive)]" />
                    )}
                    {(cell.aim || cell.laid) && (
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-0 ring-1 ring-inset",
                          isAimed || cell.laid
                            ? "bg-amber-400/55 ring-2 ring-amber-200"
                            : cn(!art?.aim && "bg-amber-400/20", "ring-amber-300/40"),
                        )}
                        style={art?.aim && !isAimed && !cell.laid ? boardSliceStyle(art.aim) : undefined}
                      />
                    )}
                    {template.has(key) && (
                      <span
                        data-template=""
                        className="pointer-events-none absolute inset-0 bg-orange-500/35 ring-1 ring-inset ring-orange-200/70"
                      />
                    )}
                    {/* Somebody else's area, held open for an answer: where it lands. */}
                    {heldCells.has(key) && (
                      <span className="pointer-events-none absolute inset-0 bg-[#f5c97a]/45 ring-1 ring-inset ring-[#f5c97a]/90" />
                    )}
                    {isActor && (
                      <span className="pointer-events-none absolute inset-0 rounded-[3px] border-2 border-dashed border-white/85" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tokens never take the pointer: a click on one lands on the square beneath it, so the
              board has exactly one focusable thing per square and the arrow keys mean one thing. */}
            {cells.map((cell) => {
              const combatant = cell.occupant;
              // Drawn once, from its top-left cell, across every cell it fills (1.194).
              if (!combatant || !cell.anchor) return null;
              const span = Math.max(1, combatant.span ?? 1);
              const key = rulesetCellKey(cell);
              const onTurn = combatant.id === view.actorId;
              const party = combatant.side === "party";
              const ai = party && played.has(combatant.id);
              const sprite = resolveSprite(sprites.get(combatant.id));
              // An opponent with no picture of its own is drawn with its creature art when the pack has it.
              const creature =
                combatant.side !== "party" && sprite.kind !== "url"
                  ? findCreatureArtIn(creaturePacks, {
                      creature: combatant.creature,
                      rulesetId: view.ruleset.id,
                      name: combatant.name,
                    })
                  : null;
              const percent = rulesetHealthPercent(combatant.health);
              const bar = rulesetHealthTone(percent);
              // What they are doing (dodging, hidden), beside what the fight put on them, which the
              // condition marks show.
              const stances = (combatant.stances ?? []).map((stance) => ({
                id: `stance:${stance}`,
                label: t(`game.combat.ruleset.stance.${stance}`),
              }));
              // A trait they hold all fight is never marked, or Lucky would hide Blessed.
              const marked = combatant.conditions.filter((condition) => !condition.trait);
              // One ring, the strongest that applies: who is up, who may be picked, who an area catches
              // (red where it is one of the caster's own side).
              const glow = onTurn
                ? "0 0 0 2px #ffffff, 0 0 14px 3px rgba(255,255,255,0.55)"
                : cell.targetable
                  ? "0 0 0 2px #ff5d73, 0 0 12px 2px rgba(255,93,115,0.6)"
                  : alliesCaught.has(combatant.id)
                    ? "0 0 0 3px #ef4444, 0 0 12px 2px rgba(239,68,68,0.7)"
                    : caught.has(combatant.id)
                      ? "0 0 0 2px #f5c97a, 0 0 12px 2px rgba(245,201,122,0.6)"
                      : // A prisoner reads at a glance (re-test 16): a white ring as well as its flag.
                        combatant.surrendered
                        ? "0 0 0 2px rgba(255,255,255,0.9)"
                        : undefined;
              return (
                <div
                  key={combatant.id}
                  data-combatant={combatant.id}
                  data-cell={key}
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-200",
                    // A prisoner (re-test 15) is no corpse: dimmed, in its colours, under a white flag.
                    combatant.defeated && !combatant.surrendered && "opacity-40 grayscale",
                    combatant.surrendered && "opacity-60",
                    !combatant.defeated && combatant.down && "opacity-70 grayscale",
                  )}
                  style={{
                    left: `${((cell.x + span / 2) / grid.width) * 100}%`,
                    top: `${((cell.y + span / 2) / grid.height) * 100}%`,
                    width: `${(100 / grid.width) * 0.84 * span}%`,
                  }}
                >
                  {/* The party is round and the other side square-cornered, so shape tells the sides
                    apart and the ring's colour only repeats it. */}
                  <div
                    className={cn(
                      "relative flex aspect-square w-full items-center justify-center border-2 shadow-lg drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] @container",
                      party ? "rounded-full" : "rounded-[24%]",
                    )}
                    style={{
                      borderColor: party ? "#9dbdff" : "#ff9aaa",
                      backgroundColor: party ? "rgba(42,71,120,0.92)" : "rgba(106,33,51,0.92)",
                      boxShadow: glow,
                    }}
                  >
                    {creature ? (
                      // The token is 0.84 of a cell: its art is drawn at the creature's own size, on the cell.
                      <CreatureArtFigure
                        pack={creature.pack}
                        creature={creature.creature}
                        // Fights of one ruleset share the key: a fighter keeps its look across them.
                        variant={creatureArtVariant(creature.creature, view.ruleset.id, combatant.id)}
                        facing={facings.get(combatant.id) ?? "down"}
                        flying={combatant.flying}
                        cellFraction={1 / 0.84}
                        label={combatant.name}
                      />
                    ) : sprite.kind === "url" ? (
                      <img
                        src={sprite.value}
                        alt=""
                        className={cn("h-full w-full object-cover", party ? "rounded-full" : "rounded-[24%]")}
                      />
                    ) : sprite.kind === "emoji" ? (
                      <span className="text-[min(4vw,1.5rem)] leading-none">{sprite.value}</span>
                    ) : (
                      // Sized by the token itself, so the letters stay inside it however small the
                      // squares are; a token too small for two keeps the first.
                      <span className="text-[38cqw] font-black leading-none text-white/90">
                        <span className="hidden @min-[24px]:inline">{initialsOf(combatant.name)}</span>
                        <span className="@min-[24px]:hidden">{initialsOf(combatant.name).slice(0, 1)}</span>
                      </span>
                    )}
                    {combatant.surrendered ? (
                      <span className="absolute -left-1 -top-1 z-20 flex h-[45%] w-[45%] items-center justify-center rounded-full bg-slate-900/90 ring-1 ring-white/80">
                        <Flag className="h-[70%] w-[70%] text-white" aria-hidden="true" />
                      </span>
                    ) : (
                      (combatant.defeated || combatant.down) && (
                        <Skull className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 text-[var(--destructive)] drop-shadow" />
                      )
                    )}
                    {/* Caught unaware (1.237): marked until their first turn is over. */}
                    {combatant.surprised && !combatant.defeated && !combatant.down && (
                      <Zap className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 text-[var(--primary)] drop-shadow" />
                    )}
                    {/* What they are doing (a letter each, three at most) and a ring for a spell they hold
                      together, down the right side. The square's own sentence names them in full. */}
                    {!combatant.defeated && (stances.length > 0 || combatant.concentrating) && (
                      <div className="absolute -right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-px">
                        {combatant.concentrating && (
                          <span className="flex h-3 w-3 items-center justify-center rounded-full border border-sky-300 bg-sky-500/80 text-[0.45rem] font-black leading-none text-white">
                            {t("game.combat.ruleset.board.concentratingBadge")}
                          </span>
                        )}
                        {stances.slice(0, 3).map((stance) => (
                          <span
                            key={stance.id}
                            title={stance.label}
                            className="flex h-3 w-3 items-center justify-center rounded-full border border-emerald-200 bg-emerald-600/85 text-[0.45rem] font-black uppercase leading-none text-white"
                          >
                            {stance.label.charAt(0)}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* The health bar sits ON the token rather than under it: a bar below the circle
                      is taller than the square it belongs to, and on a small board it laps over the
                      combatant in the next row. */}
                    {ai && (
                      <span className="absolute -right-1.5 -top-1.5 rounded-[4px] bg-[#9dbdff] px-[3px] text-[0.45rem] font-black leading-tight text-[#140e1c]">
                        {t("game.combat.ruleset.screen.aiTag")}
                      </span>
                    )}
                    {/* What is on them, by icon where the art pack has one and by the first letters of its
                      name where it does not: one letter is too many conditions' (Shielded, Stunned). */}
                    {marked.length > 0 && !combatant.defeated && (
                      <span className="absolute -left-1.5 -top-1.5 flex items-center gap-px">
                        {marked.slice(0, 2).map((condition) => (
                          <ArtIcon
                            key={condition.id}
                            ids={condition.icons ?? []}
                            className="h-3.5 w-3.5 rounded-sm bg-black/70 ring-1 ring-white/60"
                            fallback={
                              <span className="rounded-[3px] bg-black/75 px-[2px] text-[0.45rem] font-bold leading-tight text-white ring-1 ring-white/50">
                                {condition.label.slice(0, 3)}
                              </span>
                            }
                          />
                        ))}
                        {marked.length > 2 && (
                          <span className="rounded-[3px] bg-black/75 px-[2px] text-[0.45rem] font-bold leading-tight text-white">
                            +{marked.length - 2}
                          </span>
                        )}
                      </span>
                    )}
                    {/* Thick enough to read at a glance, and never thinner than a sliver while any health is left. */}
                    <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 overflow-hidden rounded-full bg-black/75 ring-1 ring-black/60 sm:h-2">
                      <div
                        className={cn("h-full transition-all duration-300", bar)}
                        style={{ width: `${percent > 0 ? Math.max(percent, 8) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {scrolls && seen && (
          <div className="pointer-events-none absolute z-20" style={seen}>
            {(["left", "right", "up", "down"] as const).map((edge) =>
              away[edge].length > 0 ? (
                <button
                  key={edge}
                  type="button"
                  aria-label={t("game.combat.ruleset.board.foesAway", { count: away[edge].length })}
                  title={t("game.combat.ruleset.board.foesAway", { count: away[edge].length })}
                  onClick={() => bring(away[edge][0]!)}
                  className={cn(
                    "pointer-events-auto absolute inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-rose-300/70 bg-black/75 px-2 text-xs font-bold text-rose-100 shadow focus-visible:outline-2 focus-visible:outline-white",
                    edge === "left" && "left-1 top-1/2 -translate-y-1/2",
                    edge === "right" && "right-1 top-1/2 -translate-y-1/2",
                    edge === "up" && "left-1/2 top-1 -translate-x-1/2",
                    edge === "down" && "bottom-1 left-1/2 -translate-x-1/2",
                  )}
                >
                  <span aria-hidden="true">{{ left: "◀", right: "▶", up: "▲", down: "▼" }[edge]}</span>
                  {away[edge].length}
                </button>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* One line, right under the board: what the square under the pointer or the keyboard is, or
          why an attack is offered nobody. A square being read is hidden from the live region, because
          the square's own name has just said the same words to a screen reader. */}
      <p
        aria-live="polite"
        data-game-section="ruleset-hint"
        className="z-10 mx-auto my-1.5 min-h-[1.5rem] max-w-[min(100%,46rem)] shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-center text-[0.7rem] leading-snug text-[var(--muted-foreground)] empty:invisible"
      >
        {warning && (
          <span data-warning="" className="mr-1 font-semibold text-red-300">
            {warning}
          </span>
        )}
        {readingHint === undefined ? hint : <span aria-hidden="true">{hint}</span>}
      </p>
      {/* What the board's marks mean, a tap away. */}
      <details className="z-10 mx-auto mb-1.5 max-w-[min(100%,46rem)] shrink-0 text-[0.68rem] text-[var(--muted-foreground)]">
        <summary className="cursor-pointer text-center">{t("game.combat.ruleset.legend.title")}</summary>
        <ul className="m-0 mt-1 grid list-none grid-cols-2 gap-x-3 gap-y-0.5 p-0 sm:grid-cols-3">
          {(
            [
              ["▲", "higher"],
              ["!", "struck"],
              ["◯", "turn"],
              ["◎", "pick"],
              ["☠", "down"],
              ["⚡", "surprised"],
            ] as const
          ).map(([mark, key]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 text-center font-bold text-[var(--foreground)]">
                {mark}
              </span>
              {t(`game.combat.ruleset.legend.${key}`)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
