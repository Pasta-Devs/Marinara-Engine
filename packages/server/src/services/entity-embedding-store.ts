// Persisted-embedding backing store for tiered entity search (#4768 phase 2).
//
// Provides, per entity type, the candidate list (id/name/embedText/embedding/
// blurb) and a narrow embedding setter used by the semantic tier. Two deliberate
// design choices keep this decoupled and safe:
//
//  - Content-addressed staleness. The embedding column stores { h, v } where h is
//    a hash of the exact embed-text. On read, a stored embedding whose hash no
//    longer matches the current embed-text is treated as absent, so it is
//    re-embedded on the next search. This means NO invalidation hooks in any
//    entity's create/update path, and it is structurally immune to the class of
//    bug where an explicit invalidation field-set drifts from the embed-text
//    builder (which is exactly what left stale lorebook-entry embeddings).
//  - The setter writes ONLY the embedding column via a direct update — it never
//    routes through the entity's update() path (no version snapshot, no JSON
//    merge) and never touches updatedAt (so recency-ordered lists and the chat
//    sidebar are not churned by background vectorization).
import { PROFESSOR_MARI_ID, type CharacterData } from "@marinara-engine/shared";
import { eq } from "../db/file-query.js";
import type { DB } from "../db/connection.js";
import { characters, chats, lorebooks, personas, promptPresets } from "../db/schema/index.js";
import { logger } from "../lib/logger.js";
import type { EntityCandidate, EntitySearchType } from "./entity-semantic-search.js";

type Row = Record<string, unknown>;

// cyrb53 — a fast, well-distributed 53-bit string hash. Compact base-36 output,
// collision-negligible for staleness detection.
function hashText(text: string): string {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// The envelope carries a content hash (h) AND the embedding source id (m), so a
// stored vector is fresh only when BOTH the embed-text and the model that
// produced it are unchanged. Without m, switching to a different embedding model
// of the same dimensionality would leave every vector hash-matching and silently
// mix incompatible vectors into cosine ranking.
function resolveStoredEmbedding(raw: unknown, embedText: string, sourceId: string): number[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as { h?: unknown; v?: unknown; m?: unknown };
    if (parsed && Array.isArray(parsed.v) && typeof parsed.h === "string") {
      const fresh = parsed.h === hashText(embedText) && parsed.m === sourceId;
      return fresh ? (parsed.v as number[]) : null; // stale content or model ⇒ absent
    }
  } catch {
    // fall through
  }
  return null;
}

function serializeEmbedding(vector: number[], embedText: string, sourceId: string): string {
  return JSON.stringify({ h: hashText(embedText), v: vector, m: sourceId });
}

function buildText(parts: Array<[string, string | string[] | undefined | null]>): string {
  const lines: string[] = [];
  for (const [label, value] of parts) {
    if (Array.isArray(value)) {
      const joined = value.filter((v) => typeof v === "string" && v.trim()).join(", ");
      if (joined) lines.push(`${label}: ${joined}`);
    } else if (typeof value === "string" && value.trim()) {
      lines.push(`${label}: ${value.trim()}`);
    }
  }
  return lines.join("\n");
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function blurb(name: string, description: string, suffix?: string): string {
  const desc = trimText(description);
  const tail = desc ? ` — ${desc.length > 90 ? `${desc.slice(0, 89)}…` : desc}` : suffix ? ` (${suffix})` : "";
  return `${name}${tail}`;
}

type Projection = { name: string; embedText: string; blurb: string };

function projectCharacter(row: Row): Projection | null {
  if (row.id === PROFESSOR_MARI_ID) return null; // Mari does not fetch herself
  let data: Partial<CharacterData> = {};
  try {
    // JSON.parse can return null / a non-object (data === "null"); guard so
    // reading data.name below cannot throw and blank a whole listCandidates call.
    const parsed = typeof row.data === "string" ? JSON.parse(row.data) : {};
    data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Partial<CharacterData>) : {};
  } catch {
    data = {};
  }
  const name = typeof data.name === "string" ? data.name : "";
  if (!name.trim()) return null;
  const comment = trimText(row.comment);
  return {
    name,
    embedText: buildText([
      ["Name", name],
      ["Description", data.description],
      ["Personality", data.personality],
      ["Scenario", data.scenario],
      ["Tags", Array.isArray(data.tags) ? data.tags : []],
      // Prefer the user comment; fall back to the card's creator notes.
      ["Notes", comment || data.creator_notes],
    ]),
    // The comment is the user's disambiguation note — prefer it in the blurb the
    // candidate list shows, falling back to the description.
    blurb: blurb(name, comment || (data.description ?? "")),
  };
}

function projectPersona(row: Row): Projection | null {
  const name = typeof row.name === "string" ? row.name : "";
  if (!name.trim()) return null;
  return {
    name,
    embedText: buildText([
      ["Name", name],
      ["Description", row.description as string],
      ["Personality", row.personality as string],
      ["Scenario", row.scenario as string],
      ["Backstory", row.backstory as string],
      ["Appearance", row.appearance as string],
      ["Tags", parseJsonStringArray(row.tags)],
    ]),
    blurb: blurb(name, (row.description as string) ?? ""),
  };
}

function projectLorebook(row: Row): Projection | null {
  const name = typeof row.name === "string" ? row.name : "";
  if (!name.trim()) return null;
  return {
    name,
    embedText: buildText([
      ["Name", name],
      ["Description", row.description as string],
      ["Category", row.category as string],
      ["Tags", parseJsonStringArray(row.tags)],
    ]),
    blurb: blurb(name, (row.description as string) ?? ""),
  };
}

function projectChat(row: Row): Projection | null {
  const name = typeof row.name === "string" ? row.name : "";
  if (!name.trim()) return null;
  const metadata = parseJsonObject(row.metadata);
  const mode = typeof row.mode === "string" ? row.mode : undefined;
  return {
    name,
    embedText: buildText([
      ["Name", name],
      ["Mode", mode],
      ["Tags", parseJsonStringArray(metadata.tags)],
      ["Summary", typeof metadata.summary === "string" ? metadata.summary : ""],
    ]),
    blurb: blurb(name, "", mode),
  };
}

function projectPreset(row: Row): Projection | null {
  const name = typeof row.name === "string" ? row.name : "";
  if (!name.trim()) return null;
  return {
    name,
    embedText: buildText([
      ["Name", name],
      ["Description", row.description as string],
      ["Author", row.author as string],
    ]),
    blurb: blurb(name, (row.description as string) ?? ""),
  };
}

// The five tables share the fileTable shape but have different column unions;
// resolution accesses only id + embedding dynamically, so the table is typed
// loosely here and the concrete columns are reached by name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;
const TYPE_CONFIG: Record<EntitySearchType, { table: AnyTable; project: (row: Row) => Projection | null }> = {
  character: { table: characters, project: projectCharacter },
  persona: { table: personas, project: projectPersona },
  lorebook: { table: lorebooks, project: projectLorebook },
  chat: { table: chats, project: projectChat },
  preset: { table: promptPresets, project: projectPreset },
};

export interface EntityEmbeddingStore {
  listCandidates(type: EntitySearchType): Promise<EntityCandidate[]>;
  updateEmbedding(type: EntitySearchType, id: string, vector: number[] | null, embedText: string): Promise<void>;
}

// sourceId identifies the embedding model/provider vector space, so a model swap
// invalidates persisted vectors. Defaults to "local" (the on-device embedder).
export function createEntityEmbeddingStore(db: DB, sourceId = "local"): EntityEmbeddingStore {
  return {
    async listCandidates(type) {
      const config = TYPE_CONFIG[type];
      const rows = (await db.select().from(config.table)) as Row[];
      const candidates: EntityCandidate[] = [];
      for (const row of rows) {
        const projected = config.project(row);
        if (!projected) continue;
        candidates.push({
          id: String(row.id),
          name: projected.name,
          embedText: projected.embedText,
          embedding: resolveStoredEmbedding(row.embedding, projected.embedText, sourceId),
          blurb: projected.blurb,
        });
      }
      return candidates;
    },
    async updateEmbedding(type, id, vector, embedText) {
      const config = TYPE_CONFIG[type];
      try {
        await db
          .update(config.table)
          .set({ embedding: vector && vector.length > 0 ? serializeEmbedding(vector, embedText, sourceId) : null })
          .where(eq(config.table.id, id));
      } catch (err) {
        // Embeddings are regenerable derived data — never let a persist failure
        // break the fetch that triggered it.
        logger.warn(err, "[entity-search] Failed to persist %s embedding", type);
      }
    },
  };
}
