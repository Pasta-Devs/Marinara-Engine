import assert from "node:assert/strict";
import {
  DEFAULT_ADVANCED_MEMORY_SETTINGS,
  advancedMemorySettingsSchema,
  normalizeAdvancedMemorySettings,
} from "../../packages/shared/src/types/advanced-memory.js";

assert.equal(DEFAULT_ADVANCED_MEMORY_SETTINGS.retrieveMaxMessages, 5);
assert.equal(advancedMemorySettingsSchema.parse({}).retrieveMaxMessages, 5);
for (const settings of [undefined, null, {}, { enabled: true }]) {
  const normalized = normalizeAdvancedMemorySettings(settings);
  assert.equal(normalized.retrieveMaxMessages, 5, "new or omitted excerpt limits use five messages");
  assert.equal(normalized.retrieveMinMessages, 3, "the maximum default does not change the minimum");
}
for (const maximum of [0, 5, 10, 50]) {
  const saved = { enabled: true, retrieveMinMessages: 0, retrieveMaxMessages: maximum };
  const normalized = normalizeAdvancedMemorySettings(JSON.parse(JSON.stringify(saved)));
  assert.equal(normalized.retrieveMaxMessages, maximum, "explicit saved limits survive normalization");
  assert.equal(normalized.retrieveMinMessages, 0, "summary-only and optional-excerpt settings stay intact");
  assert.equal(normalized.enabled, true);
}
console.log("Advanced Memory defaults use five messages and preserve explicit saved excerpt limits.");
