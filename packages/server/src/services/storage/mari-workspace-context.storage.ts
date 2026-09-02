// ──────────────────────────────────────────────
// Storage: Mari Workspace Context (#5073)
//
// Read/write surface for the reference context a user attaches to a Professor
// Mari workspace conversation (today: slices of their own chat history). Scoped
// to the Mari `chatId`. Reads back the prompt-injection block (mari-workspace-
// context-prompt.ts) and the Context Viewer; writes back the chat-history picker
// and the viewer's remove control. This is a user-managed set the user is the
// reviewer of, so panel writes are DIRECT (no Keep/Restore review card) — like
// the Skills / Memories panels, unlike Mari's own autonomous mutations.
// ──────────────────────────────────────────────
import { and, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { mariWorkspaceContext } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

// A context item is injected into Mari's prompt VERBATIM every turn, so an
// oversized blob would blow the model's context window (the injection block is
// preserved by the context trimmer, unlike history). Cap per item as a hard
// server-side sanity guard; the client estimates tokens and steers the user to
// Last-N / a range before they get near this. ~200K chars ≈ 50K tokens.
export const MAX_CONTEXT_ITEM_CONTENT_LENGTH = 200_000;
export const MAX_CONTEXT_LABEL_LENGTH = 200;

export type MariWorkspaceContextKind = "chat_history";

export interface MariWorkspaceContextRow {
  id: string;
  chatId: string;
  kind: MariWorkspaceContextKind;
  label: string;
  sourceChatId: string;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface MariWorkspaceContextDraft {
  chatId: string;
  kind?: MariWorkspaceContextKind;
  label: string;
  sourceChatId?: string | null;
  content: string;
  tokenEstimate?: number | null;
}

function requireLength(value: string, max: number, field: string): string {
  if (value.length > max) {
    throw new Error(
      `An attached context item's ${field} is ${value.length} characters; the maximum is ${max}. Attach fewer messages (a range or the last N).`,
    );
  }
  return value;
}

function mapRow(row: {
  id: string;
  chatId: string;
  kind: string;
  label: string;
  sourceChatId: string;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}): MariWorkspaceContextRow {
  return {
    id: row.id,
    chatId: row.chatId,
    kind: (row.kind as MariWorkspaceContextKind) ?? "chat_history",
    label: row.label,
    sourceChatId: row.sourceChatId,
    content: row.content,
    tokenEstimate: row.tokenEstimate,
    createdAt: row.createdAt,
  };
}

export function createMariWorkspaceContextStorage(db: DB) {
  return {
    // Oldest first so the injected block reads in the order the user attached items.
    // id is a stable tiebreaker for items sharing a createdAt (a fast double-attach).
    async listForChat(chatId: string): Promise<MariWorkspaceContextRow[]> {
      const rows = await db.select().from(mariWorkspaceContext).where(eq(mariWorkspaceContext.chatId, chatId));
      return rows.map(mapRow).sort((a, b) => {
        const byCreated = String(a.createdAt).localeCompare(String(b.createdAt));
        return byCreated !== 0 ? byCreated : String(a.id).localeCompare(String(b.id));
      });
    },

    async get(id: string, chatId?: string): Promise<MariWorkspaceContextRow | null> {
      const condition = chatId
        ? and(eq(mariWorkspaceContext.chatId, chatId), eq(mariWorkspaceContext.id, id))
        : eq(mariWorkspaceContext.id, id);
      const rows = await db.select().from(mariWorkspaceContext).where(condition);
      const row = rows[0];
      return row ? mapRow(row) : null;
    },

    async create(input: MariWorkspaceContextDraft): Promise<MariWorkspaceContextRow> {
      const chatId = input.chatId.trim();
      if (!chatId) throw new Error("An attached context item needs a workspace chat id.");
      const label = requireLength(input.label.trim(), MAX_CONTEXT_LABEL_LENGTH, "label");
      if (!label) throw new Error("An attached context item needs a label.");
      const content = requireLength(input.content, MAX_CONTEXT_ITEM_CONTENT_LENGTH, "content");
      if (!content.trim()) throw new Error("An attached context item needs content.");
      const row = {
        id: newId(),
        chatId,
        kind: input.kind ?? "chat_history",
        label,
        sourceChatId: (input.sourceChatId ?? "").trim(),
        content,
        tokenEstimate: Math.max(0, Math.floor(input.tokenEstimate ?? 0)),
        createdAt: now(),
      };
      await db.insert(mariWorkspaceContext).values(row);
      return mapRow(row);
    },

    async remove(id: string, chatId?: string): Promise<boolean> {
      const existing = await this.get(id, chatId);
      if (!existing) return false;
      await db
        .delete(mariWorkspaceContext)
        .where(and(eq(mariWorkspaceContext.chatId, existing.chatId), eq(mariWorkspaceContext.id, id)));
      return true;
    },
  };
}
