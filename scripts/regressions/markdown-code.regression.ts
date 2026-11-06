import assert from "node:assert/strict";
import { protectMarkdownCode } from "../../packages/client/src/lib/markdown-code";

for (const source of [
  '7. Dialogue uses `<font color="#HEX">` per NPC.\n\n# Following heading',
  '<strong>Real HTML</strong>\n\n```html\n<font color="black">\n\n  <img src="https://code.invalid/pixel" onerror="alert(1)">\n```\nAfter',
  "```html\n<style>body { color: black; }</style>\nUnfinished <font>",
  '  ```js\n  const x = "literal";\n    return x;\n  ```',
  '<a title="A `literal attribute`">Link</a> and `code`',
  "\\`escaped\\` and `real`",
  "\uE0000\uE000 and `literal`",
  "```\n```",
]) {
  const protectedCode = protectMarkdownCode(source);
  assert.equal(protectedCode.restoreSource(protectedCode.text), source);
}
const inline = protectMarkdownCode('Before `<font color="#HEX">` after');
assert.doesNotMatch(inline.text, /<font/);
assert.equal(
  inline.restoreHtml(inline.text),
  'Before <code class="mari-md-inline-code">&lt;font color="#HEX"&gt;</code> after',
);
for (const source of ['x < y and `"red"` > z', 'x <y and `"red"` > z']) {
  const protectedCode = protectMarkdownCode(source);
  assert.doesNotMatch(protectedCode.text, /`/);
  assert.equal(protectedCode.restoreSource(protectedCode.text), source);
  assert.match(protectedCode.restoreHtml(protectedCode.text), /<code class="mari-md-inline-code">"red"<\/code>/);
}
const bracketedFence = protectMarkdownCode('<strong>HTML</strong>\nx < y\n```\n  first\n\nsecond\n```\n> z');
assert.doesNotMatch(bracketedFence.text, /```/);
assert.match(bracketedFence.restoreHtml(bracketedFence.text), /<code>  first\n\nsecond<\/code>/);
const fenced = protectMarkdownCode(
  "<strong>Real HTML</strong>\n```html\n<style>body { color: black; }</style>\n  return 42;\n```\nAfter",
);
assert.match(fenced.text, /<strong>Real HTML<\/strong>/);
assert.doesNotMatch(fenced.text, /<style>|return 42/);
assert.match(
  fenced.restoreHtml(fenced.text),
  /<code>&lt;style&gt;body \{ color: black; \}&lt;\/style&gt;\n  return 42;<\/code>/,
);
const empty = protectMarkdownCode("```\n```");
assert.equal(empty.restoreHtml(empty.text), '<pre class="mari-md-codeblock"><code></code></pre>');
assert.equal(protectMarkdownCode("\\`<font>\\`").text, "\\`<font>\\`");
assert.equal(
  protectMarkdownCode('<a title="A `literal attribute`">Link</a>').text,
  '<a title="A `literal attribute`">Link</a>',
);
console.log("Markdown literal-code protection regression passed");
