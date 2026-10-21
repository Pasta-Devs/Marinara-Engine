import assert from "node:assert/strict";
import { extractLeadingThinkingBlocks } from "../../packages/shared/src/utils/thinking-tags.js";
import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import { thinkingOnlyReplyPromotable } from "../../packages/server/src/services/generation/empty-response-reason.js";

// Game Mode showed the GM's planning as narration. The format reminder told every model to
// "Think step by step" with nowhere to put it, so a model without a native thinking channel
// (or with it switched off) wrote the plan into the reply, where the Engine has no way to tell
// it from the scene. These checks pin that the reminder sends written planning into a leading
// <think> block, which the game turn already lifts into the message's thinking.

type ReminderContext = Parameters<typeof buildGmFormatReminder>[0];

for (const language of [undefined, "English", "Deutsch", "Français", "日本語"]) {
  const reminder = buildGmFormatReminder({ hasSceneModel: false, turnNumber: 1, language } as ReminderContext);
  const label = language ?? "no language";

  assert.doesNotMatch(
    reminder,
    /think step by step/i,
    `${label}: the reminder must not ask for open step-by-step reasoning`,
  );
  assert.match(
    reminder,
    /put all of it inside one <think>\.\.\.<\/think> block at the very start of the reply/,
    `${label}: written planning must be routed into a leading <think> block`,
  );
  assert.match(
    reminder,
    /output only the VN scene text: no notes, analysis, headings or plan/,
    `${label}: the reply after the block must be the scene alone`,
  );
}

const german = buildGmFormatReminder({ hasSceneModel: false, turnNumber: 1, language: "Deutsch" } as ReminderContext);
assert.match(
  german,
  /Write the scene text directly in German as a native speaker would\./,
  "the language line must apply to the scene text, not the planning",
);

// A [To the GM] turn answers out of character, so the reminder must not also demand scene text only.
const talkToGm = buildGmFormatReminder({ hasSceneModel: false, turnNumber: 1, addressMode: "gm" } as ReminderContext);
assert.match(talkToGm, /output only your out-of-character answer to the player: no notes, analysis, headings or plan/);
assert.doesNotMatch(
  talkToGm,
  /output only the VN scene text/,
  "a talk-to-GM turn must not be told to write only the scene",
);
assert.match(
  talkToGm,
  /put all of it inside one <think>\.\.\.<\/think> block/,
  "a talk-to-GM turn still keeps its plan hidden",
);

// A non-English talk-to-GM turn still answers in the game's language, but as an answer, not a scene.
const germanTalkToGm = buildGmFormatReminder({
  hasSceneModel: false,
  turnNumber: 1,
  language: "Deutsch",
  addressMode: "gm",
} as ReminderContext);
assert.match(germanTalkToGm, /Write your answer directly in German as a native speaker would\./);
assert.doesNotMatch(
  germanTalkToGm,
  /Write the scene text directly in German/,
  "scene-language guidance must not apply to a talk-to-GM answer",
);

// A reply that follows the reminder loses its plan to the thinking slot, whatever language it plans in.
const reply = [
  "<think>",
  "Ort: Hafen von Brem, Abend. Der Spieler hat gerade das Schiff verlassen.",
  "Nächster Schritt: Die Schmugglerin spricht ihn an.",
  "</think>",
  "",
  "Nebel kriecht über die Kaimauer, und die Laternen flackern im Wind.",
  "",
  '[Mira] [main] [smirk]: "Du siehst aus wie jemand, der eine Überfahrt sucht."',
].join("\n");
const extraction = extractLeadingThinkingBlocks(reply);
assert.equal(extraction.stripped, true);
assert.match(extraction.thinking, /Nächster Schritt/);
assert.ok(
  extraction.content.startsWith("Nebel kriecht über die Kaimauer"),
  "the scene must start right after the thinking block",
);
assert.doesNotMatch(extraction.content, /Ort:|Nächster Schritt/, "no planning may reach the narration");

// A reply with no visible text used to show its thinking as narration in Game Mode whatever the
// reason. A reasoning model that spends its whole output budget thinking ends with "length" and
// nothing else: that thinking is the GM's plan and must stay out of the narration box.
const game = { chatMode: "game", reasoningRequested: true } as const;
const plan = "Ort: Hafen von Brem. Nächster Schritt: die Schmugglerin.";
assert.equal(
  thinkingOnlyReplyPromotable({ ...game, finishReason: "length", providerThinking: plan }),
  false,
  "a Game Mode reply cut off mid-thought must not show its thinking as narration",
);
assert.equal(
  thinkingOnlyReplyPromotable({ ...game, finishReason: "stop", providerThinking: "" }),
  false,
  "thinking the model tagged inline (no provider reasoning) is never promoted in Game Mode",
);
assert.equal(
  thinkingOnlyReplyPromotable({ ...game, finishReason: "stop", providerThinking: "Nebel kriecht über die Kaimauer." }),
  true,
  "a finished Game Mode reply whose provider put the answer in the reasoning field is still recovered",
);
assert.equal(
  thinkingOnlyReplyPromotable({ ...game, finishReason: undefined, providerThinking: "Nebel." }),
  true,
  "a provider that reports no finish reason still gets the recovery",
);
assert.equal(
  thinkingOnlyReplyPromotable({
    chatMode: "conversation",
    reasoningRequested: false,
    finishReason: "length",
    providerThinking: "",
  }),
  true,
  "Conversation recovery is unchanged",
);
assert.equal(
  thinkingOnlyReplyPromotable({
    chatMode: "conversation",
    reasoningRequested: true,
    finishReason: "stop",
    providerThinking: "x",
  }),
  false,
);
assert.equal(
  thinkingOnlyReplyPromotable({
    chatMode: "roleplay",
    reasoningRequested: false,
    finishReason: "stop",
    providerThinking: "x",
  }),
  false,
);

console.log("game-gm-thinking-leak regression passed");
