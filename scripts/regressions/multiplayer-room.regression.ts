import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { setTimeout as delay } from "node:timers/promises";
import type { MultiplayerAction, MultiplayerGuestState, MultiplayerStoredRoom } from "@marinara-engine/shared";
import {
  MultiplayerService,
  decodeMultiplayerInvite,
  encodeMultiplayerInvite,
} from "../../packages/server/src/services/multiplayer/service.js";
import { requestMultiplayerPeer } from "../../packages/server/src/services/multiplayer/peer-client.js";
import { startMultiplayerPeerServer } from "../../packages/server/src/services/multiplayer/peer-server.js";
import {
  createMultiplayerRoomStore,
  createRoomParticipant,
  nextRound,
} from "../../packages/server/src/services/multiplayer/room-store.js";
import {
  projectRoomSnapshot,
  roomVisibleText,
} from "../../packages/server/src/services/multiplayer/room-projection.js";
import {
  createChatsStorage,
  withChatMetadataPatchQueue,
} from "../../packages/server/src/services/storage/chats.storage.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { newId } from "../../packages/server/src/utils/id-generator.js";
import { sendSseEvent, endGenerationOutput } from "../../packages/server/src/routes/generate/sse.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-room-"));
const previousTrust = getCACertificates("default");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
process.env.FILE_STORAGE_DIR = join(directory, "host-store");
const hostDb = await createFileNativeDB();
process.env.FILE_STORAGE_DIR = join(directory, "guest-store");
const guestDb = await createFileNativeDB();
assert.notEqual(hostDb._fileStore.rootDir, guestDb._fileStore.rootDir);
const services: MultiplayerService[] = [];

async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 4_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(Date.now() < deadline, "room condition completed within the focused proof deadline");
    await delay(10);
  }
}
async function unusedPort() {
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  return address.port;
}
const action = (sequence: number, input: Record<string, unknown>) =>
  ({ operationId: newId(), sequence, ...input }) as MultiplayerAction;
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
  const createService = (db: typeof hostDb, available = true) => {
    const service = new MultiplayerService({ db, available, tls: () => tls, abortGeneration() {} });
    services.push(service);
    return service;
  };
  const disabled = createService(hostDb, false);
  await disabled.initialize();
  await assert.rejects(disabled.settings(true), expectCode("disabled"));
  await assert.rejects(disabled.prepare({ mode: "roleplay", name: "Disabled" }), expectCode("disabled"));
  const host = createService(hostDb);
  const guest = createService(guestDb);
  await host.initialize();
  await guest.initialize();
  await assert.rejects(host.prepare({ mode: "roleplay", name: "Disabled" }), expectCode("disabled"));
  await host.settings(true);
  await guest.settings(true);
  const hostChats = createChatsStorage(hostDb);
  const hostCharacters = createCharactersStorage(hostDb);
  const privateCharacter = await hostCharacters.create({
    name: "AI fixture",
    description: "Reviewed character",
  } as never);
  assert.ok(privateCharacter);
  const privateChat = await hostChats.create({
    name: "Private source",
    mode: "roleplay",
    characterIds: [privateCharacter.id],
  } as never);
  assert.ok(privateChat);
  await hostChats.createMessage({
    chatId: privateChat.id,
    role: "user",
    content: "PRIVATE TRANSCRIPT",
    extra: { debug: "PROVIDER SECRET" },
  });
  await hostChats.patchMetadata(privateChat.id, {
    privateNotes: "PRIVATE NOTE",
    activeLorebookIds: ["private-lorebook"],
  });
  const prepared = await host.prepare({ chatId: privateChat.id });
  assert.deepEqual(await hostChats.listMessages(prepared.chatId), [], "preparation never clones private history");
  assert.ok(!JSON.stringify((await hostChats.getById(prepared.chatId))?.metadata).includes("PRIVATE NOTE"));
  const hiddenHistory = await host.prepare({ mode: "roleplay", name: "Hidden history" });
  await hostChats.createMessage({
    chatId: hiddenHistory.chatId,
    role: "system",
    content: "Private hidden context must still prevent hosting this chat.",
    extra: { hiddenFromUser: true },
  });
  await assert.rejects(
    host.startHost({
      chatId: hiddenHistory.chatId,
      publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
      password: "a safe fixture password",
      displayName: "Host fixture",
      persona: { name: "Captain", description: "" },
    }),
    expectCode("invalid-message"),
    "hosting checks every stored message, even when no message would appear in the public projection",
  );
  assert.equal(host.status().hosting, false);
  const started = await host.startHost({
    chatId: prepared.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password: "a safe fixture password",
    displayName: "Host fixture",
    persona: { name: "Captain", description: "Host character" },
  });
  assert.ok(started?.invite);
  const invite = decodeMultiplayerInvite(started.invite.code);
  const preview = await guest.preview(started.invite.code);
  assert.equal(preview.name, "Private source");
  assert.ok(!JSON.stringify(preview).includes("PRIVATE"), "preview discloses no transcript or metadata");
  await assert.rejects(
    guest.join({
      inviteCode: started.invite.code,
      password: "incorrect password",
      displayName: "Guest",
      persona: { name: "Scout", description: "Guest character" },
    }),
    expectCode("wrong-password"),
  );
  let joined = await guest.join({
    inviteCode: started.invite.code,
    password: "a safe fixture password",
    displayName: "Guest",
    persona: { name: "Scout", description: "Guest character" },
  });
  assert.equal(joined.state.phase, "awaiting-approval");
  assert.equal(joined.state.snapshot, null);
  await assert.rejects(
    guest.guestAction(action(0, { type: "message", text: "Before approval" })),
    expectCode("awaiting-approval"),
  );
  await guest.leaveGuest();
  await until(
    () => host.hostState(),
    (value) => value?.pendingRequests.length === 0,
  );
  assert.equal(
    await guest.guestState(),
    null,
    "leaving before approval discards local authority and cancels the pending request",
  );
  joined = await guest.join({
    inviteCode: started.invite.code,
    password: "a safe fixture password",
    displayName: "Guest",
    persona: { name: "Scout", description: "Guest character" },
  });
  const request = (await host.hostState())!.pendingRequests[0]!;
  await host.hostAction({ type: "approve", requestId: request.id });
  const admitted = await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "connected",
  );
  assert.equal(admitted!.state.snapshot!.messages.length, 0);
  assert.notEqual(admitted!.state.snapshot!.selfId, started.snapshot.selfId);
  assert.deepEqual(
    await createChatsStorage(guestDb).listMessages(joined.localChatId),
    [],
    "a joined chat stores no downloaded host transcript",
  );
  const unauthorized = await requestMultiplayerPeer(invite, {
    version: 1,
    roomId: invite.roomId,
    type: "action",
    action: action(0, { type: "message", text: "No session" }),
  });
  assert.deepEqual(unauthorized, { version: 1, type: "error", code: "revoked" });
  await host.hostAction({ type: "pause" });
  await host.hostAction({ type: "configure", automaticReplies: false, maxGenerations: 10 });
  await host.hostAction({ type: "resume" });
  const message = action(0, { type: "message", text: "I examine the door." });
  const accepted = await guest.guestAction(message);
  assert.equal(
    accepted.state.snapshot!.messages.find((item) => item.text === "I examine the door.")!.actorId,
    admitted!.state.snapshot!.selfId,
  );
  await guest.guestAction(message);
  assert.equal(
    (await hostChats.listMessages(prepared.chatId)).filter((item) => item.content === "I examine the door.").length,
    1,
    "duplicate operation is acknowledged without another write",
  );
  await assert.rejects(
    guest.guestAction(action(0, { type: "message", text: "Replay with a new operation" })),
    expectCode("stale-action"),
  );
  const stale = await guest.guestState();
  assert.equal(stale!.state.error, "stale-action");
  assert.equal(stale!.state.snapshot!.nextSequence, 1);
  await guest.guestAction(action(1, { type: "message", text: "Recovered with authoritative sequence." }));
  await assert.rejects(
    guest.guestAction(action(2, { type: "message", text: "/download /api/settings" })),
    expectCode("restricted-command"),
  );
  let generated = 0;
  let releaseGeneration!: () => void;
  const generationGate = new Promise<void>((resolve) => {
    releaseGeneration = resolve;
  });
  host.setRunner(async (input, output, authority) => {
    generated++;
    assert.equal(input.chatId, prepared.chatId);
    assert.equal(authority?.roomId, invite.roomId);
    assert.ok(authority?.operationId);
    await generationGate;
    await hostChats.createMessage({
      chatId: prepared.chatId,
      role: "assistant",
      content: "Public AI reply",
      extra: { providerDebug: "PRIVATE PROVIDER TRACE" },
    });
    sendSseEvent(output, { type: "debug", data: "PRIVATE RAW PROVIDER EVENT" });
    sendSseEvent(output, { type: "done" });
    endGenerationOutput(output);
  });
  await host.hostParticipantAction(action(0, { type: "request-response" }));
  assert.equal((await host.hostState())!.snapshot.generation, "running");
  await assert.rejects(host.hostParticipantAction(action(1, { type: "request-response" })), expectCode("busy"));
  assert.equal(generated, 1, "only one coordinator job owns generation");
  const waitingMessage = action(2, { type: "message", text: "Preserved draft while generation runs." });
  await assert.rejects(guest.guestAction(waitingMessage), expectCode("busy"));
  releaseGeneration();
  const generatedState = await until(
    () => host.hostState(),
    (value) => value?.snapshot.generation === "idle",
  );
  assert.ok(generatedState!.snapshot.messages.some((item) => item.text === "Public AI reply"));
  assert.ok(
    !JSON.stringify(generatedState!.snapshot).includes("PRIVATE"),
    "internal provider events and extra fields never enter the snapshot",
  );
  await guest.guestAction(waitingMessage);
  assert.equal(
    (await hostChats.listMessages(prepared.chatId)).filter(
      (message) => message.content === "Preserved draft while generation runs.",
    ).length,
    1,
  );
  await host.hostAction({ type: "revoke-invite" });
  await assert.rejects(guest.preview(started.invite.code), expectCode("invalid-invite"));
  await guest.guestAction(action(3, { type: "message", text: "Existing admitted session remains scoped." }));
  let guestSequence = 4;
  await guest.guestAction(action(guestSequence++, { type: "message", text: "/send A manual attributed message." }));
  await guest.guestAction(action(guestSequence++, { type: "message", text: "/roll 1d1" }));
  assert.equal(generated, 1, "manual Send and dice commands do not request AI generation");
  const commandMessages = await hostChats.listMessages(prepared.chatId);
  assert.ok(commandMessages.some((item) => item.content === "A manual attributed message."));
  assert.ok(commandMessages.some((item) => item.content === "🎲 1d1 → 1 [1]"));
  const usersBeforeTrigger = commandMessages.filter((item) => item.role === "user").length;
  await guest.guestAction(action(guestSequence++, { type: "message", text: "/trigger" }));
  await until(
    () => host.hostState(),
    (value) => value?.snapshot.generation === "idle",
  );
  assert.equal(generated, 2, "Trigger uses the host coordinator exactly once");
  assert.equal(
    (await hostChats.listMessages(prepared.chatId)).filter((item) => item.role === "user").length,
    usersBeforeTrigger,
    "Trigger does not fabricate a user message",
  );
  const libraryCompanion = await hostCharacters.create({
    name: "Library companion",
    description: "Original card",
  } as never);
  assert.ok(libraryCompanion);
  const cardCountBeforeRosterChanges = (await hostCharacters.list()).length;
  const addedCharacter = await host.hostAction({
    type: "add-character",
    characterId: libraryCompanion.id,
    role: "character",
  });
  assert.ok(addedCharacter!.snapshot.characters.some((item) => item.id === libraryCompanion.id));
  assert.equal(
    (await hostCharacters.list()).length,
    cardCountBeforeRosterChanges,
    "adding the host's existing card does not duplicate it",
  );
  await host.hostAction({ type: "remove-character", characterId: libraryCompanion.id });
  assert.ok(!(await host.hostState())!.snapshot.characters.some((item) => item.id === libraryCompanion.id));
  assert.deepEqual(
    await hostCharacters.getById(libraryCompanion.id),
    libraryCompanion,
    "removing a room actor preserves the library card",
  );

  const proposed = action(guestSequence++, {
    type: "propose-character",
    character: { name: "Guest proposed AI", description: "Reviewed inert character text", role: "character" },
  });
  await guest.guestAction(proposed);
  const pendingProposal = (await host.hostState())!.proposals[0]!;
  assert.equal(pendingProposal.participantId, admitted!.state.snapshot!.selfId);
  assert.equal(
    (await hostCharacters.list()).length,
    cardCountBeforeRosterChanges,
    "a guest proposal cannot import a card by itself",
  );
  assert.ok(!(await host.hostState())!.snapshot.characters.some((item) => item.name === "Guest proposed AI"));
  await host.hostAction({ type: "proposal-decline", proposalId: pendingProposal.id });
  assert.equal((await hostCharacters.list()).length, cardCountBeforeRosterChanges);
  const approvedProposal = { ...proposed, operationId: newId(), sequence: guestSequence++ };
  await guest.guestAction(approvedProposal);
  const approvedRoster = await host.hostAction({ type: "proposal-approve", proposalId: approvedProposal.operationId });
  const importedCharacter = approvedRoster!.snapshot.characters.find((item) => item.name === "Guest proposed AI")!;
  assert.ok(importedCharacter);
  assert.equal(
    (await hostCharacters.list()).length,
    cardCountBeforeRosterChanges + 1,
    "only explicit host approval saves the proposed text card",
  );
  await host.hostAction({ type: "remove-character", characterId: importedCharacter.id });
  assert.ok(
    await hostCharacters.getById(importedCharacter.id),
    "removing an approved proposal also leaves its explicitly saved library card intact",
  );

  let lastProposal = proposed;
  for (let index = 0; index < 8; index++) {
    lastProposal = action(guestSequence++, {
      type: "propose-character",
      character: { name: `Bounded proposal ${index}`, description: "", role: "character" },
    });
    await guest.guestAction(lastProposal);
  }
  await guest.guestAction(lastProposal);
  assert.equal(
    (await host.hostState())!.proposals.length,
    8,
    "a lost proposal acknowledgement remains retryable at capacity",
  );
  await host.hostAction({ type: "proposal-decline", proposalId: (await host.hostState())!.proposals[0]!.id });
  const racingProposals = await Promise.allSettled(
    [0, 1].map((offset) =>
      guest.guestAction(
        action(guestSequence + offset, {
          type: "propose-character",
          character: { name: `Racing proposal ${offset}`, description: "", role: "character" },
        }),
      ),
    ),
  );
  assert.equal(racingProposals[0]!.status, "fulfilled");
  assert.ok(racingProposals[1]!.status === "rejected" && expectCode("busy")(racingProposals[1]!.reason));
  guestSequence++;
  assert.equal(
    (await host.hostState())!.proposals.length,
    8,
    "concurrent proposals cannot exceed the bounded review queue",
  );
  await host.hostAction({ type: "kick", participantId: admitted!.state.snapshot!.selfId });
  await assert.rejects(
    guest.guestAction(action(guestSequence, { type: "message", text: "After kick" })),
    expectCode("revoked"),
  );
  await guest.leaveGuest();
  const queuedInvite = decodeMultiplayerInvite((await host.hostAction({ type: "invite" }))!.invite!.code);
  const queuedAdmission = await requestMultiplayerPeer(queuedInvite, {
    version: 1,
    type: "join",
    roomId: queuedInvite.roomId,
    invite: queuedInvite.invite,
    password: "a safe fixture password",
    displayName: "Queued guest",
    persona: { name: "Queue actor", description: "" },
  });
  assert.equal(queuedAdmission.type, "admission");
  if (queuedAdmission.type !== "admission") throw new Error("Expected queue fixture admission");
  const queuedRequest = (await host.hostState())!.pendingRequests.find((item) => item.displayName === "Queued guest")!;
  await host.hostAction({ type: "approve", requestId: queuedRequest.id });
  let releaseQueue!: () => void;
  let queueEntered!: () => void;
  let actionQueued!: () => void;
  const queueReady = new Promise<void>((resolve) => {
    queueEntered = resolve;
  });
  const queueGate = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  const actionReady = new Promise<void>((resolve) => {
    actionQueued = resolve;
  });
  const heldQueue = withChatMetadataPatchQueue(prepared.chatId, async () => {
    queueEntered();
    await queueGate;
  });
  await queueReady;
  // Observe entry into the real store method without replacing its queue or transaction.
  const activeStore = (host as unknown as { host: { store: ReturnType<typeof createMultiplayerRoomStore> } }).host
    .store;
  const realAction = activeStore.action;
  activeStore.action = (...args) => {
    const pending = realAction(...args);
    actionQueued();
    return pending;
  };
  try {
    const queuedMessage = requestMultiplayerPeer(
      queuedInvite,
      {
        version: 1,
        type: "action",
        roomId: queuedInvite.roomId,
        action: action(0, { type: "message", text: "MUST NOT SURVIVE LEAVE" }),
      },
      { session: queuedAdmission.session },
    );
    await Promise.race([
      actionReady,
      delay(2_000).then(() => {
        throw new Error("Room action did not reach the queue");
      }),
    ]);
    const left = await requestMultiplayerPeer(
      queuedInvite,
      {
        version: 1,
        type: "action",
        roomId: queuedInvite.roomId,
        action: action(999, { type: "leave" }),
      },
      { session: queuedAdmission.session },
    );
    assert.equal(left.type, "accepted", "Leave revokes the session without acquiring the held room queue");
    releaseQueue();
    assert.deepEqual(await queuedMessage, { version: 1, type: "error", code: "disconnected" });
    assert.ok(
      !(await hostChats.listMessages(prepared.chatId)).some((item) => item.content === "MUST NOT SURVIVE LEAVE"),
      "a queued action cannot write after its session leaves",
    );
  } finally {
    activeStore.action = realAction;
    releaseQueue();
    await heldQueue;
  }
  await host.hostAction({ type: "stop" });
  await assert.rejects(
    requestMultiplayerPeer(invite, { version: 1, roomId: invite.roomId, type: "preview", invite: invite.invite }),
  );

  const libraryGm = await hostCharacters.create({ name: "Library GM", description: "Reviewed game master" } as never);
  assert.ok(libraryGm);
  const preparedGame = await host.prepare({ mode: "game", name: "Prepared shared Game" });
  const wizardConfig = { gmMode: "character", gmCharacterId: libraryGm.id, partyCharacterIds: [privateCharacter.id] };
  await hostChats.patchMetadata(preparedGame.chatId, { gameSetupConfig: wizardConfig });
  const cardCountBeforeGame = (await hostCharacters.list()).length;
  const lobby = await host.startHost({
    chatId: preparedGame.chatId,
    publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
    password: "a safe fixture password",
    displayName: "Host fixture",
    persona: { name: "Captain", description: "" },
  });
  assert.equal(lobby!.snapshot.status, "lobby");
  assert.deepEqual(
    lobby!.snapshot.characters.map((item) => [item.id, item.role]).sort(),
    [
      [libraryGm.id, "gm"],
      [privateCharacter.id, "character"],
    ].sort(),
    "wizard-selected GM and party are both part of the approved room roster before generation",
  );
  assert.equal((await hostCharacters.list()).length, cardCountBeforeGame);
  await host.hostAction({ type: "add-character", characterId: libraryCompanion.id, role: "character" });
  await host.hostAction({ type: "remove-character", characterId: privateCharacter.id });
  const lobbyMetadata = (await hostChats.getById(preparedGame.chatId))!.metadata;
  const lobbyConfig = (typeof lobbyMetadata === "string" ? JSON.parse(lobbyMetadata) : lobbyMetadata).gameSetupConfig;
  assert.deepEqual(
    lobbyConfig.partyCharacterIds,
    [libraryCompanion.id],
    "Game setup follows the reviewed roster after lobby changes",
  );
  assert.equal(lobbyConfig.gmCharacterId, libraryGm.id);
  await guest.join({
    inviteCode: lobby!.invite!.code,
    password: "a safe fixture password",
    displayName: "Game guest",
    persona: { name: "Scout", description: "" },
  });
  await host.hostAction({ type: "approve", requestId: (await host.hostState())!.pendingRequests[0]!.id });
  const gameGuest = await until(
    () => guest.guestState(),
    (value) => value?.state.phase === "connected",
  );
  const gameGuestId = gameGuest!.state.snapshot!.selfId;
  let gameStartCalls = 0;
  let gameFinishCalls = 0;
  host.setGameRuntime({
    async runGameStart(input) {
      gameStartCalls++;
      assert.equal(input.chatId, preparedGame.chatId);
      assert.deepEqual(
        input.config.partyCharacterIds,
        [libraryCompanion.id],
        "stale wizard inputs cannot restore a removed actor",
      );
      assert.equal(input.config.gmCharacterId, libraryGm.id);
    },
    async finishGameTurn() {
      gameFinishCalls++;
    },
  });
  await host.hostAction({ type: "startGame", config: wizardConfig as never, preferences: "" });
  const startedGame = await until(
    () => host.hostState(),
    (value) => value?.snapshot.generation === "idle",
  );
  assert.equal(gameStartCalls, 1);
  assert.equal(startedGame!.snapshot.status, "active");
  assert.ok(startedGame!.snapshot.round);
  assert.equal((await hostCharacters.list()).length, cardCountBeforeGame);
  await hostChats.patchMetadata(preparedGame.chatId, {
    gameNpcs: [{ name: "Harbormaster" }],
    gamePartyCharacterIds: [libraryCompanion.id, "npc:harbormaster", "npc:unknown", "unapproved_library_card"],
  });
  await host.hostAction({ type: "add-character", characterId: privateCharacter.id, role: "character" });
  const partyAfterAdd = JSON.parse((await hostChats.getById(preparedGame.chatId))!.metadata).gamePartyCharacterIds;
  assert.deepEqual(
    partyAfterAdd,
    [libraryCompanion.id, privateCharacter.id, "npc:harbormaster"],
    "adding an approved AI during an active Game preserves only tracked room NPC companions",
  );
  await host.hostAction({ type: "remove-character", characterId: privateCharacter.id });
  const afterRemove = (await hostChats.getById(preparedGame.chatId))!;
  assert.deepEqual(
    JSON.parse(afterRemove.metadata).gamePartyCharacterIds,
    [libraryCompanion.id, "npc:harbormaster"],
    "removing an AI during an active Game preserves the tracked NPC companion",
  );
  assert.deepEqual(
    JSON.parse(afterRemove.characterIds),
    [libraryGm.id, libraryCompanion.id],
    "tracked NPCs remain room state and never become approved library actors",
  );
  let releaseGameResolution!: () => void;
  const gameResolutionGate = new Promise<void>((resolve) => {
    releaseGameResolution = resolve;
  });
  let gameResolutionCalls = 0;
  host.setRunner(async (input, output, authority) => {
    assert.equal(input.chatId, preparedGame.chatId);
    assert.equal(authority!.roundId, startedGame!.snapshot.round!.id);
    gameResolutionCalls++;
    await gameResolutionGate;
    await hostChats.createMessage({
      chatId: preparedGame.chatId,
      role: "assistant",
      characterId: libraryGm.id,
      content: "Locked Game resolution.",
    });
    sendSseEvent(output, { type: "done" });
    endGenerationOutput(output);
  });
  try {
    const lockedRoundId = startedGame!.snapshot.round!.id;
    await host.hostParticipantAction(
      action(0, {
        type: "submit-action",
        roundId: lockedRoundId,
        submissionRevision: 0,
        text: "Captain investigates.",
      }),
    );
    await guest.guestAction(
      action(0, {
        type: "submit-action",
        roundId: lockedRoundId,
        submissionRevision: 0,
        text: "Scout watches the door.",
      }),
    );
    assert.equal(gameResolutionCalls, 1);
    const kickedWhileRunning = await host.hostAction({ type: "kick", participantId: gameGuestId });
    assert.equal(
      kickedWhileRunning!.snapshot.generation,
      "running",
      "Kick does not cancel or replace the already-owned generation claim",
    );
    assert.equal(kickedWhileRunning!.snapshot.round!.id, lockedRoundId);
    assert.equal(kickedWhileRunning!.snapshot.round!.phase, "resolving");
    assert.ok(
      kickedWhileRunning!.snapshot.round!.requiredParticipantIds.includes(gameGuestId),
      "the resolving round keeps the kicked player's committed action",
    );
    assert.ok(!kickedWhileRunning!.snapshot.players.some((player) => player.id === gameGuestId));
    assert.equal(gameResolutionCalls, 1, "Kick cannot start a second Game resolution");
    await assert.rejects(
      guest.guestAction(action(1, { type: "pass", roundId: lockedRoundId, submissionRevision: 1 })),
      expectCode("revoked"),
    );
    const kickedGuest = await until(
      () => guest.guestState(),
      (value) => value?.state.phase === "ended",
    );
    assert.equal(kickedGuest!.state.error, "revoked");
    assert.equal(
      kickedGuest!.state.snapshot,
      null,
      "revocation removes access without waiting for provider completion",
    );
    releaseGameResolution();
    const nextGameRound = await until(
      () => host.hostState(),
      (value) => value?.snapshot.generation === "idle" && value.snapshot.round?.number === 2,
    );
    assert.equal(gameResolutionCalls, 1);
    assert.equal(gameFinishCalls, 1);
    assert.deepEqual(nextGameRound!.snapshot.round!.requiredParticipantIds, [startedGame!.snapshot.selfId]);
    assert.equal(nextGameRound!.snapshot.messages.filter((item) => item.text === "Locked Game resolution.").length, 1);
    assert.equal((await hostChats.listMessages(preparedGame.chatId)).filter((item) => item.role === "user").length, 2);
  } finally {
    releaseGameResolution();
  }
  await guest.leaveGuest();
  await host.hostAction({ type: "stop" });

  // A hostile but certificate-pinned host must not replace the admitted actor or
  // rewind the accepted revision by first sending a reconnect state with no snapshot.
  const boundSnapshot = { ...generatedState!.snapshot, revision: 7 };
  let peerState: MultiplayerGuestState = { phase: "connected", snapshot: boundSnapshot, error: null };
  let peerPolls = 0;
  const hostilePeer = await startMultiplayerPeerServer({
    tls,
    port: 0,
    host: "127.0.0.1",
    enabled: () => true,
    async handle(message) {
      if (message.type === "preview")
        return {
          version: 1,
          type: "preview",
          roomId: boundSnapshot.roomId,
          name: boundSnapshot.name,
          mode: boundSnapshot.mode,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      if (message.type === "join") return { version: 1, type: "admission", session: "s".repeat(43) };
      if (message.type === "poll") {
        peerPolls++;
        return { version: 1, type: "state", state: peerState };
      }
      return { version: 1, type: "accepted", operationId: message.action.operationId, state: peerState };
    },
  });
  const boundGuest = createService(guestDb);
  try {
    await boundGuest.initialize();
    await boundGuest.settings(true);
    await boundGuest.join({
      inviteCode: encodeMultiplayerInvite({
        version: 1,
        origin: `https://127.0.0.1:${hostilePeer.port}`,
        roomId: boundSnapshot.roomId,
        fingerprint: new X509Certificate(tls.cert).fingerprint256.replaceAll(":", "").toLowerCase(),
        invite: "i".repeat(43),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      password: "a safe fixture password",
      displayName: "Bound guest",
      persona: { name: "Bound actor", description: "" },
    });
    await until(
      () => boundGuest.guestState(),
      (value) => value?.state.snapshot?.revision === 7,
    );
    peerState = { phase: "reconnecting", snapshot: null, error: "disconnected" };
    await until(
      () => boundGuest.guestState(),
      (value) => value?.state.phase === "reconnecting" && !value.state.snapshot,
    );
    peerState = { phase: "connected", snapshot: { ...boundSnapshot, revision: 6 }, error: null };
    const pollsBeforeRollback = peerPolls;
    await until(
      async () => {
        await boundGuest.guestState();
        return peerPolls;
      },
      (value) => value >= pollsBeforeRollback + 2,
    );
    assert.equal((await boundGuest.guestState())!.state.snapshot, null, "null state cannot erase revision binding");
    peerState = { phase: "connected", snapshot: { ...boundSnapshot, revision: 8 }, error: null };
    await until(
      () => boundGuest.guestState(),
      (value) => value?.state.snapshot?.revision === 8,
    );
    peerState = { phase: "reconnecting", snapshot: null, error: "disconnected" };
    await until(
      () => boundGuest.guestState(),
      (value) => value?.state.phase === "reconnecting" && !value.state.snapshot,
    );
    peerState = {
      phase: "connected",
      snapshot: { ...boundSnapshot, revision: 9, selfId: admitted!.state.snapshot!.selfId },
      error: null,
    };
    const rejectedIdentity = await until(
      () => boundGuest.guestState(),
      (value) => value?.state.phase === "ended",
    );
    assert.equal(rejectedIdentity!.state.error, "invalid-message");
    assert.equal(rejectedIdentity!.state.snapshot, null, "null state cannot erase the admitted actor binding");
  } finally {
    await boundGuest.close();
    await hostilePeer.close();
  }

  // Durable room semantics use the real store/transaction queue, independent of
  // the provider so concurrent submissions can be forced through the barrier.
  const game = await hostChats.create({ name: "Shared Game", mode: "game", characterIds: [] } as never);
  assert.ok(game);
  const hostPlayer = createRoomParticipant("Host", { name: "Captain", description: "" }, true);
  const guestPlayer = createRoomParticipant("Guest", { name: "Scout", description: "" });
  const room: MultiplayerStoredRoom = {
    version: 1,
    role: "host",
    roomId: newId(),
    epoch: newId(),
    revision: 1,
    status: "active",
    generation: "idle",
    generationOperationId: null,
    automaticReplies: true,
    pendingResponse: false,
    generations: 0,
    maxGenerations: 10,
    participants: [hostPlayer, guestPlayer],
    characters: [],
    round: null,
    receipts: [],
    lastActivityAt: new Date().toISOString(),
  };
  room.round = nextRound(room);
  await hostChats.patchMetadata(game.id, { multiplayer: room });
  const store = createMultiplayerRoomStore(hostDb, game.id, room.roomId, room.epoch);
  const roundId = room.round.id;
  assert.equal(
    (
      await store.action(
        hostPlayer.id,
        action(0, { type: "submit-action", roundId, submissionRevision: 0, text: "PRIVATE PENDING ACTION" }),
      )
    ).claim,
    null,
  );
  const beforeGuest = await store.read();
  const projection = projectRoomSnapshot({
    room: beforeGuest.room,
    chat: beforeGuest.chat,
    selfId: guestPlayer.id,
    connected: new Set(),
    messages: [],
  });
  assert.equal(projection.round!.ownSubmission, null);
  assert.ok(!JSON.stringify(projection).includes("PRIVATE PENDING ACTION"));
  assert.equal(
    (
      await store.action(
        hostPlayer.id,
        action(1, { type: "submit-action", roundId, submissionRevision: 1, text: "Edited host action" }),
      )
    ).claim,
    null,
  );
  const latePlayer = createRoomParticipant("Late guest", { name: "Healer", description: "" });
  await store.admit(latePlayer);
  assert.equal((await store.read()).room.participants.find((p) => p.id === latePlayer.id)!.joinsNextRound, true);
  await assert.rejects(
    store.action(latePlayer.id, action(0, { type: "pass", roundId, submissionRevision: 0 })),
    expectCode("stale-action"),
  );
  await store.action(
    hostPlayer.id,
    action(2, { type: "set-persona", persona: { name: "Changed Captain", description: "Later" } }),
  );
  const lastAction = action(0, { type: "submit-action", roundId, submissionRevision: 0, text: "Guest action" });
  const [completed, duplicate] = await Promise.all([
    store.action(guestPlayer.id, lastAction),
    store.action(guestPlayer.id, lastAction),
  ]);
  assert.ok(completed.claim, "standalone GM with no companion characters resolves the complete human round");
  assert.equal(duplicate.claim, null);
  assert.equal(duplicate.duplicate, true);
  const roundMessages = await hostChats.listMessages(game.id);
  assert.equal(roundMessages.length, 2);
  assert.equal(
    JSON.stringify(roundMessages).includes("Changed Captain"),
    false,
    "persona change takes effect after the current round",
  );
  await store.finishGeneration(completed.claim, false);
  assert.equal((await store.read()).room.round!.phase, "interrupted");
  assert.equal((await store.read()).room.status, "paused");
  assert.equal(await store.beginGeneration(), null, "a failed round is never automatically retried");
  await store.resume();
  const next = (await store.read()).room;
  assert.equal(next.round!.number, 2);
  assert.equal(next.participants.find((p) => p.id === hostPlayer.id)!.persona.name, "Changed Captain");
  assert.ok(next.round!.requiredParticipantIds.includes(latePlayer.id));
  assert.equal(
    await store.finishGeneration(completed.claim, true),
    null,
    "late completion cannot replay an interrupted round",
  );
  assert.equal((await store.read()).room.round!.number, 2);
  for (let sequence = 3; sequence < 133; sequence++) {
    await store.action(
      hostPlayer.id,
      action(sequence, {
        type: "set-persona",
        persona: { name: "Changed Captain", description: `Future ${sequence}` },
      }),
    );
  }
  assert.ok(!(await store.read()).room.receipts.some((receipt) => receipt.operationId === lastAction.operationId));
  await assert.rejects(
    store.action(guestPlayer.id, lastAction),
    expectCode("stale-action"),
    "sequence prevents replay after the bounded receipt cache evicts its operation",
  );
  assert.equal(await store.hostPass(hostPlayer.id), null);
  assert.equal(
    await store.hostPass(guestPlayer.id),
    null,
    "the joined player's next-round slot cannot silently disappear",
  );
  const afterKick = await store.kick(latePlayer.id);
  assert.ok(afterKick, "explicit host removal resolves the now-complete roster");
  assert.equal((await hostChats.listMessages(game.id)).filter((item) => item.role === "user").length, 4);
  await store.finishGeneration(afterKick, true);
  assert.equal(
    roomVisibleText("<think>SECRET REASONING</think>Public narration", "roleplay", next, guestPlayer.id),
    "Public narration",
  );
  const privateDialogue =
    "[Guide][thought]SECRET THOUGHT\ncontinued secret\n[Guide][whisper:Changed Captain]SECRET HOST WHISPER\n[Guide][main]Public dialogue";
  const visible = roomVisibleText(privateDialogue, "game", next, guestPlayer.id);
  assert.ok(!visible.includes("SECRET"));
  assert.ok(visible.includes("Public dialogue"));
  const secretRows = [
    {
      id: newId(),
      role: "system",
      characterId: null,
      content: "SECRET SYSTEM",
      extra: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: newId(),
      role: "user",
      characterId: null,
      content: "SECRET OLD HISTORY",
      extra: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: newId(),
      role: "assistant",
      characterId: null,
      content: "SECRET HIDDEN",
      extra: { hiddenFromUser: true },
      createdAt: new Date().toISOString(),
    },
  ];
  assert.equal(
    projectRoomSnapshot({
      room: next,
      chat: { name: "Game", mode: "game" },
      selfId: guestPlayer.id,
      connected: new Set(),
      messages: secretRows,
    }).messages.length,
    0,
  );
  await store.stop();
  await assert.rejects(
    store.action(guestPlayer.id, action(1, { type: "pass", roundId: next.round!.id, submissionRevision: 0 })),
    expectCode("room-ended"),
  );
  console.info(
    "multiplayer room: real TLS admission, settings gates, no private history, ownership, revocation, replay, two-player barrier and private projection passed",
  );
} finally {
  for (const service of services) await service.close();
  await hostDb._fileStore.close();
  await guestDb._fileStore.close();
  setDefaultCACertificates(previousTrust);
  rmSync(directory, { recursive: true, force: true });
}
