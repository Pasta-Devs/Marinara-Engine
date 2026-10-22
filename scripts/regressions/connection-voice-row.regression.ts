// Voice job: the Defaults tile and the Voice badge use the audio row the server uses (tts.routes.ts): the TTS card's
// row first, the audio default flag only while the card is empty, and nothing when the card's row is gone.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voiceRowOf } from "../../packages/client/src/lib/connection-jobs.js";

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

console.log("connection-voice-row regression passed");
