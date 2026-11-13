import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildInlineNameColorMap,
  resolvePersonaInlineNames,
} from "../../packages/client/src/lib/inline-name-colors.ts";

const kate = { name: "Kate", convoDisplayName: "Katie", nameAliases: ["Kitty", "  "], nameColor: "#ff0000" };
const persona = { name: "Clark", convoDisplayName: "CK", nameAliases: ["Kal-El", "Mr. Kent"], nameColor: "#0000ff" };

const entries = (map: Map<string, string> | null) => (map ? Object.fromEntries(map) : null);

// Characters only: unchanged from before the persona switch.
assert.deepEqual(
  entries(buildInlineNameColorMap({ characters: [kate], persona, colorCharacters: true, colorPersona: false })),
  {
    kate: "#ff0000",
    katie: "#ff0000",
    kitty: "#ff0000",
  },
);

// Persona on: its name, display name and other names, lowercased and trimmed.
assert.deepEqual(
  entries(buildInlineNameColorMap({ characters: [kate], persona, colorCharacters: true, colorPersona: true })),
  {
    kate: "#ff0000",
    katie: "#ff0000",
    kitty: "#ff0000",
    clark: "#0000ff",
    ck: "#0000ff",
    "kal-el": "#0000ff",
    "mr. kent": "#0000ff",
  },
);

// Persona alone (character coloring off) still colors the persona.
assert.deepEqual(
  entries(buildInlineNameColorMap({ characters: [kate], persona, colorCharacters: false, colorPersona: true })),
  {
    clark: "#0000ff",
    ck: "#0000ff",
    "kal-el": "#0000ff",
    "mr. kent": "#0000ff",
  },
);

// A character with the same name wins, even when character coloring is off or it has no color.
const clashing = { ...persona, nameAliases: ["kitty", "Kal-El"] };
assert.equal(
  buildInlineNameColorMap({ characters: [kate], persona: clashing, colorCharacters: true, colorPersona: true })?.get(
    "kitty",
  ),
  "#ff0000",
);
assert.equal(
  buildInlineNameColorMap({ characters: [kate], persona: clashing, colorCharacters: false, colorPersona: true })?.has(
    "kitty",
  ),
  false,
);
assert.equal(
  buildInlineNameColorMap({ characters: [{ name: "Clark" }], persona, colorCharacters: true, colorPersona: true })?.has(
    "clark",
  ),
  false,
);

// No persona, a persona without a name color, or both switches off: nothing for the persona.
assert.equal(
  buildInlineNameColorMap({ characters: [], persona: null, colorCharacters: true, colorPersona: true }),
  null,
);
assert.equal(
  buildInlineNameColorMap({
    characters: [],
    persona: { ...persona, nameColor: "" },
    colorCharacters: true,
    colorPersona: true,
  }),
  null,
);
assert.equal(
  buildInlineNameColorMap({ characters: [kate], persona, colorCharacters: false, colorPersona: false }),
  null,
);

// toColor flattens every color it paints.
assert.deepEqual(
  [
    ...new Set(
      buildInlineNameColorMap({
        characters: [kate],
        persona,
        colorCharacters: true,
        colorPersona: true,
        toColor: () => "#111",
      })!.values(),
    ),
  ],
  ["#111"],
);

// The persona switch: its own value when set, otherwise whatever the character switch resolved to.
assert.equal(resolvePersonaInlineNames(undefined, true), true);
assert.equal(resolvePersonaInlineNames(undefined, false), false);
assert.equal(resolvePersonaInlineNames(false, true), false);
assert.equal(resolvePersonaInlineNames(true, false), true);
assert.equal(resolvePersonaInlineNames("yes", false), false);

// Wiring: both the message renderer and the settings switch resolve the persona setting the same way.
for (const file of ["components/chat/ChatMessage.tsx", "features/chat-settings/ChatSettingsDrawer.tsx"]) {
  const source = readFileSync(new URL("../../packages/client/src/" + file, import.meta.url), "utf8");
  assert.match(source, /resolvePersonaInlineNames\(/, file);
}
const chatMessage = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url),
  "utf8",
);
assert.match(chatMessage, /buildInlineNameColorMap\(\{[\s\S]*?persona: personaInfo,/);

console.log("inline-name-colors regression passed");
