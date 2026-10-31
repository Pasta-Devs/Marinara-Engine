// Connection accounts: `linkConnectionAccounts` groups existing Models by credential identity
// (vendor, endpoint origin, key) across chat AND media rows, writes only `accountId`, and is idempotent.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-accounts-migration-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { encryptApiKey, decryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { linkConnectionAccounts } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");

const OPENAI_KEY = "fixture-openai-key-1111";
const BIFROST_KEY = "fixture-bifrost-key-2222";
const ROUTER_KEY = "fixture-router-key-3333";
const NANO_KEY = "fixture-nano-key-4444";
let tick = 0;

const db = await getDB();
async function seed(id: string, values: Record<string, unknown> & { provider: string }) {
  const { apiKey = "", ...rest } = values as { apiKey?: string } & Record<string, unknown>;
  const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
  await db.insert(apiConnections).values({
    id,
    name: id,
    apiKeyEncrypted: encryptApiKey(apiKey),
    createdAt: stamp,
    updatedAt: stamp,
    ...rest,
  });
}
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const accountIdOf = async (id: string) => (await rowOf(id)).accountId as string | null;
const withoutAccount = ({ accountId: _accountId, ...rest }: Record<string, unknown>) => rest;

try {
  // A gateway with three upstreams behind one key.
  for (const [id, model] of [
    ["bifrost-a", "linkapi/gpt-5.5"],
    ["bifrost-b", "nanogpt/zai-org/glm-5.2"],
    ["bifrost-c", "linkapi/claude"],
  ] as const) {
    await seed(id, { provider: "custom", baseUrl: "http://bifrost.local:8080/v1", apiKey: BIFROST_KEY, model });
  }
  // One OpenAI key serves a chat Model and an image Model (decision 20). The image row names its endpoint.
  await seed("openai-chat", { provider: "openai", apiKey: OPENAI_KEY, model: "gpt-5" });
  await seed("openai-image", {
    provider: "image_generation",
    imageGenerationSource: "openai",
    baseUrl: "https://api.openai.com/v1/images",
    apiKey: OPENAI_KEY,
    model: "gpt-image-1",
  });
  // The same string as a key for another vendor is a different credential.
  await seed("stability-image", {
    provider: "image_generation",
    imageGenerationSource: "stability",
    apiKey: OPENAI_KEY,
    model: "sd3",
  });
  // The same vendor with another key is another account.
  await seed("openai-other-key", { provider: "openai", apiKey: "fixture-openai-other-key-9999", model: "gpt-5-mini" });
  // OpenRouter chat + inferred-source image share one key; NanoGPT chat + video share one key across paths.
  await seed("router-chat", { provider: "openrouter", apiKey: ROUTER_KEY, model: "anthropic/claude" });
  await seed("router-image", { provider: "image_generation", imageGenerationSource: "openrouter", apiKey: ROUTER_KEY });
  await seed("nano-chat", {
    provider: "nanogpt",
    baseUrl: "https://nano-gpt.com/api/v1",
    apiKey: NANO_KEY,
    managementTokenEncrypted: encryptApiKey("fixture-mgmt-token"),
    showUsageWidget: "true",
    model: "zai-org/glm-5.2",
  });
  await seed("nano-video", {
    provider: "video_generation",
    videoGenerationSource: "nanogpt",
    baseUrl: "https://nano-gpt.com/api",
    apiKey: NANO_KEY,
  });
  // Keyless rows group by provider + endpoint.
  await seed("comfy-a", {
    provider: "image_generation",
    imageGenerationSource: "comfyui",
    baseUrl: "http://127.0.0.1:8188",
  });
  await seed("comfy-b", {
    provider: "image_generation",
    imageGenerationSource: "comfyui",
    baseUrl: "http://127.0.0.1:8188/",
  });
  // Image and video rows of one Comfy server share an account on the same endpoint, including a non-default port; another endpoint stays apart.
  await seed("comfy-video", {
    provider: "video_generation",
    videoGenerationSource: "comfyui",
    baseUrl: "http://127.0.0.1:8188",
  });
  await seed("comfy-9000-image", {
    provider: "image_generation",
    imageGenerationSource: "comfyui",
    baseUrl: "http://127.0.0.1:9000",
  });
  await seed("comfy-9000-video", {
    provider: "video_generation",
    videoGenerationSource: "comfyui",
    baseUrl: "http://127.0.0.1:9000",
  });
  await seed("swarm", {
    provider: "image_generation",
    imageGenerationSource: "swarmui",
    baseUrl: "http://127.0.0.1:7801",
  });
  await seed("local-a", { provider: "custom", baseUrl: "http://127.0.0.1:5001/v1" });
  await seed("local-b", { provider: "custom", baseUrl: "http://127.0.0.1:5002/v1" });
  // A Decision row that borrows another row's credentials has none of its own.
  await seed("decision-borrow", { provider: "decision", credentialsFromConnectionId: "openai-chat" });

  const before = new Map((await db.select().from(apiConnections)).map((row) => [row.id, withoutAccount(row)]));

  const first = await linkConnectionAccounts(db);
  assert.equal(first.detached, 0);
  const accountCount = (await db.select().from(connectionAccounts)).length;
  assert.equal(first.created, accountCount);

  // Gateway rows are one account.
  const bifrost = await accountIdOf("bifrost-a");
  assert(bifrost);
  assert.equal(await accountIdOf("bifrost-b"), bifrost);
  assert.equal(await accountIdOf("bifrost-c"), bifrost);

  // Decision 20: chat and image rows with one OpenAI key are one account; the image endpoint is untouched.
  const openai = await accountIdOf("openai-chat");
  assert(openai);
  assert.equal(await accountIdOf("openai-image"), openai);
  assert.equal((await rowOf("openai-image")).baseUrl, "https://api.openai.com/v1/images");
  const openaiAccount = (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, openai)))[0]!;
  assert.equal(openaiAccount.provider, "openai", "the chat row type anchors the account");
  assert.equal(openaiAccount.baseUrl, "https://api.openai.com/v1");
  assert.equal(decryptApiKey(openaiAccount.apiKeyEncrypted), OPENAI_KEY);
  // Different vendor with the same key string, and a different key, stay apart.
  assert.notEqual(await accountIdOf("stability-image"), openai);
  assert.notEqual(await accountIdOf("openai-other-key"), openai);

  assert.equal(await accountIdOf("router-image"), await accountIdOf("router-chat"));
  const nano = await accountIdOf("nano-chat");
  assert(nano);
  assert.equal(await accountIdOf("nano-video"), nano, "other endpoint path, same origin and key");
  const nanoAccount = (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, nano)))[0]!;
  assert.equal(decryptApiKey(nanoAccount.managementTokenEncrypted), "fixture-mgmt-token");
  assert.equal(nanoAccount.showUsageWidget, "true");

  assert.equal(await accountIdOf("comfy-a"), await accountIdOf("comfy-b"));
  assert.equal(await accountIdOf("comfy-video"), await accountIdOf("comfy-a"));
  assert.equal(await accountIdOf("comfy-9000-video"), await accountIdOf("comfy-9000-image"));
  assert.notEqual(await accountIdOf("comfy-9000-image"), await accountIdOf("comfy-a"));
  assert.notEqual(await accountIdOf("comfy-a"), await accountIdOf("swarm"));
  assert.notEqual(await accountIdOf("local-a"), await accountIdOf("local-b"));
  assert.equal(await accountIdOf("decision-borrow"), null);

  // Nothing but `accountId` changed; caps stay empty so throughput is unchanged.
  const after = await db.select().from(apiConnections);
  assert.equal(after.length, before.size);
  for (const row of after) assert.deepEqual(withoutAccount(row), before.get(row.id), row.id);
  for (const account of await db.select().from(connectionAccounts)) {
    assert.equal(account.maxRequestsPerMinute, null);
    assert.equal(account.maxParallelJobs, null);
    assert.equal(account.enabled, "true");
  }

  // Idempotent.
  const second = await linkConnectionAccounts(db);
  assert.deepEqual(second, { created: 0, linked: 0, detached: 0 });
  assert.equal((await db.select().from(connectionAccounts)).length, accountCount);

  // A row edited in a downgraded build drifts: a new key, or another origin, detaches and regroups it.
  await db
    .update(apiConnections)
    .set({ apiKeyEncrypted: encryptApiKey("fixture-edited-elsewhere-5555") })
    .where(eq(apiConnections.id, "bifrost-c"));
  await db
    .update(apiConnections)
    .set({ baseUrl: "https://other.example/v1" })
    .where(eq(apiConnections.id, "openai-image"));
  const repair = await linkConnectionAccounts(db);
  assert.equal(repair.detached, 2);
  assert.equal(await accountIdOf("bifrost-a"), bifrost);
  const drifted = await accountIdOf("bifrost-c");
  assert(drifted && drifted !== bifrost);
  const movedImage = await accountIdOf("openai-image");
  assert(movedImage && movedImage !== openai);
  assert.equal(await accountIdOf("openai-chat"), openai);
  assert.deepEqual(await linkConnectionAccounts(db), { created: 0, linked: 0, detached: 0 });

  // A missing account detaches its rows and they regroup.
  await db.delete(connectionAccounts).where(eq(connectionAccounts.id, bifrost));
  const orphaned = await linkConnectionAccounts(db);
  assert.equal(orphaned.detached, 2);
  assert.equal(await accountIdOf("bifrost-a"), await accountIdOf("bifrost-b"));
  assert(await accountIdOf("bifrost-a"));
  console.log("connection-accounts-migration regression passed");
} finally {
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
