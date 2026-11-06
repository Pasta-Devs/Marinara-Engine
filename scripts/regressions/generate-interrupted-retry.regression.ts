import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-interrupted-retry-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createGenerationEventSink, generationOutputSettled, sendSseEvent } =
  await import("../../packages/server/src/routes/generate/sse.js");
type ActiveAgentRun = import("../../packages/server/src/routes/generate/retry-agents-route.js").ActiveAgentRun;

// An interrupted turn must stay retryable: a turn sent right after a Stop or an interrupt waits for the stopped run to
// unwind instead of being refused, a run stopped from elsewhere tells its still-open stream it ended, and the client
// stops showing "Generating" when the server has gone quiet, and resends a turn the server never saved.

const sink = createGenerationEventSink({ onEvent: () => {}, onFinish: () => {} });
sendSseEvent(sink, { type: "token", data: "partial" });
assert.equal(generationOutputSettled(sink), false, "a token does not end the generation");
sendSseEvent(sink, { type: "error", data: "stopped" });
assert.equal(generationOutputSettled(sink), true, "an error event does");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await generateRoutes(app);
const activeGenerations = (app as unknown as { activeGenerations: Map<string, ActiveAgentRun> }).activeGenerations;
const run = (abortController: AbortController): ActiveAgentRun => ({
  abortController,
  agentAbortController: new AbortController(),
  backendUrl: null,
  messageId: null,
  swipeIndex: null,
});

try {
  const chat = await createChatsStorage(db).create({ name: "Interrupted turn", mode: "game", characterIds: [] });

  // A run still working refuses a second one at once.
  activeGenerations.set(chat.id, run(new AbortController()));
  const busy = await app.inject({ method: "POST", url: "/", payload: { chatId: chat.id, userMessage: "I cast." } });
  assert.equal(busy.statusCode, 409, busy.body);

  // A stopped run that is still unwinding is waited for, so the turn sent after the interrupt is not lost.
  const stopped = new AbortController();
  stopped.abort();
  const stoppedRun = run(stopped);
  activeGenerations.set(chat.id, stoppedRun);
  setTimeout(() => {
    if (activeGenerations.get(chat.id) === stoppedRun) activeGenerations.delete(chat.id);
  }, 300);
  const started = Date.now();
  const after = await app.inject({ method: "POST", url: "/", payload: { chatId: chat.id, userMessage: "I cast." } });
  assert.notEqual(after.statusCode, 409, `the turn after a stop must not be refused: ${after.body}`);
  assert.ok(Date.now() - started >= 250, "the request waited for the stopped run");
} finally {
  activeGenerations.clear();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const route = read("packages/server/src/routes/generate.routes.ts");
assert.match(
  route,
  /generationSignal\.aborted && !clientDisconnected && !generationOutputSettled\(reply\)\)[\s\S]{0,400}type: "error"/u,
  "a run stopped while its stream is open reports it",
);

const useGenerate = read("packages/client/src/hooks/use-generate.ts");
assert.match(useGenerate, /streamController\.signal,\s*\/\/ Backgrounded tabs/u, "the stream has its own controller");
assert.match(useGenerate, /\/generate\/status\/[\s\S]{0,400}streamStalled = true;\s*streamController\.abort\(\);/u);
assert.match(useGenerate, /if \(isAbortError\(error\) && !streamStalled\)/u, "a stalled stream is not a silent stop");
assert.match(useGenerate, /clearInterval\(stallWatchdog\)/u);
assert.match(useGenerate, /translate\("generation\.stoppedWithoutReply"\)/u);

const surface = read("packages/client/src/components/game/GameSurface.tsx");
assert.match(surface, /setUnsentTurnChatId\(succeeded === false \? activeChatId : null\)/u);
assert.match(
  surface,
  /unsentTurnChatId && unsentTurnChatId === activeChatId\) \{\s*setGameInputSendToken/u,
  "Retry resends a turn the server never saved",
);
assert.equal(surface.match(/sendToken=\{gameInputSendToken\}/gu)?.length, 2, "both inputs take the resend");
// When the input no longer holds a turn it can send, Retry falls back to asking the Game Master to go on.
assert.equal(
  surface.match(/onSendTokenUnsent=\{retryWithoutUnsentTurn\}/gu)?.length,
  2,
  "both inputs fall back when nothing is sent",
);
assert.match(
  surface,
  /const retryWithoutUnsentTurn = useCallback\(\(\) => \{\s*setUnsentTurnChatId\(null\);\s*setGenerationFailed\(false\);\s*generate\(/u,
);
// Any generation that starts clears the unsent turn, so a later failure from another path regenerates.
assert.match(surface, /if \(!isStreaming\) return;\s*setGenerationFailed\(false\);\s*setUnsentTurnChatId\(null\);/u);
const input = read("packages/client/src/components/game/GameInput.tsx");
assert.match(input, /if \(!hasTurnContent \|\| disabled \|\| rollingQueuedDice\) return false;/u);
assert.match(
  input,
  /lastSendTokenRef\.current = sendToken;\s*if \(tokenSendInFlightRef\.current\) return;\s*tokenSendInFlightRef\.current = true;\s*void handleSendRef\s*\.current\(\)\s*\.then\(\(sent\) => \{\s*if \(sent === false\) onSendTokenUnsentRef\.current\?\.\(\);\s*\}\)\s*\.finally\(\(\) => \{\s*tokenSendInFlightRef\.current = false;/u,
  "a second Retry while a resend is under way neither resends nor falls back",
);

console.log("generate-interrupted-retry regression passed");
