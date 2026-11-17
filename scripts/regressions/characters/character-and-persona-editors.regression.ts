// The character and persona editors: personas hide the character-only Convo Behavior control, a gallery delete
// reports failure, a second sprite pick waits for the running upload, and the galleries share one layout. Also
// avatar crops, sprite downloads, the phone layout of the sprite controls, the versioning switch and the header
// avatar's click area. Reads component source until a test can drive these; most need browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const characterEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/characters/CharacterEditor.tsx", import.meta.url),
  "utf8",
);
const personaEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/personas/PersonaEditor.tsx", import.meta.url),
  "utf8",
);
const convoProfileFieldsSource = readFileSync(
  new URL("../../../packages/client/src/components/characters/ConvoProfileFields.tsx", import.meta.url),
  "utf8",
);
for (const editorSource of [characterEditorSource, personaEditorSource]) {
  assert.match(editorSource, /<CardEditor\b/u);
  assert.match(editorSource, /<CardColors\b/u);
  assert.match(editorSource, /grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4/u);
  assert.match(editorSource, /onClick=\{\(\) => void handleDelete\(lightbox\)\}/u);
  assert.match(editorSource, /loading="lazy"\s+decoding="async"/u);
  assert.match(editorSource, /group-\[&:focus-within\]:opacity-100/u);
}
assert.match(characterEditorSource, /await remove\.mutateAsync\(image\.id\)/u);
assert.match(
  convoProfileFieldsSource,
  /\{kind === "character" && \(\s*<div className="mari-editor-panel space-y-3 p-3">[\s\S]*?convoBehavior/u,
  "Persona editors must not render the character-only Convo Behavior control",
);
assert.match(characterEditorSource, /if \(uploading \|\| !expression\) return;/u);
assert.match(personaEditorSource, /if \(uploading \|\| !expression\) return;/u);

const cardEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/cards/CardEditor.tsx", import.meta.url),
  "utf8",
);
assert.match(characterEditorSource, /ui\.characters\.charactergallerytab\.failedToDeleteCharacterImage/u);
assert.match(characterEditorSource, /getAvatarCropStyle/u);
assert.match(characterEditorSource, /downloadSpriteFile/u);
assert.match(personaEditorSource, /downloadSpriteFile/u);
assert.match(
  characterEditorSource,
  /className="grid grid-cols-2 items-stretch gap-2 md:flex md:flex-wrap md:items-center"/u,
);
assert.match(personaEditorSource, /className="flex flex-col gap-2 sm:flex-row"/u);
assert.match(
  characterEditorSource,
  /<SettingsSwitch\s+checked=\{formData\.extensions\.versioningEnabled !== false\}/u,
  "Character versioning must use the shared aligned settings switch",
);
assert.match(
  personaEditorSource,
  /<SettingsSwitch\s+checked=\{formData\.versioningEnabled\}/u,
  "Persona versioning must use the shared aligned settings switch",
);
assert.equal(
  cardEditorSource.match(/className="pointer-events-none h-full w-full object-cover"/gu)?.length,
  1,
  "The shared header avatar inside its upload target must not intercept page clicks",
);
