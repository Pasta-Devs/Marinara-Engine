/**
 * A world is written with the reasoning effort the game's setup chose (cheap-GM playtest 2026-10-26: the
 * wizard was set to Medium, and the world was still asked for at the connection's maximum, which stalled
 * the game).
 *
 *   - /game/world-kit, /game/world-brief and /game/world-canon send the setup's generation settings over
 *     the connection's; with none sent, the connection's own.
 *   - The wizard and the Journal's world maker send the game's settings with each request.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORLD_STARTER_KITS, parseWorldKit } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-effort-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const kit = parseWorldKit(WORLD_STARTER_KITS.find((one) => one.id === "modern_day"));
assert.ok(kit.ok);
const requests: Array<Record<string, unknown>> = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "stand-in",
      model: body.model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify({ ...kit.kit, label: "Harbor" }) },
        },
      ],
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  const connections = createConnectionsStorage(db);
  const connection = await connections.create({
    name: "Stand-in",
    provider: "openai",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "o4-mini",
    apiKey: "sk-stand-in",
  });
  await connections.updateDefaultParameters(connection!.id, { reasoningEffort: "maximum" });
  const write = async (generationParameters?: unknown) => {
    requests.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/game/world-kit",
      payload: {
        connectionId: connection!.id,
        genre: "Slice of life",
        setting: "A harbor town",
        tone: "Cozy",
        ...(generationParameters ? { generationParameters } : {}),
      },
    });
    assert.equal(response.statusCode, 200, response.body.slice(0, 300));
    assert.equal(requests.length, 1);
    return requests[0]!;
  };

  // ── The setup's Medium, not the connection's maximum ──
  const medium = await write({ reasoningEffort: "medium" });
  assert.equal(medium.reasoning_effort, "medium", JSON.stringify(medium).slice(0, 300));
  // ── With none sent, the connection's own ──
  const own = await write();
  assert.notEqual(own.reasoning_effort, "medium");
  assert.ok(own.reasoning_effort, "the connection's level is still sent");

  // ── Every world request carries the game's settings ──
  const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
  const routes = read("packages/server/src/routes/game.routes.ts");
  for (const route of ["world-kit", "world-brief", "world-canon"])
    assert.match(
      routes,
      new RegExp(`generationParameters: input\\.generationParameters,\\s*route: "${route}"`),
      `${route} sends the game's settings`,
    );
  assert.match(
    read("packages/client/src/components/game/GameSetupWizard.tsx"),
    /const worldWriteRequest = gmConnectionId[\s\S]{0,800}generationParameters/,
  );
  assert.match(
    read("packages/client/src/components/game/GameSetupWorldChooser.tsx"),
    /lorebookIds: draft!\.lorebookIds,[\s\S]{0,200}generationParameters/,
  );
  assert.match(
    read("packages/client/src/components/game/GameSurface.tsx"),
    /const makeWorldRequest = useMemo[\s\S]{0,900}generationParameters/,
  );
  console.log("world-writing-reasoning-effort: ok");
} finally {
  await app.close();
  await closeDB();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}
