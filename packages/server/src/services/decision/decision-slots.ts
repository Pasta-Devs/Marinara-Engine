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
import { DECISION_TIMEOUT_MS } from "@marinara-engine/shared";
import {
  DECISION_SIDECAR_DEFAULT_SETTINGS,
  findDecisionModel,
  normalizeDecisionThinking,
  type DecisionCalibration,
  type DecisionInputKind,
  type DecisionRuntimeKind,
  type DecisionSidecarSettings,
  type SidecarDecisionModelInfo,
  type DecisionLocalSlot,
  type DecisionThinkingMode,
  type DecisionUnavailableReason,
} from "@marinara-engine/shared";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { logger } from "../../lib/logger.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../sidecar/sidecar-process.service.js";
import { resolveSidecarRequestModel } from "../sidecar/sidecar-request-model.js";
import { decisionProcessService } from "../sidecar/decision-process.service.js";
import {
  decisionRuntimeInstalled,
  decisionRuntimeNeedsUpdate,
  decisionRuntimeService,
  isDecisionRuntimeSupported,
} from "../sidecar/decision-runtime.service.js";
import { utilitySidecarService } from "../utility-sidecar/utility-sidecar.service.js";
import { decisionServerInstall } from "../sidecar/decision-server-runtimes.js";

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
  /**
   * How to ask this slot a question.
   *
   * The two chat slots are prompted over `/v1/chat/completions` and answer through
   * token log-probabilities. The managed decision sidecar speaks System One at
   * `/v1/systemone` and rejects a chat request outright, so this is not cosmetic.
   */
  protocol: "chat_logprobs" | "system_one";
  /** The model's own operating point, for a slot that brings one. */
  calibration?: DecisionCalibration;
  /** Measured extra time per question, for a model that answers them one at a time. */
  perQuestionMs?: number;
  /**
   * The limit for a request's first answer, when this machine's measured speed calls
   * for more than the fixed default (a model running on the processor).
   */
  firstAnswerMs?: number;
  /**
   * The input limit this model was launched with.
   *
   * A decision model has its own `--max-length` and rejects anything longer with a
   * 422 instead of truncating, so it must never inherit a chat slot's context size.
   */
  maxLengthTokens?: number;
  /**
   * How many requests the model's server works on at once. More are queued there, so
   * decisions wait for one of these before their time limit starts: a statement's
   * limit is for answering it, not for waiting behind the others.
   */
  serverSlots: number;
  /** For Marinara's own decision model: which runtime serves it, and so how media are sent. */
  runtime?: DecisionRuntimeKind;
  /** What it reads. Chat pictures and clips go only to a model whose list names them. */
  inputs?: DecisionInputKind[];
  /** Extra time a request gets for each picture and each clip it carries. */
  mediaMs?: { image: number; video: number };
}

export type DecisionSlotFailure = { slot: DecisionLocalSlot; reason: DecisionUnavailableReason; detail?: string };

/** The catalog entry the user has installed, if the sidecar is enabled at all. */
export function installedDecisionModel(settings: DecisionSidecarSettings): SidecarDecisionModelInfo | null {
  if (!settings.enabled) return null;
  // A pasted model is as installed as a curated one; only where it came from differs.
  return findDecisionModel(settings.modelId) ?? settings.customModel;
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
    return { available: true, label: status.modelDisplayName ?? "Built-in model" };
  }
  if (slot === "utility") {
    const status = utilitySidecarService.getStatus();
    if (!status.configured || !status.activeModelId) return { available: false, reason: "no_model" };
    return { available: true, label: status.activeModelId };
  }
  // The decision sidecar. Each reason is different and each has a different fix, so
  // they are never collapsed into one "unavailable".
  const settings = decisionSidecarSettings();
  const model = installedDecisionModel(settings);
  // Open-Jev's Python runtime is Linux x64 only, but the llama.cpp models run nearly
  // everywhere, so with nothing installed the entry is offered on every platform and
  // each model's own install is refused where it cannot run. A runtime other than
  // Open-Jev was refused at install on a machine without a build for it.
  if (!settings.enabled) return { available: false, reason: "not_enabled" };
  if (model?.runtime === "open_jev_torch" && !isDecisionRuntimeSupported())
    return { available: false, reason: "unsupported_platform", detail: "Requires Linux with an NVIDIA GPU" };
  if (
    model?.runtime === "open_jev_torch" &&
    decisionRuntimeNeedsUpdate() &&
    decisionRuntimeService.modelDownloaded(model)
  )
    return { available: false, reason: "needs_update" };
  const runtimeHere = model
    ? model.runtime === "open_jev_torch"
      ? decisionRuntimeInstalled()
      : decisionServerInstall(model.runtime) !== null
    : false;
  if (!model || !runtimeHere || !decisionRuntimeService.modelDownloaded(model))
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

/** Not imported: sidecar-process.service.ts keeps the class private and names it. */
function isSidecarStartupCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "SidecarStartupCancelledError";
}

/**
 * The one log line for a slot that cannot serve.
 *
 * A gate asks on every turn, so a slot that stays down would otherwise write the same
 * warning each time; it is rate-limited per slot and reason, so a changed diagnosis still logs. A user stop is an expected outcome
 * and goes to info. Returns the failure so each branch can report and return at once.
 */
function slotFailure(
  failure: DecisionSlotFailure,
  cause?: { error?: unknown; aborted?: boolean; detail?: string | null },
): { resolved: null; failure: DecisionSlotFailure } {
  const fields: Record<string, unknown> = { slot: failure.slot, reason: failure.reason };
  const detail = cause?.detail ?? failure.detail;
  if (detail) fields.detail = detail;
  if (cause?.error !== undefined) fields.err = cause.error;
  if (cause?.aborted || isSidecarStartupCancelled(cause?.error)) {
    logger.info(fields, "[decision] Cancelled while the %s local model was starting", failure.slot);
  } else {
    logRateLimited(
      "warn",
      `decision.slot:${failure.slot}:${failure.reason}`,
      fields,
      "[decision] The %s local model cannot serve decisions (%s); gates fail open",
      failure.slot,
      failure.reason,
    );
  }
  return { resolved: null, failure };
}

/**
 * Settles with null once the caller gives up, so a slot start is raced against it.
 *
 * A cold load can take minutes. A cancelled generation, or a caller with its own time
 * limit such as Advanced Memory recall, must not sit behind it; the start carries on
 * in the background so the next request finds the model ready.
 */
function whenAborted(signal: AbortSignal | undefined): Promise<null> {
  return new Promise<null>((resolve) => {
    if (!signal) return;
    if (signal.aborted) resolve(null);
    else signal.addEventListener("abort", () => resolve(null), { once: true });
  });
}

/**
 * Bring a slot up and hand back what a decision request needs, or say why not.
 *
 * Returns a failure rather than throwing: a gate that cannot reach its slot must run
 * the agent, not fail the generation.
 */
export async function resolveDecisionSlot(
  slot: DecisionLocalSlot,
  signal?: AbortSignal,
  inspectOnly = false,
): Promise<{ resolved: ResolvedDecisionSlot; failure?: never } | { resolved: null; failure: DecisionSlotFailure }> {
  const description = describeDecisionSlot(slot);
  if (!description.available) return slotFailure({ slot, ...description });

  if (slot === "primary") {
    let baseUrl: string | null;
    try {
      // forceStart, like the local sidecar provider does: choosing this slot as the
      // decision model is an explicit request for it to serve. Without it a user who
      // runs a local model but has trackers and game-scene analysis both off would
      // have their chosen decision model never start, and every gate fail open.
      baseUrl = inspectOnly
        ? ""
        : await Promise.race([sidecarProcessService.ensureReady({ forceStart: true }), whenAborted(signal)]);
    } catch (error) {
      return slotFailure({ slot, reason: "stopped" }, { error });
    }
    if (baseUrl === null) return slotFailure({ slot, reason: "stopped" }, { aborted: true });
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
        protocol: "chat_logprobs",
        serverSlots: sidecarProcessService.getEffectiveParallelJobs(),
      },
    };
  }

  if (slot === "decision_sidecar") {
    const model = installedDecisionModel(decisionSidecarSettings());
    if (!model) return slotFailure({ slot, reason: "not_installed" });
    // Raced against the caller's abort: a cold load takes up to three minutes.
    const baseUrl = inspectOnly
      ? ""
      : await Promise.race([decisionProcessService.ensureRunning(model), whenAborted(signal)]);
    // A cancelled request is not a failure: the start carries on in the background.
    if (!inspectOnly && !baseUrl)
      return slotFailure(
        { slot, reason: "stopped" },
        { aborted: signal?.aborted === true, detail: decisionProcessService.getStatus().error },
      );
    return {
      resolved: {
        slot,
        baseUrl: baseUrl ?? "",
        model: "jev-latest",
        modelIdentity: `decision:${model.id}`,
        label: model.label,
        protocol: "system_one",
        calibration: model.calibration,
        ...decisionTiming(model),
        runtime: model.runtime,
        inputs: model.inputs ?? ["text"],
        maxLengthTokens: model.maxLengthTokens,
        // A purpose-built decision model never reasons: it scores candidates in one
        // forward pass and has no text to think in.
        thinking: "off",
        // Its server answers one request at a time behind a lock.
        serverSlots: 1,
      },
    };
  }

  // The utility slot already tracks which model the running child actually loaded, so
  // its blob id is the identity rather than a guess from the configured name.
  let status = utilitySidecarService.getStatus();
  if (!inspectOnly && !status.ready) {
    let started: typeof status | null;
    try {
      started = await Promise.race([utilitySidecarService.ensureRunning(), whenAborted(signal)]);
    } catch (error) {
      return slotFailure({ slot, reason: "stopped" }, { error });
    }
    if (!started) return slotFailure({ slot, reason: "stopped" }, { aborted: true });
    status = started;
  }
  if (!inspectOnly && (!status.ready || !status.baseUrl))
    return slotFailure({ slot, reason: "stopped" }, { detail: status.error });
  const activeModelId = status.activeModelId ?? "";
  return {
    resolved: {
      slot,
      baseUrl: status.baseUrl ?? "",
      model: "utility-sidecar",
      modelIdentity: `utility:${activeModelId}:${status.models[activeModelId]?.oid ?? ""}`,
      label: description.label,
      thinking: utilityThinking(),
      protocol: "chat_logprobs",
      serverSlots: utilitySidecarService.getConfig().maxParallelJobs,
    },
  };
}

/** Context budget the slot was started with, so a decision state can be capped to fit. */
/**
 * The input budget a slot was started with.
 *
 * Only meaningful for the two chat slots: the decision sidecar carries its own limit
 * on the resolved slot, because it is a property of the launched model rather than of
 * anything in the sidecar config.
 */
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

/**
 * Request limits that follow this machine's measured speed.
 *
 * Open-Jev runs on an NVIDIA card and answers in tens of milliseconds, so it keeps the
 * fixed limit and its curated per-question cost. A GGUF model may be on the processor,
 * where reading a long scene takes a minute, and a fixed four-second limit would time
 * out every gate. Its limits come from the reading speed the process timed at start:
 * the first answer reads the whole scene, up to the model's input limit; later ones
 * reuse most of it from the prompt cache.
 */
export function decisionTiming(model: SidecarDecisionModelInfo): {
  perQuestionMs?: number;
  firstAnswerMs?: number;
  mediaMs?: { image: number; video: number };
} {
  if (model.runtime === "open_jev_torch") return model.perQuestionMs ? { perQuestionMs: model.perQuestionMs } : {};
  const msPerToken = decisionProcessService.measuredMsPerToken();
  const reads = model.inputs ?? [];
  const clamp = (value: number, low: number, high: number) => Math.round(Math.min(high, Math.max(low, value)));
  // A picture scaled to 512 px read as about 550 tokens on d1 and 180 on Valen; a clip's
  // four frames about 460 on Valen, plus decoding. Generous on both, as the first
  // answer is: a gate that times out reads as "no".
  const mediaMs =
    reads.includes("image") || reads.includes("video")
      ? msPerToken === null
        ? { image: 30_000, video: 60_000 }
        : {
            image: clamp(msPerToken * 700 * 1.5 + 2_000, 4_000, 120_000),
            video: clamp(msPerToken * 1_200 * 1.5 + 5_000, 8_000, 180_000),
          }
      : undefined;
  if (msPerToken === null)
    return { ...(model.perQuestionMs ? { perQuestionMs: model.perQuestionMs } : {}), ...(mediaMs ? { mediaMs } : {}) };
  return {
    ...(mediaMs ? { mediaMs } : {}),
    firstAnswerMs: clamp(msPerToken * model.maxLengthTokens * 1.25 + 2_000, DECISION_TIMEOUT_MS.sidecar, 180_000),
    // A model with recurrent layers (JevK5, d1) rewinds its cache to the last saved
    // checkpoint rather than to the exact end of the scene, so each further question
    // re-reads a few hundred tokens: about 520 on JevK5 4B, measured 2026-11-18.
    perQuestionMs: model.perQuestionMs ?? clamp(msPerToken * 800 + 500, 250, 30_000),
  };
}
