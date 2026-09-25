import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  professorMariHomeSource.match(/showConnectionFirstHint &&/gu)?.length,
  1,
  "The mounted Professor Mari transcript must render one connection guidance note",
);
assert.doesNotMatch(
  professorMariHomeSource,
  /mari-workspace-focusbar/u,
  "The omnibar must not mount a second Mari header",
);
assert.doesNotMatch(
  professorMariHomeSource,
  /OmnibarIntro/u,
  "The empty omnibar must not mount the long first-open intro",
);
// The header's icon-only Stop stays, and the card adds a labelled one next to
// the timer so Stop sits beside the work it stops (c26a00ea2).
assert.match(
  professorMariHomeSource,
  /className="mari-live-work__stop"[\s\S]{0,160}ui\.chat\.summarypopover\.stop/u,
  "The work card's Stop control carries a visible label",
);
assert.match(
  professorMariHomeSource,
  /className="mari-live-work__sprite"/u,
  "The live work card must keep its animated mini Mari scene",
);
assert.match(
  professorMariHomeSource,
  /<WorkspaceLiveWorkCard[\s\S]*?items=\{traceItems\}[\s\S]*?active=\{false\}/u,
  "Completed workspace traces must remain visible in the rich work card",
);
assert.match(
  professorMariHomeSource,
  /<form[\s\S]*?mari-workspace-question-dock[\s\S]*?mari-workspace-answer-strip[\s\S]*?mari-professor-composer/u,
  "Mari's question and suggestions must stay together above the composer",
);
assert.doesNotMatch(
  professorMariHomeSource,
  /mari-omnibar-trust-chrome/u,
  "Omnibar Mari must not render a separate trust toolbar above the composer",
);
assert.match(
  professorMariHomeSource,
  /mari-omnibar-empty-welcome[\s\S]*?chips=\{chipRowChips\}/u,
  "Empty omnibar Mari must show a styled welcome with starter actions",
);
assert.match(
  professorMariHomeSource,
  /className="mari-workspace-context-chip inline-flex/u,
  "One-shot context must appear as a compact composer chip",
);
assert.match(
  professorMariHomeSource,
  /id: "details"[\s\S]*?detailsDestination/u,
  "The Mari workspace must expose a desktop details destination",
);
assert.match(
  professorMariHomeSource,
  /workspaceDestination === "details"[\s\S]*?latestActionResults[\s\S]*?pendingApprovalsPanel/u,
  "The details destination must show results and pending reviews",
);
assert.equal(
  professorMariHomeSource.match(/className="mari-omnibar-header-stop"/gu)?.length,
  1,
  "The omnibar header must own the only active-work Stop control",
);
assert.match(
  professorMariHomeSource,
  /<\/div>\s*\{visiblePendingChangeReviews\.length > 0(?: && workspaceDestination === "chat")? \? \(\s*<div className="mari-workspace-review-dock[\s\S]*?<form/u,
  "Pending reviews must be pinned between the transcript scroller and composer",
);
assert.match(
  professorMariHomeSource,
  /<form[\s\S]*?mari-workspace-answer-strip[\s\S]*?mari-professor-composer/u,
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
    working: true,
  }),
  "broken",
  "Recovery and workspace errors must win over every lower-priority presentation state",
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
  "Select a connection first by clicking the chainlink icon in the input box below!",
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
