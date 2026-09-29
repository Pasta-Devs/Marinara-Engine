import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { setTimeout as delay } from "node:timers/promises";
import type { MultiplayerAction } from "@marinara-engine/shared";
import type { GenerationRunner } from "../../packages/server/src/routes/generate.routes.js";
import type { RoomGameRuntime } from "../../packages/server/src/services/multiplayer/game-runtime.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-flows-"));
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
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { gameRoutes, parseRoomGameConfig } = await import("../../packages/server/src/routes/game.routes.js");
const { MultiplayerService } = await import("../../packages/server/src/services/multiplayer/service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { newId } = await import("../../packages/server/src/utils/id-generator.js");
const hostDb = await getDB();
process.env.FILE_STORAGE_DIR = join(directory, "guest-store");
const guestDb = await createFileNativeDB();
assert.notEqual(hostDb._fileStore.rootDir, guestDb._fileStore.rootDir);
const app = Fastify();
app.decorate("db", hostDb);
let runner: GenerationRunner | undefined;
let gameRuntime: RoomGameRuntime | undefined;
await app.register(generateRoutes, {
  prefix: "/api/generate",
  onRunnerReady: (value) => {
    runner = value;
  },
});
await app.register(gameRoutes, {
  prefix: "/api/game",
  onRoomRuntimeReady: (value) => {
    gameRuntime = value;
  },
});
const services: InstanceType<typeof MultiplayerService>[] = [];
let mode: "conversation" | "roleplay" | "game" = "conversation";
const prompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString();
  const input = JSON.parse(raw);
  prompts.push(raw);
  const content =
    mode === "game" && !input.stream
      ? JSON.stringify({
          storyArc: "Discover the harbor.",
          worldOverview: "A harbor town.",
          plotTwists: ["A sealed letter."],
          startingNpcs: [{ name: "Harbormaster", reputation: 0 }],
          characterCards: [{ name: "Luna" }, { name: "Rowan" }],
        })
      : mode === "game"
        ? `[Narrator][main]Shared Game result ${prompts.length}.\n[state: dialogue]\n[choices: Inspect the letter | Visit the docks]`
        : `Shared ${mode} result ${prompts.length}.`;
  response.writeHead(200, { "content-type": input.stream ? "text/event-stream" : "application/json" });
  if (input.stream)
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  else
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
});
async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 8_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(Date.now() < deadline, `full ${mode} session reached its expected state: ${JSON.stringify(value)}`);
    await delay(15);
  }
}
async function unusedPort() {
  const server = createTcpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
const action = (sequence: number, fields: Record<string, unknown>) =>
  ({ operationId: newId(), sequence, ...fields }) as MultiplayerAction;
try {
  await app.ready();
  assert.ok(runner && gameRuntime, "the real route registrations expose both trusted execution paths");
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const providerAddress = provider.address();
  assert.ok(providerAddress && typeof providerAddress !== "string");
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
  const guest = new MultiplayerService({ db: guestDb, available: true, tls: () => null, abortGeneration() {} });
  services.push(host, guest);
  await host.initialize();
  await guest.initialize();
  await host.settings(true);
  await guest.settings(true);
  host.setRunner(runner);
  host.setGameRuntime(gameRuntime);
  const chats = createChatsStorage(hostDb);
  const connection = await createConnectionsStorage(hostDb).create({
    name: "Full shared session",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${providerAddress.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 16384,
    maxTokensOverride: 2048,
  });
  const presets = createPromptsStorage(hostDb);
  const preset = await presets.create({
    name: "Shared session fixture",
    parameters: { maxTokens: 2048 },
    wrapFormat: "xml",
  });
  assert.ok(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const character = await createCharactersStorage(hostDb).create({
    name: "Guide",
    description: "A friendly guide.",
  } as never);
  assert.ok(character);
  for (mode of ["conversation", "roleplay", "game"] as const) {
    const prepared = await host.prepare({ mode, name: `Full ${mode}` });
    await chats.update(prepared.chatId, {
      characterIds: mode === "game" ? [] : [character.id],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    await chats.patchMetadata(prepared.chatId, { enableAgents: false, automaticSummaryEnabled: false });
    const hosted = await host.startHost({
      chatId: prepared.chatId,
      publicOrigin: `https://127.0.0.1:${await unusedPort()}`,
      password: "a safe fixture password",
      displayName: "Mari",
      persona: { name: "Luna", description: "A patient investigator." },
    });
    assert.ok(hosted?.invite);
    const joined = await guest.join({
      inviteCode: hosted.invite.code,
      password: "a safe fixture password",
      displayName: "Alex",
      persona: { name: "Rowan", description: "A careful traveller." },
    });
    await host.hostAction({ type: "approve", requestId: (await host.hostState())!.pendingRequests[0]!.id });
    const admitted = await until(
      () => guest.guestState(),
      (value) => value?.state.phase === "connected",
    );
    const guestId = admitted!.state.snapshot!.selfId;
    const hostId = hosted.snapshot.selfId;
    const beforeGeneration = prompts.length;
    if (mode === "game") {
      const config = parseRoomGameConfig({
        genre: "fantasy",
        setting: "A harbor",
        tone: "adventure",
        difficulty: "normal",
        playerGoals: "Find the letter",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        enableAgents: false,
      });
      await host.hostAction({ type: "startGame", config, preferences: "" });
      const started = await until(
        () => host.hostState(),
        (value) => value?.snapshot.generation === "idle" && !!value.snapshot.round,
      );
      assert.equal(
        prompts.length,
        beforeGeneration + 2,
        "Game setup and introduction each use the real provider path once",
      );
      const roundId = started!.snapshot.round!.id;
      await host.hostParticipantAction(
        action(0, { type: "submit-action", roundId, submissionRevision: 0, text: "Luna inspects the letter." }),
      );
      assert.equal(prompts.length, beforeGeneration + 2, "one human action cannot resolve a two-player Game round");
      assert.equal((await chats.listMessages(prepared.chatId)).filter((item) => item.role === "user").length, 0);
      const lastAction = action(0, {
        type: "submit-action",
        roundId,
        submissionRevision: 0,
        text: "Rowan guards the doorway.",
      });
      await guest.guestAction(lastAction);
      await guest.guestAction(lastAction);
      await until(
        () => host.hostState(),
        (value) => value?.snapshot.generation === "idle" && value.snapshot.round?.number === 2,
      );
      assert.equal(
        prompts.length,
        beforeGeneration + 3,
        "both submitted actions produce exactly one Game resolution, including a duplicate retry",
      );
    } else {
      await host.hostAction({ type: "pause" });
      await host.hostAction({ type: "configure", automaticReplies: false, maxGenerations: 10 });
      await host.hostAction({ type: "resume" });
      await host.hostParticipantAction(action(0, { type: "message", text: "Luna inspects the letter." }));
      await guest.guestAction(action(0, { type: "message", text: "Rowan guards the doorway." }));
      assert.equal(prompts.length, beforeGeneration);
      await host.hostParticipantAction(action(1, { type: "request-response" }));
      await until(
        () => host.hostState(),
        (value) => value?.snapshot.generation === "idle",
      );
      assert.equal(prompts.length, beforeGeneration + 1, `${mode} dispatches one real generation`);
    }
    const finalHost = (await host.hostState())!;
    assert.equal(finalHost.snapshot.generation, "idle");
    const finalGuest = await until(
      () => guest.guestState(),
      (value) => (value?.state.snapshot?.revision ?? -1) >= finalHost.snapshot.revision,
    );
    assert.deepEqual(
      finalGuest!.state.snapshot!.messages,
      finalHost.snapshot.messages,
      "both participants receive the same public result from the real generation pipeline",
    );
    assert.ok(
      finalHost.snapshot.messages.some((item) =>
        item.text.includes(`Shared ${mode === "game" ? "Game" : mode} result`),
      ),
    );
    const userMessages = finalHost.snapshot.messages.filter((item) => item.kind === "user");
    assert.deepEqual(
      userMessages
        .map((item) => [item.actorId, item.actorName])
        .sort((left, right) => String(left[1]).localeCompare(String(right[1]))),
      [
        [hostId, "Luna"],
        [guestId, "Rowan"],
      ],
    );
    assert.ok(
      prompts.at(-1)!.includes("Luna inspects the letter.") && prompts.at(-1)!.includes("Rowan guards the doorway."),
    );
    assert.ok(
      prompts.slice(beforeGeneration).every((prompt) => prompt.includes("Luna") && prompt.includes("Rowan")),
      "every actual prompt retains the two distinct human personas",
    );
    assert.deepEqual(
      await createChatsStorage(guestDb).listMessages(joined.localChatId),
      [],
      "real generation never imports the host transcript into the guest store",
    );
    await guest.leaveGuest();
    await host.hostAction({ type: "stop" });
  }
  console.info(
    "multiplayer full sessions: real TLS admission plus registered Conversation, Roleplay and two-player Game generation passed",
  );
} finally {
  for (const service of services) await service.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await app.close();
  await guestDb._fileStore.close();
  await closeDB();
  setDefaultCACertificates(previousTrust);
  rmSync(directory, { recursive: true, force: true });
}
