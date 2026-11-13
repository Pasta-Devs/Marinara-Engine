// Illustrator Decision model checks (Nov 2026): optional, off by default. The Decision model reads each
// Roleplay reply for "a new place" and "the weather changes", and picks the weather when no tracker has one.
import assert from "node:assert/strict";

const {
  askIllustratorDecisionChecks,
  illustratorDecisionChecks,
  ILLUSTRATOR_DECISION_LOCATION_STATEMENT,
  ILLUSTRATOR_DECISION_WEATHER_STATEMENT,
  ILLUSTRATOR_DECISION_WEATHER_OPTIONS,
} = await import("../../packages/server/src/services/generation/illustrator-decision-checks.js");

const both = { automaticBackgrounds: true, weatherVersions: true };
// Off by default, and each check needs its background feature on.
assert.deepEqual(illustratorDecisionChecks({}, both), { location: false, weather: false });
assert.deepEqual(
  illustratorDecisionChecks(
    { illustratorDecisionLocationCheck: true, illustratorDecisionWeatherCheck: true },
    { automaticBackgrounds: false, weatherVersions: true },
  ),
  { location: false, weather: true },
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
  checks: { location: true, weather: true },
  pickWeather: true,
  messages,
});
assert.deepEqual(result, { locationChanged: true, weatherChanged: true, weather: "rain" });
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
  checks: { location: false, weather: true },
  pickWeather: false,
  messages,
});
assert.deepEqual(result, { locationChanged: null, weatherChanged: false, weather: null }, "an unasked pick is ignored");
assert.equal(asked.at(-1)!.length, 1);

// "none of these" and anything off the list are no pick.
result = await askIllustratorDecisionChecks({
  backend: backend({ weather: 0.9 }, { weatherNow: "none of these" }),
  checks: { location: false, weather: true },
  pickWeather: true,
  messages,
});
assert.equal(result.weather, null);

// Nothing on: nothing asked. A failed request is no answer, never a throw.
const before = asked.length;
result = await askIllustratorDecisionChecks({
  backend: backend({}),
  checks: { location: false, weather: false },
  pickWeather: true,
  messages,
});
assert.equal(asked.length, before);
result = await askIllustratorDecisionChecks({
  backend: { ...(backend({}) as object), askMixed: async () => Promise.reject(new Error("down")) } as never,
  checks: { location: true, weather: false },
  pickWeather: false,
  messages,
});
assert.deepEqual(result, { locationChanged: null, weatherChanged: null, weather: null });

console.log("illustrator decision checks: ok");
