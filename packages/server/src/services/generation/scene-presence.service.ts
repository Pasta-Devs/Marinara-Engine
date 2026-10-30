/**
 * Picks a Merged Roleplay group's next active list: asks the Decision model who is in the
 * scene, falls back to the Character Tracker's last present list, then applies the pin and
 * narrator rules in `scene-presence-decision.ts`.
 *
 * The route gathers the chat-specific inputs and applies the result; everything that
 * decides lives here, so the regression can drive it without a generation.
 */
import type { DecisionBackend } from "../decision/decision-default.js";
import type { DecisionMessage } from "./agent-activation-questions.js";
import { logger } from "../../lib/logger.js";
import {
  chooseSceneCharacters,
  presentFromDecision,
  presentFromTracker,
  scenePresenceQuestions,
  scenePresenceState,
  type ScenePresenceCandidate,
  type ScenePresenceIdentity,
} from "./scene-presence-decision.js";

export interface ScenePresenceInput {
  mode: "decision" | "tracker";
  chatId: string;
  /** Every attached character, in roster order. */
  candidateIds: string[];
  /** The tracker snapshot's raw `presentCharacters`. */
  trackedPresentCharacters: unknown;
  /** Every attached card's name and aliases, inactive ones too; only called when the tracker has a list. */
  loadIdentities: () => Promise<ScenePresenceIdentity[]>;
  currentInactiveIds: string[];
  pinnedIds: string[];
  narratorId: string | null;
  /** Only called in Decision mode. */
  getBackend: () => Promise<DecisionBackend | null>;
  /** Only called once the Decision model will be asked. */
  loadCandidates: () => Promise<ScenePresenceCandidate[]>;
  /** The recent transcript, newest last; only called once the Decision model will be asked. */
  buildTranscript: () => DecisionMessage[];
}

export interface ScenePresenceResult {
  /** The new `inactiveCharacterIds`, or null to leave the chat as it is. */
  inactiveIds: string[] | null;
  source: "decision" | "tracker";
}

export async function decideSceneCharacters(input: ScenePresenceInput): Promise<ScenePresenceResult> {
  const tracked = input.trackedPresentCharacters;
  const trackedPresent =
    Array.isArray(tracked) && tracked.length > 0 ? presentFromTracker(tracked, await trackerIdentities(input)) : null;
  let presentIds = trackedPresent;
  let source: ScenePresenceResult["source"] = "tracker";

  if (input.mode === "decision") {
    const backend = await input.getBackend();
    // Choosing the cast sits in front of the reply, so a reasoning model defers here like
    // any pre-generation gate, and the tracker's last scene stands in.
    if (backend && !backend.deferPreGeneration) {
      const candidates = await input.loadCandidates();
      const namesById = new Map(candidates.map((candidate) => [candidate.id, candidate.name]));
      const state = scenePresenceState(
        input.buildTranscript(),
        candidates,
        (trackedPresent ?? []).map((id) => namesById.get(id) ?? id),
        backend.maxStateTokens,
      );
      if (!state) {
        logger.debug("[auto-active] Cast too large for the Decision model's state in chat %s", input.chatId);
      } else {
        const answers = await backend.ask(state, scenePresenceQuestions(candidates));
        const decided = answers
          ? presentFromDecision(
              answers,
              backend.calibration.defaultThreshold,
              candidates.map((candidate) => candidate.id),
            )
          : null;
        if (decided) {
          presentIds = decided;
          source = "decision";
        }
        if (answers)
          logger.debug(
            "[auto-active] Decision model scene for chat %s: %s",
            input.chatId,
            candidates.map((candidate) => `${candidate.name}=${answers.get(candidate.id)?.toFixed(3)}`).join(" "),
          );
      }
    }
  }

  return {
    inactiveIds: chooseSceneCharacters({
      candidateIds: input.candidateIds,
      presentIds,
      currentInactiveIds: input.currentInactiveIds,
      pinnedIds: input.pinnedIds,
      narratorId: input.narratorId,
    }),
    source,
  };
}

/** Every candidate, so a card whose name could not be read still matches by its id. */
async function trackerIdentities(input: ScenePresenceInput): Promise<ScenePresenceIdentity[]> {
  const loaded = new Map((await input.loadIdentities()).map((identity) => [identity.id, identity]));
  return input.candidateIds.map((id) => loaded.get(id) ?? { id, name: "", nameAliases: [] });
}
