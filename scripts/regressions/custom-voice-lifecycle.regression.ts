import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const temporary = await mkdtemp(join(tmpdir(), "marinara-custom-voice-"));
process.env.DATA_DIR = temporary;
process.env.FILE_STORAGE_DIR = join(temporary, "files");
process.env.TTS_LOCAL_URLS_ENABLED = "true";
process.env.ENCRYPTION_KEY = "ab".repeat(32);
const { ttsConfigSchema } = await import("../../packages/shared/src/types/tts.js");
const { createCustomVoiceService, assertManagedVoiceUsable } = await import("../../packages/server/src/services/tts/custom-voice-service.js");
const voices = new Set<string>();
let mutations = 0;
let failure = false;
let lostResponse = false;
let upload = "";
const server = createServer(async (req, res) => {
  if (req.method === "GET") return void res.end(JSON.stringify({ voices: ["builtin", ...voices], uploaded_voices: [...voices].map(name => ({ name })) }));
  mutations++;
  if (failure) { res.statusCode = 503; res.end("private provider error"); return; }
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    upload = Buffer.concat(chunks).toString("latin1");
    const name = /name="name"\r\n\r\n([^\r]+)/.exec(upload)?.[1];
    assert.ok(name);
    voices.add(name);
    if (lostResponse) { req.socket.destroy(); return; }
    res.end(JSON.stringify({ success: true, voice: { name } }));
  } else {
    voices.delete(decodeURIComponent(req.url!.split("/").at(-1)!));
    res.end(JSON.stringify({ success: true }));
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address() as { port: number };
let context = { connectionId: "a", config: ttsConfigSchema.parse({ source: "openai", baseUrl: `http://127.0.0.1:${address.port}/v1`, model: "unfamiliar-compatible-model" }), assignments: {} as Record<string, string[]> };
const service = createCustomVoiceService(async () => context);
const wav = Buffer.alloc(44 + 16000);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
const fields = { displayName: "My voice", consent: "user-consent-id", transcript: "Private transcript", audioBase64: wav.toString("base64"), acknowledged: true };
try {
  let state = await service.get();
  assert.equal(state.capability, "unknown");
  assert.equal(mutations, 0);
  await assert.rejects(service.register({ ...fields, snapshot: state.snapshot }), /select/);
  state = await service.profile(state.snapshot, "vllm-omni");
  assert.equal(mutations, 0, "opening/refresh/profile must not upload or synthesize");
  await assert.rejects(service.register({ ...fields, snapshot: state.snapshot, audioBase64: "SUQz" }), /recording/);
  await assert.rejects(service.register({ ...fields, snapshot: state.snapshot, consent: "" }), /consent/);
  state = await service.register({ ...fields, snapshot: state.snapshot });
  const voice = state.voices[0]!;
  assert.equal(voice.status, "ready");
  assert.ok(state.providerVoices.includes(voice.id));
  assert.match(upload, /name="consent"\r\n\r\nuser-consent-id/);
  assert.match(upload, /name="ref_text"\r\n\r\nPrivate transcript/);
  await assertManagedVoiceUsable(context, voice.id);
  await assertManagedVoiceUsable(context, "marinara_builtin",);
  await assert.rejects(service.register({ ...fields, snapshot: state.snapshot }), /display name/);
  assert.equal(mutations, 1);
  const original = context;
  context = { ...context, connectionId: "b" };
  assert.equal((await service.get()).voices.length, 0);
  await assert.rejects(service.register({ ...fields, snapshot: state.snapshot }), /Connection changed/);
  await assert.rejects(assertManagedVoiceUsable(context, voice.id), /unavailable/);
  context = { ...original, config: { ...original.config, apiKey: "different-account" } };
  assert.equal((await service.get()).voices.length, 0, "changed credentials do not transfer registrations");
  context = original;
  context.assignments[voice.id] = ["character:1", "narrator", "random-pool"];
  let cleared = false;
  const clear = async () => { cleared = true; delete context.assignments[voice.id]; };
  await assert.rejects(service.remove({ snapshot: state.snapshot, id: voice.id, confirmedAssignments: [] }, clear), /Assignments changed/);
  await assert.rejects(service.remove({ snapshot: state.snapshot, id: "builtin", confirmedAssignments: [] }, clear), /explicitly managed/);
  failure = true;
  await assert.rejects(service.remove({ snapshot: state.snapshot, id: voice.id, confirmedAssignments: context.assignments[voice.id]! }, clear), /not confirmed/);
  assert.equal(cleared, false);
  assert.equal((await service.get()).voices[0]!.status, "ready");
  failure = false;
  state = await service.remove({ snapshot: state.snapshot, id: voice.id, confirmedAssignments: context.assignments[voice.id]! }, clear);
  assert.equal(cleared, true);
  assert.equal(state.voices[0]!.status, "deleted");
  await assert.rejects(assertManagedVoiceUsable(context, voice.id), /unavailable/);
  lostResponse = true;
  state = await service.register({ ...fields, snapshot: state.snapshot, displayName: "Recovered" });
  assert.equal(state.voices[1]!.status, "ready", "lost POST response reconciles through provider listing");
  const reloaded = createCustomVoiceService(async () => context);
  assert.equal((await reloaded.get()).voices[1]!.id, state.voices[1]!.id);
  const metadataFiles = await readdir(join(temporary, "custom-voices"));
  assert.ok(metadataFiles.every(name => name.endsWith(".json")), "no leaked staging files");
  for (const file of metadataFiles) {
    const text = await readFile(join(temporary, "custom-voices", file), "utf8");
    for (const sensitive of [fields.consent, fields.transcript, fields.audioBase64, "different-account", context.config.baseUrl]) assert.ok(!text.includes(sensitive), "metadata stores no sensitive payload");
  }
  console.log("custom voice lifecycle: PASS (fake backend; no acoustic quality claim)");
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(temporary, { recursive: true, force: true });
}
