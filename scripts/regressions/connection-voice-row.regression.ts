// Voice job: the Defaults tile and the Voice badge use the audio row the server uses (tts.routes.ts): the TTS card's
// row first, the audio default flag only while the card is empty, and nothing when the card's row is gone.
// A voice server the user hosts (#8921, the server's `local` flag) is listed On this device, and its Voice row opens
// that page. The server side of the flag is proved in tts-local-voice-server.regression.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JOB,
  foundForJob,
  voiceJobMigration,
  voiceRowOf,
  voiceSources,
} from "../../packages/client/src/lib/connection-jobs.js";

const rows = [
  { id: "flagged", provider: "audio", defaultForAgents: "true" },
  { id: "card", provider: "audio", defaultForAgents: "false" },
  { id: "chat", provider: "openai", defaultForAgents: true },
];

// The card's row wins over the flag.
assert.deepEqual(voiceRowOf(rows, "card"), { row: rows[1], missing: false });
// A card row that is gone or not audio is missing; the server does not fall back to the flag.
assert.deepEqual(voiceRowOf(rows, "gone"), { row: null, missing: true });
assert.deepEqual(voiceRowOf(rows, "chat"), { row: null, missing: true });
// An empty card follows the audio default flag, never a chat row's flag.
assert.deepEqual(voiceRowOf(rows, ""), { row: rows[0], missing: false });
assert.deepEqual(voiceRowOf(rows, "  "), { row: rows[0], missing: false });
assert.deepEqual(voiceRowOf(rows.slice(1)), { row: null, missing: false });

// The Voice badge reads that row, not the audio flag alone.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
assert.match(
  read("../../packages/client/src/components/connections/ModelRow.tsx"),
  /job\.key === "voice" \? row\.id === voiceRowId/,
);
assert.match(
  read("../../packages/client/src/hooks/use-tts.ts"),
  /voiceRowOf\(\(rows \?\? \[\]\) as ConnectionModelRow\[\], tts\?\.connectionId\)\.row\?\.id/,
);
// Defaults warns about a missing card row instead of showing the flagged row as the voice.
assert.match(
  read("../../packages/client/src/components/connections/ConnectionDefaults.tsx"),
  /voiceRowOf\(connectionsList, tts\?\.connectionId\)\.missing[\s\S]*?connections\.defaults\.warning\.voiceMissing/,
);

// #8921: a local voice server has a place in Connections to turn it off. The On this device row and the Voice row
// decide with the same server flag, so the row always has a page to open.
assert.match(read("../../packages/client/src/hooks/use-tts.ts"), /api\s*\.get<TTSConfigResponse>\("\/tts\/config"\)/);
const deviceDetail = read("../../packages/client/src/components/connections/DeviceDetail.tsx");
assert.match(deviceDetail, /const localVoice = setup\.tts\.setUp && !!tts\?\.local;/);
// A server on another source shows its address there, not a cloud name such as "OpenAI".
assert.match(
  deviceDetail,
  /detail: \[t\(jobLabelKey\(JOB\.voice\)\), hostOf\(tts\.baseUrl\)\]\.filter\(Boolean\)\.join\(" · "\)/,
);
// A built-in source has no connection: its Voice row opens the picker, where it is listed On this device.
assert.match(
  read("../../packages/client/src/components/connections/ConnectionDefaults.tsx"),
  /role\.key === "voice" && tts\?\.enabled\) \{\s*return \{ \.\.\.tile, value: t\(`connections\.device\.ttsSource\.\$\{tts\.source\}`\)/,
);
// Its page saves the Base URL as it is typed, so it stays open while text to speech is on, even when a half-typed
// address takes its row off the list for a moment.
assert.match(
  read("../../packages/client/src/components/panels/ConnectionsPanel.tsx"),
  /const validKey = [\s\S]*?if \(key === "device:tts" && deviceSetup\.tts\.setUp\) return true;\s*if \(key\.startsWith\("device:"\)\)/,
);

// Settings from before the Voice job: on, no saved row, an audio default. The default becomes the job's saved row
// with the voice the server speaks with today, so nothing changes for the user.
const base = {
  enabled: true,
  connectionId: "",
  source: "elevenlabs",
  voice: "blob-voice",
  sourceProfiles: { openai: { voice: "openai-voice", speed: 0.8 } },
  connectionProfiles: {},
} as unknown as Parameters<typeof voiceJobMigration>[0];
const audioRows = [
  { id: "eleven", provider: "audio", defaultForAgents: "true", audioSource: "elevenlabs", audioVoice: "" },
];
assert.deepEqual(voiceJobMigration(base, audioRows)?.config, { ...base, voice: "blob-voice", connectionId: "eleven" });
// The row's own voice wins over the settings' voice, as on the server.
assert.equal(voiceJobMigration(base, [{ ...audioRows[0], audioVoice: "row-voice" }])?.config.voice, "row-voice");
// Another source reads that source's saved voice; a saved profile of the row itself is used whole.
const otherSource = voiceJobMigration({ ...base, speed: 1.1 } as typeof base, [
  { ...audioRows[0], audioSource: "openai" },
]);
assert.equal(otherSource?.config.voice, "openai-voice");
// Only the voice came from that source; the other settings stay the top-level ones the server used.
assert.equal(otherSource?.config.speed, 1.1);
const own = { ...base, connectionProfiles: { eleven: { voice: "own-voice" } } } as typeof base;
assert.equal(voiceJobMigration(own, audioRows)?.config.voice, "own-voice");
// Nothing to move: voice off, a row already saved, or no audio default.
assert.equal(voiceJobMigration({ ...base, enabled: false }, audioRows), null);
// A built-in source picked in the Voice job is not pinned back to the audio default row.
assert.equal(voiceJobMigration({ ...base, source: "pockettts" }, audioRows), null);
assert.equal(voiceJobMigration({ ...base, connectionId: "eleven" }, audioRows), null);
assert.equal(voiceJobMigration(base, [{ ...audioRows[0], defaultForAgents: "false" }]), null);

// A custom address or model the server filled into the row's blank field moves onto the row, which a saved row reads.
const custom = { ...base, baseUrl: "http://10.0.0.5:9000", model: "eleven_v3" } as typeof base;
assert.deepEqual(voiceJobMigration(custom, audioRows)?.row, {
  id: "eleven",
  baseUrl: "http://10.0.0.5:9000",
  model: "eleven_v3",
});
assert.equal(voiceJobMigration(custom, audioRows)?.config.connectionId, "eleven");
// The row's own address stays; a default address or model needs nothing on the row.
assert.deepEqual(voiceJobMigration(custom, [{ ...audioRows[0], baseUrl: "https://el.example" }])?.row, {
  id: "eleven",
  model: "eleven_v3",
});
assert.equal(
  voiceJobMigration({ ...base, baseUrl: "https://api.elevenlabs.io" } as typeof base, audioRows)?.row,
  undefined,
);

// Voice job choices without a row: Local PocketTTS always, and every direct source with its own key or server,
// also while voice is off.
const off = {
  ...base,
  enabled: false,
  source: "openai",
  baseUrl: "http://localhost:5050/v1",
  apiKey: "",
  sourceProfiles: { elevenlabs: { baseUrl: "https://api.elevenlabs.io", apiKey: "••••", voice: "", model: "" } },
} as unknown as typeof base;
assert.deepEqual(voiceSources(off), ["openai", "elevenlabs", "pockettts"]);
assert.deepEqual(voiceSources({ ...off, baseUrl: "https://api.openai.com/v1", sourceProfiles: {} } as typeof base), [
  "pockettts",
]);

// An empty job counts what the accounts' catalogs offer it, and names those accounts.
const catalogs = [
  {
    name: "NanoGPT",
    provider: "nanogpt",
    models: [
      { id: "glm-5", name: "glm-5", outputModalities: ["text"], capabilities: { logprobs: true } },
      { id: "veo-3", name: "veo-3", outputModalities: ["video"] },
      { id: "text-embedding-3-small", name: "embed" },
    ],
  },
  { name: "ComfyUI", provider: "comfyui", models: [{ id: "flux", name: "flux", outputModalities: ["image"] }] },
];
const drives = (provider: string, kind: string) => provider === "nanogpt" || kind === "image";
assert.deepEqual(foundForJob(JOB.video, catalogs, drives), { count: 1, accounts: ["NanoGPT"] });
assert.deepEqual(foundForJob(JOB.images, catalogs, drives), { count: 1, accounts: ["ComfyUI"] });
assert.deepEqual(foundForJob(JOB.main, catalogs, drives), { count: 1, accounts: ["NanoGPT"] });
assert.deepEqual(foundForJob(JOB.decision, catalogs, drives), { count: 1, accounts: ["NanoGPT"] });
assert.deepEqual(foundForJob(JOB.embeddings, catalogs, drives), { count: 1, accounts: ["NanoGPT"] });
assert.deepEqual(foundForJob(JOB.voice, catalogs, drives), { count: 0, accounts: [] });

console.log("connection-voice-row regression passed");
