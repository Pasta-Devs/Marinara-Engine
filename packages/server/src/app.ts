// ──────────────────────────────────────────────
// Fastify App Factory
// ──────────────────────────────────────────────
import Fastify, { LogController } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { getDB, closeDB, type DB } from "./db/connection.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { ipAllowlistHook } from "./middleware/ip-allowlist.js";
import { basicAuthHook } from "./middleware/basic-auth.js";
import { csrfProtectionHook } from "./middleware/csrf-protection.js";
import { rateLimitHook } from "./middleware/rate-limit.js";
import { securityHeadersHook } from "./middleware/security-headers.js";
import { seedDefaultPreset } from "./db/seed.js";
import { seedProfessorMari } from "./db/seed-mari.js";
import { seedDefaultConnection } from "./db/seed-connection.js";
import { seedDefaultBackgrounds } from "./db/seed-backgrounds.js";
import { seedDefaultGameAssets } from "./db/seed-game-assets.js";
import { seedDefaultRegexScripts } from "./db/seed-regex.js";
import { buildAssetManifest, ensureAssetDirs } from "./services/game/asset-manifest.service.js";
import { recoverGalleryImages } from "./services/storage/gallery-recovery.js";
import { migrateCharacterExtendedDescriptionsToLorebooks } from "./services/lorebook/extended-descriptions-migration.js";
import { migrateLegacyDefaultAgentPrompts } from "./services/agents/default-prompt-migration.js";
import { APP_VERSION, resetTurnGameRegistry } from "@marinara-engine/shared";
import { existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getBuildCommit, getBuildLabel } from "./config/build-info.js";
import {
  getLogLevel,
  getNodeEnv,
  isRequestLoggingDisabled,
  isAutoCreateDefaultConnectionDisabled,
  getFileStorageDir,
} from "./config/runtime-config.js";
import { corsDelegate } from "./config/cors-config.js";
import { sidecarProcessService } from "./services/sidecar/sidecar-process.service.js";
import { startServerAutonomousScheduler } from "./services/conversation/server-autonomous-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./services/noodle/noodle-refresh-scheduler.service.js";
import { startNoodleAutoPostScheduler } from "./services/noodle/noodle-autopost-scheduler.service.js";
import { preparePersonalExtensionTrust } from "./services/setup/personal-extension-trust.js";
import { personalServerExtensionRuntime } from "./services/extensions/personal-server-extension-runtime.js";
import { runWithGenerationFallbackNotifier } from "./services/generation/fallback-notification.js";
import { createReplyFallbackNotifier } from "./routes/generate/fallback-notification.js";
import { initializeCapabilityAgentRegistry } from "./services/capability-packages/capability-agent-registry.service.js";
import { capabilityPackageManager } from "./services/capability-packages/package-manager.service.js";
import { capabilityModuleRuntime } from "./services/capability-packages/capability-module-runtime.service.js";
import { migrateLegacyCapabilities } from "./services/capability-packages/legacy-capability-migration.js";
import { createClientStaticOptions } from "./config/client-static-config.js";
import { hostValidationHook } from "./middleware/host-validation.js";

const isLite = process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

export async function buildApp(https?: { cert: Buffer; key: Buffer }) {
  const hadUserStateBeforeStartup = existsSync(join(getFileStorageDir(), "manifest.json"));
  const app = Fastify({
    logger: {
      level: getLogLevel(),
      transport: getNodeEnv() !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
    },
    logController: new LogController({ disableRequestLogging: isRequestLoggingDisabled() }),
    bodyLimit: MAX_UPLOAD_BYTES, // Large profile imports can include many base64 avatars.
    ...(https && { https }),
  });

  // Reject attacker-controlled DNS names before CORS or loopback trust can
  // treat a rebound browser request as same-origin local traffic.
  app.addHook("onRequest", hostValidationHook);

  // ── Plugins ──
  // CORS uses a per-request delegator so the trusted set is re-read each
  // request (CORS_ORIGINS hot-reloads in ~2s without a restart) AND so
  // same-origin requests (Origin matches the request's Host header) are
  // auto-allowed regardless of configuration. @fastify/cors expects the
  // delegator to be returned from a factory function passed as the plugin
  // options. See cors-config.ts.
  await app.register(cors, () => corsDelegate);

  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
    },
  });

  // ── Storage ──
  const db = await getDB();
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    try {
      const stopResults = await Promise.allSettled([
        capabilityModuleRuntime.stop(),
        personalServerExtensionRuntime.stop(),
        sidecarProcessService.stop(),
      ]);
      for (const result of stopResults) {
        if (result.status === "rejected") {
          app.log.error(result.reason, "Failed to stop a server runtime service during shutdown");
        }
      }
    } finally {
      await closeDB();
    }
  });

  // Existing installations retain their selected capabilities. Downloadable
  // package updates are offered in the client and never applied at startup.
  if (getNodeEnv() !== "test") {
    try {
      const removedCorePackages = await capabilityPackageManager.pruneNonDownloadableCorePackages();
      if (removedCorePackages.length > 0) {
        app.log.info("Removed obsolete downloadable copies of core features: %s", removedCorePackages.join(", "));
      }
      await migrateLegacyCapabilities(db, hadUserStateBeforeStartup);
    } catch (error) {
      app.log.warn(error, "Optional package availability migration did not complete; it will retry next startup");
    }
  }
  resetTurnGameRegistry();

  // ── Seed defaults ──
  await seedDefaultPreset(db);
  await seedProfessorMari(db);
  if (isAutoCreateDefaultConnectionDisabled()) {
    app.log.info("Skipping default OpenRouter Free connection seed because AUTO_CREATE_DEFAULT_CONNECTION is disabled");
  } else {
    await seedDefaultConnection(db);
  }
  await seedDefaultRegexScripts(db);
  await migrateLegacyDefaultAgentPrompts(db);
  await migrateCharacterExtendedDescriptionsToLorebooks(db);
  await seedDefaultBackgrounds();
  await seedDefaultGameAssets();

  // ── Ensure default asset directories exist, then build manifest ──
  ensureAssetDirs();
  buildAssetManifest();

  // ── Recover orphaned gallery images (files on disk without DB records) ──
  await recoverGalleryImages(db);

  // Legacy extension payloads and any out-of-band code changes are retained as
  // disabled drafts. Execution always requires approval of the exact hash.
  const personalExtensionTrust = await preparePersonalExtensionTrust(db);
  if (personalExtensionTrust.legacyRecordsQuarantined > 0) {
    app.log.info(
      "Quarantined %d legacy extension record(s) as Personal Extension drafts",
      personalExtensionTrust.legacyRecordsQuarantined,
    );
  }
  if (personalExtensionTrust.changedRecordsDisabled > 0) {
    app.log.warn(
      "Disabled %d Personal Extension record(s) because stored code changed outside the approval flow",
      personalExtensionTrust.changedRecordsDisabled,
    );
  }

  // Keep fallback reporting attached to the originating request even when
  // generation passes through nested services. Streamed routes emit an SSE
  // event; ordinary requests expose a response header consumed by the client.
  app.addHook("preHandler", (_request, reply, done) => {
    runWithGenerationFallbackNotifier(createReplyFallbackNotifier(reply), done);
  });

  // ── Security headers ──
  app.addHook("onRequest", securityHeadersHook);

  // ── IP Allowlist ──
  app.addHook("onRequest", ipAllowlistHook);

  // ── Lightweight API abuse throttling ──
  app.addHook("onRequest", rateLimitHook);

  // ── HTTP Basic Auth ──
  app.addHook("onRequest", basicAuthHook);

  // ── CSRF / Origin protection for unsafe API requests ──
  app.addHook("onRequest", csrfProtectionHook);

  // ── Prevent caching of API JSON responses ──
  // Without explicit Cache-Control, browsers apply heuristic caching which
  // can return stale data when React Query refetches after mutations.
  // This caused messages to vanish after generation because the refetch
  // returned a cached response without the newly saved message.
  app.addHook("onSend", async (req, reply, payload) => {
    if (req.url.startsWith("/api/") && !reply.hasHeader("Cache-Control")) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  // ── Error Handler ──
  app.setErrorHandler(errorHandler);

  // API file routes use reply.sendFile even when the client build is absent.
  // Decorate once without exposing a static route; production assets register below.
  await app.register(fastifyStatic, { serve: false });

  // ── Routes ──
  await registerRoutes(app);

  // Trusted downloaded server capabilities register while Fastify is still mutable.
  await capabilityModuleRuntime.start(app);
  await personalServerExtensionRuntime.start(db);
  // Server-backed agent definitions are visible only after their runtime reaches
  // functional readiness. Packages without a server entrypoint remain available
  // as soon as their verified files are installed.
  await initializeCapabilityAgentRegistry();

  // ── Server-side autonomous conversation scheduler ──
  startServerAutonomousScheduler(app);

  // ── Automatic Noodle timeline refresh scheduler ──
  startNoodleRefreshScheduler(app);

  // ── NoodleR per-creator automatic-posting scheduler ──
  startNoodleAutoPostScheduler(app);

  // ── Sidecar bootstrap (background, skipped in lite mode) ──
  if (!isLite) {
    void sidecarProcessService
      .syncForCurrentConfig({ suppressKnownFailure: true, allowRuntimeInstall: false })
      .catch((error) => {
        app.log.warn({ err: error }, "sidecar bootstrap failed");
      });
  }

  // ── Serve client build in production ──
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(__dirname, "..", "..", "client", "dist");
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, createClientStaticOptions(clientDist));

    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler(async (req, reply) => {
      if (req.raw.url?.startsWith("/api/")) {
        return reply.status(404).send({ error: "Not Found" });
      }

      reply.header("Cache-Control", "no-cache, must-revalidate");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
      return reply.sendFile("index.html", clientDist);
    });
  } else {
    app.log.warn("Client build not found at %s; serving API only. Run `pnpm build` to build the frontend.", clientDist);
  }

  // ── Health Check ──
  app.get("/api/health", async () => {
    const commit = getBuildCommit();
    let capabilityPackages: Awaited<ReturnType<typeof capabilityPackageManager.diagnostics>> | null = null;
    try {
      capabilityPackages = await capabilityPackageManager.diagnostics();
    } catch (error) {
      app.log.warn(error, "Capability package diagnostics are unavailable");
    }
    return {
      status: "ok",
      version: APP_VERSION,
      commit,
      build: getBuildLabel(),
      timestamp: new Date().toISOString(),
      capabilityPackages: {
        status: capabilityPackages
          ? capabilityPackages.every((item) => item.ready || item.status === "restart-required")
            ? "ok"
            : "degraded"
          : "error",
        packages: capabilityPackages ?? [],
      },
    };
  });

  return app;
}

// Type augmentation so routes can access `fastify.db`
declare module "fastify" {
  interface FastifyInstance {
    db: DB;
  }
}
