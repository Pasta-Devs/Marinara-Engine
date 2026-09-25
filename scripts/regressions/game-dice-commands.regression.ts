// Real generate-route proof: the roll rewrite sees the original commands, and
// only the corrected output can change package state or dispatch map movement.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { AssistantSpatialDirective } from "../../packages/server/src/services/spatial-context/state-resolution.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-dice-commands-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const packagesRoot = join(dir, "capability-packages");
const versionRoot = join(packagesRoot, "versions", "pixelforge", "1.0.0");
mkdirSync(versionRoot, { recursive: true });
const table = JSON.stringify({
  schemaVersion: 1,
  verbs: [
    {
      name: "weather",
      description: "Set the weather.",
      effect: "state",
      metadataKey: "pixelforgeWeather",
      args: [{ name: "word", type: "string", enum: ["fair", "rain"] }],
    },
  ],
});
const files = [
  { path: "gm-verbs.json", content: table },
  { path: "client.js", content: "x" },
];
for (const file of files) writeFileSync(join(versionRoot, file.path), file.content);
writeFileSync(
  join(packagesRoot, "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: "pixelforge",
        version: "1.0.0",
        installedAt: "2026-09-13T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
        manifest: {
          schemaVersion: 2,
          capabilityApi: { major: 1, minor: 10 },
          builtAgainst: { engineVersion: "2.4.5", engineCommit: "0".repeat(40) },
          id: "pixelforge",
          name: "Dice fixture",
          version: "1.0.0",
          description: "Dice command regression.",
          engine: { min: "2.3.0", maxExclusive: "3.0.0" },
          kind: ["turn-game"],
          entrypoints: { client: "client.js" },
          contributions: { assets: { paths: ["gm-verbs.json"] } },
          files: files.map(({ path, content }) => ({
            path,
            sha256: createHash("sha256").update(content).digest("hex"),
            bytes: Buffer.byteLength(content),
          })),
          permissions: ["chat-write"],
          restartRequired: false,
        },
      },
    ],
  }),
);

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { registerCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { resolveGmVerbTable } =
  await import("../../packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const db = await getDB();
const chats = createChatsStorage(db);
// World Maps owns its persistence. Observe the real host dispatch at that
// capability boundary; package verb writes below use the actual file store.
const movements: Array<{ messageId: string; directive?: AssistantSpatialDirective | null }> = [];
const removeSpatial = registerCapabilityService("hierarchical-maps:state-resolution", {
  resolveEffectiveSpatialState: async () => ({
    definition: null,
    snapshot: null,
    currentLocationId: "chapel",
    definitionRevision: 0,
    visibleAnchor: null,
    virtual: true,
  }),
  materializeAssistantSpatialState: async (input: {
    messageId: string;
    directive?: AssistantSpatialDirective | null;
  }) => {
    movements.push(input);
    return null;
  },
});
const original = ClaudeSubscriptionProvider.prototype.chat;
let roll = false;
let rejectMovement = false;
let calls = 0;
const commands = '[spatial_move: destination_id="crypt"] [weather:{"word":"rain"}]';
ClaudeSubscriptionProvider.prototype.chat = async function* (
  messages: ChatMessage[],
  options: ChatOptions,
): AsyncGenerator<string, LLMUsage> {
  calls++;
  assert.equal(options.tools, undefined);
  const rewrite = messages.at(-1)?.content.includes("The engine has now rolled the requested dice:");
  if (rewrite) {
    assert.ok(
      messages.at(-2)!.content.includes(commands),
      "the corrected narration can see both original stripped commands",
    );
    assert.match(messages.at(-1)!.content, /Re-emit every original movement or package command still justified/);
    yield rejectMovement
      ? "The blocked doorway keeps you in the chapel; the sky stays fair."
      : `You enter the crypt under the rain. ${commands}`;
  } else {
    yield `You enter the crypt under the rain. ${commands}${roll ? ' [skill_check: skill="Search" dc="40"]' : ""}`;
  }
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
};
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  assert.ok(
    await resolveGmVerbTable({ gameExperienceId: "pixelforge" }),
    "fixture installs a real declared verb table",
  );
  const connection = await createConnectionsStorage(db).create({
    name: "Dice commands",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic",
    maxContext: 32768,
  });
  for (const scenario of ["no roll", "roll retains commands", "roll invalidates commands"] as const) {
    roll = scenario !== "no roll";
    rejectMovement = scenario === "roll invalidates commands";
    calls = 0;
    movements.length = 0;
    const chat = await chats.create({
      name: scenario,
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      gameExperienceId: "pixelforge",
      pixelforgeWeather: { word: "fair" },
      enableTools: false,
      enableAgents: true,
      activeAgentIds: ["hierarchical-maps"],
    });
    await chats.createMessage({
      chatId: chat.id,
      role: "user",
      content: "Walk into the crypt and search the sarcophagus.",
    });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.equal(calls, roll ? 2 : 1);
    const saved = (await chats.listMessages(chat.id)).at(-1)!;
    const metadata = JSON.parse((await chats.getById(chat.id))!.metadata);
    assert.deepEqual(metadata.pixelforgeWeather, { word: rejectMovement ? "fair" : "rain" });
    assert.equal(movements.length, 1, "the host materializes spatial state exactly once on the saved turn");
    assert.equal(movements[0]!.messageId, saved.id);
    assert.deepEqual(movements[0]!.directive, rejectMovement ? null : { type: "move", destinationId: "crypt" });
    assert.doesNotMatch(saved.content, /\[weather:|\[spatial_move:/);
  }
} finally {
  ClaudeSubscriptionProvider.prototype.chat = original;
  removeSpatial();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Game roll rewrites preserve justified commands and never revive commands invalidated by the outcome.");
