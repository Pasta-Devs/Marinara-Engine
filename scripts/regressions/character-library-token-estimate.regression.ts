import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateCharacterCardTokens } from "../../packages/shared/src/utils/character-token-estimator.js";

const fullCard = {
  name: "Catalog Character",
  description: "short description",
  mes_example: "a much longer example dialogue that is absent from the compact catalog row",
  alternate_greetings: ["first alternate greeting", "second alternate greeting"],
  system_prompt: "character-specific system prompt",
  post_history_instructions: "instructions after chat history",
  extensions: {
    backstory: "extended backstory",
    appearance: "detailed appearance",
    world: "world information",
    depth_prompt: { prompt: "depth prompt" },
  },
  character_book: {
    name: "Character lore",
    description: "Lorebook description",
    entries: [
      {
        name: "Entry",
        comment: "Comment",
        content: "Lorebook content",
        keys: ["primary key"],
        secondary_keys: ["secondary key"],
      },
    ],
  },
};

const compactFieldsOnly = {
  name: fullCard.name,
  description: fullCard.description,
};
assert.ok(
  estimateCharacterCardTokens(fullCard) > estimateCharacterCardTokens(compactFieldsOnly),
  "the full-card estimate must include text omitted from compact catalog rows",
);
const compactEstimate = estimateCharacterCardTokens(compactFieldsOnly);
for (const field of ["mes_example", "alternate_greetings", "system_prompt", "post_history_instructions"] as const) {
  assert.ok(
    estimateCharacterCardTokens({ ...compactFieldsOnly, [field]: fullCard[field] }) > compactEstimate,
    `${field} contributes independently to the full-card estimate`,
  );
}
for (const field of ["backstory", "appearance", "world", "depth_prompt"] as const) {
  assert.ok(
    estimateCharacterCardTokens({ ...compactFieldsOnly, extensions: { [field]: fullCard.extensions[field] } }) > compactEstimate,
    `extensions.${field} contributes independently to the full-card estimate`,
  );
}
assert.ok(
  estimateCharacterCardTokens({ ...compactFieldsOnly, character_book: { entries: fullCard.character_book.entries } }) > compactEstimate,
  "character-book entries contribute without relying on the book title or description",
);

const catalogSource = readFileSync(
  new URL("../../packages/server/src/services/storage/character-catalog.ts", import.meta.url),
  "utf8",
);
assert.match(
  catalogSource,
  /tokenEstimate:\s*estimateCharacterCardTokens\(data\)/u,
  "the cached catalog must calculate the estimate while the full card is available",
);

const librarySource = readFileSync(
  new URL("../../packages/client/src/components/characters/CharacterLibraryView.tsx", import.meta.url),
  "utf8",
);
assert.match(
  librarySource,
  /tokenEstimate:\s*char\.tokenEstimate\s*\?\?\s*estimateCharacterCardTokens\(char\.parsed\)/u,
  "the paginated library must use the cached full-card estimate and retain the full-detail fallback",
);

const charactersPanelSource = readFileSync(
  new URL("../../packages/client/src/components/panels/CharactersPanel.tsx", import.meta.url),
  "utf8",
);
assert.match(
  charactersPanelSource,
  /const tokenEstimate = char\.tokenEstimate;/u,
  "the character panel root rows must display the catalog estimate",
);
assert.match(
  charactersPanelSource,
  /const memberTokenEstimate = fullMember\?\.tokenEstimate \?\? null;/u,
  "the character panel folder rows must display the catalog estimate",
);
assert.doesNotMatch(
  charactersPanelSource,
  /estimateCharacterCardTokens\((?:char|fullMember)\.parsed\)/u,
  "the character panel must not recalculate token badges from compact catalog fields",
);
