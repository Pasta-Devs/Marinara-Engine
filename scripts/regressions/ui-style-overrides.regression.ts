import assert from "node:assert/strict";
import { sanitizeAppCss } from "../../packages/client/src/lib/theme-css.js";
import {
  buildUiStyleOverridesCss,
  normalizeUiStyleOverride,
  normalizeUiStyleOverrides,
  resolveUiStyleTarget,
  serializeUiStyleOverride,
  UI_STYLE_TARGETS,
  type UiStyleProbe,
} from "../../packages/client/src/lib/ui-style-overrides.js";

const css = buildUiStyleOverridesCss({ "top-bar": { background: "#123", borderRadius: 8, opacity: 90 } });
assert.equal(css, ':root [data-component="TopBar"]{background:#123!important;border-radius:8px!important;opacity:0.9!important}');
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
assert.equal(new Set(UI_STYLE_TARGETS.map((target) => target.id)).size, UI_STYLE_TARGETS.length, "region ids are unique");
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

console.info("UI style override regressions passed.");
