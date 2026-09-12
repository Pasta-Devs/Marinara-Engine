import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchCustomAgentActivation } from "../../packages/server/src/routes/generate/agent-activation.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const beforeResponse = [{ content: "Please continue normally." }];
const afterResponse = [...beforeResponse, { content: "The assistant mentions cobalt." }];

assert.equal(
  matchCustomAgentActivation({ activationKeywords: ["cobalt"], activationScanDepth: 1 }, beforeResponse).matched,
  false,
);
assert.equal(
  matchCustomAgentActivation({ activationKeywords: ["cobalt"], activationScanDepth: 1 }, afterResponse).matched,
  true,
  "Scan depth 1 must inspect the newly completed assistant response for post-processing agents",
);
assert.equal(
  matchCustomAgentActivation({ activationKeywords: ["continue"], activationScanDepth: 2 }, afterResponse).matched,
  true,
  "Larger scan depths must retain the preceding user message",
);

const generateRouteSource = readFileSync(
  join(repositoryRoot, "packages/server/src/routes/generate.routes.ts"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  generateRouteSource,
  /if \(agent\.phase !== "post_processing"\)[\s\S]{0,240}matchCustomAgentActivation\(agent\.settings, chatMessages\)/u,
  "Post-processing activation must not be decided before the assistant response exists",
);
assert.match(
  generateRouteSource,
  /const continuedTargetIndex = input\.continueMessageId[\s\S]{0,500}index === continuedTargetIndex \? \{ \.\.\.message, content: completedResponse \} : message[\s\S]{0,220}: \[\.\.\.chatMessages, \{ role: "assistant", content: completedResponse \}\][\s\S]{0,600}matchCustomAgentActivation\(agent\.settings, postActivationMessages\)/u,
  "Post-processing activation must include the completed assistant response",
);
assert.match(
  generateRouteSource,
  /const activatedTextRewriteRunAgents = textRewriteRunAgents\.filter\(\s*\(agent\) => !inactivePostProcessingAgentIds\.has\(agent\.id\),\s*\);/u,
  "Text-rewrite agents must honor the same completed-response activation check",
);
const postGenerationStart = generateRouteSource.indexOf("if (hasPostWork &&");
assert.ok(postGenerationStart >= 0, "The post-generation entrypoint must exist");
const postGenerationSource = generateRouteSource.slice(
  postGenerationStart,
  generateRouteSource.indexOf("// ── Text rewrite/editing agents"),
);
assert.match(postGenerationSource, /content: completedResponse,/u, "Lorebook triggers must receive the completed response");
assert.match(
  postGenerationSource,
  /const postAgentContext:[\s\S]{0,220}mainResponse: completedResponse/u,
  "Post-agent context must receive the completed response",
);
assert.match(
  postGenerationSource,
  /pipeline\.postGenerate\(completedResponse/u,
  "The post-generation pipeline must receive the completed response",
);
assert.match(
  postGenerationSource,
  /phaseRetryContext[\s\S]{0,240}mainResponse: completedResponse/u,
  "Post-processing retries must receive the completed response",
);
assert.match(
  generateRouteSource,
  /const hasPostWork =\s*!recoveredAlreadyAppliedOwnerTurn\s*&&\s*\(hasPostProcessingAgents\s*\|\|\s*parallelResults\.length > 0\s*\|\|\s*holdForTextRewrite\s*\|\|\s*roleplayMediaRequests\.length > 0\);/u,
  "Held responses and explicit media commands must keep post-work reachable when every custom rewrite agent is inactive",
);
assert.match(
  generateRouteSource,
  /if \(activatedTextRewriteRunAgents\.length > 0[\s\S]{0,7500}\n\s*\}\n\s*if \(holdForTextRewrite && !textRewriteApplied/u,
  "The held-response release must remain outside the active rewrite-agent branch",
);

console.info("Agent activation regression passed.");
