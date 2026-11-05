import assert from "node:assert/strict";
import {
  filterAudioGenerationConnections,
  filterLanguageGenerationConnections,
  filterTTSConnections,
  matchesAudioGenerationConnectionId,
} from "../../packages/client/src/lib/connection-filters.js";
import {
  createConnectionExportEnvelope,
  normalizeImportedConnectionEntry,
} from "../../packages/client/src/lib/connection-transfer.js";
import { buildGameSetupShareFile, resolveGameSetupImport } from "../../packages/client/src/lib/game-setup-share.js";
import { createConnectionSchema } from "../../packages/shared/src/schemas/connection.schema.js";
import { audioConnectionSupportsGeneration, type GameSetupConfig } from "../../packages/shared/dist/index.js";

const rows = [
  {
    id: "speech",
    name: "Character voices",
    provider: "audio",
    audioSource: "elevenlabs",
    audioMusic: true,
    audioSoundEffects: true,
  },
  {
    id: "music",
    name: "Scene audio",
    provider: "audio_generation",
    audioGenerationSource: "elevenlabs",
    audioGenerationLegacyConnectionId: "speech",
    audioMusic: "true",
    audioSoundEffects: true,
  },
  { id: "quarantined", name: "Review this import", provider: "audio_generation", profileImportReviewRequired: "true" },
  { id: "chat", name: "Dialogue", provider: "custom" },
];
assert.deepEqual(
  filterTTSConnections(rows).map((row) => row.id),
  ["speech"],
);
assert.deepEqual(
  filterAudioGenerationConnections(rows).map((row) => row.id),
  ["music"],
);
assert.deepEqual(
  filterLanguageGenerationConnections(rows).map((row) => row.id),
  ["chat"],
);
assert.equal(matchesAudioGenerationConnectionId(rows[1]!, "music"), true);
assert.equal(matchesAudioGenerationConnectionId(rows[1]!, "speech"), true);
assert.equal(matchesAudioGenerationConnectionId(rows[1]!, "missing"), false);
assert.equal(matchesAudioGenerationConnectionId({}, undefined), false);
assert.equal(matchesAudioGenerationConnectionId({ id: "" }, ""), false);
assert.equal(audioConnectionSupportsGeneration(rows[1]!, "music"), true);
assert.equal(
  audioConnectionSupportsGeneration({ audioGenerationSource: "custom", audioSoundEffects: true }, "sfx"),
  false,
);

for (const audioGenerationSource of ["elevenlabs", "sunoapi", "custom"] as const) {
  const source = {
    ...rows[1]!,
    audioGenerationSource,
    baseUrl: "https://audio.example.test/v1",
    model: "music-model",
    audioGenerationCallbackUrl: "https://callback.example.test/completed",
    audioSoundEffectsModel: "effect-model",
    audioMusicEndpoint: "audio/music",
    audioSoundEffectsEndpoint: "chat/completions",
    audioGenerationFormat: "chat_completions",
    apiKey: "private-do-not-export",
    defaultForAgents: true,
  };
  const exported = createConnectionExportEnvelope([source]).connections[0]!;
  assert.ok(!JSON.stringify(exported).includes(source.apiKey));
  assert.equal("audioGenerationLegacyConnectionId" in exported, false, "Migration provenance is install-owned");
  assert.equal(exported.audioSource, null, "Music/SFX exports do not masquerade as speech");
  const imported = normalizeImportedConnectionEntry(exported);
  assert.ok(imported);
  for (const key of [
    "audioGenerationSource",
    "audioGenerationCallbackUrl",
    "audioSoundEffectsModel",
    "audioMusicEndpoint",
    "audioSoundEffectsEndpoint",
    "audioGenerationFormat",
  ] as const) {
    assert.equal(imported.connection[key], source[key], `${audioGenerationSource}: ${key} round trip`);
  }
  assert.equal(imported.connection.apiKey, "");
  assert.equal(imported.connection.defaultForAgents, false, "An import cannot silently become the category default");
  assert.equal(imported.connection.audioVoice, null);
  assert.doesNotThrow(() => createConnectionSchema.parse(imported.connection));
}
for (const audioGenerationSource of [null, undefined]) {
  const defaultSourceRow = createConnectionSchema.parse({
    name: "Default ElevenLabs service",
    provider: "audio_generation",
    audioGenerationSource,
    audioMusic: true,
    model: "music_v2_5",
  });
  const exported = createConnectionExportEnvelope([defaultSourceRow]).connections[0]!;
  assert.equal(exported.audioGenerationSource, "elevenlabs", "Nullish stored source matches the runtime default");
  const imported = normalizeImportedConnectionEntry(exported);
  assert.ok(imported, "A valid null-source row must survive export/import");
  assert.equal(imported.connection.audioGenerationSource, "elevenlabs");
  assert.equal(imported.connection.audioMusic, true);
  assert.doesNotThrow(() => createConnectionSchema.parse(imported.connection));
}
// Profile imports preserve raw rows, including blank source strings that ordinary creates reject.
for (const audioGenerationSource of ["", "  \t  "]) {
  const stored = {
    ...rows[1]!,
    audioGenerationSource,
    profileImportReviewRequired: "true",
  };
  assert.equal(createConnectionSchema.shape.audioGenerationSource.safeParse(audioGenerationSource).success, false);
  const exported = createConnectionExportEnvelope([stored]).connections[0]!;
  assert.equal(exported.audioGenerationSource, "elevenlabs", "Blank restored sources use the absent-source default");
  const imported = normalizeImportedConnectionEntry(exported);
  assert.ok(imported, "A blank-source profile row must survive connection export/import");
  assert.equal(imported.connection.audioGenerationSource, "elevenlabs");
  assert.equal(imported.connection.audioMusic, true);
  assert.equal(imported.connection.defaultForAgents, false);
  assert.doesNotThrow(() => createConnectionSchema.parse(imported.connection));
}
assert.equal(
  normalizeImportedConnectionEntry(
    createConnectionExportEnvelope([
      { name: "Unknown exported service", provider: "audio_generation", audioGenerationSource: "other" },
    ]).connections[0],
  ),
  null,
  "An unknown nonempty source must not become ElevenLabs during export",
);
assert.equal(
  normalizeImportedConnectionEntry({
    name: "Unknown service",
    provider: "audio_generation",
    audioGenerationSource: "other",
  }),
  null,
);
const legacy = normalizeImportedConnectionEntry({
  ...rows[0]!,
  audioVoice: "voice-kept",
  audioMusicEndpoint: "audio/music",
});
assert.ok(legacy);
assert.equal(legacy.connection.audioVoice, "voice-kept");
assert.equal(legacy.connection.audioSource, "elevenlabs");
assert.equal(legacy.connection.audioGenerationSource, null);
assert.equal(legacy.connection.audioMusic, true, "Legacy settings remain available to the host migration");
const unsafe = normalizeImportedConnectionEntry({
  name: "Unsafe endpoint",
  provider: "audio_generation",
  audioGenerationSource: "custom",
  audioSoundEffects: true,
  audioSoundEffectsEndpoint: "https://other.example.test/audio?key=secret",
});
assert.ok(unsafe);
assert.equal(unsafe.connection.audioSoundEffectsEndpoint, null);
assert.equal(audioConnectionSupportsGeneration(unsafe.connection, "sfx"), false);

const config: GameSetupConfig = {
  genre: "fantasy",
  setting: "a harbor",
  tone: "warm",
  difficulty: "normal",
  playerGoals: "explore",
  gmMode: "standalone",
  rating: "sfw",
  partyCharacterIds: [],
  audioConnectionId: "speech",
};
const resources = { characters: [], personas: [], lorebooks: [], promptPresets: [], connections: rows };
const shared = buildGameSetupShareFile({ gameName: "Legacy audio selection", config });
assert.equal(
  resolveGameSetupImport(shared, resources).config.audioConnectionId,
  "music",
  "Same-install legacy ID resolves to its generated-audio alias",
);
assert.equal(
  resolveGameSetupImport(shared, { ...resources, connections: [rows[0]!] }).config.audioConnectionId,
  undefined,
  "A TTS row is never a generation fallback",
);
const current = buildGameSetupShareFile({
  gameName: "Current audio selection",
  config: { ...config, audioConnectionId: "music" },
});
assert.equal(resolveGameSetupImport(current, resources).config.audioConnectionId, "music");
const quarantined = buildGameSetupShareFile({
  gameName: "Quarantined selection",
  config: { ...config, audioConnectionId: "quarantined" },
});
assert.equal(resolveGameSetupImport(quarantined, resources).config.audioConnectionId, undefined);
console.info(
  "Dedicated Music/SFX selectors, legacy aliases, safe transfer and Game setup imports passed; speech choices stay separate.",
);
