import assert from "node:assert/strict";

// #8030: Game narration HTML is cached so a long Session Log opens quickly. The HTML carries
// translated text (the item-used badge), so a language switch or a reloaded translation must never
// replay HTML built from the old text, even when the language code stays the same.
const { i18n, translate } = await import("../../packages/client/src/localization/i18n.js");
const { createNarrationHtmlCache } = await import("../../packages/client/src/components/game/narration-html-cache.js");

const KEY = "game.narration.itemUsed";
i18n.addResourceBundle("en", "translation", { [KEY]: "Item used" });
i18n.addResourceBundle("fr", "translation", { [KEY]: "Objet utilisé" });
await i18n.changeLanguage("fr");

let builds = 0;
const html = createNarrationHtmlCache((content, textEffectsEnabled) => {
  builds++;
  return `${translate(KEY)}|${textEffectsEnabled}|${content}`;
}, 3);

assert.equal(html("[item_used] potion", true), "Objet utilisé|true|[item_used] potion");
assert.equal(html("[item_used] potion", true), "Objet utilisé|true|[item_used] potion");
assert.equal(builds, 1, "the same text and effects setting is built once");
assert.equal(html("[item_used] potion", false), "Objet utilisé|false|[item_used] potion");
assert.equal(builds, 2, "the effects setting is part of the key");

// activateLocale(locale, true) removes the bundle, then adds the reloaded one under the same code.
i18n.removeResourceBundle("fr", "translation");
assert.equal(html("[item_used] potion", true), "Item used|true|[item_used] potion", "removal clears the cache");
i18n.addResourceBundle("fr", "translation", { [KEY]: "Objet employé" });
assert.equal(html("[item_used] potion", true), "Objet employé|true|[item_used] potion", "a reload clears the cache");

await i18n.changeLanguage("en");
assert.equal(html("[item_used] potion", true), "Item used|true|[item_used] potion", "a language switch clears it");

// Bounded: the oldest entry goes first.
builds = 0;
html("a", true);
html("b", true);
html("c", true);
html("d", true);
html("d", true);
assert.equal(builds, 4);
html("a", true);
assert.equal(builds, 5, "the oldest entry was dropped to stay within the limit");

console.log("game narration HTML cache regression passed");
