// Connection accounts, decisions 27/28: an automatic name gets the key's last 4 when another Connection of the same
// service exists (a typed name stays as typed; two custom hosts are already apart); "Move to connection…" moves a
// Model to another Connection of the same service, takes its key and catalog, keeps the Model's id and respects the
// review gate; a move to another chat service needs a target catalog model (ranked candidates, variants flagged),
// keeps the id, roles and chat picks, moves the star and resets service-only fields; the catalog search ranks starred, then saved, then prefix matches, then the rest, before the limit.
// Picture menu: a Connection and a Model show one picture at a time (logo, letters, upload or the default).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-accounts-names-move-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, chats, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { decryptApiKey, encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { linkConnectionAccounts, createConnectionAccountsStorage } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { connectionIconSchema, parseConnectionIcon, rankModelMatch, rankModelMoveCandidates, withKeyTail } =
  await import("../../packages/shared/src/index.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
await app.register(connectionsRoutes, { prefix: "/connections" });
const json = async (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  return { status: response.statusCode, body: response.body, data: response.body ? JSON.parse(response.body) : null };
};
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const addAccount = async (payload: Record<string, unknown>) => {
  const created = await json("POST", "/accounts", { model: "", ...payload });
  assert.equal(created.status, 201, created.body);
  return {
    id: created.data.account.id as string,
    name: created.data.account.name as string,
    row: created.data.connectionId as string,
  };
};

try {
  // ── The rank (pure) ──
  assert.equal(withKeyTail("OpenAI", "sk-test-a1b2"), "OpenAI · …a1b2");
  assert.equal(withKeyTail("OpenAI", "short"), "OpenAI", "a short key would be mostly revealed");
  assert.equal(rankModelMatch("sonnet", { id: "anthropic/claude-sonnet-4" }), 2, "a word of the id starts with it");
  assert.equal(rankModelMatch("claude-son", { id: "anthropic/claude-sonnet-4" }), 2, "the id after its vendor");
  assert.equal(rankModelMatch("onnet", { id: "anthropic/claude-sonnet-4" }), 3);
  assert.equal(rankModelMatch("gpt", { id: "x/y", name: "Big GPT" }), 2, "a word of the name");
  assert.equal(rankModelMatch("zzz", { id: "anthropic/claude-sonnet-4" }), -1);
  assert.equal(rankModelMatch("son", { id: "anthropic/claude-sonnet-4" }, { saved: true }), 1);
  assert.equal(rankModelMatch("onnet", { id: "anthropic/claude-sonnet-4" }, { starred: true, saved: true }), 0);
  assert.equal(rankModelMatch("zzz", { id: "anthropic/claude-sonnet-4" }, { starred: true }), -1, "no match stays out");

  // ── Distinct automatic names at creation ──
  const first = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-1111" });
  assert.equal(first.name, "OpenAI", "the only Connection of its service keeps the plain name");
  const second = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-2222" });
  assert.equal(second.name, "OpenAI · …2222");
  const typed = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-3333", name: "Work key" });
  assert.equal(typed.name, "Work key", "a typed name is never changed");
  assert.equal((await json("GET", "/accounts")).data.find((a: { id: string }) => a.id === first.id).name, "OpenAI");
  const hostA = await addAccount({
    provider: "custom",
    baseUrl: "https://a.example/v1",
    apiKey: "fixture-custom-aaaa",
  });
  const hostB = await addAccount({
    provider: "custom",
    baseUrl: "https://b.example/v1",
    apiKey: "fixture-custom-bbbb",
  });
  assert.equal(hostA.name, "Custom · a.example");
  assert.equal(hostB.name, "Custom · b.example", "two hosts are already apart");
  const hostA2 = await addAccount({
    provider: "custom",
    baseUrl: "https://a.example/v1",
    apiKey: "fixture-custom-cccc",
  });
  assert.equal(hostA2.name, "Custom · a.example · …cccc");

  // ── Distinct automatic names at migration (startup linking): only the accounts it creates are named ──
  // Raw rows, as an older build left them: no account yet.
  const stamp = new Date().toISOString();
  for (const [id, provider, key] of [
    ["legacy-router-1", "openrouter", "fixture-router-key-4444"],
    ["legacy-router-2", "openrouter", "fixture-router-key-5555"],
    ["legacy-xai", "xai", "fixture-xai-key-6666"],
  ] as const) {
    await db.insert(apiConnections).values({
      id,
      name: id,
      provider,
      model: "m",
      apiKeyEncrypted: encryptApiKey(key),
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  const nameOf = async (rowName: string) => {
    const row = (await db.select().from(apiConnections).where(eq(apiConnections.name, rowName)))[0]!;
    const account = (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, row.accountId!)))[0]!;
    return account.name;
  };
  await linkConnectionAccounts(db);
  assert.equal(await nameOf("legacy-router-1"), "OpenRouter · …4444");
  assert.equal(await nameOf("legacy-router-2"), "OpenRouter · …5555");
  assert.equal(await nameOf("legacy-xai"), "xAI / Grok", "a single Connection of its service keeps the plain name");

  // ── Move to connection ──
  const model = await connections.create({
    name: "Mover",
    provider: "openai",
    model: "gpt-move",
    accountId: first.id,
  } as never);
  assert(model);
  await connections.setModelPinned(second.row, "starred-on-second", true);
  assert(await connections.saveModelListIfUnchanged(await rowOf(second.row), [{ id: "from-second", name: "Second" }]));
  const moved = await json("POST", `/connections/${model.id}/move`, { accountId: second.id });
  assert.equal(moved.status, 200, moved.body);
  assert(!moved.body.includes("fixture-openai-key"), "the response is masked");
  const after = await rowOf(model.id);
  assert.equal(after.accountId, second.id);
  assert.equal(
    decryptApiKey(after.apiKeyEncrypted),
    "fixture-openai-key-2222",
    "the key comes from the new Connection",
  );
  assert.deepEqual(JSON.parse(after.pinnedModels), ["starred-on-second"], "its favorites apply");
  assert.equal(after.savedModels, null, "no copy on the row");
  assert.match(JSON.stringify(await connections.readCatalog(after)), /from-second/u, "its catalog applies");
  assert.equal((await connections.getWithKey(model.id))?.id, model.id, "the id stays, so references keep working");
  assert.deepEqual(await linkConnectionAccounts(db), { created: 0, linked: 0, detached: 0 }, "the link is consistent");

  // Another service, the same Connection, an unknown one, a bad body: refused.
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: hostA.id })).status, 400);
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: second.id })).status, 400);
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: "nope" })).status, 404);
  assert.equal((await json("POST", `/connections/${model.id}/move`, {})).status, 400);
  assert.equal((await json("POST", `/connections/nope/move`, { accountId: second.id })).status, 404);

  // The review gate: an imported Model under review cannot take a trusted key by moving.
  await db.update(apiConnections).set({ profileImportReviewRequired: "true" }).where(eq(apiConnections.id, model.id));
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: first.id })).status, 409);
  assert.equal((await rowOf(model.id)).accountId, second.id);
  await db.update(apiConnections).set({ profileImportReviewRequired: "false" }).where(eq(apiConnections.id, model.id));
  // A Connection that is off blocks the Model that moves into it.
  await json("PATCH", `/accounts/${first.id}`, { enabled: false });
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: first.id })).status, 200);
  assert.equal(await connections.getWithKey(model.id), null);
  await json("PATCH", `/accounts/${first.id}`, { enabled: true });

  // ── Cross-kind move: a Comfy video Model joins the image Connection of the same server ──
  const comfyMedia = (provider: string, source: string, baseUrl: string) =>
    ({
      name: `${provider}-${baseUrl}`,
      provider,
      [provider === "video_generation" ? "videoGenerationSource" : "imageGenerationSource"]: source,
      baseUrl,
      model: "",
    }) as never;
  const comfyImage = (await connections.create(comfyMedia("image_generation", "comfyui", "http://127.0.0.1:7100")))!;
  const comfyOther = (await connections.create(comfyMedia("image_generation", "comfyui", "http://127.0.0.1:7200")))!;
  const comfyVideo = (await connections.create(comfyMedia("video_generation", "comfyui", "http://127.0.0.1:7100")))!;
  assert.equal((await rowOf(comfyVideo.id)).accountId, (await rowOf(comfyImage.id)).accountId, "new rows share");
  assert.notEqual((await rowOf(comfyOther.id)).accountId, (await rowOf(comfyImage.id)).accountId, "other endpoint");
  // An older install holds the video Model in its own account: it stays apart until moved explicitly.
  const oldAccount = await createConnectionAccountsStorage(db).create({
    name: "Old video",
    provider: "video_generation",
    baseUrl: "http://127.0.0.1:7100",
  } as never);
  await db
    .update(apiConnections)
    .set({
      accountId: oldAccount.id,
      comfyuiWorkflow: '{"node":{"inputs":{"text":"%prompt%"}}}',
      savedModels: '{"fetchedAt":"x","models":[{"id":"wf"}]}',
      pinnedModels: '["wf"]',
    })
    .where(eq(apiConnections.id, comfyVideo.id));
  await linkConnectionAccounts(db);
  const imageAccountId = (await rowOf(comfyImage.id)).accountId!;
  assert.equal((await rowOf(comfyVideo.id)).accountId, oldAccount.id, "old separate accounts stay separate");
  assert.equal(
    (await json("POST", `/connections/${comfyVideo.id}/move`, { accountId: (await rowOf(comfyOther.id)).accountId }))
      .status,
    400,
  );
  // Legacy/manual links can contain another video service: its cache must never replace Comfy's catalog.
  const swarmVideo = (await connections.create(comfyMedia("video_generation", "swarmui", "http://127.0.0.1:7100")))!;
  await db
    .update(apiConnections)
    .set({
      accountId: imageAccountId,
      savedModels: '{"models":[{"id":"wrong-service-model"}]}',
      pinnedModels: '["wrong-service-model"]',
    })
    .where(eq(apiConnections.id, swarmVideo.id));
  const movedVideo = await json("POST", `/connections/${comfyVideo.id}/move`, { accountId: imageAccountId });
  assert.equal(movedVideo.status, 200, movedVideo.body);
  const video = await rowOf(comfyVideo.id);
  assert.equal(video.accountId, imageAccountId);
  assert.equal(video.provider, "video_generation");
  assert.equal(video.baseUrl, "http://127.0.0.1:7100", "its own endpoint is untouched");
  assert.match(JSON.stringify(await connections.readCatalog(video)), /"wf"/u, "no same-kind peer: its catalog stays");
  assert.equal(video.pinnedModels, '["wf"]');
  assert.equal(video.comfyuiWorkflow, '{"node":{"inputs":{"text":"%prompt%"}}}', "workflow unchanged");
  // Shared settings edits reach both kinds, and the address edit does not detach the video Model.
  assert.equal((await json("PATCH", `/accounts/${imageAccountId}`, { baseUrl: "http://127.0.0.1:7300" })).status, 200);
  assert.equal((await rowOf(comfyVideo.id)).accountId, imageAccountId);
  assert.equal((await rowOf(comfyVideo.id)).baseUrl, "http://127.0.0.1:7300");
  assert.equal((await rowOf(comfyImage.id)).baseUrl, "http://127.0.0.1:7300");
  assert.equal(decryptApiKey((await rowOf(comfyVideo.id)).apiKeyEncrypted), "", "no key was invented");

  // NanoGPT image (/api/v1) and video (/api) share a key: an image path edit leaves the video path and catalog alone.
  const nanoKey = "fixture-nano-key-7777";
  const nanoImage = (await connections.create({
    ...comfyMedia("image_generation", "nanogpt", "https://nano-gpt.com/api/v1"),
    apiKey: nanoKey,
  }))!;
  const nanoVideo = (await connections.create({
    ...comfyMedia("video_generation", "nanogpt", "https://nano-gpt.com/api"),
    apiKey: nanoKey,
  }))!;
  await db
    .update(apiConnections)
    .set({ savedModels: '{"fetchedAt":"x","models":[{"id":"nv"}]}' })
    .where(eq(apiConnections.id, nanoVideo.id));
  await db
    .update(apiConnections)
    .set({ createdAt: "2020-01-01T00:00:00.000Z" })
    .where(eq(apiConnections.id, nanoVideo.id));
  const nanoAccountId = (await rowOf(nanoImage.id)).accountId!;
  assert.equal((await rowOf(nanoVideo.id)).accountId, nanoAccountId, "one key, one account");
  assert.equal(
    (await json("PATCH", `/accounts/${nanoAccountId}`, { baseUrl: "https://nano-gpt.com/api/v2" })).status,
    200,
  );
  const nanoVideoAfter = await rowOf(nanoVideo.id);
  assert.equal(nanoVideoAfter.accountId, nanoAccountId, "same origin: not detached");
  assert.equal(nanoVideoAfter.baseUrl, "https://nano-gpt.com/api", "the video path is not overwritten");
  assert.match(nanoVideoAfter.savedModels ?? "", /"nv"/u, "the video catalog stays");

  // A different key cannot keep a cached catalog when the target has no same-kind peer.
  const keyedImage = (await connections.create({
    ...comfyMedia("image_generation", "comfyui", "http://127.0.0.1:7400"),
    apiKey: "fixture-key-A",
  }))!;
  const keyedVideo = (await connections.create({
    ...comfyMedia("video_generation", "comfyui", "http://127.0.0.1:7400"),
    apiKey: "fixture-key-B",
  }))!;
  assert.notEqual(
    (await rowOf(keyedImage.id)).accountId,
    (await rowOf(keyedVideo.id)).accountId,
    "different keys stay apart",
  );
  await db
    .update(apiConnections)
    .set({ savedModels: '{"models":[{"id":"old-key-model"}]}' })
    .where(eq(apiConnections.id, keyedVideo.id));
  assert.equal(
    (await json("POST", `/connections/${keyedVideo.id}/move`, { accountId: (await rowOf(keyedImage.id)).accountId }))
      .status,
    200,
  );
  assert.equal((await rowOf(keyedVideo.id)).savedModels, null, "changed key clears old catalog");
  assert.equal(await connections.readCatalog(await rowOf(keyedVideo.id)), null);

  // ── Catalog search order: starred, saved, prefix, substring; ranked before the limit ──
  const catalogRow = await rowOf(hostB.row);
  assert(
    await connections.saveModelListIfUnchanged(catalogRow, [
      { id: "v/zalpha", name: "Inside" },
      { id: "v/alpha-one", name: "Prefix" },
      { id: "v/alpha-saved", name: "Saved" },
      { id: "v/zz-alphastar", name: "Starred" },
      { id: "v/unrelated", name: "Other" },
    ]),
  );
  await connections.create({
    name: "Saved",
    provider: "custom",
    baseUrl: "https://b.example/v1",
    model: "v/alpha-saved",
    accountId: hostB.id,
  } as never);
  await connections.setModelPinned(hostB.row, "v/zz-alphastar", true);
  const search = async (limit: number) =>
    (await json("GET", `/accounts/catalog-search?q=alpha&limit=${limit}`)).data
      .filter((hit: { accountId: string }) => hit.accountId === hostB.id)
      .map((hit: { model: string }) => hit.model);
  assert.deepEqual(await search(30), ["v/zz-alphastar", "v/alpha-saved", "v/alpha-one", "v/zalpha"]);
  assert.deepEqual(await search(2), ["v/zz-alphastar", "v/alpha-saved"], "the limit cuts after ranking");

  // ── Move to another service: ranked candidates, then the move keeps the id and roles and resets service fields ──
  const ranked = rankModelMoveCandidates("nanogpt/deepseek-v3", [
    { id: "deepseek-v3:thinking" },
    { id: "other" },
    { id: "deepseek/deepseek-v3" },
    { id: "nanogpt/deepseek-v3" },
    { id: "deepseek-v3" },
  ]).map(({ model: hit, match, variant }) => `${hit.id}|${match}|${variant}`);
  assert.deepEqual(ranked, [
    "nanogpt/deepseek-v3|exact|false",
    "deepseek/deepseek-v3|prefix|false",
    "deepseek-v3|prefix|false",
    "deepseek-v3:thinking|catalog|true",
  ]);
  assert.deepEqual(
    rankModelMoveCandidates("openai/gpt-5:free", [{ id: "gpt-5" }]).map((hit) => hit.variant),
    [true],
    "a billing variant is flagged, never a plain match",
  );
  assert.deepEqual(
    rankModelMoveCandidates("claude-sonnet-4-5[1m]", [{ id: "claude-sonnet-4-5" }]).map((hit) => hit.variant),
    [true],
    "a context variant is flagged",
  );
  assert.deepEqual(
    rankModelMoveCandidates("claude-sonnet-4-5@20250929", [{ id: "claude-sonnet-4-5-20250929" }]).map((hit) => [
      hit.match,
      hit.variant,
    ]),
    [["catalog", false]],
    "a Vertex date pin is the same model",
  );

  const anthropic = await addAccount({ provider: "anthropic", apiKey: "fixture-anthropic-key-8888" });
  const router = await addAccount({ provider: "openrouter", apiKey: "fixture-router-key-9999" });
  assert(
    await connections.saveModelListIfUnchanged(await rowOf(router.row), [
      { id: "openai/gpt-5", name: "GPT-5" },
      { id: "anthropic/claude-sonnet-4.5:thinking", name: "Sonnet thinking" },
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        context: 1000000,
        maxOutput: 64000,
        pricing: { prompt: 3, completion: 15 },
      },
    ]),
  );
  await connections.setModelPinned(router.row, "openai/gpt-5", true);
  const traveller = (await connections.create({
    name: "claude-sonnet-4-5",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    accountId: anthropic.id,
  } as never))!;
  await connections.setModelPinned(traveller.id, "claude-sonnet-4-5", true);
  await db
    .update(apiConnections)
    .set({
      isDefault: "true",
      fallbackForAgents: "true",
      claudeFastMode: "true",
      anthropicExtendedCacheTtl: "true",
      openrouterProvider: "Anthropic",
      maxTokensOverride: 128000,
      promptPresetId: "preset-1",
      icon: "letters:CS",
      folderId: "folder-1",
      defaultParameters: JSON.stringify({ temperature: 0.5, topK: 40, enabledParameters: { topK: true } }),
    })
    .where(eq(apiConnections.id, traveller.id));
  // Chat picks: the old model, a model the target offers under its gateway path, and one it does not offer.
  const chatPicks = {
    "chat-same": "claude-sonnet-4-5",
    "chat-prefix": "gpt-5",
    "chat-gone": "claude-opus-4-1",
  } as const;
  for (const [chatId, pickModel] of Object.entries(chatPicks)) {
    await db.insert(chats).values({
      id: chatId,
      name: chatId,
      mode: "conversation",
      connectionId: traveller.id,
      metadata: JSON.stringify({
        modelOverride: { connectionId: traveller.id, model: pickModel, maxContext: 5 },
        recentModels: [
          { connectionId: traveller.id, model: pickModel },
          { connectionId: "other-row", model: "x" },
        ],
      }),
      createdAt: stamp,
      updatedAt: stamp,
    } as never);
  }

  const plan = await json("GET", `/connections/${traveller.id}/move-candidates?accountId=${router.id}`);
  assert.equal(plan.status, 200, plan.body);
  assert.equal(plan.data.kind, "cross");
  assert.equal(plan.data.manualModelAllowed, false);
  assert.deepEqual(
    plan.data.candidates.map((hit: Record<string, unknown>) => [hit.id, hit.match, hit.variant, hit.cost ?? null]),
    [
      ["anthropic/claude-sonnet-4.5", "catalog", false, "paid"],
      ["anthropic/claude-sonnet-4.5:thinking", "catalog", true, null],
    ],
  );
  assert.equal(plan.data.candidates[0].context, 1000000);
  assert.equal((await json("GET", `/connections/${traveller.id}/move-candidates`)).status, 400);
  assert.equal(
    (await json("GET", `/connections/${traveller.id}/move-candidates?accountId=${anthropic.id}`)).data.kind,
    "mismatch",
    "its own Connection",
  );

  // Refused: no model, a model the target does not offer, a media Connection.
  assert.equal((await json("POST", `/connections/${traveller.id}/move`, { accountId: router.id })).status, 400);
  assert.equal(
    (await json("POST", `/connections/${traveller.id}/move`, { accountId: router.id, model: "x/not-offered" })).status,
    400,
  );
  assert.equal(
    (await json("POST", `/connections/${traveller.id}/move`, { accountId: imageAccountId, model: "m" })).status,
    400,
    "a chat Model never becomes a media Model",
  );
  assert.equal((await rowOf(traveller.id)).provider, "anthropic", "a refused move changes nothing");

  const crossed = await json("POST", `/connections/${traveller.id}/move`, {
    accountId: router.id,
    model: "anthropic/claude-sonnet-4.5",
  });
  assert.equal(crossed.status, 200, crossed.body);
  assert(!crossed.body.includes("fixture-"), "the response is masked");
  const moved2 = await rowOf(traveller.id);
  assert.equal(moved2.id, traveller.id, "the id stays");
  assert.equal(moved2.accountId, router.id);
  assert.equal(moved2.provider, "openrouter");
  assert.equal(moved2.model, "anthropic/claude-sonnet-4.5");
  assert.equal(moved2.baseUrl, (await rowOf(router.row)).baseUrl);
  assert.equal(decryptApiKey(moved2.apiKeyEncrypted), "fixture-router-key-9999");
  assert.equal(moved2.name, "Claude Sonnet 4.5", "an automatic name follows the model");
  assert.equal(moved2.maxContext, 1000000);
  assert.equal(moved2.maxTokensOverride, 64000, "clamped to the model's output limit");
  assert.deepEqual(
    [moved2.isDefault, moved2.fallbackForAgents, moved2.promptPresetId, moved2.icon, moved2.folderId],
    ["true", "true", "preset-1", "letters:CS", "folder-1"],
    "roles, preset, picture and folder stay",
  );
  assert.deepEqual(
    [moved2.claudeFastMode, moved2.anthropicExtendedCacheTtl, moved2.openrouterProvider],
    ["false", "false", null],
    "service-only fields are reset",
  );
  assert.deepEqual(
    JSON.parse(moved2.defaultParameters!),
    { temperature: 0.5, enabledParameters: { topK: true } },
    "top-k is dropped: the target never sends it for this model",
  );
  assert.deepEqual(JSON.parse(moved2.pinnedModels), ["openai/gpt-5", "anthropic/claude-sonnet-4.5"], "star moved");
  assert.equal((await rowOf(router.row)).pinnedModels, moved2.pinnedModels, "the Connection's stars are shared");
  const chatMeta = async (chatId: string) => {
    const chat = (await db.select().from(chats).where(eq(chats.id, chatId)))[0]!;
    assert.equal(chat.connectionId, traveller.id, "chats keep pointing at the Model");
    return JSON.parse(chat.metadata);
  };
  const same = await chatMeta("chat-same");
  assert.deepEqual(
    same.modelOverride,
    {
      connectionId: traveller.id,
      model: "anthropic/claude-sonnet-4.5",
      name: "Claude Sonnet 4.5",
      maxContext: 1000000,
    },
    "the old model becomes the new one, with the target's limits",
  );
  assert.equal(same.recentModels[0].model, "anthropic/claude-sonnet-4.5");
  assert.deepEqual(same.recentModels[1], { connectionId: "other-row", model: "x" }, "other Models are untouched");
  const prefixed = await chatMeta("chat-prefix");
  assert.deepEqual(prefixed.modelOverride, { connectionId: traveller.id, model: "openai/gpt-5", name: "GPT-5" });
  assert.equal(prefixed.recentModels[0].model, "openai/gpt-5");
  const gone = await chatMeta("chat-gone");
  assert.equal(gone.modelOverride, null, "a model the target lacks is cleared: the chat runs the Model's model");
  assert.deepEqual(gone.recentModels[0], { connectionId: traveller.id }, "no old-provider id stays");

  // A custom endpoint takes any model id.
  const toCustom = await json("GET", `/connections/${traveller.id}/move-candidates?accountId=${hostA2.id}`);
  assert.equal(toCustom.data.manualModelAllowed, true);
  assert.equal(
    (await json("POST", `/connections/${traveller.id}/move`, { accountId: hostA2.id, model: "my-local-model" })).status,
    200,
  );
  assert.equal((await rowOf(traveller.id)).model, "my-local-model");
  assert.equal((await rowOf(traveller.id)).baseUrl, "https://a.example/v1");

  // A target with no saved list for its own provider: the list is fetched with the target's key and saved; a failed
  // fetch is its own state (not "does not offer"), and the move itself fetches before it validates.
  const lazy = await addAccount({ provider: "openai", baseUrl: "http://127.0.0.1:9/v1", apiKey: "fixture-lazy-4444" });
  const accountCatalogs = async (id: string) =>
    JSON.parse(
      (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, id)))[0]!.modelCatalogs ?? "{}",
    );
  const realFetch = globalThis.fetch;
  const fetched: string[] = [];
  let modelsUp = false;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetched.push(`${String(url)} ${new Headers(init?.headers).get("authorization")}`);
    return modelsUp
      ? new Response(JSON.stringify({ data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] }), {
          headers: { "content-type": "application/json" },
        })
      : new Response("down", { status: 503 });
  }) as typeof fetch;
  try {
    const down = await json("GET", `/connections/${traveller.id}/move-candidates?accountId=${lazy.id}`);
    assert.equal(down.status, 200, down.body);
    assert.equal(down.data.catalogFetchedAt, null);
    assert.match(down.data.catalogError, /503/);
    assert.deepEqual(down.data.candidates, []);
    assert.equal(fetched[0], "http://127.0.0.1:9/v1/models Bearer fixture-lazy-4444", "the target's own key");
    const refused = await json("POST", `/connections/${traveller.id}/move`, { accountId: lazy.id, model: "gpt-5" });
    assert.equal(refused.status, 502, "a failed list is not 'does not offer'");
    assert.equal((await rowOf(traveller.id)).provider, "custom");
    modelsUp = true;
    const up = await json("GET", `/connections/${traveller.id}/move-candidates?accountId=${lazy.id}`);
    assert.equal(up.data.catalogError, undefined);
    assert.ok(up.data.catalogFetchedAt);
    assert.deepEqual(
      (await accountCatalogs(lazy.id)).openai.models.map((m: { id: string }) => m.id),
      ["gpt-5", "gpt-5-mini"],
      "saved to the Connection's catalog",
    );
    await db.update(connectionAccounts).set({ modelCatalogs: null }).where(eq(connectionAccounts.id, lazy.id));
    const callsBefore = fetched.length;
    const lazyMove = await json("POST", `/connections/${traveller.id}/move`, { accountId: lazy.id, model: "gpt-5" });
    assert.equal(lazyMove.status, 200, lazyMove.body);
    assert.equal(fetched.length, callsBefore + 1, "the move fetched the missing list");
    assert.deepEqual([(await rowOf(traveller.id)).provider, (await rowOf(traveller.id)).model], ["openai", "gpt-5"]);
  } finally {
    globalThis.fetch = realFetch;
  }

  // An address change that detaches the last Model of a provider drops that provider's catalog too.
  const shared = await addAccount({ provider: "custom", baseUrl: "https://c.example/v1", apiKey: "fixture-c-5555" });
  const sideRow = (await connections.create({
    name: "side",
    provider: "image_generation",
    model: "m",
    baseUrl: "https://c.example/v1",
  } as never))!;
  // Newer than the account's own row, so that row (not this image one) stands for the account's service.
  await db
    .update(apiConnections)
    .set({ accountId: shared.id, createdAt: new Date(Date.now() + 60_000).toISOString() })
    .where(eq(apiConnections.id, sideRow.id));
  await db
    .update(connectionAccounts)
    .set({ modelCatalogs: JSON.stringify({ image_generation: { fetchedAt: "x", models: [{ id: "m" }] } }) })
    .where(eq(connectionAccounts.id, shared.id));
  assert.equal((await json("PATCH", `/accounts/${shared.id}`, { baseUrl: "https://d.example/v1" })).status, 200);
  assert.equal((await rowOf(sideRow.id)).accountId, null, "the other-origin Model left");
  assert.deepEqual(await accountCatalogs(shared.id), {}, "its catalog left with it");

  // ── Picture: default, brand logo, letters, upload, reset (Connection and Model) ──
  assert.equal(connectionIconSchema.parse("letters: ab "), "letters:ab", "letters are trimmed");
  assert.equal(connectionIconSchema.parse("letters:👍🏽A"), "letters:👍🏽A", "two graphemes, not two code units");
  for (const bad of ["letters:ABC", "letters:", "letters:a b", "brand:../x", "brand:", "emoji:x", "x".repeat(65)]) {
    assert.equal(connectionIconSchema.safeParse(bad).success, false, bad);
  }
  assert.equal(parseConnectionIcon("brand:Bad Key"), null, "a stored malformed value reads as the default");
  const png = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
  const accountPicture = async () => {
    const item = (await json("GET", "/accounts")).data.find((a: { id: string }) => a.id === hostB.id);
    return { icon: item.icon, imagePath: item.imagePath };
  };
  assert.deepEqual(await accountPicture(), { icon: null, imagePath: null }, "a new Connection shows its service logo");
  assert.equal((await json("PATCH", `/accounts/${hostB.id}`, { icon: "brand:openai" })).data.icon, "brand:openai");
  assert.equal((await json("PATCH", `/accounts/${hostB.id}`, { name: "Renamed" })).data.icon, "brand:openai");
  assert.ok((await json("PATCH", `/accounts/${hostB.id}`, { icon: "letters:abc" })).status >= 400, "three letters");
  assert.equal((await accountPicture()).icon, "brand:openai", "a refused icon changes nothing");
  const uploaded = await json("POST", `/accounts/${hostB.id}/image`, { image: png });
  assert.equal(uploaded.status, 200, uploaded.body);
  assert.match(uploaded.data.imagePath, /^\/api\/connections\/images\/file\/connection-.+\.png$/);
  assert.equal(uploaded.data.icon, null, "an upload replaces the chosen logo");
  assert.equal((await json("POST", `/accounts/${hostB.id}/image`, { image: "bm90IGFuIGltYWdl" })).status, 400);
  assert.equal((await json("POST", `/accounts/no-such-id/image`, { image: png })).status, 404);
  const lettered = await json("PATCH", `/accounts/${hostB.id}`, { icon: "letters: R " });
  assert.deepEqual([lettered.data.icon, lettered.data.imagePath], ["letters:R", null], "letters replace the upload");
  await json("POST", `/accounts/${hostB.id}/image`, { image: png });
  const accountReset = await json("PATCH", `/accounts/${hostB.id}`, { icon: null });
  assert.deepEqual([accountReset.data.icon, accountReset.data.imagePath], [null, null], "reset clears both");

  const modelPicture = async () => {
    const row = await rowOf(hostB.row);
    return { icon: row.icon, imagePath: row.imagePath };
  };
  assert.deepEqual(await modelPicture(), { icon: null, imagePath: null });
  assert.equal((await json("PATCH", `/connections/${hostB.row}`, { icon: "letters:Ω" })).status, 200);
  assert.deepEqual(await modelPicture(), { icon: "letters:Ω", imagePath: null });
  assert.ok((await json("PATCH", `/connections/${hostB.row}`, { icon: "brand:a/b" })).status >= 400);
  assert.equal((await json("POST", `/connections/${hostB.row}/image`, { image: png })).status, 200);
  const modelUploaded = await modelPicture();
  assert.equal(modelUploaded.icon, null, "a Model upload replaces its letters");
  assert.ok(modelUploaded.imagePath, "and keeps the existing imagePath column");
  await json("PATCH", `/connections/${hostB.row}`, { icon: "brand:claude" });
  assert.deepEqual(await modelPicture(), { icon: "brand:claude", imagePath: null }, "a logo replaces the upload");
  await json("PATCH", `/connections/${hostB.row}`, { icon: null });
  assert.deepEqual(await modelPicture(), { icon: null, imagePath: null }, "reset clears both");

  // ── "Move to a new connection": a copy of the Connection (key, address, limits) takes the one Model ──
  const splitSource = await addAccount({ provider: "openai", apiKey: "split-key-7777", name: "Split source" });
  await json("PATCH", `/accounts/${splitSource.id}`, { maxRequestsPerMinute: 30 });
  const split = await json("POST", `/accounts/${splitSource.id}/split`, {
    connectionId: splitSource.row,
    name: "Split copy",
  });
  assert.equal(split.status, 201, split.body);
  const copyId = split.data.account.id as string;
  assert.notEqual(copyId, splitSource.id);
  assert.equal(split.data.account.name, "Split copy");
  assert.equal(split.data.account.maxRequestsPerMinute, 30, "limits come along");
  const [copyRow] = await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, copyId));
  assert.equal(decryptApiKey(copyRow!.apiKeyEncrypted), "split-key-7777", "the key comes along");
  assert.equal((await rowOf(splitSource.row)).accountId, copyId, "the Model moved to the copy");
  await linkConnectionAccounts(db);
  assert.equal((await rowOf(splitSource.row)).accountId, copyId, "startup linking keeps the split");
  assert.equal(
    (await json("POST", `/accounts/${splitSource.id}/split`, { connectionId: splitSource.row, name: "Again" })).status,
    404,
    "a Model of another Connection cannot be split from this one",
  );

  // A new key on one copy names the other Connection that still holds the old key; its key stays as it is.
  const rotated = await json("PATCH", `/accounts/${splitSource.id}`, { apiKey: "split-key-8888" });
  assert.equal(rotated.status, 200, rotated.body);
  assert.deepEqual(rotated.data.sameKeyAccounts, [{ id: copyId, name: "Split copy" }]);
  assert.doesNotMatch(rotated.body, /split-key/);
  const [stillOld] = await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, copyId));
  assert.equal(decryptApiKey(stillOld!.apiKeyEncrypted), "split-key-7777");
  const renamed = await json("PATCH", `/accounts/${splitSource.id}`, { name: "Split source 2" });
  assert.equal(renamed.data.sameKeyAccounts, undefined, "no key change, no list");

  // "Duplicate": a copy of the Connection with a copy of each Model (same name, no default roles); the original stays.
  await json("PATCH", `/connections/${splitSource.row}`, { isDefault: true });
  const duplicated = await json("POST", `/accounts/${copyId}/duplicate`);
  assert.equal(duplicated.status, 201, duplicated.body);
  assert.doesNotMatch(duplicated.body, /split-key/, "the key never leaves the server");
  const dupId = duplicated.data.account.id as string;
  assert.equal(duplicated.data.account.name, "Split copy (Copy)");
  const [dupAccount] = await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, dupId));
  assert.equal(decryptApiKey(dupAccount!.apiKeyEncrypted), "split-key-7777", "the key comes along");
  const dupRows = await db.select().from(apiConnections).where(eq(apiConnections.accountId, dupId));
  const originalRow = await rowOf(splitSource.row);
  assert.equal(dupRows.length, 1);
  assert.notEqual(dupRows[0]!.id, splitSource.row);
  assert.equal(dupRows[0]!.name, originalRow.name, "the Model copy keeps its name");
  assert.equal(dupRows[0]!.isDefault, "false", "the copy takes no default role");
  assert.equal(originalRow.accountId, copyId, "the original Model stays");
  assert.equal(originalRow.isDefault, "true");
  assert.equal((await json("POST", "/accounts/missing/duplicate")).status, 404);
  console.log("connection-accounts-names-move-search: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
