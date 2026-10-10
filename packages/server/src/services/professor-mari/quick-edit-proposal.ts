import { createHash } from "node:crypto";

export function quickEditFingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function validateQuickEditProposal(
  proposal: { expiresAt: string; fingerprint: string },
  currentValue: string,
  now = Date.now(),
): "ok" | "expired" | "stale" {
  const expiresAt = Date.parse(proposal.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "expired";
  return quickEditFingerprint(currentValue) === proposal.fingerprint ? "ok" : "stale";
}

/** Thrown when a proposal cannot be applied because it is missing, expired, or stale. */
export class QuickEditConflictError extends Error {}
