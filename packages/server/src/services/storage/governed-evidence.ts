import { and, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { messages, messageSwipes, stateAuthorityRecords } from "../../db/schema/index.js";
import { createHash } from "node:crypto";
import type { CommitEvidence } from "./governed-proposals.storage.js";

export type EvidenceValidation = { valid: true } | { valid: false; reason: string };

export async function validateCommitEvidence(db: DB, evidence: CommitEvidence): Promise<EvidenceValidation> {
  if (evidence.kind !== "canonical_turn") {
    const rows = await db.select().from(stateAuthorityRecords).where(eq(stateAuthorityRecords.id, evidence.authorityRecordId)).limit(1);
    const authority = rows[0];
    if (!authority) return { valid: false, reason: "authority_record_missing" };
    if (authority.authorityPath !== evidence.kind || authority.reason !== evidence.reason) return { valid: false, reason: "authority_record_mismatch" };
    return { valid: true };
  }

  const messageRows = await db.select().from(messages).where(eq(messages.id, evidence.messageId)).limit(1);
  const message = messageRows[0];
  if (!message || message.chatId !== evidence.chatId || message.role !== "assistant") return { valid: false, reason: "canonical_message_missing" };
  if (message.publicationStatus !== "canonical" || message.publicationTurnId !== evidence.turnId) return { valid: false, reason: "canonical_message_changed" };
  if (message.activeSwipeIndex !== evidence.swipeIndex) return { valid: false, reason: "selected_swipe_changed" };
  const swipeRows = await db.select().from(messageSwipes).where(and(eq(messageSwipes.messageId, evidence.messageId), eq(messageSwipes.index, evidence.swipeIndex))).limit(1);
  const swipe = swipeRows[0];
  if (!swipe || swipe.publicationStatus !== "canonical" || swipe.publicationTurnId !== evidence.turnId) return { valid: false, reason: "canonical_swipe_changed" };
  const hash = createHash("sha256").update(swipe.content).digest("hex");
  return hash === evidence.sourceContentHash ? { valid: true } : { valid: false, reason: "canonical_content_changed" };
}
