import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

// Shared server helpers keep the exact responses the old hand-written copies sent.
const { notFound } = await import("../../../packages/server/src/utils/not-found.js");

const app = Fastify();
app.get("/missing", async (_req, reply) => notFound(reply, "Folder not found"));
try {
  const response = await app.inject({ method: "GET", url: "/missing" });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "Folder not found" });
} finally {
  await app.close();
}
