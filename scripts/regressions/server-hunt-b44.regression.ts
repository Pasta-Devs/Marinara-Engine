import assert from "node:assert/strict";
import { parseTextualToolCalls } from "../../packages/server/src/services/llm/textual-tool-call-parser.js";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "search",
      description: "Search.",
      parameters: { type: "object", properties: { q: { type: "string" } } },
    },
  },
];

// A ```json fence inside <tool_call> tags is one call, not two.
const fencedInTag = '<tool_call>\n```json\n{"name":"search","arguments":{"q":"x"}}\n```\n</tool_call>';
const tagged = parseTextualToolCalls(fencedInTag, tools as never);
assert.equal(tagged.length, 1, "fence inside <tool_call> must be parsed once");
assert.equal(tagged[0]!.function.name, "search");
assert.deepEqual(JSON.parse(tagged[0]!.function.arguments), { q: "x" });

// Same for <tool_code>.
const fencedInCode = '<tool_code>\n```json\n{"name":"search","arguments":{"q":"y"}}\n```\n</tool_code>';
assert.equal(parseTextualToolCalls(fencedInCode, tools as never).length, 1);

// A bare fence still yields one call.
const bare = '```json\n{"name":"search","arguments":{"q":"z"}}\n```';
assert.equal(parseTextualToolCalls(bare, tools as never).length, 1);

// A tagged call plus a separate fence outside the tags still yields both.
const both =
  '<tool_call>{"name":"search","arguments":{"q":"a"}}</tool_call>\nthen\n```json\n{"name":"search","arguments":{"q":"b"}}\n```';
const bothCalls = parseTextualToolCalls(both, tools as never);
assert.deepEqual(
  bothCalls.map((call) => JSON.parse(call.function.arguments).q),
  ["a", "b"],
);

// Two intentional identical tagged calls are both kept.
const twice =
  '<tool_call>{"name":"search","arguments":{"q":"a"}}</tool_call><tool_call>{"name":"search","arguments":{"q":"a"}}</tool_call>';
assert.equal(parseTextualToolCalls(twice, tools as never).length, 2);

const qs = (text: string) =>
  parseTextualToolCalls(text, tools as never).map((call) => JSON.parse(call.function.arguments).q);
const callA = '{"name":"search","arguments":{"q":"A"}}';
const callB = '{"name":"search","arguments":{"q":"B"}}';
const fence = (call: string) => "```json\n" + call + "\n```";

// Review problem 1: a tag whose own content fails to parse must not hide a valid fence inside it.
assert.deepEqual(qs("<tool_call>I [will] search\n" + fence(callA) + "\n</tool_call>"), ["A"]);

// Review problem 2: an unclosed tag must not swallow later fenced calls.
assert.deepEqual(qs("<tool_call>\n" + fence(callA) + "\n" + fence(callB)), ["A", "B"]);
assert.deepEqual(qs("<|tool_call|>\n" + fence(callA) + "\n" + fence(callB)), ["A", "B"]);
// Patterns run in priority order, so the fence (B) is found before the python_tag call (A).
assert.deepEqual(qs("<|python_tag|>" + callA + "\n" + fence(callB)).sort(), ["A", "B"]);

// Review problem 3: a fence wrapping a tag, or a python_tag wrapping a fence, is one call.
assert.deepEqual(qs("```\n<tool_call>" + callA + "</tool_call>\n```"), ["A"]);
assert.deepEqual(qs("<|python_tag|>" + fence(callA) + "<|eom_id|>"), ["A"]);

// A closed tag with bad content (rejected by the command fallback, so recovery runs)
// that recovers JSON from a fence after it counts that call once.
assert.deepEqual(qs("<tool_call>oops!</tool_call>\n" + fence(callB)), ["B"]);

console.log("server-hunt-b44 regression passed");

