import assert from "node:assert/strict";

// The Own address field suggests the path a per-vendor proxy uses for the Model's family: first what the account's
// other Models of that family use, then the usual names when the Connection's own path is one of them.
const { suggestModelAddressPath } = await import("../../../packages/client/src/lib/model-address-suggest.js");

const base = "https://img-ala.trycloudflare.com/proxy/google-ai";
assert.equal(suggestModelAddressPath("gpt-6.1-sol", base), "/proxy/openai");
assert.equal(suggestModelAddressPath("glm-5.3", base), "/proxy/zai");
assert.equal(suggestModelAddressPath("claude-opus-5-5", base), "/proxy/anthropic");
assert.equal(suggestModelAddressPath("kimi-k3", base), "/proxy/moonshot-ai");
// The Connection's own path already fits: nothing to suggest.
assert.equal(suggestModelAddressPath("models/gemini-4-argon", base), null);
// An unknown family, or a server that is not laid out by vendor, gets no guess.
assert.equal(suggestModelAddressPath("misc-model", base), null);
assert.equal(suggestModelAddressPath("gpt-6.1-sol", "https://api.example.com/v1"), null);
// What the account already does wins over the usual names.
assert.equal(
  suggestModelAddressPath("gpt-6.2", base, [{ model: "gpt-6.1-sol", modelBaseUrl: "/proxy/oai-pro" }]),
  "/proxy/oai-pro",
);
assert.equal(
  suggestModelAddressPath("claude-sonnet-5", base, [
    { model: "claude-opus-5", modelBaseUrl: "https://img-ala.trycloudflare.com/proxy/aws/claude" },
  ]),
  "/proxy/aws/claude",
);
// A sibling of the family on the Connection's own path: no own address needed.
assert.equal(suggestModelAddressPath("gemini-3-pro", base, [{ model: "gemini-2.5-pro", modelBaseUrl: "" }]), null);

console.log("model-address-suggest regression passed");
