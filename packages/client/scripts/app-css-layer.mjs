/**
 * Puts the app's own CSS in the `mari-app` cascade layer (theming panel batch 2).
 *
 * Custom themes are unlayered, so with the app's rules in a layer a theme wins over them with plain
 * selectors and no `!important`, whatever the app's selector specificity. The layer order is declared
 * first thing in index.html: mari-protected, mari-theme-important, Tailwind's four layers, mari-app,
 * mari-pickers. mari-app comes after Tailwind's utilities, so the app's rules keep beating utility
 * classes exactly as they did while they were unlayered.
 *
 * Runs after Tailwind and Vite's CSS plugin have inlined imports, on every stylesheet under src/
 * (including the `?inline` ones the new layout loads on demand). Rules already in a layer, and the
 * at-rules that can't or needn't be layered (@layer statements, @import, @charset, @font-face,
 * @property, @keyframes, @counter-style, @font-feature-values), stay where they are.
 */
import postcss from "postcss";

const KEEP_AT_TOP = new Set([
  "layer",
  "import",
  "charset",
  "namespace",
  "font-face",
  "property",
  "keyframes",
  "-webkit-keyframes",
  "counter-style",
  "font-feature-values",
  "font-palette-values",
  "view-transition",
]);

export const APP_CSS_LAYER = "mari-app";

export function wrapAppCssInLayer(css, layer = APP_CSS_LAYER) {
  const root = postcss.parse(css);
  let block = null;
  for (const node of [...root.nodes]) {
    const stays = node.type === "comment" || (node.type === "atrule" && KEEP_AT_TOP.has(node.name.toLowerCase()));
    if (stays) {
      // A comment between two layered rules joins the block; elsewhere it stays put.
      if (node.type === "comment" && block) block.append(node.remove());
      else block = null;
      continue;
    }
    if (!block) {
      block = postcss.atRule({ name: "layer", params: layer, raws: { afterName: " " } });
      node.before(block);
    }
    block.append(node.remove());
  }
  return root.toString();
}

const SOURCE_CSS = /\/packages\/client\/src\/.+\.css(?:\?.*)?$/u;

export function appCssLayer() {
  // MARI_APP_CSS_LAYER=off builds the app with its CSS unlayered, to compare screenshots.
  if (process.env.MARI_APP_CSS_LAYER === "off") return { name: "app-css-layer" };
  return {
    name: "app-css-layer",
    transform(code, id) {
      const path = id.replace(/\\/gu, "/");
      if (!SOURCE_CSS.test(path) || path.includes("?raw") || path.includes("&raw")) return null;
      // A JS module already (Vite's CSS-modules or ?inline output from an earlier plugin): leave it.
      if (/^\s*(?:export|import|const|var|let)\s/u.test(code)) return null;
      return { code: wrapAppCssInLayer(code), map: null };
    },
  };
}
