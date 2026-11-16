// Model list and connection test URLs: Google's paged models URL, the catalog URL a connection test fetches, and
// normalizing a Google base URL.
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
