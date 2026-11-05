import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { setTimeout as delay } from "node:timers/promises";

// Display and persona names are public in every snapshot, so they never prove who owns a seat.
// Only the Engine holding that seat's private rejoin key gets it (and its whispers) back,
// and the key never reaches another participant or stored room data. Real TLS between two Engines.
const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-seat-key-"));
Object.assign(process.env, {
  DATA_DIR: directory,
  FILE_STORAGE_DIR: join(directory, "host-store"),
  NODE_ENV: "test",
  MARINARA_LITE: "true",
  LOG_LEVEL: "silent",
});
const previousTrust = getCACertificates("default");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { MultiplayerService, decodeMultiplayerInvite } =
  await import("../../packages/server/src/services/multiplayer/service.js");
const { requestMultiplayerPeer } = await import("../../packages/server/src/services/multiplayer/peer-client.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const hostDb = await getDB();
process.env.FILE_STORAGE_DIR = join(directory, "guest-store");
const guestDb = await createFileNativeDB();
const services: InstanceType<typeof MultiplayerService>[] = [];
const password = "a safe fixture password";
const whisper = "Only Lyra hears this: the lantern is behind the third door.";

async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean, label: string): Promise<T> {
  const deadline = Date.now() + 8_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(Date.now() < deadline, `${label}: ${JSON.stringify(value)}`);
    await delay(15);
  }
}
async function unusedPort() {
  const server = createTcpServer();
  await new Promise<void>((resolve) => server.listen({ port: 0, host: "127.0.0.1" }, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
const expectCode = (code: string) => (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && error.code === code;

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
  const pending = async (displayName: string) => {
    const requests = (await host.hostState())!.pendingRequests.filter((item) => item.displayName === displayName);
    assert.equal(requests.length, 1, `exactly one request from ${displayName} is waiting`);
    return requests[0]!.id;
  };
  const approve = async (displayName: string) =>
    host.hostAction({ type: "approve", requestId: await pending(displayName) });
  const decline = async (displayName: string) =>
    host.hostAction({ type: "decline", requestId: await pending(displayName) });
  const seesWhisper = (state: { snapshot: { messages: Array<{ text: string }> } | null } | undefined) =>
    !!state?.snapshot?.messages.some((message) => message.text.includes(whisper));

  const room = await host.prepare({ mode: "roleplay", name: "Seat key room" });
  const hosted = await host.startHost({
    chatId: room.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password,
    displayName: "Mari",
    persona: { name: "Captain", description: "" },
  });
  const characters = createCharactersStorage(hostDb);
  const guide = (await characters.create({ name: "Guide", description: "" } as never))!;
  await host.hostAction({ type: "add-character", characterId: guide.id, role: "character" });
  const invite = decodeMultiplayerInvite(hosted!.invite!.code);
  const peerJoin = (displayName: string, persona: string, seatKey?: string) =>
    requestMultiplayerPeer(
      invite,
      {
        version: 1,
        type: "join",
        roomId: invite.roomId,
        invite: invite.invite,
        password,
        displayName,
        persona: { name: persona, description: "" },
      },
      { session: seatKey },
    );
  const peerPoll = (token: string) =>
    requestMultiplayerPeer(
      invite,
      { version: 1, type: "poll", roomId: invite.roomId, revision: 0 },
      { session: token },
    );
  const joinLyra = () =>
    guest.join({
      inviteCode: hosted!.invite!.code,
      password,
      displayName: "Alex",
      persona: { name: "Lyra", description: "" },
    });

  // Alex's Engine joins as Lyra; its admission token becomes the seat's private rejoin key.
  await joinLyra();
  await approve("Alex");
  const lyra = (await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "connected",
    "Alex is admitted",
  ))!.state.snapshot!.selfId;

  // A second player joins the way an Engine without rejoin keys does: no key is presented.
  const beaJoin = await peerJoin("Bea", "Mira");
  assert.equal(beaJoin.type, "admission");
  await approve("Bea");
  const beaToken = (beaJoin as { session: string }).session;

  // The AI whispers to Lyra only; adding a character wakes the waiting polls with the new history.
  await createChatsStorage(hostDb).createMessage({
    chatId: room.chatId,
    role: "assistant",
    characterId: guide.id,
    content: "Guide looks around the tavern.",
    extra: {
      roleplayCommandActivity: [
        {
          raw: "[whisper]",
          command: { type: "whisper", character: "Lyra", text: whisper },
          whisperRecipient: { kind: "persona", id: lyra },
        },
      ],
    },
  } as never);
  const bard = (await characters.create({ name: "Bard", description: "" } as never))!;
  await host.hostAction({ type: "add-character", characterId: bard.id, role: "character" });
  await until(async () => (await guest.guestState())?.state, seesWhisper, "Alex reads the whisper addressed to Lyra");
  const beaView = await peerPoll(beaToken);
  assert.equal(beaView.type, "state");
  assert.equal(beaView.state.phase, "connected");
  assert.ok(!seesWhisper(beaView.state), "another player never sees Lyra's whisper");

  // Alex's Engine goes quiet (a hidden tab or another open chat) without leaving.
  await until(
    async () => {
      await guest.guestState();
      return [...hostSessions().values()].some(
        (session) => session.participant.id === lyra && session.status === "approved" && session.polling,
      );
    },
    Boolean,
    "Alex's poll is waiting on the host",
  );
  for (const session of hostSessions().values())
    if (session.participant.id === lyra) session.lastSeen = Date.now() - 60_000;

  // Someone copies both public names. Without the seat's key the host cannot hand the seat over.
  const copycat = await peerJoin("Alex", "Lyra");
  assert.equal(copycat.type, "admission");
  // Its poll waits on the host until the request is decided.
  const copycatPoll = peerPoll((copycat as { session: string }).session);
  copycatPoll.catch(() => undefined); // A failed assertion below must not be hidden by this poll's cleanup.
  await assert.rejects(approve("Alex"), expectCode("identity-conflict"), "copied names do not take Lyra's seat");
  const refusedAt = Date.now();
  assert.ok(
    [...hostSessions().values()].some((session) => session.participant.id === lyra && session.status === "approved"),
    "the refused request never revokes the real player's session",
  );
  // The refusal ends the request, and the one waiting is told why instead of waiting on.
  assert.equal((await host.hostState())!.pendingRequests.filter((item) => item.displayName === "Alex").length, 0);
  const copycatView = await copycatPoll;
  assert.ok(Date.now() - refusedAt < 5_000, "the refusal wakes the waiting poll instead of leaving it to time out");
  assert.equal(copycatView.type, "state");
  assert.equal(copycatView.state.phase, "ended");
  assert.equal(copycatView.state.error, "identity-conflict");
  assert.equal(copycatView.state.snapshot, null, "no history or whispers without the seat");

  // A made-up key is refused the same way.
  const guessed = await peerJoin("Alex", "Lyra", randomBytes(32).toString("base64url"));
  assert.equal(guessed.type, "admission");
  await assert.rejects(approve("Alex"), expectCode("identity-conflict"), "a wrong key does not take the seat");

  // The real player leaves and comes back from the same Engine: same seat, same whispers.
  await guest.leaveGuest();
  await until(
    async () => [...hostSessions().values()].filter((session) => session.participant.id === lyra),
    (sessions) => sessions.every((session) => session.status === "revoked"),
    "Leave revokes Alex's session",
  );
  await joinLyra();
  await approve("Alex");
  const back = (await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "connected" && seesWhisper(value.state),
    "Alex is back with Lyra's whispers",
  ))!;
  assert.equal(back.state.snapshot!.selfId, lyra, "the returning player keeps the same seat");
  assert.deepEqual(
    (await host.hostState())!.snapshot.players.map((player) => player.personaName).sort(),
    ["Captain", "Lyra", "Mira"],
    "no second Lyra seat was created",
  );

  // Neither the key nor its hash reaches another participant, the host's views or stored chat data.
  const keys = [...((guest as unknown as { seatKeys?: Map<string, string> }).seatKeys?.values() ?? [])];
  assert.equal(keys.length, 1, "the guest Engine keeps one rejoin key for this room");
  const seatKey = keys[0]!;
  assert.match(seatKey, /^[A-Za-z0-9_-]{43}$/u);
  const digest = createHash("sha256").update(seatKey).digest();
  const secrets = [seatKey, digest.toString("hex"), digest.toString("base64"), digest.toString("base64url")];
  const visible = [
    JSON.stringify(await host.hostState()),
    JSON.stringify(await peerPoll(beaToken)),
    JSON.stringify(copycatView),
    JSON.stringify(await createChatsStorage(hostDb).list()),
    JSON.stringify(await createChatsStorage(guestDb).list()),
  ];
  for (const text of visible)
    for (const value of secrets) assert.ok(!text.includes(value), "the rejoin key and its hash stay private");

  console.info(
    "multiplayer seat key: copied names and wrong keys never take a seat or its whispers; the key holder returns",
  );
} finally {
  for (const service of services) await service.close();
  await guestDb._fileStore.close();
  await closeDB();
  setDefaultCACertificates(previousTrust);
  rmSync(directory, { recursive: true, force: true });
}
