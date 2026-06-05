import { describe, expect, it } from "vitest";

import type { LorebookEntry } from "../../contracts/types/lorebook";
import { scanForActivatedEntries } from "./keyword-scanner";
import { injectAtDepth, processActivatedEntries, type PromptMessage } from "./prompt-injector";

function entry(
  overrides: Partial<LorebookEntry> & Pick<LorebookEntry, "id" | "name" | "keys" | "content" | "order">,
): LorebookEntry {
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

describe("processActivatedEntries", () => {
  it("keeps latest user-message primary-key matches ahead of older context matches", async () => {
    const activated = await scanForActivatedEntries(
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

    const budgeted = processActivatedEntries(activated, 5);

    expect(budgeted.includedEntries.map((activatedEntry) => activatedEntry.entry.id)).toEqual(["latest-user"]);
    expect(budgeted.skippedEntries.map((skipped) => skipped.activatedEntry.entry.id)).toEqual(["older-context"]);
  });
});

describe("injectAtDepth", () => {
  it("anchors depth entries to provided chat history bounds", () => {
    const messages: PromptMessage[] = [
      { role: "system", content: "system prompt", contextKind: "prompt" },
      { role: "user", content: "history 1", contextKind: "history" },
      { role: "system", content: "context before latest user", contextKind: "prompt" },
      { role: "user", content: "history 2", contextKind: "history" },
      { role: "system", content: "post-history reminder", contextKind: "prompt" },
    ];

    const result = injectAtDepth(
      messages,
      [
        { role: "system", content: "depth 0", depth: 0 },
        { role: "system", content: "depth 1", depth: 1 },
        { role: "system", content: "too deep", depth: 99 },
      ],
      { minIndex: 1, anchorIndex: 4 },
    );

    expect(result.map((message) => message.content)).toEqual([
      "system prompt",
      "too deep",
      "history 1",
      "context before latest user",
      "depth 1",
      "history 2",
      "depth 0",
      "post-history reminder",
    ]);
  });

  it("falls back to the full prompt length when no bounds are provided", () => {
    const messages: PromptMessage[] = [
      { role: "system", content: "system prompt", contextKind: "prompt" },
      { role: "user", content: "history 1", contextKind: "history" },
      { role: "system", content: "post-history reminder", contextKind: "prompt" },
    ];

    const result = injectAtDepth(messages, [{ role: "system", content: "depth 0", depth: 0 }]);

    expect(result.map((message) => message.content)).toEqual([
      "system prompt",
      "history 1",
      "post-history reminder",
      "depth 0",
    ]);
  });
});
