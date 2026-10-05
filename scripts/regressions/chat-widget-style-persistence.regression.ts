import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.js";
import { getChatWidgetFontFamily, normalizeChatWidgetFont } from "../../packages/client/src/lib/font-family.js";

const stored = new Map<string, string>([
  [
    UI_PERSISTENCE.name,
    JSON.stringify({
      state: {
        chatWidgetPreset: "unknown",
        chatWidgetFont: "custom:Bad\nFont",
        chatWidgetShape: {},
        chatWidgetBorderColor: 42,
        chatWidgetBackgroundColor: { color: "red" },
        chatWidgetTextColor: false,
      },
      version: UI_PERSISTENCE.version,
    }),
  ],
]);
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});

try {
  const {
    useUIStore,
    pickPersistedUIState,
    pickSyncedSettings,
    normalizeChatWidgetPreset,
    normalizeChatWidgetShape,
    normalizeChatWidgetColor,
  } = await import("../../packages/client/src/stores/ui.store.js");
  const selection = () => {
    const {
      chatWidgetPreset,
      chatWidgetFont,
      chatWidgetShape,
      chatWidgetBorderColor,
      chatWidgetBackgroundColor,
      chatWidgetTextColor,
    } = useUIStore.getState();
    return {
      chatWidgetPreset,
      chatWidgetFont,
      chatWidgetShape,
      chatWidgetBorderColor,
      chatWidgetBackgroundColor,
      chatWidgetTextColor,
    };
  };
  const defaults = {
    chatWidgetPreset: "default",
    chatWidgetFont: "",
    chatWidgetShape: "preset",
    chatWidgetBorderColor: "",
    chatWidgetBackgroundColor: "",
    chatWidgetTextColor: "",
  };
  assert.deepEqual(
    selection(),
    defaults,
    "even current-version invalid browser preferences restore unchanged defaults",
  );
  assert.equal(normalizeChatWidgetPreset(null), "default");
  assert.equal(normalizeChatWidgetShape("triangle"), "preset");
  for (const invalidColor of [null, undefined, false, 42, {}, ["red"]]) {
    assert.equal(normalizeChatWidgetColor(invalidColor), "");
  }
  assert.equal(normalizeChatWidgetColor("  "), "");
  assert.equal(normalizeChatWidgetFont("Arial"), "", "custom families need an explicit custom prefix");
  assert.equal(normalizeChatWidgetFont("custom:''"), "");
  assert.equal(normalizeChatWidgetFont({ family: "Arial" }), "");
  assert.equal(getChatWidgetFontFamily(""), null, "Default adds no font override");
  assert.equal(getChatWidgetFontFamily("@app"), "var(--font-user, var(--font-sans))");
  assert.match(getChatWidgetFontFamily("@sans")!, /ui-sans-serif/u);
  assert.match(getChatWidgetFontFamily("@serif")!, /ui-serif/u);
  assert.match(getChatWidgetFontFamily("@mono")!, /ui-monospace/u);
  assert.equal(getChatWidgetFontFamily('custom: "Times New Roman" '), '"Times New Roman"');
  assert.equal(
    getChatWidgetFontFamily(String.raw`custom:Family"; color: red; \ Name`),
    String.raw`"Family\"; color: red; \\ Name"`,
    "quotes, backslashes and CSS punctuation remain inside one family name",
  );

  useUIStore.getState().setChatWidgetPreset("dottore");
  useUIStore.getState().setChatWidgetFont("custom: Times New Roman ");
  useUIStore.getState().setChatWidgetShape("square");
  useUIStore.getState().setChatWidgetBorderColor(" #123456 ");
  useUIStore.getState().setChatWidgetBackgroundColor(" linear-gradient(135deg, #112233, #445566) ");
  useUIStore.getState().setChatWidgetTextColor(" #ABCDEF ");
  const selected = {
    chatWidgetPreset: "dottore",
    chatWidgetFont: "custom:Times New Roman",
    chatWidgetShape: "square",
    chatWidgetBorderColor: "#123456",
    chatWidgetBackgroundColor: "linear-gradient(135deg, #112233, #445566)",
    chatWidgetTextColor: "#ABCDEF",
  };
  assert.deepEqual(selection(), selected);
  for (const pick of [pickPersistedUIState, pickSyncedSettings]) {
    const saved = pick(useUIStore.getState());
    for (const [key, value] of Object.entries(selected)) assert.equal(saved[key as keyof typeof saved], value);
  }
  await wait(1100);
  const saved = stored.get(UI_PERSISTENCE.name)!;
  for (const [key, value] of Object.entries(selected)) assert.equal(JSON.parse(saved).state[key], value);

  useUIStore.getState().setChatWidgetPreset("mari");
  assert.deepEqual(
    selection(),
    { ...defaults, chatWidgetPreset: "mari" },
    "preset changes clear font, shape and color overrides",
  );
  stored.set(UI_PERSISTENCE.name, saved);
  await useUIStore.persist.rehydrate();
  assert.deepEqual(selection(), selected, "the selected preset and overrides survive hydration");
  useUIStore.getState().setChatWidgetPreset("default");
  assert.deepEqual(selection(), defaults, "choosing Default restores the original appearance");
  useUIStore.getState().setChatWidgetPreset("mari");
  useUIStore.getState().setChatWidgetFont("@mono");
  useUIStore.getState().setChatWidgetShape("arched");
  useUIStore.getState().setChatWidgetBorderColor("linear-gradient(90deg, red, blue)");
  useUIStore.getState().setChatWidgetBackgroundColor("#123456");
  useUIStore.getState().setChatWidgetTextColor("linear-gradient(90deg, cyan, white)");
  useUIStore.getState().resetAppearanceSettings();
  assert.deepEqual(selection(), defaults, "Reset Appearance clears the preset and its overrides for every caller");
  console.info("Chat widget style/color persistence and font quoting regression passed.");
} finally {
  // Let the existing debounced adapter finish before removing this test's storage.
  await wait(1100);
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}
