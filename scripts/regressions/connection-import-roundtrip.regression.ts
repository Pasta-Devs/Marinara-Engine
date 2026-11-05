import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NON_CHAT_PROVIDERS } from "../../packages/shared/src/constants/providers.js";
import {
  createConnectionExportEnvelope,
  normalizeImportedConnectionEntry,
} from "../../packages/client/src/lib/connection-transfer.js";

const read = (name: string) => readFileSync(new URL(`../../packages/client/src/${name}`, import.meta.url), "utf8");
const modal = read("components/modals/ImportConnectionModal.tsx");
const transfer = read("lib/connection-transfer.ts");

assert.match(modal, /isZipFile\(file\)/);
assert.match(modal, /readTextFilesFromZip\(file\)/);
assert.match(modal, /accept="\.json,\.jsonl,\.zip/);
assert.doesNotMatch(modal, /has a model without an ID/, "A row without a model must not abort the account");
assert.doesNotMatch(modal, /has no model ID/, "A row without a model counts as failed and the import goes on");
assert.match(modal, /if \(!model\) \{\s*failed \+= 1;\s*continue;/);
assert.match(transfer, /const model = asString\(value\.model\)\.trim\(\);/);
assert.match(transfer, /if \(isChatProvider\(provider\) && !model\) return null;/);
for (const provider of NON_CHAT_PROVIDERS) {
  for (const model of [undefined, "", "   "]) {
    const source = { name: provider, provider, model, audioGenerationSource: "elevenlabs" };
    const exported = createConnectionExportEnvelope([source]);
    const imported = normalizeImportedConnectionEntry(exported.connections[0]);
    assert.ok(imported, `${provider} containers can have no model ID`);
    assert.equal(imported.connection.model, "");
  }
}
for (const model of [undefined, "", "   "]) {
  assert.equal(normalizeImportedConnectionEntry({ name: "Chat", provider: "custom", model }), null);
}
assert.equal(
  normalizeImportedConnectionEntry({ name: "Chat", provider: "custom", model: " chat-model " })?.connection.model,
  "chat-model",
);
console.log("connection-import-roundtrip regression passed");
