// ──────────────────────────────────────────────
// Routes: Admin (clear data, maintenance)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { eq, inArray, like, ne } from "../db/file-query.js";
import { readFileSync } from "fs";
import { readdir, rm, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import {
  FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
  MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY,
  PROFESSOR_MARI_ID,
  SPEECH_TO_TEXT_SETTINGS_KEY,
  TTS_SETTINGS_KEY,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../utils/data-dir.js";
import * as schema from "../db/schema/index.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import {
  ADMIN_RESTART_RATE_LIMIT,
  AVATAR_STORAGE_RATE_LIMIT,
  REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT,
  RUNTIME_DIAGNOSTICS_RATE_LIMIT,
  SERVER_LOGS_RATE_LIMIT,
} from "../middleware/rate-limit.js";
import { bootId, logger } from "../lib/logger.js";
import { getRequestTimeoutSettings, saveRequestTimeoutSettings } from "../config/runtime-config.js";
import { isRestartPending, restartExitCode, scheduleRestart } from "../lib/server-restart.js";
import { getServerLogSnapshot } from "../lib/log-buffer.js";
import { collectRuntimeDiagnostics } from "../lib/runtime-diagnostics.js";
import {
  ABANDONED_AVATAR_MIN_AGE_MS,
  collectCharacterAvatarPaths,
  collectPersonaAvatarPaths,
  deleteAbandonedAvatarFiles,
  mutateAvatarReferencesAndCleanup,
  scanAbandonedAvatarFiles,
} from "../services/image/avatar-file-lifecycle.js";
import { removeAvatarOwnersOfType } from "../services/avatars/storage.js";
import { TRIPO_API_KEY_SETTING } from "../services/avatars/generation/tripo-key.js";

type ExpungeScope =
  "chats" | "characters" | "personas" | "lorebooks" | "presets" | "connections" | "automation" | "media";

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

/** Rows deleted per step: small enough that one step loads little, large enough that flushes stay few. */
const EXPUNGE_CHAT_CHUNK = 25;
// Once every message is already in memory (a backup just ran), each chunk costs a pass over all of them whatever
// its size, so fewer, bigger chunks finish far sooner and load nothing new.
const EXPUNGE_RESIDENT_CHAT_CHUNK = 250;
const EXPUNGE_ROW_CHUNK = 250;
/** Parallel unlinks while clearing media folders. */
const EXPUNGE_FILE_CONCURRENCY = 8;
/** Written when a clear starts and removed when it finishes, so an interrupted clear can be finished later. */
const EXPUNGE_MARKER_FILENAME = "expunge-in-progress.json";

type ExpungeStep = ExpungeScope | "finishing";

export type ExpungeJobStatus = {
  id: string;
  scopes: ExpungeScope[];
  state: "running" | "done" | "failed";
  /** The category being deleted right now. */
  step: ExpungeStep;
  /** Items done and total in the current step (chats, characters, files...). Total 0 = not counted yet. */
  done: number;
  total: number;
  /** Position of the current step among all steps, for an overall bar. */
  stepIndex: number;
  stepCount: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  result: {
    tablesCleared: Record<string, number>;
    filesDeleted: Record<string, number>;
  } | null;
};

function expungeMarkerPath() {
  return join(DATA_DIR, EXPUNGE_MARKER_FILENAME);
}

/** A clear that started but never finished (the server stopped during it), if any. */
function readInterruptedExpunge(): { scopes: ExpungeScope[]; startedAt: string } | null {
  try {
    const raw = JSON.parse(readFileSync(expungeMarkerPath(), "utf8")) as { scopes?: unknown; startedAt?: unknown };
    const scopes = Array.isArray(raw.scopes) ? raw.scopes.filter(isValidScope) : [];
    if (scopes.length === 0) return null;
    return { scopes, startedAt: typeof raw.startedAt === "string" ? raw.startedAt : "" };
  } catch {
    return null;
  }
}

/**
 * Empties a folder without blocking the server: the old synchronous rmSync froze every request
 * for minutes on a big Windows library (antivirus scans each unlink), which looked like a crash.
 * Missing folders count as empty; entries that cannot be removed are skipped and counted out.
 */
async function clearDirectory(dirPath: string, onProgress?: (removed: number) => void) {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return 0;
  }
  let removed = 0;
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const full = join(dirPath, entries[next++]!);
      try {
        await rm(full, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        removed++;
        onProgress?.(removed);
      } catch (err) {
        logger.warn(err, "Could not remove %s while clearing data", full);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(EXPUNGE_FILE_CONCURRENCY, entries.length) }, worker));
  return removed;
}

async function countDirectoryEntries(dirPath: string) {
  try {
    return (await readdir(dirPath)).length;
  } catch {
    return 0;
  }
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function isValidScope(scope: unknown): scope is ExpungeScope {
  return typeof scope === "string" && ALL_EXPUNGE_SCOPES.includes(scope as ExpungeScope);
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/request-timeouts", () => getRequestTimeoutSettings());
  app.put("/request-timeouts", { config: { rateLimit: REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Request timeout settings" })) return;
    return saveRequestTimeoutSettings(req.body);
  });

  // Read-only runtime detail for support, beyond what /api/health serves:
  // storage residency and whether each capability package runtime is live.
  // Counts and states only, never row content or settings values.
  app.get("/runtime-diagnostics", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Runtime diagnostics" })) return;
    reply.header("Cache-Control", "no-store");
    return collectRuntimeDiagnostics();
  });

  // The in-app server console (lib/log-buffer.ts). Read-only. Its own polls are not logged
  // (logLevel "silent"), or at LOG_LEVEL=info the console would mostly show itself.
  app.get<{ Querystring: { afterId?: string; limit?: string } }>(
    "/logs",
    { logLevel: "silent", config: { rateLimit: SERVER_LOGS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Server console" })) return;
      reply.header("Cache-Control", "no-store");
      const afterId = Number(req.query.afterId ?? 0);
      const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
      // bootId: line ids start over on a restart, so the console needs this to tell a new run from the old one.
      return { ...getServerLogSnapshot(afterId, limit), logLevel: logger.level, bootId };
    },
  );

  app.post<{ Body: { confirm?: boolean } }>(
    "/restart",
    { config: { rateLimit: ADMIN_RESTART_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Server restart" })) return;
      if (req.body?.confirm !== true) {
        return reply.status(400).send({ error: "Must send { confirm: true } to restart the server" });
      }
      if (isRestartPending()) {
        return reply.status(409).send({ error: "Server restart is already scheduled", code: "restart-scheduled" });
      }
      const exitCode = restartExitCode();
      if (exitCode === null) {
        return reply.status(409).send({
          code: "restart-unavailable",
          error:
            "Restart is unavailable for an unmanaged server. Start Marinara with its platform launcher or pnpm start; restart a development watcher from its terminal.",
        });
      }
      logger.info("Server restart requested from Advanced Settings");
      scheduleRestart(exitCode);

      return reply.status(202).send({ status: "restarting", bootId });
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

  // One clear at a time, run in the background. The old single request did everything in one go:
  // deleting "all messages" pulled every chat's history into memory at once (a crash on big
  // libraries), and the client only saw a spinner until the request ended or died. Now each
  // category is deleted in small, flushed chunks with progress the client polls, and a marker file
  // records an unfinished clear so running it again finishes the rest.
  let expungeJob: ExpungeJobStatus | null = null;

  const runExpungeJob = async (job: ExpungeJobStatus) => {
    const db = app.db;
    const tablesCleared: Record<string, number> = {};
    const filesDeleted: Record<string, number> = {};
    const steps: ExpungeStep[] = [...ALL_EXPUNGE_SCOPES.filter((scope) => job.scopes.includes(scope)), "finishing"];
    job.stepCount = steps.length;
    const beginStep = (step: ExpungeStep, total = 0) => {
      job.step = step;
      job.stepIndex = steps.indexOf(step);
      job.done = 0;
      job.total = total;
    };
    // Flush after every chunk: the deletion is durable step by step, memory from the chunk's chat
    // units can be released, and other requests get a turn in between.
    const checkpoint = async () => {
      await db._fileStore.flush();
      await new Promise<void>((resolve) => setImmediate(resolve));
    };
    const runDelete = async (name: string, task: () => Promise<unknown>) => {
      try {
        const result = await task();
        tablesCleared[name] = (tablesCleared[name] ?? 0) + ((result as { changes?: number } | undefined)?.changes ?? 0);
      } catch (err) {
        logger.warn(err, "Could not clear %s", name);
        tablesCleared[name] = tablesCleared[name] ?? 0;
      }
    };
    const clearFolders = async (folders: Array<[key: string, dir: string]>) => {
      let total = 0;
      for (const [, dir] of folders) total += await countDirectoryEntries(join(DATA_DIR, dir));
      job.total = total;
      const base = job.done;
      for (const [key, dir] of folders) {
        const before = job.done;
        const removed = await clearDirectory(join(DATA_DIR, dir), (count) => {
          job.done = before + count;
        });
        job.done = before + removed;
        filesDeleted[key] = (filesDeleted[key] ?? 0) + removed;
      }
      return job.done - base;
    };
    // Avatar models belong to their character or persona, so they go with it (Media & Assets clears them all).
    const removeAvatarModels = async (ownerType: "character" | "persona", keepOwnerIds: string[] = []) => {
      try {
        const removed = await removeAvatarOwnersOfType(ownerType, keepOwnerIds);
        filesDeleted.avatarModels = (filesDeleted.avatarModels ?? 0) + removed;
      } catch (err) {
        logger.warn(err, "Failed to remove the %s avatar models", ownerType);
      }
    };

    if (job.scopes.includes("chats")) {
      const chatIds = (await db.select({ id: schema.chats.id }).from(schema.chats)).map((row) => row.id);
      beginStep("chats", chatIds.length);
      // Chat by chat, not table by table: deleting a chat cascades to its messages, swipes, images,
      // memories and game state while only that chat's files are loaded.
      const residentTables = db._fileStore.getFullyResidentLazyTables();
      const chatsResident = residentTables.has("messages") && residentTables.has("message_swipes");
      for (const chunk of chunked(chatIds, chatsResident ? EXPUNGE_RESIDENT_CHAT_CHUNK : EXPUNGE_CHAT_CHUNK)) {
        await runDelete("chats", () => db.delete(schema.chats).where(inArray(schema.chats.id, chunk)).run());
        tablesCleared.chats = (tablesCleared.chats ?? 0) + chunk.length;
        await checkpoint();
        job.done += chunk.length;
      }
      // Leftovers whose chat was already gone. These are normally empty, so the full scans are cheap now.
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
      await checkpoint();
      job.done = 0;
      await clearFolders([
        ["gallery", "gallery"],
        ["gameSceneVideos", "game-scene-videos"],
      ]);
      job.done = job.total;
    }

    if (job.scopes.includes("characters")) {
      const characterIds = (
        await db
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(ne(schema.characters.id, PROFESSOR_MARI_ID))
      ).map((row) => row.id);
      beginStep("characters", characterIds.length);
      const cleanup = await mutateAvatarReferencesAndCleanup({
        db,
        collectAvatarPaths: async () => {
          const deletedGroups = await db
            .select({ avatarPath: schema.characterGroups.avatarPath })
            .from(schema.characterGroups);
          const characterAvatarPaths = await collectCharacterAvatarPaths(db, characterIds);
          return [...characterAvatarPaths, ...deletedGroups.flatMap((row) => (row.avatarPath ? [row.avatarPath] : []))];
        },
        mutateReferences: async () => {
          await runDelete("character_groups", () => db.delete(schema.characterGroups).run());
          for (const chunk of chunked(characterIds, EXPUNGE_ROW_CHUNK)) {
            await runDelete("characters", () =>
              db.delete(schema.characters).where(inArray(schema.characters.id, chunk)).run(),
            );
            tablesCleared.characters = (tablesCleared.characters ?? 0) + chunk.length;
            await checkpoint();
            job.done += chunk.length;
          }
          // Anything added while this ran.
          await runDelete("characters", () =>
            db.delete(schema.characters).where(ne(schema.characters.id, PROFESSOR_MARI_ID)).run(),
          );
        },
        cleanupFiles: !job.scopes.includes("media"),
      });
      filesDeleted.avatars = (filesDeleted.avatars ?? 0) + cleanup.filesDeleted;
      await removeAvatarModels("character", [PROFESSOR_MARI_ID]);
      await checkpoint();
    }

    if (job.scopes.includes("personas")) {
      const personaIds = (await db.select({ id: schema.personas.id }).from(schema.personas)).map((row) => row.id);
      beginStep("personas", personaIds.length);
      const cleanup = await mutateAvatarReferencesAndCleanup({
        db,
        collectAvatarPaths: () => collectPersonaAvatarPaths(db, personaIds),
        mutateReferences: async () => {
          await runDelete("persona_groups", () => db.delete(schema.personaGroups).run());
          for (const chunk of chunked(personaIds, EXPUNGE_ROW_CHUNK)) {
            await runDelete("personas", () =>
              db.delete(schema.personas).where(inArray(schema.personas.id, chunk)).run(),
            );
            tablesCleared.personas = (tablesCleared.personas ?? 0) + chunk.length;
            await checkpoint();
            job.done += chunk.length;
          }
          await runDelete("personas", () => db.delete(schema.personas).run());
        },
        cleanupFiles: !job.scopes.includes("media"),
      });
      filesDeleted.avatars = (filesDeleted.avatars ?? 0) + cleanup.filesDeleted;
      await removeAvatarModels("persona");
      await checkpoint();
    }

    if (job.scopes.includes("lorebooks")) {
      const lorebookIds = (await db.select({ id: schema.lorebooks.id }).from(schema.lorebooks)).map((row) => row.id);
      beginStep("lorebooks", lorebookIds.length);
      // Deleting a lorebook cascades to its entries, folders and links.
      for (const chunk of chunked(lorebookIds, EXPUNGE_ROW_CHUNK)) {
        await runDelete("lorebooks", () =>
          db.delete(schema.lorebooks).where(inArray(schema.lorebooks.id, chunk)).run(),
        );
        tablesCleared.lorebooks = (tablesCleared.lorebooks ?? 0) + chunk.length;
        await checkpoint();
        job.done += chunk.length;
      }
      await runDelete("lorebook_entries", () => db.delete(schema.lorebookEntries).run());
      await runDelete("lorebooks", () => db.delete(schema.lorebooks).run());
      await runDelete("library_folders:lorebooks", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "lorebooks")).run(),
      );
      await checkpoint();
    }

    if (job.scopes.includes("presets")) {
      beginStep("presets");
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
      await checkpoint();
    }

    if (job.scopes.includes("connections")) {
      beginStep("connections");
      await runDelete("api_connections", () => db.delete(schema.apiConnections).run());
      await runDelete("connection_accounts", () => db.delete(schema.connectionAccounts).run());
      await runDelete("app_settings", () =>
        db.delete(schema.appSettings).where(eq(schema.appSettings.key, FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY)).run(),
      );
      await runDelete("app_settings", () =>
        db.delete(schema.appSettings).where(eq(schema.appSettings.key, TTS_SETTINGS_KEY)).run(),
      );
      await runDelete("app_settings", () =>
        db.delete(schema.appSettings).where(eq(schema.appSettings.key, SPEECH_TO_TEXT_SETTINGS_KEY)).run(),
      );
      // The Tripo API key was a connection until it moved to the 3D Avatars page, so it is cleared here too.
      await runDelete("app_settings", () =>
        db.delete(schema.appSettings).where(eq(schema.appSettings.key, TRIPO_API_KEY_SETTING)).run(),
      );
      await checkpoint();
    }

    if (job.scopes.includes("automation")) {
      beginStep("automation");
      // agent_runs/agent_memory are per-chat tables: deleting their configs cascades unit by unit
      // instead of loading every chat's runs at once.
      await runDelete("agent_configs", () => db.delete(schema.agentConfigs).run());
      await runDelete("agent_runs", () => db.delete(schema.agentRuns).run());
      await runDelete("agent_memory", () => db.delete(schema.agentMemory).run());
      await runDelete("app_settings:agent_home_widgets", () =>
        db.delete(schema.appSettings).where(like(schema.appSettings.key, "agent_home_widget:%")).run(),
      );
      await runDelete("custom_tools", () => db.delete(schema.customTools).run());
      await runDelete("library_folders:functions", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "functions")).run(),
      );
      await runDelete("regex_scripts", () => db.delete(schema.regexScripts).run());
      await runDelete("library_folders:regex", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "regex")).run(),
      );
      await runDelete("custom_themes", () => db.delete(schema.customThemes).run());
      await runDelete("library_folders:agents", () =>
        db.delete(schema.libraryFolders).where(eq(schema.libraryFolders.scope, "agents")).run(),
      );
      await checkpoint();
    }

    if (job.scopes.includes("media")) {
      beginStep("media");
      await runDelete("assets", () => db.delete(schema.assets).run());
      await runDelete("game_scene_videos", () => db.delete(schema.gameSceneVideos).run());
      await runDelete("chat_images", () => db.delete(schema.chatImages).run());
      await checkpoint();
      await clearFolders([
        ["backgrounds", "backgrounds"],
        ["gameSceneVideos", "game-scene-videos"],
        ["avatars", "avatars"],
        ["sprites", "sprites"],
        ["avatarModels", "avatar-models"],
        ["gallery", "gallery"],
        ["fonts", "fonts"],
        ["knowledgeSources", "knowledge-sources"],
      ]);
    }

    beginStep("finishing");
    await db._fileStore.flush();
    job.result = { tablesCleared, filesDeleted };
  };

  const startExpunge = async (requestedScopes: ExpungeScope[], reply: FastifyReply, background: boolean) => {
    if (requestedScopes.length === 0) {
      return reply.status(400).send({ error: "At least one valid scope is required" });
    }
    if (expungeJob?.state === "running") {
      return reply.status(409).send({ error: "A data clear is already running", job: expungeJob });
    }
    const scopes = ALL_EXPUNGE_SCOPES.filter((scope) => requestedScopes.includes(scope));
    const job: ExpungeJobStatus = {
      id: randomUUID(),
      scopes,
      state: "running",
      step: scopes[0]!,
      done: 0,
      total: 0,
      stepIndex: 0,
      stepCount: scopes.length + 1,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      result: null,
    };
    expungeJob = job;
    // An earlier unfinished clear is folded into this one: its marker is replaced by the union.
    const interrupted = readInterruptedExpunge();
    const markerScopes = ALL_EXPUNGE_SCOPES.filter(
      (scope) => scopes.includes(scope) || (interrupted?.scopes.includes(scope) ?? false),
    );
    try {
      await writeFile(expungeMarkerPath(), JSON.stringify({ scopes: markerScopes, startedAt: job.startedAt }), "utf8");
    } catch (err) {
      logger.warn(err, "Could not record the data clear marker");
    }
    logger.info("Clearing data: %s", scopes.join(", "));
    const finished = runExpungeJob(job)
      .then(async () => {
        job.state = "done";
        job.finishedAt = new Date().toISOString();
        const leftover = interrupted?.scopes.filter((scope) => !scopes.includes(scope)) ?? [];
        try {
          if (leftover.length > 0) {
            await writeFile(
              expungeMarkerPath(),
              JSON.stringify({ scopes: leftover, startedAt: interrupted?.startedAt ?? job.startedAt }),
              "utf8",
            );
          } else {
            await unlink(expungeMarkerPath());
          }
        } catch {
          // The marker only drives a reminder; a stale one is harmless.
        }
        logger.info("Data clear finished: %s", scopes.join(", "));
      })
      .catch((err: unknown) => {
        job.state = "failed";
        job.finishedAt = new Date().toISOString();
        job.error = err instanceof Error ? err.message : String(err);
        logger.error(err, "Data clear failed during %s", job.step);
      });
    if (background) return reply.status(202).send({ success: true, job });
    // Callers that predate the background mode get the old answer once everything is gone.
    await finished;
    if (job.state === "failed") return reply.status(500).send({ error: job.error ?? "Data clear failed", job });
    return {
      success: true,
      scopesCleared: scopes,
      tablesCleared: job.result?.tablesCleared ?? {},
      filesDeleted: job.result?.filesDeleted ?? {},
      preserved: { characters: [PROFESSOR_MARI_ID] },
    };
  };

  app.get("/expunge/status", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Admin data expunge" })) return;
    reply.header("Cache-Control", "no-store");
    return {
      job: expungeJob,
      interrupted: expungeJob?.state === "running" ? null : readInterruptedExpunge(),
    };
  });

  // background: true answers at once with the job; progress is at GET /expunge/status.
  app.post<{ Body: { confirm: boolean; scopes?: ExpungeScope[]; background?: boolean } }>(
    "/expunge",
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Admin data expunge" })) return;
      const { confirm, scopes, background } = req.body as {
        confirm?: boolean;
        scopes?: unknown[];
        background?: unknown;
      };
      if (!confirm) {
        return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
      }

      const requestedScopes = Array.isArray(scopes) ? scopes.filter(isValidScope) : [];
      return startExpunge(requestedScopes, reply, background === true);
    },
  );

  // Clear all data — compatibility wrapper around scoped expunge.
  app.post<{ Body: { confirm: boolean; background?: boolean } }>("/clear-all", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Admin data clearing" })) return;
    const { confirm, background } = req.body as { confirm?: boolean; background?: unknown };
    if (!confirm) {
      return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
    }
    return startExpunge(ALL_EXPUNGE_SCOPES, reply, background === true);
  });
}
