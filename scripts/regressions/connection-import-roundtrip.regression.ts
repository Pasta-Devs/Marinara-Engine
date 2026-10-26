import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(`../../packages/client/src/${name}`, import.meta.url), "utf8");
const modal = read("components/modals/ImportConnectionModal.tsx");
const transfer = read("lib/connection-transfer.ts");

assert.match(modal, /isZipFile\(file\)/);
assert.match(modal, /readTextFilesFromZip\(file\)/);
assert.match(modal, /accept="\.json,\.jsonl,\.zip/);
assert.match(modal, /has a model without an ID/);
assert.match(modal, /has no model ID/);
assert.match(transfer, /const model = asString\(value\.model\)\.trim\(\);/);
assert.match(transfer, /if \(!model\) return null;/);
console.log("connection-import-roundtrip regression passed");
