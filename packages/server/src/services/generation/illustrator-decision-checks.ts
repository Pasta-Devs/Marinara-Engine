// ──────────────────────────────────────────────
// Optional Decision model checks for Illustrator's scene backgrounds.
//
// Off by default. When a chat turns one on, the Decision model reads every
// finished Roleplay reply and answers a fixed statement: did the scene move to a
// new place, did the weather change, did the time of day change. A yes starts the same background work the
// Illustrator's own decision does; the Prompt Model only writes a background
// prompt after a yes. The checks only ever add a reason to act: the
// Illustrator's run-interval decision and the World State tracker still count.
// ──────────────────────────────────────────────

import {
  BACKGROUND_TIME_VERSIONS,
  BACKGROUND_WEATHER_VERSIONS,
  DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
} from "@marinara-engine/shared";
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
export const ILLUSTRATOR_DECISION_TIME_STATEMENT = "The time of day changes in the latest message.";
/** Asked only when the World State tracker has no time to read. */
export const ILLUSTRATOR_DECISION_TIME_CHOICE = "The time of day in the latest message";
export const ILLUSTRATOR_DECISION_TIME_OPTIONS = BACKGROUND_TIME_VERSIONS;

export type IllustratorDecisionChecks = { location: boolean; weather: boolean; time: boolean };

/** Which checks this chat asked for. Each needs its background feature on to mean anything. */
export function illustratorDecisionChecks(
  chatMetadata: Record<string, unknown>,
  features: { automaticBackgrounds: boolean; weatherVersions: boolean; timeVersions?: boolean },
): IllustratorDecisionChecks {
  return {
    location: features.automaticBackgrounds && chatMetadata.illustratorDecisionLocationCheck === true,
    weather: features.weatherVersions && chatMetadata.illustratorDecisionWeatherCheck === true,
    time: features.timeVersions === true && chatMetadata.illustratorDecisionTimeCheck === true,
  };
}

export type IllustratorDecisionAnswers = {
  /** null when the check is off or the model gave no answer. */
  locationChanged: boolean | null;
  weatherChanged: boolean | null;
  /** The model's pick from ILLUSTRATOR_DECISION_WEATHER_OPTIONS, when it was asked for one. */
  weather: string | null;
  timeChanged: boolean | null;
  /** The model's pick from ILLUSTRATOR_DECISION_TIME_OPTIONS, when it was asked for one. */
  time: string | null;
};

const NO_ANSWERS: IllustratorDecisionAnswers = {
  locationChanged: null,
  weatherChanged: null,
  weather: null,
  timeChanged: null,
  time: null,
};

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
  /** Also ask which time of day it is (no tracker time to read). */
  pickTime?: boolean;
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
  if (checks.time) {
    questions.push({ id: "time", instructions: ILLUSTRATOR_DECISION_TIME_STATEMENT });
    if (args.pickTime)
      questions.push({
        id: "timeNow",
        instructions: ILLUSTRATOR_DECISION_TIME_CHOICE,
        options: [...ILLUSTRATOR_DECISION_TIME_OPTIONS],
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
    const pickedTime = checks.time && args.pickTime ? result.choices.get("timeNow") : undefined;
    const answers: IllustratorDecisionAnswers = {
      locationChanged: checks.location ? yes("location") : null,
      weatherChanged: checks.weather ? yes("weather") : null,
      weather:
        picked &&
        picked !== DECISION_CHOICE_NONE &&
        (ILLUSTRATOR_DECISION_WEATHER_OPTIONS as readonly string[]).includes(picked)
          ? picked
          : null,
      timeChanged: checks.time ? yes("time") : null,
      time:
        pickedTime &&
        pickedTime !== DECISION_CHOICE_NONE &&
        (ILLUSTRATOR_DECISION_TIME_OPTIONS as readonly string[]).includes(pickedTime)
          ? pickedTime
          : null,
    };
    logger.debug(
      "[illustrator-decision] new place=%s, weather changed=%s, weather=%s, time changed=%s, time=%s",
      answers.locationChanged,
      answers.weatherChanged,
      answers.weather ?? "-",
      answers.timeChanged,
      answers.time ?? "-",
    );
    return answers;
  } catch (error) {
    logger.warn(error, "[illustrator-decision] Decision checks failed; backgrounds follow the Illustrator only");
    return NO_ANSWERS;
  }
}
