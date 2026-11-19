import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNamedCases } from "../fixtures/named-cases.js";

const directory = await mkdtemp(join(tmpdir(), "marinara-google-sse-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";

const { GoogleProvider } = await import("../../../packages/server/src/services/llm/providers/google.provider.js");

const enc = new TextEncoder();
const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}`;
const part = (parts: unknown[], extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { parts }, ...extra }],
});

type Script = { status?: number; send: (res: ServerResponse) => void };
let script: Script = { send: () => {} };
const server = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.writeHead(script.status ?? 200, { "Content-Type": "text/event-stream" });
    script.send(response);
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const provider = new GoogleProvider(`http://127.0.0.1:${address.port}/google/v1beta`, "fixture", 8192, null, null);
const messages = [{ role: "user" as const, content: "hi" }];
const tools = [{ type: "function" as const, function: { name: "read", description: "", parameters: {} } }];

async function streamed(options: Record<string, unknown> = {}) {
  let out = "";
  const gen = provider.chat(messages, { model: "gemini-2.5-flash", stream: true, ...options });
  let usage: unknown;
  for (;;) {
    const r = await gen.next();
    if (r.done) {
      usage = r.value;
      break;
    }
    out += r.value;
  }
  return { out, usage };
}
const completed = (options: Record<string, unknown> = {}) =>
  provider.chatComplete(messages, { model: "gemini-2.5-flash", tools, onToken: () => {}, ...options });

await runNamedCases([
  {
    name: "chat() streams text across split writes and CRLF",
    run: async () => {
      script = {
        send: (res) => {
          const a = frame(part([{ text: "he" }]));
          res.write(a.slice(0, 20));
          res.write(`${a.slice(20)}\r\n\r\n${frame(part([{ text: "llo é" }], { finishReason: "STOP" }))}\n\n`);
          res.end(
            `: keep-alive\n\n${frame({ usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 } })}\n\n`,
          );
        },
      };
      const { out, usage } = await streamed();
      assert.equal(out, "hello é");
      assert.ok(usage);
    },
  },
  {
    name: "chat() splits a multi-byte character across writes",
    run: async () => {
      script = {
        send: (res) => {
          const bytes = enc.encode(`${frame(part([{ text: "a🙂b" }]))}\n\n`);
          const cut = bytes.indexOf(0xf0) + 2;
          res.write(Buffer.from(bytes.slice(0, cut)));
          res.end(Buffer.from(bytes.slice(cut)));
        },
      };
      assert.equal((await streamed()).out, "a🙂b");
    },
  },
  {
    name: "chat() surfaces an in-stream error object",
    run: async () => {
      script = {
        send: (res) =>
          res.end(`${frame({ error: { code: 429, message: "quota blown", status: "RESOURCE_EXHAUSTED" } })}\n\n`),
      };
      await assert.rejects(streamed(), /Gemini API streaming error: .*quota blown/);
    },
  },
  {
    name: "chat() reports a blocked prompt",
    run: async () => {
      script = { send: (res) => res.end(`${frame({ promptFeedback: { blockReason: "SAFETY" } })}\n\n`) };
      await assert.rejects(streamed(), /Gemini blocked the prompt \(.*SAFETY/);
    },
  },
  {
    name: "chat() surfaces an HTTP error status",
    run: async () => {
      script = { status: 400, send: (res) => res.end(JSON.stringify({ error: { message: "bad key" } })) };
      await assert.rejects(streamed(), /bad key|400/);
    },
  },
  {
    name: "chatComplete() collects text, thought and a function call with its signature",
    run: async () => {
      script = {
        send: (res) => {
          res.write(`${frame(part([{ text: "thinking", thought: true }]))}\n\n`);
          res.write(`${frame(part([{ text: "ok " }]))}\r\n\r\n`);
          res.end(
            `${frame(part([{ functionCall: { name: "read", args: { value: 1 } }, thoughtSignature: "sig1" }], { finishReason: "STOP" }))}\n\n` +
              `${frame({ usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4, totalTokenCount: 13 } })}\n\n`,
          );
        },
      };
      const thoughts: string[] = [];
      const tokens: string[] = [];
      const result = await completed({
        onThinking: (t: string) => thoughts.push(t),
        onToken: (t: string) => tokens.push(t),
      });
      assert.equal(result.content, "ok ");
      assert.equal(result.toolCalls.length, 1);
      assert.equal(result.toolCalls[0]!.function.name, "read");
      assert.deepEqual(thoughts, ["thinking"]);
      assert.deepEqual(tokens, ["ok "]);
      assert.ok(result.usage);
      assert.ok(result.providerMetadata);
    },
  },
  {
    name: "chatComplete() errors on blocked prompt and empty stream",
    run: async () => {
      script = { send: (res) => res.end(`${frame({ promptFeedback: { blockReason: "OTHER" } })}\n\n`) };
      await assert.rejects(completed(), /Gemini blocked the prompt/);
      script = { send: (res) => res.end(`: nothing\n\n`) };
      await assert.rejects(completed(), /Gemini stream returned no candidates/);
    },
  },
]).finally(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
