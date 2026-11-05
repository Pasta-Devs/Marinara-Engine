import assert from "node:assert/strict";
import { sanitizeAppCss } from "../../packages/client/src/lib/theme-css.js";
import {
  buildUiStyleOverridesCss,
  normalizeUiStyleOverride,
  normalizeUiStyleOverrides,
  resolveUiStyleTarget,
  serializeUiStyleOverride,
  type UiStyleProbe,
} from "../../packages/client/src/lib/ui-style-overrides.js";

const css = buildUiStyleOverridesCss({ "top-bar": { background: "#123", borderRadius: 8, opacity: 90 } });
assert.equal(css, ':root [data-component="TopBar"]{background:#123;border-radius:8px;opacity:0.9}');
assert.equal(sanitizeAppCss(css), css, "generated CSS passes the theme sanitizer unchanged");
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
      if (!tokens.includes(last)) return false;
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
assert.equal(resolveUiStyleTarget(node([".x"], null)), null);

console.info("UI style override regressions passed.");
