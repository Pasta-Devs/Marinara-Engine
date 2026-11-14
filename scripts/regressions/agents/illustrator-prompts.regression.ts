import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNarratorInstructionMessage,
  compileImagePrompt,
  createDefaultImageStyleProfileSettings,
  getDefaultBuiltInAgentSettings,
  resolveAgentPromptTemplate,
  resolveDefaultAgentPromptTemplateId,
  DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
  getDefaultAgentPrompt,
  getAgentContextSources,
} from "../../../packages/shared/src/index.js";
import { resolveConversationSelfieRequestedNames } from "../../../packages/server/src/services/generation/conversation-selfie-command-runtime.js";
import {
  applyCustomAgentImageChatSettings,
  forceImageGenerationScopeError,
  needsForcedSnapshotFallback,
  resolveCustomAgentStyleProfileId,
} from "../../../packages/server/src/services/generation/custom-agent-image-settings.js";
import {
  buildAgentCurrentLocationBlock,
  buildAgentReferenceContextBlock,
  buildIllustratorImageStyleInstructionBlock,
  executeAgent,
} from "../../../packages/server/src/services/agents/agent-executor.js";
import { agentCurrentLocationFromProjection } from "../../../packages/server/src/services/spatial-context/projection.js";
import { formatSentSelfieNotes } from "../../../packages/server/src/routes/generate/conversation-prompt-formatting.js";
import {
  buildBackgroundProviderPrompt,
  safeGeneratedAssetSlug,
} from "../../../packages/server/src/services/game/game-asset-generation.js";
import {
  buildIllustratorBackgroundPlanUserPrompt,
  buildIllustratorBackgroundPlanSystemPrompt,
  illustratorBackgroundGenerationEnabled,
  illustratorRequestedBackground,
  illustratorTrackerLocationChanged,
  parseIllustratorBackgroundPlan,
  resolveIllustratorStyleProfile,
} from "../../../packages/server/src/services/generation/illustrator-background-generation.js";
import {
  buildManualIllustratorPromptMessages,
  parseManualIllustratorPromptPlan,
  writeManualIllustratorPromptPlan,
} from "../../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js";
import { buildLegacyDefaultAgentConfigUpdate } from "../../../packages/server/src/services/agents/default-prompt-migration.js";
import {
  illustratorPromptRequestsRenderedText,
  illustratorPromptTemplateOwnsComposition,
  mergeIllustratorNegativePrompt,
  resolveIllustratorCharacterReferences,
} from "../../../packages/server/src/routes/generate/illustrator-references.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentContext,
  makeRegressionAgentConfig,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "Illustrator combines every image style with the selected prompt format without replacing its composition",
    run() {
      const comicPrompt = [
        "A three-panel colored comic page in left-to-right reading order.",
        'Speech bubble (Mira): "Run!"',
        "Panel 1 establishes the rain-soaked gate; panel 2 follows the leap; panel 3 holds on the landing.",
      ].join(" ");
      const styleProfiles = createDefaultImageStyleProfileSettings();

      for (const profile of styleProfiles.profiles) {
        const styleBlock = buildIllustratorImageStyleInstructionBlock(profile.styleText);
        if (profile.styleText.trim()) {
          assert.match(
            styleBlock,
            /selected Illustrator prompt template and this visual style instruction are cumulative/iu,
          );
          assert.match(styleBlock, /style instruction controls only the visual treatment/iu);
          assert.match(
            styleBlock,
            /Never replace Comic Page or manga panels and lettering with a single illustration/iu,
          );
        } else {
          assert.equal(styleBlock, "");
        }

        const compiled = compileImagePrompt({
          kind: "illustration",
          prompt: comicPrompt,
          styleProfiles,
          styleProfileId: profile.id,
          omitProfileStyleText: true,
          omitProfileSubjectTags: true,
        });
        assert.match(compiled.prompt, /three-panel colored comic page/iu);
        assert.match(compiled.prompt, /Speech bubble \(Mira\)/u);
        const genericIllustrationComposition = profile.subjectTags.illustration?.trim().toLowerCase() ?? "";
        if (genericIllustrationComposition) {
          assert.equal(
            compiled.prompt.toLowerCase().includes(genericIllustrationComposition),
            false,
            `${profile.name} must not append generic illustration composition over Comic Page`,
          );
        }

        const mergedNegative = mergeIllustratorNegativePrompt(compiled.prompt, compiled.negativePrompt);
        assert.equal(
          mergedNegative
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .includes("text"),
          false,
          `${profile.name} must not negate requested comic lettering`,
        );
      }
    },
  },
  {
    name: "Roleplay Illustrator keeps requested comic lettering out of the built-in negative prompt",
    run() {
      const generateRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const retryRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
        "utf8",
      );
      for (const source of [generateRouteSource, retryRouteSource]) {
        assert.match(
          source,
          /mergeIllustratorNegativePrompt\(\s*compiledPrompt\.prompt,\s*compiledPrompt\.negativePrompt/,
        );
        assert.match(source, /omitProfileSubjectTags:\s*illustratorPromptTemplateOwnsComposition\(/);
        assert.doesNotMatch(source, /ILLUSTRATOR_TEXT_NEGATIVE_PROMPT/);
      }

      const comicPrompt = [
        "colored comic page, five panels, cinematic nighttime thriller flow",
        "Caption: 'The drone tows them deeper into the reeds.'",
        "Speech bubble (Maukie, whisper): 'Stay with me.'",
        "SFX: 'SNAP'",
        "Expressive lettering and clean readable speech bubbles.",
      ].join(" ");
      assert.equal(illustratorPromptRequestsRenderedText(comicPrompt), true);
      const comicNegative = mergeIllustratorNegativePrompt(comicPrompt, "unreadable text, broken lettering");
      assert.equal(comicNegative, "unreadable text, broken lettering, watermark, logo, signature");
      assert.doesNotMatch(comicNegative, /dialogue boxes|word balloons|captions|SFX lettering|subtitles/iu);
      assert.equal(
        mergeIllustratorNegativePrompt(comicPrompt, "text, low quality, unreadable text, watermark", "unreadable text"),
        "low quality, unreadable text, watermark, logo, signature",
      );

      const ordinaryPrompt = "cinematic lakeside portrait, cold moonlight, reeds, detailed faces";
      assert.equal(illustratorPromptRequestsRenderedText(ordinaryPrompt), false);
      assert.match(mergeIllustratorNegativePrompt(ordinaryPrompt), /speech bubbles/iu);
      assert.match(mergeIllustratorNegativePrompt(ordinaryPrompt), /SFX lettering/iu);
      assert.equal(
        mergeIllustratorNegativePrompt(ordinaryPrompt, "low quality, text, low quality", "text", {
          imageService: "novelai",
        }),
        "low quality, text",
        "NovelAI should receive only the compiled explicit negative prompt without Illustrator's built-in anti-text list",
      );
      for (const source of [generateRouteSource, retryRouteSource]) {
        assert.match(
          source,
          /mergeIllustratorNegativePrompt\([\s\S]*?requestedNegativePrompt,\s*imgConnFull,\s*\)/u,
          "every Illustrator route should identify NovelAI when merging the negative prompt",
        );
        assert.match(source, /imageDefaults:\s*imageFallback\.imageDefaults/u);
        assert.match(source, /fallback:\s*providerAwareImageFallback/u);
        assert.match(
          source,
          /mergeIllustratorNegativePrompt\([\s\S]{0,500}?requestedNegativePrompt,\s*imageFallback,\s*\)/u,
          "every Illustrator route should compile a provider-aware prompt for its fallback connection",
        );
      }

      assert.equal(
        illustratorPromptRequestsRenderedText("Avoid captions, speech bubbles, subtitles, logos, and watermarks."),
        false,
      );
      assert.equal(illustratorPromptRequestsRenderedText('shopfront sign reading "OPEN ALL NIGHT"'), true);
    },
  },
  {
    name: "Illustrator injects configured Illustration tags while dedicated comic templates retain composition",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const profile = styleProfiles.profiles.find((candidate) => candidate.id === "danbooru");
      assert.ok(profile);
      const illustrationTemplate =
        "Generate a polished single-scene illustration with composition, lighting, mood, and environment.";
      const comicTemplate =
        "Build the prompt as a complete comic page with panel composition, speech bubbles, captions, and SFX lettering.";

      assert.equal(illustratorPromptTemplateOwnsComposition(illustrationTemplate), false);
      assert.equal(illustratorPromptTemplateOwnsComposition(comicTemplate), true);

      const compiled = compileImagePrompt({
        kind: "illustration",
        prompt: "Mira vaults over a rain-soaked gate under cold moonlight.",
        styleProfiles,
        styleProfileId: profile.id,
        omitProfileStyleText: true,
        omitProfileSubjectTags: illustratorPromptTemplateOwnsComposition(illustrationTemplate),
      });
      const subjectTags = profile.subjectTags.illustration ?? "";
      assert.match(compiled.prompt, /^masterpiece, best quality, absurdres, anime screencap, detailed eyes,/u);
      assert.match(compiled.prompt, /visual novel CG, cinematic composition, dramatic lighting/u);
      assert.ok(compiled.prompt.indexOf(profile.positiveTags) < compiled.prompt.indexOf(subjectTags));
      assert.ok(compiled.prompt.indexOf(subjectTags) < compiled.prompt.indexOf("Mira vaults"));
    },
  },
  {
    name: "Illustrator resolves depicted character and persona gallery targets without loading references",
    async run() {
      const resolution = await resolveIllustratorCharacterReferences({
        charactersStore: {
          list: async () => [
            {
              id: "character-maukie",
              data: { name: "Maukie", extensions: { appearance: "Wet brown hair." } },
              avatarPath: null,
            },
            {
              id: "character-dottore",
              data: { name: "Dottore", extensions: { appearance: "A masked scientist." } },
              avatarPath: null,
            },
          ],
        },
        chatCharacters: [
          { id: "character-maukie", name: "Maukie", avatarPath: null, appearance: "Wet brown hair." },
          { id: "character-dottore", name: "Dottore", avatarPath: null, appearance: "A masked scientist." },
        ],
        persona: { id: "persona-mari", name: "Mari", avatarPath: null, appearance: "Chubby woman." },
        requestedNames: ["Maukie", "Dottore", "Mari"],
        promptText: "Maukie and Dottore carry Mari through the reeds.",
        includeReferenceImages: false,
        maxReferences: 1,
      });
      assert.deepEqual(resolution.characterIds, ["character-maukie", "character-dottore"]);
      assert.equal(resolution.personaId, "persona-mari");
      assert.deepEqual(resolution.referenceImages, []);

      const groupSelfieResolution = await resolveIllustratorCharacterReferences({
        charactersStore: {
          list: async () => [],
        },
        chatCharacters: [
          { id: "character-maukie", name: "Maukie", avatarPath: null, appearance: "Wet brown hair." },
          { id: "character-dottore", name: "Dottore", avatarPath: null, appearance: "A masked scientist." },
        ],
        persona: { id: "persona-mari", name: "Mari", avatarPath: null, appearance: "Chubby woman." },
        requestedNames: [],
        promptText: "A group selfie of Maukie and Dottore, seen from Mari's point of view.",
        includeReferenceImages: false,
        includePersonaWhenMentionedInPrompt: false,
      });
      assert.deepEqual(groupSelfieResolution.characterIds, ["character-maukie", "character-dottore"]);
      assert.equal(groupSelfieResolution.personaId, null);
      assert.deepEqual(
        resolveConversationSelfieRequestedNames({
          speakerName: "Maukie",
          chatCharacters: [{ name: "Maukie" }, { name: "Dottore" }],
          generationGuide: buildNarratorInstructionMessage("group selfie"),
          imagePrompt: "Two friends crowd into the frame.",
        }),
        ["Maukie", "Dottore"],
      );
      assert.deepEqual(
        resolveConversationSelfieRequestedNames({
          speakerName: "Maukie",
          chatCharacters: [{ name: "Maukie" }, { name: "Dottore" }],
          imagePrompt: "Maukie takes a casual selfie at home.",
        }),
        ["Maukie"],
      );
      // A group video's selfie first frame shows the group too.
      assert.deepEqual(
        resolveConversationSelfieRequestedNames({
          speakerName: "Maukie",
          chatCharacters: [{ name: "Maukie" }, { name: "Dottore" }],
          commandContext: "User: Send me a group video of you two!",
        }),
        ["Maukie", "Dottore"],
      );
    },
  },
  {
    name: "A character's sent selfie reaches later prompt history, Illustrator images do not",
    run() {
      assert.equal(
        formatSentSelfieNotes([
          {
            type: "image",
            filename: "selfie_maukie_1.png",
            prompt: "Maukie grins at the camera,\n  holding a coffee\n\nAppearance notes: auburn hair",
          },
          { type: "image", filename: "illustration_1.png", prompt: "A dark forest." },
          { type: "image/png", filename: "selfie_upload.png", prompt: null },
        ]),
        "\n[Sent a selfie: Maukie grins at the camera, holding a coffee]",
      );
      assert.equal(formatSentSelfieNotes([{ type: "image", filename: "selfie_maukie_2.png" }]), "\n[Sent a selfie]");
      // Merged group replies hold several speakers, so the note names who sent each selfie.
      assert.equal(
        formatSentSelfieNotes([
          { type: "image", filename: "selfie_maukie_1.png", prompt: "A mirror selfie.", characterName: "Maukie" },
          { type: "image", filename: "selfie_dottore_1.png", prompt: "A lab selfie.", characterName: "Dottore" },
        ]),
        "\n[Maukie sent a selfie: A mirror selfie.]\n[Dottore sent a selfie: A lab selfie.]",
      );
      assert.equal(formatSentSelfieNotes(undefined), "");
      assert.equal(
        formatSentSelfieNotes([
          {
            type: "image",
            filename: "selfie_maukie_3.png",
            prompt: "Prompt text.",
            imageCaption: "Maukie  in a\nred scarf.",
            characterName: "Maukie",
          },
        ]),
        "\n[Maukie sent a selfie: Maukie in a red scarf.]",
      );
    },
  },
  {
    name: "Illustrator defaults to Illustration and preserves explicit Background selections",
    run() {
      const executorSource = readFileSync(
        new URL("../../../packages/server/src/services/agents/agent-executor.ts", import.meta.url),
        "utf8",
      );
      const settings = getDefaultBuiltInAgentSettings("illustrator");
      const illustrationPrompt = resolveAgentPromptTemplate({
        promptTemplate: "BASE ILLUSTRATION PROMPT",
        settings,
      });
      const explicitBackgroundPrompt = resolveAgentPromptTemplate({
        promptTemplate: "BASE ILLUSTRATION PROMPT",
        settings,
        selectedPromptTemplateId: "background",
      });

      assert.equal(resolveDefaultAgentPromptTemplateId(settings), DEFAULT_AGENT_PROMPT_TEMPLATE_ID);
      assert.equal(illustrationPrompt, "BASE ILLUSTRATION PROMPT");
      assert.match(explicitBackgroundPrompt, /background-only prompt/);

      const migrationUpdate = buildLegacyDefaultAgentConfigUpdate({
        id: "builtin:illustrator",
        type: "illustrator",
        name: "Illustrator",
        description: "Responsible for image and video generations.",
        phase: "post_processing",
        enabled: "false",
        connectionId: null,
        imagePath: null,
        promptTemplate: getDefaultAgentPrompt("illustrator"),
        settings: JSON.stringify({ defaultPromptTemplateId: "background" }),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      const migratedSettings = JSON.parse(String(migrationUpdate.settings)) as Record<string, unknown>;
      assert.equal(migratedSettings.defaultPromptTemplateId, DEFAULT_AGENT_PROMPT_TEMPLATE_ID);
      assert.equal(migratedSettings.illustratorDefaultPromptTemplateMigrationVersion, 2);
      assert.match(executorSource, /Follow the selected Illustrator prompt mode exactly/);
      assert.match(executorSource, /Background stays an environment-only plate/);
      assert.doesNotMatch(executorSource, /not a selfie, comic page, manga panel, or background-only plate/);
    },
  },
  {
    name: "Manual Illustrator preserves custom prompts with schema-first and inline instructions",
    async run() {
      for (const promptTemplate of [
        "Respond with a valid JSON object.\nDraw a three-panel comic from {{user}} POV.",
        "Decide whether to generate an image. Draw a three-panel comic from {{user}} POV.",
        '<output_format>{"prompt":"Draw a three-panel comic from {{user}} POV."}</output_format>',
        `${"Scene guidance. ".repeat(900)}Draw a three-panel comic from {{user}} POV.`,
      ]) {
        const capture = makeCapturingProvider('{"prompt":"A three-panel comic from Mari POV."}');
        const selectedPrompt = resolveAgentPromptTemplate({
          promptTemplate: "Draw an ordinary scene using the global default.",
          settings: { promptTemplates: [{ id: "user-pov", name: "User POV", promptTemplate }] },
          selectedPromptTemplateId: "user-pov",
        });
        await writeManualIllustratorPromptPlan({
          illustratorAgent: {
            ...makeRegressionAgentConfig({ type: "illustrator", promptTemplate: selectedPrompt }),
            provider: capture.provider,
            model: "regression-model",
          } as any,
          context: { ...makeRegressionAgentContext(), persona: { name: "Mari" } },
        });
        const system = capture.calls[0]![0]!.content;
        assert.match(system, /Draw a three-panel comic from Mari POV\./u);
        assert.doesNotMatch(system, /ordinary scene using the global default/u);
        assert.doesNotMatch(system, /No selected Illustrator prompt mode supplied/u);
        assert.match(system, /<\/selected_illustrator_prompt_mode>/u);
        assert.ok(
          system.indexOf("For this manual request, ignore") > system.indexOf("</selected_illustrator_prompt_mode>"),
        );
      }
    },
  },
  {
    name: "Manual Illustrator honors configured output tokens and connection/model caps before context fitting",
    async run() {
      for (const { maxTokens, connectionCap, modelCap, maxContext = 65_536, expected } of [
        { maxTokens: 32_800, connectionCap: 32_800, modelCap: 131_072, expected: 32_800 },
        { maxTokens: "32800", connectionCap: null, modelCap: undefined, expected: 32_800 },
        { maxTokens: 32_800, connectionCap: 1024, modelCap: undefined, maxContext: 4096, expected: 1024 },
        { maxTokens: 32_800, connectionCap: 16_384, modelCap: 8192, expected: 8192 },
        { maxTokens: undefined, connectionCap: null, modelCap: undefined, expected: 1800 },
        { maxTokens: undefined, connectionCap: 1024, modelCap: undefined, expected: 1024 },
      ]) {
        const capture = makeCapturingProvider('{"prompt":"A detailed comic page."}');
        await writeManualIllustratorPromptPlan({
          illustratorAgent: {
            ...makeRegressionAgentConfig({ type: "illustrator", settings: { maxTokens } }),
            provider: { ...capture.provider, maxTokensOverrideValue: connectionCap, maxContextValue: maxContext },
            model: "regression-model",
            maxOutputTokens: modelCap,
          } as any,
          context: makeRegressionAgentContext(),
        });
        assert.equal(capture.callOptions[0]?.maxTokens, expected);
      }
    },
  },
  {
    name: "Manual Illustrator rejects oversized initial and retry requests without truncating prompts",
    async run() {
      for (const retry of [false, true]) {
        const capture = makeCapturingProvider("!? ".repeat(2300));
        await assert.rejects(
          writeManualIllustratorPromptPlan({
            illustratorAgent: {
              ...makeRegressionAgentConfig({
                type: "illustrator",
                promptTemplate: retry ? "Draw a comic page." : "!? ".repeat(8000),
                settings: { maxTokens: 256 },
              }),
              provider: { ...capture.provider, maxContextValue: 2048 },
              model: "regression-model",
            } as any,
            context: makeRegressionAgentContext(),
          }),
          /Manual Illustrator request exceeds the connection context limit/u,
        );
        assert.equal(capture.calls.length, retry ? 1 : 0);
      }
    },
  },
  {
    name: "Roleplay Illustrator background decisions are gated and produce reusable library metadata",
    async run() {
      assert.equal(
        illustratorBackgroundGenerationEnabled("roleplay", { illustratorAutoBackgroundsEnabled: true }),
        true,
      );
      assert.equal(illustratorBackgroundGenerationEnabled("game", { illustratorAutoBackgroundsEnabled: true }), false);
      assert.equal(illustratorBackgroundGenerationEnabled("roleplay", {}), false);
      assert.equal(illustratorRequestedBackground(true), true);
      assert.equal(illustratorRequestedBackground("yes"), true);
      assert.equal(illustratorRequestedBackground("no"), false);
      assert.equal(illustratorTrackerLocationChanged("Royal Archive", "Enchanted Forest Clearing"), true);
      assert.equal(illustratorTrackerLocationChanged("  ROYAL   ARCHIVE ", "royal archive"), false);
      assert.equal(illustratorTrackerLocationChanged("Royal Archive", ""), false);

      const plan = parseIllustratorBackgroundPlan(
        '```json\n{"locationName":"Enchanted Forest Clearing","prompt":"Wide moonlit forest clearing with ancient trees and a readable path layout.","tags":["Forest","moonlit!","forest"],"reason":"The party entered the clearing."}\n```',
      );
      assert.deepEqual(plan, {
        locationName: "Enchanted Forest Clearing",
        prompt: "Wide moonlit forest clearing with ancient trees and a readable path layout.",
        tags: ["forest", "moonlit"],
        reason: "The party entered the clearing.",
      });
      assert.equal(safeGeneratedAssetSlug(plan!.locationName), "enchanted-forest-clearing");

      const prompt = buildIllustratorBackgroundPlanUserPrompt({
        chatName: "Moonlit Expedition",
        currentBackground: "old-library.png",
        assistantResponse: "They cross the threshold into an enchanted forest clearing.",
        decisionReason: "The scene moved outdoors.",
        gameState: { location: "Enchanted Forest Clearing", weather: "clear", time: "midnight" } as any,
        recentMessages: [
          {
            role: "assistant",
            content: "The group leaves the archive.",
            gameState: { location: "Royal Archive" } as any,
          },
          {
            role: "assistant",
            content: "They follow the moonlit road.",
            gameState: { location: "Moonlit Road" } as any,
          },
          {
            role: "assistant",
            content: "They briefly return through the archive gate.",
            gameState: { location: "Royal Archive" } as any,
          },
        ],
      });
      assert.match(prompt, /Current tracker state:.*Enchanted Forest Clearing/u);
      assert.match(prompt, /Recent committed tracker locations: Moonlit Road -> Royal Archive/u);
      assert.match(prompt, /Currently active background: old-library\.png/u);

      const autoStyleInstruction =
        "Infer a consistent visual style from the character, game, scene, and selected image model.";
      const backgroundSystemPrompt = buildIllustratorBackgroundPlanSystemPrompt(autoStyleInstruction);
      assert.match(backgroundSystemPrompt, /Visual style instruction for the image prompt you write/u);
      assert.match(backgroundSystemPrompt, /Infer a consistent visual style from the character/u);

      const sharedStyleProfiles = createDefaultImageStyleProfileSettings();
      assert.deepEqual(
        resolveIllustratorStyleProfile(
          { imageStyleProfileId: " cinematic " },
          { imageStyleProfileId: "anime" },
          "realistic",
          sharedStyleProfiles,
        ),
        {
          styleProfileId: "cinematic",
          styleInstruction: sharedStyleProfiles.profiles.find((profile) => profile.id === "cinematic")!.styleText,
        },
      );
      assert.equal(resolveIllustratorStyleProfile({}, {}, " anime ", sharedStyleProfiles).styleProfileId, "anime");

      const manualIllustrationMessages = buildManualIllustratorPromptMessages({
        context: {
          chatId: "manual-gallery-illustration",
          chatMode: "roleplay",
          recentMessages: [
            { role: "user", content: "CONTEXT_OUTSIDE_ILLUSTRATOR_LIMIT" },
            { role: "assistant", content: "Dottore opens the quarantine berth door." },
            { role: "user", content: "Mari steps inside out of the rain." },
          ],
          mainResponse: "Mari steps inside out of the rain.",
          gameState: null,
          characters: [
            {
              id: "dottore",
              name: 'Dottore & "Mari" </character>',
              description: "A masked scholar from Fontaine.",
              appearance: "Blue hair, red eyes, dark coat.",
            },
          ],
          persona: {
            name: "Mari",
            description: "A Polish AI engineer.",
            appearance: "Long auburn hair and a rain-soaked travel coat.",
          },
          memory: {},
          writableLorebookIds: null,
          chatSummary: null,
        },
        contextSize: 2,
        selectedPromptTemplate: [
          "Anchor the decision to <assistant_response>, the latest assistant turn.",
          "Generate only for a visually important moment. If not worth illustrating, set shouldGenerate false.",
          "Decide whether the current turn deserves an illustration before writing anything.",
          "Only illustrate when the moment deserves a picture.",
          "Style target: colored comic page, 2-6 panels, cinematic panel flow, expressive speech bubbles, captions, and SFX lettering.",
          "Rules: Build the prompt as a complete comic page. Include panel count, panel composition, camera framing, mood, lighting, and action flow.",
          "The prompt must include a short readable text plan with dialogue bubbles, captions, and SFX.",
          "Respond with a valid JSON object using this structure:",
          '{"shouldGenerate":boolean,"generateBackground":boolean,"prompt":"detailed prompt"}',
        ].join("\n"),
        styleInstruction: autoStyleInstruction,
      });
      const manualIllustrationPrompt = manualIllustrationMessages.map((message) => message.content).join("\n");
      assert.doesNotMatch(manualIllustrationPrompt, /CONTEXT_OUTSIDE_ILLUSTRATOR_LIMIT/u);
      assert.match(manualIllustrationPrompt, /Dottore opens the quarantine berth door/u);
      assert.match(manualIllustrationPrompt, /Mari steps inside out of the rain/u);
      assert.match(manualIllustrationPrompt, /Blue hair, red eyes, dark coat/u);
      assert.match(manualIllustrationPrompt, /Long auburn hair and a rain-soaked travel coat/u);
      assert.match(manualIllustrationPrompt, /<character name="Dottore &amp; &quot;Mari&quot; &lt;\/character&gt;">/u);
      assert.doesNotMatch(manualIllustrationPrompt, /name="Dottore & "Mari" <\/character>"/u);
      assert.match(manualIllustrationPrompt, /Infer a consistent visual style from the character/u);
      assert.match(manualIllustrationPrompt, /Style target: colored comic page, 2-6 panels/u);
      assert.match(manualIllustrationPrompt, /Build the prompt as a complete comic page/u);
      assert.match(manualIllustrationPrompt, /Combine it with the selected Illustrator prompt mode/u);
      assert.match(manualIllustrationPrompt, /Generate only for a visually important moment/u);
      assert.match(manualIllustrationPrompt, /Decide whether the current turn deserves an illustration/u);
      assert.match(manualIllustrationPrompt, /Only illustrate when the moment deserves a picture/u);
      assert.match(manualIllustrationPrompt, /Respond with a valid JSON object/u);
      assert.match(manualIllustrationPrompt, /The Illustration button has already selected the output type/u);
      const manualContract = manualIllustrationPrompt.split("</selected_illustrator_prompt_mode>")[1]!;
      assert.match(manualContract, /ignore automatic-generation conditions, cadence, and response schemas/u);
      assert.doesNotMatch(manualContract, /"shouldGenerate"\s*:/u);
      assert.doesNotMatch(manualContract, /"generateBackground"\s*:/u);

      // #8246: [illustrate:] commands and the Gallery button follow the Illustrator's Context Sources
      // for lorebook entries, summary and author notes, like an automatic Illustrator run.
      const referenceContext = {
        ...makeRegressionAgentContext(),
        activatedLorebookEntries: [
          { id: "lore-harbor", name: "Silver Harbor", content: "LORE_SILVER_HARBOR_LANTERNS" },
        ],
        chatSummary: "SUMMARY_SHIPWRECK_ARC",
        authorNotes: "NOTES_KEEP_IT_RAINY",
      };
      const runReferenceWriter = async (settings: Record<string, unknown>) => {
        const capture = makeCapturingProvider(
          JSON.stringify({ prompt: "Lantern-lit harbor at night.", characters: [], reason: "Scene." }),
        );
        await writeManualIllustratorPromptPlan({
          illustratorAgent: {
            ...makeRegressionAgentConfig({
              id: "builtin:illustrator",
              type: "illustrator",
              name: "Illustrator",
              promptTemplate: "Illustrate the scene.",
              settings: { contextSize: 2, maxTokens: 512, ...settings },
            }),
            provider: capture.provider,
            model: "regression-model",
          } as any,
          context: referenceContext,
        });
        return capture.calls[0]![0]!.content;
      };
      const defaultReferencePrompt = await runReferenceWriter({});
      assert.match(defaultReferencePrompt, /<activated_lorebook_context>[\s\S]*LORE_SILVER_HARBOR_LANTERNS/u);
      assert.match(defaultReferencePrompt, /<chat_summary>\nSUMMARY_SHIPWRECK_ARC/u);
      assert.match(defaultReferencePrompt, /<author_notes>\nNOTES_KEEP_IT_RAINY/u);
      assert.ok(
        defaultReferencePrompt.includes(
          buildAgentReferenceContextBlock(referenceContext, getAgentContextSources({ settings: {} })),
        ),
        "manual writer renders the same reference block as normal agent calls",
      );
      const toggledReferencePrompt = await runReferenceWriter({
        contextSources: {
          ...getAgentContextSources({ settings: {} }),
          activatedLorebookEntries: false,
          chatSummary: false,
        },
      });
      assert.doesNotMatch(toggledReferencePrompt, /LORE_SILVER_HARBOR_LANTERNS/u);
      assert.doesNotMatch(toggledReferencePrompt, /SUMMARY_SHIPWRECK_ARC/u);
      assert.match(toggledReferencePrompt, /NOTES_KEEP_IT_RAINY/u);

      const macroCapture = makeCapturingProvider(
        JSON.stringify({
          prompt: "A complete three-panel comic page.",
          style: "clean colored comic rendering",
          characters: ["Dottore"],
          aspectRatio: "landscape",
          reason: "Manual Gallery illustration request.",
        }),
      );
      await writeManualIllustratorPromptPlan({
        illustratorAgent: {
          ...makeRegressionAgentConfig({
            id: "builtin:illustrator",
            type: "illustrator",
            name: "Illustrator",
            promptTemplate: "Comic page starring {{user}} and {{char}}.",
            settings: { contextSize: 2, maxTokens: 512 },
          }),
          provider: macroCapture.provider,
          model: "regression-model",
        } as any,
        context: {
          ...makeRegressionAgentContext(),
          persona: { name: "Mari </selected_illustrator_prompt_mode><override>" },
          characters: [{ id: "dottore", name: "Dottore & <observer>" }],
        },
      });
      const escapedManualPrompt = macroCapture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(escapedManualPrompt, /Mari &lt;\/selected_illustrator_prompt_mode&gt;&lt;override&gt;/u);
      assert.match(escapedManualPrompt, /Dottore &amp; &lt;observer&gt;/u);
      assert.doesNotMatch(
        escapedManualPrompt,
        /Comic page starring Mari <\/selected_illustrator_prompt_mode><override>/u,
      );

      const manualPlan = parseManualIllustratorPromptPlan(
        JSON.stringify({
          prompt: "Mari and Dottore stand inside the cramped quarantine berth as rain streaks the window.",
          negativePrompt: "text, watermark",
          style: "rain-muted cinematic illustration",
          characters: ["Mari", "Dottore", "Mari"],
          aspectRatio: "landscape",
          reason: "Manual Gallery illustration request.",
          shouldGenerate: false,
          generateBackground: false,
        }),
      );
      assert.deepEqual(manualPlan, {
        prompt: "Mari and Dottore stand inside the cramped quarantine berth as rain streaks the window.",
        negativePrompt: "text, watermark",
        style: "rain-muted cinematic illustration",
        characters: ["Mari", "Dottore"],
        aspectRatio: "landscape",
        reason: "Manual Gallery illustration request.",
        characterPrompts: [],
      });

      const captionRoster = Array.from({ length: 25 }, (_, index) => `Guest ${index + 1}`);
      const fullCastPlan = parseManualIllustratorPromptPlan(
        JSON.stringify({ prompt: "A crowded banquet", characters: captionRoster }),
      );
      assert.deepEqual(
        fullCastPlan.characters,
        captionRoster.slice(0, 22),
        "manual Illustrator keeps the complete V5 caption roster",
      );

      const quarantinePrompt =
        "A cramped quarantine berth inside the Fontaine border checkpoint at night. A narrow iron-framed cot stands against a damp stone wall beside a battered table holding folded linen, simple medical supplies, an enamel basin, and a sprig of dried lavender. Heavy checkpoint doors and exposed brass pipes occupy the opposite wall. A high reinforced window reveals cold downpour streaming across the glass. A compact radiator and low amber utility lamp contrast with the blue-gray storm light. Chipped plaster, rust stains, patched bedding, old cargo crates, and hastily cleaned floorboards suggest an austere freight facility adapted for recovery.";
      const styleProfilesForHandoff = createDefaultImageStyleProfileSettings();
      const compiledAutoBackground = await buildBackgroundProviderPrompt({
        chatId: "manual-gallery-background",
        locationSlug: "fontaine-quarantine-berth",
        sceneDescription: quarantinePrompt,
        imgModel: "gpt-image-2",
        imgBaseUrl: "https://example.invalid",
        imgApiKey: "",
        styleProfiles: styleProfilesForHandoff,
        styleProfileId: "auto",
        preserveFullScenePrompt: true,
        providerReadyPrompt: true,
        omitProfileStyleText: true,
      });
      assert.equal(compiledAutoBackground.prompt, quarantinePrompt);
      assert.match(compiledAutoBackground.prompt, /narrow iron-framed cot/u);
      assert.match(compiledAutoBackground.prompt, /sprig of dried lavender/u);
      assert.match(compiledAutoBackground.prompt, /exposed brass pipes/u);
      assert.match(compiledAutoBackground.prompt, /hastily cleaned floorboards/u);
      assert.doesNotMatch(compiledAutoBackground.prompt, /Infer a consistent visual style from/u);

      const reviewedBackground = await buildBackgroundProviderPrompt({
        chatId: "manual-gallery-background-reviewed",
        locationSlug: "fontaine-quarantine-berth",
        sceneDescription: quarantinePrompt,
        imgModel: "gpt-image-2",
        imgBaseUrl: "https://example.invalid",
        imgApiKey: "",
        promptOverride: "Reviewer-approved background prompt",
        negativePromptOverride: "Reviewer-approved negative prompt",
      });
      assert.deepEqual(reviewedBackground, {
        prompt: "Reviewer-approved background prompt",
        negativePrompt: "Reviewer-approved negative prompt",
      });

      const cinematicProfile = styleProfilesForHandoff.profiles.find((profile) => profile.id === "cinematic")!;
      styleProfilesForHandoff.profiles.push({
        ...cinematicProfile,
        id: "custom-quarantine-style",
        name: "Custom Quarantine Style",
        styleText: "Muted gouache with restrained ink contours and oxidized brass accents.",
        positiveTags: "muted gouache, restrained ink contours",
        builtIn: false,
      });
      for (const profile of styleProfilesForHandoff.profiles) {
        const styleSystemPrompt = buildIllustratorBackgroundPlanSystemPrompt(profile.styleText);
        const styleIllustrationPrompt = buildManualIllustratorPromptMessages({
          context: {
            chatId: `manual-gallery-${profile.id}`,
            chatMode: "roleplay",
            recentMessages: [{ role: "assistant", content: quarantinePrompt }],
            mainResponse: quarantinePrompt,
            gameState: null,
            characters: [],
            persona: null,
            memory: {},
            writableLorebookIds: null,
            chatSummary: null,
          },
          contextSize: 1,
          styleInstruction: profile.styleText,
        })
          .map((message) => message.content)
          .join("\n");
        if (profile.styleText) {
          assert.ok(
            styleSystemPrompt.includes(profile.styleText),
            `${profile.id} background style guidance was omitted`,
          );
          assert.ok(
            styleIllustrationPrompt.includes(profile.styleText),
            `${profile.id} illustration style guidance was omitted`,
          );
        }

        const compiledStyledBackground = await buildBackgroundProviderPrompt({
          chatId: `manual-gallery-background-${profile.id}`,
          locationSlug: "fontaine-quarantine-berth",
          sceneDescription: quarantinePrompt,
          imgModel: "gpt-image-2",
          imgBaseUrl: "https://example.invalid",
          imgApiKey: "",
          styleProfiles: styleProfilesForHandoff,
          styleProfileId: profile.id,
          preserveFullScenePrompt: true,
          providerReadyPrompt: true,
          omitProfileStyleText: true,
        });
        assert.match(compiledStyledBackground.prompt, /narrow iron-framed cot/u);
        assert.match(compiledStyledBackground.prompt, /sprig of dried lavender/u);
        assert.match(compiledStyledBackground.prompt, /exposed brass pipes/u);
        assert.match(compiledStyledBackground.prompt, /hastily cleaned floorboards/u);
        if (profile.styleText) {
          assert.ok(
            !compiledStyledBackground.prompt.includes(profile.styleText),
            `${profile.id} raw style guidance leaked into the provider prompt`,
          );
        }
      }

      const drawerSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
        "utf8",
      );
      const executorSource = readFileSync(
        new URL("../../../packages/server/src/services/agents/agent-executor.ts", import.meta.url),
        "utf8",
      );
      const agentEditorSource = readFileSync(
        new URL("../../../packages/client/src/components/agents/AgentEditor.tsx", import.meta.url),
        "utf8",
      );
      const generationRoutesSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const retryAgentsRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
        "utf8",
      );
      const chatAreaSource = readFileSync(
        new URL("../../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
        "utf8",
      );
      const backgroundsRoutesSource = readFileSync(
        new URL("../../../packages/server/src/routes/backgrounds.routes.ts", import.meta.url),
        "utf8",
      );
      assert.match(drawerSource, /label=\{localizeUi\("ui\.chat\.chatsettingsdrawer\.generateSceneBackgrounds"\)\}/u);
      assert.match(drawerSource, /renderIllustratorImageStyleSelect\(\)/u);
      assert.match(executorSource, /<illustrator_background_generation enabled="true">/u);
      assert.match(executorSource, /"shouldGenerate" to true/u);
      assert.match(executorSource, /"generateBackground"/u);
      assert.doesNotMatch(executorSource, /<background_generation enabled=/u);
      assert.doesNotMatch(agentEditorSource, /Background Image Generation|autoGenerateBackgrounds/u);
      assert.doesNotMatch(generationRoutesSource, /autoGenerateBackgrounds|bgData\.generate/u);
      assert.match(chatAreaSource, /illustratorRetryTargets: \["background"\]/u);
      assert.match(
        retryAgentsRouteSource,
        /isManualIllustratorBackgroundRequest\s+\|\|\s+illustratorRequestedBackground/u,
      );
      assert.match(retryAgentsRouteSource, /isManualIllustratorBackgroundRequest\s*\?\s*\[/u);
      assert.match(retryAgentsRouteSource, /writeManualIllustratorPromptPlan/u);
      assert.match(retryAgentsRouteSource, /_styleProfileInstructionApplied:\s*true/u);
      assert.match(retryAgentsRouteSource, /force:\s*isManualIllustratorBackgroundRequest/u);
      assert.match(retryAgentsRouteSource, /await previewIllustratorSceneBackground\(backgroundArgs\)/u);
      assert.match(retryAgentsRouteSource, /kind:\s*"background"/u);
      assert.match(retryAgentsRouteSource, /backgroundPlan:\s*preview\.plan/u);
      assert.match(retryAgentsRouteSource, /promptOverride:\s*illustratorPromptReviewOverride\?\.prompt/u);
      assert.match(
        chatAreaSource,
        /illustratorPromptReview\.item\.kind === "background" \? "background" : "illustration"/u,
      );
      assert.match(retryAgentsRouteSource, /await executeRetryBatches\(\s*agentContext/u);
      assert.ok(
        generationRoutesSource.indexOf("const illustratorPromptAgent") >
          generationRoutesSource.indexOf("const illustratorAgentForInterval"),
        "automatic Illustrator style resolution must happen after interval gating",
      );
      assert.match(
        retryAgentsRouteSource,
        /const cachedStyleInstruction = args\.agentContext\.memory\._illustratorImageStyleInstruction/u,
      );
      assert.match(retryAgentsRouteSource, /typeof cachedStyleInstruction === "string"\s*\?\s*cachedStyleInstruction/u);
      assert.doesNotMatch(backgroundsRoutesSource, /getByType\("background"\)/u);
      assert.match(
        backgroundsRoutesSource,
        /Choose an image generation connection for the Illustrator agent, or mark one as the default image connection\./u,
      );
    },
  },
  {
    name: "Illustrator prompts carry the current Maps location under Tracker data (#8251)",
    async run() {
      const projection = {
        kind: "owner",
        chatId: "chat-1",
        ownerMode: "roleplay",
        definitionRevision: 1,
        currentLocationId: "loc_throne",
        breadcrumb: [
          { id: "loc_palace", name: "Royal Palace" },
          { id: "loc_throne", name: "Throne Room" },
        ],
        description: "  A vaulted white hall where the Queen holds court.  ",
        modelMemory: "PRIVATE_MEMORY_SENTINEL",
        referenceImageId: "img-1",
        useReferenceImage: true,
        lorebookEntryIds: [],
        destinations: [{ id: "loc_yard", name: "Palace Yard", kind: "area", relation: "link", sortOrder: 0 }],
        omittedDestinationCount: 0,
      } as any;
      const currentLocation = agentCurrentLocationFromProjection(projection);
      assert.deepEqual(currentLocation, {
        path: "Royal Palace > Throne Room",
        description: "A vaulted white hall where the Queen holds court.",
      });
      assert.equal(agentCurrentLocationFromProjection({ ...projection, ownerMode: "game" }), null);
      assert.equal(agentCurrentLocationFromProjection(null), null);

      const defaultSources = getAgentContextSources({ settings: {} });
      const context = makeRegressionAgentContext({
        mainResponse: "The Queen rises from the throne.",
        currentLocation,
      });
      const block = buildAgentCurrentLocationBlock(context, defaultSources);
      assert.match(block, /^<current_location>\n/u);
      assert.match(block, /Path: Royal Palace > Throne Room\nDescription: A vaulted white hall/u);
      assert.doesNotMatch(block, /PRIVATE_MEMORY_SENTINEL|Palace Yard|loc_throne/u);
      assert.equal(buildAgentCurrentLocationBlock(context, { ...defaultSources, trackerData: false }), "");
      assert.equal(buildAgentCurrentLocationBlock({ ...context, currentLocation: null }, defaultSources), "");

      const illustratorConfig = (settings: Record<string, unknown> = {}) =>
        makeRegressionAgentConfig({
          id: "builtin:illustrator",
          type: "illustrator",
          name: "Illustrator",
          promptTemplate: "Illustrate the scene.",
          settings: { contextSize: 2, maxTokens: 512, ...settings },
        });
      const quietBeat = `{"shouldGenerate":false,"prompt":"","style":"","characters":[],"reason":"quiet beat"}`;

      // Automatic Illustrator run.
      const automatic = makeCapturingProvider(quietBeat);
      await executeAgent(illustratorConfig() as any, context, automatic.provider as any, "regression-model");
      const automaticText = automatic.calls[0]!.map((message) => message.content).join("\n");
      assert.ok(automaticText.includes(block), "automatic Illustrator run gets the location block");

      const automaticOff = makeCapturingProvider(quietBeat);
      await executeAgent(
        illustratorConfig({ contextSources: { ...defaultSources, trackerData: false } }) as any,
        context,
        automaticOff.provider as any,
        "regression-model",
      );
      assert.doesNotMatch(automaticOff.calls[0]!.map((message) => message.content).join("\n"), /<current_location>/u);

      // Agents that don't write image prompts never get it.
      const tracker = makeCapturingProvider("{}");
      await executeAgent(
        makeRegressionAgentConfig({ type: "world-state", settings: { contextSize: 2, maxTokens: 512 } }) as any,
        context,
        tracker.provider as any,
        "regression-model",
      );
      assert.doesNotMatch(tracker.calls[0]!.map((message) => message.content).join("\n"), /<current_location>/u);

      // [illustrate:] commands and the Gallery button.
      const runManualWriter = async (settings: Record<string, unknown> = {}) => {
        const capture = makeCapturingProvider(
          JSON.stringify({ prompt: "The Queen rises.", characters: [], reason: "Scene." }),
        );
        await writeManualIllustratorPromptPlan({
          illustratorAgent: {
            ...illustratorConfig(settings),
            provider: capture.provider,
            model: "regression-model",
          } as any,
          context,
        });
        return capture.calls[0]![0]!.content;
      };
      assert.ok((await runManualWriter()).includes(block), "manual writer gets the same location block");
      assert.doesNotMatch(
        await runManualWriter({ contextSources: { ...defaultSources, trackerData: false } }),
        /<current_location>/u,
      );
    },
  },
  {
    name: "Illustrator sends the selected prompt template and image style instruction in the same agent request",
    async run() {
      const { calls, provider } = makeCapturingProvider(
        `{"shouldGenerate":false,"prompt":"","style":"","characters":[],"reason":"quiet beat"}`,
      );
      const config = makeRegressionAgentConfig({
        id: "builtin:illustrator",
        type: "illustrator",
        name: "Illustrator",
        promptTemplate:
          "COMIC_PAGE_TEMPLATE_SENTINEL: create a complete colored comic page with three panels and speech bubbles.",
        settings: { contextSize: 5, maxTokens: 512 },
      });
      const context = makeRegressionAgentContext({
        mainResponse: "Mira races across the rain-soaked roof and lands beside the bell tower.",
        memory: {
          _illustratorImageStyleInstruction:
            "Infer a consistent visual style from the character, game, scene, and selected image model.",
        },
      });

      const result = await executeAgent(config as any, context, provider as any, "regression-model");
      assert.equal(result.success, true);
      const messages = calls[0]!;
      const requestText = messages.map((message) => message.content).join("\n");
      assert.match(requestText, /COMIC_PAGE_TEMPLATE_SENTINEL/u);
      assert.match(requestText, /<illustrator_image_style>/u);
      assert.match(requestText, /Infer a consistent visual style from the character/u);
      assert.match(
        requestText,
        /selected Illustrator prompt template and this visual style instruction are cumulative/iu,
      );

      const gameCapture = makeCapturingProvider(
        `{"shouldGenerate":false,"prompt":"","style":"","characters":[],"reason":"quiet beat"}`,
      );
      const gameResult = await executeAgent(
        config as any,
        makeRegressionAgentContext({
          chatMode: "game",
          mainResponse: "Mira races across the rain-soaked roof and lands beside the bell tower.",
          memory: {
            _illustratorImageStyleInstruction: "GENERIC_PROFILE_STYLE_SENTINEL",
            _gameImageStylePrompt: "GAME_IMAGE_STYLE_SENTINEL",
          },
        }),
        gameCapture.provider as any,
        "regression-model",
      );
      assert.equal(gameResult.success, true);
      const gameRequestText = gameCapture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(gameRequestText, /<game_image_instructions>/u);
      assert.match(gameRequestText, /GAME_IMAGE_STYLE_SENTINEL/u);
      assert.doesNotMatch(gameRequestText, /<illustrator_image_style>/u);
      assert.doesNotMatch(gameRequestText, /GENERIC_PROFILE_STYLE_SENTINEL/u);
    },
  },
  {
    name: "forced image snapshots are limited to a single image-capable custom agent",
    run() {
      const imageAgent = { isCustomAgent: true, canEmitImagePrompt: true };
      const nonImageAgent = { isCustomAgent: true, canEmitImagePrompt: false };
      const builtIn = { isCustomAgent: false, canEmitImagePrompt: false };

      assert.equal(forceImageGenerationScopeError(false, [imageAgent, builtIn, nonImageAgent]), null);
      assert.equal(forceImageGenerationScopeError(true, [imageAgent]), null);
      // Multi-agent and empty forced batches are rejected.
      assert.match(forceImageGenerationScopeError(true, [imageAgent, imageAgent]) ?? "", /exactly one agent/);
      assert.match(forceImageGenerationScopeError(true, []) ?? "", /exactly one agent/);
      // Built-in targets are rejected — the Illustrator has its own manual path.
      assert.match(forceImageGenerationScopeError(true, [builtIn]) ?? "", /custom image agents/);
      // Custom agents without the Image generation ability are rejected.
      assert.match(forceImageGenerationScopeError(true, [nonImageAgent]) ?? "", /Image generation ability/);
    },
  },
  {
    name: "forced snapshots surface successful results that carry no image prompt",
    run() {
      // A successful non-image_prompt result (or null data) would otherwise be a
      // silent no-op for the camera press — the fallback error must fire.
      assert.equal(needsForcedSnapshotFallback(true, { success: true, type: "context_injection", data: {} }), true);
      assert.equal(needsForcedSnapshotFallback(true, { success: true, type: "image_prompt", data: null }), true);
      assert.equal(needsForcedSnapshotFallback(true, { success: true, type: "image_prompt", data: "text" }), true);
      // A usable image_prompt payload is handled by the generation block itself.
      assert.equal(needsForcedSnapshotFallback(true, { success: true, type: "image_prompt", data: {} }), false);
      // Failed results already surface their error via the agent_result event.
      assert.equal(needsForcedSnapshotFallback(true, { success: false, type: "context_injection", data: {} }), false);
      // Non-forced retries never use the fallback.
      assert.equal(needsForcedSnapshotFallback(false, { success: true, type: "context_injection", data: {} }), false);
    },
  },
  {
    name: "per-chat custom agent image overrides apply to custom agents only",
    run() {
      const chatMeta = {
        customAgentImageSettings: {
          "scene-painter": { imageConnectionId: "conn-override", styleProfileId: "  style-override  " },
          illustrator: { imageConnectionId: "conn-should-never-apply" },
          "empty-entry": { imageConnectionId: "  " },
        },
      };
      const base = { imageConnectionId: "conn-agent-default", other: "kept" };

      const overridden = applyCustomAgentImageChatSettings("scene-painter", { ...base }, chatMeta);
      assert.equal(overridden.imageConnectionId, "conn-override");
      assert.equal(overridden.styleProfileId, "style-override");
      assert.equal(overridden.other, "kept");

      // Built-in agents keep their own dedicated chat-level override keys.
      const builtIn = applyCustomAgentImageChatSettings("illustrator", { ...base }, chatMeta);
      assert.equal(builtIn.imageConnectionId, "conn-agent-default");

      // Blank or missing entries leave the agent's own configuration untouched.
      const blank = applyCustomAgentImageChatSettings("empty-entry", { ...base }, chatMeta);
      assert.equal(blank.imageConnectionId, "conn-agent-default");
      const missing = applyCustomAgentImageChatSettings("unlisted-agent", { ...base }, chatMeta);
      assert.equal(missing.imageConnectionId, "conn-agent-default");
      const noMeta = applyCustomAgentImageChatSettings("scene-painter", { ...base }, null);
      assert.equal(noMeta.imageConnectionId, "conn-agent-default");

      const profiles = [{ id: "style-override" }];
      assert.equal(
        resolveCustomAgentStyleProfileId({
          usesChatIllustratorSettings: false,
          agentSettings: overridden,
          availableProfiles: profiles,
          gameStyleProfileId: "game-style",
          chatStyleProfileId: "chat-style",
        }),
        "style-override",
      );
      assert.equal(
        resolveCustomAgentStyleProfileId({
          usesChatIllustratorSettings: false,
          agentSettings: { styleProfileId: "deleted-profile" },
          availableProfiles: profiles,
          gameStyleProfileId: "game-style",
          chatStyleProfileId: "chat-style",
        }),
        "game-style",
      );
      assert.equal(
        resolveCustomAgentStyleProfileId({
          usesChatIllustratorSettings: true,
          agentSettings: overridden,
          availableProfiles: profiles,
          gameStyleProfileId: "",
          chatStyleProfileId: "chat-style",
        }),
        "chat-style",
      );
    },
  },
];

await runNamedCases(cases);
