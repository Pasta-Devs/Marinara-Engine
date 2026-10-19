import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { scopeChatCss } from "../../packages/client/src/lib/card-css.js";
import { sanitizeChatMessageCss, scopeChatMessageCss } from "../../packages/client/src/lib/chat-message-css.js";

const clientRequire = createRequire(new URL("../../packages/client/package.json", import.meta.url));
const postcss = clientRequire("postcss") as typeof import("postcss").default;

const importedCss = sanitizeChatMessageCss(`
  @import/* separator */url("https://example.invalid/theme.css");
  @import url("data:text/css;charset=utf-8,a;b");
  .safe { background-image: url("https://example.invalid/image.png"); }
`);
assert.doesNotMatch(importedCss, /@import/iu, "shared-message CSS cannot retain imported stylesheets");
assert.match(
  importedCss,
  /background-image:\s*url\("https:\/\/example\.invalid\/image\.png"\)/u,
  "ordinary HTTPS image styling remains available",
);

const positionedCss = sanitizeChatMessageCss(`
  .indirect { --message-position: fixed; position: var(--message-position); }
  .fixed { position: sticky !important; }
  .safe { position: relative; background-position: fixed; }
`);
assert.match(positionedCss, /\.indirect\s*\{[^}]*position:static/u, "indirect position values are neutralized");
assert.match(
  positionedCss,
  /\.fixed\s*\{[^}]*position:absolute/u,
  "viewport positions remain usable inside the message box",
);
assert.match(positionedCss, /\.safe\s*\{[^}]*position:relative/u, "safe positioning remains available");
assert.match(positionedCss, /background-position:\s*fixed/u, "unrelated position properties are not rewritten");

const contentCss = sanitizeChatMessageCss(`
  .layout { align-content: center; justify-content: space-between; place-content: stretch; }
  .label::before { content: "Untrusted label"; }
`);
assert.match(contentCss, /align-content:\s*center/u, "align-content remains available");
assert.match(contentCss, /justify-content:\s*space-between/u, "justify-content remains available");
assert.match(contentCss, /place-content:\s*stretch/u, "place-content remains available");
assert.doesNotMatch(contentCss, /(?<![-\w])content\s*:/iu, "standalone content declarations remain blocked");

const quotedComment = sanitizeChatMessageCss('[data-label="/* literal */"] { color: red; }');
assert.match(quotedComment, /"\/\* literal \*\/"/u, "comment-like text inside strings remains intact");

const reconstructedStyleTag = sanitizeChatMessageCss("<sty<style>le>.safe { color: red; }</sty</style>le>");
assert.doesNotMatch(reconstructedStyleTag, /</u, "tag-like text cannot reconstruct an HTML style element");
assert.match(reconstructedStyleTag, /\\3c /u, "literal angle brackets retain their CSS meaning through escaping");

for (const reconstructingImport of [
  '@imexpression(x)port url("https://example.invalid/expression.css"); .safe { color: red; }',
  '@im@import url("https://example.invalid/nested.css");port url("https://example.invalid/outer.css"); .safe { color: red; }',
]) {
  const reconstructedCss = sanitizeChatMessageCss(reconstructingImport);
  assert.doesNotMatch(reconstructedCss, /@import\b/iu, "removed syntax cannot concatenate into an import rule");
  assert.match(reconstructedCss, /\.safe\s*\{/u, "safe CSS after a rejected import remains available");
}

const scopedCss = scopeChatMessageCss(
  '@namespace svg url("https://example.invalid/ns"); .safe { color: red; }',
  ".message-scope",
);
assert.doesNotMatch(scopedCss, /@namespace/iu, "shared-message CSS cannot retain external namespaces");
assert.match(scopedCss, /\.message-scope \.safe\s*\{/u, "ordinary message selectors remain scoped");

const globalCss = scopeChatMessageCss(
  `
    @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
    @font-face { font-family: "Story Font"; src: url("https://example.invalid/story.woff2"); }
    @property --glow { syntax: "<color>"; inherits: false; initial-value: red; }
    @page { margin: 0; }
    @counter-style app-counter { system: numeric; symbols: "X"; }
    .animated { animation: 1s pulse; font-family: "Story Font"; color: var(--glow); }
  `,
  ".message-scope",
);
assert.doesNotMatch(globalCss, /@(?:page|counter-style)\b/iu, "document-global rules cannot affect the app");
assert.doesNotMatch(globalCss, /@keyframes\s+pulse\b/iu, "message keyframe names cannot collide with app animations");
assert.match(globalCss, /@keyframes\s+mari-msg-[\w-]+-pulse\b/iu, "message animations remain available by namespace");
assert.match(globalCss, /animation:\s*1s\s+mari-msg-[\w-]+-pulse/iu, "animation references use the namespace");
assert.doesNotMatch(globalCss, /font-family:\s*"Story Font"/iu, "message fonts cannot override an app family");
assert.match(globalCss, /font-family:\s*"mari-msg-font-[^"]+"/iu, "message fonts remain available by namespace");
assert.doesNotMatch(globalCss, /@property\s+--glow\b/iu, "registered properties cannot collide with app properties");
assert.match(
  globalCss,
  /var\(--mari-msg-[\w-]+-glow\)/iu,
  "registered custom properties remain available by namespace",
);

const conditionalCss = scopeChatMessageCss(
  `
    @media (min-width: 1px) { .inside:is(.wide, .narrow), [data-label="a,b"] { color: red; } }
    @layer attacker, base;
    @layer cards { .outer { & + .outside { color: green; } :is(&, body) .outside { color: blue; } } }
    .after { color: rgb(4, 5, 6); }
  `,
  ".message-scope",
);
assert.match(
  conditionalCss,
  /@media[^{}]*\{\s*\.message-scope \.inside:is\(\.wide, \.narrow\), \.message-scope \[data-label="a,b"\]\s*\{/u,
  "conditional rules and selector-list commas remain available inside the message scope",
);
assert.match(
  conditionalCss,
  /\}\s*\.message-scope \.after\s*\{/u,
  "a selector following a retained at-rule cannot escape the message scope",
);
assert.doesNotMatch(conditionalCss, /\}\s*\.after\s*\{/u, "an at-rule closing brace cannot expose a global selector");
assert.doesNotMatch(conditionalCss, /@layer\s+attacker/u, "statement layers cannot reorder the app's cascade");
assert.match(conditionalCss, /@layer\s+mari-msg-layer-[\w-]+\s*\{/u, "named message layers remain usable by namespace");
assert.match(conditionalCss, /\.message-scope \.outer\s*\{\s*\}/u, "the safely scoped parent rule remains available");
assert.doesNotMatch(conditionalCss, /&|:is\([^)]*body|\.outside/u, "nested rules cannot select outside the message");

const malformedBraceCss = scopeChatMessageCss(
  ".inside { color: red; }} .after-malformed { color: blue; }",
  ".message-scope",
);
assert.equal(malformedBraceCss, "", "malformed CSS fails closed instead of relying on browser error recovery");
assert.doesNotMatch(malformedBraceCss, /\}\s*\.after-malformed\s*\{/u);

const indirectGlobalCss = scopeChatMessageCss(
  `
    @keyframes pulse { from { opacity: 0; } }
    @font-face { font-family: "Story Font"; src: url("https://example.invalid/story.woff2"); }
    .indirect { --animation-name: pulse; --font-name: "Story Font"; animation-name: var(--animation-name); font-family: var(--font-name); }
  `,
  ".message-scope",
);
assert.match(indirectGlobalCss, /--animation-name:\s*mari-msg-[\w-]+-pulse/u, "indirect animations remain usable");
assert.match(indirectGlobalCss, /--font-name:\s*"mari-msg-font-[^"]+"/u, "indirect custom fonts remain usable");

const rejectedGlobalIdentifiers = scopeChatMessageCss(
  `
    @keyframes "app-spin" { from { opacity: 0; } }
    @keyframes évil { from { opacity: 0; } }
    @keyframes \\31 app { from { opacity: 0; } }
    @property --évil { syntax: "<color>"; inherits: false; initial-value: red; }
    @property --app\\5f color { syntax: "<color>"; inherits: false; initial-value: red; }
    @font-face { font-family: "Harmless"; font-family: "Inter"; src: local("}"); }
  `,
  ".message-scope",
);
assert.doesNotMatch(rejectedGlobalIdentifiers, /@keyframes\s+(?:"app-spin"|évil|\\31 app)/u);
assert.doesNotMatch(rejectedGlobalIdentifiers, /@property\s+(?:--évil|--app\\5f color)/u);
assert.doesNotMatch(rejectedGlobalIdentifiers, /font-family:\s*"(?:Harmless|Inter)"/u);
assert.match(
  rejectedGlobalIdentifiers,
  /font-family:\s*"mari-msg-font-[^"]+"/u,
  "every effective font-face family is namespaced even with duplicate declarations and brace-like strings",
);

// A top-level selector that starts with a sibling combinator would match elements next to the
// message box (`.scope ~ x`) instead of inside it.
const leadingCombinatorCss = scopeChatMessageCss(
  "~ .after { color: red; } + .next { color: red; } || td { color: red; } > .child { color: green; } .kept, ~ .dropped { color: blue; }",
  ".message-scope",
);
assert.doesNotMatch(leadingCombinatorCss, /\.message-scope\s*(?:~|\+|\|\|)/u, "selectors cannot reach siblings");
assert.doesNotMatch(leadingCombinatorCss, /\.after|\.next|\btd\b|\.dropped/u, "sibling selectors are dropped");
assert.match(leadingCombinatorCss, /\.message-scope > \.child\s*\{/u, "a child selector stays inside the message");
assert.match(leadingCombinatorCss, /\.message-scope \.kept\s*\{/u, "the safe part of a selector list remains");

const spacedImportant = sanitizeChatMessageCss(".a { color: red ! important; } .b { color: blue !/**/important; }");
assert.doesNotMatch(spacedImportant, /!\s*important/iu, "spaced !important cannot force styles past the app's own");

// Card creator-notes CSS goes into a document-wide <style>, so every rule must keep the card scope.
function assertEveryRuleScoped(css: string, scope: string, message: string) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/iu.test((rule.parent as import("postcss").AtRule).name)) return;
    for (const selector of rule.selectors) {
      const rest = selector.slice(scope.length);
      // The scope must end at a selector boundary: `.mari-card-css-other` is a different element.
      assert.ok(selector.startsWith(scope) && /^(?:$|[\s>:[.#])/u.test(rest), `${message}: ${selector}`);
      assert.doesNotMatch(rest, /^(?:[^\s~+>]*)\s*(?:~|\+|\|\|)/u, `${message}: ${selector}`);
    }
  });
}
assert.throws(
  () => assertEveryRuleScoped(".mari-card-css-other .a { color: red }", ".mari-card-css", "prefix"),
  assert.AssertionError,
  "a class that only starts with the scope name is not inside the scope",
);

const escapedQuoteCardCss = scopeChatCss(
  '.a { --x: \\"; } .probe { color: red } .b { color: blue; content: "\\"" } .after { color: green }',
  ".mari-card-css",
);
assertEveryRuleScoped(escapedQuoteCardCss, ".mari-card-css", "an escaped quote cannot end a card rule early");
assert.match(escapedQuoteCardCss, /\.mari-card-css \.probe\s*\{/u, "rules after an escaped quote stay scoped");

for (const scope of [".mari-card-css", '.mari-card-css [data-card-css="card-1"]']) {
  const siblingCardCss = scopeChatCss(
    `~ .a { color: red } + .b { color: red } :root ~ .c { color: red } body:not(.x) + .d { color: red }
     [data-card-css] ~ .e { color: red } [data-card-css]:hover + .f { color: red } > .child { color: green }
     .g ~ .h { color: green } html .i { color: green }`,
    scope,
  );
  assertEveryRuleScoped(siblingCardCss, scope, "card selectors cannot reach siblings of the scope");
  assert.doesNotMatch(siblingCardCss, /\.[a-e]\s*\{/u, "sibling selectors are dropped");
  // In Exclusive mode [data-card-css] is the scope element itself; in Chat mode it is a descendant.
  if (scope.includes("[data-card-css=")) assert.doesNotMatch(siblingCardCss, /\.f\s*\{/u);
  else assert.match(siblingCardCss, /\.mari-card-css \[data-card-css\]:hover \+ \.f\s*\{/u);
  assert.match(siblingCardCss, /> \.child\s*\{/u, "child selectors remain");
  assert.match(siblingCardCss, /\.g ~ \.h\s*\{/u, "siblings inside the scope remain");
}

const cardAtRules = scopeChatCss(
  `@media (min-width: 1px) { .wide { color: red } }
   @keyframes spin { from { opacity: 0 } }
   @property --primary { syntax: "<color>"; inherits: false; initial-value: red; }
   .spin { animation: spin 1s; }
   .unclosed { color: red`,
  ".mari-card-css",
);
assertEveryRuleScoped(cardAtRules, ".mari-card-css", "card at-rules keep their rules scoped");
assert.match(cardAtRules, /@media[^{]*\{\s*\.mari-card-css \.wide/u, "card media queries remain");
assert.match(cardAtRules, /@keyframes mc-spin/u, "card animations remain namespaced");
assert.doesNotMatch(cardAtRules, /@property/u, "card CSS cannot register app-wide custom properties");
assert.match(cardAtRules, /\.mari-card-css \.unclosed\s*\{\s*color: red\s*\}/u, "a block left open is closed");

const chatMessageSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url),
  "utf8",
);
assert.match(
  chatMessageSource,
  /relative !overflow-hidden !contain-paint/u,
  "the rendered message box enforces clipping and a fixed-position containing block",
);

console.info("Chat message CSS security regressions passed.");
