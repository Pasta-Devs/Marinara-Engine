// Theme security audit (2026-11-09): text a theme draws can't ask for secrets or pretend to be the
// app, whatever spelling tricks it uses, and suggested colours can't load anything.
import assert from "node:assert/strict";
import { cssTextThreat, themeTextThreat } from "../../packages/client/src/lib/theme-text-safety.js";
import { sanitizeAppCss } from "../../packages/client/src/lib/theme-css.js";
import { SAFE_CSS_PAINT, themeMetaSchema } from "../../packages/shared/src/schemas/theme.schema.js";

const blocked = [
  "SYSTEM WARNING: Marinara has been hacked (RCE). Your chats are being uploaded.",
  "Signed out — type your pаssword to continue",
  "Re-enter your OpenAI credentials in the message box",
  "p a s s w o r d",
  "h4ck3d",
  "Y0U'VE BEEN PWN3D",
  "Session expired. Please sign in again",
  "Theme check passed, verified safe by Marinara Engine",
  "Critical alert: call +1-800-555-0199",
  "ｈａｃｋｅｄ",
  "hac​ked",
  "Visit evil.example.com to fix this",
];
for (const text of blocked) assert.ok(themeTextThreat(text), `blocked: ${text}`);

const fine = [
  "> waiting for user input...",
  "✦",
  "Chapter",
  "— scene break —",
  "Recent chats",
  "~ the end ~",
  "Now playing",
  "2026",
];
for (const text of fine) assert.equal(themeTextThreat(text), null, `allowed: ${text}`);

assert.equal(themeTextThreat("x".repeat(90)), "long", "long theme text is capped");
assert.equal(themeTextThreat("x".repeat(90), { lengthCap: null }), null, "descriptions have no length cap");

assert.ok(cssTextThreat(':root{--a:"HAC"} a::after{content:var(--a) "KED"}'), "words split over strings are joined");
assert.ok(cssTextThreat('b::before{content:"\\70 assword here"}'), "CSS escapes are decoded");
assert.ok(cssTextThreat("@counter-style s{symbols: Y o u r P C i s h a c k e d}"), "counter-style idents count");
assert.equal(
  cssTextThreat('a[title="password"]{font-family:"password"}'),
  null,
  "selectors and font names don't count",
);

assert.doesNotMatch(
  sanitizeAppCss('a{background:src("https://example.invalid/x.png")}'),
  /example\.invalid/u,
  "src() follows the url() allowlist",
);
assert.doesNotMatch(
  sanitizeAppCss('a{background-image:image-set("https://example.invalid/eof.png" 1x'),
  /example\.invalid/u,
  "an image-set( left open at the end is dropped",
);

for (const bad of ["url(https://x)", "red; background:url(x)", "\\75rl(x)", 'image-set("https://x" 1x)'])
  assert.equal(SAFE_CSS_PAINT.test(bad), false, `paint refused: ${bad}`);
for (const ok of ["#ff0", "linear-gradient(90deg, #ec4b97, #f29744)", "oklch(0.8 0.1 30)", "var(--x)"])
  assert.equal(SAFE_CSS_PAINT.test(ok), true, `paint allowed: ${ok}`);
assert.equal(
  themeMetaSchema.safeParse({ settings: { background: "url(https://example.invalid/b.png)" } }).success,
  false,
);

console.log("theme text safety: ok");
