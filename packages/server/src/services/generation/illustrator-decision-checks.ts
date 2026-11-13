// ──────────────────────────────────────────────
// Optional Decision model checks for Illustrator's scene backgrounds.
//
// Off by default. When a chat turns one on, the Decision model reads every
// finished Roleplay reply and answers a fixed statement: did the scene move to a
// new place, did the weather change. A yes starts the same background work the
// Illustrator's own decision does; the Prompt Model only writes a background
// prompt after a yes. The checks only ever add a reason to act: the
// Illustrator's run-interval decision and the World State tracker still count.
// ──────────────────────────────────────────────

import { BACKGROUND_WEATHER_VERSIONS, DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { DecisionBackend } from "../decision/decision-default.js";
import { DECISION_CHOICE_NONE, type NoulQuestion } from "../decision/system-one.client.js";
import { buildDecisionState, type DecisionMessage } from "./agent-activation-questions.js";

/** Statements about the latest message read most reliably with small Decision models. */
export const ILLUSTRATOR_DECISION_LOCATION_STATEMENT = "The latest message moves the scene to a new place.";
export const ILLUSTRATOR_DECISION_WEATHER_STATEMENT = "The weather changes in the latest message.";
/** Asked only when the World State tracker has no weather to read: a subject, with short answers. */
export const ILLUSTRATOR_DECISION_WEATHER_CHOICE = "The weather in the latest message";
/** "clear" for the plain picture, then every weather a background is repainted for. */
export const ILLUSTRATOR_DECISION_WEATHER_OPTIONS = ["clear", ...BACKGROUND_WEATHER_VERSIONS] as const;

export type IllustratorDecisionChecks = { location: boolean; weather: boolean };

/** Which checks this chat asked for. Each needs its background feature on to mean anything. */
export function illustratorDecisionChecks(
  chatMetadata: Record<string, unknown>,
  features: { automaticBackgrounds: boolean; weatherVersions: boolean },
): IllustratorDecisionChecks {
  return {
    location: features.automaticBackgrounds && chatMetadata.illustratorDecisionLocationCheck === true,
    weather: features.weatherVersions && chatMetadata.illustratorDecisionWeatherCheck === true,
  };
}

export type IllustratorDecisionAnswers = {
  /** null when the check is off or the model gave no answer. */
  locationChanged: boolean | null;
  weatherChanged: boolean | null;
  /** The model's pick from ILLUSTRATOR_DECISION_WEATHER_OPTIONS, when it was asked for one. */
  weather: string | null;
};

const NO_ANSWERS: IllustratorDecisionAnswers = { locationChanged: null, weatherChanged: null, weather: null };

/**
 * Ask the enabled checks in one request. Never throws: a failed or missing answer is null, and the
 * caller then behaves as if the check were off.
 */
export async function askIllustratorDecisionChecks(args: {
  backend: DecisionBackend;
  checks: IllustratorDecisionChecks;
  messages: DecisionMessage[];
  /** Also ask which weather it is (no tracker weather to read). */
  pickWeather: boolean;
  signal?: AbortSignal;
}): Promise<IllustratorDecisionAnswers> {
  const { backend, checks } = args;
  const questions: NoulQuestion[] = [];
  if (checks.location) questions.push({ id: "location", instructions: ILLUSTRATOR_DECISION_LOCATION_STATEMENT });
  if (checks.weather) {
    questions.push({ id: "weather", instructions: ILLUSTRATOR_DECISION_WEATHER_STATEMENT });
    if (args.pickWeather)
      questions.push({
        id: "weatherNow",
        instructions: ILLUSTRATOR_DECISION_WEATHER_CHOICE,
        options: [...ILLUSTRATOR_DECISION_WEATHER_OPTIONS],
      });
  }
  if (questions.length === 0 || args.signal?.aborted) return NO_ANSWERS;
  try {
    const state = buildDecisionState(args.messages, DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH, backend.maxStateTokens);
    const result = await backend.askMixed(state, questions);
    const threshold = backend.calibration.defaultThreshold;
    const yes = (id: string): boolean | null => {
      const p = result.answers.get(id);
      return typeof p === "number" && Number.isFinite(p) ? p >= threshold : null;
    };
    const picked = checks.weather && args.pickWeather ? result.choices.get("weatherNow") : undefined;
    const answers: IllustratorDecisionAnswers = {
      locationChanged: checks.location ? yes("location") : null,
      weatherChanged: checks.weather ? yes("weather") : null,
      weather:
        picked &&
        picked !== DECISION_CHOICE_NONE &&
        (ILLUSTRATOR_DECISION_WEATHER_OPTIONS as readonly string[]).includes(picked)
          ? picked
          : null,
    };
    logger.debug(
      "[illustrator-decision] new place=%s, weather changed=%s, weather=%s",
      answers.locationChanged,
      answers.weatherChanged,
      answers.weather ?? "-",
    );
    return answers;
  } catch (error) {
    logger.warn(error, "[illustrator-decision] Decision checks failed; backgrounds follow the Illustrator only");
    return NO_ANSWERS;
  }
}
