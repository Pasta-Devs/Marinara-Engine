import { useEffect, useMemo, useState } from "react";
import type { MultiplayerFight, MultiplayerFightCommand } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import type { MultiplayerGuestLabels } from "./multiplayer-guest-labels";

interface Props {
  fight: MultiplayerFight;
  labels: MultiplayerGuestLabels;
  disabled: boolean;
  onCommand: (command: MultiplayerFightCommand) => Promise<boolean>;
}

const BUTTON_CLASS =
  "mari-chrome-control flex !min-h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium !text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

/** The two sides apart at a glance, whatever the room's accent is. */
const PARTY_CLASS = "bg-sky-600";
const FOE_CLASS = "bg-red-700";

/** A board square's colour by its ground, plain enough to read at a glance. */
const TILE_CLASS: Record<string, string> = {
  plains: "bg-[color-mix(in_srgb,var(--secondary)_70%,green_30%)]",
  forest: "bg-[color-mix(in_srgb,var(--secondary)_45%,green_55%)]",
  mountain: "bg-[color-mix(in_srgb,var(--secondary)_50%,gray_50%)]",
  ruin: "bg-[color-mix(in_srgb,var(--secondary)_60%,sienna_40%)]",
  water: "bg-[color-mix(in_srgb,var(--secondary)_40%,steelblue_60%)]",
  wall: "bg-[color-mix(in_srgb,var(--foreground)_70%,black_30%)]",
};

function formatLabel(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{(\w+)\}\}/gu, (match, key: string) => String(values[key] ?? match));
}

const cellKey = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;

/**
 * A shared room's fight as a guest plays it (2026-10-27): who stands where and how they are, and for
 * the guest's own party members what they may do now. Everything here is the host's projection, read
 * as text and numbers only; each choice goes back to the host's fight, which checks it again.
 */
export function MultiplayerGuestFight({ fight, labels, disabled, onCommand }: Props) {
  const [optionId, setOptionId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [placing, setPlacing] = useState<string | null>(null);
  // A choice in hand belongs to the moment it was offered in.
  useEffect(() => {
    setOptionId(null);
    setPicked([]);
    setPlacing(null);
  }, [fight.id, fight.revision]);
  const byId = useMemo(() => new Map(fight.combatants.map((one) => [one.id, one])), [fight.combatants]);
  const option = fight.options.find((one) => one.id === optionId) ?? null;
  const actor = fight.actorId ? byId.get(fight.actorId) : undefined;
  const placeable = fight.deploy?.unitIds.filter((id) => byId.has(id)) ?? [];
  const placingId = placing ?? placeable[0] ?? null;
  const send = async (command: MultiplayerFightCommand) => {
    const accepted = await onCommand(command);
    if (accepted) {
      setOptionId(null);
      setPicked([]);
    }
  };
  const choose = (id: string) => {
    const chosen = fight.options.find((one) => one.id === id);
    if (!chosen) return;
    if (chosen.pick === "none") void send({ type: "ruleset", optionId: chosen.id, targetIds: [] });
    else {
      setOptionId(chosen.id);
      setPicked([]);
    }
  };
  const target = (id: string) => {
    if (!option || option.pick !== "targets" || !option.targetIds.includes(id)) return;
    if (option.count <= 1) {
      void send({ type: "ruleset", optionId: option.id, targetIds: [id] });
      return;
    }
    setPicked((current) =>
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id].slice(0, option.count),
    );
  };
  const cells = new Set(
    option?.pick === "cell"
      ? option.cells.map(cellKey)
      : placingId && fight.deploy
        ? fight.deploy.cells.map(cellKey)
        : [],
  );
  const clickCell = (x: number, y: number) => {
    if (disabled || !cells.has(cellKey({ x, y }))) return;
    if (option?.pick === "cell") {
      void send(
        option.moves
          ? { type: "ruleset", optionId: option.id, targetIds: [], to: { x, y } }
          : { type: "ruleset", optionId: option.id, targetIds: [], at: { x, y } },
      );
    } else if (placingId) {
      void onCommand({ type: "deploy", unitId: placingId, to: { x, y } }).then((accepted) => {
        if (accepted) setPlacing(null);
      });
    }
  };
  const status = fight.over
    ? labels.fightOver
    : fight.prompt
      ? fight.prompt
      : placingId
        ? formatLabel(labels.fightDeploy, { name: byId.get(placingId)?.name ?? "" })
        : actor?.mine && fight.options.length
          ? formatLabel(labels.fightYourTurn, { name: actor.name })
          : fight.waitingOn
            ? formatLabel(labels.fightWaitingOn, { name: fight.waitingOn })
            : actor
              ? formatLabel(labels.fightActing, { name: actor.name })
              : labels.gameCombat;
  const mine = fight.combatants.filter((one) => one.mine);

  return (
    <section
      aria-label={formatLabel(labels.fightTitle, { round: fight.round })}
      className="max-h-[70dvh] shrink-0 space-y-3 overflow-y-auto border-b border-[var(--border)] px-3 py-3 text-xs"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{formatLabel(labels.fightTitle, { round: fight.round })}</h2>
        <p role="status" aria-live="polite" className="font-medium text-[var(--primary)]">
          {status}
        </p>
      </div>

      {fight.grid && (
        <div
          className="mx-auto grid w-full max-w-xl gap-px rounded-md bg-[var(--border)] p-px"
          style={{ gridTemplateColumns: `repeat(${fight.grid.width}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: fight.grid.height }, (_, y) =>
            Array.from({ length: fight.grid!.width }, (_, x) => {
              const here = fight.combatants.find((one) => one.x === x && one.y === y && !one.defeated);
              const open = cells.has(cellKey({ x, y }));
              const pickable = !!here && option?.pick === "targets" && option.targetIds.includes(here.id);
              const tile = fight.grid!.tiles[y]?.[x] ?? "plains";
              return (
                <button
                  key={`${x},${y}`}
                  type="button"
                  disabled={disabled || !(open || pickable)}
                  aria-label={here ? here.name : formatLabel(labels.fightSquare, { x: x + 1, y: y + 1 })}
                  onClick={() => (pickable ? target(here.id) : clickCell(x, y))}
                  className={cn(
                    "relative aspect-square min-w-0 disabled:cursor-default",
                    TILE_CLASS[tile] ?? TILE_CLASS.plains,
                    (open || pickable) && "outline outline-2 -outline-offset-2 outline-[var(--primary)]",
                  )}
                >
                  {here && (
                    <span
                      className={cn(
                        "absolute inset-[12%] flex items-center justify-center overflow-hidden rounded-full text-[0.55rem] font-bold leading-none text-white",
                        here.side === "party" ? PARTY_CLASS : FOE_CLASS,
                        here.mine && "ring-2 ring-[var(--foreground)]",
                        here.id === fight.actorId && "outline outline-2 outline-yellow-300",
                        here.down && "opacity-50",
                      )}
                    >
                      {here.name.slice(0, 2)}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      )}

      <ul className="grid gap-1 sm:grid-cols-2">
        {fight.combatants.map((one) => {
          const pickable = option?.pick === "targets" && option.targetIds.includes(one.id);
          return (
            <li key={one.id}>
              <button
                type="button"
                disabled={disabled || !pickable}
                aria-pressed={pickable ? picked.includes(one.id) : undefined}
                onClick={() => target(one.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left disabled:cursor-default",
                  pickable ? "border-[var(--primary)]" : "border-[var(--border)]",
                  picked.includes(one.id) && "bg-[var(--accent)]",
                  one.id === fight.actorId && "ring-1 ring-yellow-400",
                  (one.defeated || one.down) && "opacity-60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 shrink-0 rounded-full", one.side === "party" ? PARTY_CLASS : FOE_CLASS)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {one.name}
                    {one.player && !one.mine && (
                      <span className="ml-1 font-normal text-[var(--muted-foreground)]">
                        {formatLabel(labels.fightPlayedBy, { name: one.player })}
                      </span>
                    )}
                    {one.mine && <span className="ml-1 font-normal text-[var(--primary)]">{labels.you}</span>}
                  </span>
                  {one.conditions.length > 0 && (
                    <span className="block truncate text-[var(--muted-foreground)]">{one.conditions.join(", ")}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {one.defeated || one.down
                    ? labels.fightDown
                    : formatLabel(labels.fightHealth, { value: Math.max(0, one.health.value), max: one.health.max })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {placeable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {placeable.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={placingId === id}
              className={cn(BUTTON_CLASS, placingId === id && "bg-[var(--accent)]")}
              onClick={() => setPlacing(id)}
            >
              {byId.get(id)?.name}
            </button>
          ))}
        </div>
      )}

      {fight.options.length > 0 && (
        <div className="space-y-2">
          {option ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">{option.label}</span>
                {" · "}
                {option.pick === "cell"
                  ? labels.fightPickCell
                  : formatLabel(labels.fightPickTargets, { count: option.count })}
              </p>
              {option.pick === "targets" && option.count > 1 && (
                <button
                  type="button"
                  className={BUTTON_CLASS}
                  disabled={disabled || picked.length === 0}
                  onClick={() => void send({ type: "ruleset", optionId: option.id, targetIds: picked })}
                >
                  {labels.fightConfirm}
                </button>
              )}
              <button type="button" className={BUTTON_CLASS} onClick={() => setOptionId(null)}>
                {labels.fightBack}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fight.options.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={BUTTON_CLASS}
                  disabled={disabled}
                  onClick={() => choose(one.id)}
                >
                  {one.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!fight.over && mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((one) =>
            one.controller ? (
              <button
                key={one.id}
                type="button"
                className={BUTTON_CLASS}
                disabled={disabled}
                onClick={() =>
                  void onCommand({
                    type: "control",
                    unitId: one.id,
                    controller: one.controller === "ai" ? "manual" : "ai",
                  })
                }
              >
                {formatLabel(one.controller === "ai" ? labels.fightTakeBack : labels.fightLetEngine, {
                  name: one.name,
                })}
              </button>
            ) : null,
          )}
        </div>
      )}

      {fight.log.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">{labels.fightLog}</summary>
          <ol className="mt-1 space-y-0.5 text-[var(--muted-foreground)]">
            {fight.log.map((line, index) => (
              <li key={index} className="break-words">
                {line}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
