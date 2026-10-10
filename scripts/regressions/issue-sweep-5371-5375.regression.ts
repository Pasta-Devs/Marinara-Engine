import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const chatSetupWizardSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatSetupWizard.tsx", import.meta.url),
  "utf8",
);
const agentHeaderStart = chatSetupWizardSource.indexOf(
  'className="flex items-center justify-between bg-[var(--secondary)] px-3 py-1.5"',
);
assert.ok(agentHeaderStart >= 0, "The setup wizard must render an agent category header");
const agentHeaderSource = chatSetupWizardSource.slice(agentHeaderStart, agentHeaderStart + 220);
assert.doesNotMatch(
  agentHeaderSource,
  /\bsticky\b|\btop-0\b/u,
  "Agent category headers must scroll with their rows instead of covering agent text",
);
assert.doesNotMatch(agentHeaderSource, /backdrop-blur/u);

const professorMariHomeSource = readFileSync(
  new URL("../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
// Slice 82: the chat's parts live in components/chat/mari/; "nowhere" checks read all of them.
const mariChatDir = new URL("../../packages/client/src/components/chat/mari/", import.meta.url);
const mariChatPart = (name: string) => readFileSync(new URL(name, mariChatDir), "utf8");
const mariChatAll = [professorMariHomeSource, ...readdirSync(mariChatDir).map(mariChatPart)].join("\n");
const mariComposerSource = mariChatPart("MariComposer.tsx");
const mariTranscriptSource = mariChatPart("MariTranscript.tsx");
const mariWorkTimelineSource = mariChatPart("MariWorkTimeline.tsx");
const compactMariMessageSource = mariChatPart("CompactMariMessage.tsx");
const homeBrowserHubSource = readFileSync(
  new URL("../../packages/client/src/components/chat/HomeBrowserHub.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  homeBrowserHubSource,
  /<HomeProfessorMariChat/u,
  "The Home Professor tab must not mount a second Mari chat surface",
);
assert.match(
  homeBrowserHubSource,
  /tab === "professor"[\s\S]*?requestProfessorMariOpen\(\)/u,
  "The Home Professor tab must open the canonical omnibar Mari surface",
);
assert.match(
  professorMariHomeSource,
  /shouldShowProfessorMariConnectionHint\(\{/u,
  "Professor Mari's connection guidance must use the shared presentation contract",
);
assert.match(
  professorMariHomeSource,
  /setMessages\(\[\]\);\s*setLoadedMessagesChatId\(chat\.id\);/u,
  "Restarting Professor Mari must mark the new empty chat history as loaded",
);
assert.equal(
  mariChatAll.match(/showConnectionFirstHint &&/gu)?.length,
  1,
  "The mounted Professor Mari transcript must render one connection guidance note",
);
assert.doesNotMatch(mariChatAll, /mari-workspace-focusbar/u, "The omnibar must not mount a second Mari header");
assert.doesNotMatch(mariChatAll, /OmnibarIntro/u, "The empty omnibar must not mount the long first-open intro");
// Like other agents, the composer's Send button turns into Stop while Mari works, and it is the one Stop
// control: the header and the live work line no longer carry their own.
assert.match(
  mariComposerSource,
  /data-mode=\{workspaceTimelineActive \? "stop" : "send"\}[\s\S]{0,900}stopProfessorMariWorkspaceAgent/u,
  "The composer's Send button must turn into a labelled Stop while Mari works",
);
assert.doesNotMatch(mariChatAll, /mari-omnibar-header-stop|mari-live-work__stop/u, "Stop lives only in the composer");
assert.match(
  mariWorkTimelineSource,
  /className="mari-live-work__sprite"/u,
  "The running step must keep its animated mini Mari sprite",
);
assert.match(
  compactMariMessageSource,
  /<MariWorkTimeline[\s\S]*?items=\{traceItems\}[\s\S]*?active=\{false\}/u,
  "Completed workspace traces must remain visible, fully open, in Mari's message",
);
assert.match(
  mariComposerSource,
  /<form[\s\S]*?mari-workspace-question-dock[\s\S]*?mari-workspace-answer-strip[\s\S]*?mari-workspace-composer\b/u,
  "Mari's question and suggestions must stay together above the composer",
);
assert.doesNotMatch(
  mariChatAll,
  /mari-omnibar-trust-chrome/u,
  "Omnibar Mari must not render a separate trust toolbar above the composer",
);
assert.match(
  mariTranscriptSource,
  /mari-omnibar-empty-welcome[\s\S]*?chips=\{chipRowChips\}/u,
  "Empty omnibar Mari must show a styled welcome with starter actions",
);
assert.match(
  mariComposerSource,
  /className="mari-workspace-context-chip"/u,
  "One-shot context must appear as a compact composer chip",
);
assert.doesNotMatch(
  mariChatAll,
  /id: "details"|workspaceDestination === "details"/u,
  "Mari has no Details sidebar or destination: results and reviews live in the chat",
);
assert.match(
  professorMariHomeSource,
  /const reviewsByTurn = assignReviewsToTurns\(\s*displayMessages,\s*\[\s*\.\.\.visiblePendingChangeReviews\.map/u,
  "Every visible pending review must be placed in the transcript",
);
assert.match(
  professorMariHomeSource,
  /reviews=\{renderTurnReviews\(message\.id\)\}/u,
  "A pending review must render inside the turn that asked for it",
);
// M5a (slice 36): a turn's reviews split into its outcome group - "what changed" and "needs your OK".
assert.match(
  professorMariHomeSource,
  /const entries = \(reviewsByTurn\.byMessageId\.get\(messageId\) \?\? \[\]\)\.filter\([\s\S]*?needsOk: \[[\s\S]*?waiting\.filter\([\s\S]*?\.map\(renderTurnPrompt\)/u,
  "A turn's assigned reviews must reach its renderer",
);
assert.match(
  compactMariMessageSource,
  /<MariOutcomeGroup\s+changed=\{reviews\?\.changed \?\? \[\]\}[\s\S]*?needsOk=\{reviews\?\.needsOk \?\? \[\]\}/u,
  "A Mari turn must render the reviews assigned to it",
);
assert.match(
  mariTranscriptSource,
  /mari-transcript-stack[\s\S]*?\{reviewsByTurn\.unassigned\.length > 0 \|\| \(heldCardNode && !lastAssistantId\) \? \(\s*<div className="space-y-3">[\s\S]*?\{reviewsByTurn\.unassigned\.map\(renderTurnPrompt\)\}\s*<\/div>/u,
  "A pending review without a reply turn must still render inline in the transcript, before the composer",
);
assert.match(
  professorMariHomeSource,
  /<MariTranscript\b[\s\S]*?<MariComposer\b/u,
  "the transcript renders before the composer",
);
assert.match(
  mariComposerSource,
  /<form[\s\S]*?mari-workspace-answer-strip[\s\S]*?mari-workspace-composer\b/u,
  "Suggestion answers must stay in the composer dock instead of inside transcript turns",
);

const presentation = await import("../../packages/client/src/lib/professor-mari-presentation.js");
const presentationDefaults = {
  hasRecovery: false,
  hasWorkspaceError: false,
  pendingReviewCount: 0,
  working: false,
  hasDraft: false,
  attachmentCount: 0,
  hasActionResult: false,
  messageCount: 0,
};
assert.equal(presentation.resolveProfessorMariPresentationState(presentationDefaults), "empty");
assert.equal(presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, working: true }), "working");
assert.equal(
  presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, hasDraft: true }),
  "composing",
);
assert.equal(
  presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, messageCount: 1 }),
  "history",
);
assert.equal(
  presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, hasActionResult: true }),
  "completed",
);
assert.equal(
  presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, pendingReviewCount: 1 }),
  "waiting-approval",
);
assert.equal(
  presentation.resolveProfessorMariPresentationState({
    ...presentationDefaults,
    hasRecovery: true,
    pendingReviewCount: 1,
  }),
  "broken",
  "Recovery and workspace errors must win over every lower-priority presentation state",
);
// R14: a new run or a retry answers the failure, so a stale error never reads as "broken" while she works.
assert.notEqual(
  presentation.resolveProfessorMariPresentationState({ ...presentationDefaults, hasRecovery: true, working: true }),
  "broken",
);
assert.equal(
  presentation.shouldShowProfessorMariConnectionHint({
    chatId: "chat-1",
    loadedMessagesChatId: "chat-1",
    sending: false,
    effectiveConnectionId: "connection-1",
  }),
  false,
  "Connected empty chats must not show connection guidance",
);
assert.equal(
  presentation.shouldShowProfessorMariConnectionHint({
    chatId: "chat-1",
    loadedMessagesChatId: "chat-1",
    sending: false,
    effectiveConnectionId: null,
  }),
  true,
  "Disconnected loaded chats must show connection guidance",
);
assert.equal(
  presentation.shouldOfferProfessorMariStarterSuggestions({
    chatId: "chat-1",
    loadedMessagesChatId: "chat-1",
    messageCount: 1,
    busy: false,
  }),
  false,
  "Starter suggestions must not return after a conversation has begun",
);
assert.equal(presentation.stripProfessorMariSpeakerPrefix("Professor Mari: Hello"), "Hello");
assert.equal(presentation.stripProfessorMariSpeakerPrefix("Mari: Hello"), "Hello");
assert.equal(presentation.stripProfessorMariSpeakerPrefix("Mari thinks this through."), "Mari thinks this through.");
assert.equal(
  presentation.professorMariContextCount(1, {
    source: "character-card",
    capability: "edit",
    resource: { kind: "character", id: "character-1", label: "Jenni" },
  }),
  2,
  "Persistent character focus contributes to the Context badge",
);
assert.equal(
  presentation.professorMariContextCount(1, {
    source: "omnibar",
    capability: "navigate",
    settingsLocation: { tab: "settings" },
  }),
  1,
  "One-shot page context must remain a composer chip instead of inflating the persistent Context badge",
);

const englishLocale = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
) as Record<string, string>;
assert.equal(
  englishLocale["ui.chat.homeprofessormarichat.selectAConnectionFirst"],
  "Select a connection first. Use the link icon in the message box below.",
);

const chatsHookSource = readFileSync(new URL("../../packages/client/src/hooks/use-chats.ts", import.meta.url), "utf8");
assert.match(
  chatsHookSource,
  /copyLocalSpriteVisualSettings\(chatId, newChat\.id\)/u,
  "Creating a branch must copy the source chat's local sprite setup",
);

const spriteStorage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => spriteStorage.get(key) ?? null,
      setItem: (key: string, value: string) => spriteStorage.set(key, value),
    },
  },
});

try {
  const spriteSettingsModule =
    await import("../../packages/client/src/components/chat/local-sprite-visual-settings.js");
  const copyLocalSpriteVisualSettings = Reflect.get(spriteSettingsModule, "copyLocalSpriteVisualSettings") as unknown;
  assert.ok(
    typeof copyLocalSpriteVisualSettings === "function",
    "The local sprite settings helper must expose branch copying",
  );

  spriteSettingsModule.saveLocalSpriteVisualSettings("source-chat", {
    spritePosition: "left",
    spritePlacements: { "character-1": { x: 24, y: 92 } },
    expressionSpriteScale: 1.25,
    expressionAvatarsEnabled: false,
  });
  copyLocalSpriteVisualSettings("source-chat", "branch-chat");

  assert.deepEqual(
    spriteSettingsModule.loadLocalSpriteVisualSettings("branch-chat"),
    spriteSettingsModule.loadLocalSpriteVisualSettings("source-chat"),
    "A branch must inherit the source chat's local sprite position, placement, scale, and avatar settings",
  );
} finally {
  Reflect.deleteProperty(globalThis, "window");
}

console.info("Issue sweep #5371-#5375 regression passed");

// Mari's work reads in the order it happened: her words, her thinking and her steps, with
// back-to-back steps in one list and internal status lines left out.
{
  const { buildWorkTimelineBlocks } = await import("../../packages/client/src/lib/mari-work-timeline.js");
  const blocks = buildWorkTimelineBlocks<string>([
    { id: "t1", type: "text", content: "Professor Mari: I'll read her card first." },
    { id: "s1", type: "status", content: "Pacing requests to stay under this connection's rate limit" },
    { id: "a", type: "tool", tool: "read" },
    { id: "b", type: "tool", tool: "search" },
    { id: "k1", type: "thinking", content: "The greeting contradicts her backstory." },
    { id: "t2", type: "text", content: "   " },
    { id: "c", type: "tool", tool: "patch" },
    { id: "t3", type: "text", content: "Done." },
  ]);
  assert.deepEqual(
    blocks.map((block) =>
      block.kind === "steps" ? `steps:${block.steps.map((step) => step.tool).join("+")}` : block.kind,
    ),
    ["text", "steps:read+search", "thinking", "steps:patch", "text"],
  );
  assert.equal(blocks[0].kind === "text" && blocks[0].content, "I'll read her card first.");
  // A timed thought says how long it took (never 0s); an untimed one from an older saved run has no time.
  const thoughts = buildWorkTimelineBlocks<string>([
    { id: "k1", type: "thinking", content: "Hmm.", startedAt: 1_000, updatedAt: 5_400 },
    { id: "t1", type: "text", content: "Ok." },
    { id: "k2", type: "thinking", content: "Quick.", startedAt: 9_000, updatedAt: 9_100 },
    { id: "t2", type: "text", content: "Ok." },
    { id: "k3", type: "thinking", content: "Old run." },
  ]);
  assert.deepEqual(
    thoughts.flatMap((block) => (block.kind === "thinking" ? [block.seconds] : [])),
    [4, 1, null],
  );
}
