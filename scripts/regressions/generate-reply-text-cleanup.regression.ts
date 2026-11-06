import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanGeneratedReply } from "../../packages/server/src/routes/generate/reply-text-cleanup.js";

// Pins the reply text cleanup moved out of generate.routes.ts (#7573).

const charInfo = [
  { id: "char-1", name: "Alice" },
  { id: "char-2", name: "Bob" },
];
const base = {
  chatId: "chat-1",
  chatMode: "conversation",
  impersonate: false,
  connectedChatId: null as string | null,
  isGroupChat: false,
  usesIndividualGroupGeneration: false,
  targetCharId: "char-1" as string | null,
  charInfo,
  trimIncompleteEnding: false,
};
const individual = { ...base, isGroupChat: true, usesIndividualGroupGeneration: true };
const roleplay = { ...base, chatMode: "roleplay" };

const rows: Array<{
  name: string;
  text: string;
  o: typeof base;
  expected:
    { text: string; changed: boolean; trimmedEnding?: boolean; oocMessages?: string[] } | { dropped: "wrong_speaker" };
}> = [
  {
    name: "OOC tags go to the connected conversation",
    text: "She nods.\n\n<ooc>Brb, dinner.</ooc>\n\n\nThe rain falls.",
    o: { ...roleplay, connectedChatId: "conv-1" },
    expected: { text: "She nods.\n\nThe rain falls.", changed: true, oocMessages: ["Brb, dinner."] },
  },
  {
    name: "an OOC-only reply stays visible instead of being discarded (#8382)",
    text: "<ooc>The next beat should reveal the letter.</ooc>",
    o: { ...roleplay, connectedChatId: "conv-1" },
    expected: { text: "The next beat should reveal the letter.", changed: true },
  },
  {
    name: "case-insensitive OOC-only blocks preserve their order without duplicate forwarding",
    text: "  <OOC>First thought.</OOC>\n\n<oOc>Second thought.</oOc>  ",
    o: { ...roleplay, connectedChatId: "conv-1" },
    expected: { text: "First thought.\n\nSecond thought.", changed: true },
  },
  {
    name: "empty OOC blocks do not hide a real OOC-only reply",
    text: "<ooc> </ooc> <OOC>Keep the answer.</OOC>",
    o: { ...roleplay, connectedChatId: "conv-1" },
    expected: { text: "Keep the answer.", changed: true },
  },
  {
    name: "OOC-only individual group replies survive a stripped speaker prefix",
    text: "Alice: <OOC>Keep Alice's answer.</OOC>",
    o: { ...individual, chatMode: "roleplay", connectedChatId: "conv-1" },
    expected: { text: "Keep Alice's answer.", changed: true },
  },
  {
    name: "OOC fallback does not revive a wrong-speaker-only group reply",
    text: "Bob: Not Alice's turn. <OOC>Keep the speaker gate.</OOC>",
    o: { ...individual, chatMode: "roleplay", connectedChatId: "conv-1" },
    expected: { dropped: "wrong_speaker" },
  },
  {
    name: "restored OOC text cannot bypass the individual wrong-speaker gate",
    text: "<OOC>Bob: Not Alice's turn.</OOC>",
    o: { ...individual, chatMode: "roleplay", connectedChatId: "conv-1" },
    expected: { dropped: "wrong_speaker" },
  },
  {
    name: "restored OOC text strips the target's individual speaker prefix",
    text: "<OOC>Alice: Keep this answer.</OOC>",
    o: { ...individual, chatMode: "roleplay", connectedChatId: "conv-1" },
    expected: { text: "Keep this answer.", changed: true },
  },
  {
    name: "restored OOC text honors incomplete-ending cleanup",
    text: "<OOC>First sentence. Second sentence is cut</OOC>",
    o: { ...roleplay, connectedChatId: "conv-1", trimIncompleteEnding: true },
    expected: { text: "First sentence.", changed: true, trimmedEnding: true },
  },
  {
    name: "an unclosed OOC block remains visible",
    text: "<OOC>Keep this unfinished block.",
    o: { ...roleplay, connectedChatId: "conv-1" },
    expected: { text: "<OOC>Keep this unfinished block.", changed: false },
  },
  {
    name: "OOC tags stay without a connected conversation",
    text: "She nods. <ooc>Brb.</ooc>",
    o: roleplay,
    expected: { text: "She nods. <ooc>Brb.</ooc>", changed: false },
  },
  {
    name: "OOC tags stay in an impersonation",
    text: "She nods. <ooc>Brb.</ooc>",
    o: { ...roleplay, connectedChatId: "conv-1", impersonate: true },
    expected: { text: "She nods. <ooc>Brb.</ooc>", changed: false },
  },
  {
    // Roleplay: the conversation envelope strip would also remove the prefix and hide a broken strip.
    name: "individual group: the responder's name prefix is stripped",
    text: "Alice: Hello there.",
    o: { ...individual, chatMode: "roleplay" },
    expected: { text: "Hello there.", changed: true },
  },
  {
    name: "individual group: a speaker wrapper is stripped",
    text: '<speaker="Alice">"Hi."</speaker>',
    o: { ...individual, chatMode: "roleplay" },
    expected: { text: '"Hi."', changed: true },
  },
  {
    name: "individual group: another speaker's leading turn is pruned to the responder's",
    text: "Bob: Me first.\n\nAlice: My turn.",
    o: individual,
    expected: { text: "My turn.", changed: true },
  },
  {
    name: "individual group conversation: a trailing extra turn is cut",
    text: "Hi Bob.\nBob: Hi Alice.",
    o: individual,
    expected: { text: "Hi Bob.", changed: true },
  },
  {
    name: "individual group: a reply holding only another speaker's turn is dropped",
    text: "Bob: Only my words.",
    o: individual,
    expected: { dropped: "wrong_speaker" },
  },
  {
    name: "merged group conversation keeps speaker prefixes",
    text: "Alice: Hi.\nBob: Hey.",
    o: { ...base, isGroupChat: true },
    expected: { text: "Alice: Hi.\nBob: Hey.", changed: false },
  },
  {
    name: "conversation envelope is stripped",
    text: "[11.07 15:53] Alice: Hello!",
    o: base,
    expected: { text: "Hello!", changed: true },
  },
  {
    name: "incomplete ending is trimmed when on",
    text: "First sentence. Second sentence is cut",
    o: { ...base, trimIncompleteEnding: true },
    expected: { text: "First sentence.", changed: true, trimmedEnding: true },
  },
  // #8643: a finished roleplay reply that ends in an italic action or bold line is complete. The emphasis marks after
  // the full stop made the trim drop the whole last paragraph, leaving an exact prefix of what had streamed.
  {
    name: "a reply ending in an italic action is complete (#8643)",
    text: 'She looked up. "Hello there."\n\n*She smiles softly, leaning closer.*',
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: 'She looked up. "Hello there."\n\n*She smiles softly, leaning closer.*', changed: false },
  },
  {
    name: "a quoted line inside a closing italic action is not cut at its question mark (#8643)",
    text: 'He nods. "Fine."\n\n*"Really?" she asks, grinning wide.*',
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: 'He nods. "Fine."\n\n*"Really?" she asks, grinning wide.*', changed: false },
  },
  {
    name: "bold, underscore and struck endings are complete (#8643)",
    text: "The rain fell.\n\n**The end.** _Fin._ ~~Or is it?~~",
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: "The rain fell.\n\n**The end.** _Fin._ ~~Or is it?~~", changed: false },
  },
  {
    name: "a line closed by HTML tags is complete (#8643)",
    text: 'She waves.\n\n<font color="#c9f">"See you tomorrow."</font>\n\n<i>Finally home.</I>',
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: {
      text: 'She waves.\n\n<font color="#c9f">"See you tomorrow."</font>\n\n<i>Finally home.</I>',
      changed: false,
    },
  },
  {
    name: "a line closed by CJK quote brackets is complete (#8643)",
    text: "彼女は笑った。\n「また明日ね。」\n『本当に？』\n（そうだ。）",
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: "彼女は笑った。\n「また明日ね。」\n『本当に？』\n（そうだ。）", changed: false },
  },
  {
    name: "an italic action that was really cut off is still trimmed",
    text: "She waits.\n\n*She turns toward the door and",
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: "She waits.", changed: true, trimmedEnding: true },
  },
  {
    name: "an HTML line that was really cut off is still trimmed",
    text: "She waits.\n\n<i>She turns toward the door and</i>",
    o: { ...roleplay, trimIncompleteEnding: true },
    expected: { text: "She waits.", changed: true, trimmedEnding: true },
  },
  {
    name: "incomplete ending is kept when off",
    text: "First sentence. Second sentence is cut",
    o: base,
    expected: { text: "First sentence. Second sentence is cut", changed: false },
  },
  {
    name: "roleplay whitespace is trimmed",
    text: "  Line one.   \nLine two.  \n",
    o: roleplay,
    expected: { text: "Line one.\nLine two.", changed: true },
  },
  {
    name: "a clean roleplay reply is unchanged",
    text: "Line one.\nLine two.",
    o: roleplay,
    expected: { text: "Line one.\nLine two.", changed: false },
  },
];

for (const row of rows) {
  const result = cleanGeneratedReply(row.text, row.o);
  const expected =
    "dropped" in row.expected ? row.expected : { oocMessages: [], trimmedEnding: false, ...row.expected };
  assert.deepEqual(result, expected, row.name);
}

// A trim is announced, never silent (#8643): the route sends reply_trimmed and the chat shows a notice.
const routeSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  routeSource,
  /if \(cleanedReply\.trimmedEnding\) sendSseEvent\(reply, \{ type: "reply_trimmed" \}\);/u,
  "the generate route announces a trimmed ending",
);
const clientSource = readFileSync(new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url), "utf8");
assert.match(
  clientSource,
  /case "reply_trimmed": \{[\s\S]{0,300}toast\.info\(translate\("chat\.reply\.trimmedIncompleteEnding"\)/u,
  "the chat shows a notice when the reply's ending was trimmed",
);

console.log("generate reply text cleanup regression passed");
