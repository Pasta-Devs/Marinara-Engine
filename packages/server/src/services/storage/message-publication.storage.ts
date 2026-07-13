// ──────────────────────────────────────────────
// Storage: server-owned assistant publication lifecycle
// ──────────────────────────────────────────────
import { and, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, messages, messageSwipes } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreateCandidateMessageInput {
  chatId: string;
  characterId?: string | null;
  content: string;
  turnId: string;
  messageExtra?: Record<string, unknown>;
  swipeExtra?: Record<string, unknown>;
}

export type PublicationTransitionResult =
  | { status: "promoted" | "rejected"; message: typeof messages.$inferSelect }
  | { status: "not_found" }
  | { status: "turn_conflict" }
  | { status: "already_canonical" | "already_rejected" };

function generatedMessageExtra(extra: Record<string, unknown> | undefined) {
  return JSON.stringify({
    ...(extra ?? {}),
    displayText: null,
    isGenerated: true,
    tokenCount: null,
    generationInfo: null,
  });
}

export function createMessagePublicationStorage(db: DB) {
  async function getMessage(messageId: string) {
    const rows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    return rows[0] ?? null;
  }

  return {
    /**
     * Create a server-owned assistant candidate. It is intentionally absent from
     * canonical transcript reads and does not advance chat recency until promoted.
     */
    async createCandidate(input: CreateCandidateMessageInput) {
      return db.transaction(async (tx) => {
        const timestamp = now();
        const messageId = newId();
        const swipeId = newId();
        const messageRow: typeof messages.$inferInsert = {
          id: messageId,
          chatId: input.chatId,
          role: "assistant",
          characterId: input.characterId ?? null,
          content: input.content,
          activeSwipeIndex: 0,
          publicationStatus: "candidate",
          publicationTurnId: input.turnId,
          promotedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          extra: generatedMessageExtra(input.messageExtra),
          createdAt: timestamp,
        };
        const swipeRow: typeof messageSwipes.$inferInsert = {
          id: swipeId,
          messageId,
          index: 0,
          content: input.content,
          publicationStatus: "candidate",
          publicationTurnId: input.turnId,
          promotedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          extra: JSON.stringify(input.swipeExtra ?? {}),
          createdAt: timestamp,
        };
        await tx.insert(messages).values(messageRow);
        await tx.insert(messageSwipes).values(swipeRow);
        return messageRow as typeof messages.$inferSelect;
      });
    },

    /** Compare-and-set candidate → canonical while publishing approved text. */
    async promoteCandidate(messageId: string, turnId: string, approvedContent: string): Promise<PublicationTransitionResult> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(messages).where(eq(messages.id, messageId)).limit(1);
        const message = rows[0];
        if (!message) return { status: "not_found" };
        if (message.publicationTurnId !== turnId) return { status: "turn_conflict" };
        if (message.publicationStatus === "canonical") return { status: "already_canonical" };
        if (message.publicationStatus === "rejected") return { status: "already_rejected" };

        const timestamp = now();
        const swipeRows = await tx
          .select()
          .from(messageSwipes)
          .where(and(eq(messageSwipes.messageId, messageId), eq(messageSwipes.index, message.activeSwipeIndex)))
          .limit(1);
        const swipe = swipeRows[0];
        if (!swipe) return { status: "not_found" };
        if (swipe.publicationTurnId !== turnId) return { status: "turn_conflict" };
        if (swipe.publicationStatus === "canonical") return { status: "already_canonical" };
        if (swipe.publicationStatus === "rejected") return { status: "already_rejected" };

        await tx
          .update(messageSwipes)
          .set({
            content: approvedContent,
            publicationStatus: "canonical",
            promotedAt: timestamp,
            rejectedAt: null,
            rejectionReason: null,
          })
          .where(and(eq(messageSwipes.id, swipe.id), eq(messageSwipes.publicationStatus, "candidate")));
        await tx
          .update(messages)
          .set({
            content: approvedContent,
            publicationStatus: "canonical",
            promotedAt: timestamp,
            rejectedAt: null,
            rejectionReason: null,
          })
          .where(and(eq(messages.id, messageId), eq(messages.publicationStatus, "candidate")));
        await tx
          .update(chats)
          .set({ lastMessageAt: message.createdAt, updatedAt: timestamp })
          .where(eq(chats.id, message.chatId));

        const promoted = { ...message, content: approvedContent, publicationStatus: "canonical" as const, promotedAt: timestamp };
        return { status: "promoted", message: promoted };
      });
    },

    /** Compare-and-set candidate → rejected. Rejected prose stays audit-only. */
    async rejectCandidate(messageId: string, turnId: string, reason: string): Promise<PublicationTransitionResult> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(messages).where(eq(messages.id, messageId)).limit(1);
        const message = rows[0];
        if (!message) return { status: "not_found" };
        if (message.publicationTurnId !== turnId) return { status: "turn_conflict" };
        if (message.publicationStatus === "canonical") return { status: "already_canonical" };
        if (message.publicationStatus === "rejected") return { status: "already_rejected" };

        const timestamp = now();
        await tx
          .update(messageSwipes)
          .set({ publicationStatus: "rejected", rejectedAt: timestamp, rejectionReason: reason })
          .where(
            and(
              eq(messageSwipes.messageId, messageId),
              eq(messageSwipes.publicationTurnId, turnId),
              eq(messageSwipes.publicationStatus, "candidate"),
            ),
          );
        await tx
          .update(messages)
          .set({ publicationStatus: "rejected", rejectedAt: timestamp, rejectionReason: reason })
          .where(and(eq(messages.id, messageId), eq(messages.publicationStatus, "candidate")));

        const rejected = {
          ...message,
          publicationStatus: "rejected" as const,
          rejectedAt: timestamp,
          rejectionReason: reason,
        };
        return { status: "rejected", message: rejected };
      });
    },

    /** Explicit audit read; ordinary transcript reads must remain canonical-only. */
    getForAudit: getMessage,
  };
}
