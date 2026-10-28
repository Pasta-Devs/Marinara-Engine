// #8391: a handbook Mari read stays in her context while she keeps working on its surface. #7827 drops its
// text from history once the turn ends, but the read-first gate counted it as read for the whole chat, so
// from turn 2 she could write from memory. Each assistant turn records `extra.mariHandbooks`; the next turn
// works out the active set from those records, carries their whole text and re-arms the gate for the rest.

import { normalizeAppDataActionName } from "../mari-db/mari-db.service.js";
import { escapeXmlAttribute, flattenLine } from "./mari-skills-prompt.js";
import type { WorkspaceCommandCall, WorkspaceCommandResult } from "./workspace-agent.service.js";
import { handbooksForAction } from "./workspace-commands.js";

/** At most this many handbooks stay; reading another drops the oldest (characters + onboarding fit together). */
export const STICKY_HANDBOOK_LIMIT = 2;
/** A handbook drops after this many of Mari's turns in a row (one per user message) without a read or write on its surface. */
export const STICKY_HANDBOOK_QUIET_TURNS = 3;

/** What one assistant turn did with handbooks: built-in skills it read, and the handbooks its other actions route to. */
export type MariHandbookTurn = { read: string[]; touched: string[] };

/**
 * One turn's record from its tool results. Only successful app_data calls count, and only built-in skills are read.
 * Calls held for the user's approval (Manual mode) count as touches too: she wrote them on that surface.
 */
export function handbookTurnFromResults(
  results: WorkspaceCommandResult[],
  heldCalls: WorkspaceCommandCall[] = [],
): MariHandbookTurn {
  const read = new Set<string>();
  const touched = new Set<string>();
  for (const result of results) {
    if (!result.success || result.name !== "app_data") continue;
    const action = typeof result.input.action === "string" ? result.input.action : result.input.type;
    if (typeof action !== "string") continue;
    if (normalizeAppDataActionName(action) === "skill.get") {
      const id = result.input.id ?? result.input.skillId;
      if (typeof id === "string" && id.trim().startsWith("builtin-")) read.add(id.trim());
      continue;
    }
    handbooksForAction(action, result.input).forEach((id) => touched.add(id));
  }
  for (const call of heldCalls) {
    if (call.name !== "app_data") continue;
    const action = typeof call.arguments.action === "string" ? call.arguments.action : call.arguments.type;
    if (typeof action === "string") handbooksForAction(action, call.arguments).forEach((id) => touched.add(id));
  }
  return { read: [...read], touched: [...touched] };
}

/** A stored `extra.mariHandbooks`, or an empty turn for rows from before #8391 and anything malformed. */
export function parseHandbookTurn(value: unknown): MariHandbookTurn {
  const ids = (list: unknown) =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  if (typeof value !== "object" || value === null) return { read: [], touched: [] };
  const record = value as Record<string, unknown>;
  return { read: ids(record.read), touched: ids(record.touched) };
}

/**
 * The handbooks active for the next turn, oldest first, from every earlier assistant turn in order. A read adds or
 * refreshes a handbook; a touch refreshes one already active (it never adds one she didn't read).
 */
export function activeHandbookIds(turns: MariHandbookTurn[]): string[] {
  let active: Array<{ id: string; lastTurn: number }> = [];
  turns.forEach((turn, index) => {
    // Only what was in this turn's prompt can be refreshed: a dropped handbook needs a new read, not a touch.
    active = active.filter((entry) => index - 1 - entry.lastTurn < STICKY_HANDBOOK_QUIET_TURNS);
    for (const id of turn.read) {
      active = active.filter((entry) => entry.id !== id);
      active.push({ id, lastTurn: index });
    }
    // A touch moves it to the end too, so the limit below drops the one idle longest, not the one read first.
    for (const id of turn.touched) {
      const entry = active.find((candidate) => candidate.id === id);
      if (!entry) continue;
      active = active.filter((candidate) => candidate !== entry);
      active.push({ id, lastTurn: index });
    }
    active = active.slice(-STICKY_HANDBOOK_LIMIT);
  });
  // The quiet turns are the ones after its last use, up to the newest stored turn.
  return active
    .filter((entry) => turns.length - 1 - entry.lastTurn < STICKY_HANDBOOK_QUIET_TURNS)
    .map((entry) => entry.id);
}

/** The prompt block for the active handbooks, in the order given. Handbooks with no text are left out. */
export function renderActiveHandbooksPrompt(
  handbooks: Array<{ id: string; name: string; content: string }>,
): string | null {
  const blocks = handbooks
    .filter((handbook) => handbook.content.trim())
    .map(
      (handbook) =>
        `<handbook id="${escapeXmlAttribute(flattenLine(handbook.id))}" name="${escapeXmlAttribute(flattenLine(handbook.name))}">\n${handbook.content.trim()}\n</handbook>`,
    );
  if (blocks.length === 0) return null;
  return [
    "<active_handbooks>",
    `Handbooks you read earlier in this chat, in full. Each stays here while you keep working on its surface and drops after ${STICKY_HANDBOOK_QUIET_TURNS} turns without it. Follow it as written; while it is here, you don't need skill.get for it.`,
    "",
    blocks.join("\n\n"),
    "</active_handbooks>",
  ].join("\n");
}
