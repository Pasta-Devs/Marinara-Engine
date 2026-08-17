import assert from "node:assert/strict";
import type { NoodleAccount } from "../../../packages/shared/src/types/noodle.js";
import { LIMITS } from "../../../packages/shared/src/constants/defaults.js";
import {
  composeNoodleTimelineSystemPrompt,
  formatNoodleTimelineForPrompt,
  noodleLorebookTokenBudget,
  noodlePastMemoryCutoff,
  noodlePastMemorySampleSize,
  noodlePersonaCommentPostIds,
  noodleTimelineVoiceDefaultText,
  NOODLE_ADULT_PLATFORM_POLICY,
  NOODLE_CONGRUENCY_INSTRUCTION,
  NOODLE_CREATIVE_FORMAT_INSTRUCTIONS,
  noodleCreativeFormatInstructions,
  NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
  NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
  NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION,
  NOODLE_LEGACY_TONE_INSTRUCTION,
  NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION,
  NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION,
  NOODLE_RECALLED_MEMORY_INSTRUCTION,
  NOODLE_TONE_INSTRUCTIONS,
  NOODLE_TIMELINE_BASE_DEFAULT_PROMPT,
  noodleTimelineFeatureInstructions,
  sampleNoodlePastMemories,
  sampleNoodlePastMemoriesWeighted,
} from "../../../packages/server/src/services/noodle/noodle-prompt.js";
import { compareNoodlerSourceSnapshots } from "../../../packages/server/src/services/noodle/noodle-noodler-source.js";
import { resolveIllustratorCharacterReferences } from "../../../packages/server/src/services/image/illustrator-references.js";
import {
  canViewNoodlerPost,
  isNoodlerHiddenFromViewer,
} from "../../../packages/server/src/services/noodle/noodler-access.js";
import { resolveStoredMaxTokens } from "../../../packages/server/src/services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../packages/server/src/services/generation/output-token-limits.js";
import {
  NOODLE_IMAGE_POST,
  NOODLE_TIMELINE_BASE,
  NOODLE_TIMELINE_VOICE,
} from "../../../packages/server/src/services/prompt-overrides/registry/noodle.js";

const makeAccount = (id: string): NoodleAccount => ({
  id,
  kind: "character",
  entityId: `entity-${id}`,
  handle: id,
  displayName: id.toUpperCase(),
  bio: "",
  avatarUrl: null,
  avatarCrop: null,
  invited: true,
  settings: {
    profile: {},
    social: {},
    scheduler: { autoPosting: { enabled: false, imagesEnabled: false } },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: 999999 },
  },
  platform: "noodle",
  noodleAccountId: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
});

assert.strictEqual(resolveStoredMaxTokens(null, 6144), 6144);
assert.strictEqual(resolveStoredMaxTokens({}, 6144), 6144);
assert.strictEqual(resolveStoredMaxTokens({ imageGenerationSource: "comfyui" }, 6144), 6144);
assert.strictEqual(
  resolveStoredMaxTokens(JSON.stringify({ maxTokens: 16_000, enabledParameters: { maxTokens: true } }), 6144),
  16_000,
);
assert.strictEqual(resolveStoredMaxTokens({ maxTokens: 16_000, enabledParameters: { maxTokens: false } }, 6144), 6144);
assert.strictEqual(
  clampGenerationMaxOutputTokens({
    provider: "custom",
    model: "kimi-k2.7",
    maxTokens: resolveStoredMaxTokens({ maxTokens: 16_000 }, 6144),
    maxTokensOverride: 8192,
  }),
  8192,
);

const sourceBaseline = {
  publicDisplayName: "Known Public Name",
  publicHandle: "known_public",
  name: "Known Public Name",
  description: "Marine biologist",
  personality: "Patient",
  scenario: "At the coast",
  appearance: "Blue coat",
  backstory: "Maps tide pools",
};
assert.deepEqual(compareNoodlerSourceSnapshots(sourceBaseline, { ...sourceBaseline }), { state: "current" });
assert.deepEqual(compareNoodlerSourceSnapshots(sourceBaseline, { ...sourceBaseline, appearance: "Red coat" }), {
  state: "changed",
  changes: [{ field: "appearance", previous: "Blue coat", current: "Red coat" }],
});
const accessCreator = {
  ...makeAccount("creator-private"),
  platform: "noodler" as const,
  settings: {
    ...makeAccount("creator-private").settings,
    privacy: {
      access: { hiddenFromAccountIds: ["blocked-viewer"] },
    },
  },
};
assert.equal(isNoodlerHiddenFromViewer(accessCreator, "blocked-viewer"), true);
assert.equal(isNoodlerHiddenFromViewer(accessCreator, "allowed-viewer"), false);
const lockedPost = { id: "locked-post", access: "locked" as const };
assert.equal(
  canViewNoodlerPost({
    post: { id: "public-post", access: "public" },
    subscribed: false,
    unlockedPostIds: new Set(),
  }),
  true,
);
assert.equal(
  canViewNoodlerPost({
    post: lockedPost,
    subscribed: false,
    unlockedPostIds: new Set(),
  }),
  false,
);
assert.equal(
  canViewNoodlerPost({
    post: lockedPost,
    subscribed: true,
    unlockedPostIds: new Set(),
  }),
  true,
);
assert.equal(
  canViewNoodlerPost({
    post: lockedPost,
    subscribed: false,
    unlockedPostIds: new Set([lockedPost.id]),
  }),
  true,
);
assert.match(NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION, /controlled exclusively by the user/u);
assert.match(
  NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION,
  /Never generate posts, replies, likes, reposts, poll votes, or follows/u,
);
assert.match(
  NOODLE_TIMELINE_BASE_DEFAULT_PROMPT,
  /^You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./u,
);
assert.equal(NOODLE_TIMELINE_BASE_DEFAULT_PROMPT.includes(NOODLE_ADULT_PLATFORM_POLICY), true);
assert.equal(NOODLE_TIMELINE_BASE_DEFAULT_PROMPT.includes(NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION), true);
assert.match(NOODLE_TIMELINE_BASE_DEFAULT_PROMPT, /Return JSON only\. No prose outside the JSON object\.$/u);
assert.equal(NOODLE_TIMELINE_BASE.defaultBuilder({}), NOODLE_TIMELINE_BASE_DEFAULT_PROMPT);
const timelineVoiceTail = "- Distinct final timeline voice instruction.";
const composedTimelineSystemPrompt = composeNoodleTimelineSystemPrompt(
  NOODLE_TIMELINE_BASE_DEFAULT_PROMPT,
  timelineVoiceTail,
);
assert.equal(composedTimelineSystemPrompt.endsWith(timelineVoiceTail), true);
assert.ok(
  composedTimelineSystemPrompt.indexOf(NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION) <
    composedTimelineSystemPrompt.indexOf(timelineVoiceTail),
);
assert.equal(
  composeNoodleTimelineSystemPrompt("Replace the base prompt entirely.", timelineVoiceTail),
  `Replace the base prompt entirely.\n${timelineVoiceTail}`,
);
assert.equal(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS.length, 3);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[0], /create polls in their own posts and vote in polls/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[0], /polls are optional, not a quota/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[1], /Standard Unicode emojis are allowed in post and reply content/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[1], /not every post or reply needs one/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[2], /allowed to be assholes to each other/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[2], /revive old grievances, form rivalries/u);
assert.match(NOODLE_CREATIVE_FORMAT_INSTRUCTIONS[2], /permission, not a quota/u);
assert.doesNotMatch(noodleCreativeFormatInstructions(false).join("\n"), /random users?/iu);
assert.match(noodleCreativeFormatInstructions(false)[0] ?? "", /^- Characters may create polls/u);

assert.equal(NOODLE_TONE_INSTRUCTIONS.length, 2);
assert.match(NOODLE_TONE_INSTRUCTIONS[0], /must come from each character's own Personality\/Description\/Backstory/u);
assert.match(NOODLE_TONE_INSTRUCTIONS[0], /Do not make every account sound equally enthusiastic/u);
assert.match(NOODLE_TONE_INSTRUCTIONS[1], /ground yourself in that account's stated personality traits/u);
assert.match(NOODLE_TONE_INSTRUCTIONS[1], /should not sound like an enthusiastic extrovert/u);
assert.match(NOODLE_CONGRUENCY_INSTRUCTION, /react to, quote, subtweet, or argue with each other's posts/u);
assert.match(NOODLE_RECALLED_MEMORY_INSTRUCTION, /feel free to revisit, reply to, repost, or build on it/u);
assert.match(NOODLE_RECALLED_MEMORY_INSTRUCTION, /do not force a reference to every recalled post/u);


const threadedTimeline = formatNoodleTimelineForPrompt(
  [
    {
      id: "post-1",
      authorAccountId: "character-account",
      authorSnapshot: {
        id: "character-account",
        kind: "character",
        entityId: "character-1",
        handle: "character_one",
        displayName: "Character One",
        avatarUrl: null,
      },
      content: "A character post.",
      imagePrompt: null,
      metadata: {},
      createdAt: "2026-07-10T10:00:00.000Z",
    },
  ],
  [
    {
      id: "persona-comment-1",
      postId: "post-1",
      parentInteractionId: null,
      actorAccountId: "persona-account",
      actorSnapshot: {
        id: "persona-account",
        kind: "persona",
        entityId: "persona-1",
        handle: "smarinara_spaghetti",
        displayName: "Mari",
        avatarUrl: null,
      },
      type: "reply",
      content: "Mari asks a follow-up question.",
      imageUrl: null,
      createdAt: "2026-07-10T10:05:00.000Z",
    },
  ],
  { priorityActorAccountId: "persona-account" },
);
assert.match(threadedTimeline, /replyId=persona-comment-1/u);
assert.match(threadedTimeline, /@smarinara_spaghetti/u);
assert.match(threadedTimeline, /Mari asks a follow-up question/u);
assert.deepEqual(
  noodlePersonaCommentPostIds(
    [
      { postId: "old-post-with-new-comment", actorAccountId: "persona-account", type: "reply" },
      { postId: "other-post", actorAccountId: "character-account", type: "reply" },
      { postId: "old-post-with-new-comment", actorAccountId: "persona-account", type: "reply" },
    ],
    "persona-account",
  ),
  ["old-post-with-new-comment"],
);

const activeAccountsInstruction = "- Use only the active accounts listed by @handle. Do not invent accounts.";
const randomUserSupportingInstruction =
  "- Character accounts are the primary cast. Random-user activity should be occasional supporting texture and must never dominate the generated posts or interactions.";
const randomUserParodyInstruction =
  "- A small minority of posts from random_user accounts may be obvious parody advertisements or absurd fake crypto scams. Usually generate none and never more than one per refresh. Keep every company, product, coin, ticker, price, and financial claim invented, visibly ridiculous, and non-actionable. Never imitate a real company or include real or usable links, wallet addresses, financial advice, or scam instructions.";
const imageGenerationInstruction =
  "- When image generation is enabled, imagePrompt must contain only the final concrete visual description for the attached image: either a character-focused image of the author/their scene/selfie, or an in-character meme they would plausibly post. Do not put the post JSON, field names, meta-commentary, instructions to another model, or the full post text inside imagePrompt.";
const galleryAttachmentInstruction =
  "- When gallery attachments are enabled, set attachGalleryImage to true only when the post naturally fits an existing gallery or chat image.";

const instructions = (input: {
  allowRandomUsers?: boolean;
  enableImagePrompts?: boolean;
  allowGalleryImageAttachments?: boolean;
  imageGenerationPrompt?: string;
}) =>
  noodleTimelineFeatureInstructions({
    allowRandomUsers: input.allowRandomUsers ?? false,
    enableImagePrompts: input.enableImagePrompts ?? false,
    allowGalleryImageAttachments: input.allowGalleryImageAttachments ?? false,
    imageGenerationPrompt: input.imageGenerationPrompt ?? "",
  });

assert.deepEqual(instructions({}), []);
assert.deepEqual(instructions({ allowRandomUsers: true }), [
  activeAccountsInstruction,
  randomUserSupportingInstruction,
  randomUserParodyInstruction,
]);
assert.deepEqual(instructions({ enableImagePrompts: true }), [imageGenerationInstruction]);
assert.deepEqual(instructions({ allowGalleryImageAttachments: true }), [galleryAttachmentInstruction]);
assert.deepEqual(
  instructions({ allowRandomUsers: true, enableImagePrompts: true, allowGalleryImageAttachments: true }),
  [
    activeAccountsInstruction,
    randomUserSupportingInstruction,
    randomUserParodyInstruction,
    imageGenerationInstruction,
    galleryAttachmentInstruction,
  ],
);

// Source the appearance block from the real resolver rather than a hand-written string, so the
// shared block's framing is covered by this test and not only the Noodle-side template.
const noodleImageReferences = await resolveIllustratorCharacterReferences({
  charactersStore: { list: async () => [] },
  chatCharacters: [{ id: "dottore", name: "Dottore", avatarPath: null, appearance: "blue hair and a white mask" }],
  persona: null,
  requestedNames: ["Dottore"],
  promptText: "Dottore",
  includeReferenceImages: false,
});
assert.equal(noodleImageReferences.appearanceBlock, "Dottore's Appearance: blue hair and a white mask");

const defaultNoodleImagePrompt = NOODLE_IMAGE_POST.defaultBuilder({
  authorName: "Dottore",
  postContent: "This entire post must not be sent to ComfyUI.",
  draftPrompt: "cel-shaded laboratory selfie",
  userInstructions: "Create a social-media-ready character image. Mention build, clothing, pose, lighting.",
  characterDescription: noodleImageReferences.appearanceBlock ?? "",
  characterPersonality: "precise, arrogant, impatient",
  characterImageInstructions: "stark lab photography with cold lighting",
});
assert.match(defaultNoodleImagePrompt, /^cel-shaded laboratory selfie/u);
assert.match(defaultNoodleImagePrompt, /Dottore's Appearance: blue hair and a white mask/u);
assert.doesNotMatch(defaultNoodleImagePrompt, /Character appearance notes:/u);
assert.doesNotMatch(defaultNoodleImagePrompt, /This entire post/u);
assert.doesNotMatch(defaultNoodleImagePrompt, /Output only|Draft image idea|Post text/u);

// The image model must never receive text written for a language model. Settings instructions go
// to the timeline model instead, and the surviving blocks carry no labels or framing sentences.
assert.doesNotMatch(defaultNoodleImagePrompt, /social-media-ready character image|Mention build/u);
assert.doesNotMatch(
  defaultNoodleImagePrompt,
  /Character personality and traits:|Character-specific image instructions:|Let these traits naturally influence/u,
);
assert.match(defaultNoodleImagePrompt, /precise, arrogant, impatient/u);
assert.match(defaultNoodleImagePrompt, /stark lab photography/u);

// ...and the timeline model must receive those instructions, marked as direction rather than text
// to copy into imagePrompt.
const imageDirectionInstructions = instructions({
  enableImagePrompts: true,
  imageGenerationPrompt: "Mention build, clothing, pose, lighting.",
});
assert.equal(imageDirectionInstructions.length, 2);
assert.match(imageDirectionInstructions[1] ?? "", /Mention build, clothing, pose, lighting\./u);
assert.match(imageDirectionInstructions[1] ?? "", /instructions to you, not text to copy/u);
assert.deepEqual(instructions({ enableImagePrompts: true, imageGenerationPrompt: "   " }), [
  imageGenerationInstruction,
]);
assert.deepEqual(instructions({ imageGenerationPrompt: "ignored while image prompts are off" }), []);


const cutoffAnchor = new Date("2026-07-10T12:00:00.000Z");
assert.equal(noodlePastMemoryCutoff(cutoffAnchor), "2026-07-08T12:00:00.000Z");
assert.equal(
  noodlePastMemorySampleSize(() => 0.9),
  0,
);
const oneItemRolls = [0.5, 0];
assert.equal(
  noodlePastMemorySampleSize(() => oneItemRolls.shift() ?? 0),
  1,
);
const fiveItemRolls = [0, 0.999];
assert.equal(
  noodlePastMemorySampleSize(() => fiveItemRolls.shift() ?? 0),
  5,
);

// Explicit legacy chance/maxItems params reproduce pre-toggle behavior (enableEnhancedTimelineWriting off).
assert.equal(
  noodlePastMemorySampleSize(
    () => 0.5,
    NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
    NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
  ),
  0,
);
const legacyThreeItemRolls = [0, 0.999];
assert.equal(
  noodlePastMemorySampleSize(
    () => legacyThreeItemRolls.shift() ?? 0,
    NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
    NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
  ),
  3,
);

assert.deepEqual(
  sampleNoodlePastMemories(["a", "b", "c"], 1, () => 0.99),
  ["c"],
);
const fiveMemories = sampleNoodlePastMemories(["a", "b", "c", "d", "e", "f"], 5, () => 0);
assert.equal(fiveMemories.length, 5);
assert.equal(new Set(fiveMemories).size, 5);
assert.ok(fiveMemories.every((item) => ["a", "b", "c", "d", "e", "f"].includes(item)));
assert.deepEqual(
  sampleNoodlePastMemories(["only"], 5, () => 0),
  ["only"],
);
assert.deepEqual(
  sampleNoodlePastMemories(["a", "b", "c", "d", "e", "f"], 99, () => 0),
  ["a", "b", "c", "d", "e"],
);


// Deterministic weighted-key cases prove that a much higher-weighted item wins ordinary equal
// rolls while a baseline-weighted item remains reachable with a sufficiently favorable roll.
const weightedMemories = ["low-a", "low-b", "high"];
const dominantWeightRolls = [0.5, 0.5, 0.5];
assert.deepEqual(
  sampleNoodlePastMemoriesWeighted(
    weightedMemories,
    1,
    (item) => (item === "high" ? 10 : 0.25),
    () => dominantWeightRolls.shift() ?? 0.5,
  ),
  ["high"],
);
const baselineReachabilityRolls = [0.99, 0.1, 1e-9];
assert.deepEqual(
  sampleNoodlePastMemoriesWeighted(
    weightedMemories,
    1,
    (item) => (item === "high" ? 10 : 0.25),
    () => baselineReachabilityRolls.shift() ?? 0.5,
  ),
  ["low-a"],
);
assert.deepEqual(
  sampleNoodlePastMemoriesWeighted(
    ["only"],
    5,
    () => 1,
    () => 0.5,
  ),
  ["only"],
);
assert.equal(
  sampleNoodlePastMemoriesWeighted(
    ["a", "b"],
    0,
    () => 1,
    () => 0.5,
  ).length,
  0,
);

// noodleLorebookTokenBudget scales with active character count but is floored and capped so a
// single-character Noodle refresh never dips below the floor, and a large roster never exceeds
// Noodle's explicit 8k hard ceiling.
assert.equal(noodleLorebookTokenBudget(0), LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_FLOOR);
assert.equal(noodleLorebookTokenBudget(1), LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_FLOOR);
assert.equal(
  noodleLorebookTokenBudget(10),
  Math.min(LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_MAX, 10 * LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_PER_ACCOUNT),
);
assert.equal(LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_MAX, 8192);
assert.equal(noodleLorebookTokenBudget(100), LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_MAX);


// noodleTimelineVoiceDefaultText(enhanced) feeds the "Noodle Timeline Voice & Tone" prompt
// override default (NOODLE_TIMELINE_VOICE.defaultBuilder). `enhanced=false` (the setting's
// default, enableEnhancedTimelineWriting off) must reproduce the exact pre-toggle text so
// existing users see no change until they opt in; `enhanced=true` is the new tone/congruency text.
assert.match(NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION, /Random user accounts are not characters/u);
const expectedLegacyVoiceText = [
  NOODLE_LEGACY_TONE_INSTRUCTION,
  NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION,
  ...NOODLE_CREATIVE_FORMAT_INSTRUCTIONS,
].join("\n");
const expectedEnhancedVoiceText = [
  ...NOODLE_TONE_INSTRUCTIONS,
  NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION,
  ...NOODLE_CREATIVE_FORMAT_INSTRUCTIONS,
  NOODLE_CONGRUENCY_INSTRUCTION,
].join("\n");
assert.equal(noodleTimelineVoiceDefaultText(false), expectedLegacyVoiceText);
assert.equal(noodleTimelineVoiceDefaultText(true), expectedEnhancedVoiceText);
assert.equal(
  noodleTimelineVoiceDefaultText(false, false),
  [NOODLE_LEGACY_TONE_INSTRUCTION, ...noodleCreativeFormatInstructions(false)].join("\n"),
);
assert.equal(NOODLE_TIMELINE_VOICE.key, "noodle.timelineVoice");
assert.equal(NOODLE_TIMELINE_VOICE.defaultBuilder({ enhanced: "false" }), expectedLegacyVoiceText);
assert.equal(NOODLE_TIMELINE_VOICE.defaultBuilder({ enhanced: "true" }), expectedEnhancedVoiceText);
assert.doesNotMatch(
  NOODLE_TIMELINE_VOICE.defaultBuilder({ enhanced: "false", allowRandomUsers: "false" }),
  /random users?/iu,
);
assert.equal(NOODLE_TIMELINE_VOICE.defaultBuilder({ enhanced: "garbage" }), expectedLegacyVoiceText);
assert.match(NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION, /optional long-term memories/u);
assert.match(NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION, /do not force a reference/u);

console.info("Noodle prompt and memory regression passed.");
