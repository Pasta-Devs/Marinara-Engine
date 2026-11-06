import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Exercise the actual startup guards with failing migration callbacks, without booting providers or a database.
const source = readFileSync(new URL("../../packages/server/src/app.ts", import.meta.url), "utf8");
const speechAt = source.indexOf('startup.phase("migrate.tts-audio"');
const nextAt = source.indexOf('startup.phase("migrate.tripo-key"', speechAt);
const start = source.lastIndexOf("\n  try {", speechAt);
const end = source.lastIndexOf("\n  try {", nextAt);
assert.ok(speechAt > 0 && start >= 0 && end > start, "locate the audio migration startup guards");
const run = new Function(
  "startup",
  "db",
  "migrateTtsSettingsToAudioConnection",
  "migrateGenerativeAudioConnections",
  "app",
  `return (async () => {${source.slice(start, end)}\n})();`,
) as (...args: unknown[]) => Promise<void>;

const speechWarning = "TTS audio-connection migration did not complete; it will retry next startup";
const generationWarning = "Generative audio-connection migration did not complete; it will retry next startup";
const observations = [];
for (const failures of [[], ["speech"], ["generation"], ["speech", "generation"]]) {
  const database = {};
  const speechError = new Error("speech fixture failure");
  const generationError = new Error("generation fixture failure");
  const calls: string[] = [];
  const phases: string[] = [];
  const warnings: Array<{ error: string; message: string }> = [];
  await run(
    {
      phase: async (name: string, work: () => Promise<void>) => {
        phases.push(name);
        await work();
      },
    },
    database,
    async (db: unknown) => {
      assert.equal(db, database);
      calls.push("speech");
      if (failures.includes("speech")) throw speechError;
    },
    async (db: unknown) => {
      assert.equal(db, database);
      calls.push("generation");
      if (failures.includes("generation")) throw generationError;
    },
    {
      log: {
        warn: (error: unknown, message: string) =>
          warnings.push({
            error: error === speechError ? "speech" : error === generationError ? "generation" : "unexpected",
            message,
          }),
      },
    },
  );
  observations.push({ failures, phases, calls, warnings });
}
assert.deepEqual(
  observations,
  [[], ["speech"], ["generation"], ["speech", "generation"]].map((failures) => ({
    failures,
    phases: ["migrate.tts-audio", "migrate.generative-audio"],
    calls: ["speech", "generation"],
    warnings: failures.map((error) => ({ error, message: error === "speech" ? speechWarning : generationWarning })),
  })),
  "both phases must be attempted independently and each failure must preserve its own error and warning",
);
console.info(
  "Startup audio migration isolation: success, speech-only failure, generation-only failure and both failures passed.",
);
