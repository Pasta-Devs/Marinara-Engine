// The Game surface: a reroll resets the narration when the active swipe changes, and the GM's SFX loop count reaches
// the audio manager, and generated game audio has a time limit. Also Journal edits, the Session window's layout, a
// closed story ending staying closed, and the minimap's accent colour.
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

// #4120: a generated game audio request has a time limit, so it can't leave the scene waiting.
{
  assert.match(
    gameSurfaceSource,
    /withTimeout\(\s*\(signal\) =>\s*api\.post<\{ tag: string; path: string \}>\(\s*"\/tts\/game-audio"[\s\S]{0,400}GAME_AUDIO_GENERATION_TIMEOUT_MS/u,
    "Generated game audio must not leave scene preparation waiting indefinitely",
  );
}

// #4940-#4942: the minimap's zoom controls take the chosen accent colour.
{
  const gameMapSource = readFileSync(
    new URL("../../../packages/client/src/components/game/GameMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    gameMapSource,
    /GAME_MAP_ACTION_ITEM_CLASS\s*=\s*\n\s*"text-\[var\(--primary\)\]/u,
    "Minimap zoom controls must inherit the selected accent color",
  );
}
