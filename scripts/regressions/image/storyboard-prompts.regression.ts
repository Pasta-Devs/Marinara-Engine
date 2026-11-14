import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANIME_GAME_PROMPT_TEMPLATE_ID,
  ANIME_GAME_SYSTEM_PROMPT,
  LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE,
  LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  mergeBuiltInAgentSettings,
  normalizeStoryboardAgentSettings,
  replaceBuiltInAgentDefinitions,
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
  STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
  normalizeGameStoryboardKeyframeCount,
} from "../../../packages/shared/src/index.js";
import {
  resolveComfyUiVideoWorkflowPlaceholders,
  resolveLtxDirectorPromptInput,
} from "../../../packages/server/src/services/video/video-generation.js";
import { loadGameStoryboardImagePrompt } from "../../../packages/server/src/services/image/game-storyboard-image-prompt.js";
import {
  selectPreviousSuccessfulStoryboard,
  selectRoleplayStoryboardEpisode,
} from "../../../packages/server/src/services/roleplay/storyboard-episode.js";
import { buildRoleplayStoryboardMessages } from "../../../packages/server/src/services/roleplay/storyboard-prompts.js";
import {
  applyStoryboardAgentSettings,
  shouldSuppressIllustratorForegroundForStoryboard,
} from "../../../packages/server/src/services/game/storyboard-agent-settings.js";
import {
  STORYBOARD_FALLBACK_BEAT_MAX_CHARS,
  compactStoryboardFallbackBeat,
  compactStoryboardTextAtWordBoundary,
  createStoryboardReviewPlanEnvelope,
  formatStoryboardFallbackSectionText,
  resolveStoryboardReviewPlanEnvelope,
  storyboardPlanHasRenderableKeyframe,
} from "../../../packages/server/src/services/game/storyboard-planner-fallback.js";
import {
  buildStoryboardAnimationRefinementMessages,
  compactStoryboardAnimationPrompt,
  executeStoryboardImageAwareAnimation,
  redactStoryboardAnimationRefinementMessages,
  resolveStoryboardAnimationRefinement,
} from "../../../packages/server/src/services/video/storyboard-animation-refinement.js";
import { resolveGameGmPromptTemplate } from "../../../packages/server/src/services/generation/game-gm-prompt-runtime.js";
import { buildSceneIllustrationProviderPrompt } from "../../../packages/server/src/services/game/game-asset-generation.js";
import { readImageAppearanceOverride } from "../../../packages/shared/src/utils/image-appearance.js";
import {
  addChatPersonaIllustrationAssets,
  buildGameIllustratorAppearanceContextBlock,
  buildIllustrationNarrationSummaryMessages,
  buildStoryboardIllustratorMessages,
  extractCharacterAppearanceText,
  selectStoryboardAppearanceCharacterNames,
} from "../../../packages/server/src/routes/game.routes.js";
import { listPromptOverrideKeys } from "../../../packages/server/src/services/prompt-overrides/index.js";
import {
  normalizeIllustratorAppearance,
  readIllustratorAppearance,
  resolveIllustratorCharacterReferences,
} from "../../../packages/server/src/routes/generate/illustrator-references.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { regressionAgentDefinitions } from "../fixtures/regression-agent-definitions.js";

const fallbackBeatWords = Array.from({ length: 400 }, (_, index) => `storyboard-beat-${index}`);
const compactedFallbackBeat = compactStoryboardFallbackBeat(fallbackBeatWords.join(" "));
assert.ok(compactedFallbackBeat.length <= STORYBOARD_FALLBACK_BEAT_MAX_CHARS);
assert.ok(compactedFallbackBeat.endsWith("..."));
assert.ok(fallbackBeatWords.includes(compactedFallbackBeat.slice(0, -3).split(" ").at(-1) ?? ""));
assert.equal(compactStoryboardTextAtWordBoundary("  silver   hair blue eyes  ", 18), "silver hair...");
assert.equal(formatStoryboardFallbackSectionText("Morgana-: Hold the hatch.", "Morgana-"), "Morgana-: Hold the hatch.");
assert.equal(
  formatStoryboardFallbackSectionText("Morgana-: Morgana-: Hold the hatch.", "Morgana-"),
  "Morgana-: Hold the hatch.",
);
assert.equal(formatStoryboardFallbackSectionText("Hold the hatch.", "Morgana-"), "Morgana-: Hold the hatch.");
assert.equal(
  formatStoryboardFallbackSectionText("Shellback Tollkeeper: Run, little coins!", "Shellback Tollkeeper"),
  "Shellback Tollkeeper: Run, little coins!",
);
assert.equal(storyboardPlanHasRenderableKeyframe({ keyframes: [] }), false);
assert.equal(storyboardPlanHasRenderableKeyframe({ keyframes: [{ narrationBeat: "  " }] }), false);
assert.equal(storyboardPlanHasRenderableKeyframe({ keyframes: [{ imagePrompt: "A usable frame" }] }), true);
const fallbackReviewEnvelope = createStoryboardReviewPlanEnvelope({
  plan: { keyframes: [{ narrationBeat: compactedFallbackBeat }] },
  plannerError: "Planner response was malformed; used fallback storyboard planner and skipped video generation.",
  usedFallbackPlanner: true,
});
assert.deepEqual(resolveStoryboardReviewPlanEnvelope(fallbackReviewEnvelope), {
  plan: fallbackReviewEnvelope.plan,
  plannerError: fallbackReviewEnvelope.plannerError,
  usedFallbackPlanner: true,
});

const cases: RegressionCase[] = [
  {
    name: "Storyboard package updates merge new built-in prompts without replacing saved choices",
    run() {
      const collectionKeys = [
        "illustrationTemplates",
        "videoTemplates",
        "animationRefinementTemplates",
        "roleplayEpisodeTemplates",
        "roleplayStyleTemplates",
        "roleplayAnimationTemplates",
        "roleplayOutputTemplates",
      ] as const;
      const storyboardDefinition = {
        id: "storyboard",
        name: "Storyboard",
        description: "Storyboard regression fixture.",
        phase: "post_processing" as const,
        enabledByDefault: false,
        category: "misc" as const,
        defaultTools: [],
        defaultPromptTemplate: "Plan a storyboard.",
        defaultSettings: Object.fromEntries(
          collectionKeys.map((key) => [
            key,
            [
              { id: `${key.toLowerCase()}-existing`, name: "Existing built-in", promptTemplate: `DEFAULT ${key}` },
              { id: `${key.toLowerCase()}-new`, name: "New built-in", promptTemplate: `NEW ${key}` },
            ],
          ]),
        ),
      };
      replaceBuiltInAgentDefinitions([...regressionAgentDefinitions, storyboardDefinition]);

      try {
        const savedSettings = Object.fromEntries(
          collectionKeys.map((key) => [
            key,
            [
              { id: `${key.toLowerCase()}-existing`, name: "Saved override", promptTemplate: `SAVED ${key}` },
              { id: `${key.toLowerCase()}-custom`, name: "Custom prompt", promptTemplate: `CUSTOM ${key}` },
            ],
          ]),
        );
        const merged = mergeBuiltInAgentSettings("storyboard", {
          ...savedSettings,
          roleplayAnimationTemplateId: "roleplayanimationtemplates-custom",
        });

        for (const key of collectionKeys) {
          const templates = merged[key] as Array<{ id: string; promptTemplate: string }>;
          assert.deepEqual(
            templates.map((template) => [template.id, template.promptTemplate]),
            [
              [`${key.toLowerCase()}-existing`, `SAVED ${key}`],
              [`${key.toLowerCase()}-new`, `NEW ${key}`],
              [`${key.toLowerCase()}-custom`, `CUSTOM ${key}`],
            ],
            `${key} must add new built-ins while preserving saved overrides and custom prompts`,
          );
        }
        assert.equal(
          merged.roleplayAnimationTemplateId,
          "roleplayanimationtemplates-custom",
          "merging package defaults must preserve the selected prompt id",
        );
      } finally {
        replaceBuiltInAgentDefinitions(regressionAgentDefinitions);
      }
    },
  },
  {
    name: "Storyboard chat settings override agent defaults for Game and Roleplay",
    async run() {
      const agents = {
        ensureBuiltinConfig: async () => ({
          id: "storyboard-config",
          connectionId: "agent-prompt-connection",
          settings: {
            runInterval: 2,
            keyframeCount: 3,
            animationDurationSeconds: 6,
            autoGenerateMode: "illustration",
            imageConnectionId: "agent-image-connection",
            videoConnectionId: "agent-video-connection",
            promptTemplates: [
              { id: "shared-planner", name: "Agent planner", promptTemplate: "AGENT PLANNER" },
              { id: "agent-planner", name: "Agent fallback", promptTemplate: "AGENT FALLBACK" },
            ],
            illustrationPlannerTemplateIds: ["shared-planner", "agent-planner"],
            animationPlannerTemplateIds: ["shared-planner", "agent-planner"],
            animationRefinementTemplates: [
              { id: "shot-planner", name: "Shot planner", promptTemplate: "AGENT SHOT PLANNER" },
            ],
            animationRefinementTemplateId: "shot-planner",
            imageAwareShotPlanningEnabled: true,
            roleplayEpisodeTemplates: [
              { id: "shared-episode", name: "Agent episode", promptTemplate: "AGENT EPISODE" },
              { id: "agent-episode", name: "Agent fallback", promptTemplate: "AGENT EPISODE FALLBACK" },
            ],
          },
        }),
      } as unknown as Parameters<typeof applyStoryboardAgentSettings>[1];

      const roleplay = await applyStoryboardAgentSettings(
        {
          activeAgentIds: ["storyboard"],
          roleplayStoryboardAutoGenerateMode: "manual",
          roleplayStoryboardRunInterval: 7,
          roleplayStoryboardKeyframeCount: 5,
          roleplayStoryboardAnimationDurationSeconds: 11,
          roleplayStoryboardPromptConnectionId: "chat-prompt-connection",
          roleplayStoryboardImageConnectionId: "chat-image-connection",
          roleplayStoryboardVideoConnectionId: "chat-video-connection",
          roleplayStoryboardEpisodeTemplateId: "shared-episode",
          roleplayStoryboardEpisodeTemplates: [
            { id: "shared-episode", name: "Chat episode", promptTemplate: "CHAT EPISODE" },
          ],
        },
        agents,
        "roleplay",
      );
      assert.equal(roleplay.roleplayStoryboardAutoGenerateMode, "manual");
      assert.equal(roleplay.roleplayStoryboardRunInterval, 7);
      assert.equal(roleplay.roleplayStoryboardKeyframeCount, 5);
      assert.equal(roleplay.roleplayStoryboardAnimationDurationSeconds, 11);
      assert.equal(roleplay.storyboardAgentPromptConnectionId, "chat-prompt-connection");
      assert.equal(roleplay.storyboardAgentImageConnectionId, "chat-image-connection");
      assert.equal(roleplay.storyboardAgentVideoConnectionId, "chat-video-connection");
      assert.equal(roleplay.storyboardAgentAnimationRefinementTemplateId, "shot-planner");
      assert.equal(roleplay.storyboardAgentImageAwareShotPlanningEnabled, true);
      assert.equal(
        (roleplay.storyboardAgentAnimationRefinementTemplates as Array<{ promptTemplate: string }>)[0]?.promptTemplate,
        "AGENT SHOT PLANNER",
      );
      assert.deepEqual(
        (roleplay.roleplayStoryboardEpisodeTemplates as Array<{ id: string; promptTemplate: string }>).map(
          (template) => [template.id, template.promptTemplate],
        ),
        [
          ["shared-episode", "CHAT EPISODE"],
          ["agent-episode", "AGENT EPISODE FALLBACK"],
        ],
      );

      const game = await applyStoryboardAgentSettings(
        {
          activeAgentIds: ["storyboard"],
          gameStoryboardKeyframeCount: 6,
          gameStoryboardIllustrationPromptTemplateId: "shared-planner",
          gameStoryboardPromptTemplates: [
            { id: "shared-planner", name: "Chat planner", promptTemplate: "CHAT PLANNER" },
          ],
        },
        agents,
        "game",
      );
      assert.equal(game.gameStoryboardKeyframeCount, 6);
      assert.equal(game.storyboardAgentAnimationRefinementTemplateId, "shot-planner");
      assert.deepEqual(
        (game.gameStoryboardPromptTemplates as Array<{ id: string; promptTemplate: string }>).map((template) => [
          template.id,
          template.promptTemplate,
        ]),
        [
          ["shared-planner", "CHAT PLANNER"],
          ["agent-planner", "AGENT FALLBACK"],
        ],
      );
    },
  },
  {
    name: "automatic Roleplay Storyboard owns foreground media without suppressing Illustrator backgrounds",
    run() {
      assert.equal(
        shouldSuppressIllustratorForegroundForStoryboard({
          ownerMode: "roleplay",
          storyboardAgentActive: true,
          createsAssistantMessage: true,
          meta: { roleplayStoryboardAutoGenerateMode: "animation" },
          defaultAutoGenerateMode: "manual",
        }),
        true,
      );
      assert.equal(
        shouldSuppressIllustratorForegroundForStoryboard({
          ownerMode: "roleplay",
          storyboardAgentActive: true,
          createsAssistantMessage: true,
          meta: { roleplayStoryboardAutoGenerateMode: "manual" },
          defaultAutoGenerateMode: "animation",
        }),
        false,
        "a chat-level manual override should keep Illustrator foreground generation available",
      );
      assert.equal(
        shouldSuppressIllustratorForegroundForStoryboard({
          ownerMode: "roleplay",
          storyboardAgentActive: true,
          createsAssistantMessage: false,
          meta: { roleplayStoryboardAutoGenerateMode: "animation" },
          defaultAutoGenerateMode: "animation",
        }),
        false,
        "regeneration and continuation do not create a new automatic Storyboard target",
      );

      const generateRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      assert.match(generateRouteSource, /shouldSuppressIllustratorForegroundForStoryboard\(\{/u);
      // Explicit image commands request foreground art; automatic backgrounds
      // retain their independent setting when Storyboard owns foreground art.
      assert.match(
        generateRouteSource,
        /if \(!commandTarget && automaticBackgroundsEnabled && illustratorBackgroundAgent\)/u,
      );
      assert.match(generateRouteSource, /if \(!storyboardSuppressesForeground && shouldGenerate && imagePrompt\)/u);
    },
  },
  {
    name: "Roleplay Storyboard cadence selects bounded episodes since the last successful run",
    run() {
      const messages = [
        { id: "user-1", role: "user", content: "The door opens." },
        { id: "assistant-1", role: "assistant", content: "Mira enters the observatory.", activeSwipeIndex: 0 },
        { id: "user-2", role: "user", content: "I ask what she found." },
        { id: "assistant-2", role: "assistant", content: "She raises a brass star map.", activeSwipeIndex: 1 },
        { id: "user-3", role: "user", content: "I move closer." },
        { id: "assistant-3", role: "assistant", content: "Blue constellations fill the room.", activeSwipeIndex: 2 },
      ];

      const firstAutomaticRun = selectRoleplayStoryboardEpisode({
        messages,
        currentMessageId: "assistant-3",
        runInterval: 3,
        automatic: true,
      });
      assert.equal(firstAutomaticRun.status, "ready");
      if (firstAutomaticRun.status !== "ready") return;
      assert.deepEqual(
        firstAutomaticRun.sections.map((section) => section.messageId),
        ["user-3", "assistant-3"],
        "the first run should use the latest completed exchange instead of backfilling the chat",
      );

      assert.deepEqual(
        selectRoleplayStoryboardEpisode({
          messages,
          currentMessageId: "assistant-2",
          previousSuccessfulMessageId: "assistant-1",
          runInterval: 3,
          automatic: true,
        }),
        { status: "skip", reason: "interval" },
      );

      const accumulatedEpisode = selectRoleplayStoryboardEpisode({
        messages,
        currentMessageId: "assistant-3",
        previousSuccessfulMessageId: "assistant-1",
        runInterval: 3,
        automatic: true,
      });
      assert.equal(accumulatedEpisode.status, "ready");
      if (accumulatedEpisode.status !== "ready") return;
      assert.equal(accumulatedEpisode.assistantMessageCount, 2);
      assert.equal(accumulatedEpisode.swipeIndex, 2);
      assert.deepEqual(
        accumulatedEpisode.sections.map((section) => section.messageId),
        ["user-2", "assistant-2", "user-3", "assistant-3"],
      );

      const missingAnchorEpisode = selectRoleplayStoryboardEpisode({
        messages,
        currentMessageId: "assistant-3",
        previousSuccessfulMessageId: "missing-anchor",
        runInterval: 10,
        automatic: true,
      });
      assert.equal(missingAnchorEpisode.status, "ready");
      if (missingAnchorEpisode.status !== "ready") return;
      assert.deepEqual(
        missingAnchorEpisode.sections.map((section) => section.messageId),
        ["user-3", "assistant-3"],
        "an unresolved anchor should fall back to the latest exchange without applying interval cadence",
      );

      const previousStoryboard = selectPreviousSuccessfulStoryboard(
        [
          { id: "future", messageId: "assistant-3", status: "complete", createdAt: "2026-07-31T05:00:00Z" },
          { id: "older", messageId: "assistant-1", status: "complete", createdAt: "2026-07-31T04:00:00Z" },
          { id: "nearest-old", messageId: "assistant-2", status: "partial", createdAt: "2026-07-31T02:00:00Z" },
          { id: "nearest-new", messageId: "assistant-2", status: "complete", createdAt: "2026-07-31T03:00:00Z" },
          { id: "failed", messageId: "assistant-2", status: "failed", createdAt: "2026-07-31T06:00:00Z" },
        ],
        messages,
        "assistant-3",
      );
      assert.equal(previousStoryboard?.id, "nearest-new");

      const boundedEpisode = selectRoleplayStoryboardEpisode({
        messages: [
          { id: "anchor", role: "assistant", content: "Previous success" },
          ...Array.from({ length: 24 }, (_, index) => ({
            id: `bounded-${index}`,
            role: index % 2 === 0 ? "user" : "assistant",
            content: "x".repeat(1_000),
          })),
        ],
        currentMessageId: "bounded-23",
        previousSuccessfulMessageId: "anchor",
        automatic: false,
      });
      assert.equal(boundedEpisode.status, "ready");
      if (boundedEpisode.status !== "ready") return;
      assert.ok(boundedEpisode.sections.length <= 20);
      assert.ok(boundedEpisode.sections.reduce((total, section) => total + section.content.length, 0) <= 12_000);
    },
  },
  {
    name: "Roleplay Storyboard prompts layer still and animation instructions without changing source text",
    run() {
      const meta = {
        roleplayStoryboardEpisodeTemplateId: "episode",
        roleplayStoryboardEpisodeTemplates: [
          { id: "episode", name: "Episode", promptTemplate: "EPISODE ${keyframeCount}" },
        ],
        roleplayStoryboardStyleTemplateId: "comic",
        roleplayStoryboardStyleTemplates: [
          { id: "comic", name: "Comic", promptTemplate: "STYLE COMIC ${aspectRatio}" },
        ],
        roleplayStoryboardAnimationTemplateId: "motion",
        roleplayStoryboardAnimationTemplates: [
          {
            id: "motion",
            name: "Motion",
            promptTemplate:
              "ANIMATION: imagePrompt is the exact T=0 frame. Add simple action, camera, source dialogue, sound effects, ambience, and end hold for ${durationSeconds} seconds.",
          },
        ],
        roleplayStoryboardOutputTemplateId: "output",
        roleplayStoryboardOutputTemplates: [{ id: "output", name: "Output", promptTemplate: "OUTPUT JSON" }],
      };
      const sections = [
        {
          index: 0,
          kind: "user" as const,
          speaker: "User" as const,
          messageId: "user<&quote",
          content: "Keep <thinking> and A&B verbatim.",
        },
        {
          index: 1,
          kind: "assistant" as const,
          speaker: "Assistant" as const,
          messageId: "assistant-1",
          content: "Mira turns toward the rain.",
        },
      ];

      const still = buildRoleplayStoryboardMessages({
        meta,
        sections,
        keyframeCount: 3,
        durationSeconds: 6,
        aspectRatio: "16:9",
        generateVideos: false,
      });
      assert.match(still.systemPrompt, /EPISODE 3/u);
      assert.match(still.systemPrompt, /STYLE COMIC 16:9/u);
      assert.match(still.systemPrompt, /OUTPUT JSON/u);
      assert.doesNotMatch(still.systemPrompt, /ANIMATION:/u);
      assert.match(still.messages[1]?.content ?? "", /Keep <thinking> and A&B verbatim\./u);
      assert.match(still.messages[1]?.content ?? "", /message_id="user&lt;&amp;quote"/u);
      assert.deepEqual(still.selectedTemplateIds, ["episode", "comic", "output"]);

      const animation = buildRoleplayStoryboardMessages({
        meta,
        sections,
        keyframeCount: 3,
        durationSeconds: 8,
        aspectRatio: "16:9",
        generateVideos: true,
      });
      assert.match(animation.systemPrompt, /exact T=0 frame/u);
      assert.match(animation.systemPrompt, /source dialogue, sound effects, ambience, and end hold/u);
      assert.match(animation.systemPrompt, /end hold for 8 seconds/u);
      assert.deepEqual(animation.selectedTemplateIds, ["episode", "comic", "motion", "output"]);
    },
  },
  {
    name: "custom Game GM text wins over a selected Storyboard Game preset",
    run() {
      assert.equal(
        resolveGameGmPromptTemplate({
          gameSystemPrompt: "My exact GM instructions",
          gameGmPromptTemplateId: ANIME_GAME_PROMPT_TEMPLATE_ID,
        }),
        "My exact GM instructions",
      );
      assert.equal(
        resolveGameGmPromptTemplate({ gameGmPromptTemplateId: ANIME_GAME_PROMPT_TEMPLATE_ID }),
        ANIME_GAME_SYSTEM_PROMPT,
      );
      assert.equal(
        resolveGameGmPromptTemplate({}, { gameGmPromptTemplateId: ANIME_GAME_PROMPT_TEMPLATE_ID }),
        ANIME_GAME_SYSTEM_PROMPT,
      );
    },
  },
  {
    name: "Storyboard host consumes package-owned prompts without restoring Engine globals",
    async run() {
      const sharedPlannerSource = readFileSync(
        new URL("../../../packages/shared/src/constants/game-storyboard-prompts.ts", import.meta.url),
        "utf8",
      );
      const sharedImageSource = readFileSync(
        new URL("../../../packages/shared/src/constants/game-storyboard-image-prompts.ts", import.meta.url),
        "utf8",
      );
      const settingsSource = readFileSync(
        new URL("../../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url),
        "utf8",
      );
      const drawerSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
        "utf8",
      );
      const settingsOrderSource = readFileSync(
        new URL("../../../packages/client/src/lib/agent-settings-order.ts", import.meta.url),
        "utf8",
      ).replace(/\r\n/gu, "\n");
      const roleplaySurfaceSource = readFileSync(
        new URL("../../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
        "utf8",
      ).replace(/\r\n/gu, "\n");
      const storyboardChatSettingsSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/StoryboardChatSettingsPanel.tsx", import.meta.url),
        "utf8",
      );
      const setupSource = readFileSync(
        new URL("../../../packages/client/src/components/game/GameSetupWizard.tsx", import.meta.url),
        "utf8",
      );
      const editorSource = readFileSync(
        new URL("../../../packages/client/src/components/agents/AgentEditor.tsx", import.meta.url),
        "utf8",
      );
      const storyboardEditorSource = readFileSync(
        new URL("../../../packages/client/src/components/agents/StoryboardAgentSettingsPanel.tsx", import.meta.url),
        "utf8",
      );
      const serviceSource = readFileSync(
        new URL("../../../packages/server/src/services/game/storyboard-agent-settings.ts", import.meta.url),
        "utf8",
      );
      const routeSource = readFileSync(
        new URL("../../../packages/server/src/routes/game.routes.ts", import.meta.url),
        "utf8",
      );
      const chatsRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/chats.routes.ts", import.meta.url),
        "utf8",
      );
      const storyboardOrderOffset = settingsOrderSource.match(
        /order\.set\(STORYBOARD_AGENT_ID,\s*\(order\.get\("illustrator"\)\s*\?\?\s*order\.size\)\s*\+\s*(\d+(?:\.\d+)?)\);/u,
      )?.[1];
      assert.equal(Number(storyboardOrderOffset), 0.5, "Storyboard settings should sort directly after Illustrator");

      const roleplayMenuLinksStart = drawerSource.indexOf("const roleplayAgentMenuLinks = useMemo(() => {");
      const roleplayMenuLinksEnd = drawerSource.indexOf("\n  }, [", roleplayMenuLinksStart);
      assert.notEqual(roleplayMenuLinksStart, -1, "Roleplay agent quick links should be defined");
      assert.notEqual(roleplayMenuLinksEnd, -1, "Roleplay agent quick links should have a bounded source block");
      const roleplayMenuLinksSource = drawerSource.slice(roleplayMenuLinksStart, roleplayMenuLinksEnd);
      assert.match(
        roleplayMenuLinksSource,
        /addLink\(ltmPackage\.id, metadata\.enableAgents === true && activeAgentIds\.includes\(ltmPackage\.id\), ltmAgent\.name\)/u,
        "Active Long-Term Memory should have a Roleplay agent menu link",
      );

      const activeAgentOrderStart = drawerSource.indexOf("const activeInCat = catAgents");
      const activeAgentMenuStart = drawerSource.indexOf("activeInCat.map((agent) => {");
      const activeAgentMenuEnd = drawerSource.indexOf("{/* Available agents to add */}", activeAgentMenuStart);
      assert.notEqual(activeAgentOrderStart, -1, "Active Roleplay agents should have an explicit order");
      assert.notEqual(activeAgentMenuStart, -1, "Active Roleplay agent menu items should be rendered");
      assert.notEqual(activeAgentMenuEnd, -1, "Active Roleplay agent menu source should be bounded");
      const activeAgentOrderSource = drawerSource.slice(activeAgentOrderStart, activeAgentMenuStart);
      assert.match(
        activeAgentOrderSource,
        /\.sort\([\s\S]*getRoleplayAgentSettingsOrder\(a\.id\)\s*-\s*getRoleplayAgentSettingsOrder\(b\.id\)/u,
        "Active Roleplay agent settings should use the same order as their quick links",
      );
      const activeAgentMenuSource = drawerSource.slice(activeAgentMenuStart, activeAgentMenuEnd);
      assert.match(
        drawerSource,
        /const renderStandaloneRoleplayAgentSettingsCard[\s\S]*?<AgentSettingsCard[\s\S]*?id=\{getAgentSettingsMenuId\(chat\.id, agent\.id\)\}/u,
        "Standalone Roleplay agents such as Long-Term Memory must expose the menu link target",
      );
      const standaloneAgentRendererStart = drawerSource.indexOf("const renderStandaloneRoleplayAgentSettingsCard =");
      const standaloneAgentRendererEnd = drawerSource.indexOf(
        "const updateAgentPromptTemplateSelection =",
        standaloneAgentRendererStart,
      );
      assert.notEqual(standaloneAgentRendererStart, -1, "Standalone Roleplay agent settings should be rendered");
      assert.notEqual(standaloneAgentRendererEnd, -1, "Standalone Roleplay agent settings should be bounded");
      const standaloneAgentRendererSource = drawerSource.slice(
        standaloneAgentRendererStart,
        standaloneAgentRendererEnd,
      );
      const storyboardMenuBranchStart = standaloneAgentRendererSource.indexOf(
        "} else if (agent.id === STORYBOARD_AGENT_ID) {",
      );
      const storyboardMenuBranchEnd = standaloneAgentRendererSource.indexOf(
        '} else if (agent.id === "beholder") {',
        storyboardMenuBranchStart,
      );
      assert.notEqual(storyboardMenuBranchStart, -1, "Active Storyboard should render its chat settings branch");
      assert.notEqual(storyboardMenuBranchEnd, -1, "Storyboard chat settings branch should be complete");
      const storyboardMenuBranchSource = standaloneAgentRendererSource.slice(
        storyboardMenuBranchStart,
        storyboardMenuBranchEnd,
      );

      const automaticStoryboardEffectStart = roleplaySurfaceSource.indexOf(
        "useEffect(() => {\n    const messageId = latestStoryboardMessage?.id;",
      );
      const automaticStoryboardEffectEnd = roleplaySurfaceSource.indexOf("\n  }, [", automaticStoryboardEffectStart);
      assert.notEqual(automaticStoryboardEffectStart, -1, "Automatic Storyboard completion effect should exist");
      assert.notEqual(automaticStoryboardEffectEnd, -1, "Automatic Storyboard completion effect should be bounded");
      const automaticStoryboardEffectSource = roleplaySurfaceSource.slice(
        automaticStoryboardEffectStart,
        automaticStoryboardEffectEnd,
      );
      const automaticBusyGuardStart = automaticStoryboardEffectSource.indexOf("if (\n      isStreaming ||");
      const automaticTriggerStart = automaticStoryboardEffectSource.indexOf(
        "void generateRoleplayStoryboard\n      .mutateAsync({",
        automaticBusyGuardStart,
      );
      const automaticArmIndex = automaticStoryboardEffectSource.lastIndexOf(
        "automaticStoryboardMessageRef.current = messageId;",
        automaticTriggerStart,
      );
      const automaticFlagIndex = automaticStoryboardEffectSource.indexOf("automatic: true", automaticTriggerStart);
      assert.ok(
        automaticBusyGuardStart >= 0 &&
          automaticArmIndex > automaticBusyGuardStart &&
          automaticTriggerStart > automaticArmIndex &&
          automaticFlagIndex > automaticTriggerStart,
        "Automatic Storyboard generation should wait for idle, arm the completed message, then trigger automatically",
      );
      const automaticBusyGuardSource = automaticStoryboardEffectSource.slice(
        automaticBusyGuardStart,
        automaticArmIndex,
      );

      assert.equal(normalizeGameStoryboardKeyframeCount(undefined), 3);
      assert.equal(normalizeGameStoryboardKeyframeCount(0), 1);
      assert.equal(normalizeGameStoryboardKeyframeCount(12), 12);
      assert.doesNotMatch(sharedPlannerSource, /You are Marinara's/u);
      assert.doesNotMatch(sharedImageSource, /promptTemplate:/u);
      assert.equal(listPromptOverrideKeys().includes("game.storyboardIllustrationDirector"), false);
      assert.equal(listPromptOverrideKeys().includes("game.storyboardAnimationDirector"), false);
      assert.doesNotMatch(settingsSource, /game\.storyboardIllustrationDirector|game\.storyboardAnimationDirector/u);
      assert.doesNotMatch(drawerSource, /gameStoryboard/u);
      assert.match(drawerSource, /lazy\(\(\) =>\s*import\("\.\/StoryboardChatSettingsPanel"\)/u);
      assert.match(
        roleplayMenuLinksSource,
        /addLink\(STORYBOARD_AGENT_ID, activeAgentIds\.includes\(STORYBOARD_AGENT_ID\), storyboardAgent\.name\)/u,
      );
      assert.match(
        activeAgentMenuSource,
        /const hasSettingsTarget = chatSettingsPackageByAgentId\.has\(agent\.id\);[\s\S]*id=\{hasSettingsTarget \? getAgentSettingsMenuId\(chat\.id, agent\.id\)/u,
      );
      assert.match(
        roleplayMenuLinksSource,
        /for \(const \[agentId, capabilityPackage\] of chatSettingsPackageByAgentId\)[\s\S]*addLink\(agentId, activeAgentIds\.includes\(agentId\), agent\?\.name \?\? capabilityPackage\.manifest\.name\)/u,
      );
      assert.match(storyboardMenuBranchSource, /<StoryboardChatSettingsPanel/u);
      assert.match(storyboardMenuBranchSource, /ownerMode="roleplay"/u);
      assert.match(
        automaticBusyGuardSource,
        /isStreaming\s*\|\|\s*agentProcessing\s*\|\|\s*messageHasPendingPostProcessing\(latestStoryboardMessage\)\s*\|\|\s*generateRoleplayStoryboard\.isPending/u,
      );
      assert.match(automaticBusyGuardSource, /\{\s*return;\s*\}/u);
      assert.match(storyboardChatSettingsSource, /settings\.plannerTemplates\.filter/u);
      assert.match(storyboardChatSettingsSource, /gameStoryboardIllustrationPromptTemplateId/u);
      assert.match(storyboardChatSettingsSource, /gameStoryboardAnimationPromptTemplateId/u);
      assert.match(storyboardChatSettingsSource, /gameStoryboardImagePromptTemplateId/u);
      assert.match(storyboardChatSettingsSource, /gameStoryboardVideoPromptTemplateId/u);
      assert.match(storyboardChatSettingsSource, /storyboardAgentImageAwareShotPlanningEnabled/u);
      assert.match(storyboardChatSettingsSource, /storyboardAgentAnimationRefinementTemplateId/u);
      assert.match(storyboardChatSettingsSource, /settings\.animationRefinementTemplates/u);
      assert.equal(
        storyboardChatSettingsSource.match(/<StoryboardImageAwarePlannerOverride/gu)?.length,
        2,
        "Game and Roleplay chat settings should both expose image-aware Step 3 overrides",
      );
      const gameChatSettingsStart = storyboardChatSettingsSource.indexOf("export function StoryboardChatSettingsPanel");
      const roleplayChatSettingsStart = storyboardChatSettingsSource.indexOf(
        "function RoleplayStoryboardChatSettingsPanel",
      );
      const gameChatSettingsSource = storyboardChatSettingsSource.slice(
        gameChatSettingsStart,
        roleplayChatSettingsStart,
      );
      const roleplayChatSettingsSource = storyboardChatSettingsSource.slice(roleplayChatSettingsStart);
      for (const [mode, source] of [
        ["Game", gameChatSettingsSource],
        ["Roleplay", roleplayChatSettingsSource],
      ] as const) {
        const stage2Index = source.indexOf("number={2}");
        const stage3Index = source.indexOf("<StoryboardImageAwarePlannerOverride");
        const stage4Index = source.indexOf("number={4}");
        assert.ok(
          stage2Index >= 0 && stage2Index < stage3Index && stage3Index < stage4Index,
          `${mode} chat settings should show production stages 2, 3, and 4 in runtime order`,
        );
      }
      assert.match(
        gameChatSettingsSource,
        /autoAnimationsEnabled \? \([\s\S]*<StoryboardImageAwarePlannerOverride[\s\S]*number=\{4\}/u,
        "Game chat settings should hide animation-only stages unless animations are enabled",
      );
      assert.match(
        roleplayChatSettingsSource,
        /autoGenerateMode === "animation" \? \([\s\S]*<StoryboardImageAwarePlannerOverride[\s\S]*number=\{4\}/u,
        "Roleplay chat settings should hide animation-only stages unless animations are enabled",
      );
      assert.match(storyboardChatSettingsSource, /automaticStoryboardIllustrations/u);
      assert.match(storyboardChatSettingsSource, /automaticStoryboardAnimations/u);
      assert.match(storyboardChatSettingsSource, /type="number"/u);
      assert.doesNotMatch(
        storyboardChatSettingsSource,
        /gameStoryboard(?:Prompt|Image|Video)ConnectionId|gameStoryboard(?:IncludeCharacterAppearance|UseAvatarReferences)/u,
      );
      assert.match(drawerSource, /<StoryboardChatSettingsPanel[\s\S]*?<\/Suspense>\s*<\/AgentSettingsCard>/u);
      assert.doesNotMatch(setupSource, /setEnableStoryboard|setStoryboardKeyframeCount/u);
      assert.match(setupSource, /setGamePresentation/u);
      assert.match(
        setupSource,
        /gameGmPromptTemplateId:\s*gamePresentation === "anime" \? ANIME_GAME_PROMPT_TEMPLATE_ID : null/u,
      );
      assert.match(chatsRouteSource, /const customPrompt = resolveGameGmPromptTemplate\(chatMeta, setupConfig\);/u);
      assert.match(editorSource, /StoryboardAgentSettingsPanel/u);
      assert.match(editorSource, /\{!isStoryboardAgent && !isAvatarAgent && \(\s*<FieldGroup[\s\S]*?agentBudget/u);
      assert.doesNotMatch(
        editorSource,
        /\.\.\.\(localContextSize !== "" \? \{ contextSize: Number\(localContextSize\) \} : \{\}\)/u,
      );
      assert.doesNotMatch(
        editorSource,
        /\.\.\.\(localMaxTokens !== "" \? \{ maxTokens: clampAgentMaxTokens\(localMaxTokens\) \} : \{\}\)/u,
      );
      const activeEditorStart = storyboardEditorSource.indexOf("export function StoryboardAgentSettingsPanel");
      assert.ok(activeEditorStart >= 0, "Storyboard active-flow editor should exist");
      const setupComponentStart = storyboardEditorSource.indexOf("function StoryboardSetupSection");
      const setupComponentEnd = storyboardEditorSource.indexOf("function SelectedTemplateControl", setupComponentStart);
      const setupComponentSource = storyboardEditorSource.slice(setupComponentStart, setupComponentEnd);
      assert.notEqual(setupComponentStart, -1, "Shared Storyboard setup should exist");
      assert.notEqual(setupComponentEnd, -1, "Shared Storyboard setup source should be bounded");
      assert.doesNotMatch(setupComponentSource, /useState|aria-expanded|aria-controls/u);
      assert.match(setupComponentSource, /\{children\}/u, "Shared Storyboard setup should always render its controls");
      const activeEditorSource = storyboardEditorSource.slice(activeEditorStart);
      const stageLibraryStart = storyboardEditorSource.indexOf("function StagePromptLibrary");
      const stageLibraryEnd = storyboardEditorSource.indexOf("function StoryboardSetupSection", stageLibraryStart);
      const stageLibrarySource = storyboardEditorSource.slice(stageLibraryStart, stageLibraryEnd);
      assert.notEqual(stageLibraryStart, -1, "Storyboard stage prompt library disclosure should exist");
      assert.match(stageLibrarySource, /useState\(false\)/u);
      assert.match(stageLibrarySource, /aria-expanded=\{expanded\}/u);
      assert.match(stageLibrarySource, /expanded \? \(/u);
      assert.match(stageLibrarySource, /data-storyboard-stage-prompt-library=\{stage\}/u);
      assert.equal(
        activeEditorSource.match(/<StagePromptLibrary stage=\{/gu)?.length,
        5,
        "Roleplay and Game should each have a Stage 1 library, followed by shared Stage 2, 3, and 4 libraries",
      );
      assert.equal(
        activeEditorSource.match(/<TemplateCollectionEditor/gu)?.length,
        8,
        "All prompt collections should be editable inside their numbered stage libraries",
      );
      assert.equal(
        activeEditorSource.match(/<StagePromptLibrary stage=\{1\}/gu)?.length,
        2,
        "Roleplay and Game should keep separate Stage 1 prompt libraries",
      );
      for (const collection of [
        "roleplayEpisodeTemplates",
        "roleplayStyleTemplates",
        "roleplayAnimationTemplates",
        "roleplayOutputTemplates",
        "illustrationTemplates",
        "animationRefinementTemplates",
        "videoTemplates",
      ]) {
        assert.match(
          activeEditorSource,
          new RegExp(`settings\\.${collection}`, "u"),
          `${collection} should remain editable in its numbered stage library`,
        );
      }
      assert.match(activeEditorSource, /templates=\{plannerTemplates\}/u);
      assert.match(activeEditorSource, /onPlannerTemplatesChange\(templates\)/u);
      assert.match(activeEditorSource, /renderTemplateMeta=/u);
      assert.match(activeEditorSource, /ui\.agents\.agenteditor\.copyDefaultToEdit/u);
      assert.match(
        activeEditorSource,
        /plannerPrompt\.trim\(\) \? \([\s\S]*<MacroTextarea[\s\S]*\) : \(\s*<pre/u,
        "The built-in fallback planner prompt should stay read-only until explicitly copied",
      );

      const setupIndex = activeEditorSource.indexOf("<StoryboardSetupSection");
      const workflowTabsIndex = activeEditorSource.indexOf('role="tablist"');
      const roleplayWorkflowStart = activeEditorSource.indexOf("data-storyboard-active-roleplay");
      const gameWorkflowStart = activeEditorSource.indexOf("data-storyboard-active-game");
      assert.ok(
        setupIndex >= 0 && setupIndex < workflowTabsIndex,
        "Compact Storyboard setup should appear before the mode-specific active flow",
      );
      assert.ok(
        workflowTabsIndex < roleplayWorkflowStart && roleplayWorkflowStart < gameWorkflowStart,
        "Roleplay and Game Mode should be distinct navigable workflows",
      );
      assert.match(activeEditorSource, /role="tabpanel"/u);
      assert.match(activeEditorSource, /aria-controls="storyboard-active-flow"/u);
      const roleplayWorkflowSource = activeEditorSource.slice(roleplayWorkflowStart, gameWorkflowStart);
      const gameWorkflowSource = activeEditorSource.slice(gameWorkflowStart);
      assert.ok(
        roleplayWorkflowSource.indexOf("number={1}") < roleplayWorkflowSource.indexOf("{sharedWorkflowStages}"),
        "Roleplay planning must render before the shared production stages",
      );
      assert.ok(
        gameWorkflowSource.indexOf("number={1}") < gameWorkflowSource.indexOf("{sharedWorkflowStages}"),
        "Game planning must render before the shared production stages",
      );
      assert.match(roleplayWorkflowSource, /settings\.roleplayEpisodeTemplateId/u);
      assert.match(roleplayWorkflowSource, /settings\.roleplayStyleTemplateId/u);
      assert.match(roleplayWorkflowSource, /settings\.roleplayAnimationTemplateId/u);
      assert.match(roleplayWorkflowSource, /settings\.roleplayOutputTemplateId/u);
      assert.match(gameWorkflowSource, /settings\.illustrationPlannerTemplateId/u);
      assert.match(gameWorkflowSource, /settings\.animationPlannerTemplateId/u);
      assert.match(gameWorkflowSource, /settings\.viewerDisplayMode/u);

      const sharedStagesStart = activeEditorSource.indexOf("const sharedWorkflowStages");
      const sharedStagesEnd = activeEditorSource.indexOf("\n\n  return (", sharedStagesStart);
      const sharedStagesSource = activeEditorSource.slice(sharedStagesStart, sharedStagesEnd);
      const stage2Index = sharedStagesSource.indexOf("number={2}");
      const stage3Index = sharedStagesSource.indexOf("number={3}");
      const stage4Index = sharedStagesSource.indexOf("number={4}");
      assert.ok(
        stage2Index >= 0 && stage2Index < stage3Index && stage3Index < stage4Index,
        "Shared production stages should render in image, image-aware, then video order",
      );
      assert.match(activeEditorSource, /const showAnimationStages = settings\.autoGenerateMode !== "illustration"/u);
      assert.match(sharedStagesSource, /showAnimationStages \? \(/u);
      assert.match(sharedStagesSource, /data-storyboard-still-flow-note/u);
      assert.match(sharedStagesSource, /settings\.usePromptTemplate \? \(/u);
      assert.match(sharedStagesSource, /settings\.imageAwareShotPlanningEnabled \? \(/u);
      assert.doesNotMatch(editorSource, /StoryboardAdvancedPromptLibrary|storyboardPromptLibraryOpen/u);
      assert.match(
        editorSource,
        /\{!isStoryboardAgent && !isAvatarAgent \? \(\s*<FieldGroup\s*label=\{localizeUi\("ui\.agents\.agenteditor\.promptTemplate"\)\}/u,
        "Storyboard should not render a second global prompt library below its numbered stages",
      );
      assert.match(editorSource, /onPlannerPromptChange=\{setLocalPrompt\}/u);
      assert.match(editorSource, /onPlannerTemplatesChange=\{setLocalPromptTemplates\}/u);
      assert.match(editorSource, /includeCharacterAppearance:\s*settings\.includeCharacterAppearance/u);
      assert.match(editorSource, /useAvatarReferences:\s*settings\.useAvatarReferences/u);
      assert.match(serviceSource, /ensureBuiltinConfig\(STORYBOARD_AGENT_ID\)/u);
      assert.match(
        serviceSource,
        /meta\.gameImageIncludeCharacterAppearance \?\? settings\.includeCharacterAppearance/u,
      );
      assert.match(serviceSource, /meta\.gameImageUseAvatarReferences \?\? settings\.useAvatarReferences/u);
      assert.match(serviceSource, /meta\.gameSceneConnectionId \?\? config\.connectionId/u);
      assert.match(serviceSource, /meta\.gameImageConnectionId \?\? settings\.imageConnectionId/u);
      assert.match(serviceSource, /meta\.gameVideoConnectionId \?\? settings\.videoConnectionId/u);
      assert.match(routeSource, /Install the Storyboard Agent before generating Game storyboards/u);
      assert.match(routeSource, /storyboardAgentImageConnectionId/u);
      assert.match(routeSource, /storyboardAgentVideoConnectionId/u);
      assert.match(routeSource, /meta\.storyboardAgentIncludeCharacterAppearance !== false/u);
      assert.match(routeSource, /meta\.storyboardAgentUseAvatarReferences !== false/u);
      assert.match(
        routeSource,
        /setupConfig\.enableSpriteGeneration \? \[BUILT_IN_AGENT_IDS\.ILLUSTRATOR\] : \[\]/u,
        "Game setup must activate Illustrator when visual generation is enabled",
      );
      assert.match(
        routeSource,
        /setupConfig\.gameStoryboardsEnabled \? \[STORYBOARD_AGENT_ID\] : \[\]/u,
        "Game setup must activate Storyboard when storyboard generation is enabled",
      );

      assert.deepEqual(
        {
          includeCharacterAppearance: normalizeStoryboardAgentSettings({}).includeCharacterAppearance,
          useAvatarReferences: normalizeStoryboardAgentSettings({}).useAvatarReferences,
        },
        { includeCharacterAppearance: true, useAvatarReferences: true },
      );
      assert.deepEqual(
        {
          includeCharacterAppearance: normalizeStoryboardAgentSettings({ includeCharacterAppearance: false })
            .includeCharacterAppearance,
          useAvatarReferences: normalizeStoryboardAgentSettings({ useAvatarReferences: false }).useAvatarReferences,
        },
        { includeCharacterAppearance: false, useAvatarReferences: false },
      );
      assert.deepEqual(
        {
          keyframeCount: normalizeStoryboardAgentSettings({ keyframeCount: null }).keyframeCount,
          animationDurationSeconds: normalizeStoryboardAgentSettings({ animationDurationSeconds: "" })
            .animationDurationSeconds,
        },
        { keyframeCount: 3, animationDurationSeconds: 5 },
      );
      const relabeledVideoTemplate = normalizeStoryboardAgentSettings({
        videoTemplates: [
          {
            id: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
            name: "LTX Director Video",
            description: "Legacy built-in label",
            promptTemplate: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE,
          },
        ],
      }).videoTemplates[0];
      assert.deepEqual(
        { id: relabeledVideoTemplate?.id, name: relabeledVideoTemplate?.name },
        { id: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID, name: "Narration Passthrough" },
        "Existing Storyboard configs should receive the clearer Stage 4 built-in label without changing its id",
      );

      const ctx = {
        sceneTitleLine: "Mira at the gate.",
        scenePrompt: "Mira braces beneath a storm-lit archway.",
        finalVisibilityRuleLine: "Final visibility rule: Only depict Mira.",
        narrativePurposeLine: "Narrative purpose: arrival.",
        charactersLine: "Characters: Mira.",
        referenceHandlingLine: "Reference handling: match the attached portrait.",
        locationHandlingLine: "Location handling: use the attached gate image.",
        appearanceNotesBlock: "",
        artDirectionLine: "Art direction: painterly fantasy.",
        imagePromptInstructionsLine: "User image instructions: keep the silver cloak.",
      };
      const rendered = await loadGameStoryboardImagePrompt({
        templateId: STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
        customTemplates: [
          {
            id: STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
            name: "Storyboard Illustration",
            promptTemplate: "${scenePrompt}\n${locationHandlingLine}\n${imagePromptInstructionsLine}",
          },
        ],
        ctx,
      });
      assert.match(rendered, /Mira braces beneath a storm-lit archway/u);
      assert.match(rendered, /Location handling: use the attached gate image/u);
      const staleSelectionFallback = await loadGameStoryboardImagePrompt({
        templateId: "removed-template",
        customTemplates: [
          {
            id: STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
            name: "Storyboard Illustration",
            promptTemplate: "${scenePrompt}\n${locationHandlingLine}",
          },
        ],
        ctx,
      });
      assert.match(staleSelectionFallback, /Mira braces beneath a storm-lit archway/u);
      await assert.rejects(
        () => loadGameStoryboardImagePrompt({ customTemplates: [], ctx }),
        /Storyboard Agent does not provide a usable image formatter prompt/u,
      );
    },
  },
  {
    name: "LTX Storyboard video formatter sends one complete prompt through the universal video contract",
    run() {
      const videoPreset = GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.find(
        (template) => template.id === LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
      );
      const gameRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/game.routes.ts", import.meta.url),
        "utf8",
      );

      assert.equal(videoPreset?.name, "Narration Passthrough");
      assert.equal(videoPreset?.promptTemplate, LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE);
      assert.equal(LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE, "${narrationSummary}");
      assert.doesNotMatch(gameRouteSource, /buildLtxDirectorStoryboardPrompt|sanitizeLtxDirectorStoryboardSegments/);
      assert.doesNotMatch(gameRouteSource, /ltxDirectorPrompt:\s*promptBuild|storyboardVideoTemplateId/);
      assert.match(gameRouteSource, /generateStoryboardVideos && !usedFallbackStoryboardPlanner/);
      assert.match(gameRouteSource, /if \(storyboardAbortSignal\.aborted\)/);
      assert.match(gameRouteSource, /completeStoryboardPlan\(\{/);
      assert.match(gameRouteSource, /Storyboard keyframe is missing its planned animation prompt/);
      assert.doesNotMatch(
        gameRouteSource,
        /plannedFrame\.narrationBeat[\s\S]{0,160}\|\|[\s\S]{0,80}latestNarrationSummary/,
      );

      const timelineData = JSON.stringify({
        global_prompt: "",
        normalStartFrame: 0,
        normalDurationFrames: 0,
        segments: [
          {
            id: "marinara-reference",
            start: 0,
            length: 16,
            prompt: "",
            type: "image",
            imageFile: "%reference_image_name%",
            isEndFrame: false,
          },
        ],
        motionSegments: [],
        audioSegments: [],
      }).replace('"normalDurationFrames":0', '"normalDurationFrames":%length%');
      const workflow = {
        "3678": {
          inputs: {
            end_second: "%duration_seconds%",
            length_seconds: "%length_s%",
            duration_seconds: "%duration_seconds%",
            end_frame: "%length%",
            duration_frames: "%length%",
            global_prompt: "%prompt%",
            timeline_data: timelineData,
            local_prompts: "",
            segment_lengths: "",
            guide_strength: "1.00",
            frame_rate: "%fps%",
            custom_width: "%width%",
            custom_height: "%height%",
          },
        },
      };
      const completePrompt =
        'She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.';
      const resolved = resolveComfyUiVideoWorkflowPlaceholders(
        workflow,
        {
          prompt: completePrompt,
          durationSeconds: 6,
          fps: 24,
          model: "ltx-2.3-distilled",
        },
        { seed: 123, width: 1280, height: 720, referenceImageName: "marinara-reference.png" },
      ) as typeof workflow;
      const inputs = resolved["3678"].inputs;
      assert.equal(inputs.end_second, 6);
      assert.equal(inputs.length_seconds, 6);
      assert.equal(inputs.duration_seconds, 6);
      assert.equal(inputs.end_frame, 144);
      assert.equal(inputs.duration_frames, 144);
      assert.equal(inputs.frame_rate, 24);
      assert.equal(inputs.global_prompt, completePrompt);
      assert.equal(inputs.local_prompts, "");
      assert.equal(inputs.segment_lengths, "");
      assert.equal(inputs.guide_strength, "1.00");
      assert.equal(inputs.custom_width, 1280);
      assert.equal(inputs.custom_height, 720);
      const resolvedTimeline = JSON.parse(inputs.timeline_data) as {
        global_prompt: string;
        normalDurationFrames: number;
        segments: Array<{ start: number; imageFile: string }>;
      };
      assert.equal(resolvedTimeline.global_prompt, "");
      assert.equal(resolvedTimeline.normalDurationFrames, 144);
      assert.equal(resolvedTimeline.segments.length, 1);
      assert.equal(resolvedTimeline.segments[0]?.start, 0);
      assert.equal(resolvedTimeline.segments[0]?.imageFile, "marinara-reference.png");

      const ordinaryRequest = { prompt: "Existing complete video prompt", durationSeconds: 6 };
      assert.deepEqual(resolveLtxDirectorPromptInput(ordinaryRequest), {
        globalPrompt: ordinaryRequest.prompt,
        localPrompts: "",
        segmentLengths: "",
      });
      const ordinaryResolved = resolveComfyUiVideoWorkflowPlaceholders(workflow, ordinaryRequest, {
        seed: 456,
        width: 1280,
        height: 720,
        referenceImageName: "ordinary-reference.png",
      }) as typeof workflow;
      assert.equal(ordinaryResolved["3678"].inputs.global_prompt, ordinaryRequest.prompt);
      assert.equal(ordinaryResolved["3678"].inputs.local_prompts, "");
      assert.equal(ordinaryResolved["3678"].inputs.segment_lengths, "");

      const compatibleDirectorWorkflow = {
        node: { inputs: { global_prompt: "%global_prompt%", local_prompts: "%local_prompts%" } },
      };
      assert.deepEqual(
        resolveComfyUiVideoWorkflowPlaceholders(compatibleDirectorWorkflow, ordinaryRequest, {
          seed: 654,
          width: 1280,
          height: 720,
        }),
        { node: { inputs: { global_prompt: ordinaryRequest.prompt, local_prompts: "" } } },
      );

      const referenceWorkflow = {
        node: {
          inputs: {
            base64: "%reference_image%",
            base64Slot1: "%reference_image_01%",
            base64Slot2: "%reference_image_02%",
            base64Slot3: "%reference_image_03%",
            base64Slot4: "%reference_image_04%",
            filename: "%reference_image_name%",
            filenameSlot2: "%reference_image_name_02%",
          },
        },
      };
      assert.deepEqual(
        resolveComfyUiVideoWorkflowPlaceholders(referenceWorkflow, ordinaryRequest, {
          seed: 321,
          width: 1280,
          height: 720,
          referenceImageBase64: "cG5n",
          referenceImageName: "reference.png",
        }),
        {
          node: {
            inputs: {
              base64: "cG5n",
              base64Slot1: "cG5n",
              base64Slot2: "cG5n",
              base64Slot3: "cG5n",
              base64Slot4: "cG5n",
              filename: "reference.png",
              filenameSlot2: "reference.png",
            },
          },
        },
      );

      const legacyWorkflow = {
        node: {
          inputs: {
            prompt: "%prompt%",
            seed: "%seed%",
            width: "%width%",
            height: "%height%",
            frames: "%length%",
            lengthSeconds: "%length_s%",
            fps: "%fps%",
          },
        },
      };
      assert.deepEqual(
        resolveComfyUiVideoWorkflowPlaceholders(legacyWorkflow, ordinaryRequest, {
          seed: 789,
          width: 1280,
          height: 720,
        }),
        {
          node: {
            inputs: {
              prompt: ordinaryRequest.prompt,
              seed: 789,
              width: 1280,
              height: 720,
              frames: 96,
              lengthSeconds: 6,
              fps: 16,
            },
          },
        },
      );
    },
  },
  {
    name: "Storyboard appearance always reaches the planner and is injected once into render prompts",
    async run() {
      const appearance = "auburn hair, green eyes, leather jacket";
      const description = "A verbose roleplay card description that must not be sent as visual appearance.";

      assert.equal(extractCharacterAppearanceText({ extensions: { appearance }, description }), appearance);
      assert.equal(
        extractCharacterAppearanceText({
          extensions: { appearance: `${appearance} {{// author-only note}}` },
          description,
        }),
        appearance,
      );
      assert.equal(extractCharacterAppearanceText({ appearance, description }), appearance);
      assert.equal(extractCharacterAppearanceText({ description }), "");
      assert.equal(
        extractCharacterAppearanceText({ extensions: { appearance }, description }),
        readIllustratorAppearance({ extensions: { appearance }, description }),
      );
      const longAppearance = "silver braided hair with violet ribbon ".repeat(80).trim();
      assert.equal(readIllustratorAppearance({ appearance: longAppearance }), longAppearance);
      assert.equal(
        normalizeIllustratorAppearance("  silver hair {{// private note}}\n blue eyes  "),
        "silver hair blue eyes",
      );

      const normalizedResolution = await resolveIllustratorCharacterReferences({
        charactersStore: {
          list: async () => [
            {
              id: "database-character",
              data: { name: "Database", extensions: { appearance: "DB hair {{// hidden}}" } },
            },
          ],
        },
        chatCharacters: [{ id: "chat-character", name: "Chat", appearance: "Chat hair {{// hidden}}\n green eyes" }],
        persona: { id: "persona", name: "Persona", appearance: "Persona hair {{// hidden}}\n brown eyes" },
        requestedNames: ["Database", "Chat", "Persona"],
        promptText: "Database, Chat, and Persona",
        includeReferenceImages: false,
      });
      assert.match(normalizedResolution.appearanceBlock ?? "", /Database's Appearance: DB hair/u);
      assert.match(normalizedResolution.appearanceBlock ?? "", /Chat's Appearance: Chat hair green eyes/u);
      assert.match(normalizedResolution.appearanceBlock ?? "", /Persona's Appearance: Persona hair brown eyes/u);
      assert.doesNotMatch(normalizedResolution.appearanceBlock ?? "", /hidden/u);

      const appearanceContextBlock = buildGameIllustratorAppearanceContextBlock([
        `Lyra's Appearance: ${extractCharacterAppearanceText({ extensions: { appearance }, description })}`,
      ]);
      assert.match(appearanceContextBlock, /^<character_appearance_context>/u);
      assert.match(appearanceContextBlock, new RegExp(appearance, "u"));
      assert.doesNotMatch(appearanceContextBlock, new RegExp(description, "u"));

      // #7053: a persona with the image override enabled must contribute its
      // override text to the Game illustration appearance context, exactly like a
      // character. The /game/generate-assets illustration path previously loaded
      // only character rows, so the persona produced no line at all — with or
      // without an override.
      const personaOverrideTags = "1boy, caucasian, tall male, muscular, black hair, green eyes";
      const personaProse = "Lean-muscular build with a velvety voice and forest-toned wardrobe.";
      const personaOverrideLine = readImageAppearanceOverride(
        { imageAppearanceEnabled: true, imageAppearance: personaOverrideTags },
        personaProse,
      );
      assert.equal(personaOverrideLine, personaOverrideTags, "the persona override wins for the game context");
      const personaContextBlock = buildGameIllustratorAppearanceContextBlock([
        `Fel Lockheart's Appearance: ${personaOverrideLine}`,
        `Jessica's Appearance: ${appearance}`,
      ]);
      assert.match(personaContextBlock, /Fel Lockheart's Appearance: 1boy, caucasian/u);
      assert.doesNotMatch(personaContextBlock, /velvety voice/u, "persona prose must not reach the game context");

      // The helper call above would still pass if the route stopped loading the
      // persona, which is the actual defect. Exercise the shared loader the Game
      // illustration routes call, so removing that wiring fails this regression.
      const gamePersonaGallery = { kind: "persona-gallery" } as never;
      const gamePersonaMaps = () => ({
        charReferenceByName: new Map<string, string>(),
        charReferenceSourceByName: new Map<string, string>(),
        charAvatarByName: new Map<string, string>(),
        charDescriptionByName: new Map<string, string>(),
      });
      const enabledPersonaRow = {
        id: "persona-fel",
        name: "Fel Lockheart",
        appearance: personaProse,
        imageAppearanceEnabled: "true",
        imageAppearance: personaOverrideTags,
      };
      const disabledPersonaRow = { ...enabledPersonaRow, imageAppearanceEnabled: "false" };

      const enabledMaps = gamePersonaMaps();
      const enabledName = await addChatPersonaIllustrationAssets({
        maps: enabledMaps,
        characters: { getPersona: async () => enabledPersonaRow } as never,
        personaGallery: gamePersonaGallery,
        chat: { personaId: "persona-fel" },
        setupConfig: null,
      });
      assert.equal(enabledName, "Fel Lockheart", "the selected persona must resolve by name");
      // `addNameLookupEntry` keys by normalized aliases (lowercase, per word), not
      // by the display name, so assert on the stored text rather than the raw key.
      assert.ok(
        [...enabledMaps.charDescriptionByName.values()].includes(personaOverrideTags),
        "the persona's enabled override must reach the Game illustration appearance maps",
      );

      const disabledMaps = gamePersonaMaps();
      await addChatPersonaIllustrationAssets({
        maps: disabledMaps,
        characters: { getPersona: async () => disabledPersonaRow } as never,
        personaGallery: gamePersonaGallery,
        chat: { personaId: "persona-fel" },
        setupConfig: null,
      });
      assert.ok(
        [...disabledMaps.charDescriptionByName.values()].includes(personaProse),
        "a disabled persona override must fall back to the persona appearance",
      );
      assert.ok(
        ![...disabledMaps.charDescriptionByName.values()].includes(personaOverrideTags),
        "a disabled persona override must not leak into the Game illustration maps",
      );

      // No persona selected -> nothing added, and no throw.
      const nothingMaps = gamePersonaMaps();
      assert.equal(
        await addChatPersonaIllustrationAssets({
          maps: nothingMaps,
          characters: { getPersona: async () => enabledPersonaRow } as never,
          personaGallery: gamePersonaGallery,
          chat: { personaId: null },
          setupConfig: null,
        }),
        null,
      );
      assert.equal(nothingMaps.charDescriptionByName.size, 0, "no persona means no appearance entry");

      // Both Game illustration routes must share the loader, so a fix in one
      // cannot leave the other behind.
      const gameRoutesSource = readFileSync(
        new URL("../../../packages/server/src/routes/game.routes.ts", import.meta.url),
        "utf8",
      );
      const listenerCalls = gameRoutesSource.match(/await addChatPersonaIllustrationAssets\(\{/gu) ?? [];
      assert.equal(
        listenerCalls.length,
        2,
        "both /generate-assets and /generate-assets/preview must load the chat persona",
      );
      assert.equal(
        (gameRoutesSource.match(/addPersonaIllustrationAssets\(/gu) ?? []).length,
        3,
        "the persona asset helper should have exactly one definition and two shared-loader call sites",
      );

      // Disabled or empty persona override falls back to the persona prose.
      assert.equal(
        readImageAppearanceOverride(
          { imageAppearanceEnabled: false, imageAppearance: personaOverrideTags },
          personaProse,
        ),
        personaProse,
      );
      assert.equal(
        readImageAppearanceOverride({ imageAppearanceEnabled: true, imageAppearance: "   " }, personaProse),
        personaProse,
      );

      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "You raise your hand beside 2B- as the shrine begins to glow.",
          sections: [],
          allowedCharacterNames: ["2B-", "matt", "Mara Venn"],
          activePersonaName: "matt",
        }),
        ["matt", "2B-"],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "You raise your hand beside 2B- as the shrine begins to glow.",
          sections: [],
          allowedCharacterNames: ["2B-", "matt", "Mara Venn"],
        }),
        ["2B-"],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "Grish joins Elowen, Rowan, Tusk, and Voss beside the gate.",
          sections: [],
          allowedCharacterNames: [
            "Old Grish",
            "Young Elowen",
            "Elder Rowan",
            "Great Tusk",
            "Captain Voss",
            "Amber Slime",
            "Blue Ooze",
            "Violet Myconid",
          ],
        }),
        ["Old Grish", "Young Elowen", "Elder Rowan", "Great Tusk", "Captain Voss"],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "Amber light turns the old stone blue beside a violet banner.",
          sections: [],
          allowedCharacterNames: ["Old Grish", "Amber Slime", "Blue Ooze", "Violet Myconid"],
        }),
        [],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "Grish raises his lantern.",
          sections: [],
          allowedCharacterNames: ["Old Grish", "Young Grish"],
        }),
        [],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "Old Grish raises his lantern.",
          sections: [],
          allowedCharacterNames: ["Old Grish", "Young Grish"],
        }),
        ["Old Grish"],
      );
      assert.deepEqual(
        selectStoryboardAppearanceCharacterNames({
          sourceNarration: "Old waits beside the gate.",
          sections: [],
          allowedCharacterNames: ["Old"],
        }),
        ["Old"],
      );

      const narrationSummaryMessages = await buildIllustrationNarrationSummaryMessages({
        illustration: {
          prompt: "Lyra stands beneath the moon while rain darkens her jacket and the forest around her.",
          characters: ["Lyra"],
        },
        narration: "Lyra stands beneath the moon while rain darkens her jacket and the forest around her.",
        characterAppearanceContextBlock: appearanceContextBlock,
      });
      const narrationSummarySystemPrompt = narrationSummaryMessages[0]?.content ?? "";
      assert.match(narrationSummarySystemPrompt, /^You are Marinara's Game Mode narration summarizer/u);
      assert.ok(narrationSummarySystemPrompt.indexOf(appearanceContextBlock) > 0);
      assert.ok(
        narrationSummarySystemPrompt.indexOf(appearanceContextBlock) <
          narrationSummarySystemPrompt.indexOf("Read the completed turn narration"),
      );
      assert.match(narrationSummarySystemPrompt, /never invent or contradict a supplied hair color/iu);

      const narrationSummaryWithoutAppearance = await buildIllustrationNarrationSummaryMessages({
        illustration: {
          prompt: "Lyra stands beneath the moon while rain darkens the forest around her.",
          characters: ["Lyra"],
        },
        narration: "Lyra stands beneath the moon while rain darkens the forest around her.",
      });
      assert.doesNotMatch(narrationSummaryWithoutAppearance[0]?.content ?? "", /character_appearance_context/u);

      const storyboardMessages = await buildStoryboardIllustratorMessages({
        meta: {
          gameStoryboardPromptTemplates: [
            {
              id: "regression-still-planner",
              name: "Regression Still Planner",
              promptTemplate: [
                "You are Marinara's Game Mode Storyboard Illustrator.",
                "Turn exactly one completed GM narration into a concise storyboard.",
                "If a visual trait is not supplied, omit it instead of guessing.",
              ].join("\n"),
            },
          ],
          gameStoryboardIllustrationPlannerTemplateIds: ["regression-still-planner"],
          gameStoryboardIllustrationPromptTemplateId: "regression-still-planner",
        },
        setupConfig: null,
        latestState: null,
        sourceNarration: "Lyra stands beneath the moon while rain darkens the forest around her.",
        sections: [
          {
            index: 0,
            kind: "narration",
            content: "Lyra stands beneath the moon while rain darkens the forest around her.",
          },
        ],
        keyframeCount: 1,
        durationSeconds: 6,
        aspectRatio: "16:9",
        generateVideos: false,
        allowedCharacterNames: ["Lyra"],
        maxVisibleCharacters: 1,
        characterAppearanceContextBlock: appearanceContextBlock,
      });
      assert.match(storyboardMessages.systemPrompt, /^You are Marinara's Game Mode Storyboard Illustrator/u);
      assert.ok(storyboardMessages.systemPrompt.indexOf(appearanceContextBlock) > 0);
      assert.ok(
        storyboardMessages.systemPrompt.indexOf(appearanceContextBlock) <
          storyboardMessages.systemPrompt.indexOf("Turn exactly one completed GM narration"),
      );
      assert.match(storyboardMessages.systemPrompt, /omit it instead of guessing/iu);

      const compiled = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        prompt:
          "Lyra standing in a moonlit forest Final visibility rule: Only depict these named visible characters: Lyra.",
        characters: ["Lyra"],
        characterDescriptions: [`Lyra's Appearance: ${appearance}`],
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.match(compiled.prompt, /Character appearance notes:\s*Lyra's Appearance:/u);
      assert.match(compiled.prompt, /Final visibility rule: Only depict these named visible characters: Lyra/iu);
      assert.doesNotMatch(compiled.prompt, /without an attached reference image/iu);
      assert.doesNotMatch(compiled.prompt, new RegExp(description, "u"));

      const separatedVisibilityCompiled = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        prompt:
          "Lyra standing in a moonlit forest Final visibility rule: Only depict these named visible characters: Lyra.",
        characters: ["Lyra"],
        storyboardImagePromptTemplateId: "separated-visibility",
        storyboardImagePromptTemplates: [
          {
            id: "separated-visibility",
            name: "Separated Visibility",
            promptTemplate: "SCENE ${scenePrompt}\nSCOPE ${finalVisibilityRuleLine}",
          },
        ],
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.equal(
        separatedVisibilityCompiled.prompt,
        "SCENE Lyra standing in a moonlit forest\nSCOPE Final visibility rule: Only depict these named visible characters: Lyra.",
      );

      const fallbackFirstFrameCompiled = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        prompt: "Lyra standing in a moonlit forest",
        characters: ["Lyra"],
        characterDescriptions: [`Lyra's Appearance: ${appearance}`],
        ensureCharacterAppearance: true,
        storyboardImagePromptTemplateId: "storyboard-first-frame",
        storyboardImagePromptTemplates: [
          {
            id: "storyboard-first-frame",
            name: "Storyboard First Frame",
            promptTemplate: "${scenePrompt}",
          },
        ],
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.match(fallbackFirstFrameCompiled.prompt, /Character appearance notes:\s*Lyra's Appearance:/u);
      assert.equal(fallbackFirstFrameCompiled.prompt.match(/Character appearance notes:/gu)?.length, 1);

      const compiledWithoutAttachedAppearance = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        prompt: "Lyra standing in a moonlit forest",
        characters: ["Lyra"],
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.doesNotMatch(compiledWithoutAttachedAppearance.prompt, /Character appearance notes:/u);

      const longCharacterNames = ["Lyra", "Korr", "Mira", "Tarin", "Sable", "Orin"];
      const longCompiled = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        prompt: "Six adventurers regroup around a moonlit shrine.",
        characters: longCharacterNames,
        characterDescriptions: longCharacterNames.map(
          (name) => `${name}'s Appearance: ${"silver braided hair with violet ribbon ".repeat(80).trim()}`,
        ),
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.ok(longCompiled.prompt.length > 7000);
      const longAppearanceBlock = longCompiled.prompt.split("Character appearance notes:\n")[1] ?? "";
      const longAppearanceLines = longAppearanceBlock.split("\n").filter((line) => line.includes("'s Appearance:"));
      assert.equal(longAppearanceLines.length, longCharacterNames.length);
      for (const name of longCharacterNames) {
        const fullDescription = `${name}'s Appearance: ${"silver braided hair with violet ribbon ".repeat(80).trim()}`;
        assert.ok(longAppearanceLines.includes(fullDescription), `${name}'s full appearance must reach the provider`);
      }

      const directCompiled = await buildSceneIllustrationProviderPrompt({
        chatId: "prompt-regression",
        title: "Moonlit meeting",
        prompt:
          "Lyra standing in a moonlit forest Final visibility rule: Only depict these named visible characters: Lyra.",
        reason: "Key emotional moment",
        characters: ["Lyra"],
        characterDescriptions: [`Lyra's Appearance: ${appearance}`],
        imagePromptInstructions: "Keep the moon visible.",
        useGamePromptTemplate: false,
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.match(directCompiled.prompt, /^Lyra standing in a moonlit forest/u);
      assert.match(directCompiled.prompt, /Final visibility rule: Only depict these named visible characters: Lyra/iu);
      assert.match(directCompiled.prompt, /Character appearance notes:\s*Lyra's Appearance:/u);
      assert.match(directCompiled.prompt, /User image instructions: Keep the moon visible/u);
      assert.doesNotMatch(
        directCompiled.prompt,
        /(?:^|\n)(?:Scene moment|Narrative purpose|Characters|Reference handling|Location handling|Art direction):/iu,
      );

      const chatSettingsSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
        "utf8",
      );
      const storyboardSettingsSource = readFileSync(
        new URL("../../../packages/client/src/components/agents/StoryboardAgentSettingsPanel.tsx", import.meta.url),
        "utf8",
      );
      const storyboardChatSettingsSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/StoryboardChatSettingsPanel.tsx", import.meta.url),
        "utf8",
      );
      const roleplaySettingsStart = storyboardChatSettingsSource.indexOf(
        "function RoleplayStoryboardChatSettingsPanel",
      );
      assert.ok(roleplaySettingsStart >= 0, "Roleplay Storyboard settings boundary should exist");
      const gameStoryboardChatSettingsSource = storyboardChatSettingsSource.slice(0, roleplaySettingsStart);
      const gameSurfaceSource = readFileSync(
        new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
        "utf8",
      );
      const gameRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/game.routes.ts", import.meta.url),
        "utf8",
      );
      assert.doesNotMatch(chatSettingsSource, /gameStoryboard/u);
      assert.match(storyboardSettingsSource, /settings\.usePromptTemplate/u);
      assert.match(storyboardSettingsSource, /update\(\{ usePromptTemplate: checked \}\)/u);
      assert.match(storyboardSettingsSource, /settings\.includeCharacterAppearance/u);
      assert.match(storyboardSettingsSource, /update\(\{ includeCharacterAppearance: checked \}\)/u);
      assert.match(storyboardSettingsSource, /settings\.useAvatarReferences/u);
      assert.match(storyboardSettingsSource, /update\(\{ useAvatarReferences: checked \}\)/u);
      assert.doesNotMatch(gameStoryboardChatSettingsSource, /gameStoryboardIncludeCharacterAppearance/u);
      assert.doesNotMatch(gameStoryboardChatSettingsSource, /gameStoryboardUseAvatarReferences/u);
      assert.doesNotMatch(gameStoryboardChatSettingsSource, /appearanceOverridden/u);
      assert.doesNotMatch(gameStoryboardChatSettingsSource, /avatarReferencesOverridden/u);
      assert.doesNotMatch(gameSurfaceSource, /useGamePromptTemplate/u);
      assert.match(gameRouteSource, /characterAppearanceContextBlock:\s*storyboardAppearanceContextBlock/u);
      assert.equal(gameRouteSource.match(/^\s+characterAppearanceContextBlock,\s*$/gmu)?.length, 2);
      assert.equal(gameRouteSource.match(/includeCharacterDescriptions:\s*true,/gu)?.length, 1);
      assert.equal(gameRouteSource.match(/includeCharacterDescriptions:\s*includeCharacterAppearance,/gu)?.length, 4);
      assert.equal(
        gameRouteSource.match(
          /includeCharacterDescriptions:\s*includeCharacterAppearanceAtRender && characterPrompts\.length === 0,/gu,
        )?.length,
        1,
      );
      assert.match(
        gameRouteSource,
        /const includeCharacterAppearanceAtRender = includeCharacterAppearance && usedFallbackStoryboardPlanner/u,
      );
      assert.match(gameRouteSource, /Marinara used narration-based fallback keyframes and skipped video generation/u);
      assert.equal(gameRouteSource.match(/meta\.storyboardAgentIncludeCharacterAppearance !== false/gu)?.length, 1);
      assert.equal(gameRouteSource.match(/meta\.storyboardAgentUseAvatarReferences !== false/gu)?.length, 1);
      assert.equal(gameRouteSource.match(/meta\.gameImageIncludeCharacterAppearance !== false/gu)?.length, 2);
      assert.equal(gameRouteSource.match(/meta\.gameImageUseAvatarReferences !== false/gu)?.length, 2);
      assert.doesNotMatch(
        gameRouteSource,
        /const storyboardAppearanceCharacterNames\s*=\s*includeCharacterAppearance/gu,
      );
    },
  },
  {
    name: "Storyboard animation refinement sees the generated illustration after image generation",
    async run() {
      const motionIntent =
        "She lifts the sword as the camera pushes in | Her coat settles while she looks toward the doorway";
      const referenceImage = { base64: "cGl4ZWxz", mimeType: "image/png" };
      const templates = [
        {
          id: "image-aware-shot",
          name: "Image-aware shot",
          promptTemplate:
            "Inspect the attached generated illustration for ${title}. Motion intent: ${motionIntent}. First-frame plan: ${imagePrompt}. Sources: ${sourceSections}. Characters: ${characters}. Duration: ${durationSeconds}. Ratio: ${aspectRatio}. Return classification and narrationBeat as JSON.",
        },
      ];
      const messages = buildStoryboardAnimationRefinementMessages({
        templates,
        templateId: "image-aware-shot",
        title: "The doorway",
        motionIntent,
        imagePrompt: "Waist-up profile of Mira holding a lowered sword beside a doorway.",
        sourceSections: '<section index="2">Mira reaches the doorway.</section>',
        characters: ["Mira"],
        durationSeconds: 6,
        aspectRatio: "16:9",
        referenceImage,
      });
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.role, "user");
      assert.deepEqual(messages[0]?.images, ["data:image/png;base64,cGl4ZWxz"]);
      assert.match(messages[0]?.content ?? "", /Mira reaches the doorway/u);
      assert.match(messages[0]?.content ?? "", /She lifts the sword/u);

      const redactedMessages = redactStoryboardAnimationRefinementMessages(messages);
      assert.doesNotMatch(JSON.stringify(redactedMessages), /cGl4ZWxz/u);
      assert.match(JSON.stringify(redactedMessages), /"mediaType":"image\/png"/u);
      assert.deepEqual(
        resolveStoryboardAnimationRefinement(
          '```json\n{"classification":"simplify","narrationBeat":"Starting from the lowered sword, Mira raises it slightly | She holds as the camera eases closer"}\n```',
          motionIntent,
        ),
        {
          classification: "simplify",
          narrationBeat:
            "Starting from the lowered sword, Mira raises it slightly | She holds as the camera eases closer",
        },
      );
      assert.equal(
        resolveStoryboardAnimationRefinement(
          '{"classification":"subtle","narrationBeat":"Mira only turns her head."}',
          motionIntent,
        ),
        null,
      );
      assert.equal(
        resolveStoryboardAnimationRefinement('{"classification":"unknown","narrationBeat":"One | Two"}', motionIntent),
        null,
      );
      assert.equal(
        resolveStoryboardAnimationRefinement('{"classification":"subtle","narrationBeat":"One |"}', "Original |"),
        null,
      );

      const completeStructuredPrompt = [
        `Visual motion: ${"falling petals drift around Mira as her coat settles ".repeat(18)}`,
        `Camera and audio: ${"the camera eases closer while cloth rustles and distant bells ring ".repeat(16)}AUDIO_END`,
      ].join(" | ");
      const normalizedCompleteStructuredPrompt = completeStructuredPrompt.replace(/\s+/gu, " ").trim();
      assert.ok(completeStructuredPrompt.length > 1_200);
      assert.equal(compactStoryboardAnimationPrompt(completeStructuredPrompt), normalizedCompleteStructuredPrompt);
      const completeRefinement = resolveStoryboardAnimationRefinement(
        JSON.stringify({ classification: "suitable", narrationBeat: completeStructuredPrompt }),
        "visual intent | audio intent",
      );
      assert.equal(completeRefinement?.narrationBeat, normalizedCompleteStructuredPrompt);
      assert.match(completeRefinement?.narrationBeat ?? "", /AUDIO_END$/u);
      assert.doesNotMatch(completeRefinement?.narrationBeat ?? "", /\.\.\.$/u);

      let completePersistedPrompt = "";
      const completeExecution = await executeStoryboardImageAwareAnimation({
        referenceImage,
        motionIntent: "visual intent | audio intent",
        refine: async () => completeRefinement!,
        formatPrompt: async (narrationBeat) => narrationBeat,
        persistPrompt: async ({ prompt }) => {
          completePersistedPrompt = prompt;
        },
        generateVideo: async ({ prompt }) => {
          assert.equal(prompt, normalizedCompleteStructuredPrompt);
          return { id: "complete-structured-video" };
        },
      });
      assert.equal(completePersistedPrompt, normalizedCompleteStructuredPrompt);
      assert.equal(completeExecution.prompt, completePersistedPrompt);
      assert.match(completePersistedPrompt, /AUDIO_END$/u);

      const persisted: Array<{ prompt: string; classification: string }> = [];
      const videoCalls: Array<{ prompt: string; referenceImage: typeof referenceImage }> = [];
      const execution = await executeStoryboardImageAwareAnimation({
        referenceImage,
        motionIntent,
        refine: async (actualImage) => {
          assert.strictEqual(actualImage, referenceImage);
          const response =
            '{"classification":"simplify","narrationBeat":"Mira raises the lowered sword carefully | She holds while the camera eases closer"}';
          const refinement = resolveStoryboardAnimationRefinement(response, motionIntent);
          assert.ok(refinement);
          return refinement;
        },
        formatPrompt: async (narrationBeat) => `FINAL VIDEO PROMPT: ${narrationBeat}`,
        persistPrompt: async (value) => {
          persisted.push(value);
        },
        generateVideo: async (value) => {
          videoCalls.push(value);
          return { id: "generated-video" };
        },
      });
      assert.equal(execution.classification, "simplify");
      assert.deepEqual(persisted, [
        {
          classification: "simplify",
          prompt:
            "FINAL VIDEO PROMPT: Mira raises the lowered sword carefully | She holds while the camera eases closer",
        },
      ]);
      assert.equal(videoCalls.length, 1);
      assert.equal(videoCalls[0]?.prompt, persisted[0]?.prompt);
      assert.strictEqual(videoCalls[0]?.referenceImage, referenceImage);

      const fallbackVideoCalls: string[] = [];
      await executeStoryboardImageAwareAnimation({
        referenceImage,
        motionIntent,
        refine: async () => {
          throw new Error("vision unavailable");
        },
        formatPrompt: async (narrationBeat) => `FALLBACK VIDEO PROMPT: ${narrationBeat}`,
        persistPrompt: async ({ classification }) => assert.equal(classification, ""),
        generateVideo: async ({ prompt }) => {
          fallbackVideoCalls.push(prompt);
          return { id: "fallback-video" };
        },
      });
      assert.deepEqual(fallbackVideoCalls, [`FALLBACK VIDEO PROMPT: ${motionIntent}`]);

      let disabledPlannerCalls = 0;
      await executeStoryboardImageAwareAnimation({
        referenceImage,
        motionIntent,
        refinementEnabled: false,
        refine: async () => {
          disabledPlannerCalls += 1;
          throw new Error("disabled planner should not run");
        },
        formatPrompt: async (narrationBeat) => narrationBeat,
        persistPrompt: async ({ classification }) => assert.equal(classification, ""),
        generateVideo: async ({ prompt }) => {
          assert.equal(prompt, motionIntent);
          return { id: "disabled-refinement-video" };
        },
      });
      assert.equal(disabledPlannerCalls, 0);
    },
  },
];

await runNamedCases(cases);
