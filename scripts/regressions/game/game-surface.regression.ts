// The Game surface: a reroll resets the narration when the active swipe changes, and the GM's SFX loop count reaches
// the audio manager. Also Journal edits, the Session window's layout, and a closed story ending staying closed.
// Reads component source until a test can drive these; most need browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSurfaceSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const gameNarrationSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameNarration.tsx", import.meta.url),
  "utf8",
);
assert.match(
  gameNarrationSource,
  /const narrationKey = latestAssistant \? `\$\{latestAssistant\.id\}:\$\{latestAssistant\.activeSwipeIndex \?\? 0\}` : null/u,
  "Game rerolls must reset narration when the saved swipe changes on the same message",
);
assert.match(gameSurfaceSource, /audioManager\.playSfx\(resolved, assetMap, fx\.sfxLoopCount\)/u);

const gameJournalSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameJournal.tsx", import.meta.url),
  "utf8",
);
assert.match(gameJournalSource, /\/game\/\$\{chatId\}\/journal\/entries\/\$\{editingEntry\.index\}/u);
assert.match(
  gameJournalSource,
  /<TimelineView\s+entries=\{visibleEntries\}\s+onEdit=\{beginEditingEntry\}/u,
  "Game Journal must keep edit controls connected after JSX formatting changes",
);
assert.match(
  gameSurfaceSource,
  /id=\{CHAT_CONTROL_WINDOW_IDS\.session\}[\s\S]{0,400}scroll=\{false\}[\s\S]{0,200}\{renderSessionPanel\(\)\}/u,
  "The Session window must leave scrolling to the Game Journal inside it",
);
assert.match(
  gameSurfaceSource,
  /const renderSessionPanel = \(\) => \{[\s\S]{0,300}<div className="flex min-h-0 flex-1 flex-col overflow-hidden">/u,
  "The Session panel must fill its window as a bounded flex column",
);
// A closed story ending (Capability API 1.343) stays closed when the game surface mounts again: the close
// is kept in this browser by game and ending, and read back before the ending is shown.
assert.match(gameSurfaceSource, /localStorage\.setItem\(`story-ending-closed:\$\{storyEndingKey\}`, "1"\)/u);
assert.match(gameSurfaceSource, /readIntroPresentedFlag\(`story-ending-closed:\$\{storyEndingKey\}`\)/u);
assert.match(gameSurfaceSource, /storyEndingKey !== storyEndingClosed &&\s*!storyEndingClosedBefore &&/u);
