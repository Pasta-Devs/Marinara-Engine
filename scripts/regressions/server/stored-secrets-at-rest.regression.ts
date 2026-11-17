import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The DeepL key, the Discord mirror webhook and connection custom headers are stored encrypted (`enc:v1:`) and
// every response shows only a mask. Sending the mask back keeps the saved value, "" clears it, a new value replaces
// it, and the server resolves the real value itself for translation, mirroring and outgoing headers.
const dir = mkdtempSync(join(tmpdir(), "marinara-stored-secrets-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB } = await import("../../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../../packages/server/src/routes/chat-presets.routes.js");
const { connectionsRoutes } = await import("../../../packages/server/src/routes/connections.routes.js");
const { appSettingsRoutes } = await import("../../../packages/server/src/routes/app-settings.routes.js");
const { translateRoutes } = await import("../../../packages/server/src/routes/translate.routes.js");
const { sanitizeProfileTableRows, quarantineProfileApiConnectionRow } =
  await import("../../../packages/server/src/routes/backup.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createChatPresetsStorage } =
  await import("../../../packages/server/src/services/storage/chat-presets.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } =
  await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { resolveDeeplApiKey } = await import("../../../packages/server/src/services/translation.service.js");
const { resolveLocalBackendHeaders } = await import("../../../packages/server/src/services/image/image-generation.js");
const { withConnectionDefaultParameters } =
  await import("../../../packages/server/src/services/llm/connection-default-provider.js");
const { getMariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { readChatMetadataSecret, redactStoredSecretsDeep, decryptConnectionHeaderSecrets } =
  await import("../../../packages/server/src/utils/stored-secrets.js");
const { STORED_SECRET_MASK, TRANSLATOR_DEFAULTS_SETTINGS_KEY } = await import("../../../packages/shared/src/index.js");

const DEEPL_KEY = "11111111-2222-3333-4444-555555555555:fx";
const WEBHOOK = "https://discord.com/api/webhooks/123456789/secret-token_ABC";
const NEW_WEBHOOK = "https://discord.com/api/webhooks/987654321/replaced-token";
const HEADER_VALUE = "cf-access-secret-value";

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
await app.register(connectionsRoutes, { prefix: "/api/connections" });
await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
await app.register(translateRoutes, { prefix: "/api/translate" });
await app.ready();

const chats = createChatsStorage(db);
const storedMeta = async (id: string) => JSON.parse((await chats.getById(id))!.metadata as string);

try {
  const chat = (await chats.create({ name: "Secrets", mode: "conversation", characterIds: [] }))!;

  // ── Write encrypts ──
  const patch = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { translationProvider: "deepl", translationDeeplApiKey: DEEPL_KEY, discordWebhookUrl: WEBHOOK },
  });
  assert.equal(patch.statusCode, 200, patch.body);
  assert.ok(!patch.body.includes(DEEPL_KEY) && !patch.body.includes(WEBHOOK), "the patch response is masked");
  let saved = await storedMeta(chat.id);
  assert.match(saved.translationDeeplApiKey, /^enc:v1:/, "the DeepL key is encrypted at rest");
  assert.match(saved.discordWebhookUrl, /^enc:v1:/, "the webhook is encrypted at rest");
  const encryptedKey = saved.translationDeeplApiKey;

  // ── GET masks (chat by id, chat list) ──
  for (const url of [`/api/chats/${chat.id}`, "/api/chats"]) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes(DEEPL_KEY), `${url} hides the key`);
    assert.ok(!response.body.includes(WEBHOOK) && !response.body.includes("secret-token"), `${url} hides the webhook`);
    assert.ok(!response.body.includes("enc:v1:"), `${url} does not send the ciphertext either`);
  }
  const fetched = (await app.inject({ method: "GET", url: `/api/chats/${chat.id}` })).json();
  assert.equal(fetched.metadata.translationDeeplApiKey, STORED_SECRET_MASK, "the UI can tell a key is saved");
  assert.equal(fetched.metadata.discordWebhookUrl, STORED_SECRET_MASK);

  // ── Mask round-trip (and an omitted field) keeps the value ──
  const roundTrip = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { ...fetched.metadata, translationTargetLang: "de" },
  });
  assert.equal(roundTrip.statusCode, 200, roundTrip.body);
  saved = await storedMeta(chat.id);
  assert.equal(saved.translationDeeplApiKey, encryptedKey, "sending the mask back keeps the saved key");
  assert.equal(readChatMetadataSecret(saved, "discordWebhookUrl"), WEBHOOK, "and the saved webhook");
  // A whole metadata write from server code that copied a masked response keeps the value too.
  await chats.updateMetadata(chat.id, { ...saved, translationDeeplApiKey: STORED_SECRET_MASK });
  assert.equal(readChatMetadataSecret(await storedMeta(chat.id), "translationDeeplApiKey"), DEEPL_KEY);

  // ── Translation and Discord mirroring resolve the real value on the server ──
  assert.equal(
    await resolveDeeplApiKey(db, { chatId: chat.id }),
    DEEPL_KEY,
    "translate requests carry only the chat id",
  );
  assert.equal(await resolveDeeplApiKey(db, { chatId: chat.id, deeplApiKey: STORED_SECRET_MASK }), DEEPL_KEY);
  assert.equal(
    await resolveDeeplApiKey(db, { chatId: chat.id, deeplApiKey: "legacy-client-key" }),
    "legacy-client-key",
    "an older client that sends its own key still works",
  );
  assert.equal(readChatMetadataSecret(await storedMeta(chat.id), "discordWebhookUrl"), WEBHOOK);

  // ── A new value replaces; an empty string clears ──
  const replaced = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { discordWebhookUrl: NEW_WEBHOOK },
  });
  assert.equal(replaced.statusCode, 200, replaced.body);
  assert.equal(readChatMetadataSecret(await storedMeta(chat.id), "discordWebhookUrl"), NEW_WEBHOOK);
  const invalid = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { discordWebhookUrl: "https://example.com/hook" },
  });
  assert.equal(invalid.statusCode, 400, "a new webhook is still validated");
  const cleared = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { translationDeeplApiKey: "" },
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
  assert.equal((await storedMeta(chat.id)).translationDeeplApiKey, "", "an empty string clears the key");
  assert.equal(await resolveDeeplApiKey(db, { chatId: chat.id }), undefined);

  // ── A plain value from an older version keeps working and is encrypted on the next save ──
  const legacy = (await chats.create({ name: "Legacy", mode: "conversation", characterIds: [] }))!;
  const { chats: chatsTable } = await import("../../../packages/server/src/db/schema/chats.js");
  const { eq } = await import("../../../packages/server/src/db/file-query.js");
  await db
    .update(chatsTable)
    .set({ metadata: JSON.stringify({ translationDeeplApiKey: DEEPL_KEY, discordWebhookUrl: WEBHOOK }) })
    .where(eq(chatsTable.id, legacy.id));
  assert.equal(await resolveDeeplApiKey(db, { chatId: legacy.id }), DEEPL_KEY, "plain values are read as they are");
  const legacyGet = await app.inject({ method: "GET", url: `/api/chats/${legacy.id}` });
  assert.ok(!legacyGet.body.includes(DEEPL_KEY) && !legacyGet.body.includes(WEBHOOK), "plain values are masked too");
  await app.inject({ method: "PATCH", url: `/api/chats/${legacy.id}/metadata`, payload: { autoTranslate: true } });
  const resaved = await storedMeta(legacy.id);
  assert.match(resaved.translationDeeplApiKey, /^enc:v1:/, "the next save encrypts a plain key");
  assert.match(resaved.discordWebhookUrl, /^enc:v1:/);
  assert.equal(readChatMetadataSecret(resaved, "translationDeeplApiKey"), DEEPL_KEY);

  // ── Settings profiles ──
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { translationDeeplApiKey: DEEPL_KEY },
  });
  const chatMasked = (await app.inject({ method: "GET", url: `/api/chats/${chat.id}` })).json();
  const created = await app.inject({
    method: "POST",
    url: `/api/chat-presets?fromChatId=${chat.id}`,
    payload: { name: "With key", mode: "conversation", settings: { metadata: chatMasked.metadata } },
  });
  assert.equal(created.statusCode, 200, created.body);
  assert.ok(!created.body.includes(DEEPL_KEY), "a profile response is masked");
  const profile = created.json();
  const profileRow = await createChatPresetsStorage(db).getById(profile.id);
  const profileMeta = profileRow!.settings.metadata as Record<string, unknown>;
  assert.match(String(profileMeta.translationDeeplApiKey), /^enc:v1:/, "the profile stores the chat's key encrypted");
  assert.equal(readChatMetadataSecret(profileMeta, "translationDeeplApiKey"), DEEPL_KEY);
  for (const url of ["/api/chat-presets", `/api/chat-presets/${profile.id}`, "/api/chat-presets?mode=conversation"]) {
    const response = await app.inject({ method: "GET", url });
    assert.ok(!response.body.includes(DEEPL_KEY) && !response.body.includes("enc:v1:"), `${url} is masked`);
  }
  // Saving the profile's masked settings back keeps its key.
  const resave = await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${profile.id}/settings`,
    payload: profile.settings,
  });
  assert.equal(resave.statusCode, 200, resave.body);
  const resavedProfile = await createChatPresetsStorage(db).getById(profile.id);
  assert.equal(
    readChatMetadataSecret(resavedProfile!.settings.metadata, "translationDeeplApiKey"),
    DEEPL_KEY,
    "a masked profile save keeps the key",
  );
  const exported = await app.inject({ method: "GET", url: `/api/chat-presets/${profile.id}/export` });
  assert.ok(!exported.body.includes("translationDeeplApiKey"), "a profile export leaves the key out");

  // A new chat set up from the profile (Chat Setup sends the profile's masked settings plus appliedChatPresetId)
  // gets the profile's key, not a lost one; a mask without a newly applied profile keeps the chat's own value.
  const fromProfile = (await chats.create({ name: "From profile", mode: "conversation", characterIds: [] }))!;
  const setup = await app.inject({
    method: "PATCH",
    url: `/api/chats/${fromProfile.id}/metadata`,
    payload: { ...profile.settings.metadata, appliedChatPresetId: profile.id },
  });
  assert.equal(setup.statusCode, 200, setup.body);
  assert.ok(!setup.body.includes(DEEPL_KEY), "the setup response is masked");
  assert.equal(
    readChatMetadataSecret(await storedMeta(fromProfile.id), "translationDeeplApiKey"),
    DEEPL_KEY,
    "a chat set up from a profile keeps the profile's DeepL key",
  );
  assert.equal(
    readChatMetadataSecret(await storedMeta(fromProfile.id), "discordWebhookUrl"),
    readChatMetadataSecret(profileMeta, "discordWebhookUrl"),
    "and the profile's webhook",
  );
  assert.ok(readChatMetadataSecret(profileMeta, "discordWebhookUrl"), "the profile holds a webhook to carry over");
  // The setup wizard may record the profile first, then send its masked settings under the same id.
  const sameId = (await chats.create({ name: "Same id", mode: "conversation", characterIds: [] }))!;
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${sameId.id}/metadata`,
    payload: { appliedChatPresetId: profile.id },
  });
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${sameId.id}/metadata`,
    payload: { ...profile.settings.metadata, appliedChatPresetId: profile.id },
  });
  assert.equal(
    readChatMetadataSecret(await storedMeta(sameId.id), "translationDeeplApiKey"),
    DEEPL_KEY,
    "a profile already recorded on the chat still fills its masked key",
  );
  // A chat's own key wins over the unchanged profile's when the mask comes back.
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${sameId.id}/metadata`,
    payload: { translationDeeplApiKey: "chat-own-key" },
  });
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${sameId.id}/metadata`,
    payload: { translationDeeplApiKey: STORED_SECRET_MASK, appliedChatPresetId: profile.id },
  });
  assert.equal(readChatMetadataSecret(await storedMeta(sameId.id), "translationDeeplApiKey"), "chat-own-key");
  const keyless = await app.inject({
    method: "POST",
    url: "/api/chat-presets",
    payload: { name: "No key", mode: "conversation", settings: { metadata: { translationProvider: "deepl" } } },
  });
  const plainChat = (await chats.create({ name: "Keyless profile", mode: "conversation", characterIds: [] }))!;
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${plainChat.id}/metadata`,
    payload: { translationDeeplApiKey: STORED_SECRET_MASK, appliedChatPresetId: keyless.json().id },
  });
  assert.equal(
    readChatMetadataSecret(await storedMeta(plainChat.id), "translationDeeplApiKey"),
    "",
    "a profile without a key gives the new chat none",
  );

  // ── Translator defaults ──
  const defaultsPut = await app.inject({
    method: "PUT",
    url: `/api/app-settings/${TRANSLATOR_DEFAULTS_SETTINGS_KEY}?fromChatId=${chat.id}`,
    payload: { value: JSON.stringify({ translationProvider: "deepl", translationDeeplApiKey: STORED_SECRET_MASK }) },
  });
  assert.equal(defaultsPut.statusCode, 200, defaultsPut.body);
  const rawDefaults = JSON.parse((await createAppSettingsStorage(db).get(TRANSLATOR_DEFAULTS_SETTINGS_KEY))!);
  assert.match(rawDefaults.translationDeeplApiKey, /^enc:v1:/, "translator defaults store the chat's key encrypted");
  assert.equal(readChatMetadataSecret(rawDefaults, "translationDeeplApiKey"), DEEPL_KEY);
  const defaultsGet = await app.inject({ method: "GET", url: `/api/app-settings/${TRANSLATOR_DEFAULTS_SETTINGS_KEY}` });
  assert.ok(!defaultsGet.body.includes(DEEPL_KEY) && !defaultsGet.body.includes("enc:v1:"), "defaults are masked");
  const fromDefaults = (await chats.create({ name: "From defaults", mode: "conversation", characterIds: [] }))!;
  assert.equal(await resolveDeeplApiKey(db, { chatId: fromDefaults.id }), DEEPL_KEY, "a new chat inherits the key");

  // Noodle forwards the defaults mask without a chat id. Only the outbound provider request gets the real key.
  {
    const originalFetch = globalThis.fetch;
    const originalLookup = dns.lookup;
    const requests: Array<{ url: string; authorization: string | null; body: unknown }> = [];
    const appSettings = createAppSettingsStorage(db);
    const translate = (input: { chatId?: string; deeplApiKey?: string } = {}) =>
      app.inject({
        method: "POST",
        url: "/api/translate",
        payload: { text: "Hello", provider: "deepl", targetLanguage: "de", ...input },
      });
    dns.lookup = (async (hostname: string) => {
      assert.ok(["api-free.deepl.com", "api.deepl.com"].includes(hostname), "only DeepL DNS is used");
      return [{ address: "8.8.8.8", family: 4 }];
    }) as typeof dns.lookup;
    globalThis.fetch = async (url, init) => {
      assert.ok(
        ["https://api-free.deepl.com/v2/translate", "https://api.deepl.com/v2/translate"].includes(String(url)),
      );
      requests.push({
        url: String(url),
        authorization: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ translations: [{ text: "Hallo" }] });
    };
    try {
      const maskedKey = JSON.parse(defaultsGet.json().value).translationDeeplApiKey;
      assert.equal(maskedKey, STORED_SECRET_MASK);
      for (const deeplApiKey of [maskedKey, undefined, "", rawDefaults.translationDeeplApiKey]) {
        const response = await translate({ deeplApiKey });
        assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual(response.json(), { translatedText: "Hallo" });
        assert.deepEqual(requests.at(-1), {
          url: "https://api-free.deepl.com/v2/translate",
          authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
          body: { text: ["Hello"], target_lang: "DE" },
        });
      }
      await chats.updateMetadata(fromDefaults.id, { translationDeeplApiKey: "chat-specific-key" });
      assert.equal((await translate({ chatId: fromDefaults.id, deeplApiKey: maskedKey })).statusCode, 200);
      assert.equal(requests.at(-1)?.authorization, "DeepL-Auth-Key chat-specific-key", "the chat key wins");
      assert.equal((await translate({ deeplApiKey: " legacy-client-key " })).statusCode, 200);
      assert.equal(requests.at(-1)?.authorization, "DeepL-Auth-Key legacy-client-key", "explicit plaintext wins");
      assert.equal((await translate({ chatId: fromDefaults.id, deeplApiKey: "legacy-client-key" })).statusCode, 200);
      assert.equal(requests.at(-1)?.authorization, "DeepL-Auth-Key legacy-client-key");

      const assertMissingKey = async (input: { chatId?: string; deeplApiKey?: string } = {}) => {
        const before = requests.length;
        const response = await translate(input);
        assert.equal(response.statusCode, 400, response.body);
        assert.equal(response.json().message, "DeepL API key is required");
        assert.equal(requests.length, before, "missing or unusable keys make no upstream request");
      };
      await chats.updateMetadata(fromDefaults.id, { translationDeeplApiKey: "" });
      await assertMissingKey({ chatId: fromDefaults.id, deeplApiKey: maskedKey });
      await assertMissingKey({ chatId: "missing-chat", deeplApiKey: maskedKey });

      const after = await app.inject({ method: "GET", url: `/api/app-settings/${TRANSLATOR_DEFAULTS_SETTINGS_KEY}` });
      assert.equal(JSON.parse(after.json().value).translationDeeplApiKey, STORED_SECRET_MASK);
      assert.ok(!after.body.includes(DEEPL_KEY) && !after.body.includes("enc:v1:"));
      await appSettings.remove(TRANSLATOR_DEFAULTS_SETTINGS_KEY);
      await assertMissingKey({ deeplApiKey: maskedKey });
      for (const value of [
        "",
        "broken json",
        "null",
        "[]",
        JSON.stringify({ translationDeeplApiKey: "" }),
        JSON.stringify({ translationDeeplApiKey: STORED_SECRET_MASK }),
        JSON.stringify({ translationDeeplApiKey: "enc:v1:broken" }),
        JSON.stringify({ translationDeeplApiKey: 42 }),
      ]) {
        await appSettings.set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, value);
        await assertMissingKey({ deeplApiKey: maskedKey });
      }
      await appSettings.set(
        TRANSLATOR_DEFAULTS_SETTINGS_KEY,
        JSON.stringify({ translationDeeplApiKey: "legacy-default" }),
      );
      assert.equal((await translate({ deeplApiKey: maskedKey })).statusCode, 200);
      assert.equal(requests.at(-1)?.authorization, "DeepL-Auth-Key legacy-default", "legacy saved defaults still work");
    } finally {
      globalThis.fetch = originalFetch;
      dns.lookup = originalLookup;
      await appSettings.set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, JSON.stringify(rawDefaults));
    }
  }

  // ── Connection custom headers ──
  const connections = createConnectionsStorage(db);
  const connection = await connections.create({
    name: "Headers",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture-key",
    baseUrl: "http://127.0.0.1:9/v1",
  });
  const putParams = (params: Record<string, unknown>) =>
    app.inject({ method: "PUT", url: `/api/connections/${connection.id}/default-parameters`, payload: params });
  const imageProfile = { version: 1, service: "comfyui", customHeaders: { "X-Image-Token": HEADER_VALUE } };
  assert.equal(
    (await putParams({ customHeaders: { "X-Access-Token": HEADER_VALUE }, imageGeneration: imageProfile })).statusCode,
    200,
  );
  const storedParams = () => connections.getById(connection.id).then((row) => JSON.parse(row!.defaultParameters!));
  let params = await storedParams();
  assert.match(params.customHeaders["X-Access-Token"], /^enc:v1:/, "header values are encrypted at rest");
  assert.match(params.imageGeneration.customHeaders["X-Image-Token"], /^enc:v1:/, "image defaults headers too");
  for (const url of ["/api/connections", `/api/connections/${connection.id}`]) {
    const response = await app.inject({ method: "GET", url });
    assert.ok(!response.body.includes(HEADER_VALUE) && !response.body.includes("enc:v1:"), `${url} masks headers`);
  }
  const maskedRow = (await app.inject({ method: "GET", url: `/api/connections/${connection.id}` })).json();
  const masked = JSON.parse(maskedRow.defaultParameters);
  assert.equal(masked.customHeaders["X-Access-Token"], STORED_SECRET_MASK);
  // The editor sends the masked headers back with another change: the values are kept.
  assert.equal((await putParams({ ...masked, temperature: 0.4 })).statusCode, 200);
  params = await storedParams();
  assert.equal(params.temperature, 0.4);
  const usable = decryptConnectionHeaderSecrets(params);
  assert.equal(usable.customHeaders["X-Access-Token"], HEADER_VALUE, "a masked header keeps its value");
  assert.equal(usable.imageGeneration.customHeaders["X-Image-Token"], HEADER_VALUE);
  // Outgoing requests carry the real value, never the ciphertext or the mask.
  let sentHeaders: Record<string, string> = {};
  const provider = {
    setCustomRequestHeaders(headers: Record<string, string>) {
      sentHeaders = headers;
    },
  };
  withConnectionDefaultParameters(provider as never, JSON.stringify(params));
  assert.deepEqual(sentHeaders, { "X-Access-Token": HEADER_VALUE }, "LLM requests send the decrypted header");
  assert.deepEqual(
    resolveLocalBackendHeaders("", { ...params.imageGeneration.customHeaders, "X-Masked": STORED_SECRET_MASK }),
    { "X-Image-Token": HEADER_VALUE },
    "image/video backends get decrypted headers and never a mask",
  );
  // A new value replaces; a removed header is gone.
  assert.equal((await putParams({ customHeaders: { "X-Access-Token": "rotated" } })).statusCode, 200);
  assert.deepEqual(decryptConnectionHeaderSecrets(await storedParams()).customHeaders, { "X-Access-Token": "rotated" });

  // Profile exports carry the header names with the mask; a trusted re-import keeps this install's values and any
  // other row gets none.
  const exportedRow = sanitizeProfileTableRows("api_connections", [await connections.getById(connection.id)])[0]!;
  assert.ok(!String(exportedRow.defaultParameters).includes("enc:v1:"), "profile exports leave header values out");
  assert.ok(!String(exportedRow.defaultParameters).includes("rotated"));
  const existing = (await connections.getById(connection.id)) as unknown as Record<string, unknown>;
  const trusted = quarantineProfileApiConnectionRow(exportedRow, existing);
  assert.equal(trusted.trustedIdentity, true);
  assert.equal(
    decryptConnectionHeaderSecrets(JSON.parse(String(trusted.row.defaultParameters))).customHeaders["X-Access-Token"],
    "rotated",
  );
  const untrusted = quarantineProfileApiConnectionRow(exportedRow, undefined);
  assert.deepEqual(JSON.parse(String(untrusted.row.defaultParameters)).customHeaders, {});

  // ── Profile exports of chats leave both secrets out ──
  const profileChats = sanitizeProfileTableRows("chats", [(await chats.getById(chat.id)) as Record<string, unknown>]);
  const exportedMeta = JSON.parse(String(profileChats[0]!.metadata));
  assert.equal(exportedMeta.translationDeeplApiKey, undefined);
  assert.equal(exportedMeta.discordWebhookUrl, undefined);

  // ── Professor Mari's database reads show only the mask ──
  const mari = getMariDbService(db);
  for (const argv of [
    ["db", "get", "chats", legacy.id],
    ["db", "get", "--parsed", "chats", legacy.id],
    ["db", "get", "--parsed", "chats", chat.id],
    ["db", "get", "--parsed", "api_connections", connection.id],
  ]) {
    const read = await mari.executeCli({ argv });
    assert.equal(read.ok, true, `${argv.join(" ")}: ${read.error ?? ""}`);
    const text = JSON.stringify(read);
    assert.ok(!text.includes(DEEPL_KEY) && !text.includes("secret-token"), `${argv.join(" ")} hides chat secrets`);
    assert.ok(!text.includes("rotated") && !text.includes("replaced-token"), `${argv.join(" ")} hides the rest`);
    assert.ok(!text.includes("enc:v1:"), `${argv.join(" ")} hides the ciphertext too`);
  }
  assert.deepEqual(
    redactStoredSecretsDeep({ value: JSON.stringify({ translationDeeplApiKey: DEEPL_KEY, other: 1 }) }),
    { value: JSON.stringify({ translationDeeplApiKey: STORED_SECRET_MASK, other: 1 }) },
    "JSON text columns are redacted too",
  );

  console.info("Stored secrets regression passed (encrypt, mask, keep, clear, resolve, export, Mari reads).");
  // Header names come from request JSON: a "__proto__" header never reaches the prototype or the stored copy.
  {
    const { sealConnectionHeaderSecrets } = await import("../../../packages/server/src/utils/stored-secrets.js");
    const sealed = sealConnectionHeaderSecrets(
      '{"customHeaders":{"__proto__":{"polluted":"yes"},"X-Key":"header-secret"}}',
    ) as string;
    const parsed = JSON.parse(sealed) as { customHeaders: Record<string, unknown> };
    assert.equal(Object.prototype.hasOwnProperty.call(parsed.customHeaders, "__proto__"), false);
    assert.match(String(parsed.customHeaders["X-Key"]), /^enc:v1:/u);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  }
  // A decision model's saved custom headers are sent decrypted; an older plain value still works.
  {
    const { resolveDecisionConnection } =
      await import("../../../packages/server/src/services/decision/decision-connection.js");
    const { sealConnectionHeaderSecrets: seal } = await import("../../../packages/server/src/utils/stored-secrets.js");
    const row = {
      id: "decision-row",
      provider: "decision",
      baseUrl: "",
      model: "",
      apiKey: "typesafe-key",
      decisionSource: "typesafe",
    };
    const sealedParams = seal(JSON.stringify({ customHeaders: { "X-Access": HEADER_VALUE } })) as string;
    assert.match(sealedParams, /enc:v1:/u);
    const resolved = await resolveDecisionConnection({ ...row, defaultParameters: sealedParams }, async () => null);
    assert.equal(resolved.connection?.headers?.["X-Access"], HEADER_VALUE, "decision requests send the plain header");
    const legacy = await resolveDecisionConnection(
      { ...row, defaultParameters: JSON.stringify({ customHeaders: { "X-Access": "plain-old" } }) },
      async () => null,
    );
    assert.equal(legacy.connection?.headers?.["X-Access"], "plain-old");
  }
} finally {
  await app.close();
  await db._fileStore?.close();
  rmSync(dir, { recursive: true, force: true });
}
