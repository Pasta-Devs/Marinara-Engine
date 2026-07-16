// ──────────────────────────────────────────────
// Routes: Noodle Fake Social Media
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import {
  createNoodlePoll,
  canManageNoodleReply,
  extractNoodleMentionHandles,
  noodleAccountUpdateSchema,
  noodleBulkInviteSchema,
  noodleCreateInteractionSchema,
  noodleCreatePostSchema,
  noodleInviteSchema,
  noodleInteractionOwnerSchema,
  noodleInteractionUpdateSchema,
  noodlePostUpdateSchema,
  noodleRemoveInteractionSchema,
  noodleRescheduleRefreshSchema,
  noodleRefreshSchema,
  noodleSettingsUpdateSchema,
  PROFESSOR_MARI_ID,
  readNoodlePollFromMetadata,
  type APIProvider,
  type NoodleAccount,
  type NoodleBootstrap,
  type NoodleInteraction,
  type NoodleInteractionType,
  type NoodlePost,
  type NoodleRefreshAttemptKind,
  type NoodleSettings,
} from "@marinara-engine/shared";
import type { ChatMessage } from "../services/llm/base-provider.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createNoodleStorage, parseNoodleAvatarCrop } from "../services/storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../services/llm/connection-fallback-provider.js";
import { generateImage, saveImageToDisk } from "../services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import {
  loadPrompt,
  NOODLE_IMAGE_POST,
  NOODLE_TIMELINE_BASE,
  NOODLE_TIMELINE_VOICE,
} from "../services/prompt-overrides/index.js";
import { parseGameJsonish } from "../services/game/jsonish.js";
import { resolveIllustratorCharacterReferences } from "./generate/illustrator-references.js";
import { resolveBaseUrl } from "./generate/generate-route-utils.js";
import { logger, logDebugOverride } from "../lib/logger.js";
import { clampGenerationMaxOutputTokens } from "../services/generation/output-token-limits.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import {
  noodleRefreshSchedulerStatus,
  rescheduleNoodleRefreshTime,
} from "../services/noodle/noodle-refresh-schedule.js";
import { NOODLE_JSON_OUTPUT_HEADING, noodleResponseFormat } from "../services/noodle/noodle-response-format.js";
import { generateNoodleImageWithRetry } from "../services/noodle/noodle-image-retry.js";
import {
  canGenerateNoodleActivityForAccountKind,
  collectNoodlePromptImageCandidates,
  composeNoodleTimelineSystemPrompt,
  formatNoodleTimelineForPrompt,
  noodleLorebookTokenBudget,
  noodlePastMemoryCutoff,
  noodlePastMemorySampleSize,
  noodlePersonaCommentPostIds,
  NOODLE_ADULT_PLATFORM_POLICY,
  NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE,
  NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS,
  NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION,
  NOODLE_PERSONA_IDENTITY_INSTRUCTION,
  NOODLE_RECALLED_MEMORY_INSTRUCTION,
  noodleTimelineFeatureInstructions,
  sampleNoodlePastMemories,
  sampleNoodlePastMemoriesWeighted,
} from "../services/noodle/noodle-prompt.js";
import { processLorebooks } from "../services/lorebook/index.js";
import type { DB } from "../db/connection.js";
import {
  generateImageCaptionForDataUrl,
  resolveImageCaptioningRuntime,
  type ImageCaptioningRuntime,
} from "./generate/image-captioning-runtime.js";
import {
  formatNoodleVisionManifest,
  isUnsupportedNoodleVisionInputError,
  prepareNoodleVisionAttachments,
  type NoodleVisionAttachment,
} from "../services/noodle/noodle-vision.js";
import { chooseNoodleParticipantAccounts } from "../services/noodle/noodle-participant-selection.js";
import { canCreateGeneratedNoodleInteraction } from "../services/noodle/noodle-interaction-policy.js";
import { parseNoodleGeneratedProfiles } from "../services/noodle/noodle-generated-profiles.js";
import {
  parseNoodleGeneratedRefresh,
  validateNoodleGeneratedRefresh,
} from "../services/noodle/noodle-generated-refresh.js";
import { normalizeNoodleImagePrompt } from "../services/noodle/noodle-image-prompt.js";
import { normalizeNoodleHandle } from "../services/noodle/noodle-handle.js";
import { resolveNoodleAvatarCropAfterProfileUpdate } from "../services/noodle/noodle-profile-avatar.js";

const NOODLE_ROUTE_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC_DIR = resolve(NOODLE_ROUTE_DIR, "../../../client/public");
const NOODLE_FOLLOWED_AT_BY_ACCOUNT_KEY = "followingAccountTimestamps";
const PROFESSOR_MARI_REFERENCE_ASSETS = [
  "sprites/mari/Mari_profile.png",
  "sprites/mari/chibi-professor-mari.png",
] as const;

function readProfessorMariReferenceImages(): string[] {
  return PROFESSOR_MARI_REFERENCE_ASSETS.flatMap((relativePath) => {
    const filePath = resolve(CLIENT_PUBLIC_DIR, relativePath);
    if (!existsSync(filePath)) return [];
    try {
      return [readFileSync(filePath).toString("base64")];
    } catch {
      return [];
    }
  });
}

function characterAvatarCrop(row: { data: unknown }) {
  return parseNoodleAvatarCrop(parseRecord(parseRecord(row.data).extensions).avatarCrop);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

function characterNameFromRow(row: { data: unknown } | null | undefined) {
  const data = parseRecord(row?.data);
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
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

function characterAppearanceFromRow(row: { data: unknown }) {
  const data = parseRecord(row.data);
  const extensions = parseRecord(data.extensions);
  const value = data.appearance ?? extensions.appearance ?? data.description;
  return typeof value === "string" ? value.trim() : "";
}

function galleryImageUrl(filePath: string, fallbackChatId: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/gallery/file/${encodeURIComponent(fallbackChatId)}/${encodeURIComponent(filename)}`;
}

function characterGalleryImageUrl(characterId: string, filePath: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

function readBoolSetting(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return value === true || value === "true";
}

function isProfileGenerated(account: NoodleAccount) {
  return readBoolSetting(account.settings, "profileGenerated");
}

function mentionedCharacterAccounts(accounts: NoodleAccount[], content: string): NoodleAccount[] {
  const mentionedHandles = new Set(extractNoodleMentionHandles(content));
  if (mentionedHandles.size === 0) return [];
  return accounts.filter(
    (account) => account.kind === "character" && mentionedHandles.has(account.handle.toLowerCase()),
  );
}

function mentionedAccountMetadata(accounts: NoodleAccount[]) {
  return {
    mentionedAccountIds: accounts.map((account) => account.id),
    mentionedEntityIds: accounts.map((account) => account.entityId),
  };
}

function generatedProfileSettings(settings: Record<string, unknown>, location: string, bannerUrl: string | null) {
  return {
    ...settings,
    profileGenerated: true,
    location,
    bannerUrl: bannerUrl ?? "",
  };
}

function profileSetupMaxTokens(characterCount: number) {
  return 1024 + Math.max(0, characterCount) * 1024;
}

function timelineRefreshMaxTokens(characterCount: number) {
  return 4096 + Math.max(0, characterCount) * 1024;
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

const RANDOM_NOODLE_USERS = [
  {
    entityId: "random_user:thread-countess",
    displayName: "Thread Countess",
    bio: "Chronically online textile hobbyist who treats every Noodle argument like court gossip.",
  },
  {
    entityId: "random_user:packet-soup",
    displayName: "Packet Soup",
    bio: "Friendly lurker, recipe collector, and accidental drama amplifier.",
  },
  {
    entityId: "random_user:orbit-notice",
    displayName: "Orbit Notice",
    bio: "Posts vague observations, likes too quickly, and follows anyone with interesting chaos.",
  },
  {
    entityId: "random_user:glass-bulletin",
    displayName: "Glass Bulletin",
    bio: "Local rumor account with polished manners and questionable sources.",
  },
  {
    entityId: "random_user:moth-hour",
    displayName: "Moth Hour",
    bio: "Night-scroller who replies with eerie encouragement and niche memes.",
  },
  {
    entityId: "random_user:brine-index",
    displayName: "Brine Index",
    bio: "Overconfident commentator who keeps a spreadsheet of everyone else's scandals.",
  },
] as const;

const PROFESSOR_MARI_NOODLE_BIO =
  "She/Her | 18+ | Skill Issue | Your Assistant After Hours (hey, I get to do fun stuff, too!) | Simp for Il Dottore 24/7 | LLMs Fan";

export function collectNoodlePriorityAccountIds(input: {
  accounts: NoodleAccount[];
  posts: NoodlePost[];
  interactions: NoodleInteraction[];
  personaAccount: NoodleAccount | null;
}): Set<string> {
  const priority = new Set<string>();
  if (!input.personaAccount) return priority;
  const accountByHandle = new Map(input.accounts.map((account) => [account.handle.toLowerCase(), account]));
  const interactionById = new Map(input.interactions.map((interaction) => [interaction.id, interaction]));
  const addMentionedAccounts = (content: string | null | undefined) => {
    for (const handle of extractNoodleMentionHandles(content ?? "")) {
      const account = accountByHandle.get(handle);
      if (account && account.kind !== "persona") priority.add(account.id);
    }
  };

  for (const post of input.posts) {
    if (post.authorAccountId === input.personaAccount.id) addMentionedAccounts(post.content);
  }
  for (const interaction of input.interactions) {
    if (interaction.actorAccountId === input.personaAccount.id) {
      addMentionedAccounts(interaction.content);
      const post = input.posts.find((candidate) => candidate.id === interaction.postId);
      if (post && post.authorAccountId !== input.personaAccount.id) priority.add(post.authorAccountId);
      const parent = interaction.parentInteractionId ? interactionById.get(interaction.parentInteractionId) : null;
      if (parent && parent.actorAccountId !== input.personaAccount.id) priority.add(parent.actorAccountId);
      continue;
    }
    if (extractNoodleMentionHandles(interaction.content ?? "").includes(input.personaAccount.handle.toLowerCase())) {
      priority.add(interaction.actorAccountId);
    }
  }
  return priority;
}

async function pickGalleryAttachmentForAccount(input: {
  account: NoodleAccount;
  chats: ReturnType<typeof createChatsStorage>;
  gallery: ReturnType<typeof createGalleryStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
}) {
  if (input.account.kind !== "character") return null;

  const characterImages = await input.characterGallery.listByCharacterId(input.account.entityId);
  const characterImage = characterImages[0];
  if (characterImage) {
    return {
      imageUrl: characterGalleryImageUrl(input.account.entityId, characterImage.filePath),
      metadata: {
        galleryAttachmentSource: "character-gallery",
        galleryAttachmentId: characterImage.id,
      },
    };
  }

  const chats = await input.chats.list();
  const chatIds = chats
    .filter((chat) => parseStringArray(chat.characterIds).includes(input.account.entityId))
    .map((chat) => chat.id)
    .slice(0, 20);
  const chatImages = await input.gallery.listByChatIds(chatIds);
  const chatImage = chatImages[0];
  if (!chatImage) return null;
  return {
    imageUrl: galleryImageUrl(chatImage.filePath, chatImage.chatId),
    metadata: {
      galleryAttachmentSource: "chat-gallery",
      galleryAttachmentId: chatImage.id,
      galleryAttachmentChatId: chatImage.chatId,
    },
  };
}

async function pickRandomCharacterBannerUrl(
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>,
  characterId: string,
) {
  const images = await characterGallery.listByCharacterId(characterId);
  const image = images.length > 0 ? shuffle(images)[0] : null;
  return image ? characterGalleryImageUrl(characterId, image.filePath) : null;
}

async function ensureRandomUserAccounts(noodle: ReturnType<typeof createNoodleStorage>) {
  for (const profile of RANDOM_NOODLE_USERS) {
    await noodle.upsertAccountFromProfile({
      kind: "random_user",
      entityId: profile.entityId,
      displayName: profile.displayName,
      bio: profile.bio,
      invited: true,
    });
  }
}

async function ensureProfessorMariAccount(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const row = await characters.getById(PROFESSOR_MARI_ID);
  const account = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: PROFESSOR_MARI_ID,
    displayName: row ? characterNameFromRow(row) : "Professor Mari",
    avatarUrl: row?.avatarPath ?? "/sprites/mari/Mari_profile.png",
    avatarCrop: row ? characterAvatarCrop(row) : null,
    bio: PROFESSOR_MARI_NOODLE_BIO,
    invited: true,
    syncIdentity: true,
  });
  if (
    account.settings.profileManuallyEdited !== true &&
    (account.bio !== PROFESSOR_MARI_NOODLE_BIO || !isProfileGenerated(account) || !account.settings.location)
  ) {
    await noodle.updateAccount(account.id, {
      handle: account.handle || "professor_mari",
      displayName: account.displayName || "Professor Mari",
      bio: PROFESSOR_MARI_NOODLE_BIO,
      avatarUrl: account.avatarUrl || row?.avatarPath || "/sprites/mari/Mari_profile.png",
      settings: generatedProfileSettings(account.settings, "Marinara Engine", null),
    });
  }
}

async function ensureSelectedGroupCharacterAccounts(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  groupIds: string[],
) {
  const selectedGroupIds = new Set(groupIds);
  if (selectedGroupIds.size === 0) return new Set<string>();
  const groups = await characters.listGroups();
  const selectedCharacterIds = new Set<string>();
  for (const group of groups) {
    if (!selectedGroupIds.has(group.id)) continue;
    for (const characterId of parseStringArray(group.characterIds)) selectedCharacterIds.add(characterId);
  }

  for (const characterId of selectedCharacterIds) {
    const row = await characters.getById(characterId);
    if (!row) continue;
    await noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: characterNameFromRow(row),
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      bio: String(parseRecord(row.data).description ?? ""),
      syncIdentity: true,
    });
  }
  return selectedCharacterIds;
}

async function ensurePersonaAccounts(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const personas = await characters.listPersonas();
  const livePersonaIds = new Set<string>();
  for (const persona of personas) {
    livePersonaIds.add(persona.id);
    await noodle.upsertAccountFromProfile({
      kind: "persona",
      entityId: persona.id,
      displayName: persona.convoDisplayName || persona.name || "User",
      avatarUrl: persona.avatarPath ?? null,
      avatarCrop: parseNoodleAvatarCrop(persona.avatarCrop),
      bio: persona.aboutMe || persona.description || "",
      invited: true,
    });
  }
  return livePersonaIds;
}

function filterStalePersonaAccounts(bootstrap: NoodleBootstrap, livePersonaIds: Set<string>): NoodleBootstrap {
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "persona" || livePersonaIds.has(account.entityId),
    ),
  };
}

function filterExcludedNoodleAccounts(bootstrap: NoodleBootstrap, settings: NoodleSettings): NoodleBootstrap {
  if (settings.allowProfessorMari) return bootstrap;
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "character" || account.entityId !== PROFESSOR_MARI_ID,
    ),
  };
}

async function bootstrapVisibleNoodle(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const settings = await noodle.getSettings();
  const livePersonaIds = await ensurePersonaAccounts(noodle, characters);
  if (settings.allowProfessorMari) await ensureProfessorMariAccount(noodle, characters);
  const existingCharacterAccounts = (await noodle.listAccounts()).filter(
    (account) => account.kind === "character" && account.entityId !== PROFESSOR_MARI_ID,
  );
  const characterRowsById = new Map((await characters.list()).map((row) => [row.id, row]));
  for (const account of existingCharacterAccounts) {
    const row = characterRowsById.get(account.entityId);
    if (!row) continue;
    await noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: characterNameFromRow(row),
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      syncIdentity: true,
    });
  }
  return filterExcludedNoodleAccounts(filterStalePersonaAccounts(await noodle.bootstrap(), livePersonaIds), settings);
}

async function resolvePersonaAccount(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  personaId?: string,
) {
  const personas = await characters.listPersonas();
  const persona =
    personas.find((p) => p.id === personaId) ?? personas.find((p) => p.isActive === "true") ?? personas[0];
  if (!persona) return null;
  return noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: persona.id,
    displayName: persona.convoDisplayName || persona.name || "User",
    avatarUrl: persona.avatarPath ?? null,
    avatarCrop: parseNoodleAvatarCrop(persona.avatarCrop),
    bio: persona.aboutMe || persona.description || "",
    invited: true,
  });
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

async function buildOptedInChatContext(
  chats: ReturnType<typeof createChatsStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  selectedCharacterIds: string[],
) {
  if (selectedCharacterIds.length === 0) return "No selected character chats are eligible for Noodle context.";
  const selected = new Set(selectedCharacterIds);
  const allChats = await chats.list();
  const relevant = allChats
    .filter((chat) => parseRecord(chat.metadata).noodleTimelineContextEnabled === true)
    .filter((chat) => parseStringArray(chat.characterIds).some((characterId) => selected.has(characterId)))
    .slice(0, NOODLE_CHAT_CONTEXT_CHAT_LIMIT);
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
  }
  return blocks.length > 0
    ? blocks.join("\n\n")
    : "No opted-in chats with recent messages for the selected characters.";
}

async function buildRefreshPrompt(input: {
  db: DB;
  noodle: ReturnType<typeof createNoodleStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  chats: ReturnType<typeof createChatsStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  activeAccounts: NoodleAccount[];
  personaAccount: NoodleAccount | null;
  settings: NoodleSettings;
  imageCaptioning: ImageCaptioningRuntime;
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
    : noodlePastMemorySampleSize(Math.random, NOODLE_LEGACY_PAST_MEMORY_INCLUSION_CHANCE, NOODLE_LEGACY_PAST_MEMORY_MAX_ITEMS);
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

  const characterContext = characterRows
    .filter((row): row is NonNullable<typeof row> => !!row)
    .map(characterContextFromRow)
    .join("\n\n");
  const randomUserContext = activeRandomUsers
    .map(
      (account) =>
        `<random_user name="${escapePromptAttribute(account.displayName)}" handle="${escapePromptAttribute(account.handle)}">\nBio: ${
          account.bio || "A casual Noodle user."
        }\n</random_user>`,
    )
    .join("\n\n");
  const personaContext = personaRow ? personaContextFromRow(personaRow) : "No user persona is active.";
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
    const captionResults = await Promise.all(
      visionCandidates.map(async (attachment) => ({
        attachment,
        caption: await generateImageCaptionForDataUrl(
          attachment.key,
          attachment.dataUrl,
          input.imageCaptioning,
          AbortSignal.timeout(120_000),
        ),
      })),
    );
    visionAttachments = [];
    for (const result of captionResults) {
      if (result.caption) captionedImages.set(result.attachment.key, result.caption);
      else visionAttachments.push(result.attachment);
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

async function generateMissingNoodleProfiles(input: {
  noodle: ReturnType<typeof createNoodleStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  accounts: NoodleAccount[];
  provider: ReturnType<typeof createLLMProvider>;
  connection: {
    provider: string;
    model: string;
    maxTokensOverride?: number | null;
  };
  debugMode: boolean;
}) {
  const targets: Array<{
    account: NoodleAccount;
    row: { id: string; data: unknown; avatarPath?: string | null };
    bannerUrl: string | null;
  }> = [];
  for (const account of input.accounts) {
    if (account.kind !== "character" || isProfileGenerated(account)) continue;
    const row = await input.characters.getById(account.entityId);
    if (!row) continue;
    const bannerUrl = await pickRandomCharacterBannerUrl(input.characterGallery, account.entityId);
    targets.push({ account, row, bannerUrl });
  }
  if (targets.length === 0) return;

  const characterBlocks = targets
    .map(({ account, row }) =>
      [
        `<profile_target entityId="${account.entityId}" currentName="${account.displayName}" currentHandle="${account.handle}">`,
        characterContextFromRow(row),
        `</profile_target>`,
      ].join("\n"),
    )
    .join("\n\n");
  const outputFormat = [
    NOODLE_JSON_OUTPUT_HEADING,
    JSON.stringify(
      {
        profiles: [
          {
            entityId: "exact entityId from profile_target",
            name: "display name for the social profile",
            handle: "short @nickname without @, lowercase letters/numbers/underscores preferred",
            bio: "short in-character social media bio",
            location: "short profile location, fictional or canonical if known",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You set up fake Noodle social media profiles for existing Marinara Engine characters.",
        NOODLE_ADULT_PLATFORM_POLICY,
        "Create concise profile metadata only. Do not write posts, replies, likes, or timeline content.",
        "Use each character's personality, setting, and appearance to make the profile feel natural and in character.",
        "Return JSON only. No prose outside the JSON object.",
      ].join("\n"),
    },
    {
      role: "user",
      content: ["# Characters Needing Noodle Profiles", characterBlocks, "", outputFormat].join("\n"),
    },
  ];
  const promptForLog = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
  logDebugOverride(input.debugMode, "[debug/noodle] Profile prompt sent to model:\n%s", promptForLog);
  const maxTokens = clampGenerationMaxOutputTokens({
    provider: input.connection.provider as APIProvider,
    model: input.connection.model,
    maxTokens: profileSetupMaxTokens(targets.length),
    maxTokensOverride: input.connection.maxTokensOverride,
  });
  const result = await input.provider.chatComplete(messages, {
    model: input.connection.model,
    maxTokens,
    temperature: 0.55,
    topP: 0.9,
    stream: false,
    debugMode: input.debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "profiles"),
  });
  const generated = parseNoodleGeneratedProfiles(parseGameJsonish(result.content ?? ""));
  if (generated.rejected.length > 0) {
    logger.warn(
      "[noodle] Skipped %d invalid generated profile row(s); valid profiles will still be applied",
      generated.rejected.length,
    );
  }
  const profileByEntityId = new Map(generated.profiles.map((profile) => [profile.entityId, profile]));

  for (const target of targets) {
    const profile = profileByEntityId.get(target.account.entityId);
    if (!profile) continue;
    await input.noodle.updateAccount(target.account.id, {
      handle: profile.handle,
      displayName: profile.name,
      bio: profile.bio,
      avatarUrl: target.row.avatarPath ?? target.account.avatarUrl,
      settings: generatedProfileSettings(target.account.settings, profile.location, target.bannerUrl),
    });
  }
}

function interactionDigestVerb(type: NoodleInteractionType) {
  if (type === "reply") return "replied on";
  if (type === "repost") return "reposted";
  if (type === "vote") return "voted in";
  return "liked";
}

function noodleDigestAccountLabel(account: Pick<NoodleAccount, "kind" | "displayName" | "handle">) {
  const identity = `${account.displayName} (@${account.handle})`;
  return account.kind === "persona" ? `Persona ${identity}` : identity;
}

async function generateNoodlePostImage(input: {
  account: NoodleAccount;
  referenceAccounts: NoodleAccount[];
  postContent: string;
  draftPrompt: string;
  settings: NoodleSettings;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;
  app: FastifyInstance;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
}) {
  const imageSettings = await loadImageGenerationUserSettings(input.app.db);
  const imageDefaults = resolveConnectionImageDefaults(input.imageConnection);
  const imageModel = input.imageConnection.model || "";
  const imageBaseUrl = input.imageConnection.baseUrl || "https://image.pollinations.ai";
  const imageSource = input.imageConnection.imageGenerationSource || imageModel;
  const imageServiceHint = input.imageConnection.imageService || imageSource;
  const imageFallback = await resolveImageConnectionFallback(
    createConnectionsStorage(input.app.db),
    input.imageConnection.id,
  );
  let characterDescription = "";
  let referenceImages: string[] | undefined;

  if (
    input.account.kind === "character" &&
    (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences)
  ) {
    const character = await input.characters.getById(input.account.entityId);
    if (character) {
      const referenceAccountByEntityId = new Map(
        [input.account, ...input.referenceAccounts]
          .filter((account) => account.kind === "character")
          .map((account) => [account.entityId, account]),
      );
      const referenceRows = await Promise.all(
        Array.from(referenceAccountByEntityId.keys()).map((characterId) => input.characters.getById(characterId)),
      );
      const chatCharacters = referenceRows
        .filter((row): row is NonNullable<typeof row> => !!row)
        .map((row) => {
          const account = referenceAccountByEntityId.get(row.id);
          return {
            id: row.id,
            name: account?.displayName || characterNameFromRow(row),
            avatarPath: row.avatarPath ?? null,
            appearance: characterAppearanceFromRow(row),
          };
        });
      const referenceResolution = await resolveIllustratorCharacterReferences({
        charactersStore: input.characters,
        chatCharacters,
        persona: null,
        requestedNames: [input.account.displayName],
        promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
        maxReferences: 6,
      });
      if (input.settings.imageGenerationIncludeDescriptions && referenceResolution.appearanceBlock) {
        characterDescription = referenceResolution.appearanceBlock;
      }
      if (input.settings.imageGenerationUseAvatarReferences) {
        const builtInMariReferences =
          input.account.entityId === PROFESSOR_MARI_ID ? readProfessorMariReferenceImages() : [];
        const combinedReferences = [...builtInMariReferences, ...referenceResolution.referenceImages];
        if (combinedReferences.length > 0) {
          referenceImages = Array.from(new Set(combinedReferences)).slice(0, 6);
        }
      }
    }
  }

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription,
  });
  const compiledPrompt = compileImagePrompt({
    kind: "illustration",
    prompt: postPrompt,
    styleProfiles: imageSettings.styleProfiles,
    imageDefaults,
  });
  const finalPrompt = input.promptOverride?.prompt.trim() || compiledPrompt.prompt;
  const finalNegativePrompt = input.promptOverride
    ? input.promptOverride.negativePrompt?.trim() || undefined
    : compiledPrompt.negativePrompt || undefined;
  logDebugOverride(
    input.debugMode,
    "[debug/noodle/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );
  if (finalNegativePrompt) {
    logDebugOverride(input.debugMode, "[debug/noodle/image] negative prompt:\n%s", finalNegativePrompt);
  }

  if (input.previewOnly) {
    return {
      imageUrl: null,
      metadata: {},
      preview: {
        kind: "illustration" as const,
        title: `${input.account.displayName} Noodle image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: imageSettings.illustration.width,
        height: imageSettings.illustration.height,
      },
    };
  }

  const image = await generateNoodleImageWithRetry(
    () =>
      generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        model: imageModel,
        width: imageSettings.illustration.width,
        height: imageSettings.illustration.height,
        imageEndpointId: input.imageConnection.imageEndpointId || undefined,
        comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
        imageDefaults,
        referenceImages,
        fallback: imageFallback,
      }),
    (error, attempt, maxAttempts) => {
      logger.warn(
        error,
        "[noodle] Image generation attempt %d/%d failed for %s",
        attempt,
        maxAttempts,
        input.account.displayName,
      );
    },
  );
  const provider = input.imageConnection.provider ?? "image_generation";
  if (input.account.kind === "character") {
    const filePath = saveImageToDisk(`characters/${input.account.entityId}`, image.base64, image.ext);
    const galleryImage = await input.characterGallery.create({
      characterId: input.account.entityId,
      filePath,
      prompt: finalPrompt,
      provider,
      model: imageModel || "unknown",
      width: imageSettings.illustration.width,
      height: imageSettings.illustration.height,
    });
    return {
      imageUrl: characterGalleryImageUrl(input.account.entityId, filePath),
      metadata: {
        imageGenerated: true,
        imageProvider: provider,
        imageModel: imageModel || "unknown",
        imageStyleProfileId: compiledPrompt.profile.id,
        characterGalleryImageId: galleryImage?.id ?? null,
      },
      preview: null,
    };
  }

  const filePath = saveImageToDisk("noodle", image.base64, image.ext);
  return {
    imageUrl: galleryImageUrl(filePath, "noodle"),
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
    },
    preview: null,
  };
}

const noodleImagePromptConfirmationSchema = z.object({
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().trim().min(1).max(20_000),
        negativePrompt: z.string().trim().max(20_000).optional(),
      }),
    )
    .max(20),
  debugMode: z.boolean().optional(),
});

export async function noodleRoutes(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const chats = createChatsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const gallery = createGalleryStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const promptOverrides = createPromptOverridesStorage(app.db);
  let refreshInFlight = false;

  app.get("/", async () => {
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.put("/settings", async (req, reply) => {
    const parsed = noodleSettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return noodle.updateSettings(parsed.data);
  });

  app.put("/refresh-schedule", async (req, reply) => {
    const parsed = noodleRescheduleRefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (refreshInFlight) return reply.code(409).send({ error: "Wait for the current Noodle refresh to finish." });
    const at = new Date();
    const schedule = await noodle.ensureRefreshSchedule(at);
    try {
      const rescheduled = rescheduleNoodleRefreshTime(schedule, parsed.data.scheduledTime, parsed.data.time, at);
      await noodle.saveRefreshSchedule(rescheduled);
      return noodleRefreshSchedulerStatus(rescheduled, at);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Could not reschedule refresh." });
    }
  });

  app.put("/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const existing = await noodle.getAccountById(id);
    if (!existing) return reply.code(404).send({ error: "Noodle account not found" });
    const sourceCharacter = existing.kind === "character" ? await characters.getById(existing.entityId) : null;
    const avatarCrop = resolveNoodleAvatarCropAfterProfileUpdate({
      currentAvatarUrl: existing.avatarUrl,
      nextAvatarUrl: parsed.data.avatarUrl,
      currentCrop: existing.avatarCrop,
      sourceAvatarUrl: sourceCharacter?.avatarPath,
      sourceCrop: sourceCharacter ? characterAvatarCrop(sourceCharacter) : null,
    });
    const profileFieldsChanged =
      existing.kind === "character" &&
      (parsed.data.handle !== undefined ||
        parsed.data.displayName !== undefined ||
        parsed.data.bio !== undefined ||
        parsed.data.avatarUrl !== undefined ||
        parsed.data.settings?.avatarCrop !== undefined ||
        parsed.data.settings?.bannerUrl !== undefined ||
        parsed.data.settings?.location !== undefined);
    const updated = await noodle.updateAccount(id, {
      ...parsed.data,
      ...(profileFieldsChanged
        ? {
            settings: {
              ...existing.settings,
              ...parsed.data.settings,
              ...(avatarCrop !== undefined ? { avatarCrop } : {}),
              profileManuallyEdited: true,
            },
          }
        : {}),
    });
    if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
    return updated;
  });

  app.post("/invites", async (req, reply) => {
    const parsed = noodleInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const row = await characters.getById(parsed.data.characterId);
    if (!row) return reply.code(404).send({ error: "Character not found" });
    const name = characterNameFromRow(row);
    return noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: name,
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      bio: String(parseRecord(row.data).description ?? ""),
      invited: true,
      syncIdentity: true,
    });
  });

  app.post("/invites/bulk", async (req, reply) => {
    const parsed = noodleBulkInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const uniqueCharacterIds = Array.from(new Set(parsed.data.characterIds));
    const accounts: NoodleAccount[] = [];
    for (const characterId of uniqueCharacterIds) {
      const row = await characters.getById(characterId);
      if (!row) continue;
      accounts.push(
        await noodle.upsertAccountFromProfile({
          kind: "character",
          entityId: row.id,
          displayName: characterNameFromRow(row),
          avatarUrl: row.avatarPath ?? null,
          avatarCrop: characterAvatarCrop(row),
          bio: String(parseRecord(row.data).description ?? ""),
          invited: true,
          syncIdentity: true,
        }),
      );
    }
    return accounts;
  });

  app.delete("/invites", async () => {
    await Promise.all([
      noodle.clearCharacterInvites(),
      noodle.updateSettings({ invitedCharacterGroupIds: [], allowRandomUsers: false }),
    ]);
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.delete("/invites/:characterId", async (req, reply) => {
    const { characterId } = req.params as { characterId: string };
    const account = await noodle.setCharacterInvited(characterId, false);
    if (!account) return reply.code(404).send({ error: "Noodle character account not found" });
    return account;
  });

  app.post("/posts", async (req, reply) => {
    const parsed = noodleCreatePostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let account = await noodle.getAccountByEntity(parsed.data.authorKind, parsed.data.authorEntityId);
    if (!account && parsed.data.authorKind === "persona") {
      account = await resolvePersonaAccount(noodle, characters, parsed.data.authorEntityId);
    }
    if (!account) return reply.code(404).send({ error: "Noodle account not found" });
    const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), parsed.data.content);
    const poll = parsed.data.poll ? createNoodlePoll(parsed.data.poll) : null;
    const post = await noodle.createPost({
      authorAccountId: account.id,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
      imagePrompt: parsed.data.imagePrompt ?? null,
      parentPostId: parsed.data.parentPostId ?? null,
      quotePostId: parsed.data.quotePostId ?? null,
      source: "manual",
      metadata: { ...mentionedAccountMetadata(mentionedAccounts), ...(poll ? { poll } : {}) },
    });
    if (!post) return reply.code(404).send({ error: "Noodle author not found" });
    const digest = await noodle.createDigest({
      accountIds: [account.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
      content: `${noodleDigestAccountLabel(account)} posted on Noodle: ${post.content}`,
      sourcePostId: post.id,
    });
    return (await noodle.updatePostMedia(post.id, { metadata: { activityDigestId: digest.id } })) ?? post;
  });

  app.patch("/posts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodlePostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let post = await noodle.updatePost(id, parsed.data);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.content !== undefined) {
      const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), post.content);
      post =
        (await noodle.updatePostMedia(post.id, {
          metadata: mentionedAccountMetadata(mentionedAccounts),
        })) ?? post;
      const digestId = post.metadata.activityDigestId;
      const author = await noodle.getAccountById(post.authorAccountId);
      if (typeof digestId === "string" && digestId && author) {
        await noodle.updateDigest(digestId, {
          accountIds: [author.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
          content: `${noodleDigestAccountLabel(author)} posted on Noodle: ${post.content}`,
        });
      }
    }
    return post;
  });

  app.delete("/posts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await noodle.deletePost(id);
    if (!deleted) return reply.code(404).send({ error: "Noodle post not found" });
    return deleted;
  });

  app.delete("/timeline", async () => {
    await noodle.resetTimeline();
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.post("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const post = await noodle.getPostById(id);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.type === "vote") {
      const poll = readNoodlePollFromMetadata(post.metadata);
      if (!poll || !poll.options.some((option) => option.id === parsed.data.content?.trim())) {
        return reply.code(400).send({ error: "Choose a valid option from this poll." });
      }
    }
    const interaction = await noodle.createInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that Noodle interaction." });
    if (parsed.data.type !== "like") {
      const directReplyTarget = parsed.data.parentInteractionId
        ? (await noodle.listInteractions([id])).find((item) => item.id === parsed.data.parentInteractionId)
        : null;
      const poll = readNoodlePollFromMetadata(post.metadata);
      const selectedPollOption =
        parsed.data.type === "vote"
          ? poll?.options.find((option) => option.id === interaction.content)?.label
          : undefined;
      const interactionSummary =
        parsed.data.type === "vote" && poll && selectedPollOption
          ? `${poll.question}: ${selectedPollOption}`
          : interaction.content || (interaction.imageUrl ? "shared an image" : post.content);
      await noodle.createDigest({
        accountIds: Array.from(
          new Set([actor.id, post.authorAccountId, directReplyTarget?.actorAccountId].filter(Boolean) as string[]),
        ),
        content: `${noodleDigestAccountLabel(actor)} ${interactionDigestVerb(parsed.data.type)} a Noodle post: ${interactionSummary}`,
        sourcePostId: post.id,
        sourceInteractionId: interaction.id,
      });
    }
    return interaction;
  });

  app.patch("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({
        actorKind,
        actorAccountId: interaction.actorAccountId,
        personaAccountId: persona.id,
      })
    ) {
      return reply.code(403).send({ error: "You can only edit comments from this persona or a character." });
    }
    const content = parsed.data.content === undefined ? interaction.content : parsed.data.content?.trim() || null;
    const imageUrl = parsed.data.imageUrl === undefined ? interaction.imageUrl : parsed.data.imageUrl?.trim() || null;
    if (!content && !imageUrl) return reply.code(400).send({ error: "Comments need text or an image." });
    const updated = await noodle.updateInteraction(interactionId, { content, imageUrl });
    if (!updated) return reply.code(404).send({ error: "Noodle comment not found" });
    const [post, accounts] = await Promise.all([noodle.getPostById(postId), noodle.listAccounts()]);
    if (post && interactionActor) {
      const directReplyTarget = updated.parentInteractionId
        ? await noodle.getInteractionById(updated.parentInteractionId)
        : null;
      const mentionedAccounts = mentionedCharacterAccounts(accounts, updated.content ?? "");
      await noodle.createDigest({
        accountIds: Array.from(
          new Set(
            [
              interactionActor.id,
              post.authorAccountId,
              directReplyTarget?.actorAccountId,
              ...mentionedAccounts.map((account) => account.id),
            ].filter(Boolean) as string[],
          ),
        ),
        content: `${noodleDigestAccountLabel(interactionActor)} replied to a Noodle post: ${
          updated.content || (updated.imageUrl ? "shared an image" : post.content)
        }`,
        sourcePostId: post.id,
        sourceInteractionId: updated.id,
      });
    }
    return updated;
  });

  app.delete("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionOwnerSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({
        actorKind,
        actorAccountId: interaction.actorAccountId,
        personaAccountId: persona.id,
      })
    ) {
      return reply.code(403).send({ error: "You can only delete comments from this persona or a character." });
    }
    const deleted = await noodle.deleteInteractionById(interactionId);
    if (deleted.length === 0) return reply.code(404).send({ error: "Noodle comment not found" });
    return deleted;
  });

  app.delete("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const interaction = await noodle.deleteInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "Noodle interaction not found" });
    return interaction;
  });

  app.post("/refresh/images", async (req, reply) => {
    const parsed = noodleImagePromptConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const imageConnection = settings.imageGenerationConnectionId
      ? await connections.getWithKey(settings.imageGenerationConnectionId)
      : await connections.getDefaultForImageGeneration();
    if (!imageConnection) return reply.code(400).send({ error: "Select a Noodle image generation connection first." });

    for (const promptOverride of parsed.data.prompts) {
      const post = await noodle.getPostById(promptOverride.id);
      if (!post || !post.imagePrompt || post.imageUrl) continue;
      const account = await noodle.getAccountById(post.authorAccountId);
      if (!account) continue;
      try {
        const generatedImage = await generateNoodlePostImage({
          account,
          referenceAccounts: [account],
          postContent: post.content,
          draftPrompt: post.imagePrompt,
          settings,
          characters,
          characterGallery,
          promptOverrides,
          imageConnection,
          app,
          debugMode: parsed.data.debugMode === true,
          promptOverride,
        });
        await noodle.updatePostMedia(post.id, {
          imageUrl: generatedImage.imageUrl,
          metadata: generatedImage.metadata,
        });
      } catch (error) {
        logger.warn(error, "[noodle] Failed to generate reviewed image for %s", account.displayName);
        await noodle.updatePostMedia(post.id, {
          imageUrl: null,
          imagePrompt: null,
          metadata: {
            imageGenerationFailed: true,
            imageGenerationError: getErrorMessage(error).slice(0, 500),
          },
        });
      }
    }

    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.post("/refresh", async (req, reply) => {
    const parsed = noodleRefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connectionId = parsed.data.connectionId ?? settings.generationConnectionId;
    if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const conn = await connections.getWithKey(connectionId);
    if (!conn) return reply.code(404).send({ error: "Noodle generation connection not found" });
    const imageCaptioning = await resolveImageCaptioningRuntime({
      chatMeta: {
        imageCaptioningEnabled: settings.imageCaptioningEnabled,
        imageCaptioningConnectionId: settings.imageCaptioningConnectionId,
      },
      fallbackConnectionId: connectionId,
      connections,
    });
    const imageConnection = settings.enableImagePrompts
      ? settings.imageGenerationConnectionId
        ? await connections.getWithKey(settings.imageGenerationConnectionId)
        : await connections.getDefaultForImageGeneration()
      : null;
    if (settings.enableImagePrompts && !imageConnection) {
      return reply.code(400).send({ error: "Select a Noodle image generation connection first." });
    }
    if (refreshInFlight) {
      return reply.code(409).send({ error: "A Noodle timeline refresh is already running." });
    }
    refreshInFlight = true;

    const debugMode = parsed.data.debugMode === true;
    let run: Awaited<ReturnType<typeof noodle.createRefreshRun>> | null = null;

    try {
      const baseUrl = resolveBaseUrl(conn);
      const primaryProvider = createLLMProvider(
        conn.provider,
        baseUrl,
        conn.apiKey,
        conn.maxContext,
        conn.openrouterProvider,
        conn.maxTokensOverride,
        conn.claudeFastMode === "true",
        conn.treatAsLocalEndpoint === "true",
      );
      const fallbackConnection = await connections.getFallbackForMain();
      const provider = withConnectionFallbackProvider({
        primary: primaryProvider,
        primaryConnectionId: conn.id,
        fallbackConnection,
        fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
        category: "main",
      });
      await ensurePersonaAccounts(noodle, characters);
      if (settings.allowProfessorMari) await ensureProfessorMariAccount(noodle, characters);
      const personaAccount = await resolvePersonaAccount(noodle, characters, parsed.data.personaId);
      const selectedGroupCharacterIds = await ensureSelectedGroupCharacterAccounts(
        noodle,
        characters,
        settings.invitedCharacterGroupIds,
      );
      if (settings.allowRandomUsers) await ensureRandomUserAccounts(noodle);
      const eligibleAccounts = await noodle.listAccounts();
      const eligibleCharacterAccounts = eligibleAccounts.filter(
        (account) =>
          account.kind === "character" &&
          (settings.allowProfessorMari || account.entityId !== PROFESSOR_MARI_ID) &&
          (account.invited || selectedGroupCharacterIds.has(account.entityId)),
      );
      await generateMissingNoodleProfiles({
        noodle,
        characters,
        characterGallery,
        accounts: eligibleCharacterAccounts,
        provider,
        connection: conn,
        debugMode,
      });
      const participantAccounts = await noodle.listAccounts();
      const selectionCutoff = sinceHoursIso(48);
      const [recentCreatedSelectionPosts, recentPersonaSelectionReplies] = await Promise.all([
        noodle.listPosts({ since: selectionCutoff, limit: 200 }),
        personaAccount ? noodle.listRepliesByActorSince(personaAccount.id, selectionCutoff, 200) : Promise.resolve([]),
      ]);
      const personaSelectionPostIds = Array.from(
        new Set(recentPersonaSelectionReplies.map((interaction) => interaction.postId)),
      );
      const personaSelectionPosts = (
        await Promise.all(personaSelectionPostIds.map((postId) => noodle.getPostById(postId)))
      ).filter((post): post is NoodlePost => Boolean(post));
      const recentSelectionPosts = [
        ...new Map([...recentCreatedSelectionPosts, ...personaSelectionPosts].map((post) => [post.id, post])).values(),
      ];
      const [recentSelectionInteractions, recentCompletedRuns] = await Promise.all([
        noodle.listInteractions(recentSelectionPosts.map((post) => post.id)),
        noodle.listRefreshRuns({ status: "completed", limit: 1 }),
      ]);
      const priorityAccountIds = collectNoodlePriorityAccountIds({
        accounts: participantAccounts,
        posts: recentSelectionPosts,
        interactions: recentSelectionInteractions,
        personaAccount,
      });
      const selectedParticipants = chooseNoodleParticipantAccounts({
        accounts: participantAccounts,
        settings,
        selectedGroupCharacterIds,
        followedAccountIds: new Set(parseStringArray(personaAccount?.settings.followingAccountIds)),
        recentlyActiveAccountIds: new Set(recentCompletedRuns[0]?.activeAccountIds ?? []),
        priorityAccountIds,
      });
      if (selectedParticipants.length === 0) {
        return reply
          .code(400)
          .send({ error: "Invite a character, select a character folder, or enable random users before refreshing." });
      }

      const activeAccounts = [...selectedParticipants, ...(personaAccount ? [personaAccount] : [])];
      const {
        messages,
        textOnlyMessages,
        promptForLog,
        textOnlyPromptForLog,
        visionAttachmentCount,
        captionedImageCount,
        recalledPostIds,
        lorebookActivatedEntryIds,
      } = await buildRefreshPrompt({
        db: app.db,
        noodle,
        characters,
        chats,
        promptOverrides,
        activeAccounts: selectedParticipants,
        personaAccount,
        settings,
        imageCaptioning,
      });
      logDebugOverride(debugMode, "[debug/noodle] Prompt sent to model:\n%s", promptForLog);
      if (visionAttachmentCount > 0) {
        logDebugOverride(
          debugMode,
          "[debug/noodle] Attached %d timeline image input(s) to the refresh prompt",
          visionAttachmentCount,
        );
      }
      if (captionedImageCount > 0) {
        logDebugOverride(
          debugMode,
          "[debug/noodle] Added %d generated timeline image caption(s) to the refresh prompt",
          captionedImageCount,
        );
      }
      if (lorebookActivatedEntryIds.length > 0) {
        logDebugOverride(
          debugMode,
          "[debug/noodle] Activated %d lorebook entr(ies) for this refresh: %s",
          lorebookActivatedEntryIds.length,
          lorebookActivatedEntryIds.join(", "),
        );
      }
      run = await noodle.createRefreshRun({
        activeAccountIds: activeAccounts.map((account) => account.id),
        prompt: promptForLog,
      });
      const runId = run.id;
      const timelineMaxTokens = clampGenerationMaxOutputTokens({
        provider: conn.provider as APIProvider,
        model: conn.model,
        maxTokens: timelineRefreshMaxTokens(
          selectedParticipants.filter((account) => account.kind === "character").length,
        ),
        maxTokensOverride: conn.maxTokensOverride,
      });
      const completionOptions = {
        model: conn.model,
        maxTokens: timelineMaxTokens,
        temperature: 0.9,
        topP: 0.95,
        stream: false,
        debugMode,
        responseFormat: noodleResponseFormat(conn.model, "timeline"),
      } as const;
      let requestMessages: ChatMessage[] = messages;
      let firstAttemptKind: NoodleRefreshAttemptKind = "initial";
      let result: Awaited<ReturnType<typeof provider.chatComplete>>;
      try {
        result = await provider.chatComplete(messages, completionOptions);
      } catch (error) {
        if (visionAttachmentCount === 0 || !isUnsupportedNoodleVisionInputError(error)) throw error;
        logger.warn(
          error,
          "[noodle/vision] The selected timeline model rejected image input; retrying the refresh as text-only",
        );
        logDebugOverride(
          debugMode,
          "[debug/noodle] Text-only fallback prompt sent to model:\n%s",
          textOnlyPromptForLog,
        );
        requestMessages = textOnlyMessages;
        firstAttemptKind = "text_only_fallback";
        result = await provider.chatComplete(textOnlyMessages, completionOptions);
      }
      let content = result.content ?? "";
      logDebugOverride(
        debugMode,
        "[debug/noodle] Raw model response (%s attempt %d):\n%s",
        firstAttemptKind,
        1,
        content,
      );
      let parsedGenerated: ReturnType<typeof parseNoodleGeneratedRefresh> | null = null;
      let retryReason: string | null = null;
      const allowedActorHandles = new Set(selectedParticipants.map((account) => normalizeNoodleHandle(account.handle)));
      const knownHandles = new Set(activeAccounts.map((account) => normalizeNoodleHandle(account.handle)));
      try {
        parsedGenerated = parseNoodleGeneratedRefresh(parseGameJsonish(content));
        retryReason = validateNoodleGeneratedRefresh(parsedGenerated.refresh, allowedActorHandles, knownHandles);
      } catch (error) {
        retryReason = `the response was not valid timeline JSON (${getErrorMessage(error)})`;
      }
      await noodle.recordRefreshAttempt(runId, {
        sequence: 1,
        kind: firstAttemptKind,
        response: content,
        rejectionReason: retryReason,
        createdAt: new Date().toISOString(),
      });

      if (retryReason) {
        const allowedHandles = selectedParticipants.map((account) => `@${account.handle}`);
        const knownTargetHandles = activeAccounts.map((account) => `@${account.handle}`);
        logger.warn("[noodle] Retrying timeline generation because %s", retryReason);
        const correction = [
          "Your previous timeline response could not be used.",
          `Reason: ${retryReason}.`,
          `Regenerate the complete JSON object now. Authors and actors must use only these selected participant handles: ${allowedHandles.join(", ")}.`,
          `Follow targets may additionally use these known handles: ${knownTargetHandles.join(", ")}.`,
          "Do not invent, rename, or omit an authorHandle, actorHandle, or targetHandle. Return JSON only.",
        ].join("\n");
        result = await provider.chatComplete([...requestMessages, { role: "user", content: correction }], completionOptions);
        content = result.content ?? "";
        logDebugOverride(
          debugMode,
          "[debug/noodle] Raw model response (%s attempt %d):\n%s",
          "correction",
          2,
          content,
        );
        parsedGenerated = null;
        let correctedRetryReason: string | null = null;
        try {
          parsedGenerated = parseNoodleGeneratedRefresh(parseGameJsonish(content));
          correctedRetryReason = validateNoodleGeneratedRefresh(
            parsedGenerated.refresh,
            allowedActorHandles,
            knownHandles,
          );
        } catch (error) {
          correctedRetryReason = `the response was not valid timeline JSON (${getErrorMessage(error)})`;
        }
        await noodle.recordRefreshAttempt(runId, {
          sequence: 2,
          kind: "correction",
          response: content,
          rejectionReason: correctedRetryReason,
          createdAt: new Date().toISOString(),
        });
        if (correctedRetryReason) {
          throw new Error(`Noodle timeline correction could not be used because ${correctedRetryReason}.`);
        }
      }

      if (!parsedGenerated) throw new Error("Noodle timeline generation returned no usable response.");
      const generated = parsedGenerated.refresh;
      for (const rejected of parsedGenerated.rejected) {
        logger.warn(
          "[noodle] Ignoring malformed generated %s item at index %d (%d validation issue%s)",
          rejected.collection,
          rejected.index,
          rejected.issueCount,
          rejected.issueCount === 1 ? "" : "s",
        );
      }
      const handleToAccount = new Map(
        [...(personaAccount ? [personaAccount] : []), ...selectedParticipants].map((account) => [
          normalizeNoodleHandle(account.handle),
          account,
        ]),
      );
      const mutableAccountSettings = new Map(
        activeAccounts.map((account) => [account.id, { ...account.settings }] as const),
      );
      const freshPosts = await noodle.listPosts({ since: sinceHoursIso(48), limit: 200 });
      const allowedExistingPostIds = new Set([...freshPosts.map((post) => post.id), ...recalledPostIds]);
      const existingInteractionById = new Map(
        (await noodle.listInteractions([...allowedExistingPostIds])).map((interaction) => [
          interaction.id,
          interaction,
        ]),
      );
      const existingInteractions = [...existingInteractionById.values()];
      let remainingImagePrompts = settings.enableImagePrompts ? settings.maxImagesPerRefresh : 0;
      const tempIdToPostId = new Map<string, string>();
      const createdPostIds: string[] = [];
      const imagePromptReviewItems: Array<{
        id: string;
        kind: "illustration";
        title: string;
        prompt: string;
        negativePrompt?: string;
        width: number;
        height: number;
      }> = [];
      const activeCharacterReferenceAccounts = activeAccounts.filter((account) => account.kind === "character");

      for (const generatedPost of generated.posts.slice(0, settings.maxGeneratedPostsPerRefresh)) {
        const account = handleToAccount.get(normalizeNoodleHandle(generatedPost.authorHandle));
        if (!account) continue;
        if (!canGenerateNoodleActivityForAccountKind(account.kind)) {
          logger.warn("[noodle] Ignoring generated post attributed to persona %s", account.entityId);
          continue;
        }
        const imagePrompt =
          remainingImagePrompts > 0 ? normalizeNoodleImagePrompt(generatedPost.imagePrompt) : null;
        if (imagePrompt) remainingImagePrompts -= 1;
        let persistedImagePrompt = imagePrompt;
        let imageUrl: string | null = null;
        const mediaMetadata: Record<string, unknown> = {};
        let imageGenerationFailed = false;
        let imagePromptPreview: Omit<(typeof imagePromptReviewItems)[number], "id"> | null = null;
        if (imagePrompt && imageConnection) {
          try {
            const generatedImage = await generateNoodlePostImage({
              account,
              referenceAccounts: activeCharacterReferenceAccounts,
              postContent: generatedPost.content,
              draftPrompt: imagePrompt,
              settings,
              characters,
              characterGallery,
              promptOverrides,
              imageConnection,
              app,
              debugMode,
              previewOnly: parsed.data.reviewImagePromptsBeforeSend === true,
            });
            imageUrl = generatedImage.imageUrl;
            Object.assign(mediaMetadata, generatedImage.metadata);
            imagePromptPreview = generatedImage.preview;
          } catch (err) {
            logger.warn(err, "[noodle] Failed to generate image for %s", account.displayName);
            persistedImagePrompt = null;
            imageGenerationFailed = true;
            mediaMetadata.imageGenerationFailed = true;
            mediaMetadata.imageGenerationError = getErrorMessage(err).slice(0, 500);
          }
        } else if (imagePrompt) {
          persistedImagePrompt = null;
          imageGenerationFailed = true;
          mediaMetadata.imageGenerationFailed = true;
          mediaMetadata.imageGenerationError = "No image generation connection is configured.";
        }
        if (
          !imageUrl &&
          !imagePromptPreview &&
          !imageGenerationFailed &&
          settings.allowGalleryImageAttachments &&
          generatedPost.attachGalleryImage === true
        ) {
          try {
            const attachment = await pickGalleryAttachmentForAccount({ account, chats, gallery, characterGallery });
            if (attachment) {
              imageUrl = attachment.imageUrl;
              Object.assign(mediaMetadata, attachment.metadata);
            }
          } catch (err) {
            logger.warn(err, "[noodle] Failed to attach gallery image for %s", account.displayName);
          }
        }
        const mentionedAccounts = mentionedCharacterAccounts(activeAccounts, generatedPost.content);
        const poll = generatedPost.poll ? createNoodlePoll(generatedPost.poll) : null;
        const post = await noodle.createPost({
          authorAccountId: account.id,
          content: generatedPost.content,
          imagePrompt: persistedImagePrompt,
          imageUrl,
          source: "generated",
          metadata: {
            runId,
            ...mediaMetadata,
            ...mentionedAccountMetadata(mentionedAccounts),
            ...(poll ? { poll } : {}),
          },
        });
        if (!post) continue;
        createdPostIds.push(post.id);
        if (imagePromptPreview) imagePromptReviewItems.push({ id: post.id, ...imagePromptPreview });
        if (generatedPost.tempId) tempIdToPostId.set(generatedPost.tempId, post.id);
        const digest = await noodle.createDigest({
          accountIds: [account.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
          content: `${noodleDigestAccountLabel(account)} posted on Noodle: ${post.content}`,
          sourceRunId: runId,
          sourcePostId: post.id,
        });
        await noodle.updatePostMedia(post.id, { metadata: { activityDigestId: digest.id } });
      }

      const quotas: Record<NoodleInteractionType, number> = {
        like: settings.maxLikesPerRefresh,
        repost: settings.maxRepostsPerRefresh,
        reply: settings.maxRepliesPerRefresh,
        vote: settings.maxLikesPerRefresh,
      };
      for (const generatedInteraction of generated.interactions) {
        if (quotas[generatedInteraction.type] <= 0) continue;
        const actor = handleToAccount.get(normalizeNoodleHandle(generatedInteraction.actorHandle));
        if (!actor) continue;
        if (!canGenerateNoodleActivityForAccountKind(actor.kind)) {
          logger.warn(
            "[noodle] Ignoring generated %s interaction attributed to persona %s",
            generatedInteraction.type,
            actor.entityId,
          );
          continue;
        }
        const targetPostId =
          generatedInteraction.targetPostId ?? tempIdToPostId.get(generatedInteraction.targetTempId ?? "");
        if (!targetPostId || (!allowedExistingPostIds.has(targetPostId) && !createdPostIds.includes(targetPostId))) {
          continue;
        }
        const targetPost = await noodle.getPostById(targetPostId);
        if (!targetPost) continue;
        const parentInteraction = generatedInteraction.parentInteractionId
          ? (existingInteractionById.get(generatedInteraction.parentInteractionId) ?? null)
          : null;
        if (
          generatedInteraction.parentInteractionId &&
          (!parentInteraction || parentInteraction.postId !== targetPostId || parentInteraction.type !== "reply")
        ) {
          continue;
        }
        if (
          !canCreateGeneratedNoodleInteraction({
            actor,
            targetPost,
            parentInteraction,
            existingInteractions,
          })
        ) {
          continue;
        }
        const poll = readNoodlePollFromMetadata(targetPost.metadata);
        const selectedPollOption =
          generatedInteraction.type === "vote" ? poll?.options[generatedInteraction.pollOptionIndex ?? -1] : undefined;
        if (generatedInteraction.type === "vote" && !selectedPollOption) continue;
        const interaction = await noodle.createInteraction(targetPostId, {
          actorAccountId: actor.id,
          type: generatedInteraction.type,
          content: selectedPollOption?.id ?? generatedInteraction.content ?? null,
          parentInteractionId: parentInteraction?.id ?? null,
        });
        if (!interaction) continue;
        existingInteractions.push(interaction);
        existingInteractionById.set(interaction.id, interaction);
        quotas[generatedInteraction.type] -= 1;
        if (generatedInteraction.type !== "like") {
          const interactionSummary =
            generatedInteraction.type === "vote" && poll && selectedPollOption
              ? `${poll.question}: ${selectedPollOption.label}`
              : interaction.content || targetPost.content;
          await noodle.createDigest({
            accountIds: Array.from(
              new Set([actor.id, targetPost.authorAccountId, parentInteraction?.actorAccountId]),
            ).filter((accountId): accountId is string => Boolean(accountId)),
            content: `${noodleDigestAccountLabel(actor)} ${interactionDigestVerb(
              generatedInteraction.type,
            )} a Noodle post: ${interactionSummary}`,
            sourceRunId: runId,
            sourcePostId: targetPostId,
            sourceInteractionId: interaction.id,
          });
        }
      }

      const maxGeneratedFollows = Math.max(12, activeAccounts.length * 2);
      const seenGeneratedFollows = new Set<string>();
      for (const generatedFollow of generated.follows.slice(0, maxGeneratedFollows)) {
        const actor = handleToAccount.get(normalizeNoodleHandle(generatedFollow.actorHandle));
        const target = handleToAccount.get(normalizeNoodleHandle(generatedFollow.targetHandle));
        if (!actor || !target || actor.id === target.id) continue;
        if (!canGenerateNoodleActivityForAccountKind(actor.kind)) {
          logger.warn("[noodle] Ignoring generated follow attributed to persona %s", actor.entityId);
          continue;
        }
        const followKey = `${actor.id}:${target.id}`;
        if (seenGeneratedFollows.has(followKey)) continue;
        seenGeneratedFollows.add(followKey);
        const actorSettings = mutableAccountSettings.get(actor.id) ?? actor.settings;
        const currentFollowingAccountIds = parseStringArray(actorSettings.followingAccountIds);
        if (currentFollowingAccountIds.includes(target.id)) continue;
        const followedAtByAccount = parseRecord(actorSettings[NOODLE_FOLLOWED_AT_BY_ACCOUNT_KEY]);
        const nextSettings = {
          ...actorSettings,
          followingAccountIds: [...currentFollowingAccountIds, target.id],
          [NOODLE_FOLLOWED_AT_BY_ACCOUNT_KEY]: {
            ...followedAtByAccount,
            [target.id]: new Date().toISOString(),
          },
        };
        mutableAccountSettings.set(actor.id, nextSettings);
        await noodle.updateAccount(actor.id, { settings: nextSettings });
        await noodle.createDigest({
          accountIds: [actor.id, target.id],
          content: `${noodleDigestAccountLabel(actor)} followed ${noodleDigestAccountLabel(target)} on Noodle.`,
          sourceRunId: runId,
        });
      }

      await noodle.finishRefreshRun(runId, { status: "completed", result: content });
      return {
        bootstrap: await bootstrapVisibleNoodle(noodle, characters),
        imagePromptReviewItems,
      };
    } catch (error) {
      logger.error(error, "[noodle] Timeline refresh failed");
      if (run) await noodle.finishRefreshRun(run.id, { status: "failed", error: getErrorMessage(error) });
      return reply.code(500).send({ error: getErrorMessage(error) });
    } finally {
      refreshInFlight = false;
    }
  });
}
