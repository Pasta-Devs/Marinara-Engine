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
  DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
  decisionLocalSlotForId,
  normalizeDecisionThinking,
  type DecisionLocalSlot,
  type DecisionModelOption,
  type DecisionModelOptions,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import {
  describeDecisionSlot,
  isDecisionSlotImplemented,
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
  if (slot === "decision_sidecar" || !isDecisionSlotImplemented(slot)) return base;
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
    return { selected, options };
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
      if (!isDecisionSlotImplemented(slot) || !description.available)
        return reply.status(409).send({
          error: "That local model cannot answer decisions right now",
          reason: description.available ? "not_installed" : description.reason,
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
    await settings.remove(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
    await connections.update(id, { defaultForAgents: true });
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
    if (!isDecisionSlotImplemented(slot))
      return reply.status(409).send({ error: "That local model is not available in this build" });
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
