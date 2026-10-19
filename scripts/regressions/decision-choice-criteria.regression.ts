/**
 * Criteria on a Choice option (#7791): `decision_choice:"..." == "angry":"criteria"`.
 *
 * Every macro written before this keeps its meaning. The criteria reach the Decision
 * model as the option's description, on System One and on a chat model, while the
 * answer and every comparison stay the option alone. Malformed criteria fall back to
 * what the parser always did with that text.
 */
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";

const { collectDecisionQuestions, planDecisionStatements, resolveDeferredCharacterMacros, resolveMacros } =
  await import("../../packages/shared/dist/index.js");
const { answerPromptDecisions, planPromptDecisions, PromptDecisionTurnCache } =
  await import("../../packages/server/src/services/decision/prompt-decisions.js");
const { askChoicesAsStatements } = await import("../../packages/server/src/services/decision/decision-default.js");
const { askNoulQuestions } = await import("../../packages/server/src/services/decision/system-one.client.js");

const profiles = [{ name: "Kaelen" }, { name: "Alyssa" }];
const base = {
  user: "Mira",
  char: "Kaelen",
  characters: ["Kaelen", "Alyssa"],
  variables: {},
  characterProfiles: profiles,
};
const run = (template: string, choices?: Record<string, string>) =>
  resolveMacros(
    template,
    { ...base, decisions: choices ? { choices: new Map(Object.entries(choices)) } : undefined } as never,
    { trimResult: false },
  );
const collect = (condition: string) => collectDecisionQuestions(`{{#if ${condition}}}x{{/if}}`);

// ── the old syntax is unchanged ─────────────────────────────────────────────────

assert.deepEqual(collect(`decision_choice:"mood" == "angry"`), [
  { kind: "choice", question: "mood", options: ["angry"] },
]);
assert.deepEqual(collect(`decision_choice:"weather" == "rain" || "snow"`), [
  { kind: "choice", question: "weather", options: ["rain", "snow"] },
]);
// A colon inside one quoted value is part of it, as before.
assert.deepEqual(collect(`decision_choice:"time" == "time: 12:00"`)[0]!.options, ["time: 12:00"]);
assert.deepEqual(collect(`decision_choice:"line" == "say \\"hi\\""`)[0]!.options, ['say "hi"']);
assert.deepEqual(collect(`decision_choice:"line" == "He said "hi" to me"`)[0]!.options, ['He said "hi" to me']);
assert.equal(run(`{{#if decision_choice:"mood" == "angry"}}A{{else}}B{{/if}}`, { mood: "angry" }), "A");
// Only a comparison with a Choice statement reads criteria; any other keeps the literal.
assert.equal(run(`{{#if char == "Kaelen":"x"}}A{{else}}B{{/if}}`), "B");
assert.equal(run(`{{#if char == 'Kaelen:x'}}A{{else}}B{{/if}}`), "B");

// ── the new syntax ──────────────────────────────────────────────────────────────

assert.deepEqual(collect(`decision_choice:"mood" == "angry":"Kaelen shouts or threatens"`), [
  { kind: "choice", question: "mood", options: ["angry"], criteria: ["Kaelen shouts or threatens"] },
]);
assert.deepEqual(collect(`decision_choice:"mood" sticky:2 == "angry" : "shouts"`), [
  { kind: "choice", question: "mood", sticky: 2, options: ["angry"], criteria: ["shouts"] },
]);
assert.deepEqual(collect(`decision_choice:"weather" == "rain" || "snow":"white flakes fall"`)[0], {
  kind: "choice",
  question: "weather",
  options: ["rain", "snow"],
  criteria: ["", "white flakes fall"],
});
assert.deepEqual(collect(`"angry":"shouts" == decision_choice:"mood"`)[0]!.criteria, ["shouts"], "either side");
// Quotes and escapes behave as in any other quoted value.
assert.deepEqual(collect(`decision_choice:"mood" == 'angry':'he "snaps"'`)[0]!.criteria, ['he "snaps"']);
assert.deepEqual(collect(`decision_choice:"mood" == \u201cangry\u201d:\u201cshouts\u201d`)[0]!.options, ["angry"]);
assert.deepEqual(collect(`decision_choice:"mood" == "an\\"gry":"says \\"no\\""`)[0], {
  kind: "choice",
  question: "mood",
  options: ['an"gry'],
  criteria: ['says "no"'],
});
// `&&` and `||` inside the criteria are text, not operators.
assert.deepEqual(collect(`decision_choice:"mood" == "angry":"shouts && throws || kicks"`)[0]!.criteria, [
  "shouts && throws || kicks",
]);

// Malformed criteria fall back to what the parser always did with that text.
assert.deepEqual(collect(`decision_choice:"mood" == "angry":`)[0]!.options, [], "no criteria: not a value");
assert.deepEqual(collect(`decision_choice:"mood" == "angry":'mixed'`)[0]!.options, [], "mixed quotes: not a value");
assert.deepEqual(collect(`decision_choice:"mood" == "angry"x"y"`)[0], {
  kind: "choice",
  question: "mood",
  options: ['angry"x"y'],
});
assert.deepEqual(collect(`decision_choice:"mood" == "angry":""`)[0], {
  kind: "choice",
  question: "mood",
  options: ["angry"],
});

// The answer and the comparison are the option alone.
const mood = `{{#if decision_choice:"mood" == "angry":"he shouts"}}A{{else if decision_choice:"mood" == "sad":"he cries"}}S{{else}}C{{/if}}`;
assert.equal(run(mood, { mood: "angry" }), "A");
assert.equal(run(mood, { mood: "sad" }), "S");
assert.equal(run(mood, { mood: "none of these" }), "C");
assert.equal(run(mood), "C", "no answer: every comparison is false");
assert.equal(run(`{{#if decision_choice:"mood" != "calm":"at ease"}}A{{else}}B{{/if}}`, { mood: "angry" }), "A");
assert.equal(run(`{{#if decision_choice:"mood" != "calm":"at ease"}}A{{else}}B{{/if}}`), "B");
assert.equal(run(`{{#if "angry":"he shouts" == decision_choice:"mood"}}A{{else}}B{{/if}}`, { mood: "angry" }), "A");
const weather = `{{#if decision_choice:"weather" == "rain":"water falls" || "snow":"flakes fall"}}WET{{else}}DRY{{/if}}`;
assert.equal(run(weather, { weather: "snow" }), "WET", "the short form compares each option");
assert.equal(run(weather, { weather: "sun" }), "DRY");
const group = `[\n{{char}}: {{#if decision_choice:"{{char}}'s mood" == "angry":"{{char}} shouts"}}A{{else}}C{{/if}}\n]`;
assert.equal(
  run(group, { "Kaelen's mood": "angry", "Alyssa's mood": "none of these" }),
  "[\nKaelen: A\n]\n[\nAlyssa: C\n]",
  "a group block compares the option for each character",
);
const perResponder = `{{#if decision_choice:"{{char}}'s mood" == "angry":"shouts"}}snaps{{else}}calm{{/if}}`;
const choiceCtx = { ...base, decisions: { choices: new Map([["Alyssa's mood", "angry"]]) } };
const deferred = resolveMacros(perResponder, choiceCtx as never, { deferCharacterMacros: "all", trimResult: false });
assert.equal(resolveDeferredCharacterMacros(deferred, profiles[1]!, choiceCtx as never), "snaps");
// A lorebook scan follows a settled branch the same way.
assert.equal(
  planDecisionStatements(`{{#if decision_choice:"mood" == "angry":"he shouts"}}A{{/if}}`, choiceCtx as never, {
    settledOnly: true,
  }).text,
  "",
);
assert.equal(
  planDecisionStatements(
    `{{#if decision_choice:"mood" == "angry":"he shouts"}}A{{/if}}`,
    { ...base, decisions: { choices: new Map([["mood", "angry"]]) } } as never,
    { settledOnly: true },
  ).text,
  "A",
);

// ── planning: criteria resolved, merged, and sent ─────────────────────────────

const plan = planPromptDecisions(
  [
    {
      texts: [
        `{{#if decision_choice:"mood" == "angry"}}a{{/if}}`,
        `{{#if decision_choice:"mood" == "angry":"{{user}} is shouted at"}}a{{/if}}`,
        `{{#if decision_choice:"mood" == "sad":"tears"}}b{{/if}}`,
        `{{#if decision_choice:"mood" == "Sad":"ignored, sad has criteria already"}}b{{/if}}`,
        `{{#if decision_choice:"mood" == "calm"}}c{{/if}}`,
        `{{#if decision_choice:"plain" == "one" || "two"}}d{{/if}}`,
      ],
      ctx: base as never,
    },
  ],
  32,
);
assert.deepEqual(
  plan.decisions.map((d) => [d.key, d.options, d.criteria]),
  [
    ["mood", ["angry", "sad", "calm"], ["Mira is shouted at", "tears", ""]],
    ["plain", ["one", "two"], undefined],
  ],
  "the first criteria written for an option count, with macros filled in; options without any carry none",
);
const perCharacter = planPromptDecisions(
  [{ texts: [`{{#if decision_choice:"{{char}}'s mood" == "angry":"{{char}} shouts"}}a{{/if}}`], ctx: base as never }],
  32,
);
assert.deepEqual(
  perCharacter.decisions.map((d) => [d.key, d.criteria]),
  [
    ["Kaelen's mood", ["Kaelen shouts"]],
    ["Alyssa's mood", ["Alyssa shouts"]],
  ],
  "criteria name the same character as their statement",
);

const asked: Array<Array<{ id: string; options?: string[]; criteria?: string[] }>> = [];
const backend = {
  maxStateTokens: 3500,
  calibration: { defaultThreshold: 0.5, questionShape: "text" as const },
  deferPreGeneration: false,
  ask: async () => null,
  askMixed: async (_state: unknown, questions: Array<{ id: string; options?: string[]; criteria?: string[] }>) => {
    asked.push(questions);
    return { answers: new Map(), choices: new Map(questions.map((q) => [q.id, q.options![0]!])) };
  },
};
const cache = new PromptDecisionTurnCache();
const messages = [{ role: "user", name: "Mira", content: "Hello" }];
const answered = await answerPromptDecisions({ plan, backend: backend as never, messages, cacheKey: "t", cache });
assert.equal(answered.choices!.get("mood"), "angry", "the answer is the option, never its criteria");
assert.deepEqual(
  asked[0]!.map((q) => [q.options, q.criteria]),
  [
    [
      ["angry", "sad", "calm"],
      ["Mira is shouted at", "tears", ""],
    ],
    [["one", "two"], undefined],
  ],
);
await answerPromptDecisions({ plan, backend: backend as never, messages, cacheKey: "t", cache });
assert.equal(asked.length, 1, "the same turn is not asked twice");
const edited = planPromptDecisions(
  [{ texts: [`{{#if decision_choice:"mood" == "angry":"he slams a door"}}a{{/if}}`], ctx: base as never }],
  32,
);
const reworded = planPromptDecisions(
  [{ texts: [`{{#if decision_choice:"mood" == "angry":"he shouts"}}a{{/if}}`], ctx: base as never }],
  32,
);
await answerPromptDecisions({ plan: edited, backend: backend as never, messages, cacheKey: "t2", cache });
await answerPromptDecisions({ plan: reworded, backend: backend as never, messages, cacheKey: "t2", cache });
assert.equal(asked.length, 3, "edited criteria ask again on the same turn");

// ── the Decision model's prompt ───────────────────────────────────────────────

const choiceQuestion = { id: "m", instructions: "mood", options: ["angry", "sad"], criteria: ["he shouts", ""] };
const inspection = { mode: "inspect", requests: [], results: [] } as {
  mode: "inspect";
  requests: Array<{ body: { questions: Record<string, { criteria?: Record<string, string> }> } }>;
  results: unknown[];
};
await askNoulQuestions({
  connection: { protocol: "system_one", endpoint: "http://127.0.0.1:9/v1/systemone", apiKey: "", model: "m" },
  state: {},
  questions: [choiceQuestion, { id: "o", instructions: "weather", options: ["rain"] }],
  inspection: inspection as never,
});
assert.deepEqual(
  inspection.requests[0]!.body.questions.m!.criteria,
  { angry: "he shouts", sad: "", "none of these": "None of the other options apply." },
  "System One: the criteria are the option's description",
);
assert.deepEqual(
  inspection.requests[0]!.body.questions.o!.criteria,
  { rain: "", "none of these": "None of the other options apply." },
  "System One: an option without criteria is sent as before",
);

const statements: string[] = [];
const chosen = await askChoicesAsStatements(
  async (_state, questions) => {
    statements.push(...questions.map((q) => q.instructions));
    return new Map(questions.map((q): [string, number] => [q.id, q.instructions.includes("angry") ? 0.9 : 0.1]));
  },
  {},
  [choiceQuestion],
  0.5,
);
assert.deepEqual(statements, ["mood: angry (he shouts)", "mood: sad"], "a chat model reads the criteria per option");
assert.equal(chosen.choices.get("m"), "angry");

console.log("decision choice criteria regression passed");
