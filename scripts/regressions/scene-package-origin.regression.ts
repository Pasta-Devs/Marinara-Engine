/**
 * A package thread as a scene origin (capability API 1.66).
 *
 * The package's provider supplies the cast, persona and transcript, holds the only lock, and hears how
 * each scene ended. The Engine never writes a recap into a Conversation for it.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneOriginEnd, SceneOriginProvider } from "@marinara-engine/shared";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-scene-package-origin-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const { buildApp } = await import("../../packages/server/src/app.js");
const { registerCapabilitySceneOrigin } =
  await import("../../packages/server/src/services/capability-packages/capability-scene-origin.service.js");
const { capabilityPackageManifestSchema } = await import("../../packages/shared/src/index.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const app = await buildApp();

const requests: Array<{ messages: Array<{ content: string }> }> = [];
let providerContent = "";
const llm = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: providerContent }, finish_reason: "stop" }] }));
});

try {
  await app.ready();
  await new Promise<void>((resolve) => llm.listen(0, "127.0.0.1", resolve));
  const address = llm.address();
  assert.ok(address && typeof address !== "string");
  const api = async (method: "GET" | "POST" | "DELETE", url: string, payload?: object) => {
    const response = await app.inject({ method, url, payload });
    assert.ok(response.statusCode < 300, response.body);
    return response.statusCode === 204 ? null : response.json();
  };

  const creator = await api("POST", "/api/characters", { data: { name: "Mina" } });
  const persona = await api("POST", "/api/characters/personas", { name: "Fan", description: "A loyal fan." });
  const conn = await api("POST", "/api/connections", {
    name: "Scene fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
  });

  // The fixture package: one lock per thread, every end recorded.
  const chatsStore = createChatsStorage(app.db);
  const stillExisted: string[] = [];
  const locks = new Map<string, string>();
  const ends: Array<{ originId: string; end: SceneOriginEnd }> = [];
  let claimThrows = false;
  const claimedData: unknown[] = [];
  const provider: SceneOriginProvider = {
    async getContext(originId) {
      if (originId === "gone") return null;
      return {
        characterIds: [creator.id, "no-such-character"],
        personaId: persona.id,
        connectionId: conn.id,
        transcript: [
          { speaker: "Fan", content: "Loved your last post." },
          { speaker: "Mina", content: "Come to my shoot tonight?" },
        ],
        notes: "Stage name Mina; hard no: feet.",
      };
    },
    async claim(originId, scene) {
      if (claimThrows) throw new Error("storage down");
      claimedData.push(scene.data);
      // A scene that asked not to lock is admitted without one.
      if (scene.data?.lock === false) return true;
      if (locks.has(originId)) return false;
      locks.set(originId, scene.sceneChatId);
      return true;
    },
    async release(originId, end) {
      if (end.kind !== "concluded" && (await chatsStore.getById(end.sceneChatId))) stillExisted.push(end.kind);
      if (locks.get(originId) !== end.sceneChatId) return;
      locks.delete(originId);
      ends.push({ originId, end });
    },
  };
  const unregister = registerCapabilitySceneOrigin("fixture-pkg", provider);
  const origin = (originId: string) => ({ packageId: "fixture-pkg", originId });

  // Plan: the planner sees the provider's transcript, notes, persona and only real characters.
  const plan = {
    name: "Scene: The Shoot",
    description: "A studio at night.",
    scenario: "The shoot turns personal.",
    firstMessage: "You came.",
    background: null,
    characterIds: [creator.id],
    systemPrompt: "Write the scene.",
    rating: "nsfw",
    relationshipHistory: "Creator and fan.",
    participationGuide: "Play it cool.",
  };
  providerContent = JSON.stringify(plan);
  const planned = await api("POST", "/api/scene/plan", {
    packageOrigin: origin("thread-1"),
    prompt: "The shoot",
  });
  assert.equal(planned.plan.name, plan.name);
  const sent = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  for (const text of ["Fan: Loved your last post.", "Mina: Come to my shoot tonight?", "hard no: feet", "A loyal fan."])
    assert.ok(sent.includes(text), `The planner prompt includes ${text}`);
  assert.ok(!sent.includes("no-such-character"), "Unknown character IDs are not offered to the planner");

  // Create: the package lock admits exactly one scene per thread.
  const payload = { packageOrigin: origin("thread-1"), plan: planned.plan, initiatorCharId: creator.id };
  const creations = await Promise.all(
    [0, 1].map(() => app.inject({ method: "POST", url: "/api/scene/create", payload })),
  );
  assert.deepEqual(
    creations.map((response) => response.statusCode).sort(),
    [200, 409],
    "Only one active Scene can claim a package thread",
  );
  const created = creations.find((response) => response.statusCode === 200)!.json();
  const chatsAfterCreate = (await api("GET", "/api/chats")) as Array<{ name: string }>;
  assert.equal(
    chatsAfterCreate.filter((chat) => chat.name === plan.name).length,
    1,
    "A refused claim leaves no scene chat behind",
  );
  const scene = await api("GET", `/api/chats/${created.chatId}`);
  assert.deepEqual(scene.metadata.scenePackageOrigin, origin("thread-1"));
  assert.equal(scene.metadata.sceneOriginChatId, undefined);
  assert.equal(scene.personaId, persona.id);
  assert.deepEqual(scene.characterIds, [creator.id]);
  assert.ok(scene.metadata.sceneConversationContext.startsWith("Stage name Mina; hard no: feet."));
  assert.ok(scene.metadata.sceneConversationContext.includes("Mina: Come to my shoot tonight?"));
  assert.equal(locks.get("thread-1"), created.chatId);

  // Conclude: the recap goes to the package, not into any Conversation.
  providerContent = "They finished the shoot and stayed to talk.";
  const concluded = await api("POST", "/api/scene/conclude", { sceneChatId: created.chatId, connectionId: conn.id });
  assert.equal(concluded.originChatId, null);
  assert.deepEqual(concluded.packageOrigin, origin("thread-1"));
  assert.equal(ends.length, 1);
  assert.deepEqual(ends[0], {
    originId: "thread-1",
    end: {
      data: null,
      kind: "concluded",
      sceneChatId: created.chatId,
      summary: providerContent,
      description: plan.description,
      scenario: plan.scenario,
      rating: "nsfw",
      characterIds: [creator.id],
    },
  });
  assert.equal(locks.has("thread-1"), false, "Concluding unlocks the thread");

  // Abandon, delete and convert each unlock the thread with their own outcome.
  const start = async () => (await api("POST", "/api/scene/create", payload)).chatId as string;
  const abandoned = await start();
  const abandonResponse = await api("POST", "/api/scene/abandon", { sceneChatId: abandoned });
  assert.deepEqual(abandonResponse, { originChatId: null, packageOrigin: origin("thread-1") });
  const deleted = await start();
  await api("DELETE", `/api/chats/${deleted}`);
  const converted = await start();
  const fork = await api("POST", "/api/scene/fork", { sceneChatId: converted, mode: "convert" });
  assert.deepEqual(fork.packageOrigin, origin("thread-1"));
  assert.deepEqual(
    ends.slice(1).map(({ end }) => [end.kind, end.sceneChatId]),
    [
      ["abandoned", abandoned],
      ["deleted", deleted],
      ["converted", converted],
    ],
  );
  assert.equal(locks.size, 0);
  assert.deepEqual(stillExisted, [], "A thread unlocks only after its scene chat is gone");

  // A package can write the scene itself: its plan is used as is.
  const own = await api("POST", "/api/scene/create", {
    packageOrigin: origin("thread-2"),
    initiatorCharId: creator.id,
    plan: { ...plan, name: "Scene: Written by the package", firstMessage: "Package opening." },
  });
  const ownMessages = await api("GET", `/api/chats/${own.chatId}/messages`);
  assert.ok(ownMessages.at(-1).content.endsWith("Package opening."));
  await api("POST", "/api/scene/abandon", { sceneChatId: own.chatId });
  ends.pop();

  const refuse = async (url: string, body: object, status: number) => {
    const response = await app.inject({ method: "POST", url, payload: body });
    assert.equal(response.statusCode, status, `${url} ${JSON.stringify(body)}: ${response.body}`);
  };
  // Per-scene settings: stored with the scene, handed to claim and release, and free to skip the lock.
  const unlocked = await api("POST", "/api/scene/create", {
    ...payload,
    packageOrigin: origin("thread-3"),
    packageData: { lock: false, reach: "hint" },
  });
  const second = await api("POST", "/api/scene/create", {
    ...payload,
    packageOrigin: origin("thread-3"),
    packageData: { lock: false },
  });
  assert.notEqual(unlocked.chatId, second.chatId, "Scenes that skip the lock run side by side");
  assert.deepEqual(claimedData.slice(-2), [{ lock: false, reach: "hint" }, { lock: false }]);
  const unlockedChat = await api("GET", `/api/chats/${unlocked.chatId}`);
  assert.deepEqual(unlockedChat.metadata.scenePackageData, { lock: false, reach: "hint" });
  const endsBefore = ends.length;
  locks.set("thread-3", unlocked.chatId); // let the fixture record this release
  await api("POST", "/api/scene/abandon", { sceneChatId: unlocked.chatId });
  assert.deepEqual(ends.at(-1)?.end.data, { lock: false, reach: "hint" }, "release gets the scene's own data");
  ends.splice(endsBefore);
  await api("POST", "/api/scene/abandon", { sceneChatId: second.chatId });
  await refuse("/api/scene/create", { ...payload, packageData: "x" }, 400);
  await refuse("/api/scene/create", { ...payload, packageData: { big: "x".repeat(5000) } }, 400);

  // Refusals.
  await refuse("/api/scene/plan", { chatId: "x", packageOrigin: origin("thread-1"), prompt: "" }, 400);
  await refuse("/api/scene/plan", { packageOrigin: { packageId: "Bad Id", originId: "t" }, prompt: "" }, 400);
  await refuse("/api/scene/plan", { packageOrigin: { packageId: "other-pkg", originId: "t" }, prompt: "" }, 404);
  await refuse("/api/scene/plan", { packageOrigin: origin("gone"), prompt: "" }, 404);
  await refuse("/api/scene/create", { packageOrigin: origin("thread-1"), plan: { name: 1 } }, 400);
  claimThrows = true;
  const before = ((await api("GET", "/api/chats")) as unknown[]).length;
  await refuse("/api/scene/create", payload, 503);
  assert.equal(((await api("GET", "/api/chats")) as unknown[]).length, before, "A failed claim removes the scene chat");
  claimThrows = false;

  // A package that went away: the scene still concludes, and the release is skipped.
  const orphan = await start();
  unregister();
  providerContent = "A quiet ending.";
  const orphanEnd = await api("POST", "/api/scene/conclude", { sceneChatId: orphan, connectionId: conn.id });
  assert.equal(orphanEnd.summary, "A quiet ending.");
  assert.equal(ends.length, 4, "No release reaches an unregistered package");
  const orphanChat = await api("GET", `/api/chats/${orphan}`);
  assert.equal(orphanChat.metadata.sceneStatus, "concluded");
  assert.equal(orphanChat.metadata.sceneSummary, "A quiet ending.", "A missed release can be reconciled");
  await refuse("/api/scene/create", payload, 404);

  // A package that only starts scenes: no claim, no release, no lock.
  const unregisterLight = registerCapabilitySceneOrigin("light-pkg", {
    getContext: async () => ({ characterIds: [creator.id], personaId: null, transcript: [] }),
  });
  const light = { packageId: "light-pkg", originId: "anywhere" };
  const lightPayload = { packageOrigin: light, plan: planned.plan, initiatorCharId: creator.id };
  const both = await Promise.all(
    [0, 1].map(() => app.inject({ method: "POST", url: "/api/scene/create", payload: lightPayload })),
  );
  assert.deepEqual(
    both.map((response) => response.statusCode),
    [200, 200],
    "Without claim nothing is locked",
  );
  for (const response of both) {
    const sceneChatId = response.json().chatId;
    providerContent = "Done.";
    const ended = await api("POST", "/api/scene/conclude", { sceneChatId, connectionId: conn.id });
    assert.deepEqual(ended.packageOrigin, light);
  }
  unregisterLight();

  // A provider that never answers cannot hang a scene route.
  const unregisterSlow = registerCapabilitySceneOrigin("slow-pkg", {
    getContext: () => new Promise(() => undefined),
  });
  const started = Date.now();
  await refuse("/api/scene/plan", { packageOrigin: { packageId: "slow-pkg", originId: "x" }, prompt: "" }, 503);
  assert.ok(Date.now() - started < 12_000, "The route gives up on a silent provider");
  unregisterSlow();

  // A claim that answers after the deadline: the scene is gone, so the late lock is handed back.
  const lateEnds: SceneOriginEnd[] = [];
  const unregisterLate = registerCapabilitySceneOrigin("late-pkg", {
    getContext: async () => ({ characterIds: [creator.id], personaId: null, transcript: [] }),
    claim: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 8_500)),
    release: async (_originId, end) => {
      lateEnds.push(end);
    },
  });
  await refuse(
    "/api/scene/create",
    { packageOrigin: { packageId: "late-pkg", originId: "t" }, plan: planned.plan, initiatorCharId: creator.id },
    503,
  );
  for (let waited = 0; lateEnds.length === 0 && waited < 3_000; waited += 100)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(lateEnds[0]?.kind, "deleted", "A late claim is released at once");
  unregisterLate();

  // The `scenes` permission needs capability API 1.66.
  const manifest = {
    schemaVersion: 2 as const,
    id: "fixture-pkg",
    name: "Fixture",
    version: "1.0.0",
    description: "Scene origin regression fixture.",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    capabilityApi: { major: 1, minor: 66 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "a".repeat(40) },
    entrypoints: { server: "server.mjs" },
    files: [{ path: "server.mjs", sha256: "b".repeat(64), bytes: 10 }],
    permissions: ["scenes"],
  };
  assert.doesNotThrow(() => capabilityPackageManifestSchema.parse(manifest));
  assert.throws(
    () => capabilityPackageManifestSchema.parse({ ...manifest, capabilityApi: { major: 1, minor: 65 } }),
    /permission requires schemaVersion 2 and capabilityApi 1\.66 or newer/,
  );
} finally {
  await new Promise<void>((resolve) => llm.close(() => resolve()));
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
