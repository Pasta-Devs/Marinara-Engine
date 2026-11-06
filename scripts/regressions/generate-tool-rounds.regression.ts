import assert from "node:assert/strict";
import { GenerationStreamOutput } from "../../packages/server/src/routes/generate/generation-stream-output.js";
import { createGenerationEventSink } from "../../packages/server/src/routes/generate/sse.js";
import { runToolRounds, type ToolRoundsContext } from "../../packages/server/src/routes/generate/tool-rounds.js";
import { stripTrailingToolAnnouncement } from "../../packages/server/src/services/game/gm-planning.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

// Pins the tool-call rounds moved out of generate.routes.ts (#7573).

type Step = (
  messages: ChatMessage[],
  options: ChatOptions,
) => Promise<Awaited<ReturnType<ToolRoundsContext["provider"]["chatComplete"]>>>;

function setup(steps: Step[], overrides: Partial<ToolRoundsContext> = {}) {
  const events: Array<Record<string, unknown>> = [];
  const calls: Array<{ messages: ChatMessage[]; options: ChatOptions }> = [];
  const executed: string[][] = [];
  const controller = new AbortController();
  const sink = createGenerationEventSink({ onEvent: (payload) => events.push(payload), onFinish: () => {} });
  const ctx: ToolRoundsContext = {
    provider: {
      async chatComplete(messages, options) {
        calls.push({ messages: [...messages], options });
        const step = steps.shift();
        assert.ok(step, "no more provider requests were expected");
        return step(messages, options);
      },
    },
    requestOptions: () => ({ model: "fixture" }),
    streaming: true,
    signal: controller.signal,
    timeoutMs: 10_000,
    stream: new GenerationStreamOutput(sink, false, null, null),
    output: sink,
    chatMode: "conversation",
    impersonate: false,
    roleplayRollEnabled: false,
    gameToolPlan: null,
    maxToolRounds: 3,
    initialMessages: [{ role: "user", content: "Go." }],
    assistantPrefillInjected: false,
    tools: [
      { type: "function", function: { name: "lookup", description: "", parameters: {} } },
    ] as ChatOptions["tools"],
    toolChoice: () => "auto" as ChatOptions["toolChoice"],
    debugMode: true,
    allowedToolNames: new Set(["lookup", "roll_dice"]),
    usageProvider: () => "openai",
    fit: async (messages) => messages,
    rememberPromptPreview: () => {},
    logPrompt: () => {},
    recordLongTermMemoryPrompt: async () => {},
    recordUsage: () => {},
    executeTools: async (toolCalls) => {
      executed.push(toolCalls.map((call) => `${call.function.name}(${call.function.arguments})`));
      return toolCalls.map((call) => ({
        toolCallId: call.id,
        name: call.function.name,
        result:
          call.function.name === "roll_dice"
            ? JSON.stringify({ notation: "1d20+3", rolls: [12], modifier: 3, total: 15 })
            : '{"found":true}',
        success: true,
      }));
    },
    roleplayActivity: [],
    roleplayInlinePrefixes: new Map(),
    toolDiceRollResults: [],
    pendingGameStateToolCalls: [],
    getCharacter: async () => null,
    sendAgentResult: () => {},
    ...overrides,
  };
  return { ctx, events, calls, executed, controller };
}

const lookupCall = { id: "c1", type: "function" as const, function: { name: "lookup", arguments: "{}" } };

// (a) A tool call streamed as text is taken back out with content_replace; the prose is written again.
{
  const { ctx, events, calls, executed } = setup([
    async (_messages, options) => {
      await options.onToken!("Hi ");
      await options.onToken!('<tool_call>{"name":"lookup"}</tool_call>');
      return { content: "Hi ", toolCalls: [lookupCall], finishReason: "tool_calls" };
    },
    async (_messages, options) => {
      await options.onToken!("Done.");
      return { content: "Done.", toolCalls: [], finishReason: "stop" };
    },
  ]);
  const outcome = await runToolRounds(ctx, "Pre. ");
  assert.equal(outcome.aborted, false);
  assert.equal(outcome.fullResponse, "Pre. Hi Done.");
  assert.deepEqual(
    events.filter((event) => event.type === "content_replace"),
    [{ type: "content_replace", data: "Pre. " }],
  );
  assert.deepEqual(executed, [["lookup({})"]]);
  assert.equal(events.filter((event) => event.type === "tool_result").length, 1);
  assert.equal(calls[1]!.options.toolChoice, "auto");
  assert.equal(calls[1]!.options.debugMode, true);
  assert.equal(calls[1]!.messages.at(-1)?.role, "tool");
  if (!outcome.aborted) assert.equal(outcome.finishReason, "stop");
}

// (b) An abort mid-request ends the rounds; the text streamed so far is kept.
{
  const { ctx, controller } = setup([
    async (_messages, options) => {
      await options.onToken!("Partial");
      controller.abort();
      await options.onToken!(" never");
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
  ]);
  const outcome = await runToolRounds(ctx, "Start ");
  assert.deepEqual(outcome, { aborted: true, fullResponse: "Start Partial" });
}

// (c) A roleplay [roll:] cuts the stream: the round's signal aborts and a roll_dice call is made from the text.
{
  let roundSignal: AbortSignal | undefined;
  const { ctx, events, calls, executed } = setup(
    [
      async (_messages, options) => {
        roundSignal = options.signal;
        await options.onToken!("I try the lock. ");
        await options.onToken!('[roll: notation="1d20+3", reason="Need 15"]');
        assert.equal(options.signal?.aborted, true, "the roll stops the request");
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
      async (_messages, options) => {
        await options.onToken!(" It opens.");
        return { content: " It opens.", toolCalls: [], finishReason: "stop" };
      },
    ],
    { chatMode: "roleplay", roleplayRollEnabled: true },
  );
  const outcome = await runToolRounds(ctx, "");
  assert.equal(outcome.aborted, false);
  assert.ok(roundSignal && roundSignal !== ctx.signal);
  assert.equal(ctx.signal.aborted, false, "the generation itself goes on");
  assert.equal(executed.length, 1);
  assert.match(executed[0]![0]!, /^roll_dice\(.*"notation":"1d20\+3".*"reason":"Need 15"/);
  assert.equal(ctx.roleplayActivity[0]?.raw, '[roll: notation="1d20+3", reason="Need 15"]');
  assert.equal(ctx.toolDiceRollResults[0]?.total, 15);
  const toolResult = events.find((event) => event.type === "tool_result") as { data: Record<string, unknown> };
  assert.equal(toolResult.data.mode, "roleplay");
  assert.ok(toolResult.data.diceRollResult);
  assert.match(String(calls[1]!.messages.at(-1)?.content), /^The engine resolved your roll request:/);
  assert.equal(outcome.fullResponse, 'I try the lock. [roll: notation="1d20+3", reason="Need 15"] It opens.');
}

// (d) The final follow-up sends no tools, tool choice or debug mode, and cuts a roll it may not make.
{
  const { ctx, events, calls } = setup(
    [
      async () => ({ content: null, toolCalls: [lookupCall], finishReason: "tool_calls" }),
      async () => ({
        content: 'The end. [roll: notation="1d6", reason="more"]',
        toolCalls: [],
        finishReason: "stop",
      }),
    ],
    { chatMode: "roleplay", roleplayRollEnabled: true, maxToolRounds: 1, streaming: false },
  );
  const outcome = await runToolRounds(ctx, "");
  assert.equal(calls.length, 2);
  const finalOptions = calls[1]!.options;
  for (const key of ["tools", "toolChoice", "debugMode"])
    assert.ok(!(key in finalOptions), `final round sends no ${key}`);
  assert.equal(finalOptions.signal, ctx.signal, "the final round uses the generation signal alone");
  assert.equal(finalOptions.onToken, undefined);
  assert.deepEqual(
    events.filter((event) => event.type === "roleplay_command_error"),
    [{ type: "roleplay_command_error", data: { rollLimit: true } }],
  );
  assert.equal(outcome.fullResponse, "The end. ");
}

// (e) A Game tool plan runs once without a provider request or usage; its results go before the prefill.
{
  let usageRecords = 0;
  const { ctx, calls, executed } = setup([], {
    chatMode: "game",
    maxToolRounds: 1,
    gameToolPlan: { toolCalls: [lookupCall] } as ToolRoundsContext["gameToolPlan"],
    assistantPrefillInjected: true,
    initialMessages: [
      { role: "user", content: "Go." },
      { role: "assistant", content: "Prefill" },
    ],
    recordUsage: () => {
      usageRecords += 1;
    },
  });
  const outcome = await runToolRounds(ctx, "");
  assert.equal(calls.length, 0, "the plan is executed, not requested again");
  assert.equal(usageRecords, 0, "the planning pass owns its usage");
  assert.deepEqual(executed, [["lookup({})"]]);
  assert.equal(outcome.aborted, false);
  if (!outcome.aborted) {
    assert.equal(outcome.narratorMessages.at(-1)?.content, "Prefill");
    assert.match(String(outcome.narratorMessages.at(-2)?.content), /^The engine ran a separate tool-planning pass/);
  }
}

// (f) The round after a native call starts a new paragraph, and a Game Master's announcement of the call is cut.
const rollCall = {
  id: "r1",
  type: "function" as const,
  function: { name: "roll_dice", arguments: '{"notation":"2d8+3","reason":"Brannoc: Cure Wounds"}' },
};
for (const chatMode of ["game", "conversation"]) {
  const { ctx, events } = setup(
    [
      async (_messages, options) => {
        await options.onToken!("Brannoc kneels in the lamplight");
        await options.onToken!(" — let me get the number.");
        return {
          content: "Brannoc kneels in the lamplight — let me get the number.",
          toolCalls: [rollCall],
          finishReason: "tool_calls",
        };
      },
      async (_messages, options) => {
        await options.onToken!("Warmth goes out of his hands.");
        return { content: "Warmth goes out of his hands.", toolCalls: [], finishReason: "stop" };
      },
    ],
    { chatMode },
  );
  const outcome = await runToolRounds(ctx, "");
  const tokens = events
    .filter((event) => event.type === "token" || event.type === "content_replace")
    .map((event) => (event.type === "content_replace" ? `|${String(event.data)}|` : String(event.data)))
    .join("");
  if (chatMode === "game") {
    assert.equal(outcome.fullResponse, "Brannoc kneels in the lamplight\n\nWarmth goes out of his hands.");
    assert.match(tokens, /\|Brannoc kneels in the lamplight\|\n\nWarmth goes out of his hands\.$/);
  } else {
    assert.equal(
      outcome.fullResponse,
      "Brannoc kneels in the lamplight — let me get the number.\n\nWarmth goes out of his hands.",
    );
    assert.equal(events.filter((event) => event.type === "content_replace").length, 0);
  }
}
{
  // The player's own impersonated line keeps every word.
  const { ctx } = setup(
    [
      async () => ({ content: "I kneel. Let me roll for it.", toolCalls: [rollCall], finishReason: "tool_calls" }),
      async () => ({ content: " It works.", toolCalls: [], finishReason: "stop" }),
    ],
    { chatMode: "game", impersonate: true, streaming: false },
  );
  assert.equal((await runToolRounds(ctx, "")).fullResponse, "I kneel. Let me roll for it. It works.");
}
for (const lead of ["He reads the result.", " He reads the result."]) {
  // A round whose streamed words are taken back and written again still starts its own paragraph,
  // and words that already start with a space get no second break.
  const { ctx } = setup(
    [
      async (_messages, options) => {
        await options.onToken!("Brannoc kneels.");
        return { content: "Brannoc kneels.", toolCalls: [rollCall], finishReason: "tool_calls" };
      },
      async (_messages, options) => {
        await options.onToken!(`${lead} [lookup]`);
        return { content: lead, toolCalls: [{ ...rollCall, id: "r2" }], finishReason: "tool_calls" };
      },
      async (_messages, options) => {
        await options.onToken!("It holds.");
        return { content: "It holds.", toolCalls: [], finishReason: "stop" };
      },
    ],
    { chatMode: "game" },
  );
  const separated = lead.startsWith(" ")
    ? "Brannoc kneels. He reads the result."
    : "Brannoc kneels.\n\nHe reads the result.";
  assert.equal((await runToolRounds(ctx, "")).fullResponse, `${separated}\n\nIt holds.`);
}
for (const [prose, saved] of [
  // A round's own look-alike stays whole; a whole announcement goes, with one break before the next round.
  [
    "He kneels. Time to check the cellar before the light goes.",
    "He kneels. Time to check the cellar before the light goes.\n\nIt holds.",
  ],
  ["Brannoc kneels in the lamplight — time to find out.", "Brannoc kneels in the lamplight\n\nIt holds."],
  ["Brannoc kneels — let me roll initiative.", "Brannoc kneels\n\nIt holds."],
  ["Brannoc kneels — let me roll to see how that goes.", "Brannoc kneels\n\nIt holds."],
  ["Brannoc kneels — let me check and see how that goes.", "Brannoc kneels\n\nIt holds."],
  ["Brannoc kneels — let me roll the die, and see what it does.", "Brannoc kneels\n\nIt holds."],
]) {
  const { ctx, events } = setup(
    [
      async (_messages, options) => {
        await options.onToken!(prose!);
        return { content: prose!, toolCalls: [rollCall], finishReason: "tool_calls" };
      },
      async (_messages, options) => {
        await options.onToken!("It holds.");
        return { content: "It holds.", toolCalls: [], finishReason: "stop" };
      },
    ],
    { chatMode: "game" },
  );
  assert.equal((await runToolRounds(ctx, "")).fullResponse, saved);
  assert.equal(
    events.filter((event) => event.type === "content_replace").length,
    saved!.startsWith(prose!) ? 0 : 1,
    prose,
  );
}
for (const [before, after] of [
  ["Brannoc kneels — let me get the number.", "Brannoc kneels"],
  ["Brannoc kneels. Let me roll for the healing.", "Brannoc kneels."],
  ["Brannoc kneels. Okay, now I'll check the save:", "Brannoc kneels."],
  ["Let me roll for Cure Wounds.", ""],
  ["Brannoc kneels. Let me roll it.", "Brannoc kneels."],
  ["Brannoc kneels. Time to roll 2d8+3 for the healing.", "Brannoc kneels."],
  ["The door groans — let me roll the die.", "The door groans"],
  ["Brannoc kneels -- time to see how much it heals.", "Brannoc kneels"],
  ["Brannoc kneels in the lamplight — time to find out.", "Brannoc kneels in the lamplight"],
  ["The blade falls — let me see what the dice say.", "The blade falls"],
  ["Brannoc swings. Let me roll.", "Brannoc swings."],
  ["Brannoc kneels — let me roll initiative.", "Brannoc kneels"],
  ["Time to roll a saving throw.", ""],
  ["Brannoc braces. Let me roll the check.", "Brannoc braces."],
  ["The blade bites. Time to roll damage.", "The blade bites."],
  ["Brannoc kneels — let me check.", "Brannoc kneels"],
  ["Brannoc kneels — let me look up.", "Brannoc kneels"],
  ["Brannoc kneels — let me roll to see how that goes.", "Brannoc kneels"],
  ["Brannoc kneels. Time to roll and see what the dice say.", "Brannoc kneels."],
  ["Brannoc lunges. Let me throw and find out.", "Brannoc lunges."],
  ["Brannoc lunges — let me roll if it hits.", "Brannoc lunges"],
  ["He rubs his chin — let me check and see how that goes.", "He rubs his chin"],
  ["Time to get to find out.", ""],
  ["Brannoc steadies. Let me check the save and see how it lands.", "Brannoc steadies."],
  ["Brannoc steadies. Let me check the save, and see how it lands.", "Brannoc steadies."],
  ["The door groans — let me roll the die and see what it does.", "The door groans"],
  ["The door groans — let me roll the die, and see what it does.", "The door groans"],
  ["Brannoc kneels — time to check, and see.", "Brannoc kneels"],
  ["The blade falls — time to get to see what the dice say.", "The blade falls"],
  ["Brannoc steadies. Time to check his Dexterity save.", "Brannoc steadies."],
  // Narration that only sounds like it is left alone.
  ['Brannoc kneels. "Let me check the wound."', 'Brannoc kneels. "Let me check the wound."'],
  ["Let me roll it, he says. Brannoc kneels.", "Let me roll it, he says. Brannoc kneels."],
  ["She lets me get the number from the ledger.", "She lets me get the number from the ledger."],
  ["Brannoc kneels in the lamplight", "Brannoc kneels in the lamplight"],
  [
    "He kneels. Time to check the cellar before the light goes.",
    "He kneels. Time to check the cellar before the light goes.",
  ],
  ["She shoulders the door. Time to roll the barrels.", "She shoulders the door. Time to roll the barrels."],
  ["He looks up. Let me see who will die tonight.", "He looks up. Let me see who will die tonight."],
  ["He looks up. Let me roll to see who will die tonight.", "He looks up. Let me roll to see who will die tonight."],
  [
    "He looks up. Let me check and see who will die tonight.",
    "He looks up. Let me check and see who will die tonight.",
  ],
  ["He kneels. Let me check the damage to the wall.", "He kneels. Let me check the damage to the wall."],
  [
    "He looks up. Let me roll the die, and see who will die tonight.",
    "He looks up. Let me roll the die, and see who will die tonight.",
  ],
  ["He kneels beside the body — let me see the damage.", "He kneels beside the body — let me see the damage."],
  [
    "He kneels beside the body — let me see the damage he took.",
    "He kneels beside the body — let me see the damage he took.",
  ],
  ["Time to check the damage.", "Time to check the damage."],
  [
    "He kneels. I'll check the cellar before the light goes.",
    "He kneels. I'll check the cellar before the light goes.",
  ],
  [
    "He rubs his chin. — Let me see the wound, he says, crouching.",
    "He rubs his chin. — Let me see the wound, he says, crouching.",
  ],
]) {
  assert.equal(stripTrailingToolAnnouncement(before!), after, before);
}

console.info("Generate tool-rounds regression passed.");
