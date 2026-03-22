// ──────────────────────────────────────────────
// Fastify App Factory
// ──────────────────────────────────────────────
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { getDB, type DB } from "./db/connection.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { ipAllowlistHook } from "./middleware/ip-allowlist.js";
import { runMigrations } from "./db/migrate.js";
import { seedDefaultPreset } from "./db/seed.js";
import { seedProfessorMari } from "./db/seed-mari.js";
import { seedDefaultConnection } from "./db/seed-connection.js";
import { seedDefaultBackgrounds } from "./db/seed-backgrounds.js";
import { recoverGalleryImages } from "./services/storage/gallery-recovery.js";
import { APP_VERSION } from "@marinara-engine/shared";
import { existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

export async function buildApp(https?: { cert: Buffer; key: Buffer }) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "warn",
      transport:
        process.env.NODE_ENV !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
    },
    bodyLimit: 50 * 1024 * 1024, // 50 MB — needed for PNG character cards with embedded avatar
    ...(https && { https }),
  });

  // ── Plugins ──
  await app.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB max upload
    },
  });

  // ── Database ──
  const db = await getDB();
  app.decorate("db", db);

  // ── Migrations (add missing columns to existing tables) ──
  await runMigrations(db);

  // ── Seed defaults ──
  await seedDefaultPreset(db);
  await seedProfessorMari(db);
  await seedDefaultConnection(db);
  await seedDefaultBackgrounds();

  // ── Recover orphaned gallery images (files on disk without DB records) ──
  await recoverGalleryImages(db);

  // ── IP Allowlist ──
  app.addHook("onRequest", ipAllowlistHook);

  // ── Error Handler ──
  app.setErrorHandler(errorHandler);

  // ── Routes ──
  await registerRoutes(app);

  // ── Serve client build in production ──
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(__dirname, "..", "..", "client", "dist");
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
      wildcard: false,
    });

    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile("index.html", clientDist);
    });
  }

  // ── Health Check ──
  app.get("/api/health", async () => ({
    status: "ok",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  }));

  return app;
}

// Type augmentation so routes can access `fastify.db`
declare module "fastify" {
  interface FastifyInstance {
    db: DB;
  }
}
