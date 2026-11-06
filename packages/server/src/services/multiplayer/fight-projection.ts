import {
  MULTIPLAYER_LIMITS,
  RULESET_MOVE_OPTION,
  multiplayerFightSchema,
  type DirectedCombatView,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type MultiplayerFight,
} from "@marinara-engine/shared";

/** The most a fight may take of a guest's snapshot, so the room's messages still fit beside it. */
export const MULTIPLAYER_FIGHT_BYTES = Math.floor(MULTIPLAYER_LIMITS.snapshotBytes / 2);

type Cell = { x: number; y: number };
const cellOf = (cell: Cell): Cell => ({ x: cell.x, y: cell.y });
const onBoard = (cell: Cell) =>
  Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.y >= 0 && cell.x < 256 && cell.y < 256;
const shortName = (value: string) => value.trim().slice(0, 80) || "?";

/** An option's name on a guest's buttons. A ready entry's own label is the bare word "ready", so it
 *  names what is readied and for when (laptop room playtest 2026-10-30: ten buttons all read
 *  "ready"); the standard actions' ids-as-labels ("dash") read as words. */
function optionText(option: DirectedRulesetOption): string {
  if (option.ready) {
    const name = option.ready.optionId === RULESET_MOVE_OPTION ? "Move" : option.ready.label;
    return `Ready ${name}: when an enemy ${option.ready.on === "comes" ? "comes in reach" : "acts"}`;
  }
  if (option.kind === "standard" && /^[a-z]/u.test(option.label))
    return option.label.charAt(0).toUpperCase() + option.label.slice(1);
  return option.label;
}

/** How a guest takes one option, or null for one this view cannot offer (a teleport's landing, a wall
 *  laid in a line, a kind of zone to name): those stay on the host's own screen. */
function optionPick(option: DirectedRulesetOption): MultiplayerFight["options"][number] | null {
  if (option.teleport || option.movesTarget || option.alterNeeded || option.kindsOf?.length || option.walls?.length)
    return null;
  const label = optionText(option).trim().slice(0, 120) || option.id.slice(0, 120);
  const base = { id: option.id, label, count: 0, targetIds: [] as string[], cells: [] as Cell[], moves: false };
  if (option.kind === "move") {
    const cells = (option.cells ?? []).filter(onBoard).slice(0, 400).map(cellOf);
    return cells.length ? { ...base, pick: "cell", cells, moves: true } : null;
  }
  if (option.area) {
    const cells = (option.aim ?? []).filter(onBoard).slice(0, 400).map(cellOf);
    return cells.length ? { ...base, pick: "cell", cells } : null;
  }
  if (option.targets.side === "self" || option.targets.count === 0) return { ...base, pick: "none" };
  // Nobody to point it at right now: the host's own menu folds these away too.
  if (option.targetIds.length === 0) return null;
  return {
    ...base,
    pick: "targets",
    count: Math.min(20, option.targets.count),
    targetIds: option.targetIds.slice(0, 60),
  };
}

/** One plain line for the steps a player most needs to follow; the rest stay on the host's log. */
function logLine(event: DirectedRulesetView["events"][number]["event"], nameOf: (id?: string) => string) {
  switch (event.type) {
    case "round":
      return `Round ${event.round}`;
    case "turn":
      return `${nameOf(event.actorId)}'s turn`;
    case "attack":
      return `${nameOf(event.actorId)} ${event.label ? `uses ${event.label} on` : "attacks"} ${nameOf(event.targetId)}: ${event.total} against ${event.defense}, ${event.outcome}`;
    case "save":
      return `${nameOf(event.actorId)} ${event.success ? "makes" : "fails"} a ${event.save} save (${event.total} against ${event.difficulty})`;
    case "damage":
      return `${nameOf(event.targetId)} takes ${event.dealt}${event.damageType ? ` ${event.damageType}` : ""} damage (${event.health}/${event.maxHealth})`;
    case "heal":
      return `${nameOf(event.targetId)} heals ${event.amount} (${event.health}/${event.maxHealth})`;
    case "condition":
      return `${nameOf(event.targetId)} ${event.active ? "is now" : "is no longer"} ${event.condition}`;
    default:
      return null;
  }
}

/**
 * The fight as one room player is shown it (2026-10-27), from the host's view of it for that player:
 * every field copied by name and bounded, never the view itself, so a guest's snapshot carries no
 * art, no reasoning, no sheet and nothing the host's own screen keeps to itself. Null for a fight a
 * room cannot share (one the ruleset does not resolve) or one too big to send.
 */
export function projectMultiplayerFight(anchor: string, view: DirectedCombatView): MultiplayerFight | null {
  const fight = view.ruleset;
  if (view.style !== "ruleset" || !fight || !view.instanceId) return null;
  const names = new Map(fight.combatants.map((one) => [one.id, shortName(one.name)]));
  const nameOf = (id?: string) => (id ? (names.get(id) ?? "Someone") : "Someone");
  const yours = new Set(fight.yours ?? []);
  const party = view.party as Array<{ id: string; controller?: unknown }>;
  const controllerOf = (id: string) => {
    const controller = party.find((member) => member.id === id)?.controller;
    return controller === "manual" || controller === "ai" ? controller : null;
  };
  const over = !!view.outcome || !!fight.summary;
  const window = fight.window;
  const asked = window?.actorId ?? fight.actorId;
  const askedPlayer = asked ? fight.players?.[asked] : undefined;
  const waiting =
    !over &&
    asked &&
    !yours.has(asked) &&
    (window ? window.controller === "manual" : fight.controller === "manual") &&
    askedPlayer
      ? askedPlayer.name
      : null;
  const options = (fight.options ?? []).flatMap((option) => {
    const pick = optionPick(option);
    return pick ? [pick] : [];
  });
  const grid = fight.grid
    ? {
        width: Math.min(64, fight.grid.width),
        height: Math.min(64, fight.grid.height),
        tiles: fight.grid.tiles.slice(0, 64).map((row) => row.slice(0, 64).map((tile) => String(tile).slice(0, 24))),
      }
    : null;
  const lines = fight.events.flatMap(({ event }) => {
    const line = logLine(event, nameOf);
    return line ? [line.slice(0, 300)] : [];
  });
  const projected: MultiplayerFight = {
    anchor,
    id: view.id,
    instanceId: view.instanceId,
    revision: view.revision,
    round: fight.round,
    over,
    actorId: over ? null : (fight.actorId ?? null),
    waitingOn: waiting ? shortName(waiting) : null,
    combatants: fight.combatants
      .filter((one) => !one.left && !one.away && (one.side === "party" || !one.hidden))
      .slice(0, 60)
      .map((one) => {
        const player = one.side === "party" ? fight.players?.[one.id] : undefined;
        return {
          id: one.id,
          name: shortName(one.name),
          side: one.side,
          health: { value: one.health.value, max: Math.max(0, one.health.max) },
          down: one.down,
          defeated: one.defeated,
          conditions: one.conditions
            .slice(0, 8)
            .map((condition) => condition.label.trim().slice(0, 80))
            .filter(Boolean),
          player: player ? shortName(player.name) : null,
          mine: yours.has(one.id),
          controller: one.side === "party" ? controllerOf(one.id) : null,
          ...(grid && one.x !== undefined && one.y !== undefined && onBoard({ x: one.x, y: one.y })
            ? { x: one.x, y: one.y }
            : {}),
        };
      }),
    grid,
    options: over ? [] : options.slice(0, 60),
    prompt: !over && window && options.length ? (window.label ?? "").slice(0, 300) || "Your answer" : null,
    deploy:
      !over && fight.deploy && fight.deploy.ids.length
        ? {
            unitIds: fight.deploy.ids.slice(0, 20),
            cells: fight.deploy.cells.filter(onBoard).slice(0, 400).map(cellOf),
          }
        : null,
    log: lines.slice(-16),
  };
  const parsed = multiplayerFightSchema.safeParse(projected);
  if (!parsed.success) return null;
  // A board too big to send leaves its cells out; the fight still reads as a list.
  if (Buffer.byteLength(JSON.stringify(parsed.data)) <= MULTIPLAYER_FIGHT_BYTES) return parsed.data;
  const listed = {
    ...parsed.data,
    grid: null,
    options: parsed.data.options.filter((option) => option.pick !== "cell"),
  };
  return Buffer.byteLength(JSON.stringify(listed)) <= MULTIPLAYER_FIGHT_BYTES ? listed : null;
}
