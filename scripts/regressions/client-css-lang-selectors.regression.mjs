import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// :where() and :is() take a forgiving list: Chromium drops only the :lang() argument and keeps the rule, which still
// matches by the dir attribute. Tailwind's rtl:/ltr: variants lower to that shape, so they must not fail the build.
const rtlVariant = safari14('.rtl\\:mr-2:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *){margin-right:.5rem}');
const ltrVariant = safari14('.ltr\\:mr-2:where(:dir(ltr), [dir="ltr"], [dir="ltr"] *){margin-right:.5rem}');
assert.match(rtlVariant, /:where\(:lang\(ae,[^)]*\),\[dir=rtl\],\[dir=rtl\] \*\)/u);
assert.match(ltrVariant, /:where\(:not\(:lang\(ae,[^)]*\)\),\[dir=ltr\],\[dir=ltr\] \*\)/u);
assert.deepEqual(findLangSelectorLists(rtlVariant), []);
assert.deepEqual(findLangSelectorLists(ltrVariant), []);
assert.deepEqual(findLangSelectorLists(safari14('.a:is(:dir(rtl), [dir="rtl"]){left:0}')), []);
// Outside one, a list still drops the rule: at the top level or inside :not() or :has(), which are not forgiving,
// including a logical property under an rtl: variant (rtl:start-0).
const unforgiving = [".a:not(:dir(rtl)){left:0}", ".a:has(:dir(rtl)){left:0}"].map(safari14).join("");
assert.deepEqual(findLangSelectorLists(unforgiving), [
  ".a:not(:lang(ae,ar,arc,bcc,bqi,ckb,dv,fa,glk,he,ku,mzn,nqo,pnb,ps,sd,ug,ur,yi))",
  ".a:has(:lang(ae,ar,arc,bcc,bqi,ckb,dv,fa,glk,he,ku,mzn,nqo,pnb,ps,sd,ug,ur,yi))",
]);
const rtlLogical = safari14('.rtl\\:start-0:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *){inset-inline-start:0}');
assert.equal(findLangSelectorLists(rtlLogical).length, 2);

// G3's narrow layout floats her sprite at the inline start, so its gap to the text must be at the inline end:
// a physical right margin put the gap on the outer side in right-to-left locales, and the text touched her.
const mariCss = readFileSync(resolve(repositoryRoot, "packages/client/src/styles/mari.css"), "utf8");
const narrowLayout = mariCss.slice(mariCss.indexOf("@container mari-scroll (width < 52rem)"));
const narrowSprite = safari14(narrowLayout.match(/\.mari-answer__sprite \{[^}]*\}/u)[0]);
assert.match(narrowSprite, /float:inline-start/u);
assert.match(narrowSprite, /margin-inline-end:\.6rem/u);
assert.doesNotMatch(narrowSprite, /margin(?:-left|-right)?:/u, "no physical side margin");
assert.deepEqual(findLangSelectorLists(narrowSprite), []);

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
assert.doesNotThrow(() => run(asset("assets/client-a.css", rtlVariant + ltrVariant)), "rtl:/ltr: variants build");
assert.doesNotThrow(() => run(asset("assets/notes.txt", logical)), "only stylesheets are checked");

console.log("client CSS :lang() selector guard regression passed");
