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
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Skull } from "lucide-react";
import type { Combatant, DirectedRulesetView, RulesetCombatCell } from "@marinara-engine/shared";
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
  ringColorFor,
  tileShadow,
} from "../../lib/tactical-board-look";
import {
  rulesetBoardCells,
  rulesetCellKey,
  rulesetCellSentences,
  rulesetDistanceText,
  rulesetHealthPercent,
  rulesetNothingInReach,
  rulesetPathTo,
  type RulesetBoardCell,
} from "../../lib/ruleset-combat-board";
import { rulesetPickTarget, rulesetSendsOnPick, type RulesetMenuStep } from "../../lib/ruleset-combat-menu";
import { RulesetCombatMenu } from "./RulesetCombatMenu";
import { cn } from "../../lib/utils";

export interface RulesetCombatBoardProps {
  /** A view that carries a grid. Without one the caller keeps the Classic stage. */
  view: DirectedRulesetView;
  /** The Engine's own combatants, for the portraits only: every number on screen is the view's. */
  units: Combatant[];
  budgetLabel: (id: string) => string;
  /** The scene's terrain theme, which is the same string the board was generated from. */
  environment?: string;
  busy: boolean;
  onChoose: (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    cell?: { to?: RulesetCombatCell; at?: RulesetCombatCell },
  ) => void;
  onFlee: () => void;
  /** The per-member manual and automatic toggles, built by the caller so this file stays about the
   *  board. */
  controls?: ReactNode;
}

export function RulesetCombatBoard({
  view,
  units,
  budgetLabel,
  environment,
  busy,
  onChoose,
  onFlee,
  controls,
}: RulesetCombatBoardProps) {
  const { t } = useTranslation();
  const grid = view.grid!;
  const [step, setStep] = useState<RulesetMenuStep | null>(null);
  /** The cell the pointer or the keyboard is on, which is what the hint below the board describes. */
  const [reading, setReading] = useState<RulesetCombatCell | null>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const actor = view.combatants.find((combatant) => combatant.id === view.actorId);
  const cells = useMemo(() => rulesetBoardCells(view, step), [view, step]);
  const byKey = useMemo(() => new Map(cells.map((cell) => [rulesetCellKey(cell), cell])), [cells]);
  const path = useMemo(() => {
    if (!reading) return new Set<string>();
    return new Set(rulesetPathTo(step, reading).map(rulesetCellKey));
  }, [step, reading]);
  const aimed = reading && step?.stage === "aim" ? byKey.get(rulesetCellKey(reading))?.aim : undefined;
  const caught = useMemo(() => new Set(aimed?.targetIds ?? []), [aimed]);

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

  const holdStep = useCallback((next: RulesetMenuStep | null) => setStep(next), []);
  // Escape is the PLAYER closing the step, so the keyboard goes back to the menu the choice was
  // made on. Not in the handler: the menu only draws the root it lands on once the step is gone,
  // so the move waits for the render that puts it back.
  const returnFocus = useRef(false);
  const leaveStep = useCallback(() => {
    returnFocus.current = true;
    setStep(null);
  }, []);
  useEffect(() => {
    if (step !== null || !returnFocus.current) return;
    returnFocus.current = false;
    menuRoot.current?.focus();
  }, [step]);

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
      onChoose(step.option.id, [], step.payWith, { to: { x: cell.x, y: cell.y } });
      return;
    }
    if (step.stage === "aim" && cell.aim) {
      setStep(null);
      onChoose(step.option.id, [], step.payWith, { at: { x: cell.x, y: cell.y } });
      return;
    }
    // The same two rules the list in the menu picks by, so clicking a token and clicking its name
    // can never disagree about what was picked.
    if (step.stage === "target" && cell.targetable && cell.occupant) {
      const targets = rulesetPickTarget(step.option, step.targets, cell.occupant.id);
      if (rulesetSendsOnPick(step.option) && targets.length === 1) {
        setStep(null);
        onChoose(step.option.id, targets, step.payWith);
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
  const hint = readingHint ?? (rulesetNothingInReach(view) ? t("game.combat.ruleset.board.nothingInReach") : "");

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-white">
      <style>{TACTICAL_BOARD_KEYFRAMES}</style>
      {/* Radial vignette so the grid reads against the scene art without an opaque fill. */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.45) 60%, rgba(2,6,23,0.78) 100%)",
        }}
      />

      <div className="z-20 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-black/40 px-3 py-1.5 text-xs backdrop-blur">
        <span className="font-semibold text-white/80">
          {actor
            ? t("game.combat.ruleset.board.turnOf", { name: actor.name })
            : t("game.combat.ruleset.menu.waitingAnybody")}
        </span>
        {actor && typeof actor.movementLeft === "number" && (
          <span className="rounded-md bg-[var(--primary)]/20 px-2 py-0.5 font-semibold text-[var(--primary)]">
            {t("game.combat.ruleset.board.movementLeft", {
              amount: rulesetDistanceText(actor.movementLeft, grid.distance, t),
            })}
          </span>
        )}
      </div>

      {controls}

      {/* The board keeps a floor of its own height: the menu and the hint below both bound
          themselves, so a long menu or a long sentence can never squeeze the squares away. */}
      <div className="relative z-10 flex min-h-[9rem] flex-1 items-center justify-center overflow-auto p-1.5 [container-type:size] sm:min-h-[12rem] sm:p-3">
        <div
          role="group"
          aria-label={t("game.combat.ruleset.board.title")}
          // Whole and square, whichever way the room runs out. The box above is a size container, so
          // the board can ask how wide AND how tall its room is: it takes the full width, or the
          // width its own shape allows at the full height, whichever is smaller. (A width of 100%
          // with a ceiling on the height does NOT do this: the ceiling clamps the height and the
          // width stays, which stretched every square sideways on a wide screen.)
          className="relative m-auto shrink-0"
          style={{
            aspectRatio: `${grid.width} / ${grid.height}`,
            width: `min(100cqw, calc(100cqh * ${grid.width} / ${grid.height}))`,
          }}
        >
          <div
            className="absolute inset-0 grid gap-[2px]"
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
                  {cell.terrain === "water" && (
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
                  {/* Nothing walks in and nothing sees through: drawn solid rather than merely dark. */}
                  {cell.solid && (
                    <span className="pointer-events-none absolute inset-0 bg-black/45 ring-1 ring-inset ring-white/25" />
                  )}
                  {icon && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.7em] opacity-45">
                      {icon}
                    </span>
                  )}
                  {cell.reach && (
                    <span
                      className={cn(
                        "pointer-events-none absolute inset-0 ring-1 ring-inset",
                        provokes
                          ? "bg-amber-400/35 ring-amber-300/70"
                          : "bg-[var(--primary)]/40 ring-[var(--primary)]/60",
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
                  {cell.aim && (
                    <span
                      className={cn(
                        "pointer-events-none absolute inset-0 ring-1 ring-inset",
                        isAimed ? "bg-amber-400/55 ring-2 ring-amber-200" : "bg-amber-400/20 ring-amber-300/40",
                      )}
                    />
                  )}
                  {isActor && (
                    <span className="pointer-events-none absolute inset-0 rounded-[3px] border-2 border-dashed border-[var(--primary)]/80" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tokens never take the pointer: a click on one lands on the square beneath it, so the
              board has exactly one focusable thing per square and the arrow keys mean one thing. */}
          {cells.map((cell) => {
            const combatant = cell.occupant;
            if (!combatant) return null;
            const key = rulesetCellKey(cell);
            const onTurn = combatant.id === view.actorId;
            const ring = ringColorFor(combatant.id, combatant.side === "party" ? "party" : "enemy");
            const sprite = resolveSprite(sprites.get(combatant.id));
            const percent = rulesetHealthPercent(combatant.health);
            const bar = percent > 60 ? "bg-emerald-500" : percent > 25 ? "bg-amber-500" : "bg-red-500";
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
                  left: `${((cell.x + 0.5) / grid.width) * 100}%`,
                  top: `${((cell.y + 0.5) / grid.height) * 100}%`,
                  width: `${(100 / grid.width) * 0.84}%`,
                }}
              >
                <div
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center rounded-full border-2 shadow-lg drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]",
                    onTurn && "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-slate-900",
                    cell.targetable && "ring-2 ring-[var(--destructive)]",
                    caught.has(combatant.id) && "ring-2 ring-amber-200",
                  )}
                  style={{
                    borderColor: ring,
                    backgroundColor: combatant.side === "party" ? "rgba(30,58,90,0.9)" : "rgba(90,30,40,0.9)",
                    animation: onTurn ? "tc-ready-glow 1.8s ease-in-out infinite" : undefined,
                  }}
                >
                  {sprite.kind === "url" ? (
                    <img src={sprite.value} alt="" className="h-full w-full rounded-full object-cover" />
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
                  {/* The health bar sits ON the token rather than under it: a bar below the circle
                      is taller than the square it belongs to, and on a small board it laps over the
                      combatant in the next row. */}
                  <div className="absolute -bottom-1 left-0 right-0 h-1 overflow-hidden rounded-full bg-black/70 ring-1 ring-black/50">
                    <div className={cn("h-full transition-all duration-300", bar)} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* One line, bounded, right above the menu: what the square under the pointer or the keyboard
          is, or why an attack is offered nobody. A square being read is hidden from the live region,
          because the square's own name has just said the same words to a screen reader. */}
      <p
        aria-live="polite"
        className="z-10 min-h-[1.5rem] shrink-0 border-t border-white/10 bg-black/35 px-3 py-1 text-[0.65rem] leading-snug text-white/70 backdrop-blur"
      >
        {readingHint === undefined ? hint : <span aria-hidden="true">{hint}</span>}
      </p>

      <div className="z-10 shrink-0 border-t border-white/10 bg-black/40 backdrop-blur">
        <RulesetCombatMenu
          view={view}
          budgetLabel={budgetLabel}
          busy={busy}
          onChoose={onChoose}
          onFlee={onFlee}
          step={step}
          onStepChange={holdStep}
          menuRef={menuRoot}
        />
      </div>
    </div>
  );
}
