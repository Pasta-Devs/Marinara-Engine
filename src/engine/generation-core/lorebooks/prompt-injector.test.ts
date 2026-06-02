import { describe, expect, it } from "vitest";

import type { LorebookEntry } from "../../contracts/types/lorebook";
import { scanForActivatedEntries } from "./keyword-scanner";
import { applyTokenBudgetWithSkipped } from "./prompt-injector";

function entry(overrides: Partial<LorebookEntry> & Pick<LorebookEntry, "id" | "name" | "keys" | "content" | "order">): LorebookEntry {
  const { id, name, keys, content, order, ...rest } = overrides;
  return {
    id,
    lorebookId: "book",
    name,
    content,
    description: "",
    keys,
    secondaryKeys: [],
    enabled: true,
    constant: false,
    selective: false,
    selectiveLogic: "and",
    probability: null,
    scanDepth: null,
    matchWholeWords: true,
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
    order,
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
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    ...rest,
  };
}

describe("applyTokenBudgetWithSkipped", () => {
  it("keeps latest user-message primary-key matches ahead of older context matches", () => {
    const activated = scanForActivatedEntries(
      [
        { role: "user", content: "Earlier chat mentioned old-key." },
        { role: "assistant", content: "Acknowledged." },
        { role: "user", content: "Now the current turn mentions new-key." },
      ],
      [
        entry({
          id: "older-context",
          name: "Older context",
          keys: ["old-key"],
          content: "older context lore",
          order: 10,
        }),
        entry({
          id: "latest-user",
          name: "Latest user",
          keys: ["new-key"],
          content: "latest user lore",
          order: 20,
        }),
      ],
    );

    const budgeted = applyTokenBudgetWithSkipped(activated, 5);

    expect(budgeted.includedEntries.map((activatedEntry) => activatedEntry.entry.id)).toEqual(["latest-user"]);
    expect(budgeted.skippedEntries.map((skipped) => skipped.activatedEntry.entry.id)).toEqual(["older-context"]);
  });
});
