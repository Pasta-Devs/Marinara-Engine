// One fixture per reply-checkup code (slice 61, R2): a saved reply's facts in, the expected finding
// codes out. diagnoseReply feeds the chat's quiet line, the omnibar Fix row and the Peek header.
import assert from "node:assert/strict";
import {
  diagnoseReply,
  REPLY_CHECKUP_LINE_CODES,
  type ReplyCheckupInput,
} from "../../packages/shared/src/utils/diagnose-reply.js";

const info = (patch: Record<string, unknown> = {}) => ({
  model: "m",
  provider: "openai",
  finishReason: "stop",
  maxTokens: 1024,
  maxContext: 8192,
  ...patch,
});
const fit = (patch: Record<string, unknown> = {}) => ({
  trimmed: false,
  droppedHistory: 0,
  tokensBefore: 3000,
  tokensAfter: 3000,
  inputBudget: 7000,
  replyBudgetFrom: 1024,
  replyBudgetTo: 1024,
  ...patch,
});
const codes = (input: ReplyCheckupInput) => diagnoseReply(input).map((finding) => finding.code);
const reply = (extra: NonNullable<ReplyCheckupInput["message"]["extra"]>, content = "A full reply.") => ({
  message: { content, extra },
});

// A healthy reply has nothing to say.
assert.deepEqual(codes(reply({ generationInfo: info({ contextFit: fit() }) })), []);

// cut_off: the provider reported the output limit; quote the limit that was sent.
const cut = diagnoseReply(reply({ generationInfo: info({ finishReason: "length", contextFit: fit() }) }));
assert.deepEqual(
  cut.map((finding) => finding.code),
  ["cut_off"],
);
assert.equal(cut[0]!.values.limit, 1024);
assert.deepEqual(cut[0]!.link, { kind: "chat-settings", section: "advanced-parameters" });

// empty_reply: an empty saved reply reuses the server's empty-reply reason, and replaces cut_off.
const empty = diagnoseReply(
  reply({ generationInfo: info({ finishReason: "length", tokensCompletion: 1024, tokensReasoning: 1000 }) }, "  "),
);
assert.deepEqual(
  empty.map((finding) => finding.code),
  ["empty_reply"],
);
assert.match(empty[0]!.text, /whole output budget/);
// A command-only anchor is empty on purpose.
assert.deepEqual(codes(reply({ generationInfo: info(), commandOnly: true }, "")), []);

// history_trimmed: slice 60's contextFit says older messages were dropped; the link is the connection.
const trimmed = diagnoseReply({
  ...reply({
    generationInfo: info({
      contextFit: fit({ trimmed: true, droppedHistory: 42, tokensBefore: 9000, tokensAfter: 6900 }),
    }),
  }),
  connectionId: "conn-1",
});
assert.deepEqual(
  trimmed.map((finding) => finding.code),
  ["history_trimmed"],
);
assert.equal(trimmed[0]!.values.count, 42);
assert.deepEqual(trimmed[0]!.link, { kind: "resource", resource: "connection", id: "conn-1" });
// Trimmed but no history dropped (only lore/system cut) is not this finding.
assert.deepEqual(codes(reply({ generationInfo: info({ contextFit: fit({ trimmed: true }) }) })), []);

// reply_budget_cut: the fit shrank the reply budget to make room for the prompt.
const budgetCut = diagnoseReply(
  reply({ generationInfo: info({ contextFit: fit({ replyBudgetFrom: 4096, replyBudgetTo: 900 }) }) }),
);
assert.deepEqual(
  budgetCut.map((finding) => finding.code),
  ["reply_budget_cut"],
);
assert.deepEqual(budgetCut[0]!.values, { from: 4096, to: 900 });

// lore_budget_skipped: budget skips count, location skips do not; a chat budget links to Chat Settings.
const lore = diagnoseReply(
  reply({
    generationInfo: info(),
    lorebookScan: {
      budgetSkippedEntries: [
        { name: "Castle", lorebookId: "lb-1", blockedBy: "lorebook" },
        { name: "Elsewhere", lorebookId: "lb-1", blockedBy: "location" },
      ],
    },
  }),
);
assert.deepEqual(
  lore.map((finding) => finding.code),
  ["lore_budget_skipped"],
);
assert.equal(lore[0]!.values.count, 1);
assert.deepEqual(lore[0]!.link, { kind: "resource", resource: "lorebook", id: "lb-1" });
const chatLore = diagnoseReply(
  reply({ generationInfo: info(), lorebookScan: { budgetSkippedEntries: [{ name: "Moat", blockedBy: "chat" }] } }),
);
assert.deepEqual(chatLore[0]!.link, { kind: "chat-settings", section: "lorebooks" });
assert.deepEqual(
  codes(
    reply({ generationInfo: info(), lorebookScan: { budgetSkippedEntries: [{ name: "X", blockedBy: "location" }] } }),
  ),
  [],
);

// card_large: the prompt-bearing card text above 40% of the prompt budget. Greetings do not count.
const bigCard = { description: "word ".repeat(4000) };
const card = diagnoseReply({
  ...reply({ generationInfo: info({ contextFit: fit({ inputBudget: 7000 }) }) }),
  character: { id: "char-1", data: bigCard },
});
assert.deepEqual(
  card.map((finding) => finding.code),
  ["card_large"],
);
assert.ok(Number(card[0]!.values.percent) > 40);
assert.deepEqual(card[0]!.link, { kind: "resource", resource: "character", id: "char-1" });
assert.deepEqual(
  codes({
    ...reply({ generationInfo: info({ contextFit: fit({ inputBudget: 7000 }) }) }),
    character: { id: "char-1", data: { description: "Short.", alternate_greetings: ["word ".repeat(9000)] } },
  }),
  [],
);

// A reply with several problems lists them all. F4: card_large leads when it co-occurs with
// history_trimmed/reply_budget_cut, since the trim is the oversized card's symptom, not an
// independent cause — "name one cause" (the Fix row, the panel, chat.diagnose) must point at the card.
assert.deepEqual(
  codes({
    message: {
      content: "Half a sent",
      extra: {
        generationInfo: info({
          finishReason: "length",
          contextFit: fit({ trimmed: true, droppedHistory: 3, replyBudgetFrom: 2048, replyBudgetTo: 512 }),
        }),
        lorebookScan: { budgetSkippedEntries: [{ name: "Moat", blockedBy: "both" }] },
      },
    },
    character: { id: "c", data: bigCard },
  }),
  ["card_large", "cut_off", "history_trimmed", "reply_budget_cut", "lore_budget_skipped"],
);

// F4: large card + trim only (T20's exact shape) — card_large still leads.
assert.deepEqual(
  codes({
    ...reply({ generationInfo: info({ contextFit: fit({ trimmed: true, droppedHistory: 6, inputBudget: 7000 }) }) }),
    character: { id: "c", data: bigCard },
  }),
  ["card_large", "history_trimmed"],
);
// No trim/reply-cut alongside it: card_large still just appends at the end as before.
assert.deepEqual(
  codes({
    ...reply({ generationInfo: info({ contextFit: fit({ inputBudget: 7000 }) }) }),
    character: { id: "c", data: bigCard },
  }),
  ["card_large"],
);

// Only reply facts earn the quiet line; setup facts stay inside the checkup.
assert.deepEqual([...REPLY_CHECKUP_LINE_CODES].sort(), [
  "cut_off",
  "empty_reply",
  "history_trimmed",
  "reply_budget_cut",
]);

console.log("reply-checkup regression passed");
