// Add window, job "embeddings": Done makes the new Model the embeddings default (it once assigned nothing).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADD_JOB_KIND } from "../../packages/client/src/lib/add-connection.js";

const modal = readFileSync(
  new URL("../../packages/client/src/components/modals/CreateConnectionModal.tsx", import.meta.url),
  "utf8",
);

assert.equal(ADD_JOB_KIND.embeddings, "chat");
assert.match(modal, /job === "embeddings"[\s\S]*?setEmbeddingDefault\.mutateAsync\(id\)/);
// Undo puts the previous default back.
assert.match(modal, /setEmbeddingDefault\.mutateAsync\(previous\)/);

console.log("add-connection-embeddings-job regression passed");
