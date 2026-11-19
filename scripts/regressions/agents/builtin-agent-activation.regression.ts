/**
 * Built-in agents take the same activation keywords and question as custom agents (#9405).
 *
 * The gate is opt-in: a built-in with no keywords runs as before. Agents the Engine already
 * gates itself (host and feature agents, Illustrator, Knowledge Retrieval / Router) stay out.
 * When paired built-in rewriters run as one merged request, the merge happens after the gate,
 * so a gated-off Prose Guardian leaves Continuity's rewrite running without its own instructions.
 */
import assert from "node:assert/strict";

import {
  agentSupportsActivationGate,
  replaceBuiltInAgentDefinitions,
  type BuiltInAgentManifest,
} from "../../../packages/shared/src/types/agent.js";
import type { ResolvedAgent } from "../../../packages/server/src/services/agents/agent-pipeline.js";
import { matchCustomAgentActivation } from "../../../packages/server/src/routes/generate/agent-activation.js";
import { activeTextRewriteRunAgents } from "../../../packages/server/src/services/generation/prose-guardian-settings.js";

const manifest = (
  id: string,
  phase: BuiltInAgentManifest["phase"],
  execution?: BuiltInAgentManifest["execution"],
): BuiltInAgentManifest => ({
  id,
  name: id,
  description: id,
  phase,
  enabledByDefault: false,
  category: "writer",
  ...(execution ? { execution } : {}),
});

replaceBuiltInAgentDefinitions([
  manifest("prose-guardian", "post_processing"),
  manifest("continuity", "post_processing"),
  manifest("world-state", "post_processing", "pipeline"),
  manifest("storyboard", "post_processing", "host"),
  manifest("music-dj", "parallel", "feature"),
  manifest("illustrator", "post_processing"),
  manifest("knowledge-router", "pre_generation"),
]);

try {
  for (const type of ["prose-guardian", "continuity", "world-state", "custom-my-agent"]) {
    assert.equal(agentSupportsActivationGate(type), true, `${type} takes the activation gate`);
  }
  for (const type of ["storyboard", "music-dj", "illustrator", "knowledge-router", "knowledge-retrieval"]) {
    assert.equal(agentSupportsActivationGate(type), false, `${type} keeps its own gating`);
  }

  // The gate reads plain settings, so a built-in's saved keywords behave like a custom agent's.
  const guardianSettings = { bannedWords: "ozone", activationKeywords: ["ozone", "Elara"], activationScanDepth: 1 };
  const clean = matchCustomAgentActivation(guardianSettings, [
    { content: "The air smells of ozone." },
    { content: "Rain falls on the square." },
  ]);
  assert.equal(clean.configured, true);
  assert.equal(clean.matched, false, "scan depth 1 only reads the newest message");
  const hit = matchCustomAgentActivation(guardianSettings, [{ content: "A sharp tang of OZONE hangs there." }]);
  assert.deepEqual(hit.matchedKeywords, ["ozone"], "case-insensitive substring match");
  assert.equal(matchCustomAgentActivation({}, [{ content: "anything" }]).configured, false, "empty stays off");

  const agent = (type: string): ResolvedAgent => ({
    id: `cfg-${type}`,
    type,
    name: type,
    phase: "post_processing",
    promptTemplate: `${type.toUpperCase()}_INSTRUCTIONS`,
    connectionId: "fixture",
    settings: { resultType: "text_rewrite" },
    isCustomAgent: false,
    provider: null as unknown as ResolvedAgent["provider"],
    model: "fixture",
  });
  const rewriters = [agent("prose-guardian"), agent("continuity")];

  const bothActive = activeTextRewriteRunAgents(rewriters, new Set());
  assert.equal(bothActive.length, 1, "active pair still shares one request");
  assert.match(bothActive[0]!.promptTemplate, /PROSE-GUARDIAN_INSTRUCTIONS/);
  assert.match(bothActive[0]!.promptTemplate, /CONTINUITY_INSTRUCTIONS/);

  const guardianGated = activeTextRewriteRunAgents(rewriters, new Set(["cfg-prose-guardian"]));
  assert.deepEqual(
    guardianGated.map((run) => run.id),
    ["cfg-continuity"],
    "the partner runs alone, under its own id",
  );
  assert.doesNotMatch(guardianGated[0]!.promptTemplate, /PROSE-GUARDIAN_INSTRUCTIONS/);

  assert.deepEqual(
    activeTextRewriteRunAgents(rewriters, new Set(["cfg-prose-guardian", "cfg-continuity"])),
    [],
    "both gated: no rewrite run, so the reply is released at once",
  );
} finally {
  replaceBuiltInAgentDefinitions([]);
}

console.log("builtin-agent-activation regression passed");
