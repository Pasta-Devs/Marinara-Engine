// Exercise Game's actual event callbacks with React's state commits held back, rather than mounting the surface.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { SpritePlacement } from "../../packages/shared/src/types/chat.ts";
import {
  loadLocalSpriteVisualSettings,
  saveLocalSpriteVisualSettings,
  normalizeSpriteCharacterVisualSettingsMap,
  type LocalSpriteVisualSettings,
} from "../../packages/client/src/components/chat/local-sprite-visual-settings.ts";
import { normalizeSpritePlacements } from "../../packages/client/src/components/chat/sprite-placement.ts";

const source = ts.createSourceFile(
  "GameSurface.tsx",
  readFileSync(new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function callback(name: string) {
  let found: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `${name} remains available to exercise`);
  return `const ${found.getText(source)};`;
}
const code = ts.transpileModule([callback("changeAvatarPlacement"), callback("changeAvatarScale")].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
type Update = LocalSpriteVisualSettings | ((previous: LocalSpriteVisualSettings) => LocalSpriteVisualSettings);
type Callbacks = {
  changeAvatarPlacement(key: string, placement: SpritePlacement): void;
  changeAvatarScale(ownerId: string, scale: number): void;
};
const data = new Map<string, string>();
let phase = "event";
let rejectWrites = false;
const writes: string[] = [];
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem(key: string, value: string) {
        writes.push(phase);
        if (rejectWrites) throw new Error("quota exceeded");
        data.set(key, value);
      },
    },
  },
});
function harness(chatId: string, refChatId = chatId) {
  const initial = loadLocalSpriteVisualSettings(chatId);
  const chatMeta = {
    spritePlacements: { "legacy:avatar": { x: 22, y: 80 } },
    spriteCharacterVisualSettings: { a: { expressionSpriteScale: 0.8 }, legacy: { fullBodySpriteOpacity: 0.4 } },
  };
  let state = initial;
  const queued: Update[] = [];
  const activeChatIdRef = { current: chatId };
  const scope = {
    activeChatId: chatId,
    activeChatIdRef,
    avatarVisualSettingsRef: { current: { chatId: refChatId, settings: loadLocalSpriteVisualSettings(refChatId) } },
    avatarPlacements: normalizeSpritePlacements(initial.spritePlacements ?? chatMeta.spritePlacements),
    avatarCharacterSettings: normalizeSpriteCharacterVisualSettingsMap(
      initial.characterOverrides ?? chatMeta.spriteCharacterVisualSettings,
    ),
    chatMeta,
    loadLocalSpriteVisualSettings,
    saveLocalSpriteVisualSettings,
    normalizeSpritePlacements,
    normalizeSpriteCharacterVisualSettingsMap,
    useCallback: (fn: unknown) => fn,
    setAvatarVisualSettings: (update: Update) => queued.push(update),
  };
  const edits = new Function(...Object.keys(scope), `${code}\nreturn { changeAvatarPlacement, changeAvatarScale };`)(
    ...Object.values(scope),
  ) as Callbacks;
  return {
    edits,
    activeChatIdRef,
    flush() {
      phase = "updater";
      for (const update of queued.splice(0)) state = typeof update === "function" ? update(state) : update;
      phase = "event";
      return state;
    },
  };
}
try {
  const game = harness("game-a");
  game.edits.changeAvatarPlacement("a:avatar", { x: 35, y: 75 });
  game.edits.changeAvatarPlacement("b:avatar", { x: 65, y: 85 });
  game.edits.changeAvatarScale("a", 0.7);
  game.edits.changeAvatarScale("b", 1.2);
  const saved = game.flush();
  assert.deepEqual(
    saved.spritePlacements,
    {
      "legacy:avatar": { x: 22, y: 80 },
      "a:avatar": { x: 35, y: 75 },
      "b:avatar": { x: 65, y: 85 },
    },
    "both owner moves survive a batched commit and retain metadata placements",
  );
  assert.deepEqual(
    saved.characterOverrides,
    {
      a: { expressionSpriteScale: 0.8, fullBodySpriteScale: 0.7 },
      legacy: { fullBodySpriteOpacity: 0.4 },
      b: { fullBodySpriteScale: 1.2 },
    },
    "both sizes survive and preserve other per-owner fields",
  );
  assert.deepEqual(loadLocalSpriteVisualSettings("game-a"), saved, "the complete result is persisted");
  assert.ok(writes.length > 0 && writes.every((entry) => entry === "event"), "no persistence runs in an updater");

  const writeCount = writes.length;
  game.activeChatIdRef.current = "game-b";
  game.edits.changeAvatarPlacement("stale:avatar", { x: 50, y: 80 });
  game.edits.changeAvatarScale("stale", 1.5);
  assert.equal(writes.length, writeCount, "callbacks from the previous chat cannot save after a switch");

  saveLocalSpriteVisualSettings("game-b", { spritePlacements: { "b:avatar": { x: 60, y: 90 } } });
  const switched = harness("game-b", "game-a");
  switched.edits.changeAvatarPlacement("new:avatar", { x: 40, y: 70 });
  assert.deepEqual(
    switched.flush().spritePlacements,
    {
      "b:avatar": { x: 60, y: 90 },
      "new:avatar": { x: 40, y: 70 },
    },
    "a new chat's callback before its reset effect reads that chat, never the old ref",
  );
  assert.deepEqual(loadLocalSpriteVisualSettings("game-a"), saved, "switching leaves the previous chat unchanged");

  rejectWrites = true;
  const unavailable = harness("storage-full");
  unavailable.edits.changeAvatarPlacement("a:avatar", { x: 30, y: 70 });
  unavailable.edits.changeAvatarPlacement("b:avatar", { x: 70, y: 90 });
  assert.deepEqual(
    unavailable.flush().spritePlacements,
    {
      "legacy:avatar": { x: 22, y: 80 },
      "a:avatar": { x: 30, y: 70 },
      "b:avatar": { x: 70, y: 90 },
    },
    "queued moves remain visible even when the preference cache cannot save",
  );
} finally {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
}
console.log("avatar placement regression passed");
