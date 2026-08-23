import assert from "node:assert/strict";
import {
  assertSafeRedirect,
  isWikipediaHost,
  pageRefFromUrl,
  serviceUrl,
  wikiApiUrl,
  wikiRefFromInput,
} from "../../../packages/server/src/services/professor-mari/fandom-mediawiki/fandom-url.js";
import { stripHtml } from "../../../packages/server/src/services/professor-mari/fandom-mediawiki/html-text.js";

const wikipedia = wikiRefFromInput("en.wikipedia.org");
assert.equal(wikipedia.host, "en.wikipedia.org");
assert.equal(wikipedia.apiUrl, "https://en.wikipedia.org/w/api.php");
assert.equal(isWikipediaHost(wikipedia.host), true);

const page = pageRefFromUrl("https://en.wikipedia.org/wiki/Artificial_intelligence");
assert.equal(page.wiki.host, "en.wikipedia.org");
assert.equal(page.title, "Artificial intelligence");
assert.equal(
  wikiApiUrl(page.wiki, { action: "query", format: "json" }).toString(),
  "https://en.wikipedia.org/w/api.php?action=query&format=json",
);

assert.equal(wikiRefFromInput("genshin-impact").host, "genshin-impact.fandom.com");
assert.equal(wikiRefFromInput("genshin-impact").slug, "genshin-impact");
assert.throws(() => wikiRefFromInput("http://en.wikipedia.org/wiki/Test"), /Only HTTPS/u);
assert.throws(
  () => wikiRefFromInput("https://wikipedia.org/wiki/Test"),
  /Only \*\.fandom\.com and \*\.wikipedia\.org/u,
);
assert.throws(() => wikiRefFromInput("https://example.com/wiki/Test"), /Only \*\.fandom\.com and \*\.wikipedia\.org/u);
assert.throws(() => wikiRefFromInput("https://127.0.0.1/wiki/Test"), /IP literal/u);
assert.equal(
  serviceUrl("/unified-search/page-search", { query: "Teyvat" }).toString(),
  "https://services.fandom.com/unified-search/page-search?query=Teyvat",
);
assert.throws(
  () => serviceUrl("https://en.wikipedia.org/w/api.php", { action: "query" }),
  /must stay on services\.fandom\.com/u,
);
assert.equal(stripHtml('<script type="text/javascript">hidden()</script >Visible'), "Visible");
assert.equal(stripHtml('<style type="text/css">.hidden { display: none }</style >Readable'), "Readable");
assert.equal(stripHtml("<script>hidden()</script\t\n ignored>Visible"), "Visible");
assert.equal(stripHtml("<style>.hidden { display: none }</style\t\n ignored>Readable"), "Readable");
assert.equal(stripHtml("Before<script>hidden()"), "Before");
assert.equal(stripHtml("Before<style>.hidden { display: none }</style"), "Before");
assert.equal(stripHtml("Before<script type=text/javascript"), "Before<script type=text/javascript");
assert.equal(stripHtml("Before<style type=text/css"), "Before<style type=text/css");
const malformedScriptClosings = "</script".repeat(50_000);
const malformedStyleClosings = "</style".repeat(50_000);
const malformedClosingScanStartedAt = performance.now();
assert.equal(stripHtml(`<script>hidden${malformedScriptClosings}`), "");
assert.equal(stripHtml(`<style>hidden${malformedStyleClosings}`), "");
assert.ok(
  performance.now() - malformedClosingScanStartedAt < 2_000,
  "repeated unterminated script and style closing prefixes should be scanned in linear time",
);
assert.throws(
  () => assertSafeRedirect(new URL(wikipedia.apiUrl), new URL("https://fr.wikipedia.org/w/api.php")),
  /crossed to a different host/u,
);

process.stdout.write("Professor Mari wiki regression passed.\n");
