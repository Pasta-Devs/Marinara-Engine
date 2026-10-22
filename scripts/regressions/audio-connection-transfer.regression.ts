import assert from "node:assert/strict";
import {
  createConnectionExportEnvelope,
  normalizeImportedConnectionEntry,
} from "../../packages/client/src/lib/connection-transfer.js";
import { createConnectionSchema } from "../../packages/shared/src/schemas/connection.schema.js";

const source = {
  name: "Compatible audio",
  provider: "audio",
  audioSource: "openai",
  baseUrl: "https://audio.example.test/v1",
  apiKey: "private-key-must-not-travel",
  audioMusic: true,
  audioSoundEffects: true,
  audioMusicEndpoint: "chat/completions",
  audioSoundEffectsEndpoint: "audio/generations",
  audioGenerationFormat: "chat_completions",
  defaultForAgents: true,
};
const exported = createConnectionExportEnvelope([source]);
assert.ok(!JSON.stringify(exported).includes(source.apiKey));
const imported = normalizeImportedConnectionEntry(exported.connections[0]);
assert.ok(imported);
for (const field of ["audioMusicEndpoint", "audioSoundEffectsEndpoint", "audioGenerationFormat"] as const) {
  assert.equal(imported.connection[field], source[field], `${field} survives the export/import round trip`);
}
assert.equal(imported.connection.apiKey, "", "Imports never inherit credentials");
assert.equal(imported.connection.defaultForAgents, false, "Imports never activate themselves as the default");
assert.equal(createConnectionSchema.parse(imported.connection).audioGenerationFormat, "chat_completions");

const legacy = normalizeImportedConnectionEntry({ name: "Legacy ElevenLabs", provider: "audio" });
assert.ok(legacy);
assert.equal(legacy.connection.audioMusicEndpoint, null);
assert.equal(legacy.connection.audioSoundEffectsEndpoint, null);
assert.equal(legacy.connection.audioGenerationFormat, "binary");

for (const value of [
  "https://other.example.test/generate",
  "//other.example.test/generate",
  "audio/generate?api_key=secret",
  "audio/generate#fragment",
  "audio\\generate",
  "a".repeat(501),
  {},
  ["audio/generate"],
]) {
  const unsafe = normalizeImportedConnectionEntry({
    ...source,
    audioMusicEndpoint: value,
    audioSoundEffectsEndpoint: value,
    audioGenerationFormat: "unknown",
  });
  assert.ok(unsafe);
  assert.equal(unsafe.connection.audioMusicEndpoint, null);
  assert.equal(unsafe.connection.audioSoundEffectsEndpoint, null);
  assert.equal(unsafe.connection.audioGenerationFormat, "binary");
  assert.doesNotThrow(() => createConnectionSchema.parse(unsafe.connection));
}
const normalized = normalizeImportedConnectionEntry({
  ...source,
  audioMusicEndpoint: " /v1/chat/completions ",
  audioSoundEffectsEndpoint: "  ",
  audioGenerationFormat: "binary",
});
assert.equal(normalized?.connection.audioMusicEndpoint, "/v1/chat/completions");
assert.equal(normalized?.connection.audioSoundEffectsEndpoint, null);
const otherProvider = createConnectionExportEnvelope([{ ...source, provider: "openai" }]).connections[0]!;
assert.equal(otherProvider.audioMusicEndpoint, null);
assert.equal(otherProvider.audioSoundEffectsEndpoint, null);
assert.equal(otherProvider.audioGenerationFormat, "binary");
console.info(
  "Compatible audio endpoint paths and response format survive safe connection transfer; legacy defaults remain unchanged.",
);
