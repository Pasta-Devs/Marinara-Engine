// Optional real-model proof (downloads models in online mode, outside the 30s regression lane):
// pnpm --filter @marinara-engine/server exec tsx ../../scripts/smoke-local-models.ts <online|offline|lite> <isolated-data-dir> <jfk.wav>
// Audio fixture: https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [mode, dataDir, wavFile] = process.argv.slice(2);
assert.ok(mode && ["online", "offline", "lite"].includes(mode) && dataDir && wavFile, "See usage above");
process.env.DATA_DIR = resolve(dataDir);
process.env.MARINARA_LITE = mode === "lite" ? "true" : "false";
let networkAttempts = 0;
if (mode !== "online") {
  globalThis.fetch = async () => {
    networkAttempts++;
    throw new Error("Network disabled by local model smoke proof");
  };
}
const { localEmbed, isLocalEmbedderAvailable } = await import("../packages/server/src/services/local-embedder.js");
const { sidecarSpeechService: speech } =
  await import("../packages/server/src/services/sidecar/sidecar-speech.service.js");

if (mode === "lite") {
  assert.equal(isLocalEmbedderAvailable(), false);
  assert.equal(await localEmbed(["Must not download a model"]), null);
  assert.equal(speech.getStatus().available, false);
  await assert.rejects(speech.download(), /unavailable/);
} else {
  assert.equal(isLocalEmbedderAvailable(), true, "native runtime must be loadable");
  const vectors = await localEmbed([
    "A cat sits on a mat.",
    "A kitten rests on the rug.",
    "The aircraft crossed the ocean.",
  ]);
  assert.ok(vectors && vectors.length === 3);
  for (const vector of vectors) {
    assert.equal(vector.length, 384);
    assert.ok(vector.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...vector) - 1) < 0.001, "MiniLM embeddings must remain normalized");
  }
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index]!, 0);
  assert.ok(dot(vectors[0]!, vectors[1]!) > dot(vectors[0]!, vectors[2]!), "similar texts must remain closer");
  const wav = readFileSync(resolve(wavFile));
  if (mode === "offline") {
    assert.equal(speech.getStatus().modelDownloaded, true, "the existing cache must be detected after restart");
    assert.match(await speech.transcribeWav(wav), /ask not what your country can do for you/i);
  }
  for (const model of ["whisper_tiny", "whisper_base"] as const) {
    await speech.download(model);
    assert.equal(speech.getStatus().status, "ready");
    assert.equal(speech.getStatus().config.modelId, model);
    const transcript = await speech.transcribeWav(wav);
    assert.match(transcript, /ask not what your country can do for you/i, `${model} must transcribe actual speech`);
    console.log(`${model}: ${transcript}`);
  }
  console.log("MiniLM: 384 finite, normalized dimensions; semantic similarity passed.");
}
assert.equal(networkAttempts, 0, "offline and Lite operation must not attempt a download");
console.log(`Local model ${mode} smoke passed (${process.platform}/${process.arch}).`);
