import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { setTimeout as delay } from "node:timers/promises";
import {
  MULTIPLAYER_LIMITS,
  type MultiplayerAction,
  type MultiplayerPeerRequest,
  type MultiplayerPeerResponse,
  type MultiplayerSnapshot,
  type MultiplayerStoredRoom,
} from "../../packages/shared/src/index.js";
import {
  MultiplayerService,
  decodeMultiplayerInvite,
  encodeMultiplayerInvite,
} from "../../packages/server/src/services/multiplayer/service.js";
import { requestMultiplayerPeer } from "../../packages/server/src/services/multiplayer/peer-client.js";
import { startMultiplayerPeerServer } from "../../packages/server/src/services/multiplayer/peer-server.js";
import { projectRoomSnapshot, record } from "../../packages/server/src/services/multiplayer/room-projection.js";
import {
  projectMultiplayerGame,
  gameNarrationForParticipant,
} from "../../packages/server/src/services/multiplayer/game-projection.js";
import { resolveRoomGenerationPolicy } from "../../packages/server/src/services/multiplayer/generation-policy.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { newId } from "../../packages/server/src/utils/id-generator.js";
import { sendSseEvent, endGenerationOutput } from "../../packages/server/src/routes/generate/sse.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-roster-"));
const previousTrust = getCACertificates("default");
const actualNow = Date.now;
let elapsed = 0;
Date.now = () => actualNow() + elapsed;
process.env.FILE_STORAGE_DIR = join(directory, "host-store");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const hostDb = await createFileNativeDB();
process.env.FILE_STORAGE_DIR = join(directory, "guest-store");
const guestDb = await createFileNativeDB();
const services: MultiplayerService[] = [];
let fakePeer: Awaited<ReturnType<typeof startMultiplayerPeerServer>> | undefined;

async function unusedPort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = actualNow() + 4_000;
  for (;;) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(actualNow() < deadline, "room operation finishes within the proof deadline");
    await delay(10);
  }
}
const action = (sequence: number, input: Record<string, unknown>) =>
  ({ operationId: newId(), sequence, ...input }) as MultiplayerAction;

try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "2",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
      "-keyout",
      "host.key",
      "-out",
      "host.pem",
    ],
    { cwd: directory, stdio: "ignore" },
  );
  const tls = { cert: readFileSync(join(directory, "host.pem")), key: readFileSync(join(directory, "host.key")) };
  setDefaultCACertificates([tls.cert.toString("utf8")]);
  const makeService = async (db: typeof hostDb) => {
    const service = new MultiplayerService({ db, available: true, tls: () => tls, abortGeneration() {} });
    services.push(service);
    await service.initialize();
    await service.settings(true);
    return service;
  };
  const host = await makeService(hostDb);
  const chats = createChatsStorage(hostDb);
  const characters = createCharactersStorage(hostDb);
  const ids: string[] = [];
  for (let index = 0; index < 13; index++) {
    const character = await characters.create({ name: `Companion ${index}`, description: "Reviewed AI" } as never);
    assert.ok(character);
    ids.push(character.id);
  }
  const source = await chats.create({ name: "Large party", mode: "game", characterIds: ids.slice(0, 12) } as never);
  assert.ok(source);
  const prepared = await host.prepare({ chatId: source.id });
  assert.deepEqual(
    JSON.parse((await chats.getById(prepared.chatId))!.characterIds),
    ids.slice(0, 12),
    "preparation retains every selected AI",
  );
  const started = await host.startHost({
    chatId: prepared.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password: "a safe fixture password",
    displayName: "Host",
    persona: { name: "Captain", description: "" },
  });
  assert.equal(started!.snapshot.characters.length, 12, "hosting has no eight-AI cap");
  const invitation = decodeMultiplayerInvite(started!.invite!.code);
  const peer = (message: Omit<MultiplayerPeerRequest, "version" | "roomId">, session?: string) =>
    requestMultiplayerPeer(
      invitation,
      { version: 1, roomId: invitation.roomId, ...message } as MultiplayerPeerRequest,
      { session },
    );
  let joins = 0;
  const joinPeer = async () => {
    // Keep the existing password-work rate limit; advance the fixture clock between batches.
    if (joins && joins % 5 === 0) elapsed += 61_000;
    const index = ++joins;
    return peer({
      type: "join",
      invite: invitation.invite,
      password: "a safe fixture password",
      displayName: `Guest ${index}`,
      persona: { name: `Hero ${index}`, description: "" },
    } as never);
  };
  const sessions: string[] = [];
  for (let index = 0; index < 9; index++) {
    const admitted = await joinPeer();
    assert.equal(admitted.type, "admission");
    if (admitted.type !== "admission") throw new Error("Admission failed");
    sessions.push(admitted.session);
    const pending = (await host.hostState())!.pendingRequests;
    assert.equal(pending.length, 1);
    await host.hostAction({ type: "approve", requestId: pending[0]!.id });
  }
  assert.equal(
    (await host.hostState())!.snapshot.players.length,
    10,
    "nine admitted sessions do not consume the pending admission budget",
  );
  for (let index = 0; index < 8; index++) assert.equal((await joinPeer()).type, "admission");
  assert.deepEqual(
    await joinPeer(),
    { version: 1, type: "error", code: "room-full" },
    "unapproved requests remain bounded separately",
  );
  for (const pending of (await host.hostState())!.pendingRequests)
    await host.hostAction({ type: "decline", requestId: pending.id });
  await host.hostAction({ type: "add-character", characterId: ids[12]!, role: "character" });
  const proposal = action(0, {
    type: "propose-character",
    character: { name: "Guest companion", description: "Reviewed proposal", role: "character" },
  });
  assert.equal((await peer({ type: "action", action: proposal } as never, sessions[0])).type, "accepted");
  await host.hostAction({ type: "proposal-approve", proposalId: proposal.operationId });
  assert.equal(
    (await host.hostState())!.snapshot.characters.length,
    14,
    "local additions and approved guest proposals both work beyond eight AI",
  );

  let generationCalls = 0;
  let finishCalls = 0;
  host.setRunner(async (_input, output, authority) => {
    generationCalls++;
    const chat = (await chats.getById(prepared.chatId))!;
    const policy = resolveRoomGenerationPolicy(
      chat.id,
      record(chat.metadata),
      JSON.parse(chat.characterIds),
      authority,
    );
    assert.equal(policy!.participants.length, 10, "generation policy retains every approved human");
    assert.equal(policy!.characters.length, 14);
    sendSseEvent(output, { type: "done", messageId: newId() } as never);
    endGenerationOutput(output);
  });
  host.setGameRuntime({
    async runGameStart() {},
    async finishGameTurn() {
      finishCalls++;
    },
  });
  await host.hostAction({ type: "startGame", config: {} as never, preferences: "" });
  const game = (await until(
    () => host.hostState(),
    (state) => state?.snapshot.generation === "idle",
  ))!;
  const round = game.snapshot.round!;
  assert.equal(round.requiredParticipantIds.length, 10);
  await host.hostParticipantAction(action(0, { type: "pass", roundId: round.id, submissionRevision: 0 }));
  for (let index = 0; index < sessions.length; index++) {
    const submission = action(index === 0 ? 1 : 0, {
      type: "submit-action",
      roundId: round.id,
      submissionRevision: 0,
      text: `Hero ${index + 1} holds their position.`,
    });
    assert.equal((await peer({ type: "action", action: submission } as never, sessions[index])).type, "accepted");
    if (index < sessions.length - 1) assert.equal(generationCalls, 0, "the larger round waits for every human");
  }
  await until(
    () => host.hostState(),
    (state) => state?.snapshot.round?.number === 2,
  );
  assert.equal(generationCalls, 1);
  assert.equal(finishCalls, 1);
  const current = (await chats.getById(prepared.chatId))!;
  const room = record(record(current.metadata).multiplayer) as unknown as MultiplayerStoredRoom;
  const participantIds = room.participants.map((participant) => participant.id);
  for (const session of sessions) {
    const response = await peer({ type: "poll", revision: 0 } as never, session);
    assert.equal(response.type, "state");
    if (response.type !== "state") throw new Error("Missing snapshot");
    assert.deepEqual(
      response.state.snapshot!.players.map((player) => player.id),
      participantIds,
    );
    assert.equal(response.state.snapshot!.characters.length, 14);
    assert.deepEqual(response.state.snapshot!.round!.requiredParticipantIds, participantIds);
  }
  const owners = [
    ...room.participants.map((participant) => ({ id: participant.id, name: participant.persona.name })),
    ...room.characters,
  ];
  const hud = projectMultiplayerGame({
    room,
    metadata: {},
    state: {
      presentCharacters: owners.map((owner) => ({
        characterId: owner.id,
        name: owner.name,
        stats: [{ name: "HP", value: 10 }],
      })),
    },
    messages: [],
  });
  assert.equal(hud.trackers.length, 24, "later actors are not silently omitted from the Game HUD");
  const audience = {
    roomId: room.roomId,
    participants: room.participants.map((participant) => ({ id: participant.id, name: participant.persona.name })),
  };
  const whisper = "[Guide][whisper:Hero 9]Private ninth-player message.";
  assert.ok(gameNarrationForParticipant(whisper, room, participantIds[9]!, audience).includes("Private ninth-player"));
  assert.ok(!gameNarrationForParticipant(whisper, room, participantIds[0]!, audience).includes("Private ninth-player"));
  const reactionSnapshot = projectRoomSnapshot({
    room,
    chat: current,
    selfId: participantIds[0]!,
    connected: new Set(),
    messages: [
      {
        id: newId(),
        role: "assistant",
        characterId: null,
        content: "Everyone agrees.",
        extra: { reactions: [{ emoji: "👍", by: room.characters.map((character) => character.id) }] },
        createdAt: new Date().toISOString(),
      },
    ],
  });
  assert.equal(reactionSnapshot.messages[0]!.reactions![0]!.by.length, 14);

  // An actual oversized roster is not truncated or allowed across the peer boundary.
  // Trusted host management remains readable, so removing the excess data recovers the same sessions.
  const oversized = structuredClone(room);
  oversized.characters = Array.from({ length: 1000 }, (_, index) => ({
    id: `large_character_${index.toString().padStart(8, "0")}`,
    name: `AI ${index} ${"界".repeat(70)}`,
    role: "character" as const,
  }));
  await chats.patchMetadata(prepared.chatId, { multiplayer: oversized });
  const localLarge = (await host.hostState())!;
  assert.equal(localLarge.snapshot.characters.length, 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(localLarge.snapshot)) > MULTIPLAYER_LIMITS.snapshotBytes);
  assert.deepEqual(await peer({ type: "poll", revision: 0 } as never, sessions[0]), {
    version: 1,
    type: "error",
    code: "snapshot-too-large",
  });
  await host.hostAction({ type: "remove-character", characterId: oversized.characters.at(-1)!.id });
  assert.equal((await host.hostState())!.snapshot.characters.length, 999, "oversized rooms keep working host controls");
  await chats.patchMetadata(prepared.chatId, { multiplayer: room });
  assert.equal(
    (await peer({ type: "poll", revision: 0 } as never, sessions[0])).type,
    "state",
    "an existing session recovers after the host reduces the update",
  );

  // Exercise the real guest connector against a pinned peer, without wall-clock sleeps.
  const guest = await makeService(guestDb);
  let polls = 0;
  let behavior: "state" | "busy" | "rate-limited" | "snapshot-too-large" = "state";
  const safeSnapshot: MultiplayerSnapshot = { ...game.snapshot, selfId: participantIds[1]! };
  fakePeer = await startMultiplayerPeerServer({
    tls,
    port: 0,
    host: "127.0.0.1",
    enabled: () => true,
    async handle(message): Promise<MultiplayerPeerResponse> {
      if (message.type === "preview")
        return {
          version: 1,
          type: "preview",
          roomId: invitation.roomId,
          name: "Retry proof",
          mode: "game",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      if (message.type === "join") return { version: 1, type: "admission", session: "s".repeat(43) };
      if (message.type === "poll") {
        polls++;
        return behavior === "state"
          ? { version: 1, type: "state", state: { phase: "connected", snapshot: safeSnapshot, error: null } }
          : { version: 1, type: "error", code: behavior };
      }
      return {
        version: 1,
        type: "accepted",
        operationId: message.action.operationId,
        state: { phase: "ended", snapshot: null, error: "revoked" },
      };
    },
  });
  const retryInvite = {
    ...invitation,
    origin: `https://127.0.0.1:${fakePeer.port}`,
    fingerprint: new X509Certificate(tls.cert).fingerprint256.replaceAll(":", "").toLowerCase(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  await guest.join({
    inviteCode: encodeMultiplayerInvite(retryInvite),
    password: "a safe fixture password",
    displayName: "Guest",
    persona: { name: "Hero", description: "" },
  });
  await until(
    () => guest.guestState(),
    (state) => state?.state.phase === "connected",
  );
  for (const failure of ["busy", "rate-limited", "snapshot-too-large"] as const) {
    behavior = failure;
    elapsed += 30_000;
    const failed = await until(
      () => guest.guestState(),
      (state) => state?.state.error === failure,
    );
    assert.deepEqual(failed!.state.snapshot, safeSnapshot, "temporary capacity errors retain the last safe state");
    const before = polls;
    for (let index = 0; index < 20; index++) await guest.guestState();
    await delay(30);
    assert.equal(polls, before, "local UI refreshes cannot spin peer retries during backoff");
  }
  behavior = "state";
  elapsed += 30_000;
  await until(
    () => guest.guestState(),
    (state) => state?.state.phase === "connected",
  );
  await guest.leaveGuest();
  assert.equal(await guest.guestState(), null);
  console.info(
    "multiplayer roster: 10 humans/14 AI, separate pending budget, complete Game barrier/HUD/whispers, recoverable byte limits and bounded retries passed",
  );
} finally {
  for (const service of services) await service.close();
  await fakePeer?.close();
  await hostDb._fileStore.close();
  await guestDb._fileStore.close();
  setDefaultCACertificates(previousTrust);
  Date.now = actualNow;
  rmSync(directory, { recursive: true, force: true });
}
