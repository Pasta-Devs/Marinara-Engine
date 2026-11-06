import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer as createTcpServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { setTimeout as delay } from "node:timers/promises";

// Host Stop/disable reaching guests, scoped Leave, returning players, stale sessions,
// an unopened room port and the hosted-room roster guard, over real TLS between two Engines.
const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-lifecycle-"));
Object.assign(process.env, {
  DATA_DIR: directory,
  FILE_STORAGE_DIR: join(directory, "host-store"),
  NODE_ENV: "test",
  MARINARA_LITE: "true",
  LOG_LEVEL: "silent",
});
const previousTrust = getCACertificates("default");
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { MultiplayerService, decodeMultiplayerInvite, encodeMultiplayerInvite } =
  await import("../../packages/server/src/services/multiplayer/service.js");
const { startMultiplayerPeerServer } = await import("../../packages/server/src/services/multiplayer/peer-server.js");
const { requestMultiplayerPeer } = await import("../../packages/server/src/services/multiplayer/peer-client.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const hostDb = await getDB();
process.env.FILE_STORAGE_DIR = join(directory, "guest-store");
const guestDb = await createFileNativeDB();
const app = Fastify();
app.decorate("db", hostDb);
await app.register(chatsRoutes, { prefix: "/api/chats" });
const services: InstanceType<typeof MultiplayerService>[] = [];
const password = "a safe fixture password";

async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean, label: string): Promise<T> {
  const deadline = Date.now() + 6_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(Date.now() < deadline, `${label}: ${JSON.stringify(value)}`);
    await delay(15);
  }
}
async function listen(server: Server, host?: string) {
  await new Promise<void>((resolve) => server.listen({ port: 0, host }, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}
async function unusedPort() {
  const server = createTcpServer();
  const port = await listen(server, "127.0.0.1");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
const metadataOf = async (db: typeof hostDb, chatId: string) => {
  const raw = (await createChatsStorage(db).getById(chatId))!.metadata;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, any>;
};
const expectCode = (code: string) => (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && error.code === code;

try {
  await app.ready();
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
  const host = new MultiplayerService({ db: hostDb, available: true, tls: () => tls, abortGeneration() {} });
  const guest = new MultiplayerService({ db: guestDb, available: true, tls: () => tls, abortGeneration() {} });
  services.push(host, guest);
  for (const service of services) {
    await service.initialize();
    await service.settings(true);
  }
  const hostSessions = () =>
    (
      host as unknown as {
        host: {
          sessions: Map<string, { participant: { id: string }; status: string; lastSeen: number; polling: boolean }>;
        };
      }
    ).host.sessions;
  const approve = async (displayName: string) => {
    const request = (await host.hostState())!.pendingRequests.find((item) => item.displayName === displayName);
    assert.ok(request, `${displayName} is waiting for approval`);
    return host.hostAction({ type: "approve", requestId: request.id });
  };
  // Stop and disable answer the guest's long poll; wait until the host holds one instead of guessing a delay.
  const pollWaiting = () =>
    until(
      async () => {
        await guest.guestState();
        return [...hostSessions().values()].some((session) => session.status === "approved" && session.polling);
      },
      Boolean,
      "the guest's poll is waiting on the host",
    );
  const connected = (label: string) =>
    until(
      () => guest.guestState(),
      (value) => value?.state.phase === "connected",
      label,
    );

  // A room port that cannot open leaves the prepared setup ready for another try, not a dead "stopped" room.
  const busyPort = createTcpServer();
  const heldPort = await listen(busyPort);
  const conversation = await host.prepare({ mode: "conversation", name: "Lifecycle conversation" });
  try {
    await assert.rejects(
      host.startHost({
        chatId: conversation.chatId,
        publicOrigin: `https://127.0.0.1:${heldPort}`,
        password,
        displayName: "Mari",
        persona: { name: "Captain", description: "" },
      }),
    );
  } finally {
    await new Promise<void>((resolve) => busyPort.close(() => resolve()));
  }
  const unopened = await metadataOf(hostDb, conversation.chatId);
  assert.equal(unopened.multiplayer ?? null, null, "a room that never opened is not left behind as ended");
  assert.equal(unopened.multiplayerSetup, true, "the prepared setup survives a port that would not open");
  assert.equal(await host.hostState(), null);
  const roomA = await host.startHost({
    chatId: conversation.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password,
    displayName: "Mari",
    persona: { name: "Captain", description: "" },
  });
  assert.equal(roomA!.snapshot.status, "active", "the same prepared chat hosts on a free port");

  // Ordinary roster edits cannot silently drift from the room's own roster.
  const characters = createCharactersStorage(hostDb);
  const guide = (await characters.create({ name: "Guide", description: "" } as never))!;
  const bard = (await characters.create({ name: "Bard", description: "" } as never))!;
  await host.hostAction({ type: "add-character", characterId: guide.id, role: "character" });
  await host.hostAction({ type: "add-character", characterId: bard.id, role: "character" });
  const patchRoster = (characterIds: string[]) =>
    app.inject({ method: "PATCH", url: `/api/chats/${conversation.chatId}`, payload: { characterIds } });
  assert.equal((await patchRoster([guide.id])).statusCode, 409, "removal goes through the room roster");
  assert.equal((await patchRoster([guide.id, bard.id, "other_character_1"])).statusCode, 409);
  assert.equal((await patchRoster([bard.id, guide.id])).statusCode, 200, "reordering the same roster still works");
  assert.deepEqual(
    new Set(JSON.parse((await createChatsStorage(hostDb).getById(conversation.chatId))!.characterIds)),
    new Set((await host.hostState())!.snapshot.characters.map((character) => character.id)),
    "the chat and the room keep the same AI roster",
  );

  const joinedA = await guest.join({
    inviteCode: roomA!.invite!.code,
    password,
    displayName: "Alex",
    persona: { name: "Scout", description: "" },
  });
  await approve("Alex");
  const scout = (await connected("guest admitted to the conversation"))!.state.snapshot!.selfId;

  // Leave from another (old) joined chat leaves the live session alone.
  await guest.leaveGuest("old_joined_chat_1");
  assert.equal((await guest.guestState())?.localChatId, joinedA.localChatId);
  assert.ok((await host.hostState())!.snapshot.players.some((player) => player.id === scout && player.connected));
  assert.notEqual((await metadataOf(guestDb, joinedA.localChatId)).multiplayer.status, "ended");

  // Stop answers the guest's waiting poll, so the guest sees the room end instead of "Reconnecting".
  await pollWaiting();
  await host.hostAction({ type: "stop" });
  const stopped = await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "ended",
    "guest learns that the host stopped",
  );
  assert.equal(stopped!.state.error, "room-ended");

  // The ended session no longer blocks joining the next room; a live one still does.
  const game = await host.prepare({ mode: "game", name: "Lifecycle game" });
  const lobby = await host.startHost({
    chatId: game.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password,
    displayName: "Mari",
    persona: { name: "Captain", description: "" },
  });
  const lobbyInvite = decodeMultiplayerInvite(lobby!.invite!.code);
  const joinLyra = () =>
    guest.join({
      inviteCode: lobby!.invite!.code,
      password,
      displayName: "Alex",
      persona: { name: "Lyra", description: "" },
    });
  const joinedB = await joinLyra();
  assert.equal((await metadataOf(guestDb, joinedA.localChatId)).multiplayer.status, "ended");
  await assert.rejects(joinLyra(), expectCode("busy"), "one live joined session at a time");
  await approve("Alex");
  const lyra = (await connected("guest admitted to the game"))!.state.snapshot!.selfId;
  const lyraCards = async () =>
    ((await metadataOf(hostDb, game.chatId)).gameCharacterCards as Array<Record<string, unknown>>).filter(
      (card) => card.name === "Lyra",
    );
  assert.deepEqual(
    (await lyraCards()).map((card) => card.multiplayerParticipantId),
    [lyra],
  );

  // A player who left comes back as the same persona and keeps their seat and sheet.
  await guest.leaveGuest(joinedB.localChatId);
  await until(
    async () => [...hostSessions().values()].filter((session) => session.participant.id === lyra),
    (sessions) => sessions.every((session) => session.status === "revoked"),
    "Leave revokes the old session",
  );
  // Someone else asking for that persona does not get Alex's seat or name.
  const impostor = await requestMultiplayerPeer(lobbyInvite, {
    version: 1,
    type: "join",
    roomId: lobbyInvite.roomId,
    invite: lobbyInvite.invite,
    password,
    displayName: "Rose",
    persona: { name: "Lyra", description: "Rose's description" },
  });
  assert.equal(impostor.type, "admission");
  await assert.rejects(
    approve("Rose"),
    expectCode("identity-conflict"),
    "a departed seat goes back only to its player",
  );
  assert.ok(
    !(await host.hostState())!.pendingRequests.some((item) => item.displayName === "Rose"),
    "the refused request ends, its asker told the name is in use",
  );
  assert.deepEqual((await host.hostState())!.snapshot.players.map((player) => player.displayName).sort(), [
    "Alex",
    "Mari",
  ]);
  await joinLyra();
  await approve("Alex");
  assert.equal((await connected("returning player admitted"))!.state.snapshot!.selfId, lyra);
  assert.deepEqual((await host.hostState())!.snapshot.players.map((player) => player.personaName).sort(), [
    "Captain",
    "Lyra",
  ]);
  assert.deepEqual(
    (await lyraCards()).map((card) => card.multiplayerParticipantId),
    [lyra],
  );

  // Nobody else can take a connected player's name.
  const intruder = await requestMultiplayerPeer(lobbyInvite, {
    version: 1,
    type: "join",
    roomId: lobbyInvite.roomId,
    invite: lobbyInvite.invite,
    password,
    displayName: "Intruder",
    persona: { name: "Lyra", description: "" },
  });
  assert.equal(intruder.type, "admission");
  await assert.rejects(approve("Intruder"), expectCode("identity-conflict"));
  assert.ok(!(await host.hostState())!.pendingRequests.some((item) => item.displayName === "Intruder"));

  // An Engine restart drops the guest's token without telling the host. Once that session is silent,
  // the player can come back as the same persona.
  await guest.settings(false);
  for (const session of hostSessions().values())
    if (session.participant.id === lyra) session.lastSeen = Date.now() - 60_000;
  await guest.settings(true);
  await joinLyra();
  await approve("Alex");
  assert.equal((await connected("player admitted after a restart"))!.state.snapshot!.selfId, lyra);
  assert.equal(
    [...hostSessions().values()].filter((session) => session.participant.id === lyra && session.status === "approved")
      .length,
    1,
    "the lost session is revoked when the player returns",
  );

  // Deleting the joined chat leaves no hidden session that blocks the next join.
  const joinedLast = (await guest.guestState())!.localChatId;
  await createChatsStorage(guestDb).remove(joinedLast);
  await joinLyra();
  await approve("Alex");
  assert.equal((await connected("rejoined after deleting the joined chat"))!.state.snapshot!.selfId, lyra);

  // Turning multiplayer off on the host also reaches the guest.
  await pollWaiting();
  await host.settings(false);
  const disabled = await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "ended",
    "guest learns that the host turned multiplayer off",
  );
  assert.equal(disabled!.state.error, "room-ended");

  // A host answering "disabled" never reads as this Engine's own multiplayer being off,
  // which would make the guest's app stop its own multiplayer controls.
  const closedRoom = await startMultiplayerPeerServer({
    tls,
    port: 0,
    host: "127.0.0.1",
    enabled: () => true,
    handle: async () => ({ version: 1, type: "error", code: "disabled" }),
  });
  try {
    const closedInvite = encodeMultiplayerInvite({
      ...lobbyInvite,
      origin: `https://127.0.0.1:${closedRoom.port}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await assert.rejects(guest.preview(closedInvite), expectCode("room-ended"));
  } finally {
    await closedRoom.close();
  }
  console.info(
    "multiplayer lifecycle: answered Stop/disable, scoped Leave, returning players, stale sessions, unopened ports and roster guard passed",
  );
} finally {
  for (const service of services) await service.close();
  await app.close();
  await guestDb._fileStore.close();
  await closeDB();
  setDefaultCACertificates(previousTrust);
  rmSync(directory, { recursive: true, force: true });
}
