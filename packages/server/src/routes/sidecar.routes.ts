// ──────────────────────────────────────────────
// Sidecar Routes — Runtime, model management,
// and localhost llama-server inference
// ──────────────────────────────────────────────

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { logger, logDebugOverride } from "../lib/logger.js";
import { z } from "zod";
import { sidecarModelService } from "../services/sidecar/sidecar-model.service.js";
import { mlxRuntimeService } from "../services/sidecar/mlx-runtime.service.js";
import { sidecarRuntimeService } from "../services/sidecar/sidecar-runtime.service.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../services/llm/local-sidecar.js";
import {
  analyzeScene,
  isInferenceAvailable,
  isInferenceBusy,
  runTestMessage,
  runTrackerPrompt,
  unloadModel,
} from "../services/sidecar/sidecar-inference.service.js";
import { sidecarProcessService } from "../services/sidecar/sidecar-process.service.js";
import {
  buildSceneAnalyzerSystemPrompt,
  buildSceneAnalyzerUserPrompt,
  type SceneAnalyzerContext,
} from "../services/sidecar/scene-analyzer.js";
import { postProcessSceneResult, type PostProcessContext } from "../services/sidecar/scene-postprocess.js";
import {
  SIDECAR_EMBEDDING_POOLING_TYPES,
  SIDECAR_RUNTIME_PREFERENCES,
  scoreAmbient,
  scoreMusic,
  type GameActiveState,
  type SidecarDownloadProgress,
  type SidecarQuantization,
} from "@marinara-engine/shared";
import { isSidecarRuntimeInstallEnabled } from "../config/runtime-config.js";
import { isAdminAuthorized, requirePrivilegedAccess } from "../middleware/privileged-gate.js";

const quantizationSchema = z.enum(["q8_0", "q4_k_m"]);
const hfRepoSchema = z
  .string()
  .trim()
  .regex(/^[^/\s]+\/[^/\s]+$/, "Repository must be in owner/repo format");

export function isRuntimeInstallRequestAllowed(request: FastifyRequest): boolean {
  return isSidecarRuntimeInstallEnabled() || isAdminAuthorized(request);
}

function runtimeInstallDisabledPayload() {
  return {
    error: "Sidecar runtime install is disabled",
    message:
      "Set SIDECAR_RUNTIME_INSTALL_ENABLED=true or enter the matching Admin Access secret to allow runtime installation from the API.",
  };
}

function createResponseAbortSignal(reply: FastifyReply, label: string): AbortSignal {
  const controller = new AbortController();
  reply.raw.once("close", () => {
    if (!controller.signal.aborted) {
      controller.abort(new Error(`${label} cancelled because the client disconnected`));
    }
  });
  return controller.signal;
}

export const sidecarRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    void sidecarProcessService
      .syncForCurrentConfig({ suppressKnownFailure: true, allowRuntimeInstall: false })
      .catch((error) => {
        logger.error(error, "[sidecar] Background sync from /status failed");
      });

    const status = sidecarModelService.getStatus();
    return {
      ...status,
      inferenceReady: sidecarProcessService.isReady(),
      startupError: sidecarProcessService.getStartupError(),
      failedRuntimeVariant: sidecarProcessService.getFailedRuntimeVariant(),
    };
  });

  const configSchema = z.object({
    useForTrackers: z.boolean().optional(),
    useForGameScene: z.boolean().optional(),
    contextSize: z.number().int().min(512).optional(),
    maxTokens: z.number().int().min(64).optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().gt(0).max(1).optional(),
    topK: z.number().int().min(0).max(500).optional(),
    gpuLayers: z.number().int().min(-1).max(1024).optional(),
    enableNativeToolCalls: z.boolean().optional(),
    embeddingPooling: z.enum(SIDECAR_EMBEDDING_POOLING_TYPES).optional(),
    embeddingBatchSize: z.number().int().min(128).max(32768).optional(),
    runtimePreference: z.enum(SIDECAR_RUNTIME_PREFERENCES).optional(),
  });

  app.patch("/config", async (req) => {
    const body = configSchema.parse(req.body);
    const config = sidecarModelService.updateConfig(body);
    void sidecarProcessService
      .syncForCurrentConfig({ suppressKnownFailure: true, allowRuntimeInstall: false, preemptStarting: true })
      .catch((error) => {
        logger.error(error, "[sidecar] Background sync from /config failed");
      });
    return { config };
  });

  app.post("/runtime/install", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar runtime install" })) return;
    if (!isRuntimeInstallRequestAllowed(req)) {
      return reply.status(403).send(runtimeInstallDisabledPayload());
    }
    const body = z.object({ reinstall: z.boolean().optional() }).parse(req.body ?? {});

    await handleDownloadSse(reply, async () => {
      if (body.reinstall) {
        await sidecarProcessService.reinstallRuntime();
      } else {
        await sidecarProcessService.installRuntime();
      }
    });
  });

  app.post("/restart", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar restart" })) return;
    if (isInferenceBusy()) {
      return reply.status(409).send({ error: "Cannot restart the sidecar while inference is in progress" });
    }
    await sidecarProcessService.restart();
    return { ok: true };
  });

  app.post("/test-message", async () => {
    const startedAt = Date.now();
    try {
      const result = await runTestMessage();
      return {
        success: true,
        response: result.output,
        messageContent: result.content,
        reasoningContent: result.reasoning,
        nonce: result.nonce,
        nonceVerified: result.nonceVerified,
        usage: result.usage,
        timings: result.timings,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        success: false,
        response: "",
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Local sidecar test failed",
        failedRuntimeVariant: sidecarProcessService.getFailedRuntimeVariant(),
      };
    }
  });

  const embeddingsBodySchema = z
    .object({
      input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      model: z.string().trim().min(1).optional(),
    })
    .passthrough();

  app.post("/v1/embeddings", async (req, reply) => {
    const body = embeddingsBodySchema.parse(req.body ?? {});
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    const model = body.model ?? LOCAL_SIDECAR_MODEL;

    try {
      const embeddings = await getLocalSidecarProvider().embed(texts, model);
      return {
        object: "list",
        model,
        data: embeddings.map((embedding, index) => ({
          object: "embedding",
          embedding,
          index,
        })),
      };
    } catch (error) {
      logger.warn(error, "[sidecar] Embedding request failed");
      return reply.status(502).send({
        error: error instanceof Error ? error.message : "Local sidecar embedding request failed",
      });
    }
  });

  app.post("/reinstall", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar runtime reinstall" })) return;
    if (!isRuntimeInstallRequestAllowed(req)) {
      return reply.status(403).send(runtimeInstallDisabledPayload());
    }
    await sidecarProcessService.reinstallRuntime();
    return { ok: true };
  });

  const listCustomModelsSchema = z.object({
    repo: hfRepoSchema,
  });

  app.post("/models/list-huggingface", async (req) => {
    const body = listCustomModelsSchema.parse(req.body);
    const models = await sidecarModelService.listHuggingFaceModels(body.repo);
    return { models };
  });

  async function handleDownloadSse(reply: FastifyReply, task: () => Promise<void>): Promise<void> {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let completed = false;
    const cancelActiveWork = () => {
      if (completed) return;
      sidecarModelService.cancelDownload();
      mlxRuntimeService.cancelInstall();
      sidecarRuntimeService.cancelInstall();
      void sidecarProcessService.stop().catch((error) => {
        logger.warn(error, "[sidecar] Failed to stop sidecar after download stream closed");
      });
    };
    reply.raw.once("close", cancelActiveWork);

    const sendEvent = (data: unknown) => {
      if (reply.raw.destroyed || reply.raw.writableEnded) return;
      try {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        // Client disconnected between the guard and the write.
      }
    };

    let lastProgressPhase: SidecarDownloadProgress["phase"] | undefined;
    let lastProgressLabel: string | undefined;
    const listener = (progress: SidecarDownloadProgress) => {
      lastProgressPhase = progress.phase;
      lastProgressLabel = progress.label;
      if (progress.status === "downloading") {
        sendEvent(progress);
      }
    };
    sidecarModelService.addProgressListener(listener);

    try {
      await task();
      completed = true;
      sendEvent({ done: true });
    } catch (error) {
      if (reply.raw.destroyed) {
        return;
      }
      sendEvent({
        status: "error",
        phase: lastProgressPhase,
        label: lastProgressLabel,
        error: error instanceof Error ? error.message : "Download failed",
      });
    } finally {
      sidecarModelService.removeProgressListener(listener);
      completed = true;
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        try {
          reply.raw.end();
        } catch {
          // Client disconnected between the guard and the end call.
        }
      }
    }
  }

  app.post<{
    Body: { quantization: SidecarQuantization };
  }>("/download", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar model download" })) return;
    if (isInferenceBusy()) {
      return reply.status(409).send({ error: "Cannot download or switch sidecar models while inference is in progress" });
    }
    const { quantization } = z.object({ quantization: quantizationSchema }).parse(req.body);
    await handleDownloadSse(reply, async () => {
      await sidecarProcessService.stop();
      await sidecarModelService.download(quantization);
      await sidecarProcessService.syncForCurrentConfig({ allowRuntimeInstall: false });
    });
  });

  app.post<{
    Body: { repo: string; modelPath?: string };
  }>("/download/custom", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar custom model download" })) return;
    if (isInferenceBusy()) {
      return reply.status(409).send({ error: "Cannot download or switch sidecar models while inference is in progress" });
    }
    const body = z
      .object({
        repo: hfRepoSchema,
        modelPath: z.string().min(1).optional(),
      })
      .parse(req.body);

    await handleDownloadSse(reply, async () => {
      await sidecarProcessService.stop();
      await sidecarModelService.downloadCustomModel(body.repo, body.modelPath);
      await sidecarProcessService.syncForCurrentConfig({ allowRuntimeInstall: false });
    });
  });

  app.post("/download/cancel", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar download cancel" })) return;
    sidecarModelService.cancelDownload();
    mlxRuntimeService.cancelInstall();
    sidecarRuntimeService.cancelInstall();
    await sidecarProcessService.stop();
    return { ok: true };
  });

  app.delete("/model", async (_req, reply) => {
    if (!requirePrivilegedAccess(_req, reply, { feature: "Sidecar model deletion" })) return;
    if (isInferenceBusy()) {
      return reply.status(409).send({ error: "Cannot delete the sidecar model while inference is in progress" });
    }

    await sidecarProcessService.stop();
    await sidecarModelService.deleteModel();
    return { ok: true };
  });

  app.post("/unload", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Sidecar unload" })) return;
    if (isInferenceBusy()) {
      return reply.status(409).send({ error: "Cannot unload the sidecar while inference is in progress" });
    }
    await unloadModel();
    return { ok: true };
  });

  const sceneBodySchema = z.object({
    narration: z.string().max(16000),
    playerAction: z.string().max(4000).optional(),
    context: z.object({
      currentState: z.string().optional(),
      availableBackgrounds: z.array(z.string()).optional(),
      availableSfx: z.array(z.string()).optional(),
      activeWidgets: z.array(z.unknown()).optional(),
      trackedNpcs: z.array(z.unknown()).optional(),
      characterNames: z.array(z.string()).optional(),
      currentBackground: z.string().nullable().optional(),
      currentMusic: z.string().nullable().optional(),
      recentMusic: z.array(z.string()).max(20).optional(),
      useSpotifyMusic: z.boolean().optional(),
      availableSpotifyTracks: z
        .array(
          z.object({
            uri: z.string().min(1).max(300),
            name: z.string().min(1).max(300),
            artist: z.string().min(1).max(300),
            album: z.string().max(300).nullable().optional(),
            position: z.number().nullable().optional(),
            score: z.number().nullable().optional(),
          }),
        )
        .max(50)
        .optional(),
      currentSpotifyTrack: z.string().max(300).nullable().optional(),
      recentSpotifyTracks: z.array(z.string().max(300)).max(20).optional(),
      currentAmbient: z.string().nullable().optional(),
      currentLocation: z.string().nullable().optional(),
      currentWeather: z.string().nullable().optional(),
      currentTimeOfDay: z.string().nullable().optional(),
      genre: z.string().nullable().optional(),
      setting: z.string().nullable().optional(),
      worldOverview: z.string().nullable().optional(),
      canGenerateBackgrounds: z.boolean().optional(),
      canGenerateIllustrations: z.boolean().optional(),
      artStylePrompt: z.string().nullable().optional(),
      imagePromptInstructions: z.string().max(5000).nullable().optional(),
    }),
    debugMode: z.boolean().optional().default(false),
  });

  app.post("/analyze-scene", async (req, reply) => {
    const body = sceneBodySchema.parse(req.body);
    const requestDebug = body.debugMode === true;
    const debugLogsEnabled = requestDebug || logger.isLevelEnabled("debug");
    const debugLog = (message: string, ...args: any[]) => {
      logDebugOverride(requestDebug, message, ...args);
    };
    const available = await isInferenceAvailable();
    if (!available) {
      return reply.status(503).send({ error: "Sidecar model is not available" });
    }

    const bgTags = body.context.availableBackgrounds ?? [];
    const sfxTags = body.context.availableSfx ?? [];

    const sceneCtx = body.context as SceneAnalyzerContext;
    const systemPrompt = buildSceneAnalyzerSystemPrompt(sceneCtx);
    const userPrompt = buildSceneAnalyzerUserPrompt(body.narration, body.playerAction, sceneCtx);

    try {
      if (debugLogsEnabled) {
        debugLog(
          "[debug/game/scene-analysis:sidecar] request narrationChars=%d playerActionChars=%d state=%s bgOptions=%d sfxOptions=%d widgets=%d npcs=%d generateBackgrounds=%s generateIllustration=%s",
          body.narration.length,
          body.playerAction?.length ?? 0,
          body.context.currentState ?? "unknown",
          bgTags.length,
          sfxTags.length,
          body.context.activeWidgets?.length ?? 0,
          body.context.trackedNpcs?.length ?? 0,
          !!body.context.canGenerateBackgrounds,
          !!body.context.canGenerateIllustrations,
        );
        debugLog("[debug/game/scene-analysis:sidecar] system prompt:\n%s", systemPrompt);
        debugLog("[debug/game/scene-analysis:sidecar] user prompt:\n%s", userPrompt);
      }

      const raw = await analyzeScene(systemPrompt, userPrompt, createResponseAbortSignal(reply, "Sidecar scene analysis"));
      if (debugLogsEnabled) {
        debugLog("[debug/game/scene-analysis:sidecar] parsed model response:\n%s", JSON.stringify(raw, null, 2));
      }

      const ppCtx: PostProcessContext = {
        availableBackgrounds: bgTags,
        availableSfx: sfxTags,
        useSpotifyMusic: !!body.context.useSpotifyMusic,
        availableSpotifyTracks: body.context.availableSpotifyTracks ?? [],
        canGenerateBackgrounds: !!body.context.canGenerateBackgrounds,
        validWidgetIds: new Set(
          (body.context.activeWidgets ?? [])
            .map((widget) =>
              widget && typeof widget === "object" && !Array.isArray(widget) ? (widget as { id?: unknown }).id : null,
            )
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
        characterNames: body.context.characterNames ?? [],
      };
      const result = postProcessSceneResult(raw, ppCtx);
      if (!body.context.canGenerateIllustrations) {
        result.illustration = null;
      }

      const { getAssetManifest } = await import("../services/game/asset-manifest.service.js");
      const manifest = getAssetManifest();
      const assetKeys = Object.keys(manifest.assets ?? {});
      const musicTags = assetKeys.filter((key) => key.startsWith("music:"));
      const ambientTags = assetKeys.filter((key) => key.startsWith("ambient:"));

      if (body.context.useSpotifyMusic) {
        result.music = null;
      } else {
        const scoredMusic = scoreMusic({
          state: (body.context.currentState as GameActiveState) ?? "exploration",
          weather: result.weather ?? body.context.currentWeather ?? null,
          timeOfDay: result.timeOfDay ?? body.context.currentTimeOfDay ?? null,
          musicGenre: result.musicGenre,
          musicIntensity: result.musicIntensity,
          currentMusic: body.context.currentMusic ?? null,
          recentMusic: body.context.recentMusic ?? null,
          availableMusic: musicTags,
        });
        result.music = scoredMusic ?? null;
      }

      const scoredAmbient = scoreAmbient({
        state: (body.context.currentState as GameActiveState) ?? "exploration",
        weather: result.weather ?? body.context.currentWeather ?? null,
        timeOfDay: result.timeOfDay ?? body.context.currentTimeOfDay ?? null,
        locationKind: result.locationKind,
        currentAmbient: body.context.currentAmbient ?? null,
        availableAmbient: ambientTags,
        background: result.background ?? body.context.currentBackground,
      });
      result.ambient = scoredAmbient ?? null;

      if (debugLogsEnabled) {
        debugLog("[debug/game/scene-analysis:sidecar] final result:\n%s", JSON.stringify(result, null, 2));
      }

      return { result };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Scene analysis failed",
      });
    }
  });

  const trackerBodySchema = z.object({
    systemPrompt: z.string().max(16000),
    userPrompt: z.string().max(16000),
  });

  app.post("/tracker", async (req, reply) => {
    const body = trackerBodySchema.parse(req.body);
    const available = await isInferenceAvailable();
    if (!available) {
      return reply.status(503).send({ error: "Sidecar model is not available" });
    }

    try {
      const result = await runTrackerPrompt(
        body.systemPrompt,
        body.userPrompt,
        createResponseAbortSignal(reply, "Sidecar tracker inference"),
      );
      return { result };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Tracker inference failed",
      });
    }
  });
};
