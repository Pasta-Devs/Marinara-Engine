// English wording in the locale catalog for labels that were once wrong: the lorebook position labels and their
// tooltip, the curly quotes in the colour previews, and the Assistant Prefill placeholder.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const lorebookEnglishLocale = JSON.parse(
  readFileSync(join(REPOSITORY_ROOT, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, unknown>;
assert.equal(lorebookEnglishLocale["ui.lorebooks.lorebookentryrow.beforeCharacter"], "Before character definitions");
assert.equal(lorebookEnglishLocale["ui.lorebooks.lorebookentryrow.afterCharacter"], "After character definitions");
assert.equal(lorebookEnglishLocale["ui.lorebooks.lorebookentryrow.beforeCompact"], "↑Char");
assert.equal(lorebookEnglishLocale["ui.lorebooks.lorebookentryrow.afterCompact"], "↓Char");
assert.match(
  String(lorebookEnglishLocale["ui.lorebooks.lorebookentryrow.positionInThePromptBeforeCharacterAfterCharacterOr"]),
  /Before Character Definitions, After Character Definitions/u,
);
const englishLocale = JSON.parse(
  readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
) as Record<string, string>;
assert.equal(englishLocale["ui.characters.colorstab.ldquoHelloThereRdquo"], "“Hello there.”");
assert.equal(englishLocale["ui.personas.personacolorstab.ldquoGeneralKenobiRdquo"], "“General Kenobi.”");
assert.equal(englishLocale["ui.ui.generationparametersfields.thinking"], "{{value1}}thinking{{value2}}");
