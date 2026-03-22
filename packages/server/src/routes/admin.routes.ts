// ──────────────────────────────────────────────
// Routes: Admin (clear data, maintenance)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, readdirSync, unlinkSync, rmSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";
import * as schema from "../db/schema/index.js";

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

export async function adminRoutes(app: FastifyInstance) {
  // Clear all data — nuclear option
  app.post<{ Body: { confirm: boolean } }>("/clear-all", async (req, reply) => {
    const { confirm } = req.body as { confirm?: boolean };
    if (!confirm) {
      return reply.status(400).send({ error: "Must send { confirm: true } to proceed" });
    }

    // Require ADMIN_SECRET if configured (strongly recommended)
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
      const provided = (req.headers["x-admin-secret"] as string) ?? "";
      if (provided !== adminSecret) {
        return reply.status(403).send({ error: "Invalid or missing X-Admin-Secret header" });
      }
    }

    const db = app.db;

    // Delete from all tables in dependency order using Drizzle schema objects
    const tablesToClear = [
      ["message_swipes", schema.messageSwipes],
      ["messages", schema.messages],
      ["chats", schema.chats],
      ["lorebook_entries", schema.lorebookEntries],
      ["lorebooks", schema.lorebooks],
      ["prompt_sections", schema.promptSections],
      ["prompt_groups", schema.promptGroups],
      ["choice_blocks", schema.choiceBlocks],
      ["prompt_presets", schema.promptPresets],
      ["agent_memory", schema.agentMemory],
      ["agent_runs", schema.agentRuns],
      ["agent_configs", schema.agentConfigs],
      ["game_state_snapshots", schema.gameStateSnapshots],
      ["assets", schema.assets],
      ["character_groups", schema.characterGroups],
      ["personas", schema.personas],
      ["characters", schema.characters],
      ["api_connections", schema.apiConnections],
    ] as const;

    const deleted: Record<string, number> = {};
    for (const [name, table] of tablesToClear) {
      try {
        const result = await db.delete(table).run();
        deleted[name] = (result as any)?.changes ?? 0;
      } catch {
        // Table might not exist, skip
        deleted[name] = 0;
      }
    }

    // Clear file-based data
    const filesDeleted = {
      backgrounds: clearDirectory(join(DATA_DIR, "backgrounds")),
      avatars: clearDirectory(join(DATA_DIR, "avatars")),
      sprites: clearDirectory(join(DATA_DIR, "sprites")),
    };

    return {
      success: true,
      tablesCleared: deleted,
      filesDeleted,
    };
  });
}
