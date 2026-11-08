import assert from "node:assert/strict";
import {
  gradientStopsFromColor,
  hexAlpha,
  hexToHsv,
  hsvToHex,
  normalizeHexColor,
  withAlpha,
} from "../../packages/client/src/lib/css-colors.js";
import { sanitizeAppCss } from "../../packages/client/src/lib/theme-css.js";
import {
  buildUiStyleOverridesCss,
  foldAppBackgroundColor,
  normalizeUiStyleOverride,
  normalizeUiStyleOverrides,
  normalizeUiStylePresets,
  resolveUiStyleChain,
  resolveUiStyleTarget,
  serializeUiStyleOverride,
  UI_STYLE_TARGETS,
  type UiStyleProbe,
} from "../../packages/client/src/lib/ui-style-overrides.js";

const css = buildUiStyleOverridesCss({ "top-bar": { background: "#123", borderRadius: 8, opacity: 90 } });
assert.equal(
  css,
  ':root [data-component="TopBar"]{background:#123!important;border-radius:8px!important;opacity:0.9!important}',
);
assert.equal(sanitizeAppCss(css), css, "generated CSS passes the theme sanitizer unchanged");

// Text color and size reach descendants that set their own; inner layers take the background; a border
// shows even where the region has none.
const chatCss = buildUiStyleOverridesCss({
  "roleplay-surface": { background: "#000", color: "#fff", borderColor: "red", fontSize: 18 },
});
assert.deepEqual(chatCss.split("\n"), [
  ':root [data-component="ChatArea.Roleplay"]{background:#000!important;color:#fff!important;border-color:red!important;font-size:18px!important}',
  ':root [data-component="ChatArea.Roleplay"] :is(.mari-chat-area, .rpg-overlay){background:#000!important}',
  ':where(:root [data-component="ChatArea.Roleplay"] *){color:inherit!important;font-size:inherit!important}',
  ':root [data-component="ChatArea.Roleplay"]:not(:focus-visible){outline:1px solid red!important;outline-offset:-1px!important}',
]);
assert.equal(sanitizeAppCss(chatCss), chatCss, "every rule shape passes the theme sanitizer unchanged");
assert.equal(
  new Set(UI_STYLE_TARGETS.map((target) => target.id)).size,
  UI_STYLE_TARGETS.length,
  "region ids are unique",
);
const everyCss = buildUiStyleOverridesCss(
  Object.fromEntries(
    UI_STYLE_TARGETS.map((target) => [target.id, { background: "#000", color: "#fff", borderColor: "red" }]),
  ),
);
assert.equal(everyCss.split("\n").length >= UI_STYLE_TARGETS.length * 3, true, "every region emits its rules");
assert.equal(sanitizeAppCss(everyCss), everyCss, "every region's selector passes the theme sanitizer unchanged");
assert.equal(buildUiStyleOverridesCss({}), "");
assert.equal(
  buildUiStyleOverridesCss({ bogus: { color: "red" } } as never),
  "",
  "unknown region ids never reach the stylesheet",
);

// Injection through a synced value is dropped; numbers are clamped; unknown keys are dropped.
const hostile = normalizeUiStyleOverride({ background: "red;} body{display:none", fontSize: 999, bogus: 1 });
assert.deepEqual(hostile, { fontSize: 32 });
assert.equal(normalizeUiStyleOverride({ color: "rgb(1,2,3" }), null, "unbalanced parentheses are rejected");
assert.equal(normalizeUiStyleOverride({ background: "url(https://example.invalid/x.png)" }), null);
assert.equal(normalizeUiStyleOverride({ opacity: 0 })?.opacity, 30, "opacity cannot hide the interface");
for (const value of ["red !important", "red\n:x", "rgb(0 0 0 / .5);", `#${"a".repeat(400)}`]) {
  assert.equal(normalizeUiStyleOverride({ color: value }), null, `rejects ${JSON.stringify(value).slice(0, 30)}`);
}
assert.equal(
  buildUiStyleOverridesCss({ "top-bar": { background: "red;}body{display:none" } } as never),
  "",
  "the CSS builder re-normalizes hostile values",
);
assert.deepEqual(normalizeUiStyleOverrides({ sidebar: {}, nope: { color: "red" }, modal: { color: "red" } }), {
  modal: { color: "red" },
});
assert.equal(
  serializeUiStyleOverride({ color: "red", opacity: 50 }),
  serializeUiStyleOverride({ opacity: 50, color: "red" }),
  "serialization ignores key order",
);

// Region resolution: the deepest matching ancestor wins; a stub chain stands in for the DOM.
function node(tokens: string[], parent: UiStyleProbe | null): UiStyleProbe {
  return {
    parentElement: parent,
    matches(selector) {
      const parts = selector.split(" ");
      const last = parts[parts.length - 1]!;
      const alternatives = last.startsWith(":is(") ? last.slice(4, -1).split(",") : [last];
      if (!alternatives.some((token) => tokens.includes(token))) return false;
      let cursor = parent;
      for (let i = parts.length - 2; i >= 0; i--) {
        while (cursor && !(cursor as unknown as { tokens: string[] }).tokens.includes(parts[i]!)) {
          cursor = cursor.parentElement;
        }
        if (!cursor) return false;
        cursor = cursor.parentElement;
      }
      return true;
    },
    getAttribute(name) {
      if (name !== "class") return null;
      return tokens
        .filter((token) => token.startsWith("."))
        .map((token) => token.slice(1))
        .join(" ");
    },
    ...({ tokens } as object),
  };
}
const row = node(['[data-message-role="user"]'], node(['[data-component="ChatArea.Roleplay"]'], null));
const bubble = node([".mari-message-bubble"], row);
const inner = node([".text"], bubble);
assert.equal(resolveUiStyleTarget(inner), "user-message");
const lineBody = node([".mari-message-line-body"], node(['[data-message-role="assistant"]'], null));
assert.equal(resolveUiStyleTarget(node([".text"], lineBody)), "assistant-message", "plain layout messages resolve too");
assert.equal(resolveUiStyleTarget(node([".x"], null)), null);

// Blocks: a pick offers its region, then up to two enclosing `mari-*` blocks, its own block last.
const shell = node([".mari-editor-shell", ".mari-editor-legacy-bridge"], null);
const contentInner = node([".mari-editor-content-inner"], shell);
const panel = node([".mari-editor-panel", ".p-3"], contentInner);
const field = node([".mari-editor-field", ".w-full"], panel);
assert.deepEqual(resolveUiStyleChain(field), ["editors", "class:mari-editor-panel", "class:mari-editor-field"]);
assert.equal(resolveUiStyleTarget(field), "class:mari-editor-field", "a click picks the innermost block");
assert.deepEqual(resolveUiStyleChain(node([".label"], panel)), [
  "editors",
  "class:mari-editor-content-inner",
  "class:mari-editor-panel",
]);
assert.deepEqual(
  resolveUiStyleChain(node([".mari-x--state", ".mari-Bad"], null)),
  [],
  "modifier/invalid classes are no block",
);
assert.deepEqual(resolveUiStyleChain(inner), ["user-message"], "a region with no inner block is unchanged");

// Block keys are the synced trust boundary too: only `class:mari-<lowercase-words>` survives.
const blockOverrides = normalizeUiStyleOverrides({
  "class:mari-editor-panel": { background: "#123", bogus: 1 },
  "class:mari-editor-field": { color: "red;}body{display:none" },
  "class:Mari-x": { color: "red" },
  "class:mari-x;}body{display:none": { color: "red" },
  "class:mari-x y": { color: "red" },
  "class:mari-": { color: "red" },
  "class:mari--x": { color: "red" },
  "class:other": { color: "red" },
  [`class:mari-${"a".repeat(70)}`]: { color: "red" },
  "mari-editor-panel": { color: "red" },
  sidebar: { color: "blue" },
});
assert.deepEqual(blockOverrides, { sidebar: { color: "blue" }, "class:mari-editor-panel": { background: "#123" } });
const blockCss = buildUiStyleOverridesCss(blockOverrides);
const outsideEditor = ":where(:not([data-ui-style-editor], [data-ui-style-editor] *))";
assert.ok(blockCss.includes(`:root .mari-editor-panel${outsideEditor}{background:#123!important}`), blockCss);
assert.ok(!blockCss.includes(`.mari-sidebar${outsideEditor}`), "regions outside the editor keep their plain selector");
{
  // The editor's own buttons and fields carry block classes too; the styles being edited must not repaint them.
  const css = buildUiStyleOverridesCss({ buttons: { color: "red" }, "text-fields": { color: "red" } });
  assert.equal(css.split("\n").filter((rule) => rule.includes(outsideEditor)).length, 4, css);
  assert.equal(sanitizeAppCss(css), css, "the editor guard passes the theme sanitizer unchanged");
}
assert.ok(blockCss.indexOf(".mari-sidebar") < blockCss.indexOf(".mari-editor-panel"), "blocks come after regions");
assert.equal(sanitizeAppCss(blockCss), blockCss, "block rules pass the app CSS sanitizer unchanged");
const manyBlocks = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`class:mari-b${i}`, { color: "red" }]));
assert.equal(Object.keys(normalizeUiStyleOverrides(manyBlocks)).length, 100, "block count is capped");
assert.deepEqual(
  normalizeUiStylePresets([{ id: "blk", name: "Blocks", overrides: { "class:mari-editor-panel": { opacity: 80 } } }])[0]
    ?.overrides,
  { "class:mari-editor-panel": { opacity: 80 } },
  "presets keep blocks",
);

// Presets: a synced library of whole-interface snapshots, so everything is re-validated on the way in.
const goodPreset = {
  id: "a_1-B",
  name: "  Night\u0007 mode ",
  overrides: { sidebar: { background: "#000", bogus: 1 }, nope: { background: "#fff" } },
};
assert.deepEqual(normalizeUiStylePresets([goodPreset]), [
  { id: "a_1-B", name: "Night mode", overrides: { sidebar: { background: "#000" } } },
]);
assert.deepEqual(normalizeUiStylePresets({ 0: goodPreset }), [], "non-arrays yield no presets");
assert.deepEqual(normalizeUiStylePresets("x"), []);
assert.deepEqual(
  normalizeUiStylePresets([
    { ...goodPreset, overrides: { sidebar: { background: "#000", color: "red;} body{display:none" } } },
  ])[0]?.overrides,
  { sidebar: { background: "#000" } },
  "hostile override values are dropped",
);
assert.deepEqual(
  normalizeUiStylePresets([
    { ...goodPreset, overrides: { sidebar: { background: "red;} body{display:none" } } },
    { ...goodPreset, id: "b", overrides: { nope: { background: "#fff" } } },
    { ...goodPreset, id: "c", overrides: [] },
  ]),
  [],
  "presets with nothing valid left are dropped",
);
assert.deepEqual(
  normalizeUiStylePresets([
    { ...goodPreset, name: "   " },
    { ...goodPreset, name: "\u0001" },
    { ...goodPreset, name: 5 },
  ]),
  [],
);
assert.equal(
  normalizeUiStylePresets([{ ...goodPreset, name: "n".repeat(100) }])[0]?.name.length,
  40,
  "names are capped at 40",
);
for (const id of ["", "a b", "a/b", "x".repeat(65), 7, null]) {
  assert.deepEqual(normalizeUiStylePresets([{ ...goodPreset, id }]), [], `rejects id ${JSON.stringify(id)}`);
}
assert.deepEqual(
  normalizeUiStylePresets([goodPreset, { ...goodPreset, name: "Other" }, null, "x"]).map((preset) => preset.name),
  ["Night mode"],
  "duplicate ids keep the first",
);
const many = Array.from({ length: 45 }, (_, index) => ({
  id: `p${index}`,
  name: `Preset ${index}`,
  overrides: { sidebar: { opacity: 80 } },
}));
assert.equal(normalizeUiStylePresets(many).length, 30, "at most 30 presets");

// The colour selector's square and hue strip: hex survives a round trip through hue/saturation/brightness.
for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#123456", "#ec4b97", "#808080", "#fe01ff"]) {
  assert.equal(hsvToHex(...hexToHsv(hex)), hex, `round trip ${hex}`);
}
assert.deepEqual(hexToHsv("#ff0000"), [0, 100, 100]);
assert.deepEqual(hexToHsv("#000000"), [0, 0, 0]);
assert.equal(hsvToHex(359, 100, 100), "#ff0004", "the end of the hue strip stays red");
assert.equal(hsvToHex(240, 0, 50), "#808080", "zero saturation is grey whatever the hue");

// The opacity strip: an alpha below 1 rides along as `#rrggbbaa`; fully opaque values stay `#rrggbb`.
assert.equal(normalizeHexColor("#ABC"), "#aabbcc");
assert.equal(normalizeHexColor("#abcf"), "#aabbcc", "opaque short alpha is dropped");
assert.equal(normalizeHexColor("#abc8"), "#aabbcc88");
assert.equal(normalizeHexColor("#112233FF"), "#112233");
assert.equal(normalizeHexColor("#11223380"), "#11223380");
assert.equal(normalizeHexColor("#1122"), "#11112222");
for (const bad of ["#12345", "#1234567", "red", "#ggg"]) assert.equal(normalizeHexColor(bad), null, bad);
assert.equal(withAlpha("#112233", 1), "#112233");
assert.equal(withAlpha("#112233", 0.5), "#11223380");
assert.equal(withAlpha("#112233", 0), "#11223300");
assert.equal(withAlpha("#112233", -1), "#11223300", "alpha is clamped");
assert.equal(hexAlpha("#112233"), 1);
assert.equal(withAlpha("#ff0000", hexAlpha("#11223366")), "#ff000066", "a palette pick keeps the current opacity");
assert.equal(
  sanitizeAppCss(buildUiStyleOverridesCss({ "top-bar": { background: "#11223380" } })),
  ':root [data-component="TopBar"]{background:#11223380!important}',
  "an 8-digit hex survives the override sanitizer",
);

// Border width, background blur and shadow presets. A width draws the real border (theme color when
// none is picked) instead of the inset outline; blur 0 is `none`, which never traps fixed descendants.
{
  const css = buildUiStyleOverridesCss({
    "top-bar": { borderWidth: 2, blur: 12, shadow: "soft" },
    sidebar: { borderColor: "red", borderWidth: 0, blur: 0 },
  });
  assert.equal(
    css.split("\n")[0],
    ':root [data-component="TopBar"]{border-width:2px!important;border-style:solid!important;border-color:var(--border)!important;box-shadow:0 1px 3px rgb(0 0 0 / 0.25)!important;-webkit-backdrop-filter:blur(12px)!important;backdrop-filter:blur(12px)!important}',
  );
  assert.ok(
    css.includes(
      "border-color:red!important;border-width:0px!important;border-style:solid!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important",
    ),
    css,
  );
  assert.ok(!css.includes("outline"), "a set border width replaces the inset outline");
  assert.equal(sanitizeAppCss(css), css, "the new properties pass the theme sanitizer unchanged");
}
assert.deepEqual(
  normalizeUiStyleOverride({ borderWidth: 99, blur: -5, shadow: "huge" }),
  { borderWidth: 8, blur: 0 },
  "numbers are clamped and unknown shadows dropped",
);
assert.equal(normalizeUiStyleOverride({ shadow: "toString" }), null, "inherited keys are not shadow presets");
assert.notEqual(serializeUiStyleOverride({ shadow: "soft" }), serializeUiStyleOverride({ shadow: "glow" }));

// The whole app paints through the variable the body, the shell and every paint layer read, so a
// gradient spans the app; inner regions still come later and win.
{
  const gradient = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)";
  const css = buildUiStyleOverridesCss({
    app: { background: gradient, color: "#eee" },
    center: { background: "#000" },
  });
  const lines = css.split("\n");
  assert.equal(lines[0], ':root [data-component="AppShell"]{color:#eee!important}', "no element background");
  assert.equal(lines[1], `:root{--marinara-app-background-paint:${gradient}!important}`);
  assert.ok(css.indexOf("CenterContent") > css.indexOf(gradient), "the center region's rules follow the app's");
  assert.equal(sanitizeAppCss(css), css, "the paint variable rule passes the theme sanitizer unchanged");
  assert.deepEqual(normalizeUiStyleOverrides({ app: { background: gradient } }), { app: { background: gradient } });
  assert.equal(
    buildUiStyleOverridesCss({ app: { background: gradient } }),
    `:root{--marinara-app-background-paint:${gradient}!important}`,
    "a background alone leaves no empty region rule",
  );
  assert.equal(resolveUiStyleTarget(node(['[data-component="AppShell"]'], null)), "app");
}

// The retired Background Color folds into the Whole app part (persist migrate and server sync both call this).
{
  const gradient = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)";
  const blocks = { "class:mari-chrome-control": { borderRadius: 4 } };
  assert.deepEqual(
    foldAppBackgroundColor(gradient, { app: { color: "#eee" }, ...blocks }),
    { uiStyleOverrides: { app: { color: "#eee", background: gradient }, ...blocks }, appBackgroundColor: "" },
    "a background joins the part's other properties, blocks stay, and the old field clears",
  );
  assert.deepEqual(
    foldAppBackgroundColor("url(wall.png)", { app: { background: "#000" } }),
    { uiStyleOverrides: { app: { background: "#000" } }, appBackgroundColor: "" },
    "a saved Whole app background wins",
  );
  assert.deepEqual(
    foldAppBackgroundColor("url(wall.png)", {}),
    { uiStyleOverrides: {}, appBackgroundColor: "url(wall.png)" },
    "a value the part cannot hold stays where it is",
  );
}

// Gradient mode starts from the current color: it, then a lighter shade (dark) or darker shade (light).
{
  assert.equal(gradientStopsFromColor(""), null, "no color: the picker falls back to its first preset");
  assert.equal(gradientStopsFromColor(null), null);
  const [darkStart, darkEnd] = gradientStopsFromColor("#1A1A2E") ?? [];
  assert.equal(darkStart, "#1a1a2e");
  assert.ok(hexToHsv(darkEnd!)[2] > hexToHsv(darkStart!)[2], "a dark color ends lighter");
  const [lightStart, lightEnd] = gradientStopsFromColor("#ffd93d") ?? [];
  assert.equal(lightStart, "#ffd93d");
  assert.ok(hexToHsv(lightEnd!)[2] < hexToHsv(lightStart!)[2], "a light color ends darker");
  assert.equal(hexAlpha(gradientStopsFromColor("#ffd93d80")![1]), hexAlpha("#ffd93d80"), "the shade keeps the opacity");
}

// The persist migrate (v104 -> v105) leaves a Background Color the part cannot hold, so App.tsx still paints it.
{
  const { UI_PERSISTENCE } = await import("../../packages/client/src/lib/ui-persistence.js");
  const stored = new Map([
    [UI_PERSISTENCE.name, JSON.stringify({ state: { appBackgroundColor: "url(wall.png)" }, version: 104 })],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
  });
  const { useUIStore } = await import("../../packages/client/src/stores/ui.store.js");
  assert.equal(useUIStore.getState().appBackgroundColor, "url(wall.png)", "the migrate keeps what it cannot fold");
  assert.equal(useUIStore.getState().uiStyleOverrides.app, undefined);

  // Nothing else clears that leftover now, so each way of resetting or replacing the Whole app part does.
  const legacy = { appBackgroundColor: "url(wall.png)" };
  const { saveUiStyleOverride, resetUiStyleOverrides, saveUiStylePreset, applyUiStylePreset } =
    useUIStore.getState();
  useUIStore.setState(legacy);
  saveUiStyleOverride("app", { color: "#eeeeee" });
  assert.equal(useUIStore.getState().appBackgroundColor, "url(wall.png)", "a Whole app edit without a background keeps it");
  saveUiStyleOverride("app", null);
  assert.equal(useUIStore.getState().appBackgroundColor, "", "resetting Whole app clears it");
  useUIStore.setState(legacy);
  saveUiStyleOverride("app", { background: "#101010" });
  assert.equal(useUIStore.getState().appBackgroundColor, "", "a Whole app background replaces it");
  useUIStore.setState(legacy);
  saveUiStyleOverride("sidebar", null);
  assert.equal(useUIStore.getState().appBackgroundColor, "url(wall.png)", "other parts leave it");
  resetUiStyleOverrides();
  assert.equal(useUIStore.getState().appBackgroundColor, "", "Reset all clears it");
  saveUiStyleOverride("sidebar", { color: "#eeeeee" });
  saveUiStylePreset("Plain");
  useUIStore.setState(legacy);
  applyUiStylePreset(useUIStore.getState().uiStylePresets[0]!.id);
  assert.equal(useUIStore.getState().appBackgroundColor, "", "Apply preset clears it");
}

console.info("UI style override regressions passed.");
