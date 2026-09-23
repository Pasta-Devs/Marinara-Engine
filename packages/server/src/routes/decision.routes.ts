/**
 * The Decision model setting: which model answers agent activation questions.
 *
 * One choice for the whole engine, offered as one list. Connections are stored rows
 * and keep using the ordinary `defaultForAgents` flag; local slots have no row, so the
 * chosen one is recorded as an app setting. Selecting either side clears the other, so
 * the list and the stored state can never disagree.
 *
 * Entries that cannot serve right now are returned with a reason rather than omitted:
 * hiding the local model entry produces "where did it go" reports from users who were
 * told the feature exists.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  DECISION_LOCAL_DEFAULT_SETTINGS_KEY,
  DECISION_LOCAL_SLOTS,
  DECISION_LOCAL_SLOT_IDS,
  DECISION_THINKING_MODES,
  DECISION_SMART_ORDER_SETTINGS_KEY,
  DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
  decisionLocalSlotForId,
  DECISION_SIDECAR_SETTINGS_KEY,
  DEFAULT_DECISION_CALIBRATION,
  findDecisionModel,
  parseDecisionSidecarSettings,
  SIDECAR_DECISION_MODELS,
  type DecisionSidecarSettings,
  normalizeDecisionThinking,
  type DecisionCalibration,
  type DecisionLocalSlot,
  type DecisionModelOption,
  type DecisionModelOptions,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { DECISION_SIDECAR_RATE_LIMIT } from "../middleware/rate-limit.js";
import { decisionProcessService } from "../services/sidecar/decision-process.service.js";
import { DECISION_TIMEOUT_MS } from "@marinara-engine/shared";
import { askNoulQuestions } from "../services/decision/system-one.client.js";
import { inspectDecisionRepo } from "../services/sidecar/decision-byo.js";
import { configuredCudaIndex, preflightDecisionModel } from "../services/sidecar/decision-preflight.js";
import { awaitGpuProbe } from "../services/sidecar/sidecar-footprint.js";
import {
  decisionRuntimeInstalled,
  decisionRuntimeService,
  isDecisionRuntimeSupported,
} from "../services/sidecar/decision-runtime.service.js";
import {
  decisionSidecarSettings,
  describeDecisionSlot,
  hasThinkingSetting,
  installedDecisionModel,
  setDecisionSidecarSettingsReader,
  resolveDecisionSlot,
  setDecisionSlotThinking,
} from "../services/decision/decision-slots.js";
import { getAnswerStyle } from "../services/decision/decision-thinking-cache.js";
import { probeDecisionSlot } from "../services/decision/sidecar-decision.backend.js";
import { sidecarModelService } from "../services/sidecar/sidecar-model.service.js";
import { utilitySidecarService } from "../services/utility-sidecar/utility-sidecar.service.js";

const slotSchema = z.enum(DECISION_LOCAL_SLOTS);
const selectSchema = z.object({ id: z.string().trim().max(128).nullable() });
const thinkingSchema = z.object({ slot: slotSchema, thinking: z.enum(DECISION_THINKING_MODES) });

/** The label shown for each local entry, with the model it would actually use. */
const SLOT_LABELS: Record<DecisionLocalSlot, string> = {
  primary: "Primary local model",
  utility: "Utility local model",
  decision_sidecar: "Decision sidecar",
};

/**
 * A local chat model is prompted rather than queried, so it reads the question as
 * written and answers on the ordinary scale. The managed decision sidecar brings its
 * own operating point from its catalog entry.
 */
function localSlotCalibration(slot: DecisionLocalSlot): DecisionCalibration {
  return slot === "decision_sidecar"
    ? (installedDecisionModel(decisionSidecarSettings())?.calibration ?? DEFAULT_DECISION_CALIBRATION)
    : DEFAULT_DECISION_CALIBRATION;
}

function slotThinking(slot: DecisionLocalSlot) {
  return normalizeDecisionThinking(
    slot === "utility"
      ? utilitySidecarService.getConfig().decisionThinking
      : sidecarModelService.getConfig().decisionThinking,
  );
}

function slotModelIdentity(slot: DecisionLocalSlot): string {
  if (slot === "utility") {
    const config = utilitySidecarService.getConfig();
    const active = config.activeModelId ?? "";
    return `utility:${active}:${config.models[active]?.oid ?? ""}`;
  }
  const status = sidecarModelService.getStatus();
  return `primary:${sidecarModelService.getConfiguredModelRef() ?? ""}:${status.modelSize ?? 0}`;
}

interface DecisionConnectionRowSummary {
  id: string;
  credentialsFromConnectionId?: string | null;
  profileImportReviewRequired?: unknown;
}

/**
 * Why a Decision connection cannot serve, or null when it can.
 *
 * A borrowed key whose connection is gone cannot sign a request, and copying the key
 * across on deletion would be a silent credential move. One function so the list and
 * the writer cannot drift into disagreeing about what is selectable.
 */
export function decisionConnectionUnavailable(
  row: DecisionConnectionRowSummary,
  rows: DecisionConnectionRowSummary[],
): "needs_relinking" | null {
  if (row.profileImportReviewRequired === "true") return "needs_relinking";
  if (!row.credentialsFromConnectionId) return null;
  const lender = rows.find((other) => other.id === row.credentialsFromConnectionId);
  return lender && lender.profileImportReviewRequired !== "true" ? null : "needs_relinking";
}

function localOption(slot: DecisionLocalSlot, selectedId: string | null): DecisionModelOption {
  const id = DECISION_LOCAL_SLOT_IDS[slot];
  const description = describeDecisionSlot(slot);
  const identity = slotModelIdentity(slot);
  const base: DecisionModelOption = {
    id,
    label: description.available ? `${SLOT_LABELS[slot]} — ${description.label}` : SLOT_LABELS[slot],
    group: "local",
    slot,
    selected: selectedId === id,
    unavailable: description.available ? null : description.reason,
    ...(description.available ? {} : description.detail ? { detail: description.detail } : {}),
  };
  if (!hasThinkingSetting(slot)) return base;
  return {
    ...base,
    thinking: slotThinking(slot),
    answerStyle: getAnswerStyle(identity),
    // Always true for a local chat model: its yes/no probabilities are usable for a
    // threshold but were never trained to be calibrated the way a purpose-built
    // decision model's are, and a slot whose runtime returns no log-probabilities
    // answers 1 or 0 outright. Both cases want the same warning.
    uncalibrated: true,
  };
}

export async function decisionRoutes(app: FastifyInstance) {
  const settings = createAppSettingsStorage(app.db);
  const connections = createConnectionsStorage(app.db);

  /**
   * The slot description is synchronous, because the dropdown asks about every entry
   * on each request and must not wait on the database. The settings are cached here
   * and refreshed on every write, so the reader never blocks.
   */
  let sidecarSettings = parseDecisionSidecarSettings(await settings.get(DECISION_SIDECAR_SETTINGS_KEY));
  setDecisionSidecarSettingsReader(() => sidecarSettings);
  // Serialised, and the cache follows the write rather than leading it. Updating
  // memory first means a failed save leaves the engine acting on a setting that is
  // not on disk, and two concurrent writes could otherwise interleave so the last
  // value cached is not the last value stored.
  let sidecarWrites: Promise<unknown> = Promise.resolve();
  const writeSidecarSettings = async (update: (current: DecisionSidecarSettings) => DecisionSidecarSettings) => {
    // The updater runs inside the queue, not at call time. Capturing the settings
    // before waiting means two concurrent changes each start from the same snapshot
    // and the second silently drops the first: enabling and changing the start policy
    // at once would lose one of them.
    const write = sidecarWrites.then(async () => {
      const next = update(sidecarSettings);
      await settings.set(DECISION_SIDECAR_SETTINGS_KEY, JSON.stringify(next));
      sidecarSettings = next;
      return next;
    });
    // Keep the chain alive even when this write fails, so one failure does not wedge
    // every later setting change behind a rejected promise.
    sidecarWrites = write.catch(() => undefined);
    return write;
  };

  // Start with Marinara only when the user asked for that. `installedDecisionModel`
  // returns null unless the sidecar is enabled, so a disabled install cannot start
  // here. Fire and forget: a model that cannot load must never hold up boot, and the
  // failure is already recorded in the process status for the panel to show.
  if (sidecarSettings.startPolicy === "with_marinara") {
    const model = installedDecisionModel(sidecarSettings);
    if (model)
      void decisionProcessService
        .ensureRunning(model)
        .catch((error) => logger.warn(error, "[decision-sidecar] Start-with-Marinara failed"));
  }

  /** What the panel needs: the catalog, each entry's verdict, and what is installed. */
  app.get("/sidecar", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async () => {
    const models = await Promise.all(
      SIDECAR_DECISION_MODELS.map(async (model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
        downloadSizeBytes: model.downloadSizeBytes,
        diskBytes: model.diskBytes,
        vramBytes: model.vramBytes,
        licenses: model.licenses,
        downloaded: decisionRuntimeService.modelDownloaded(model),
        preflight: await preflightDecisionModel(model),
      })),
    );
    // Every preflight above waited for the probe, so this reads the same result.
    const probe = await awaitGpuProbe();
    return {
      supported: isDecisionRuntimeSupported(),
      // Greyed out rather than hidden when nothing fits: hiding it produces "where is
      // the option" reports from people who were told the feature exists.
      unsupportedReason: isDecisionRuntimeSupported() ? null : "Requires Linux with an NVIDIA GPU",
      settings: sidecarSettings,
      runtimeInstalled: decisionRuntimeInstalled(),
      process: decisionProcessService.getStatus(),
      logPath: decisionProcessService.getLogPath(),
      models,
      // For the GPU picker. By `nvidia-smi` index, which is what `cuda:N` means once
      // the process runs with CUDA_DEVICE_ORDER=PCI_BUS_ID.
      devices: probe.devices.map((device) => ({
        index: device.index,
        name: device.name,
        totalBytes: device.totalBytes,
      })),
      cudaDevice: configuredCudaIndex(),
    };
  });

  /**
   * Choose the GPU the decision sidecar runs on, or null for the default.
   *
   * A running process is stopped, because it stays on the card it was launched on;
   * the next start is weighed and placed on the new one.
   */
  app.post("/sidecar/device", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    const { cudaDevice } = z.object({ cudaDevice: z.number().int().min(0).max(63).nullable() }).parse(req.body);
    if (cudaDevice !== null) {
      const probe = await awaitGpuProbe({ fresh: true });
      if (!probe.devices.some((device) => device.index === cudaDevice))
        return reply.status(409).send({ error: `There is no NVIDIA GPU at index ${cudaDevice}` });
    }
    // Saved first, stopped second. A gate starting between the two would otherwise read
    // the old choice and relaunch on the old card. With this order, any start after the
    // save reads the new card, and the stop cancels any start that began before it.
    const next = await writeSidecarSettings((current) => ({ ...current, cudaDevice }));
    await decisionProcessService.stop();
    if (next.startPolicy === "with_marinara") {
      const model = installedDecisionModel(next);
      if (model)
        void decisionProcessService
          .ensureRunning(model)
          .catch((error) => logger.warn(error, "[decision-sidecar] Restart on the new GPU failed"));
    }
    return { settings: next };
  });

  /**
   * Turn the sidecar on or off.
   *
   * Enabling records what the user was shown when they agreed, so a support report can
   * tell an informed choice from a surprise. Disabling stops the process and keeps the
   * download: removing the files is a separate, explicit action.
   */
  app.post("/sidecar/enable", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    const body = z.object({ enabled: z.boolean(), confirmedVerdict: z.string().max(64).optional() }).parse(req.body);
    if (body.enabled && !isDecisionRuntimeSupported())
      return reply.status(409).send({ error: "The decision sidecar is not supported on this machine" });
    if (!body.enabled) await decisionProcessService.stop();
    return {
      settings: await writeSidecarSettings((current) => ({
        ...current,
        enabled: body.enabled,
        confirmedAt: body.enabled ? new Date().toISOString() : current.confirmedAt,
        confirmedVerdict: body.enabled ? (body.confirmedVerdict ?? null) : current.confirmedVerdict,
      })),
    };
  });

  app.post("/sidecar/start-policy", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req) => {
    const { startPolicy } = z.object({ startPolicy: z.enum(["on_demand", "with_marinara"]) }).parse(req.body);
    return { settings: await writeSidecarSettings((current) => ({ ...current, startPolicy })) };
  });

  /**
   * Install a catalog entry: the runtime, then its weights.
   *
   * Refuses an entry this machine cannot run rather than letting a download start and
   * fail at load, which is the whole point of having a preflight.
   */
  app.post("/sidecar/install", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Decision model download" })) return;
    const body = z
      .object({
        modelId: z.string().trim().min(1).max(200).optional(),
        repoId: z.string().trim().min(3).max(120).optional(),
        revision: z.string().trim().max(120).optional(),
      })
      .parse(req.body);
    // A pasted repository is re-inspected here rather than trusting whatever the
    // client sends: the description it showed the user is not an authorisation.
    let model = body.modelId ? findDecisionModel(body.modelId) : null;
    let custom = false;
    if (!model && body.repoId) {
      const inspected = await inspectDecisionRepo(body.repoId, body.revision || "main");
      if ("refusal" in inspected)
        return reply.status(409).send({ error: "That repository cannot be installed", reason: inspected.refusal });
      model = inspected.model;
      custom = true;
    }
    if (!model) return reply.status(404).send({ error: "No such decision model" });
    if (!sidecarSettings.enabled)
      return reply.status(409).send({ error: "Enable the decision sidecar before installing a model" });
    const preflight = await preflightDecisionModel(model);
    if (!preflight.installable)
      return reply.status(409).send({ error: preflight.reason ?? "This machine cannot run that model" });
    try {
      await decisionRuntimeService.ensureInstalled((progress) =>
        logger.debug("[decision-sidecar] %s %s", progress.phase, progress.label ?? ""),
      );
      await decisionRuntimeService.downloadModel(model, (progress) =>
        logger.debug("[decision-sidecar] %s %s", progress.phase, progress.label ?? ""),
      );
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Install failed" });
    }
    return {
      settings: await writeSidecarSettings((current) => ({
        ...current,
        modelId: custom ? null : model.id,
        customModel: custom ? model : null,
      })),
    };
  });

  /** Delete the runtime and every downloaded weight. Separate from turning it off. */
  app.post("/sidecar/remove", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Decision model removal" })) return;
    await decisionProcessService.stop();
    await decisionRuntimeService.remove();
    return {
      settings: await writeSidecarSettings((current) => ({
        ...current,
        modelId: null,
        // A pasted entry is stored whole, so clearing modelId alone would leave
        // installedDecisionModel still reporting a model whose files are gone.
        customModel: null,
        enabled: false,
      })),
    };
  });

  /**
   * Look at a pasted repository without installing anything.
   *
   * Answers with what would be installed and this machine's verdict on it, or the
   * reason it is refused. Read-only on purpose: the user sees the base model it pulls
   * and the total size before they agree to any of it.
   */
  app.post("/sidecar/inspect", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async (req) => {
    const { repoId, revision } = z
      .object({ repoId: z.string().trim().min(3).max(120), revision: z.string().trim().max(120).optional() })
      .parse(req.body);
    const inspected = await inspectDecisionRepo(repoId, revision || "main");
    if ("refusal" in inspected) return { refusal: inspected.refusal };
    return {
      model: inspected.model,
      // The exact commit this verdict describes. The install sends it back, so a
      // branch that moves between checking and confirming cannot swap what is
      // downloaded for something the user never saw.
      revision: inspected.model.artifacts[0]?.revision ?? null,
      preflight: await preflightDecisionModel(inspected.model),
    };
  });

  app.post("/sidecar/stop", { config: { rateLimit: DECISION_SIDECAR_RATE_LIMIT } }, async () => {
    await decisionProcessService.stop();
    return { process: decisionProcessService.getStatus() };
  });

  const readSelected = async (): Promise<string | null> => {
    const local = await settings.get(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
    if (decisionLocalSlotForId(local)) return local;
    const row = await connections.getDefaultForDecision();
    return row?.id ?? null;
  };

  /** Every entry the dropdown offers, with the reason for each one it cannot use. */
  app.get("/options", async (): Promise<DecisionModelOptions> => {
    const selected = await readSelected();
    const rows = await connections.list();
    const options: DecisionModelOption[] = DECISION_LOCAL_SLOTS.map((slot) => localOption(slot, selected));
    for (const row of rows) {
      if (row.provider !== "decision") continue;
      options.push({
        id: row.id,
        label: row.name,
        group: "connection",
        slot: null,
        selected: selected === row.id,
        unavailable: decisionConnectionUnavailable(row, rows),
      });
    }
    // The editor needs the selected model's operating point, not a constant: seeding a
    // new question with 0.5 against a model that answers yes at 0.2 would make it skip
    // every relevant turn while looking configured.
    const slot = decisionLocalSlotForId(selected);
    const calibration = slot ? localSlotCalibration(slot) : DEFAULT_DECISION_CALIBRATION;
    return { selected, options, calibration };
  });

  /**
   * Choose the decision model, or None.
   *
   * Writes both sides every time: a local entry clears whichever connection held the
   * flag, and a connection clears the stored local id. Changing the choice never
   * touches any agent's question or threshold.
   */
  app.post("/select", async (req, reply) => {
    const { id } = selectSchema.parse(req.body);
    const slot = decisionLocalSlotForId(id);
    const current = await connections.getDefaultForDecision();
    if (slot) {
      // An entry the dropdown greys out must not be selectable through the API
      // either. Storing one would leave /options reporting it as chosen while every
      // gate quietly resolved nothing, which reads as "activation questions are
      // broken" rather than "that model is not set up".
      const description = describeDecisionSlot(slot);
      if (!description.available)
        return reply.status(409).send({
          error: "That local model cannot answer decisions right now",
          reason: description.reason,
        });
      await settings.set(DECISION_LOCAL_DEFAULT_SETTINGS_KEY, id!);
      if (current) await connections.update(current.id, { defaultForAgents: false });
      return { selected: id };
    }
    if (!id) {
      await settings.remove(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
      if (current) await connections.update(current.id, { defaultForAgents: false });
      return { selected: null };
    }
    const row = await connections.getById(id);
    if (!row || row.provider !== "decision") return reply.status(404).send({ error: "No such decision connection" });
    // The same check the dropdown greys the row out with. A stale client, or a direct
    // request, must not be able to store a connection that cannot sign a request:
    // that leaves a decision model named in the UI while every gate fails open.
    const unavailable = decisionConnectionUnavailable(row, await connections.list());
    if (unavailable)
      return reply
        .status(409)
        .send({ error: "That connection cannot answer decisions right now", reason: unavailable });
    // Nothing above this line changes stored state. A rejected request must leave the
    // user on whatever they had chosen: clearing the local slot first would answer a
    // 404 or a 409 and silently drop them to None, which stops every gate.
    // The connection is promoted first. If that fails the stored local slot is still
    // there, which is a decision model that works; doing it the other way round could
    // leave nothing selected at all after a failed update.
    await connections.update(id, { defaultForAgents: true });
    await settings.remove(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
    return { selected: id };
  });

  /**
   * How a local slot's model is allowed to reach its answer.
   *
   * Unlike `/select`, this deliberately accepts a slot with no model downloaded yet.
   * It is a preference stored in that slot's own config, exactly like `contextSize`
   * and `gpuLayers`, which `/api/sidecar/config` and the utility slot's settings both
   * accept before a model exists; it simply applies once one does. An unimplemented
   * slot is different: the setter discards that write, so returning the requested
   * value would report a save that did not happen.
   */
  app.post("/thinking", async (req, reply) => {
    const { slot, thinking } = thinkingSchema.parse(req.body);
    // A decision model has no reasoning to allow or forbid, so a request naming it is
    // refused rather than echoed back as a saved setting it does not have.
    if (!hasThinkingSetting(slot)) return reply.status(409).send({ error: "That model has no thinking setting" });
    setDecisionSlotThinking(slot, thinking);
    return { slot, thinking };
  });

  /**
   * Whether a model that has to think first may also gate pre-generation agents.
   *
   * Off by default, because those gates sit in front of the user's reply and reasoning
   * takes seconds. Post-processing gates run after the reply is on screen either way.
   */
  app.get("/thinking-pregeneration", async () => ({
    enabled: (await settings.get(DECISION_THINKING_PREGENERATION_SETTINGS_KEY)) === "true",
  }));

  app.post("/thinking-pregeneration", async (req) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    if (enabled) await settings.set(DECISION_THINKING_PREGENERATION_SETTINGS_KEY, "true");
    else await settings.remove(DECISION_THINKING_PREGENERATION_SETTINGS_KEY);
    return { enabled };
  });

  /**
   * Whether Smart response order asks the Decision model who should speak.
   *
   * Off by default. The chat-model selector remains the fallback whenever the Decision
   * model is unset or does not answer, so turning this on can save a call per turn but
   * never leaves a turn without a speaker.
   */
  app.get("/smart-order", async () => ({
    enabled: (await settings.get(DECISION_SMART_ORDER_SETTINGS_KEY)) === "true",
  }));

  app.post("/smart-order", async (req) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    if (enabled) await settings.set(DECISION_SMART_ORDER_SETTINGS_KEY, "true");
    else await settings.remove(DECISION_SMART_ORDER_SETTINGS_KEY);
    return { enabled };
  });

  /**
   * The Test button for a local entry, which has no connection form of its own.
   *
   * Reports the probability and latency like a connection test does, plus the two
   * things only a local slot can be unsure about: whether log-probabilities came back,
   * and whether the model answered directly or had to think first.
   */
  app.post("/test", async (req, reply) => {
    const { slot } = z.object({ slot: slotSchema }).parse(req.body);
    const resolution = await resolveDecisionSlot(slot);
    if (!resolution.resolved)
      return reply.status(200).send({ success: false, errorCode: resolution.failure.reason, latencyMs: 0 });
    // A System One slot answers a fixed Noul question, not a chat prompt. Testing it
    // the chat way is what made this return "no answer" against a healthy server.
    if (resolution.resolved.protocol === "system_one") {
      const result = await askNoulQuestions({
        connection: {
          endpoint: `${resolution.resolved.baseUrl}/v1/systemone`,
          apiKey: "",
          model: resolution.resolved.model,
          maxStateTokens: 3500,
        },
        state: { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] },
        questions: [{ id: "test", instructions: "The door is open." }],
        timeoutMs: DECISION_TIMEOUT_MS.sidecar,
        questionShape: resolution.resolved.calibration?.questionShape ?? "text",
      });
      const probability = result.answers.get("test");
      return {
        success: probability !== undefined,
        decisionProbability: probability,
        latencyMs: result.latencyMs,
        // A purpose-built decision model returns a calibrated probability directly
        // and never reasons, so both of the chat-slot caveats are simply true.
        logprobs: true,
        answersDirectly: true,
        errorCode: result.error,
      };
    }

    const probe = await probeDecisionSlot(resolution.resolved);
    return {
      success: probe.probability !== null,
      decisionProbability: probe.probability ?? undefined,
      latencyMs: probe.latencyMs,
      logprobs: probe.logprobs,
      answersDirectly: probe.answersDirectly,
      errorCode: probe.probability === null ? "no_answer" : undefined,
    };
  });
}
