// An agent that cannot run without a kind of Model says so: a package manifest declares it, Illustrator and
// image-triggering custom agents are inferred, and every other agent needs nothing extra.
import assert from "node:assert/strict";

const { agentRequiredConnection, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

const manifest = { phase: "post_processing", enabledByDefault: true, category: "utility", description: "Fixture" } as const;
replaceBuiltInAgentDefinitions([
  { ...manifest, id: "film-maker", name: "Film maker", requiresConnection: "video" },
  { ...manifest, id: "illustrator", name: "Illustrator" },
  { ...manifest, id: "echo-chamber", name: "Echo Chamber" },
]);

assert.equal(agentRequiredConnection("film-maker"), "video", "a declared requirement wins");
assert.equal(agentRequiredConnection("illustrator"), "image", "Illustrator draws before its manifest says so");
assert.equal(agentRequiredConnection("echo-chamber"), null, "a plain built-in needs nothing extra");
assert.equal(
  agentRequiredConnection("my-artist", { customCapabilities: { trigger_image_generation: true } }),
  "image",
  "a custom agent allowed to trigger image generation needs an image model",
);
assert.equal(
  agentRequiredConnection("my-writer", { customCapabilities: { edit_lorebooks: true } }),
  null,
  "a custom agent without image permission needs nothing extra",
);

console.log("agent-required-connection: ok");
