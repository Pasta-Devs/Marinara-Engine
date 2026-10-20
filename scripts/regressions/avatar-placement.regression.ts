// Exercise ChatArea's actual layout callbacks with React's state commits held back, rather than mounting the chat.
// Roleplay, Visual Novel and Game avatars and Chat Settings' Avatars drawer all save through them (maintainer
// decision, 2026-10-19: avatars are arranged, sized and framed from the drawer, not from buttons on the stage).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { SpritePlacement } from "../../packages/shared/src/types/chat.ts";
import type { AvatarFraming } from "../../packages/client/src/features/avatars/contract.ts";
import {
  loadLocalSpriteVisualSettings,
  saveLocalSpriteVisualSettings,
  normalizeSpriteCharacterVisualSettingsMap,
  type LocalSpriteVisualSettings,
} from "../../packages/client/src/components/chat/local-sprite-visual-settings.ts";
import { normalizeSpritePlacements } from "../../packages/client/src/components/chat/sprite-placement.ts";

const source = ts.createSourceFile(
  "ChatArea.tsx",
  readFileSync(new URL("../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url), "utf8"),
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
const names = [
  "patchLocalSpriteVisualSettings",
  "handleSpritePlacementChange",
  "handleAvatarScaleChange",
  "handleAvatarFramingChange",
  "handleResetAvatarPlacements",
] as const;
const code = ts.transpileModule(names.map(callback).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
type Update = LocalSpriteVisualSettings | ((previous: LocalSpriteVisualSettings) => LocalSpriteVisualSettings);
type Callbacks = {
  handleSpritePlacementChange(key: string, placement: SpritePlacement): void;
  handleAvatarScaleChange(ownerId: string, scale: number): void;
  handleAvatarFramingChange(ownerId: string, framing: AvatarFraming): void;
  handleResetAvatarPlacements(): void;
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
    spritePlacements: { "legacy:avatar": { x: 22, y: 80 }, legacy: { x: 30, y: 90 } },
    spriteCharacterVisualSettings: { a: { expressionSpriteScale: 0.8 }, legacy: { fullBodySpriteOpacity: 0.4 } },
  };
  let state = initial;
  const queued: Update[] = [];
  const active = { chatId };
  const scope = {
    chat: { id: chatId },
    chatMeta,
    useChatStore: { getState: () => ({ activeChatId: active.chatId }) },
    localSpriteVisualSettingsRef: {
      current: { chatId: refChatId, settings: loadLocalSpriteVisualSettings(refChatId) },
    },
    // ChatArea starts it from the shown placements: this device's, or the chat's saved ones.
    pendingSpritePlacements: {
      current: normalizeSpritePlacements(
        Object.prototype.hasOwnProperty.call(initial, "spritePlacements")
          ? initial.spritePlacements
          : chatMeta.spritePlacements,
      ),
    },
    loadLocalSpriteVisualSettings,
    saveLocalSpriteVisualSettings,
    normalizeSpriteCharacterVisualSettingsMap,
    useCallback: (fn: unknown) => fn,
    setLocalSpriteVisualSettings: (update: Update) => queued.push(update),
  };
  const edits = new Function(...Object.keys(scope), `${code}\nreturn { ${names.slice(1).join(", ")} };`)(
    ...Object.values(scope),
  ) as Callbacks;
  return {
    edits,
    active,
    flush() {
      phase = "updater";
      for (const update of queued.splice(0)) state = typeof update === "function" ? update(state) : update;
      phase = "event";
      return state;
    },
  };
}
try {
  const chat = harness("chat-a");
  chat.edits.handleSpritePlacementChange("a:avatar", { x: 35, y: 75 });
  chat.edits.handleSpritePlacementChange("b:avatar", { x: 65, y: 85 });
  chat.edits.handleAvatarScaleChange("a", 0.7);
  chat.edits.handleAvatarScaleChange("b", 1.2);
  chat.edits.handleAvatarFramingChange("a", "full-body");
  chat.edits.handleAvatarFramingChange("b", "half-body");
  const saved = chat.flush();
  assert.deepEqual(
    saved.spritePlacements,
    {
      "legacy:avatar": { x: 22, y: 80 },
      legacy: { x: 30, y: 90 },
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
  assert.deepEqual(saved.avatarFramings, { a: "full-body", b: "half-body" }, "both framings survive");
  assert.deepEqual(loadLocalSpriteVisualSettings("chat-a"), saved, "the complete result is persisted");
  assert.ok(writes.length > 0 && writes.every((entry) => entry === "event"), "no persistence runs in an updater");

  // Reset clears the avatars' positions only; the sprites keep theirs.
  chat.edits.handleResetAvatarPlacements();
  assert.deepEqual(
    chat.flush().spritePlacements,
    { legacy: { x: 30, y: 90 } },
    "Reset clears every avatar position and keeps the sprites'",
  );
  assert.deepEqual(loadLocalSpriteVisualSettings("chat-a").characterOverrides, saved.characterOverrides);
  assert.deepEqual(loadLocalSpriteVisualSettings("chat-a").avatarFramings, saved.avatarFramings, "framing stays");

  const writeCount = writes.length;
  chat.active.chatId = "chat-b";
  chat.edits.handleSpritePlacementChange("stale:avatar", { x: 50, y: 80 });
  chat.edits.handleAvatarScaleChange("stale", 1.5);
  chat.edits.handleAvatarFramingChange("stale", "full-body");
  chat.edits.handleResetAvatarPlacements();
  assert.equal(writes.length, writeCount, "callbacks from the previous chat cannot save after a switch");

  saveLocalSpriteVisualSettings("chat-b", { spritePlacements: { "b:avatar": { x: 60, y: 90 } } });
  const switched = harness("chat-b", "chat-a");
  switched.edits.handleAvatarFramingChange("new", "half-body");
  switched.edits.handleSpritePlacementChange("new:avatar", { x: 40, y: 70 });
  const switchedState = switched.flush();
  assert.deepEqual(
    switchedState.spritePlacements,
    {
      "b:avatar": { x: 60, y: 90 },
      "new:avatar": { x: 40, y: 70 },
    },
    "a new chat's callback before its reset effect reads that chat, never the old ref",
  );
  assert.deepEqual(switchedState.avatarFramings, { new: "half-body" }, "and starts from that chat's framings");
  assert.deepEqual(
    loadLocalSpriteVisualSettings("chat-a").spritePlacements,
    { legacy: { x: 30, y: 90 } },
    "switching leaves the previous chat unchanged",
  );

  saveLocalSpriteVisualSettings("odd", {
    avatarFramings: { a: "full-body", b: "sideways", " ": "portrait" } as Record<string, AvatarFraming>,
  });
  assert.deepEqual(
    loadLocalSpriteVisualSettings("odd").avatarFramings,
    { a: "full-body" },
    "an unknown framing or blank owner is dropped",
  );

  rejectWrites = true;
  const unavailable = harness("storage-full");
  unavailable.edits.handleSpritePlacementChange("a:avatar", { x: 30, y: 70 });
  unavailable.edits.handleSpritePlacementChange("b:avatar", { x: 70, y: 90 });
  unavailable.edits.handleAvatarFramingChange("a", "full-body");
  const unsaved = unavailable.flush();
  assert.deepEqual(
    unsaved.spritePlacements,
    {
      "legacy:avatar": { x: 22, y: 80 },
      legacy: { x: 30, y: 90 },
      "a:avatar": { x: 30, y: 70 },
      "b:avatar": { x: 70, y: 90 },
    },
    "queued moves remain visible even when the preference cache cannot save",
  );
  assert.deepEqual(unsaved.avatarFramings, { a: "full-body" }, "and so does the framing");
} finally {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
}
console.log("avatar placement regression passed");
