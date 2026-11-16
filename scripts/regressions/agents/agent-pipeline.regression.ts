import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  characterTrackerLockKey,
  type AgentContext,
  getDefaultAgentPrompt,
} from "../../../packages/shared/src/index.js";
import {
  normalizeCyoaChoiceOutput,
  normalizeCyoaDialogueQuotes,
} from "../../../packages/server/src/services/agents/cyoa-choice-normalization.js";
import { formatSeparateAgentInjection } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  compactGameStateForAgentContext,
  executeAgent,
  executeAgentBatch,
  formatAgentMainResponseForPrompt,
} from "../../../packages/server/src/services/agents/agent-executor.js";
import { shouldSkipAgentByMessageInterval } from "../../../packages/server/src/services/generation/agent-cadence.js";
import {
  DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY,
  buildDirectorSecretPlotAgent,
  shouldRunDirectorSecretPlotMaintenance,
} from "../../../packages/server/src/services/generation/director-secret-plot-runtime.js";
import { NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT } from "../../../packages/shared/src/constants/agent-prompts.js";
import {
  runParallelAgents,
  runPreGenerationAgents,
  type ResolvedAgent,
} from "../../../packages/server/src/services/agents/agent-pipeline.js";
import { buildLegacyDefaultAgentConfigUpdate } from "../../../packages/server/src/services/agents/default-prompt-migration.js";
import {
  buildRuntimeAgentSectionEligibleTypesForTest,
  clearUnusedRuntimeAgentSectionsForTest,
  makeRuntimeAgentSectionTokens,
  splitRuntimeHandledAgentInjectionsForTest,
} from "../../../packages/server/src/services/generation/runtime-agent-sections.js";
import {
  getTextRewritePendingState,
  mergePairedBuiltInRewriteAgents,
  shouldHoldForTextRewrite,
  TEXT_REWRITE_PENDING_MESSAGE,
} from "../../../packages/server/src/services/generation/prose-guardian-settings.js";
import { parseRouterResponse } from "../../../packages/server/src/services/agents/knowledge-router.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentContext,
  makeRegressionAgentConfig,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const assistantCadenceMessages = [
  { id: "illustrator-anchor", role: "assistant" },
  { id: "accepted-user-turn", role: "user" },
];
const illustratorCadenceStore = {
  getLastSuccessfulRunByType: async () => ({ messageId: "illustrator-anchor" }),
};
assert.equal(
  await shouldSkipAgentByMessageInterval({
    agentsStore: illustratorCadenceStore,
    chatId: "roleplay-cadence",
    agentType: "illustrator",
    settings: { runInterval: 2 },
    fallbackInterval: 5,
    messages: assistantCadenceMessages,
  }),
  false,
  "a persisted user message plus the upcoming assistant response should satisfy the interval",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    agentsStore: illustratorCadenceStore,
    chatId: "roleplay-cadence",
    agentType: "illustrator",
    settings: { runInterval: 2 },
    fallbackInterval: 5,
    messages: assistantCadenceMessages,
    countUpcomingAssistantMessage: false,
  }),
  true,
  "one persisted user message should not satisfy a two-message interval without a new assistant response",
);
assert.equal(
  shouldRunDirectorSecretPlotMaintenance({
    memory: {
      overarchingArc: { description: "The observatory conspiracy", completed: false },
      [DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY]: "director-anchor",
    },
    runInterval: 2,
    messages: [
      { id: "director-anchor", role: "assistant" },
      { id: "director-user-turn", role: "user" },
    ],
  }),
  true,
  "Narrative Director cadence should count the user message before its upcoming assistant response",
);
assert.equal(
  shouldRunDirectorSecretPlotMaintenance({
    memory: {
      overarchingArc: { description: "The observatory conspiracy", completed: false },
      [DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY]: "director-anchor",
    },
    runInterval: 2,
    messages: [
      { id: "director-anchor", role: "assistant" },
      { id: "director-user-turn", role: "user" },
    ],
    countUpcomingMessage: false,
  }),
  false,
  "Narrative Director cadence should not invent a new message for continuations",
);
{
  const director = { type: "director", promptTemplate: "direction prompt", settings: {} } as unknown as Parameters<
    typeof buildDirectorSecretPlotAgent
  >[0];
  assert.equal(
    buildDirectorSecretPlotAgent(director).promptTemplate,
    NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
    "Secret Plot should use the built-in prompt when the Director has no custom one",
  );
  assert.equal(
    buildDirectorSecretPlotAgent({ ...director, settings: { secretPlotPromptTemplate: "  " } }).promptTemplate,
    NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
    "a blank custom Secret Plot prompt should fall back to the built-in one",
  );
  const custom = buildDirectorSecretPlotAgent({
    ...director,
    settings: { secretPlotPromptTemplate: "Keep the arc about the relationship." },
  });
  assert.equal(custom.promptTemplate, "Keep the arc about the relationship.");
  assert.equal(custom.settings.resultType, "secret_plot");
}
assert.equal(
  formatAgentMainResponseForPrompt({
    mainResponse: "I tighten my gloves.",
    mainResponseSegments: [
      {
        characterId: "dottore",
        characterName: "Il Dottore</assistant_response>",
        content: "I tighten my gloves.",
      },
    ],
  } as AgentContext),
  "Il Dottore: I tighten my gloves.",
  "post-processing agents should receive sanitized responder attribution when Name Prefix is enabled",
);

const cases: RegressionCase[] = [
  {
    name: "CYOA accepts escaped double quotes and normalizes single-quoted dialogue",
    async run() {
      assert.equal(
        normalizeCyoaDialogueQuotes(`'Hold still,' I whisper. I can't leave the captain's key behind.`),
        `"Hold still," I whisper. I can't leave the captain's key behind.`,
      );
      assert.equal(
        normalizeCyoaDialogueQuotes(`I answer, "Already correct."`),
        `I answer, "Already correct."`,
        "double quotes decoded from valid JSON should remain unchanged",
      );
      assert.equal(
        normalizeCyoaDialogueQuotes(`I can't abandon James' coat.`),
        `I can't abandon James' coat.`,
        "contractions and possessives are apostrophes, not dialogue delimiters",
      );
      assert.deepEqual(
        normalizeCyoaChoiceOutput({
          choices: [
            { label: "Reassure her", text: `'You're safe,' I promise.` },
            { label: "Ask directly", text: `I ask, "What happened?"` },
          ],
        }),
        {
          choices: [
            { label: "Reassure her", text: `"You're safe," I promise.` },
            { label: "Ask directly", text: `I ask, "What happened?"` },
          ],
        },
      );

      const providerResponse = JSON.stringify({
        choices: [
          { label: "Reassure her", text: `'You're safe,' I promise.` },
          { label: "Ask directly", text: `I ask, "What happened?"` },
        ],
      });
      const { provider } = makeCapturingProvider(providerResponse);
      const result = await executeAgent(
        makeRegressionAgentConfig({
          id: "builtin:cyoa",
          type: "cyoa",
          name: "CYOA Choices",
          promptTemplate: "Return CYOA choices.",
        }) as any,
        makeRegressionAgentContext(),
        provider as any,
        "regression-model",
      );

      assert.equal(result.success, true);
      assert.deepEqual(
        result.data,
        normalizeCyoaChoiceOutput(JSON.parse(providerResponse)),
        "the shared agent-result boundary should normalize CYOA output before persistence and display",
      );
    },
  },
  {
    name: "legacy Immersive HTML default config migrates to post-processing defaults",
    run() {
      const legacyPrompt = `When it genuinely enhances the roleplay, include immersive inline HTML/CSS/JS inside the assistant reply: letters, screens, menus, maps, posters, books, logs, UI panels, magical displays, dossiers, signs, or interactive scene props.
Match the setting and tone. Keep text readable. Use self-contained HTML with inline CSS/JS only; no external assets, libraries, fonts, network calls, iframes, or code fences.
Use HTML sparingly and diegetically. Do not replace normal prose/dialogue unless the scene naturally calls for a visual artifact.`;

      const update = buildLegacyDefaultAgentConfigUpdate({
        id: "builtin:html",
        type: "html",
        name: "Immersive HTML",
        description:
          "Adds immersive HTML/CSS/JS formatting instructions to the last Roleplay user prompt without running a separate agent call.",
        phase: "pre_generation",
        enabled: "true",
        connectionId: null,
        imagePath: null,
        promptTemplate: legacyPrompt,
        settings: JSON.stringify({
          promptTemplates: [{ id: "legacy-stock-html", name: "Legacy Stock", promptTemplate: legacyPrompt }],
        }),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      assert.equal(update.promptTemplate, "");
      assert.equal(update.phase, "post_processing");
      assert.match(String(update.description), /Adds HTML\/CSS\/JS visual effects to AI messages/);
      const settings = JSON.parse(String(update.settings)) as Record<string, unknown>;
      assert.equal(settings.resultType, "text_rewrite");
      assert.equal(settings.contextSize, 5);
      assert.equal(settings.maxTokens, 4096);
      assert.deepEqual(settings.promptTemplates, []);
      assert.match(getDefaultAgentPrompt("html"), /post-processing visual enhancer/);
    },
  },
  {
    name: "custom-agent vector access injects semantic matches and recalled memories only when enabled",
    async run() {
      const vectorContext = {
        semanticLorebookEntries: [
          {
            id: "lore-semantic-match",
            content: "The hidden laboratory is beneath the abandoned opera house.",
            semanticScore: 0.812,
          },
        ],
        recalledMemories: ["Mari previously found a silver key inside Dottore's field journal."],
      };
      const enabledCapture = makeCapturingProvider("Vector context received.");
      const enabledConfig = makeRegressionAgentConfig({
        id: "custom:vector-reader",
        type: "custom-vector-reader",
        name: "Vector Reader",
        isCustomAgent: true,
        promptTemplate: "Summarize the relevant prior context.",
        settings: {
          contextSize: 5,
          maxTokens: 256,
          resultType: "context_injection",
          customCapabilities: { access_vectors: true },
          contextSources: { recalledMemories: true },
        },
      });

      await executeAgent(
        enabledConfig as any,
        makeRegressionAgentContext({ vectorContext }),
        enabledCapture.provider as any,
        "regression-model",
      );
      const enabledSystem = enabledCapture.calls[0]?.[0]?.content ?? "";
      assert.match(enabledSystem, /<vector_context>/u);
      assert.match(enabledSystem, /<semantic_lorebook_matches>/u);
      assert.match(enabledSystem, /The hidden laboratory is beneath the abandoned opera house\./u);
      assert.match(enabledSystem, /<recalled_chat_memories>/u);
      assert.match(enabledSystem, /Mari previously found a silver key/u);

      const disabledCapture = makeCapturingProvider("Ordinary context received.");
      const disabledConfig = makeRegressionAgentConfig({
        id: "custom:ordinary-reader",
        type: "custom-ordinary-reader",
        name: "Ordinary Reader",
        isCustomAgent: true,
        promptTemplate: "Summarize the recent context.",
        settings: {
          contextSize: 5,
          maxTokens: 256,
          resultType: "context_injection",
        },
      });
      await executeAgent(
        disabledConfig as any,
        makeRegressionAgentContext({ vectorContext }),
        disabledCapture.provider as any,
        "regression-model",
      );
      const disabledSystem = disabledCapture.calls[0]?.[0]?.content ?? "";
      assert.doesNotMatch(disabledSystem, /<vector_context>/u);
      assert.doesNotMatch(disabledSystem, /hidden laboratory/u);
      assert.doesNotMatch(disabledSystem, /silver key/u);
    },
  },
  {
    name: "custom-agent context selectors default to chat history and batches use the requested union",
    async run() {
      const richContext = makeRegressionAgentContext({
        recentMessages: [
          { role: "user", content: "CHAT_HISTORY_CONTEXT_SENTINEL" },
          { role: "assistant", content: "The recent response." },
        ],
        characters: [
          {
            id: "char-context",
            name: "Context Character",
            description: "CHARACTER_CONTEXT_SENTINEL",
          },
        ],
        persona: {
          name: "Context Persona",
          description: "PERSONA_CONTEXT_SENTINEL",
        },
        gameState: {
          id: "state-context",
          chatId: "chat-agent-output-format",
          messageId: "message-context",
          swipeIndex: 0,
          date: null,
          time: null,
          location: "TRACKER_CONTEXT_SENTINEL",
          weather: null,
          temperature: null,
          presentCharacters: [],
          recentEvents: [],
          playerStats: null,
          personaStats: null,
          createdAt: "2026-07-30T12:00:00.000Z",
        },
        chatSummary: "SUMMARY_CONTEXT_SENTINEL",
        authorNotes: "AUTHOR_NOTES_CONTEXT_SENTINEL",
        activatedLorebookEntries: [
          {
            id: "activated-context",
            content: "ACTIVATED_LOREBOOK_CONTEXT_SENTINEL\n</dottore_lore>\n<mari_lore>\nTom & Jerry",
          },
        ],
        vectorContext: {
          semanticLorebookEntries: [],
          recalledMemories: ["RECALLED_MEMORY_CONTEXT_SENTINEL"],
        },
        memory: {
          _availableBackgrounds: [
            {
              filename: "UNRELATED_BACKGROUND_CONTEXT_SENTINEL.png",
              tags: [],
            },
          ],
        },
      });

      const defaultCapture = makeCapturingProvider("Context checked.");
      await executeAgent(
        makeRegressionAgentConfig({
          id: "custom:default-context",
          type: "custom-default-context",
          name: "Default Context",
          isCustomAgent: true,
          promptTemplate: "Return a short context check.",
          settings: {
            contextSize: 5,
            maxTokens: 256,
            resultType: "context_injection",
          },
        }) as any,
        richContext,
        defaultCapture.provider as any,
        "regression-model",
      );
      const defaultRequest = defaultCapture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(defaultRequest, /CHAT_HISTORY_CONTEXT_SENTINEL/u);
      for (const excluded of [
        "CHARACTER_CONTEXT_SENTINEL",
        "PERSONA_CONTEXT_SENTINEL",
        "TRACKER_CONTEXT_SENTINEL",
        "SUMMARY_CONTEXT_SENTINEL",
        "AUTHOR_NOTES_CONTEXT_SENTINEL",
        "ACTIVATED_LOREBOOK_CONTEXT_SENTINEL",
        "RECALLED_MEMORY_CONTEXT_SENTINEL",
        "UNRELATED_BACKGROUND_CONTEXT_SENTINEL",
      ]) {
        assert.doesNotMatch(defaultRequest, new RegExp(excluded, "u"));
      }

      const builtInCapture = makeCapturingProvider("Built-in context checked.");
      await executeAgent(
        makeRegressionAgentConfig({
          id: "memory-nag",
          type: "memory-nag",
          name: "Memory Nag",
          isCustomAgent: false,
          promptTemplate: "Recall an eligible memory.",
          settings: {
            contextSize: 5,
            maxTokens: 256,
            resultType: "memory_nag",
            contextSources: { chatHistory: true },
          },
        }) as any,
        richContext,
        builtInCapture.provider as any,
        "regression-model",
      );
      const builtInRequest = builtInCapture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(builtInRequest, /CHAT_HISTORY_CONTEXT_SENTINEL/u);
      for (const excluded of [
        "CHARACTER_CONTEXT_SENTINEL",
        "PERSONA_CONTEXT_SENTINEL",
        "TRACKER_CONTEXT_SENTINEL",
        "SUMMARY_CONTEXT_SENTINEL",
        "AUTHOR_NOTES_CONTEXT_SENTINEL",
        "ACTIVATED_LOREBOOK_CONTEXT_SENTINEL",
        "RECALLED_MEMORY_CONTEXT_SENTINEL",
      ]) {
        assert.doesNotMatch(builtInRequest, new RegExp(excluded, "u"));
      }

      const selectedCapture = makeCapturingProvider("Selected context checked.");
      await executeAgent(
        makeRegressionAgentConfig({
          id: "custom:selected-context",
          type: "custom-selected-context",
          name: "Selected Context",
          isCustomAgent: true,
          promptTemplate: "Return a short context check.",
          settings: {
            contextSize: 5,
            maxTokens: 256,
            resultType: "context_injection",
            customCapabilities: { access_vectors: true },
            contextSources: {
              chatHistory: true,
              characters: true,
              persona: true,
              activatedLorebookEntries: true,
              chatSummary: true,
              authorNotes: true,
              trackerData: true,
              recalledMemories: true,
            },
          },
        }) as any,
        richContext,
        selectedCapture.provider as any,
        "regression-model",
      );
      const selectedRequest = selectedCapture.calls[0]!.map((message) => message.content).join("\n");
      for (const included of [
        "CHAT_HISTORY_CONTEXT_SENTINEL",
        "CHARACTER_CONTEXT_SENTINEL",
        "PERSONA_CONTEXT_SENTINEL",
        "TRACKER_CONTEXT_SENTINEL",
        "SUMMARY_CONTEXT_SENTINEL",
        "AUTHOR_NOTES_CONTEXT_SENTINEL",
        "ACTIVATED_LOREBOOK_CONTEXT_SENTINEL",
        "RECALLED_MEMORY_CONTEXT_SENTINEL",
      ]) {
        assert.match(selectedRequest, new RegExp(included, "u"));
      }
      assert.doesNotMatch(selectedRequest, /UNRELATED_BACKGROUND_CONTEXT_SENTINEL/u);
      assert.match(selectedRequest, /<\/dottore_lore>\n<mari_lore>/u);
      assert.match(selectedRequest, /Tom & Jerry/u);
      assert.doesNotMatch(selectedRequest, /&lt;\/dottore_lore&gt;/u);

      const batchCapture = makeCapturingProvider(
        `{"custom-batch-character":"character context read","custom-batch-author":"author context read"}`,
      );
      const characterReader = makeRegressionAgentConfig({
        id: "custom:batch-character",
        type: "custom-batch-character",
        name: "Character Reader",
        isCustomAgent: true,
        promptTemplate: "Read character context.",
        settings: {
          contextSize: 5,
          maxTokens: 256,
          resultType: "context_injection",
          contextSources: { chatHistory: false, characters: true },
        },
      });
      const authorReader = makeRegressionAgentConfig({
        id: "custom:batch-author",
        type: "custom-batch-author",
        name: "Author Notes Reader",
        isCustomAgent: true,
        promptTemplate: "Read author notes.",
        settings: {
          contextSize: 5,
          maxTokens: 256,
          resultType: "context_injection",
          contextSources: { chatHistory: false, authorNotes: true },
        },
      });
      await executeAgentBatch(
        [characterReader, authorReader] as any,
        richContext,
        batchCapture.provider as any,
        "regression-model",
      );
      const batchRequest = batchCapture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(batchRequest, /CHARACTER_CONTEXT_SENTINEL/u);
      assert.match(batchRequest, /AUTHOR_NOTES_CONTEXT_SENTINEL/u);
      assert.doesNotMatch(batchRequest, /CHAT_HISTORY_CONTEXT_SENTINEL/u);
      assert.doesNotMatch(batchRequest, /PERSONA_CONTEXT_SENTINEL/u);
      assert.doesNotMatch(batchRequest, /TRACKER_CONTEXT_SENTINEL/u);
      assert.doesNotMatch(batchRequest, /SUMMARY_CONTEXT_SENTINEL/u);
      assert.doesNotMatch(batchRequest, /ACTIVATED_LOREBOOK_CONTEXT_SENTINEL/u);
    },
  },
  {
    name: "agent current game state hides quest progress from non-quest agents",
    run() {
      const hiddenMoodKey = characterTrackerLockKey({ characterId: "mira", name: "Mira" }, 0, "mood");
      const gameState = {
        date: "Day 1",
        presentCharacters: [
          {
            characterId: "mira",
            name: "Mira",
            mood: "Uneasy",
            outfit: "Travel cloak",
          },
        ],
        playerStats: {
          status: "Recognized by the northern clerk",
          inventory: [{ name: "glass earring", description: "A dangerous token", quantity: 1, location: "on_person" }],
          activeQuests: [
            {
              questEntryId: "The Man Called Maukie",
              name: "The Man Called Maukie",
              currentStage: 1,
              objectives: [{ text: "Secure passage north", completed: false }],
              completed: false,
            },
          ],
        },
        fieldLocks: {
          "quests.id:The%20Man%20Called%20Maukie.name": true,
          "playerStats.status": true,
          [hiddenMoodKey]: true,
        },
        hiddenTrackerFields: { [hiddenMoodKey]: true },
      };

      const backgroundState = compactGameStateForAgentContext(gameState, ["background"]) as {
        playerStats: Record<string, unknown>;
        fieldLocks: Record<string, unknown>;
        presentCharacters: Array<Record<string, unknown>>;
        hiddenTrackerFields?: Record<string, unknown>;
      };
      assert.equal("activeQuests" in backgroundState.playerStats, false);
      assert.equal(backgroundState.playerStats.status, "Recognized by the northern clerk");
      assert.equal(backgroundState.fieldLocks["quests.id:The%20Man%20Called%20Maukie.name"], undefined);
      assert.equal(backgroundState.fieldLocks["playerStats.status"], true);
      assert.equal(backgroundState.fieldLocks[hiddenMoodKey], undefined);
      assert.equal("mood" in backgroundState.presentCharacters[0]!, false);
      assert.equal(backgroundState.presentCharacters[0]?.outfit, "Travel cloak");
      assert.equal("hiddenTrackerFields" in backgroundState, false);

      const questState = compactGameStateForAgentContext(gameState, ["quest"]) as {
        playerStats: { activeQuests?: Array<{ name?: string }> };
        fieldLocks: Record<string, unknown>;
      };
      assert.equal(Array.isArray(questState.playerStats.activeQuests), true);
      assert.equal(questState.playerStats.activeQuests?.[0]?.name, "The Man Called Maukie");
      assert.equal(questState.fieldLocks["quests.id:The%20Man%20Called%20Maukie.name"], true);
    },
  },
  {
    name: "single agent output format is terminal user message using selected wrapper",
    async run() {
      const { calls, provider } = makeCapturingProvider(`{"chosen":null,"generate":null}`);
      const config = makeRegressionAgentConfig();
      const context = makeRegressionAgentContext({
        wrapFormat: "markdown",
        mainResponse: "Dottore studies the rain-slick street and chooses a darker alley backdrop.",
        characters: [
          {
            id: "char-dottore",
            name: "Dottore",
            description: "AGENT_CHAR_DESCRIPTION",
            personality: "AGENT_CHAR_PERSONALITY",
            backstory: "AGENT_CHAR_BACKSTORY",
            appearance: "AGENT_CHAR_APPEARANCE",
            scenario: "AGENT_CHAR_SCENARIO",
          },
        ],
      });

      const result = await executeAgent(config as any, context, provider as any, "regression-model");
      assert.equal(result.success, true);
      const messages = calls[0]!;
      const last = messages[messages.length - 1]!;
      assert.equal(last.role, "user");
      assert.match(last.content, /<assistant_response>/);
      assert.match(last.content, /Now return the requested format/);
      assert.match(last.content, /## Output Format/);
      assert.match(last.content, /Return ONLY one valid JSON object for active agent "background"\./);
      assert.match(last.content, /Agent "background" \(Background\):/);
      assert.doesNotMatch(last.content, /Agent "quest"/);
      assert.equal(last.content.trim().endsWith('Return JSON: {"chosen": null}'), true);
      const system = messages[0]?.content ?? "";
      const cardFieldPositions = [
        "AGENT_CHAR_DESCRIPTION",
        "AGENT_CHAR_PERSONALITY",
        "AGENT_CHAR_BACKSTORY",
        "AGENT_CHAR_APPEARANCE",
        "AGENT_CHAR_SCENARIO",
      ].map((fragment) => system.indexOf(fragment));
      assert.ok(cardFieldPositions.every((position) => position >= 0));
      assert.deepEqual(
        cardFieldPositions,
        [...cardFieldPositions].sort((left, right) => left - right),
      );
    },
  },
  {
    name: "batched agent output format lists only active requested agents in terminal user message",
    async run() {
      const { calls, provider } = makeCapturingProvider(
        `{"background":{"chosen":null,"generate":null},"character-tracker":{"updates":[]}}`,
      );
      const background = makeRegressionAgentConfig();
      const characterTracker = makeRegressionAgentConfig({
        id: "builtin:character-tracker",
        type: "character-tracker",
        name: "Character Tracker",
        promptTemplate: 'Return JSON: {"updates": []}',
        settings: {
          contextSize: 5,
          maxTokens: 256,
          resultType: "character_tracker_update",
        },
      });
      const context = makeRegressionAgentContext({
        wrapFormat: "xml",
        mainResponse: "Dottore notices Mari tense when the door opens.",
      });

      const results = await executeAgentBatch(
        [background, characterTracker] as any,
        context,
        provider as any,
        "regression-model",
      );
      assert.equal(results.length, 2);
      assert.match(calls[0]![0]!.content, /tracker_incremental_updates: supported/);
      const messages = calls[0]!;
      const system = messages[0]!;
      const last = messages[messages.length - 1]!;
      assert.equal(last.role, "user");
      assert.doesNotMatch(system.content, /REQUIRED OUTPUT FORMAT/);
      assert.match(last.content, /<output_format>/);
      assert.match(last.content, /"background": null/);
      assert.match(last.content, /"character-tracker": null/);
      assert.doesNotMatch(last.content, /"quest": null/);
      assert.equal(last.content.trim().endsWith("</output_format>"), true);
    },
  },
  {
    name: "sequential Game agent phases do not overlap different model connections",
    async run() {
      for (const sequentialExecution of [false, true]) {
        let active = 0;
        let peak = 0;
        const agents = [0, 1, 2].map((index) => {
          const capture = makeCapturingProvider("Context checked.");
          const complete = capture.provider.chatComplete;
          capture.provider.chatComplete = async (...args) => {
            active++;
            peak = Math.max(peak, active);
            try {
              await new Promise((done) => setTimeout(done, 20));
              return await complete(...args);
            } finally {
              active--;
            }
          };
          return {
            ...makeRegressionAgentConfig({
              id: `custom:sequential-${index}`,
              type: `sequential-${index}`,
              isCustomAgent: true,
              phase: "parallel",
              promptTemplate: "Check the supplied context.",
              settings: { resultType: "context_injection" },
            }),
            provider: capture.provider,
            model: `model-${index}`,
            maxParallelJobs: 4,
          } as ResolvedAgent;
        });
        await runParallelAgents(agents, makeRegressionAgentContext({ chatMode: "game", sequentialExecution }));
        assert.equal(peak, sequentialExecution ? 1 : 3);
      }
    },
  },
  {
    name: "automatic agent phases keep distinct request contexts in separate batches",
    async run() {
      for (const phase of ["pre_generation", "parallel"] as const) {
        const capture = makeCapturingProvider("Context checked.");
        const agents = ["tracker-lorebooks-off", "tracker-lorebooks-on"].map(
          (batchContextKey, index) =>
            ({
              ...makeRegressionAgentConfig({
                id: `custom:${phase}-${index}`,
                type: `context-reader-${index}`,
                name: `Context Reader ${index}`,
                isCustomAgent: true,
                phase,
                promptTemplate: "Check the supplied context.",
                settings: { resultType: "context_injection" },
              }),
              provider: capture.provider,
              model: "regression-model",
              batchContextKey,
            }) as ResolvedAgent,
        );

        if (phase === "pre_generation") {
          await runPreGenerationAgents(agents, makeRegressionAgentContext());
        } else {
          await runParallelAgents(agents, makeRegressionAgentContext());
        }

        assert.equal(capture.calls.length, 2, `${phase} agents with different contexts must not share a batch`);
      }
    },
  },
  {
    name: "unused runtime agent sections omit surrounding prompt text",
    run() {
      const tokens = makeRuntimeAgentSectionTokens("knowledge-router", "regression");
      const messages = [
        {
          content: `${tokens.start}<knowledge_router>\nThis is where additional lore will be:\n${tokens.placeholder}\n</knowledge_router>${tokens.end}`,
        },
      ];

      clearUnusedRuntimeAgentSectionsForTest(messages, [["knowledge-router", tokens]]);

      assert.equal(messages.length, 0);
    },
  },
  {
    name: "assembled presets own unmatched runtime agent placement",
    run() {
      const tokens = makeRuntimeAgentSectionTokens("long-term-memory", "placement");
      const markerMessages = [{ content: tokens.placeholder }];
      const marked = splitRuntimeHandledAgentInjectionsForTest(
        markerMessages,
        new Map([["long-term-memory", tokens]]),
        [{ agentType: "long-term-memory", text: "MEMORY" }],
        { omitUnmatched: true },
      );
      assert.deepEqual(marked.fallbackInjections, []);
      assert.deepEqual(marked.omittedInjections, []);
      assert.equal(markerMessages[0]?.content, "MEMORY");

      const omitted = splitRuntimeHandledAgentInjectionsForTest(
        [{ content: "preset" }],
        new Map([["long-term-memory", tokens]]),
        [{ agentType: "long-term-memory", text: "MEMORY" }],
        { omitUnmatched: true },
      );
      assert.equal(omitted.omittedInjections.length, 1);
      assert.equal(
        formatSeparateAgentInjection("long-term-memory", "MEMORY", "xml"),
        "<long_term_memory>\nMEMORY\n</long_term_memory>",
      );

      const freshContextInjections = [
        { agentType: "long-term-memory", text: "MEMORY" },
        { agentType: "prose-guardian", text: "GUIDANCE" },
      ];
      const freshFallback = splitRuntimeHandledAgentInjectionsForTest(
        [{ content: "preset" }],
        new Map([["long-term-memory", tokens]]),
        freshContextInjections,
      );
      assert.deepEqual(freshFallback.fallbackInjections, freshContextInjections);
      assert.deepEqual(freshFallback.omittedInjections, []);

      const fallbackForUnmatchedMarker = splitRuntimeHandledAgentInjectionsForTest(
        [{ content: "preset" }],
        new Map([["long-term-memory", tokens]]),
        freshContextInjections,
        { omitUnmatched: true },
      );
      const cachedFallbackInjections = [
        ...fallbackForUnmatchedMarker.fallbackInjections,
        ...fallbackForUnmatchedMarker.omittedInjections.filter(
          (injection) => injection.agentType === "long-term-memory",
        ),
      ];
      assert.deepEqual(fallbackForUnmatchedMarker.omittedInjections, freshContextInjections);
      const regeneratedContextInjections = freshContextInjections.filter(
        (injection) =>
          injection.agentType === "long-term-memory" ||
          !fallbackForUnmatchedMarker.omittedInjections.includes(injection),
      );
      const longTermMemoryOnly = [freshContextInjections[0]];
      assert.deepEqual(regeneratedContextInjections, longTermMemoryOnly);
      assert.deepEqual(cachedFallbackInjections, longTermMemoryOnly);
      const generateRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const ltmFallbackStart = generateRouteSource.indexOf("if (!handledByPresetSection) {");
      const ltmFallbackEnd = generateRouteSource.indexOf(
        "longTermMemoryRecallReceipt = recall.receipt;",
        ltmFallbackStart,
      );
      const ltmFallbackSource = generateRouteSource.slice(
        ltmFallbackStart,
        ltmFallbackEnd + "longTermMemoryRecallReceipt = recall.receipt;".length,
      );
      assert.match(ltmFallbackSource, /appendSeparateAgentInjection/u);
      assert.match(ltmFallbackSource, /longTermMemoryRecallReceipt = recall\.receipt/u);
      assert.doesNotMatch(generateRouteSource, /handledByPresetSection \|\| !presetOwnsAgentPlacement/u);

      const cachedReplayStart = generateRouteSource.indexOf("const runtimeHandledCached");
      const cachedReplayEnd = generateRouteSource.indexOf("const cachedPipelineInjections", cachedReplayStart);
      const cachedReplaySource = generateRouteSource.slice(cachedReplayStart, cachedReplayEnd);
      assert.match(cachedReplaySource, /unmatchedCachedLongTermMemory/u);
      assert.match(cachedReplaySource, /fallbackInjections\.push/u);

      const fallback = splitRuntimeHandledAgentInjectionsForTest([{ content: "conversation" }], new Map(), [
        { agentType: "long-term-memory", text: "MEMORY" },
      ]);
      assert.equal(fallback.fallbackInjections.length, 1);
      assert.deepEqual(fallback.omittedInjections, []);
    },
  },
  {
    name: "knowledge router parser accepts common selected-id aliases",
    run() {
      assert.deepEqual(parseRouterResponse('{"entryIds":["entry-a"]}'), ["entry-a"]);
      assert.deepEqual(parseRouterResponse('{"selectedEntryIds":["entry-b","entry-b"]}'), ["entry-b"]);
      assert.deepEqual(parseRouterResponse('{"selectedEntries":[{"id":"entry-c"},{"entry_id":"entry-d"}]}'), [
        "entry-c",
        "entry-d",
      ]);
      assert.deepEqual(parseRouterResponse('```json\n{"entries":[{"entryId":"entry-e"}]}\n```'), ["entry-e"]);
    },
  },
  {
    name: "immersive HTML is not a pre-generation runtime injection",
    run() {
      const eligible = buildRuntimeAgentSectionEligibleTypesForTest({
        enableAgents: true,
        activeAgentIds: ["html"],
        chatMode: "roleplay",
        configuredAgents: [{ type: "html", phase: "post_processing", settings: { resultType: "text_rewrite" } }],
      });

      assert.equal(eligible.has("html"), false);
    },
  },
  {
    name: "built-in rewrite agents merge into one held rewrite pass",
    run() {
      const rewriteAgents = [
        {
          id: "pg",
          type: "prose-guardian",
          name: "Prose Guardian",
          phase: "post_processing",
          promptTemplate: "STYLE PROMPT",
          settings: { resultType: "text_rewrite", holdForRewrite: true, contextSize: 5, maxTokens: 1024 },
        },
        {
          id: "cont",
          type: "continuity",
          name: "Continuity Checker",
          phase: "post_processing",
          promptTemplate: "CONTINUITY PROMPT",
          settings: { resultType: "text_rewrite", holdForRewrite: true, contextSize: 8, maxTokens: 2048 },
        },
        {
          id: "html",
          type: "html",
          name: "Immersive HTML",
          phase: "post_processing",
          promptTemplate: "HTML PROMPT",
          settings: { resultType: "text_rewrite", holdForRewrite: true, contextSize: 5, maxTokens: 4096 },
        },
      ] as unknown as ResolvedAgent[];

      const merged = mergePairedBuiltInRewriteAgents(rewriteAgents);

      assert.equal(merged.length, 1);
      assert.equal(merged[0]?.settings.contextSize, 8);
      assert.equal(merged[0]?.settings.maxTokens, 4096);
      assert.match(merged[0]?.name ?? "", /Prose Guardian \+ Continuity Checker \+ Immersive HTML/);
      assert.match(merged[0]?.promptTemplate ?? "", /<style_editor>/);
      assert.match(merged[0]?.promptTemplate ?? "", /<continuity_editor>/);
      assert.match(merged[0]?.promptTemplate ?? "", /<immersive_html_editor>/);
      assert.equal(shouldHoldForTextRewrite(rewriteAgents), true);
      assert.deepEqual(getTextRewritePendingState(rewriteAgents), {
        agentType: "text-rewrite",
        message: TEXT_REWRITE_PENDING_MESSAGE,
      });
    },
  },
];

await runNamedCases(cases);
