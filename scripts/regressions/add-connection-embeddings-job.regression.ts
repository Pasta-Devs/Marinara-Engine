// Add window, job "embeddings": Done makes the new Model the embeddings default (it once assigned nothing).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jobAddKind } from "../../packages/client/src/lib/connection-jobs.js";

const modal = readFileSync(
  new URL("../../packages/client/src/components/modals/CreateConnectionModal.tsx", import.meta.url),
  "utf8",
);

assert.equal(jobAddKind("embeddings"), "chat");
assert.match(modal, /job === "embeddings"[\s\S]*?setEmbeddingDefault\.mutateAsync\(id\)/);
// Undo puts the previous default back.
assert.match(modal, /setEmbeddingDefault\.mutateAsync\(previous\)/);

console.log("add-connection-embeddings-job regression passed");
