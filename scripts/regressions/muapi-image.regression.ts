import assert from "node:assert/strict";
import { buildMuApiUrl, parseMuApiModels } from "../../packages/server/src/services/image/muapi-image.js";
import { inferImageSource } from "../../packages/shared/src/constants/model-lists.js";

assert.equal(buildMuApiUrl("https://api.muapi.ai/v1", "models"), "https://api.muapi.ai/v1/models");
assert.equal(buildMuApiUrl("https://api.muapi.ai", "images/generations"), "https://api.muapi.ai/v1/images/generations");
assert.equal(buildMuApiUrl("https://api.muapi.ai/v1/images/generations", "models"), "https://api.muapi.ai/v1/models");
assert.equal(inferImageSource("muapi", "https://example.test/v1"), "muapi");
assert.equal(inferImageSource("flux-schnell", "https://api.muapi.ai/v1"), "muapi");

assert.deepEqual(
  parseMuApiModels({
    data: [
      { id: "flux-schnell", name: "FLUX Schnell" },
      { id: "flux-schnell", name: "duplicate" },
      { id: "seedream-v4" },
      { object: "model" },
    ],
  }),
  [
    { id: "flux-schnell", name: "FLUX Schnell" },
    { id: "seedream-v4", name: "seedream-v4" },
  ],
);
assert.deepEqual(parseMuApiModels({ data: [] }), []);
assert.equal(parseMuApiModels({ models: [] }), null);

process.stdout.write("MuAPI image regressions passed.\n");
