import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { build } from "esbuild";

// Render the actual component without launching Marinara or a browser. Interactive
// focus, mutation and persistence coverage lives in the matching Playwright spec.
const clientRoot = fileURLToPath(new URL("../../../packages/client/", import.meta.url));
const messages = JSON.parse(await readFile(join(clientRoot, "src/localization/locales/en.json"), "utf8"));
const scratch = await mkdtemp(join(clientRoot, ".keyword-visibility-"));
try {
  const outfile = join(scratch, "fields.mjs");
  await build({
    stdin: {
      contents: [
        'export { KeysEditor } from "./src/components/lorebooks/LorebookFormFields.tsx";',
        'export { createElement } from "react";',
        'export { renderToStaticMarkup } from "react-dom/server";',
        'export { createInstance } from "i18next";',
        'export { I18nextProvider } from "react-i18next";',
      ].join("\n"),
      resolveDir: clientRoot,
    },
    outfile,
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    jsx: "automatic",
    logLevel: "silent",
  });
  const { KeysEditor, createElement, renderToStaticMarkup, createInstance, I18nextProvider } = await import(
    pathToFileURL(outfile).href
  );
  const i18n = createInstance();
  await i18n.init({
    lng: "en",
    resources: { en: { translation: messages } },
    keySeparator: false,
    interpolation: { escapeValue: false },
  });
  let changes = 0;
  const render = (keys) =>
    renderToStaticMarkup(
      createElement(I18nextProvider, { i18n }, createElement(KeysEditor, { keys, onChange: () => changes++ })),
    );

  for (const count of [0, 10, 11]) {
    const keys = Array.from({ length: count }, (_, index) => "keyword-" + (index + 1));
    const before = [...keys];
    const html = render(keys);
    assert.equal((html.match(/class="mari-editor-chip /gu) ?? []).length, Math.min(count, 10));
    assert.match(html, /<input /u, "the input is always rendered");
    assert.match(html, />Add<\/button>/u);
    if (count > 10) {
      assert.match(html, /aria-expanded="false"/u);
      assert.match(html, />Show 1 more<\/button>/u);
      assert.ok(!html.includes("keyword-11"));
      const controlledId = html.match(/aria-controls="([^"]+)"/u)?.[1];
      assert.ok(controlledId && html.includes('id="' + controlledId + '"'));
    } else {
      assert.ok(!html.includes("aria-expanded="));
    }
    assert.deepEqual(keys, before, "rendering never trims the stored array");
  }
  assert.equal(changes, 0, "rendering the collapsed list never updates keys");
  console.log("Lorebook keyword visibility render regressions passed.");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
