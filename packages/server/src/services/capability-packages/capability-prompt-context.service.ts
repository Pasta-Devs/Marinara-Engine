// ──────────────────────────────────────────────
// Capability prompt-context registry — gives the `prompt-context` permission its mechanism.
//
// A contributor is called ONCE per generation with a read-only view of the chat and returns the text to
// append, or null for nothing this turn. It must not mutate anything, and a throw is swallowed by the
// collector. It may also declare which built-in game systems it replaces; undeclared stays built-in.
// ──────────────────────────────────────────────

import { logger } from "../../lib/logger.js";

/** Read-only view of the turn handed to each contributor. */
export interface CapabilityPromptContextRequest {
  chatId: string;
  /** The chat's metadata record (where game/agent state lives). */
  chatMeta: Record<string, unknown>;
  /** Chat mode, so a contributor can bail out of modes it doesn't serve. */
  mode: string;
  /** Target characters for this generation. Empty means narrator or no resolved target. */
  targetCharacterIds?: string[];
  /** Active persona for this generation, when one is selected. */
  personaId?: string | null;
  /** Agent-data sections already placed by the active preset. */
  placedAgentTypes?: string[];
}

/** Built-in game systems an experience can declare it replaces. Open set — undeclared stays built-in. */
export interface CapabilityProvidedGameSystems {
  /** The experience tracks items itself ⇒ drop the [inventory:] command and the PLAYER INVENTORY block. */
  inventory?: boolean;
}

/** Rich form of a contribution, for a package that also replaces built-in systems. */
export interface CapabilityPromptContribution {
  text?: string | null;
  provides?: CapabilityProvidedGameSystems;
}

/** A package's per-turn contributor. May return a bare string, the rich form, or nothing. */
export type CapabilityPromptContextContributor = (
  request: CapabilityPromptContextRequest,
) =>
  | string
  | CapabilityPromptContribution
  | null
  | undefined
  | Promise<string | CapabilityPromptContribution | null | undefined>;

/** What the collector hands the turn: the text blocks plus the union of every `provides` declaration. */
export interface CapabilityPromptContextResult {
  blocks: string[];
  packageBlocks: Array<{ packageId: string; text: string }>;
  provides: CapabilityProvidedGameSystems;
}

const contributorsByPackage = new Map<string, CapabilityPromptContextContributor>();

/** Register (or replace) the contributor for a package. Returns a releaser for deactivation. */
export function registerCapabilityPromptContext(
  packageId: string,
  contributor: CapabilityPromptContextContributor,
): () => void {
  if (typeof contributor !== "function") throw new Error("Capability prompt-context contributor is invalid");
  contributorsByPackage.set(packageId, contributor);
  return () => {
    if (contributorsByPackage.get(packageId) === contributor) contributorsByPackage.delete(packageId);
  };
}

/** Deadline per contributor. A throw is already non-fatal, but a promise that never settles would hang
 *  the turn, so building the prompt can't wait on one indefinitely. */
export const CONTRIBUTOR_TIMEOUT_MS = 2_000;

/**
 * Reject if `value` has not settled within {@link CONTRIBUTOR_TIMEOUT_MS}. A primitive is passed straight
 * through, and the timer is cleared on settle and unref'd so a pending deadline never holds the event loop
 * open during shutdown.
 *
 * Anything that can defer races the deadline, not just a native Promise: `Promise.resolve` ADOPTS a
 * thenable, so a hand-rolled one that never settles would slip past the guard and hang the turn — which is
 * the exact failure this exists to prevent.
 */
export function withDeadline<T>(value: Promise<T> | T, label: string, timeoutMs = CONTRIBUTOR_TIMEOUT_MS): Promise<T> {
  const canDefer = value !== null && (typeof value === "object" || typeof value === "function");
  if (!canDefer) return Promise.resolve(value);
  let timer: NodeJS.Timeout;
  return Promise.race([
    Promise.resolve(value),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Collect every registered contribution for this turn. A contributor that fails, times out or returns
 * nothing is skipped, so one bad package can't block generation. Contributors run in registration order:
 * they compose one prompt, so the block order has to be stable across a run.
 */
export async function collectCapabilityPromptContext(
  request: CapabilityPromptContextRequest,
): Promise<CapabilityPromptContextResult> {
  if (contributorsByPackage.size === 0) return { blocks: [], packageBlocks: [], provides: {} };
  const blocks: string[] = [];
  const packageBlocks: Array<{ packageId: string; text: string }> = [];
  const provides: CapabilityProvidedGameSystems = {};
  const activeExperienceId =
    typeof request.chatMeta.gameExperienceId === "string" ? request.chatMeta.gameExperienceId : null;
  for (const [packageId, contribute] of contributorsByPackage) {
    try {
      const contribution = await withDeadline(contribute(request), `prompt-context contributor ${packageId}`);
      if (contribution === null || contribution === undefined) continue;
      const text = typeof contribution === "string" ? contribution : contribution.text;
      if (typeof text === "string" && text.trim().length > 0) {
        const normalized = text.trim();
        blocks.push(normalized);
        packageBlocks.push({ packageId, text: normalized });
      }
      // Only the experience recorded on this game may replace its built-in systems. Other packages may
      // still contribute prompt context, but cannot hide Classic inventory from unrelated games.
      if (
        packageId === activeExperienceId &&
        typeof contribution === "object" &&
        contribution.provides?.inventory === true
      ) {
        provides.inventory = true;
      }
    } catch (error) {
      // Non-fatal by design: a broken contributor costs its own context, not the player's turn.
      logger.warn(error, "[capability] prompt-context contributor failed for %s", packageId);
    }
  }
  return { blocks, packageBlocks, provides };
}
