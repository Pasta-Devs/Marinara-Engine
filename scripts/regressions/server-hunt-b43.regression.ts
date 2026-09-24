import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL ??= "silent";
const originalDataDir = process.env.DATA_DIR;
const dataDir = await mkdtemp(join(tmpdir(), "marinara-b43-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env

const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
// 2. Responses streaming paths cancel the upstream body when the consumer exits early without an abort.
let closedResolvers: Array<() => void> = [];
const openStreams = new Set<ServerResponse>();
const server = createServer(async (request, response) => {
  for await (const _chunk of request) void _chunk;
  response.writeHead(200, { "content-type": "text/event-stream" });
  openStreams.add(response);
  let n = 0;
  const timer = setInterval(() => {
    const event = { type: "response.output_text.delta", delta: `t${n++} ` };
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }, 10);
  response.on("close", () => {
    clearInterval(timer);
    openStreams.delete(response);
    const resolvers = closedResolvers;
    closedResolvers = [];
    for (const resolve of resolvers) resolve();
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

function waitForUpstreamClose(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), ms);
    closedResolvers.push(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "openai",
  );
  const messages = [{ role: "user" as const, content: "hello" }];

  // chatResponses: the consumer stops iterating after the first token.
  {
    const closed = waitForUpstreamClose(3000);
    let got = "";
    for await (const chunk of provider.chat(messages, { model: "gpt-6-astra", stream: true })) {
      got += chunk;
      break;
    }
    assert.ok(got.length > 0);
    assert.equal(await closed, true, "chat() over Responses must cancel the upstream stream on early return");
  }

  // chatCompleteResponses: onToken throws mid-stream.
  {
    const closed = waitForUpstreamClose(3000);
    await assert.rejects(
      provider.chatComplete(messages, {
        model: "gpt-6-astra",
        stream: true,
        onToken: () => {
          throw new Error("consumer failed");
        },
      }),
      /consumer failed/,
    );
    assert.equal(await closed, true, "chatComplete() over Responses must cancel the upstream stream on error");
  }
} finally {
  for (const response of openStreams) response.destroy();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  await rm(dataDir, { recursive: true, force: true });
}

console.log("server-hunt-b43 regression passed");
