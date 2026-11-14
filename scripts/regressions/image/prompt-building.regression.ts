import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANIME_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE,
  COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  compileImagePrompt,
  createDefaultImageStyleProfileSettings,
  normalizeImageStyleProfileSettings,
  removeCopiedPromptGuidance,
  resolveImageStyleGuidanceText,
  resolveGameSetupArtStylePrompt,
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
  GAME_VIDEO_PROMPT_TEMPLATE,
} from "../../../packages/shared/src/index.js";
import {
  addNameLookupEntry,
  findCharAvatarFuzzy,
  loadCharacterLibraryAvatarLookup,
} from "../../../packages/server/src/services/game/npc-avatar-utils.js";
import { loadGameVideoPrompt } from "../../../packages/server/src/services/video/game-video-prompt.js";
import {
  clipVerbatimVideoSource,
  compactVideoPromptText,
  getSceneVideoPromptLimits,
  resolveGalleryVideoNarrationSummary,
  resolveGalleryVideoSourceExchange,
} from "../../../packages/server/src/services/video/prompt-context.js";
import {
  buildRoleplayVideoDirectionMessages,
  buildRoleplayVideoDirectionUserPrompt,
  resolveRoleplayVideoDirection,
} from "../../../packages/server/src/services/video/roleplay-video-direction.js";
import { captionSentSelfies } from "../../../packages/server/src/services/generation/image-captioning-runtime.js";
import {
  buildBackgroundProviderPrompt,
  buildNpcPortraitProviderPrompt,
  buildSceneIllustrationProviderPrompt,
} from "../../../packages/server/src/services/game/game-asset-generation.js";
import { MAPS_LOCATION_ARTWORK } from "../../../packages/server/src/services/prompt-overrides/registry/game-assets.js";
import { resolveReviewedImagePromptSubmission } from "../../../packages/server/src/services/image/image-prompt-review.js";
import { buildIllustratorBackgroundPlanSystemPrompt } from "../../../packages/server/src/services/generation/illustrator-background-generation.js";
import { buildManualIllustratorPromptMessages } from "../../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js";
import {
  buildDynamicGameImagePromptMessages,
  dynamicGameImagePromptRequestOptions,
  resolveDynamicGameImagePromptConnection,
  resolveNpcPortraitAppearance,
  sanitizeNpcPortraitAppearanceText,
  selectLatestGameTurnNarration,
  shouldUseDynamicGameImagePromptGenerator,
} from "../../../packages/server/src/routes/game.routes.js";
import type { PromptOverridesStorage } from "../../../packages/server/src/services/storage/prompt-overrides.storage.js";
import {
  listPromptOverrideKeys,
  loadPrompt,
  ROLEPLAY_GALLERY_VIDEO_DIRECTOR,
} from "../../../packages/server/src/services/prompt-overrides/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "campaign art style controls and manual storyboard review remain wired end to end",
    run() {
      assert.equal(resolveGameSetupArtStylePrompt({ artStylePrompt: "  painterly fantasy  " }), "painterly fantasy");
      assert.equal(
        resolveGameSetupArtStylePrompt({ artStylePrompt: "painterly fantasy", useCampaignArtStyle: false }),
        "",
      );
      assert.equal(resolveGameSetupArtStylePrompt({ useCampaignArtStyle: true }), "");

      const drawerSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
        "utf8",
      );
      const gameSurfaceSource = readFileSync(
        new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
        "utf8",
      );
      const storyboardHookSource = readFileSync(
        new URL("../../../packages/client/src/hooks/use-game-storyboards.ts", import.meta.url),
        "utf8",
      );
      const gameRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/game.routes.ts", import.meta.url),
        "utf8",
      );

      assert.match(drawerSource, /label=\{localizeUi\("ui\.chat\.chatsettingsdrawer\.useCampaignArtStyle"\)\}/);
      assert.match(drawerSource, /generatedArtStylePrompt: generatedCampaignArtStyle \|\| campaignArtStyle/);
      assert.match(gameSurfaceSource, /reviewImagePromptsBeforeSend/);
      assert.match(gameSurfaceSource, /previewTurnStoryboardPrompts\.mutateAsync\(payload\)/);
      assert.match(gameSurfaceSource, /plannedStoryboard = preview\.plannedStoryboard/);
      assert.match(gameSurfaceSource, /promptOverrides/);
      const storyboardHandlerStart = gameSurfaceSource.indexOf("const handleGenerateTurnStoryboard = useCallback");
      const storyboardHandlerEnd = gameSurfaceSource.indexOf("\n  useEffect(() =>", storyboardHandlerStart);
      assert.notEqual(storyboardHandlerStart, -1);
      assert.notEqual(storyboardHandlerEnd, -1);
      const storyboardHandlerSource = gameSurfaceSource.slice(storyboardHandlerStart, storyboardHandlerEnd);
      assert.match(storyboardHandlerSource, /latestTurnStoryboardRendering \|\| manualStoryboardReviewActive/);
      assert.match(
        storyboardHandlerSource,
        /withTimeout\(\s*\(\) => previewTurnStoryboardPrompts\.mutateAsync\(payload\),\s*GAME_ASSET_PREVIEW_TIMEOUT_MS/,
      );
      assert.match(storyboardHandlerSource, /GAME_ASSET_PROMPT_REVIEW_TIMEOUT_MS/);
      assert.match(storyboardHandlerSource, /overrides = IMAGE_PROMPT_REVIEW_TIMED_OUT/);
      assert.match(
        gameSurfaceSource,
        /onClick=\{\(\) => void handleGenerateTurnStoryboard\(\)\}[\s\S]{0,300}manualStoryboardReviewActive/,
      );
      assert.match(storyboardHookSource, /previewOnly: true/);
      assert.match(gameRouteSource, /if \(input\.previewOnly\)/);
      assert.match(gameRouteSource, /createStoryboardReviewPlanEnvelope\(\{/);
      assert.match(gameRouteSource, /plannerWarning: illustratorErrorMessage/);
      assert.match(
        gameRouteSource,
        /usedFallbackStoryboardPlanner = reviewedStoryboard\.usedFallbackPlanner \|\| !reviewedPlanHasRenderableKeyframe/u,
      );
      assert.match(gameSurfaceSource, /preview\.plannerWarning/);
      assert.match(gameRouteSource, /storyboardPromptOverrideById\.get\(`storyboard:\$\{frame\.index\}`\)/);
      assert.match(gameRouteSource, /\[debug\/game\/storyboard-image-preview\]/);
    },
  },
  {
    name: "Avatar prompts keep configured positive and per-image tags as the leading prefix",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const profile = styleProfiles.profiles.find((candidate) => candidate.id === "danbooru");
      assert.ok(profile);
      const compiled = compileImagePrompt({
        kind: "avatar",
        prompt: "Canonical appearance for Mira: young woman, long brown hair, amber eyes, dark travel coat.",
        styleProfiles,
        styleProfileId: profile.id,
        hardNegative:
          "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads",
      });

      assert.match(
        compiled.prompt,
        /^masterpiece, best quality, absurdres, anime screencap, detailed eyes, solo, portrait, upper body, centered composition,/u,
      );
      assert.doesNotMatch(compiled.prompt, /readable expression|clear silhouette|face-and-shoulders/iu);
      assert.match(compiled.negativePrompt, /collage layouts/iu);
    },
  },
  {
    name: "tagged avatar prompts preserve long user appearance details",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const profile = styleProfiles.profiles.find((candidate) => candidate.id === "danbooru");
      assert.ok(profile);
      const appearance =
        "1girl, Shiranui Mai, Fatal Fury, light blue button down, long auburn hair, amber eyes, red ribbon, white gloves, black skirt, thighhighs, detailed face, soft smile, standing in a moonlit garden, intricate floral background, cinematic rim lighting, warm highlights, cool shadows";
      const compiled = compileImagePrompt({
        kind: "avatar",
        prompt: `Canonical appearance: ${appearance}`,
        userPositive: appearance,
        styleProfiles,
        styleProfileId: profile.id,
      });
      for (const detail of [
        "1girl",
        "Shiranui Mai",
        "Fatal Fury",
        "light blue button down",
        "intricate floral background",
      ]) {
        assert.match(compiled.prompt, new RegExp(detail, "iu"), `avatar prompt must preserve ${detail}`);
      }
    },
  },
  {
    name: "Auto style guidance never reaches the final image prompt as text (#7318)",
    async run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const autoInstruction = /Infer a consistent visual style/iu;
      const prompt = "1girl, solo, silver hair, red eyes, black coat, rain, night city street";
      for (const kind of ["avatar", "illustration", "background", "selfie"] as const) {
        const compiled = compileImagePrompt({ kind, prompt, styleProfiles, styleProfileId: "auto" });
        assert.doesNotMatch(compiled.prompt, autoInstruction, `${kind}: ${compiled.prompt}`);
        assert.match(compiled.prompt, /silver hair/u, `${kind} kept the source prompt: ${compiled.prompt}`);
      }

      const background = await buildBackgroundProviderPrompt({
        chatId: "auto-style-background",
        locationSlug: "rainy-street",
        sceneDescription: "Rain-soaked neon street at night",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
        styleProfiles,
        styleProfileId: "auto",
      });
      assert.doesNotMatch(background.prompt, autoInstruction, background.prompt);

      // A real style profile's Style text is still applied when no prompt writer handled it.
      const anime = compileImagePrompt({ kind: "illustration", prompt, styleProfiles, styleProfileId: "anime" });
      assert.match(anime.prompt, /Anime illustration with clean character design/u, anime.prompt);

      // Style text the user wrote into a clone of Auto (Clone keeps the auto base style) still applies.
      const autoProfile = styleProfiles.profiles.find((profile) => profile.id === "auto")!;
      const autoClone = {
        ...autoProfile,
        id: "auto-custom",
        builtIn: false,
        styleText: "watercolor, soft pastel palette",
      };
      const cloneProfiles = { ...styleProfiles, profiles: [...styleProfiles.profiles, autoClone] };
      for (const kind of ["avatar", "illustration"] as const) {
        const custom = compileImagePrompt({
          kind,
          prompt,
          styleProfiles: cloneProfiles,
          styleProfileId: "auto-custom",
        });
        assert.match(custom.prompt, /watercolor, soft pastel palette/u, `${kind}: ${custom.prompt}`);
      }
    },
  },
  {
    name: "Image prompt writers follow Style text and Image Prompting Instructions without pasting them (#7357)",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const danbooruStyle = styleProfiles.profiles.find((profile) => profile.id === "danbooru")!.styleText;
      const instructions = "Write everything in capital letters. Use comma-separated Danbooru tags only.";
      const quotedStyle = /Danbooru-tagged anime generation/iu;

      // An Illustrator writer told to carry the style into its JSON "style" field echoes the Style
      // text there and in its prompt. The Engine cleans the writer's own output before it adds
      // configured text, so none of the guidance reaches the image model, but a configured positive
      // prompt that happens to repeat an instruction stays as the user wrote it.
      const writerGuidance = [danbooruStyle, instructions];
      const echoedStyle = danbooruStyle.replace(/\.$/u, "");
      const writerStyle = removeCopiedPromptGuidance(`${echoedStyle}, cel shading`, writerGuidance);
      const writerPrompt = removeCopiedPromptGuidance(
        `${echoedStyle}, 1GIRL, SOLO, SILVER HAIR, RAIN\n${instructions}`,
        writerGuidance,
      );
      assert.equal(writerStyle, "cel shading");
      const configuredPositive = "Write everything in capital letters";
      const written = compileImagePrompt({
        kind: "illustration",
        prompt: [writerStyle, writerPrompt, configuredPositive].filter(Boolean).join(", "),
        generatedStyle: writerStyle,
        styleProfiles,
        styleProfileId: "danbooru",
        omitProfileStyleText: true,
      });
      assert.doesNotMatch(written.prompt, quotedStyle, written.prompt);
      assert.doesNotMatch(written.prompt, /comma-separated Danbooru tags only/iu, written.prompt);
      assert.match(written.prompt, /1GIRL, SOLO, SILVER HAIR, RAIN/u, written.prompt);
      assert.match(written.prompt, /Write everything in capital letters$/u, "configured text stays: " + written.prompt);
      assert.match(written.prompt, /^masterpiece, best quality/u, "literal profile tags stay: " + written.prompt);

      // Tag lists and tag phrases are words for the image model, so a writer that uses them keeps them.
      const tagGuidance = "masterpiece, best quality, absurdres";
      assert.equal(removeCopiedPromptGuidance(`${tagGuidance}, 1girl`, [tagGuidance]), `${tagGuidance}, 1girl`);
      const tagPhrase = "cold lighting with deep shadows, film grain";
      assert.equal(removeCopiedPromptGuidance(`1girl, ${tagPhrase}`, [tagPhrase]), `1girl, ${tagPhrase}`);
      assert.equal(
        removeCopiedPromptGuidance(
          "1girl, solo\n\nWRITE EVERYTHING IN CAPITAL LETTERS\n\nMira's Appearance: red hair",
          ["Write everything in capital letters."],
        ),
        "1girl, solo\n\nMira's Appearance: red hair",
      );
      // A writer that returned nothing but the guidance keeps its text, so the image still has a subject.
      assert.equal(removeCopiedPromptGuidance(echoedStyle, [danbooruStyle]), echoedStyle);
      // A JSON "style" that was only the copied Style text is dropped; the prompt keeps the subject.
      assert.equal(removeCopiedPromptGuidance(echoedStyle, [danbooruStyle], { allowEmpty: true }), "");
      // A sentence the user wrapped over two lines is still one sentence.
      assert.equal(
        removeCopiedPromptGuidance("1girl, Use moody lighting and show long shadows in rain., solo", [
          "Use moody lighting\nand show long shadows in rain.",
        ]),
        "1girl, solo",
      );

      // Every writer path cleans its own output before configured text is added.
      const routeSource = (path: string) =>
        readFileSync(new URL(`../../../packages/server/src/${path}`, import.meta.url), "utf8");
      const generateRoute = routeSource("routes/generate.routes.ts");
      assert.match(generateRoute, /const writerPrompt = removeCopiedPromptGuidance\(imagePrompt, writerGuidance\);/u);
      assert.match(
        generateRoute,
        /let fullPrompt = writerStyle \? `\$\{writerStyle\}, \$\{writerPrompt\}` : writerPrompt;/u,
      );
      assert.equal(generateRoute.match(/generatedStyle: writerStyle,/gu)?.length, 2);
      const retryRoute = routeSource("routes/generate/retry-agents-route.ts");
      assert.match(
        retryRoute,
        /style: writerStyle,\s+imagePrompt: removeCopiedPromptGuidance\(imagePrompt, writerGuidance\),/u,
      );
      assert.equal(retryRoute.match(/generatedStyle: writerStyle,/gu)?.length, 2);
      assert.match(
        routeSource("routes/gallery.routes.ts"),
        /removeCopiedPromptGuidance\(\(promptResult\.content \?\? ""\)\.trim\(\), \[/u,
      );
      // The Conversation selfie writer strips leading reasoning first, then the copied guidance.
      assert.match(
        routeSource("services/generation/conversation-selfie-command-runtime.ts"),
        /removeCopiedPromptGuidance\(answer, \[/u,
      );
      assert.match(
        routeSource("services/generation/illustrator-background-generation.ts"),
        /sceneDescription: removeCopiedPromptGuidance\(plan\.prompt, \[styleInstruction, imagePromptInstructions\]\)/u,
      );

      // Without a prompt writer, the profile's Style text still applies as written (#7318).
      const unwritten = compileImagePrompt({
        kind: "illustration",
        prompt: "1girl, solo",
        styleProfiles,
        styleProfileId: "danbooru",
      });
      assert.match(unwritten.prompt, quotedStyle, unwritten.prompt);

      // Style text a user writes into Auto or a copy of it is guidance for selfie writers too,
      // instead of being dropped; the built-in Auto sentence is not.
      const autoProfile = styleProfiles.profiles.find((profile) => profile.id === "auto")!;
      const cloneProfiles = {
        ...styleProfiles,
        profiles: [
          ...styleProfiles.profiles,
          { ...autoProfile, id: "auto-custom", builtIn: false, styleText: "watercolor" },
        ],
      };
      assert.equal(resolveImageStyleGuidanceText(cloneProfiles, "auto-custom"), "watercolor");
      assert.equal(resolveImageStyleGuidanceText(cloneProfiles, "auto"), "");

      // The manual Illustration writer gets the instructions next to its request, as the automatic
      // Illustrator does, not above the character cards and chat history.
      const manualMessages = buildManualIllustratorPromptMessages({
        context: {
          chatId: "manual-instructions",
          chatMode: "roleplay",
          recentMessages: [{ role: "assistant", content: "Mira steps into the rain." }],
          mainResponse: "Mira steps into the rain.",
          gameState: null,
          characters: [],
          persona: null,
          memory: {},
          writableLorebookIds: null,
          chatSummary: null,
        },
        contextSize: 1,
        styleInstruction: danbooruStyle,
        imagePromptInstructions: instructions,
      });
      const manualRequest = manualMessages.at(-1)!;
      assert.equal(manualRequest.role, "user");
      assert.match(manualRequest.content, /<image_prompting_instructions>[\s\S]*capital letters/u);
      assert.doesNotMatch(manualMessages[0]!.content, /capital letters/u);

      // The scene background writer gets them too.
      const backgroundSystemPrompt = buildIllustratorBackgroundPlanSystemPrompt(danbooruStyle, instructions);
      assert.match(backgroundSystemPrompt, /<image_prompting_instructions>[\s\S]*capital letters/u);
      assert.match(backgroundSystemPrompt, /Visual style instruction for the image prompt you write/u);
    },
  },
  {
    name: "avatar portrait and sprite prompts honor a profile's natural-language grammar",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const animeProfile = styleProfiles.profiles.find((candidate) => candidate.id === "danbooru");
      assert.ok(animeProfile);
      const naturalAnimeProfile = {
        ...animeProfile,
        id: "natural-anime",
        name: "Natural anime",
        promptMode: "natural" as const,
        positiveTags: "",
        negativeTags: "",
        styleText: "",
        subjectTags: {},
      };
      const naturalStyleProfiles = {
        ...styleProfiles,
        defaultProfileId: naturalAnimeProfile.id,
        profiles: [...styleProfiles.profiles, naturalAnimeProfile],
      };
      const prompt =
        "Create a portrait of Mira. She has long brown hair and amber eyes. She wears a dark travel coat beneath cold moonlight.";

      for (const kind of ["avatar", "portrait", "sprite"] as const) {
        const compiled = compileImagePrompt({
          kind,
          prompt,
          styleProfiles: naturalStyleProfiles,
          styleProfileId: naturalAnimeProfile.id,
        });

        assert.match(compiled.prompt, /She has long brown hair and amber eyes/u);
        assert.match(compiled.prompt, /She wears a dark travel coat beneath cold moonlight/u);
        assert.doesNotMatch(compiled.prompt, /long brown hair, amber eyes, dark travel coat/u);
      }
    },
  },
  {
    name: "Selfie captions are made once, cached, and never stop the turn",
    async run() {
      const calls: string[] = [];
      const runtime = {
        enabled: true,
        connectionId: "cap-conn",
        connection: { id: "cap-conn", provider: "openai", model: "vision-1" },
        provider: {
          chatComplete: async () => {
            calls.push("caption");
            return { content: "A smiling selfie." };
          },
        },
        prompt: null,
      } as any;
      const readImageDataUrl = async () => "data:image/png;base64,AAAA";
      const signal = new AbortController().signal;
      const attachments = [
        { type: "image", filename: "selfie_maukie_1.png", galleryId: "g1", prompt: "A selfie." },
        { type: "image", filename: "illustration_1.png", galleryId: "g2" },
      ];

      const captioned = await captionSentSelfies({ attachments, imageCaptioning: runtime, readImageDataUrl, signal });
      assert.ok(Array.isArray(captioned));
      assert.equal(captioned[0]!.imageCaption, "A smiling selfie.");
      assert.equal(captioned[0]!.imageCaptionConnectionId, "cap-conn");
      assert.equal(captioned[1]!.imageCaption, undefined);
      assert.equal(calls.length, 1);

      assert.equal(
        await captionSentSelfies({ attachments: captioned, imageCaptioning: runtime, readImageDataUrl, signal }),
        null,
      );
      assert.equal(calls.length, 1);

      const failingRuntime = {
        ...runtime,
        provider: {
          chatComplete: async () => {
            throw new Error("vision model down");
          },
        },
      };
      assert.equal(
        await captionSentSelfies({ attachments, imageCaptioning: failingRuntime, readImageDataUrl, signal }),
        null,
      );

      const disabledReads: string[] = [];
      const disabledRuntime = { ...runtime, enabled: false };
      assert.equal(
        await captionSentSelfies({
          attachments,
          imageCaptioning: disabledRuntime,
          readImageDataUrl: async () => {
            disabledReads.push("read");
            return null;
          },
          signal,
        }),
        null,
      );
      assert.equal(disabledReads.length, 0);
    },
  },
  {
    name: "Gemini Omni video prompts preserve complete storyboard direction",
    run() {
      const direction = [
        "0.0-2.0s: Establish the hall and move toward the relic.",
        "2.0-4.0s: The sealing spike lands and the conduits extinguish.",
        "4.0-6.0s: Pull back through falling parchment and hold on Vaela's final expression.",
        "continuity ".repeat(100),
      ].join(" ");
      const omniLimits = getSceneVideoPromptLimits(false, true);
      const defaultLimits = getSceneVideoPromptLimits(false);
      const xaiLimits = getSceneVideoPromptLimits(true, true);

      assert.equal(compactVideoPromptText(direction, omniLimits.narrationSummary), direction.trim());
      assert.ok(compactVideoPromptText(direction, defaultLimits.narrationSummary).endsWith("..."));
      assert.equal(xaiLimits.finalPrompt, 3800);
    },
  },
  {
    name: "Roleplay Gallery Animate uses the selected image's source narration",
    async run() {
      const messages = [
        {
          id: "source-request",
          role: "user",
          content: "Draw the blade, but do not strike yet.",
          extra: "{}",
        },
        {
          id: "source-turn",
          role: "assistant",
          content: "The active swipe now describes a quiet room.",
          extra: "{}",
        },
        {
          id: "active-source-turn",
          role: "assistant",
          content: "Mira raises the lantern and studies the opening door.",
          extra: JSON.stringify({ attachments: [{ type: "image", galleryId: "active-gallery-image" }] }),
        },
        {
          id: "latest-turn",
          role: "assistant",
          content: "Much later, Sol runs across the moonlit courtyard.",
          extra: "{malformed",
        },
        {
          id: "later-system-event",
          role: "system",
          content: "A system event records a participant joining the chat.",
          extra: "{}",
        },
        {
          id: "later-narrator-event",
          role: "narrator",
          content: "An unrelated narrator event should not become animation direction.",
          extra: "{}",
        },
        {
          id: "latest-user-turn",
          role: "user",
          content: "Follow Sol.",
          extra: "{}",
        },
      ];
      const swipes = [
        {
          messageId: "source-turn",
          content: "Mira slowly draws the ancient blade as dust falls from the ceiling.",
          extra: JSON.stringify({ attachments: [{ type: "image", galleryId: "swipe-gallery-image" }] }),
        },
      ];

      assert.equal(
        resolveGalleryVideoNarrationSummary(messages, swipes, "swipe-gallery-image", 650),
        "Mira slowly draws the ancient blade as dust falls from the ceiling.",
      );
      assert.equal(
        resolveGalleryVideoNarrationSummary(messages, swipes, "active-gallery-image", 650),
        "Mira raises the lantern and studies the opening door.",
      );
      assert.equal(
        resolveGalleryVideoNarrationSummary(messages, swipes, "legacy-upload-without-source", 650),
        "Much later, Sol runs across the moonlit courtyard.",
      );

      assert.deepEqual(resolveGalleryVideoSourceExchange(messages, swipes, "swipe-gallery-image"), {
        sourceMessageId: "source-turn",
        content:
          "User:\nDraw the blade, but do not strike yet.\n\nAssistant:\nMira slowly draws the ancient blade as dust falls from the ceiling.",
      });
      assert.equal(clipVerbatimVideoSource("  verbatim source  ", 8), "verbatim");

      const directionUserPrompt = buildRoleplayVideoDirectionUserPrompt({
        durationSeconds: 6,
        aspectRatio: "16:9",
        sourceExchange: "User:\nDraw the blade.\n\nAssistant:\nMira slowly draws it as dust falls.",
        referenceImagePrompt: "Mira holds the half-drawn blade in a ruined hall, static portrait details.",
        characterNames: ["Mira"],
        setting: "Ruined hall at night",
      });
      const defaultDirectorPrompt = ROLEPLAY_GALLERY_VIDEO_DIRECTOR.defaultBuilder({ durationSeconds: 6 });
      assert.match(defaultDirectorPrompt, /one 6-second image-to-video Roleplay clip/u);
      assert.match(defaultDirectorPrompt, /inside the 6-second runtime/u);
      assert.match(defaultDirectorPrompt, /exact first frame at time zero/u);
      assert.match(defaultDirectorPrompt, /camera movement/u);
      assert.match(defaultDirectorPrompt, /ambient audio/u);
      assert.match(defaultDirectorPrompt, /Do not repeat a static image description/u);
      assert.equal(listPromptOverrideKeys().includes("roleplay.galleryVideoDirector"), true);
      const directorOverrideStorage = {
        async get(key: string) {
          if (key !== ROLEPLAY_GALLERY_VIDEO_DIRECTOR.key) return null;
          return {
            key,
            template: "Direct one ${durationSeconds}-second Roleplay animation.",
            enabled: true,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async list() {
          return [];
        },
        async upsert(input) {
          return {
            key: input.key,
            template: input.template,
            enabled: input.enabled,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async remove() {},
      } satisfies PromptOverridesStorage;
      assert.equal(
        await loadPrompt(directorOverrideStorage, ROLEPLAY_GALLERY_VIDEO_DIRECTOR, { durationSeconds: 12 }),
        "Direct one 12-second Roleplay animation.",
      );
      const missingDirectorOverrideStorage = {
        ...directorOverrideStorage,
        async get() {
          return null;
        },
      } satisfies PromptOverridesStorage;
      assert.equal(
        await loadPrompt(missingDirectorOverrideStorage, ROLEPLAY_GALLERY_VIDEO_DIRECTOR, { durationSeconds: 8 }),
        ROLEPLAY_GALLERY_VIDEO_DIRECTOR.defaultBuilder({ durationSeconds: 8 }),
      );
      const disabledDirectorOverrideStorage = {
        ...directorOverrideStorage,
        async get(key: string) {
          if (key !== ROLEPLAY_GALLERY_VIDEO_DIRECTOR.key) return null;
          return {
            key,
            template: "This disabled template must not render ${durationSeconds}.",
            enabled: false,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
      } satisfies PromptOverridesStorage;
      assert.equal(
        await loadPrompt(disabledDirectorOverrideStorage, ROLEPLAY_GALLERY_VIDEO_DIRECTOR, { durationSeconds: 9 }),
        ROLEPLAY_GALLERY_VIDEO_DIRECTOR.defaultBuilder({ durationSeconds: 9 }),
      );
      const directionMessages = await buildRoleplayVideoDirectionMessages(directorOverrideStorage, {
        durationSeconds: 12,
        aspectRatio: "16:9",
        sourceExchange: "User:\nDraw the blade.\n\nAssistant:\nMira slowly draws it as dust falls.",
        referenceImagePrompt: "Mira holds the half-drawn blade in a ruined hall, static portrait details.",
        characterNames: ["Mira"],
        setting: "Ruined hall at night",
      });
      assert.equal(directionMessages[0].role, "system");
      assert.equal(directionMessages[0].content, "Direct one 12-second Roleplay animation.");
      assert.equal(directionMessages[1].role, "user");
      assert.match(directionMessages[1].content, /<clip_duration_seconds>12<\/clip_duration_seconds>/u);
      assert.match(directionUserPrompt, /<source_exchange>[\s\S]*Draw the blade/u);
      assert.match(directionUserPrompt, /<first_frame_generation_context>/u);
      assert.equal(
        resolveRoleplayVideoDirection(
          '```json\n{"narrationBeat":"Mira draws the blade as the camera eases closer; dust falls and steel rings softly."}\n```',
          3_800,
        ),
        "Mira draws the blade as the camera eases closer; dust falls and steel rings softly.",
      );
      assert.equal(
        resolveRoleplayVideoDirection(
          'Planned direction follows.\n```json\n{"narrationBeat":"Mira holds the blade steady while the camera settles."}\n```\nEnd.',
          3_800,
        ),
        "Mira holds the blade steady while the camera settles.",
      );
      assert.equal(
        resolveRoleplayVideoDirection("Narration beat: She stops and holds as the room tone settles.", 3_800),
        "She stops and holds as the room tone settles.",
      );
      assert.equal(resolveRoleplayVideoDirection('{"wrongField":"do not send raw JSON"}', 3_800), "");
      // A JSON shape the video connection's instructions ask for is the prompt itself.
      assert.equal(
        resolveRoleplayVideoDirection(
          '```json\n{"shot":"Mira draws the blade","soundscape":"steel rings"}\n```',
          3_800,
          "Answer as JSON with shot and soundscape fields.",
        ),
        '{"shot":"Mira draws the blade","soundscape":"steel rings"}',
      );
      assert.equal(
        resolveRoleplayVideoDirection('[{"shot":"Mira bows"}]', 3_800, "Answer as a JSON list of shots."),
        '[{"shot":"Mira bows"}]',
      );
      // Instructions that ask for no JSON make a stray object (an error payload) no prompt at all.
      assert.equal(
        resolveRoleplayVideoDirection('{"error":"rate limited"}', 3_800, "Write one cinematic paragraph."),
        "",
      );

      const galleryRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/gallery.routes.ts", import.meta.url),
        "utf8",
      );
      assert.match(galleryRouteSource, /!promptDraft && chat\.mode === "roleplay"/u);
      // Roleplay planning goes through the shared clip writer, which uses the Prompt Model and the director messages.
      assert.match(galleryRouteSource, /writeRoleplayClipDirection\(app\.db/u);
      const clipWriterSource = readFileSync(
        new URL("../../../packages/server/src/services/video/roleplay-clip-writer.ts", import.meta.url),
        "utf8",
      );
      assert.match(clipWriterSource, /resolveIllustratorPromptRuntime/u);
      assert.match(clipWriterSource, /buildRoleplayVideoDirectionMessages\(createPromptOverridesStorage\(db\)/u);
      assert.match(galleryRouteSource, /input\.promptOverride\?\.trim\(\) \?\? ""/u);
      assert.doesNotMatch(galleryRouteSource, /chat\.mode === "roleplay"[\s\S]{0,400}gameStoryboard/u);
    },
  },
  {
    name: "game video prompt selection wins over global prompt override",
    async run() {
      const promptOverridesStorage = {
        async get(key: string) {
          if (key !== "game.video") return null;
          return {
            key,
            template: "GLOBAL VIDEO OVERRIDE ${sceneTitle}",
            enabled: true,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async list() {
          return [];
        },
        async upsert(input) {
          return {
            key: input.key,
            template: input.template,
            enabled: input.enabled,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async remove() {},
      } satisfies PromptOverridesStorage;

      const prompt = await loadGameVideoPrompt({
        promptOverridesStorage,
        meta: {
          gameVideoPromptTemplateId: "custom-video-motion",
          gameVideoPromptTemplates: [
            {
              id: "custom-video-motion",
              name: "Custom Video Motion",
              description: "Regression template",
              promptTemplate: "CHAT VIDEO ${sceneTitle} ${sourceIllustrationLine}",
            },
          ],
        },
        ctx: {
          sceneTitle: "Arrival",
          narrationSummary: "The party reaches the gate.",
          illustrationPrompt: "A wide gate at sunset.",
          charactersLine: "Mira, Sol",
          settingLine: "sunset city gate",
          artStyleLine: "painterly fantasy",
          durationSeconds: 6,
          aspectRatio: "16:9",
          sourceIllustrationLine: "Use image-123 as the first frame/reference image.",
        },
      });

      assert.equal(prompt, "CHAT VIDEO Arrival Use image-123 as the first frame/reference image.");
      assert.doesNotMatch(prompt, /GLOBAL VIDEO OVERRIDE/);

      const storyboardPrompt = await loadGameVideoPrompt({
        promptOverridesStorage,
        meta: {
          gameVideoPromptTemplateId: "custom-video-motion",
          gameVideoPromptTemplates: [
            {
              id: "custom-video-motion",
              name: "Custom Video Motion",
              description: "Regression template",
              promptTemplate: "CHAT VIDEO ${sceneTitle}",
            },
          ],
        },
        templateId: ANIME_GAME_VIDEO_PROMPT_TEMPLATE_ID,
        ctx: {
          sceneTitle: "Arrival",
          narrationSummary: "The party reaches the gate.",
          illustrationPrompt: "A wide gate at sunset.",
          charactersLine: "Mira, Sol",
          settingLine: "sunset city gate",
          artStyleLine: "painterly fantasy",
          durationSeconds: 6,
          aspectRatio: "16:9",
          sourceIllustrationLine: "Use image-123 as the first frame/reference image.",
        },
      });

      assert.match(storyboardPrompt, /anime shot from the supplied first-frame illustration/);
      assert.match(storyboardPrompt, /Stage severe harm with broadcast-anime restraint/);
      assert.doesNotMatch(storyboardPrompt, /CHAT VIDEO|GLOBAL VIDEO OVERRIDE/);

      const ltxDirectorPassThroughPrompt = await loadGameVideoPrompt({
        promptOverridesStorage,
        meta: {},
        templateId: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
        ctx: {
          sceneTitle: "Arrival action that must stay local",
          narrationSummary: "Mira runs through the gate and raises her sword.",
          illustrationPrompt: "Mira is already running through a storm of sparks.",
          charactersLine: "Mira, Sol",
          settingLine: "sunset city gate, cold rain",
          artStyleLine: "cel-shaded broadcast anime",
          durationSeconds: 6,
          aspectRatio: "16:9",
          sourceIllustrationLine: "Use image-789 as the first frame/reference image.",
        },
      });

      assert.equal(ltxDirectorPassThroughPrompt, "Mira runs through the gate and raises her sword.");
      assert.doesNotMatch(
        ltxDirectorPassThroughPrompt,
        /Sol|sunset|rain|cel-shaded|storm of sparks|Arrival action|image-789|6-second|16:9/,
      );

      const comicReferencePrompt = await loadGameVideoPrompt({
        promptOverridesStorage,
        meta: {},
        templateId: COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
        ctx: {
          sceneTitle: "Rooftop pursuit",
          narrationSummary:
            "[0-2s] Establish the page and first panel. [2-5s] Push into the leap. [5-8s] Follow the landing and hold.",
          illustrationPrompt: "Three-panel comic page in chronological reading order.",
          charactersLine: "Mira",
          settingLine: "rainy rooftop",
          artStyleLine: "colored anime comic",
          durationSeconds: 8,
          aspectRatio: "16:9",
          sourceIllustrationLine: "Use image-456 as the first frame/reference image.",
        },
      });

      assert.match(comicReferencePrompt, /8-second 16:9 animation/);
      assert.match(comicReferencePrompt, /comic or manga page reference/);
      assert.match(comicReferencePrompt, /ordered temporal beats rather than simultaneous subjects/);
      assert.match(comicReferencePrompt, /Do not merge panels, collapse gutters/);
      assert.match(comicReferencePrompt, /Preserve any deliberate comic lettering only while it remains visible/);
      assert.equal(
        GAME_VIDEO_PROMPT_TEMPLATE,
        [
          "Create a ${durationSeconds}-second ${aspectRatio} animated game scene from the provided first-frame illustration.",
          "${sourceIllustrationLine}",
          "Scene: ${sceneTitle}",
          "Story beat: ${narrationSummary}",
          "Characters: ${charactersLine}",
          "Setting: ${settingLine}",
          "Art style: ${artStyleLine}",
          "Reference prompt excerpt: ${illustrationPrompt}",
          "Use the reference image as the visual anchor. Keep recognizable characters, setting, and mood while adding motion that feels natural for this moment.",
          "You may choose the most cinematic camera drift, focus shift, gestures, atmospheric movement, and ending pose that fit the scene.",
          "Avoid subtitles, captions, UI, logos, watermarks, unrelated new characters, distorted anatomy, and abrupt cuts.",
        ].join("\n"),
      );
      assert.equal(
        GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.find(
          (template) => template.id === COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
        )?.promptTemplate,
        COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE,
      );
    },
  },
  {
    name: "game portrait appearance aggregation deduplicates raw values before labels",
    run() {
      const description = "A silver-furred fox-woman in a persimmon kimono.";
      const appearance = resolveNpcPortraitAppearance(
        { description: `  ${description.toUpperCase()}  ` },
        {
          description,
          descriptionSource: "model",
          notes: ["Carries a debt-scroll."],
        } as any,
        {
          appearance: description,
          outfit: "Persimmon kimono",
          mood: "Warm smile",
        },
      );

      assert.equal(appearance.toLowerCase().split(description.toLowerCase()).length - 1, 1);
      assert.match(appearance, /^Canonical NPC profile:/);
      assert.match(appearance, /Current outfit: Persimmon kimono/);
      assert.match(appearance, /Current expression or mood: Warm smile/);
      assert.doesNotMatch(appearance, /debt-scroll|Notable details/);

      const legacyPollutedAppearance = resolveNpcPortraitAppearance(
        { description: null },
        {
          description:
            "A nine-foot Xenomorph with a biomechanical black carapace. Notable details: [helped] reputation +15 → 15 (neutral)",
          descriptionSource: "model",
          notes: [],
        } as any,
        null,
      );
      assert.match(legacyPollutedAppearance, /nine-foot Xenomorph with a biomechanical black carapace/i);
      assert.doesNotMatch(legacyPollutedAppearance, /Notable details|reputation|\[helped\]/i);
      assert.equal(sanitizeNpcPortraitAppearanceText("[helped] reputation +15 → 15 (neutral)"), "");
      assert.equal(sanitizeNpcPortraitAppearanceText("[reputation: 25]"), "");
      assert.equal(sanitizeNpcPortraitAppearanceText("[NPC, reputation: 25]"), "");
      assert.equal(sanitizeNpcPortraitAppearanceText("Notable details: reputation: trusted"), "");
      assert.equal(
        sanitizeNpcPortraitAppearanceText("Black carapace. Reputation: trusted, elongated skull"),
        "Black carapace. elongated skull",
      );
    },
  },
  {
    name: "game portrait prompts preserve one canonical description across compilation paths",
    async run() {
      const appearance = "silver-furred fox-woman, persimmon kimono, debt-scroll tucked in her sleeve";
      const request = {
        chatId: "prompt-regression",
        npcName: "Lyra",
        appearance,
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      };
      const countAppearance = (prompt: string) => prompt.toLowerCase().split(appearance.toLowerCase()).length - 1;

      const unstyled = await buildNpcPortraitProviderPrompt(request);
      assert.equal(countAppearance(unstyled.prompt), 1);

      const zImage = await buildNpcPortraitProviderPrompt({
        ...request,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "z-image-turbo",
      });
      assert.equal(countAppearance(zImage.prompt), 1);
      assert.doesNotMatch(
        zImage.prompt,
        /\b(?:letters|captions|UI|watermarks|logos|speech bubbles|split panels|collage)\b/i,
      );
      assert.match(zImage.negativePrompt, /letters|captions|UI|watermark|logo|collage/i);

      const tagged = await buildNpcPortraitProviderPrompt({
        ...request,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "danbooru",
      });
      assert.equal(countAppearance(tagged.prompt), 1);
      assert.match(tagged.prompt, /silver-furred fox-woman/);

      const dynamicPreserved = await buildNpcPortraitProviderPrompt({
        ...request,
        dynamicPromptGenerator: async () =>
          `Centered portrait of Lyra, ${appearance}, readable expression, single subject.`,
      });
      assert.equal(countAppearance(dynamicPreserved.prompt), 1);

      const providerReadyDynamicPrompt =
        "1girl, elphelt_valentine, guilty_gear, solo, portrait, upper_body, pink_hair, blue_eyes, white_background, masterpiece, best_quality";
      const providerReadyDynamic = await buildNpcPortraitProviderPrompt({
        ...request,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "danbooru",
        dynamicPromptGenerator: async () => providerReadyDynamicPrompt,
      });
      assert.match(providerReadyDynamic.prompt, new RegExp(providerReadyDynamicPrompt));

      const dynamicOmitted = await buildNpcPortraitProviderPrompt({
        ...request,
        dynamicPromptGenerator: async () => "Centered portrait of Lyra with a readable expression and clean lighting.",
      });
      assert.equal(countAppearance(dynamicOmitted.prompt), 0);

      const shortDescription = await buildNpcPortraitProviderPrompt({
        ...request,
        appearance: "man",
        dynamicPromptGenerator: async () =>
          "Centered portrait of a woman with clean lighting and a readable expression.",
      });
      assert.doesNotMatch(shortDescription.prompt, /canonical NPC visual profile|\bman\b/i);

      const narrationDescription = "A rain-soaked courier in a patched green cloak.";
      const narrationAppearance = resolveNpcPortraitAppearance(
        { description: null },
        {
          description: narrationDescription,
          descriptionSource: "narration",
          notes: [],
        } as any,
        null,
      );
      const narrationPrompt = await buildNpcPortraitProviderPrompt({
        ...request,
        appearance: narrationAppearance,
      });
      assert.equal(narrationPrompt.prompt.toLowerCase().split(narrationDescription.toLowerCase()).length - 1, 1);
      assert.doesNotMatch(narrationPrompt.prompt, /Canonical NPC profile:/);

      let xenomorphSourcePrompt = "";
      await buildNpcPortraitProviderPrompt({
        ...request,
        npcName: "Xenomorph Drone",
        appearance: "A nine-foot biomechanical hunter with an elongated skull and black carapace.",
        dynamicPromptGenerator: async (dynamicRequest) => {
          xenomorphSourcePrompt = dynamicRequest.sourcePrompt;
          return "xenomorph, biomechanical black carapace, elongated skull, solo portrait";
        },
      });
      assert.match(xenomorphSourcePrompt, /Appearance: xenomorph/i);
      assert.doesNotMatch(xenomorphSourcePrompt, /human or humanoid person/i);

      await assert.rejects(
        () =>
          buildNpcPortraitProviderPrompt({
            ...request,
            dynamicPromptGenerator: async () => {
              throw new Error("prompt director unavailable");
            },
          }),
        /prompt director unavailable/,
      );
    },
  },
  {
    name: "custom dynamic portrait instructions remain authoritative",
    async run() {
      const override = "Return only a clean comma-separated visual tag list. Never copy prose labels.";
      const promptOverridesStorage = {
        async get(key: string) {
          return key === "game.imagePromptDirector"
            ? { key, template: override, enabled: true, updatedAt: "2026-07-20T00:00:00.000Z" }
            : null;
        },
        async list() {
          return [];
        },
        async upsert(input) {
          return {
            key: input.key,
            template: input.template,
            enabled: input.enabled,
            updatedAt: "2026-07-20T00:00:00.000Z",
          };
        },
        async remove() {},
      } satisfies PromptOverridesStorage;
      const messages = await buildDynamicGameImagePromptMessages({
        promptOverridesStorage,
        illustratorPromptTemplate: "Always include the distinctive tag chromatic_aberration_test.",
        request: {
          kind: "portrait",
          title: "Sentinel",
          sourcePrompt: "One alien sentinel in a bioluminescent hive interior.",
          assetContext: ["NPC name: Sentinel", "Appearance traits: towering alien, long tail, glowing eyes"],
          maxCharacters: 1400,
        },
        meta: {},
        setupConfig: null,
        latestState: null,
        latestTurnNarration: "This must not be added to a portrait prompt.",
      });

      assert.match(messages[0]?.content ?? "", new RegExp(override));
      assert.match(messages[0]?.content ?? "", /chromatic_aberration_test/);
      assert.match(messages[1]?.content ?? "", /Appearance traits: towering alien/);
      assert.doesNotMatch(messages[1]?.content ?? "", /latest_gm_turn|must not be added/i);
      assert.doesNotMatch(messages[1]?.content ?? "", /copy the Required canonical NPC visual profile/i);
      assert.doesNotMatch(messages[1]?.content ?? "", /Return only JSON/i);

      const requestOptions = dynamicGameImagePromptRequestOptions("portrait");
      assert.equal("responseFormat" in requestOptions, false);
      assert.equal(
        shouldUseDynamicGameImagePromptGenerator({
          enabled: false,
          hasCustomizedIllustratorPrompt: true,
          hasEnabledPromptDirectorOverride: false,
        }),
        true,
      );
      assert.equal(
        shouldUseDynamicGameImagePromptGenerator({
          enabled: false,
          hasCustomizedIllustratorPrompt: false,
          hasEnabledPromptDirectorOverride: true,
        }),
        true,
      );
      assert.equal(
        shouldUseDynamicGameImagePromptGenerator({
          enabled: false,
          hasCustomizedIllustratorPrompt: false,
          hasEnabledPromptDirectorOverride: false,
        }),
        false,
      );
    },
  },
  {
    name: "dynamic Game backgrounds use the latest completed GM turn as primary scene context",
    async run() {
      const latestTurnNarration = selectLatestGameTurnNarration([
        { role: "user", content: "I open the station doors." },
        { role: "assistant", content: "An older scene in a dry mountain pass." },
        {
          role: "assistant",
          content:
            "[bg: storm-station] Rain lashes the glass-roofed station while blue signal lamps flicker over the abandoned platforms.",
        },
        { role: "assistant", content: "[party-turn] Lyra shields her face from the rain." },
        { role: "narrator", content: "**Session 4 Concluded**\nThe next arc is ready." },
        { role: "system", content: "Internal state update after the visible turn." },
      ]);
      assert.equal(
        latestTurnNarration,
        "Rain lashes the glass-roofed station while blue signal lamps flicker over the abandoned platforms.",
      );

      const messages = await buildDynamicGameImagePromptMessages({
        request: {
          kind: "background",
          title: "storm-station",
          sourcePrompt: "scenery, station, wide shot",
          assetContext: ["Location slug: storm-station"],
          maxCharacters: 1000,
        },
        meta: {},
        setupConfig: null,
        latestState: null,
        latestTurnNarration,
      });
      const userPrompt = messages[1]?.content ?? "";
      assert.match(userPrompt, /<latest_gm_turn>/);
      assert.match(userPrompt, /glass-roofed station/);
      assert.doesNotMatch(userPrompt, /\[bg:/);
      assert.match(userPrompt, /latest GM turn as the primary source/i);
      assert.ok(userPrompt.indexOf("<latest_gm_turn>") < userPrompt.indexOf("<draft_prompt>"));

      const override = [
        "Direct the current background from this completed turn:",
        "${latestTurnBlock}",
        "Keep the result under ${maxCharacters} characters.",
      ].join("\n");
      const promptOverridesStorage = {
        async get(key: string) {
          return key === "game.imagePromptDirector"
            ? { key, template: override, enabled: true, updatedAt: "2026-07-30T00:00:00.000Z" }
            : null;
        },
        async list() {
          return [];
        },
        async upsert(input) {
          return {
            key: input.key,
            template: input.template,
            enabled: input.enabled,
            updatedAt: "2026-07-30T00:00:00.000Z",
          };
        },
        async remove() {},
      } satisfies PromptOverridesStorage;
      const overriddenMessages = await buildDynamicGameImagePromptMessages({
        promptOverridesStorage,
        request: {
          kind: "background",
          title: "storm-station",
          sourcePrompt: "scenery, station, wide shot",
          assetContext: ["Location slug: storm-station"],
          maxCharacters: 1000,
        },
        meta: {},
        setupConfig: null,
        latestState: null,
        latestTurnNarration,
      });
      const overriddenSystemPrompt = overriddenMessages[0]?.content ?? "";
      assert.match(overriddenSystemPrompt, /<latest_gm_turn>/);
      assert.match(overriddenSystemPrompt, /glass-roofed station/);
      assert.doesNotMatch(overriddenSystemPrompt, /\$\{latestTurnBlock\}/);
    },
  },
  {
    name: "dynamic image prompts fall back to the default agent text connection",
    async run() {
      const defaultAgentConnection = {
        id: "agent-default",
        provider: "openai",
        model: "prompt-model",
        baseUrl: "https://example.invalid/v1",
        apiKey: "test-key",
      };
      const connections = {
        async listRandomPool() {
          return [];
        },
        async getWithKey(id: string) {
          return id === defaultAgentConnection.id ? defaultAgentConnection : null;
        },
        async getDefaultForAgents() {
          return defaultAgentConnection;
        },
      } as unknown as Parameters<typeof resolveDynamicGameImagePromptConnection>[0]["connections"];
      const resolved = await resolveDynamicGameImagePromptConnection({
        connections,
        meta: { gameSceneConnectionId: "deleted-scene-connection" },
        setupConfig: null,
        chatConnectionId: null,
      });

      assert.equal(resolved.conn.id, defaultAgentConnection.id);
    },
  },
  {
    name: "provider-ready image prompts preserve every long visual detail across profiles and kinds (#8396)",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const longClause =
        "Her asymmetrical moonstone cuff bears a labyrinthine lattice of tiny enamel tessellations interleaved with alternating hammered copper filigree and a distinctly notched oval clasp";
      const details = [
        longClause,
        ...Array.from({ length: 90 }, (_, index) => `embroidered collar motif ${index}`),
        "(opal cuff, copper filigree:1.2)",
        "a tiny carnelian bead suspended from the final woven tassel",
      ];
      for (const profile of styleProfiles.profiles) {
        for (const kind of ["portrait", "sprite", "illustration", "background", "selfie"] as const) {
          const compiled = compileImagePrompt({
            kind,
            prompt: details.join(", "),
            styleProfiles,
            styleProfileId: profile.id,
          });
          for (const detail of details) {
            assert.ok(compiled.prompt.includes(detail), `${profile.id}/${kind} lost visual detail: ${detail}`);
          }
        }
        const avatar = compileImagePrompt({
          kind: "avatar",
          prompt: "",
          userPositive: details.join(", "),
          styleProfiles,
          styleProfileId: profile.id,
        });
        for (const detail of details)
          assert.ok(avatar.prompt.includes(detail), `${profile.id}/avatar lost appearance: ${detail}`);
      }
    },
  },
  {
    name: "explicit legacy tag conversion has no global token budget or priority reorder (#8396)",
    run() {
      const details = ["scar on cheek", ...Array.from({ length: 90 }, (_, index) => `forest detail ${index}`)];
      const compiled = compileImagePrompt({
        kind: "portrait",
        prompt: details.join(", "),
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "anime",
        applyPromptModeToSourcePrompt: true,
      });
      let previous = -1;
      for (const detail of details) {
        const at = compiled.prompt.indexOf(detail);
        assert.ok(at > previous, `explicit tag conversion lost or reordered ${detail}`);
        previous = at;
      }
    },
  },
  {
    name: "long configured image style text survives normalization and compilation (#8396)",
    run() {
      const styleText = `${"velvet brushwork ".repeat(160)}complete style finish`;
      const positiveTags = `${"engraved linen seam ".repeat(250)}complete positive finish`;
      const negativeTags = `${"distorted woven stitches ".repeat(200)}complete negative finish`;
      const subjectTags = `${"handwoven composition detail ".repeat(80)}complete composition finish`;
      const raw = {
        defaultProfileId: "complete-style",
        profiles: [
          {
            id: "complete-style",
            name: "Complete style",
            baseStyle: "custom",
            promptMode: "natural",
            styleText,
            positiveTags,
            negativeTags,
            subjectTags: { illustration: subjectTags },
          },
        ],
      };
      const normalized = normalizeImageStyleProfileSettings(raw);
      const roundtrip = normalizeImageStyleProfileSettings(JSON.parse(JSON.stringify(normalized)));
      const profile = roundtrip.profiles.find((entry) => entry.id === "complete-style")!;
      assert.equal(profile.styleText, styleText);
      assert.equal(profile.positiveTags, positiveTags);
      assert.equal(profile.negativeTags, negativeTags);
      assert.equal(profile.subjectTags.illustration, subjectTags);
      const compiled = compileImagePrompt({
        kind: "illustration",
        prompt: "A crafted textile.",
        styleProfiles: roundtrip,
      });
      for (const text of [styleText, positiveTags, subjectTags]) assert.ok(compiled.prompt.includes(text));
      assert.ok(compiled.negativePrompt.includes(negativeTags));
    },
  },
  {
    name: "image prompt compilation suppresses exact provider-visible duplicate inputs",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const generatedStyle = "Watercolor fantasy illustration, soft edges, warm palette";
      const appearance = "silver-furred fox-woman, persimmon kimono, debt-scroll tucked in her sleeve";
      const countValue = (prompt: string, value: string) => prompt.toLowerCase().split(value.toLowerCase()).length - 1;

      for (const profile of styleProfiles.profiles) {
        for (const kind of ["portrait", "background", "illustration"] as const) {
          const compiled = compileImagePrompt({
            kind,
            prompt: `Art style: ${generatedStyle}. A moonlit graveyard scene with one clear subject.`,
            styleProfiles,
            styleProfileId: profile.id,
            generatedStyle,
            applyPromptModeToSourcePrompt: kind !== "portrait",
          });

          assert.equal(
            countValue(compiled.prompt, generatedStyle),
            1,
            `${profile.id}/${kind} repeated the generated style: ${compiled.prompt}`,
          );
        }

        const sprite = compileImagePrompt({
          kind: "sprite",
          prompt: `Single full-body character sprite, ${appearance}, idle pose.`,
          userPositive: appearance,
          styleProfiles,
          styleProfileId: profile.id,
        });
        assert.equal(
          countValue(sprite.prompt, appearance),
          1,
          `${profile.id}/sprite repeated the supplied appearance: ${sprite.prompt}`,
        );
        assert.match(sprite.prompt, /silver-furred/i);
        assert.match(sprite.prompt, /persimmon kimono/i);
        assert.match(sprite.prompt, /debt-scroll/i);
        if (profile.id === "anime") {
          const compactAppearance = "natural expression";
          const compactBudgetPrompt = [
            ...Array.from({ length: 40 }, (_, index) => `forest detail ${index}`),
            compactAppearance,
          ].join(", ");
          const compactSprite = compileImagePrompt({
            kind: "sprite",
            prompt: compactBudgetPrompt,
            userPositive: compactAppearance,
            styleProfiles,
            styleProfileId: profile.id,
          });
          assert.equal(
            countValue(compactSprite.prompt, compactAppearance),
            1,
            `compact sprite lost the supplied appearance: ${compactSprite.prompt}`,
          );
        }

        const preservedPrompt = `Art direction: ${generatedStyle}. Lyra raises a lantern in the graveyard.`;
        const preservedPrefix = compileImagePrompt({
          kind: "illustration",
          prompt: "",
          dedupeAgainstPrompt: preservedPrompt,
          styleProfiles,
          styleProfileId: profile.id,
          generatedStyle,
        });
        const preservedProviderPrompt = [preservedPrefix.prompt, preservedPrompt].filter(Boolean).join(", ");
        assert.equal(
          countValue(preservedProviderPrompt, generatedStyle),
          1,
          `${profile.id}/preserved illustration repeated the generated style: ${preservedProviderPrompt}`,
        );
        assert.ok(preservedPrefix.diagnostics.removedPositiveDuplicates.includes(generatedStyle));
      }

      const zImageStyleAlreadyPresent = compileImagePrompt({
        kind: "portrait",
        prompt: `Art style: ${generatedStyle}. Centered portrait of Lyra.`,
        styleProfiles,
        styleProfileId: "z-image-turbo",
        generatedStyle,
      });
      assert.equal(countValue(zImageStyleAlreadyPresent.prompt, generatedStyle), 1);
      assert.doesNotMatch(zImageStyleAlreadyPresent.prompt, /Z-Image Turbo prompt that keeps compact narrative/);

      const zImageStyleMissing = compileImagePrompt({
        kind: "portrait",
        prompt: "Centered portrait of Lyra.",
        styleProfiles,
        styleProfileId: "z-image-turbo",
        generatedStyle,
      });
      assert.equal(countValue(zImageStyleMissing.prompt, generatedStyle), 1);

      const zImageStyleOnlyNegated = compileImagePrompt({
        kind: "portrait",
        prompt: `Avoid ${generatedStyle}. Centered portrait of Lyra.`,
        styleProfiles,
        styleProfileId: "z-image-turbo",
        generatedStyle,
      });
      assert.equal(countValue(zImageStyleOnlyNegated.prompt, generatedStyle), 1);
      assert.equal(zImageStyleOnlyNegated.diagnostics.removedPositiveDuplicates.includes(generatedStyle), false);

      const zImageAppearanceMissing = compileImagePrompt({
        kind: "sprite",
        prompt: "Single full-body character sprite in an idle pose.",
        userPositive: appearance,
        styleProfiles,
        styleProfileId: "z-image-turbo",
      });
      assert.equal(countValue(zImageAppearanceMissing.prompt, appearance), 1);

      const avatarAppearance = [
        "silver-furred fox-woman with a braided crown and mismatched amber and teal eyes",
        "persimmon kimono with embroidered moonflowers and a debt-scroll tucked into her sleeve",
        "quietly amused expression with a small scar through the left eyebrow",
      ].join(", ");
      const avatar = compileImagePrompt({
        kind: "avatar",
        prompt: "Create a polished character avatar portrait.",
        userPositive: avatarAppearance,
        styleProfiles,
        styleProfileId: "anime",
      });
      assert.match(avatar.prompt, /braided crown/);
      assert.match(avatar.prompt, /embroidered moonflowers/);
      assert.match(avatar.prompt, /scar through the left eyebrow/);

      const compactBudgetPrompt = [
        ...Array.from({ length: 40 }, (_, index) => `blue eyes detail ${index}`),
        `Art style: ornate rococo oil painting`,
      ].join(", ");
      for (const profileId of ["anime", "danbooru", "realistic", "painterly"] as const) {
        const compact = compileImagePrompt({
          kind: "portrait",
          prompt: compactBudgetPrompt,
          styleProfiles,
          styleProfileId: profileId,
          generatedStyle: "ornate rococo oil painting",
        });
        assert.equal(
          countValue(compact.prompt, "ornate rococo oil painting"),
          1,
          `${profileId} compact prompt lost the configured style: ${compact.prompt}`,
        );
      }

      const semicolonNegation = compileImagePrompt({
        kind: "portrait",
        prompt: "Centered portrait; avoid ornate rococo oil painting",
        styleProfiles,
        styleProfileId: "danbooru",
        generatedStyle: "ornate rococo oil painting",
      });
      assert.equal(countValue(semicolonNegation.prompt, "ornate rococo oil painting"), 1);
      assert.match(semicolonNegation.negativePrompt, /ornate rococo oil painting/i);

      const embeddedNegation = compileImagePrompt({
        kind: "portrait",
        prompt: "Centered portrait, avoid ornate rococo oil painting, blue eyes",
        styleProfiles,
        styleProfileId: "anime",
        generatedStyle: "ornate rococo oil painting",
      });
      assert.equal(countValue(embeddedNegation.prompt, "ornate rococo oil painting"), 1);
      assert.match(embeddedNegation.negativePrompt, /ornate rococo oil painting/i);
    },
  },
  {
    name: "deprecated image-style rule flags remain provider-visible no-ops",
    run() {
      const settings = createDefaultImageStyleProfileSettings();
      const profile = settings.profiles.find((entry) => entry.id === "anime")!;
      const compile = (preferTagsOverNarrative: boolean, preserveUserPhrases: boolean) => {
        const result = compileImagePrompt({
          kind: "portrait",
          prompt: "A silver-haired scholar holding a glass vial in a moonlit laboratory.",
          negativePrompt: "blurry, text",
          styleProfiles: {
            ...settings,
            profiles: [
              ...settings.profiles.filter((entry) => entry.id !== profile.id),
              {
                ...profile,
                rules: { ...profile.rules, preferTagsOverNarrative, preserveUserPhrases },
              },
            ],
          },
          styleProfileId: profile.id,
        });
        return {
          prompt: result.prompt,
          negativePrompt: result.negativePrompt,
          diagnostics: result.diagnostics,
        };
      };
      const baseline = compile(false, false);
      assert.deepEqual(compile(false, true), baseline);
      assert.deepEqual(compile(true, false), baseline);
      assert.deepEqual(compile(true, true), baseline);
    },
  },
  {
    name: "reviewed map backgrounds preserve location detail with Engine campaign styling",
    async run() {
      const sceneDetail =
        "Wide establishing image of Sunken Observatory. Ancient brass instruments rise above a flooded stone chamber.";
      const compiled = await buildBackgroundProviderPrompt({
        chatId: "map-artwork-preview-regression",
        locationSlug: "Sunken Observatory",
        sceneDescription: sceneDetail,
        genre: "Anime JRPG dungeon crawler",
        setting: "A gothic guild city above luminous crystal dungeons",
        worldOverview: "Adult adventurers explore dangerous ruins beneath the city.",
        artStyle: "cinematic violet-gold anime illustration",
        imagePromptInstructions: "Use ornate brass machinery and deep blue reflections.",
        preserveFullBackgroundPrompt: true,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "auto",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });

      assert.match(compiled.prompt, /Sunken Observatory/);
      assert.match(compiled.prompt, /Ancient brass instruments rise above a flooded stone chamber/);
      assert.match(compiled.prompt, /cinematic violet-gold anime illustration/);
      assert.match(compiled.prompt, /Use ornate brass machinery and deep blue reflections/);
      assert.match(compiled.negativePrompt, /watermark/);
    },
  },
  {
    name: "automatic map artwork uses the global Maps template and keeps positive prose out of negatives",
    async run() {
      const campaignStyle = "luminous violet campaign brushwork";
      const scenePrompt =
        "Wide establishing image of Moonwell Floor. A quiet tiled bath beneath blue crystals. No text.";
      const defaultRawPrompt = MAPS_LOCATION_ARTWORK.defaultBuilder({
        locationName: "Moonwell Floor",
        locationDescription: "A quiet tiled bath beneath blue crystals.",
        locationType: "Floor",
        parentLocationName: "Ascendant Spire",
        parentLocationDescription: "A colossal shifting dungeon tower.",
        locationPath: "Asterreach > Ascendant Spire > Moonwell Floor",
        locationPrompt: scenePrompt,
        genre: "Fantasy dungeon crawler",
        genreLine: "Fantasy dungeon crawler.",
        campaignArtStyle: campaignStyle,
        campaignArtStyleLine: `Campaign art style: ${campaignStyle}.`,
        imageInstructions: "Use blue crystal reflections.",
        imageInstructionsLine: "User image instructions: Use blue crystal reflections.",
      });
      assert.equal(
        defaultRawPrompt,
        `${scenePrompt} Fantasy dungeon crawler. Campaign art style: ${campaignStyle}. User image instructions: Use blue crystal reflections.`,
      );
      assert.doesNotMatch(
        defaultRawPrompt,
        /SD\/Illustrious|background-only location art|game background art|high quality|anime style/iu,
        "The Maps default must not impose provider, style, quality, or composition tags",
      );
      const compile = (useCampaignArtStyle: boolean) =>
        buildBackgroundProviderPrompt({
          chatId: "map-artwork-campaign-toggle-regression",
          locationSlug: "Moonwell Floor",
          sceneDescription: scenePrompt,
          mapsArtworkContext: {
            locationName: "Moonwell Floor",
            locationDescription: "A quiet tiled bath beneath blue crystals.",
            locationType: "Floor",
            parentLocationName: "Ascendant Spire",
            parentLocationDescription: "A colossal shifting dungeon tower.",
            locationPath: "Asterreach > Ascendant Spire > Moonwell Floor",
            genre: "Fantasy dungeon crawler",
            campaignArtStyle: resolveGameSetupArtStylePrompt({
              artStylePrompt: campaignStyle,
              useCampaignArtStyle,
            }),
            imageInstructions: "Use blue crystal reflections.",
          },
          preserveFullBackgroundPrompt: true,
          styleProfiles: createDefaultImageStyleProfileSettings(),
          styleProfileId: "auto",
          imgModel: "unused",
          imgBaseUrl: "",
          imgApiKey: "",
        });

      const withoutCampaignStyle = await compile(false);
      const withCampaignStyle = await compile(true);
      assert.doesNotMatch(withoutCampaignStyle.prompt, /luminous violet campaign brushwork/u);
      assert.match(withCampaignStyle.prompt, /luminous violet campaign brushwork/u);
      assert.match(withCampaignStyle.prompt, /Fantasy dungeon crawler/u);
      assert.match(withCampaignStyle.prompt, /Use blue crystal reflections/u);
      assert.doesNotMatch(withoutCampaignStyle.negativePrompt, /Style:|Fantasy dungeon crawler|quiet tiled bath/u);
      assert.doesNotMatch(
        withCampaignStyle.negativePrompt,
        /Style:|luminous violet campaign brushwork|quiet tiled bath/u,
      );

      const promptOverridesStorage = {
        get: async (key: string) =>
          key === "maps.locationArtwork"
            ? {
                key,
                template: "${locationName}. ${locationDescription} Location type: ${locationType}.",
                enabled: true,
                updatedAt: "2026-07-26T00:00:00.000Z",
              }
            : null,
        list: async () => [],
        upsert: async () => {
          throw new Error("Unexpected prompt override write");
        },
        remove: async () => {
          throw new Error("Unexpected prompt override removal");
        },
      } as unknown as PromptOverridesStorage;
      const customized = await buildBackgroundProviderPrompt({
        chatId: "map-artwork-global-template-regression",
        locationSlug: "Moonwell Floor",
        sceneDescription: scenePrompt,
        mapsArtworkContext: {
          locationName: "Moonwell Floor",
          locationDescription: "A quiet tiled bath beneath blue crystals.",
          locationType: "Floor",
          parentLocationName: "Ascendant Spire",
          parentLocationDescription: "A colossal shifting dungeon tower.",
          locationPath: "Asterreach > Ascendant Spire > Moonwell Floor",
          genre: "Fantasy dungeon crawler",
          campaignArtStyle: campaignStyle,
          imageInstructions: "Use blue crystal reflections.",
        },
        promptOverridesStorage,
        preserveFullBackgroundPrompt: true,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "auto",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.match(customized.prompt, /Moonwell Floor/u);
      assert.match(customized.prompt, /Location type: Floor/u);
      assert.doesNotMatch(
        customized.prompt,
        /Fantasy dungeon crawler|luminous violet campaign brushwork|blue crystal reflections/u,
      );

      const reviewed = resolveReviewedImagePromptSubmission({
        generatedPrompt: withCampaignStyle.prompt,
        generatedNegativePrompt: withCampaignStyle.negativePrompt,
        promptOverride: "exact edited positive",
        negativePromptOverride: "exact edited negative",
      });
      assert.deepEqual(reviewed, {
        prompt: "exact edited positive",
        negativePrompt: "exact edited negative",
      });

      const galleryRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/gallery.routes.ts", import.meta.url),
        "utf8",
      );
      const compilerStart = galleryRouteSource.indexOf("async function compileGalleryImageRequest");
      const compilerEnd = galleryRouteSource.indexOf("async function collectChatAssetParticipants", compilerStart);
      const compilerSource = galleryRouteSource.slice(compilerStart, compilerEnd);
      assert.match(compilerSource, /mapsArtworkContext:/);
      assert.match(compilerSource, /genre: context\.genre/);
      assert.match(compilerSource, /campaignArtStyle: context\.artStyle/);
      assert.doesNotMatch(compilerSource, /setting: context\.setting|worldOverview: context\.worldOverview/);
      assert.match(compilerSource, /resolveReviewedImagePromptSubmission/);
      assert.match(compilerSource, /promptOverride: input\.promptOverride/);
      assert.match(compilerSource, /negativePromptOverride: input\.negativePromptOverride/);
      assert.equal(listPromptOverrideKeys().includes("maps.locationArtwork"), true);
    },
  },
  {
    name: "manual game illustrations preserve detailed natural-language scene prompts",
    async run() {
      const sceneDetail =
        "2B balances an open leather-bound book in one hand while violet light reflects across the rain-dark guild hall windows.";
      const compiled = await buildSceneIllustrationProviderPrompt({
        chatId: "manual-game-illustration-regression",
        title: "Manual scene illustration",
        prompt: sceneDetail,
        reason: "Manual Gallery Illustrate request",
        characters: ["2B"],
        artStyle: "anime illustration",
        referenceImages: ["location-reference"],
        locationReferenceImageAttached: true,
        preserveFullScenePrompt: true,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "anime",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });

      assert.ok(compiled.prompt.includes(sceneDetail), compiled.prompt);
      assert.match(
        compiled.prompt,
        /Location handling: an attached location reference image is available\. Use it to set the scene location\./,
      );
      assert.doesNotMatch(compiled.prompt, /Reference handling: attached character reference images/);

      const withCharacterReference = await buildSceneIllustrationProviderPrompt({
        chatId: "manual-game-illustration-character-reference-regression",
        prompt: sceneDetail,
        referenceImages: ["location-reference", "character-reference"],
        locationReferenceImageAttached: true,
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.match(withCharacterReference.prompt, /Location handling: an attached location reference image/);
      assert.match(withCharacterReference.prompt, /Reference handling: attached character reference images/);
    },
  },
  {
    name: "preserved storyboard prompts retain complete scenes and one configured style",
    async run() {
      const generatedStyle = "ornate rococo oil painting";
      const longScene = `${"moonlit forest atmosphere ".repeat(300)} Art direction: ${generatedStyle}.`;
      const compiled = await buildSceneIllustrationProviderPrompt({
        chatId: "style-truncation-regression",
        prompt: "A moonlit forest scene.",
        artStyle: generatedStyle,
        preserveFullScenePrompt: true,
        dynamicPromptGenerator: async () => longScene,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "z-image-turbo",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });

      assert.ok(compiled.prompt.includes(longScene));
      assert.equal(compiled.prompt.toLowerCase().split(generatedStyle).length - 1, 1);

      const styleLeadingScene = `Art direction: ${generatedStyle}. ${"moonlit forest atmosphere ".repeat(280)}`;
      const styleLeading = await buildSceneIllustrationProviderPrompt({
        chatId: "style-deduplication-regression",
        prompt: "A moonlit forest scene.",
        artStyle: generatedStyle,
        preserveFullScenePrompt: true,
        dynamicPromptGenerator: async () => styleLeadingScene,
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "z-image-turbo",
        imgModel: "unused",
        imgBaseUrl: "",
        imgApiKey: "",
      });
      assert.ok(styleLeading.prompt.includes(styleLeadingScene.trim()));
      assert.equal(styleLeading.prompt.toLowerCase().split(generatedStyle).length - 1, 1);
    },
  },
  {
    name: "danbooru illustration prompts preserve generated tags",
    run() {
      const compiled = compileImagePrompt({
        kind: "illustration",
        prompt: [
          "military-straight posture",
          "coiled whip-blade at hip",
          "slight smirk",
          "brass alchemy mask",
          "violet laboratory haze",
          "red rim light",
          "silver surgical gloves",
          "black marble floor reflection",
          "torn manifesto pages",
          "overhead cathedral machinery",
        ].join(", "),
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "danbooru",
      });

      assert.match(compiled.prompt, /military-straight posture/);
      assert.match(compiled.prompt, /coiled whip-blade at hip/);
      assert.match(compiled.prompt, /overhead cathedral machinery/);
    },
  },
  {
    name: "danbooru illustration prompts keep grouped weighted tags intact",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const compiled = compileImagePrompt({
        kind: "illustration",
        prompt: [
          "masterpiece",
          "1boy",
          "solo",
          "(shaved head, bald:1.2)",
          "(grey beard, short beard, stubble:1.3)",
          "blue eyes",
          "no (bad hands, extra fingers:1.2)",
          "standing",
        ].join(", "),
        styleProfiles,
        styleProfileId: "danbooru",
      });

      assert.match(compiled.prompt, /\(shaved head, bald:1\.2\)/);
      assert.match(compiled.prompt, /\(grey beard, short beard, stubble:1\.3\)/);
      assert.match(compiled.prompt, /\bstanding\b/);
      assert.match(compiled.negativePrompt, /\(bad hands, extra fingers:1\.2\)/);
      assert.doesNotMatch(compiled.prompt, /\(bad hands, extra fingers:1\.2\)/);

      const taggedAppearance = compileImagePrompt({
        kind: "portrait",
        prompt: "Equipment: (sword and shield), cloak",
        styleProfiles,
        styleProfileId: "danbooru",
      });

      assert.match(taggedAppearance.prompt, /\(sword and shield\)/);
      assert.match(taggedAppearance.prompt, /\bcloak\b/);
    },
  },
  {
    name: "preserved image prompts keep positive sentences after inline negation (#8396)",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      for (const profile of styleProfiles.profiles) {
        for (const kind of ["portrait", "sprite", "illustration", "background", "selfie"] as const) {
          for (const prompt of [
            "Blue eyes, no hat. Red coat",
            "Blue eyes, no hat. No shoes. Red coat",
            "Portrait of Yunyun.\nAppearance: Blue eyes, no hat. Red coat\nOutfit: Gold armor",
          ]) {
            const compiled = compileImagePrompt({ kind, prompt, styleProfiles, styleProfileId: profile.id });
            assert.match(compiled.prompt, /Blue eyes/, `${profile.id}/${kind} lost the preceding positive clause`);
            assert.match(compiled.prompt, /Red coat/, `${profile.id}/${kind} lost the trailing positive sentence`);
            assert.match(compiled.negativePrompt, /\bhat\b/);
            assert.doesNotMatch(compiled.negativePrompt, /Blue eyes|Red coat|Gold armor/);
            assert.doesNotMatch(compiled.prompt, /\bno hat\b/);
            if (prompt.includes("Gold armor")) assert.match(compiled.prompt, /Gold armor/);
          }
          const grouped = compileImagePrompt({
            kind,
            prompt:
              'Blue eyes, no (bad hands, extra fingers:1.2). Red coat, a sign says "no hat. Blue coat", (red coat. blue hem:1.2)',
            styleProfiles,
            styleProfileId: profile.id,
          });
          assert.match(grouped.negativePrompt, /\(bad hands, extra fingers:1\.2\)/);
          assert.match(grouped.prompt, /Red coat/);
          assert.ok(grouped.prompt.includes('"no hat. Blue coat"'));
          assert.ok(grouped.prompt.includes("(red coat. blue hem:1.2)"));
          assert.doesNotMatch(grouped.negativePrompt, /Red coat|Blue coat|blue hem/);
          const quotedNegative = compileImagePrompt({
            kind,
            prompt: 'Blue eyes, no ("bad. hands", extra fingers:1.2). Red coat',
            styleProfiles,
            styleProfileId: profile.id,
          });
          assert.ok(quotedNegative.negativePrompt.includes('("bad. hands", extra fingers:1.2)'));
          assert.match(quotedNegative.prompt, /Red coat/);
          assert.doesNotMatch(quotedNegative.negativePrompt, /Red coat/);
          for (const title of ["Dr.", "Prof.", "Mr.", "Mrs.", "Ms.", "Sr.", "Jr.", "St.", "Mt."]) {
            for (const lead of ["", "Blue eyes, "]) {
              const titled = compileImagePrompt({
                kind,
                prompt: `${lead}Avoid ${title} Smith's glasses. Red coat`,
                styleProfiles,
                styleProfileId: profile.id,
              });
              assert.ok(titled.negativePrompt.includes(`${title} Smith's glasses`));
              assert.doesNotMatch(titled.prompt, /Smith's glasses/);
              assert.match(titled.prompt, /Red coat/);
            }
          }
        }
      }
    },
  },
  {
    name: "image prompt negation only moves the directly negated comma clause",
    run() {
      const styleProfiles = createDefaultImageStyleProfileSettings();
      const natural = compileImagePrompt({
        kind: "selfie",
        prompt: "A woman, no makeup, holding flowers, smiling",
        styleProfiles,
        styleProfileId: "realistic",
      });

      assert.match(natural.negativePrompt, /\bmakeup\b/);
      assert.doesNotMatch(natural.negativePrompt, /holding flowers|smiling/);
      assert.match(natural.prompt, /holding flowers/);
      assert.match(natural.prompt, /smiling/);

      const inlineAvoid = compileImagePrompt({
        kind: "selfie",
        prompt: "A woman, avoid makeup, holding flowers, smiling",
        styleProfiles,
        styleProfileId: "realistic",
      });

      assert.match(inlineAvoid.negativePrompt, /\bmakeup\b/);
      assert.doesNotMatch(inlineAvoid.negativePrompt, /holding flowers|smiling/);
      assert.match(inlineAvoid.prompt, /holding flowers/);
      assert.match(inlineAvoid.prompt, /smiling/);

      for (const instruction of ["exclude makeup", "do not include makeup", "don't include makeup"]) {
        const inlineNegativeInstruction = compileImagePrompt({
          kind: "selfie",
          prompt: `A woman, ${instruction}, holding flowers, smiling`,
          styleProfiles,
          styleProfileId: "realistic",
        });

        assert.match(inlineNegativeInstruction.negativePrompt, /\bmakeup\b/);
        assert.doesNotMatch(inlineNegativeInstruction.negativePrompt, /holding flowers|smiling/);
        assert.match(inlineNegativeInstruction.prompt, /holding flowers/);
        assert.match(inlineNegativeInstruction.prompt, /smiling/);
      }

      const standaloneAvoid = compileImagePrompt({
        kind: "portrait",
        prompt:
          "Avoid text, letters, captions, UI, watermarks, logos, speech bubbles, split panels, collage, contact sheet, multiple portraits, duplicated faces, and four-image grids.",
        styleProfiles,
        styleProfileId: "z-image-turbo",
      });

      for (const artifact of [
        "text",
        "letters",
        "captions",
        "UI",
        "watermarks",
        "logos",
        "speech bubbles",
        "split panels",
        "collage",
        "contact sheet",
        "multiple portraits",
        "duplicated faces",
        "four-image grids",
      ]) {
        assert.doesNotMatch(standaloneAvoid.prompt, new RegExp(`\\b${artifact}\\b`, "i"));
        assert.ok(
          standaloneAvoid.diagnostics.movedNegativeFragments.some((fragment) =>
            new RegExp(`^avoid ${artifact}$`, "i").test(fragment),
          ),
          `${artifact} was not routed to the negative path`,
        );
      }
      assert.match(standaloneAvoid.negativePrompt, /text|UI|watermarks|logos|collage/i);

      const standaloneAvoidWithFollowingSentence = compileImagePrompt({
        kind: "portrait",
        prompt: "Avoid text, captions, watermarks. A woman with auburn hair and green eyes.",
        styleProfiles,
        styleProfileId: "z-image-turbo",
      });

      assert.match(standaloneAvoidWithFollowingSentence.negativePrompt, /text|captions|watermarks/i);
      assert.match(standaloneAvoidWithFollowingSentence.prompt, /auburn hair|green eyes/i);
      assert.doesNotMatch(standaloneAvoidWithFollowingSentence.prompt, /avoid text|captions|watermarks/i);

      const groupedNatural = compileImagePrompt({
        kind: "selfie",
        prompt: 'A cafe sign says "no shoes, no service", no (bad hands, extra fingers:1.2), holding flowers',
        styleProfiles,
        styleProfileId: "realistic",
      });

      assert.match(groupedNatural.prompt, /no shoes, no service/);
      assert.match(groupedNatural.prompt, /holding flowers/);
      assert.match(groupedNatural.negativePrompt, /\(bad hands, extra fingers:1\.2\)/);
      assert.doesNotMatch(groupedNatural.negativePrompt, /no shoes|no service|holding flowers/);

      const tagged = compileImagePrompt({
        kind: "portrait",
        prompt: "no glasses, red hair",
        styleProfiles,
        styleProfileId: "danbooru",
      });

      assert.match(tagged.negativePrompt, /\bglasses\b/);
      assert.doesNotMatch(tagged.negativePrompt, /red hair/);
      assert.match(tagged.prompt, /red hair/);
    },
  },
  {
    name: "Game portrait lookup reuses only unambiguous character-library avatars",
    async run() {
      const avatars = new Map<string, string>();
      addNameLookupEntry(avatars, "Dottore", "/api/avatars/file/dottore.png");
      assert.equal(findCharAvatarFuzzy("Il Dottore", avatars), "/api/avatars/file/dottore.png");
      assert.equal(findCharAvatarFuzzy("Dottore", avatars), "/api/avatars/file/dottore.png");

      addNameLookupEntry(avatars, "John Smith", "/api/avatars/file/john-smith.png");
      addNameLookupEntry(avatars, "John Doe", "/api/avatars/file/john-doe.png");
      assert.equal(
        findCharAvatarFuzzy("John", avatars),
        undefined,
        "ambiguous aliases must not select by insertion order",
      );
      assert.equal(findCharAvatarFuzzy("John Smith", avatars), "/api/avatars/file/john-smith.png");

      const boundaryAvatars = new Map<string, string>();
      addNameLookupEntry(boundaryAvatars, "Ann", "/api/avatars/file/ann.png");
      assert.equal(
        findCharAvatarFuzzy("Joanne", boundaryAvatars),
        undefined,
        "partial matches require word boundaries",
      );

      let warned = false;
      let updateByMessageCalled = false;
      const unavailableLibrary = await loadCharacterLibraryAvatarLookup(
        async () => {
          throw new Error("library unavailable");
        },
        () => {
          warned = true;
        },
      );
      const gameStateStore = {
        async updateByMessage() {
          updateByMessageCalled = true;
        },
      };
      await gameStateStore.updateByMessage();
      assert.equal(unavailableLibrary.size, 0);
      assert.equal(warned, true);
      assert.equal(
        updateByMessageCalled,
        true,
        "optional avatar enrichment failures must not block tracker persistence",
      );
    },
  },
  {
    name: "off image style profile leaves positive prompt untouched",
    run() {
      const compiled = compileImagePrompt({
        kind: "illustration",
        prompt: "1girl, blue dress",
        styleProfiles: createDefaultImageStyleProfileSettings(),
        styleProfileId: "off",
      });

      assert.equal(compiled.prompt, "1girl, blue dress");
      assert.equal(compiled.negativePrompt, "");
      assert.equal(compiled.profile.id, "off");
    },
  },
];

await runNamedCases(cases);
