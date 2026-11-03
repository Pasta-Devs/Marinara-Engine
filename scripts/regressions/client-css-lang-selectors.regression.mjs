import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssLangSelectorGuard, findLangSelectorLists } from "../../packages/client/scripts/css-lang-selectors.mjs";

// #8709: with cssTarget safari14, Lightning CSS fakes inset-inline-start's right-to-left side with :lang() lists.
// Chromium rejects a :lang() list, so it dropped the rule that keeps Prof. Mari's reply sprite out of the text.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const clientRequire = createRequire(resolve(repositoryRoot, "packages/client/package.json"));
const { transform } = createRequire(clientRequire.resolve("vite"))("lightningcss");
const safari14 = (code) =>
  transform({
    filename: "fixture.css",
    code: Buffer.from(code),
    minify: true,
    targets: { safari: 14 << 16 },
  }).code.toString();

const logical = safari14(".mari-answer__sprite{position:absolute;inset-inline-start:-3.75rem}");
assert.deepEqual(findLangSelectorLists(logical), [
  ".mari-answer__sprite:not(:lang(ae,ar,arc,bcc,bqi,ckb,dv,fa,glk,he,ku,mzn,nqo,pnb,ps,sd,ug,ur,yi))",
  ".mari-answer__sprite:lang(ae,ar,arc,bcc,bqi,ckb,dv,fa,glk,he,ku,mzn,nqo,pnb,ps,sd,ug,ur,yi)",
]);

// The rewrite the client uses: physical sides, flipped by the dir attribute i18n.ts sets on <html>.
const physical = safari14(
  ".mari-answer__sprite{position:absolute;left:-3.75rem}:where([dir=rtl]) .mari-answer__sprite{right:-3.75rem;left:auto}",
);
assert.deepEqual(findLangSelectorLists(physical), []);
assert.match(physical, /:where\(\[dir=rtl\]\) \.mari-answer__sprite\{left:auto;right:-3\.75rem\}/u);
assert.deepEqual(findLangSelectorLists("a:lang(ar){left:0}"), [], "a single language is valid in Chromium");

// The build plugin fails on such a selector in an emitted stylesheet, whatever form Vite gives its source.
const guard = cssLangSelectorGuard();
const run = (bundle) =>
  guard.generateBundle.call(
    {
      error(message) {
        throw new Error(message);
      },
    },
    {},
    bundle,
  );
const asset = (fileName, source) => ({ [fileName]: { type: "asset", fileName, source } });
assert.equal(guard.enforce, "post", "runs after Vite writes a library build's stylesheet");
assert.throws(() => run(asset("assets/client-a.css", logical)), /client-a\.css[\s\S]*\.mari-answer__sprite:lang\(ae,/u);
assert.throws(() => run(asset("guest.css", new TextEncoder().encode(logical))), /guest\.css/u);
assert.doesNotThrow(() => run(asset("assets/client-a.css", physical)));
assert.doesNotThrow(() => run(asset("assets/notes.txt", logical)), "only stylesheets are checked");

console.log("client CSS :lang() selector guard regression passed");
