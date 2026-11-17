import assert from "node:assert/strict";

import {
  markReplayedNarration,
  type WorkspaceTimelineItem,
} from "../../../packages/client/src/components/chat/mari/mari-tool-presentation.js";
import { groupRunPhases } from "../../../packages/client/src/lib/mari-work-timeline.js";

// #9394: a reloaded run lost the live narration mark, so each round's words showed under the next step.
const tool = (id: string, title: string): WorkspaceTimelineItem => ({
  id,
  type: "tool",
  tool: { id, name: title, status: "done", detail: null, startedAt: 0, updatedAt: 0 } as never,
});
const text = (id: string, content: string): WorkspaceTimelineItem => ({ id, type: "text", content });
const thought = (id: string): WorkspaceTimelineItem => ({ id, type: "thinking", content: "hm" });

// The saved order: each round's words come right after that round's steps.
const saved: WorkspaceTimelineItem[] = [
  thought("h1"),
  tool("skill", "Reading skill"),
  text("w1", "Let me grab the image handbook first."),
  thought("h2"),
  tool("connections", "Checking image connections"),
  text("w2", "Let me see what image models are on tap first."),
  thought("h3"),
  tool("generate", "Generating review image"),
  text("w3", "Two models available. Generating now."),
  { id: "s", type: "status", content: "Looking" },
  tool("look", "Looking at image"),
  text("w4", "Generated. Now let me look at it."),
  thought("h4"),
  text("answer", "Here she is: a librarian by the window."),
];

const marked = markReplayedNarration(saved);
assert.deepEqual(
  marked.filter((item) => item.type === "text").map((item) => [item.id, item.type === "text" && !!item.narration]),
  [
    ["w1", true],
    ["w2", true],
    ["w3", true],
    ["w4", true],
    ["answer", false],
  ],
  "words right after a step are that round's narration (a status line in between does not count); her last words stay the answer",
);

const describe = (name: string) => ({ title: name, failed: false });
const { phases, tail } = groupRunPhases(marked, {
  active: false,
  describe: (call: { name: string }) => describe(call.name),
});
const captionOf = (stepId: string) =>
  phases.find((phase) => phase.items.some((item) => item.type === "tool" && item.id === stepId))?.caption ?? null;
assert.equal(
  captionOf("generate"),
  "Two models available. Generating now.",
  "the image step is captioned with the words of its own round, as it was live, not the round before",
);
assert.equal(
  phases.some((phase) => phase.items.some((item) => item.type === "text" && item.id === "w2")),
  false,
  "no round's words are left as a loose line under the next step",
);
assert.deepEqual(
  tail.filter((item) => item.type === "text").map((item) => item.id),
  ["answer"],
  "her answer still stands on its own",
);

assert.deepEqual(
  markReplayedNarration([text("only", "Hi there.")]),
  [text("only", "Hi there.")],
  "a reply without steps is untouched",
);

console.log("replayed narration regression passed");
