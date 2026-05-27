import { describe, expect, it } from "vitest";
import type { LorebookEntry } from "../../contracts/types/lorebook";
import { scanForActivatedEntries } from "./keyword-scanner";

function lorebookEntry(overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    id: "entry",
    lorebookId: "book",
    name: "Entry",
    content: "Entry content.",
    description: "",
    keys: ["needle"],
    secondaryKeys: [],
    enabled: true,
    constant: false,
    selective: false,
    selectiveLogic: "and",
    probability: null,
    scanDepth: null,
    matchWholeWords: false,
    caseSensitive: false,
    useRegex: false,
    characterFilterMode: "any",
    characterFilterIds: [],
    characterTagFilterMode: "any",
    characterTagFilters: [],
    generationTriggerFilterMode: "any",
    generationTriggerFilters: [],
    additionalMatchingSources: [],
    position: 0,
    depth: 0,
    order: 0,
    role: "system",
    sticky: null,
    cooldown: null,
    delay: null,
    ephemeral: null,
    group: "",
    groupWeight: null,
    folderId: null,
    locked: false,
    preventRecursion: false,
    tag: "",
    relationships: {},
    dynamicState: {},
    activationConditions: [],
    schedule: null,
    excludeFromVectorization: false,
    embedding: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("scanForActivatedEntries vector exclusions", () => {
  it("does not activate excluded entries through semantic fallback", () => {
    const entries = [
      lorebookEntry({
        keys: ["absent-key"],
        excludeFromVectorization: true,
        embedding: [1, 0],
      }),
    ];

    const activated = scanForActivatedEntries([{ role: "user", content: "No keyword match here." }], entries, {
      chatEmbedding: [1, 0],
      semanticThreshold: 0.5,
    });

    expect(activated).toHaveLength(0);
  });

  it("still activates excluded entries through keyword matching", () => {
    const entries = [lorebookEntry({ excludeFromVectorization: true, embedding: [1, 0] })];

    const activated = scanForActivatedEntries([{ role: "user", content: "The needle is visible." }], entries, {
      chatEmbedding: [0, 1],
      semanticThreshold: 0.5,
    });

    expect(activated.map((entry) => entry.entry.id)).toEqual(["entry"]);
    expect(activated[0]?.matchedKeys).toEqual(["needle"]);
  });
});
