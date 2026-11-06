/* global TextDecoder */

/**
 * Whether the selector at index sits inside a :where() or :is() argument, at any depth. Those take a forgiving
 * list, so Chromium drops only that argument and keeps the rule. Tailwind's rtl:/ltr: variants lower to
 * :where(:lang(ae,...),[dir=rtl],[dir=rtl] *) (ltr: :where(:not(:lang(...)),...)) and still match by dir.
 */
function inForgivingList(css, index) {
  let depth = 0;
  for (let i = index - 1; i >= 0 && css[i] !== "{" && css[i] !== "}"; i--) {
    if (css[i] === ")") depth++;
    else if (css[i] !== "(") continue;
    else if (depth > 0) depth--;
    else if (/:(?:where|is)$/iu.test(css.slice(Math.max(0, i - 6), i))) return true;
  }
  return false;
}

/**
 * The selectors of the rules that use a `:lang()` selector with a comma list outside a :where()/:is() argument.
 * Chromium rejects such a selector and drops the whole rule. Lightning CSS writes them when cssTarget (safari14)
 * lacks a logical property, such as inset-inline-start or a logical corner radius, to fake its right-to-left
 * side (#8709).
 */
export function findLangSelectorLists(css) {
  const matches = [...css.matchAll(/:lang\([^)]*,[^)]*\)/gu)].filter(({ index }) => !inForgivingList(css, index));
  const selectors = matches.map(({ index }) => {
    const start = Math.max(css.lastIndexOf("{", index), css.lastIndexOf("}", index)) + 1;
    const end = css.indexOf("{", index);
    return css.slice(start, end === -1 ? undefined : end).trim();
  });
  return [...new Set(selectors)];
}

/**
 * Fails a build whose CSS has such a selector, naming the rules Chromium would drop.
 * ponytail: reads emitted .css files only; CSS a build inlines into JS (?inline imports, a library build with
 * cssCodeSplit) is not checked. The client has none; scan chunk code too if that changes.
 */
export function cssLangSelectorGuard() {
  return {
    name: "css-lang-selector-guard",
    // After Vite's own CSS plugin, which writes a library build's stylesheet in generateBundle.
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
        const css = typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
        const rules = findLangSelectorLists(css);
        if (rules.length === 0) continue;
        this.error(
          `${file.fileName} has :lang() selector lists, which Chromium drops with their rules. Write physical ` +
            `left/right (or corner radii) with a [dir="rtl"] override instead of the logical property (#8709):\n  ` +
            rules.join("\n  "),
        );
      }
    },
  };
}
