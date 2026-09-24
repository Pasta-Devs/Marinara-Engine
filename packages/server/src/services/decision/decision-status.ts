import {
  DECISION_LOCAL_DEFAULT_SETTINGS_KEY,
  DEFAULT_DECISION_CALIBRATION,
  decisionLocalSlotForId,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { decisionSidecarSettings, describeDecisionSlot, installedDecisionModel } from "./decision-slots.js";

interface DecisionConnectionRowSummary {
  id: string;
  credentialsFromConnectionId?: string | null;
  profileImportReviewRequired?: unknown;
}

/** Shared by selection, the options list and Mari. This is not a network health test. */
export function decisionConnectionUnavailable(
  row: DecisionConnectionRowSummary,
  rows: DecisionConnectionRowSummary[],
): "needs_relinking" | null {
  if (row.profileImportReviewRequired === "true") return "needs_relinking";
  if (!row.credentialsFromConnectionId) return null;
  const lender = rows.find((other) => other.id === row.credentialsFromConnectionId);
  return lender && lender.profileImportReviewRequired !== "true" ? null : "needs_relinking";
}

export async function readSelectedDecisionModel(db: DB): Promise<string | null> {
  const local = await createAppSettingsStorage(db).get(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
  if (decisionLocalSlotForId(local)) return local;
  return (await createConnectionsStorage(db).getDefaultForDecision())?.id ?? null;
}

/** Never starts a model, sends a provider request, or exposes credentials. */
export async function readDecisionAuthoringStatus(db: DB) {
  try {
    const selected = await readSelectedDecisionModel(db);
    if (!selected) return { state: "none" as const, selected: null, health: "untested" as const };
    const slot = decisionLocalSlotForId(selected);
    if (slot) {
      const description = describeDecisionSlot(slot);
      return {
        state: description.available ? ("selected" as const) : ("unavailable" as const),
        selected,
        source: "local" as const,
        slot,
        reason: description.available ? null : description.reason,
        calibration:
          slot === "decision_sidecar"
            ? (installedDecisionModel(decisionSidecarSettings())?.calibration ?? DEFAULT_DECISION_CALIBRATION)
            : DEFAULT_DECISION_CALIBRATION,
        health: "untested" as const,
      };
    }
    const rows = await createConnectionsStorage(db).list();
    const row = rows.find((entry) => entry.id === selected && entry.provider === "decision");
    const reason = row ? decisionConnectionUnavailable(row, rows) : "missing_connection";
    return {
      state: reason ? ("unavailable" as const) : ("selected" as const),
      selected,
      source: "connection" as const,
      reason,
      calibration: DEFAULT_DECISION_CALIBRATION,
      health: "untested" as const,
    };
  } catch (err) {
    logger.warn(err, "Mari could not read Decision model status");
    return { state: "unknown" as const, selected: null, health: "untested" as const };
  }
}
