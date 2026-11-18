import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { runNamedCases } from "../fixtures/named-cases.js";
import { OpenAIProvider } from "../../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage } from "../../../packages/server/src/services/llm/base-provider.js";

const enc = new TextEncoder();
const frame = (obj: unknown, event?: string) => `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(obj)}\n\n`;
const cc = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  frame({ choices: [{ delta, finish_reason: null }], ...extra });

type Script = { status?: number; send: (res: ServerResponse, path: string) => void };
let script: Script = { send: () => {} };
const server = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.writeHead(script.status ?? 200, { "Content-Type": "text/event-stream" });
    script.send(response, request.url ?? "");
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const provider = new OpenAIProvider(
  `http://127.0.0.1:${address.port}/v1`,
  "fixture",
  undefined,
  undefined,
  undefined,
  "openai",
);
const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
const tools = [{ type: "function" as const, function: { name: "read", description: "", parameters: {} } }];

async function streamed(model: string, options: Record<string, unknown> = {}) {
  let out = "";
  const gen = provider.chat(messages, { model, stream: true, ...options });
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

const completed = (model: string, options: Record<string, unknown> = {}) =>
  provider.chatComplete(messages, { model, tools, stream: true, ...options });

await runNamedCases([
  {
    name: "chat streams text across split writes and CRLF",
    run: async () => {
      script = {
        send: (res) => {
          const a = cc({ content: "he" }).replace(/\n/g, "\r\n");
          res.write(a.slice(0, 15));
          res.write(`${a.slice(15)}: keep-alive\n\n${cc({ content: "llo é" })}`);
          res.write(cc({}, { usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }));
          res.end("data: [DONE]\n\n");
        },
      };
      const { out, usage } = await streamed("gpt-4o");
      assert.equal(out, "hello é");
      assert.ok(usage);
    },
  },
  {
    name: "chat splits a multi-byte character across writes",
    run: async () => {
      script = {
        send: (res) => {
          const bytes = enc.encode(cc({ content: "a🦊b" }));
          const cut = bytes.indexOf(0xf0) + 2;
          res.write(Buffer.from(bytes.slice(0, cut)));
          res.end(Buffer.from(bytes.slice(cut)));
        },
      };
      assert.equal((await streamed("gpt-4o")).out, "a🦊b");
    },
  },
  {
    name: "chat surfaces an in-stream error payload",
    run: async () => {
      script = { send: (res) => res.end(frame({ error: { message: "quota blown" } })) };
      await assert.rejects(streamed("gpt-4o"), /missing choices: .*quota blown/);
    },
  },
  {
    name: "chat surfaces an HTTP error status",
    run: async () => {
      script = { status: 400, send: (res) => res.end(JSON.stringify({ error: { message: "bad key" } })) };
      await assert.rejects(streamed("gpt-4o"), /bad key/);
    },
  },
  {
    name: "chatComplete collects text and tool-call deltas",
    run: async () => {
      script = {
        send: (res) => {
          res.write(cc({ content: "ok " }));
          res.write(
            cc({
              tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "read", arguments: '{"a"' } }],
            }),
          );
          const last = cc({ tool_calls: [{ index: 0, function: { arguments: ":1}" } }] });
          res.write(last.slice(0, 20));
          res.end(`${last.slice(20)}data: [DONE]\n\n`);
        },
      };
      const tokens: string[] = [];
      const result = await completed("gpt-4o", { onToken: (t: string) => tokens.push(t) });
      assert.equal(result.content, "ok ");
      assert.deepEqual(tokens, ["ok "]);
      assert.equal(result.toolCalls.length, 1);
      assert.equal(result.toolCalls[0]!.function.name, "read");
      assert.equal(result.toolCalls[0]!.function.arguments, '{"a":1}');
    },
  },
  {
    name: "chatComplete surfaces an in-stream error",
    run: async () => {
      script = { send: (res) => res.end(frame({ error: { message: "nope" } })) };
      await assert.rejects(completed("gpt-4o", { onToken: () => {} }));
    },
  },
  {
    name: "Responses chat() follows event names even without a type field",
    run: async () => {
      script = {
        send: (res) => {
          res.write(`: keep-alive\n\n`);
          res.write(frame({ delta: "he" }, "response.output_text.delta").replace(/\n/g, "\r\n"));
          res.write(frame({ delta: "llo" }, "response.output_text.delta"));
          res.end(frame({ response: { usage: { input_tokens: 1, output_tokens: 2 } } }, "response.completed"));
        },
      };
      const { out } = await streamed("gpt-6-astra", { reasoningEffort: "medium" });
      assert.equal(out, "hello");
    },
  },
  {
    name: "Responses chat() surfaces a failed response",
    run: async () => {
      script = { send: (res) => res.end(frame({ response: { error: { message: "boom" } } }, "response.failed")) };
      await assert.rejects(streamed("gpt-6-astra", { reasoningEffort: "medium" }), /boom/);
    },
  },
  {
    name: "Responses chatComplete streams text and a function call",
    run: async () => {
      script = {
        send: (res) => {
          res.write(frame({ delta: "ok" }, "response.output_text.delta"));
          res.write(
            frame(
              { item: { type: "function_call", id: "fc_1", call_id: "call_1", name: "read", arguments: '{"v":1}' } },
              "response.output_item.done",
            ),
          );
          res.end(frame({ response: { usage: { input_tokens: 1, output_tokens: 2 } } }, "response.completed"));
        },
      };
      const result = await completed("gpt-6-astra", { reasoningEffort: "medium", onToken: () => {} });
      assert.equal(result.content, "ok");
      assert.equal(result.toolCalls[0]!.function.name, "read");
    },
  },
]).finally(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
