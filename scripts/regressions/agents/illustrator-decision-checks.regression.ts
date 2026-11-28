// Illustrator Decision model checks (Nov 2026): optional, off by default. The Decision model reads each
// Roleplay reply for "a new place", "the weather changes" and "the time of day changes", and picks the weather
// or the time of day when no tracker has one.
import assert from "node:assert/strict";

const {
  askIllustratorDecisionChecks,
  illustratorDecisionChecks,
  ILLUSTRATOR_DECISION_LOCATION_STATEMENT,
  ILLUSTRATOR_DECISION_WEATHER_STATEMENT,
  ILLUSTRATOR_DECISION_WEATHER_OPTIONS,
  ILLUSTRATOR_DECISION_TIME_STATEMENT,
} = await import("../../../packages/server/src/services/generation/illustrator-decision-checks.js");

const both = { automaticBackgrounds: true, weatherVersions: true };
// Off by default, and each check needs its background feature on.
assert.deepEqual(illustratorDecisionChecks({}, both), { location: false, weather: false, time: false });
assert.deepEqual(
  illustratorDecisionChecks(
    { illustratorDecisionLocationCheck: true, illustratorDecisionWeatherCheck: true },
    { automaticBackgrounds: false, weatherVersions: true },
  ),
  { location: false, weather: true, time: false },
);
assert.deepEqual(
  illustratorDecisionChecks(
    { illustratorDecisionTimeCheck: true },
    { automaticBackgrounds: true, weatherVersions: true, timeVersions: true },
  ),
  { location: false, weather: false, time: true },
);
assert.equal(
  illustratorDecisionChecks({ illustratorDecisionTimeCheck: true }, both).time,
  false,
  "the time check needs time of day versions on",
);

const asked: Array<Array<{ id: string; instructions: string; options?: string[] }>> = [];
const backend = (answers: Record<string, number>, choices: Record<string, string> = {}) =>
  ({
    maxStateTokens: 4000,
    calibration: { defaultThreshold: 0.5 },
    askMixed: async (_state: unknown, questions: Array<{ id: string; instructions: string; options?: string[] }>) => {
      asked.push(questions);
      return { answers: new Map(Object.entries(answers)), choices: new Map(Object.entries(choices)) };
    },
  }) as never;
const messages = [
  { role: "user", content: "Let's head to the docks." },
  { role: "assistant", content: "Rain begins to fall as you reach the harbor." },
];

// Statements, worded about the latest message; the weather choice only without tracker weather.
let result = await askIllustratorDecisionChecks({
  backend: backend({ location: 0.9, weather: 0.8 }, { weatherNow: "rain" }),
  checks: { location: true, weather: true, time: false },
  pickWeather: true,
  messages,
});
assert.deepEqual(result, {
  locationChanged: true,
  weatherChanged: true,
  weather: "rain",
  timeChanged: null,
  time: null,
});
assert.deepEqual(
  asked.at(-1)!.map((question) => question.instructions),
  [
    ILLUSTRATOR_DECISION_LOCATION_STATEMENT,
    ILLUSTRATOR_DECISION_WEATHER_STATEMENT,
    "The weather in the latest message",
  ],
);
assert.deepEqual(asked.at(-1)![2]!.options, [...ILLUSTRATOR_DECISION_WEATHER_OPTIONS]);

result = await askIllustratorDecisionChecks({
  backend: backend({ weather: 0.2 }, { weatherNow: "snow" }),
  checks: { location: false, weather: true, time: false },
  pickWeather: false,
  messages,
});
assert.deepEqual(
  result,
  { locationChanged: null, weatherChanged: false, weather: null, timeChanged: null, time: null },
  "an unasked pick is ignored",
);
assert.equal(asked.at(-1)!.length, 1);

// "none of these" and anything off the list are no pick.
result = await askIllustratorDecisionChecks({
  backend: backend({ weather: 0.9 }, { weatherNow: "none of these" }),
  checks: { location: false, weather: true, time: false },
  pickWeather: true,
  messages,
});
assert.equal(result.weather, null);

// Time of day: a statement, and the time picked from the four only without a tracker time.
result = await askIllustratorDecisionChecks({
  backend: backend({ time: 0.85 }, { timeNow: "sunset" }),
  checks: { location: false, weather: false, time: true },
  pickWeather: true,
  pickTime: true,
  messages,
});
assert.deepEqual(result, {
  locationChanged: null,
  weatherChanged: null,
  weather: null,
  timeChanged: true,
  time: "sunset",
});
assert.deepEqual(
  asked.at(-1)!.map((question) => question.instructions),
  [ILLUSTRATOR_DECISION_TIME_STATEMENT, "The time of day in the latest message"],
);
assert.deepEqual(asked.at(-1)![1]!.options, ["dawn", "day", "sunset", "night"]);
result = await askIllustratorDecisionChecks({
  backend: backend({ time: 0.1 }, { timeNow: "noon" }),
  checks: { location: false, weather: false, time: true },
  pickWeather: false,
  pickTime: true,
  messages,
});
assert.equal(result.timeChanged, false);
assert.equal(result.time, null, "anything off the list is no pick");

// Nothing on: nothing asked. A failed request is no answer, never a throw.
const before = asked.length;
result = await askIllustratorDecisionChecks({
  backend: backend({}),
  checks: { location: false, weather: false, time: false },
  pickWeather: true,
  messages,
});
assert.equal(asked.length, before);
result = await askIllustratorDecisionChecks({
  backend: { ...(backend({}) as object), askMixed: async () => Promise.reject(new Error("down")) } as never,
  checks: { location: true, weather: false, time: false },
  pickWeather: false,
  messages,
});
assert.deepEqual(result, { locationChanged: null, weatherChanged: null, weather: null, timeChanged: null, time: null });

console.log("illustrator decision checks: ok");
