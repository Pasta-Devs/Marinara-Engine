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
import { Skull, Zap } from "lucide-react";
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
  rulesetAimTake,
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
  rulesetPickTarget,
  rulesetSendsOnPick,
  rulesetPicksStep,
  type RulesetMenuStep,
} from "../../lib/ruleset-combat-menu";
import { boardCellArt, boardSliceStyle, useBoardArt } from "../../lib/board-art";
import { CreatureArtFigure, findCreatureArtIn, useCreatureFacings, useCreaturePacks } from "./CreatureArt";
import { cn } from "../../lib/utils";
import { rulesetHealthTone } from "./RulesetTurnOrder";
import { useMatchMedia } from "../../hooks/use-match-media";

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
  const path = useMemo(() => {
    if (!reading) return new Set<string>();
    return new Set(rulesetPathTo(step, reading).map(rulesetCellKey));
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

  // The keyboard starts on whoever is up, so a player who never touches the pointer is already
  // where the turn is. It follows the turn, and nothing else moves it.
  const [cursor, setCursor] = useState<RulesetCombatCell>({ x: 0, y: 0 });
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  useEffect(() => {
    if (typeof actor?.x === "number" && typeof actor?.y === "number") setCursor({ x: actor.x, y: actor.y });
  }, [actor?.x, actor?.y]);
  // A step that ends, or a turn that moves on, leaves nothing half-described under the board.
  useEffect(() => {
    setReading(null);
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
  const boardStage = step?.stage === "move" || step?.stage === "aim" ? step.stage : null;
  const boardStepOption = boardStage ? step?.option.id : undefined;
  useEffect(() => {
    if (!boardStage) return;
    tiles.current.get(rulesetCellKey(cursorRef.current))?.focus();
  }, [boardStage, boardStepOption]);

  const focusCell = (x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(grid.width - 1, x));
    const clampedY = Math.max(0, Math.min(grid.height - 1, y));
    setCursor({ x: clampedX, y: clampedY });
    tiles.current.get(rulesetCellKey({ x: clampedX, y: clampedY }))?.focus();
  };

  /** What clicking or pressing Enter on this square does, which is only ever finishing a step the
   *  player opened. A square outside the step is inert: it is information, not a command. */
  const takeCell = (cell: RulesetBoardCell) => {
    if (busy || !step) return;
    if (step.stage === "move" && cell.reach) {
      setStep(null);
      onChoose(step.option.id, [], step.payWith, { to: { x: cell.x, y: cell.y } }, step.style, step.mode);
      return;
    }
    // A wall set down waits for the way it runs, and any square turns it (1.177).
    if (step.stage === "aim" && (cell.aim || rulesetAimTurning(step.option, step.lay))) {
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
      // Who goes along on a teleport (1.276), picked in the menu while it is aimed.
      const carries = step.option.teleport ? step.targets : [];
      onChoose(
        step.option.id,
        [],
        step.payWith,
        carries.length ? { ...taken.send, carries } : taken.send,
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
  const touch = useMatchMedia("(pointer: coarse)");
  const hint = [said, boardStage && !touch ? t("game.combat.ruleset.screen.stepHint") : ""].filter(Boolean).join(" ");

  return (
    <div className={cn("relative flex min-h-0 flex-col text-white", className)}>
      <style>{TACTICAL_BOARD_KEYFRAMES}</style>
      {/* The board keeps a floor of its own height, and takes whatever the log and the pane leave. */}
      <div className="relative z-10 flex min-h-[9rem] flex-1 items-start justify-center overflow-hidden px-1.5 pt-1.5 [container-type:size] sm:min-h-[12rem] sm:px-3 sm:pt-3">
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
            width: `min(100cqw, calc(100cqh * ${grid.width} / ${grid.height}))`,
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
                  ].join(" ")}
                  onClick={() => takeCell(cell)}
                  onKeyDown={(event) => onKeyDown(event, cell)}
                  onFocus={() => {
                    setCursor({ x: cell.x, y: cell.y });
                    setReading({ x: cell.x, y: cell.y });
                  }}
                  onBlur={() =>
                    setReading((current) => (current?.x === cell.x && current.y === cell.y ? null : current))
                  }
                  onMouseEnter={() => setReading({ x: cell.x, y: cell.y })}
                  onMouseLeave={() =>
                    setReading((current) => (current?.x === cell.x && current.y === cell.y ? null : current))
                  }
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
                  {/* A lasting area (1.172): tinted, with its name in the tooltip of the square. */}
                  {cell.zones &&
                    (art?.zones.length ? (
                      art.zones.map((slice, n) => (
                        <span
                          key={n}
                          className="pointer-events-none absolute inset-0"
                          style={boardSliceStyle(slice)}
                          title={cell.zones!.join(", ")}
                        />
                      ))
                    ) : (
                      <span
                        className="pointer-events-none absolute inset-0 bg-[var(--accent)]/20 ring-1 ring-inset ring-[var(--accent)]/40"
                        title={cell.zones.join(", ")}
                      />
                    ))}
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
            // One ring, the strongest that applies: who is up, who may be picked, who an area catches.
            const glow = onTurn
              ? "0 0 0 2px #ffffff, 0 0 14px 3px rgba(255,255,255,0.55)"
              : cell.targetable
                ? "0 0 0 2px #ff5d73, 0 0 12px 2px rgba(255,93,115,0.6)"
                : caught.has(combatant.id)
                  ? "0 0 0 2px #f5c97a, 0 0 12px 2px rgba(245,201,122,0.6)"
                  : undefined;
            return (
              <div
                key={combatant.id}
                data-combatant={combatant.id}
                data-cell={key}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-200",
                  combatant.defeated && "opacity-40 grayscale",
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
                    "relative flex aspect-square w-full items-center justify-center border-2 shadow-lg drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]",
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
                    <span className="text-[min(3vw,0.9rem)] font-black text-white/90">
                      {initialsOf(combatant.name)}
                    </span>
                  )}
                  {(combatant.defeated || combatant.down) && (
                    <Skull className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 text-[var(--destructive)] drop-shadow" />
                  )}
                  {/* Caught unaware (1.237): marked until their first turn is over. */}
                  {combatant.surprised && !combatant.defeated && !combatant.down && (
                    <Zap className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 text-[var(--primary)] drop-shadow" />
                  )}
                  {/* The health bar sits ON the token rather than under it: a bar below the circle
                      is taller than the square it belongs to, and on a small board it laps over the
                      combatant in the next row. */}
                  {ai && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-[4px] bg-[#9dbdff] px-[3px] text-[0.45rem] font-black leading-tight text-[#140e1c]">
                      {t("game.combat.ruleset.screen.aiTag")}
                    </span>
                  )}
                  <div className="absolute -bottom-1 left-0 right-0 h-1 overflow-hidden rounded-full bg-black/70 ring-1 ring-black/50">
                    <div className={cn("h-full transition-all duration-300", bar)} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* One line, right under the board: what the square under the pointer or the keyboard is, or
          why an attack is offered nobody. A square being read is hidden from the live region, because
          the square's own name has just said the same words to a screen reader. */}
      <p
        aria-live="polite"
        data-game-section="ruleset-hint"
        className="z-10 mx-auto my-1.5 min-h-[1.5rem] max-w-[min(100%,46rem)] shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-center text-[0.7rem] leading-snug text-[var(--muted-foreground)] empty:invisible"
      >
        {readingHint === undefined ? hint : <span aria-hidden="true">{hint}</span>}
      </p>
    </div>
  );
}
