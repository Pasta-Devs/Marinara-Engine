import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const temporary = await mkdtemp(join(tmpdir(), "marinara-voice-openai-"));
process.env.DATA_DIR = temporary;
process.env.FILE_STORAGE_DIR = join(temporary, "files");
process.env.TTS_LOCAL_URLS_ENABLED = "true";
process.env.ENCRYPTION_KEY = "ab".repeat(32);
const { ttsConfigSchema } = await import("../../packages/shared/src/types/tts.js");
const { createCustomVoiceService, assertManagedVoiceUsable, voiceContextSnapshot } =
  await import("../../packages/server/src/services/tts/custom-voice-service.js");
const { customVoiceStorage } = await import("../../packages/server/src/services/tts/custom-voice-storage.js");
const voices = new Map<string, string>([["builtin", "Builtin voice"]]);
let listingStatus = 200;
let registration: "ok" | "wrong" | "ambiguous" | "lost" = "ok";
let deletion: unknown = { deleted: true };
let deletionStatus = 200;
let mutations = 0;
let intended = "";
let actualId = "";
const deletedIds: string[] = [];
const server = createServer(async (req, res) => {
  if (req.url === "/v1/audio/speech") {
    res.setHeader("content-type", "audio/wav");
    return void res.end("ORDINARY-SPEECH");
  }
  if (req.method === "GET") {
    res.statusCode = listingStatus;
    return void res.end(
      JSON.stringify({ object: "list", data: [...voices].map(([id, name]) => ({ id, object: "audio.voice", name })) }),
    );
  }
  mutations++;
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const multipart = Buffer.concat(chunks).toString("latin1");
    assert.deepEqual(
      [...multipart.matchAll(/Content-Disposition: form-data; name="([^"]+)"/g)].map((m) => m[1]).sort(),
      ["audio_sample", "name"],
    );
    intended = /name="name"\r\n\r\n([^\r]+)/.exec(multipart)![1]!;
    assert.match(intended, /^marinara_[a-f0-9]{32}$/);
    const journal = await customVoiceStorage(`generic\0${contextSnapshot}`).read();
    assert.equal(journal!.voices.at(-1)!.id, intended, "provisional journal ID precedes transmission");
    assert.equal(journal!.voices.at(-1)!.providerName, intended, "intended provider name is journaled separately");
    assert.equal(journal!.voices.at(-1)!.status, "pending");
    actualId = `provider_${intended}`;
    if (registration === "ok" || registration === "lost") voices.set(actualId, intended);
    if (registration === "wrong") voices.set(intended, "unrelated-name");
    if (registration === "lost") return void req.socket.destroy();
    return void res.end(
      JSON.stringify(
        registration === "ambiguous"
          ? { success: true }
          : {
              id: actualId,
              object: "audio.voice",
              name: registration === "wrong" ? "unrelated-name" : intended,
              created: true,
            },
      ),
    );
  }
  res.statusCode = deletionStatus;
  const target = decodeURIComponent(req.url!.split("/").at(-1)!);
  deletedIds.push(target);
  const body = deletion as { id?: string; deleted?: boolean; success?: boolean } | null;
  if (
    deletionStatus === 204 ||
    (body &&
      (body.id === undefined || body.id === target) &&
      (body.deleted === true || body.success === true) &&
      body.deleted !== false &&
      body.success !== false)
  ) {
    voices.delete(target);
  }
  res.end(deletionStatus === 204 ? undefined : JSON.stringify(deletion));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const context = {
  connectionId: "generic",
  config: ttsConfigSchema.parse({
    source: "openai",
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
    model: "unfamiliar",
    voice: "alloy",
  }),
  assignments: {} as Record<string, string[]>,
};
const contextSnapshot = voiceContextSnapshot(context);
const service = createCustomVoiceService(async () => context);
let snapshot = "";
const wav = Buffer.alloc(44 + 16000);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(16000, 40);
const input = { displayName: "Generic", audioBase64: wav.toString("base64"), acknowledged: true };
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const Fastify = (await import("../../packages/server/node_modules/fastify/fastify.js")).default;
const app = Fastify({ logger: false });
app.decorate("db", await getDB());
const { ttsRoutes } = await import("../../packages/server/src/routes/tts.routes.js");
app.register(ttsRoutes, { prefix: "/api/tts" });
await app.ready();
try {
  let state = await service.get();
  snapshot = state.snapshot;
  assert.equal(state.profile, null);
  await assert.rejects(service.register({ ...input, snapshot }), /select/);
  state = await service.profile(snapshot, "openai-compatible");
  snapshot = state.snapshot;
  assert.deepEqual(state.providerVoices, ["builtin"]);
  assert.equal(mutations, 0);
  // Force a generated-name collision to prove an existing provider voice cannot be adopted.
  const originalUUID = crypto.randomUUID;
  crypto.randomUUID = () => "11111111-1111-4111-8111-111111111111";
  syncBuiltinESMExports();
  const collisionName = "marinara_11111111111141118111111111111111";
  try {
    for (const [existingId, existingName] of [
      [collisionName, "unrelated-name"],
      ["preexisting-distinct-id", collisionName],
    ] as const) {
      voices.set(existingId, existingName);
      await assert.rejects(service.register({ ...input, snapshot }), /collision/);
      assert.equal(mutations, 0, "ID and name collisions reject before POST");
      assert.equal((await service.get()).voices.length, 0, "collision never creates a managed journal");
      voices.delete(existingId);
    }
  } finally {
    voices.delete(collisionName);
    voices.delete("preexisting-distinct-id");
    crypto.randomUUID = originalUUID;
    syncBuiltinESMExports();
  }
  await assert.rejects(service.register({ ...input, snapshot, acknowledged: false }), /permission/);
  await assert.rejects(service.register({ ...input, snapshot, audioBase64: "SUQz" }), /recording/);
  state = await service.register({ ...input, snapshot });
  const id = state.voices[0]!.id;
  assert.equal(state.voices[0]!.status, "ready");
  assert.equal(id, actualId);
  assert.notEqual(id, intended, "provider-assigned ID need not equal submitted name");
  assert.equal(state.voices[0]!.providerName, intended);
  assert.equal(state.voices[0]!.identityConfirmed, true);
  assert.notEqual(snapshot, contextSnapshot, "mutation token does not replace the storage context key");
  assert.equal((await customVoiceStorage(`generic\0${contextSnapshot}`).read())!.voices[0]!.id, id);
  await assertManagedVoiceUsable(context, id);
  await assert.rejects(assertManagedVoiceUsable({ ...context, connectionId: "other" }, id), /unavailable/);
  const staleProfileSnapshot = snapshot;
  const beforeProfileMutations = mutations;
  state = await service.profile(snapshot, null);
  snapshot = state.snapshot;
  await assert.rejects(service.register({ ...input, snapshot: staleProfileSnapshot, displayName: "stale" }), {
    statusCode: 409,
  });
  await assert.rejects(
    service.remove({ snapshot: staleProfileSnapshot, id, confirmedAssignments: [] }, async () =>
      assert.fail("cleanup"),
    ),
    { statusCode: 409 },
  );
  assert.equal(mutations, beforeProfileMutations, "stale profile confirmations never reach provider mutations");
  state = await service.profile(snapshot, "openai-compatible");
  snapshot = state.snapshot;
  assert.notEqual(snapshot, staleProfileSnapshot, "A→B→A invalidates prior confirmations");
  await assert.rejects(service.register({ ...input, snapshot: staleProfileSnapshot, displayName: "stale-again" }), {
    statusCode: 409,
  });
  await assert.rejects(
    service.remove({ snapshot: staleProfileSnapshot, id, confirmedAssignments: [] }, async () =>
      assert.fail("cleanup"),
    ),
    { statusCode: 409 },
  );
  assert.equal(mutations, beforeProfileMutations);
  const enrolledName = intended;
  voices.delete(id);
  assert.equal((await service.get()).voices[0]!.status, "unavailable");
  await assert.rejects(assertManagedVoiceUsable(context, id), /unavailable/);
  voices.set(id, enrolledName);
  assert.equal((await service.get()).voices[0]!.status, "ready");
  await assert.rejects(service.register({ ...input, snapshot: "stale" }), /Connection changed/);
  context.assignments[id] = ["narrator"];
  let cleared = false;
  const clear = async () => {
    cleared = true;
    delete context.assignments[id];
  };
  const remove = () => service.remove({ snapshot, id, confirmedAssignments: ["narrator"] }, clear);
  await assert.rejects(service.remove({ snapshot, id, confirmedAssignments: [] }, clear), /Assignments changed/);
  await assert.rejects(service.remove({ snapshot, id: "builtin", confirmedAssignments: [] }, clear), /managed/);
  for (const body of [
    {},
    { deleted: "true" },
    { success: 1 },
    { deleted: true, id: "wrong" },
    { success: true, deleted: false },
    null,
  ]) {
    deletion = body;
    await assert.rejects(remove(), /not confirmed/);
    assert.equal(cleared, false);
    assert.equal((await service.get()).voices[0]!.status, "ready");
  }
  deletion = { id, deleted: true };
  state = await remove();
  assert.equal(cleared, true);
  assert.equal(state.voices[0]!.status, "deleted");
  assert.ok(
    deletedIds.every((target) => target === id),
    "deletion targets actual ID, never submitted name",
  );
  voices.set(id, enrolledName);
  assert.equal((await service.get()).voices[0]!.status, "deleted", "refresh never revives tombstones");
  voices.delete(id);
  await assert.rejects(assertManagedVoiceUsable(context, id), /unavailable/);
  for (const mode of ["wrong", "ambiguous", "lost"] as const) {
    registration = mode;
    state = await service.register({ ...input, snapshot, displayName: mode });
    const voice = state.voices.at(-1)!;
    assert.equal(voice.providerName, intended);
    assert.equal(voice.id, mode === "lost" ? actualId : intended);
    assert.equal(voice.status, mode === "lost" ? "ready" : "uncertain");
    assert.equal(voice.identityConfirmed, mode === "lost");
    if (mode !== "lost") {
      deletion = { deleted: true };
      const beforeDelete = mutations;
      await assert.rejects(
        service.remove({ snapshot, id: voice.id, confirmedAssignments: [] }, async () => {}),
        /identity.*confirmed/i,
      );
      assert.equal(mutations, beforeDelete, "provisional name never authorizes provider deletion");
      assert.ok(state.error);
      await assert.rejects(assertManagedVoiceUsable(context, voice.id), /unavailable/);
      assert.equal(
        (await service.get()).voices.at(-1)!.status,
        "uncertain",
        "wrong-name/absent entries do not recover",
      );
      voices.set(actualId, intended);
      if (mode === "ambiguous") {
        voices.set("duplicate-name", intended);
        state = await service.get();
        assert.equal(state.voices.at(-1)!.status, "uncertain", "duplicate names must not transfer ownership");
        assert.equal(state.voices.at(-1)!.id, intended);
        voices.delete("duplicate-name");
        voices.delete(actualId);
        voices.set(id, intended);
        state = await service.get();
        assert.equal(state.voices[0]!.status, "deleted");
        assert.equal(state.voices.at(-1)!.status, "uncertain", "recovery cannot adopt a tombstoned managed ID");
        voices.delete(id);
        voices.set(actualId, intended);
      }
      state = await service.get();
      assert.equal(state.voices.at(-1)!.status, "ready", "unique intended name reconciles actual provider ID");
      assert.equal(state.voices.at(-1)!.id, actualId);
      assert.equal(state.voices.at(-1)!.identityConfirmed, true);
    } else {
      assert.equal(state.error, undefined, "lost POST response recovers a distinct ID from listing");
      assert.equal((await customVoiceStorage(`generic\0${contextSnapshot}`).read())!.voices.at(-1)!.id, actualId);
    }
    await assertManagedVoiceUsable(context, actualId);
  }
  deletion = { success: true };
  const recoveredId = state.voices.at(-1)!.id;
  voices.delete(recoveredId);
  state = await service.get();
  assert.equal(state.voices.at(-1)!.status, "unavailable");
  assert.equal(state.voices.at(-1)!.identityConfirmed, true, "unavailability preserves confirmed ownership");
  await assert.rejects(
    service.remove({ snapshot, id: recoveredId, confirmedAssignments: [] }, async () => {
      throw new Error("local cleanup failed");
    }),
    /local cleanup failed/,
  );
  const afterProviderDelete = mutations;
  assert.equal((await service.get()).voices.at(-1)!.status, "deleted");
  state = await service.remove({ snapshot, id: recoveredId, confirmedAssignments: [] }, async () => {});
  assert.equal(mutations, afterProviderDelete, "tombstone cleanup never repeats DELETE");
  assert.equal(state.voices.at(-1)!.status, "deleted");
  deletionStatus = 204;
  const anotherId = state.voices[1]!.id;
  state = await service.remove({ snapshot, id: anotherId, confirmedAssignments: [] }, async () => {});
  assert.equal(state.voices[1]!.status, "deleted");
  state = await service.profile(snapshot, "vllm-omni");
  snapshot = state.snapshot;
  await assert.rejects(service.register({ ...input, snapshot, displayName: "vllm" }), /consent/);
  state = await service.profile(snapshot, "openai-compatible");
  snapshot = state.snapshot;
  for (const status of [404, 405, 501]) {
    listingStatus = status;
    state = await service.get();
    assert.equal(state.capability, "unsupported");
    assert.match(state.error!, /unavailable or unsupported/);
    await assert.rejects(service.register({ ...input, snapshot, displayName: `unsupported-${status}` }), /unsupported/);
  }
  // Ordinary routing remains usable with an opted-in but unsupported management API.
  let response = await app.inject({
    method: "PUT",
    url: "/api/tts/config",
    payload: { ...context.config, enabled: true },
  });
  assert.equal(response.statusCode, 204);
  response = await app.inject({ method: "GET", url: "/api/tts/custom-voices?connectionId=" });
  const legacySnapshot = response.json().snapshot as string;
  response = await app.inject({
    method: "PUT",
    url: "/api/tts/custom-voices?connectionId=",
    payload: { snapshot: legacySnapshot, profile: "openai-compatible" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().capability, "unsupported");
  response = await app.inject({ method: "GET", url: "/api/tts/voices" });
  assert.equal(response.statusCode, 200, "ordinary list falls back when management listing is unsupported");
  assert.ok(response.json().voices.includes("alloy"));
  response = await app.inject({ method: "POST", url: "/api/tts/speak", payload: { text: "ordinary speech" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "ORDINARY-SPEECH");
  console.log("custom voice openai-compatible: PASS (mock provider only)");
} finally {
  await app.close();
  await closeDB();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(temporary, { recursive: true, force: true });
}
