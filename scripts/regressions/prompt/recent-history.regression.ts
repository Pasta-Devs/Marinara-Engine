import assert from "node:assert/strict";
import type { ChatMLMessage, MarkerConfig } from "../../../packages/shared/src/index.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { assemblePrompt, type AssemblerInput } from "../../../packages/server/src/services/prompt/index.js";
import {
  appendNonLeadingSystemMessagesToLastUser,
  dedupeLastMessageWrappers,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  dropPromptHistoryMessages,
  scopeIndividualGroupMessagesForTarget,
  type GenerationPromptMessage,
} from "../../../packages/server/src/services/generation/prompt-message-scope.js";
import { splitHistoryForResume } from "../../../packages/server/src/services/llm/providers/claude-subscription/jsonl-entries.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";

type SectionSpec =
  | { id: string; text: string; role?: "system" | "user" | "assistant"; depth?: number }
  | { id: string; marker: MarkerConfig; enabled?: boolean };

function chat(count: number): ChatMLMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `MSG_${index + 1}`,
  }));
}

function history(n = 4): SectionSpec[] {
  return [
    { id: "main", text: "WORLD_RULES" },
    { id: "chat", marker: { type: "chat_history" } },
    { id: "scene", text: "SCENE_NOW" },
    { id: "recent", marker: { type: "recent_history", recentHistoryOptions: { recentMessages: n } } },
  ];
}

async function assemble(
  specs: SectionSpec[],
  chatMessages: ChatMLMessage[],
  options: { wrapFormat?: "xml" | "markdown" | "none"; extra?: Partial<AssemblerInput> } = {},
) {
  const result = await assemblePrompt({
    db: undefined as unknown as DB,
    preset: {
      id: "preset-recent-history",
      name: "Recent History Fixture",
      sectionOrder: JSON.stringify(specs.map((spec) => spec.id)),
      groupOrder: JSON.stringify([]),
      wrapFormat: options.wrapFormat ?? "xml",
      parameters: JSON.stringify({}),
      variableGroups: JSON.stringify([]),
      variableValues: JSON.stringify({}),
    },
    sections: specs.map((spec) =>
      "marker" in spec
        ? promptSection({
            id: spec.id,
            identifier: spec.id,
            name: spec.marker.type === "recent_history" ? "Recent History" : "Chat History",
            isMarker: "true",
            markerConfig: JSON.stringify(spec.marker),
            enabled: spec.enabled === false ? "false" : "true",
          })
        : promptSection({
            id: spec.id,
            identifier: spec.id,
            name: spec.id === "scene" ? "Scene" : "Main Prompt",
            content: spec.text,
            role: spec.role ?? "system",
            ...(spec.depth !== undefined ? { injectionPosition: "depth", injectionDepth: spec.depth } : {}),
          }),
    ),
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "chat-recent-history",
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages,
    chatSummary: null,
    // Generation defers role merging to the provider boundary; the strict-role case below applies it.
    deferMessagePostProcessing: true,
    ...options.extra,
  });
  return result.messages;
}

const order = (messages: ChatMLMessage[]) =>
  messages.map((message) => message.content.match(/MSG_\d+|SCENE_NOW|WORLD_RULES|DEPTH_\w+/gu)?.join("+") ?? "?");

const cases: RegressionCase[] = [
  {
    name: "Recent History sends the newest N messages after the blocks placed between it and Chat History",
    async run() {
      const messages = await assemble(history(3), chat(8));
      assert.deepEqual(order(messages), [
        "WORLD_RULES",
        "MSG_1",
        "MSG_2",
        "MSG_3",
        "MSG_4",
        "MSG_5",
        "SCENE_NOW",
        "MSG_6",
        "MSG_7",
        "MSG_8",
      ]);
      assert.match(messages[1]!.content, /^<chat_history>\nMSG_1/u);
      assert.match(messages[5]!.content, /MSG_5\n<\/chat_history>$/u);
      assert.match(messages[7]!.content, /^<recent_history>\nMSG_6/u);
      assert.match(messages[8]!.content, /MSG_7\n<\/recent_history>$/u);
      assert.equal(messages[9]!.content, "<last_message>\nMSG_8\n</last_message>");
      assert.deepEqual(
        messages.map((message) => message.historyPart ?? null),
        [null, "past", "past", "past", "past", "past", null, "recent", "recent", "recent"],
      );
      assert.equal(
        messages[6]!.contextKind,
        "injection",
        "the block between the parts is placed like a depth injection",
      );
      assert.equal(messages[0]!.contextKind, "prompt");
    },
  },
  {
    name: "the older part is a stable prefix from one turn to the next",
    async run() {
      const before = await assemble(history(4), chat(10));
      const after = await assemble(history(4), chat(12));
      const text = (messages: ChatMLMessage[]) => messages.map((message) => message.content).join("\u0000");
      // Up to the old part's closing tag, the next turn's prompt starts with exactly the same text.
      const pastEnd = before.findIndex((message) => message.content.endsWith("</chat_history>"));
      const stable = text(before.slice(0, pastEnd + 1)).replace(/\n<\/chat_history>$/u, "");
      assert.ok(text(after).startsWith(stable));
    },
  },
  {
    name: "fewer messages than N all go to Recent History with no empty Chat History wrapper",
    async run() {
      const messages = await assemble(history(6), chat(3));
      assert.deepEqual(order(messages), ["WORLD_RULES", "SCENE_NOW", "MSG_1", "MSG_2", "MSG_3"]);
      assert.doesNotMatch(messages.map((message) => message.content).join("\n"), /chat_history/u);
      assert.ok(messages.slice(2).every((message) => message.historyPart === "recent"));

      const one = await assemble(history(4), chat(1));
      assert.equal(one.at(-1)!.content, "<last_message>\nMSG_1\n</last_message>");
      const none = await assemble(history(4), []);
      assert.deepEqual(order(none), ["WORLD_RULES", "SCENE_NOW"]);
    },
  },
  {
    name: "Chat History's max messages counts the whole history before Recent History takes its share",
    async run() {
      const specs = history(2).map((spec) =>
        spec.id === "chat"
          ? { id: "chat", marker: { type: "chat_history", chatHistoryOptions: { maxMessages: 5 } } }
          : spec,
      ) as SectionSpec[];
      assert.deepEqual(order(await assemble(specs, chat(9))), [
        "WORLD_RULES",
        "MSG_5",
        "MSG_6",
        "MSG_7",
        "SCENE_NOW",
        "MSG_8",
        "MSG_9",
      ]);
    },
  },
  {
    name: "a lone, misplaced or second Recent History falls back safely",
    async run() {
      const alone = await assemble(
        [
          { id: "main", text: "WORLD_RULES" },
          { id: "recent", marker: { type: "recent_history", recentHistoryOptions: { recentMessages: 2 } } },
        ],
        chat(4),
      );
      assert.deepEqual(order(alone), ["WORLD_RULES", "MSG_1", "MSG_2", "MSG_3", "MSG_4"]);
      assert.match(alone[1]!.content, /^<chat_history>/u, "without Chat History it sends the whole history");
      assert.ok(alone.every((message) => message.historyPart === undefined));

      const above = await assemble(
        [
          { id: "recent", marker: { type: "recent_history" } },
          { id: "scene", text: "SCENE_NOW" },
          { id: "chat", marker: { type: "chat_history" } },
        ],
        chat(4),
      );
      assert.deepEqual(order(above), ["SCENE_NOW", "MSG_1", "MSG_2", "MSG_3", "MSG_4"]);

      const twice = await assemble(
        [
          ...history(2),
          { id: "recent2", marker: { type: "recent_history", recentHistoryOptions: { recentMessages: 1 } } },
        ],
        chat(5),
      );
      assert.deepEqual(order(twice), ["WORLD_RULES", "MSG_1", "MSG_2", "MSG_3", "SCENE_NOW", "MSG_4", "MSG_5"]);

      const off = await assemble(
        history(2).map((spec) => (spec.id === "recent" ? { ...spec, enabled: false } : spec)) as SectionSpec[],
        chat(4),
      );
      assert.deepEqual(order(off), ["WORLD_RULES", "MSG_1", "MSG_2", "MSG_3", "MSG_4", "SCENE_NOW"]);
    },
  },
  {
    name: "depth entries count chat messages only, skipping the blocks between the parts",
    async run() {
      const specs: SectionSpec[] = [
        ...history(3),
        { id: "d0", text: "DEPTH_ZERO", depth: 0 },
        { id: "d2", text: "DEPTH_TWO", depth: 2 },
        { id: "d3", text: "DEPTH_THREE", depth: 3 },
        { id: "d5", text: "DEPTH_FIVE", depth: 5 },
        { id: "d99", text: "DEPTH_DEEP", depth: 99 },
      ];
      assert.deepEqual(order(await assemble(specs, chat(8))), [
        "WORLD_RULES",
        "DEPTH_DEEP",
        "MSG_1",
        "MSG_2",
        "MSG_3",
        "DEPTH_FIVE",
        "MSG_4",
        "MSG_5",
        "SCENE_NOW",
        "DEPTH_THREE",
        "MSG_6",
        "DEPTH_TWO",
        "MSG_7",
        "MSG_8",
        "DEPTH_ZERO",
      ]);
    },
  },
  {
    name: "markdown and no-wrapper presets label or leave each part",
    async run() {
      const markdown = await assemble(history(2), chat(5), { wrapFormat: "markdown" });
      const text = markdown.map((message) => message.content).join("\n");
      assert.match(text, /## Chat History\nMSG_1/u);
      assert.match(text, /## Recent History\nMSG_4/u);
      assert.match(text, /## Last Message\nMSG_5/u);
      const none = await assemble(history(2), chat(5), { wrapFormat: "none" });
      assert.deepEqual(
        none.slice(1).map((message) => message.content),
        ["MSG_1", "MSG_2", "MSG_3", "SCENE_NOW", "MSG_4", "MSG_5"],
      );
    },
  },
  {
    name: "strict role formatting gives a system block between the parts its own turn",
    async run() {
      const sent = appendNonLeadingSystemMessagesToLastUser(await assemble(history(2), chat(5)));
      assert.deepEqual(order(sent), ["WORLD_RULES", "MSG_1", "MSG_2", "MSG_3", "SCENE_NOW", "MSG_4", "MSG_5"]);
      assert.equal(sent[4]!.role, "user");
      assert.equal(sent[3]!.content.includes("SCENE_NOW"), false, "the past message itself is unchanged");
    },
  },
  {
    name: "group replies and history trimming keep a wrapper per part",
    async run() {
      const assembled = (await assemble(history(2), chat(6))) as GenerationPromptMessage[];
      const scoped = scopeIndividualGroupMessagesForTarget(assembled, null, [], () => {});
      const text = scoped.map((message) => message.content).join("\n");
      assert.equal(text.match(/<chat_history>/gu)?.length, 1);
      assert.match(
        text,
        /<chat_history>\nMSG_1[\s\S]*MSG_4\n<\/chat_history>\n<scene>\s*SCENE_NOW\s*<\/scene>\n<recent_history>\nMSG_5\n<\/recent_history>/u,
      );
      assert.match(text, /<last_message>\nMSG_6\n<\/last_message>$/u);

      const trimmed = (await assemble(history(2), chat(6))) as GenerationPromptMessage[];
      dropPromptHistoryMessages(trimmed, (message) => message.id === "m1" || message.id === "m2");
      assert.match(trimmed[1]!.content, /^<chat_history>\nMSG_3$/u);
      assert.match(trimmed[2]!.content, /^MSG_4\n<\/chat_history>$/u);
      assert.match(trimmed[4]!.content, /^<recent_history>\nMSG_5\n<\/recent_history>$/u);

      const allPastGone = (await assemble(history(2), chat(4))) as GenerationPromptMessage[];
      dropPromptHistoryMessages(allPastGone, (message) => message.id === "m1" || message.id === "m2");
      assert.doesNotMatch(allPastGone.map((message) => message.content).join("\n"), /chat_history/u);
    },
  },
  {
    name: "a moved last-message wrapper takes the Recent History closing tag with it",
    async run() {
      const messages = await assemble(history(3), chat(5));
      messages.push({ role: "user", content: "<last_message>\nNEW_TURN\n</last_message>" });
      dedupeLastMessageWrappers(messages);
      const text = messages.map((message) => message.content).join("\n");
      assert.match(text, /MSG_4\nMSG_5\n<\/recent_history>\n<last_message>\nNEW_TURN/u);
      assert.equal(text.match(/<last_message>/gu)?.length, 1);
    },
  },
  {
    name: "the Claude subscription session moves only the closing tag that ends its history",
    async run() {
      const messages = await assemble(history(3), chat(5));
      const { history: resumed, current } = splitHistoryForResume(
        messages.filter((message) => message.role !== "system"),
      );
      assert.ok(
        resumed.some((message) => message.content.endsWith("MSG_2\n</chat_history>")),
        "the older part keeps its tag",
      );
      assert.equal(resumed.at(-1)!.content, "MSG_4");
      assert.match(current.content as string, /^<\/recent_history>\n<last_message>\nMSG_5/u);
    },
  },
];

await runNamedCases(cases);
