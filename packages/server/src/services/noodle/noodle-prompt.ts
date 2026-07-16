// ──────────────────────────────────────────────
// Noodle Prompt Instructions
// ──────────────────────────────────────────────
import {
  LIMITS,
  readNoodlePollFromMetadata,
  type NoodleAccountKind,
  type NoodleInteraction,
  type NoodlePost,
  type NoodleSettings,
} from "@marinara-engine/shared";

export const NOODLE_PAST_MEMORY_MIN_AGE_MS = 48 * 60 * 60 * 1000;
/** Behavior when a Noodle setting's `enableEnhancedTimelineWriting` is off — reproduces the exact pre-toggle defaults. */
export const NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS = 3;
export const NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE = 0.5;
/** Behavior when `enableEnhancedTimelineWriting` is on. */
export const NOODLE_PAST_MEMORY_MAX_ITEMS = 5;
export const NOODLE_PAST_MEMORY_INCLUSION_CHANCE = 0.85;
export const NOODLE_ADULT_PLATFORM_POLICY =
  "Noodle only accepts confirmed adult accounts and personas. Every participant on Noodle is 18+; minors are not allowed on the platform. NSFW content is allowed, anything goes, and adult in-character drama, flirtation, gossip, and explicit references may appear when they fit the accounts involved.";
export const NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION =
  "- The user persona is controlled exclusively by the user. Never generate posts, replies, likes, reposts, poll votes, or follows as a persona. Personas may only be mentioned or targeted by other accounts.";
export const NOODLE_PERSONA_IDENTITY_INSTRUCTION =
  "- Every persona account is a separate user identity. Preserve the accountKey on historical posts and replies: changing the currently selected persona never changes, merges, or reattributes activity created by another persona.";
export const NOODLE_TIMELINE_BASE_DEFAULT_PROMPT = [
  "You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle.",
  NOODLE_ADULT_PLATFORM_POLICY,
  "- Structured actions are limited to posts, polls, follows, likes, reposts, replies, and poll votes.",
  "- Generated interactions may target existing posts included in this prompt or posts you create in this response.",
  "- To respond directly to an existing comment, create a reply interaction for its post and set parentInteractionId to that comment's exact replyId.",
  "- Do not make an account interact with the same existing post again when it has already liked, reposted, voted, or replied there, unless that account was tagged or is answering a direct response to its own comment. Never make an account reply to its own comment.",
  "- Avoid repeating an account's recent post topic or phrasing. Continue an existing thread only when new activity gives the account a reason to return.",
  NOODLE_PERSONA_AUTHORSHIP_INSTRUCTION,
  NOODLE_PERSONA_IDENTITY_INSTRUCTION,
  "- For each interaction, set either targetTempId or targetPostId and set the unused target field to null.",
  "- pollOptionIndex must be a zero-based integer for votes and null for every other interaction.",
  "- An exact @handle in post or reply text tags that active account. Preserve the @handle exactly when mentioning someone.",
  "- Return JSON only. No prose outside the JSON object.",
].join("\n");

export function composeNoodleTimelineSystemPrompt(basePromptText: string, timelineVoiceText: string): string {
  return [basePromptText.trim(), timelineVoiceText.trim()].filter(Boolean).join("\n");
}
export const NOODLE_CREATIVE_FORMAT_INSTRUCTIONS = [
  "- Characters and random users may create polls in their own posts and vote in polls. Occasionally use a poll when an audience question or set of choices fits naturally with the account and current activity; polls are optional, not a quota.",
  "- Standard Unicode emojis are allowed in post and reply content. Use them naturally when they fit the account's voice or reaction; emojis are optional, and not every post or reply needs one.",
  "- Characters are allowed to be assholes to each other when it fits their personalities, history, and relationships. They may be rude, insulting, confrontational, jealous, petty, sarcastic, start arguments, revive old grievances, form rivalries, or deliberately stir up interpersonal drama. This is permission, not a quota: do not force hostility into every refresh or flatten established characterization just to create conflict.",
] as const;
const NOODLE_CHARACTER_ONLY_POLL_INSTRUCTION =
  "- Characters may create polls in their own posts and vote in polls. Occasionally use a poll when an audience question or set of choices fits naturally with the account and current activity; polls are optional, not a quota.";
const NOODLE_CHARACTER_ONLY_CREATIVE_FORMAT_INSTRUCTIONS = [
  NOODLE_CHARACTER_ONLY_POLL_INSTRUCTION,
  ...NOODLE_CREATIVE_FORMAT_INSTRUCTIONS.slice(1),
] as const;

export function noodleCreativeFormatInstructions(allowRandomUsers: boolean): readonly string[] {
  return allowRandomUsers ? NOODLE_CREATIVE_FORMAT_INSTRUCTIONS : NOODLE_CHARACTER_ONLY_CREATIVE_FORMAT_INSTRUCTIONS;
}
/** Legacy single-line tone instruction, used when `enableEnhancedTimelineWriting` is off. */
export const NOODLE_LEGACY_TONE_INSTRUCTION =
  "- Characters should act in character but like people posting online: funny, messy, indirect, petty, affectionate, dramatic, vulgar, or casual as fits them.";
export const NOODLE_TONE_INSTRUCTIONS = [
  "- Characters post like real people online (funny, messy, indirect, petty, affectionate, dramatic, vulgar, or casual) — but which of these fits, and how much, must come from each character's own Personality/Description/Backstory below, not a default upbeat voice. Do not make every account sound equally enthusiastic, chatty, or friendly.",
  "- Before writing each account's posts/replies, briefly ground yourself in that account's stated personality traits (guarded, blunt, anxious, arrogant, deadpan, etc.) and let sentence length, punctuation, capitalization, and emoji use vary accordingly. A withdrawn or hostile character should not sound like an enthusiastic extrovert.",
] as const;
export const NOODLE_CONGRUENCY_INSTRUCTION =
  "- Multiple active accounts may know each other from shared chats, prior Noodle posts, or each other's lore below. When it fits, have accounts react to, quote, subtweet, or argue with each other's posts in this same batch (via @handle mentions and targetTempId), not just post in isolation.";
export const NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION =
  "- Random user accounts are not characters. Treat them as ordinary fictional Noodle profiles that may follow, like, reply, repost, gossip, or casually join public drama.";
/**
 * Default text for the editable "Noodle Timeline Voice & Tone" prompt override
 * (registry/noodle.ts: NOODLE_TIMELINE_VOICE). Deliberately limited to tone and creative-freedom
 * instructions only — schema-critical output-format rules (structured action limits, target
 * field rules, handle preservation, persona authorship, adult platform policy, "Return JSON
 * only") stay hardcoded in buildRefreshPrompt() outside this override, so a user rewriting their
 * voice/tone text cannot accidentally break the noodleGeneratedRefreshSchema output contract.
 *
 * `enhanced` mirrors the Noodle setting `enableEnhancedTimelineWriting` (off by default): off
 * reproduces the original single-line tone instruction with no congruency instruction; on adds
 * the personality-grounding tone instructions and the cross-account congruency instruction. This
 * only affects the UNEDITED default — once a user customizes the override, their text is used
 * regardless of the setting.
 */
export function noodleTimelineVoiceDefaultText(enhanced: boolean, allowRandomUsers = true): string {
  return [
    ...(enhanced ? NOODLE_TONE_INSTRUCTIONS : [NOODLE_LEGACY_TONE_INSTRUCTION]),
    ...(allowRandomUsers ? [NOODLE_RANDOM_USER_TREATMENT_INSTRUCTION] : []),
    ...noodleCreativeFormatInstructions(allowRandomUsers),
    ...(enhanced ? [NOODLE_CONGRUENCY_INSTRUCTION] : []),
  ].join("\n");
}
/** Legacy recalled-memory instruction, used when `enableEnhancedTimelineWriting` is off. */
export const NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION =
  "- These posts are more than 48 hours old and are optional long-term memories. Active accounts may naturally remember, revisit, like, repost, reply to, or build on them, but do not force a reference.";
export const NOODLE_RECALLED_MEMORY_INSTRUCTION =
  "- These posts are more than 48 hours old and are past context an account might plausibly remember, especially posts or threads involving currently active accounts. When a recalled post naturally continues a relevant thread, character relationship, or grievance, feel free to revisit, reply to, repost, or build on it — but do not force a reference to every recalled post, and skip ones that don't fit the moment.";

type NoodleTimelineFeatureSettings = Pick<
  NoodleSettings,
  "allowRandomUsers" | "enableImagePrompts" | "allowGalleryImageAttachments"
>;

type RandomSource = () => number;
type NoodlePromptPost = Pick<
  NoodlePost,
  | "id"
  | "authorAccountId"
  | "authorSnapshot"
  | "content"
  | "imageUrl"
  | "imagePrompt"
  | "metadata"
  | "createdAt"
>;
type NoodlePromptInteraction = Pick<
  NoodleInteraction,
  | "id"
  | "postId"
  | "parentInteractionId"
  | "actorAccountId"
  | "actorSnapshot"
  | "type"
  | "content"
  | "imageUrl"
  | "createdAt"
>;

const NOODLE_PROMPT_REPLIES_PER_POST = 12;

function formatNoodlePromptAccount(snapshot: NoodlePost["authorSnapshot"], fallbackAccountId: string): string {
  if (!snapshot) return `accountKey=${fallbackAccountId}`;
  return `${snapshot.displayName} (@${snapshot.handle}; ${snapshot.kind} accountKey=${snapshot.kind}:${snapshot.entityId})`;
}

export interface NoodlePromptImageCandidate {
  key: string;
  imageUrl: string;
  postId: string;
  interactionId: string | null;
  createdAt: string;
}

export function noodlePostImageKey(postId: string): string {
  return `noodle-post-image:${postId}`;
}

export function noodleReplyImageKey(interactionId: string): string {
  return `noodle-reply-image:${interactionId}`;
}

export function canGenerateNoodleActivityForAccountKind(kind: NoodleAccountKind): boolean {
  return kind === "character" || kind === "random_user";
}

export function noodlePersonaCommentPostIds(
  interactions: Array<Pick<NoodleInteraction, "postId" | "actorAccountId" | "type">>,
  personaAccountId?: string,
): string[] {
  if (!personaAccountId) return [];
  return Array.from(
    new Set(
      interactions
        .filter((interaction) => interaction.type === "reply" && interaction.actorAccountId === personaAccountId)
        .map((interaction) => interaction.postId),
    ),
  );
}

function promptRepliesForPost(
  interactions: NoodlePromptInteraction[],
  postId: string,
  priorityActorAccountId?: string,
) {
  const replies = interactions.filter((interaction) => interaction.postId === postId && interaction.type === "reply");
  const prioritized = priorityActorAccountId
    ? replies.filter((interaction) => interaction.actorAccountId === priorityActorAccountId).reverse()
    : [];
  const newest = replies.slice().reverse();
  const selected = new Map<string, NoodlePromptInteraction>();
  for (const reply of [...prioritized, ...newest]) {
    if (selected.size >= NOODLE_PROMPT_REPLIES_PER_POST) break;
    selected.set(reply.id, reply);
  }
  return [...selected.values()].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function collectNoodlePromptImageCandidates(
  posts: NoodlePromptPost[],
  interactions: NoodlePromptInteraction[],
  options: { priorityActorAccountId?: string } = {},
): NoodlePromptImageCandidate[] {
  const candidates: NoodlePromptImageCandidate[] = [];
  for (const post of posts) {
    if (post.imageUrl) {
      candidates.push({
        key: noodlePostImageKey(post.id),
        imageUrl: post.imageUrl,
        postId: post.id,
        interactionId: null,
        createdAt: post.createdAt,
      });
    }
    for (const reply of promptRepliesForPost(interactions, post.id, options.priorityActorAccountId)) {
      if (!reply.imageUrl) continue;
      candidates.push({
        key: noodleReplyImageKey(reply.id),
        imageUrl: reply.imageUrl,
        postId: post.id,
        interactionId: reply.id,
        createdAt: reply.createdAt,
      });
    }
  }
  return candidates;
}

export function formatNoodleTimelineForPrompt(
  posts: NoodlePromptPost[],
  interactions: NoodlePromptInteraction[],
  options: {
    emptyMessage?: string;
    includeTimestamp?: boolean;
    priorityActorAccountId?: string;
    attachedImageKeys?: ReadonlySet<string>;
    imageCaptions?: ReadonlyMap<string, string>;
  } = {},
) {
  if (posts.length === 0) return options.emptyMessage ?? "No recent Noodle posts.";
  return posts
    .slice()
    .reverse()
    .map((post) => {
      const author = formatNoodlePromptAccount(post.authorSnapshot, post.authorAccountId);
      const poll = readNoodlePollFromMetadata(post.metadata);
      const pollSummary = poll
        ? ` [poll: ${poll.question}; ${poll.options
            .map((option, index) => {
              const votes = interactions.filter(
                (interaction) =>
                  interaction.postId === post.id && interaction.type === "vote" && interaction.content === option.id,
              ).length;
              return `option ${index}: ${option.label} (${votes} vote${votes === 1 ? "" : "s"})`;
            })
            .join("; ")}]`
        : "";
      const timestamp = options.includeTimestamp ? ` at ${post.createdAt}` : "";
      const replyLines = promptRepliesForPost(interactions, post.id, options.priorityActorAccountId).map((reply) => {
        const replyAuthor = formatNoodlePromptAccount(reply.actorSnapshot, reply.actorAccountId);
        const parent = reply.parentInteractionId ? ` parentReplyId=${reply.parentInteractionId}` : "";
        const imageKey = noodleReplyImageKey(reply.id);
        const imageAttached = options.attachedImageKeys?.has(imageKey) === true;
        const imageCaption = options.imageCaptions?.get(imageKey)?.trim();
        const replyBody =
          reply.content || (imageAttached ? "[image]" : reply.imageUrl ? "[image reply]" : "[empty reply]");
        return `  - replyId=${reply.id}${parent} by ${replyAuthor} at ${reply.createdAt}: ${replyBody}${
          imageAttached
            ? ` [attached image: ${imageKey}]`
            : imageCaption
              ? ` [image description: ${imageCaption}]`
              : reply.imageUrl && reply.content
                ? " [image not attached]"
                : ""
        }`;
      });
      const postImageKey = noodlePostImageKey(post.id);
      const postImageAttached = options.attachedImageKeys?.has(postImageKey) === true;
      const postImageCaption = options.imageCaptions?.get(postImageKey)?.trim();
      return [
        `- ${post.id} by ${author}${timestamp}: ${post.content}${pollSummary}${
          postImageAttached
            ? ` [attached image: ${postImageKey}]`
            : postImageCaption
              ? ` [image description: ${postImageCaption}]`
              : post.imagePrompt
                ? ` [image prompt: ${post.imagePrompt}]`
                : post.imageUrl
                  ? " [image not attached]"
                  : ""
        }`,
        ...replyLines,
      ].join("\n");
    })
    .join("\n");
}

function normalizedRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999_999, Math.max(0, value));
}

export function noodlePastMemoryCutoff(at = new Date()): string {
  return new Date(at.getTime() - NOODLE_PAST_MEMORY_MIN_AGE_MS).toISOString();
}

export function noodlePastMemorySampleSize(
  random: RandomSource = Math.random,
  inclusionChance: number = NOODLE_PAST_MEMORY_INCLUSION_CHANCE,
  maxItems: number = NOODLE_PAST_MEMORY_MAX_ITEMS,
): number {
  if (normalizedRandom(random) >= inclusionChance) return 0;
  return 1 + Math.floor(normalizedRandom(random) * maxItems);
}

export function sampleNoodlePastMemories<T>(
  items: readonly T[],
  limit: number,
  random: RandomSource = Math.random,
): T[] {
  const count = Math.min(Math.max(0, Math.floor(limit)), NOODLE_PAST_MEMORY_MAX_ITEMS, items.length);
  if (count === 0) return [];
  const pool = [...items];
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = index + Math.floor(normalizedRandom(random) * (pool.length - index));
    [pool[index], pool[selectedIndex]] = [pool[selectedIndex]!, pool[index]!];
  }
  return pool.slice(0, count);
}

/**
 * Like sampleNoodlePastMemories, but biases selection toward items weightFn scores higher
 * (e.g. posts authored by or mentioning currently active accounts), using weighted sampling
 * without replacement (`-log(random) / weight` keys, sorted ascending). Baseline weight (see
 * weightFn) keeps unrelated older posts occasionally reachable rather than filtering them out.
 */
export function sampleNoodlePastMemoriesWeighted<T>(
  items: readonly T[],
  limit: number,
  weightFn: (item: T) => number,
  random: RandomSource = Math.random,
): T[] {
  const count = Math.min(Math.max(0, Math.floor(limit)), NOODLE_PAST_MEMORY_MAX_ITEMS, items.length);
  if (count === 0) return [];
  const keyed = items.map((item) => {
    const weight = Math.max(weightFn(item), 0.001);
    const roll = Math.max(normalizedRandom(random), 1e-9);
    return { item, key: -Math.log(roll) / weight };
  });
  keyed.sort((left, right) => left.key - right.key);
  return keyed.slice(0, count).map((entry) => entry.item);
}

/**
 * Noodle can batch far more characters into one refresh (up to 100, or uncapped with "All
 * invited") than a normal chat turn (1-2 characters), so it scales its own lorebook budget by
 * active character count rather than reusing DEFAULT_LOREBOOK_TOKEN_BUDGET outright — a
 * single-character refresh gets at least the floor, and a large roster is capped at the same
 * default a normal chat turn would get, never more.
 */
export function noodleLorebookTokenBudget(activeCharacterCount: number): number {
  const scaled = Math.max(activeCharacterCount, 0) * LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_PER_ACCOUNT;
  return Math.min(LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET, Math.max(LIMITS.NOODLE_LOREBOOK_TOKEN_BUDGET_FLOOR, scaled));
}

export function noodleTimelineFeatureInstructions(settings: NoodleTimelineFeatureSettings): string[] {
  return [
    ...(settings.allowRandomUsers
      ? [
          "- Use only the active accounts listed by @handle. Do not invent accounts.",
          "- Character accounts are the primary cast. Random-user activity should be occasional supporting texture and must never dominate the generated posts or interactions.",
          "- A small minority of posts from random_user accounts may be obvious parody advertisements or absurd fake crypto scams. Usually generate none and never more than one per refresh. Keep every company, product, coin, ticker, price, and financial claim invented, visibly ridiculous, and non-actionable. Never imitate a real company or include real or usable links, wallet addresses, financial advice, or scam instructions.",
        ]
      : []),
    ...(settings.enableImagePrompts
      ? [
          "- When image generation is enabled, imagePrompt must contain only the final concrete visual description for the attached image: either a character-focused image of the author/their scene/selfie, or an in-character meme they would plausibly post. Do not put the post JSON, field names, meta-commentary, instructions to another model, or the full post text inside imagePrompt.",
        ]
      : []),
    ...(settings.allowGalleryImageAttachments
      ? [
          "- When gallery attachments are enabled, set attachGalleryImage to true only when the post naturally fits an existing gallery or chat image.",
        ]
      : []),
  ];
}
