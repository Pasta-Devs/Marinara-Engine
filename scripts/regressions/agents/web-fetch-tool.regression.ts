// web_fetch is the page-reading half of web search: web_search returns snippets and this returns the
// text behind one result. The claims pinned here are the ones the agent prompt depends on — markup and
// scripts never reach the model, the article block wins over page chrome, entities decode, whitespace
// collapses, and only https:// URLs are fetched.
import assert from "node:assert/strict";
import { BUILT_IN_TOOLS } from "../../../packages/shared/src/index.js";
import { executeToolCalls } from "../../../packages/server/src/services/tools/tool-executor.js";
import { decodeHtmlEntities, extractReadableText } from "../../../packages/server/src/services/tools/web-page-text.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

async function fetchThrough(url: string) {
  const [result] = await executeToolCalls([
    { id: "call-1", type: "function", function: { name: "web_fetch", arguments: JSON.stringify({ url }) } },
  ]);
  assert.ok(result);
  assert.equal(result!.success, false);
  return JSON.parse(result!.result) as Record<string, unknown>;
}

const page = `<!doctype html>
<html><head><title>Artorias &amp; the Abyss</title>
<style>body { color: red } .hidden { display: none }</style>
<script>window.analytics = { track() { return "noise" } }</script></head>
<body>
  <nav><a href="/">Home</a> <a href="/lore">Lore</a></nav>
  <main>
    <h1>Artorias the Abysswalker</h1>
    <p>Artorias was one of Gwyn's Four Knights, and he &quot;walked the Abyss&quot; to stop its spread.</p>
    <p>He is not a god. His sword deals extra damage to the Abyss&rsquo;s creatures &#8212; the Darkwraiths.</p>
  </main>
  <footer>Copyright &copy; 2024</footer>
</body></html>`;

const cases: RegressionCase[] = [
  {
    name: "web_fetch is a built-in tool that takes a url",
    run() {
      const webFetch = BUILT_IN_TOOLS.find((tool) => tool.name === "web_fetch");
      assert.ok(webFetch, "web_fetch is a built-in tool");
      assert.deepEqual(webFetch!.parameters.required, ["url"]);
      assert.equal(webFetch!.parameters.properties?.url?.type, "string");
      assert.equal(webFetch!.parameters.properties?.maxChars?.maximum, 12000);
    },
  },
  {
    name: "web_fetch refuses empty, relative and non-https URLs",
    async run() {
      assert.match(String((await fetchThrough("")).error), /non-empty url/u);
      assert.match(String((await fetchThrough("not a url")).error), /absolute URL/u);
      assert.match(String((await fetchThrough("http://example.com/page")).error), /only reads https/u);
      assert.match(String((await fetchThrough("ftp://example.com/page")).error), /only reads https/u);
    },
  },
  {
    name: "extraction drops chrome, scripts and styles",
    run() {
      const pageResult = extractReadableText(page);
      assert.equal(pageResult.title, "Artorias & the Abyss");
      assert.match(pageResult.text, /Artorias was one of Gwyn's Four Knights/u);
      assert.match(pageResult.text, /"walked the Abyss"/u);
      assert.match(pageResult.text, /Abyss’s creatures — the Darkwraiths/u);
      assert.doesNotMatch(pageResult.text, /window\.analytics|color: red|<[a-z]/iu);
      assert.doesNotMatch(pageResult.text, /Copyright/u, "the main block wins over the footer");
      assert.ok(!pageResult.text.includes("<"), "no markup survives extraction");
    },
  },
  {
    name: "a short teaser does not win the content container",
    run() {
      const longestArticle = extractReadableText(`<body>
  <article><p>Short teaser.</p></article>
  <article><p>${"The full article text. ".repeat(20)}</p></article>
</body>`);
      assert.match(longestArticle.text, /The full article text\./u);
      assert.doesNotMatch(longestArticle.text, /Short teaser/u);
    },
  },
  {
    name: "a bare fragment still yields its prose",
    run() {
      const fragment = extractReadableText("<p>Bare fragment &amp; text.</p>");
      assert.equal(fragment.text, "Bare fragment & text.");
    },
  },
  {
    name: "block boundaries survive as lines",
    run() {
      const formatted = extractReadableText("<div><p>One</p><p>Two</p></div><ul><li>Three</li></ul>");
      assert.deepEqual(
        formatted.text.split("\n").filter((line) => line.trim()),
        ["One", "Two", "Three"],
      );
    },
  },
  {
    name: "entities that wikis use decode, unknown ones are left alone",
    run() {
      assert.equal(decodeHtmlEntities("&hellip;&mdash;&ndash;&laquo;&raquo;&#x27;&unknown;"), "…—–«»'&unknown;");
    },
  },
];

await runNamedCases(cases);
