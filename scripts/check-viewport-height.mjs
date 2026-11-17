import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// `100dvh`/`100vh` stay full height on iOS while the on-screen keyboard covers the bottom.
// AppShell writes the visible height above the keyboard to --mari-visual-viewport-height.
const ROOT = fileURLToPath(new URL("../packages/client/src", import.meta.url));
const RAW_HEIGHT = /(?<!--mari-visual-viewport-height,\s*)\b100[dsl]?vh\b|\b(?:min-|max-)?h-(?:screen|[dsl]?vh)\b/g;

// ponytail: count ratchet for files that predate this check; lower or delete an entry
// when a file moves to the variable. Upgrade path: an ESLint/Stylelint rule with inline opt-outs.
const KNOWN = {
  "App.tsx": 1,
  "components/bot-browser/BotBrowserView.tsx": 1,
  "components/chat/ChatMessage.tsx": 1,
  "components/chat/ConversationPresenceCard.tsx": 1,
  "components/chat/HomeBrowserHub.tsx": 2,
  "components/chat/NewChatConnectionGate.tsx": 1,
  "components/chat/QuickConnectionSwitcher.tsx": 1,
  "components/chat/chat-settings-window.ts": 1,
  "components/chat/mari/MariComposer.tsx": 1,
  "components/game-assets/FileEditorModal.tsx": 4,
  "components/game-assets/ImagePreviewModal.tsx": 2,
  "components/game/GameCharacterSheet.tsx": 1,
  "components/game/GameInventory.tsx": 1,
  "components/game/GameNarration.tsx": 2,
  "components/game/GameReadableDisplay.tsx": 1,
  "components/game/GameSetupWizard.tsx": 1,
  "components/game/LegacyExperienceSetupDialog.tsx": 1,
  "components/game/TacticalCombatUI.tsx": 2,
  "components/layout/AppShell.tsx": 2,
  "components/layout/GlobalOmnibar.tsx": 1,
  "components/layout/TopBar.tsx": 1,
  "components/presets/PresetVariablesEditor.tsx": 4,
  "components/ui/MacroTextarea.tsx": 6,
  "components/ui/SpriteWandCleanupEditor.tsx": 1,
  "features/tracker-panel/components/character-card/CharacterThoughtBubbles.tsx": 1,
  "styles/globals.css": 3,
  "styles/mari.css": 6,
};

const counts = {};
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(tsx?|css)$/.test(entry.name)) {
      const found = readFileSync(path, "utf8").match(RAW_HEIGHT)?.length ?? 0;
      if (found) counts[relative(ROOT, path).split("\\").join("/")] = found;
    }
  }
};
walk(ROOT);

if (process.argv.includes("--print")) {
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

const failures = Object.entries(counts)
  .filter(([file, found]) => found > (KNOWN[file] ?? 0))
  .map(([file, found]) => `  packages/client/src/${file}: ${found} (allowed ${KNOWN[file] ?? 0})`);

if (failures.length) {
  console.error(
    [
      "New 100dvh/100vh/h-screen heights found. The on-screen keyboard covers them on iOS.",
      "Use var(--mari-visual-viewport-height, 100dvh) for anything that holds fields,",
      "or raise the count in scripts/check-viewport-height.mjs for a full-screen backdrop.",
      ...failures,
    ].join("\n"),
  );
  process.exit(1);
}
console.log("Viewport heights OK.");
