import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { DEFAULT_GENERATION_PARAMS } from "../../packages/shared/src/constants/defaults.js";
import { isStockMarinaraUniversalPreset } from "../../packages/shared/src/types/prompt.js";

const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");

const dir = mkdtempSync(join(tmpdir(), "marinara-stock-parameters-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { seedDefaultPreset } = await import("../../packages/server/src/db/seed.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { assemblePrompt, getPresetGenerationParameters } =
  await import("../../packages/server/src/services/prompt/assembler.js");
const { registerParameterPreviewRoute } =
  await import("../../packages/server/src/routes/generate/parameter-preview-route.js");
const { resolveGenerationParameters } =
  await import("../../packages/server/src/services/generation/provider-generation-runtime.js");
const { promptPresets, apiConnections, chats } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const db = await createFileNativeDB();
const app = Fastify();
app.decorate("db", db);

const legacyParameters = {
  ...DEFAULT_GENERATION_PARAMS,
  temperature: 0.2,
  reasoningEffort: "low" as const,
  verbosity: "high" as const,
  serviceTier: "priority" as const,
  customParameters: { legacy_stock_flag: true },
  assistantPrefill: "legacy prefill",
  singleUserMessage: true,
  strictRoleFormatting: false,
  enabledParameters: { temperature: false },
};

try {
  const storage = createPromptsStorage(db);
  const settings = createAppSettingsStorage(db);
  await seedDefaultPreset(db);
  const stock = (await storage.list()).find(isStockMarinaraUniversalPreset)!;
  assert.ok(stock);
  assert.deepEqual(JSON.parse(stock.parameters), {}, "fresh stock presets save no generation parameters");

  await storage.update(stock.id, { parameters: legacyParameters });
  assert.deepEqual(
    JSON.parse((await storage.getById(stock.id))!.parameters),
    {},
    "stock updates cannot assign controls",
  );

  // Model a profile seeded before snapshots existed, without using the new storage guard.
  await db
    .update(promptPresets)
    .set({ parameters: JSON.stringify(legacyParameters) })
    .where(eq(promptPresets.id, stock.id));
  await settings.remove("seed:marinara-universal-preset:snapshot-sha256");
  await settings.set("seed:marinara-universal-preset:sha256", "older-bundle");
  await seedDefaultPreset(db);
  assert.deepEqual(
    JSON.parse((await storage.getById(stock.id))!.parameters),
    {},
    "no-snapshot upgrades clear old controls",
  );

  await settings.set("seed:marinara-universal-preset:sha256", "older-bundle");
  await seedDefaultPreset(db);
  assert.deepEqual(
    JSON.parse((await storage.getById(stock.id))!.parameters),
    {},
    "snapshot upgrades keep stock parameters empty",
  );

  // Runtime identity checks also protect profiles whose legacy row has not been reseeded yet.
  const legacyStock = { ...stock, parameters: JSON.stringify(legacyParameters) };
  assert.deepEqual(getPresetGenerationParameters(legacyStock), {});
  const userPreset = (await storage.create({
    name: stock.name,
    author: stock.author,
    parameters: legacyParameters,
  }))!;
  assert.equal(
    getPresetGenerationParameters(userPreset).temperature,
    0.2,
    "matching names do not disable user controls",
  );
  assert.equal(getPresetGenerationParameters(userPreset).singleUserMessage, true);

  const assemble = (preset: typeof stock) =>
    assemblePrompt({
      db,
      preset: { ...preset, sectionOrder: '["history"]', groupOrder: "[]" },
      sections: [
        {
          id: "history",
          presetId: preset.id,
          identifier: "chat_history",
          name: "History",
          content: "",
          role: "system",
          enabled: "true",
          isMarker: "true",
          groupId: null,
          markerConfig: '{"type":"chat_history"}',
          injectionPosition: "ordered",
          injectionDepth: 0,
          injectionOrder: 0,
          forbidOverrides: "false",
        },
      ],
      groups: [],
      choiceBlocks: [],
      chatChoices: {},
      chatId: "stock-parameters-proof",
      characterIds: [],
      personaName: "User",
      personaDescription: "",
      chatMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
      disableLorebooks: true,
      enableAgents: false,
      previewOnly: true,
    });
  const assembledStock = await assemble(legacyStock);
  assert.deepEqual(assembledStock.parameters, {}, "the real assembler emits no stock parameter layer");
  assert.equal(assembledStock.messages.at(-1)?.role, "assistant", "legacy stock formatting controls are ignored");
  const assembledUser = await assemble(userPreset);
  assert.equal(assembledUser.parameters.temperature, 0.2);
  assert.equal(assembledUser.messages.length, 1, "user formatting controls remain effective");

  const runtime = resolveGenerationParameters({
    connection: {
      provider: "custom",
      model: "fixture",
      defaultParameters: { temperature: 0.7, reasoningEffort: null, customParameters: { connection_flag: true } },
    },
    chatMode: "roleplay",
    isSceneChat: false,
    chatParameters: { topP: 0.8 },
    managedParameterDefinitions: [],
    modelAccessPolicy: { suppressModelParameters: false },
    initial: {
      ...DEFAULT_GENERATION_PARAMS,
      ...assembledStock.parameters,
      enabledParameters: undefined,
      effectiveMaxContext: undefined,
    },
  });
  assert.equal(runtime.temperature, 0.7, "live provider runtime uses connection controls over stock");
  assert.equal(runtime.topP, 0.8, "chat controls still win");
  assert.equal(runtime.reasoningEffort, null, "the connection can turn reasoning off");
  assert.equal(runtime.verbosity, null, "old stock verbosity is absent");
  assert.equal(runtime.assistantPrefill, "", "old stock prefills are absent");
  assert.deepEqual(runtime.customParameters, { connection_flag: true }, "old stock raw provider parameters are absent");
  assert.equal(runtime.maxTokens, DEFAULT_GENERATION_PARAMS.maxTokens, "Engine fallback output budget remains intact");

  await db
    .update(promptPresets)
    .set({ parameters: JSON.stringify(legacyParameters) })
    .where(eq(promptPresets.id, stock.id));
  const connectionParameters = {
    temperature: 0.7,
    reasoningEffort: null,
    verbosity: "low",
    customParameters: { connection_flag: true },
    enabledParameters: { temperature: true },
  };
  await db.insert(apiConnections).values({
    id: "stock-connection",
    name: "Stock parameter proof",
    provider: "custom",
    model: "fixture",
    baseUrl: "http://127.0.0.1:9/v1",
    defaultParameters: JSON.stringify(connectionParameters),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  for (const mode of ["roleplay", "conversation", "game"]) {
    await db.insert(chats).values({
      id: `stock-${mode}`,
      name: mode,
      mode,
      connectionId: "stock-connection",
      promptPresetId: stock.id,
      metadata: JSON.stringify({ chatParameters: { topP: 0.8 } }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  await registerParameterPreviewRoute(app);
  for (const mode of ["roleplay", "conversation", "game"]) {
    const response = await app.inject({
      method: "POST",
      url: "/parameters",
      payload: { connectionId: "stock-connection", chatId: `stock-${mode}` },
    });
    assert.equal(response.statusCode, 200, response.body);
    const { parameters } = response.json();
    assert.equal(parameters.temperature.value, 0.7);
    assert.equal(parameters.temperature.source, "connection");
    assert.equal(parameters.temperature.enabled, true);
    assert.equal(parameters.reasoningEffort.source, "connection");
    assert.equal(parameters.topP.source, "chat");
    assert.equal(parameters.topP.value, 0.8);
    assert.equal(parameters.verbosity.value, "low");
    assert.equal(parameters.assistantPrefill.value, "");
    assert.deepEqual(parameters.customParameters.value, { connection_flag: true });
    assert.equal(parameters.singleUserMessage.source, "defaults");
    assert.equal(parameters.singleUserMessage.value, null);
    assert.ok(Object.values(parameters).every((parameter) => (parameter as { source: string }).source !== "preset"));
  }
} finally {
  await app.close();
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.info("Stock preset parameter ownership regression passed.");
