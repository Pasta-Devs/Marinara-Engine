import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_GENERATION_PARAMS } from "../../packages/shared/src/constants/defaults.js";
import { withoutPresetTokenLimits } from "../../packages/shared/src/types/prompt.js";
import { parsePresetParameters } from "../../packages/server/src/services/prompt/assembler.js";
import { resolveGenerationParameters } from "../../packages/server/src/services/generation/provider-generation-runtime.js";
import { resolveModelAccessPolicy } from "../../packages/server/src/services/generation/model-access-policy.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { createPromptsStorage } from "../../packages/server/src/services/storage/prompts.storage.js";

const legacy = {
  maxContext: 128000,
  maxTokens: 512,
  useMaxContext: false,
  temperature: 0.6,
  enabledParameters: { maxTokens: false, reasoningEffort: false },
};
for (const raw of [JSON.stringify(legacy), "{}", "invalid", JSON.stringify({ ...legacy, temperature: "invalid" })]) {
  const parsed = parsePresetParameters(raw);
  for (const key of ["maxTokens", "maxContext", "useMaxContext"]) assert.equal(key in parsed, false, key);
  assert.equal(parsed.enabledParameters?.maxTokens, undefined);
}
assert.equal(parsePresetParameters(JSON.stringify(legacy)).temperature, 0.6);
assert.equal(withoutPresetTokenLimits(legacy).enabledParameters?.reasoningEffort, false);
assert.equal(legacy.enabledParameters.maxTokens, false, "sanitizing does not mutate saved input");

const policy = resolveModelAccessPolicy({ provider: "openai", model: "gpt-5.5", maxContext: 1000000 });
const initial = {
  ...DEFAULT_GENERATION_PARAMS,
  maxTokens: 4096,
  ...parsePresetParameters(JSON.stringify(legacy)),
  effectiveMaxContext: policy.effectiveMaxContext,
};
const resolve = (defaultParameters: unknown, chatParameters: unknown = {}) =>
  resolveGenerationParameters({
    connection: { provider: "openai", model: "gpt-5.5", defaultParameters },
    chatMode: "roleplay",
    isSceneChat: false,
    managedParameterDefinitions: [],
    modelAccessPolicy: policy,
    initial,
    chatParameters,
  });
assert.equal(resolve({}).maxTokens, 4096, "legacy preset output cap is ignored");
assert.equal(resolve({}).effectiveMaxContext, 1000000, "legacy preset context cap is ignored");
assert.equal(resolve({ maxTokens: 16000, maxContext: 500000 }).maxTokens, 16000);
assert.equal(resolve({ maxTokens: 16000, maxContext: 500000 }).effectiveMaxContext, 500000);
assert.equal(resolve({ maxTokens: 16000 }, { maxTokens: 32000, maxContext: 250000 }).maxTokens, 32000);
assert.equal(resolve({}, { maxContext: 250000 }).effectiveMaxContext, 250000);

const dir = mkdtempSync(join(tmpdir(), "marinara-preset-limits-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();
try {
  const storage = createPromptsStorage(db);
  const preset = (await storage.create({ name: "Legacy token limits", parameters: legacy }))!;
  const check = (raw: string) => {
    const params = JSON.parse(raw);
    assert.equal(params.maxContext, undefined);
    assert.equal(params.maxTokens, undefined);
    assert.equal(params.useMaxContext, undefined);
    assert.equal(params.enabledParameters?.maxTokens, undefined);
    assert.equal(params.enabledParameters?.reasoningEffort, false);
  };
  check(preset.parameters);
  const updated = (await storage.update(preset.id, { parameters: legacy }))!;
  check(updated.parameters);
  const copy = (await storage.duplicate(preset.id))!;
  check(copy.parameters);
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}
console.info("Preset token limits regression passed");
