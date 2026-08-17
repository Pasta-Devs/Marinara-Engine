// ──────────────────────────────────────────────
// Storage: API Connections
// ──────────────────────────────────────────────
import { eq, desc, and, ne } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { apiConnections } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { encryptApiKey, decryptApiKey } from "../../utils/crypto.js";
import type { CreateConnectionInput } from "@marinara-engine/shared";
import { sweepDanglingConnectionReferences } from "./connection-reference-cleanup.js";
import { clearConnectionRateLimit, setConnectionRateLimit } from "../llm/connection-rate-limit-registry.js";
import { logger } from "../../lib/logger.js";

type ConnectionDefaultCategory = "image_generation" | "video_generation" | "audio" | "language";

/**
 * Decrypt a stored connection for internal use and keep the per-connection outbound throttle
 * registry in sync. Every provider-building read goes through here, so the registry is refreshed
 * exactly when a connection is about to be used.
 */
function withDecryptedKey<T extends { id: string; apiKeyEncrypted: string; maxRequestsPerMinute?: number | null }>(
  row: T,
): T & { apiKey: string } {
  setConnectionRateLimit(row.id, row.maxRequestsPerMinute ?? null);
  return { ...row, apiKey: decryptApiKey(row.apiKeyEncrypted) };
}

function defaultCategoryForProvider(provider: string): ConnectionDefaultCategory {
  if (provider === "image_generation") return "image_generation";
  if (provider === "video_generation") return "video_generation";
  if (provider === "audio") return "audio";
  return "language";
}

export function createConnectionsStorage(db: DB) {
  return {
    async list() {
      const rows = await db.select().from(apiConnections).orderBy(desc(apiConnections.updatedAt));
      // Mask API keys in list response
      return rows.map((r: any) => ({ ...r, apiKeyEncrypted: r.apiKeyEncrypted ? "••••••••" : "" }));
    },

    async getById(id: string) {
      const rows = await db.select().from(apiConnections).where(eq(apiConnections.id, id));
      return rows[0] ?? null;
    },

    /** Get connection with decrypted API key (for internal use only). */
    async getWithKey(id: string) {
      const conn = await this.getById(id);
      if (!conn || conn.profileImportReviewRequired === "true") return null;
      return withDecryptedKey(conn);
    },

    async getDefault() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.isDefault, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      return rows[0] ?? null;
    },

    /** Get the language connection used after a main generation failure. */
    async getFallbackForMain() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.fallbackForMain, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      const row = rows.find((candidate) => defaultCategoryForProvider(candidate.provider) === "language");
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the connection marked as default for agents (with decrypted key). */
    async getDefaultForAgents() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(eq(apiConnections.defaultForAgents, "true"), ne(apiConnections.profileImportReviewRequired, "true")),
        );
      const row = rows.find((candidate) => defaultCategoryForProvider(candidate.provider) === "language");
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the language connection used after an agent generation failure. */
    async getFallbackForAgents() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(eq(apiConnections.fallbackForAgents, "true"), ne(apiConnections.profileImportReviewRequired, "true")),
        );
      const row = rows.find((candidate) => defaultCategoryForProvider(candidate.provider) === "language");
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the image-generation connection selected under Defaults → Images (with decrypted key). */
    async getDefaultForImageGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "image_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the image-generation connection used after an image generation failure. */
    async getFallbackForImageGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "image_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the video-generation connection marked as default for scene videos (with decrypted key). */
    async getDefaultForVideoGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "video_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the video-generation connection used after a video generation failure. */
    async getFallbackForVideoGeneration() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "video_generation"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the audio connection marked as default (with decrypted key). */
    async getDefaultForAudio() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.defaultForAgents, "true"),
            eq(apiConnections.provider, "audio"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    /** Get the audio connection used when the preferred one fails or is gone. */
    async getFallbackForAudio() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.fallbackForAgents, "true"),
            eq(apiConnections.provider, "audio"),
            ne(apiConnections.profileImportReviewRequired, "true"),
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return null;
      return withDecryptedKey(row);
    },

    async create(input: CreateConnectionInput) {
      const id = newId();
      const timestamp = now();
      const providerCategory = defaultCategoryForProvider(input.provider);
      const values = {
        id,
        name: input.name,
        provider: input.provider,
        baseUrl: input.baseUrl ?? "",
        apiKeyEncrypted: encryptApiKey(input.apiKey ?? ""),
        profileImportReviewRequired: "false",
        model: input.model ?? "",
        imagePath: input.imagePath ?? null,
        maxContext: input.maxContext ?? 128000,
        isDefault: String(input.isDefault ?? false),
        fallbackForMain: String(providerCategory === "language" && (input.fallbackForMain ?? false)),
        useForRandom: String(input.useForRandom ?? false),
        defaultForAgents: String(input.defaultForAgents ?? false),
        fallbackForAgents: String(input.fallbackForAgents ?? false),
        enableCaching: String(input.enableCaching ?? false),
        anthropicExtendedCacheTtl: String(input.anthropicExtendedCacheTtl ?? false),
        cachingAtDepth: input.cachingAtDepth ?? 5,
        maxParallelJobs: input.maxParallelJobs ?? 1,
        maxRequestsPerMinute: input.maxRequestsPerMinute ?? null,
        embeddingModel: input.embeddingModel ?? "",
        embeddingBaseUrl: input.embeddingBaseUrl ?? "",
        embeddingConnectionId: input.embeddingConnectionId ?? null,
        openrouterProvider: input.openrouterProvider ?? null,
        imageGenerationSource: input.imageGenerationSource ?? null,
        comfyuiWorkflow: input.comfyuiWorkflow ?? null,
        imageService: input.imageService ?? null,
        imageEndpointId: input.imageEndpointId ?? null,
        imagePromptInstructions: input.imagePromptInstructions ?? null,
        imageGenerationQuality: input.imageGenerationQuality ?? "auto",
        videoGenerationSource: input.videoGenerationSource ?? null,
        videoService: input.videoService ?? null,
        audioSource: input.audioSource ?? null,
        audioVoice: input.audioVoice ?? null,
        audioSoundEffects: String(input.audioSoundEffects ?? false),
        audioMusic: String(input.audioMusic ?? false),
        promptPresetId: input.promptPresetId ?? null,
        maxTokensOverride: input.maxTokensOverride ?? null,
        claudeFastMode: String(input.claudeFastMode ?? false),
        treatAsLocalEndpoint: String(input.treatAsLocalEndpoint ?? false),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.transaction(async (tx) => {
        // If this is set as default, unset others.
        if (input.isDefault) {
          await tx.update(apiConnections).set({ isDefault: "false" });
          values.fallbackForMain = "false";
        }
        if (providerCategory === "language" && input.fallbackForMain) {
          await tx.update(apiConnections).set({ fallbackForMain: "false" });
          values.isDefault = "false";
        }
        // If this is set as default for agents, unset others in the same provider category.
        if (input.defaultForAgents) {
          values.fallbackForAgents = "false";
          const category = defaultCategoryForProvider(input.provider);
          if (category === "image_generation" || category === "video_generation" || category === "audio") {
            await tx
              .update(apiConnections)
              .set({ defaultForAgents: "false" })
              .where(and(eq(apiConnections.defaultForAgents, "true"), eq(apiConnections.provider, category)));
          } else {
            const existingDefaults = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.defaultForAgents, "true"));
            for (const row of existingDefaults) {
              if (defaultCategoryForProvider(row.provider) === "language") {
                await tx.update(apiConnections).set({ defaultForAgents: "false" }).where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        if (input.fallbackForAgents) {
          values.defaultForAgents = "false";
          const category = defaultCategoryForProvider(input.provider);
          if (category === "image_generation" || category === "video_generation" || category === "audio") {
            await tx
              .update(apiConnections)
              .set({ fallbackForAgents: "false" })
              .where(and(eq(apiConnections.fallbackForAgents, "true"), eq(apiConnections.provider, category)));
          } else {
            const existingFallbacks = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.fallbackForAgents, "true"));
            for (const row of existingFallbacks) {
              if (defaultCategoryForProvider(row.provider) === "language") {
                await tx
                  .update(apiConnections)
                  .set({ fallbackForAgents: "false" })
                  .where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        await tx.insert(apiConnections).values(values);
      });
      setConnectionRateLimit(id, input.maxRequestsPerMinute ?? null);
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateConnectionInput>) {
      const existing = await this.getById(id);
      if (!existing) return null;

      const effectiveProvider = data.provider ?? existing.provider;
      const effectiveProviderCategory = defaultCategoryForProvider(effectiveProvider);
      // Saving through the connection editor is the explicit local review
      // boundary for a connection restored from someone else's profile.
      const updateFields: Record<string, unknown> = {
        updatedAt: now(),
      };
      if (
        data.provider !== undefined ||
        data.baseUrl !== undefined ||
        data.apiKey !== undefined ||
        data.model !== undefined
      ) {
        updateFields.profileImportReviewRequired = "false";
      }
      const shouldClearDefault = data.isDefault === true;
      const shouldClearMainFallback = effectiveProviderCategory === "language" && data.fallbackForMain === true;
      const shouldClearAgentDefaults =
        data.defaultForAgents === true ||
        (data.defaultForAgents === undefined && data.provider !== undefined && existing.defaultForAgents === "true");
      const shouldClearAgentFallbacks =
        data.fallbackForAgents === true ||
        (data.fallbackForAgents === undefined && data.provider !== undefined && existing.fallbackForAgents === "true");
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.provider !== undefined) updateFields.provider = data.provider;
      if (data.baseUrl !== undefined) updateFields.baseUrl = data.baseUrl;
      if (data.apiKey !== undefined) updateFields.apiKeyEncrypted = encryptApiKey(data.apiKey);
      if (data.model !== undefined) updateFields.model = data.model;
      if (data.imagePath !== undefined) updateFields.imagePath = data.imagePath;
      if (data.maxContext !== undefined) updateFields.maxContext = data.maxContext;
      if (data.isDefault !== undefined) {
        updateFields.isDefault = String(data.isDefault);
      }
      if (data.fallbackForMain !== undefined) {
        updateFields.fallbackForMain = String(effectiveProviderCategory === "language" && data.fallbackForMain);
      }
      if (data.provider !== undefined && effectiveProviderCategory !== "language") {
        updateFields.fallbackForMain = "false";
      }
      if (data.useForRandom !== undefined) {
        updateFields.useForRandom = String(data.useForRandom);
      }
      if (data.defaultForAgents !== undefined) {
        updateFields.defaultForAgents = String(data.defaultForAgents);
      }
      if (data.fallbackForAgents !== undefined) {
        updateFields.fallbackForAgents = String(data.fallbackForAgents);
      }
      if (data.enableCaching !== undefined) {
        updateFields.enableCaching = String(data.enableCaching);
      }
      if (data.anthropicExtendedCacheTtl !== undefined) {
        updateFields.anthropicExtendedCacheTtl = String(data.anthropicExtendedCacheTtl);
      }
      if (data.cachingAtDepth !== undefined) {
        updateFields.cachingAtDepth = data.cachingAtDepth;
      }
      if (data.embeddingModel !== undefined) {
        updateFields.embeddingModel = data.embeddingModel;
      }
      if (data.embeddingBaseUrl !== undefined) {
        updateFields.embeddingBaseUrl = data.embeddingBaseUrl;
      }
      if (data.embeddingConnectionId !== undefined) {
        updateFields.embeddingConnectionId = data.embeddingConnectionId;
      }
      if (data.openrouterProvider !== undefined) {
        updateFields.openrouterProvider = data.openrouterProvider;
      }
      if (data.imageGenerationSource !== undefined) {
        updateFields.imageGenerationSource = data.imageGenerationSource;
      }
      if (data.comfyuiWorkflow !== undefined) {
        updateFields.comfyuiWorkflow = data.comfyuiWorkflow;
      }
      if (data.imageService !== undefined) {
        updateFields.imageService = data.imageService;
      }
      if (data.imageEndpointId !== undefined) {
        updateFields.imageEndpointId = data.imageEndpointId;
      }
      if (data.imagePromptInstructions !== undefined) {
        updateFields.imagePromptInstructions = data.imagePromptInstructions;
      }
      if (data.imageGenerationQuality !== undefined) {
        updateFields.imageGenerationQuality = data.imageGenerationQuality;
      }
      if (data.videoGenerationSource !== undefined) {
        updateFields.videoGenerationSource = data.videoGenerationSource;
      }
      if (data.videoService !== undefined) {
        updateFields.videoService = data.videoService;
      }
      if (data.audioSource !== undefined) {
        updateFields.audioSource = data.audioSource;
      }
      if (data.audioVoice !== undefined) {
        updateFields.audioVoice = data.audioVoice;
      }
      if (data.audioSoundEffects !== undefined) {
        updateFields.audioSoundEffects = String(data.audioSoundEffects);
      }
      if (data.audioMusic !== undefined) {
        updateFields.audioMusic = String(data.audioMusic);
      }
      if (data.promptPresetId !== undefined) {
        updateFields.promptPresetId = data.promptPresetId;
      }
      if (data.maxTokensOverride !== undefined) {
        updateFields.maxTokensOverride = data.maxTokensOverride;
      }
      if (data.maxParallelJobs !== undefined) {
        updateFields.maxParallelJobs = data.maxParallelJobs;
      }
      if (data.maxRequestsPerMinute !== undefined) {
        updateFields.maxRequestsPerMinute = data.maxRequestsPerMinute;
      }
      if (data.claudeFastMode !== undefined) {
        updateFields.claudeFastMode = String(data.claudeFastMode);
      }
      if (data.treatAsLocalEndpoint !== undefined) {
        updateFields.treatAsLocalEndpoint = String(data.treatAsLocalEndpoint);
      }
      await db.transaction(async (tx) => {
        if (shouldClearDefault) {
          await tx.update(apiConnections).set({ isDefault: "false" });
          updateFields.fallbackForMain = "false";
        }
        if (shouldClearMainFallback) {
          await tx.update(apiConnections).set({ fallbackForMain: "false" });
          updateFields.isDefault = "false";
        }
        if (shouldClearAgentDefaults) {
          updateFields.fallbackForAgents = "false";
          const category = defaultCategoryForProvider(effectiveProvider);
          if (category === "image_generation" || category === "video_generation" || category === "audio") {
            await tx
              .update(apiConnections)
              .set({ defaultForAgents: "false" })
              .where(
                data.defaultForAgents === true
                  ? and(eq(apiConnections.defaultForAgents, "true"), eq(apiConnections.provider, category))
                  : and(
                      eq(apiConnections.defaultForAgents, "true"),
                      eq(apiConnections.provider, category),
                      ne(apiConnections.id, id),
                    ),
              );
          } else {
            const existingDefaults = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.defaultForAgents, "true"));
            for (const row of existingDefaults) {
              if (
                defaultCategoryForProvider(row.provider) === "language" &&
                (data.defaultForAgents === true || row.id !== id)
              ) {
                await tx.update(apiConnections).set({ defaultForAgents: "false" }).where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        if (shouldClearAgentFallbacks) {
          updateFields.defaultForAgents = "false";
          const category = defaultCategoryForProvider(effectiveProvider);
          if (category === "image_generation" || category === "video_generation" || category === "audio") {
            await tx
              .update(apiConnections)
              .set({ fallbackForAgents: "false" })
              .where(
                data.fallbackForAgents === true
                  ? and(eq(apiConnections.fallbackForAgents, "true"), eq(apiConnections.provider, category))
                  : and(
                      eq(apiConnections.fallbackForAgents, "true"),
                      eq(apiConnections.provider, category),
                      ne(apiConnections.id, id),
                    ),
              );
          } else {
            const existingFallbacks = await tx
              .select()
              .from(apiConnections)
              .where(eq(apiConnections.fallbackForAgents, "true"));
            for (const row of existingFallbacks) {
              if (
                defaultCategoryForProvider(row.provider) === "language" &&
                (data.fallbackForAgents === true || row.id !== id)
              ) {
                await tx
                  .update(apiConnections)
                  .set({ fallbackForAgents: "false" })
                  .where(eq(apiConnections.id, row.id));
              }
            }
          }
        }
        await tx.update(apiConnections).set(updateFields).where(eq(apiConnections.id, id));
      });
      // Sync the throttle registry only after the write commits, so a failed update never installs
      // an unpersisted cap.
      if (data.maxRequestsPerMinute !== undefined) {
        setConnectionRateLimit(id, data.maxRequestsPerMinute ?? null);
      }
      return this.getById(id);
    },

    /** Duplicate a connection (including the encrypted API key). */
    async duplicate(id: string) {
      const source = await this.getById(id);
      if (!source) return null;
      const newConnId = newId();
      const timestamp = now();
      await db.insert(apiConnections).values({
        id: newConnId,
        name: `${source.name} (Copy)`,
        provider: source.provider,
        baseUrl: source.baseUrl,
        apiKeyEncrypted: source.apiKeyEncrypted,
        profileImportReviewRequired: source.profileImportReviewRequired,
        model: source.model,
        imagePath: source.imagePath,
        maxContext: source.maxContext,
        isDefault: "false",
        fallbackForMain: "false",
        useForRandom: "false",
        defaultForAgents: "false",
        fallbackForAgents: "false",
        enableCaching: source.enableCaching,
        anthropicExtendedCacheTtl: source.anthropicExtendedCacheTtl,
        cachingAtDepth: source.cachingAtDepth,
        embeddingModel: source.embeddingModel,
        embeddingConnectionId: source.embeddingConnectionId,
        defaultParameters: source.defaultParameters,
        openrouterProvider: source.openrouterProvider,
        embeddingBaseUrl: source.embeddingBaseUrl,
        imageGenerationSource: source.imageGenerationSource,
        comfyuiWorkflow: source.comfyuiWorkflow,
        imageService: source.imageService,
        imageEndpointId: source.imageEndpointId,
        imagePromptInstructions: source.imagePromptInstructions,
        imageGenerationQuality: source.imageGenerationQuality,
        videoGenerationSource: source.videoGenerationSource,
        videoService: source.videoService,
        audioSource: source.audioSource,
        audioVoice: source.audioVoice,
        audioSoundEffects: source.audioSoundEffects,
        audioMusic: source.audioMusic,
        promptPresetId: source.promptPresetId,
        maxTokensOverride: source.maxTokensOverride,
        maxParallelJobs: source.maxParallelJobs,
        maxRequestsPerMinute: source.maxRequestsPerMinute,
        claudeFastMode: source.claudeFastMode,
        treatAsLocalEndpoint: source.treatAsLocalEndpoint,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      setConnectionRateLimit(newConnId, source.maxRequestsPerMinute ?? null);
      return this.getById(newConnId);
    },

    /** Get all connections marked for the random pool (with decrypted keys). */
    async listRandomPool() {
      const rows = await db
        .select()
        .from(apiConnections)
        .where(and(eq(apiConnections.useForRandom, "true"), ne(apiConnections.profileImportReviewRequired, "true")));
      // The pool is drawn as the live chat LLM — media connections can never
      // serve a chat turn, so they are excluded even if a row was flagged
      // before its provider changed.
      return rows
        .filter(
          (r: any) => r.provider !== "audio" && r.provider !== "image_generation" && r.provider !== "video_generation",
        )
        .map((r: any) => withDecryptedKey(r));
    },

    async remove(id: string) {
      const cleanup = await db.transaction(async (tx) => {
        await tx.delete(apiConnections).where(eq(apiConnections.id, id));
        return sweepDanglingConnectionReferences(tx, id);
      });
      // Clear the throttle registry only after the delete commits.
      clearConnectionRateLimit(id);
      const totalCleaned = cleanup.chatsUpdated + cleanup.agentsUpdated + cleanup.connectionsUpdated;
      if (totalCleaned > 0) {
        logger.info(
          "[connections] Cleared dangling references to deleted connection %s: %d chat(s), %d agent(s), %d connection(s)",
          id,
          cleanup.chatsUpdated,
          cleanup.agentsUpdated,
          cleanup.connectionsUpdated,
        );
      }
    },

    async updateDefaultParameters(id: string, params: Record<string, unknown> | null) {
      await db
        .update(apiConnections)
        .set({ defaultParameters: params ? JSON.stringify(params) : null, updatedAt: now() })
        .where(eq(apiConnections.id, id));
    },
  };
}
