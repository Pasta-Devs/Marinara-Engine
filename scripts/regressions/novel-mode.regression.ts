import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPPORTED_MACROS } from "../../packages/shared/src/utils/macro-engine.js";
import { isNovelChat } from "../../packages/shared/src/types/chat.js";
import {
  changedNovelPassages,
  createNovelPassage,
  createNovelState,
  deleteAcrossNovelPassages,
  emptiedNovelPassages,
  flattenPastedNovelPassages,
  novelPassageAttrs,
  novelParagraphSeparator,
  novelPassageText,
  normalizeNovelText,
  parseNovelMarks,
  serializeNovelMarks,
  splitNovelParagraphs,
  novelEditStillCurrent,
  queueNovelSave,
  recordNovelSave,
  syncNovelPassages,
  unsavedNovelEdits,
  type NovelPassageBaseline,
} from "../../packages/client/src/components/chat/novel-document.js";
import { getMessageBarRules } from "../../packages/client/src/lib/message-bar-rules.js";
import {
  getSlashCompletions,
  matchSlashCommand,
  type SlashCommandContext,
} from "../../packages/client/src/lib/slash-commands.js";
import {
  resolveGroupGenerationMode,
  resolveGroupSpeakerColors,
  stripSpeakerTagsExceptLastAssistant,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  buildCyoaChoiceSubmissionPayload,
  resolveCyoaChoiceAction,
} from "../../packages/client/src/components/chat/cyoa-choice-submission.js";
import {
  buildNovelGuideInstructionMessage,
  stripGenerationGuideInstruction,
} from "../../packages/shared/src/utils/generation-guide.js";
import { cleanTTSInputText } from "../../packages/client/src/lib/tts-dialogue.js";

assert.equal(isNovelChat("roleplay", { roleplayDisplayStyle: "novel" }), true);
assert.equal(isNovelChat("roleplay", { roleplayDisplayStyle: "visual-novel" }), false);
assert.equal(isNovelChat("roleplay", {}), false);
assert.equal(isNovelChat("roleplay", null), false);
assert.equal(isNovelChat("game", { roleplayDisplayStyle: "novel" }), false);
assert.equal(isNovelChat("conversation", { roleplayDisplayStyle: "novel" }), false);

assert.equal(stripGenerationGuideInstruction(buildNovelGuideInstructionMessage("  a storm hits  ")), "a storm hits");
assert.ok(!buildNovelGuideInstructionMessage("x").includes("{{user}}"));
// A bracketed guide reads as a note the model copies into the passage ("[guidance: ...]"), so the novel's is
// a plain sentence. Guides stored before still show their direction.
assert.doesNotMatch(buildNovelGuideInstructionMessage("go to the school"), /[[\]]/);
assert.equal(
  stripGenerationGuideInstruction(
    "[Guided generation instruction — write the next passage of the story, steering it toward the following: a storm hits]",
  ),
  "a storm hits",
);

// Novels write with Marinara's Novel Preset (novel-preset.regression.ts), so the Universal preset and the
// macro engine carry no novel switch: a bare `novel` operand would read as truthy text in every chat.
assert.doesNotMatch(
  readFileSync(new URL("../../packages/server/src/db/default-preset.json", import.meta.url), "utf8"),
  /novel/i,
);
assert.ok(!SUPPORTED_MACROS.some((macro) => /novel/i.test(macro.syntax)));

// Book paragraphs: each non-blank line is one.
assert.deepEqual(splitNovelParagraphs("First line.\n\nSecond line.\n   \nThird."), [
  "First line.",
  "Second line.",
  "Third.",
]);

const syncMessageOf = (id: string, content: string, activeSwipeIndex = 0) => ({ id, content, activeSwipeIndex });

// Italic and bold: read from the message's markdown and written back the same way, in one style (* and **).
{
  const marks = (line: string) =>
    parseNovelMarks(line).map(({ text, bold, italic }) => `${bold ? "B" : ""}${italic ? "I" : ""}:${text}`);
  assert.deepEqual(marks("*thought*"), ["I:thought"]);
  assert.deepEqual(marks("_thought_ and __loud__"), ["I:thought", ": and ", "B:loud"]);
  assert.deepEqual(marks("***both***"), ["BI:both"]);
  assert.deepEqual(marks("**bold *nested* bold**"), ["B:bold ", "BI:nested", "B: bold"]);
  // Literal asterisks, unmatched markers, escapes and snake_case stay text.
  for (const literal of [
    "5 * 3 = 15",
    "5 * 3 * 2",
    "a lone *",
    "*unmatched",
    "** spaced **",
    "snake_case_name",
    "\\*not\\*",
  ])
    assert.deepEqual(marks(literal), [`:${literal}`], literal);
  assert.deepEqual(marks("**unmatched*"), [":*", "I:unmatched"]);
  assert.deepEqual(marks("un*frigging*believable"), [":un", "I:frigging", ":believable"]);
  // A marker never reaches across a line: each line is a paragraph of its own.
  assert.deepEqual(splitNovelParagraphs("*one\ntwo*").map(marks), [[":*one"], [":two*"]]);
  // Other markdown is plain text.
  assert.deepEqual(marks("# Heading [link](https://x.y) `code` <b>tag</b>"), [
    ":# Heading [link](https://x.y) `code` <b>tag</b>",
  ]);

  // Parse, then serialize: the same string, paragraph breaks included.
  const schema = createNovelState().schema;
  const roundTrip = (content: string) =>
    novelPassageText(createNovelPassage(schema, { messageId: "m" }, content), novelParagraphSeparator(content));
  for (const content of [
    "Plain text.",
    "She *knew* it was over.\nHe said **no**.",
    "She *knew* it was over.\n\nHe said **no**.",
    "***x***",
    "5 * 3 = 15, and a lone * here.\n*unmatched and **half*\nun*frigging*believable and snake_case",
    '"*Hush*," she said. **Bold *and italic* inside**, then *it **b** it*.',
    "**b *i***\n\n***x* y**\n\n*a**b*",
    "# Not a heading\n- not a list\n[not](https://a.link) <i>nor a tag</i>",
  ])
    assert.equal(roundTrip(content), content, content);
  // Underscores read the same and are written in the one style.
  assert.equal(roundTrip("_thought_ and __loud__"), "*thought* and **loud**");
  assert.equal(normalizeNovelText("_thought_\n__loud__"), "*thought*\n\n**loud**");

  // A mark the writer gives a word and its space keeps the space outside, so it reads back as bold.
  assert.equal(
    serializeNovelMarks([
      { text: "word ", bold: true, italic: false },
      { text: "next", bold: false, italic: false },
    ]),
    "**word** next",
  );
  assert.equal(serializeNovelMarks([{ text: " ", bold: false, italic: true }]), " ");

  // The paragraph break a message uses.
  assert.equal(novelParagraphSeparator("a\nb\nc"), "\n");
  assert.equal(novelParagraphSeparator("a\n\nb\n\nc\n"), "\n\n");
  assert.equal(novelParagraphSeparator("a\nb\n\nc"), "\n\n", "mixed breaks keep the blank line");
  assert.equal(novelParagraphSeparator("one line"), "\n\n");

  // Editing one word saves the rest of the markdown, and the message's single line breaks, unchanged.
  const original = "She *knew* it.\n**Run**, he said. 5 * 3 *is* not 2.\nThird *line*, __old__ style.";
  const markBaselines = new Map<string, NovelPassageBaseline>();
  let state = createNovelState();
  state = state.apply(syncNovelPassages(state, [syncMessageOf("m", original)], markBaselines, new Map())!);
  assert.deepEqual(unsavedNovelEdits(state.doc, markBaselines), [], "a loaded passage is not an edit");
  let saidPos = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text!.includes("said") && saidPos < 0) saidPos = pos + node.text!.indexOf("said");
  });
  state = state.apply(state.tr.insertText("shouted", saidPos, saidPos + "said".length));
  assert.deepEqual(unsavedNovelEdits(state.doc, markBaselines), [
    {
      messageId: "m",
      text: "She *knew* it.\n\n**Run**, he shouted. 5 * 3 *is* not 2.\n\nThird *line*, **old** style.",
      content: "She *knew* it.\n**Run**, he shouted. 5 * 3 *is* not 2.\nThird *line*, **old** style.",
      swipe: 0,
    },
  ]);
  // Bold (Ctrl/Cmd+B) on a selection saves it as **…**.
  let boldPos = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text!.startsWith("She") && boldPos < 0) boldPos = pos;
  });
  state = state.apply(state.tr.addMark(boldPos, boldPos + "She".length, state.schema.marks.bold!.create()));
  assert.match(unsavedNovelEdits(state.doc, markBaselines)[0]!.content, /^\*\*She\*\* \*knew\* it\.\n/);

  // Baselines: a message whose only change is its paragraph breaks or marker style is not an edit, and its
  // passage is left as it is.
  const breakBaselines = new Map<string, NovelPassageBaseline>();
  let breaks = createNovelState();
  breaks = breaks.apply(syncNovelPassages(breaks, [syncMessageOf("m", "One *a*.\nTwo.")], breakBaselines, new Map())!);
  assert.equal(syncNovelPassages(breaks, [syncMessageOf("m", "One _a_.\n\nTwo.\n")], breakBaselines, new Map()), null);
  assert.deepEqual(unsavedNovelEdits(breaks.doc, breakBaselines), []);
  assert.equal(breakBaselines.get("m")?.separator, "\n\n", "the baseline follows the message's breaks");

  // Text to speech reads the saved markdown without its asterisks.
  assert.equal(cleanTTSInputText("She *knew* it. **Run**, she said. ***Now***."), "She knew it. Run, she said. Now.");
}

// The novel editor's document: one passage per message, then the writer's draft.
const passageSummary = (state: ReturnType<typeof createNovelState>) => {
  const rows: string[] = [];
  state.doc.forEach((passage) => {
    const { messageId, draft, pendingKey } = novelPassageAttrs(passage);
    rows.push(`${messageId ?? (draft ? "draft" : pendingKey)}:${novelPassageText(passage)}`);
  });
  return rows;
};
const syncMessage = syncMessageOf;
const baselines = new Map<string, NovelPassageBaseline>();
const createdPending = new Map<string, string>();
let novelState = createNovelState();
const applySync = (messages: ReturnType<typeof syncMessage>[]) => {
  const tr = syncNovelPassages(novelState, messages, baselines, createdPending);
  if (tr) novelState = novelState.apply(tr);
  return tr;
};

applySync([syncMessage("a", "One.\nTwo."), syncMessage("b", "Three.")]);
assert.deepEqual(passageSummary(novelState), ["a:One.\n\nTwo.", "b:Three.", "draft:"]);
assert.equal(
  applySync([syncMessage("a", "One.\nTwo."), syncMessage("b", "Three.")]),
  null,
  "no change, no transaction",
);

// A passage the writer is editing keeps their text when its message refreshes; others take the new text.
const posInPassage = (index: number, offset: number) => {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += novelState.doc.child(i).nodeSize;
  return pos + 2 + offset;
};
novelState = novelState.apply(novelState.tr.insertText(" Edited", posInPassage(1, "Three.".length)));
applySync([syncMessage("a", "One changed."), syncMessage("b", "Three.")]);
assert.deepEqual(passageSummary(novelState), ["a:One changed.", "b:Three. Edited", "draft:"]);
// The unsaved edit is found, so the editor can save it before a sync drops its passage (the transcript
// window moving past it); the sync itself takes the passage and its baseline out.
const pendingEdit = unsavedNovelEdits(novelState.doc, baselines);
assert.deepEqual(pendingEdit, [{ messageId: "b", text: "Three. Edited", content: "Three. Edited", swipe: 0 }]);
assert.equal(novelEditStillCurrent(baselines, pendingEdit[0]!), true);
{
  const leftList = syncNovelPassages(novelState, [syncMessage("a", "One changed.")], new Map(baselines), new Map());
  assert.deepEqual(passageSummary(novelState.apply(leftList!)), ["a:One changed.", "draft:"]);
}
// Switching swipes drops the edit for the new swipe's text.
applySync([syncMessage("a", "One changed."), syncMessage("b", "Other swipe.", 1)]);
assert.deepEqual(passageSummary(novelState), ["a:One changed.", "b:Other swipe.", "draft:"]);
// A save of the old swipe's edit still queued is not sent (it would write into the new swipe), and one
// that finishes after the switch leaves the new swipe's baseline alone, so the new swipe is not dirty.
assert.equal(novelEditStillCurrent(baselines, pendingEdit[0]!), false);
recordNovelSave(baselines, pendingEdit[0]!);
assert.deepEqual(unsavedNovelEdits(novelState.doc, baselines), []);
// A deleted message's passage goes.
applySync([syncMessage("b", "Other swipe.", 1)]);
assert.deepEqual(passageSummary(novelState), ["b:Other swipe.", "draft:"]);

// Text written in the draft becomes a pending passage, then the message it was saved as.
novelState = novelState.apply(
  novelState.tr
    .replaceWith(posInPassage(1, -1) - 1, novelState.doc.content.size, [
      createNovelPassage(novelState.schema, { pendingKey: "k1" }, "My own line."),
      createNovelPassage(novelState.schema, { draft: true }, ""),
    ])
    .setMeta("novelSync", true),
);
assert.deepEqual(passageSummary(novelState), ["b:Other swipe.", "k1:My own line.", "draft:"]);
baselines.set("c", { text: "My own line.", swipe: 0 });
createdPending.set("k1", "c");
applySync([syncMessage("b", "Other swipe.", 1)]);
assert.deepEqual(passageSummary(novelState), ["b:Other swipe.", "k1:My own line.", "draft:"], "kept until it loads");
// The sync right after the save runs before the message loads; it keeps the new message's baseline, so
// what the writer types meanwhile is still an edit once the message arrives, and is saved, not replaced.
assert.deepEqual(baselines.get("c"), { text: "My own line.", swipe: 0 });
novelState = novelState.apply(novelState.tr.insertText(" More.", posInPassage(1, "My own line.".length)));
applySync([syncMessage("b", "Other swipe.", 1), syncMessage("c", "My own line.")]);
assert.deepEqual(passageSummary(novelState), ["b:Other swipe.", "c:My own line. More.", "draft:"]);
assert.equal(createdPending.size, 0);
{
  const [typedWhileSaving, ...rest] = unsavedNovelEdits(novelState.doc, baselines);
  assert.deepEqual(
    [typedWhileSaving, rest],
    [{ messageId: "c", text: "My own line. More.", content: "My own line. More.", swipe: 0 }, []],
  );
  recordNovelSave(baselines, typedWhileSaving!);
}

// The editor's save queue: one message's saves run in order, each checked again at its turn.
{
  const queue = new Map<string, Promise<void>>();
  const saveBaselines = new Map<string, NovelPassageBaseline>([["m", { text: "A", swipe: 0 }]]);
  const sent: string[] = [];
  const errors: unknown[] = [];
  let finishFirst!: () => void;
  const save = ({ text }: { text: string }) => {
    sent.push(text);
    if (text === "A1") return new Promise<void>((resolve) => (finishFirst = resolve));
    if (text === "fails") return Promise.reject(new Error("offline"));
    return Promise.resolve();
  };
  const edit = (text: string, swipe = 0) => ({ messageId: "m", text, swipe });
  const first = queueNovelSave(queue, saveBaselines, edit("A1"), save, (error) => errors.push(error));
  const second = queueNovelSave(queue, saveBaselines, edit("A12"), save, (error) => errors.push(error));
  // The same text again (a blur right after the timer): written once, by the save ahead of it.
  const repeat = queueNovelSave(queue, saveBaselines, edit("A12"), save, (error) => errors.push(error));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(sent, ["A1"], "a later save waits for the one in flight");
  finishFirst();
  await Promise.all([first, second, repeat]);
  assert.deepEqual(sent, ["A1", "A12"]);
  assert.deepEqual(saveBaselines.get("m"), { text: "A12", swipe: 0 });
  assert.equal(queue.size, 0, "a settled queue is emptied");
  // An edit still queued when the passage moves to another swipe is not sent.
  let finishBlocker!: () => void;
  const blocker = queueNovelSave(
    queue,
    saveBaselines,
    edit("A123"),
    () => new Promise<void>((resolve) => (finishBlocker = resolve)),
    (error) => errors.push(error),
  );
  const stale = queueNovelSave(queue, saveBaselines, edit("A1234"), save, (error) => errors.push(error));
  await new Promise((resolve) => setTimeout(resolve, 0));
  saveBaselines.set("m", { text: "Other swipe.", swipe: 1 });
  finishBlocker();
  await Promise.all([blocker, stale]);
  assert.deepEqual(sent, ["A1", "A12"]);
  assert.deepEqual(saveBaselines.get("m"), { text: "Other swipe.", swipe: 1 });
  // A failed save is reported and leaves the baseline, so the text is still unsaved and saves again later.
  await queueNovelSave(queue, saveBaselines, edit("fails", 1), save, (error) => errors.push(error));
  assert.deepEqual(
    errors.map((error) => (error as Error).message),
    ["offline"],
  );
  assert.deepEqual(saveBaselines.get("m"), { text: "Other swipe.", swipe: 1 });
  assert.equal(queue.size, 0);
}

// Unsaved text whose save failed and that the writer then emptied has nothing left to save: the guard keeps
// it (its pending key would vanish), so the sync takes it out once the caret is elsewhere. Text still being
// written, or on its way to a message, stays.
{
  const pendingPage = (caretIn: number, saving?: Map<string, string>) => {
    let state = createNovelState();
    state = state.apply(
      state.tr
        .replaceWith(0, state.doc.content.size, [
          createNovelPassage(state.schema, { messageId: "m" }, "Kept."),
          createNovelPassage(state.schema, { pendingKey: "failed" }, ""),
          createNovelPassage(state.schema, { draft: true }, ""),
        ])
        .setMeta("novelSync", true),
    );
    let caret = 0;
    for (let i = 0; i < caretIn; i++) caret += state.doc.child(i).nodeSize;
    // The scripts cannot import ProseMirror itself; the state's own selection class makes the caret.
    const TextSelection = state.selection.constructor as unknown as {
      near: (pos: ReturnType<typeof state.doc.resolve>) => typeof state.selection;
    };
    state = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(caret + 2))));
    const tr = syncNovelPassages(state, [syncMessage("m", "Kept.")], new Map(), saving ?? new Map());
    return passageSummary(tr ? state.apply(tr) : state);
  };
  assert.deepEqual(pendingPage(2), ["m:Kept.", "draft:"]);
  assert.deepEqual(pendingPage(1), ["m:Kept.", "failed:", "draft:"], "the caret is still in it");
  assert.deepEqual(
    pendingPage(2, new Map([["failed", "x"]])),
    ["m:Kept.", "failed:", "draft:"],
    "its message is on its way",
  );
}

// Deleting across passages deletes inside each one and keeps every passage and its message.
applySync([syncMessage("a", "Alpha one.\nAlpha two."), syncMessage("b", "Beta."), syncMessage("c", "Gamma.")]);
{
  const tr = novelState.tr;
  assert.ok(deleteAcrossNovelPassages(tr, posInPassage(0, "Alpha ".length), posInPassage(2, "Gam".length)));
  novelState = novelState.apply(tr);
  assert.deepEqual(passageSummary(novelState), ["a:Alpha ", "b:", "c:ma.", "draft:"]);
  assert.equal(novelState.doc.child(1).childCount, 1, "an emptied passage keeps a paragraph");
  // The passage the delete emptied is found though the caret never entered it, so it can be offered for
  // deletion instead of skipping its save and coming back on reload; the caret's own passage waits.
  assert.equal(novelState.selection.$from.index(0), 0);
  assert.deepEqual(emptiedNovelPassages(novelState.doc, baselines, 0), ["b"]);
  assert.deepEqual(emptiedNovelPassages(novelState.doc, baselines, 1), []);
  // A message that was empty to begin with is not one the writer emptied.
  assert.deepEqual(emptiedNovelPassages(novelState.doc, new Map([["b", { text: "", swipe: 0 }]]), -1), []);
  assert.equal(deleteAcrossNovelPassages(novelState.tr, posInPassage(0, 0), posInPassage(0, 2)), false);
}
// The passages an edit changes are found by message, so an edit to a hidden one can be refused.
{
  const before = novelState.doc;
  assert.deepEqual(changedNovelPassages(before, before), []);
  const edited = novelState.tr.insertText("!", posInPassage(2, 0)).doc;
  assert.deepEqual(changedNovelPassages(before, edited), [before.child(0).nodeSize + before.child(1).nodeSize]);
  const tr = novelState.tr;
  deleteAcrossNovelPassages(tr, posInPassage(0, 0), posInPassage(2, 1));
  assert.deepEqual(changedNovelPassages(before, tr.doc).length, 2, "the emptied passage was already empty");
}
// The guard refuses a user edit that joins passages, which would drop a message.
{
  const joined = novelState.tr.delete(posInPassage(0, 2), posInPassage(2, 1));
  assert.equal(novelState.applyTransaction(joined).state.doc.childCount, novelState.doc.childCount);
}
// Text copied across passages pastes as plain paragraphs, not as copies of the passages.
{
  const slice = novelState.doc.slice(posInPassage(0, 0), posInPassage(2, 1));
  const pasted = flattenPastedNovelPassages(slice);
  pasted.content.forEach((node) => assert.equal(node.type.name, "paragraph"));
}

// A novel has no persona turn, so impersonating is not offered there; other roleplays keep it.
assert.equal(matchSlashCommand("/impersonate she runs", { mode: "roleplay", novel: true }), null);
assert.equal(matchSlashCommand("/impersonate_prompt", { mode: "roleplay", novel: true }), null);
// Nor is posting a message as your persona: a novel has no user turns.
assert.equal(matchSlashCommand("/send hello", { mode: "roleplay", novel: true }), null);
assert.equal(matchSlashCommand("/send hello", { mode: "roleplay" })?.command.name, "send");
assert.equal(matchSlashCommand("/impersonate she runs", { mode: "roleplay" })?.command.name, "impersonate");
assert.ok(
  !getSlashCompletions("/imp", { mode: "roleplay", novel: true }).some((command) => command.name.startsWith("imp")),
);
assert.ok(getSlashCompletions("/imp", { mode: "roleplay" }).some((command) => command.name === "impersonate"));

// /guided (and the Guide reply action, which runs it) steers a novel's next passage with the novel's
// instruction, never the Roleplay one that forbids writing {{user}}.
for (const line of ["/guided a storm hits", "/guided respond for Mira a storm hits"]) {
  const generated: unknown[] = [];
  const guided = matchSlashCommand(line, { mode: "roleplay", novel: true })!;
  await guided.command.execute(guided.args, {
    chatId: "c1",
    mode: "roleplay",
    novel: true,
    characters: [{ id: "mira", name: "Mira" }],
    generate: async (params) => void generated.push(params),
  } as SlashCommandContext);
  assert.deepEqual(
    (generated as Array<{ generationGuide?: string; generationGuideSource?: string }>).map((params) => [
      params.generationGuide,
      params.generationGuideSource,
    ]),
    [[buildNovelGuideInstructionMessage("a storm hits"), "guide"]],
    line,
  );
}

// A group roleplay keeps its last tagged reply as an example; a novel, which asks for no tags, keeps none.
for (const keepLastAssistant of [true, false]) {
  const history = [
    { role: "assistant" as const, content: '<speaker="Ivo">"Hello."</speaker>' },
    { role: "assistant" as const, content: '<speaker="Lena">"Hi."</speaker>' },
  ];
  stripSpeakerTagsExceptLastAssistant(history, keepLastAssistant);
  assert.equal(history[0]!.content, '"Hello."');
  assert.equal(history[1]!.content, keepLastAssistant ? '<speaker="Lena">"Hi."</speaker>' : '"Hi."');
}

// The message bar's novel rules live in one place: a novel's bar only steers the next passage.
{
  const novelBar = getMessageBarRules(true);
  const chatBar = getMessageBarRules(false);
  assert.equal(getMessageBarRules(true), novelBar, "the same rules object, safe in hook dependencies");
  assert.deepEqual(
    [
      novelBar.steersOnly,
      novelBar.attachments,
      novelBar.postOnly,
      novelBar.guideReply,
      novelBar.impersonate,
      novelBar.spatialMoves,
    ],
    [true, false, false, false, false, false],
  );
  assert.deepEqual(
    [
      chatBar.steersOnly,
      chatBar.attachments,
      chatBar.postOnly,
      chatBar.guideReply,
      chatBar.impersonate,
      chatBar.spatialMoves,
    ],
    [false, true, true, true, true, true],
  );
  assert.equal(novelBar.guideInstruction("rain"), buildNovelGuideInstructionMessage("rain"));
  assert.notEqual(chatBar.guideInstruction("rain"), buildNovelGuideInstructionMessage("rain"));
}

// /help in a novel lists only the commands a novel can run.
for (const novel of [true, false]) {
  const help = matchSlashCommand("/help", { mode: "roleplay", novel })!;
  const { feedback } = await help.command.execute(help.args, {
    chatId: "c1",
    mode: "roleplay",
    novel,
  } as SlashCommandContext);
  assert.equal(String(feedback).includes("/impersonate"), !novel, `help in a ${novel ? "novel" : "roleplay"}`);
}

// A CYOA choice in a novel steers the next passage as guidance, never as a message or impersonation.
assert.equal(resolveCyoaChoiceAction({ addToMessage: false, impersonate: true, novel: true }), "send");
assert.equal(resolveCyoaChoiceAction({ addToMessage: true, impersonate: true, novel: true }), "add");
assert.equal(resolveCyoaChoiceAction({ addToMessage: false, impersonate: true }), "impersonate");
assert.deepEqual(buildCyoaChoiceSubmissionPayload({ chatId: "c1", text: "Open the door", novel: true }), {
  chatId: "c1",
  connectionId: null,
  generationGuide: buildNovelGuideInstructionMessage("Open the door"),
  generationGuideSource: "guide",
});
assert.equal(buildCyoaChoiceSubmissionPayload({ chatId: "c1", text: "Open the door" }).userMessage, "Open the door");

// A novel has one author voice for every character: its group is always Merged, whatever is stored.
assert.equal(resolveGroupGenerationMode("roleplay", "individual", { roleplayDisplayStyle: "novel" }), "merged");
assert.equal(resolveGroupGenerationMode("roleplay", "individual", { roleplayDisplayStyle: "classic" }), "individual");
assert.equal(resolveGroupGenerationMode("roleplay", "individual"), "individual");
// Peek Prompt and its summary readers read the group as generation does, never the stored mode alone, so
// the preview of a novel matches the passage it previews. (A source check: the route needs a whole chat.)
assert.doesNotMatch(
  readFileSync(new URL("../../packages/server/src/routes/chats.routes.ts", import.meta.url), "utf8"),
  /normalizeGroupChatMode\(chatMeta\.groupChatMode\)/,
);
// A novel is plain prose: a stored speaker-colors option from before it became a novel adds no <speaker> tags.
assert.equal(
  resolveGroupSpeakerColors("roleplay", true, { roleplayDisplayStyle: "novel", groupSpeakerColors: true }),
  false,
);
assert.equal(
  resolveGroupSpeakerColors("roleplay", true, { roleplayDisplayStyle: "classic", groupSpeakerColors: true }),
  true,
);
assert.equal(resolveGroupSpeakerColors("roleplay", true, {}), false);
assert.equal(resolveGroupSpeakerColors("conversation", true, {}), true);
assert.equal(resolveGroupSpeakerColors("conversation", false, {}), false);

console.log("novel mode regression passed");
