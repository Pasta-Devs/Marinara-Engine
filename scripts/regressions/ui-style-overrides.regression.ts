import assert from "node:assert/strict";
import {
  hexAlpha,
  hexToHsv,
  hsvToHex,
  normalizeHexColor,
  withAlpha,
} from "../../packages/client/src/lib/css-colors.js";
import { sanitizeAppCss } from "../../packages/client/src/lib/theme-css.js";
import {
  buildUiStyleOverridesCss,
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
assert.ok(blockCss.includes(":root .mari-editor-panel{background:#123!important}"), blockCss);
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

console.info("UI style override regressions passed.");
