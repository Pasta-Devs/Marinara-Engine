import {
  type APIProvider,
  type NoodleAccount,
  type NoodlePost,
  type NoodleRefreshAttemptKind,
  type NoodleSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import type { ImageCaptioningRuntime } from "../generation/image-captioning-runtime.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { commitGeneratedNoodleActivity, prepareGeneratedNoodleMedia } from "./noodle-generated-activity.service.js";
import {
  deduplicateGeneratedNoodleContent,
  parseNoodleGeneratedRefreshResponse,
  validateNoodleGeneratedRefresh,
} from "./noodle-generated-refresh.js";
import { normalizeNoodleHandle } from "./noodle-handle.js";
import { chooseNoodleParticipantAccounts, collectNoodlePriorityAccountIds } from "./noodle-participant-selection.js";
import { buildRefreshPrompt } from "./noodle-public-prompt.service.js";
import { generateMissingNoodleProfiles } from "./noodle-public-profiles.service.js";
import {
  bootstrapVisibleNoodle,
  characterAvatarCrop,
  characterNameFromRow,
  ensurePersonaAccounts,
  ensureProfessorMariAccount,
  getErrorMessage,
  parseRecord,
  resolvePersonaAccount,
} from "./noodle-public-support.js";
import { noodleResponseFormat } from "./noodle-response-format.js";
import { isUnsupportedNoodleVisionInputError } from "./noodle-vision.js";
import { formatNoodleMessagesForLog } from "./noodle-generation-log.js";

type PublicGenerationConnection = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>
>;

type PublicGenerationInput = {
  connection: PublicGenerationConnection;
  imageConnection: PublicGenerationConnection | null;
  imageCaptioning: ImageCaptioningRuntime;
  settings: NoodleSettings;
  personaId?: string;
  timeZone?: string;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
};

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

function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

function timelineRefreshMaxTokens(characterCount: number) {
  return 4096 + Math.max(0, characterCount) * 1024;
}

async function ensureRandomUserAccounts(noodle: ReturnType<typeof createNoodleStorage>) {
  for (const profile of RANDOM_NOODLE_USERS) {
    await noodle.upsertAccountFromProfile({ kind: "random_user", ...profile, invited: true });
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

export function createPublicNoodleGenerationService(db: DB) {
  const noodle = createNoodleStorage(db);
  const characters = createCharactersStorage(db);
  const chats = createChatsStorage(db);
  const connections = createConnectionsStorage(db);
  const gallery = createGalleryStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  return {
    async generate(input: PublicGenerationInput) {
      let run: Awaited<ReturnType<typeof noodle.createRefreshRun>> | null = null;
      try {
        const settings = input.settings;
        const conn = input.connection;
        const imageConnection = input.imageConnection;
        const imageCaptioning = input.imageCaptioning;
        const debugMode = input.debugMode;
        const baseUrl = resolveBaseUrl(input.connection);
        const primaryProvider = createLLMProvider(
          input.connection.provider,
          baseUrl,
          input.connection.apiKey,
          input.connection.maxContext,
          input.connection.openrouterProvider,
          input.connection.maxTokensOverride,
          input.connection.claudeFastMode === "true",
          input.connection.treatAsLocalEndpoint === "true",
          input.connection.defaultParameters,
        );
        const fallbackConnection = await connections.getFallbackForMain();
        const provider = withConnectionFallbackProvider({
          primary: primaryProvider,
          primaryConnectionId: input.connection.id,
          fallbackConnection,
          fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
          category: "main",
        });
        await ensurePersonaAccounts(noodle, characters);
        if (settings.allowProfessorMari) await ensureProfessorMariAccount(noodle, characters);
        const personaAccount = await resolvePersonaAccount(noodle, characters, input.personaId);
        const selectedGroupCharacterIds = await ensureSelectedGroupCharacterAccounts(
          noodle,
          characters,
          settings.invitedCharacterGroupIds,
        );
        if (settings.allowRandomUsers) await ensureRandomUserAccounts(noodle);
        const participantAccounts = await noodle.listAccounts();
        const selectionCutoff = sinceHoursIso(48);
        const [recentCreatedSelectionPosts, recentPersonaSelectionReplies] = await Promise.all([
          noodle.listPosts({ since: selectionCutoff, limit: 200 }),
          personaAccount
            ? noodle.listRepliesByActorSince(personaAccount.id, selectionCutoff, 200)
            : Promise.resolve([]),
        ]);
        const personaSelectionPostIds = Array.from(
          new Set(recentPersonaSelectionReplies.map((interaction) => interaction.postId)),
        );
        const personaSelectionPosts = (
          await Promise.all(personaSelectionPostIds.map((postId) => noodle.getPostById(postId)))
        ).filter((post): post is NoodlePost => Boolean(post));
        const recentSelectionPosts = [
          ...new Map(
            [...recentCreatedSelectionPosts, ...personaSelectionPosts].map((post) => [post.id, post]),
          ).values(),
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
        let selectedParticipants = chooseNoodleParticipantAccounts({
          accounts: participantAccounts,
          settings,
          selectedGroupCharacterIds,
          followedAccountIds: new Set(personaAccount?.settings.social.followingAccountIds ?? []),
          recentlyActiveAccountIds: new Set(recentCompletedRuns[0]?.activeAccountIds ?? []),
          priorityAccountIds,
        });
        if (selectedParticipants.length === 0) {
          return {
            ok: false as const,
            error: "Invite a character, select a character folder, or enable random users before refreshing.",
          };
        }

        await generateMissingNoodleProfiles({
          noodle,
          characters,
          characterGallery,
          accounts: selectedParticipants,
          provider,
          connection: conn,
          debugMode,
        });
        selectedParticipants = (
          await Promise.all(selectedParticipants.map((account) => noodle.getAccountById(account.id)))
        ).filter((account): account is NoodleAccount => account !== null);
        const activeAccounts = [...selectedParticipants, ...(personaAccount ? [personaAccount] : [])];
        const prompt = await buildRefreshPrompt({
          db,
          noodle,
          characters,
          chats,
          promptOverrides,
          activeAccounts: selectedParticipants,
          personaAccount,
          settings,
          timeZone: input.timeZone,
          imageCaptioning,
          debugMode,
        });
        logDebugOverride(debugMode, "[debug/noodle] Prompt sent to model:\n%s", prompt.promptForLog);
        if (prompt.visionAttachmentCount > 0)
          logDebugOverride(
            debugMode,
            "[debug/noodle] Attached %d timeline image input(s) to the refresh prompt",
            prompt.visionAttachmentCount,
          );
        if (prompt.captionedImageCount > 0)
          logDebugOverride(
            debugMode,
            "[debug/noodle] Added %d generated timeline image caption(s) to the refresh prompt",
            prompt.captionedImageCount,
          );
        if (prompt.lorebookActivatedEntryIds.length > 0) {
          logDebugOverride(
            debugMode,
            "[debug/noodle] Activated %d lorebook entr(ies) for this refresh: %s",
            prompt.lorebookActivatedEntryIds.length,
            prompt.lorebookActivatedEntryIds.join(", "),
          );
        }
        run = await noodle.createRefreshRun({
          activeAccountIds: activeAccounts.map((account) => account.id),
          prompt: prompt.promptForLog,
        });
        const runId = run.id;
        const timelineMaxTokens = clampGenerationMaxOutputTokens({
          provider: input.connection.provider as APIProvider,
          model: input.connection.model,
          maxTokens: resolveStoredMaxTokens(
            input.connection.defaultParameters,
            timelineRefreshMaxTokens(selectedParticipants.filter((account) => account.kind === "character").length),
          ),
          maxTokensOverride: input.connection.maxTokensOverride,
        });
        const completionOptions = {
          model: input.connection.model,
          maxTokens: timelineMaxTokens,
          temperature: 0.9,
          topP: 0.95,
          ...resolveStoredChatOptions(
            input.connection.defaultParameters,
            input.connection.provider,
            input.connection.model,
          ),
          stream: false,
          debugMode,
          responseFormat: noodleResponseFormat(input.connection.model, "timeline"),
        } as const;
        let requestMessages: ChatMessage[] = prompt.messages;
        let firstAttemptKind: NoodleRefreshAttemptKind = "initial";
        let result: Awaited<ReturnType<typeof provider.chatComplete>>;
        try {
          result = await provider.chatComplete(prompt.messages, completionOptions);
        } catch (error) {
          if (prompt.visionAttachmentCount === 0 || !isUnsupportedNoodleVisionInputError(error)) throw error;
          logger.warn(
            error,
            "[noodle/vision] The selected timeline model rejected image input; retrying the refresh as text-only",
          );
          logDebugOverride(
            debugMode,
            "[debug/noodle] Text-only fallback prompt sent to model:\n%s",
            prompt.textOnlyPromptForLog,
          );
          requestMessages = prompt.textOnlyMessages;
          firstAttemptKind = "text_only_fallback";
          result = await provider.chatComplete(prompt.textOnlyMessages, completionOptions);
        }
        let content = result.content ?? "";
        logDebugOverride(
          debugMode,
          "[debug/noodle] Raw model response (%s attempt %d):\n%s",
          firstAttemptKind,
          1,
          content,
        );
        let parsedGenerated: ReturnType<typeof parseNoodleGeneratedRefreshResponse> | null = null;
        let retryReason: string | null = null;
        const allowedActorHandles = new Set(
          selectedParticipants.map((account) => normalizeNoodleHandle(account.handle)),
        );
        const knownHandles = new Set(activeAccounts.map((account) => normalizeNoodleHandle(account.handle)));
        try {
          parsedGenerated = parseNoodleGeneratedRefreshResponse(content);
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
          const correctionMessages = [...requestMessages, { role: "user" as const, content: correction }];
          logDebugOverride(
            debugMode,
            "[debug/noodle] Correction prompt sent to model:\n%s",
            formatNoodleMessagesForLog(correctionMessages),
          );
          result = await provider.chatComplete(correctionMessages, completionOptions);
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
            parsedGenerated = parseNoodleGeneratedRefreshResponse(content);
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
          if (correctedRetryReason)
            throw new Error(`Noodle timeline correction could not be used because ${correctedRetryReason}.`);
        }
        if (!parsedGenerated) throw new Error("Noodle timeline generation returned no usable response.");
        for (const rejected of parsedGenerated.rejected) {
          logger.warn(
            "[noodle] Ignoring malformed generated %s item at index %d (%d validation issue%s)",
            rejected.collection,
            rejected.index,
            rejected.issueCount,
            rejected.issueCount === 1 ? "" : "s",
          );
        }
        const deduplicated = deduplicateGeneratedNoodleContent(parsedGenerated.refresh);
        if (deduplicated.removedCount > 0) {
          logger.warn(
            "[noodle] Removed %d duplicate generated post/reply item%s",
            deduplicated.removedCount,
            deduplicated.removedCount === 1 ? "" : "s",
          );
        }
        const preparedMedia = await prepareGeneratedNoodleMedia({
          db,
          characters,
          chats,
          gallery,
          characterGallery,
          promptOverrides,
          generated: deduplicated.generated,
          selectedParticipants,
          personaAccount,
          settings,
          imageConnection,
          debugMode,
          reviewImagePromptsBeforeSend: input.reviewImagePromptsBeforeSend,
        });
        const activity = await commitGeneratedNoodleActivity({
          db,
          generated: deduplicated.generated,
          selectedParticipants,
          personaAccount,
          settings,
          runId,
          result: content,
          recalledPostIds: prompt.recalledPostIds,
          preparedMedia,
        });
        run = null;
        return {
          ok: true as const,
          result: {
            bootstrap: await bootstrapVisibleNoodle(noodle, characters),
            imagePromptReviewItems: activity.imagePromptReviewItems,
          },
        };
      } catch (error) {
        logger.error(error, "[noodle] Timeline refresh failed");
        if (run) {
          try {
            await noodle.finishRefreshRun(run.id, { status: "failed", error: getErrorMessage(error) });
          } catch (cleanupError) {
            logger.error(
              { err: cleanupError, generationError: error },
              "[noodle] Failed to persist the failed timeline refresh",
            );
            throw new Error("Internal Server Error");
          }
        }
        throw error;
      }
    },
  };
}
