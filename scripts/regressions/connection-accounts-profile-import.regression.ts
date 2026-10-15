// Connection accounts in profiles: neither export path carries a key or token, an untrusted imported account
// is quarantined, a trusted identity keeps the local key, and one key entered on a quarantined account
// unlocks its linked Models except the one with a foreign-origin embedding endpoint.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-accounts-profile-import-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { decryptApiKey, encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { backupRoutes, quarantineProfileConnectionAccountRow } = await import(
  "../../packages/server/src/routes/backup.routes.js"
);
const { createConnectionAccountsStorage } = await import(
  "../../packages/server/src/services/storage/connection-accounts.storage.js"
);
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../packages/server/node_modules/@fastify/multipart/index.js");

const KEY = "fixture-account-key-1234";
const TOKEN = "fixture-management-token-5678";
const NEW_KEY = "fixture-entered-key-9999";
const FOREIGN = "https://collector.example";

const db = await getDB();
const accounts = createConnectionAccountsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(multipart);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
await app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const accountOf = async (id: string) =>
  (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, id)))[0]!;
const plain = (ciphertext: string) => decryptApiKey(ciphertext);

try {
  // Local install: an OpenAI account with two Models and a NanoGPT account with a management token.
  const created = await app.inject({
    method: "POST",
    url: "/accounts",
    payload: { provider: "openai", apiKey: KEY, model: "gpt-5" },
  });
  assert.equal(created.statusCode, 201, created.body);
  const accountId: string = created.json().account.id;
  const chatId: string = created.json().connectionId;
  const second = await accounts.findOrCreateModel(accountId, { model: "gpt-5-mini", name: "gpt-5-mini" });
  assert(typeof second === "object");
  const nano = await app.inject({
    method: "POST",
    url: "/accounts",
    payload: { provider: "nanogpt", apiKey: KEY + "-nano", managementToken: TOKEN, model: "m" },
  });
  assert.equal(nano.statusCode, 201, nano.body);
  const nanoId: string = nano.json().account.id;
  await accounts.update(accountId, { name: "My OpenAI", enabled: false });

  // Export: JSON and ZIP carry no fixture secret in either table, plaintext or ciphertext.
  const storedAccounts = await db.select().from(connectionAccounts);
  const storedRows = await db.select().from(apiConnections);
  const secrets = [
    KEY,
    TOKEN,
    ...[...storedAccounts, ...storedRows].flatMap((row: Record<string, unknown>) =>
      [row.apiKeyEncrypted, row.managementTokenEncrypted].filter((value): value is string => !!value),
    ),
  ];
  assert(secrets.length >= 6, "fixture must hold keys and tokens to leak");
  const jsonExport = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(jsonExport.statusCode, 200, jsonExport.body);
  const zipExport = await app.inject({ method: "GET", url: "/api/backup/export-profile?format=zip" });
  assert.equal(zipExport.statusCode, 200);
  const zipText = new AdmZip(zipExport.rawPayload)
    .getEntries()
    .map((entry) => entry.getData().toString("utf8"))
    .join("\n");
  for (const [label, text] of [
    ["JSON", jsonExport.body],
    ["ZIP", zipText],
  ] as const) {
    for (const secret of secrets) assert(!text.includes(secret), `${label} export leaked a credential`);
    assert(text.includes("connection_accounts"), `${label} export must still carry the account table`);
    assert(text.includes("My OpenAI"), `${label} export keeps non-secret account settings`);
  }
  const exported = JSON.parse(jsonExport.body);
  const tables = (exported.data?.fileStorage ?? exported.fileStorage).tables as Record<string, Array<any>>;
  assert.equal(tables.connection_accounts.length, 2);
  for (const row of tables.connection_accounts) {
    assert.equal(row.apiKeyEncrypted, "");
    assert.equal(row.managementTokenEncrypted, "");
  }

  // Pure rule: trusted only for the same id, provider, base URL and an account not under review.
  const local = await accountOf(accountId);
  const exportedAccount = tables.connection_accounts.find((row) => row.id === accountId)!;
  const trusted = quarantineProfileConnectionAccountRow(exportedAccount, local);
  assert.equal(plain(trusted.apiKeyEncrypted as string), KEY);
  assert.equal(trusted.profileImportReviewRequired, "false");
  assert.equal(trusted.enabled, "false", "enabled is kept");
  for (const changed of [{ baseUrl: `${FOREIGN}/v1` }, { provider: "custom" }, { id: "other-id" }]) {
    const plan = quarantineProfileConnectionAccountRow({ ...exportedAccount, ...changed }, local);
    assert.equal(plan.apiKeyEncrypted, "", `untrusted when ${Object.keys(changed)[0]} differs`);
    assert.equal(plan.profileImportReviewRequired, "true");
  }
  const underReview = quarantineProfileConnectionAccountRow(exportedAccount, {
    ...local,
    profileImportReviewRequired: "true",
  });
  assert.equal(underReview.apiKeyEncrypted, "", "an account under review never lends its key");
  assert.equal(quarantineProfileConnectionAccountRow({ ...exportedAccount, apiKeyEncrypted: "x" }).apiKeyEncrypted, "");

  // Import: the same install's profile keeps the local key and links; a foreign profile does not.
  const importProfile = async (tablesPayload: Record<string, unknown[]>) => {
    const preview = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile?preview=true",
      payload: {
        type: "marinara_profile",
        version: 1,
        exportedAt: new Date(0).toISOString(),
        data: { fileStorage: { version: 1, tables: tablesPayload, files: [] } },
      },
    });
    assert.equal(preview.statusCode, 200, preview.body);
    const done = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile",
      headers: { "x-profile-preview-token": preview.json().previewToken },
    });
    assert.equal(done.statusCode, 200, done.body);
  };
  await importProfile({ connection_accounts: tables.connection_accounts, api_connections: tables.api_connections });
  assert.equal(plain((await accountOf(accountId)).apiKeyEncrypted), KEY, "trusted account keeps the local key");
  assert.equal(plain((await accountOf(nanoId)).managementTokenEncrypted), TOKEN);
  assert.equal((await accountOf(accountId)).profileImportReviewRequired, "false");
  assert.equal((await rowOf(chatId)).accountId, accountId, "a trusted Model stays under its local account");
  assert.equal(plain((await rowOf(chatId)).apiKeyEncrypted), KEY);

  // A foreign profile: a lookalike account id with another origin, plus Models claiming the local account.
  const modelFixture = (id: string, overrides: Record<string, unknown> = {}) => ({
    ...tables.api_connections.find((row) => row.id === chatId)!,
    id,
    name: id,
    accountId,
    apiKeyEncrypted: encryptApiKey("foreign-profile-key"),
    isDefault: "false",
    ...overrides,
  });
  const foreignAccount = {
    ...exportedAccount,
    id: "foreign-account",
    name: "Foreign",
    baseUrl: `${FOREIGN}/v1`,
    apiKeyEncrypted: encryptApiKey("foreign-profile-key"),
    managementTokenEncrypted: encryptApiKey("foreign-profile-token"),
    enabled: "true",
  };
  await importProfile({
    connection_accounts: [foreignAccount, { ...exportedAccount, baseUrl: `${FOREIGN}/v1`, apiKeyEncrypted: "k" }],
    api_connections: [
      modelFixture("imported-same-origin", { accountId: "foreign-account" }),
      modelFixture("imported-claims-local", { accountId }),
      modelFixture("imported-embedding", {
        accountId: "foreign-account",
        embeddingBaseUrl: `${FOREIGN}/embeddings`,
      }),
    ],
  });
  const clobbered = await accountOf(accountId);
  assert.equal(clobbered.apiKeyEncrypted, "", "same id with another base URL must not keep the local key");
  assert.equal(clobbered.profileImportReviewRequired, "true");
  const foreign = await accountOf("foreign-account");
  assert.equal(foreign.apiKeyEncrypted, "");
  assert.equal(foreign.managementTokenEncrypted, "");
  assert.equal(foreign.profileImportReviewRequired, "true");
  assert.equal(foreign.enabled, "true", "enabled is kept");
  const importedIds = ["imported-same-origin", "imported-claims-local", "imported-embedding"];
  for (const id of importedIds) {
    const row = await rowOf(id);
    assert.equal(row.apiKeyEncrypted, "");
    assert.equal(row.profileImportReviewRequired, "true");
    assert.notEqual(row.accountId, accountId, `${id} must not stay linked to the local account`);
  }

  // One key entered on the quarantined account unlocks its linked Models, except the foreign-endpoint one.
  const reviewAccountId = (await rowOf("imported-same-origin")).accountId as string;
  assert(reviewAccountId, "quarantined Models are regrouped into a review account");
  assert.equal((await accountOf(reviewAccountId)).profileImportReviewRequired, "true");
  await accounts.update(reviewAccountId, { apiKey: NEW_KEY });
  assert.equal((await accountOf(reviewAccountId)).profileImportReviewRequired, "false");
  const unlocked = await rowOf("imported-same-origin");
  assert.equal(plain(unlocked.apiKeyEncrypted), NEW_KEY);
  assert.equal(unlocked.profileImportReviewRequired, "false");
  const embedding = await rowOf("imported-embedding");
  assert.equal(embedding.profileImportReviewRequired, "true", "a foreign-origin embedding endpoint stays under review");
  assert.equal(plain((await rowOf(chatId)).apiKeyEncrypted), KEY, "the local Model never receives the entered key");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}

console.info("Connection account profile import regressions passed.");
