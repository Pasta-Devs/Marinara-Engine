import assert from "node:assert/strict";
import { DEFAULT_NOODLE_SETTINGS, noodleRefreshSchema } from "../../packages/shared/src/schemas/noodle.schema.js";
import { canManageNoodleReply } from "../../packages/shared/src/utils/noodle-interactions.js";
import type { NoodleAccount, NoodleInteraction, NoodlePost } from "../../packages/shared/src/types/noodle.js";
import { LIMITS, PROFESSOR_MARI_ID } from "../../packages/shared/src/constants/defaults.js";
import {
  canGenerateNoodleActivityForAccountKind,
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
} from "../../packages/server/src/services/noodle/noodle-prompt.js";
import { chooseNoodleParticipantAccounts } from "../../packages/server/src/services/noodle/noodle-participant-selection.js";
import { noodleAccountsNeedingProfiles } from "../../packages/server/src/services/noodle/noodle-profile-selection.js";
import {
  buildNoodleCarryoverBlock,
  NOODLE_CARRYOVER_TOKEN_BUDGET,
} from "../../packages/server/src/services/noodle/noodle-context.js";
import { canCreateGeneratedNoodleInteraction } from "../../packages/server/src/services/noodle/noodle-interaction-policy.js";
import { parseNoodleGeneratedProfiles } from "../../packages/server/src/services/noodle/noodle-generated-profiles.js";
import {
  parseNoodleGeneratedRefresh,
  validateNoodleGeneratedRefresh,
} from "../../packages/server/src/services/noodle/noodle-generated-refresh.js";
import { normalizeNoodleImagePrompt } from "../../packages/server/src/services/noodle/noodle-image-prompt.js";
import {
  NOODLE_IMAGE_POST,
  NOODLE_TIMELINE_BASE,
} from "../../packages/server/src/services/prompt-overrides/registry/noodle.js";
import { collectNoodlePriorityAccountIds } from "../../packages/server/src/routes/noodle.routes.js";
import { NOODLE_TIMELINE_VOICE } from "../../packages/server/src/services/prompt-overrides/registry/noodle.js";

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
  settings: {},
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
});

const participantSettings = {
  ...DEFAULT_NOODLE_SETTINGS,
  participantSelectionMode: "exact" as const,
  participantMin: 2,
  participantMax: 2,
};
const participantAccounts = [makeAccount("alpha"), makeAccount("beta"), makeAccount("gamma")];
const professorMariAccount = { ...makeAccount("professor-mari"), entityId: PROFESSOR_MARI_ID };
const selectionPersona: NoodleAccount = {
  ...makeAccount("persona-account"),
  kind: "persona",
  entityId: "persona-entity",
  handle: "mari",
};

const largeInvitedRoster = Array.from({ length: 200 }, (_, index) => makeAccount(`invited-${index}`));
const selectedLargeRosterParticipants = chooseNoodleParticipantAccounts({
  accounts: largeInvitedRoster,
  settings: participantSettings,
  selectedGroupCharacterIds: new Set(),
  random: () => 0,
});
assert.equal(selectedLargeRosterParticipants.length, 2);
const selectedWithExistingProfile = selectedLargeRosterParticipants.map((account, index) => ({
  ...account,
  settings: index === 0 ? { profileGenerated: true } : {},
}));
const largeRosterProfileTargets = noodleAccountsNeedingProfiles(selectedWithExistingProfile);
assert.equal(largeRosterProfileTargets.length, 1);
assert.ok(selectedLargeRosterParticipants.some((account) => account.id === largeRosterProfileTargets[0]!.id));
assert.ok(
  largeRosterProfileTargets.every((account) => selectedLargeRosterParticipants.some((selected) => selected.id === account.id)),
);
assert.deepEqual(
  [
    ...collectNoodlePriorityAccountIds({
      accounts: [...participantAccounts, selectionPersona],
      personaAccount: selectionPersona,
      posts: [
        {
          id: "alpha-post",
          authorAccountId: "alpha",
          content: "Alpha posted.",
          imageUrl: null,
          imagePrompt: null,
          parentPostId: null,
          quotePostId: null,
          source: "generated",
          metadata: {},
          authorSnapshot: null,
          createdAt: "2026-07-10T10:00:00.000Z",
          updatedAt: "2026-07-10T10:00:00.000Z",
        },
        {
          id: "persona-post",
          authorAccountId: selectionPersona.id,
          content: "@beta what do you think?",
          imageUrl: null,
          imagePrompt: null,
          parentPostId: null,
          quotePostId: null,
          source: "manual",
          metadata: {},
          authorSnapshot: null,
          createdAt: "2026-07-10T10:01:00.000Z",
          updatedAt: "2026-07-10T10:01:00.000Z",
        },
      ],
      interactions: [
        {
          id: "persona-alpha-reply",
          postId: "alpha-post",
          parentInteractionId: null,
          actorAccountId: selectionPersona.id,
          type: "reply",
          content: "Tell me more.",
          imageUrl: null,
          actorSnapshot: null,
          createdAt: "2026-07-10T10:02:00.000Z",
        },
      ],
    }),
  ].sort(),
  ["alpha", "beta"],
);
assert.deepEqual(
  chooseNoodleParticipantAccounts({
    accounts: participantAccounts,
    settings: participantSettings,
    selectedGroupCharacterIds: new Set(),
    recentlyActiveAccountIds: new Set(["alpha"]),
    random: () => 0,
  }).map((account) => account.id),
  ["gamma", "beta"],
);
assert.deepEqual(
  chooseNoodleParticipantAccounts({
    accounts: participantAccounts,
    settings: participantSettings,
    selectedGroupCharacterIds: new Set(),
    recentlyActiveAccountIds: new Set(["alpha"]),
    priorityAccountIds: new Set(["alpha"]),
    random: () => 0,
  }).map((account) => account.id),
  ["alpha", "gamma"],
);
assert.equal(
  chooseNoodleParticipantAccounts({
    accounts: [professorMariAccount],
    settings: { ...participantSettings, allowProfessorMari: false },
    selectedGroupCharacterIds: new Set(),
  }).length,
  0,
);
assert.equal(
  chooseNoodleParticipantAccounts({
    accounts: [professorMariAccount],
    settings: participantSettings,
    selectedGroupCharacterIds: new Set(),
  })[0]?.entityId,
  PROFESSOR_MARI_ID,
);

const randomParticipant = { ...makeAccount("ambient"), kind: "random_user" as const };
const characterFirstSelection = chooseNoodleParticipantAccounts({
  accounts: [...participantAccounts, randomParticipant],
  settings: { ...participantSettings, allowRandomUsers: true },
  selectedGroupCharacterIds: new Set(),
  random: () => 0,
});
assert.equal(characterFirstSelection.filter((account) => account.kind === "character").length, 1);
assert.equal(characterFirstSelection.filter((account) => account.kind === "random_user").length, 1);
const charactersOnlySelection = chooseNoodleParticipantAccounts({
  accounts: [...participantAccounts, randomParticipant],
  settings: { ...participantSettings, allowRandomUsers: true },
  selectedGroupCharacterIds: new Set(),
  random: () => 0.9,
});
assert.equal(charactersOnlySelection.every((account) => account.kind === "character"), true);
const sparseCharacterSelection = chooseNoodleParticipantAccounts({
  accounts: [participantAccounts[0]!, randomParticipant, { ...randomParticipant, id: "ambient-two", entityId: "ambient-two" }],
  settings: { ...participantSettings, allowRandomUsers: true, participantMin: 3, participantMax: 3 },
  selectedGroupCharacterIds: new Set(),
  random: () => 0.9,
});
assert.equal(sparseCharacterSelection.length, 3);
assert.equal(sparseCharacterSelection[0]?.kind, "character");

const repeatActor = makeAccount("repeat_actor");
const repeatPost: NoodlePost = {
  id: "repeat-post",
  authorAccountId: "post-author",
  content: "An ordinary post.",
  imageUrl: null,
  imagePrompt: null,
  parentPostId: null,
  quotePostId: null,
  source: "generated",
  metadata: {},
  authorSnapshot: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
};
const actorReply: NoodleInteraction = {
  id: "actor-reply",
  postId: repeatPost.id,
  parentInteractionId: null,
  actorAccountId: repeatActor.id,
  type: "reply",
  content: "First reply.",
  imageUrl: null,
  actorSnapshot: null,
  createdAt: "2026-07-10T10:01:00.000Z",
};
const directResponse: NoodleInteraction = {
  ...actorReply,
  id: "direct-response",
  actorAccountId: "persona-account",
  parentInteractionId: actorReply.id,
  content: "What do you mean?",
  createdAt: "2026-07-10T10:02:00.000Z",
};
assert.equal(
  canCreateGeneratedNoodleInteraction({
    actor: repeatActor,
    targetPost: repeatPost,
    parentInteraction: null,
    existingInteractions: [actorReply],
  }),
  false,
);
assert.equal(
  canCreateGeneratedNoodleInteraction({
    actor: repeatActor,
    targetPost: repeatPost,
    parentInteraction: actorReply,
    existingInteractions: [actorReply],
  }),
  false,
);
assert.equal(
  canCreateGeneratedNoodleInteraction({
    actor: repeatActor,
    targetPost: repeatPost,
    parentInteraction: directResponse,
    existingInteractions: [actorReply, directResponse],
  }),
  true,
);
assert.equal(
  canCreateGeneratedNoodleInteraction({
    actor: repeatActor,
    targetPost: { ...repeatPost, content: "Come back, @repeat_actor." },
    parentInteraction: null,
    existingInteractions: [actorReply],
  }),
  true,
);

assert.equal(canGenerateNoodleActivityForAccountKind("persona"), false);
assert.equal(canGenerateNoodleActivityForAccountKind("character"), true);
assert.equal(canGenerateNoodleActivityForAccountKind("random_user"), true);
assert.equal(noodleRefreshSchema.parse({ reviewImagePromptsBeforeSend: true }).reviewImagePromptsBeforeSend, true);
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

assert.equal(
  canManageNoodleReply({
    actorKind: "persona",
    actorAccountId: "persona-account",
    personaAccountId: "persona-account",
  }),
  true,
);
assert.equal(
  canManageNoodleReply({
    actorKind: "persona",
    actorAccountId: "other-persona-account",
    personaAccountId: "persona-account",
  }),
  false,
);
assert.equal(
  canManageNoodleReply({
    actorKind: "character",
    actorAccountId: "character-account",
    personaAccountId: "persona-account",
  }),
  true,
);
assert.equal(
  canManageNoodleReply({
    actorKind: "random_user",
    actorAccountId: "random-account",
    personaAccountId: "persona-account",
  }),
  false,
);

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
}) =>
  noodleTimelineFeatureInstructions({
    allowRandomUsers: input.allowRandomUsers ?? false,
    enableImagePrompts: input.enableImagePrompts ?? false,
    allowGalleryImageAttachments: input.allowGalleryImageAttachments ?? false,
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

const resilientRefresh = parseNoodleGeneratedRefresh({
  posts: [{ authorHandle: "alpha", content: "A valid post." }],
  interactions: [
    {
      actorHandle: "beta",
      targetPostId: "post-1",
      type: "like",
      parentInteractionId: "comment-that-must-not-be-here",
    },
  ],
  follows: [],
  digests: [],
});
assert.equal(resilientRefresh.refresh.posts.length, 1);
assert.equal(resilientRefresh.refresh.interactions.length, 0);
assert.deepEqual(resilientRefresh.rejected, [{ collection: "interactions", index: 0, issueCount: 1 }]);
assert.equal(
  validateNoodleGeneratedRefresh(
    { posts: [], interactions: [], follows: [], digests: [] },
    new Set(["alpha"]),
    new Set(["alpha", "persona"]),
  ),
  "the response contained no timeline activity",
);
assert.equal(
  validateNoodleGeneratedRefresh(
    {
      posts: [{ authorHandle: "persona", content: "The model must not post as the user.", attachGalleryImage: false }],
      interactions: [],
      follows: [],
      digests: [],
    },
    new Set(["alpha"]),
    new Set(["alpha", "persona"]),
  ),
  "the response used no selected participant handle",
);
assert.equal(
  validateNoodleGeneratedRefresh(
    {
      posts: [{ authorHandle: "alpha", content: "A valid cast post.", attachGalleryImage: false }],
      interactions: [],
      follows: [],
      digests: [],
    },
    new Set(["alpha"]),
    new Set(["alpha", "persona"]),
  ),
  null,
);

assert.equal(
  normalizeNoodleImagePrompt(
    'Post text: a long social post\nDraft image idea: cel-shaded scientist holding a test tube\nUser instructions: vivid color',
  ),
  "cel-shaded scientist holding a test tube",
);
assert.equal(
  normalizeNoodleImagePrompt('{"imagePrompt":"moonlit laboratory portrait","content":"do not send me"}'),
  "moonlit laboratory portrait",
);
assert.equal(normalizeNoodleImagePrompt('{"content":"do not send this JSON to an image model"}'), null);
const defaultNoodleImagePrompt = NOODLE_IMAGE_POST.defaultBuilder({
  authorName: "Dottore",
  postContent: "This entire post must not be sent to ComfyUI.",
  draftPrompt: "cel-shaded laboratory selfie",
  userInstructions: "dramatic blue lighting",
  characterDescription: "Dottore has blue hair and a white mask.",
});
assert.match(defaultNoodleImagePrompt, /^cel-shaded laboratory selfie/u);
assert.match(defaultNoodleImagePrompt, /Dottore has blue hair/u);
assert.doesNotMatch(defaultNoodleImagePrompt, /This entire post/u);
assert.doesNotMatch(defaultNoodleImagePrompt, /Output only|Draft image idea|Post text/u);

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
  noodlePastMemorySampleSize(() => 0.5, NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE, NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS),
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

const boundedGeneratedProfiles = parseNoodleGeneratedProfiles({
  profiles: [
    {
      entityId: "formatted-character",
      name: `Who̶̥͛ is…she…?${" very mysterious".repeat(20)}`,
      handle: "formatted_character_handle_that_is_far_too_long_for_noodle",
      bio: "bio ".repeat(150),
      location: "somewhere ".repeat(30),
    },
  ],
});
assert.equal(boundedGeneratedProfiles.rejected.length, 0);
assert.equal(boundedGeneratedProfiles.profiles.length, 1);
assert.ok(boundedGeneratedProfiles.profiles[0]!.name.length <= 120);
assert.ok(boundedGeneratedProfiles.profiles[0]!.handle.length <= 40);
assert.ok(boundedGeneratedProfiles.profiles[0]!.bio.length <= 500);
assert.ok(boundedGeneratedProfiles.profiles[0]!.location.length <= 120);

const partiallyInvalidGeneratedProfiles = parseNoodleGeneratedProfiles({
  profiles: [
    { entityId: "invalid", name: "Missing handle" },
    { entityId: "valid", name: "Valid Character", handle: "valid_character", bio: "", location: "" },
  ],
});
assert.deepEqual(partiallyInvalidGeneratedProfiles.profiles.map((profile) => profile.entityId), ["valid"]);
assert.deepEqual(partiallyInvalidGeneratedProfiles.rejected, [{ index: 0, issueCount: 1 }]);

// sampleNoodlePastMemoriesWeighted should reliably favor a much higher-weighted item over
// several trials, while still keeping baseline-weighted items reachable (not filtered out).
let highWeightPicks = 0;
const trials = 200;
for (let trial = 0; trial < trials; trial += 1) {
  const rolls = [Math.random(), Math.random(), Math.random()];
  const [top] = sampleNoodlePastMemoriesWeighted(
    ["low-a", "low-b", "high"],
    1,
    (item) => (item === "high" ? 10 : 0.25),
    () => rolls.shift() ?? Math.random(),
  );
  if (top === "high") highWeightPicks += 1;
}
assert.ok(highWeightPicks > trials * 0.8, `expected high-weight item to dominate, got ${highWeightPicks}/${trials}`);
assert.deepEqual(
  sampleNoodlePastMemoriesWeighted(["only"], 5, () => 1, () => 0.5),
  ["only"],
);
assert.equal(sampleNoodlePastMemoriesWeighted(["a", "b"], 0, () => 1, () => 0.5).length, 0);

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

const oversizedCarryoverDigests = Array.from({ length: 50 }, (_, index) => ({
  content: `newest-${index}-${"x".repeat(1180)}`,
}));
const boundedCarryoverBlock = buildNoodleCarryoverBlock(oversizedCarryoverDigests, 50, "xml");
assert.ok(boundedCarryoverBlock);
assert.ok(boundedCarryoverBlock.length <= NOODLE_CARRYOVER_TOKEN_BUDGET * 4);
assert.match(boundedCarryoverBlock, /newest-0-/u);
assert.doesNotMatch(boundedCarryoverBlock, /newest-49-/u);
assert.ok(boundedCarryoverBlock.indexOf("newest-1-") < boundedCarryoverBlock.indexOf("newest-0-"));
assert.equal(
  buildNoodleCarryoverBlock([{ content: "newest" }, { content: "older\nwith detail" }], 2, "none"),
  "- older\nwith detail\n- newest",
);

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
