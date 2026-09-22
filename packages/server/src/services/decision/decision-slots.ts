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
  DECISION_SIDECAR_DEFAULT_SETTINGS,
  findDecisionModel,
  normalizeDecisionThinking,
  type DecisionSidecarSettings,
  type SidecarDecisionModelInfo,
  type DecisionLocalSlot,
  type DecisionThinkingMode,
  type DecisionUnavailableReason,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../sidecar/sidecar-process.service.js";
import { resolveSidecarRequestModel } from "../sidecar/sidecar-request-model.js";
import { decisionProcessService } from "../sidecar/decision-process.service.js";
import {
  decisionRuntimeInstalled,
  decisionRuntimeService,
  isDecisionRuntimeSupported,
} from "../sidecar/decision-runtime.service.js";
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

/** The catalog entry the user has installed, if the sidecar is enabled at all. */
export function installedDecisionModel(settings: DecisionSidecarSettings): SidecarDecisionModelInfo | null {
  return settings.enabled ? findDecisionModel(settings.modelId) : null;
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
  // The decision sidecar. Each reason is different and each has a different fix, so
  // they are never collapsed into one "unavailable".
  if (!isDecisionRuntimeSupported())
    return {
      available: false,
      reason: "unsupported_platform",
      detail: "Requires Linux with an NVIDIA GPU",
    };
  const settings = decisionSidecarSettings();
  if (!settings.enabled) return { available: false, reason: "not_enabled" };
  const model = installedDecisionModel(settings);
  if (!model || !decisionRuntimeInstalled() || !decisionRuntimeService.modelDownloaded(model))
    return { available: false, reason: "not_installed" };
  return { available: true, label: model.label };
}

/**
 * The stored decision sidecar settings.
 *
 * Read through an injected reader so the slot description stays synchronous: the
 * dropdown asks about every entry on each request and must not wait on the database.
 */
let readDecisionSidecarSettings: () => DecisionSidecarSettings = () => ({ ...DECISION_SIDECAR_DEFAULT_SETTINGS });

export function setDecisionSidecarSettingsReader(reader: () => DecisionSidecarSettings): void {
  readDecisionSidecarSettings = reader;
}

export function decisionSidecarSettings(): DecisionSidecarSettings {
  return readDecisionSidecarSettings();
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

  if (slot === "decision_sidecar") {
    const model = installedDecisionModel(decisionSidecarSettings());
    if (!model) return { resolved: null, failure: { slot, reason: "not_installed" } };
    const baseUrl = await decisionProcessService.ensureRunning(model);
    if (!baseUrl) return { resolved: null, failure: { slot, reason: "stopped" } };
    return {
      resolved: {
        slot,
        baseUrl,
        model: "jev-latest",
        modelIdentity: `decision:${model.id}`,
        label: model.label,
        // A purpose-built decision model never reasons: it scores candidates in one
        // forward pass and has no text to think in.
        thinking: "off",
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

/**
 * Which slots have a Thinking setting at all.
 *
 * Only the two chat slots. A purpose-built decision model scores candidates in one
 * forward pass and has no text to reason in, so there is nothing to allow or forbid.
 */
export function hasThinkingSetting(slot: DecisionLocalSlot): boolean {
  return slot === "primary" || slot === "utility";
}

export function setDecisionSlotThinking(slot: DecisionLocalSlot, thinking: DecisionThinkingMode): void {
  // Explicit per slot rather than an else. An else branch catches `decision_sidecar`
  // as well and silently writes a setting for it over the primary slot's config,
  // which is a real bug this had once already.
  if (slot === "utility") utilitySidecarService.setDecisionThinking(thinking);
  else if (slot === "primary") sidecarModelService.setDecisionThinking(thinking);
}
