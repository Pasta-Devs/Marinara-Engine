// Model list and connection test URLs: Google's paged models URL, the catalog URL a connection test fetches, and
// normalizing a Google base URL, plus the ComfyUI model names read from its loader info.
import assert from "node:assert/strict";
import {
  buildConnectionTestCatalogUrl,
  buildGoogleModelsPageUrl,
} from "../../../packages/server/src/routes/connections.routes.js";
import { normalizeGoogleGenerativeLanguageBaseUrl } from "../../../packages/server/src/services/llm/providers/google.provider.js";

const googleModelsPageUrl = buildGoogleModelsPageUrl(
  "https://gemini-proxy.example.test/v1beta",
  "/models",
  "next page/token",
);
assert.equal(
  buildConnectionTestCatalogUrl("https://api.elevenlabs.io/", "audio", "/models", "elevenlabs"),
  "https://api.elevenlabs.io/v1/models",
  "ElevenLabs audio connection tests must normalize a trailing slash and use the versioned models endpoint",
);
assert.equal(
  buildConnectionTestCatalogUrl("https://api.elevenlabs.io/v1/", "audio", "/models", "elevenlabs"),
  "https://api.elevenlabs.io/v1/models",
  "An explicitly versioned ElevenLabs URL with a trailing slash must not duplicate the API version",
);
assert.equal(
  buildConnectionTestCatalogUrl("https://api.openai.com/v1", "audio", "/models", "openai"),
  "https://api.openai.com/v1/models",
  "Other audio sources keep their configured models endpoint",
);
assert.equal(
  normalizeGoogleGenerativeLanguageBaseUrl("https://generativelanguage.googleapis.com/v1"),
  "https://generativelanguage.googleapis.com/v1beta",
  "Legacy Gemini v1 connection URLs must use the supported v1beta endpoint",
);
assert.equal(
  normalizeGoogleGenerativeLanguageBaseUrl("https://generativelanguage.googleapis.com"),
  "https://generativelanguage.googleapis.com/v1beta",
);
assert.equal(
  normalizeGoogleGenerativeLanguageBaseUrl("https://generativelanguage.googleapis.com/v1beta"),
  "https://generativelanguage.googleapis.com/v1beta",
);
assert.equal(
  normalizeGoogleGenerativeLanguageBaseUrl("https://generativelanguage.googleapis.com/v1?key=legacy#models"),
  "https://generativelanguage.googleapis.com/v1beta",
  "Gemini base URL query and fragment text must not become part of appended model paths",
);
assert.equal(
  googleModelsPageUrl,
  "https://gemini-proxy.example.test/v1beta/models?pageSize=1000&pageToken=next%20page%2Ftoken",
);
assert.equal(
  new URL(googleModelsPageUrl).searchParams.has("key"),
  false,
  "Gemini API keys must stay out of model URLs",
);

// Issue #3993 — ComfyUI model fetch must list the DiffusionModels (UNETLoader)
// folder and keep missing loader metadata distinguishable from an empty list.
{
  const { parseComfyLoaderModelNames } = await import("../../../packages/server/src/routes/connections.routes.js");
  const checkpointInfo = {
    CheckpointLoaderSimple: { input: { required: { ckpt_name: [["sd15.safetensors", "shared.safetensors"]] } } },
  };
  const unetInfo = {
    UNETLoader: {
      input: { required: { unet_name: [["anima.safetensors", "zimage.safetensors", "shared.safetensors"]] } },
    },
  };
  assert.deepEqual(parseComfyLoaderModelNames(checkpointInfo, "CheckpointLoaderSimple", "ckpt_name"), [
    "sd15.safetensors",
    "shared.safetensors",
  ]);
  assert.deepEqual(parseComfyLoaderModelNames(unetInfo, "UNETLoader", "unet_name"), [
    "anima.safetensors",
    "zimage.safetensors",
    "shared.safetensors",
  ]);
  assert.deepEqual(
    parseComfyLoaderModelNames(
      { CheckpointLoaderSimple: { input: { required: { ckpt_name: [[]] } } } },
      "CheckpointLoaderSimple",
      "ckpt_name",
    ),
    [],
    "A genuinely empty checkpoint list must stay a list, not a missing-schema signal",
  );
  assert.equal(
    parseComfyLoaderModelNames({}, "CheckpointLoaderSimple", "ckpt_name"),
    null,
    "Missing checkpoint schema must be reported as null so the route can 502",
  );
  assert.equal(
    parseComfyLoaderModelNames({}, "UNETLoader", "unet_name"),
    null,
    "A ComfyUI build without UNETLoader must be detectable so the route can degrade to checkpoints",
  );
  assert.equal(
    parseComfyLoaderModelNames(
      { CheckpointLoaderSimple: { input: { required: { ckpt_name: ["not-an-array"] } } } },
      "CheckpointLoaderSimple",
      "ckpt_name",
    ),
    null,
    "Malformed options must not be mistaken for an empty model list",
  );
  const checkpointNames = parseComfyLoaderModelNames(checkpointInfo, "CheckpointLoaderSimple", "ckpt_name") ?? [];
  const unetNames = parseComfyLoaderModelNames(unetInfo, "UNETLoader", "unet_name") ?? [];
  assert.deepEqual(
    [...new Set([...checkpointNames, ...unetNames])],
    ["sd15.safetensors", "shared.safetensors", "anima.safetensors", "zimage.safetensors"],
    "Overlapping names across the two folders must be listed once",
  );
}
