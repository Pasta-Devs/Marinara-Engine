import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apiPath = resolve(root, "src/features/modes/game/api/game-api.ts");
const promptsPath = resolve(root, "src/engine/modes/game/prompts/gm-prompts.ts");

const api = readFileSync(apiPath, "utf8");
const prompts = readFileSync(promptsPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const upsertStart = api.indexOf("async upsertPartyCard(data:");
const upsertEnd = api.indexOf("async removePartyMember", upsertStart);
assert(upsertStart >= 0 && upsertEnd > upsertStart, "Could not locate upsertPartyCard body.");

const upsertBody = api.slice(upsertStart, upsertEnd);

assert(
  prompts.includes("export function buildPartyRecruitCardPrompt"),
  "Game GM prompts do not export buildPartyRecruitCardPrompt.",
);
assert(
  upsertBody.includes("buildPartyRecruitCardPrompt") && upsertBody.includes("llmJson"),
  "upsertPartyCard does not route through the LLM party-card prompt.",
);
assert(
  upsertBody.includes("purpose:") && upsertBody.includes('"regenerate"') && upsertBody.includes('"recruit"'),
  "upsertPartyCard does not distinguish recruit and regenerate prompt purposes.",
);

console.log("Issue #2134 proof passed: party card upsert uses the LLM recruit/regenerate prompt path.");
