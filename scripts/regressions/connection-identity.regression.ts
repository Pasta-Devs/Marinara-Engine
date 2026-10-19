import assert from "node:assert/strict";
import { getConnectionIdentity } from "../../packages/client/src/lib/connection-identity.js";

const server = "http://10.0.0.16:9000/";
const comfy = getConnectionIdentity(
  { name: "ComfyUI · 10.0.0.16:9000", provider: "image_generation", baseUrl: server },
  [
    { provider: "image_generation", imageGenerationSource: "comfyui" },
    { provider: "video_generation", videoGenerationSource: "comfyui" },
  ],
);
assert.deepEqual(comfy, { name: "ComfyUI", accountLabel: null, endpoint: "10.0.0.16:9000", service: "comfyui" });
assert.equal(
  getConnectionIdentity({ name: "My studio", provider: "image_generation", baseUrl: server }, [
    { provider: "image_generation", imageGenerationSource: "comfyui" },
  ]).accountLabel,
  "My studio",
  "authored names remain distinct from the service",
);
const mixed = getConnectionIdentity(
  { name: "Work account", provider: "openai", baseUrl: "https://api.openai.com/v1" },
  [
    { provider: "image_generation", imageGenerationSource: "openai" },
    { provider: "openai", model: "gpt-5.5" },
  ],
);
assert.equal(mixed.name, "OpenAI", "a media model does not rename a shared chat connection");
assert.equal(mixed.service, null);
assert.equal(mixed.accountLabel, "Work account");
const proxy = getConnectionIdentity({ name: "Bifrost Proxy", provider: "custom", baseUrl: "https://llm.example/v1" }, [
  { provider: "custom", model: "nanogpt/vendor/model" },
  { provider: "image_generation", imageGenerationSource: "openai" },
]);
assert.equal(proxy.name, "Bifrost Proxy");
assert.equal(proxy.accountLabel, null, "custom connection names are already the heading");
assert.equal(proxy.service, null);
assert.equal(proxy.endpoint, "llm.example");
assert.equal(
  getConnectionIdentity({ name: "NanoGPT · …55b5", provider: "nanogpt", baseUrl: "https://nano-gpt.com/api/v1" }, [
    { provider: "nanogpt", model: "test" },
  ]).accountLabel,
  "…55b5",
  "automatic key tails identify accounts without repeating their provider",
);
const audio = getConnectionIdentity({ name: "Voice rig", provider: "audio" }, [
  { provider: "audio", audioSource: "pockettts", imageGenerationSource: "openai" },
]);
assert.equal(audio.name, "PocketTTS", "stale fields of another model kind cannot rename the service");
assert.equal(audio.service, "pockettts");
assert.equal(
  getConnectionIdentity({ name: "Voice", provider: "audio" }, [{ provider: "audio", audioSource: "openai" }]).name,
  "OpenAI-compatible",
  "audio is not DALL-E",
);
console.log("connection-identity: shared chat/media/custom identities passed");
