// ──────────────────────────────────────────────
// Routes: Admin (clear data, maintenance)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { eq, ne } from "../db/file-query.js";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY, PROFESSOR_MARI_ID, TTS_SETTINGS_KEY } from "@marinara-engine/shared";
import { DATA_DIR } from "../utils/data-dir.js";
import * as schema from "../db/schema/index.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { ADMIN_RESTART_RATE_LIMIT, AVATAR_STORAGE_RATE_LIMIT } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";
import { isDockerRuntime } from "../config/runtime-config.js";
import {
  ABANDONED_AVATAR_MIN_AGE_MS,
  collectCharacterAvatarPaths,
  collectPersonaAvatarPaths,
  deleteAbandonedAvatarFiles,
  mutateAvatarReferencesAndCleanup,
  scanAbandonedAvatarFiles,
} from "../services/image/avatar-file-lifecycle.js";

type ExpungeScope =
  | "chats"
  | "characters"
  | "personas"
  | "lorebooks"
  | "presets"
  | "connections"
  | "automation"
  | "media";

const GRACEFUL_RESTART_TIMEOUT_MS = 30_000;

const ALL_EXPUNGE_SCOPES: ExpungeScope[] = [
  "chats",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "connections",
  "automation",
  "media",
];

function clearDirectory(dirPath: string) {
  if (!existsSync(dirPath)) return 0;
  const files = readdirSync(dirPath);
  let count = 0;
  for (const f of files) {
    const full = join(dirPath, f);
    try {
      rmSync(full, { recursive: true, force: true });
      count++;
    } catch {
      // skip
    }
  }
  return count;
}

function isValidScope(scope: unknown): scope is ExpungeScope {
  return typeof scope === "string" && ALL_EXPUNGE_SCOPES.includes(scope as ExpungeScope);
}

export async function adminRoutes(app: FastifyInstance) {
  let restartScheduled = false;

  app.post<{ Body: { confirm?: boolean } }>(
    "/restart",
    { config: { rateLimit: ADMIN_RESTART_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Server restart" })) return;
      if (req.body?.confirm !== true) {
        return reply.status(400).send({ error: "Must send { confirm: true } to restart the server" });
      }
      if (restartScheduled) {
        return reply.status(409).send({ error: "Server restart is already scheduled" });
      }

      restartScheduled = true;
      setTimeout(() => {
        void (async () => {
          const forceCloseTimer = setTimeout(() => {
            logger.warn("Forcing server restart after %dms", GRACEFUL_RESTART_TIMEOUT_MS);
            app.server.closeAllConnections();
          }, GRACEFUL_RESTART_TIMEOUT_MS);
          forceCloseTimer.unref();
          try {
            await app.close();
            if (!isDockerRuntime()) {
              const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
                cwd: process.cwd(),
                detached: true,
                env: process.env,
                stdio: "inherit",
                windowsHide: true,
              });
              child.unref();
            }
            logger.info("Server restart requested from Advanced Settings");
            process.exit(0);
          } catch (error) {
            logger.error(error, "Graceful server restart failed");
            process.exit(1);
          } finally {
            clearTimeout(forceCloseTimer);
          }
        })();
      }, 750);

      return reply.status(202).send({ status: "restarting" });
    },
  );

  app.get("/avatar-storage/abandoned", { config: { rateLimit: AVATAR_STORAGE_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Avatar storage scan" })) return;
    const result = await scanAbandonedAvatarFiles({ db: app.db });
    return { ...result, minimumAgeMinutes: ABANDONED_AVATAR_MIN_AGE_MS / 60_000 };
  });

  app.post<{ Body: { confirm: boolean } }>(
    "/avatar-storage/cleanup",
    { config: { rateLimit: AVATAR_STORAGE_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Avatar storage cleanup" })) return;
      if (req.body?.confirm !== true) {
        return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
      }
      const result = await deleteAbandonedAvatarFiles({ db: app.db });
      logger.info("Removed %d abandoned avatar files (%d bytes)", result.files, result.bytes);
      return { ...result, minimumAgeMinutes: ABANDONED_AVATAR_MIN_AGE_MS / 60_000 };
    },
  );

  const runExpunge = async (requestedScopes: ExpungeScope[], reply: FastifyReply) => {
    if (requestedScopes.length === 0) {
      return reply.status(400).send({ error: "At least one valid scope is required" });
    }

    const db = app.db;
    const tablesCleared: Record<string, number> = {};
    const filesDeleted: Record<string, number> = {};

    const runDelete = async (name: string, task: () => Promise<unknown>) => {
      try {
        const result = await task();
        tablesCleared[name] = (tablesCleared[name] ?? 0) + ((result as { changes?: number } | undefined)?.changes ?? 0);
      } catch {
        tablesCleared[name] = tablesCleared[name] ?? 0;
      }
    };

    if (requestedScopes.includes("chats")) {
      await runDelete("message_swipes", () => db.delete(schema.messageSwipes).run());
      await runDelete("ooc_influences", () => db.delete(schema.oocInfluences).run());
      await runDelete("memory_chunks", () => db.delete(schema.memoryChunks).run());
      await runDelete("messages", () => db.delete(schema.messages).run());
      await runDelete("agent_runs", () => db.delete(schema.agentRuns).run());
      await runDelete("agent_memory", () => db.delete(schema.agentMemory).run());
      await runDelete("game_state_snapshots", () => db.delete(schema.gameStateSnapshots).run());
      await runDelete("game_scene_videos", () => db.delete(schema.gameSceneVideos).run());
      await runDelete("chat_images", () => db.delete(schema.chatImages).run());
      await runDelete("chat_folders", () => db.delete(schema.chatFolders).run());
      await runDelete("chats", () => db.delete(schema.chats).run());
      filesDeleted.gallery = clearDirectory(join(DATA_DIR, "gallery"));
      filesDeleted.gameSceneVideos = clearDirectory(join(DATA_DIR, "game-scene-videos"));
    }

    if (requestedScopes.includes("characters")) {
      const cleanup = await mutateAvatarReferencesAndCleanup({
        db,
        collectAvatarPaths: async () => {
          const [deletedCharacters, deletedGroups] = await Promise.all([
            db
              .select({ id: schema.characters.id })
              .from(schema.characters)
              .where(ne(schema.characters.id, PROFESSOR_MARI_ID)),
            db.select({ avatarPath: schema.characterGroups.avatarPath }).from(schema.characterGroups),
          ]);
          const characterAvatarPaths = await collectCharacterAvatarPaths(
            db,
            deletedCharacters.map((row) => row.id),
          );
          return [...characterAvatarPaths, ...deletedGroups.flatMap((row) => (row.avatarPath ? [row.avatarPath] : []))];
        },
        mutateReferences: async () => {
          await runDelete("character_groups", () => db.delete(schema.characterGroups).run());
          await runDelete("characters", () =>
            db.delete(schema.characters).where(ne(schema.characters.id, PROFESSOR_MARI_ID)).run(),
          );
        },
        cleanupFiles: !requestedScopes.includes("media"),
      });
      filesDeleted.avatars = (filesDeleted.avatars ?? 0) + cleanup.filesDeleted;
    }

    if (requestedScopes.includes("personas")) {
      const cleanup = await mutateAvatarReferencesAndCleanup({
        db,
        collectAvatarPaths: async () => {
          const deletedPersonas = await db.select({ id: schema.personas.id }).from(schema.personas);
          return collectPersonaAvatarPaths(
            db,
            deletedPersonas.map((row) => row.id),
          );
        },
        mutateReferences: async () => {
          await runDelete("persona_groups", () => db.delete(schema.personaGroups).run());
          await runDelete("personas", () => db.delete(schema.personas).run());
        },
        cleanupFiles: !requestedScopes.includes("media"),
      });
      filesDeleted.avatars = (filesDeleted.avatars ?? 0) + cleanup.filesDeleted;
    }

    if (requestedScopes.includes("lorebooks")) {
      await runDelete("lorebook_entries", () => db.delete(schema.lorebookEntries).run());
      await runDelete("lorebooks", () => db.delete(schema.lorebooks).run());
      await runDelete("library_folders:lorebooks", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "lorebooks")).run(),
      );
    }

    if (requestedScopes.includes("presets")) {
      const defaultPreset = (
        await db
          .select({ id: schema.promptPresets.id })
          .from(schema.promptPresets)
          .where(eq(schema.promptPresets.isDefault, "true"))
      )[0];
      const stockPreset = (
        await db
          .select({ id: schema.promptPresets.id })
          .from(schema.promptPresets)
          .where(eq(schema.promptPresets.systemKey, MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY))
          .limit(1)
      )[0];
      const stockPresetId = stockPreset?.id;

      await runDelete("prompt_sections", () =>
        stockPresetId
          ? db.delete(schema.promptSections).where(ne(schema.promptSections.presetId, stockPresetId)).run()
          : db.delete(schema.promptSections).run(),
      );
      await runDelete("prompt_groups", () =>
        stockPresetId
          ? db.delete(schema.promptGroups).where(ne(schema.promptGroups.presetId, stockPresetId)).run()
          : db.delete(schema.promptGroups).run(),
      );
      await runDelete("choice_blocks", () =>
        stockPresetId
          ? db.delete(schema.choiceBlocks).where(ne(schema.choiceBlocks.presetId, stockPresetId)).run()
          : db.delete(schema.choiceBlocks).run(),
      );
      await runDelete("prompt_presets", () =>
        stockPresetId
          ? db.delete(schema.promptPresets).where(ne(schema.promptPresets.id, stockPresetId)).run()
          : db.delete(schema.promptPresets).run(),
      );
      if (stockPresetId && defaultPreset && defaultPreset.id !== stockPresetId) {
        await db
          .update(schema.promptPresets)
          .set({ isDefault: "true" })
          .where(eq(schema.promptPresets.id, stockPresetId));
      }
      await runDelete("library_folders:presets", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "presets")).run(),
      );
    }

    if (requestedScopes.includes("connections")) {
      await runDelete("api_connections", () => db.delete(schema.apiConnections).run());
      await runDelete("app_settings", () =>
        db.delete(schema.appSettings).where(eq(schema.appSettings.key, TTS_SETTINGS_KEY)).run(),
      );
    }

    if (requestedScopes.includes("automation")) {
      await runDelete("agent_runs", () => db.delete(schema.agentRuns).run());
      await runDelete("agent_memory", () => db.delete(schema.agentMemory).run());
      await runDelete("agent_configs", () => db.delete(schema.agentConfigs).run());
      await runDelete("custom_tools", () => db.delete(schema.customTools).run());
      await runDelete("regex_scripts", () => db.delete(schema.regexScripts).run());
      await runDelete("custom_themes", () => db.delete(schema.customThemes).run());
      await runDelete("library_folders:agents", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "agents")).run(),
      );
    }

    if (requestedScopes.includes("media")) {
      await runDelete("assets", () => db.delete(schema.assets).run());
      await runDelete("game_scene_videos", () => db.delete(schema.gameSceneVideos).run());
      await runDelete("chat_images", () => db.delete(schema.chatImages).run());
      filesDeleted.backgrounds = clearDirectory(join(DATA_DIR, "backgrounds"));
      filesDeleted.gameSceneVideos = clearDirectory(join(DATA_DIR, "game-scene-videos"));
      filesDeleted.avatars = clearDirectory(join(DATA_DIR, "avatars"));
      filesDeleted.sprites = clearDirectory(join(DATA_DIR, "sprites"));
      filesDeleted.gallery = clearDirectory(join(DATA_DIR, "gallery"));
      filesDeleted.fonts = clearDirectory(join(DATA_DIR, "fonts"));
      filesDeleted.knowledgeSources = clearDirectory(join(DATA_DIR, "knowledge-sources"));
    }

    return {
      success: true,
      scopesCleared: requestedScopes,
      tablesCleared,
      filesDeleted,
      preserved: {
        characters: [PROFESSOR_MARI_ID],
      },
    };
  };

  app.post<{ Body: { confirm: boolean; scopes?: ExpungeScope[] } }>("/expunge", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Admin data expunge" })) return;
    const { confirm, scopes } = req.body as { confirm?: boolean; scopes?: unknown[] };
    if (!confirm) {
      return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
    }

    const requestedScopes = Array.isArray(scopes) ? scopes.filter(isValidScope) : [];
    return runExpunge(requestedScopes, reply);
  });

  // Clear all data — compatibility wrapper around scoped expunge.
  app.post<{ Body: { confirm: boolean } }>("/clear-all", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Admin data clearing" })) return;
    const { confirm } = req.body as { confirm?: boolean };
    if (!confirm) {
      return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
    }
    return runExpunge(ALL_EXPUNGE_SCOPES, reply);
  });
}
