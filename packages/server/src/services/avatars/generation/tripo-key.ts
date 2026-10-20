// ──────────────────────────────────────────────
// Avatar generation: a stored Tripo API key (lane: 3D generation)
// ──────────────────────────────────────────────
// One-click 3D models with Tripo were withdrawn (maintainer decision, 2026-10-19): Tripo models have no face
// rig, so their mouth can't move. A key saved for that generator stays where it is, in one app setting
// encrypted at rest: nothing shows it, uses it or sends it anywhere, it is never logged, profile exports leave
// it out (backup.routes.ts), and only Clear data's Connections scope removes it (admin.routes.ts).
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { decryptApiKey, encryptApiKey } from "../../../utils/crypto.js";
import { createAppSettingsStorage } from "../../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../../storage/connections.storage.js";

export const TRIPO_API_KEY_SETTING = "tripoApiKey";

/** The saved key, or "" when none is saved or it can't be read (it was encrypted with another encryption key). */
export async function readTripoApiKey(db: DB): Promise<string> {
  const stored = await createAppSettingsStorage(db).get(TRIPO_API_KEY_SETTING);
  return stored ? decryptApiKey(stored) : "";
}

export async function saveTripoApiKey(db: DB, apiKey: string): Promise<void> {
  await createAppSettingsStorage(db).set(TRIPO_API_KEY_SETTING, encryptApiKey(apiKey));
}

/**
 * Boot migration (app.ts chain): before the key moved to the 3D Avatars page, Tripo was a provider in
 * Connections (staging only, never released). Kept after the generator was withdrawn, so such a connection
 * still goes away without losing its key. When no key is saved yet, the first Tripo connection whose key
 * can be read gives its key; then every Tripo connection is deleted, which also clears the defaults and the
 * agent and chat settings that pointed to it. With no Tripo connection left it does nothing, so it is safe on
 * every boot (and the next boot cleans up one an old profile import brings back).
 */
export async function migrateTripoConnectionsToApiKey(db: DB): Promise<void> {
  const connections = createConnectionsStorage(db);
  // The provider is no longer a known one, so it is compared as plain text.
  const tripoIds = (await connections.list())
    .filter((row: { provider: unknown }) => String(row.provider) === "tripo")
    .map((row: { id: string }) => row.id);
  if (tripoIds.length === 0) return;

  let movedKey = false;
  if (!(await readTripoApiKey(db))) {
    for (const id of tripoIds) {
      // decryptApiKey answers "" for a key it can't read, so a broken one is skipped, never thrown.
      const apiKey = decryptApiKey((await connections.getById(id))?.apiKeyEncrypted ?? "").trim();
      if (!apiKey) continue;
      await saveTripoApiKey(db, apiKey);
      movedKey = true;
      break;
    }
  }
  for (const id of tripoIds) await connections.remove(id);
  logger.info(
    "[migration] Removed %d Tripo connection(s); %s",
    tripoIds.length,
    movedKey ? "their Tripo API key was kept in app settings" : "no Tripo API key was moved",
  );
}
