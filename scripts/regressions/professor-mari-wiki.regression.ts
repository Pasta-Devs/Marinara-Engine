import assert from "node:assert/strict";
import {
  assertSafeRedirect,
  isWikipediaHost,
  pageRefFromUrl,
  serviceUrl,
  wikiApiUrl,
  wikiRefFromInput,
} from "../../packages/server/src/services/professor-mari/fandom-mediawiki/fandom-url.js";

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
assert.throws(() => wikiRefFromInput("http://en.wikipedia.org/wiki/Test"), /Only HTTPS/u);
assert.throws(() => wikiRefFromInput("https://wikipedia.org/wiki/Test"), /Only \*\.fandom\.com and \*\.wikipedia\.org/u);
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
assert.throws(
  () => assertSafeRedirect(new URL(wikipedia.apiUrl), new URL("https://fr.wikipedia.org/w/api.php")),
  /crossed to a different host/u,
);

process.stdout.write("Professor Mari wiki regression passed.\n");
