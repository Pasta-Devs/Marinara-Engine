import {
  extractNoodleMentionHandles,
  resolveMacros,
  type NoodleAccount,
  type NoodlePost,
  type NoodleSettings,
} from "@marinara-engine/shared";
import type { ChatMessage } from "../llm/base-provider.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_TIMELINE_BASE, NOODLE_TIMELINE_VOICE } from "../prompt-overrides/index.js";
import { NOODLE_JSON_OUTPUT_HEADING } from "./noodle-response-format.js";
import {
  collectNoodlePromptImageCandidates,
  composeNoodleTimelineSystemPrompt,
  formatNoodleTimelineForPrompt,
  noodleLorebookTokenBudget,
  noodlePastMemoryCutoff,
  noodlePastMemorySampleSize,
  noodlePersonaCommentPostIds,
  NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
  NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
  NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION,
  NOODLE_PERSONA_IDENTITY_INSTRUCTION,
  NOODLE_RECALLED_MEMORY_INSTRUCTION,
  noodleTimelineFeatureInstructions,
  sampleNoodlePastMemories,
  sampleNoodlePastMemoriesWeighted,
} from "./noodle-prompt.js";
import { processLorebooks } from "../lorebook/index.js";
import { buildPromptMacroContext, resolveMacrosWithVariableSnapshot } from "../prompt/index.js";
import type { DB } from "../../db/connection.js";
import {
  generateImageCaptionsForDataUrls,
  type ImageCaptioningRuntime,
} from "../generation/image-captioning-runtime.js";
import {
  formatNoodleVisionManifest,
  prepareNoodleVisionAttachments,
  type NoodleVisionAttachment,
} from "./noodle-vision.js";
import { characterNameFromRow, parseRecord } from "./noodle-public-support.js";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function escapePromptAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Reads the chat's already-derived `conversationCharacterStatuses` (updated on each generation in
 * that chat), keyed by characterId. This is a plain metadata read, not a schedule recomputation —
 * cheap enough to attach to every opted-in chat_context block without a separate token budget.
 */
function parseConversationCharacterStatuses(metadata: unknown): Record<string, { status: string; activity: string }> {
  const raw = parseRecord(metadata).conversationCharacterStatuses;
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, { status: string; activity: string }> = {};
  for (const [characterId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const status = (value as Record<string, unknown>).status;
    const activity = (value as Record<string, unknown>).activity;
    if (typeof status === "string" && typeof activity === "string") {
      result[characterId] = { status, activity };
    }
  }
  return result;
}

function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

function personaNameFromRow(row: { name?: string | null; convoDisplayName?: string | null } | null | undefined) {
  return row?.convoDisplayName?.trim() || row?.name?.trim() || "User";
}

function characterContextFromRow(row: { id: string; data: unknown; avatarPath?: string | null }) {
  const data = parseRecord(row.data);
  const extensions = parseRecord(data.extensions);
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
  const lines = [`<character name="${escapePromptAttribute(name)}">`];
  for (const [label, value] of [
    ["Description", data.description],
    ["Personality", data.personality],
    ["Scenario", data.scenario],
    ["First message", data.first_mes],
    ["Appearance", data.appearance ?? extensions.appearance],
    ["Backstory", data.backstory ?? extensions.backstory],
  ] as const) {
    if (typeof value === "string" && value.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  lines.push(`</character>`);
  return lines.join("\n");
}

function personaContextFromRow(row: {
  id: string;
  name: string;
  convoDisplayName?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
}) {
  const displayName = row.convoDisplayName?.trim() || row.name || "User";
  const lines = [
    `<persona id="${escapePromptAttribute(row.id)}" accountKey="persona:${escapePromptAttribute(row.id)}" name="${escapePromptAttribute(displayName)}">`,
  ];
  for (const [label, value] of [
    ["Description", row.description],
    ["Personality", row.personality],
    ["Scenario", row.scenario],
    ["Backstory", row.backstory],
    ["Appearance", row.appearance],
  ] as const) {
    if (typeof value === "string" && value.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  lines.push(`</persona>`);
  return lines.join("\n");
}

const NOODLE_CHAT_CONTEXT_MESSAGE_LIMIT = 8;
const NOODLE_CHAT_CONTEXT_CHAT_LIMIT = 8;

async function resolveCharacterName(
  characters: ReturnType<typeof createCharactersStorage>,
  characterId: string,
  cache: Map<string, string>,
) {
  const cached = cache.get(characterId);
  if (cached) return cached;
  const row = await characters.getById(characterId);
  const name = characterNameFromRow(row);
  cache.set(characterId, name);
  return name;
}

async function resolvePersonaName(
  characters: ReturnType<typeof createCharactersStorage>,
  personaId: string | null | undefined,
  cache: Map<string, string>,
) {
  if (!personaId) return "User";
  const cached = cache.get(personaId);
  if (cached) return cached;
  const row = await characters.getPersona(personaId);
  const name = personaNameFromRow(row);
  cache.set(personaId, name);
  return name;
}

function messageRoleLabel(role: string) {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "narrator") return "narrator";
  return "system";
}

export async function buildOptedInChatContext(
  chats: ReturnType<typeof createChatsStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  selectedCharacterIds: string[],
) {
  if (selectedCharacterIds.length === 0) return "No selected character chats are eligible for Noodle context.";
  const selected = new Set(selectedCharacterIds);
  const allChats = await chats.list();
  const relevant = allChats
    .filter((chat) => parseRecord(chat.metadata).noodleTimelineContextEnabled === true)
    .filter((chat) => parseStringArray(chat.characterIds).some((characterId) => selected.has(characterId)));
  const blocks: string[] = [];
  const characterNameCache = new Map<string, string>();
  const personaNameCache = new Map<string, string>();
  for (const chat of relevant) {
    const chatCharacterIds = parseStringArray(chat.characterIds);
    const [personaName, characterNames, messages] = await Promise.all([
      resolvePersonaName(characters, chat.personaId, personaNameCache),
      Promise.all(
        chatCharacterIds.map(async (characterId) => ({
          id: characterId,
          name: await resolveCharacterName(characters, characterId, characterNameCache),
        })),
      ),
      chats.listMessagesPaginated(chat.id, NOODLE_CHAT_CONTEXT_MESSAGE_LIMIT),
    ]);
    if (messages.length === 0) continue;
    const speakerNameByCharacterId = new Map(characterNames.map((character) => [character.id, character.name]));
    const participantLines = [
      `- User persona: ${personaName}`,
      ...characterNames.map((character) => `- Character: ${character.name}`),
    ];
    // Attach each character's current status/activity from this chat's own schedule, if this chat
    // has one. Read-only metadata lookup already updated by that chat's own generation — no new
    // schedule computation and no attempt to reconcile a character's status across multiple chats;
    // each opted-in chat's status stays scoped to its own <chat_context> block, same as messages.
    const characterStatuses = parseConversationCharacterStatuses(chat.metadata);
    const statusLines = characterNames
      .map((character) => {
        const status = characterStatuses[character.id];
        return status ? `- ${character.name}: currently ${status.status} (${status.activity})` : null;
      })
      .filter((line): line is string => Boolean(line));
    const messageLines = await Promise.all(
      messages.map(async (message) => {
        const role = messageRoleLabel(message.role);
        let speaker = role === "user" ? personaName : role === "narrator" ? "Narrator" : "Assistant";
        if (message.characterId) {
          speaker =
            speakerNameByCharacterId.get(message.characterId) ??
            (await resolveCharacterName(characters, message.characterId, characterNameCache));
        }
        const content = String(message.content ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 900);
        return `- ${speaker} (${role}): ${content}`;
      }),
    );
    blocks.push(
      [
        `<chat_context id="${escapePromptAttribute(chat.id)}" mode="${escapePromptAttribute(
          chat.mode,
        )}" name="${escapePromptAttribute(chat.name)}">`,
        "Participants:",
        ...participantLines,
        ...(statusLines.length > 0 ? ["Current status in this story:", ...statusLines] : []),
        "Recent messages:",
        ...messageLines,
        `</chat_context>`,
      ].join("\n"),
    );
    if (blocks.length >= NOODLE_CHAT_CONTEXT_CHAT_LIMIT) break;
  }
  return blocks.length > 0
    ? blocks.join("\n\n")
    : "No opted-in chats with recent messages for the selected characters.";
}

export async function buildRefreshPrompt(input: {
  db: DB;
  noodle: ReturnType<typeof createNoodleStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  chats: ReturnType<typeof createChatsStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  activeAccounts: NoodleAccount[];
  personaAccount: NoodleAccount | null;
  settings: NoodleSettings;
  imageCaptioning: ImageCaptioningRuntime;
  debugMode: boolean;
}) {
  const activeCharacters = input.activeAccounts.filter((account) => account.kind === "character");
  const activeRandomUsers = input.activeAccounts.filter((account) => account.kind === "random_user");
  const selectedCharacterIds = activeCharacters.map((account) => account.entityId);
  const characterRows = await Promise.all(selectedCharacterIds.map((id) => input.characters.getById(id)));
  const personaRow = input.personaAccount ? await input.characters.getPersona(input.personaAccount.entityId) : null;
  const recentCutoff = sinceHoursIso(48);
  const [recentCreatedPosts, recentPersonaComments] = await Promise.all([
    input.noodle.listPosts({ since: recentCutoff, limit: 100 }),
    input.personaAccount
      ? input.noodle.listRepliesByActorSince(input.personaAccount.id, recentCutoff, 100)
      : Promise.resolve([]),
  ]);
  const recentlyCommentedPostIds = noodlePersonaCommentPostIds(recentPersonaComments, input.personaAccount?.id);
  const recentlyCommentedPosts = (
    await Promise.all(recentlyCommentedPostIds.map((postId) => input.noodle.getPostById(postId)))
  ).filter((post): post is NoodlePost => Boolean(post));
  const recentPostById = new Map([...recentCreatedPosts, ...recentlyCommentedPosts].map((post) => [post.id, post]));
  const recentPosts = [...recentPostById.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const enhancedTimelineWriting = input.settings.enableEnhancedTimelineWriting;
  const pastMemorySampleSize = enhancedTimelineWriting
    ? noodlePastMemorySampleSize()
    : noodlePastMemorySampleSize(
        Math.random,
        NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
        NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
      );
  const olderPosts =
    pastMemorySampleSize > 0
      ? (await input.noodle.listPostsBefore(noodlePastMemoryCutoff())).filter((post) => !recentPostById.has(post.id))
      : [];
  let recalledPosts: NoodlePost[];
  if (enhancedTimelineWriting) {
    const activeAccountIds = new Set(input.activeAccounts.map((account) => account.id));
    const activeAccountHandles = new Set(
      input.activeAccounts
        .map((account) => account.handle?.toLowerCase())
        .filter((handle): handle is string => Boolean(handle)),
    );
    const recentAuthorIds = new Set(recentPosts.map((post) => post.authorAccountId));
    const recalledPostRelevanceWeight = (post: NoodlePost): number => {
      let weight = 0.25;
      if (activeAccountIds.has(post.authorAccountId)) weight += 2;
      for (const handle of extractNoodleMentionHandles(post.content ?? "")) {
        if (activeAccountHandles.has(handle)) weight += 1;
      }
      if (recentAuthorIds.has(post.authorAccountId)) weight += 1;
      return weight;
    };
    recalledPosts = sampleNoodlePastMemoriesWeighted(olderPosts, pastMemorySampleSize, recalledPostRelevanceWeight);
  } else {
    recalledPosts = sampleNoodlePastMemories(olderPosts, pastMemorySampleSize);
  }
  const [chatContext, recentInteractions, recalledInteractions] = await Promise.all([
    buildOptedInChatContext(input.chats, input.characters, selectedCharacterIds),
    input.noodle.listInteractions(recentPosts.map((post) => post.id)),
    input.noodle.listInteractions(recalledPosts.map((post) => post.id)),
  ]);

  const promptMacroContext = await buildPromptMacroContext({
    db: input.db,
    characterIds: selectedCharacterIds,
    personaName: personaNameFromRow(personaRow),
    personaPhoneticName: personaRow?.phoneticName ?? "",
    personaDescription: personaRow?.description ?? "",
    personaFields: {
      phoneticName: personaRow?.phoneticName ?? "",
      personality: personaRow?.personality ?? "",
      scenario: personaRow?.scenario ?? "",
      backstory: personaRow?.backstory ?? "",
      appearance: personaRow?.appearance ?? "",
    },
    lastGenerationType: "noodle",
  });
  const resolveNoodleMacros = (value: string) => resolveMacros(value, promptMacroContext, { trimResult: false });
  const characterContext = characterRows
    .filter((row): row is NonNullable<typeof row> => !!row)
    .map((row) => resolveNoodleMacros(characterContextFromRow(row)))
    .join("\n\n");
  const randomUserContext = activeRandomUsers
    .map(
      (account) =>
        `<random_user name="${escapePromptAttribute(account.displayName)}" handle="${escapePromptAttribute(account.handle)}">\nBio: ${
          account.bio || "A casual Noodle user."
        }\n</random_user>`,
    )
    .join("\n\n");
  const personaContext = personaRow
    ? resolveNoodleMacros(personaContextFromRow(personaRow))
    : "No user persona is active.";
  const activeAccountList = [...input.activeAccounts, ...(input.personaAccount ? [input.personaAccount] : [])]
    .map(
      (account) =>
        `- ${account.displayName} (@${account.handle}) kind=${account.kind} accountKey=${account.kind}:${account.entityId} generationRole=${
          account.kind === "persona" ? "reference-target-only" : "allowed-author-and-actor"
        }`,
    )
    .join("\n");

  // Reuse the engine's existing multi-character lorebook system (already used by group chats) so
  // character lore/backstory can surface in Noodle refreshes. Off by default (Settings ->
  // Lorebook context) so existing timelines are unaffected until a user opts in. Oldest-first scan
  // messages from recent timeline text give keyword-scoped entries real content to match against;
  // character context is appended last so entries keyed to a character's own traits stay in scan depth.
  const lorebookResult = input.settings.enableLorebookContext
    ? await processLorebooks(
        input.db,
        [
          ...recentPosts
            .slice()
            .reverse()
            .map((post) => ({ role: "user", content: post.content })),
          ...recentInteractions
            .filter((interaction) => interaction.type === "reply" && interaction.content)
            .map((interaction) => ({ role: "user", content: interaction.content ?? "" })),
          ...(characterContext ? [{ role: "user", content: characterContext }] : []),
        ],
        null,
        {
          characterIds: selectedCharacterIds,
          personaId: input.personaAccount?.entityId ?? null,
          tokenBudget: noodleLorebookTokenBudget(activeCharacters.length),
          generationTriggers: ["noodle"],
          previewOnly: true,
          resolveContent: (value) =>
            resolveMacrosWithVariableSnapshot(value, promptMacroContext, { trimResult: false }),
        },
      )
    : null;
  const loreContext = lorebookResult
    ? [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter].filter(Boolean).join("\n")
    : "";

  // The base timeline prompt and its voice/tone tail are independently editable. The base prompt
  // includes the complete default adult-platform, persona-authorship, interaction, and JSON rules;
  // the voice text is deliberately appended last so users can tune style without hunting through
  // the structural instructions.
  const [timelineBaseText, timelineVoiceText] = await Promise.all([
    loadPrompt(input.promptOverrides, NOODLE_TIMELINE_BASE, {}),
    loadPrompt(input.promptOverrides, NOODLE_TIMELINE_VOICE, {
      enhanced: String(enhancedTimelineWriting),
      allowRandomUsers: String(input.settings.allowRandomUsers),
    }),
  ]);
  const system = composeNoodleTimelineSystemPrompt(timelineBaseText, timelineVoiceText);
  const timelineFeatureInstructions = noodleTimelineFeatureInstructions(input.settings);

  const visionCandidates = await prepareNoodleVisionAttachments([
    ...collectNoodlePromptImageCandidates(recentPosts, recentInteractions, {
      priorityActorAccountId: input.personaAccount?.id,
    }),
    ...collectNoodlePromptImageCandidates(recalledPosts, recalledInteractions, {
      priorityActorAccountId: input.personaAccount?.id,
    }),
  ]);
  const captionedImages = new Map<string, string>();
  let visionAttachments: NoodleVisionAttachment[] = visionCandidates;
  if (input.imageCaptioning.enabled) {
    const captionResults = await generateImageCaptionsForDataUrls(
      visionCandidates.map((attachment) => ({
        filename: attachment.key,
        imageDataUrl: attachment.dataUrl,
        attachment,
      })),
      input.imageCaptioning,
      AbortSignal.timeout(120_000),
      input.debugMode,
    );
    visionAttachments = [];
    for (const result of captionResults) {
      if (result.caption) captionedImages.set(result.input.attachment.key, result.caption);
      else visionAttachments.push(result.input.attachment);
    }
  }
  const attachedImageKeys = new Set(visionAttachments.map((attachment) => attachment.key));
  const visionManifest = formatNoodleVisionManifest(visionAttachments);

  const buildContext = (
    imageKeys: ReadonlySet<string>,
    imageManifest: string,
    imageCaptions: ReadonlyMap<string, string>,
  ) =>
    [
      "# Active Noodle Accounts",
      activeAccountList || "No active accounts.",
      "",
      "# User Persona",
      personaContext,
      "",
      "# Persona Identity Rule",
      NOODLE_PERSONA_IDENTITY_INSTRUCTION,
      "The User Persona above is the identity selected for this refresh only. Historical timeline authors retain the distinct accountKey recorded on their own activity.",
      "",
      "# Character Profiles",
      characterContext || "No character profiles.",
      "",
      ...(loreContext ? ["# World / Lore", loreContext, ""] : []),
      ...(randomUserContext ? ["# Random User Profiles", randomUserContext, ""] : []),
      "# Opted-In Chat Context",
      "Only chats whose Chat Settings allow Noodle references are included here.",
      chatContext,
      "",
      "# Recent Noodle Timeline",
      "Recent persona comments are especially relevant. Characters may naturally respond to them by using the comment replyId as parentInteractionId.",
      formatNoodleTimelineForPrompt(recentPosts, recentInteractions, {
        priorityActorAccountId: input.personaAccount?.id,
        attachedImageKeys: imageKeys,
        imageCaptions,
      }),
      ...(recalledPosts.length > 0
        ? [
            "",
            "# Randomly Recalled Older Noodle Activity",
            enhancedTimelineWriting ? NOODLE_RECALLED_MEMORY_INSTRUCTION : NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION,
            formatNoodleTimelineForPrompt(recalledPosts, recalledInteractions, {
              emptyMessage: "No older Noodle activity was recalled.",
              includeTimestamp: true,
              priorityActorAccountId: input.personaAccount?.id,
              attachedImageKeys: imageKeys,
              imageCaptions,
            }),
          ]
        : []),
      ...(imageManifest ? ["", imageManifest] : []),
      ...(timelineFeatureInstructions.length > 0
        ? ["", "# Enabled Timeline Features", ...timelineFeatureInstructions]
        : []),
      "",
      "# Quotas",
      `posts: at most ${input.settings.maxGeneratedPostsPerRefresh}`,
      `replies: at most ${input.settings.maxRepliesPerRefresh}`,
      `reposts: at most ${input.settings.maxRepostsPerRefresh}`,
      `likes: at most ${input.settings.maxLikesPerRefresh}`,
      "follows: optional; use sparingly when an account would naturally follow another active account after today's public activity.",
      input.settings.enableImagePrompts
        ? `image generation: at most ${input.settings.maxImagesPerRefresh} images this refresh; imagePrompt may request either a character image or a meme. For character images, describe concrete appearance, build, clothing, and scene composition. For memes, describe the meme format, visual gag, intended caption/text if any, and why it fits the author's personality.`
        : "image generation: disabled; omit imagePrompt or return null.",
      input.settings.allowGalleryImageAttachments
        ? "gallery attachments: enabled; you may set attachGalleryImage true on posts that should reuse existing character/chat gallery media."
        : "gallery attachments: disabled; set attachGalleryImage false or omit it.",
    ].join("\n");

  const context = buildContext(attachedImageKeys, visionManifest, captionedImages);
  const textOnlyContext = buildContext(new Set(), "", captionedImages);

  const outputFormat = [
    NOODLE_JSON_OUTPUT_HEADING,
    JSON.stringify(
      {
        posts: [
          {
            tempId: "local id used only inside this response",
            authorHandle: "exact @handle of a non-persona account allowed to author generated activity",
            content: "post text",
            poll: { question: "optional poll question", options: ["first answer", "second answer"] },
            imagePrompt: "optional image prompt or null",
            attachGalleryImage: false,
          },
        ],
        interactions: [
          {
            actorHandle: "exact @handle of a non-persona account allowed to perform generated activity",
            targetTempId: "tempId from posts, if targeting a newly created post",
            targetPostId: "existing post id, if targeting an existing post",
            parentInteractionId: "existing replyId when directly answering a comment, otherwise null",
            type: "like | repost | reply | vote",
            content: "required for reply, optional/null otherwise",
            pollOptionIndex: 1,
          },
        ],
        follows: [
          {
            actorHandle: "exact @handle of a non-persona account allowed to perform generated activity",
            targetHandle: "exact @handle from Active Noodle Accounts",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");

  const messages = [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: context,
      ...(visionAttachments.length > 0 ? { images: visionAttachments.map((attachment) => attachment.dataUrl) } : {}),
    },
    { role: "user" as const, content: outputFormat },
  ] satisfies ChatMessage[];
  const textOnlyMessages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: textOnlyContext },
    { role: "user" as const, content: outputFormat },
  ] satisfies ChatMessage[];
  return {
    messages,
    textOnlyMessages,
    promptForLog: `${system}\n\n${context}\n\n${outputFormat}\n\n[${visionAttachments.length} Noodle timeline image input(s) attached]`,
    textOnlyPromptForLog: `${system}\n\n${textOnlyContext}\n\n${outputFormat}`,
    visionAttachmentCount: visionAttachments.length,
    captionedImageCount: captionedImages.size,
    recalledPostIds: recalledPosts.map((post) => post.id),
    lorebookActivatedEntryIds: lorebookResult?.activatedEntryIds ?? [],
  };
}
