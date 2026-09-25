import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const transformersEntry = serverRequire.resolve("@huggingface/transformers");
const transformersRequire = createRequire(transformersEntry);
const transformers = JSON.parse(readFileSync(join(dirname(transformersEntry), "..", "package.json"), "utf8"));
for (const name of ["onnxruntime-node", "onnxruntime-web"]) {
  const backendEntry = transformersRequire.resolve(name);
  const backendManifest = join(dirname(backendEntry), "..", "package.json");
  const backend = JSON.parse(readFileSync(backendManifest, "utf8"));
  assert.equal(
    backend.version,
    transformers.dependencies[name],
    `${name} must match Transformers.js, without a stale override`,
  );
  assert.equal(serverRequire.resolve(name), backendEntry, "Engine and Transformers must use the same backend");
  const backendRequire = createRequire(backendManifest);
  const common = JSON.parse(
    readFileSync(join(dirname(backendRequire.resolve("onnxruntime-common")), "..", "..", "package.json"), "utf8"),
  );
  assert.equal(
    common.version,
    backend.dependencies["onnxruntime-common"],
    "each backend must keep its matching common runtime",
  );
}
console.log("Transformers backend and common-runtime compatibility contracts passed.");
