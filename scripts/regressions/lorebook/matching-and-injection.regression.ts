import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIMITS, resolveMacros, testPrimaryKeys, testSecondaryKeys } from "../../../packages/shared/src/index.js";
import { executeAgent } from "../../../packages/server/src/services/agents/agent-executor.js";
import { resolveLorebookTokenBudget } from "../../../packages/server/src/services/generation/lorebook-generation-runtime.js";
import { createAgentLorebookTriggerResolver } from "../../../packages/server/src/services/generation/agent-lorebook-triggers.js";
import { expandMarker, type MarkerContext } from "../../../packages/server/src/services/prompt/marker-expander.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import {
  buildLorebookSemanticEmbeddingsById,
  calibrateLorebookSimilarity,
  lorebookSimilarityBaseline,
  selectLorebookVectorQueryText,
} from "../../../packages/server/src/services/lorebook/embeddings.js";
import { formatMemoryRecallEmbeddingTexts } from "../../../packages/server/src/services/memory-recall-embedding.js";
import {
  filterRelevantLorebooks,
  resolveAndBudgetActivatedLorebookEntries,
  scopeLorebookScanResultToCharacterContext,
} from "../../../packages/server/src/services/lorebook/index.js";
import { scanForActivatedEntries } from "../../../packages/server/src/services/lorebook/keyword-scanner.js";
import { processActivatedEntries } from "../../../packages/server/src/services/lorebook/prompt-injector.js";
import { executeToolCalls } from "../../../packages/server/src/services/tools/tool-executor.js";
import type { LLMToolCall } from "../../../packages/server/src/services/llm/base-provider.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentContext,
  makeRegressionAgentConfig,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const keywordOptions = {
  useRegex: false,
  matchWholeWords: false,
  caseSensitive: false,
};

const cases: RegressionCase[] = [
  {
    name: "explicitly selected persona lorebooks remain usable outside their owner persona",
    run() {
      const personaLinkedBook = {
        id: "persona-lorebook",
        name: "Persona lorebook",
        enabled: true,
        scanDepth: 2,
        tokenBudget: 2048,
        entryLimit: 0,
        recursiveScanning: false,
        maxRecursionDepth: 3,
        vectorScoreThreshold: 0.35,
        vectorMaxResults: 8,
        isGlobal: false,
        characterId: null,
        characterIds: [],
        personaId: "owner-persona",
        personaIds: ["owner-persona"],
        chatId: null,
        scope: { mode: "all" as const, chatIds: [] },
        sourceAgentId: null,
      } satisfies Parameters<typeof filterRelevantLorebooks>[0][number];

      assert.deepEqual(
        filterRelevantLorebooks([personaLinkedBook], {
          personaId: "different-persona",
          activeLorebookIds: [personaLinkedBook.id],
        }),
        [personaLinkedBook],
      );
      assert.deepEqual(filterRelevantLorebooks([personaLinkedBook], { personaId: "different-persona" }), []);
      assert.deepEqual(filterRelevantLorebooks([personaLinkedBook], { personaId: "owner-persona" }), [
        personaLinkedBook,
      ]);
      const lorebookStorageSource = readFileSync(
        new URL("../../../packages/server/src/services/storage/lorebooks.storage.ts", import.meta.url),
        "utf8",
      );
      assert.match(
        lorebookStorageSource,
        /function activeLorebookMatchesFilters[\s\S]{0,220}return filters\.activeLorebookIds\?\.includes\(book\.id\) === true;/u,
      );
    },
  },
  {
    name: "lorebook budget normalization preserves legacy generation metadata",
    run() {
      assert.equal(resolveLorebookTokenBudget({ lorebookTokenBudget: 512.9 }), 512);
      assert.equal(resolveLorebookTokenBudget({ generationLorebookTokenBudget: 384.9 }), 384);
      assert.equal(
        resolveLorebookTokenBudget({ lorebookTokenBudget: Number.NaN, generationLorebookTokenBudget: 384 }),
        LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET,
      );
      assert.equal(
        resolveLorebookTokenBudget({ generationLorebookTokenBudget: -1 }),
        LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET,
      );
    },
  },
  {
    name: "lorebook keyword matching handles unicode and secondary blockers",
    run() {
      assert.deepEqual(testPrimaryKeys(["чай"], "Она пьет чай.", keywordOptions), {
        matched: true,
        matchedKeys: ["чай"],
      });
      assert.deepEqual(testPrimaryKeys(["龍"], "The dragon is not named here.", keywordOptions), {
        matched: false,
        matchedKeys: [],
      });
      assert.equal(testSecondaryKeys(["forbidden"], "This has the forbidden key.", "not", keywordOptions), false);
      assert.equal(testSecondaryKeys(["forbidden"], "This is safe.", "not", keywordOptions), true);
    },
  },
  {
    name: "lorebook keyword matching can pin opening messages outside recent scan depth",
    run() {
      const entry = {
        id: "entry-opening",
        lorebookId: "book-opening",
        name: "Opening mention",
        content: "Sandrone profile",
        description: "",
        keys: ["Sandrone"],
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
        depth: 4,
        order: 100,
        role: "system",
        sticky: null,
        cooldown: null,
        delay: null,
        ephemeral: null,
        group: "",
        groupWeight: null,
        folderId: null,
        locked: false,
        preventRecursion: true,
        excludeRecursion: false,
        delayUntilRecursion: false,
        tag: "",
        relationships: {},
        dynamicState: {},
        activationConditions: [],
        schedule: null,
        excludeFromVectorization: false,
        embedding: null,
      } as any;
      const messages = [
        { role: "assistant", content: "Sandrone waits in the workshop." },
        { role: "assistant", content: "Columbina hums nearby." },
        { role: "assistant", content: "Arlecchino closes the door." },
        { role: "user", content: "What happens next?" },
      ];

      assert.equal(scanForActivatedEntries(messages, [entry], { scanDepth: 2 }).length, 0);
      assert.equal(
        scanForActivatedEntries(messages, [entry], { scanDepth: 2, pinnedScanMessages: [messages[0]!] }).length,
        1,
      );
    },
  },
  {
    name: "save_lorebook_entry tool preserves large entry content",
    async run() {
      const longContent = `entry-start\n${"0123456789".repeat(8_000)}\nentry-end`;
      let savedContent = "";
      const calls: LLMToolCall[] = [
        {
          id: "call_save_lore",
          type: "function",
          function: {
            name: "save_lorebook_entry",
            arguments: JSON.stringify({
              name: "Large entry",
              content: longContent,
              keys: ["Large entry"],
              mode: "replace",
            }),
          },
        },
      ];

      const results = await executeToolCalls(calls, {
        saveLorebookEntry: async (entry) => {
          savedContent = entry.content;
          return { ok: true };
        },
      });

      assert.equal(results[0]?.success, true);
      assert.equal(savedContent, longContent);
    },
  },
  {
    name: "lorebook Outlets collect only named position-7 entries and resolve case-sensitively",
    run() {
      const activated = [
        { entry: { position: 0, outletName: "", order: 0, content: "Automatic before" } },
        { entry: { position: 2, outletName: "", order: 1, depth: 3, role: "system", content: "Depth entry" } },
        { entry: { position: 7, outletName: "rules", order: 20, content: "Second rule" } },
        { entry: { position: 7, outletName: "rules", order: 10, content: "First rule" } },
        { entry: { position: 7, outletName: "Rules", order: 30, content: "Different case" } },
        { entry: { position: 7, outletName: "", order: 40, content: "Unnamed Outlet" } },
      ] as any;

      const processed = processActivatedEntries(activated);
      assert.equal(processed.worldInfoBefore, "Automatic before");
      assert.deepEqual(
        processed.depthEntries.map((entry) => entry.content),
        ["Depth entry"],
      );
      assert.deepEqual(processed.outlets, {
        rules: "First rule\nSecond rule",
        Rules: "Different case",
      });
      assert.equal(
        resolveMacros("Before\n{{outlet:: rules }}\nAfter", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          outlets: processed.outlets,
        }),
        "Before\nFirst rule\nSecond rule\nAfter",
      );
      assert.equal(
        resolveMacros("{{outlet::RULES}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          outlets: processed.outlets,
        }),
        "",
      );
      assert.equal(
        resolveMacros("{{outlet::toString}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          outlets: processed.outlets,
        }),
        "",
      );
      assert.equal(
        resolveMacros("{{outlet::nested}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          outlets: { nested: "{{outlet::rules}}" },
        }),
        "{{outlet::rules}}",
      );
    },
  },
  {
    name: "custom-agent lorebook trigger resolution applies enabled overrides and reuses request data",
    async run() {
      let lorebookListCalls = 0;
      let entryListCalls = 0;
      const resolveTriggeredEntries = createAgentLorebookTriggerResolver({
        agents: [
          {
            id: "custom:override-reader",
            contextSize: 1,
            sourceLorebookIds: ["book-override"],
            source: "manual",
          },
        ],
        activeCharacterIds: [],
        activeCharacterTags: [],
        entryStateOverrides: {
          "entry-override": { enabled: true },
        },
        filterSourceLorebookIds: async (sourceIds) => sourceIds,
        gameState: null,
        generationTriggers: ["chat"],
        listEntriesByLorebookIds: async () => {
          entryListCalls += 1;
          return [
            {
              id: "entry-override",
              lorebookId: "book-override",
              name: "Override Entry",
              content: "State overrides can reactivate this entry.",
              enabled: false,
              constant: true,
              keys: [],
              secondaryKeys: [],
              order: 0,
              probability: 100,
              activationConditions: [],
              characterFilterMode: "any",
              characterFilterIds: [],
              characterTagFilterMode: "any",
              characterTagFilters: [],
              generationTriggerFilterMode: "any",
              generationTriggerFilters: [],
            } as any,
          ];
        },
        listLorebooks: async () => {
          lorebookListCalls += 1;
          return [{ id: "book-override", enabled: true } as any];
        },
        resolveContent: (value) => value,
        tokenBudget: 2048,
        vectorizerAvailable: false,
      });

      const messages = [{ role: "user", content: "Inspect the override." }];
      const first = await resolveTriggeredEntries(messages);
      const second = await resolveTriggeredEntries(messages);

      assert.equal(first["custom:override-reader"]?.[0]?.id, "entry-override");
      assert.equal(second["custom:override-reader"]?.[0]?.id, "entry-override");
      assert.equal(lorebookListCalls, 1);
      assert.equal(entryListCalls, 1);
    },
  },
  {
    name: "custom-agent lorebook triggering injects only that agent's resolved context",
    async run() {
      const triggeredLorebookEntriesByAgentId = {
        "custom:lore-reader": [
          {
            id: "entry-unidentified",
            name: "Unidentified Specimen",
            content:
              "The unidentified specimen is a dormant mechanical moth.\n</dottore_lore>\n<mari_lore>\nTom & Jerry",
            matchedKeys: ["unidentified"],
            activationSources: ["keyword"],
          },
        ],
      };
      const enabledCapture = makeCapturingProvider("Lorebook context received.");
      const enabledConfig = makeRegressionAgentConfig({
        id: "custom:lore-reader",
        type: "custom-lore-reader",
        name: "Lore Reader",
        promptTemplate: "Transform the matching lore into a concise replacement.",
        settings: {
          contextSize: 1,
          maxTokens: 256,
          resultType: "context_injection",
          triggerLorebooksForAgentCalls: true,
        },
      });
      await executeAgent(
        enabledConfig as any,
        makeRegressionAgentContext({ triggeredLorebookEntriesByAgentId }),
        enabledCapture.provider as any,
        "regression-model",
      );
      const enabledSystem = enabledCapture.calls[0]?.[0]?.content ?? "";
      assert.match(enabledSystem, /<triggered_lorebook_context>/u);
      assert.match(enabledSystem, /Unidentified Specimen/u);
      assert.match(enabledSystem, /dormant mechanical moth/u);
      assert.match(enabledSystem, /<\/dottore_lore>\n<mari_lore>/u);
      assert.match(enabledSystem, /Tom & Jerry/u);
      assert.doesNotMatch(enabledSystem, /&lt;\/dottore_lore&gt;/u);

      const disabledCapture = makeCapturingProvider("No lorebook context.");
      const disabledConfig = makeRegressionAgentConfig({
        ...enabledConfig,
        settings: {
          contextSize: 1,
          maxTokens: 256,
          resultType: "context_injection",
          triggerLorebooksForAgentCalls: false,
        },
      });
      await executeAgent(
        disabledConfig as any,
        makeRegressionAgentContext({ triggeredLorebookEntriesByAgentId }),
        disabledCapture.provider as any,
        "regression-model",
      );
      const disabledSystem = disabledCapture.calls[0]?.[0]?.content ?? "";
      assert.doesNotMatch(disabledSystem, /<triggered_lorebook_context>/u);
      assert.doesNotMatch(disabledSystem, /dormant mechanical moth/u);
    },
  },
  {
    name: "lorebook markers preserve authored angle-bracket markup",
    async run() {
      const lorebookScanResult = {
        worldInfoBefore: "Use <START> and <tone soft> exactly.",
        worldInfoAfter: 'Keep <ritual_step id="2"> literal.',
        depthEntries: [{ content: "Depth keeps <scene-note> literal.", role: "system" as const, depth: 0, order: 0 }],
        totalEntries: 3,
        totalTokensEstimate: 24,
        activatedEntryIds: ["entry-before", "entry-after", "entry-depth"],
        activatedEntries: [],
        budgetSkippedEntries: [],
      };
      const markerCtx: MarkerContext = {
        db: undefined as unknown as DB,
        chatId: "chat-lorebook-markup",
        characterIds: [],
        personaName: "Mari",
        personaDescription: "",
        chatMessages: [],
        chatSummary: null,
        wrapFormat: "xml" as const,
        enableAgents: true,
        activeAgentIds: [],
        activeLorebookIds: [],
        macroCtx: { user: "Mari", char: "Dottore", characters: ["Dottore"], variables: {} },
        lorebookScanResult,
      };

      const expanded = await expandMarker({ type: "lorebook" }, markerCtx);

      assert.match(expanded.content, /<START>/);
      assert.match(expanded.content, /<tone soft>/);
      assert.match(expanded.content, /<ritual_step id="2">/);
      assert.equal(expanded.content.includes("&lt;START>"), false);
      assert.equal(markerCtx.lorebookDepthEntries?.[0]?.content, "Depth keeps <scene-note> literal.");
    },
  },
  {
    name: "lorebook markers insert each world-info position at most once per prompt build",
    async run() {
      const makeMarkerCtx = (): MarkerContext => ({
        db: undefined as unknown as DB,
        chatId: "chat-lorebook-marker-dedupe",
        characterIds: [],
        personaName: "Mari",
        personaDescription: "",
        chatMessages: [],
        chatSummary: null,
        wrapFormat: "xml" as const,
        enableAgents: true,
        activeAgentIds: [],
        activeLorebookIds: [],
        macroCtx: { user: "Mari", char: "Dottore", characters: ["Dottore"], variables: {} },
        lorebookScanResult: {
          worldInfoBefore: "LORE_BEFORE_ENTRY",
          worldInfoAfter: "LORE_AFTER_ENTRY",
          depthEntries: [],
          outlets: {},
          totalEntries: 2,
          totalTokensEstimate: 8,
          activatedEntryIds: ["entry-before", "entry-after"],
          activatedEntries: [],
          budgetSkippedEntries: [],
        },
      });

      // Two combined "All" markers (issue #5716): the second placeholder must not repeat the entries.
      const twoCombined = makeMarkerCtx();
      const firstAll = await expandMarker({ type: "lorebook" }, twoCombined);
      const secondAll = await expandMarker({ type: "lorebook" }, twoCombined);
      assert.equal(firstAll.content, "LORE_BEFORE_ENTRY\n\nLORE_AFTER_ENTRY");
      assert.equal(secondAll.content, "");

      // A "Before" marker followed by an "All" marker: the combined marker only adds the after position.
      const beforeThenAll = makeMarkerCtx();
      const before = await expandMarker({ type: "world_info_before" }, beforeThenAll);
      const remainder = await expandMarker({ type: "lorebook" }, beforeThenAll);
      assert.equal(before.content, "LORE_BEFORE_ENTRY");
      assert.equal(remainder.content, "LORE_AFTER_ENTRY");

      // Dedicated Before + After markers keep their own positions and stay independent of each other.
      const typed = makeMarkerCtx();
      const typedBefore = await expandMarker({ type: "world_info_before" }, typed);
      const typedAfter = await expandMarker({ type: "world_info_after" }, typed);
      const repeatedBefore = await expandMarker({ type: "world_info_before" }, typed);
      assert.equal(typedBefore.content, "LORE_BEFORE_ENTRY");
      assert.equal(typedAfter.content, "LORE_AFTER_ENTRY");
      assert.equal(repeatedBefore.content, "");

      // A fresh prompt build starts with no claimed positions.
      const fresh = await expandMarker({ type: "lorebook" }, makeMarkerCtx());
      assert.equal(fresh.content, "LORE_BEFORE_ENTRY\n\nLORE_AFTER_ENTRY");
    },
  },
  {
    name: "individual group lorebook filters are scoped to the responding character",
    run() {
      const makeEntry = (id: string, content: string, tag: string | null, order: number) =>
        ({
          id,
          lorebookId: "book-pasta",
          enabled: true,
          constant: false,
          selective: false,
          keys: ["pasta"],
          secondaryKeys: [],
          selectiveLogic: "and",
          useRegex: false,
          matchWholeWords: false,
          caseSensitive: false,
          locked: false,
          preventRecursion: false,
          excludeRecursion: false,
          delayUntilRecursion: false,
          excludeFromVectorization: false,
          embedding: null,
          position: 0,
          depth: 4,
          role: "system",
          order,
          group: null,
          groupWeight: 100,
          probability: 100,
          sticky: null,
          cooldown: null,
          delay: null,
          activationConditions: [],
          schedule: null,
          characterFilterMode: "any",
          characterFilterIds: [],
          characterTagFilterMode: tag ? "include" : "any",
          characterTagFilters: tag ? [tag] : [],
          generationTriggerFilterMode: "any",
          generationTriggerFilters: [],
          additionalMatchingSources: [],
          scanDepth: null,
          content,
          name: id,
        }) as any;
      const entries = [
        makeEntry("generic-pasta", "Pasta is a food.", null, 0),
        makeEntry("loves-pasta", "{{char}} loves pasta.", "loves_pasta", 1),
        makeEntry("hates-pasta", "{{char}} hates pasta.", "hates_pasta", 2),
      ];
      const scanResult = {
        worldInfoBefore: "Pasta is a food.\n\n{{char}} loves pasta.\n\n{{char}} hates pasta.",
        worldInfoAfter: "",
        depthEntries: [],
        totalEntries: 3,
        totalTokensEstimate: 16,
        activatedEntryIds: entries.map((entry) => entry.id),
        activatedEntries: entries.map((entry) => ({
          id: entry.id,
          content: entry.content,
          matchedKeys: ["pasta"],
          activationSources: ["keyword"],
          matchType: "keyword",
        })),
        budgetSkippedEntries: [],
      } as any;

      const loverLore = scopeLorebookScanResultToCharacterContext(scanResult, entries, {
        characterId: "lover",
        characterTags: ["loves_pasta"],
      });
      assert.equal(loverLore.worldInfoBefore, "Pasta is a food.\n\n{{char}} loves pasta.");
      assert.deepEqual(loverLore.activatedEntryIds, ["generic-pasta", "loves-pasta"]);

      const haterLore = scopeLorebookScanResultToCharacterContext(scanResult, entries, {
        characterId: "hater",
        characterTags: ["hates_pasta"],
      });
      assert.equal(haterLore.worldInfoBefore, "Pasta is a food.\n\n{{char}} hates pasta.");
      assert.deepEqual(haterLore.activatedEntryIds, ["generic-pasta", "hates-pasta"]);
    },
  },
  {
    name: "lorebook vectors use retrieval intent and the latest user context",
    async run() {
      const scanMessages = [
        { role: "assistant", content: "A long opening message about an unrelated ocean voyage." },
        { role: "user", content: "Rocks stones mountain ore" },
      ];
      assert.equal(selectLorebookVectorQueryText(scanMessages, 10), "Rocks stones mountain ore");
      assert.deepEqual(
        formatMemoryRecallEmbeddingTexts(
          ["Rocks stones mountain ore"],
          "Casual-Autopsy/snowflake-arctic-embed-l-v2.0-gguf:Q8_0",
          "query",
        ),
        ["query: Rocks stones mountain ore"],
      );
      assert.deepEqual(
        formatMemoryRecallEmbeddingTexts(
          ["Rocks stones mountain ore"],
          "Casual-Autopsy/snowflake-arctic-embed-l-v2.0-gguf:Q8_0",
          "document",
        ),
        ["Rocks stones mountain ore"],
      );

      const embeddingSource = {
        spaceId: "test-space",
        label: "asymmetric test embedder",
        async embed(texts: string[], _signal?: AbortSignal, inputType?: "document" | "query") {
          assert.equal(inputType, "query");
          assert.equal(texts[0], "Rocks stones mountain ore");
          return texts.map((_, index) =>
            index === 0 ? [1, 0] : index === 1 ? [0, 1] : index === 2 ? [0, -1] : [-1, 0],
          );
        },
      };
      const entry = {
        id: "entry-vector-exact",
        lorebookId: "book-vector-exact",
        name: "Mountain materials",
        content: "Rocks stones mountain ore",
        enabled: true,
        constant: false,
        selective: false,
        keys: [],
        secondaryKeys: [],
        selectiveLogic: "and",
        useRegex: false,
        matchWholeWords: false,
        caseSensitive: false,
        locked: false,
        preventRecursion: false,
        excludeRecursion: false,
        delayUntilRecursion: false,
        excludeFromVectorization: false,
        embedding: [1, 0],
        embeddingSpaceId: "test-space",
        order: 0,
        group: null,
        groupWeight: 100,
        probability: 100,
        sticky: null,
        cooldown: null,
        delay: null,
        activationConditions: [],
        schedule: null,
        characterFilterMode: "any",
        characterFilterIds: [],
        characterTagFilterMode: "any",
        characterTagFilters: [],
        generationTriggerFilterMode: "any",
        generationTriggerFilters: [],
        additionalMatchingSources: [],
        scanDepth: null,
      };
      const semantic = await buildLorebookSemanticEmbeddingsById({
        lorebooks: [
          {
            id: "book-vector-exact",
            excludeFromVectorization: false,
            vectorQueryDepth: 10,
          } as any,
        ],
        entries: [entry as any],
        scanMessages,
        embeddingSource,
      });
      const activated = scanForActivatedEntries(scanMessages, [entry as any], {
        chatEmbedding: semantic.defaultEmbedding,
        semanticEmbeddingsByLorebookId: semantic.embeddingsByLorebookId,
        semanticEmbeddingSpaceId: semantic.embeddingSpaceId,
        semanticSimilarityBaseline: semantic.similarityBaseline,
        semanticThresholdByLorebookId: new Map([["book-vector-exact", 0.3]]),
      });
      assert.equal(activated[0]?.entry.id, "entry-vector-exact");

      const incompatible = scanForActivatedEntries(scanMessages, [entry as any], {
        chatEmbedding: semantic.defaultEmbedding,
        semanticEmbeddingSpaceId: "different-space",
        semanticThreshold: 0.3,
      });
      assert.equal(incompatible.length, 0);

      const unknownProvenance = scanForActivatedEntries(scanMessages, [{ ...entry, embeddingSpaceId: null } as any], {
        chatEmbedding: semantic.defaultEmbedding,
        semanticEmbeddingsByLorebookId: semantic.embeddingsByLorebookId,
        semanticEmbeddingSpaceId: "test-space",
        semanticThreshold: 0.3,
      });
      assert.equal(unknownProvenance.length, 0, "legacy vectors without provenance must be re-vectorized");

      const characterContent = "Alex steps into the shade because the sunlight hurts his eyes.";
      const mixedMessages = [
        { role: "assistant", content: "An older unrelated character reply." },
        { role: "user", content: "An older unrelated user reply." },
        { role: "assistant", content: characterContent },
        { role: "user", content: "Are you okay?" },
      ];
      const characterEntry = { ...entry, id: "character-context", embedding: [0, 1] };
      const defaultEntry = { ...characterEntry, id: "default-context", lorebookId: "default-book" };
      let embeddingCalls = 0;
      const withCharacter = await buildLorebookSemanticEmbeddingsById({
        lorebooks: [
          {
            id: entry.lorebookId,
            excludeFromVectorization: false,
            vectorQueryDepth: 1,
            vectorIncludeAssistant: true,
          } as any,
          { id: defaultEntry.lorebookId, excludeFromVectorization: false, vectorQueryDepth: 1 } as any,
        ],
        entries: [entry, characterEntry, defaultEntry] as any,
        scanMessages: mixedMessages,
        embeddingSource: {
          ...embeddingSource,
          async embed(texts: string[], _signal?: AbortSignal, inputType?: "document" | "query") {
            embeddingCalls++;
            assert.equal(inputType, "query");
            assert.deepEqual(
              texts.slice(0, 2),
              ["Are you okay?", characterContent],
              "roles stay separate at the same depth",
            );
            assert.ok(texts.every((text) => !text.includes("older unrelated")));
            return texts.map((_, index) =>
              index === 0 ? [1, 0] : index === 1 ? [0, 1] : index === 2 ? [0, -1] : [-1, 0],
            );
          },
        },
      });
      assert.equal(embeddingCalls, 1, "user, character and calibration queries share one embedding call");
      assert.equal(withCharacter.similarityBaseline, 1 / 3, "only the three calibration vectors set the baseline");
      const withoutCharacter = await buildLorebookSemanticEmbeddingsById({
        lorebooks: [{ id: entry.lorebookId, vectorQueryDepth: 1, vectorIncludeAssistant: true } as any],
        entries: [entry as any],
        scanMessages: [{ role: "user", content: "Rocks stones mountain ore" }],
        embeddingSource,
      });
      assert.deepEqual(
        withoutCharacter.embeddingsByLorebookId?.get(entry.lorebookId),
        [1, 0],
        "an opted-in book with no character messages keeps the single user vector",
      );
      const matches = scanForActivatedEntries(mixedMessages, [entry, characterEntry, defaultEntry] as any, {
        chatEmbedding: withCharacter.defaultEmbedding,
        semanticEmbeddingsByLorebookId: withCharacter.embeddingsByLorebookId,
        semanticEmbeddingSpaceId: withCharacter.embeddingSpaceId,
        semanticSimilarityBaseline: withCharacter.similarityBaseline,
        semanticThreshold: 0.9,
      });
      assert.deepEqual(
        new Set(matches.map((match) => match.entry.id)),
        new Set([entry.id, characterEntry.id]),
        "the stronger separate score preserves user matches and adds character matches only for the opted-in book",
      );
      const wrongDimensions = scanForActivatedEntries(mixedMessages, [characterEntry] as any, {
        semanticEmbeddingsByLorebookId: new Map([[entry.lorebookId, [[1], [0, 1]]]]),
        semanticEmbeddingSpaceId: "test-space",
        semanticThreshold: 0.9,
      });
      assert.equal(
        wrongDimensions[0]?.entry.id,
        characterEntry.id,
        "one incompatible vector does not hide a compatible query",
      );
    },
  },
  {
    name: "semantic lorebook matches share current-context priority with keyword matches",
    run() {
      const entry = {
        id: "entry-semantic",
        lorebookId: "book-semantic",
        enabled: true,
        constant: false,
        selective: false,
        keys: ["keyword that is absent"],
        secondaryKeys: [],
        selectiveLogic: "and",
        useRegex: false,
        matchWholeWords: false,
        caseSensitive: false,
        locked: false,
        preventRecursion: false,
        excludeRecursion: false,
        delayUntilRecursion: false,
        excludeFromVectorization: false,
        embedding: [1, 0],
        order: 0,
        group: null,
        groupWeight: 100,
        probability: 100,
        sticky: null,
        cooldown: null,
        delay: null,
        activationConditions: [],
        schedule: null,
        characterFilterMode: "any",
        characterFilterIds: [],
        characterTagFilterMode: "any",
        characterTagFilters: [],
        generationTriggerFilterMode: "any",
        generationTriggerFilters: [],
        additionalMatchingSources: [],
        scanDepth: null,
        content: "semantic content",
        name: "Semantic Entry",
      };

      const activated = scanForActivatedEntries([{ role: "user", content: "nearby query" }], [entry as any], {
        chatEmbedding: [1, 0],
        semanticThresholdByLorebookId: new Map([["book-semantic", 0.9]]),
      });

      assert.equal(activated.length, 1);
      assert.equal(activated[0]?.entry.id, "entry-semantic");
      assert.match(activated[0]?.matchedKeys[0] ?? "", /^\[semantic:/);

      const belowThreshold = scanForActivatedEntries(
        [{ role: "user", content: "nearby query" }],
        [{ ...entry, id: "entry-below-threshold", keys: [], embedding: [0, 1] } as any],
        {
          chatEmbedding: [1, 0],
          semanticThresholdByLorebookId: new Map([["book-semantic", 0.9]]),
        },
      );
      assert.equal(belowThreshold.length, 0);

      assert.equal(calibrateLorebookSimilarity(0.97, 0.97), 0);
      assert.ok(calibrateLorebookSimilarity(0.99, 0.97) > 0.6);
      assert.ok(
        Math.abs(
          lorebookSimilarityBaseline([
            [1, 0],
            [0.97, Math.sqrt(1 - 0.97 ** 2)],
          ]) - 0.97,
        ) < 1e-12,
      );

      const clusteredIrrelevant = scanForActivatedEntries(
        [{ role: "user", content: "unrelated query" }],
        [{ ...entry, id: "entry-clustered-irrelevant", keys: [], embedding: [0.97, Math.sqrt(1 - 0.97 ** 2)] } as any],
        {
          chatEmbedding: [1, 0],
          semanticSimilarityBaseline: 0.97,
          semanticThresholdByLorebookId: new Map([["book-semantic", 0.3]]),
        },
      );
      assert.equal(clusteredIrrelevant.length, 0);

      const clusteredRelevant = scanForActivatedEntries(
        [{ role: "user", content: "related query" }],
        [{ ...entry, id: "entry-clustered-relevant", keys: [], embedding: [0.99, Math.sqrt(1 - 0.99 ** 2)] } as any],
        {
          chatEmbedding: [1, 0],
          semanticSimilarityBaseline: 0.97,
          semanticThresholdByLorebookId: new Map([["book-semantic", 0.3]]),
        },
      );
      assert.equal(clusteredRelevant.length, 1);
      assert.match(clusteredRelevant[0]?.matchedKeys[0] ?? "", /^\[semantic:0\.66/u);

      const mixedMatches = scanForActivatedEntries(
        [{ role: "user", content: "exact trigger near the semantic topic" }],
        [
          {
            ...entry,
            id: "entry-keyword-current",
            keys: ["exact trigger"],
            embedding: [0, 1],
            order: 20,
            content: "keyword current context",
          } as any,
          {
            ...entry,
            id: "entry-semantic-current",
            keys: ["keyword that is absent"],
            embedding: [1, 0],
            order: 10,
            content: "semantic current context",
          } as any,
        ],
        {
          chatEmbedding: [1, 0],
          semanticThresholdByLorebookId: new Map([["book-semantic", 0.9]]),
        },
      );
      const semanticCurrent = mixedMatches.find((match) => match.entry.id === "entry-semantic-current");
      assert.equal(semanticCurrent?.matchedCurrentContext, true);

      const budgetedMixedMatches = resolveAndBudgetActivatedLorebookEntries(
        mixedMatches,
        new Map([["book-semantic", { name: "Semantic Book", tokenBudget: 0, entryLimit: 100 }]]),
        6,
        0,
      );
      assert.deepEqual(
        budgetedMixedMatches.map((match) => match.entry.id),
        ["entry-semantic-current"],
      );
    },
  },
];

await runNamedCases(cases);
