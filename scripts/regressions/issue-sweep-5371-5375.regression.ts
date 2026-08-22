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
assert.match(
  professorMariHomeSource,
  /const showConnectionFirstHint =\s*chatId !== null &&\s*loadedMessagesChatId === chatId &&\s*!sending &&\s*!messages\.some\(\(message\) => message\.role === "user"\);/u,
  "Professor Mari's connection guidance must wait for the active chat history and remain visible until the first user message",
);
assert.match(
  professorMariHomeSource,
  /setMessages\(\[\]\);\s*setLoadedMessagesChatId\(chat\.id\);/u,
  "Restarting Professor Mari must mark the new empty chat history as loaded",
);
assert.equal(
  professorMariHomeSource.match(/showConnectionFirstHint &&/gu)?.length,
  2,
  "Both Professor Mari transcript layouts must show the fresh-chat connection guidance",
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
