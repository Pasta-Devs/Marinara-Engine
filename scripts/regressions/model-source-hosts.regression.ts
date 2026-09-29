import assert from "node:assert/strict";
import { inferImageSource, inferVideoSource } from "../../packages/shared/src/constants/model-lists.js";

const imageHosts = [
  ["arliai.com", "arli"],
  ["openrouter.ai", "openrouter"],
  ["x.ai", "xai"],
  ["venice.ai", "venice"],
  ["api.z.ai", "zai"],
  ["atlascloud.ai", "atlas"],
  ["stability.ai", "stability"],
  ["novelai.net", "novelai"],
  ["pollinations.ai", "pollinations"],
  ["together.xyz", "togetherai"],
  ["stablehorde.net", "horde"],
  ["blockentropy.ai", "blockentropy"],
  ["runpod.ai", "runpod_comfyui"],
  ["nano-gpt.com", "nanogpt"],
] as const;

const videoHosts = [
  ["atlascloud.ai", "atlas"],
  ["seedance2.ai", "seedance"],
  ["openrouter.ai", "openrouter"],
  ["x.ai", "xai"],
  ["nano-gpt.com", "nanogpt"],
] as const;

for (const [infer, hosts, fallback] of [
  [inferImageSource, imageHosts, "openai"],
  [inferVideoSource, videoHosts, "gemini_omni"],
] as const) {
  for (const [host, expected] of hosts) {
    for (const valid of [`https://${host}/v1`, `https://api.${host}/v1`, `https://${host.toUpperCase()}./v1`]) {
      assert.equal(infer("", valid), expected, valid);
    }
    for (const forged of [
      `https://${host}.example/v1`,
      `https://not-${host}/v1`,
      `https://example.test/${host}/v1`,
      `https://example.test/?provider=${host}`,
      `https://${host}@example.test/v1`,
      `not a URL ${host}`,
    ]) {
      assert.equal(infer("", forged), fallback, forged);
    }
  }
}

assert.equal(inferImageSource("flux", "https://api.openai.com/v1"), "openai");
assert.equal(inferImageSource("flux", "https://example.test/openai.com"), "togetherai");
assert.equal(inferImageSource("arli", "http://localhost:1234"), "arli");
assert.equal(inferImageSource("", "http://127.0.0.1:7801"), "swarmui");
assert.equal(inferImageSource("", "http://localhost:8188"), "comfyui");
assert.equal(inferVideoSource("seedance-2", ""), "seedance");
console.log("Image/video provider inference accepts real hosts and rejects misleading URLs.");
