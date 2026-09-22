/**
 * Resolving a local model slot into something that can answer a decision.
 *
 * Both slots already own their lifecycle — the main sidecar through
 * `sidecarProcessService`, the utility slot through `utilitySidecarService` — so this
 * asks each for its base URL and leaves starting, stopping and error reporting where
 * they are. It never couples the two: each is reached through its own entry point,
 * for the reason the utility provider's header comment gives.
 *
 * The request itself is a plain POST rather than a trip through a provider, because
 * `openai.provider.ts` drops `logprobs` and `top_logprobs` unless a caller sets them
 * explicitly, and the whole method depends on those two fields arriving intact.
 */
import {
  normalizeDecisionThinking,
  type DecisionLocalSlot,
  type DecisionThinkingMode,
  type DecisionUnavailableReason,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../sidecar/sidecar-process.service.js";
import { resolveSidecarRequestModel } from "../sidecar/sidecar-request-model.js";
import { utilitySidecarService } from "../utility-sidecar/utility-sidecar.service.js";

/** A slot that is ready to answer, with everything a request needs. */
export interface ResolvedDecisionSlot {
  slot: DecisionLocalSlot;
  baseUrl: string;
  /** Model name to send; llama-server serves whatever single model it loaded. */
  model: string;
  /**
   * Which model is loaded right now, for the Thinking probe cache.
   *
   * The cache is keyed by model, not by slot, so swapping to a well-behaved model
   * goes straight back to the fast path instead of inheriting the old one's verdict.
   */
  modelIdentity: string;
  /** Friendly label for the dropdown and diagnostics. */
  label: string;
  thinking: DecisionThinkingMode;
}

export type DecisionSlotFailure = { slot: DecisionLocalSlot; reason: DecisionUnavailableReason; detail?: string };

/** Which slots this build can serve at all. The decision sidecar arrives with its runtime. */
export function isDecisionSlotImplemented(slot: DecisionLocalSlot): boolean {
  return slot === "primary" || slot === "utility";
}

/** The main sidecar's Thinking setting, kept with that slot's own config. */
function primaryThinking(): DecisionThinkingMode {
  return normalizeDecisionThinking(sidecarModelService.getConfig().decisionThinking);
}

function utilityThinking(): DecisionThinkingMode {
  return normalizeDecisionThinking(utilitySidecarService.getConfig().decisionThinking);
}

/**
 * Is this slot offerable in the Decision model dropdown, and if not, why?
 *
 * Read-only: it never starts a process. An entry whose model is downloaded but whose
 * process is stopped stays selectable, because the gate starts it on demand and fails
 * open while it loads.
 */
export function describeDecisionSlot(
  slot: DecisionLocalSlot,
): { available: true; label: string } | { available: false; reason: DecisionUnavailableReason; detail?: string } {
  if (slot === "primary") {
    const status = sidecarModelService.getStatus();
    if (!status.modelDownloaded) return { available: false, reason: "no_model" };
    return { available: true, label: status.modelDisplayName ?? "Primary local model" };
  }
  if (slot === "utility") {
    const status = utilitySidecarService.getStatus();
    if (!status.configured || !status.activeModelId) return { available: false, reason: "no_model" };
    return { available: true, label: status.activeModelId };
  }
  return { available: false, reason: "not_installed" };
}

/**
 * Bring a slot up and hand back what a decision request needs, or say why not.
 *
 * Returns a failure rather than throwing: a gate that cannot reach its slot must run
 * the agent, not fail the generation.
 */
export async function resolveDecisionSlot(
  slot: DecisionLocalSlot,
): Promise<{ resolved: ResolvedDecisionSlot; failure?: never } | { resolved: null; failure: DecisionSlotFailure }> {
  const description = describeDecisionSlot(slot);
  if (!description.available) return { resolved: null, failure: { slot, ...description } };

  if (slot === "primary") {
    let baseUrl: string;
    try {
      // forceStart, like the local sidecar provider does: choosing this slot as the
      // decision model is an explicit request for it to serve. Without it a user who
      // runs a local model but has trackers and game-scene analysis both off would
      // have their chosen decision model never start, and every gate fail open.
      baseUrl = await sidecarProcessService.ensureReady({ forceStart: true });
    } catch (error) {
      logger.warn(error, "[decision] The primary local model could not start; gates fail open");
      return { resolved: null, failure: { slot, reason: "stopped" } };
    }
    const status = sidecarModelService.getStatus();
    return {
      resolved: {
        slot,
        baseUrl,
        model: resolveSidecarRequestModel(status.config.backend, sidecarModelService.getConfiguredModelRef()),
        // Size distinguishes two builds of one filename; the path alone would not.
        modelIdentity: `primary:${sidecarModelService.getConfiguredModelRef() ?? ""}:${status.modelSize ?? 0}`,
        label: description.label,
        thinking: primaryThinking(),
      },
    };
  }

  // The utility slot already tracks which model the running child actually loaded, so
  // its blob id is the identity rather than a guess from the configured name.
  let status = utilitySidecarService.getStatus();
  if (!status.ready) {
    try {
      status = await utilitySidecarService.ensureRunning();
    } catch (error) {
      logger.warn(error, "[decision] The utility local model could not start; gates fail open");
      return { resolved: null, failure: { slot, reason: "stopped" } };
    }
  }
  if (!status.ready || !status.baseUrl) return { resolved: null, failure: { slot, reason: "stopped" } };
  const activeModelId = status.activeModelId ?? "";
  return {
    resolved: {
      slot,
      baseUrl: status.baseUrl,
      model: "utility-sidecar",
      modelIdentity: `utility:${activeModelId}:${status.models[activeModelId]?.oid ?? ""}`,
      label: description.label,
      thinking: utilityThinking(),
    },
  };
}

/** Context budget the slot was started with, so a decision state can be capped to fit. */
export function decisionSlotContextSize(slot: DecisionLocalSlot): number {
  if (slot === "utility") return utilitySidecarService.getConfig().contextSize;
  return sidecarModelService.getConfig().contextSize;
}

export function setDecisionSlotThinking(slot: DecisionLocalSlot, thinking: DecisionThinkingMode): void {
  // Without this guard the else branch catches `decision_sidecar` too, and a setting
  // for a slot this build cannot run would silently overwrite the primary slot's.
  if (!isDecisionSlotImplemented(slot)) return;
  if (slot === "utility") utilitySidecarService.setDecisionThinking(thinking);
  else sidecarModelService.setDecisionThinking(thinking);
}
