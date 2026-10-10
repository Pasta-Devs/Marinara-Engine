import assert from "node:assert/strict";

import { classifyQuickAnswerError } from "../../../packages/server/src/services/professor-mari/quick-answer-error.js";

// Slice 84: a failed quick answer names its kind, so the omnibar says what to do. Only auth and a missing
// model get "Choose a model"; a provider 500 is not an auth problem.
assert.equal(classifyQuickAnswerError("Set up a language connection before using Quick Prof. Mari."), "missing-model");
assert.equal(classifyQuickAnswerError("Custom OpenAI-compatible endpoint error 401: invalid api key"), "auth");
assert.equal(
  classifyQuickAnswerError("Custom OpenAI-compatible endpoint error 500: Provider returned 500"),
  "provider",
);
assert.equal(classifyQuickAnswerError("Provider returned 500: upstream timeout"), "provider");
assert.equal(classifyQuickAnswerError("connect ECONNREFUSED 127.0.0.1:8080"), "network");
assert.equal(classifyQuickAnswerError("fetch failed"), "network");
assert.equal(classifyQuickAnswerError("Professor Mari sent no words for this quick answer."), "empty");
assert.equal(classifyQuickAnswerError("something nobody expected"), "provider");

console.log("Quick answer error kind regression checks passed.");
