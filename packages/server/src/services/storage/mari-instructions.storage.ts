// ──────────────────────────────────────────────
// Storage: Mari Instructions (#4851)
//
// Read/write surface for Professor Mari's persistent standing instructions.
// Reads (list/get) back the index-and-fetch prompt injection and the
// instruction.list/get actions. Writes (create/update/remove) back the user-driven
// Memories management panel, which edits directly (like the Skills panel) because
// the user IS the reviewer of their own memory. This is distinct from Mari's OWN
// autonomous remember/update/forget, which run through the mutation/Keep-Restore
// pipeline in mari-db.service.ts so she gets a review card. Do NOT route panel
// writes through that pipeline (it would raise a Keep/Restore card for the user's
// own direct edit).
// ──────────────────────────────────────────────
import { eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { mariInstructions } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

// Much smaller than a Skill's 200K cap: a memory is injected (its index always, its
// body on fetch or when persistent), so keeping bodies lean is the whole point.
// Enforced as hard limits (not silent truncation) on every write path.
export const MAX_INSTRUCTION_CONTENT_LENGTH = 20_000;
export const MAX_INSTRUCTION_NAME_LENGTH = 120;
export const MAX_INSTRUCTION_DESCRIPTION_LENGTH = 300;

export interface MariInstructionRow {
  id: string;
  name: string;
  description: string;
  content: string;
  persistent: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MariInstructionDraft {
  name: string;
  description?: string | null;
  content: string;
  persistent?: boolean;
  enabled?: boolean;
}

export interface MariInstructionPatch {
  name?: string | null;
  description?: string | null;
  content?: string | null;
  persistent?: boolean;
  enabled?: boolean;
}

function requireLength(value: string, max: number, field: string): string {
  if (value.length > max) {
    throw new Error(
      `A memory's ${field} is ${value.length} characters; the maximum is ${max}. Trim it or split it into two memories.`,
    );
  }
  return value;
}

function mapRow(row: {
  id: string;
  name: string;
  description: string;
  content: string;
  persistent: number;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}): MariInstructionRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    persistent: row.persistent === 1,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createMariInstructionsStorage(db: DB) {
  return {
    async list(): Promise<MariInstructionRow[]> {
      const rows = await db.select().from(mariInstructions);
      // Sort by updatedAt desc, then id asc as a stable tiebreaker. instruction.list pages this
      // order by slicing it on each call, so ties (bulk writes can share a timestamp) need a total
      // order or the same row could be skipped or repeated across pages, or a cursor walk could loop.
      return rows.map(mapRow).sort((a, b) => {
        const byUpdated = String(b.updatedAt).localeCompare(String(a.updatedAt));
        return byUpdated !== 0 ? byUpdated : String(a.id).localeCompare(String(b.id));
      });
    },

    async get(id: string): Promise<MariInstructionRow | null> {
      const rows = await db.select().from(mariInstructions).where(eq(mariInstructions.id, id));
      const row = rows[0];
      return row ? mapRow(row) : null;
    },

    // Direct write for the Memories panel. New memories default DISABLED (inert until
    // the user turns them on) and non-persistent.
    async create(input: MariInstructionDraft): Promise<MariInstructionRow> {
      const name = requireLength(input.name.trim(), MAX_INSTRUCTION_NAME_LENGTH, "name");
      if (!name) throw new Error("A memory needs a name.");
      const content = requireLength(input.content.trim(), MAX_INSTRUCTION_CONTENT_LENGTH, "content");
      if (!content) throw new Error("A memory needs content.");
      const timestamp = now();
      const row = {
        id: newId(),
        name,
        description: requireLength((input.description ?? "").trim(), MAX_INSTRUCTION_DESCRIPTION_LENGTH, "description"),
        content,
        persistent: input.persistent ? 1 : 0,
        enabled: input.enabled ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(mariInstructions).values(row);
      return mapRow(row);
    },

    async update(id: string, patch: MariInstructionPatch): Promise<MariInstructionRow | null> {
      if (!(await this.get(id))) return null;
      // Write ONLY the fields present in `patch` (plus updatedAt), so a concurrent partial update
      // (e.g. one toggling persistent, one toggling enabled) can't restore an unrelated field from
      // a stale snapshot. Reject a provided-but-blank name/content instead of silently keeping the
      // old value (matches create). Re-read after the write for the authoritative return value.
      const next: Partial<{
        name: string;
        description: string;
        content: string;
        persistent: number;
        enabled: number;
        updatedAt: string;
      }> = {
        updatedAt: now(),
      };
      if (patch.name != null) {
        const name = requireLength(patch.name.trim(), MAX_INSTRUCTION_NAME_LENGTH, "name");
        if (!name) throw new Error("A memory needs a name.");
        next.name = name;
      }
      if (patch.description != null) {
        next.description = requireLength(patch.description.trim(), MAX_INSTRUCTION_DESCRIPTION_LENGTH, "description");
      }
      if (patch.content != null) {
        const content = requireLength(patch.content.trim(), MAX_INSTRUCTION_CONTENT_LENGTH, "content");
        if (!content) throw new Error("A memory needs content.");
        next.content = content;
      }
      if (patch.persistent != null) next.persistent = patch.persistent ? 1 : 0;
      if (patch.enabled != null) next.enabled = patch.enabled ? 1 : 0;
      await db.update(mariInstructions).set(next).where(eq(mariInstructions.id, id));
      return this.get(id);
    },

    async remove(id: string): Promise<boolean> {
      const existing = await this.get(id);
      if (!existing) return false;
      await db.delete(mariInstructions).where(eq(mariInstructions.id, id));
      return true;
    },
  };
}
