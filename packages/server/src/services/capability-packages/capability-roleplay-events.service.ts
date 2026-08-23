// ──────────────────────────────────────────────
// Roleplay-event read + audience filter — the read half of the roleplay-events primitive.
//
// Packages WRITE durable events via persistence.appendRoleplayEvent. This is the Engine-owned READ that
// turns those stored facts back into prompt context, filtered by who the turn can write. A package never
// chooses the prompt role: the Engine decides what a model sees, here.
// ──────────────────────────────────────────────

import type { DB } from "../../db/connection.js";
import { and, desc, eq } from "../../db/file-query.js";
import { capabilityDocuments } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";

const EVENT_KIND = "roleplay-event";

/** Scopes the synthetic document owner to one chat, so both the write-side idempotency check
 *  (capability-persistence.service.ts) and this read filter by an indexed column instead of a
 *  global, cross-chat scan. */
export function engineEventOwner(chatId: string): string {
  return `__engine__:${chatId}`;
}
/** Durable history is meant to survive, but the model only needs the recent tail — the rest is noise it
 *  learns to skip, and it costs tokens every turn. */
const MAX_EVENTS = 6;
const MAX_BLOCK_CHARS = 600;

type StoredEvent = {
  chatId: string;
  eventType: string;
  audience: "public" | "user-only" | { characterIds: string[] };
  text: string;
  createdAt: string;
};

/** An event reaches the model only when the turn cannot leak it to a character it is not meant for. */
export function visibleTo(audience: StoredEvent["audience"], targetCharacterIds: string[]): boolean {
  if (audience === "user-only") return false; // UI only, never a model.
  if (audience === "public") return true;
  // Private: every character this turn can write must be in the audience, or it stays out.
  return targetCharacterIds.length > 0 && targetCharacterIds.every((id) => audience.characterIds.includes(id));
}

/**
 * The recent, in-audience roleplay events for this chat as one labelled block, or "" when there is nothing
 * to say. Read-only, best-effort: a bad row or a read failure costs the block, not the turn.
 */
export async function collectRoleplayEventContext(
  db: DB,
  chatId: string,
  targetCharacterIds: string[],
): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(capabilityDocuments)
      .where(and(eq(capabilityDocuments.packageId, engineEventOwner(chatId)), eq(capabilityDocuments.kind, EVENT_KIND)))
      .orderBy(desc(capabilityDocuments.createdAt))
      .limit(MAX_EVENTS);
    const lines: string[] = [];
    for (const row of rows) {
      let event: StoredEvent;
      try {
        event = JSON.parse(row.data) as StoredEvent;
      } catch {
        continue;
      }
      try {
        if (!visibleTo(event.audience, targetCharacterIds)) continue;
      } catch {
        continue;
      }
      const text = String(event.text ?? "")
        .replace(/\s+/gu, " ")
        .trim();
      if (text) lines.push(`- ${text}`);
    }
    if (lines.length === 0) return "";
    return `[Recent phone activity in this scene]\n${lines.join("\n")}`.slice(0, MAX_BLOCK_CHARS);
  } catch (error) {
    logger.warn(error, "[capability] roleplay-event read failed; the turn continues without it");
    return "";
  }
}
