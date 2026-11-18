import assert from "node:assert/strict";
import { readSseData, type SseData } from "../../../packages/server/src/services/llm/base-provider.js";
import { runNamedCases } from "../fixtures/named-cases.js";

/** A streamed Response whose body arrives as exactly these byte chunks. */
function chunkedResponse(chunks: Array<string | Uint8Array>, onCancel?: () => void): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
    },
    cancel() {
      onCancel?.();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

async function collect(response: Response, signal?: AbortSignal): Promise<SseData[]> {
  const out: SseData[] = [];
  for await (const item of readSseData(response, signal)) out.push(item);
  return out;
}

await runNamedCases([
  {
    name: "reader splits LF and CRLF lines and trims payloads",
    run: async () => {
      const items = await collect(chunkedResponse(['data: {"a":1}  \r\n\r\ndata:{"b":2}\n\n']));
      assert.deepEqual(items, [
        { event: "", data: '{"a":1}' },
        { event: "", data: '{"b":2}' },
      ]);
    },
  },
  {
    name: "reader joins chunks split mid-line and mid-UTF-8 character",
    run: async () => {
      const bytes = new TextEncoder().encode('data: {"text":"héllo 🍝"}\n\n');
      const cut = bytes.indexOf(0xf0) + 2; // inside the 4-byte emoji
      const items = await collect(chunkedResponse(["da", "ta: ", bytes.slice(6, cut), bytes.slice(cut)]));
      assert.deepEqual(items, [{ event: "", data: '{"text":"héllo 🍝"}' }]);
    },
  },
  {
    name: "reader gives the event name to the next data line only and skips comments",
    run: async () => {
      const items = await collect(
        chunkedResponse([
          ": keep-alive\n\n",
          "event: response.output_text.delta\ndata: one\n",
          "data: two\n",
          "event: response.completed\n\n",
          "data: three\n",
          "id: 7\nretry: 100\n",
        ]),
      );
      assert.deepEqual(items, [
        { event: "response.output_text.delta", data: "one" },
        { event: "", data: "two" },
        { event: "", data: "three" },
      ]);
    },
  },
  {
    name: "reader passes [DONE] through and reads a last line without newline",
    run: async () => {
      const items = await collect(chunkedResponse(["data: x\n\ndata: [DONE]\n\ndata: tail"]));
      assert.deepEqual(
        items.map((item) => item.data),
        ["x", "[DONE]", "tail"],
      );
    },
  },
  {
    name: "reader throws when the response has no body",
    run: async () => {
      await assert.rejects(collect(new Response(null)), /No response body/);
    },
  },
  {
    name: "reader cancels the body when the signal aborts or the caller stops early",
    run: async () => {
      let cancelled = 0;
      const already = new AbortController();
      already.abort();
      assert.deepEqual(
        await collect(
          chunkedResponse(["data: x\n"], () => cancelled++),
          already.signal,
        ),
        [],
      );
      assert.equal(cancelled, 1);

      const controller = new AbortController();
      const seen: string[] = [];
      for await (const item of readSseData(
        chunkedResponse(["data: a\n", "data: b\n", "data: c\n"], () => cancelled++),
        controller.signal,
      )) {
        seen.push(item.data);
        controller.abort();
      }
      assert.deepEqual(seen, ["a"]);
      assert.equal(cancelled, 2);

      for await (const item of readSseData(chunkedResponse(["data: a\n", "data: b\n"], () => cancelled++))) {
        if (item.data === "a") break;
      }
      assert.equal(cancelled, 3);
    },
  },
]);
