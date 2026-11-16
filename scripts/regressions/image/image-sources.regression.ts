// Which image or video source a connection's URL or model means, and that each source is listed.
import assert from "node:assert/strict";
import { imageSourceToDefaultsService } from "../../../packages/shared/src/constants/image-generation-defaults.js";
import {
  IMAGE_GENERATION_SOURCES,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
} from "../../../packages/shared/src/constants/model-lists.js";

assert.equal(inferImageSource("", "https://api.z.ai/api/paas/v4"), "zai");
assert.ok(IMAGE_GENERATION_SOURCES.some((source) => source.id === "zai"));
assert.equal(inferImageSource("flux-model", "https://api.arliai.com/v1"), "arli");
assert.ok(IMAGE_GENERATION_SOURCES.some((source) => source.id === "arli"));
assert.equal(imageSourceToDefaultsService("arli"), "automatic1111");
assert.equal(inferImageSource("", "http://127.0.0.1:7801"), "swarmui");
assert.ok(IMAGE_GENERATION_SOURCES.some((source) => source.id === "swarmui"));
assert.equal(imageSourceToDefaultsService("swarmui"), "comfyui");
assert.equal(inferVideoSource("", "http://127.0.0.1:7801"), "swarmui");
assert.ok(VIDEO_GENERATION_SOURCES.some((source) => source.id === "swarmui"));
assert.equal(inferImageSource("", "https://api.atlascloud.ai/api/v1"), "atlas");
assert.equal(inferVideoSource("", "https://api.atlascloud.ai/api/v1"), "atlas");
